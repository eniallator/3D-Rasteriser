import { Vector } from "vectyped";

import { createPolygon, type Polygon } from "../rasterise/types.ts";

export type FaceDir = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

const ALL_FACES: readonly FaceDir[] = ["+x", "-x", "+y", "-y", "+z", "-z"];

type Corner = readonly [0 | 1, 0 | 1, 0 | 1];

const FACE_CORNERS: Record<FaceDir, readonly [Corner, Corner, Corner, Corner]> =
  {
    "+x": [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    "-x": [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
    "+y": [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
    "-y": [
      [0, 0, 1],
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
    ],
    "+z": [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
    "-z": [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  };

const FACE_NORMALS: Record<FaceDir, readonly [number, number, number]> = {
  "+x": [1, 0, 0],
  "-x": [-1, 0, 0],
  "+y": [0, 1, 0],
  "-y": [0, -1, 0],
  "+z": [0, 0, 1],
  "-z": [0, 0, -1],
};

// Fixed "sunlight from above and slightly in front" direction used to fake
// per-face shading, since the rasteriser has no real lighting model.
const LIGHT_DIR = ((): readonly [number, number, number] => {
  const [x, y, z] = [-0.5, 1, 0.3];
  const mag = Math.hypot(x, y, z);
  return [x / mag, y / mag, z / mag];
})();

/** Brightness multiplier for a given face direction, in [0.55, 1]. */
export function faceShade(face: FaceDir): number {
  const [nx, ny, nz] = FACE_NORMALS[face];
  const [lx, ly, lz] = LIGHT_DIR;
  const dot = nx * lx + ny * ly + nz * lz;
  return 0.55 + 0.45 * Math.max(0, dot);
}

/** Scales a "#rrggbb" colour by a brightness factor. */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number): number =>
    Math.min(255, Math.max(0, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * factor);
  const g = clamp(((n >> 8) & 255) * factor);
  const b = clamp((n & 255) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Builds the polygons for an axis-aligned box between `min` and `max`,
 * shaded per-face from `baseColor` to fake simple directional lighting.
 * `faces` can be used to omit sides that will never be seen (e.g. a face
 * flush against a wall or resting on the floor).
 */
export function boxPolygons(
  min: Vector<3>,
  max: Vector<3>,
  baseColor: string,
  faces: readonly FaceDir[] = ALL_FACES
): Polygon[] {
  const corner = (c: Corner): Vector<3> =>
    Vector.create(
      c[0] === 1 ? max.x() : min.x(),
      c[1] === 1 ? max.y() : min.y(),
      c[2] === 1 ? max.z() : min.z()
    );

  return faces.map(face =>
    createPolygon({
      points: FACE_CORNERS[face].map(corner) as Polygon["points"],
      style: shade(baseColor, faceShade(face)),
    })
  );
}

/** A flat quad on a plane of constant x, e.g. a wall or window pane. */
export function verticalQuad(
  x: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  style: Polygon["style"]
): Polygon {
  return createPolygon({
    points: [
      Vector.create(x, y1, z0),
      Vector.create(x, y0, z0),
      Vector.create(x, y0, z1),
      Vector.create(x, y1, z1),
    ],
    style,
  });
}

/**
 * A top-to-bottom gradient fill, using the whole (unsplit) polygon's
 * projected bounds - not just a fragment's, so the gradient stays
 * continuous across however many pieces the BSP tree cuts it into.
 */
export function verticalGradientStyle(
  colorBottom: string,
  colorTop: string
): Polygon["style"] {
  return ({ original }, ctx) => {
    const ys = original.projected.map(point => point.y());
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const avgX =
      original.projected.reduce((sum, point) => sum + point.x(), 0) /
      original.projected.length;
    const gradient = ctx.createLinearGradient(avgX, maxY, avgX, minY);
    gradient.addColorStop(0, colorBottom);
    gradient.addColorStop(1, colorTop);
    return gradient;
  };
}
