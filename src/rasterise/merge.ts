import { tuple } from "niall-utils/core";
import type { Vector } from "vectyped";

import {
  boundsOf,
  findSqrDist,
  IMPRECISION_THRESHOLD,
  planeSide,
  pointsToPlane,
  rayPlaneIntersectionT,
} from "./helpers";
import { isPointInPolygon } from "./intersect";
import type {
  AABB,
  BSPNode,
  Plane,
  Point,
  Primitive2D,
  SplittablePrimitive,
} from "./types";

// 0 if `point` is inside `bounds`, otherwise the straight-line distance to
// the nearest point on it.
function distanceToBounds(point: Vector<3>, bounds: AABB<3>): number {
  return point
    .map((n, i) =>
      Math.max(bounds.min.valueOf(i) - n, 0, n - bounds.max.valueOf(i))
    )
    .getMagnitude();
}

function mergeLeafPoints(
  primitives: Primitive2D[],
  points: Point[],
  viewPos: Vector<3>
): Primitive2D[] {
  if (points.length === 0) return primitives;
  return [...primitives, ...points]
    .map(primitive => tuple(findSqrDist(viewPos, primitive).avg, primitive))
    .sort(([a], [b]) => b - a)
    .map(([, primitive]) => primitive);
}

// The splitter that produced this branch's plane is always a Polygon (see
// bsp.ts's pickBestSplitter) and is always present in `coplanar`, but it may
// itself be a fragment of some larger original polygon - re-deriving a plane
// from the original's points instead of the fragment's avoids the floating-
// point drift that repeated lerp-cutting accumulates.
function originalPlaneFor(node: BSPNode & { type: "branch" }): Plane {
  const splitter = node.coplanar.find(p => p.type === "Polygon");
  return splitter == null
    ? node.plane
    : pointsToPlane((splitter.original ?? splitter).points);
}

// Points can't be split like a Polygon or Line, so they never enter the BSP
// tree during construction (see PreparedScene's `points` field) - but the
// same tree, walked again here with each point classified against the real
// planes along its path, places it exactly where a splittable primitive at
// that position would land. Recursing to a leaf means a point only ever
// gets directly distance-compared against the small, spatially coherent
// handful of primitives sharing its leaf, never the whole scene.
//
// This alone isn't perfectly precise - see enforceFragmentConsistency below
// for why - but it gives a good starting position, which is all that's
// needed here.
function mergeIntoTree(
  tree: BSPNode,
  points: Point[],
  viewPos: Vector<3>
): Primitive2D[] {
  if (tree.type === "leaf") {
    return mergeLeafPoints(tree.primitives, points, viewPos);
  }

  // Skip the plane lookup for branches with no points to classify - most
  // of them, since points split further apart with every level.
  let frontPoints: Point[] = [];
  let backPoints: Point[] = [];
  if (points.length > 0) {
    const plane = originalPlaneFor(tree);
    frontPoints = points.filter(p => planeSide(p.point, plane) >= 0);
    backPoints = points.filter(p => planeSide(p.point, plane) < 0);
  }

  // Farthest-first: whichever side is opposite the eye is drawn first -
  // exactly the same rule bsp.ts's traverseBackToFront uses for real
  // primitives, applied here to points instead.
  const eyeSide = planeSide(viewPos, tree.plane);
  return eyeSide < 0
    ? [
        ...mergeIntoTree(tree.left, frontPoints, viewPos),
        ...tree.coplanar,
        ...mergeIntoTree(tree.right, backPoints, viewPos),
      ]
    : [
        ...mergeIntoTree(tree.right, backPoints, viewPos),
        ...tree.coplanar,
        ...mergeIntoTree(tree.left, frontPoints, viewPos),
      ];
}

// Lines have no silhouette to test a Point's relevance against (no
// reliable plane, just a path), so they still fall back to a bounding-box
// proximity proxy: within this distance of the *actual* extent of the
// line's points is "close enough to matter", vs. e.g. two unrelated lines
// that happen to pass near each other's endpoints while running in
// completely different directions.
const MAX_RELEVANT_DISTANCE = 1.5;

interface Constraint {
  behind: boolean;
  distance: number;
  indices: number[];
}

