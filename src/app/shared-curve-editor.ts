import {
  RESPONSE_CURVE_MAX_POINTS_V1,
  RESPONSE_CURVE_PRESETS_V1,
  compileResponseCurveV1,
  normalizeResponseCurveV1,
  responseCurveEqualsV1,
  responseCurvePresetIdV1,
  responseCurvePresetV1,
  type ResponseCurvePointV1,
  type ResponseCurvePresetIdV1,
} from '../domain/response-curve.js';

export interface SharedCurveEditorV1 {
  setCurve(curve: readonly ResponseCurvePointV1[]): void;
  setDisabled(disabled: boolean): void;
  snapshot(): readonly ResponseCurvePointV1[];
  dispose(): void;
}

interface SharedCurveEditorElementsV1 {
  readonly canvas: HTMLCanvasElement;
  readonly preset: HTMLSelectElement;
  readonly inputNumber: HTMLInputElement;
  readonly outputNumber: HTMLInputElement;
  readonly deleteButton: HTMLButtonElement;
  readonly resetButton: HTMLButtonElement;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function canvasPoint(
  canvas: HTMLCanvasElement,
  point: ResponseCurvePointV1,
): { readonly x: number; readonly y: number } {
  return Object.freeze({ x: point.input * canvas.width, y: (1 - point.output) * canvas.height });
}

export function installSharedCurveEditorV1(input: {
  readonly elements: SharedCurveEditorElementsV1;
  readonly initialCurve: readonly ResponseCurvePointV1[];
  readonly onChange: (curve: readonly ResponseCurvePointV1[]) => void;
}): SharedCurveEditorV1 {
  const { canvas, preset, inputNumber, outputNumber, deleteButton, resetButton } = input.elements;
  let curve = normalizeResponseCurveV1(input.initialCurve);
  let selectedIndex = 0;
  let draggingPointerId: number | null = null;
  let disabled = false;

  const render = (): void => {
    const context = canvas.getContext('2d');
    if (context !== null) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#e6ebf3';
      context.lineWidth = 1;
      for (let step = 1; step < 4; step += 1) {
        const x = (canvas.width * step) / 4;
        const y = (canvas.height * step) / 4;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }
      context.strokeStyle = '#cbd5e1';
      context.beginPath();
      context.moveTo(0, canvas.height);
      context.lineTo(canvas.width, 0);
      context.stroke();

      const compiled = compileResponseCurveV1(curve);
      context.strokeStyle = '#2d8cff';
      context.lineWidth = 2.5;
      context.beginPath();
      for (let step = 0; step <= 96; step += 1) {
        const value = step / 96;
        const x = value * canvas.width;
        const y = (1 - compiled.sample(value)) * canvas.height;
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      curve.forEach((curvePoint, index) => {
        const position = canvasPoint(canvas, curvePoint);
        context.beginPath();
        context.arc(position.x, position.y, index === selectedIndex ? 6.5 : 5, 0, Math.PI * 2);
        context.fillStyle = index === selectedIndex ? '#ff3d8d' : '#ffffff';
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = index === selectedIndex ? '#c2185b' : '#2d8cff';
        context.stroke();
      });
    }
    const selected = curve[selectedIndex] ?? curve[0]!;
    inputNumber.value = (selected.input * 100).toFixed(1);
    outputNumber.value = (selected.output * 100).toFixed(1);
    const endpoint = selectedIndex === 0 || selectedIndex === curve.length - 1;
    inputNumber.disabled = disabled || endpoint;
    outputNumber.disabled = disabled || endpoint;
    deleteButton.disabled = disabled || endpoint;
    resetButton.disabled = disabled;
    preset.disabled = disabled;
    canvas.setAttribute('aria-disabled', String(disabled));
    const presetId = responseCurvePresetIdV1(curve);
    preset.value = presetId ?? 'custom';
  };

  const emit = (): void => {
    render();
    input.onChange(curve);
  };

  const updateSelected = (nextInput: number, nextOutput: number): void => {
    if (selectedIndex <= 0 || selectedIndex >= curve.length - 1) return;
    const before = curve[selectedIndex - 1]!;
    const after = curve[selectedIndex + 1]!;
    const normalizedInput = clamp(nextInput, before.input + 0.001, after.input - 0.001);
    const normalizedOutput = clamp(nextOutput, before.output, after.output);
    const next = curve.map((curvePoint, index) =>
      index === selectedIndex
        ? Object.freeze({ input: normalizedInput, output: normalizedOutput })
        : curvePoint,
    );
    curve = normalizeResponseCurveV1(next);
    emit();
  };

  const localPointer = (
    event: PointerEvent,
  ): { readonly input: number; readonly output: number } => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    return Object.freeze({
      input: clamp(x / canvas.width, 0, 1),
      output: clamp(1 - y / canvas.height, 0, 1),
    });
  };

