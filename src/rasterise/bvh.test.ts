import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import {
  buildBVH,
  buildFrustumPlanes,
  primitiveBounds,
  queryFrustum,
  queryOverlapping,
} from "./bvh";
import type { ProjectOptions } from "./project";
import {
  createLine,
  createPoint,
  type AABB,
  type BVHNode,
  type Primitive2D,
} from "./types";

const vec3 = (x: number, y: number, z: number): Vector<3> =>
  Vector.create(x, y, z);

function flattenLeaves(node: BVHNode): Primitive2D[] {
  return node.type === "leaf"
    ? node.primitives
    : [...flattenLeaves(node.left), ...flattenLeaves(node.right)];
}

describe("primitiveBounds", () => {
  it("returns a zero-size box at the point for a Point primitive", () => {
    const point = createPoint({ point: vec3(1, 2, 3) });
    const bounds = primitiveBounds(point);

    expect(bounds.min).toEqual(vec3(1, 2, 3));
    expect(bounds.max).toEqual(vec3(1, 2, 3));
  });

  it("returns the bounding box of all points for a Line/Polygon", () => {
    const line = createLine({ points: [vec3(0, 5, -1), vec3(3, -2, 4)] });
    const bounds = primitiveBounds(line);

    expect(bounds.min).toEqual(vec3(0, -2, -1));
    expect(bounds.max).toEqual(vec3(3, 5, 4));
  });
});

describe("buildBVH", () => {
  it("returns an empty leaf for an empty scene", () => {
    const tree = buildBVH([]);
    expect(tree).toEqual({
      type: "leaf",
      bounds: { min: Vector.zero(3), max: Vector.zero(3) },
      primitives: [],
    });
  });

  it("returns a single leaf for a scene at or below the leaf size", () => {
    const points = [vec3(0, 0, 0), vec3(1, 1, 1), vec3(2, 2, 2)].map(p =>
      createPoint({ point: p })
    );
    const tree = buildBVH(points);
    expect(tree.type).toBe("leaf");
  });

  it("branches for a scene larger than the leaf size, preserving every primitive", () => {
    const points = Array.from({ length: 20 }, (_, i) =>
      createPoint({ point: vec3(i * 10, 0, 0) })
    );
    const tree = buildBVH(points);

    expect(tree.type).toBe("branch");
    const leaves = flattenLeaves(tree);
    expect(leaves).toHaveLength(20);
    for (const point of points) expect(leaves).toContain(point);
  });

  it("gives every node bounds that contain all of its descendants", () => {
    const points = Array.from({ length: 20 }, (_, i) =>
      createPoint({ point: vec3(i * 10, i % 3, -i) })
    );
    const tree = buildBVH(points);

    const checkContains = (node: BVHNode): void => {
      for (const primitive of flattenLeaves(node)) {
        const bounds = primitiveBounds(primitive);
        expect(bounds.min.x()).toBeGreaterThanOrEqual(node.bounds.min.x());
        expect(bounds.min.y()).toBeGreaterThanOrEqual(node.bounds.min.y());
        expect(bounds.min.z()).toBeGreaterThanOrEqual(node.bounds.min.z());
        expect(bounds.max.x()).toBeLessThanOrEqual(node.bounds.max.x());
        expect(bounds.max.y()).toBeLessThanOrEqual(node.bounds.max.y());
        expect(bounds.max.z()).toBeLessThanOrEqual(node.bounds.max.z());
      }
      if (node.type === "branch") {
        checkContains(node.left);
        checkContains(node.right);
      }
    };
    checkContains(tree);
  });
});

