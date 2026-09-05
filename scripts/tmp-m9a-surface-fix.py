from pathlib import Path

p = Path('src/app/m9a-library-surface.ts')
s = p.read_text()
s = s.replace(
    "for (const button of surface.querySelectorAll<HTMLButtonElement>('[data-section]')) {",
    "for (const button of Array.from(\n        surface.querySelectorAll<HTMLButtonElement>('[data-section]'),\n      )) {",
)
s = s.replace(
    "for (const button of surface.querySelectorAll<HTMLButtonElement>('[data-m9a-view]')) {",
    "for (const button of Array.from(\n      surface.querySelectorAll<HTMLButtonElement>('[data-m9a-view]'),\n    )) {",
)
s = s.replace("      if (section === 'import') return;\n", "")
p.write_text(s)
