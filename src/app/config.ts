import { config, rangeConfig } from "../configParser/create";

export default config(
  rangeConfig({
    id: "fov",
    label: "Field of vision",
    default: 1.5,
    attrs: {
      min: "0.2",
      max: "5",
      step: "0.1",
    },
  }),
  rangeConfig({
    id: "speed",
    label: "Animation speed",
    default: 100,
    attrs: {
      min: "0",
      max: "1000",
      step: "0.1",
    },
  })
);
