import Vector from "../../core/Vector";

type OptRunnable<A, R> = R | ((args: A) => R);

export type StrokeStyle<A> = OptRunnable<
  A,
  CanvasFillStrokeStyles["strokeStyle"]
>;

export type FillStyle<A> = OptRunnable<A, CanvasFillStrokeStyles["fillStyle"]>;

export interface ProjectedPoint {
  type: "Point";
  geometry: Point;
  projected: Vector<2>;
}

export interface ProjectedLabel {
  type: "Label";
  geometry: Label;
  projected: Vector<2>;
}

export interface ProjectedLine {
  type: "Line";
  geometry: Line;
  projected: Array<Vector<2>>;
}

export interface ProjectedTriangle {
  type: "Triangle";
  geometry: Triangle;
  projected: [Vector<2>, Vector<2>, Vector<2>];
}

export type ProjectedGeometry =
  | ProjectedPoint
  | ProjectedLabel
  | ProjectedLine
  | ProjectedTriangle;

export type ToProjected<G extends Geometry> = {
  [P in ProjectedGeometry as P["type"]]: P;
}[G["type"]];

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

export type Geometry1D = Point | Label | Line;
export type Geometry = Geometry1D | Triangle;

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

export function isGeometry1D(geometry: Geometry): geometry is Geometry1D {
  return (
    geometry.type === "Point" ||
    geometry.type === "Label" ||
    geometry.type === "Line"
  );
}
