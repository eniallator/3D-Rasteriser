import Vector from "../../core/Vector";
import { checkExhausted } from "../../core/utils";
import { intersect } from "./helpers";
import { Geometry, ToProjected } from "./types";

export interface ProjectOptions {
  viewPos: Vector<3>;
  dirNorm: Vector<3>;
  fov: number;
  screenDim: Vector<2>;
}

function project(
  point: Vector<3>,
  { viewPos, dirNorm, fov, screenDim }: ProjectOptions
): [Vector<2>, boolean] {
  const screenCenterPos = dirNorm.copy().setMagnitude(1 / fov);
  const pointNorm = point.copy().sub(viewPos).getNorm();
  const t =
    screenCenterPos.multiply(dirNorm).sum() /
    pointNorm.copy().multiply(dirNorm).sum();
  const pointOnPlane = pointNorm.multiply(t);
  const xAxis = dirNorm.crossProduct(Vector.create(0, 1, 0));
  const yAxis = dirNorm.crossProduct(xAxis);

  const screenStart = {
    x: screenCenterPos.copy().sub(xAxis.copy().divide(2)),
    y: screenCenterPos.copy().sub(yAxis.copy().divide(2)),
  };
  const screenEnd = {
    x: screenCenterPos.copy().add(xAxis.copy().divide(2)),
    y: screenCenterPos.copy().add(yAxis.copy().divide(2)),
  };

  const [xAxisIntersection, onXAxis] = intersect(
    screenStart.x,
    screenEnd.x,
    pointOnPlane
  );
  const [yAxisIntersection, onYAxis] = intersect(
    screenStart.y,
    screenEnd.y,
    pointOnPlane
  );

  const aspectRatio = screenDim.x() / screenDim.y();
  return [
    Vector.create(
      xAxisIntersection.divide(aspectRatio).dot(xAxis),
      yAxisIntersection.dot(yAxis)
    )
      .add(0.5)
      .multiply(screenDim),
    onXAxis && onYAxis,
  ];
}

export function projectGeometry<G extends Geometry>(
  geometry: G,
  projectOptions: ProjectOptions
): ToProjected<G> {
  switch (geometry.type) {
    case "Point":
    case "Label":
      return {
        type: geometry.type,
        geometry,
        projected: project(geometry.point, projectOptions)[0],
      } as ToProjected<G>;
    case "Line":
    case "Triangle":
      return {
        type: geometry.type,
        geometry,
        projected: geometry.points.map(
          point => project(point, projectOptions)[0]
        ),
      } as ToProjected<G>;
    default:
      return checkExhausted(geometry);
  }
}
