import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { positionAtMeanAnomaly, type KeplerOrbitShape } from '../../src/bodies/kepler';
import { createOrbitLine } from '../../src/bodies/orbitLine';
import { ORBIT_STYLE } from '../../src/bodies/orbitMath';

const N = ORBIT_STYLE.segments;
const SHAPE: KeplerOrbitShape = {
  semiMajorAxisDisplay: 80,
  eccentricity: 0.2,
  inclinationRad: THREE.MathUtils.degToRad(35),
  ascendingNodeRad: THREE.MathUtils.degToRad(20),
  argumentOfPerihelionRad: THREE.MathUtils.degToRad(15),
};

function make() {
  return createOrbitLine(SHAPE, '#6fb6ff');
}

function mat(o: ReturnType<typeof make>): THREE.ShaderMaterial {
  return o.object.material as THREE.ShaderMaterial;
}

/** True when `src` contains `n` as a standalone numeric literal (optionally written with a trailing ".0"). */
function hasLiteral(src: string, n: number): boolean {
  const s = String(n).replace('.', '\\.');
  return new RegExp(`(?<![\\d.])${s}(\\.0+)?(?![\\d])`).test(src);
}

describe('createOrbitLine', () => {
  it('is a mesh named orbit-line that is never frustum culled', () => {
    const o = make();
    expect(o.object).toBeInstanceOf(THREE.Mesh);
    expect(o.object.name).toBe('orbit-line');
    expect(o.object.frustumCulled).toBe(false);
  });

  it('is a closed strip with phase and tangent attributes', () => {
    const geo = make().object.geometry;
    expect(geo.getAttribute('position').count).toBe(2 * (N + 1));
    expect(geo.getAttribute('aSide').count).toBe(2 * (N + 1));
    expect(geo.getAttribute('aPhase').count).toBe(2 * (N + 1));
    expect(geo.getAttribute('aTangent').count).toBe(2 * (N + 1));
    expect(geo.getIndex()?.count).toBe(6 * N);
    const idx = geo.getIndex()!;
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeLessThan(2 * (N + 1));
    }
  });

  it('samples the inclined Kepler ellipse and preserves phase at the closed seam', () => {
    const geo = make().object.geometry;
    const pos = geo.getAttribute('position');
    const side = geo.getAttribute('aSide');
    const phase = geo.getAttribute('aPhase');
    for (let i = 0; i < pos.count; i++) {
      const meanAnomaly = phase.getX(i);
      const expected = positionAtMeanAnomaly(SHAPE, meanAnomaly);
      expect([pos.getX(i), pos.getY(i), pos.getZ(i)]).toEqual(
        expected.map((coordinate) => expect.closeTo(coordinate, 3)),
      );
      expect(Math.abs(side.getX(i))).toBe(1);
    }
    // At M=π/2, the sampled point has the expected nonzero inclination and eccentricity.
    expect(phase.getX(2 * (N / 4))).toBeCloseTo(Math.PI / 2, 5);
    expect(pos.getX(2 * (N / 4))).toBeCloseTo(-65.88845879, 3);
    expect(pos.getY(2 * (N / 4))).toBeCloseTo(37.90420107, 3);
    expect(pos.getZ(2 * (N / 4))).toBeCloseTo(-33.62549453, 3);
    // Both sides of each station share the phase; the seam is duplicated as 0 and 2π.
    expect(phase.getX(0)).toBe(0);
    expect(phase.getX(1)).toBe(0);
    expect(side.getX(0)).toBe(-side.getX(1));
    expect(phase.getX(2 * N)).toBeCloseTo(Math.PI * 2, 5);
    expect(phase.getX(2 * N + 1)).toBeCloseTo(Math.PI * 2, 5);
    expect(phase.getX(2 * 64)).toBeCloseTo((64 / N) * Math.PI * 2, 5);
    const tangent = geo.getAttribute('aTangent');
    for (let i = 0; i < tangent.count; i++) {
      expect(Number.isFinite(tangent.getX(i))).toBe(true);
      expect(Number.isFinite(tangent.getY(i))).toBe(true);
      expect(Number.isFinite(tangent.getZ(i))).toBe(true);
    }
  });

  it('uses an additive, transparent ShaderMaterial that tests depth but does not write it', () => {
    const m = mat(make());
    expect(m).toBeInstanceOf(THREE.ShaderMaterial);
    expect(m.blending).toBe(THREE.AdditiveBlending);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.depthTest).toBe(true);
  });

  it('tints by the given colour', () => {
    const c = mat(make()).uniforms.uColor!.value as THREE.Color;
    expect(c.getHexString()).toBe(new THREE.Color('#6fb6ff').getHexString());
  });

  it('setViewport sets the viewport and pixel-ratio uniforms', () => {
    const o = make();
    o.setViewport(1000, 500, 2);
    const u = mat(o).uniforms;
    const vp = u.uViewport!.value as THREE.Vector2;
    expect(vp.x).toBe(1000);
    expect(vp.y).toBe(500);
    expect(u.uPixelRatio!.value).toBe(2);
  });

  it('setPlanetMeanAnomaly and setEmphasis set their uniforms, emphasis clamped to 0..1', () => {
    const o = make();
    const u = mat(o).uniforms;
    o.setPlanetMeanAnomaly(1.25);
    expect(u.uPlanetMeanAnomaly!.value).toBe(1.25);
    o.setEmphasis(0.3);
    expect(u.uEmphasis!.value).toBe(0.3);
    o.setEmphasis(4);
    expect(u.uEmphasis!.value).toBe(1);
    o.setEmphasis(-1);
    expect(u.uEmphasis!.value).toBe(0);
  });

  it('dispose() disposes geometry and material', () => {
    const o = make();
    const g = vi.spyOn(o.object.geometry, 'dispose');
    const m = vi.spyOn(mat(o), 'dispose');
    o.dispose();
    expect(g).toHaveBeenCalled();
    expect(m).toHaveBeenCalled();
  });

  it('builds the shaders from ORBIT_STYLE constants instead of retyping them', () => {
    const m = mat(make());
    const src = m.vertexShader + m.fragmentShader;
    const S = ORBIT_STYLE;
    for (const n of [
      S.baseIntensity,
      S.headIntensity,
      S.tailRad,
      S.haloShare,
      S.totalWidthPx / 2,
    ]) {
      expect(hasLiteral(src, n), String(n)).toBe(true);
    }
    expect(hasLiteral(src, S.coreWidthPx / S.totalWidthPx)).toBe(true);
  });

  it('guards against projected points behind or at the camera (w <= 0.001)', () => {
    const vs = mat(make()).vertexShader;
    expect(vs).toMatch(/\.w\s*<=\s*0\.001/);
    expect(mat(make()).fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(mat(make()).fragmentShader).toContain('#include <colorspace_fragment>');
  });
});
