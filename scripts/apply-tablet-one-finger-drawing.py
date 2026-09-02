from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, got {count}')
    file.write_text(text.replace(before, after, 1))

replace_once(
    'src/input/input-arbitration.ts',
    "function defaultFingerDrawingEnabledV1(): boolean {\n  if (typeof globalThis.matchMedia !== 'function') return false;\n  return globalThis.matchMedia('(max-width: 799px) and (pointer: coarse)').matches;\n}\n",
    "function defaultFingerDrawingEnabledV1(): boolean {\n  return true;\n}\n",
)

replace_once(
    'tests/unit/input-arbitration.test.ts',
    "  it('keeps touch in navigation mode by default and does not forward it to the drawing transport', () => {\n    const arbitration = new PointerInputArbitrationV1({ fingerDrawingEnabled: false });\n",
    "  it('routes one-finger touch to the active tool by default regardless of viewport width', () => {\n    const arbitration = new PointerInputArbitrationV1();\n    const decision = arbitration.route(batch(sample('touch', 'pointerdown', { timestampMs: 1000 })));\n    expect(decision).toMatchObject({\n      disposition: 'tool',\n      reason: 'touch-finger-drawing',\n      cancelToolPointerIds: [],\n    });\n    expect(decision.forwardBatch?.confirmed.at(-1)?.source).toBe('mouse');\n    expect(arbitration.snapshot().fingerDrawingEnabled).toBe(true);\n  });\n\n  it('keeps touch in navigation mode when finger drawing is explicitly disabled', () => {\n    const arbitration = new PointerInputArbitrationV1({ fingerDrawingEnabled: false });\n",
)

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
text = memo.read_text()
marker = '#### Touch drawing default — 2026-09-02'
if marker not in text:
    text += "\n\n#### Touch drawing default — 2026-09-02\n\n- Canvas touch arbitration is device-size independent: one touch contact defaults to the active drawing tool on phones and tablets alike.\n- A second simultaneous touch cancels any active one-finger drawing transaction before promoting the touch set to canvas navigation (pan/zoom/rotate); three or more touches must never continue the one-finger paint transaction.\n- Pen input keeps priority and existing palm/recent-pen rejection remains authoritative. An explicit workspace/input setting may disable finger drawing, in which case touch remains navigation-only.\n"
    memo.write_text(text)
