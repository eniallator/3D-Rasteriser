import { Vector } from "vectyped";

import {
  createLine,
  createPoint,
  type Primitive2D,
} from "../rasterise/types.ts";
import { boxPolygons } from "./shapes.ts";
import { animatedScene, type Scene } from "./types.ts";

// A dense, constantly-churning scene meant to exercise the pipeline hard:
// hundreds of pulsing polygons whose shape genuinely changes every frame
// (heavy BSP rebuild/splitting), a swarm of glowing Points (the primitive
// type that must never sway which polygon gets picked as a splitter), a
// wireframe of Lines, and a camera that both orbits *and* dives through the
// geometry (near-plane clipping) while continuously changing look direction
// (frustum planes recomputed from a rotating basis every frame).

const GRID_SIZE = 4;
const GRID_SPACING = 1.4;
const GRID_HALF_EXTENT = ((GRID_SIZE - 1) / 2) * GRID_SPACING;
const CUBE_BASE_HALF = 0.35;
const CUBE_PULSE_AMPLITUDE = 0.12;

const PARTICLE_COUNT = 30;

const ORBIT_BASE_RADIUS = 6;
const ORBIT_RADIUS_AMPLITUDE = 3.5;
const ORBIT_HEIGHT_AMPLITUDE = 3;

/** A smooth RGB rainbow cycle, as a "#rrggbb" string, parameterised by phase. */
function rainbowHex(phase: number): string {
  const channel = (offset: number): string =>
    Math.round(127 + 127 * Math.sin(phase + offset))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel((2 * Math.PI) / 3)}${channel((4 * Math.PI) / 3)}`;
}

function buildWireframe(bound: number): Primitive2D[] {
  const c = (x: number, y: number, z: number): Vector<3> =>
    Vector.create(x, y, z);
  const style = "rgba(150, 200, 255, 0.5)";
  const edges: [Vector<3>, Vector<3>][] = [];

  for (const y of [-bound, bound]) {
    for (const z of [-bound, bound]) {
      edges.push([c(-bound, y, z), c(bound, y, z)]);
    }
  }
  for (const x of [-bound, bound]) {
    for (const z of [-bound, bound]) {
      edges.push([c(x, -bound, z), c(x, bound, z)]);
    }
  }
  for (const x of [-bound, bound]) {
    for (const y of [-bound, bound]) {
      edges.push([c(x, y, -bound), c(x, y, bound)]);
    }
  }

  return edges.map(([a, b]) => createLine({ points: [a, b], style, width: 1 }));
}

function buildGrid(t: number): Primitive2D[] {
  const primitives: Primitive2D[] = [];
  const offset = (GRID_SIZE - 1) / 2;

  for (let ix = 0; ix < GRID_SIZE; ix++) {
    for (let iy = 0; iy < GRID_SIZE; iy++) {
      for (let iz = 0; iz < GRID_SIZE; iz++) {
        const cx = (ix - offset) * GRID_SPACING;
        const cy = (iy - offset) * GRID_SPACING;
        const cz = (iz - offset) * GRID_SPACING;
        const phase = (ix + iy + iz) * 0.6;
        const half =
          CUBE_BASE_HALF + CUBE_PULSE_AMPLITUDE * Math.sin(t * 1.3 + phase);
        const color = rainbowHex((ix + iy + iz) * 0.4 + t * 0.6);

        primitives.push(
          ...boxPolygons(
            Vector.create(cx - half, cy - half, cz - half),
            Vector.create(cx + half, cy + half, cz + half),
            color
          )
        );
      }
    }
  }

  return primitives;
}

function buildParticles(t: number): Primitive2D[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const seed = i * 12.9898;
    const freqX = 0.3 + (i % 5) * 0.07;
    const freqY = 0.25 + (i % 7) * 0.05;
    const freqZ = 0.35 + (i % 3) * 0.06;
    const orbitRadius = 2 + (i % 4) * 1.2;

    const point = Vector.create(
      orbitRadius * Math.sin(t * freqX + seed),
      orbitRadius * 0.6 * Math.cos(t * freqY + seed * 1.3),
      orbitRadius * Math.sin(t * freqZ + seed * 0.7)
    );
    const glow = rainbowHex(i * 0.3 + t * 0.4);

    return createPoint({
      point,
      radius: 3,
      style: (projected, ctx) => {
        const gradient = ctx.createRadialGradient(
          ...projected.projected.toArray(),
          0,
          ...projected.projected.toArray(),
          8
        );
        gradient.addColorStop(0, `${glow}ff`);
        gradient.addColorStop(1, `${glow}00`);
        return gradient;
      },
    });
  });
}

export const stressTest: Scene = animatedScene((config, time, _prev) => {
  const t = (time.now - time.start) * config.speed;

  const primitives: Primitive2D[] = [
    ...buildWireframe(GRID_HALF_EXTENT + 0.7),
    ...buildGrid(t),
    ...buildParticles(t),
  ];

  const theta = t * 0.4;
  const orbitRadius =
    ORBIT_BASE_RADIUS + ORBIT_RADIUS_AMPLITUDE * Math.sin(t * 0.17);
  const viewPos = Vector.create(
    orbitRadius * Math.cos(theta),
    ORBIT_HEIGHT_AMPLITUDE * Math.sin(t * 0.23),
    orbitRadius * Math.sin(theta)
  );
  // Always looking back toward the grid's centre, so the camera both orbits
  // and continuously changes look direction rather than sliding sideways.
  const dirNorm = Vector.zero(3).sub(viewPos).getNorm();

  return {
    primitives,
    cameraOptions: { viewPos, dirNorm, fov: config.fov },
  };
});
