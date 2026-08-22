import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import type { ProjectOptions } from "./project";
import { executeDrawOps, renderBatchedPrimitives, toDrawOps } from "./render";
import type { DrawOp } from "./render";
import {
  createLine,
  createPoint,
  createPolygon,
  type ProjectedLine,
  type ProjectedPoint,
  type ProjectedPolygon,
  type SplitStyleArg,
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

describe("toDrawOps - Point", () => {
  it("returns a single fill op with an arc segment at the projected position and default radius", () => {
    const { ctx } = fakeCtx();
    const point = createPoint({ point: Vector.create(0, 0, 0) });
    const projected: ProjectedPoint = {
      type: "Point",
      primitive: point,
      projected: Vector.create(10, 20),
    };

    const ops = toDrawOps(projected, projectOptions, ctx);

    expect(ops).toHaveLength(1);
    const [op] = ops as [DrawOp];
    expect(op.op).toBe("fill");
    if (op.op !== "fill" || op.segment.kind !== "arc") {
      throw new Error("expected an arc fill op");
    }
    expect(op.segment.center.toArray()).toEqual([10, 20]);
    expect(op.segment.radius).toBe(1);
    expect(op.bounds.min.toArray()).toEqual([9, 19]);
    expect(op.bounds.max.toArray()).toEqual([11, 21]);
  });

  it("uses the primitive's radius and resolves the fill style with (projected, ctx)", () => {
    const { ctx } = fakeCtx();
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

    const [op] = toDrawOps(projected, projectOptions, ctx) as [DrawOp];

    if (op.op !== "fill" || op.segment.kind !== "arc") {
      throw new Error("expected an arc fill op");
    }
    expect(op.segment.radius).toBe(7);
    expect(op.style).toBe("purple");
    expect(style).toHaveBeenCalledWith(projected, ctx);
  });

  it("adds a centered fillText op when a label is present", () => {
    const { ctx, measureText } = fakeCtx();
    const point = createPoint({
      point: Vector.create(0, 0, 0),
      label: { text: "hi" },
    });
    const projected: ProjectedPoint = {
      type: "Point",
      primitive: point,
      projected: Vector.create(100, 50),
    };

    const ops = toDrawOps(projected, projectOptions, ctx);

    expect(ops).toHaveLength(2);
    const [, textOp] = ops as [DrawOp, DrawOp];
    if (textOp.op !== "fillText") throw new Error("expected a fillText op");
    expect(measureText).toHaveBeenCalledWith("hi");
    // measureText returns width 40, so text is centered: x - 40/2 = 80.
    expect(textOp.text).toBe("hi");
    expect(textOp.x).toBe(80);
    expect(textOp.y).toBe(50);
    expect(textOp.maxWidth).toBeUndefined();
  });

  it("clamps the label centering offset to maxWidth and resolves a function-based font", () => {
    const { ctx } = fakeCtx();
    const font = vi.fn(() => "16px sans-serif");
    const point = createPoint({
      point: Vector.create(0, 0, 0),
      label: { text: "hi", font, maxWidth: 10 },
    });
    const projected: ProjectedPoint = {
      type: "Point",
      primitive: point,
      projected: Vector.create(100, 50),
    };

    const [, textOp] = toDrawOps(projected, projectOptions, ctx) as [
      DrawOp,
      DrawOp,
    ];

    expect(font).toHaveBeenCalledWith(projected, ctx);
    if (textOp.op !== "fillText") throw new Error("expected a fillText op");
    expect(textOp.font).toBe("16px sans-serif");
    // measureText mock returns width 40, but maxWidth=10 clamps it: 100 - 10/2 = 95.
    expect(textOp.x).toBe(95);
    expect(textOp.maxWidth).toBe(10);
  });
});

describe("toDrawOps - Line", () => {
  it("returns a single stroke op with the projected points and width", () => {
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

    const ops = toDrawOps(projected, projectOptions, ctx);

    expect(ops).toHaveLength(1);
    const [op] = ops as [DrawOp];
    expect(op.op).toBe("stroke");
    if (op.op !== "stroke") throw new Error("expected a stroke op");
    expect(op.points).toBe(projected.projected);
    expect(op.width).toBe(5);
  });

  it("resolves style with {original: self} when the line was never split", () => {
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

    const [op] = toDrawOps(projected, projectOptions, ctx) as [DrawOp];

    expect(style).toHaveBeenCalledWith({ original: projected }, ctx);
    if (op.op !== "stroke") throw new Error("expected a stroke op");
    expect(op.style).toBe("blue");
  });

  it("resolves style with {fragment, original} when the line was split, projecting the whole original", () => {
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

    toDrawOps(projected, projectOptions, ctx);

    expect(style).toHaveBeenCalledOnce();
    const [arg] = style.mock.calls[0] as unknown as [
      SplitStyleArg<ProjectedLine>,
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

describe("toDrawOps - Polygon", () => {
  it("extends bottom/right-facing edges by 1px to close seams between adjacent fills", () => {
    const { ctx } = fakeCtx();
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

    const ops = toDrawOps(projected, projectOptions, ctx);

    expect(ops).toHaveLength(1);
    const [op] = ops as [DrawOp];
    if (op.op !== "fill" || op.segment.kind !== "polygon") {
      throw new Error("expected a polygon fill op");
    }
    const [p0, p1, p2] = op.segment.points;
    const shift = 1 / Math.sqrt(2);
    // The right-angle vertex (0,0) touches only the two edges running along
    // the axes - neither faces down-right - so it's untouched. The
    // hypotenuse (10,0)->(0,10) is the only down-right-facing edge, so both
    // its endpoints get nudged 1px outward along its outward normal.
    expect(p0.toArray()).toEqual([0, 0]);
    expect(p1.x()).toBeCloseTo(10 + shift);
    expect(p1.y()).toBeCloseTo(shift);
    expect(p2.x()).toBeCloseTo(shift);
    expect(p2.y()).toBeCloseTo(10 + shift);
  });

  it("computes bounds from the (possibly extended) fill points", () => {
    const { ctx } = fakeCtx();
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 0),
        Vector.create(1, 0, 0),
        Vector.create(1, 1, 0),
        Vector.create(0, 1, 0),
      ],
    });
    const projected: ProjectedPolygon = {
      type: "Polygon",
      primitive: polygon,
      projected: [
        Vector.create(0, 0),
        Vector.create(10, 0),
        Vector.create(10, 10),
        Vector.create(0, 10),
      ],
    };

    const [op] = toDrawOps(projected, projectOptions, ctx) as [DrawOp];

    if (op.op !== "fill") throw new Error("expected a fill op");
    expect(op.bounds.min.toArray()).toEqual([0, 0]);
    expect(op.bounds.max.x()).toBeCloseTo(11);
    expect(op.bounds.max.y()).toBeCloseTo(11);
  });

  it("resolves style with {original: self} when the polygon was never split", () => {
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

    const [op] = toDrawOps(projected, projectOptions, ctx) as [DrawOp];

    expect(style).toHaveBeenCalledWith({ original: projected }, ctx);
    if (op.op !== "fill") throw new Error("expected a fill op");
    expect(op.style).toBe("orange");
  });

  it("resolves style with {fragment, original} when the polygon was split, projecting the whole original - not just the fragment's own bounds", () => {
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

    toDrawOps(projected, projectOptions, ctx);

    expect(style).toHaveBeenCalledOnce();
    const [arg] = style.mock.calls[0] as unknown as [
      SplitStyleArg<ProjectedPolygon>,
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
});

describe("executeDrawOps", () => {
  it("batches consecutive strokes with the same style and width into one beginPath/stroke call", () => {
    const { ctx, beginPath, moveTo, lineTo, stroke } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "stroke",
        style: "red",
        width: 2,
        points: [Vector.create(0, 0), Vector.create(10, 0)],
      },
      {
        op: "stroke",
        style: "red",
        width: 2,
        points: [Vector.create(0, 10), Vector.create(10, 10)],
      },
    ];

    executeDrawOps(ctx, ops);

    expect(beginPath).toHaveBeenCalledOnce();
    expect(stroke).toHaveBeenCalledOnce();
    expect(moveTo).toHaveBeenCalledTimes(2);
    expect(lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.strokeStyle).toBe("red");
    expect(ctx.lineWidth).toBe(2);
  });

  it("starts a new stroke batch when the style or width changes", () => {
    const { ctx, beginPath, stroke } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "stroke",
        style: "red",
        width: 2,
        points: [Vector.create(0, 0), Vector.create(10, 0)],
      },
      {
        op: "stroke",
        style: "blue",
        width: 2,
        points: [Vector.create(0, 10), Vector.create(10, 10)],
      },
    ];

    executeDrawOps(ctx, ops);

    expect(beginPath).toHaveBeenCalledTimes(2);
    expect(stroke).toHaveBeenCalledTimes(2);
  });

  it("leaves strokeStyle/lineWidth untouched when an op doesn't specify them", () => {
    const { ctx } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "stroke",
        style: undefined,
        width: undefined,
        points: [Vector.create(0, 0), Vector.create(10, 0)],
      },
    ];

    executeDrawOps(ctx, ops);

    expect(ctx.strokeStyle).toBeUndefined();
    expect(ctx.lineWidth).toBeUndefined();
  });

  it("batches consecutive same-style fills whose bounds don't overlap", () => {
    const { ctx, beginPath, fill } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "fill",
        style: "green",
        segment: {
          kind: "polygon",
          points: [Vector.create(0, 0), Vector.create(1, 0), Vector.create(1, 1)],
        },
        bounds: { min: Vector.create(0, 0), max: Vector.create(1, 1) },
      },
      {
        op: "fill",
        style: "green",
        segment: {
          kind: "polygon",
          points: [Vector.create(5, 5), Vector.create(6, 5), Vector.create(6, 6)],
        },
        bounds: { min: Vector.create(5, 5), max: Vector.create(6, 6) },
      },
    ];

    executeDrawOps(ctx, ops);

    expect(beginPath).toHaveBeenCalledOnce();
    expect(fill).toHaveBeenCalledOnce();
    expect(ctx.fillStyle).toBe("green");
  });

  it("starts a new fill batch when the next op's bounds overlap the running batch", () => {
    const { ctx, beginPath, fill } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "fill",
        style: "green",
        segment: {
          kind: "polygon",
          points: [Vector.create(0, 0), Vector.create(2, 0), Vector.create(2, 2)],
        },
        bounds: { min: Vector.create(0, 0), max: Vector.create(2, 2) },
      },
      {
        op: "fill",
        style: "green",
        segment: {
          kind: "polygon",
          points: [Vector.create(1, 1), Vector.create(3, 1), Vector.create(3, 3)],
        },
        bounds: { min: Vector.create(1, 1), max: Vector.create(3, 3) },
      },
    ];

    executeDrawOps(ctx, ops);

    expect(beginPath).toHaveBeenCalledTimes(2);
    expect(fill).toHaveBeenCalledTimes(2);
  });

  it("starts a new fill batch when the style changes", () => {
    const { ctx, beginPath, fill } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "fill",
        style: "green",
        segment: { kind: "arc", center: Vector.create(0, 0), radius: 1 },
        bounds: { min: Vector.create(-1, -1), max: Vector.create(1, 1) },
      },
      {
        op: "fill",
        style: "red",
        segment: { kind: "arc", center: Vector.create(10, 10), radius: 1 },
        bounds: { min: Vector.create(9, 9), max: Vector.create(11, 11) },
      },
    ];

    executeDrawOps(ctx, ops);

    expect(beginPath).toHaveBeenCalledTimes(2);
    expect(fill).toHaveBeenCalledTimes(2);
  });

  it("draws arc segments via ctx.arc, moved-to from the rightmost point", () => {
    const { ctx, moveTo, arc } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "fill",
        style: undefined,
        segment: { kind: "arc", center: Vector.create(5, 5), radius: 3 },
        bounds: { min: Vector.create(2, 2), max: Vector.create(8, 8) },
      },
    ];

    executeDrawOps(ctx, ops);

    expect(moveTo).toHaveBeenCalledWith(8, 5);
    expect(arc).toHaveBeenCalledWith(5, 5, 3, 0, 2 * Math.PI);
  });

  it("runs fillText ops individually, applying font and style", () => {
    const { ctx, fillText } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "fillText",
        style: "black",
        font: "16px sans-serif",
        text: "hi",
        x: 1,
        y: 2,
        maxWidth: 50,
      },
    ];

    executeDrawOps(ctx, ops);

    expect(ctx.font).toBe("16px sans-serif");
    expect(ctx.fillStyle).toBe("black");
    expect(fillText).toHaveBeenCalledWith("hi", 1, 2, 50);
  });

  it("does not batch strokes across an intervening fillText op", () => {
    const { ctx, beginPath, stroke } = fakeCtx();
    const ops: DrawOp[] = [
      {
        op: "stroke",
        style: "red",
        width: 1,
        points: [Vector.create(0, 0), Vector.create(1, 0)],
      },
      {
        op: "fillText",
        style: undefined,
        font: undefined,
        text: "x",
        x: 0,
        y: 0,
        maxWidth: undefined,
      },
      {
        op: "stroke",
        style: "red",
        width: 1,
        points: [Vector.create(0, 1), Vector.create(1, 1)],
      },
    ];

    executeDrawOps(ctx, ops);

    expect(beginPath).toHaveBeenCalledTimes(2);
    expect(stroke).toHaveBeenCalledTimes(2);
  });
});

