import { checkExhausted } from "niall-utils";
import { Vector } from "vectyped";

import { cutPolygonSignedDistances } from "./intersect";
import type { ProjectOptions } from "./project";
import {
  createLine,
  type Line,
  type Plane,
  type Polygon,
  type Primitive2D,
  type ProjectedPrimitive,
} from "./types";

function signedDistance(point: Vector<3>, plane: Plane): number {
  return plane.norm.dot(point) + plane.d;
}

interface PointDist {
  point: Vector<3>;
  dist: number;
}

function clipLineToPlane(line: Line, plane: Plane): Line[] {
  const points = line.points.map((point): PointDist => ({
    point,
    dist: signedDistance(point, plane),
  }));
  if (points.length === 0) return [];

  const first = points.at(0) as PointDist;
  const lines: Line[] = [];
  let current: Vector<3>[] = first.dist >= 0 ? [first.point] : [];

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points.at(i) as PointDist;
    const next = points.at(i + 1) as PointDist;

    if (curr.dist >= 0 !== next.dist >= 0) {
      const crossing = curr.point
        .copy()
        .lerp(curr.dist / (curr.dist - next.dist), next.point);
      current.push(crossing);
      if (current.length > 1) {
        lines.push(
          createLine({
            ...line,
            points: current,
            original: line.original ?? line,
          })
        );
      }
      current = next.dist >= 0 ? [crossing] : [];
    }
    if (next.dist >= 0) current.push(next.point);
  }
  if (current.length > 1) {
    lines.push(
      createLine({ ...line, points: current, original: line.original ?? line })
    );
  }
  return lines;
}

function clipPolygonToPlane(polygon: Polygon, plane: Plane): Polygon[] {
  const signedDistances = polygon.points.map(point =>
    signedDistance(point, plane)
  );
  if (signedDistances.every(d => d >= 0)) return [polygon];
  if (signedDistances.every(d => d < 0)) return [];

  return cutPolygonSignedDistances(polygon, signedDistances).filter(piece => {
    const centroid = Vector.zero(3)
      .add(...piece.points)
      .divide(piece.points.length);
    return signedDistance(centroid, plane) >= 0;
  });
}

// A point at exactly zero depth from the camera sits on the plane through
// the camera perpendicular to the view direction - project() divides by
// that depth to find where the point falls on the view plane, so a vertex
// placed there (as clipping exactly at depth 0 would produce) divides by
// zero and projects to NaN, silently dropping whatever it's part of.
// Clipping a hair in front of the camera instead keeps depth strictly
// positive, so every projectable point stays projectable.
//
// This isn't a geometric "close enough to coincident" tolerance (that's
// IMPRECISION_THRESHOLD, elsewhere) - it controls how far a grazing vertex's
// projected screen position can blow up, since that position scales with
// roughly 1/depth. Too small (IMPRECISION_THRESHOLD's 1e-5 measured in the
// hundreds of thousands of pixels once a scene has geometry close to the
// camera) and a fragment can end up with one vertex far enough from its
// others to visibly distort its fill shape, even though every coordinate is
// technically still finite. 0.01 world units keeps that projected distance
// in the thousands of pixels - imperceptible geometrically, but small enough
// not to visibly warp anything.
const NEAR_PLANE_EPSILON = 0.01;

export function clipPrimitivesToCamera(
  primitives: Primitive2D[],
  { dirNorm, viewPos }: ProjectOptions
): Primitive2D[] {
  const plane = {
    norm: dirNorm,
    d: -dirNorm.dot(viewPos) - NEAR_PLANE_EPSILON,
  };
  return primitives.flatMap((primitive): Primitive2D[] => {
    switch (primitive.type) {
      case "Point":
        return signedDistance(primitive.point, plane) >= 0 ? [primitive] : [];
      case "Line":
        return clipLineToPlane(primitive, plane);
      case "Polygon":
        return clipPolygonToPlane(primitive, plane);
      default:
        return checkExhausted(primitive);
    }
  });
}

function clipParamRange(
  p0: number,
  p1: number,
  min: number,
  max: number,
  tMin: number,
  tMax: number
): [number, number] | null {
  const d = p1 - p0;
  if (d === 0) {
    return p0 >= min && p0 <= max ? [tMin, tMax] : null;
  }
  const [t0, t1] =
    d > 0 ? [(min - p0) / d, (max - p0) / d] : [(max - p0) / d, (min - p0) / d];
  const newTMin = Math.max(tMin, t0);
  const newTMax = Math.min(tMax, t1);
  return newTMin <= newTMax ? [newTMin, newTMax] : null;
}

function segmentOverlapsScreen(
  p0: Vector<2>,
  p1: Vector<2>,
  screenDim: Vector<2>
): boolean {
  const xRange = clipParamRange(p0.x(), p1.x(), 0, screenDim.x(), 0, 1);
  if (xRange == null) return false;
  const yRange = clipParamRange(
    p0.y(),
    p1.y(),
    0,
    screenDim.y(),
    xRange[0],
    xRange[1]
  );
  return yRange != null;
}

export function isPrimitiveOnScreen(
  projected: ProjectedPrimitive,
  screenDim: Vector<2>
): boolean {
  if (projected.type === "Point") {
    return projected.projected.inBounds(screenDim);
  }

  const points = projected.projected;
  if (points.some(point => point.inBounds(screenDim))) {
    return true;
  }

  const edgeCount = points.length - Number(projected.type === "Polygon");
  for (let i = 0; i < edgeCount; i++) {
    const start = points.at(i) as Vector<2>;
    const end = points.at((i + 1) % points.length) as Vector<2>;
    if (segmentOverlapsScreen(start, end, screenDim)) {
      return true;
    }
  }
  return false;
}
