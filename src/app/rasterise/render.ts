import Vector from "../../core/Vector";
import { checkExhausted } from "../../core/utils";
import project, { ProjectOptions } from "./project";
import { Line, LineString, Point, Renderable } from "./types";

function findMinDist(fromPos: Vector<3>, renderable: Renderable): number {
  switch (renderable.type) {
    case "LineString":
      return Math.min(
        ...renderable.items.map(({ point }) =>
          fromPos.copy().sub(point).getSquaredMagnitude()
        )
      );

    case "Line":
      return Math.min(
        ...renderable.points.map(point =>
          fromPos.copy().sub(point).getSquaredMagnitude()
        )
      );

    case "Point":
      return fromPos.copy().sub(renderable.point).getSquaredMagnitude();

    default:
      return checkExhausted(renderable);
  }
}

function renderLineString(
  ctx: CanvasRenderingContext2D,
  lineString: LineString,
  projectOptions: ProjectOptions
) {
  ctx.beginPath();
  for (let i = 0; i < lineString.items.length; i++) {
    const item = lineString.items[i];
    const [projected] = project(item.point, projectOptions);
    if (!projected.some(isNaN)) {
      if (i > 0 && "style" in item && item.style != null) {
        ctx.stroke();
        ctx.strokeStyle = item.style;
      }
      if (i > 0 && "width" in item && item.width != null) {
        ctx.lineWidth = item.width;
      }
      if (i === 0) {
        ctx.moveTo(...projected.toArray());
      } else {
        ctx.lineTo(...projected.toArray());
      }
    }
  }
  ctx.stroke();
}

function renderLine(
  ctx: CanvasRenderingContext2D,
  line: Line,
  projectOptions: ProjectOptions
): void {
  const projectedPoints = line.points.map(
    point => project(point, projectOptions)[0]
  );
  if (projectedPoints.every(projected => !projected.some(isNaN))) {
    const [start, end] = projectedPoints;
    if (line.width != null) {
      ctx.lineWidth = line.width;
    }
    if (line.style != null) {
      ctx.strokeStyle = line.style;
    }
    ctx.beginPath();
    ctx.moveTo(...start.toArray());
    ctx.lineTo(...end.toArray());
    ctx.stroke();
  }
}

function renderPoint(
  ctx: CanvasRenderingContext2D,
  point: Point,
  projectOptions: ProjectOptions
): void {
  const [projected] = project(point.point, projectOptions);
  if (point.style != null) {
    ctx.fillStyle = point.style;
  }
  ctx.beginPath();
  ctx.arc(...projected.toArray(), point.radius ?? 1, 0, 2 * Math.PI);
  ctx.fill();
}

interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  defaultFill?: CanvasFillStrokeStyles["fillStyle"];
  defaultStroke?: CanvasFillStrokeStyles["strokeStyle"];
}

export default function render(
  renderables: Renderable[],
  projectOptions: ProjectOptions,
  { ctx, defaultFill, defaultStroke }: RenderOptions
): void {
  const { viewPos } = projectOptions;
  const sortedRenderables = renderables
    .map(renderable => [findMinDist(viewPos, renderable), renderable] as const)
    .sort(([a], [b]) => b - a);

  for (const [_, renderable] of sortedRenderables) {
    ctx.fillStyle = defaultFill ?? "white";
    ctx.strokeStyle = defaultStroke ?? "white";

    switch (renderable.type) {
      case "LineString": {
        renderLineString(ctx, renderable, projectOptions);
        break;
      }
      case "Line": {
        renderLine(ctx, renderable, projectOptions);
        break;
      }
      case "Point": {
        renderPoint(ctx, renderable, projectOptions);
        break;
      }
      default:
        return checkExhausted(renderable);
    }
  }
}
