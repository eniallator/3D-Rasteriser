import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { buildBSPTree, sampleIndices, traverseBackToFront } from "./bsp";
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

  it("chooses the same splitter across rebuilds of a scene above the sampling cap, even when the ideal splitter narrowly makes or misses the sampled pool", () => {
    const verticalQuad = (x: number): Polygon =>
      createPolygon({
        points: [
          vec3(x, -1, -1),
          vec3(x, 1, -1),
          vec3(x, 1, 1),
          vec3(x, -1, 1),
        ],
      });

    const buildScene = (): Polygon[] => {
      const great = createPolygon({ ...verticalQuad(0), style: "great" });
      const targets = [verticalQuad(5), verticalQuad(-5)];
      const decoys = Array.from({ length: 24 }, (_, i) =>
        verticalQuad(i < 12 ? 1000 + i : -1000 - i)
      );
      return [great, ...targets, ...decoys];
    };

    const outcomes = Array.from({ length: 15 }, () => {
      const tree = buildBSPTree(buildScene());
      return tree.type === "branch" && tree.coplanar[0]?.style === "great";
    });

    expect(new Set(outcomes).size).toBe(1);
  });

  it("doesn't let Point primitives sway which polygon is chosen as splitter", () => {
    const candidateA = createPolygon({
      points: [vec3(0, -1, -1), vec3(0, 1, -1), vec3(0, 1, 1), vec3(0, -1, 1)],
      style: "A",
    });
    const candidateB = createPolygon({
      points: [vec3(-1, -1, 0), vec3(1, -1, 0), vec3(1, 1, 0), vec3(-1, 1, 0)],
      style: "B",
    });
    const balancers = [
      createPolygon({
        points: [vec3(5, -1, 4), vec3(6, -1, 4), vec3(6, 1, 4), vec3(5, 1, 4)],
      }),
      createPolygon({
        points: [
          vec3(-6, -1, 3),
          vec3(-5, -1, 3),
          vec3(-5, 1, 3),
          vec3(-6, 1, 3),
        ],
      }),
    ];

    const swayingPoints = Array.from({ length: 20 }, (_, i) =>
      createPoint({ point: vec3(10, 0, i < 10 ? 10 : -10) })
    );

    const tree = buildBSPTree([
      candidateA,
      candidateB,
      ...balancers,
      ...swayingPoints,
    ]);

    expect(tree.type === "branch" && tree.coplanar[0]?.style).toBe("A");
  });
});

describe("sampleIndices", () => {
  it("returns the same indices every time for the same pool/count, so a scene rebuilt every frame picks the same splitter candidates", () => {
    const first = sampleIndices(30, 20);
    const second = sampleIndices(30, 20);

    expect(second).toEqual(first);
  });

  it("returns `count` unique in-bounds indices when the pool is larger than count", () => {
    const indices = sampleIndices(30, 20);

    expect(indices).toHaveLength(20);
    expect(new Set(indices).size).toBe(20);
    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(30);
    }
  });

  it("returns every index in order when the pool is at or below count", () => {
    expect(sampleIndices(5, 20)).toEqual([0, 1, 2, 3, 4]);
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
