import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import {
  cameraBasis,
  project,
  projectPrimitive,
  type ProjectOptions,
} from "./project";
import { createLine, createPoint, createPolygon } from "./types";

const baseOptions: ProjectOptions = {
  viewPos: Vector.create(0, 0, 0),
  dirNorm: Vector.create(0, 0, 1),
  fov: 1,
  screenDim: Vector.create(800, 600),
};

describe("cameraBasis", () => {
  it("derives an orthonormal xAxis/yAxis from dirNorm, and scales screenCenterPos by 1/fov", () => {
    const basis = cameraBasis(baseOptions);

    expect(basis.xAxis.getMagnitude()).toBeCloseTo(1);
    expect(basis.yAxis.getMagnitude()).toBeCloseTo(1);
    expect(basis.xAxis.dot(baseOptions.dirNorm)).toBeCloseTo(0);
    expect(basis.yAxis.dot(baseOptions.dirNorm)).toBeCloseTo(0);
    expect(basis.xAxis.dot(basis.yAxis)).toBeCloseTo(0);

    expect(basis.screenCenterPos.getMagnitude()).toBeCloseTo(1);
    expect(
      basis.screenCenterPos.getNorm().dot(baseOptions.dirNorm)
    ).toBeCloseTo(1);
  });

  it("scales screenCenterPos inversely with fov", () => {
    const narrow = cameraBasis({ ...baseOptions, fov: 2 });
    const wide = cameraBasis({ ...baseOptions, fov: 0.5 });

    expect(narrow.screenCenterPos.getMagnitude()).toBeCloseTo(0.5);
    expect(wide.screenCenterPos.getMagnitude()).toBeCloseTo(2);
  });
});

describe("project", () => {
  it("maps a point straight ahead of the camera to the center of the screen", () => {
    const result = project(Vector.create(0, 0, 10), baseOptions);
    expect(result.x()).toBeCloseTo(400);
    expect(result.y()).toBeCloseTo(300);
  });

  it("projects laterally symmetric points to horizontally symmetric screen positions", () => {
    const left = project(Vector.create(-1, 0, 5), baseOptions);
    const right = project(Vector.create(1, 0, 5), baseOptions);

    expect(left.y()).toBeCloseTo(right.y());
    expect(left.x() - 400).toBeCloseTo(-(right.x() - 400));
  });

  it("projects vertically symmetric points to vertically symmetric screen positions", () => {
    const up = project(Vector.create(0, 1, 5), baseOptions);
    const down = project(Vector.create(0, -1, 5), baseOptions);

    expect(up.x()).toBeCloseTo(down.x());
    expect(up.y() - 300).toBeCloseTo(-(down.y() - 300));
  });

  it("foreshortens: a laterally offset point further from the camera projects closer to center", () => {
    const near = project(Vector.create(1, 0, 2), baseOptions);
    const far = project(Vector.create(1, 0, 20), baseOptions);

    expect(Math.abs(far.x() - 400)).toBeLessThan(Math.abs(near.x() - 400));
  });
});

describe("projectPrimitive", () => {
  it("projects a Point primitive", () => {
    const point = createPoint({ point: Vector.create(0, 0, 10) });
    const result = projectPrimitive(point, baseOptions);

    expect(result.type).toBe("Point");
    expect(result.primitive).toBe(point);
    expect(result.projected.x()).toBeCloseTo(400);
    expect(result.projected.y()).toBeCloseTo(300);
  });

  it("projects each point of a Line primitive", () => {
    const line = createLine({
      points: [Vector.create(0, 0, 10), Vector.create(1, 0, 5)],
    });
    const result = projectPrimitive(line, baseOptions);

    expect(result.type).toBe("Line");
    expect(result.projected).toHaveLength(2);
    expect(result.projected[0]?.x()).toBeCloseTo(400);
  });

  it("projects each point of a Polygon primitive", () => {
    const polygon = createPolygon({
      points: [
        Vector.create(0, 0, 10),
        Vector.create(1, 0, 10),
        Vector.create(0, 1, 10),
      ],
    });
    const result = projectPrimitive(polygon, baseOptions);

    expect(result.type).toBe("Polygon");
    expect(result.projected).toHaveLength(3);
  });
});
