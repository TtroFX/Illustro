from pathlib import Path

path = Path('.github/m6a-065-apply-once.py')
source = path.read_text(encoding='utf-8')
start_marker = '# There are exactly two paint loops (rgba8 and rgba16) with this local-X anchor.\n'
end_marker = "path.write_text(text, encoding='utf-8')\n"
start = source.find(start_marker)
if start < 0:
    raise SystemExit('wrapper could not find paint-loop patch start marker')
end_start = source.find(end_marker, start)
if end_start < 0:
    raise SystemExit('wrapper could not find paint-loop patch end marker')
end = end_start + len(end_marker)
replacement = '''# There are exactly two paint loops (rgba8 and rgba16); match their indentation independently.\npath = Path('src/gpu/baseline-raster-tile-store.ts')\ntext = path.read_text(encoding='utf-8')\npattern = re.compile(\n    r"(?m)^(\\s*)const localX = \\(documentX \\+ 0\\.5 - dab\\.x\\) / radiusX;\\n\\1const tipCoverage = baselineProceduralTipCoverageV1\\(dab, localX, localY\\);"\n)\ndef add_reference_clip(match: re.Match[str]) -> str:\n    indent = match.group(1)\n    return (\n        f"{indent}if (referenceClip !== null && !referenceClipAllowsPixelV1(referenceClip, documentX, documentY)) {{\\n"\n        f"{indent}  continue;\\n"\n        f"{indent}}}\\n"\n        f"{indent}const localX = (documentX + 0.5 - dab.x) / radiusX;\\n"\n        f"{indent}const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);"\n    )\ntext, count = pattern.subn(add_reference_clip, text)\nif count != 2:\n    raise SystemExit(f'src/gpu/baseline-raster-tile-store.ts: expected two paint loop anchors, found {count}')\npath.write_text(text, encoding='utf-8')\n'''
source = source[:start] + replacement + source[end:]
source = source.replace(
    "        ...(layer.draft === true ? { draft: true } : {}),\\n",
    "        draft: layer.draft ?? false,\\n",
)
source = 'import re\n' + source
exec(compile(source, str(path), 'exec'), {'__name__': '__main__'})
