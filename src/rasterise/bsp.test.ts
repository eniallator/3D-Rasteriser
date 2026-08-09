import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { buildBSPTree, traverseBackToFront } from "./bsp";
import {
  createLine,
  createPoint,
  createPolygon,
  type BSPNode,
  type Polygon,
} from "./types";

const vec3 = (x: number, y: number, z: number): Vector<3> =>
  Vector.create(x, y, z);

function square(ox: number, oy: number, z: number, size = 1): Polygon {
  return createPolygon({
    points: [
      vec3(ox, oy, z),
      vec3(ox + size, oy, z),
      vec3(ox + size, oy + size, z),
      vec3(ox, oy + size, z),
    ],
  });
}

function findNodeWithCoplanar(node: BSPNode): BSPNode & { type: "branch" } {
  if (node.type === "branch" && node.coplanar.length > 1) return node;
  if (node.type === "branch") {
    try {
      return findNodeWithCoplanar(node.left);
    } catch {
      return findNodeWithCoplanar(node.right);
    }
  }
  throw new Error("no coplanar bucket found");
}

describe("buildBSPTree", () => {
  it("returns a single leaf, unchanged, for a scene with no polygons", () => {
    const point = createPoint({ point: vec3(0, 0, 0) });
    const line = createLine({ points: [vec3(0, 0, 0), vec3(1, 1, 1)] });

    const tree = buildBSPTree([point, line]);

    expect(tree).toEqual({ type: "leaf", primitives: [point, line] });
  });

  it("splits a straddling Line by the polygon's plane into front/back pieces", () => {
    const polygon = square(0, 0, 0);
    const line = createLine({ points: [vec3(5, 5, -1), vec3(5, 5, 1)] });

    const tree = buildBSPTree([polygon, line]);

    const flattened = traverseBackToFront(tree, vec3(0, 0, -10));
    const lines = flattened.filter(p => p.type === "Line");

    expect(lines).toHaveLength(2);
    for (const piece of lines) {
      expect(piece.points).toHaveLength(2);
    }
    const zRanges = lines
      .map(piece => piece.points.map(p => p.z()).sort((a, b) => a - b))
      .sort((a, b) => a[0] - b[0]);
    expect(zRanges).toEqual([
      [-1, 0],
      [0, 1],
    ]);
  });

  it("orders coplanar polygons by their original scene index", () => {
    const polys = [square(0, 0, 0), square(10, 0, 0), square(20, 0, 0)];

    const tree = buildBSPTree([...polys]);
    const node = findNodeWithCoplanar(tree);

    expect(node.coplanar).toEqual(polys);
  });

  it("preserves original-index order through an unrelated straddling split", () => {
    const polys = [square(0, 0, 0), square(10, 0, 0), square(20, 0, 0)];
    const straddler = createPolygon({
      points: [
        vec3(50, -3, -3),
        vec3(56, -3, -3),
        vec3(56, 3, 3),
        vec3(50, 3, 3),
      ],
    });
    const scene = [polys[0], straddler, polys[1], polys[2]] as Polygon[];

    const tree = buildBSPTree([...scene]);
    const node = findNodeWithCoplanar(tree);

    expect(node.coplanar).toEqual(polys);
  });
});

describe("traverseBackToFront", () => {
  it("orders two non-overlapping polygons from farthest to nearest", () => {
    const near = square(0, 0, 0);
    const far = square(0, 0, 5);

    const tree = buildBSPTree([near, far]);

    expect(traverseBackToFront(tree, vec3(0, 0, -10))).toEqual([far, near]);
    expect(traverseBackToFront(tree, vec3(0, 0, 10))).toEqual([near, far]);
  });

  it("flattens the whole tree, losing no primitives, for a non-splitting scene", () => {
    const polys = [square(0, 0, 0), square(10, 0, 5), square(20, 0, 10)];
    const point = createPoint({ point: vec3(0, 0, 0) });

    const tree = buildBSPTree([...polys, point]);
    const flattened = traverseBackToFront(tree, vec3(0, 0, -50));

    expect(flattened).toHaveLength(4);
    for (const p of polys) expect(flattened).toContain(p);
    expect(flattened).toContain(point);
  });
});
