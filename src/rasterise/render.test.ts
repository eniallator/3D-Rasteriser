import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import { renderPrimitive } from "./render";
import {
  createLine,
  createPoint,
  createPolygon,
  type ProjectedLine,
  type ProjectedPoint,
  type ProjectedPolygon,
} from "./types";

function fakeCtx() {
  const mocks = {
    beginPath: vi.fn(),
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

    renderPrimitive(ctx, projected);

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

    renderPrimitive(ctx, projected);

    expect(arc).toHaveBeenCalledWith(10, 20, 7, 0, 2 * Math.PI);
    expect(style).toHaveBeenCalledWith(projected);
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

    renderPrimitive(ctx, projected);

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

    renderPrimitive(ctx, projected);

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

    renderPrimitive(ctx, projected);

    expect(ctx.lineWidth).toBe(5);
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

    renderPrimitive(ctx, projected);

    expect(beginPath).toHaveBeenCalledOnce();
    expect(moveTo).toHaveBeenCalledWith(0, 0);
    expect(lineTo).toHaveBeenCalledWith(10, 0);
    expect(lineTo).toHaveBeenCalledWith(0, 10);
    expect(fill).toHaveBeenCalledOnce();
  });

  it("calls a style function with the projected primitive to set fillStyle", () => {
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

    renderPrimitive(ctx, projected);

    expect(style).toHaveBeenCalledWith(projected);
    expect(ctx.fillStyle).toBe("orange");
  });
});
