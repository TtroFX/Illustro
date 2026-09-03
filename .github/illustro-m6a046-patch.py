from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))


def append_once(path: str, text: str) -> None:
    p = Path(path)
    current = p.read_text()
    if text not in current:
        p.write_text(current + text)


# ---------------- brush schema ----------------
replace_once(
    'src/domain/brush-schema.ts',
    """export const DEFAULT_BRUSH_STROKE_START_LENGTH_PX_V1 = 0 as const;
""",
    """export const DEFAULT_BRUSH_PEN_ORIENTATION_ENABLED_V1 = false as const;

export function brushPenOrientationEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.penOrientationEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PEN_ORIENTATION_ENABLED_V1;
}

export function withBrushPenOrientationEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush pen orientation flag must be boolean');
  if (enabled === DEFAULT_BRUSH_PEN_ORIENTATION_ENABLED_V1) {
    const { penOrientationEnabled: _penOrientationEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, penOrientationEnabled: enabled },
  });
}

export const DEFAULT_BRUSH_STROKE_START_LENGTH_PX_V1 = 0 as const;
""",
)

# ---------------- preset library ----------------
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushFollowStrokeRotationV1,
""",
    """  withBrushFollowStrokeRotationV1,
  withBrushPenOrientationEnabledV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """export function updateBrushPresetTipSelectionModeV1(
""",
    """export type BrushRotationSourceV1 = 'fixed' | 'stroke' | 'pen';

export function updateBrushPresetRotationSourceV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  source: BrushRotationSourceV1,
): BrushPresetLibraryStateV1 {
  if (source !== 'fixed' && source !== 'stroke' && source !== 'pen') {
    throw new TypeError('unsupported brush rotation source');
  }
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const rotation = withBrushFollowStrokeRotationV1(item.preset, source === 'stroke');
    const current = withBrushPenOrientationEnabledV1(rotation, source === 'pen');
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetTipSelectionModeV1(
""",
)

# ---------------- baseline brush ----------------
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly altitudeAngle?: number | null;
}
""",
    """  readonly altitudeAngle?: number | null;
  readonly azimuthAngle?: number | null;
  readonly twist?: number;
}
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """export interface BaselineBrushDabV1 {
""",
    """/**
 * Clockwise pen orientation in canvas coordinates. Pointer Events azimuthAngle is preferred;
 * tiltX/tiltY use the W3C conversion fallback. Twist is then added as barrel-axis rotation.
 */
export function baselineBrushSampleOrientationDegreesV1(sample: BaselineBrushSampleV1): number {
  let azimuthRadians: number;
  const azimuth = sample.azimuthAngle;
  if (azimuth !== undefined && azimuth !== null) {
    if (!Number.isFinite(azimuth) || azimuth < 0 || azimuth > Math.PI * 2) {
      throw new RangeError('baseline brush azimuth angle must be within 0..2pi');
    }
    azimuthRadians = azimuth === Math.PI * 2 ? 0 : azimuth;
  } else {
    const tiltX = sample.tiltX ?? 0;
    const tiltY = sample.tiltY ?? 0;
    if (!Number.isFinite(tiltX) || tiltX < -90 || tiltX > 90) {
      throw new RangeError('baseline brush tiltX must be within -90..90');
    }
    if (!Number.isFinite(tiltY) || tiltY < -90 || tiltY > 90) {
      throw new RangeError('baseline brush tiltY must be within -90..90');
    }
    if (tiltX === 0) {
      azimuthRadians = tiltY > 0 ? Math.PI / 2 : tiltY < 0 ? (3 * Math.PI) / 2 : 0;
    } else if (tiltY === 0) {
      azimuthRadians = tiltX < 0 ? Math.PI : 0;
    } else if (Math.abs(tiltX) === 90 || Math.abs(tiltY) === 90) {
      azimuthRadians = 0;
    } else {
      const tangentX = Math.tan((tiltX * Math.PI) / 180);
      const tangentY = Math.tan((tiltY * Math.PI) / 180);
      azimuthRadians = Math.atan2(tangentY, tangentX);
      if (azimuthRadians < 0) azimuthRadians += Math.PI * 2;
    }
  }
  const twist = sample.twist ?? 0;
  if (!Number.isFinite(twist) || twist < 0 || twist > 359) {
    throw new RangeError('baseline brush twist must be within 0..359');
  }
  return normalizeBaselineBrushTipAngleDegreesV1((azimuthRadians * 180) / Math.PI + twist);
}

function shortestAngularDeltaDegreesV1(fromDegrees: number, toDegrees: number): number {
  const from = normalizeBaselineBrushTipAngleDegreesV1(fromDegrees);
  const to = normalizeBaselineBrushTipAngleDegreesV1(toDegrees);
  return ((to - from + 540) % 360) - 180;
}

export interface BaselineBrushDabV1 {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  baselineBrushSampleTiltUprightnessV1(sample);
}
""",
    """  baselineBrushSampleTiltUprightnessV1(sample);
  baselineBrushSampleOrientationDegreesV1(sample);
}
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #followStrokeRotation: boolean;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
    """  readonly #followStrokeRotation: boolean;
  readonly #penOrientationEnabled: boolean;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #lastPoint: { x: number; y: number; pressure: number; tiltUprightness: number } | null = null;
