import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import { traverseBackToFront } from "./bsp";
import {
  fullPipeline,
  naivePipeline,
  prepareScene,
  renderPrepared,
} from "./pipeline";
import { project, type ProjectOptions } from "./project";
import { createLine, createPoint, createPolygon } from "./types";

const vec3 = (x: number, y: number, z: number): Vector<3> =>
  Vector.create(x, y, z);

const projectOptions: ProjectOptions = {
  viewPos: vec3(0, 0, 0),
  dirNorm: vec3(0, 0, 1),
  fov: 1,
  screenDim: Vector.create(800, 600),
};

function fakeCtx() {
  const mocks = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
  };
  const ctx = mocks as unknown as CanvasRenderingContext2D;
  return { ctx, ...mocks };
}

describe("naivePipeline", () => {
  it("draws primitives back-to-front, farthest first", () => {
    const { ctx, arc } = fakeCtx();
    const near = createPoint({ point: vec3(0, 0, 5), radius: 1 });
    const far = createPoint({ point: vec3(0, 0, 20), radius: 2 });

    naivePipeline([near, far], projectOptions, { ctx });

    expect(arc).toHaveBeenCalledTimes(2);
    expect(arc.mock.calls[0]?.[2]).toBe(2);
    expect(arc.mock.calls[1]?.[2]).toBe(1);
  });

  it("drops primitives behind the camera and off-screen primitives", () => {
    const { ctx, arc } = fakeCtx();
    const behind = createPoint({ point: vec3(0, 0, -5) });
    const offScreen = createPoint({ point: vec3(10000, 0, 5) });
    const visible = createPoint({ point: vec3(0, 0, 5) });

    naivePipeline([behind, offScreen, visible], projectOptions, { ctx });

    expect(arc).toHaveBeenCalledTimes(1);
  });

  it("applies default styles when none are given, and overrides when they are", () => {
    const point = createPoint({ point: vec3(0, 0, 5) });

    const defaultFake = fakeCtx();
    naivePipeline([point], projectOptions, { ctx: defaultFake.ctx });
    expect(defaultFake.ctx.fillStyle).toBe("white");
    expect(defaultFake.ctx.strokeStyle).toBe("white");
    expect(defaultFake.ctx.font).toBe("inherit");

    const customFake = fakeCtx();
    naivePipeline([point], projectOptions, {
      ctx: customFake.ctx,
      defaultFill: "red",
      defaultStroke: "blue",
      defaultFont: "12px sans-serif",
    });
    expect(customFake.ctx.fillStyle).toBe("red");
    expect(customFake.ctx.strokeStyle).toBe("blue");
    expect(customFake.ctx.font).toBe("12px sans-serif");
  });
});

describe("prepareScene", () => {
  it("builds a BSP leaf and a BVH leaf for a scene with no polygons, at or below the BVH leaf size", () => {
    const a = createPoint({ point: vec3(0, 0, 0) });
    const b = createPoint({ point: vec3(1, 1, 1) });

    const scene = prepareScene([a, b]);

    expect(scene.tree).toEqual({ type: "leaf", primitives: [a, b] });
    expect(scene.bvh.type).toBe("leaf");
  });

  it("resolves intersections before building the trees, so crossing lines are split", () => {
    const a = createLine({ points: [vec3(-1, 0, 0), vec3(1, 0, 0)] });
    const b = createLine({ points: [vec3(0, -1, 0), vec3(0, 1, 0)] });

    const scene = prepareScene([a, b]);
    const flattened = traverseBackToFront(scene.tree, vec3(0, 0, -10));

    expect(flattened).toHaveLength(4);
  });
});

describe("renderPrepared", () => {
  it("only draws primitives that are visible: on-screen and in front of the camera", () => {
    const { ctx, arc } = fakeCtx();
    const near = createPoint({ point: vec3(0, 0, 5), radius: 1 });
    const far = createPoint({ point: vec3(0, 0, 20), radius: 2 });
    const behindCamera = createPoint({ point: vec3(0, 0, -5), radius: 3 });
    const outsideFrustum = createPoint({
      point: vec3(10000, 0, 5),
      radius: 4,
    });

    const scene = prepareScene([near, far, behindCamera, outsideFrustum]);
    renderPrepared(scene, projectOptions, { ctx });

    expect(arc).toHaveBeenCalledTimes(2);
    const radii = arc.mock.calls.map(call => call[2] as number);
    expect(radii.sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("orders polygons back-to-front via the BSP tree", () => {
    const { ctx, moveTo } = fakeCtx();
    const near = createPolygon({
      points: [vec3(-2, -0.5, 5), vec3(-1, -0.5, 5), vec3(-1.5, 0.5, 5)],
    });
    const far = createPolygon({
      points: [vec3(5, -0.5, 20), vec3(6, -0.5, 20), vec3(5.5, 0.5, 20)],
    });

    const scene = prepareScene([near, far]);
    renderPrepared(scene, projectOptions, { ctx });

    const farScreen = project(far.points[0], projectOptions);
    const nearScreen = project(near.points[0], projectOptions);

    expect(moveTo).toHaveBeenCalledTimes(2);
    expect(moveTo.mock.calls[0]).toEqual([farScreen.x(), farScreen.y()]);
    expect(moveTo.mock.calls[1]).toEqual([nearScreen.x(), nearScreen.y()]);
  });
});

describe("fullPipeline", () => {
  it("prepares and renders a scene end-to-end without throwing", () => {
    const { ctx, fill } = fakeCtx();
    const triangleA = createPolygon({
      points: [vec3(-1, -1, 5), vec3(1, -1, 5), vec3(0, 1, 5)],
    });
    const triangleB = createPolygon({
      points: [vec3(-1, -1, 10), vec3(1, -1, 10), vec3(0, 1, 10)],
    });

    expect(() => {
      fullPipeline([triangleA, triangleB], projectOptions, { ctx });
    }).not.toThrow();

    expect(fill).toHaveBeenCalledTimes(2);
  });
});
