import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { clipPrimitivesToCamera, isPrimitiveOnScreen } from "./clip";
import type { ProjectOptions } from "./project";
import {
  createLine,
  createPoint,
  createPolygon,
  type Polygon,
  type ProjectedLine,
  type ProjectedPoint,
  type ProjectedPolygon,
} from "./types";

const projectOptions: ProjectOptions = {
  viewPos: Vector.create(0, 0, 0),
  dirNorm: Vector.create(0, 0, 1),
  fov: 1,
  screenDim: Vector.create(800, 600),
};

describe("clipPrimitivesToCamera", () => {
  it("keeps a Point in front of the camera and drops one behind it", () => {
    const inFront = createPoint({ point: Vector.create(0, 0, 5) });
    const behind = createPoint({ point: Vector.create(0, 0, -5) });

    const result = clipPrimitivesToCamera([inFront, behind], projectOptions);

    expect(result).toEqual([inFront]);
  });

  it("keeps a Line entirely in front of the camera unchanged", () => {
    const line = createLine({
      points: [Vector.create(0, 0, 1), Vector.create(1, 0, 5)],
    });

    const result = clipPrimitivesToCamera([line], projectOptions);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "Line", points: line.points });
  });

  it("drops a Line entirely behind the camera", () => {
    const line = createLine({
      points: [Vector.create(0, 0, -1), Vector.create(1, 0, -5)],
    });

    const result = clipPrimitivesToCamera([line], projectOptions);

    expect(result).toEqual([]);
  });

  it("clips a Line straddling the near plane down to its front portion", () => {
    const line = createLine({
      points: [Vector.create(0, 0, -1), Vector.create(0, 0, 1)],
    });

    const result = clipPrimitivesToCamera([line], projectOptions);

    expect(result).toHaveLength(1);
    const clipped = result[0] as ReturnType<typeof createLine>;
    expect(clipped.points).toHaveLength(2);
    expect(clipped.points.every(p => p.z() >= -1e-9)).toBe(true);
    // Crossing point should be at z=0, the other endpoint kept as-is.
    expect(clipped.points.some(p => Math.abs(p.z()) < 1e-9)).toBe(true);
    expect(clipped.points.some(p => p.z() === 1)).toBe(true);
  });

  it("keeps a Polygon entirely in front of the camera unchanged", () => {
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 1),
        Vector.create(1, 0, 1),
        Vector.create(0, 1, 1),
      ],
    });

    const result = clipPrimitivesToCamera([polygon], projectOptions);
    expect(result).toEqual([polygon]);
  });

  it("drops a Polygon entirely behind the camera", () => {
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, -1),
        Vector.create(1, 0, -1),
        Vector.create(0, 1, -1),
      ],
    });

    const result = clipPrimitivesToCamera([polygon], projectOptions);
    expect(result).toEqual([]);
  });

  it("clips a Polygon straddling the near plane to only its front portion", () => {
    const polygon = createPolygon({
      points: [
        Vector.create(-1, -1, -1),
        Vector.create(1, -1, -1),
        Vector.create(1, 1, 1),
        Vector.create(-1, 1, 1),
      ],
    });

    const result = clipPrimitivesToCamera(
      [polygon],
      projectOptions
    ) as Polygon[];

    expect(result).toHaveLength(1);
    expect(result[0]?.points.every(p => p.z() >= -1e-9)).toBe(true);
  });
});

describe("isPrimitiveOnScreen", () => {
  it("returns true for a Point within screen bounds", () => {
    const projected: ProjectedPoint = {
      type: "Point",
      primitive: createPoint({ point: Vector.create(0, 0, 0) }),
      projected: Vector.create(400, 300),
    };
    expect(isPrimitiveOnScreen(projected, projectOptions.screenDim)).toBe(true);
  });

  it("returns false for a Point outside screen bounds", () => {
    const projected: ProjectedPoint = {
      type: "Point",
      primitive: createPoint({ point: Vector.create(0, 0, 0) }),
      projected: Vector.create(-50, 300),
    };
    expect(isPrimitiveOnScreen(projected, projectOptions.screenDim)).toBe(
      false
    );
  });

  it("returns true for a Line whose endpoints are off-screen but which crosses the screen", () => {
    const line = createLine({
      points: [Vector.create(0, 0, 1), Vector.create(1, 0, 1)],
    });
    const projected: ProjectedLine = {
      type: "Line",
      primitive: line,
      projected: [Vector.create(-10, 300), Vector.create(810, 300)],
    };
    expect(isPrimitiveOnScreen(projected, projectOptions.screenDim)).toBe(true);
  });

  it("returns false for a Line entirely off-screen and not crossing it", () => {
    const line = createLine({
      points: [Vector.create(0, 0, 1), Vector.create(1, 0, 1)],
    });
    const projected: ProjectedLine = {
      type: "Line",
      primitive: line,
      projected: [Vector.create(-100, -100), Vector.create(-50, -50)],
    };
    expect(isPrimitiveOnScreen(projected, projectOptions.screenDim)).toBe(
      false
    );
  });

  it("returns true for a Polygon whose vertices are off-screen but whose edge crosses the screen", () => {
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 1),
        Vector.create(1, 0, 1),
        Vector.create(0, 1, 1),
      ],
    });
    const projected: ProjectedPolygon = {
      type: "Polygon",
      primitive: polygon,
      projected: [
        Vector.create(-100, 300),
        Vector.create(900, 300),
        Vector.create(400, -500),
      ],
    };
    expect(isPrimitiveOnScreen(projected, projectOptions.screenDim)).toBe(true);
  });

  it("returns false for a Polygon entirely off-screen", () => {
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 1),
        Vector.create(1, 0, 1),
        Vector.create(0, 1, 1),
      ],
    });
    const projected: ProjectedPolygon = {
      type: "Polygon",
      primitive: polygon,
      projected: [
        Vector.create(-300, -300),
        Vector.create(-200, -300),
        Vector.create(-250, -200),
      ],
    };
    expect(isPrimitiveOnScreen(projected, projectOptions.screenDim)).toBe(
      false
    );
  });
});
