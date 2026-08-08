import type { Vector } from "vectyped";

import { IMPRECISION_THRESHOLD, pointsToPlane } from "./helpers";
import { project, type ProjectOptions } from "./project";
import {
  createLine,
  createPolygon,
  type Line,
  type Polygon,
  type Primitive2D,
} from "./types";

function boundsOf<N extends number>(
  points: Vector<N>[]
): { min: Vector<N>; max: Vector<N> } {
  const first = points.at(0) as Vector<N>;
  return points.slice(1).reduce(
    (acc, point) => ({
      min: acc.min.min(point),
      max: acc.max.max(point),
    }),
    { min: first.copy(), max: first.copy() }
  );
}

function boundsOverlap<N extends number>(
  a: { min: Vector<N>; max: Vector<N> },
  b: { min: Vector<N>; max: Vector<N> }
): boolean {
  const aSize = a.max.copy().sub(a.min);
  return a.min.inBounds(
    b.max.copy().sub(b.min).add(aSize),
    b.min.copy().sub(aSize)
  );
}

function segment2DIntersection(
  a0: Vector<2>,
  a1: Vector<2>,
  b0: Vector<2>,
  b1: Vector<2>
): { t: number; s: number } | null {
  const d1x = a1.x() - a0.x();
  const d1y = a1.y() - a0.y();
  const d2x = b1.x() - b0.x();
  const d2y = b1.y() - b0.y();
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < IMPRECISION_THRESHOLD) return null;

  const dx = b0.x() - a0.x();
  const dy = b0.y() - a0.y();
  const t = (dx * d2y - dy * d2x) / denom;
  const s = (dx * d1y - dy * d1x) / denom;

  return t > IMPRECISION_THRESHOLD &&
    t < 1 - IMPRECISION_THRESHOLD &&
    s > IMPRECISION_THRESHOLD &&
    s < 1 - IMPRECISION_THRESHOLD
    ? { t, s }
    : null;
}

interface LineCrossing {
  aIndex: number;
  aT: number;
  bIndex: number;
  bT: number;
}

function findLineLineCrossing(
  a: Line,
  b: Line,
  projectOptions: ProjectOptions
): LineCrossing | null {
  const aProjected = a.points.map(point => project(point, projectOptions));
  const bProjected = b.points.map(point => project(point, projectOptions));
  if (!boundsOverlap(boundsOf(aProjected), boundsOf(bProjected))) {
    return null;
  }

  for (let aIndex = 0; aIndex < aProjected.length - 1; aIndex++) {
    for (let bIndex = 0; bIndex < bProjected.length - 1; bIndex++) {
      const crossing = segment2DIntersection(
        aProjected[aIndex] as Vector<2>,
        aProjected[aIndex + 1] as Vector<2>,
        bProjected[bIndex] as Vector<2>,
        bProjected[bIndex + 1] as Vector<2>
      );
      if (crossing != null) {
        return { aIndex, aT: crossing.t, bIndex, bT: crossing.s };
      }
    }
  }
  return null;
}

// Splits a line into two pieces at parameter t (0-1) along the segment
// starting at `index`.
function cutLineAt(line: Line, index: number, t: number): [Line, Line] {
  const point = line.points[index] as Vector<3>;
  const next = line.points[index + 1] as Vector<3>;
  const crossing = point.copy().lerp(t, next);
  return [
    createLine({
      ...line,
      points: [...line.points.slice(0, index + 1), crossing],
    }),
    createLine({
      ...line,
      points: [crossing, ...line.points.slice(index + 1)],
    }),
  ];
}

