import { checkExhausted, tuple } from "niall-utils/core";
import { Vector } from "vectyped";

import { boundsOf, boundsOverlap, resolveOptRunnable } from "./helpers";
import { projectPrimitive, type ProjectOptions } from "./project";
import type {
  AABB,
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

function addSubpath(ctx: CanvasRenderingContext2D, points: Vector<2>[]): void {
  for (const [i, projected] of points.entries()) {
    ctx[i === 0 ? "moveTo" : "lineTo"](...projected.toArray());
  }
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
  const normAxis = Vector.create(-dir.y(), dir.x());
  const midpoint = from.copy().add(to).divide(2);
  const pointsOutward = normAxis.dot(midpoint.copy().sub(centroid)) >= 0;
  return (pointsOutward ? normAxis : normAxis.copy().multiply(-1)).getNorm();
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

type FillSegment =
  | { kind: "polygon"; points: Vector<2>[] }
  | { kind: "arc"; center: Vector<2>; radius: number };

interface FillOp {
  op: "fill";
  style: CanvasFillStrokeStyles["fillStyle"] | undefined;
  segment: FillSegment;
  bounds: AABB<2>;
}

interface StrokeOp {
  op: "stroke";
  style: CanvasFillStrokeStyles["strokeStyle"] | undefined;
  width: number | undefined;
  points: Vector<2>[];
}

interface FillTextOp {
  op: "fillText";
  style: CanvasFillStrokeStyles["fillStyle"] | undefined;
  font: string | undefined;
  text: string;
  x: number;
  y: number;
  maxWidth: number | undefined;
}

export type DrawOp = FillOp | StrokeOp | FillTextOp;

function arcBounds(center: Vector<2>, radius: number): AABB<2> {
  const r = Vector.fill(2, radius);
  return { min: center.copy().sub(r), max: center.copy().add(r) };
}

function pointOps(
  point: ProjectedPoint,
  ctx: CanvasRenderingContext2D
): DrawOp[] {
  const radius = point.primitive.radius ?? 1;
  const ops: DrawOp[] = [
    {
      op: "fill",
      style: resolveOptRunnable(point.primitive.style, () => tuple(point, ctx)),
      segment: { kind: "arc", center: point.projected, radius },
      bounds: arcBounds(point.projected, radius),
    },
  ];

  const { label } = point.primitive;
  if (label != null) {
    const font = resolveOptRunnable(label.font, () => tuple(point, ctx));
    if (font != null) ctx.font = font;
    const textWidth = ctx.measureText(label.text).width;
    ops.push({
      op: "fillText",
      font,
      style: resolveOptRunnable(label.style, () => tuple(point, ctx)),
      text: label.text,
      x:
        point.projected.x() -
        (label.maxWidth != null
          ? Math.min(textWidth, label.maxWidth) / 2
          : textWidth / 2),
      y: point.projected.y(),
      maxWidth: label.maxWidth,
    });
  }

  return ops;
}

function lineOp(
  line: ProjectedLine,
  projectOptions: ProjectOptions,
  ctx: CanvasRenderingContext2D
): DrawOp {
  return {
    op: "stroke",
    style: resolveOptRunnable(line.primitive.style, () =>
      tuple(splitStyleArg(line, projectOptions), ctx)
    ),
    width: line.primitive.width,
    points: line.projected,
  };
}

function polygonOp(
  polygon: ProjectedPolygon,
  projectOptions: ProjectOptions,
  ctx: CanvasRenderingContext2D
): DrawOp {
  const points = extendBottomRightEdges(polygon.projected);
  return {
    op: "fill",
    style: resolveOptRunnable(polygon.primitive.style, () =>
      tuple(splitStyleArg(polygon, projectOptions), ctx)
    ),
    segment: { kind: "polygon", points },
    bounds: boundsOf(points),
  };
}

export function toDrawOps(
  primitive: ProjectedPrimitive,
  projectOptions: ProjectOptions,
  ctx: CanvasRenderingContext2D
): DrawOp[] {
  switch (primitive.type) {
    case "Point":
      return pointOps(primitive, ctx);
    case "Line":
      return [lineOp(primitive, projectOptions, ctx)];
    case "Polygon":
      return [polygonOp(primitive, projectOptions, ctx)];
    default:
      return checkExhausted(primitive);
  }
}

function addFillSegment(
  ctx: CanvasRenderingContext2D,
  segment: FillSegment
): void {
  switch (segment.kind) {
    case "polygon":
      addSubpath(ctx, segment.points);
      ctx.closePath();
      break;

    case "arc":
      ctx.moveTo(segment.center.x() + segment.radius, segment.center.y());
      ctx.arc(
        segment.center.x(),
        segment.center.y(),
        segment.radius,
        0,
        2 * Math.PI
      );
      break;

    default:
      return checkExhausted(segment);
  }
}

function flushFill(ctx: CanvasRenderingContext2D, batch: FillOp[]): void {
  ctx.beginPath();
  for (const { segment } of batch) addFillSegment(ctx, segment);
  const style = (batch[0] as FillOp).style;
  if (style != null) ctx.fillStyle = style;
  ctx.fill();
}

function flushStroke(ctx: CanvasRenderingContext2D, batch: StrokeOp[]): void {
  ctx.beginPath();
  for (const { points } of batch) addSubpath(ctx, points);
  const { width, style } = batch[0] as StrokeOp;
  if (width != null) ctx.lineWidth = width;
  if (style != null) ctx.strokeStyle = style;
  ctx.stroke();
}

function runFillText(ctx: CanvasRenderingContext2D, op: FillTextOp): void {
  if (op.font != null) ctx.font = op.font;
  if (op.style != null) ctx.fillStyle = op.style;
  ctx.fillText(op.text, op.x, op.y, op.maxWidth);
}

function mergeBounds(a: AABB<2>, b: AABB<2>): AABB<2> {
  return { min: a.min.copy().min(b.min), max: a.max.copy().max(b.max) };
}

export function executeDrawOps(
  ctx: CanvasRenderingContext2D,
  ops: readonly DrawOp[]
): void {
  let i = 0;
  while (i < ops.length) {
    const curr = ops[i++] as DrawOp;
    switch (curr.op) {
      case "fillText": {
        runFillText(ctx, curr);
        break;
      }

      case "stroke": {
        const batch: StrokeOp[] = [curr];
        for (; i < ops.length; i++) {
          const next = ops[i] as DrawOp;
          if (
            next.op !== "stroke" ||
            next.style !== curr.style ||
            next.width !== curr.width
          ) {
            break;
          }
          batch.push(next);
        }
        flushStroke(ctx, batch);
        break;
      }

      case "fill": {
        const batch: FillOp[] = [curr];
        let bounds = curr.bounds;
        for (; i < ops.length; i++) {
          const next = ops[i] as DrawOp;
          if (
            next.op !== "fill" ||
            next.style !== curr.style ||
            boundsOverlap(bounds, next.bounds)
          ) {
            break;
          }
          batch.push(next);
          bounds = mergeBounds(bounds, next.bounds);
        }
        flushFill(ctx, batch);
        break;
      }

      default:
        return checkExhausted(curr);
    }
  }
}

export function renderBatchedPrimitives(
  ctx: CanvasRenderingContext2D,
  projected: readonly ProjectedPrimitive[],
  projectOptions: ProjectOptions
): void {
  executeDrawOps(
    ctx,
    projected.flatMap(primitive => toDrawOps(primitive, projectOptions, ctx))
  );
}
