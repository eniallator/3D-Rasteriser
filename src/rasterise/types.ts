import type { Vector } from "vectyped";

type OptRunnable<A, R> = R | ((args: A) => R);

export type StrokeStyle<A> = OptRunnable<
  A,
  CanvasFillStrokeStyles["strokeStyle"]
>;

export type FillStyle<A> = OptRunnable<A, CanvasFillStrokeStyles["fillStyle"]>;

export type Plane = { norm: Vector<3>; d: number };

export type AABB<N extends number> = { min: Vector<N>; max: Vector<N> };

export interface ProjectedPoint {
  type: "Point";
  primitive: Point;
  projected: Vector<2>;
}

export interface ProjectedLine {
  type: "Line";
  primitive: Line;
  projected: Array<Vector<2>>;
}

export interface ProjectedPolygon {
  type: "Polygon";
  primitive: Polygon;
  projected: Array<Vector<2>>;
}

export type ProjectedPrimitive =
  ProjectedPoint | ProjectedLine | ProjectedPolygon;

export type ToProjected<A extends Primitive2D> = {
  [P in ProjectedPrimitive as P["type"]]: P;
}[A["type"]];

export interface Point {
  type: "Point";
  point: Vector<3>;
  radius?: number;
  style?: FillStyle<ProjectedPoint>;
  label?: {
    text: string;
    maxWidth?: number;
    style?: FillStyle<ProjectedPoint>;
    font?: OptRunnable<ProjectedPoint, string>;
  };
}

export interface Line {
  type: "Line";
  points: Array<Vector<3>>;
  width?: number;
  style?: StrokeStyle<ProjectedLine>;
}

export interface Polygon {
  type: "Polygon";
  points: [Vector<3>, Vector<3>, Vector<3>, ...Vector<3>[]];
  style?: FillStyle<ProjectedPolygon>;
}

export type Primitive1D = Point | Line;
export type Primitive2D = Primitive1D | Polygon;

export type PrimitiveBTree<BranchMeta, LeafMeta = Record<never, never>> =
  | ({
      type: "branch";
      left: PrimitiveBTree<BranchMeta, LeafMeta>;
      right: PrimitiveBTree<BranchMeta, LeafMeta>;
    } & BranchMeta)
  | ({ type: "leaf"; primitives: Primitive2D[] } & LeafMeta);

export type BSPNode = PrimitiveBTree<{ plane: Plane; coplanar: Primitive2D[] }>;
export type BVHNode = PrimitiveBTree<{ bounds: AABB<3> }, { bounds: AABB<3> }>;

export interface PreparedScene {
  tree: BSPNode;
  bvh: BVHNode;
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
