import { tuple } from "niall-utils/core";
import { mapFilter } from "niall-utils/functional";

import { buildBSPTree } from "./bsp";
import {
  aabbInFrustum,
  buildBVH,
  buildFrustumPlanes,
  primitiveBounds,
  queryFrustum,
} from "./bvh";
import { clipPrimitivesToCamera, isPrimitiveOnScreen } from "./clip";
import { findSqrDist } from "./helpers";
import { resolveIntersections } from "./intersect";
import { mergePointsByDistance } from "./merge";
import { projectPrimitive, type ProjectOptions } from "./project";
import { renderPrimitive } from "./render";
import type {
  Point,
  PreparedScene,
  Primitive1D,
  Primitive2D,
  SplittablePrimitive,
} from "./types";

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
      return isPrimitiveOnScreen(projected, projectOptions.screenDim)
        ? tuple(findSqrDist(projectOptions.viewPos, primitive).avg, projected)
        : null;
    }
  )
    .sort(([a], [b]) => b - a)
    .forEach(([_, projected]) => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";

      renderPrimitive(ctx, projected, projectOptions);
    });
}

export function prepareScene(
  primitives: readonly Primitive2D[]
): PreparedScene {
  const resolved = resolveIntersections(primitives);
  // Points never enter the BSP tree/BVH - see PreparedScene's `points` field.
  const points = resolved.filter((p): p is Point => p.type === "Point");
  const shapes = resolved.filter(
    (p): p is SplittablePrimitive => p.type !== "Point"
  );
  return { tree: buildBSPTree(shapes), bvh: buildBVH(shapes), points };
}

export function renderPrepared(
  { tree, bvh, points }: PreparedScene,
  projectOptions: ProjectOptions,
  { ctx, defaultFill, defaultStroke, defaultFont }: RenderOptions
): void {
  const frustumPlanes = buildFrustumPlanes(projectOptions);
  // Primitives that survive the BSP tree's straddling splits are new objects,
  // not the ones the BVH indexed, so a reference-based Set lookup would drop
  // them; fall back to a direct bounds check for anything the Set misses.
  const visible = new Set(queryFrustum(bvh, frustumPlanes));
  const visiblePoints = points.filter(point =>
    aabbInFrustum(primitiveBounds(point), frustumPlanes)
  );

  const merged = mergePointsByDistance(
    tree,
    visiblePoints,
    projectOptions.viewPos
  ).filter(
    primitive =>
      primitive.type === "Point" ||
      visible.has(primitive) ||
      aabbInFrustum(primitiveBounds(primitive), frustumPlanes)
  );

  clipPrimitivesToCamera(merged, projectOptions)
    .map(primitive => projectPrimitive(primitive, projectOptions))
    .filter(projected =>
      isPrimitiveOnScreen(projected, projectOptions.screenDim)
    )
    .forEach(projected => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";
      renderPrimitive(ctx, projected, projectOptions);
    });
}

export function fullPipeline(
  primitives: Primitive2D[],
  projectOptions: ProjectOptions,
  renderOptions: RenderOptions
): void {
  renderPrepared(prepareScene(primitives), projectOptions, renderOptions);
}
