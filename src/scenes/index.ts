import type { Config } from "../config.ts";
import { cube } from "./cube.ts";
import type { Scene } from "./types.ts";

export const scenes: Record<Config["scene"], Scene> = {
  "Spinning Cube": cube,
};
