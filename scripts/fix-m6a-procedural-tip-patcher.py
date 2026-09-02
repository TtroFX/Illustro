from pathlib import Path

p = Path('scripts/apply-m6a-procedural-tip.py')
text = p.read_text()
old_anchor = '''    "        opacity: candidate.opacity,\\n        ...(color === undefined ? {} : { color }),",'''
new_anchor = '''    "        opacity: candidate.opacity,\\n        ...(flow === undefined ? {} : { flow }),\\n        ...(strokeOpacity === undefined ? {} : { strokeOpacity }),\\n        ...(color === undefined ? {} : { color }),",'''
old_replacement = '''    "        opacity: candidate.opacity,\\n        ...(tipShape === undefined ? {} : { tipShape }),\\n        ...(color === undefined ? {} : { color }),",'''
new_replacement = '''    "        opacity: candidate.opacity,\\n        ...(flow === undefined ? {} : { flow }),\\n        ...(strokeOpacity === undefined ? {} : { strokeOpacity }),\\n        ...(tipShape === undefined ? {} : { tipShape }),\\n        ...(color === undefined ? {} : { color }),",'''
if old_anchor not in text or old_replacement not in text:
    raise RuntimeError('procedural tip worker patch anchor not found')
text = text.replace(old_anchor, new_anchor, 1).replace(old_replacement, new_replacement, 1)
p.write_text(text)
print('procedural tip patcher worker anchor fixed')
