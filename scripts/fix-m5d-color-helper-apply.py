from pathlib import Path

path = Path('scripts/apply-m5d-color-helper.py')
text = path.read_text()
old = "html_anchor = dedent(r'''            </details>\n          </section>\n          <section class=\"shell-inspector-card shell-reference-panel\" aria-label=\"Reference / Sub View\">\n''')"
new = "html_anchor = '            </details>\\n          </section>\\n          <section class=\"shell-inspector-card shell-reference-panel\" aria-label=\"Reference / Sub View\">\\n'"
if old not in text:
    raise SystemExit('html anchor definition not found')
path.write_text(text.replace(old, new, 1))
