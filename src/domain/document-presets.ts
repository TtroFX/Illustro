import type { CanvasBackgroundSpec, DocumentColorSpace, DocumentPrecision } from './document.js';

export interface DocumentPresetV1 {
  readonly schema: 'illustro.document-preset/1';
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly ppi: number;
  readonly background: CanvasBackgroundSpec;
  readonly workingSpace: DocumentColorSpace;
  readonly precision: DocumentPrecision;
}

const TRANSPARENT_BACKGROUND = Object.freeze({ kind: 'transparent' as const });

function preset(
  id: string,
  label: string,
  width: number,
  height: number,
  ppi = 300,
): DocumentPresetV1 {
  return Object.freeze({
    schema: 'illustro.document-preset/1' as const,
    id,
    label,
    width,
    height,
    ppi,
    background: TRANSPARENT_BACKGROUND,
    workingSpace: 'srgb' as const,
    precision: 'rgba8-unorm' as const,
  });
}

export const DEFAULT_DOCUMENT_PRESETS_V1: readonly DocumentPresetV1[] = Object.freeze([
  preset('square-2048', 'Square 2048', 2048, 2048),
  preset('full-hd', 'Full HD', 1920, 1080),
  preset('uhd-4k', '4K UHD', 3840, 2160),
  preset('a4-portrait-300', 'A4 Portrait · 300 ppi', 2480, 3508),
  preset('a4-landscape-300', 'A4 Landscape · 300 ppi', 3508, 2480),
]);

export function documentPresetByIdV1(id: string): DocumentPresetV1 | null {
  return DEFAULT_DOCUMENT_PRESETS_V1.find((entry) => entry.id === id) ?? null;
}
