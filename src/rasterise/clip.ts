import { checkExhausted } from "niall-utils";
import { Vector } from "vectyped";

import { cutPolygonSignedDistances } from "./intersect";
import type { ProjectOptions } from "./project";
import {
  createLine,
  type Line,
  type Polygon,
  type Primitive2D,
  type ProjectedPrimitive,
} from "./types";

function cameraPlane({
  viewPos,
  dirNorm,
}: ProjectOptions): { norm: Vector<3>; d: number } {
  return { norm: dirNorm, d: -dirNorm.dot(viewPos) };
}

function signedDistance(
  point: Vector<3>,
  plane: { norm: Vector<3>; d: number }
): number {
  return plane.norm.dot(point) + plane.d;
}

interface PointDist {
  point: Vector<3>;
  dist: number;
}

function clipLineToPlane(
  line: Line,
  plane: { norm: Vector<3>; d: number }
): Line[] {
  const points = line.points.map(
    (point): PointDist => ({ point, dist: signedDistance(point, plane) })
  );
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

function clipPolygonToPlane(
  polygon: Polygon,
  plane: { norm: Vector<3>; d: number }
): Polygon[] {
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

// Discards anything entirely behind the camera and cuts primitives that
// straddle the near plane so only the in-front portion survives.
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

// TODO: Doesn't take into account the edges which could overlap the viewport
export function isPrimitiveOnScreen(
  projected: ProjectedPrimitive,
  projectOptions: ProjectOptions
): boolean {
  if (projected.type === "Point") {
    return projected.projected.inBounds(projectOptions.screenDim);
  }
  return projected.projected.some(point =>
    point.inBounds(projectOptions.screenDim)
  );
}
