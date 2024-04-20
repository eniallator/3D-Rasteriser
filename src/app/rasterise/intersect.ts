import Vector from "../../core/Vector";
import { pointsToPlane } from "./helpers";
import { Polygon, Primitive2D, createPolygon } from "./types";

const INTERSECT_THRESHOLD = 1e-10;

function intersectPolygons(
  a: Polygon,
  b: Polygon
): [number[], number[]] | null {
  const aPlane = pointsToPlane(a.points);
  const bPlane = pointsToPlane(b.points);
  let aMinMax = { min: Infinity, max: -Infinity };
  let bMinMax = { min: Infinity, max: -Infinity };

  const aSignedDistances = a.points.map(point => {
    const dist = bPlane[0].dot(point) - bPlane[1];
    aMinMax = {
      min: Math.min(aMinMax.min, dist),
      max: Math.max(aMinMax.max, dist),
    };
    return dist;
  });
  const bSignedDistances = b.points.map(point => {
    const dist = aPlane[0].dot(point) - aPlane[1];
    bMinMax = {
      min: Math.min(bMinMax.min, dist),
      max: Math.max(bMinMax.max, dist),
    };
    return dist;
  });
  return aMinMax.min < INTERSECT_THRESHOLD &&
    aMinMax.max > INTERSECT_THRESHOLD &&
    bMinMax.min < INTERSECT_THRESHOLD &&
    bMinMax.max > INTERSECT_THRESHOLD
    ? [aSignedDistances, bSignedDistances]
    : null;
}

function cutPolygonSignedDistances(
  polygon: Polygon,
  signedDistances: number[]
): Polygon[] {
  const polygons: Polygon[] = [];
  let currentPoints = [polygon.points[0]];

  for (let i = 0; i < polygon.points.length; i++) {
    currentPoints.push(polygon.points[i]);
    if (signedDistances[i] >= 0 !== signedDistances[i + 1] >= 0) {
      const nextI = (i + 1) % polygon.points.length;
      const pointOnPlane = polygon.points[i].lerp(
        polygon.points[nextI],
        signedDistances[i] / (signedDistances[i] - signedDistances[nextI])
      );
      currentPoints.push(pointOnPlane);
      polygons.push(
        createPolygon({
          points: currentPoints as Polygon["points"],
        })
      );
      currentPoints = [pointOnPlane];
    }
  }
  polygons[0].points.push(...currentPoints);

  return polygons;
}

export function resolveIntersections(primitives: Primitive2D[]) {
  for (let i = 0; i < primitives.length; i++) {
    for (let j = i + 1; j < primitives.length; j++) {
      const currPrimitive = primitives[i];
      const otherPrimitive = primitives[j];
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
            primitives.splice(
              i,
              1,
              ...cutPolygonSignedDistances(currPrimitive, results[0])
            );
            primitives.splice(
              j,
              1,
              ...cutPolygonSignedDistances(otherPrimitive, results[0])
            );
          }
        }
        // curr OR other must be a line and the other a polygon
      }
    }
  }
  return primitives;
}

export function linePlaneIntersection(
  line: { coefficients: Vector<3>; intersect: Vector<3> },
  plane: [Vector<3>, number]
): Vector<3> {
  return line.coefficients
    .copy()
    .multiply(
      (plane[1] - line.intersect.sum()) / plane[0].dot(line.coefficients)
    )
    .add(line.intersect);
}
