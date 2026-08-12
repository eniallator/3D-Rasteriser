import { isFunction } from "deep-guards";
import { checkExhausted, tuple } from "niall-utils/core";

import { optSetFill, optSetStroke } from "./helpers";
import { projectPrimitive, type ProjectOptions } from "./project";
import type {
  ProjectedLine,
  ProjectedPoint,
  ProjectedPolygon,
  ProjectedPrimitive,
  SplitStyleArg,
} from "./types";

function splitStyleArg<Projected extends ProjectedLine | ProjectedPolygon>(
  projected: Projected,
  projectOptions: ProjectOptions
): SplitStyleArg<Projected> {
  const { original } = projected.primitive;
  return original == null
    ? { original: projected }
    : {
        fragment: projected,
        original: projectPrimitive(original, projectOptions) as Projected,
      };
}

function renderPoint(
  ctx: CanvasRenderingContext2D,
  point: ProjectedPoint
): void {
  optSetFill(ctx, point.primitive.style, () => tuple(point, ctx));
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
    optSetFill(ctx, label.style, () => tuple(point, ctx));
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

function renderLine(
  ctx: CanvasRenderingContext2D,
  line: ProjectedLine,
  projectOptions: ProjectOptions
): void {
  if (line.primitive.width != null) {
    ctx.lineWidth = line.primitive.width;
  }
  optSetStroke(ctx, line.primitive.style, () =>
    tuple(splitStyleArg(line, projectOptions), ctx)
  );
  ctx.beginPath();
  for (const [i, projected] of line.projected.entries()) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...projected.toArray());
  }
  ctx.stroke();
}

function renderPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: ProjectedPolygon,
  projectOptions: ProjectOptions
): void {
  optSetFill(ctx, polygon.primitive.style, () =>
    tuple(splitStyleArg(polygon, projectOptions), ctx)
  );
  ctx.beginPath();
  for (const [i, projected] of polygon.projected.entries()) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...projected.toArray());
  }
  ctx.closePath();
  ctx.fill();
  // Two polygons that exactly share an edge (e.g. a flat surface the BSP
  // tree cut into pieces) are filled independently, so each anti-aliases
  // its own edge - that can leave a hairline gap of background showing
  // through where they meet. Stroking the same fill colour over the edge
  // "caulks" that gap without visibly thickening solid interior edges.
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function renderPrimitive(
  ctx: CanvasRenderingContext2D,
  projected: ProjectedPrimitive,
  projectOptions: ProjectOptions
): void {
  switch (projected.type) {
    case "Point":
      renderPoint(ctx, projected);
      break;
    case "Line":
      renderLine(ctx, projected, projectOptions);
      break;
    case "Polygon":
      renderPolygon(ctx, projected, projectOptions);
      break;
    default:
      return checkExhausted(projected);
  }
}