""",
    """  #lastPoint: {
    x: number;
    y: number;
    pressure: number;
    tiltUprightness: number;
    orientationDegrees: number;
  } | null = null;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly followStrokeRotation?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly followStrokeRotation?: boolean;
      readonly penOrientationEnabled?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const followStrokeRotation = options.followStrokeRotation ?? false;
    if (typeof followStrokeRotation !== 'boolean') {
      throw new TypeError('baseline brush follow rotation must be boolean');
    }
""",
    """    const followStrokeRotation = options.followStrokeRotation ?? false;
    const penOrientationEnabled = options.penOrientationEnabled ?? false;
    if (typeof followStrokeRotation !== 'boolean') {
      throw new TypeError('baseline brush follow rotation must be boolean');
    }
    if (typeof penOrientationEnabled !== 'boolean') {
      throw new TypeError('baseline brush pen orientation flag must be boolean');
    }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#followStrokeRotation = followStrokeRotation;
    this.#tipShape = options.tipShape ?? 'round';
""",
    """    this.#followStrokeRotation = followStrokeRotation;
    this.#penOrientationEnabled = penOrientationEnabled;
    this.#tipShape = options.tipShape ?? 'round';
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const tiltUprightness = baselineBrushSampleTiltUprightnessV1(sample);
    this.#lastPoint = { x: sample.documentX, y: sample.documentY, pressure, tiltUprightness };
    this.#pushLogicalStamp(
      sample.documentX,
      sample.documentY,
      pressure,
      tiltUprightness,
      this.#resolvedTipAngleDegrees(),