describe("renderBatchedPrimitives", () => {
  it("projects and draws a mix of primitive kinds", () => {
    const { ctx, beginPath, fill, stroke, fillText } = fakeCtx();
    const point = createPoint({ point: Vector.create(0, 0, 0) });
    const line = createLine({
      points: [Vector.create(0, 0, 0), Vector.create(1, 1, 1)],
    });
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 0),
        Vector.create(1, 0, 0),
        Vector.create(0, 1, 0),
      ],
    });

    const projected = [
      {
        type: "Point",
        primitive: point,
        projected: Vector.create(0, 0),
      } as ProjectedPoint,
      {
        type: "Line",
        primitive: line,
        projected: [Vector.create(0, 0), Vector.create(10, 10)],
      } as ProjectedLine,
      {
        type: "Polygon",
        primitive: polygon,
        projected: [
          Vector.create(0, 0),
          Vector.create(10, 0),
          Vector.create(0, 10),
        ],
      } as ProjectedPolygon,
    ];

    renderBatchedPrimitives(ctx, projected, projectOptions);

    // Point -> one arc fill, Line -> one stroke, Polygon -> one polygon
    // fill: no two consecutive ops share both "op" and style, so none of
    // them batch together.
    expect(beginPath).toHaveBeenCalledTimes(3);
    expect(fill).toHaveBeenCalledTimes(2);
    expect(stroke).toHaveBeenCalledOnce();
    expect(fillText).not.toHaveBeenCalled();
  });

  it("batches consecutive same-style, non-overlapping points into one fill call", () => {
    const { ctx, beginPath, fill } = fakeCtx();
    const pointA = createPoint({ point: Vector.create(0, 0, 0), style: "red" });
    const pointB = createPoint({ point: Vector.create(5, 0, 0), style: "red" });

    const projected = [
      {
        type: "Point",
        primitive: pointA,
        projected: Vector.create(0, 0),
      } as ProjectedPoint,
      {
        type: "Point",
        primitive: pointB,
        projected: Vector.create(50, 0),
      } as ProjectedPoint,
    ];

    renderBatchedPrimitives(ctx, projected, projectOptions);

    expect(beginPath).toHaveBeenCalledOnce();
    expect(fill).toHaveBeenCalledOnce();
    expect(ctx.fillStyle).toBe("red");
  });
});
