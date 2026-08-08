import { tuple } from "niall-utils/core";
import { mapFilter } from "niall-utils/functional";
import { Vector } from "vectyped";

import {
  closestPointOnPlane,
  findSqrDist,
  IMPRECISION_THRESHOLD,
  isPrimitiveOnScreen,
  pointsToPlane,
} from "./helpers";
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
  mapFilter(primitives, (primitive: Primitive1D) => {
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
    .map(primitive => ({
      primitive,
      center:
        primitive.type === "Point"
          ? primitive.point
          : Vector.zero(3)
              .add(...primitive.points)
              .divide(primitive.points.length),
      // plane:
      //   primitive.type === "Polygon"
      //     ? pointsToPlane(primitive.points)
      //     : primitive.type === "Line"
      //       ? tuple(
      //           primitive.points[1].copy().sub(primitive.points[0]).normalise(),
      //           primitive.points[1]
      //             .copy()
      //             .sub(primitive.points[0])
      //             .normalise()
      //             .dot(primitive.points[0])
      //         )
      //       : tuple(Vector.zero(3), 0),
      sqrDist: projectOptions.viewPos.sqrDistTo(
        primitive.type === "Point"
          ? primitive.point
          : Vector.zero(3)
              .add(...primitive.points)
              .divide(primitive.points.length)
      ),
    }))
    .sort((a, b) => {
      if (a.primitive.type === "Polygon" && b.primitive.type === "Polygon") {
        const aPlane = pointsToPlane(a.primitive.points);
        const bPlane = pointsToPlane(b.primitive.points);
        const normDiff = aPlane.norm.copy().sub(bPlane.norm);
        if (normDiff.abs().every(n => n > IMPRECISION_THRESHOLD)) {
          // const intersectLine = planePlaneIntersection(aPlane, bPlane);
          // const aValue = pointsSameSide(
          //   projectOptions.viewPos,
          //   a.center,
          //   intersectLine
          // )
          //   ? 1
          //   : -1;
          // const bValue = pointsSameSide(
          //   projectOptions.viewPos,
          //   b.center,
          //   intersectLine
          // )
          //   ? 1
          //   : -1;
          // const aValue =
          //   projectOptions.viewPos.copy().sub(a.center).getSquaredMagnitude() -
          //   projectOptions.viewPos
          //     .copy()
          //     .sub(a.center.copy().sub(distToPlane(a.center, bPlane)))
          //     .getSquaredMagnitude();
          // const bValue =
          //   projectOptions.viewPos.copy().sub(b.center).getSquaredMagnitude() -
          //   projectOptions.viewPos
          //     .copy()
          //     .sub(b.center.copy().sub(distToPlane(b.center, aPlane)))
          //     .getSquaredMagnitude();
          // return Math.sign(bValue) + Math.sign(aValue);
          // return (
          //   Math.sign(
          //     projectOptions.viewPos.sqrDistTo(b.center) -
          //       projectOptions.viewPos.sqrDistTo(
          //         closestPointOnPlane(b.center, aPlane)
          //       )
          //   ) -
          //   Math.sign(
          //     projectOptions.viewPos.sqrDistTo(a.center) -
          //       projectOptions.viewPos.sqrDistTo(
          //         closestPointOnPlane(a.center, bPlane)
          //       )
          //   )
          // );
          // return (
          //   projectOptions.viewPos.sqrDistTo(b.center) -
          //   projectOptions.viewPos.sqrDistTo(
          //     closestPointOnPlane(b.center, aPlane)
          //     // b.center.copy().add(
          //     //   // projectOptions.dirNorm.dot(aPlane.norm) *
          //     //   distToPlane(b.center, aPlane)
          //     // )
          //   )
          // );
          // Make a plane with the norm dirNorm, at the point where the 2 poly planes intersect
          // Get the avg norm of the two planes and then use that instead of the closest point on the plane
          // return closestPointOnPlane(projectOptions.viewPos, aPlane)
          //   .sub()
          //   .dot(projectOptions.dirNorm);

          return (
            Math.sign(
              closestPointOnPlane(projectOptions.viewPos, aPlane)
                .sub(projectOptions.viewPos)
                .dot(closestPointOnPlane(b.center, aPlane).sub(b.center))
            ) -
            Math.sign(
              closestPointOnPlane(projectOptions.viewPos, bPlane)
                .sub(projectOptions.viewPos)
                .dot(closestPointOnPlane(a.center, bPlane).sub(a.center))
            )
          );
        } else {
          return (
            projectOptions.viewPos.sqrDistTo(
              closestPointOnPlane(projectOptions.viewPos, bPlane)
            ) -
            projectOptions.viewPos.sqrDistTo(
              closestPointOnPlane(projectOptions.viewPos, aPlane)
            )
          );
        }
      } else {
        return b.sqrDist - a.sqrDist;
      }
    })
    .forEach(({ primitive }) => {
      ctx.fillStyle = defaultFill ?? "white";
      ctx.strokeStyle = defaultStroke ?? "white";
      ctx.font = defaultFont ?? "inherit";
      renderPrimitive(ctx, projectPrimitive(primitive, projectOptions));
    });
}