""",
    """    const tiltUprightness = baselineBrushSampleTiltUprightnessV1(sample);
    const orientationDegrees = baselineBrushSampleOrientationDegreesV1(sample);
    this.#lastPoint = {
      x: sample.documentX,
      y: sample.documentY,
      pressure,
      tiltUprightness,
      orientationDegrees,
    };
    this.#pushLogicalStamp(
      sample.documentX,
      sample.documentY,
      pressure,
      tiltUprightness,
      this.#resolvedTipAngleDegrees(undefined, orientationDegrees),
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """          baselineBrushSampleTiltUprightnessV1(sample),
        );
""",
    """          baselineBrushSampleTiltUprightnessV1(sample),
          baselineBrushSampleOrientationDegreesV1(sample),
        );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        baselineBrushSampleTiltUprightnessV1(sample),
      );
""",
    """        baselineBrushSampleTiltUprightnessV1(sample),
        baselineBrushSampleOrientationDegreesV1(sample),
      );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """          lastPoint.tiltUprightness,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
    """          lastPoint.tiltUprightness,
          this.#resolvedTipAngleDegrees(
            this.#lastStrokeDirectionDegrees ?? undefined,
            lastPoint.orientationDegrees,
          ),
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #resolvedTipAngleDegrees(strokeDirectionDegrees?: number): number {
    const followAngle =
      this.#followStrokeRotation && strokeDirectionDegrees !== undefined
        ? strokeDirectionDegrees
        : 0;
    return normalizeBaselineBrushTipAngleDegreesV1(
      followAngle + this.#tipAngleDegrees - this.#tipDirectionDegrees,
    );
  }

  #appendPoint(x: number, y: number, pressure: number, tiltUprightness: number): void {
""",
    """  #resolvedTipAngleDegrees(
    strokeDirectionDegrees?: number,
    penOrientationDegrees?: number,
  ): number {
    const sourceAngle =
      this.#penOrientationEnabled && penOrientationDegrees !== undefined
        ? penOrientationDegrees
        : this.#followStrokeRotation && strokeDirectionDegrees !== undefined
          ? strokeDirectionDegrees
          : 0;
    return normalizeBaselineBrushTipAngleDegreesV1(
      sourceAngle + this.#tipAngleDegrees - this.#tipDirectionDegrees,
    );
  }

  #appendPoint(
    x: number,
    y: number,
    pressure: number,
    tiltUprightness: number,
    orientationDegrees: number,
  ): void {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    let cursorTiltUprightness = lastPoint.tiltUprightness;
    const segmentLength = Math.hypot(x - cursorX, y - cursorY);
""",
    """    let cursorTiltUprightness = lastPoint.tiltUprightness;
    let cursorOrientationDegrees = lastPoint.orientationDegrees;
    const segmentLength = Math.hypot(x - cursorX, y - cursorY);
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      cursorTiltUprightness += (tiltUprightness - cursorTiltUprightness) * ratio;
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        cursorPressure,
        cursorTiltUprightness,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
    """      cursorTiltUprightness += (tiltUprightness - cursorTiltUprightness) * ratio;
      cursorOrientationDegrees = normalizeBaselineBrushTipAngleDegreesV1(
        cursorOrientationDegrees +
          shortestAngularDeltaDegreesV1(cursorOrientationDegrees, orientationDegrees) * ratio,
      );
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        cursorPressure,
        cursorTiltUprightness,
        this.#resolvedTipAngleDegrees(
          this.#lastStrokeDirectionDegrees ?? undefined,
          cursorOrientationDegrees,
        ),
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#lastPoint = { x, y, pressure, tiltUprightness };
""",
    """    this.#lastPoint = { x, y, pressure, tiltUprightness, orientationDegrees };
