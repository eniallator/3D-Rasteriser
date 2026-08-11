import { isFunction } from "deep-guards";
import { checkExhausted } from "niall-utils/core";

import { optSetFill, optSetStroke } from "./helpers";
import type {
  ProjectedLine,
  ProjectedPoint,
  ProjectedPolygon,
  ProjectedPrimitive,
} from "./types";

function renderPoint(
  ctx: CanvasRenderingContext2D,
  point: ProjectedPoint
): void {
  optSetFill(ctx, point.primitive.style, [point, ctx]);
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
      ctx.font = isFunction(label.font) ? label.font(point, ctx) : label.font;
    }
    optSetFill(ctx, label.style, [point, ctx]);
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
  optSetStroke(ctx, line.primitive.style, [line, ctx]);
  ctx.beginPath();
  for (const [i, projected] of line.projected.entries()) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...projected.toArray());
  }
  ctx.stroke();
}

function renderPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: ProjectedPolygon
): void {
  optSetFill(ctx, polygon.primitive.style, [polygon, ctx]);
  ctx.beginPath();
  for (const [i, projected] of polygon.projected.entries()) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...projected.toArray());
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
