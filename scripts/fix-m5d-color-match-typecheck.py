from pathlib import Path

path = Path('src/app/color-match.ts')
text = path.read_text()
replacements = [
    (
        '    accumulator.sum[channel] += value * weight;\n    accumulator.sumSquares[channel] += value * value * weight;\n',
        '    accumulator.sum[channel] = (accumulator.sum[channel] ?? 0) + value * weight;\n    accumulator.sumSquares[channel] =\n      (accumulator.sumSquares[channel] ?? 0) + value * value * weight;\n',
    ),
    (
        '      accumulator.sum[channel] += mean * weight;\n      accumulator.sumSquares[channel] += (stddev * stddev + mean * mean) * weight;\n',
        '      accumulator.sum[channel] = (accumulator.sum[channel] ?? 0) + mean * weight;\n      accumulator.sumSquares[channel] =\n        (accumulator.sumSquares[channel] ?? 0) + (stddev * stddev + mean * mean) * weight;\n',
    ),
]
for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise SystemExit(f'typecheck fix anchor not found: {old!r}')
path.write_text(text)
print('Color Match strict indexing fixed')
