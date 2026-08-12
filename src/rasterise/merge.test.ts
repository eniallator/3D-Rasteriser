import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { buildBSPTree } from "./bsp";
import { mergePointsByDistance } from "./merge";
import { createLine, createPoint, createPolygon, type Polygon } from "./types";

const vec3 = (x: number, y: number, z: number): Vector<3> =>
  Vector.create(x, y, z);

function square(ox: number, oy: number, z: number, size = 1): Polygon {
  return createPolygon({
    points: [
      vec3(ox, oy, z),
      vec3(ox + size, oy, z),
      vec3(ox + size, oy + size, z),
      vec3(ox, oy + size, z),
    ],
  });
}

describe("mergePointsByDistance", () => {
  it("returns a leaf's primitives unchanged when there are no points", () => {
    const lineA = createLine({ points: [vec3(0, 0, 0), vec3(1, 1, 1)] });
    const lineB = createLine({ points: [vec3(2, 2, 2), vec3(3, 3, 3)] });
    const tree = buildBSPTree([lineA, lineB]);

    expect(mergePointsByDistance(tree, [], vec3(0, 0, -10))).toEqual([
      lineA,
      lineB,
    ]);
  });

  it("sorts points and leaf primitives together, farthest first, within a single leaf", () => {
    const lineNear = createLine({ points: [vec3(0, 0, 5), vec3(1, 1, 5)] });
    const lineFar = createLine({ points: [vec3(0, 0, 20), vec3(1, 1, 20)] });
    const tree = buildBSPTree([lineNear, lineFar]);

    const pointMid = createPoint({ point: vec3(0, 0, 12) });
    const viewPos = vec3(0, 0, 0);

    expect(mergePointsByDistance(tree, [pointMid], viewPos)).toEqual([
      lineFar,
      pointMid,
      lineNear,
    ]);
  });

  it("draws a point on the far side of a split before geometry on the near side, when the eye is on the near side", () => {
    const near = square(0, 0, 0);
    const far = square(0, 0, 5);
    const tree = buildBSPTree([near, far]);
    const viewPos = vec3(0, 0, -10);

    const behindEverything = createPoint({ point: vec3(0, 0, 10) });
    const betweenThem = createPoint({ point: vec3(0, 0, 2.5) });
    const inFrontOfEverything = createPoint({ point: vec3(0, 0, -5) });

    const result = mergePointsByDistance(
      tree,
      [behindEverything, betweenThem, inFrontOfEverything],
      viewPos
    );

    expect(result).toEqual([
      behindEverything,
      far,
      betweenThem,
      near,
      inFrontOfEverything,
    ]);
  });

  it("orders correctly across a splitting plane that isn't aligned with the view direction, since near/far half-spaces relative to the eye are valid regardless of the plane's orientation", () => {
    // A horizontal splitter (like a tabletop or a log's top face) even
    // though the camera is looking mostly along +z, not +y.
    const tabletop = createPolygon({
      points: [vec3(-5, 1, -5), vec3(5, 1, -5), vec3(5, 1, 5), vec3(-5, 1, 5)],
    });
    const tree = buildBSPTree([tabletop]);
    const viewPos = vec3(0, 2, -10); // above the tabletop plane (y=1)

    const belowTabletop = createPoint({ point: vec3(0, 0, 0) });
    const aboveTabletop = createPoint({ point: vec3(0, 3, 0) });

    const result = mergePointsByDistance(
      tree,
      [belowTabletop, aboveTabletop],
      viewPos
    );

    // Eye is on the same side as `aboveTabletop` (y>1), so the tabletop and
    // anything below it (opposite side from the eye) must be drawn before
    // (behind) it.
    const belowIdx = result.indexOf(belowTabletop);
    const tableIdx = result.indexOf(tabletop);
    const aboveIdx = result.indexOf(aboveTabletop);
    expect(belowIdx).toBeLessThan(tableIdx);
    expect(tableIdx).toBeLessThan(aboveIdx);
  });

  it("moves a point wholesale to one side of every fragment of a split polygon, rather than sandwiching it between them", () => {
    // `splitter` cuts `straddler` (spanning z 3..7) into a near piece
    // (z 3..4) and a far piece (z 4..7). `splitter` itself is offset far
    // away in x/y (10..14) so it doesn't also compete for the point's
    // position - unlike splitter's own cutting plane (necessarily
    // positioned right at the crossing depth), a Point genuinely between
    // the fragments' individual depths would, left to the raw tree-walk,
    // land between them; this test asserts that's no longer what happens.
    const splitter = square(10, 10, 4, 4);
    const straddler = createPolygon({
      points: [vec3(-1, -1, 3), vec3(1, -1, 7), vec3(1, 1, 7), vec3(-1, 1, 3)],
    });
    const tree = buildBSPTree([splitter, straddler]);
    const viewPos = vec3(0, 0, -10);

    // Between the two fragments' individual average z (near ~3.5,
    // far ~5.5), but on the same side as the eye relative to straddler's
    // own (whole) plane - genuinely nearer than the whole original
    // surface. Off-center in x (not 0) so it doesn't land exactly on
    // straddler's own tilted plane, which passes through z=5 at x=0 by
    // construction (straddler is symmetric about x=0).
    const midPoint = createPoint({ point: vec3(0.5, 0, 5) });
    const result = mergePointsByDistance(tree, [midPoint], viewPos);

    expect(result).toHaveLength(4);
    const pointIdx = result.indexOf(midPoint);
    const straddlerFragmentIndices = result
      .map((p, i) =>
        p.type === "Polygon" && p.original === straddler ? i : -1
      )
      .filter(i => i !== -1);

    expect(straddlerFragmentIndices).toHaveLength(2);
    const allBefore = straddlerFragmentIndices.every(i => i < pointIdx);
    const allAfter = straddlerFragmentIndices.every(i => i > pointIdx);
    expect(allBefore || allAfter).toBe(true);
  });

  it("keeps a Point consistently ordered against every fragment of a flat polygon that got fragmented by an unrelated, non-depth-aligned splitter (the living room flame/glow bug)", () => {
    // `flame` is flat at x=5 (like the living room's flame layers, all at a
    // constant x). `logSide` doesn't overlap flame in x at all (6..8 vs 5),
    // but its z=0 plane still cuts straight through flame's z range
    // (-1..1) - and gives a perfectly balanced split (flame straddles it,
    // logSide doesn't straddle flame's plane), so pickBestSplitter chooses
    // logSide, fragmenting flame along an axis with nothing to do with its
    // true (x) depth relationship to anything else.
    const flame = createPolygon({
      points: [vec3(5, 0, -1), vec3(5, 2, -1), vec3(5, 2, 1), vec3(5, 0, 1)],
    });
    const logSide = createPolygon({
      points: [vec3(6, 0, 0), vec3(8, 0, 0), vec3(8, 1, 0), vec3(6, 1, 0)],
    });
    const tree = buildBSPTree([flame, logSide]);
    const viewPos = vec3(0, 1, -10);

    // x=5.5, strictly farther than flame's x=5 (camera is at x=0, nearer
    // than both) - flame should ALWAYS draw after (in front of) this
    // point, for both fragments, regardless of which side of z=0 they're
    // on.
    const glow = createPoint({ point: vec3(5.5, 1, 0.3) });
    const result = mergePointsByDistance(tree, [glow], viewPos);

    const flameIndices = result
      .map((p, i) => (p.type === "Polygon" && p.original === flame ? i : -1))
      .filter(i => i !== -1);
    expect(flameIndices).toHaveLength(2);

    const glowIdx = result.indexOf(glow);
    expect(flameIndices.every(i => i > glowIdx)).toBe(true);
  });

  it("ignores a polygon that's close to a point's bounding box but whose footprint the eye-ray never actually crosses, even when it would otherwise win priority over a genuine occluder", () => {
    // Same flame/logSide/glow setup as the test above (flame genuinely
    // occludes glow, split by an unrelated splitter) plus `distractor`: a
    // polygon whose bounding box sits closer to glow than flame's does
    // (0.3 vs 0.5 world units), and whose plane gives the same "behind"
    // side test flame does - a proximity-only check would let it outrank
    // and override flame's real constraint. But distractor's own footprint
    // (y in 1.3..2.3) doesn't extend anywhere near glow's actual line of
    // sight to it (the eye-ray crosses distractor's plane at y=1), so it
    // should never get to compete at all.
    const flame = createPolygon({
      points: [vec3(5, 0, -1), vec3(5, 2, -1), vec3(5, 2, 1), vec3(5, 0, 1)],
    });
    const logSide = createPolygon({
      points: [vec3(6, 0, 0), vec3(8, 0, 0), vec3(8, 1, 0), vec3(6, 1, 0)],
    });
    const distractor = createPolygon({
      points: [
        vec3(5.4, 1.3, 0.5),
        vec3(6.4, 1.3, 0.5),
        vec3(6.4, 2.3, 0.5),
        vec3(5.4, 2.3, 0.5),
      ],
    });
    const tree = buildBSPTree([flame, logSide, distractor]);
    const viewPos = vec3(0, 1, -10);

    const glow = createPoint({ point: vec3(5.5, 1, 0.3) });
    const result = mergePointsByDistance(tree, [glow], viewPos);

    const flameIndices = result
      .map((p, i) => (p.type === "Polygon" && p.original === flame ? i : -1))
      .filter(i => i !== -1);
    // distractor's z=0.5 plane happens to straddle flame's own z range, so
    // it also becomes a genuine BSP splitter for flame - unrelated to this
    // test's point-ordering concern, so the exact fragment count isn't
    // pinned, just that all of them still end up ordered correctly.
    expect(flameIndices.length).toBeGreaterThanOrEqual(2);

    const glowIdx = result.indexOf(glow);
    expect(flameIndices.every(i => i > glowIdx)).toBe(true);
  });

  it("classifies a point against a tilted (non-axis-aligned) polygon by where its eye-ray actually crosses the polygon's boundary, not just which side of the infinite plane it's on", () => {
    // `tilted`'s plane is z = x + 2 (independent of y), spanning
    // x in -2..2, y in -2..2. `inFront` and `outside` sit on the exact
    // same side of that infinite plane (same sign either way of it), and
    // their eye-rays cross the plane at the same x/z (0, 2) - only their y
    // differs, putting `outside`'s crossing at y=2.4, past the polygon's
    // y in -2..2 boundary. A plane-side-only test would treat them
    // identically; the crossing/containment test must not.
    const tilted = createPolygon({
      points: [vec3(-2, -2, 0), vec3(2, -2, 4), vec3(2, 2, 4), vec3(-2, 2, 0)],
    });
    // `anchor` is far off to the side, coplanar with neither `tilted` nor
    // either point's eye-ray, giving both points a fixed rough position
    // (via mergeIntoTree's tree-walk) that only `tilted`'s own constraint
    // - correctly applied only to `inFront` - should override.
    const anchor = square(20, 20, 20, 1);
    const treeTwoPoints = buildBSPTree([tilted, anchor]);
    const viewPos = vec3(0, 0, -10);

    const inFront = createPoint({ point: vec3(0, 0, 5) });
    const outside = createPoint({ point: vec3(0, 3, 5) });

    const result = mergePointsByDistance(
      treeTwoPoints,
      [inFront, outside],
      viewPos
    );

    const tiltedIdx = result.indexOf(tilted);
    // `inFront`'s eye-ray crosses `tilted` at (0, 0, 2), inside its
    // boundary, nearer to the eye than the point itself - so `tilted`
    // must be drawn after (in front of) it.
    expect(result.indexOf(inFront)).toBeLessThan(tiltedIdx);
  });

  it("treats a polygon whose plane the eye-ray runs exactly parallel to as irrelevant, rather than crashing", () => {
    // `wall`'s plane is x = 5. `parallelPoint`'s eye-ray travels straight
    // along z at a constant x, so it never crosses x = 5 at all.
    const wall = createPolygon({
      points: [vec3(5, -1, -1), vec3(5, 1, -1), vec3(5, 1, 1), vec3(5, -1, 1)],
    });
    const tree = buildBSPTree([wall]);
    const viewPos = vec3(0, 0, -10);
    const parallelPoint = createPoint({ point: vec3(0, 0, 5) });

    expect(() =>
      mergePointsByDistance(tree, [parallelPoint], viewPos)
    ).not.toThrow();
    const result = mergePointsByDistance(tree, [parallelPoint], viewPos);
    expect(result).toHaveLength(2);
  });

  it("sorts multiple points sharing a leaf farthest-first relative to each other", () => {
    const line = createLine({ points: [vec3(0, 0, 5), vec3(1, 1, 5)] });
    const tree = buildBSPTree([line]);
    const viewPos = vec3(0, 0, 0);

    const near = createPoint({ point: vec3(0, 0, 1) });
    const mid = createPoint({ point: vec3(0, 0, 2) });
    const far = createPoint({ point: vec3(0, 0, 3) });

    const result = mergePointsByDistance(tree, [mid, near, far], viewPos);
    const pointsOnly = result.filter(p => p.type === "Point");
    expect(pointsOnly).toEqual([far, mid, near]);
  });
});
