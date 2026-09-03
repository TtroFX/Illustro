export interface RealtimeBrushStabilizerSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly timestampMs: number;
}

export interface RealtimeBrushStabilizedPointV1 {
  readonly documentX: number;
  readonly documentY: number;
}

const DEFAULT_DT_SECONDS = 1 / 120;
const MIN_DT_SECONDS = 1 / 1000;
const MAX_DT_SECONDS = 1 / 20;
const DERIVATIVE_CUTOFF_HZ = 1;
const WEAK_MIN_CUTOFF_HZ = 12;
const STRONG_MIN_CUTOFF_HZ = 0.75;
const WEAK_BETA = 0.08;
const STRONG_BETA = 0.015;
const RELEASE_EPSILON_PX = 1e-6;

function finiteSample(sample: RealtimeBrushStabilizerSampleV1): void {
  if (
    !Number.isFinite(sample.documentX) ||
    !Number.isFinite(sample.documentY) ||
    !Number.isFinite(sample.timestampMs)
  ) {
    throw new TypeError('real-time stabilizer sample must be finite');
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function lowPassAlpha(cutoffHz: number, dtSeconds: number): number {
  const timeConstant = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + timeConstant / dtSeconds);
}

/**
 * M6A causal real-time stroke stabilizer.
 *
 * This is an independently implemented One-Euro-style adaptive low-pass filter: slow motion is
 * smoothed strongly, while the cutoff rises with filtered velocity so fast intentional motion
 * stays responsive. It stores only the previous raw/filter state and therefore remains O(1) per
 * sample and never rewrites an already-confirmed stroke prefix.
 */
export class RealtimeBrushStabilizerV1 {
  readonly #amount: number;
  #initialized = false;
  #lastTimestampMs = 0;
  #lastDtSeconds = DEFAULT_DT_SECONDS;
  #lastRawX = 0;
  #lastRawY = 0;
  #filteredX = 0;
  #filteredY = 0;
  #filteredDerivativeX = 0;
  #filteredDerivativeY = 0;

  constructor(amount: number) {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('real-time stabilization amount must be within 0..1');
    }
    this.#amount = amount;
  }

  amount(): number {
    return this.#amount;
  }

  push(sample: RealtimeBrushStabilizerSampleV1): RealtimeBrushStabilizedPointV1 {
    finiteSample(sample);
    if (!this.#initialized) {
      this.#adoptRaw(sample);
      return Object.freeze({ documentX: sample.documentX, documentY: sample.documentY });
    }
    if (this.#amount <= 0) {
      this.#adoptRaw(sample);
      return Object.freeze({ documentX: sample.documentX, documentY: sample.documentY });
    }

    const rawDtSeconds = (sample.timestampMs - this.#lastTimestampMs) / 1000;
    const dtSeconds =
      Number.isFinite(rawDtSeconds) && rawDtSeconds > 0
        ? clamp(rawDtSeconds, MIN_DT_SECONDS, MAX_DT_SECONDS)
        : this.#lastDtSeconds;
    const derivativeX = (sample.documentX - this.#lastRawX) / dtSeconds;
    const derivativeY = (sample.documentY - this.#lastRawY) / dtSeconds;
    const derivativeAlpha = lowPassAlpha(DERIVATIVE_CUTOFF_HZ, dtSeconds);
    this.#filteredDerivativeX = interpolate(
      this.#filteredDerivativeX,
      derivativeX,
      derivativeAlpha,
    );
    this.#filteredDerivativeY = interpolate(
      this.#filteredDerivativeY,
      derivativeY,
      derivativeAlpha,
    );
    const speedPxPerSecond = Math.hypot(this.#filteredDerivativeX, this.#filteredDerivativeY);
    const minimumCutoffHz = interpolate(WEAK_MIN_CUTOFF_HZ, STRONG_MIN_CUTOFF_HZ, this.#amount);
    const beta = interpolate(WEAK_BETA, STRONG_BETA, this.#amount);
    const cutoffHz = minimumCutoffHz + beta * speedPxPerSecond;
    const positionAlpha = lowPassAlpha(cutoffHz, dtSeconds);
    this.#filteredX = interpolate(this.#filteredX, sample.documentX, positionAlpha);
    this.#filteredY = interpolate(this.#filteredY, sample.documentY, positionAlpha);
    this.#lastRawX = sample.documentX;
    this.#lastRawY = sample.documentY;
    this.#lastTimestampMs = sample.timestampMs;
    this.#lastDtSeconds = dtSeconds;
    return Object.freeze({ documentX: this.#filteredX, documentY: this.#filteredY });
  }

  release(sample: RealtimeBrushStabilizerSampleV1): RealtimeBrushStabilizedPointV1 | null {
    finiteSample(sample);
    if (!this.#initialized || this.#amount <= 0) return null;
    const dx = sample.documentX - this.#filteredX;
    const dy = sample.documentY - this.#filteredY;
    if (Math.hypot(dx, dy) <= RELEASE_EPSILON_PX) return null;
    this.#adoptRaw(sample);
    return Object.freeze({ documentX: sample.documentX, documentY: sample.documentY });
  }

  #adoptRaw(sample: RealtimeBrushStabilizerSampleV1): void {
    this.#initialized = true;
    this.#lastRawX = sample.documentX;
    this.#lastRawY = sample.documentY;
    this.#filteredX = sample.documentX;
    this.#filteredY = sample.documentY;
    this.#filteredDerivativeX = 0;
    this.#filteredDerivativeY = 0;
    this.#lastTimestampMs = sample.timestampMs;
    this.#lastDtSeconds = DEFAULT_DT_SECONDS;
  }
}
