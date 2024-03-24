import { isFunction } from "../../core/guard";
import { optSetFill, optSetStroke } from "./helpers";
import {
  ProjectedGeometry,
  ProjectedLabel,
  ProjectedLine,
  ProjectedPoint,
  ProjectedTriangle,
} from "./types";

function renderPoint(
  ctx: CanvasRenderingContext2D,
  point: ProjectedPoint
): void {
  optSetFill(ctx, point.geometry.style, point);
  ctx.beginPath();
  ctx.arc(
    ...point.projected.toArray(),
    point.geometry.radius ?? 1,
    0,
    2 * Math.PI
  );
  ctx.fill();
}

function renderLabel(
  ctx: CanvasRenderingContext2D,
  label: ProjectedLabel
): void {
  optSetFill(ctx, label.geometry.style, label);
  if (label.geometry.font != null) {
    ctx.font = isFunction(label.geometry.font)
      ? label.geometry.font(label)
      : label.geometry.font;
  }
  const textWidth = ctx.measureText(label.geometry.text).width;
  ctx.fillText(
    label.geometry.text,
    label.projected.x() -
      (label.geometry.maxWidth != null
        ? Math.min(textWidth, label.geometry.maxWidth) / 2
        : textWidth / 2),
    label.projected.y(),
    label.geometry.maxWidth
  );
}

function renderLine(ctx: CanvasRenderingContext2D, line: ProjectedLine): void {
  if (line.geometry.width != null) {
    ctx.lineWidth = line.geometry.width;
  }
  optSetStroke(ctx, line.geometry.style, line);
  ctx.beginPath();
  for (let i = 0; i < line.projected.length; i++) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...line.projected[i].toArray());
  }
  ctx.stroke();
}

function renderTriangle(
  ctx: CanvasRenderingContext2D,
  triangle: ProjectedTriangle
): void {
  optSetFill(ctx, triangle.geometry.style, triangle);
  ctx.beginPath();
  for (let i = 0; i < triangle.projected.length; i++) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...triangle.projected[i].toArray());
  }
  ctx.fill();
}

export type RenderFn<P extends ProjectedGeometry> = (
  ctx: CanvasRenderingContext2D,
  projected: P
) => void;

type RenderFns = {
  [P in ProjectedGeometry as P["geometry"]["type"]]: RenderFn<P>;
};

export const renderFnMap: RenderFns = {
  Label: renderLabel,
  Line: renderLine,
  Point: renderPoint,
  Triangle: renderTriangle,
};
