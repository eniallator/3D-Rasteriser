import { tuple } from "niall-utils/core";
import { mapFilter } from "niall-utils/functional";
import { Vector } from "vectyped";

import { clipPrimitivesToCamera, isPrimitiveOnScreen } from "./clip";
import { findSqrDist, planeSide, pointsToPlane } from "./helpers";
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
  resolveIntersections(
    clipPrimitivesToCamera(primitives, projectOptions),
    projectOptions
  )
    .map(primitive => projectPrimitive(primitive, projectOptions))
    .filter(projected => isPrimitiveOnScreen(projected, projectOptions))
    .map(projected => {
      const { primitive } = projected;
      const center =
        primitive.type === "Point"
          ? primitive.point
          : Vector.zero(3)
              .add(...primitive.points)
              .divide(primitive.points.length);
      return {
        projected,
        center,
        sqrDist: projectOptions.viewPos.sqrDistTo(center),
      };
    })
    .sort((a, b) => {
      if (
        a.projected.primitive.type === "Polygon" &&
        b.projected.primitive.type === "Polygon"
      ) {
        const aPlane = pointsToPlane(a.projected.primitive.points);
        const bPlane = pointsToPlane(b.projected.primitive.points);

        const eyeSideA = planeSide(projectOptions.viewPos, aPlane);
        const bSideA = planeSide(b.center, aPlane);
        if (eyeSideA !== 0 && bSideA !== 0) {
          return eyeSideA === bSideA ? -1 : 1;
        }

        const eyeSideB = planeSide(projectOptions.viewPos, bPlane);
        const aSideB = planeSide(a.center, bPlane);
        if (eyeSideB !== 0 && aSideB !== 0) {
          return eyeSideB === aSideB ? 1 : -1;
        }

        return b.sqrDist - a.sqrDist;
      } else {
        return b.sqrDist - a.sqrDist;
      }
    })
    .forEach(({ projected }) => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";
      renderPrimitive(ctx, projected);
    });
}
