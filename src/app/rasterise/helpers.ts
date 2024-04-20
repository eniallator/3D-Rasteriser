import Vector from "../../core/Vector";
import { isFunction } from "../../core/guard";
import { checkExhausted } from "../../core/utils";
import { ProjectOptions } from "./project";
import { StrokeStyle, FillStyle, Primitive2D } from "./types";

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
      const avg = fromPos.copy().sub(primitive.point).getSquaredMagnitude();
      return { avg, min: avg, max: avg };
    }
    case "Line":
    case "Polygon": {
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

export function pointsToPlane([a, b, c]: [
  Vector<3>,
  Vector<3>,
  Vector<3>,
  ...Vector<3>[],
]): [Vector<3>, number] {
  const planeNormal = a.copy().sub(b).crossProduct(a.copy().sub(c));
  return [planeNormal, -planeNormal.dot(a)];
}

export function pointsToLine(a: Vector<3>, b: Vector<3>) {
  return { coefficients: a.copy().sub(b), intersect: b };
}

export function isPrimitiveOnScreen(
  _primitive: Primitive2D,
  { screenDim: _screenDim }: ProjectOptions
): boolean {
  return true;
  // const axes = tuple(screenDim.with(0, 0), screenDim.with(1, 0));
  // switch (primitive.type) {
  //   case "Point":
  //     return !primitive.projected.some(isNaN);
  //   case "Line":
  //   case "Polygon":
  //     return (
  //       primitive.projected.length > 0 &&
  //       primitive.projected.every(projected => !projected.some(isNaN))
  //     );
  // }
}
