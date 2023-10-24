import { config, numberConfig, rangeConfig } from "../configParser/create";

export default config(
  rangeConfig({
    id: "fov",
    label: "Field of vision",
    default: 1,
    attrs: {
      min: "0.2",
      max: "5",
      step: "0.1",
    },
  }),
  numberConfig({
    id: "max-stars",
    label: "Max number of stars to have at any point",
    default: 100,
    attrs: {
      min: "1",
      max: "1000",
    },
  }),
  rangeConfig({
    id: "box-size",
    label: "Box size to spawn stars",
    default: 100,
    attrs: {
      min: "10",
      max: "500",
      step: "",
    },
  }),
  numberConfig({
    id: "spawn-delay-seconds",
    label: "Spawn delay in seconds",
    default: 0.1,
    attrs: {
      min: "0",
      max: "30",
      step: "0.01",
    },
  }),
  rangeConfig({
    id: "speed",
    label: "Star speed",
    default: 10,
    attrs: {
      min: "0.1",
      max: "100",
      step: "0.1",
    },
  })
);
