import Vector from "../../core/Vector";
import Monad from "../../core/monad";
import { checkExhausted } from "../../core/utils";
import project from "./project";
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

type ProjectPoint = (point: Vector<3>) => Vector<2>;

function renderLineString(
  ctx: CanvasRenderingContext2D,
  lineString: LineString,
  projectPoint: ProjectPoint
) {
  ctx.beginPath();
  for (let i = 0; i < lineString.items.length; i++) {
    const item = lineString.items[i];
    const projected = projectPoint(item.point);
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
  projectPoint: ProjectPoint
): void {
  const projectedPoints = line.points.map(projectPoint);
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
  projectPoint: ProjectPoint
): void {
  const projected = projectPoint(point.point);
  if (point.style != null) {
    ctx.fillStyle = point.style;
  }
  ctx.beginPath();
  ctx.arc(...projected.toArray(), point.radius ?? 1, 0, 2 * Math.PI);
  ctx.fill();
}

export default function render(
  ctx: CanvasRenderingContext2D,
  renderables: Renderable[],
  viewPos: Vector<3>,
  dirNorm: Vector<3>,
  fov: number,
  screenDim: Vector<2>,
  defaultFill?: CanvasFillStrokeStyles["fillStyle"],
  defaultStroke?: CanvasFillStrokeStyles["strokeStyle"]
): void {
  const sortedRenderables = renderables
    .map(renderable => [findMinDist(viewPos, renderable), renderable] as const)
    .sort(([a], [b]) => b - a);

  const aspectRatio = screenDim.x() / screenDim.y();

  const projectPoint: ProjectPoint = (point: Vector<3>) =>
    Monad.from(project(point, viewPos, dirNorm, fov, aspectRatio))
      .map(([point]) => point.add(0.5).multiply(screenDim))
      .value();

  for (const [_, renderable] of sortedRenderables) {
    ctx.fillStyle = defaultFill ?? "white";
    ctx.strokeStyle = defaultStroke ?? "white";

    switch (renderable.type) {
      case "LineString": {
        renderLineString(ctx, renderable, projectPoint);
        break;
      }
      case "Line": {
        renderLine(ctx, renderable, projectPoint);
        break;
      }
      case "Point": {
        renderPoint(ctx, renderable, projectPoint);
        break;
      }
      default:
        return checkExhausted(renderable);
    }
  }
}
