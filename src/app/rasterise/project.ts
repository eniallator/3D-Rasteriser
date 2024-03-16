import Vector from "../../core/Vector";

function intersect(
  vecA: Vector<3>,
  vecB: Vector<3>,
  point: Vector<3>
): [Vector<3>, boolean] {
  const a = vecA.copy().sub(point).getMagnitude();
  const b = vecB.copy().sub(point).getMagnitude();
  const c = vecA.copy().sub(vecB).getMagnitude();

  const t = (b ** 2 - a ** 2 + c ** 2) / (2 * c);
  return [vecA.lerp(vecB, t), 0 <= t && t <= 1];
}

export default function project(
  point: Vector<3>,
  viewPos: Vector<3>,
  dirNorm: Vector<3>,
  fov: number,
  aspectRatio: number
): [Vector<2>, boolean] {
  const offsettedPoint = point.copy().sub(viewPos);
  const pointInView = offsettedPoint.dot(dirNorm) > 0;
  const screenCenterPos = dirNorm.copy().setMagnitude(1 / fov);
  const pointNorm = offsettedPoint.getNorm();
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

  return [
    Vector.create(
      xAxisIntersection.divide(aspectRatio).dot(xAxis),
      yAxisIntersection.dot(yAxis)
    ),
    pointInView && onXAxis && onYAxis,
  ];
}
