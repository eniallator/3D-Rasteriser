import { tuple } from "niall-utils";
import { Vector } from "vectyped";

import { Keyboard } from "../lib/keyboard.ts";
import { Mouse } from "../lib/mouse.ts";
import { cameraBasis } from "../rasterise/project.ts";
import type { CameraOptions } from "../rasterise/types.ts";

const KEY_INPUTS: [Vector<2>, string[]][] = [
  tuple(Vector.UP, ["w", "ArrowUp"]),
  tuple(Vector.LEFT, ["a", "ArrowLeft"]),
  tuple(Vector.DOWN, ["s", "ArrowDown"]),
  tuple(Vector.RIGHT, ["d", "ArrowRight"]),
];

export function keyboardMouseInput(
  canvas: HTMLCanvasElement
): (
  opts: CameraOptions,
  dt: number,
  positionSensitivity: number,
  directionSensitivity: number
) => CameraOptions {
  const mouse = new Mouse(canvas);
  let previousPosition: Vector<2> | null = null;
  const keyboard = new Keyboard(canvas);

  return (opts, dt, positionSensitivity, directionSensitivity) => {
    const { xAxis, yAxis } = cameraBasis(opts);

    const moveInput = KEY_INPUTS.reduce(
      (acc, [offset, keys]) =>
        keys.some(key => keyboard.isDown(key)) ? acc.copy().add(offset) : acc,
      Vector.zero(2)
    );

    const viewPos = opts.viewPos
      .copy()
      .add(
        xAxis
          .copy()
          .multiply(moveInput.x())
          .sub(opts.dirNorm.copy().multiply(moveInput.y()))
          .multiply(dt, positionSensitivity)
      );

    let dirNorm = opts.dirNorm;

    if (mouse.down && previousPosition != null) {
      const mouseDelta = mouse.relativePos.copy().sub(previousPosition);
      dirNorm = opts.dirNorm
        .copy()
        .add(
          xAxis
            .copy()
            .multiply(mouseDelta.x())
            .add(yAxis.copy().multiply(mouseDelta.y()))
            .multiply(dt, directionSensitivity)
        )
        .normalise();
    }

    previousPosition = mouse.down ? mouse.relativePos.copy() : null;

    return { dirNorm, viewPos, fov: opts.fov };
  };
}
