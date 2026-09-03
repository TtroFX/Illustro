export interface PostStrokeCorrectionPointV1 {
  readonly documentX: number;
  readonly documentY: number;
}

const MAX_POST_STROKE_PASSES = 4;
const MAX_PASS_GAIN = 0.6;
const DISTANCE_EPSILON_PX = 1e-9;

function finitePoint(point: PostStrokeCorrectionPointV1): void {
  if (!Number.isFinite(point.documentX) || !Number.isFinite(point.documentY)) {
    throw new TypeError('post-stroke correction point must be finite');
  }
}

function freezePoint(point: PostStrokeCorrectionPointV1): PostStrokeCorrectionPointV1 {
  return Object.freeze({ documentX: point.documentX, documentY: point.documentY });
}

/**
 * Release-only symmetric stroke correction.
 *
 * Interior points move toward the distance-proportional chord between their neighbors. Endpoints are
 * exact invariants. A bounded 1..4 pass count gives useful smoothing without making release work
 * unbounded beyond O(n), and amount=0 is an exact identity path.
 */
export function correctPostStrokeGeometryV1(
  samples: readonly PostStrokeCorrectionPointV1[],
  amount: number,
): readonly PostStrokeCorrectionPointV1[] {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('post-stroke correction amount must be within 0..1');
  }
  for (const sample of samples) finitePoint(sample);
  if (samples.length === 0) return Object.freeze([]);
  let current = samples.map(freezePoint);
  if (amount <= 0 || current.length < 3) return Object.freeze(current);

  const passCount = Math.max(1, Math.min(MAX_POST_STROKE_PASSES, Math.ceil(amount * 4)));
  const gain = MAX_PASS_GAIN * amount;
  for (let pass = 0; pass < passCount; pass += 1) {
    const next = current.map(freezePoint);
    for (let index = 1; index < current.length - 1; index += 1) {
      const previous = current[index - 1];
      const point = current[index];
      const following = current[index + 1];
      if (previous === undefined || point === undefined || following === undefined) continue;
      const leftDistance = Math.hypot(
        point.documentX - previous.documentX,
        point.documentY - previous.documentY,
      );
      const rightDistance = Math.hypot(
        following.documentX - point.documentX,
        following.documentY - point.documentY,
      );
      const totalDistance = leftDistance + rightDistance;
      if (totalDistance <= DISTANCE_EPSILON_PX) continue;
      const ratio = leftDistance / totalDistance;
      const chordX = previous.documentX + (following.documentX - previous.documentX) * ratio;
      const chordY = previous.documentY + (following.documentY - previous.documentY) * ratio;
      next[index] = Object.freeze({
        documentX: point.documentX + (chordX - point.documentX) * gain,
        documentY: point.documentY + (chordY - point.documentY) * gain,
      });
    }
    current = next;
  }
  return Object.freeze(current);
}
