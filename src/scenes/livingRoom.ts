import { Vector } from "vectyped";

import {
  createPoint,
  createPolygon,
  type Primitive2D,
} from "../rasterise/types.ts";
import {
  boxPolygons,
  faceShade,
  shade,
  verticalGradientStyle,
  verticalQuad,
} from "./shapes.ts";
import { animatedScene, type Scene } from "./types.ts";

// World layout: x runs from the open front of the room (0) back to the
// fireplace wall, y is up, z runs left/right across the room.
const ROOM_DEPTH = 9;
const ROOM_WIDTH = 8;
const ROOM_HEIGHT = 4.5;
const HALF_WIDTH = ROOM_WIDTH / 2;
const BACK_WALL_X = ROOM_DEPTH;

const FLOOR_COLOR = "#6b4226";
const WALL_COLOR = "#c9b896";
const CEILING_COLOR = "#e8ddc7";

function buildRoomShell(): Primitive2D[] {
  const floor = createPolygon({
    points: [
      Vector.create(0, 0, -HALF_WIDTH),
      Vector.create(BACK_WALL_X, 0, -HALF_WIDTH),
      Vector.create(BACK_WALL_X, 0, HALF_WIDTH),
      Vector.create(0, 0, HALF_WIDTH),
    ],
    style: shade(FLOOR_COLOR, faceShade("+y")),
  });

  const ceiling = createPolygon({
    points: [
      Vector.create(0, ROOM_HEIGHT, -HALF_WIDTH),
      Vector.create(0, ROOM_HEIGHT, HALF_WIDTH),
      Vector.create(BACK_WALL_X, ROOM_HEIGHT, HALF_WIDTH),
      Vector.create(BACK_WALL_X, ROOM_HEIGHT, -HALF_WIDTH),
    ],
    style: shade(CEILING_COLOR, faceShade("-y")),
  });

  const backWall = verticalQuad(
    BACK_WALL_X,
    0,
    ROOM_HEIGHT,
    -HALF_WIDTH,
    HALF_WIDTH,
    shade(WALL_COLOR, faceShade("-x"))
  );

  const leftWall = createPolygon({
    points: [
      Vector.create(0, ROOM_HEIGHT, -HALF_WIDTH),
      Vector.create(0, 0, -HALF_WIDTH),
      Vector.create(BACK_WALL_X, 0, -HALF_WIDTH),
      Vector.create(BACK_WALL_X, ROOM_HEIGHT, -HALF_WIDTH),
    ],
    style: shade(WALL_COLOR, faceShade("+z")),
  });

  const rightWall = createPolygon({
    points: [
      Vector.create(0, 0, HALF_WIDTH),
      Vector.create(0, ROOM_HEIGHT, HALF_WIDTH),
      Vector.create(BACK_WALL_X, ROOM_HEIGHT, HALF_WIDTH),
      Vector.create(BACK_WALL_X, 0, HALF_WIDTH),
    ],
    style: shade(WALL_COLOR, faceShade("-z")),
  });

  return [floor, ceiling, backWall, leftWall, rightWall];
}

const FIREPLACE_HALF_WIDTH = 1.9;
const FIREPLACE_FRONT_X = BACK_WALL_X - 1.3;
const FIREPLACE_TOP_Y = 3.0;
const MANTEL_HEIGHT = 0.18;
const MANTEL_FRONT_X = BACK_WALL_X - 1.5;
const MANTEL_HALF_WIDTH = 2.15;

const OPENING_HALF_WIDTH = 0.85;
const OPENING_TOP_Y = 1.75;
const OPENING_BOTTOM_Y = 0.03;
const OPENING_INTERIOR_X = FIREPLACE_FRONT_X - 0.04;

const STONE_COLOR = "#8a8378";

