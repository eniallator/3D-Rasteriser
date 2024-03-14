import Monad from "../core/monad";
import { AppContextWithState, appMethods } from "../core/types";
import Vector from "../core/Vector";
import config from "./config";

interface Star {
  pos: Vector<3>;
  tail: Array<Vector<3>>;
}

// interface StarState {
//   stars: Array<Star>;
//   dirNorm: Vector<3>;
//   lastSpawned: number;
// }

interface CubeState {
  dirNorm: Vector<3>;
}

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

function project(
  dirNorm: Vector<3>,
  point: Vector<3>,
  fov: number
): [Vector<2>, boolean] {
  const pointInView = point.dot(dirNorm) > 0;
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
    Vector.create(xAxisIntersection.dot(xAxis), yAxisIntersection.dot(yAxis)),
    pointInView && onXAxis && onYAxis,
  ];
}

// function createStar(boxSize: number): Star {
//   return {
//     pos: Vector.create(
//       boxSize / 2,
//       boxSize * Math.random() - boxSize / 2,
//       boxSize * Math.random() - boxSize / 2
//     ),
//     tail: [],
//   };
// }

// function animationFrame({
//   paramConfig,
//   ctx,
//   canvas,
//   state,
//   time,
// }: AppContextWithState<typeof config, StarState>) {
//   const { stars, dirNorm } = state;
//   let { lastSpawned } = state;
//   ctx.strokeStyle = "white";
//   ctx.fillStyle = "black";
//   ctx.fillRect(0, 0, canvas.width, canvas.height);

//   const boxSize = paramConfig.getVal("box-size");
//   for (let i = stars.length - 1; i >= 0; i--) {
//     if (stars[i].pos.x() < 0) {
//       stars.splice(i, 1);
//     }
//   }

//   const now = Date.now();

//   const spawnDelay = paramConfig.getVal("spawn-delay-seconds");
//   while (
//     stars.length < paramConfig.getVal("max-stars") &&
//     (spawnDelay === 0 || lastSpawned + spawnDelay * 1000 < now)
//   ) {
//     stars.push(createStar(boxSize));
//     lastSpawned = now;
//   }

//   const screenDim = Vector.create(canvas.width, canvas.height);
//   const posDelta = Vector.create(
//     time.delta * -paramConfig.getVal("speed"),
//     0,
//     0
//   );

//   ctx.lineWidth = (screenDim.getMin() / 100) * paramConfig.getVal("star-size");
//   ctx.lineCap = "round";
//   for (const star of stars) {
//     ctx.beginPath();
//     let first = true;
//     for (const pos of [star.pos, ...star.tail]) {
//       const screenPos = project(dirNorm, pos, paramConfig.getVal("fov"))
//         ?.add(0.5)
//         .multiply(screenDim);

//       if (screenPos != null) {
//         if (first) {
//           first = false;
//           ctx.moveTo(screenPos.x(), screenPos.y());
//           ctx.lineTo(screenPos.x(), screenPos.y());
//         } else {
//           ctx.lineTo(screenPos.x(), screenPos.y());
//         }
//       }
//     }
//     ctx.stroke();
//     star.tail = [star.pos.copy(), ...star.tail];
//     star.pos.add(posDelta);
//     const tailSizeSquared = paramConfig.getVal("tail-size") ** 2;
//     for (let i = star.tail.length - 1; i >= 0; i--) {
//       if (
//         star.tail[i].copy().sub(star.pos).getSquaredMagnitude() >
//         tailSizeSquared
//       ) {
//         star.tail.pop();
//       } else {
//         break;
//       }
//     }
//   }

//   return { stars, lastSpawned, dirNorm };
// }

// export default appMethods.stateful<typeof config, StarState>({
//   init: () => ({
//     stars: [],
//     dirNorm: Vector.create(1, 0, 0),
//     lastSpawned: Date.now(),
//   }),
//   animationFrame,
// });

function animationFrame({
  paramConfig,
  ctx,
  canvas,
  state,
  time,
}: AppContextWithState<typeof config, CubeState>) {
  const { dirNorm } = state;
  ctx.strokeStyle = "white";
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const screenDim = Vector.create(canvas.width, canvas.height);
  const cubeAngle =
    (((time.now - time.animationStart) * paramConfig.getVal("speed")) / 100) %
    (Math.PI / 2);
  const cubeCenter = Vector.create(1.5, 0, 0);

  ctx.lineWidth = (screenDim.getMin() / 100) * paramConfig.getVal("star-size");
  ctx.lineCap = "round";
  ctx.beginPath();

  // point components are either 0 or 1
  const processCubeCorner = (point: Vector<3>): Vector<2> =>
    Monad.from(point)
      .map(point => {
        const [x, y, z] = point.copy().sub(0.5).toArray();
        const [rotX, rotY] = Vector.create(x, y)
          .rotate(Vector.zero(2), cubeAngle)
          .toArray();
        return Vector.create(rotX, rotY, z);
      })
      .map(point => point.add(cubeCenter))
      .map(point => project(dirNorm, point, paramConfig.getVal("fov")))
      .map(([point]) => point.add(0.5).multiply(screenDim))
      .value();

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const cornerPoint = Vector.create(i, j, (i + j) % 2);
      const projectedCornerPoint = processCubeCorner(cornerPoint);
      for (let k = 0; k < 3; k++) {
        const toPoint = cornerPoint.with(k, (cornerPoint.valueOf(k) + 1) % 2);
        const projectedToPoint = processCubeCorner(toPoint);

        if (
          !projectedCornerPoint.some(isNaN) &&
          !projectedToPoint.some(isNaN)
        ) {
          ctx.moveTo(...projectedCornerPoint.toArray());
          ctx.lineTo(...projectedToPoint.toArray());
        }
      }
    }
  }
  ctx.stroke();

  return { dirNorm };
}

export default appMethods.stateful<typeof config, CubeState>({
  init: () => ({
    points: [],
    dirNorm: Vector.create(1, 0, 0),
  }),
  animationFrame,
});
