import { Vector } from "vectyped";

import { IMPRECISION_THRESHOLD, pointsToPlane } from "./helpers";
import { createPolygon, type Polygon, type Primitive2D } from "./types";

function intersectPolygons(
  a: Polygon,
  b: Polygon
): [number[], number[]] | null {
  const aPlane = pointsToPlane(a.points);
  const bPlane = pointsToPlane(b.points);
  let aMinMax = { min: Infinity, max: -Infinity };
  let bMinMax = { min: Infinity, max: -Infinity };

  const aSignedDistances = a.points.map(point => {
    const dist = bPlane.norm.dot(point) + bPlane.d;
    aMinMax = {
      min: Math.min(aMinMax.min, dist),
      max: Math.max(aMinMax.max, dist),
    };
    return dist;
  });
  const bSignedDistances = b.points.map(point => {
    const dist = aPlane.norm.dot(point) + aPlane.d;
    bMinMax = {
      min: Math.min(bMinMax.min, dist),
      max: Math.max(bMinMax.max, dist),
    };
    return dist;
  });
  // Require points genuinely on both sides of each plane (not just touching
  // it), otherwise polygons that merely share an edge (e.g. adjacent cube
  // faces) get misclassified as intersecting.
  return aMinMax.min < -IMPRECISION_THRESHOLD &&
    aMinMax.max > IMPRECISION_THRESHOLD &&
    bMinMax.min < -IMPRECISION_THRESHOLD &&
    bMinMax.max > IMPRECISION_THRESHOLD
    ? [aSignedDistances, bSignedDistances]
    : null;
}

function cutPolygonSignedDistances(
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
  for (let i = 0; i < primitives.length; i++) {
    for (let j = i + 1; j < primitives.length; j++) {
      const currPrimitive = primitives.at(i) as Primitive2D;
      const otherPrimitive = primitives.at(j) as Primitive2D;
      if (
        currPrimitive.type !== "Point" &&
        otherPrimitive.type !== "Point" &&
        // Find a solution to this in the future for overlapping lines
        !(currPrimitive.type === "Line" && otherPrimitive.type === "Line")
      ) {
        if (
          currPrimitive.type === "Polygon" &&
          otherPrimitive.type === "Polygon"
        ) {
          const results = intersectPolygons(currPrimitive, otherPrimitive);
          if (results != null) {
            const currCut = cutPolygonSignedDistances(
              currPrimitive,
              results[0]
            );
            const otherCut = cutPolygonSignedDistances(
              otherPrimitive,
              results[1]
            );
            primitives.splice(i, 1, ...currCut);
            // j shifts by however many extra/fewer polygons the first
            // splice inserted at i, since i < j
            primitives.splice(j + (currCut.length - 1), 1, ...otherCut);
          }
        }
        // curr OR other must be a line and the other a polygon
      }
    }
  }
  return primitives;
}

export function linePlaneIntersection(
  line: { norm: Vector<3>; intersect: Vector<3> },
  plane: { norm: Vector<3>; d: number }
): Vector<3> {
  return line.norm
    .copy()
    .multiply((plane.d - line.intersect.sum()) / plane.norm.dot(line.norm))
    .add(line.intersect);
}

export function planePlaneIntersection(
  a: { norm: Vector<3>; d: number },
  b: { norm: Vector<3>; d: number }
): { norm: Vector<3>; intersect: Vector<3> } {
  const yNumerator = a.norm.x() * b.d - b.norm.x() * a.d;
  const yDenominator = a.norm.x() * b.norm.y() - b.norm.x() * a.norm.y();
  const y = yNumerator / yDenominator;
  const x =
    (a.d * yDenominator - a.norm.y() * yNumerator) /
    (a.norm.x() * yDenominator);
  return {
    norm: a.norm.crossProduct(b.norm),
    intersect: Vector.create(x, y, 0),
  };
}
