import { Vector } from "vectyped";

import { boundsOf, boundsOverlap } from "./helpers";
import { cameraBasis, type ProjectOptions } from "./project";
import type {
  AABB,
  BVHNode,
  Plane,
  Primitive2D,
  SplittablePrimitive,
} from "./types";

export const primitiveBounds = (primitive: Primitive2D): AABB<3> =>
  boundsOf(primitive.type === "Point" ? [primitive.point] : primitive.points);

const mergeBounds = (a: AABB<3>, b: AABB<3>): AABB<3> => ({
  min: a.min.copy().min(b.min),
  max: a.max.copy().max(b.max),
});

const BVH_LEAF_SIZE = 4;

interface PrimitiveWithBounds {
  primitive: SplittablePrimitive;
  bounds: AABB<3>;
  centroid: Vector<3>;
}

function buildBVHNode(items: PrimitiveWithBounds[]): BVHNode {
  const bounds = items.map(item => item.bounds).reduce(mergeBounds);

  if (items.length <= BVH_LEAF_SIZE) {
    return {
      type: "leaf",
      bounds,
      primitives: items.map(item => item.primitive),
    };
  }

  const centroidBounds = items
    .map((item): AABB<3> => ({ min: item.centroid, max: item.centroid }))
    .reduce(mergeBounds);
  const spread = centroidBounds.max.copy().sub(centroidBounds.min);
  const axis = [0, 1, 2].reduce((best, i) =>
    spread.valueOf(i) > spread.valueOf(best) ? i : best
  );

  const sorted = [...items].sort(
    (a, b) => a.centroid.valueOf(axis) - b.centroid.valueOf(axis)
  );
  const mid = Math.floor(sorted.length / 2);

  return {
    type: "branch",
    bounds,
    left: buildBVHNode(sorted.slice(0, mid)),
    right: buildBVHNode(sorted.slice(mid)),
  };
}

export function buildBVH(primitives: SplittablePrimitive[]): BVHNode {
  if (primitives.length === 0) {
    return {
      type: "leaf",
      bounds: { min: Vector.zero(3), max: Vector.zero(3) },
      primitives: [],
    };
  }

  const withBounds = primitives.map((primitive): PrimitiveWithBounds => {
    const bounds = primitiveBounds(primitive);
    return {
      primitive,
      bounds,
      centroid: bounds.min.copy().add(bounds.max).divide(2),
    };
  });
  return buildBVHNode(withBounds);
}

function sidePlaneThrough(
  viewPos: Vector<3>,
  c1: Vector<3>,
  c2: Vector<3>,
  dirNorm: Vector<3>
): Plane {
  const normal = c1.copy().sub(viewPos).crossProduct(c2.copy().sub(viewPos));
  if (normal.dot(dirNorm) < 0) normal.multiply(-1);
  normal.normalise();
  return { norm: normal, d: -normal.dot(viewPos) };
}

export function buildFrustumPlanes(projectOptions: ProjectOptions): Plane[] {
  const { viewPos, dirNorm, screenDim } = projectOptions;
  const { screenCenterPos, xAxis, yAxis } = cameraBasis(projectOptions);

  const aspectRatio = screenDim.x() / screenDim.y();
  const halfW = 0.5 * aspectRatio;
  const halfH = 0.5;
  const center3D = viewPos.copy().add(screenCenterPos);

  const corners = (
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
  ).map(([sx, sy]) =>
    center3D
      .copy()
      .add(xAxis.copy().multiply(sx * halfW))
      .add(yAxis.copy().multiply(sy * halfH))
  );

  const sidePlanes = corners.map((corner, i) =>
    sidePlaneThrough(
      viewPos,
      corner,
      corners.at((i + 1) % corners.length) as Vector<3>,
      dirNorm
    )
  );

  const nearPlane: Plane = { norm: dirNorm, d: -dirNorm.dot(viewPos) };
  return [nearPlane, ...sidePlanes];
}

const aabbOutsidePlane = (bounds: AABB<3>, plane: Plane): boolean =>
  plane.norm.dot(
    Vector.create(
      plane.norm.x() >= 0 ? bounds.max.x() : bounds.min.x(),
      plane.norm.y() >= 0 ? bounds.max.y() : bounds.min.y(),
      plane.norm.z() >= 0 ? bounds.max.z() : bounds.min.z()
    )
  ) +
    plane.d <
  0;

export const aabbInFrustum = (
  bounds: AABB<3>,
  frustumPlanes: Plane[]
): boolean => !frustumPlanes.some(plane => aabbOutsidePlane(bounds, plane));

export function queryFrustum(
  node: BVHNode,
  frustumPlanes: Plane[]
): SplittablePrimitive[] {
  if (!aabbInFrustum(node.bounds, frustumPlanes)) return [];
  if (node.type === "leaf") return node.primitives;
  return [
    ...queryFrustum(node.left, frustumPlanes),
    ...queryFrustum(node.right, frustumPlanes),
  ];
}

export function queryOverlapping(
  node: BVHNode,
  targetBounds: AABB<3>
): SplittablePrimitive[] {
  if (!boundsOverlap(node.bounds, targetBounds)) return [];
  if (node.type === "leaf") return node.primitives;
  return [
    ...queryOverlapping(node.left, targetBounds),
    ...queryOverlapping(node.right, targetBounds),
  ];
}
