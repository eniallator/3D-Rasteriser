import type { Vector } from "vectyped";

type OptRunnable<A extends readonly unknown[], R> = R | ((...args: A) => R);

export type StrokeStyle<A extends readonly unknown[]> = OptRunnable<
  A,
  CanvasFillStrokeStyles["strokeStyle"]
>;

export type FillStyle<A extends readonly unknown[]> = OptRunnable<
  A,
  CanvasFillStrokeStyles["fillStyle"]
>;

export type Plane = { norm: Vector<3>; d: number };

export type AABB<N extends number> = { min: Vector<N>; max: Vector<N> };

export interface CameraOptions {
  viewPos: Vector<3>;
  dirNorm: Vector<3>;
  fov: number;
}

export interface ProjectedPoint {
  type: "Point";
  primitive: Point;
  projected: Vector<2>;
}

export interface ProjectedLine {
  type: "Line";
  primitive: Line;
  projected: Vector<2>[];
}

export interface ProjectedPolygon {
  type: "Polygon";
  primitive: Polygon;
  projected: Vector<2>[];
}

export type ProjectedSplittablePrimitive = ProjectedLine | ProjectedPolygon;

export type ProjectedPrimitive = ProjectedPoint | ProjectedSplittablePrimitive;

export interface SplitStyleArg<Projected extends ProjectedSplittablePrimitive> {
  original: Projected;
  fragment?: Projected;
}

export type ToProjected<A extends Primitive2D> = {
  [P in ProjectedPrimitive as P["type"]]: P;
}[A["type"]];

export interface Point {
  type: "Point";
  point: Vector<3>;
  radius?: number;
  style?: FillStyle<[ProjectedPoint, CanvasRenderingContext2D]>;
  label?: {
    text: string;
    maxWidth?: number;
    style?: FillStyle<[ProjectedPoint, CanvasRenderingContext2D]>;
    font?: OptRunnable<[ProjectedPoint, CanvasRenderingContext2D], string>;
  };
}

export interface Line {
  type: "Line";
  points: Vector<3>[];
  width?: number;
  style?: StrokeStyle<[SplitStyleArg<ProjectedLine>, CanvasRenderingContext2D]>;
  original?: Line;
}

export interface Polygon {
  type: "Polygon";
  points: [Vector<3>, Vector<3>, Vector<3>, ...Vector<3>[]];
  style?: FillStyle<
    [SplitStyleArg<ProjectedPolygon>, CanvasRenderingContext2D]
  >;
  original?: Polygon;
}

export type Primitive1D = Point | Line;
export type Primitive2D = Primitive1D | Polygon;

/** A Line or a Polygon - the two primitive kinds that can be split by
 * clipping or BSP splitting (unlike Point, which has no extent to split). */
export type SplittablePrimitive = Line | Polygon;

export type PrimitiveBTree<BranchMeta, LeafMeta = Record<never, never>> =
  | ({
      type: "branch";
      left: PrimitiveBTree<BranchMeta, LeafMeta>;
      right: PrimitiveBTree<BranchMeta, LeafMeta>;
    } & BranchMeta)
  | ({ type: "leaf"; primitives: SplittablePrimitive[] } & LeafMeta);

export type BSPNode = PrimitiveBTree<{
  plane: Plane;
  coplanar: SplittablePrimitive[];
}>;
export type BVHNode = PrimitiveBTree<{ bounds: AABB<3> }, { bounds: AABB<3> }>;

export interface PreparedScene {
  tree: BSPNode;
  bvh: BVHNode;
  /**
   * Points never go into the BSP tree - see renderPrepared() for why: a
   * Point has no extent, so it can't be split, and its correct depth
   * relationship to nearby geometry is better decided by comparing actual
   * distance from the camera than by classifying it against whatever plane
   * a *polygon* happened to be split by nearby.
   */
  points: Point[];
}

export function createPoint(point: Omit<Point, "type">): Point {
  return { type: "Point", ...point };
}

export function createLine(line: Omit<Line, "type">): Line {
  return { type: "Line", ...line };
}

export function createPolygon(polygon: Omit<Polygon, "type">): Polygon {
  return { type: "Polygon", ...polygon };
}
