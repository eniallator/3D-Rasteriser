import Vector from "../../core/Vector";
import { isFunction } from "../../core/guard";
import { checkExhausted, tuple } from "../../core/utils";
import {
  StrokeStyle,
  FillStyle,
  Primitive2D,
  ProjectedPrimitive,
} from "./types";

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
    case "Point":
    case "Label": {
      const avg = fromPos.copy().sub(primitive.point).getSquaredMagnitude();
      return { avg, min: avg, max: avg };
    }
    case "Line":
    case "Triangle": {
      const extremes = primitive.points.reduce(
        (acc, point) => ({
          min: Math.min(
            acc.min,
            fromPos.copy().sub(point).getSquaredMagnitude()
          ),
          max: Math.max(
            acc.max,
            fromPos.copy().sub(point).getSquaredMagnitude()
          ),
        }),
        { min: Infinity, max: -Infinity }
      );
      return {
        ...extremes,
        avg: fromPos
          .copy()
          .sub(primitive.points.reduce((acc, point) => acc.lerp(point, 0.5)))
          .getSquaredMagnitude(),
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
  const a = vecA.copy().sub(point).getMagnitude();
  const b = vecB.copy().sub(point).getMagnitude();
  const c = vecA.copy().sub(vecB).getMagnitude();

  const t = (b ** 2 - a ** 2 + c ** 2) / (2 * c);
  return vecA.lerp(vecB, t);
}

export function isProjectedOnScreen(
  projectedPrimitive: ProjectedPrimitive,
  screenDim: Vector<2>
): boolean {
  const axes = tuple(screenDim.with(0, 0), screenDim.with(1, 0));
  switch (projectedPrimitive.type) {
    case "Point":
    case "Label":
      return !projectedPrimitive.projected.some(isNaN);
    case "Line":
    case "Triangle":
      return (
        projectedPrimitive.projected.length > 0 &&
        projectedPrimitive.projected.every(projected => !projected.some(isNaN))
      );
  }
}
