import { isFunction } from "deep-guards";
import { checkExhausted } from "niall-utils/core";
import type { Vector } from "vectyped";

import { linePlaneIntersection } from "./intersect";
import type { FillStyle, Primitive2D, StrokeStyle } from "./types";

export const IMPRECISION_THRESHOLD = 1e-5;

export function optSetStroke<A>(
  ctx: CanvasRenderingContext2D,
  style: StrokeStyle<A> | undefined,
  args: A
): void {
  if (style != null) {
    ctx.strokeStyle = isFunction(style) ? style(args) : style;
  }
}

export function optSetFill<A>(
  ctx: CanvasRenderingContext2D,
  style: FillStyle<A> | undefined,
  args: A
): void {
  if (style != null) {
    ctx.fillStyle = isFunction(style) ? style(args) : style;
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
          primitive.points.reduce((acc, point) => acc.lerp(0.5, point))
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
]): { norm: Vector<3>; d: number } {
  const norm = a.copy().sub(b).crossProduct(a.copy().sub(c)).normalise();
  return { norm, d: -norm.dot(a) };
}

export function pointsToLine(a: Vector<3>, b: Vector<3>) {
  return { norm: a.copy().sub(b).normalise(), intersect: b };
}

export function planeSide(
  point: Vector<3>,
  plane: { norm: Vector<3>; d: number }
): -1 | 0 | 1 {
  const dist = plane.norm.dot(point) + plane.d;
  return Math.abs(dist) < IMPRECISION_THRESHOLD
    ? 0
    : (Math.sign(dist) as -1 | 1);
}

export function closestPointOnPlane(
  point: Vector<3>,
  plane: { norm: Vector<3>; d: number }
): Vector<3> {
  const t =
    -(plane.norm.dot(point) + plane.d) / plane.norm.getSquaredMagnitude();
  return point.copy().add(plane.norm.copy().multiply(t));
}

export function pointsSameSide(
  a: Vector<3>,
  b: Vector<3>,
  line: { norm: Vector<3>; intersect: Vector<3> }
): boolean {
  const closestPointOnLine = linePlaneIntersection(line, {
    norm: line.norm,
    d: line.norm.dot(b),
  });
  return a.sqrDistTo(b) < a.sqrDistTo(closestPointOnLine);
}
