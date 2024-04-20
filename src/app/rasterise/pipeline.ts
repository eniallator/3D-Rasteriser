import Vector from "../../core/Vector";
import { filterAndMap, tuple } from "../../core/utils";
import {
  findSqrDist,
  isPrimitiveOnScreen,
  pointsToLine,
  pointsToPlane,
} from "./helpers";
import { linePlaneIntersection, resolveIntersections } from "./intersect";
import { ProjectOptions, projectPrimitive } from "./project";
import { renderPrimitive } from "./render";
import { Primitive1D, Primitive2D } from "./types";

interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  defaultFill?: CanvasFillStrokeStyles["fillStyle"];
  defaultStroke?: CanvasFillStrokeStyles["strokeStyle"];
  defaultFont?: string;
}

export function naivePipeline(
  primitives: Primitive1D[],
  projectOptions: ProjectOptions,
  { ctx, defaultFill, defaultStroke, defaultFont }: RenderOptions
): void {
  filterAndMap(primitives, (primitive: Primitive1D) => {
    return isPrimitiveOnScreen(primitive, projectOptions)
      ? tuple(
          findSqrDist(projectOptions.viewPos, primitive).avg,
          projectPrimitive(primitive, projectOptions)
        )
      : null;
  })
    .sort(([a], [b]) => b - a)
    .forEach(([_, projected]) => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";

      renderPrimitive(ctx, projected);
    });
}

export function fullPipeline(
  primitives: Primitive2D[],
  projectOptions: ProjectOptions,
  { ctx, defaultFill, defaultStroke, defaultFont }: RenderOptions
): void {
  resolveIntersections(primitives)
    .map((primitive, index) => {
      const center =
        primitive.type === "Point"
          ? primitive.point
          : Vector.zero(3)
              .add(...primitive.points)
              .divide(primitive.points.length);
      return {
        primitive,
        index,
        center,
        distToCenterSqr: projectOptions.viewPos
          .copy()
          .sub(center)
          .getSquaredMagnitude(),
      };
    })
    .sort((a, b) => {
      const sign = a.distToCenterSqr < b.distToCenterSqr ? 1 : -1;
      const [first, second] = a.index < b.index ? [a, b] : [b, a];
      if (
        first.primitive.type === "Polygon" &&
        second.primitive.type === "Polygon"
      ) {
        return (
          sign *
          (first.distToCenterSqr -
            linePlaneIntersection(
              pointsToLine(projectOptions.viewPos, first.center),
              pointsToPlane(second.primitive.points)
            )
              .sub(projectOptions.viewPos)
              .getSquaredMagnitude())
        );
      }
      return sign * (b.distToCenterSqr - a.distToCenterSqr);
    })
    .forEach(({ primitive }) => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";
      renderPrimitive(ctx, projectPrimitive(primitive, projectOptions));
    });
}
