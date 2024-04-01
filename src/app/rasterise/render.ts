import { isFunction } from "../../core/guard";
import { optSetFill, optSetStroke } from "./helpers";
import {
  ProjectedPrimitive,
  ProjectedLabel,
  ProjectedLine,
  ProjectedPoint,
  ProjectedTriangle,
} from "./types";

function renderPoint(
  ctx: CanvasRenderingContext2D,
  point: ProjectedPoint
): void {
  optSetFill(ctx, point.primitive.style, point);
  ctx.beginPath();
  ctx.arc(
    ...point.projected.toArray(),
    point.primitive.radius ?? 1,
    0,
    2 * Math.PI
  );
  ctx.fill();
}

function renderLabel(
  ctx: CanvasRenderingContext2D,
  label: ProjectedLabel
): void {
  optSetFill(ctx, label.primitive.style, label);
  if (label.primitive.font != null) {
    ctx.font = isFunction(label.primitive.font)
      ? label.primitive.font(label)
      : label.primitive.font;
  }
  const textWidth = ctx.measureText(label.primitive.text).width;
  ctx.fillText(
    label.primitive.text,
    label.projected.x() -
      (label.primitive.maxWidth != null
        ? Math.min(textWidth, label.primitive.maxWidth) / 2
        : textWidth / 2),
    label.projected.y(),
    label.primitive.maxWidth
  );
}

function renderLine(ctx: CanvasRenderingContext2D, line: ProjectedLine): void {
  if (line.primitive.width != null) {
    ctx.lineWidth = line.primitive.width;
  }
  optSetStroke(ctx, line.primitive.style, line);
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
  optSetFill(ctx, triangle.primitive.style, triangle);
  ctx.beginPath();
  for (let i = 0; i < triangle.projected.length; i++) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...triangle.projected[i].toArray());
  }
  ctx.fill();
}

export type RenderFn<P extends ProjectedPrimitive> = (
  ctx: CanvasRenderingContext2D,
  projected: P
) => void;

type RenderFns = {
  [P in ProjectedPrimitive as P["primitive"]["type"]]: RenderFn<P>;
};

export const renderFnMap: RenderFns = {
  Label: renderLabel,
  Line: renderLine,
  Point: renderPoint,
  Triangle: renderTriangle,
};
