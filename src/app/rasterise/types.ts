import Vector from "../../core/Vector";

type OptRunnable<A, R> = R | ((args: A) => R);

export type StrokeStyle<A> = OptRunnable<
  A,
  CanvasFillStrokeStyles["strokeStyle"]
>;

export type FillStyle<A> = OptRunnable<A, CanvasFillStrokeStyles["fillStyle"]>;

export interface ProjectedPoint {
  type: "Point";
  primitive: Point;
  projected: Vector<2>;
}

export interface ProjectedLabel {
  type: "Label";
  primitive: Label;
  projected: Vector<2>;
}

export interface ProjectedLine {
  type: "Line";
  primitive: Line;
  projected: Array<Vector<2>>;
}

export interface ProjectedTriangle {
  type: "Triangle";
  primitive: Triangle;
  projected: Array<Vector<2>>;
}

export type ProjectedPrimitive =
  | ProjectedPoint
  | ProjectedLabel
  | ProjectedLine
  | ProjectedTriangle;

export type ToProjected<A extends Primitive2D> = {
  [P in ProjectedPrimitive as P["type"]]: P;
}[A["type"]];

export interface Point {
  type: "Point";
  point: Vector<3>;
  radius?: number;
  style?: FillStyle<ProjectedPoint>;
}

export interface Label {
  type: "Label";
  point: Vector<3>;
  text: string;
  maxWidth?: number;
  style?: FillStyle<ProjectedLabel>;
  font?: OptRunnable<ProjectedLabel, string>;
}

export interface Line {
  type: "Line";
  points: Array<Vector<3>>;
  width?: number;
  style?: StrokeStyle<ProjectedLine>;
}

export interface Triangle {
  type: "Triangle";
  points: [Vector<3>, Vector<3>, Vector<3>];
  style?: FillStyle<ProjectedTriangle>;
}

export type Primitive1D = Point | Label | Line;
export type Primitive2D = Primitive1D | Triangle;

export function createPoint(point: Omit<Point, "type">): Point {
  return { type: "Point", ...point };
}

export function createLabel(label: Omit<Label, "type">): Label {
  return { type: "Label", ...label };
}

export function createLine(line: Omit<Line, "type">): Line {
  return { type: "Line", ...line };
}

export function createTriangle(triangle: Omit<Triangle, "type">): Triangle {
  return { type: "Triangle", ...triangle };
}

export function isPrimitive1D(
  primitive: Primitive2D
): primitive is Primitive1D {
  return (
    primitive.type === "Point" ||
    primitive.type === "Label" ||
    primitive.type === "Line"
  );
}
