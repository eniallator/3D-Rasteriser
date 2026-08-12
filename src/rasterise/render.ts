import { isFunction } from "deep-guards";
import { checkExhausted, tuple } from "niall-utils/core";
import { Vector } from "vectyped";

import { optSetFill, optSetStroke } from "./helpers";
import { projectPrimitive, type ProjectOptions } from "./project";
import type {
  ProjectedLine,
  ProjectedPoint,
  ProjectedPolygon,
  ProjectedPrimitive,
  ProjectedSplittablePrimitive,
  SplitStyleArg,
} from "./types";

function splitStyleArg<Projected extends ProjectedSplittablePrimitive>(
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

// Canvas computes each fill's anti-aliased coverage independently, with no
// awareness of neighbouring shapes - so two polygons sharing an edge (e.g.
// adjacent BSP fragments of one original) can each award that shared
// boundary only partial coverage. Since neither fully covers it, the two
// partial-coverage draws compound to *less* than full opacity there,
// leaving a visibly darker seam even when both polygons are the exact
// same colour - a plain matching-colour stroke doesn't fix this, since
// its own outer edge has the identical "only partial coverage on this
// side" problem.
//
// This instead borrows the "fill convention" GPU rasterisers use to make
// adjacent triangles tile without gaps or double-coverage: extend an edge
// outward by a pixel only if its outward normal points generally
// down-right. A shared edge's outward normal points in exactly opposite
// directions for its two owning polygons, so this rule always picks
// exactly one owner to extend past the boundary - giving full, opaque
// coverage right up to (and a hair past) the seam, with no partial
// coverage left for anything to compound with.
const EDGE_EXTEND_PX = 1;

function outwardNormal(
  from: Vector<2>,
  to: Vector<2>,
  centroid: Vector<2>
): Vector<2> {
  const dir = to.copy().sub(from);
  const candidate = Vector.create(-dir.y(), dir.x());
  const midpoint = from.copy().add(to).divide(2);
  const pointsOutward = candidate.dot(midpoint.copy().sub(centroid)) >= 0;
  return (pointsOutward ? candidate : candidate.copy().multiply(-1)).getNorm();
}

function extendBottomRightEdges(points: Vector<2>[]): Vector<2>[] {
  const n = points.length;
  const centroid = points
    .reduce((sum, point) => sum.add(point), Vector.zero(2))
    .divide(n);

  return points.map((point, i) => {
    const prev = points[(i - 1 + n) % n] as Vector<2>;
    const next = points[(i + 1) % n] as Vector<2>;
    const offset = Vector.zero(2);

    const prevNormal = outwardNormal(prev, point, centroid);
    if (prevNormal.x() + prevNormal.y() > 0) {
      offset.add(prevNormal.copy().multiply(EDGE_EXTEND_PX));
    }
    const nextNormal = outwardNormal(point, next, centroid);
    if (nextNormal.x() + nextNormal.y() > 0) {
      offset.add(nextNormal.copy().multiply(EDGE_EXTEND_PX));
    }

    return point.copy().add(offset);
  });
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
  for (const [i, projected] of extendBottomRightEdges(
    polygon.projected
  ).entries()) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...projected.toArray());
  }
  ctx.closePath();
  ctx.fill();
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