function isPointInPolygon(
  point: Vector<3>,
  polygon: Polygon,
  plane: { norm: Vector<3>; d: number }
): boolean {
  const origin = polygon.points[0];
  const u = polygon.points[1].copy().sub(origin).normalise();
  const v = plane.norm.crossProduct(u);
  const toUV = (p: Vector<3>): [number, number] => {
    const rel = p.copy().sub(origin);
    return [rel.dot(u), rel.dot(v)];
  };

  const [testX, testY] = toUV(point);
  const polyUV = polygon.points.map(toUV);

  let inside = false;
  for (let i = 0, j = polyUV.length - 1; i < polyUV.length; j = i++) {
    const [xi, yi] = polyUV[i] as [number, number];
    const [xj, yj] = polyUV[j] as [number, number];
    const crosses =
      yi > testY !== yj > testY &&
      testX < ((xj - xi) * (testY - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

interface LinePolygonCrossing {
  index: number;
  t: number;
}

function findLinePolygonCrossing(
  line: Line,
  polygon: Polygon,
  plane: { norm: Vector<3>; d: number }
): LinePolygonCrossing | null {
  if (!boundsOverlap(boundsOf(line.points), boundsOf(polygon.points))) {
    return null;
  }

  const dists = line.points.map(point => plane.norm.dot(point) + plane.d);

  for (let i = 0; i < line.points.length - 1; i++) {
    const d0 = dists[i] as number;
    const d1 = dists[i + 1] as number;
    if (d0 >= 0 === d1 >= 0) continue;

    const t = d0 / (d0 - d1);
    if (t <= IMPRECISION_THRESHOLD || t >= 1 - IMPRECISION_THRESHOLD) continue;

    const crossingPoint = (line.points[i] as Vector<3>)
      .copy()
      .lerp(t, line.points[i + 1] as Vector<3>);
    if (isPointInPolygon(crossingPoint, polygon, plane)) {
      return { index: i, t };
    }
  }
  return null;
}

export function cutPolygonSignedDistances(
  polygon: Polygon,
  signedDistances: number[]
): Polygon[] {
  const polygons: Polygon[] = [];
  let currentPoints = [polygon.points[0]];

  for (const [i, point] of polygon.points.entries()) {
    currentPoints.push(point);
    const nextI = (i + 1) % polygon.points.length;

    const sDist = signedDistances[i] as number;
    const nextSDist = signedDistances[nextI] as number;
    if (sDist >= 0 !== nextSDist >= 0) {
      const pointOnPlane = point.lerp(
        sDist / (sDist - nextSDist),
        polygon.points[nextI] as Vector<3>
      );
      currentPoints.push(pointOnPlane);
      polygons.push(
        createPolygon({ points: currentPoints as Polygon["points"] })
      );
      currentPoints = [pointOnPlane];
    }
  }
  polygons[0]?.points.push(...currentPoints);

  return polygons;
}

export function resolveIntersections(
  primitives: Primitive2D[],
  projectOptions: ProjectOptions
): Primitive2D[] {
  // A polygon's plane is checked against every line in the scene, so cache
  // it per polygon rather than recomputing it on each pair.
  const polygonPlanes = new Map<Polygon, { norm: Vector<3>; d: number }>();
  const planeFor = (polygon: Polygon): { norm: Vector<3>; d: number } => {
    let plane = polygonPlanes.get(polygon);
    if (plane == null) {
      plane = pointsToPlane(polygon.points);
      polygonPlanes.set(polygon, plane);
    }
    return plane;
  };

  for (let i = 0; i < primitives.length; i++) {
    for (let j = i + 1; j < primitives.length; j++) {
      const currPrimitive = primitives.at(i) as Primitive2D;
      const otherPrimitive = primitives.at(j) as Primitive2D;

      if (
        (currPrimitive.type === "Polygon" &&
          otherPrimitive.type === "Polygon") ||
        currPrimitive.type === "Point" ||
        otherPrimitive.type === "Point"
      ) {
        continue;
      }

      if (currPrimitive.type === "Line" && otherPrimitive.type === "Line") {
        const crossing = findLineLineCrossing(
          currPrimitive,
          otherPrimitive,
          projectOptions
        );
        if (crossing != null) {
          const currCut = cutLineAt(
            currPrimitive,
            crossing.aIndex,
            crossing.aT
          );
          const otherCut = cutLineAt(
            otherPrimitive,
            crossing.bIndex,
            crossing.bT
          );
          primitives.splice(i, 1, ...currCut);
          primitives.splice(j + (currCut.length - 1), 1, ...otherCut);
        }
      } else {
        const line = (
          currPrimitive.type === "Line" ? currPrimitive : otherPrimitive
        ) as Line;
        const polygon = (
          currPrimitive.type === "Polygon" ? currPrimitive : otherPrimitive
        ) as Polygon;
        const crossing = findLinePolygonCrossing(
          line,
          polygon,
          planeFor(polygon)
        );

        if (crossing != null) {
          const lineCut = cutLineAt(line, crossing.index, crossing.t);
          const currCut =
            currPrimitive.type === "Line" ? lineCut : [currPrimitive];
          const otherCut =
            otherPrimitive.type === "Line" ? lineCut : [otherPrimitive];
          primitives.splice(i, 1, ...currCut);
          primitives.splice(j + (currCut.length - 1), 1, ...otherCut);
        }
      }
    }
  }
  return primitives;
}
