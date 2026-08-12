import type { Config } from "../config.ts";
import { cube } from "./cube.ts";
import { livingRoom } from "./livingRoom.ts";
import { stressTest } from "./stressTest.ts";
import type { Scene } from "./types.ts";

export const scenes: Record<Config["scene"], Scene> = {
  "Spinning Cube": cube,
  "Living Room": livingRoom,
  "Stress Test": stressTest,
};
