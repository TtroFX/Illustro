from pathlib import Path

path = Path('scripts/apply-m6a-eraser.py')
text = path.read_text()

old_html = '<div class="shell-rail-slots" aria-label="描画ツール">'
new_html = '<div class="shell-rail-slots" role="group" aria-label="描画ツール">'
if old_html not in text:
    raise RuntimeError('M6A Eraser tool-rail accessibility anchor not found')
text = text.replace(old_html, new_html, 1)

old_verifier = "requireText('src/index.html', 'id=\\\\\\\"brush-mode-eraser\\\\\\\"', 'reachable Eraser control missing');"
new_verifier = "requireText('src/index.html', 'id=\\\"brush-mode-eraser\\\"', 'reachable Eraser control missing');"
if old_verifier not in text:
    raise RuntimeError('M6A Eraser verifier quote anchor not found')
text = text.replace(old_verifier, new_verifier, 1)

path.write_text(text)
