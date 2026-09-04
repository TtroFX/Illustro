from pathlib import Path

path = Path('.github/m6a-065-apply-once.py')
source = path.read_text(encoding='utf-8')
old = '''anchor = """      const localX = (documentX + 0.5 - dab.x) / radiusX;\\n      const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);\\n"""\ncount = text.count(anchor)\nif count != 2:\n    raise SystemExit(f'src/gpu/baseline-raster-tile-store.ts: expected two paint loop anchors, found {count}')\ntext = text.replace(\n    anchor,\n    """      if (referenceClip !== null && !referenceClipAllowsPixelV1(referenceClip, documentX, documentY)) {\\n        continue;\\n      }\\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\\n      const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);\\n""",\n    2,\n)\n'''
new = '''pattern = re.compile(\n    r"(?m)^(\\s*)const localX = \\(documentX \\+ 0\\.5 - dab\\.x\\) / radiusX;\\n\\1const tipCoverage = baselineProceduralTipCoverageV1\\(dab, localX, localY\\);"\n)\ndef add_reference_clip(match: re.Match[str]) -> str:\n    indent = match.group(1)\n    return (\n        f"{indent}if (referenceClip !== null && !referenceClipAllowsPixelV1(referenceClip, documentX, documentY)) {{\\n"\n        f"{indent}  continue;\\n"\n        f"{indent}}}\\n"\n        f"{indent}const localX = (documentX + 0.5 - dab.x) / radiusX;\\n"\n        f"{indent}const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);"\n    )\ntext, count = pattern.subn(add_reference_clip, text)\nif count != 2:\n    raise SystemExit(f'src/gpu/baseline-raster-tile-store.ts: expected two paint loop anchors, found {count}')\n'''
if source.count(old) != 1:
    raise SystemExit(f'wrapper could not identify original paint-loop patch block: {source.count(old)}')
source = 'import re\n' + source.replace(old, new, 1)
exec(compile(source, str(path), 'exec'), {'__name__': '__main__'})
