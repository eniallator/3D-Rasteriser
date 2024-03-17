import Vector from "../../core/Vector";

type RenderStyle<O> =
  | CanvasFillStrokeStyles["strokeStyle"]
  | ((options: O) => CanvasFillStrokeStyles["strokeStyle"]);

export interface Point {
  type: "Point";
  point: Vector<3>;
  radius?: number;
  style?: RenderStyle<Vector<2>>;
}

export interface Line {
  type: "Line";
  points: [Vector<3>, Vector<3>];
  width?: number;
  style?: RenderStyle<[Vector<2>, Vector<2>]>;
}

export interface LineString {
  type: "LineString";
  items: [
    ...Array<{
      point: Vector<3>;
      width?: number;
      style?: RenderStyle<Array<Vector<2>>>;
    }>,
    { point: Vector<3> },
  ];
}

export interface Label {
  type: "Label";
  point: Vector<3>;
  text: string;
  maxWidth?: number;
  style?: RenderStyle<Vector<2>>;
  font?: string | ((projectedPoint: Vector<2>) => string);
}

export type Renderable = Point | Line | LineString | Label;

export function createPoint(point: Omit<Point, "type">): Point {
  return { type: "Point", ...point };
}

export function createLine(line: Omit<Line, "type">): Line {
  return { type: "Line", ...line };
}

export function createLineString(items: LineString["items"]): LineString {
  return { type: "LineString", items };
}

export function createLabel(label: Omit<Label, "type">): Label {
  return { type: "Label", ...label };
}