// Classifies `point` against `original`: whether it's close enough to
// matter, which side it's behind, and how far away it is (used to
// prioritise which of several nearby originals wins if they disagree - see
// enforceFragmentConsistency).
//
// For a Polygon, this is an exact ray/silhouette test rather than a
// proximity heuristic: cast the ray from the eye through the Point, find
// where it crosses the polygon's own (whole, unsplit) plane, and check
// whether that crossing point actually lands inside the polygon's
// boundary - the same test a real depth buffer would do, restricted to
// the one ray this Point defines. A Point can be geometrically "close" to
// a polygon's bounding box while nowhere near its actual footprint (e.g.
// near the plane of a cube face that's far away in the other two axes) -
// that's a false positive under distance-to-bounds, but this ray never
// crosses the polygon's silhouette, so it's correctly excluded regardless
// of 3D proximity.
function constraintFor(
  point: Point,
  original: SplittablePrimitive,
  indices: number[],
  viewPos: Vector<3>
): Constraint | null {
  if (original.type === "Line") {
    // Lines don't reliably have 3+ non-collinear points for a plane, so
    // there's no equivalent side test - fall back to distance from the eye.
    const distance = distanceToBounds(point.point, boundsOf(original.points));
    if (distance >= MAX_RELEVANT_DISTANCE) return null;
    const behind =
      findSqrDist(viewPos, point).avg > findSqrDist(viewPos, original).avg;
    return { behind, distance, indices };
  }

  const plane = pointsToPlane(original.points);
  const dir = point.point.copy().sub(viewPos);
  const t = rayPlaneIntersectionT(viewPos, dir, plane);
  // t <= 0: the plane crosses at or behind the eye, so it can't lie
  // between the eye and the Point - not a real occluder for this ray.
  if (t == null || t <= IMPRECISION_THRESHOLD) return null;

  const distance = Math.abs(t - 1) * dir.getMagnitude();
  // The Point sits essentially on the polygon's own surface - too close
  // to call a side without floating-point noise deciding it.
  if (distance < IMPRECISION_THRESHOLD) return null;

  const crossing = viewPos.copy().add(dir.copy().multiply(t));
  if (!isPointInPolygon(crossing, original, plane)) return null;

  return { behind: t < 1, distance, indices };
}

// mergeIntoTree() places each shape independently, following whatever
// planes happen to lie along its own path through the tree - planes chosen
// for other, unrelated primitives entirely. Even a single, never-split
// polygon can end up on the wrong side of a nearby Point this way, if it
// never itself became a splitter anywhere along the Point's path; a
// polygon the BSP tree cut into several fragments (e.g. a log's face
// cutting through a flame silhouette along an axis that has nothing to do
// with the flame's true depth) is just the sharpest version of the same
// problem, since each fragment can independently land on either side. This
// pass corrects both the same way: for every distinct shape still present
// in the merged result (its whole original, if it's a fragment - every
// fragment of one original is always resolved together), the Point is
// confined to whichever side - before all of it, or after all of it - the
// *original* geometry actually puts it on.
//
// A Point can be near more than one such shape at once (e.g. a flame and a
// log both close to its glow), and their constraints can disagree - in
// that case the *closer* shape wins and the farther one is dropped, since
// it's the one actually adjacent to the Point on screen.
function enforceFragmentConsistency(
  initial: Primitive2D[],
  viewPos: Vector<3>
): Primitive2D[] {
  let result = initial;

  for (const point of initial) {
    if (point.type !== "Point") continue;

    const currentIdx = result.indexOf(point);
    const withoutPoint = result.filter(p => p !== point);

    const fragmentsByOriginal = new Map<SplittablePrimitive, number[]>();
    for (const [i, p] of withoutPoint.entries()) {
      if (p.type === "Point") continue;
      const original = p.original ?? p;
      const indices = fragmentsByOriginal.get(original);
      if (indices == null) fragmentsByOriginal.set(original, [i]);
      else indices.push(i);
    }

    const constraints = [...fragmentsByOriginal.entries()]
      .map(([original, indices]) =>
        constraintFor(point, original, indices, viewPos)
      )
      .filter(c => c != null)
      .sort((a, b) => a.distance - b.distance);

    let lowerBound = 0;
    let upperBound = withoutPoint.length;
    for (const { behind, indices } of constraints) {
      const nextLower = behind
        ? lowerBound
        : Math.max(lowerBound, Math.max(...indices) + 1);
      const nextUpper = behind
        ? Math.min(upperBound, Math.min(...indices))
        : upperBound;
      if (nextLower > nextUpper) continue; // farther, conflicting - drop it
      lowerBound = nextLower;
      upperBound = nextUpper;
    }

    const insertAt = Math.max(lowerBound, Math.min(currentIdx, upperBound));
    result = withoutPoint.toSpliced(insertAt, 0, point);
  }

  return result;
}

export function mergePointsByDistance(
  tree: BSPNode,
  points: Point[],
  viewPos: Vector<3>
): Primitive2D[] {
  return enforceFragmentConsistency(
    mergeIntoTree(tree, points, viewPos),
    viewPos
  );
}
