import { checkExhausted } from "niall-utils";
import { Vector } from "vectyped";

import { IMPRECISION_THRESHOLD, planeSide, pointsToPlane } from "./helpers";
import { cutPolygonSignedDistances } from "./intersect";
import { createLine, type Line, type Polygon, type Primitive2D } from "./types";

type Plane = { norm: Vector<3>; d: number };

export type BSPNode =
  | { type: "leaf"; primitives: Primitive2D[] }
  | {
      type: "split";
      plane: Plane;
      coplanar: Primitive2D[];
      front: BSPNode;
      back: BSPNode;
    };

type Side = "front" | "back" | "coplanar" | "straddling";

interface Classification {
  side: Side;
  // signed distance of each point, in the same order - reused by the split
  // functions below so straddling primitives don't get re-measured.
  distances: number[];
}

function classifyPoints(points: Vector<3>[], plane: Plane): Classification {
  const distances = points.map(point => plane.norm.dot(point) + plane.d);
  const hasFront = distances.some(dist => dist > IMPRECISION_THRESHOLD);
  const hasBack = distances.some(dist => dist < -IMPRECISION_THRESHOLD);

  const side: Side =
    hasFront && hasBack
      ? "straddling"
      : hasFront
        ? "front"
        : hasBack
          ? "back"
          : "coplanar";
  return { side, distances };
}

interface PointDist {
  point: Vector<3>;
  dist: number;
}

function splitLineByPlane(
  line: Line,
  distances: number[]
): { front: Line[]; back: Line[] } {
  const points = line.points.map((point, i): PointDist => ({
    point,
    dist: distances[i] as number,
  }));
  const front: Line[] = [];
  const back: Line[] = [];
  if (points.length === 0) return { front, back };

  const first = points.at(0) as PointDist;
  let current: Vector<3>[] = [first.point];
  let currentIsFront = first.dist >= 0;

  const flush = (): void => {
    if (current.length > 1) {
      (currentIsFront ? front : back).push(
        createLine({ ...line, points: current })
      );
    }
  };

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points.at(i) as PointDist;
    const next = points.at(i + 1) as PointDist;
    const nextIsFront = next.dist >= 0;

    if (curr.dist >= 0 !== nextIsFront) {
      const crossing = curr.point
        .copy()
        .lerp(curr.dist / (curr.dist - next.dist), next.point);
      current.push(crossing);
      flush();
      current = [crossing];
      currentIsFront = nextIsFront;
    }
    current.push(next.point);
  }
  flush();

  return { front, back };
}

function splitPolygonByPlane(
  polygon: Polygon,
  distances: number[],
  plane: Plane
): { front: Polygon[]; back: Polygon[] } {
  const front: Polygon[] = [];
  const back: Polygon[] = [];
  for (const piece of cutPolygonSignedDistances(polygon, distances)) {
    const centroid = Vector.zero(3)
      .add(...piece.points)
      .divide(piece.points.length);
    (planeSide(centroid, plane) >= 0 ? front : back).push(piece);
  }
  return { front, back };
}

export function buildBSPTree(primitives: Primitive2D[]): BSPNode {
  const splitterIndex = primitives.findIndex(
    primitive => primitive.type === "Polygon"
  );
  if (splitterIndex === -1) {
    return { type: "leaf", primitives };
  }

  const splitter = primitives.at(splitterIndex) as Polygon;
  const plane = pointsToPlane(splitter.points);
  const coplanar: Primitive2D[] = [splitter];
  const front: Primitive2D[] = [];
  const back: Primitive2D[] = [];

  for (let i = 0; i < primitives.length; i++) {
    if (i === splitterIndex) continue;
    const primitive = primitives.at(i) as Primitive2D;

    switch (primitive.type) {
      case "Point": {
        const side = planeSide(primitive.point, plane);
        (side >= 0 ? front : back).push(primitive);
        break;
      }
      case "Line": {
        const { side, distances } = classifyPoints(primitive.points, plane);
        switch (side) {
          case "front":
            front.push(primitive);
            break;
          case "back":
            back.push(primitive);
            break;
          case "coplanar":
            coplanar.push(primitive);
            break;
          case "straddling": {
            const split = splitLineByPlane(primitive, distances);
            front.push(...split.front);
            back.push(...split.back);
            break;
          }
        }
        break;
      }
      case "Polygon": {
        const { side, distances } = classifyPoints(primitive.points, plane);
        switch (side) {
          case "front":
            front.push(primitive);
            break;
          case "back":
            back.push(primitive);
            break;
          case "coplanar":
            coplanar.push(primitive);
            break;
          case "straddling": {
            const split = splitPolygonByPlane(primitive, distances, plane);
            front.push(...split.front);
            back.push(...split.back);
            break;
          }
        }
        break;
      }
      default:
        checkExhausted(primitive);
    }
  }

  return {
    type: "split",
    plane,
    coplanar,
    front: buildBSPTree(front),
    back: buildBSPTree(back),
  };
}

export function traverseBackToFront(
  node: BSPNode,
  viewPos: Vector<3>
): Primitive2D[] {
  if (node.type === "leaf") return node.primitives;

  const eyeSide = planeSide(viewPos, node.plane);
  return eyeSide < 0
    ? [
        ...traverseBackToFront(node.front, viewPos),
        ...node.coplanar,
        ...traverseBackToFront(node.back, viewPos),
      ]
    : [
        ...traverseBackToFront(node.back, viewPos),
        ...node.coplanar,
        ...traverseBackToFront(node.front, viewPos),
      ];
}
