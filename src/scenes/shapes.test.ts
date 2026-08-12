import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import { prepareScene, renderPrepared } from "../rasterise/pipeline.ts";
import type { ProjectOptions } from "../rasterise/project.ts";
import { createPolygon } from "../rasterise/types.ts";
import { verticalGradientStyle } from "./shapes.ts";

function fakeCtx() {
  const gradientCalls: [number, number, number, number][] = [];
  const ctx = {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(
      (x0: number, y0: number, x1: number, y1: number) => {
        gradientCalls.push([x0, y0, x1, y1]);
        return { addColorStop: vi.fn() };
      }
    ),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, gradientCalls };
}

describe("verticalGradientStyle end-to-end through the real BSP pipeline", () => {
  it("uses the same gradient bounds for every fragment of a polygon the BSP tree split, not each fragment's own (smaller) bounds", () => {
    // A tall vertical panel with a top-to-bottom gradient, positioned so a
    // splitter plane cuts straight through it - exactly what happens to the
    // living room's window panes and flame layers once other geometry
    // forces the BSP tree to split them.
    const panel = createPolygon({
      points: [
        Vector.create(3, 0, -1),
        Vector.create(3, 4, -1),
        Vector.create(3, 4, 1),
        Vector.create(3, 0, 1),
      ],
      style: verticalGradientStyle("#000000", "#ffffff"),
    });
    const splitter = createPolygon({
      points: [
        Vector.create(0, 2, -5),
        Vector.create(6, 2, -5),
        Vector.create(6, 2, 5),
        Vector.create(0, 2, 5),
      ],
    });

    const projectOptions: ProjectOptions = {
      viewPos: Vector.create(3, 2, -10),
      dirNorm: Vector.create(0, 0, 1),
      fov: 1.5,
      screenDim: Vector.create(800, 600),
    };

    // Order matters: with only two candidates, whichever is tried first by
    // pickBestSplitter wins immediately once it perfectly bisects the other
    // (imbalance 0) - splitter first ensures splitter becomes the tree's
    // root plane, and panel is the one that gets cut by it.
    const { ctx, gradientCalls } = fakeCtx();
    renderPrepared(prepareScene([splitter, panel]), projectOptions, { ctx });

    // The panel must actually have been split for this test to mean
    // anything - otherwise there's only ever one fragment to compare.
    expect(gradientCalls.length).toBeGreaterThan(1);

    const [first, ...rest] = gradientCalls;
    for (const call of rest) {
      expect(call).toEqual(first);
    }
  });
});
