import type { Config } from "../config.ts";
import type { Time } from "../lib/types.ts";
import type {
  CameraOptions,
  PreparedScene,
  Primitive2D,
} from "../rasterise/types.ts";

export interface SceneResult {
  primitives: readonly Primitive2D[];
  cameraOptions: CameraOptions;
}

export interface SceneData {
  preparedScene: PreparedScene;
  sceneResult: SceneResult;
}

export interface Scene {
  animated: boolean;
  update: (config: Config, time: Time, prev: SceneData | null) => SceneResult;
}

export const animatedScene = (update: Scene["update"]): Scene => ({
  animated: true,
  update,
});

export const staticScene = (update: Scene["update"]): Scene => ({
  animated: false,
  update,
});
