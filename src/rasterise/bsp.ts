import { checkExhausted, tuple } from "niall-utils";
import { Vector } from "vectyped";

import { IMPRECISION_THRESHOLD, planeSide, pointsToPlane } from "./helpers";
import { cutPolygonSignedDistances } from "./intersect";
import {
  createLine,
  type BSPNode,
  type Line,
  type Plane,
  type Polygon,
  type SplittablePrimitive,
} from "./types";

type Side = "front" | "back" | "coplanar" | "straddling";

const foldSide = (side: Side, sideFn: Partial<Record<Side, () => void>>) => {
  sideFn[side]?.();
};

interface Classification {
  side: Side;
  // signed distance of each point, in the same order - reused by the split
  // functions below so straddling primitives don't get re-measured.
  distances: number[];
}

function classifyPoints(points: Vector<3>[], plane: Plane): Classification {
  const distances = points.map(point => plane.norm.dot(point) + plane.d);
  const hasFront = distances.some(dist => dist > IMPRECISION_THRESHOLD);
  const hasBack = distances.some(dist => dist < -IMPRECISION_THRESHOLD);

  const side: Side =
    hasFront && hasBack
      ? "straddling"
      : hasFront
        ? "front"
        : hasBack
          ? "back"
          : "coplanar";
  return { side, distances };
}

interface PointDist {
  point: Vector<3>;
  dist: number;
}

function splitLineByPlane(
  line: Line,
  distances: number[]
): { front: Line[]; back: Line[] } {
  const points = line.points.map((point, i): PointDist => ({
    point,
    dist: distances[i] as number,
  }));
  const front: Line[] = [];
  const back: Line[] = [];
  if (points.length === 0) return { front, back };

  const first = points.at(0) as PointDist;
  let current: Vector<3>[] = [first.point];
  let currentIsFront = first.dist >= 0;

  const flush = (): void => {
    if (current.length > 1) {
      (currentIsFront ? front : back).push(
        createLine({
          ...line,
          points: current,
          original: line.original ?? line,
        })
      );
    }
  };

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points.at(i) as PointDist;
    const next = points.at(i + 1) as PointDist;
    const nextIsFront = next.dist >= 0;

    if (curr.dist >= 0 !== nextIsFront) {
      const crossing = curr.point
        .copy()
        .lerp(curr.dist / (curr.dist - next.dist), next.point);
      current.push(crossing);
      flush();
      current = [crossing];
      currentIsFront = nextIsFront;
    }
    current.push(next.point);
  }
  flush();

  return { front, back };
}

function splitPolygonByPlane(
  polygon: Polygon,
  distances: number[],
  plane: Plane
): { front: Polygon[]; back: Polygon[] } {
  const front: Polygon[] = [];
  const back: Polygon[] = [];
  for (const piece of cutPolygonSignedDistances(polygon, distances)) {
    const centroid = Vector.zero(3)
      .add(...piece.points)
      .divide(piece.points.length);
    (planeSide(centroid, plane) >= 0 ? front : back).push(piece);
  }
  return { front, back };
}

function classifySideOnly(points: Vector<3>[], plane: Plane): Side {
  let hasFront = false;
  let hasBack = false;
  for (const point of points) {
    const dist = plane.norm.dot(point) + plane.d;
    if (dist > IMPRECISION_THRESHOLD) hasFront = true;
    else if (dist < -IMPRECISION_THRESHOLD) hasBack = true;
    if (hasFront && hasBack) return "straddling";
  }
  if (hasFront) return "front";
  if (hasBack) return "back";
  return "coplanar";
}

const MAX_SPLITTER_CANDIDATES = 20;

// Deterministic (not random) so that rebuilding the tree for the same scene
// - which happens every frame for animated scenes - always picks the same
// splitter candidates. Random sampling here made the whole tree shape, and
// therefore where static geometry gets cut into pieces, change every frame.
export function sampleIndices(poolSize: number, count: number): number[] {
  if (poolSize <= count) {
    return Array.from({ length: poolSize }, (_, i) => i);
  }

  return Array.from({ length: count }, (_, i) =>
    Math.floor((i * poolSize) / count)
  );
}

type PrimitiveEntry = [number, SplittablePrimitive];
type PolygonEntry = [number, Polygon];

