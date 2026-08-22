import { checkExhausted } from "niall-utils";
import { Vector } from "vectyped";

import { intersect } from "./helpers";
import type { CameraOptions, Primitive2D, ToProjected } from "./types";

export interface ProjectOptions extends CameraOptions {
  screenDim: Vector<2>;
}

export interface CameraBasis {
  screenCenterPos: Vector<3>;
  xAxis: Vector<3>;
  yAxis: Vector<3>;
}

export function cameraBasis({ dirNorm, fov }: CameraOptions): CameraBasis {
  const screenCenterPos = dirNorm.copy().setMagnitude(1 / fov);
  const xAxis = dirNorm.crossProduct(Vector.create(0, 1, 0)).normalise();
  const yAxis = dirNorm.crossProduct(xAxis);
  return { screenCenterPos, xAxis, yAxis };
}

export function project(
  point: Vector<3>,
  projectOptions: ProjectOptions
): Vector<2> {
  const { viewPos, dirNorm, screenDim } = projectOptions;
  const { screenCenterPos, xAxis, yAxis } = cameraBasis(projectOptions);
  const pointNorm = point.copy().sub(viewPos).getNorm();
  const t = screenCenterPos.dot(dirNorm) / pointNorm.dot(dirNorm);
  const pointOnPlane = pointNorm.multiply(t);

  const screenStart = {
    x: screenCenterPos.copy().sub(xAxis.copy().divide(2)),
    y: screenCenterPos.copy().sub(yAxis.copy().divide(2)),
  };
  const screenEnd = {
    x: screenCenterPos.copy().add(xAxis.copy().divide(2)),
    y: screenCenterPos.copy().add(yAxis.copy().divide(2)),
  };

  const xAxisIntersection = intersect(screenStart.x, screenEnd.x, pointOnPlane);
  const yAxisIntersection = intersect(screenStart.y, screenEnd.y, pointOnPlane);

  const aspectRatio = screenDim.x() / screenDim.y();
  return Vector.create(
    xAxisIntersection.divide(aspectRatio).dot(xAxis),
    yAxisIntersection.dot(yAxis)
  )
    .add(0.5)
    .multiply(screenDim);
}

export function projectPrimitive<P extends Primitive2D>(
  primitive: P,
  projectOptions: ProjectOptions
): ToProjected<P> {
  switch (primitive.type) {
    case "Point":
      return {
        type: primitive.type,
        primitive,
        projected: project(primitive.point, projectOptions),
      } as ToProjected<P>;
    case "Line":
    case "Polygon":
      return {
        type: primitive.type,
        primitive,
        projected: primitive.points.map(point =>
          project(point, projectOptions)
        ),
      } as ToProjected<P>;
    default:
      return checkExhausted(primitive);
  }
}
