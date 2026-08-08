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

function cameraPlane({ viewPos, dirNorm }: ProjectOptions): Plane {
  return { norm: dirNorm, d: -dirNorm.dot(viewPos) };
}

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
        lines.push(createLine({ ...line, points: current }));
      }
      current = next.dist >= 0 ? [crossing] : [];
    }
    if (next.dist >= 0) current.push(next.point);
  }
  if (current.length > 1) {
    lines.push(createLine({ ...line, points: current }));
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

export function clipPrimitivesToCamera(
  primitives: Primitive2D[],
  projectOptions: ProjectOptions
): Primitive2D[] {
  const plane = cameraPlane(projectOptions);
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
  projectOptions: ProjectOptions
): boolean {
  if (projected.type === "Point") {
    return projected.projected.inBounds(projectOptions.screenDim);
  }

  const points = projected.projected;
  if (points.some(point => point.inBounds(projectOptions.screenDim))) {
    return true;
  }

  const edgeCount =
    projected.type === "Polygon" ? points.length : points.length - 1;
  for (let i = 0; i < edgeCount; i++) {
    const start = points.at(i) as Vector<2>;
    const end = points.at((i + 1) % points.length) as Vector<2>;
    if (segmentOverlapsScreen(start, end, projectOptions.screenDim)) {
      return true;
    }
  }
  return false;
}
