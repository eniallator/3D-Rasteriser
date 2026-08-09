import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import {
  boundsOf,
  boundsOverlap,
  findSqrDist,
  intersect,
  optSetFill,
  optSetStroke,
  planeSide,
  pointsToPlane,
} from "./helpers";
import { createLine, createPoint, createPolygon } from "./types";

function fakeCtx(): CanvasRenderingContext2D {
  return {} as CanvasRenderingContext2D;
}

describe("optSetStroke", () => {
  it("sets strokeStyle directly when given a plain value", () => {
    const ctx = fakeCtx();
    optSetStroke(ctx, "red", undefined);
    expect(ctx.strokeStyle).toBe("red");
  });

  it("calls the style function with args and sets the result", () => {
    const ctx = fakeCtx();
    const style = vi.fn(() => "blue");
    optSetStroke(ctx, style, "the-args");
    expect(style).toHaveBeenCalledWith("the-args");
    expect(ctx.strokeStyle).toBe("blue");
  });

  it("does nothing when style is undefined", () => {
    const ctx = fakeCtx();
    optSetStroke(ctx, undefined, undefined);
    expect(ctx.strokeStyle).toBeUndefined();
  });
});

describe("optSetFill", () => {
  it("sets fillStyle directly when given a plain value", () => {
    const ctx = fakeCtx();
    optSetFill(ctx, "green", undefined);
    expect(ctx.fillStyle).toBe("green");
  });

  it("calls the style function with args and sets the result", () => {
    const ctx = fakeCtx();
    const style = vi.fn(() => "yellow");
    optSetFill(ctx, style, "the-args");
    expect(style).toHaveBeenCalledWith("the-args");
    expect(ctx.fillStyle).toBe("yellow");
  });

  it("does nothing when style is undefined", () => {
    const ctx = fakeCtx();
    optSetFill(ctx, undefined, undefined);
    expect(ctx.fillStyle).toBeUndefined();
  });
});

describe("findSqrDist", () => {
  it("returns equal avg/min/max for a Point primitive", () => {
    const point = createPoint({ point: Vector.create(3, 4, 0) });
    const result = findSqrDist(Vector.create(0, 0, 0), point);
    expect(result).toEqual({ avg: 25, min: 25, max: 25 });
  });

  it("returns min/max over each point and avg to the centroid for a Line", () => {
    const line = createLine({
      points: [Vector.create(0, 0, 0), Vector.create(10, 0, 0)],
    });
    const result = findSqrDist(Vector.create(0, 0, 0), line);
    expect(result.min).toBe(0);
    expect(result.max).toBe(100);
    // Centroid is (5,0,0), distance from origin squared is 25.
    expect(result.avg).toBe(25);
  });

  it("returns min/max over each point and avg to the centroid for a Polygon", () => {
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 0),
        Vector.create(4, 0, 0),
        Vector.create(4, 4, 0),
        Vector.create(0, 4, 0),
      ],
    });
    const result = findSqrDist(Vector.create(0, 0, 0), polygon);
    expect(result.min).toBe(0);
    expect(result.max).toBe(32);
    // Centroid is (2,2,0), distance from origin squared is 8.
    expect(result.avg).toBe(8);
  });
});

describe("intersect", () => {
  it("finds the perpendicular foot of a point onto a line, symmetric case", () => {
    const result = intersect(
      Vector.create(0, 0),
      Vector.create(10, 0),
      Vector.create(5, 5)
    );
    expect(result.x()).toBeCloseTo(5);
    expect(result.y()).toBeCloseTo(0);
  });

  it("finds the perpendicular foot of a point onto a line, asymmetric case", () => {
    const result = intersect(
      Vector.create(0, 0),
      Vector.create(10, 0),
      Vector.create(2, 3)
    );
    expect(result.x()).toBeCloseTo(2);
    expect(result.y()).toBeCloseTo(0);
  });
});

describe("pointsToPlane", () => {
  it("computes the normal and offset of the plane through 3 points", () => {
    const plane = pointsToPlane([
      Vector.create(0, 0, 0),
      Vector.create(1, 0, 0),
      Vector.create(0, 1, 0),
    ]);

    expect(plane.norm.x()).toBeCloseTo(0);
    expect(plane.norm.y()).toBeCloseTo(0);
    expect(Math.abs(plane.norm.z())).toBeCloseTo(1);
    expect(plane.d).toBeCloseTo(0);

    for (const point of [
      Vector.create(0, 0, 0),
      Vector.create(1, 0, 0),
      Vector.create(0, 1, 0),
    ]) {
      expect(plane.norm.dot(point) + plane.d).toBeCloseTo(0);
    }
  });
});

describe("planeSide", () => {
  const plane = { norm: Vector.create(0, 0, 1), d: 0 };

  it("returns 1 for a point in front of the plane", () => {
    expect(planeSide(Vector.create(0, 0, 5), plane)).toBe(1);
  });

  it("returns -1 for a point behind the plane", () => {
    expect(planeSide(Vector.create(0, 0, -5), plane)).toBe(-1);
  });

  it("returns 0 for a point on the plane", () => {
    expect(planeSide(Vector.create(3, -2, 0), plane)).toBe(0);
  });
});

describe("boundsOf", () => {
  it("computes the component-wise min/max across all points", () => {
    const bounds = boundsOf([
      Vector.create(1, -5, 2),
      Vector.create(-3, 4, 0),
      Vector.create(2, 2, 9),
    ]);

    expect(bounds.min.x()).toBe(-3);
    expect(bounds.min.y()).toBe(-5);
    expect(bounds.min.z()).toBe(0);
    expect(bounds.max.x()).toBe(2);
    expect(bounds.max.y()).toBe(4);
    expect(bounds.max.z()).toBe(9);
  });

  it("returns a zero-size box for a single point", () => {
    const bounds = boundsOf([Vector.create(1, 2, 3)]);
    expect(bounds.min).toEqual(bounds.max);
  });
});

describe("boundsOverlap", () => {
  it("returns true for overlapping boxes", () => {
    const a = { min: Vector.create(0, 0, 0), max: Vector.create(2, 2, 2) };
    const b = { min: Vector.create(1, 1, 1), max: Vector.create(3, 3, 3) };
    expect(boundsOverlap(a, b)).toBe(true);
  });

  it("returns false for boxes that are clearly separated", () => {
    const a = { min: Vector.create(0, 0, 0), max: Vector.create(1, 1, 1) };
    const b = { min: Vector.create(5, 5, 5), max: Vector.create(6, 6, 6) };
    expect(boundsOverlap(a, b)).toBe(false);
  });

  it("returns true for zero-thickness boxes touching exactly on one axis", () => {
    // Two coplanar (z=0) boxes that only touch at x=1.
    const a = { min: Vector.create(0, 0, 0), max: Vector.create(1, 1, 0) };
    const b = { min: Vector.create(1, 0, 0), max: Vector.create(2, 1, 0) };
    expect(boundsOverlap(a, b)).toBe(true);
  });
});
