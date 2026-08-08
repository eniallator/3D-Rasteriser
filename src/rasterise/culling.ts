import type { Vector } from "vectyped";

import type { ProjectOptions } from "./project";
import type { ProjectedPrimitive } from "./types";

function isInFrontOfCamera(
  point: Vector<3>,
  { viewPos, dirNorm }: ProjectOptions
): boolean {
  return point.copy().sub(viewPos).dot(dirNorm) > 0;
}

// TODO: Doesn't take into account the edges which could overlap the viewport
export function isPrimitiveOnScreen(
  projected: ProjectedPrimitive,
  projectOptions: ProjectOptions
): boolean {
  if (projected.type === "Point") {
    return (
      isInFrontOfCamera(projected.primitive.point, projectOptions) &&
      projected.projected.inBounds(projectOptions.screenDim)
    );
  }
  return projected.primitive.points.some(
    (point, i) =>
      isInFrontOfCamera(point, projectOptions) &&
      projected.projected[i]?.inBounds(projectOptions.screenDim)
  );
}