  const nearestPointIndex = (event: PointerEvent): number | null => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    let bestIndex: number | null = null;
    let bestDistance = 18 * 18;
    curve.forEach((curvePoint, index) => {
      const position = canvasPoint(canvas, curvePoint);
      const distance = (position.x - x) ** 2 + (position.y - y) ** 2;
      if (distance <= bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (disabled || event.button !== 0) return;
    const nearest = nearestPointIndex(event);
    if (nearest !== null) {
      selectedIndex = nearest;
      draggingPointerId = event.pointerId;
      canvas.setPointerCapture?.(event.pointerId);
      render();
      event.preventDefault();
      return;
    }
    if (curve.length >= RESPONSE_CURVE_MAX_POINTS_V1) return;
    const value = localPointer(event);
    if (value.input <= 0.001 || value.input >= 0.999) return;
    const insertionIndex = curve.findIndex((curvePoint) => curvePoint.input > value.input);
    if (insertionIndex <= 0) return;
    const before = curve[insertionIndex - 1]!;
    const after = curve[insertionIndex]!;
    const inserted = Object.freeze({
      input: value.input,
      output: clamp(value.output, before.output, after.output),
    });
    curve = normalizeResponseCurveV1([
      ...curve.slice(0, insertionIndex),
      inserted,
      ...curve.slice(insertionIndex),
    ]);
    selectedIndex = insertionIndex;
    draggingPointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    emit();
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (disabled || draggingPointerId !== event.pointerId) return;
    const value = localPointer(event);
    updateSelected(value.input, value.output);
    event.preventDefault();
  };
  const onPointerEnd = (event: PointerEvent): void => {
    if (draggingPointerId !== event.pointerId) return;
    draggingPointerId = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const onInputNumber = (): void => {
    const selected = curve[selectedIndex];
    if (selected === undefined) return;
    updateSelected(Number(inputNumber.value) / 100, selected.output);
  };
  const onOutputNumber = (): void => {
    const selected = curve[selectedIndex];
    if (selected === undefined) return;
    updateSelected(selected.input, Number(outputNumber.value) / 100);
  };
  const onDelete = (): void => {
    if (disabled || selectedIndex <= 0 || selectedIndex >= curve.length - 1) return;
    curve = normalizeResponseCurveV1(curve.filter((_point, index) => index !== selectedIndex));
    selectedIndex = Math.max(0, selectedIndex - 1);
    emit();
  };
  const onReset = (): void => {
    curve = responseCurvePresetV1('linear');
    selectedIndex = 0;
    emit();
  };
  const onPreset = (): void => {
    if (disabled || preset.value === 'custom') return;
    const presetId = preset.value as ResponseCurvePresetIdV1;
    if (!RESPONSE_CURVE_PRESETS_V1.some((entry) => entry.id === presetId)) return;
    curve = responseCurvePresetV1(presetId);
    selectedIndex = 0;
    emit();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  inputNumber.addEventListener('change', onInputNumber);
  outputNumber.addEventListener('change', onOutputNumber);
  deleteButton.addEventListener('click', onDelete);
  resetButton.addEventListener('click', onReset);
  preset.addEventListener('change', onPreset);
  render();

  return Object.freeze({
    setCurve: (nextCurve: readonly ResponseCurvePointV1[]): void => {
      const normalized = normalizeResponseCurveV1(nextCurve);
      if (responseCurveEqualsV1(curve, normalized)) return;
      curve = normalized;
      selectedIndex = Math.min(selectedIndex, curve.length - 1);
      render();
    },
    setDisabled: (nextDisabled: boolean): void => {
      disabled = nextDisabled;
      render();
    },
    snapshot: (): readonly ResponseCurvePointV1[] => curve,
    dispose: (): void => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      inputNumber.removeEventListener('change', onInputNumber);
      outputNumber.removeEventListener('change', onOutputNumber);
      deleteButton.removeEventListener('click', onDelete);
      resetButton.removeEventListener('click', onReset);
      preset.removeEventListener('change', onPreset);
    },
  });
}
