import type { BrushTextureBlendModeV1 } from '../domain/brush-schema.js';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function requireUnit(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be within 0..1`);
  }
  return value;
}

/**
 * Combines a scalar sampled texture with already-established brush coverage.
 * This function is deliberately color-space neutral: it never reads or writes RGB.
 */
export function combineBrushTextureCoverageV1(
  brushCoverage: number,
  textureCoverage: number,
  strength: number,
  blendMode: BrushTextureBlendModeV1,
): number {
  const brush = requireUnit(brushCoverage, 'brush coverage');
  const texture = requireUnit(textureCoverage, 'texture coverage');
  const amount = requireUnit(strength, 'texture strength');
  if (blendMode !== 'multiply' && blendMode !== 'subtract' && blendMode !== 'add') {
    throw new TypeError('unsupported brush texture blend mode');
  }
  if (brush <= 0 || amount <= 0) return brush;

  if (blendMode === 'multiply') {
    const modulation = 1 - amount * (1 - texture);
    return clamp01(brush * modulation);
  }
  if (blendMode === 'subtract') {
    return clamp01(brush - amount * (1 - texture));
  }
  return clamp01(brush + (1 - brush) * texture * amount);
}
