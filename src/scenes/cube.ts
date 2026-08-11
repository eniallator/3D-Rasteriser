import { tuple } from "niall-utils/core";
import { Monad } from "niall-utils/functional";
import { Vector } from "vectyped";

import {
  createPoint,
  createPolygon,
  type Primitive2D,
} from "../rasterise/types.ts";
import { animatedScene, type Scene } from "./types.ts";

export const cube: Scene = animatedScene((config, time, _prev) => {
  const progress = (time.now - time.start) * config.speed;

  const cubeAngle = progress % (Math.PI * 2);
  const cubeCenter = Vector.zero(3);

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
      .get();

  const primitives: Primitive2D[] = [
    createPoint({
      label: { text: "Test Cube", style: "white", font: "30px sans-serif" },
      point: cubeCenter,
      radius: 30,
      style: ({ projected }, ctx) => {
        const gradient = ctx.createRadialGradient(
          ...projected.toArray(),
          0,
          ...projected.toArray(),
          30
        );
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        return gradient;
      },
    }),
  ];

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const cornerPoint = Vector.create(i, j, (i + j) % 2);
      for (let k = 0; k < 3; k++) {
        const points = tuple(
          cornerPoint,
          cornerPoint.with(k, (cornerPoint.valueOf(k) + 1) % 2),
          cornerPoint.with(
            (k + 1) % 3,
            (cornerPoint.valueOf((k + 1) % 3) + 1) % 2
          )
        );

        primitives.push(
          createPolygon({
            points: points.map(processCubeCorner) as typeof points,
            style: `rgb(${Vector.zero(3)
              .add(...points)
              .divide(points.length)
              .multiply(255)
              .toArray()
              .join(", ")})`,
          })
        );
      }
    }
  }

  return {
    primitives,
    cameraOptions: {
      viewPos: Vector.create(
        -2.5,
        Math.cos(progress) / 1.5,
        Math.sin(progress) / 1.5
      ),
      dirNorm: Vector.create(1, 0, 0),
      fov: config.fov,
    },
  };
});