""",
)

# ---------------- canonical facade ----------------
replace_once(
    'src/app/canonical-raster-brush.ts',
    """  readonly altitudeAngle?: number | null;
}
""",
    """  readonly altitudeAngle?: number | null;
  readonly azimuthAngle?: number | null;
  readonly twist?: number;
}
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly followStrokeRotation?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly followStrokeRotation?: boolean;
      readonly penOrientationEnabled?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.followStrokeRotation === undefined
        ? {}
        : { followStrokeRotation: options.followStrokeRotation }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
    """      ...(options.followStrokeRotation === undefined
        ? {}
        : { followStrokeRotation: options.followStrokeRotation }),
      ...(options.penOrientationEnabled === undefined
        ? {}
        : { penOrientationEnabled: options.penOrientationEnabled }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
)

# ---------------- paint session ----------------
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushFollowStrokeRotation: boolean;
  readonly brushTipSelectionMode: BaselineBrushTipSelectionModeV1;
""",
    """  readonly brushFollowStrokeRotation: boolean;
  readonly brushPenOrientationEnabled: boolean;
  readonly brushTipSelectionMode: BaselineBrushTipSelectionModeV1;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushFollowStrokeRotation = false;
  #brushTipSelectionMode: BaselineBrushTipSelectionModeV1 = 'fixed';
""",
    """  #brushFollowStrokeRotation = false;
  #brushPenOrientationEnabled = false;
  #brushTipSelectionMode: BaselineBrushTipSelectionModeV1 = 'fixed';
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushFollowStrokeRotation: this.#brushFollowStrokeRotation,
      brushTipSelectionMode: this.#brushTipSelectionMode,
""",
    """      brushFollowStrokeRotation: this.#brushFollowStrokeRotation,
      brushPenOrientationEnabled: this.#brushPenOrientationEnabled,
      brushTipSelectionMode: this.#brushTipSelectionMode,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushFollowStrokeRotation(): boolean {
    return this.#brushFollowStrokeRotation;
  }

  setBrushTipSelection(
""",
    """  brushFollowStrokeRotation(): boolean {
    return this.#brushFollowStrokeRotation;
  }

  setBrushPenOrientationEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime pen orientation flag');
    if (enabled !== this.#brushPenOrientationEnabled) this.#clearActiveStroke();
    this.#brushPenOrientationEnabled = enabled;
    return this.#brushPenOrientationEnabled;
  }

  brushPenOrientationEnabled(): boolean {
    return this.#brushPenOrientationEnabled;
  }

  setBrushTipSelection(
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        altitudeAngle: source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
      });
""",
    """        altitudeAngle: source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
        azimuthAngle: source === 'pen' ? sample.azimuthAngle : 0,
        twist: source === 'pen' ? sample.twist : 0,
      });
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        followStrokeRotation: this.#brushFollowStrokeRotation,
        tipDensity: this.#brushTipDensity,
""",
    """        followStrokeRotation: this.#brushFollowStrokeRotation,
        penOrientationEnabled: this.#brushPenOrientationEnabled,
        tipDensity: this.#brushTipDensity,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        altitudeAngle: active.source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
      });
""",
    """        altitudeAngle: active.source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
        azimuthAngle: active.source === 'pen' ? sample.azimuthAngle : 0,
        twist: active.source === 'pen' ? sample.twist : 0,
      });
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """                altitudeAngle:
                  active.source === 'pen' ? rawEndpoint.altitudeAngle : Math.PI / 2,
""",
    """                altitudeAngle:
                  active.source === 'pen' ? rawEndpoint.altitudeAngle : Math.PI / 2,
                azimuthAngle: active.source === 'pen' ? rawEndpoint.azimuthAngle : 0,
                twist: active.source === 'pen' ? rawEndpoint.twist : 0,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """              altitudeAngle: completed.source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
            });
""",
    """              altitudeAngle: completed.source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
              azimuthAngle: completed.source === 'pen' ? sample.azimuthAngle : 0,
              twist: completed.source === 'pen' ? sample.twist : 0,
            });
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """                  altitudeAngle:
                    completed.source === 'pen' ? rawEndpoint.altitudeAngle : Math.PI / 2,
                }),
""",
    """                  altitudeAngle:
                    completed.source === 'pen' ? rawEndpoint.altitudeAngle : Math.PI / 2,
                  azimuthAngle: completed.source === 'pen' ? rawEndpoint.azimuthAngle : 0,
                  twist: completed.source === 'pen' ? rawEndpoint.twist : 0,
                }),
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """              altitudeAngle: liveGeometry[index]?.altitudeAngle ?? Math.PI / 2,
            }),
""",
    """              altitudeAngle: liveGeometry[index]?.altitudeAngle ?? Math.PI / 2,
              azimuthAngle: liveGeometry[index]?.azimuthAngle ?? 0,
              twist: liveGeometry[index]?.twist ?? 0,
            }),
""",
)

