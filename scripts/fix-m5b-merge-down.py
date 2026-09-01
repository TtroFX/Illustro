from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:100]}')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly bakedToRasterLayer: boolean;\n}',
    '  readonly bakedToRasterLayer?: boolean;\n}',
)
replace_once(
    'src/app/layer-raster-merge.ts',
    '  const reason = compatibleRasterLayer(source) ?? compatibleRasterLayer(target);',
    '  const sourceRaster = source as RasterLayerV1;\n  const targetRaster = target as RasterLayerV1;\n  const reason = compatibleRasterLayer(sourceRaster) ?? compatibleRasterLayer(targetRaster);',
)
