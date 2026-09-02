from pathlib import Path

path = Path('scripts/apply-m5d-color-helper.py')
text = path.read_text()

replacements = [
    (
        "html_anchor = dedent(r'''            </details>\n          </section>\n          <section class=\"shell-inspector-card shell-reference-panel\" aria-label=\"Reference / Sub View\">\n''')",
        "html_anchor = '            </details>\\n          </section>\\n          <section class=\"shell-inspector-card shell-reference-panel\" aria-label=\"Reference / Sub View\">\\n'",
    ),
    (
        "  let colorHelperWorkingSpace = workingSpace();\\n",
        "  let colorHelperWorkingSpace = input.paintSession.currentDocument()?.color.workingSpace ?? 'srgb';\\n",
    ),
    (
        '<div class=\"shell-color-helper-tabs\" role=\"group\" aria-label=\"色候補モード\">',
        '<fieldset class=\"shell-color-helper-tabs\" aria-label=\"色候補モード\">',
    ),
    (
        '<button id=\"color-helper-approximate-tab\" type=\"button\" aria-pressed=\"false\">近似</button>\n                </div>',
        '<button id=\"color-helper-approximate-tab\" type=\"button\" aria-pressed=\"false\">近似</button>\n                </fieldset>',
    ),
    (
        '<div class=\"shell-color-intermediate-corners\" aria-label=\"4隅の登録色\">',
        '<div class=\"shell-color-intermediate-corners\">',
    ),
]

for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise SystemExit(f'fix anchor not found: {old[:100]!r}')

path.write_text(text)
