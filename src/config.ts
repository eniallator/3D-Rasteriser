import {
  createParsers,
  rangeParser,
  selectParser,
  type InitParserObject,
  type SeriFormOptions,
} from "seriform";

export const options: SeriFormOptions = { query: location.search };
export const config = createParsers({
  scene: selectParser({
    label: "Scene",
    options: ["Spinning Cube", "Living Room", "Stress Test"],
    default: "Spinning Cube",
  }),
  fov: rangeParser({
    label: "Field of vision",
    default: 1.5,
    attrs: {
      min: "0.2",
      max: "5",
      step: "0.1",
    },
  }),
  speed: rangeParser({
    label: "Animation speed",
    default: 1,
    attrs: {
      min: "0",
      max: "10",
      step: "0.001",
    },
  }),
});

export type Config =
  typeof config extends InitParserObject<infer R> ? R : never;
