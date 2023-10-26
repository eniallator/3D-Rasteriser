import { AppContextWithState, appMethods } from "../core/types";
import Vector, { Components2D, Components3D } from "../core/Vector";
import config from "./config";

interface State {
  stars: Array<Vector<Components3D>>;
  dirNorm: Vector<Components3D>;
  lastSpawned: number;
  lastFrame: number;
}

function intersect(
  vecA: Vector<Components3D>,
  vecB: Vector<Components3D>,
  point: Vector<Components3D>
): Vector<Components3D> | undefined {
  const a = vecA.copy().sub(point).getMagnitude();
  const b = vecB.copy().sub(point).getMagnitude();
  const c = vecA.copy().sub(vecB).getMagnitude();

  const t = (b ** 2 - a ** 2 + c ** 2) / (2 * c);
  if (0 <= t && t <= 1) {
    return vecA.lerp(vecB, t);
  }
}

function project(
  dirNorm: Vector<Components3D>,
  point: Vector<Components3D>,
  fov: number
): Vector<Components2D> | undefined {
  if (point.dot(dirNorm) > 0) {
    const screenCenterPos = dirNorm.copy().setMagnitude(1 / fov);
    const pointNorm = point.getNorm();
    const t =
      screenCenterPos.multiply(dirNorm).sum() /
      pointNorm.copy().multiply(dirNorm).sum();
    const pointOnPlane = pointNorm.multiply(t);
    const xAxis = dirNorm.crossProduct(Vector.create(0, 1, 0));
    const yAxis = dirNorm.crossProduct(xAxis);

    const screenStart = {
      x: screenCenterPos.copy().add(xAxis.copy().multiply(-1 / 2)),
      y: screenCenterPos.copy().add(yAxis.copy().multiply(-1 / 2)),
    };
    const screenEnd = {
      x: screenCenterPos.copy().add(xAxis.copy().multiply(1 / 2)),
      y: screenCenterPos.copy().add(yAxis.copy().multiply(1 / 2)),
    };

    const xAxisIntersection = intersect(
      screenStart.x,
      screenEnd.x,
      pointOnPlane
    );
    const yAxisIntersection = intersect(
      screenStart.y,
      screenEnd.y,
      pointOnPlane
    );

    return xAxisIntersection != null && yAxisIntersection != null
      ? Vector.create(
          xAxisIntersection.dot(xAxis),
          yAxisIntersection.dot(yAxis)
        )
      : undefined;
  }
  return undefined;
}

function createStar(boxSize: number): Vector<Components3D> {
  return Vector.create(
    boxSize / 2,
    boxSize * Math.random() - boxSize / 2,
    boxSize * Math.random() - boxSize / 2
  );
}

function animationFrame({
  paramConfig,
  ctx,
  canvas,
  state,
}: AppContextWithState<typeof config, State>) {
  let { stars, lastSpawned, dirNorm, lastFrame } = state;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxSize = paramConfig.getVal("box-size");
  for (let i = stars.length - 1; i >= 0; i--) {
    if (stars[i].x() < 0) {
      stars.splice(i, 1);
    }
  }

  const now = Date.now();

  const spawnDelay = paramConfig.getVal("spawn-delay-seconds");
  while (
    stars.length < paramConfig.getVal("max-stars") &&
    (spawnDelay === 0 || lastSpawned + spawnDelay * 1000 < now)
  ) {
    stars.push(createStar(boxSize));
    lastSpawned = now;
  }

  const screenDim = Vector.create(canvas.width, canvas.height);
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  const posDelta = Vector.create(dt * -paramConfig.getVal("speed"), 0, 0);

  ctx.fillStyle = "white";
  for (const star of stars) {
    const screenPos = project(dirNorm, star, paramConfig.getVal("fov"))
      ?.add(0.5)
      .multiply(screenDim);

    if (screenPos != null) {
      ctx.fillRect(screenPos.x() - 5, screenPos.y() - 5, 10, 10);
    }
    star.add(posDelta);
  }

  return { stars, lastSpawned, dirNorm, lastFrame };
}

export default appMethods.stateful<typeof config, State>({
  init: () => ({
    stars: [],
    dirNorm: Vector.create(1, 0, 0),
    lastSpawned: 0,
    lastFrame: Date.now(),
  }),
  animationFrame,
});
