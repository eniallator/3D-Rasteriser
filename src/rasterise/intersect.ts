import { Vector } from "vectyped";

import { buildBVH, primitiveBounds, queryOverlapping } from "./bvh";
import {
  boundsOf,
  boundsOverlap,
  IMPRECISION_THRESHOLD,
  pointsToPlane,
} from "./helpers";
import {
  createLine,
  createPolygon,
  type Line,
  type Plane,
  type Polygon,
  type Primitive2D,
} from "./types";

function segment2DIntersection(
  a0: Vector<2>,
  a1: Vector<2>,
  b0: Vector<2>,
  b1: Vector<2>
): { t: number; s: number } | null {
  const d1 = a1.copy().sub(a0);
  const d2 = b1.copy().sub(b0);
  const denom = d1.x() * d2.y() - d1.y() * d2.x();
  if (Math.abs(denom) < IMPRECISION_THRESHOLD) return null;

  const d = b0.copy().sub(a0);
  const t = (d.x() * d2.y() - d.y() * d2.x()) / denom;
  const s = (d.x() * d1.y() - d.y() * d1.x()) / denom;

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

function findLineLineCrossing(a: Line, b: Line): LineCrossing | null {
  if (!boundsOverlap(boundsOf(a.points), boundsOf(b.points))) {
    return null;
  }

  for (let aIndex = 0; aIndex < a.points.length - 1; aIndex++) {
    const a0 = a.points[aIndex] as Vector<3>;
    const a1 = a.points[aIndex + 1] as Vector<3>;
    const aDir = a1.copy().sub(a0);
    if (aDir.getSquaredMagnitude() < IMPRECISION_THRESHOLD) continue;
    const u = aDir.normalise();

    for (let bIndex = 0; bIndex < b.points.length - 1; bIndex++) {
      const b0 = b.points[bIndex] as Vector<3>;
      const b1 = b.points[bIndex + 1] as Vector<3>;

      const normal = u.copy().crossProduct(b0.copy().sub(a0));
      if (normal.getSquaredMagnitude() < IMPRECISION_THRESHOLD) continue;
      normal.normalise();

      if (Math.abs(normal.dot(b1.copy().sub(a0))) > IMPRECISION_THRESHOLD) {
        continue;
      }

      const v = normal.crossProduct(u);
      const toUV = (p: Vector<3>): Vector<2> => {
        const rel = p.copy().sub(a0);
        return Vector.create(rel.dot(u), rel.dot(v));
      };

      const crossing = segment2DIntersection(
        toUV(a0),
        toUV(a1),
        toUV(b0),
        toUV(b1)
      );
      if (crossing != null) {
        return { aIndex, aT: crossing.t, bIndex, bT: crossing.s };
      }
    }
  }
  return null;
}

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
  plane: Plane
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
  plane: Plane
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

export function resolveIntersections(primitives: Primitive2D[]): Primitive2D[] {
  const polygonPlanes = new Map<Polygon, Plane>();
  const planeFor = (polygon: Polygon): Plane => {
    let plane = polygonPlanes.get(polygon);
    if (plane == null) {
      plane = pointsToPlane(polygon.points);
      polygonPlanes.set(polygon, plane);
    }
    return plane;
  };

  const points = primitives.filter(p => p.type === "Point");
  const initial = primitives.filter(p => p.type !== "Point");
  const bvh = buildBVH(initial);

  const removed = new Set<Line | Polygon>();
  const replacedBy = new Map<Line | Polygon, (Line | Polygon)[]>();
  const resolveCurrent = (primitive: Line | Polygon): (Line | Polygon)[] => {
    const replacement = replacedBy.get(primitive);
    return replacement == null
      ? [primitive]
      : replacement.flatMap(resolveCurrent);
  };

  const working: (Line | Polygon)[] = [...initial];

  for (let i = 0; i < working.length; i++) {
    const currPrimitive = working.at(i) as Line | Polygon;
    if (removed.has(currPrimitive)) continue;

    const candidates = queryOverlapping(bvh, primitiveBounds(currPrimitive));

    for (const rawCandidate of candidates) {
      if (removed.has(currPrimitive)) break;
      if (rawCandidate.type === "Point") continue;

      for (const otherPrimitive of resolveCurrent(rawCandidate)) {
        if (removed.has(currPrimitive)) break;
        if (otherPrimitive === currPrimitive) continue;

        if (
          currPrimitive.type === "Polygon" &&
          otherPrimitive.type === "Polygon"
        ) {
          continue;
        }

        if (currPrimitive.type === "Line" && otherPrimitive.type === "Line") {
          const crossing = findLineLineCrossing(currPrimitive, otherPrimitive);
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
            removed.add(currPrimitive);
            removed.add(otherPrimitive);
            replacedBy.set(currPrimitive, currCut);
            replacedBy.set(otherPrimitive, otherCut);
            working.push(...currCut, ...otherCut);
          }
        } else {
          const currIsLine = currPrimitive.type === "Line";
          const line = (currIsLine ? currPrimitive : otherPrimitive) as Line;
          const polygon = (
            currIsLine ? otherPrimitive : currPrimitive
          ) as Polygon;
          const crossing = findLinePolygonCrossing(
            line,
            polygon,
            planeFor(polygon)
          );

          if (crossing != null) {
            const lineCut = cutLineAt(line, crossing.index, crossing.t);
            removed.add(line);
            replacedBy.set(line, lineCut);
            working.push(...lineCut);
          }
        }
      }
    }
  }

  const final = working.filter(primitive => !removed.has(primitive));
  return [...points, ...final];
}