describe("buildFrustumPlanes + queryFrustum", () => {
  const projectOptions: ProjectOptions = {
    viewPos: vec3(0, 0, 0),
    dirNorm: vec3(0, 0, 1),
    fov: 1,
    screenDim: Vector.create(800, 600),
  };

  it("keeps a point straight ahead and drops one behind the camera", () => {
    const ahead = createPoint({ point: vec3(0, 0, 10) });
    const aheadFiller = Array.from({ length: 5 }, (_, i) =>
      createPoint({ point: vec3(i, 0, 11) })
    );
    const behind = createPoint({ point: vec3(0, 0, -10) });
    const behindFiller = Array.from({ length: 5 }, (_, i) =>
      createPoint({ point: vec3(i, 0, -11) })
    );
    const bvh = buildBVH([ahead, ...aheadFiller, behind, ...behindFiller]);

    const visible = queryFrustum(bvh, buildFrustumPlanes(projectOptions));
    expect(visible).toContain(ahead);
    expect(visible).not.toContain(behind);
  });

  it("keeps a point within the lateral field of view and drops one outside it", () => {
    const aspectRatio = 800 / 600;
    const inside = createPoint({ point: vec3(0.4 * aspectRatio * 10, 0, 10) });
    const insideFiller = Array.from({ length: 5 }, (_, i) =>
      createPoint({ point: vec3(0.4 * aspectRatio * 10, 0, 10 + i * 0.1) })
    );
    const outside = createPoint({ point: vec3(0.6 * aspectRatio * 10, 0, 10) });
    const outsideFiller = Array.from({ length: 5 }, (_, i) =>
      createPoint({ point: vec3(0.6 * aspectRatio * 10, 0, 10 + i * 0.1) })
    );
    const bvh = buildBVH([inside, ...insideFiller, outside, ...outsideFiller]);

    const visible = queryFrustum(bvh, buildFrustumPlanes(projectOptions));
    expect(visible).toContain(inside);
    expect(visible).not.toContain(outside);
  });

  it("prunes an entire cluster whose bounds are fully outside the frustum", () => {
    const nearCluster = Array.from({ length: 6 }, (_, i) =>
      createPoint({ point: vec3(i, 0, 10) })
    );
    const behindCluster = Array.from({ length: 6 }, (_, i) =>
      createPoint({ point: vec3(i, 0, -10) })
    );
    const bvh = buildBVH([...nearCluster, ...behindCluster]);

    const visible = queryFrustum(bvh, buildFrustumPlanes(projectOptions));
    expect(visible).toHaveLength(6);
    for (const point of nearCluster) expect(visible).toContain(point);
  });
});

describe("queryOverlapping", () => {
  it("returns only primitives whose bounds overlap the target box", () => {
    const near = createLine({ points: [vec3(0, 0, 0), vec3(1, 1, 1)] });
    const nearFiller = Array.from({ length: 5 }, (_, i) =>
      createPoint({ point: vec3(0, 0, i * 0.1) })
    );
    const far = createLine({
      points: [vec3(100, 100, 100), vec3(101, 101, 101)],
    });
    const farFiller = Array.from({ length: 5 }, (_, i) =>
      createPoint({ point: vec3(100, 100, 100 + i * 0.1) })
    );
    const bvh = buildBVH([near, ...nearFiller, far, ...farFiller]);

    const target: AABB<3> = { min: vec3(-1, -1, -1), max: vec3(2, 2, 2) };
    const result = queryOverlapping(bvh, target);

    expect(result).toContain(near);
    expect(result).not.toContain(far);
  });

  it("prunes whole subtrees whose combined bounds don't overlap", () => {
    const cluster = Array.from({ length: 6 }, (_, i) =>
      createPoint({ point: vec3(i, 0, 0) })
    );
    const farCluster = Array.from({ length: 6 }, (_, i) =>
      createPoint({ point: vec3(1000 + i, 0, 0) })
    );
    const bvh = buildBVH([...cluster, ...farCluster]);

    const target: AABB<3> = { min: vec3(-1, -1, -1), max: vec3(10, 1, 1) };
    const result = queryOverlapping(bvh, target);

    expect(result).toHaveLength(6);
    for (const point of cluster) expect(result).toContain(point);
  });
});