function buildFireplaceSurround(): Primitive2D[] {
  const front = verticalQuad(
    FIREPLACE_FRONT_X,
    0,
    FIREPLACE_TOP_Y,
    -FIREPLACE_HALF_WIDTH,
    FIREPLACE_HALF_WIDTH,
    shade(STONE_COLOR, faceShade("-x"))
  );

  const leftSide = createPolygon({
    points: [
      Vector.create(FIREPLACE_FRONT_X, FIREPLACE_TOP_Y, -FIREPLACE_HALF_WIDTH),
      Vector.create(FIREPLACE_FRONT_X, 0, -FIREPLACE_HALF_WIDTH),
      Vector.create(BACK_WALL_X, 0, -FIREPLACE_HALF_WIDTH),
      Vector.create(BACK_WALL_X, FIREPLACE_TOP_Y, -FIREPLACE_HALF_WIDTH),
    ],
    style: shade(STONE_COLOR, faceShade("+z")),
  });

  const rightSide = createPolygon({
    points: [
      Vector.create(FIREPLACE_FRONT_X, 0, FIREPLACE_HALF_WIDTH),
      Vector.create(FIREPLACE_FRONT_X, FIREPLACE_TOP_Y, FIREPLACE_HALF_WIDTH),
      Vector.create(BACK_WALL_X, FIREPLACE_TOP_Y, FIREPLACE_HALF_WIDTH),
      Vector.create(BACK_WALL_X, 0, FIREPLACE_HALF_WIDTH),
    ],
    style: shade(STONE_COLOR, faceShade("-z")),
  });

  const mantel = boxPolygons(
    Vector.create(MANTEL_FRONT_X, FIREPLACE_TOP_Y, -MANTEL_HALF_WIDTH),
    Vector.create(
      BACK_WALL_X,
      FIREPLACE_TOP_Y + MANTEL_HEIGHT,
      MANTEL_HALF_WIDTH
    ),
    STONE_COLOR,
    ["-x", "+y", "+z", "-z"]
  );

  const opening = verticalQuad(
    OPENING_INTERIOR_X,
    OPENING_BOTTOM_Y,
    OPENING_TOP_Y,
    -OPENING_HALF_WIDTH,
    OPENING_HALF_WIDTH,
    "#0c0806"
  );

  const log1 = boxPolygons(
    Vector.create(OPENING_INTERIOR_X - 0.06, 0.05, -0.5),
    Vector.create(OPENING_INTERIOR_X + 0.64, 0.26, 0.5),
    "#4a2f1d",
    ["-x", "+y", "+z", "-z"]
  );

  const log2 = boxPolygons(
    Vector.create(OPENING_INTERIOR_X - 0.02, 0.22, -0.32),
    Vector.create(OPENING_INTERIOR_X + 0.68, 0.42, 0.38),
    "#5a3823",
    ["-x", "+y", "+z", "-z"]
  );

  return [front, leftSide, rightSide, ...mantel, opening, ...log1, ...log2];
}

const FLAME_CENTER_Z = 0;
const FLAME_BASE_Y = OPENING_BOTTOM_Y + 0.05;
const FLAME_HEIGHT = 1.55;
const FLAME_HALF_WIDTH = 0.72;
const FLAME_FRONT_X = OPENING_INTERIOR_X - 0.1;

// (zFrac, yFrac) outline of a flickering flame silhouette, normalised to
// [-1, 1] horizontally and [0, ~1.15] vertically.
const FLAME_OUTLINE: readonly [number, number][] = [
  [-1.0, 0.0],
  [-0.55, 0.28],
  [-0.3, 0.62],
  [-0.08, 0.95],
  [0.05, 1.15],
  [0.25, 0.85],
  [0.4, 0.55],
  [0.7, 0.25],
  [1.0, 0.0],
];

function flameLayer(
  x: number,
  t: number,
  seed: number,
  scale: number,
  style: Parameters<typeof createPolygon>[0]["style"]
): Primitive2D {
  const points = FLAME_OUTLINE.map(([zFrac, yFrac], i) => {
    const flicker =
      Math.sin(t * 5 + seed + i * 1.3) * 0.06 +
      Math.sin(t * 11 + seed * 2 + i) * 0.03;
    const y =
      FLAME_BASE_Y + Math.max(0, yFrac + flicker) * FLAME_HEIGHT * scale;
    const z = FLAME_CENTER_Z + zFrac * FLAME_HALF_WIDTH * scale;
    return Vector.create(x, y, z);
  });
  return createPolygon({
    points: points as [Vector<3>, Vector<3>, Vector<3>],
    style,
  });
}

const EMBER_COUNT = 10;

