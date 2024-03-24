import Vector from "../../core/Vector";
import { isFunction } from "../../core/guard";
import { checkExhausted } from "../../core/utils";
import { StrokeStyle, FillStyle, Geometry, ProjectedGeometry } from "./types";

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
  geometry: Geometry
): { avg: number; min: number; max: number } {
  switch (geometry.type) {
    case "Point":
    case "Label": {
      const avg = fromPos.copy().sub(geometry.point).getSquaredMagnitude();
      return { avg, min: avg, max: avg };
    }
    case "Line":
    case "Triangle": {
      const extremes = geometry.points.reduce(
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
          .sub(geometry.points.reduce((acc, point) => acc.lerp(point, 0.5)))
          .getSquaredMagnitude(),
      };
    }

    default:
      return checkExhausted(geometry);
  }
}

export function intersect(
  vecA: Vector<3>,
  vecB: Vector<3>,
  point: Vector<3>
): [Vector<3>, boolean] {
  const a = vecA.copy().sub(point).getMagnitude();
  const b = vecB.copy().sub(point).getMagnitude();
  const c = vecA.copy().sub(vecB).getMagnitude();

  const t = (b ** 2 - a ** 2 + c ** 2) / (2 * c);
  return [vecA.lerp(vecB, t), 0 <= t && t <= 1];
}

export function isProjectedOnScreen(
  projectedGeometry: ProjectedGeometry,
  // Test if the projected is overlapping the screen dim and if not, return false
  _screenDim: Vector<2>
): boolean {
  switch (projectedGeometry.type) {
    case "Point":
    case "Label":
      return !projectedGeometry.projected.some(isNaN);
    case "Line":
    case "Triangle":
      return (
        projectedGeometry.projected.length > 0 &&
        projectedGeometry.projected.every(projected => !projected.some(isNaN))
      );
  }
}
