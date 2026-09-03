export const CUSTOM_BRUSH_TIP_SIDE_V1 = 5 as const;
export const CUSTOM_BRUSH_TIP_PIXEL_COUNT_V1 = CUSTOM_BRUSH_TIP_SIDE_V1 * CUSTOM_BRUSH_TIP_SIDE_V1;
const MAX_CUSTOM_BRUSH_TIP_FILE_BYTES_V1 = 16 * 1024 * 1024;

function byte(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 255) {
    throw new RangeError(label + ' must be within 0..255');
  }
  return Math.round(value);
}

export function customBrushTipAlphaFromRgbaV1(rgba: ArrayLike<number>): readonly number[] {
  if (rgba.length !== CUSTOM_BRUSH_TIP_PIXEL_COUNT_V1 * 4) {
    throw new RangeError('custom brush tip RGBA input must be exactly 5x5');
  }
  const result: number[] = [];
  for (let index = 0; index < CUSTOM_BRUSH_TIP_PIXEL_COUNT_V1; index += 1) {
    const offset = index * 4;
    const red = byte(Number(rgba[offset]), 'custom tip red');
    const green = byte(Number(rgba[offset + 1]), 'custom tip green');
    const blue = byte(Number(rgba[offset + 2]), 'custom tip blue');
    const alpha = byte(Number(rgba[offset + 3]), 'custom tip alpha');
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    result.push(Math.round((alpha * (255 - luminance)) / 255));
  }
  if (!result.some((value) => value > 0)) {
    throw new RangeError('custom brush tip image has no drawable dark coverage');
  }
  return Object.freeze(result);
}

export async function customBrushTipAlphaFromFileV1(file: File): Promise<readonly number[]> {
  if (!file.type.startsWith('image/'))
    throw new TypeError('custom brush tip requires an image file');
  if (file.size > MAX_CUSTOM_BRUSH_TIP_FILE_BYTES_V1) {
    throw new RangeError('custom brush tip image must be 16 MiB or smaller');
  }
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 1 || bitmap.height < 1)
      throw new RangeError('custom brush tip image is empty');
    const canvas = document.createElement('canvas');
    canvas.width = CUSTOM_BRUSH_TIP_SIDE_V1;
    canvas.height = CUSTOM_BRUSH_TIP_SIDE_V1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('custom brush tip image decoder is unavailable');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const sourceSide = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - sourceSide) / 2;
    const sourceY = (bitmap.height - sourceSide) / 2;
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceSide,
      sourceSide,
      0,
      0,
      CUSTOM_BRUSH_TIP_SIDE_V1,
      CUSTOM_BRUSH_TIP_SIDE_V1,
    );
    return customBrushTipAlphaFromRgbaV1(
      context.getImageData(0, 0, CUSTOM_BRUSH_TIP_SIDE_V1, CUSTOM_BRUSH_TIP_SIDE_V1).data,
    );
  } finally {
    bitmap.close();
  }
}

export function drawCustomBrushTipPreviewV1(
  canvas: HTMLCanvasElement,
  alpha: readonly number[] | null,
): void {
  canvas.width = CUSTOM_BRUSH_TIP_SIDE_V1;
  canvas.height = CUSTOM_BRUSH_TIP_SIDE_V1;
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (alpha === null) return;
  if (alpha.length !== CUSTOM_BRUSH_TIP_PIXEL_COUNT_V1) {
    throw new RangeError('custom brush tip preview requires exactly 25 alpha values');
  }
  const image = context.createImageData(CUSTOM_BRUSH_TIP_SIDE_V1, CUSTOM_BRUSH_TIP_SIDE_V1);
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    image.data[offset] = 0;
    image.data[offset + 1] = 0;
    image.data[offset + 2] = 0;
    image.data[offset + 3] = byte(alpha[index] ?? 0, 'custom tip preview alpha');
  }
  context.putImageData(image, 0, 0);
}