function buildFire(t: number): Primitive2D[] {
  const outer = flameLayer(
    FLAME_FRONT_X,
    t,
    0,
    1.0,
    verticalGradientStyle("rgba(150, 25, 8, 0.95)", "rgba(255, 150, 40, 0.9)")
  );
  const mid = flameLayer(
    FLAME_FRONT_X - 0.04,
    t,
    12,
    0.72,
    verticalGradientStyle("rgba(220, 80, 10, 0.95)", "rgba(255, 210, 80, 0.9)")
  );
  const core = flameLayer(
    FLAME_FRONT_X - 0.08,
    t,
    27,
    0.42,
    verticalGradientStyle(
      "rgba(255, 160, 40, 0.95)",
      "rgba(255, 250, 200, 0.9)"
    )
  );

  // A Polygon, not a Point: a Point has no extent, so it can never be split
  // the way the flame, floor, walls etc. are - it just gets compared
  // piecemeal against whatever fragments of them happen to share its path
  // through the BSP tree. When two of those (e.g. the floor and the flame)
  // disagree about which side of them the point belongs on - which can
  // happen even though each is individually consistent, if their own
  // fragments are already interleaved with each other in the tree - there
  // is no single position for a zero-extent point that satisfies both. A
  // Polygon has no such problem: it gets split during normal BSP
  // construction alongside everything else, so its ordering is exactly as
  // correct as any other primitive's.
  const GLOW_HALF_SIZE = 1.0;
  const glow = verticalQuad(
    // Sits just behind the outer flame layer (FLAME_FRONT_X) so the flame
    // draws on top of it cleanly, and well clear of both the stone
    // surround's front face (FIREPLACE_FRONT_X) and log1's front face
    // (OPENING_INTERIOR_X - 0.06, which happens to equal FLAME_FRONT_X +
    // 0.04 exactly - an unintentional coplanar tie) to avoid near-tie depth
    // ordering.
    FLAME_FRONT_X + 0.02,
    FLAME_BASE_Y + 0.55 - GLOW_HALF_SIZE,
    FLAME_BASE_Y + 0.55 + GLOW_HALF_SIZE,
    FLAME_CENTER_Z - GLOW_HALF_SIZE,
    FLAME_CENTER_Z + GLOW_HALF_SIZE,
    ({ original }, ctx) => {
      // Use the whole (unsplit) quad's projection, not just a fragment's,
      // so the gradient stays continuous across a BSP split - same reason
      // verticalGradientStyle does this in shapes.ts.
      const xs = original.projected.map(p => p.x());
      const ys = original.projected.map(p => p.y());
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      const radius = (Math.max(...xs) - Math.min(...xs)) / 2;
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius
      );
      gradient.addColorStop(0, "rgba(255, 140, 40, 0.55)");
      gradient.addColorStop(1, "rgba(255, 140, 40, 0)");
      return gradient;
    }
  );

  const embers = Array.from({ length: EMBER_COUNT }, (_, i) => {
    const cycle = 1.6 + (i % 4) * 0.35;
    const phase = (i / EMBER_COUNT) * cycle;
    const localT = ((((t + phase) % cycle) + cycle) % cycle) / cycle;
    const hash = ((i * 9301 + 49297) % 233280) / 233280;
    const z =
      FLAME_CENTER_Z +
      (hash - 0.5) * OPENING_HALF_WIDTH * 1.4 +
      Math.sin(t * 2 + i) * 0.1;
    const y = FLAME_BASE_Y + 0.2 + localT * 1.5;
    const x = FLAME_FRONT_X - 0.05 - localT * 0.15;
    const alpha = Math.max(0, 1 - localT);

    return createPoint({
      point: Vector.create(x, y, z),
      radius: 1.5 + alpha * 1.5,
      style: `rgba(255, ${Math.round(120 + 80 * alpha)}, ${Math.round(40 + 30 * localT)}, ${alpha.toFixed(2)})`,
    });
  });

  return [outer, mid, core, glow, ...embers];
}

const WINDOW_Y0 = 1.3;
const WINDOW_Y1 = 3.6;
const WINDOW_HALF_WIDTH = 0.75;
const WINDOW_CENTERS = [-3.0, 3.0];
const PANE_X = BACK_WALL_X - 0.03;
const FRAME_X = BACK_WALL_X - 0.1;
const FRAME_THICKNESS = 0.08;
const FRAME_COLOR = "#3d2b1c";

function buildWindow(centerZ: number): Primitive2D[] {
  const z0 = centerZ - WINDOW_HALF_WIDTH;
  const z1 = centerZ + WINDOW_HALF_WIDTH;
  const midY = (WINDOW_Y0 + WINDOW_Y1) / 2;

  const pane = verticalQuad(
    PANE_X,
    WINDOW_Y0,
    WINDOW_Y1,
    z0,
    z1,
    verticalGradientStyle("#bcd6e8", "#5f92b8")
  );

  const frameBars = [
    verticalQuad(
      FRAME_X,
      WINDOW_Y1 - FRAME_THICKNESS,
      WINDOW_Y1,
      z0,
      z1,
      FRAME_COLOR
    ),
    verticalQuad(
      FRAME_X,
      WINDOW_Y0,
      WINDOW_Y0 + FRAME_THICKNESS,
      z0,
      z1,
      FRAME_COLOR
    ),
    verticalQuad(
      FRAME_X,
      WINDOW_Y0,
      WINDOW_Y1,
      z0,
      z0 + FRAME_THICKNESS,
      FRAME_COLOR
    ),
    verticalQuad(
      FRAME_X,
      WINDOW_Y0,
      WINDOW_Y1,
      z1 - FRAME_THICKNESS,
      z1,
      FRAME_COLOR
    ),
  ];

  const mullions = [
    verticalQuad(
      FRAME_X,
      WINDOW_Y0,
      WINDOW_Y1,
      centerZ - FRAME_THICKNESS / 2,
      centerZ + FRAME_THICKNESS / 2,
      FRAME_COLOR
    ),
    verticalQuad(
      FRAME_X,
      midY - FRAME_THICKNESS / 2,
      midY + FRAME_THICKNESS / 2,
      z0,
      z1,
      FRAME_COLOR
    ),
  ];

  return [pane, ...frameBars, ...mullions];
}

