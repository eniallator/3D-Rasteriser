import { raise } from "niall-utils/core";
import { Option } from "niall-utils/functional";
import { Vector } from "vectyped";

import type { Config } from "./config.ts";
import { appMethods, type StatefulAppContext } from "./lib/types.ts";
import rasterise from "./rasterise";
import { scenes } from "./scenes/index.ts";
import type { SceneData } from "./scenes/types.ts";

interface State {
  sceneId: Config["scene"];
  sceneData: SceneData | null;
}

function animationFrame({
  seriform,
  ctx,
  time,
  canvas,
  getState,
  setState,
}: StatefulAppContext<Config, State>) {
  let { sceneId, sceneData } = getState();

  const nextId = seriform.getValue("scene");
  if (nextId !== sceneId) {
    sceneId = nextId;
    sceneData = null;
  }

  const scene = scenes[sceneId];

  ctx.strokeStyle = "white";
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const nextData = Option.from(scene.animated ? seriform.getAllValues() : null)
    .map(config => scene.update(config, time, sceneData))
    .map<SceneData>(sceneResult => ({
      sceneResult,
      preparedScene: rasterise.prepareScene(sceneResult.primitives),
    }))
    .getOrElse(() => sceneData ?? raise(new Error("Expected SceneData")));

  setState({ sceneId, sceneData: nextData });

  rasterise.renderPrepared(
    nextData.preparedScene,
    {
      ...nextData.sceneResult.cameraOptions,
      screenDim: Vector.create(canvas.width, canvas.height),
    },
    { ctx }
  );
}

export const app = appMethods<Config, State>({
  init: ({ seriform, time }) => {
    const sceneId = seriform.getValue("scene");
    const scene = scenes[sceneId];
    return {
      sceneId,
      sceneData: Option.from(scene.animated ? null : seriform.getAllValues())
        .map(config => scene.update(config, time, null))
        .map<SceneData>(sceneResult => ({
          sceneResult,
          preparedScene: rasterise.prepareScene(sceneResult.primitives),
        }))
        .getOrNull(),
    };
  },
  animationFrame,
});
