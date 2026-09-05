/** CPU timings are wall time; submission is not a measurement of physical visibility. */
export class PaintWorkMetricsV1 {
  canonicalRasterMs = 0;
  canonicalDabs = 0;
  liveCanonicalMs = 0;
  liveCanonicalDabs = 0;
  cpuCompositeMs = 0;
  cpuCompositeTiles = 0;
  cpuCompositePixels = 0;
  commandEncoders = 0;
  gpuSubmissions = 0;
  presentations = 0;
  renderedDabs = 0;
  dirtyPixels = 0;
  presentedPixels = 0;
  fullSurfaceCopies = 0;
  snapshot() {
    return Object.freeze({ ...this });
  }
}
