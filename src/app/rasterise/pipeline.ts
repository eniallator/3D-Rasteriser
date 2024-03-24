import { filterAndMap } from "../../core/utils";
import { findSqrDist, isProjectedOnScreen } from "./helpers";
import { ProjectOptions, projectGeometry } from "./project";
import { RenderFn, renderFnMap } from "./render";
import { Geometry, Geometry1D, ToProjected, isGeometry1D } from "./types";

interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  defaultFill?: CanvasFillStrokeStyles["fillStyle"];
  defaultStroke?: CanvasFillStrokeStyles["strokeStyle"];
  defaultFont?: string;
}

export function naivePipeline(
  geometries: Geometry1D[],
  projectOptions: ProjectOptions,
  { ctx, defaultFill, defaultStroke, defaultFont }: RenderOptions
): void {
  filterAndMap(
    geometries,
    <G extends Geometry1D>(geometry: G): [number, ToProjected<G>] | null => {
      const projectedGeometry = isGeometry1D(geometry)
        ? projectGeometry(geometry, projectOptions)
        : null;
      return projectedGeometry != null &&
        isProjectedOnScreen(projectedGeometry, projectOptions.screenDim)
        ? [findSqrDist(projectOptions.viewPos, geometry).avg, projectedGeometry]
        : null;
    }
  )
    .sort(([a], [b]) => b - a)
    .forEach(([_, projected]) => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";

      const render = renderFnMap[projected.geometry.type] as RenderFn<
        typeof projected
      >;
      render(ctx, projected);
    });
}

export function fullPipeline(
  geometries: Geometry[],
  projectOptions: ProjectOptions,
  { ctx, defaultFill, defaultStroke, defaultFont }: RenderOptions
): void {
  filterAndMap(
    geometries,
    <G extends Geometry>(
      geometry: G
    ): [ReturnType<typeof findSqrDist>, ToProjected<G>] | null => {
      const projectedGeometry = projectGeometry(geometry, projectOptions);
      return isProjectedOnScreen(projectedGeometry, projectOptions.screenDim)
        ? [findSqrDist(projectOptions.viewPos, geometry), projectedGeometry]
        : null;
    }
  );
}
