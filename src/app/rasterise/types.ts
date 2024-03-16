import Vector from "../../core/Vector";

export interface Point {
  type: "Point";
  point: Vector<3>;
  radius?: number;
  style?: CanvasFillStrokeStyles["fillStyle"];
}

export interface Line {
  type: "Line";
  points: [Vector<3>, Vector<3>];
  width?: number;
  style?: CanvasFillStrokeStyles["strokeStyle"];
}

export interface LineString {
  type: "LineString";
  items: [
    ...Array<{
      point: Vector<3>;
      width?: number;
      style?: CanvasFillStrokeStyles["strokeStyle"];
    }>,
    { point: Vector<3> },
  ];
}

export type Renderable = LineString | Line | Point;

export function point(point: Omit<Point, "type">): Point {
  return { type: "Point", ...point };
}

export function line(line: Omit<Line, "type">): Line {
  return { type: "Line", ...line };
}

export function lineString(items: LineString["items"]): LineString {
  return { type: "LineString", items };
}
