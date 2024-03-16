import Vector from "../../core/Vector";
import Monad from "../../core/monad";
import { checkExhausted } from "../../core/utils";
import project from "./project";
import { Renderable } from "./types";

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

  const projectOnScreen = (point: Vector<3>) =>
    Monad.from(project(point, viewPos, dirNorm, fov, aspectRatio))
      .map(([point]) => point.add(0.5).multiply(screenDim))
      .value();

  for (const [_, renderable] of sortedRenderables) {
    ctx.fillStyle = defaultFill ?? "white";
    ctx.strokeStyle = defaultStroke ?? "white";

    switch (renderable.type) {
      case "LineString": {
        ctx.beginPath();
        for (let i = 0; i < renderable.items.length; i++) {
          const item = renderable.items[i];
          const projected = projectOnScreen(item.point);
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
        break;
      }

      case "Line": {
        const projectedPoints = renderable.points.map(projectOnScreen);
        if (projectedPoints.every(projected => !projected.some(isNaN))) {
          const [start, end] = projectedPoints;
          if (renderable.width != null) {
            ctx.lineWidth = renderable.width;
          }
          if (renderable.style != null) {
            ctx.strokeStyle = renderable.style;
          }
          ctx.beginPath();
          ctx.moveTo(...start.toArray());
          ctx.lineTo(...end.toArray());
          ctx.stroke();
        }
        break;
      }

      case "Point": {
        const projected = projectOnScreen(renderable.point);
        if (renderable.style != null) {
          ctx.fillStyle = renderable.style;
        }
        ctx.beginPath();
        ctx.arc(...projected.toArray(), renderable.radius ?? 1, 0, 2 * Math.PI);
        ctx.fill();
        break;
      }

      default:
        return checkExhausted(renderable);
    }
  }
}
