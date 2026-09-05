import { parseIbisBrushEnvelopeV1 } from './ibis-brush-envelope-v1.js';

export const IBIS_QR_CARRIER_SCHEMA_V1 = 'illustro.ibis-qr-carrier/1' as const;
export const IBIS_QR_IMAGE_MAX_DIMENSION_V1 = 8192;
export const IBIS_QR_IMAGE_MAX_PIXELS_V1 = 32 * 1024 * 1024;

export interface JsQrBinaryResultV1 {
  readonly binaryData: Uint8ClampedArray | Uint8Array | readonly number[];
  readonly data?: string;
  readonly version?: number;
}

export type JsQrDecoderV1 = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options?: {
    readonly inversionAttempts?: 'attemptBoth' | 'dontInvert' | 'onlyInvert' | 'invertFirst';
  },
) => JsQrBinaryResultV1 | null;

export interface IbisQrCarrierV1 {
  readonly schema: typeof IBIS_QR_CARRIER_SCHEMA_V1;
  readonly payload: Uint8Array;
  readonly qrVersion: number | null;
}

type JsQrGlobalV1 = typeof globalThis & { readonly jsQR?: JsQrDecoderV1 };

function runtimeJsQrDecoderV1(): JsQrDecoderV1 {
  const decoder = (globalThis as JsQrGlobalV1).jsQR;
  if (typeof decoder !== 'function') throw new TypeError('QR decoder runtime is unavailable');
  return decoder;
}

function checkedPixelsV1(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  if (!(rgba instanceof Uint8ClampedArray))
    throw new TypeError('QR pixels must be RGBA Uint8ClampedArray');
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new RangeError('QR image dimensions are invalid');
  }
  if (width > IBIS_QR_IMAGE_MAX_DIMENSION_V1 || height > IBIS_QR_IMAGE_MAX_DIMENSION_V1) {
    throw new RangeError('QR image dimensions exceed the safety limit');
  }
  const pixels = width * height;
  if (pixels > IBIS_QR_IMAGE_MAX_PIXELS_V1) {
    throw new RangeError('QR image pixel count exceeds the safety limit');
  }
  if (rgba.byteLength !== pixels * 4)
    throw new RangeError('QR RGBA byte length does not match dimensions');
  return rgba;
}

export function decodeIbisBrushQrPixelsV1(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  decoder: JsQrDecoderV1 = runtimeJsQrDecoderV1(),
): IbisQrCarrierV1 {
  const pixels = checkedPixelsV1(rgba, width, height);
  const decoded = decoder(pixels, width, height, { inversionAttempts: 'attemptBoth' });
  if (decoded === null) throw new TypeError('QR code was not found in the image');
  if (decoded.binaryData === undefined)
    throw new TypeError('QR decoder did not return binary payload bytes');

  const payload = Uint8Array.from(decoded.binaryData);
  parseIbisBrushEnvelopeV1(payload);
  return Object.freeze({
    schema: IBIS_QR_CARRIER_SCHEMA_V1,
    payload,
    qrVersion: Number.isSafeInteger(decoded.version) ? (decoded.version ?? null) : null,
  });
}

export async function decodeIbisBrushQrBlobV1(
  source: Blob,
  decoder?: JsQrDecoderV1,
): Promise<IbisQrCarrierV1> {
  if (!(source instanceof Blob)) throw new TypeError('QR image source must be a Blob');
  if (typeof createImageBitmap !== 'function') {
    throw new TypeError('image decoding is unsupported in this runtime');
  }

  const bitmap = await createImageBitmap(source);
  try {
    if (
      bitmap.width < 1 ||
      bitmap.height < 1 ||
      bitmap.width > IBIS_QR_IMAGE_MAX_DIMENSION_V1 ||
      bitmap.height > IBIS_QR_IMAGE_MAX_DIMENSION_V1 ||
      bitmap.width * bitmap.height > IBIS_QR_IMAGE_MAX_PIXELS_V1
    ) {
      throw new RangeError('QR image dimensions exceed the safety limit');
    }

    let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      context = canvas.getContext('2d', { willReadFrequently: true });
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      context = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (context === null) throw new TypeError('2D canvas is unavailable for QR decoding');

    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return decodeIbisBrushQrPixelsV1(
      imageData.data,
      bitmap.width,
      bitmap.height,
      decoder ?? runtimeJsQrDecoderV1(),
    );
  } finally {
    bitmap.close();
  }
}
