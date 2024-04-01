import Monad from "../../core/monad";
import { filterAndMap, tuple } from "../../core/utils";
import { findSqrDist, isProjectedOnScreen } from "./helpers";
import { ProjectOptions, projectPrimitive } from "./project";
import { RenderFn, renderFnMap } from "./render";
import { Primitive2D, Primitive1D } from "./types";

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
    const projectedPrimitive = projectPrimitive(primitive, projectOptions);
    return projectedPrimitive != null &&
      isProjectedOnScreen(projectedPrimitive, projectOptions.screenDim)
      ? tuple(
          findSqrDist(projectOptions.viewPos, primitive).avg,
          projectedPrimitive
        )
      : null;
  })
    .sort(([a], [b]) => b - a)
    .forEach(([_, projected]) => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";

      const render = renderFnMap[projected.primitive.type] as RenderFn<
        typeof projected
      >;
      render(ctx, projected);
    });
}

export function fullPipeline(
  primitives: Primitive2D[],
  projectOptions: ProjectOptions,
  { ctx, defaultFill, defaultStroke, defaultFont }: RenderOptions
): void {
  Monad.from(primitives)
    .map(primitives =>
      filterAndMap(primitives, (primitive: Primitive2D) => {
        const projectedPrimitive = projectPrimitive(primitive, projectOptions);
        return isProjectedOnScreen(projectedPrimitive, projectOptions.screenDim)
          ? tuple(
              findSqrDist(projectOptions.viewPos, primitive),
              projectedPrimitive
            )
          : null;
      }).sort(([a], [b]) => b.avg - a.avg)
    )
    .map(projectedData => {
      const hiddenIndices = new Set<number>();
      const resolvedIntersections = filterAndMap(
        projectedData,
        ([measurements, projected], _, others) => {
          return projected.type === "Triangle"
            ? others.reduce((acc, other) => acc, projected)
            : projected;
        }
      );
      return resolvedIntersections.filter((_, i) => !hiddenIndices.has(i));
    });
}