const RUG_COLOR = "#6b2b2b";
const RUG_BORDER_COLOR = "#a8763e";

function buildRug(): Primitive2D[] {
  const outer = createPolygon({
    points: [
      Vector.create(3.2, 0.01, -2.1),
      Vector.create(6.4, 0.01, -2.1),
      Vector.create(6.4, 0.01, 2.1),
      Vector.create(3.2, 0.01, 2.1),
    ],
    style: shade(RUG_COLOR, faceShade("+y")),
  });

  const inner = createPolygon({
    points: [
      Vector.create(3.45, 0.015, -1.85),
      Vector.create(6.15, 0.015, -1.85),
      Vector.create(6.15, 0.015, 1.85),
      Vector.create(3.45, 0.015, 1.85),
    ],
    style: shade(RUG_BORDER_COLOR, faceShade("+y")),
  });

  return [outer, inner];
}

const CHAIR_UPHOLSTERY = "#3f5d4e";
const CHAIR_WOOD = "#3b2a1d";
const CHAIR_CENTER_Z = -2.6;

function buildArmchair(): Primitive2D[] {
  const backrest = boxPolygons(
    Vector.create(3.6, 0.55, CHAIR_CENTER_Z - 0.4),
    Vector.create(3.78, 1.85, CHAIR_CENTER_Z + 0.4),
    CHAIR_UPHOLSTERY,
    ["-x", "+y", "+z", "-z"]
  );

  const seat = boxPolygons(
    Vector.create(3.78, 0.5, CHAIR_CENTER_Z - 0.36),
    Vector.create(4.5, 0.78, CHAIR_CENTER_Z + 0.36),
    CHAIR_UPHOLSTERY,
    ["+x", "+y", "+z", "-z"]
  );

  const base = boxPolygons(
    Vector.create(3.7, 0.05, CHAIR_CENTER_Z - 0.36),
    Vector.create(4.5, 0.5, CHAIR_CENTER_Z + 0.36),
    CHAIR_WOOD,
    ["+x", "+z", "-z"]
  );

  const leftArmrest = boxPolygons(
    Vector.create(3.75, 0.78, CHAIR_CENTER_Z - 0.4),
    Vector.create(4.35, 1.15, CHAIR_CENTER_Z - 0.28),
    CHAIR_UPHOLSTERY,
    ["+y", "+x", "-z"]
  );

  const rightArmrest = boxPolygons(
    Vector.create(3.75, 0.78, CHAIR_CENTER_Z + 0.28),
    Vector.create(4.35, 1.15, CHAIR_CENTER_Z + 0.4),
    CHAIR_UPHOLSTERY,
    ["+y", "+x", "+z"]
  );

  return [...backrest, ...seat, ...base, ...leftArmrest, ...rightArmrest];
}

const CAMERA_VIEW_POS = Vector.create(0.4, 1.55, 0);
const CAMERA_DIR = Vector.create(1, 0, 0);

export const livingRoom: Scene = animatedScene((config, time, _prev) => {
  const t = (time.now - time.start) * config.speed;

  const primitives: Primitive2D[] = [
    ...buildRoomShell(),
    ...buildFireplaceSurround(),
    ...buildFire(t),
    ...buildWindow(WINDOW_CENTERS[0] as number),
    ...buildWindow(WINDOW_CENTERS[1] as number),
    ...buildRug(),
    ...buildArmchair(),
  ];

  return {
    primitives,
    cameraOptions: {
      viewPos: Vector.create(
        CAMERA_VIEW_POS.x(),
        CAMERA_VIEW_POS.y() + Math.sin(t * 0.75) * 1,
        CAMERA_VIEW_POS.z() + Math.sin(t * 0.5) * 1.5
      ),
      dirNorm: CAMERA_DIR,
      fov: config.fov,
    },
  };
});
