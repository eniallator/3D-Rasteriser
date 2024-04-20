import { isFunction } from "../../core/guard";
import { checkExhausted } from "../../core/utils";
import { optSetFill, optSetStroke } from "./helpers";
import {
  ProjectedPrimitive,
  ProjectedLine,
  ProjectedPoint,
  ProjectedPolygon,
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
  const { label } = point.primitive;
  if (label != null) {
    if (label.font != null) {
      ctx.font = isFunction(label.font) ? label.font(point) : label.font;
    }
    optSetFill(ctx, label.style, point);
    const textWidth = ctx.measureText(label.text).width;
    ctx.fillText(
      label.text,
      point.projected.x() -
        (label.maxWidth != null
          ? Math.min(textWidth, label.maxWidth) / 2
          : textWidth / 2),
      point.projected.y(),
      label.maxWidth
    );
  }
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

function renderPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: ProjectedPolygon
): void {
  optSetFill(ctx, polygon.primitive.style, polygon);
  ctx.beginPath();
  for (let i = 0; i < polygon.projected.length; i++) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...polygon.projected[i].toArray());
  }
  ctx.fill();
}

export function renderPrimitive(
  ctx: CanvasRenderingContext2D,
  projected: ProjectedPrimitive
): void {
  switch (projected.type) {
    case "Point":
      renderPoint(ctx, projected);
      break;
    case "Line":
      renderLine(ctx, projected);
      break;
    case "Polygon":
      renderPolygon(ctx, projected);
      break;
    default:
      return checkExhausted(projected);
  }
}
