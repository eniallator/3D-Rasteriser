import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { cutPolygonSignedDistances, resolveIntersections } from "./intersect";
import {
  createLine,
  createPoint,
  createPolygon,
  type Line,
  type Polygon,
} from "./types";

const vec3 = (x: number, y: number, z = 0): Vector<3> => Vector.create(x, y, z);

describe("cutPolygonSignedDistances", () => {
  it("splits a straddling polygon into a front piece and a back piece", () => {
    const polygon = createPolygon({
      points: [vec3(0, 1), vec3(1, 1), vec3(1, -1), vec3(0, -1)],
    });
    // Using each point's y-coordinate as its signed distance to the y=0 plane.
    const pieces = cutPolygonSignedDistances(polygon, [1, 1, -1, -1]);

    expect(pieces).toHaveLength(2);
    const [front, back] = pieces as [Polygon, Polygon];
    expect(front.points.every(p => p.y() >= -1e-9)).toBe(true);
    expect(back.points.every(p => p.y() <= 1e-9)).toBe(true);

    // The two pieces should share the same pair of crossing points (y=0).
    const frontCrossings = front.points.filter(p => Math.abs(p.y()) < 1e-9);
    const backCrossings = back.points.filter(p => Math.abs(p.y()) < 1e-9);
    expect(frontCrossings).toHaveLength(2);
    expect(backCrossings).toHaveLength(2);
  });

  it("returns no pieces when the polygon doesn't actually straddle", () => {
    const polygon = createPolygon({
      points: [vec3(0, 1), vec3(1, 1), vec3(1, 2), vec3(0, 2)],
    });
    const pieces = cutPolygonSignedDistances(polygon, [1, 1, 2, 2]);
    expect(pieces).toEqual([]);
  });
});

describe("resolveIntersections", () => {
  it("leaves non-intersecting primitives untouched, preserving identity", () => {
    const line = createLine({ points: [vec3(0, 0), vec3(1, 0)] });
    const point = createPoint({ point: vec3(100, 100) });
    const polygon = createPolygon({
      points: [vec3(50, 50), vec3(51, 50), vec3(50, 51)],
    });

    const result = resolveIntersections([line, point, polygon]);

    expect(result).toContain(line);
    expect(result).toContain(point);
    expect(result).toContain(polygon);
    expect(result).toHaveLength(3);
  });

  it("splits two crossing lines at their intersection point", () => {
    const a = createLine({ points: [vec3(-1, 0), vec3(1, 0)] });
    const b = createLine({ points: [vec3(0, -1), vec3(0, 1)] });

    const result = resolveIntersections([a, b]) as Line[];

    expect(result).toHaveLength(4);
    expect(result).not.toContain(a);
    expect(result).not.toContain(b);
    for (const line of result) {
      expect(line.points).toHaveLength(2);
    }
    // Every piece should touch the crossing point (0,0).
    const touchesOrigin = result.filter(line =>
      line.points.some(p => p.x() === 0 && p.y() === 0)
    );
    expect(touchesOrigin).toHaveLength(4);
  });

  it("splits a line crossing a polygon's plane, leaving the polygon untouched", () => {
    const line = createLine({
      points: [vec3(0.5, 0.5, -1), vec3(0.5, 0.5, 1)],
    });
    const polygon = createPolygon({
      points: [vec3(0, 0, 0), vec3(1, 0, 0), vec3(1, 1, 0), vec3(0, 1, 0)],
    });

    const result = resolveIntersections([line, polygon]);

    expect(result).toContain(polygon);
    const lines = result.filter((p): p is Line => p.type === "Line");
    expect(lines).toHaveLength(2);
    expect(lines).not.toContain(line);
    for (const piece of lines) {
      expect(piece.points).toHaveLength(2);
    }
  });

  it("does not split two overlapping polygons, leaving that to the BSP", () => {
    const a = createPolygon({
      points: [vec3(0, 0), vec3(2, 0), vec3(2, 2), vec3(0, 2)],
    });
    const b = createPolygon({
      points: [vec3(1, 1), vec3(3, 1), vec3(3, 3), vec3(1, 3)],
    });

    const result = resolveIntersections([a, b]);

    expect(result).toEqual([a, b]);
  });

  it("only cuts crossing pairs among many spatially separated non-crossing pairs", () => {
    const lines: Line[] = [];
    const crossingAt = [2, 7];

    for (let i = 0; i < 10; i++) {
      const ox = i * 50;
      if (crossingAt.includes(i)) {
        lines.push(
          createLine({ points: [vec3(ox - 1, 0), vec3(ox + 1, 0)] }),
          createLine({ points: [vec3(ox, -1), vec3(ox, 1)] })
        );
      } else {
        lines.push(
          createLine({ points: [vec3(ox - 1, 0), vec3(ox + 1, 0)] }),
          createLine({ points: [vec3(ox - 1, 5), vec3(ox + 1, 5)] })
        );
      }
    }

    const result = resolveIntersections([...lines]);
    // 2 crossing pairs -> 4 pieces each = 8; 8 untouched pairs -> 16 originals.
    expect(result).toHaveLength(8 + 16);
  });

  it("resolves a cascading split correctly regardless of processing order", () => {
    // A (y=0) crosses B (x=2) at (2,0); C (y=1) crosses B at (2,1).
    // A and C are parallel so they never cross each other.
    const a = createLine({ points: [vec3(-1, 0), vec3(5, 0)] });
    const b = createLine({ points: [vec3(2, -2), vec3(2, 2)] });
    const c = createLine({ points: [vec3(1, 1), vec3(3, 1)] });

    const result = resolveIntersections([a, b, c]) as Line[];

    expect(result).toHaveLength(7);
    expect(result).not.toContain(a);
    expect(result).not.toContain(b);
    expect(result).not.toContain(c);

    const bPieces = result.filter(line =>
      line.points.every(p => Math.abs(p.x() - 2) < 1e-9)
    );
    expect(bPieces).toHaveLength(3);
  });

  it("leaves Point primitives untouched", () => {
    const point = createPoint({ point: vec3(0, 0) });
    const line = createLine({ points: [vec3(-1, -1), vec3(1, 1)] });

    const result = resolveIntersections([point, line]);
    expect(result).toContain(point);
  });
});
