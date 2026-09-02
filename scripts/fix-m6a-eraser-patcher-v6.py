from pathlib import Path

path = Path('tests/unit/canonical-raster-brush.test.ts')
text = path.read_text()
old = """  it('exposes Raster as the only implemented canonical brush mode', () => {
    expect(isImplementedCanonicalBrushModeV1('raster')).toBe(true);
    expect(isImplementedCanonicalBrushModeV1('eraser')).toBe(false);
    expect(requireImplementedCanonicalBrushModeV1('raster')).toBe('raster');
    expect(() => requireImplementedCanonicalBrushModeV1('eraser')).toThrow(/not implemented/);
  });
"""
new = """  it('exposes Raster and Eraser as implemented canonical brush modes', () => {
    expect(isImplementedCanonicalBrushModeV1('raster')).toBe(true);
    expect(isImplementedCanonicalBrushModeV1('eraser')).toBe(true);
    expect(requireImplementedCanonicalBrushModeV1('raster')).toBe('raster');
    expect(requireImplementedCanonicalBrushModeV1('eraser')).toBe('eraser');
  });
"""
if old not in text:
    raise RuntimeError('M6A canonical brush mode expectation anchor not found')
path.write_text(text.replace(old, new, 1))
