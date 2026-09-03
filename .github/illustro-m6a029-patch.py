from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {before[:170]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


def append_once(path: str, marker: str, block: str) -> None:
    source = read(path)
    if marker in source:
        return
    write(path, source.rstrip() + '\n\n' + block.strip() + '\n')


def write_new(path: str, content: str) -> None:
    target = Path(path)
    if target.exists():
        raise RuntimeError(f'{path}: already exists')
    target.write_text(content.strip() + '\n', encoding='utf-8')


# Domain: end-side distance envelope, separate from later size/opacity taper strength controls.
insert_before(
    'src/domain/brush-schema.ts',
    'export type BrushTipSelectionModeV1 =',
    """export const DEFAULT_BRUSH_STROKE_END_LENGTH_PX_V1 = 0 as const;
export const MAX_BRUSH_STROKE_END_LENGTH_PX_V1 = 4096 as const;

export function brushStrokeEndLengthPxV1(preset: BrushPresetV1): number {
  const value = preset.stroke.endLengthPx;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_BRUSH_STROKE_END_LENGTH_PX_V1
    ? value
    : DEFAULT_BRUSH_STROKE_END_LENGTH_PX_V1;
}

export function withBrushStrokeEndLengthPxV1(
  preset: BrushPresetV1,
  lengthPx: number,
): BrushPresetV1 {
  if (
    !Number.isFinite(lengthPx) ||
    lengthPx < 0 ||
    lengthPx > MAX_BRUSH_STROKE_END_LENGTH_PX_V1
  ) {
    throw new RangeError('brush stroke end length must be within 0..4096 px');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, endLengthPx: lengthPx },
  });
}""",
)

# Kernel: retain logical stamp records so only the bounded end tail is regenerated on release.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export const BASELINE_BRUSH_START_TAPER_LENGTH_PX = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
""",
    """export const BASELINE_BRUSH_START_TAPER_LENGTH_PX = 0 as const;
export const BASELINE_BRUSH_END_TAPER_LENGTH_PX = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
""",
)
insert_before(
    'src/gpu/baseline-brush.ts',
    'export class BaselineBrushDabBuilderV1 {',
    """interface BaselineLogicalStampRecordV1 {
  readonly x: number;
  readonly y: number;
  readonly tipAngleDegrees: number;
  readonly pathDistancePx: number;
  readonly sampledTipAlpha: BaselineBrushSampledTipAlphaV1;
  primitiveStart: number;
  primitiveEnd: number;
}""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #spacing: number;
  readonly #startTaperLengthPx: number;
  readonly #flow: number;
""",
    """  readonly #spacing: number;
  readonly #startTaperLengthPx: number;
  readonly #endTaperLengthPx: number;
  readonly #flow: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #tipSelectionSeed: number;
  #logicalStampIndex = 0;
  #pathDistancePx = 0;
""",
    """  readonly #tipSelectionSeed: number;
  readonly #logicalStamps: BaselineLogicalStampRecordV1[] = [];
  #logicalStampIndex = 0;
  #pathDistancePx = 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly hardness?: number;
""",
    """      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const startTaperLengthPx = options.startTaperLengthPx ?? BASELINE_BRUSH_START_TAPER_LENGTH_PX;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const startTaperLengthPx = options.startTaperLengthPx ?? BASELINE_BRUSH_START_TAPER_LENGTH_PX;
    const endTaperLengthPx = options.endTaperLengthPx ?? BASELINE_BRUSH_END_TAPER_LENGTH_PX;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      !Number.isFinite(startTaperLengthPx) ||
      startTaperLengthPx < 0 ||
      startTaperLengthPx > 4096
    ) {
      throw new RangeError('baseline brush start taper length must be within 0..4096 px');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (
      !Number.isFinite(startTaperLengthPx) ||
      startTaperLengthPx < 0 ||
      startTaperLengthPx > 4096
    ) {
      throw new RangeError('baseline brush start taper length must be within 0..4096 px');
    }
    if (!Number.isFinite(endTaperLengthPx) || endTaperLengthPx < 0 || endTaperLengthPx > 4096) {
      throw new RangeError('baseline brush end taper length must be within 0..4096 px');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#spacing = Math.max(minimumStampDistancePx, sizePx * spacingRatio);
    this.#startTaperLengthPx = startTaperLengthPx;
    this.#flow = flow;
""",
    """    this.#spacing = Math.max(minimumStampDistancePx, sizePx * spacingRatio);
    this.#startTaperLengthPx = startTaperLengthPx;
    this.#endTaperLengthPx = endTaperLengthPx;
    this.#flow = flow;
""",
)
# Finish: first ensure the endpoint logical stamp exists, then reconcile only the bounded logical tail.
replace_once(
    'src/gpu/baseline-brush.ts',
    """  finishDelta(): readonly BaselineBrushDabV1[] {
    if (this.#finished) return Object.freeze([]);
    const start = this.#dabs.length;
    this.#finished = true;
    const lastPoint = this.#lastPoint;
    const lastStampPoint = this.#lastStampPoint;
    if (lastPoint !== null && lastStampPoint !== null) {
      const distance = Math.hypot(lastPoint.x - lastStampPoint.x, lastPoint.y - lastStampPoint.y);
      if (distance > 1e-6) {
        this.#pushLogicalStamp(
          lastPoint.x,
          lastPoint.y,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
          this.#pathDistancePx,
        );
      }
    }
    return this.#deltaFrom(start);
  }

  dabCount(): number {
    return this.#dabs.length;
  }
""",
    """  finishDelta(): readonly BaselineBrushDabV1[] {
    if (this.#finished) return Object.freeze([]);
    const start = this.#dabs.length;
    const lastPoint = this.#lastPoint;
    const lastStampPoint = this.#lastStampPoint;
    if (lastPoint !== null && lastStampPoint !== null) {
      const distance = Math.hypot(lastPoint.x - lastStampPoint.x, lastPoint.y - lastStampPoint.y);
      if (distance > 1e-6) {
        this.#pushLogicalStamp(
          lastPoint.x,
          lastPoint.y,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
          this.#pathDistancePx,
        );
      }
    }
    if (this.#endTaperLengthPx > 0) this.#reconcileEndTaper();
    this.#finished = true;
    return this.#endTaperLengthPx > 0 ? Object.freeze([]) : this.#deltaFrom(start);
  }

  dabCount(): number {
    return this.#dabs.length;
  }

  mutableTailDabCount(): number {
    if (this.#finished || this.#endTaperLengthPx <= 0 || this.#logicalStamps.length === 0) return 0;
    const threshold = this.#pathDistancePx - this.#endTaperLengthPx;
    const firstMutable = this.#logicalStamps.find(
      (stamp) => stamp.pathDistancePx > threshold + 1e-9,
    );
    return firstMutable === undefined ? 0 : this.#dabs.length - firstMutable.primitiveStart;
  }

  stablePrefixDabCount(): number {
    return this.#dabs.length - this.mutableTailDabCount();
  }
""",
)
# Refactor logical stamp emission so a stored alpha selection can be replayed without consuming RNG/sequence state.
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #startEnvelopeAtDistance(pathDistancePx: number): number {
    if (this.#startTaperLengthPx <= 0) return 1;
    return Math.max(0, Math.min(1, pathDistancePx / this.#startTaperLengthPx));
  }

  #pushLogicalStamp(x: number, y: number, tipAngleDegrees: number, pathDistancePx: number): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    if (startEnvelope <= 0) return;
    pushBaselineBrushStampV1(
      this.#dabs,
      x,
      y,
      this.#radius * startEnvelope,
      this.#flow * startEnvelope,
      this.#strokeOpacity,
      this.#hardness,
      this.#tipDensity,
      tipAngleDegrees,
      this.#color,
      this.#tipShape,
      this.#sampledTipAlphaForLogicalStamp(),
    );
    this.#logicalStampIndex += 1;
  }
""",
    """  #startEnvelopeAtDistance(pathDistancePx: number): number {
    if (this.#startTaperLengthPx <= 0) return 1;
    return Math.max(0, Math.min(1, pathDistancePx / this.#startTaperLengthPx));
  }

  #endEnvelopeAtDistance(pathDistancePx: number, totalDistancePx: number): number {
    if (this.#endTaperLengthPx <= 0) return 1;
    return Math.max(0, Math.min(1, (totalDistancePx - pathDistancePx) / this.#endTaperLengthPx));
  }

  #emitLogicalStamp(
    target: BaselineBrushDabV1[],
    stamp: Pick<
      BaselineLogicalStampRecordV1,
      'x' | 'y' | 'tipAngleDegrees' | 'sampledTipAlpha'
    >,
    envelope: number,
  ): void {
    if (envelope <= 0) return;
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * envelope,
      this.#flow * envelope,
      this.#strokeOpacity,
      this.#hardness,
      this.#tipDensity,
      stamp.tipAngleDegrees,
      this.#color,
      this.#tipShape,
      stamp.sampledTipAlpha,
    );
  }

  #pushLogicalStamp(x: number, y: number, tipAngleDegrees: number, pathDistancePx: number): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    if (startEnvelope <= 0) return;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
      tipAngleDegrees,
      pathDistancePx,
      sampledTipAlpha,
      primitiveStart: this.#dabs.length,
      primitiveEnd: this.#dabs.length,
    };
    this.#emitLogicalStamp(this.#dabs, record, startEnvelope);
    record.primitiveEnd = this.#dabs.length;
    if (record.primitiveEnd === record.primitiveStart) return;
    this.#logicalStamps.push(record);
    this.#logicalStampIndex += 1;
  }

  #reconcileEndTaper(): void {
    if (this.#endTaperLengthPx <= 0 || this.#logicalStamps.length === 0) return;
    const totalDistancePx = this.#pathDistancePx;
    const firstTailIndex = this.#logicalStamps.findIndex(
      (stamp) => this.#endEnvelopeAtDistance(stamp.pathDistancePx, totalDistancePx) < 1 - 1e-9,
    );
    if (firstTailIndex < 0) return;
    const firstTail = this.#logicalStamps[firstTailIndex];
    if (firstTail === undefined) return;
    this.#dabs.length = firstTail.primitiveStart;
    for (let index = firstTailIndex; index < this.#logicalStamps.length; index += 1) {
      const stamp = this.#logicalStamps[index];
      if (stamp === undefined) continue;
      stamp.primitiveStart = this.#dabs.length;
      const envelope = Math.min(
        this.#startEnvelopeAtDistance(stamp.pathDistancePx),
        this.#endEnvelopeAtDistance(stamp.pathDistancePx, totalDistancePx),
      );
      this.#emitLogicalStamp(this.#dabs, stamp, envelope);
      stamp.primitiveEnd = this.#dabs.length;
    }
  }
""",
)

# Canonical facade: expose bounded mutable-tail metrics and forward end length.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """  readonly stablePrefixDabCount: number;
  readonly mutableTailDabCount: 0;
  readonly reprocessedStableDabCount: 0;
""",
    """  readonly stablePrefixDabCount: number;
  readonly mutableTailDabCount: number;
  readonly reprocessedStableDabCount: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly hardness?: number;
""",
    """      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.startTaperLengthPx === undefined
        ? {}
        : { startTaperLengthPx: options.startTaperLengthPx }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.startTaperLengthPx === undefined
        ? {}
        : { startTaperLengthPx: options.startTaperLengthPx }),
      ...(options.endTaperLengthPx === undefined
        ? {}
        : { endTaperLengthPx: options.endTaperLengthPx }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      stablePrefixDabCount: this.#kernel.dabCount(),
      mutableTailDabCount: 0 as const,
      reprocessedStableDabCount: 0 as const,
""",
    """      stablePrefixDabCount: this.#kernel.stablePrefixDabCount(),
      mutableTailDabCount: this.#kernel.mutableTailDabCount(),
      reprocessedStableDabCount: 0,
""",
)

# Paint session: capture the preset-local end length at stroke start.
replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_SPACING_RATIO,
  BASELINE_BRUSH_START_TAPER_LENGTH_PX,
  BASELINE_BRUSH_TIP_DENSITY,
""",
    """  BASELINE_BRUSH_SPACING_RATIO,
  BASELINE_BRUSH_START_TAPER_LENGTH_PX,
  BASELINE_BRUSH_END_TAPER_LENGTH_PX,
  BASELINE_BRUSH_TIP_DENSITY,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushMinimumStampDistancePx: number;
  readonly brushStartTaperLengthPx: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushMinimumStampDistancePx: number;
  readonly brushStartTaperLengthPx: number;
  readonly brushEndTaperLengthPx: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushStartTaperLengthPx: number = BASELINE_BRUSH_START_TAPER_LENGTH_PX;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushStartTaperLengthPx: number = BASELINE_BRUSH_START_TAPER_LENGTH_PX;
  #brushEndTaperLengthPx: number = BASELINE_BRUSH_END_TAPER_LENGTH_PX;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushStartTaperLengthPx: this.#brushStartTaperLengthPx,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushStartTaperLengthPx: this.#brushStartTaperLengthPx,
      brushEndTaperLengthPx: this.#brushEndTaperLengthPx,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {',
    """  setBrushEndTaperLengthPx(lengthPx: number): number {
    if (!Number.isFinite(lengthPx) || lengthPx < 0 || lengthPx > 4096) {
      throw new RangeError('invalid runtime brush end taper length');
    }
    if (lengthPx !== this.#brushEndTaperLengthPx) this.#clearActiveStroke();
    this.#brushEndTaperLengthPx = lengthPx;
    return this.#brushEndTaperLengthPx;
  }

  brushEndTaperLengthPx(): number {
    return this.#brushEndTaperLengthPx;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      minimumStampDistancePx: this.#brushMinimumStampDistancePx,
      startTaperLengthPx: this.#brushStartTaperLengthPx,
      hardness: this.#brushHardness,
""",
    """      minimumStampDistancePx: this.#brushMinimumStampDistancePx,
      startTaperLengthPx: this.#brushStartTaperLengthPx,
      endTaperLengthPx: this.#brushEndTaperLengthPx,
      hardness: this.#brushHardness,
""",
)

# Renderer: permit a release-time final tail reconciliation while preserving the default prefix fast path.
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    const active = this.#activeStroke;
    if (active !== null && active.operation !== operation) {
      throw new Error('baseline finalized stroke changed brush operation');
    }
    const resolvedLayerId = this.#resolveLayerId(layerId);
    if (active?.strokeId === strokeId && isDabPrefix(active.dabs, frozenDabs)) {
""",
    """    const active = this.#activeStroke;
    if (active !== null && active.operation !== operation) {
      throw new Error('baseline finalized stroke changed brush operation');
    }
    const resolvedLayerId = this.#resolveLayerId(layerId);
    const reconciledCoordinates = new Map<string, TileCoordinateV1>();
    if (active?.strokeId === strokeId && isDabPrefix(active.dabs, frozenDabs)) {
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    } else if (active === null) {
      this.#activeStroke = { strokeId, operation, dabs: [...frozenDabs] };
      canonicalTiles.applyDabs(resolvedLayerId, strokeId, frozenDabs, operation);
      if (frozenDabs.length > 0) {
        if (operation !== 'paint' || requiresCanonicalPaintPreview(frozenDabs)) {
          this.#patchCompositeTiles(
            planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => plan.coordinate),
          );
        } else {
          this.#appendDabs(frozenDabs);
        }
      }
    } else {
      throw new Error('baseline finalized dabs do not extend the active retained prefix');
    }

    const affectedTiles = planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => {
      tileState.allocate(plan.coordinate);
      const dirty = tileState.markDirty(plan.coordinate, plan.dirtyRect);
      return Object.freeze({ coordinate: plan.coordinate, dirty });
    });
""",
    """    } else if (active === null) {
      this.#activeStroke = { strokeId, operation, dabs: [...frozenDabs] };
      canonicalTiles.applyDabs(resolvedLayerId, strokeId, frozenDabs, operation);
      if (frozenDabs.length > 0) {
        if (operation !== 'paint' || requiresCanonicalPaintPreview(frozenDabs)) {
          this.#patchCompositeTiles(
            planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => plan.coordinate),
          );
        } else {
          this.#appendDabs(frozenDabs);
        }
      }
    } else if (active.strokeId === strokeId) {
      const rollback = canonicalTiles.cancel(strokeId);
      for (const patch of rollback) {
        reconciledCoordinates.set(
          `${patch.coordinate.tx}:${patch.coordinate.ty}`,
          patch.coordinate,
        );
      }
      this.#activeStroke = { strokeId, operation, dabs: [...frozenDabs] };
      canonicalTiles.applyDabs(resolvedLayerId, strokeId, frozenDabs, operation);
      for (const plan of planBaselineBrushTilesV1(frozenDabs, width, height)) {
        reconciledCoordinates.set(`${plan.coordinate.tx}:${plan.coordinate.ty}`, plan.coordinate);
      }
      this.#patchCompositeTiles([...reconciledCoordinates.values()]);
    } else {
      throw new Error('baseline finalized dabs do not extend the active retained prefix');
    }

    const finalPlans = planBaselineBrushTilesV1(frozenDabs, width, height);
    const finalPlanByKey = new Map(
      finalPlans.map((plan) => [`${plan.coordinate.tx}:${plan.coordinate.ty}`, plan] as const),
    );
    const affectedCoordinates = new Map<string, TileCoordinateV1>();
    for (const plan of finalPlans) {
      affectedCoordinates.set(`${plan.coordinate.tx}:${plan.coordinate.ty}`, plan.coordinate);
    }
    for (const [key, coordinate] of reconciledCoordinates) affectedCoordinates.set(key, coordinate);
    const affectedTiles = [...affectedCoordinates.entries()].map(([key, coordinate]) => {
      tileState.allocate(coordinate);
      const plan = finalPlanByKey.get(key);
      const bounds = tileBoundsForDocumentV1(width, height, coordinate);
      const dirtyRect = reconciledCoordinates.has(key)
        ? { x: 0, y: 0, width: bounds.validWidth, height: bounds.validHeight }
        : plan?.dirtyRect;
      const dirty = dirtyRect === undefined ? null : tileState.markDirty(coordinate, dirtyRect);
      return Object.freeze({ coordinate, dirty });
    });
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTipSelectionModeV1,
  withBrushStrokeStartLengthPxV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTipSelectionModeV1,
  withBrushStrokeStartLengthPxV1,
  withBrushStrokeEndLengthPxV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetEndLengthV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  lengthPx: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushStrokeEndLengthPxV1(item.preset, lengthPx);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}""",
)

# Inspector UI wiring.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTipSelectionModeV1,
  brushStrokeStartLengthPxV1,
  brushStrokeSpacingV1,
""",
    """  brushTipSelectionModeV1,
  brushStrokeStartLengthPxV1,
  brushStrokeEndLengthPxV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTipSelectionModeV1,
  updateBrushPresetStartLengthV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTipSelectionModeV1,
  updateBrushPresetStartLengthV1,
  updateBrushPresetEndLengthV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const startLengthRange = requireElement('#brush-start-length-range', HTMLInputElement);
  const startLengthNumber = requireElement('#brush-start-length-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const startLengthRange = requireElement('#brush-start-length-range', HTMLInputElement);
  const startLengthNumber = requireElement('#brush-start-length-number', HTMLInputElement);
  const endLengthRange = requireElement('#brush-end-length-range', HTMLInputElement);
  const endLengthNumber = requireElement('#brush-end-length-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const startLengthPx = brushStrokeStartLengthPxV1(item.preset);
    input.paintSession.setBrushStartTaperLengthPx(startLengthPx);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const startLengthPx = brushStrokeStartLengthPxV1(item.preset);
    input.paintSession.setBrushStartTaperLengthPx(startLengthPx);
    const endLengthPx = brushStrokeEndLengthPxV1(item.preset);
    input.paintSession.setBrushEndTaperLengthPx(endLengthPx);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushStartLengthPx = String(startLengthPx);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushStartLengthPx = String(startLengthPx);
    input.root.dataset.illustroBrushEndLengthPx = String(endLengthPx);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const startLengthPx = brushStrokeStartLengthPxV1(selected.preset);
    configurePair(startLengthRange, startLengthNumber, 0, 4096, 1, startLengthPx);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const startLengthPx = brushStrokeStartLengthPxV1(selected.preset);
    configurePair(startLengthRange, startLengthNumber, 0, 4096, 1, startLengthPx);
    const endLengthPx = brushStrokeEndLengthPxV1(selected.preset);
    configurePair(endLengthRange, endLengthNumber, 0, 4096, 1, endLengthPx);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const startLabel = startLengthPx > 0 ? ` · In${Math.round(startLengthPx)}px` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}`;
""",
    """    const startLabel = startLengthPx > 0 ? ` · In${Math.round(startLengthPx)}px` : '';
    const endLabel = endLengthPx > 0 ? ` · Out${Math.round(endLengthPx)}px` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      startLengthRange,
      startLengthNumber,
      tipShape,
""",
    """      startLengthRange,
      startLengthNumber,
      endLengthRange,
      endLengthNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const updateStartLength = (lengthPx: number): void =>
    mutate(() => updateBrushPresetStartLengthV1(state, state.selectedPresetId, lengthPx));
  const onStartLengthRange = (): void => updateStartLength(Number(startLengthRange.value));
  const onStartLengthNumber = (): void => updateStartLength(Number(startLengthNumber.value));
  const onTipShape = (): void => {
""",
    """  const updateStartLength = (lengthPx: number): void =>
    mutate(() => updateBrushPresetStartLengthV1(state, state.selectedPresetId, lengthPx));
  const onStartLengthRange = (): void => updateStartLength(Number(startLengthRange.value));
  const onStartLengthNumber = (): void => updateStartLength(Number(startLengthNumber.value));
  const updateEndLength = (lengthPx: number): void =>
    mutate(() => updateBrushPresetEndLengthV1(state, state.selectedPresetId, lengthPx));
  const onEndLengthRange = (): void => updateEndLength(Number(endLengthRange.value));
  const onEndLengthNumber = (): void => updateEndLength(Number(endLengthNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  startLengthRange.addEventListener('input', onStartLengthRange);
  startLengthNumber.addEventListener('change', onStartLengthNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  startLengthRange.addEventListener('input', onStartLengthRange);
  startLengthNumber.addEventListener('change', onStartLengthNumber);
  endLengthRange.addEventListener('input', onEndLengthRange);
  endLengthNumber.addEventListener('change', onEndLengthNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      startLengthRange.removeEventListener('input', onStartLengthRange);
      startLengthNumber.removeEventListener('change', onStartLengthNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      startLengthRange.removeEventListener('input', onStartLengthRange);
      startLengthNumber.removeEventListener('change', onStartLengthNumber);
      endLengthRange.removeEventListener('input', onEndLengthRange);
      endLengthNumber.removeEventListener('change', onEndLengthNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-start-length-range">入り長さ</label>
                <input id="brush-start-length-range" type="range" min="0" max="4096" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-start-length-number" type="number" inputmode="numeric" min="0" max="4096" step="1" value="0" aria-label="ストローク入り長さ" /><span>px</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-start-length-range">入り長さ</label>
                <input id="brush-start-length-range" type="range" min="0" max="4096" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-start-length-number" type="number" inputmode="numeric" min="0" max="4096" step="1" value="0" aria-label="ストローク入り長さ" /><span>px</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-end-length-range">抜き長さ</label>
                <input id="brush-end-length-range" type="range" min="0" max="4096" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-end-length-number" type="number" inputmode="numeric" min="0" max="4096" step="1" value="0" aria-label="ストローク抜き長さ" /><span>px</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

# New end-behavior regression coverage.
write_new(
    'tests/unit/brush-stroke-end.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushStrokeEndLengthPxV1,
  createBaselineBrushPresetV1,
  withBrushStrokeEndLengthPxV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-029 stroke-end behavior', () => {
  it('preserves legacy immediate endings and validates a preset-local end length', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'end.paint',
      name: 'End',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushStrokeEndLengthPxV1(preset)).toBe(0);
    expect(brushStrokeEndLengthPxV1(withBrushStrokeEndLengthPxV1(preset, 48))).toBe(48);
    expect(() => withBrushStrokeEndLengthPxV1(preset, 5000)).toThrow(RangeError);
  });

  it('keeps a stable prefix and regenerates only the bounded release tail', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 1,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    const before = builder.dabs();
    expect(before.map((dab) => dab.x)).toEqual([0, 10, 20, 30, 40]);
    expect(builder.stablePrefixDabCount()).toBe(3);
    expect(builder.mutableTailDabCount()).toBe(2);
    const stablePrefix = before.slice(0, 3);

    expect(builder.finishDelta()).toEqual([]);
    const final = builder.dabs();
    expect(final.map((dab) => dab.x)).toEqual([0, 10, 20, 30]);
    expect(final.slice(0, 3)).toEqual(stablePrefix);
    expect(final[3]?.radius).toBeCloseTo(5, 6);
    expect(final[3]?.flow).toBeCloseTo(0.5, 6);
    expect(final[3]?.strokeOpacity).toBeCloseTo(0.8, 6);
    expect(builder.mutableTailDabCount()).toBe(0);
    expect(builder.stablePrefixDabCount()).toBe(4);
  });

  it('shrinks a sampled tip around its logical center during end-tail reconciliation', () => {
    const top = Object.freeze(Array.from({ length: 25 }, (_, index) => (index === 2 ? 255 : 0)));
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
      tipShape: 'sampled-image',
      sampledTipAlphas: [top],
    });
    builder.beginDelta({ documentX: 0, documentY: 20 });
    builder.appendDelta([{ documentX: 40, documentY: 20 }]);
    builder.finishDelta();
    const final = builder.dabs();
    const tapered = final.find((dab) => Math.abs(dab.x - 30) < 1e-6);
    expect(tapered).toBeDefined();
    expect(tapered?.y).toBeCloseTo(16, 6);
  });

  it('combines overlapping start/end envelopes by the stronger taper side', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      endTaperLengthPx: 20,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 20, documentY: 0 }]);
    builder.finishDelta();
    expect(builder.dabs()).toHaveLength(1);
    expect(builder.dabs()[0]?.x).toBeCloseTo(10, 6);
    expect(builder.dabs()[0]?.radius).toBeCloseTo(5, 6);
    expect(builder.dabs()[0]?.flow).toBeCloseTo(0.5, 6);
  });
});""",
)

# Renderer regression: non-prefix final dabs reconcile provisional-only tiles and commit canonical final state.
insert_before(
    'tests/unit/baseline-paint-renderer.test.ts',
    """  it('rebuilds the retained scene from committed state when a provisional stroke is cancelled', () => {
""",
    """  it('reconciles a changed release tail without requiring final dabs to extend the provisional prefix', () => {
    const { renderer } = configuredRenderer();
    const provisional = Object.freeze({ ...dab(124, 64), radius: 8 });
    const tapered = Object.freeze({ ...dab(124, 64), radius: 2, flow: 0.25, strokeOpacity: 1 });

    renderer.presentStroke('stroke-end-reconcile', [provisional]);
    const result = renderer.finalizeStroke('stroke-end-reconcile', [tapered]);

    expect(result).toMatchObject({
      strokeId: 'stroke-end-reconcile',
      dabCount: 1,
      renderer: { activeStrokeId: null, committedStrokeCount: 1, committedDabCount: 1 },
    });
    expect(result.affectedTiles.map((entry) => entry.coordinate)).toEqual([
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
    ]);
    expect(result.affectedTiles.every((entry) => entry.dirty?.region.kind === 'full')).toBe(true);
  });

""",
)

# Canonical work metrics regression.
insert_before(
    'tests/unit/canonical-raster-brush.test.ts',
    """  it('retains the final endpoint through the incremental finish boundary', () => {
""",
    """  it('reports an end-taper mutable tail without reprocessing the stable prefix', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
    });
    stroke.beginConfirmed({ documentX: 0, documentY: 0 });
    stroke.appendConfirmed([{ documentX: 40, documentY: 0 }]);
    expect(stroke.snapshot()).toMatchObject({
      stablePrefixDabCount: 3,
      mutableTailDabCount: 2,
      reprocessedStableDabCount: 0,
    });
    stroke.finishConfirmed();
    expect(stroke.snapshot()).toMatchObject({
      stablePrefixDabCount: 4,
      mutableTailDabCount: 0,
      reprocessedStableDabCount: 0,
      finished: true,
    });
  });

""",
)

# Progress/docs/verifier.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-029 stroke-end behavior:未完了
M6A-030 size taper:未完了
""",
    """M6A-029 stroke-end behavior:完了
再開メモ: M6A-029 stroke-end behaviorはstroke.endLengthPxを0..4096 document pxで保持し、0は従来の即時終了を維持する。endLengthPx>0ではactive中に現在末尾からendLengthPx内のlogical stampsだけをmutable tailとして識別し、pointerupで総path lengthが確定した時にそのtailだけをstart/end envelopeのminで再生成する。stable prefixはkernel上で再生成しない。whole-stroke opacity capは一定のままradiusとper-dab flow/depositを減衰し、終端0% stampは最終dab列から除外する。現rendererのactive Raster transactionはtail置換APIをまだ持たないため、final dabsがprovisional prefixと一致しない場合だけrelease時に一度cancel→最終dab列再適用で整合する。毎入力のwhole-stroke replayは行わず、tail-only raster reconciliationへの最適化はM6A-PERF-001/002に残す。次はM6A-030 size taperから再開する。
M6A-030 size taper:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A stroke-end boundary — 2026-09-03',
    """#### M6A stroke-end boundary — 2026-09-03

- M6A-029 stores end-side behavior as `stroke.endLengthPx` in document-space pixels. `0` preserves the legacy immediate ending and the existing append-only renderer finalization fast path.
- A positive end length defines a linear release envelope from full strength at `endLengthPx` before the final path position to zero at the endpoint. Start/end overlap uses `min(startEnvelope, endEnvelope)`, preventing a short stroke from being attenuated twice by multiplication.
- The brush kernel retains logical-stamp metadata for the potential end window. During active input only stamps within the current end-length window are reported as the bounded mutable tail; confirmed stamps before that window are the stable prefix. On release only the logical mutable tail is regenerated, including sampled/custom tip expansion from the already-selected per-stamp alpha asset. Stable-prefix primitive dabs are not regenerated.
- The common M6A-029 envelope continues the corrected M6A-028 invariant: radius and per-dab flow/deposit are attenuated while the captured whole-stroke opacity cap remains constant. M6A-030 and M6A-031 own independent size/opacity taper strengths/minima.
- The current baseline Raster Tile transaction cannot replace only a previously rasterized active tail. Therefore, only when release-time final dabs no longer extend the provisional prefix, the renderer performs one release reconciliation: rollback the provisional stroke transaction, apply the resolved final dab list, then finalize normally. This is never performed per input sample.
- That release reconciliation is a correctness bridge, not the performance-complete endpoint. M6A-PERF-001/002 remain explicitly incomplete and own tail-only raster/tile reconciliation so long end tapers do not require a one-time whole-stroke reapply at release.
- A release reconciliation reports the union of provisional and final affected tiles as dirty so pixels touched only by the larger provisional tail are cleared on Main WebGPU, Render Worker and compatibility presentation paths.""",
)
insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-029 stroke-end behavior:完了', 'M6A-029 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushStrokeEndLengthPxV1',
  'stroke-end preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#reconcileEndTaper',
  'bounded logical end-tail reconciliation missing',
);
requireText(
  read('src/gpu/baseline-paint-renderer.ts'),
  'const rollback = canonicalTiles.cancel(strokeId)',
  'release-time provisional raster reconciliation missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'endTaperLengthPx: this.#brushEndTaperLengthPx',
  'stroke-end behavior is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id=\"brush-end-length-range\"',
  'reachable stroke-end control missing',
);
requireText(
  read('tests/unit/brush-stroke-end.test.ts'),
  'regenerates only the bounded release tail',
  'stroke-end regression coverage missing',
);""",
)

print('M6A-029 stroke-end patch applied')