# ---------------- preset controller ----------------
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushFollowStrokeRotationV1,
""",
    """  brushFollowStrokeRotationV1,
  brushPenOrientationEnabledV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetFollowRotationV1,
""",
    """  updateBrushPresetRotationSourceV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const followRotationButton = requireElement('#brush-follow-rotation', HTMLButtonElement);
  const tipRepeatMode = requireElement('#brush-tip-repeat-mode', HTMLSelectElement);
""",
    """  const followRotationButton = requireElement('#brush-follow-rotation', HTMLButtonElement);
  const penOrientationButton = requireElement('#brush-pen-orientation', HTMLButtonElement);
  const tipRepeatMode = requireElement('#brush-tip-repeat-mode', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushFollowStrokeRotation(brushFollowStrokeRotationV1(item.preset));
    const startLengthPx = brushStrokeStartLengthPxV1(item.preset);
""",
    """    const penOrientationEnabled = brushPenOrientationEnabledV1(item.preset);
    input.paintSession.setBrushPenOrientationEnabled(penOrientationEnabled);
    input.paintSession.setBrushFollowStrokeRotation(
      penOrientationEnabled ? false : brushFollowStrokeRotationV1(item.preset),
    );
    const startLengthPx = brushStrokeStartLengthPxV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushFollowRotation = String(
      brushFollowStrokeRotationV1(item.preset),
    );
    input.root.dataset.illustroBrushTipSelectionMode = brushTipSelectionModeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushFollowRotation = String(
      penOrientationEnabled ? false : brushFollowStrokeRotationV1(item.preset),
    );
    input.root.dataset.illustroBrushPenOrientation = String(penOrientationEnabled);
    input.root.dataset.illustroBrushTipSelectionMode = brushTipSelectionModeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const followRotation = brushFollowStrokeRotationV1(selected.preset);
    followRotationButton.textContent = followRotation ? 'ON' : 'OFF';
    followRotationButton.setAttribute('aria-pressed', String(followRotation));
""",
    """    const penOrientationEnabled = brushPenOrientationEnabledV1(selected.preset);
    const followRotation = !penOrientationEnabled && brushFollowStrokeRotationV1(selected.preset);
    followRotationButton.textContent = followRotation ? 'ON' : 'OFF';
    followRotationButton.setAttribute('aria-pressed', String(followRotation));
    penOrientationButton.textContent = penOrientationEnabled ? 'ON' : 'OFF';
    penOrientationButton.setAttribute('aria-pressed', String(penOrientationEnabled));
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}`;
""",
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      followRotationButton,
      tipRepeatMode,
""",
    """      followRotationButton,
      penOrientationButton,
      tipRepeatMode,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onFollowRotation = (): void =>
    mutate(() =>
      updateBrushPresetFollowRotationV1(
        state,
        state.selectedPresetId,
        !brushFollowStrokeRotationV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
""",
    """  const onFollowRotation = (): void => {
    const selected = selectedBrushPresetItemV1(state).preset;
    const enabled = !brushPenOrientationEnabledV1(selected) && brushFollowStrokeRotationV1(selected);
    mutate(() =>
      updateBrushPresetRotationSourceV1(state, state.selectedPresetId, enabled ? 'fixed' : 'stroke'),
    );
  };
  const onPenOrientation = (): void => {
    const enabled = brushPenOrientationEnabledV1(selectedBrushPresetItemV1(state).preset);
    mutate(() =>
      updateBrushPresetRotationSourceV1(state, state.selectedPresetId, enabled ? 'fixed' : 'pen'),
    );
  };
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  followRotationButton.addEventListener('click', onFollowRotation);
  tipRepeatMode.addEventListener('change', onTipRepeatMode);
""",
    """  followRotationButton.addEventListener('click', onFollowRotation);
  penOrientationButton.addEventListener('click', onPenOrientation);
  tipRepeatMode.addEventListener('change', onTipRepeatMode);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      followRotationButton.removeEventListener('click', onFollowRotation);
      tipRepeatMode.removeEventListener('change', onTipRepeatMode);
""",
    """      followRotationButton.removeEventListener('click', onFollowRotation);
      penOrientationButton.removeEventListener('click', onPenOrientation);
      tipRepeatMode.removeEventListener('change', onTipRepeatMode);
""",
)

# ---------------- index UI ----------------
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-repeat-mode\">先端繰り返し</label>
""",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-pen-orientation\">ペン方向追従</label>
                <button id=\"brush-pen-orientation\" type=\"button\" aria-pressed=\"false\" title=\"ペンの方位角と軸回転をブラシ先端の向きへ反映。ストローク追従とは排他\">OFF</button>
                <span class=\"shell-brush-tip-kind\">回転</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-repeat-mode\">先端繰り返し</label>
""",
)

# ---------------- tests ----------------
Path('tests/unit/brush-orientation-mapping.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  brushPenOrientationEnabledV1,
  createBaselineBrushPresetV1,
  withBrushPenOrientationEnabledV1,
} from '../../src/domain/brush-schema.js';
import {
  BaselineBrushDabBuilderV1,
  baselineBrushSampleOrientationDegreesV1,
} from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> { return []; }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> { return []; }
}

describe('M6A-046 orientation mapping', () => {
  it('is opt-in and keeps legacy fixed/follow behavior by default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'orientation.mapping', name: 'Orientation Mapping', category: 'Test', behavior: 'paint',
    });
    expect(brushPenOrientationEnabledV1(preset)).toBe(false);
    expect(brushPenOrientationEnabledV1(withBrushPenOrientationEnabledV1(preset, true))).toBe(true);
  });

  it('uses Pointer Events azimuth plus twist and the W3C tilt fallback', () => {
    expect(
      baselineBrushSampleOrientationDegreesV1({
        documentX: 0, documentY: 0, azimuthAngle: Math.PI / 2, twist: 30,
      }),
    ).toBeCloseTo(120, 10);
    expect(
      baselineBrushSampleOrientationDegreesV1({ documentX: 0, documentY: 0, tiltX: 0, tiltY: 45 }),
    ).toBeCloseTo(90, 10);
    expect(
      baselineBrushSampleOrientationDegreesV1({ documentX: 0, documentY: 0, tiltX: 45, tiltY: 45 }),
    ).toBeCloseTo(45, 10);
  });

  it('interpolates orientation on the shortest circular arc at logical stamp positions', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      penOrientationEnabled: true,
    });
    builder.beginDelta({
      documentX: 0, documentY: 0, azimuthAngle: (350 * Math.PI) / 180,
    });
    builder.appendDelta([{ documentX: 10, documentY: 0, azimuthAngle: (10 * Math.PI) / 180 }]);
    const dabs = builder.dabs();
    expect(dabs[0]?.tipAngleDegrees).toBeCloseTo(350, 8);
    expect(dabs[1]?.tipAngleDegrees).toBeCloseTo(0, 8);
    expect(dabs[2]?.tipAngleDegrees).toBeCloseTo(10, 8);
  });

  it('gives pen orientation priority over stroke-follow and composes static tip offsets once', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipAngleDegrees: 10,
      tipDirectionDegrees: 20,
      followStrokeRotation: true,
      penOrientationEnabled: true,
    });
    const [first] = builder.beginDelta({
      documentX: 0, documentY: 0, azimuthAngle: Math.PI / 2, twist: 15,
    });
    expect(first?.tipAngleDegrees).toBeCloseTo(95, 10);
    const appended = builder.appendDelta([
      { documentX: 10, documentY: 0, azimuthAngle: Math.PI / 2, twist: 15 },
    ]);
    expect(appended[0]?.tipAngleDegrees).toBeCloseTo(95, 10);
  });

  it('forwards orientation through the canonical facade and runtime flag', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20, penOrientationEnabled: true, tipAngleDegrees: 5,
    });
    const [dab] = stroke.beginConfirmed({
      documentX: 1, documentY: 1, azimuthAngle: Math.PI, twist: 10,
    });
    expect(dab?.tipAngleDegrees).toBeCloseTo(195, 10);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPenOrientationEnabled(true)).toBe(true);
    expect(session.snapshot().brushPenOrientationEnabled).toBe(true);
  });
});
""")

# ---------------- verifier ----------------
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-046 orientation mapping:完了', 'M6A-046 progress is not complete');
requireText(
  read('src/gpu/baseline-brush.ts'),
  'baselineBrushSampleOrientationDegreesV1',
  'pen orientation source resolver missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'shortestAngularDeltaDegreesV1',
  'circular orientation interpolation missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#penOrientationEnabled && penOrientationDegrees !== undefined',
  'pen orientation does not take explicit precedence over stroke-follow rotation',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushPenOrientationEnabled',
  'pen orientation mapping is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id=\"brush-pen-orientation\"',
  'reachable pen-orientation control missing',
);
requireText(
  read('tests/unit/brush-orientation-mapping.test.ts'),
  'interpolates orientation on the shortest circular arc at logical stamp positions',
  'orientation wraparound regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
)

# ---------------- progress + design memo ----------------
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-046 orientation mapping:未完了',
    """M6A-046 orientation mapping:完了
再開メモ: M6A-046 orientation mappingはPenのazimuthAngleを画面+X基準の時計回り方位として優先し、未提供時はPointer Events仕様のtiltX/tiltY→azimuth変換規則で復元する。twistはスタイラス主軸回りの時計回り追加回転として方位へ加算する。stamp間の角度補間は最短円弧を使い、359°→1°で180°側へ回り込まない。`dynamics.penOrientationEnabled`は既定false。ON時の最終先端角は `pen orientation + tip.angleDegrees - tip.directionDegrees`、OFF時は既存のstroke.followRotation/fixed規則を保持する。Pen orientationはstroke-followより優先し、UIでは両者を排他的rotation sourceとして選択する。primitive dabには従来どおり解決済みtipAngleDegreesだけを保存しWorker/history ABIは増やさない。次はM6A-047 velocity mappingから再開する。""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    """

## M6A pen-orientation mapping boundary — 2026-09-03

- Pen orientation is an angular brush-tip source, distinct from M6A-045 tilt magnitude. `PointerEvent.azimuthAngle` is preferred and uses the Pointer Events canvas convention: `0` at +X and clockwise growth. When azimuth is unavailable, `tiltX`/`tiltY` are converted using the W3C Pointer Events conversion rules.
- `twist` is clockwise barrel-axis rotation in degrees and is added to the projected pen azimuth. Unsupported azimuth/tilt/twist values resolve to zero orientation, preserving the existing fixed tip angle when the mapping is enabled on hardware without directional data.
- Angular interpolation between confirmed samples follows the shortest circular arc. This prevents wraparound discontinuities such as `359° → 1°` rotating through `180°`.
- `dynamics.penOrientationEnabled` is opt-in and defaults to false. Pen orientation and `stroke.followRotation` are alternative rotation sources; pen orientation has runtime precedence for defensive compatibility, while Tool Properties presents them as mutually exclusive choices.
- Final orientation remains `source angle + tip.angleDegrees - tip.directionDegrees`. The source is Pen orientation when enabled, otherwise local stroke tangent when Follow is enabled, otherwise zero/fixed.
- Stabilization modifies coordinates only. Azimuth/twist stay paired with confirmed samples and are preserved by index through post-stroke correction. Primitive dabs store only resolved `tipAngleDegrees`; Worker/history/recovery schemas do not gain a second orientation representation.
""",
)

print('M6A-046 patch applied')
