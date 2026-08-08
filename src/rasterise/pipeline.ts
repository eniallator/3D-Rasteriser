import { tuple } from "niall-utils/core";
import { mapFilter } from "niall-utils/functional";

import { buildBSPTree, traverseBackToFront } from "./bsp";
import { clipPrimitivesToCamera, isPrimitiveOnScreen } from "./clip";
import { findSqrDist } from "./helpers";
import { resolveIntersections } from "./intersect";
import { projectPrimitive, type ProjectOptions } from "./project";
import { renderPrimitive } from "./render";
import type { Primitive1D, Primitive2D } from "./types";

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
  mapFilter(
    clipPrimitivesToCamera(primitives, projectOptions) as Primitive1D[],
    (primitive: Primitive1D) => {
      const projected = projectPrimitive(primitive, projectOptions);
      return isPrimitiveOnScreen(projected, projectOptions)
        ? tuple(findSqrDist(projectOptions.viewPos, primitive).avg, projected)
        : null;
    }
  )
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
  const resolved = resolveIntersections(
    clipPrimitivesToCamera(primitives, projectOptions),
    projectOptions
  );
  const tree = buildBSPTree(resolved);

  traverseBackToFront(tree, projectOptions.viewPos)
    .map(primitive => projectPrimitive(primitive, projectOptions))
    .filter(projected => isPrimitiveOnScreen(projected, projectOptions))
    .forEach(projected => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";
      renderPrimitive(ctx, projected);
    });
}
