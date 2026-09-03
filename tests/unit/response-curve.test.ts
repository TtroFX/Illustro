import { describe, expect, it } from 'vitest';
import {
  LINEAR_RESPONSE_CURVE_V1,
  compileResponseCurveV1,
  normalizeResponseCurveV1,
  responseCurvePresetV1,
} from '../../src/domain/response-curve.js';

describe('shared response curve', () => {
  it('keeps the canonical linear curve as exact identity', () => {
    const compiled = compileResponseCurveV1(LINEAR_RESPONSE_CURVE_V1);
    for (const value of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      expect(compiled.sample(value)).toBeCloseTo(value, 10);
    }
  });

  it('offers monotonic soft, hard and S presets with exact endpoints', () => {
    const soft = compileResponseCurveV1(responseCurvePresetV1('soft'));
    const hard = compileResponseCurveV1(responseCurvePresetV1('hard'));
    const sCurve = compileResponseCurveV1(responseCurvePresetV1('s-curve'));
    expect(soft.sample(0.35)).toBeCloseTo(0.6, 10);
    expect(hard.sample(0.65)).toBeCloseTo(0.35, 10);
    expect(sCurve.sample(0)).toBe(0);
    expect(sCurve.sample(1)).toBe(1);
    let previous = 0;
    for (let step = 1; step <= 100; step += 1) {
      const value = sCurve.sample(step / 100);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-10);
      previous = value;
    }
  });

  it('rejects curves that break fixed endpoints, input order or monotonic output', () => {
    expect(() =>
      normalizeResponseCurveV1([
        { input: 0, output: 0.1 },
        { input: 1, output: 1 },
      ]),
    ).toThrow();
    expect(() =>
      normalizeResponseCurveV1([
        { input: 0, output: 0 },
        { input: 0, output: 0.5 },
        { input: 1, output: 1 },
      ]),
    ).toThrow();
    expect(() =>
      normalizeResponseCurveV1([
        { input: 0, output: 0 },
        { input: 0.5, output: 0.8 },
        { input: 1, output: 0.7 },
      ]),
    ).toThrow();
  });
});
