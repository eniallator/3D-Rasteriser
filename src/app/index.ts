import Monad from "../core/monad";
import { AppContextWithState, appMethods } from "../core/types";
import Vector from "../core/Vector";
import config from "./config";
import rasterise from "./rasterise";
import { createLine, createPoint, Renderable } from "./rasterise/types";

// interface Star {
//   pos: Vector<3>;
//   tail: Array<Vector<3>>;
// }

// interface StarState {
//   stars: Array<Star>;
//   dirNorm: Vector<3>;
//   lastSpawned: number;
// }

interface CubeState {
  dirNorm: Vector<3>;
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

  const cubeAngle =
    (((time.now - time.animationStart) * paramConfig.getVal("speed")) / 100) %
    (Math.PI * 2);
  const cubeCenter = Vector.create(1.5, 0, 0);

  // point components are either 0 or 1
  const processCubeCorner = (point: Vector<3>): Vector<3> =>
    Monad.from(point)
      .map(point => {
        const [x, y, z] = point.copy().sub(0.5).toArray();
        const [rotX, rotY] = Vector.create(x, y)
          .rotate(Vector.zero(2), cubeAngle)
          .toArray();
        return Vector.create(rotX, rotY, z);
      })
      .map(point => point.add(cubeCenter))
      .value();

  ctx.lineWidth = 3;

  const renderables: Renderable[] = [
    createPoint({
      point: cubeCenter,
      radius: 30,
      style: screenPos => {
        const gradient = ctx.createRadialGradient(
          ...screenPos.toArray(),
          0,
          ...screenPos.toArray(),
          30
        );
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        return gradient;
      },
    }),
  ];

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const cornerPoint = Vector.create(i, j, (i + j) % 2);
      for (let k = 0; k < 3; k++) {
        const toPoint = cornerPoint.with(k, (cornerPoint.valueOf(k) + 1) % 2);

        renderables.push(
          createLine({
            points: [
              processCubeCorner(cornerPoint),
              processCubeCorner(toPoint),
            ],
            style: ([projectedCorner, projectedTo]) => {
              const gradient = ctx.createLinearGradient(
                ...projectedCorner.toArray(),
                ...projectedTo.toArray()
              );
              gradient.addColorStop(
                0,
                `rgb(${cornerPoint.copy().multiply(256).toArray().join(", ")})`
              );
              gradient.addColorStop(
                1,
                `rgb(${toPoint.copy().multiply(256).toArray().join(", ")})`
              );
              return gradient;
            },
          })
        );
      }
    }
  }

  rasterise.render(
    renderables,
    {
      viewPos: Vector.create(
        -1,
        Math.cos(
          ((time.now - time.animationStart) * paramConfig.getVal("speed")) / 100
        ) / 1.5,
        Math.sin(
          ((time.now - time.animationStart) * paramConfig.getVal("speed")) / 100
        ) / 1.5
      ),
      dirNorm,
      fov: paramConfig.getVal("fov"),
      screenDim: Vector.create(canvas.width, canvas.height),
    },
    { ctx }
  );

  return { dirNorm };
}

export default appMethods.stateful<typeof config, CubeState>({
  init: () => ({
    points: [],
    dirNorm: Vector.create(1, 0, 0),
  }),
  animationFrame,
});
