from pathlib import Path

path = Path('scripts/integrate-m8d-once.py')
text = path.read_text()
old = """def replace_once(text: str, old: str, new: str, label: str) -> str:\n    if old not in text:\n        raise SystemExit(f'missing patch anchor: {label}')\n    return text.replace(old, new, 1)\n"""
new = """def replace_once(text: str, old: str, new: str, label: str) -> str:\n    if old in text:\n        return text.replace(old, new, 1)\n    if new in text:\n        return text\n    raise SystemExit(f'missing patch anchor: {label}')\n"""
if old not in text and new not in text:
    raise SystemExit('replace_once helper shape changed unexpectedly')
if old in text:
    path.write_text(text.replace(old, new, 1))
