import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import type { ProjectOptions } from "./project";
import { renderPrimitive } from "./render";
import {
  createLine,
  createPoint,
  createPolygon,
  type ProjectedLine,
  type ProjectedPoint,
  type ProjectedPolygon,
} from "./types";

const projectOptions: ProjectOptions = {
  viewPos: Vector.create(0, 0, 0),
  dirNorm: Vector.create(0, 0, 1),
  fov: 1,
  screenDim: Vector.create(800, 600),
};

function fakeCtx() {
  const mocks = {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
  };
  const ctx = mocks as unknown as CanvasRenderingContext2D;
  return { ctx, ...mocks };
}

describe("renderPrimitive - Point", () => {
  it("draws an arc at the projected position with the default radius, and fills", () => {
    const { ctx, beginPath, arc, fill, fillText } = fakeCtx();
    const point = createPoint({ point: Vector.create(0, 0, 0) });
    const projected: ProjectedPoint = {
      type: "Point",
      primitive: point,
      projected: Vector.create(10, 20),
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(beginPath).toHaveBeenCalledOnce();
    expect(arc).toHaveBeenCalledWith(10, 20, 1, 0, 2 * Math.PI);
    expect(fill).toHaveBeenCalledOnce();
    expect(fillText).not.toHaveBeenCalled();
  });

  it("uses the primitive's radius and calls a style function with the projected primitive", () => {
    const { ctx, arc } = fakeCtx();
    const style = vi.fn(() => "purple");
    const point = createPoint({
      point: Vector.create(0, 0, 0),
      radius: 7,
      style,
    });
    const projected: ProjectedPoint = {
      type: "Point",
      primitive: point,
      projected: Vector.create(10, 20),
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(arc).toHaveBeenCalledWith(10, 20, 7, 0, 2 * Math.PI);
    expect(style).toHaveBeenCalledWith(projected, ctx);
    expect(ctx.fillStyle).toBe("purple");
  });

  it("draws a centered label when present", () => {
    const { ctx, fillText } = fakeCtx();
    const point = createPoint({
      point: Vector.create(0, 0, 0),
      label: { text: "hi" },
    });
    const projected: ProjectedPoint = {
      type: "Point",
      primitive: point,
      projected: Vector.create(100, 50),
    };

    renderPrimitive(ctx, projected, projectOptions);

    // measureText returns width 40, so text is centered: x - 40/2 = 80.
    expect(fillText).toHaveBeenCalledWith("hi", 80, 50, undefined);
  });
});

describe("renderPrimitive - Line", () => {
  it("moves to the first point, lines to the rest, and strokes", () => {
    const { ctx, beginPath, moveTo, lineTo, stroke } = fakeCtx();
    const line = createLine({
      points: [Vector.create(0, 0, 0), Vector.create(1, 1, 1)],
    });
    const projected: ProjectedLine = {
      type: "Line",
      primitive: line,
      projected: [Vector.create(0, 0), Vector.create(10, 10)],
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(beginPath).toHaveBeenCalledOnce();
    expect(moveTo).toHaveBeenCalledWith(0, 0);
    expect(lineTo).toHaveBeenCalledWith(10, 10);
    expect(stroke).toHaveBeenCalledOnce();
  });

  it("sets lineWidth when the primitive specifies one", () => {
    const { ctx } = fakeCtx();
    const line = createLine({
      points: [Vector.create(0, 0, 0), Vector.create(1, 1, 1)],
      width: 5,
    });
    const projected: ProjectedLine = {
      type: "Line",
      primitive: line,
      projected: [Vector.create(0, 0), Vector.create(10, 10)],
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(ctx.lineWidth).toBe(5);
  });

  it("calls a style function with {original: self} when the line was never split", () => {
    const { ctx } = fakeCtx();
    const style = vi.fn(() => "blue");
    const line = createLine({
      points: [Vector.create(0, 0, 0), Vector.create(1, 1, 1)],
      style,
    });
    const projected: ProjectedLine = {
      type: "Line",
      primitive: line,
      projected: [Vector.create(0, 0), Vector.create(10, 10)],
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(style).toHaveBeenCalledWith({ original: projected }, ctx);
    expect(ctx.strokeStyle).toBe("blue");
  });

  it("calls a style function with {fragment, original} when the line was split, projecting the whole original", () => {
    const { ctx } = fakeCtx();
    const style = vi.fn(() => "blue");
    const wholeOriginal = createLine({
      points: [Vector.create(0, 0, 1), Vector.create(4, 0, 1)],
    });
    const fragment = createLine({
      points: [Vector.create(0, 0, 1), Vector.create(2, 0, 1)],
      style,
      original: wholeOriginal,
    });
    const projected: ProjectedLine = {
      type: "Line",
      primitive: fragment,
      projected: [Vector.create(400, 300), Vector.create(600, 300)],
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(style).toHaveBeenCalledOnce();
    const [arg] = style.mock.calls[0] as [
      { fragment?: ProjectedLine; original: ProjectedLine },
      CanvasRenderingContext2D,
    ];
    expect(arg.fragment).toBe(projected);
    expect(arg.original.primitive).toBe(wholeOriginal);
    // The original spans x 0..4 in world space, wider than the fragment's
    // x 0..2 - its projection should reflect the whole (unsplit) shape.
    expect(arg.original.projected[0]?.x()).not.toBe(
      arg.original.projected[1]?.x()
    );
  });
});

describe("renderPrimitive - Polygon", () => {
  it("moves to the first point, lines to the rest, and fills", () => {
    const { ctx, beginPath, moveTo, lineTo, fill } = fakeCtx();
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 0),
        Vector.create(1, 0, 0),
        Vector.create(0, 1, 0),
      ],
    });
    const projected: ProjectedPolygon = {
      type: "Polygon",
      primitive: polygon,
      projected: [
        Vector.create(0, 0),
        Vector.create(10, 0),
        Vector.create(0, 10),
      ],
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(beginPath).toHaveBeenCalledOnce();
    expect(moveTo).toHaveBeenCalledWith(0, 0);
    expect(lineTo).toHaveBeenCalledWith(10, 0);
    expect(lineTo).toHaveBeenCalledWith(0, 10);
    expect(fill).toHaveBeenCalledOnce();
  });

  it("calls a style function with {original: self} when the polygon was never split", () => {
    const { ctx } = fakeCtx();
    const style = vi.fn(() => "orange");
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 0),
        Vector.create(1, 0, 0),
        Vector.create(0, 1, 0),
      ],
      style,
    });
    const projected: ProjectedPolygon = {
      type: "Polygon",
      primitive: polygon,
      projected: [
        Vector.create(0, 0),
        Vector.create(10, 0),
        Vector.create(0, 10),
      ],
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(style).toHaveBeenCalledWith({ original: projected }, ctx);
    expect(ctx.fillStyle).toBe("orange");
  });

  it("calls a style function with {fragment, original} when the polygon was split, projecting the whole original - not just the fragment's own bounds", () => {
    const { ctx } = fakeCtx();
    const style = vi.fn(() => "orange");
    const wholeOriginal = createPolygon({
      points: [
        Vector.create(0, 0, 1),
        Vector.create(4, 0, 1),
        Vector.create(4, 4, 1),
        Vector.create(0, 4, 1),
      ],
    });
    const fragment = createPolygon({
      points: [
        Vector.create(0, 0, 1),
        Vector.create(2, 0, 1),
        Vector.create(2, 4, 1),
        Vector.create(0, 4, 1),
      ],
      style,
      original: wholeOriginal,
    });
    const projected: ProjectedPolygon = {
      type: "Polygon",
      primitive: fragment,
      projected: [
        Vector.create(400, 300),
        Vector.create(500, 300),
        Vector.create(500, 400),
        Vector.create(400, 400),
      ],
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(style).toHaveBeenCalledOnce();
    const [arg] = style.mock.calls[0] as [
      { fragment?: ProjectedPolygon; original: ProjectedPolygon },
      CanvasRenderingContext2D,
    ];
    expect(arg.fragment).toBe(projected);
    expect(arg.original.primitive).toBe(wholeOriginal);
    // Fragment's own projected width is 100 (400->500); the whole original
    // (twice as wide in world space) should project wider than that.
    const originalXs = arg.original.projected.map(p => p.x());
    expect(Math.max(...originalXs) - Math.min(...originalXs)).toBeGreaterThan(
      100
    );
  });

  it("closes the path and strokes it in the same colour as the fill, to hide anti-aliasing seams between abutting polygons", () => {
    const { ctx, closePath, fill, stroke } = fakeCtx();
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 0),
        Vector.create(1, 0, 0),
        Vector.create(0, 1, 0),
      ],
      style: "orange",
    });
    const projected: ProjectedPolygon = {
      type: "Polygon",
      primitive: polygon,
      projected: [
        Vector.create(0, 0),
        Vector.create(10, 0),
        Vector.create(0, 10),
      ],
    };

    renderPrimitive(ctx, projected, projectOptions);

    expect(closePath).toHaveBeenCalledOnce();
    expect(fill.mock.invocationCallOrder[0]).toBeLessThan(
      stroke.mock.invocationCallOrder[0]
    );
    expect(stroke).toHaveBeenCalledOnce();
    expect(ctx.strokeStyle).toBe("orange");
  });
});
