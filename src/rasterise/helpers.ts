import { isFunction } from "deep-guards";
import { checkExhausted } from "niall-utils/core";
import { Vector } from "vectyped";

import type { AABB, FillStyle, Plane, Primitive2D, StrokeStyle } from "./types";

export const IMPRECISION_THRESHOLD = 1e-5;

export function optSetStroke<A extends readonly unknown[]>(
  ctx: CanvasRenderingContext2D,
  style: StrokeStyle<A> | undefined,
  args: A
): void {
  if (style != null) {
    ctx.strokeStyle = isFunction(style) ? style(...args) : style;
  }
}

export function optSetFill<A extends readonly unknown[]>(
  ctx: CanvasRenderingContext2D,
  style: FillStyle<A> | undefined,
  args: A
): void {
  if (style != null) {
    ctx.fillStyle = isFunction(style) ? style(...args) : style;
  }
}

export function findSqrDist(
  fromPos: Vector<3>,
  primitive: Primitive2D
): { avg: number; min: number; max: number } {
  switch (primitive.type) {
    case "Point": {
      const sqrDist = fromPos.sqrDistTo(primitive.point);
      return { avg: sqrDist, min: sqrDist, max: sqrDist };
    }
    case "Line":
    case "Polygon": {
      const extremes = primitive.points.reduce(
        (acc, point) => ({
          min: Math.min(acc.min, fromPos.sqrDistTo(point)),
          max: Math.max(acc.max, fromPos.sqrDistTo(point)),
        }),
        { min: Infinity, max: -Infinity }
      );
      return {
        ...extremes,
        avg: fromPos.sqrDistTo(
          Vector.zero(3)
            .add(...primitive.points)
            .divide(primitive.points.length)
        ),
      };
    }

    default:
      return checkExhausted(primitive);
  }
}

export function intersect<N extends number>(
  vecA: Vector<N>,
  vecB: Vector<N>,
  point: Vector<N>
): Vector<N> {
  const aSqr = vecA.sqrDistTo(point);
  const bSqr = vecB.sqrDistTo(point);
  const cSqr = vecA.sqrDistTo(vecB);

  const t = (aSqr - bSqr + cSqr) / (2 * cSqr);
  return vecA.lerp(t, vecB);
}

// c_x * x + c_y * y + c_z * z + d = 0
export function pointsToPlane([a, b, c]: [
  Vector<3>,
  Vector<3>,
  Vector<3>,
  ...Vector<3>[],
]): Plane {
  const norm = a.copy().sub(b).crossProduct(a.copy().sub(c)).normalise();
  return { norm, d: -norm.dot(a) };
}

export function planeSide(point: Vector<3>, plane: Plane): -1 | 0 | 1 {
  const dist = plane.norm.dot(point) + plane.d;
  return Math.abs(dist) < IMPRECISION_THRESHOLD
    ? 0
    : (Math.sign(dist) as -1 | 1);
}

export function boundsOf<N extends number>(points: Vector<N>[]): AABB<N> {
  const first = points.at(0) as Vector<N>;
  return points.slice(1).reduce(
    (acc, point) => ({
      min: acc.min.min(point),
      max: acc.max.max(point),
    }),
    { min: first.copy(), max: first.copy() }
  );
}

export function boundsOverlap<N extends number>(
  a: AABB<N>,
  b: AABB<N>
): boolean {
  const aSize = a.max.copy().sub(a.min);
  return a.min.inBounds(
    b.max.copy().sub(b.min).add(aSize).add(IMPRECISION_THRESHOLD),
    b.min.copy().sub(aSize)
  );
}
