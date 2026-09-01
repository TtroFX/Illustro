from pathlib import Path

path = Path('scripts/implement-m5b-rasterize.py')
text = path.read_text()
replacements = [
    (
        '    "  \\\"\'layer.mergeDown\'\\\",\\n  \'prepareRasterMergeDownV1\',",\n    "  \\\"\'layer.mergeDown\'\\\",\\n  \\\"\'layer.rasterize\'\\\",\\n  \'prepareRasterMergeDownV1\',\\n  \'prepareLayerRasterizeV1\',",',
        '    "  \\\"\'layer.mergeVisibleCopy\'\\\",\\n  \'prepareRasterMergeDownV1\',\\n  \'prepareRasterMergeVisibleCopyV1\',",\n    "  \\\"\'layer.mergeVisibleCopy\'\\\",\\n  \\\"\'layer.rasterize\'\\\",\\n  \'prepareRasterMergeDownV1\',\\n  \'prepareRasterMergeVisibleCopyV1\',\\n  \'prepareLayerRasterizeV1\',",',
    ),
    (
        '    "  \'id=\\\"layer-merge-down\\\"\',\\n  \'id=\\\"layer-rename\\\"\',",\n    "  \'id=\\\"layer-merge-down\\\"\',\\n  \'id=\\\"layer-rasterize\\\"\',\\n  \'id=\\\"layer-rename\\\"\',",',
        '    "  \'id=\\\"layer-merge-visible-copy\\\"\',\\n  \'id=\\\"layer-rename\\\"\',",\n    "  \'id=\\\"layer-merge-visible-copy\\\"\',\\n  \'id=\\\"layer-rasterize\\\"\',\\n  \'id=\\\"layer-rename\\\"\',",',
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'patch correction anchor missing: {old[:120]!r}')
    text = text.replace(old, new, 1)
path.write_text(text)