function pickBestSplitter(
  candidateEntries: PolygonEntry[],
  primitives: SplittablePrimitive[]
): PolygonEntry {
  const sampled = sampleIndices(
    candidateEntries.length,
    MAX_SPLITTER_CANDIDATES
  ).map(i => candidateEntries[i] as PolygonEntry);

  let best = sampled[0] as PolygonEntry;
  let bestImbalance = Infinity;

  for (const candidateEntry of sampled) {
    const [, candidate] = candidateEntry;
    const plane = pointsToPlane(candidate.points);
    let front = 0;
    let back = 0;

    for (const primitive of primitives) {
      if (primitive === candidate) continue;

      foldSide(classifySideOnly(primitive.points, plane), {
        front: () => front++,
        back: () => back++,
        straddling: () => {
          front++;
          back++;
        },
      });
    }

    const imbalance = Math.abs(front - back);
    if (imbalance < bestImbalance) {
      bestImbalance = imbalance;
      best = candidateEntry;
      if (imbalance === 0) break;
    }
  }

  return best;
}

function buildBSPTreeEntries(primitiveEntries: PrimitiveEntry[]): BSPNode {
  const polygonEntries = primitiveEntries.filter(
    (entry): entry is PolygonEntry => entry[1].type === "Polygon"
  );
  if (polygonEntries.length === 0) {
    return {
      type: "leaf",
      primitives: primitiveEntries.map(([, primitive]) => primitive),
    };
  }

  const primitives = primitiveEntries.map(([, primitive]) => primitive);
  const [splitterIndex, splitter] = pickBestSplitter(
    polygonEntries,
    primitives
  );
  const plane = pointsToPlane(splitter.points);
  const coplanarEntries: PrimitiveEntry[] = [tuple(splitterIndex, splitter)];
  const frontEntries: PrimitiveEntry[] = [];
  const backEntries: PrimitiveEntry[] = [];

  for (const [originalIndex, primitive] of primitiveEntries) {
    if (primitive === splitter) continue;

    switch (primitive.type) {
      case "Line": {
        const { side, distances } = classifyPoints(primitive.points, plane);
        foldSide(side, {
          front: () => frontEntries.push(tuple(originalIndex, primitive)),
          back: () => backEntries.push(tuple(originalIndex, primitive)),
          coplanar: () => coplanarEntries.push(tuple(originalIndex, primitive)),
          straddling: () => {
            const split = splitLineByPlane(primitive, distances);
            frontEntries.push(
              ...split.front.map(line => tuple(originalIndex, line))
            );
            backEntries.push(
              ...split.back.map(line => tuple(originalIndex, line))
            );
          },
        });
        break;
      }
      case "Polygon": {
        const { side, distances } = classifyPoints(primitive.points, plane);
        foldSide(side, {
          front: () => frontEntries.push(tuple(originalIndex, primitive)),
          back: () => backEntries.push(tuple(originalIndex, primitive)),
          coplanar: () => coplanarEntries.push(tuple(originalIndex, primitive)),
          straddling: () => {
            const split = splitPolygonByPlane(primitive, distances, plane);
            frontEntries.push(
              ...split.front.map(poly => tuple(originalIndex, poly))
            );
            backEntries.push(
              ...split.back.map(poly => tuple(originalIndex, poly))
            );
          },
        });
        break;
      }
      default:
        checkExhausted(primitive);
    }
  }

  coplanarEntries.sort(([a], [b]) => a - b);

  return {
    type: "branch",
    plane,
    coplanar: coplanarEntries.map(([, primitive]) => primitive),
    left: buildBSPTreeEntries(frontEntries),
    right: buildBSPTreeEntries(backEntries),
  };
}

export function buildBSPTree(primitives: SplittablePrimitive[]): BSPNode {
  return buildBSPTreeEntries(primitives.entries().toArray());
}

export function traverseBackToFront(
  node: BSPNode,
  viewPos: Vector<3>
): SplittablePrimitive[] {
  if (node.type === "leaf") return node.primitives;

  const eyeSide = planeSide(viewPos, node.plane);
  return eyeSide < 0
    ? [
        ...traverseBackToFront(node.left, viewPos),
        ...node.coplanar,
        ...traverseBackToFront(node.right, viewPos),
      ]
    : [
        ...traverseBackToFront(node.right, viewPos),
        ...node.coplanar,
        ...traverseBackToFront(node.left, viewPos),
      ];
}
