from pathlib import Path

source = Path('src/app/m9a-library-surface.ts')
s = source.read_text()

old = '<button type="button" class="m9a-library-button" data-m9a-return hidden>エディターへ戻る</button>'
new = '<button type="button" class="m9a-library-button" data-m9a-return>キャンバスへ</button>'
if old not in s:
    raise SystemExit('Library return button template changed; refusing blind patch')
s = s.replace(old, new, 1)

old = '    returnButton.hidden = !options.canReturnToEditor();\n'
new = """    const hasActiveEditor = options.canReturnToEditor();
    returnButton.hidden = false;
    returnButton.textContent = hasActiveEditor ? 'エディターへ戻る' : 'キャンバスへ';
"""
if old not in s:
    raise SystemExit('Library return visibility rule changed; refusing blind patch')
s = s.replace(old, new, 1)

old = """    if (target?.closest('[data-m9a-return]') && options.canReturnToEditor()) {
      options.productShell.hideLibrary();
    }
"""
new = """    if (target?.closest('[data-m9a-return]')) {
      options.productShell.hideLibrary();
    }
"""
if old not in s:
    raise SystemExit('Library return click rule changed; refusing blind patch')
s = s.replace(old, new, 1)
source.write_text(s)

test = Path('tests/unit/m9a-library-production.test.ts')
t = test.read_text()
marker = "  it('routes New and Open through canonical production persistence rather than mock state', () => {\n"
addition = """  it('always keeps a route from Library back to the Canvas surface', () => {
    expect(librarySource).toContain('data-m9a-return>キャンバスへ</button>');
    expect(librarySource).toContain('returnButton.hidden = false');
    expect(librarySource).toContain(
      \"returnButton.textContent = hasActiveEditor ? 'エディターへ戻る' : 'キャンバスへ'\",
    );
    expect(librarySource).toContain(\"if (target?.closest('[data-m9a-return]'))\");
    expect(librarySource).not.toContain(
      \"target?.closest('[data-m9a-return]') && options.canReturnToEditor()\",
    );
  });

"""
if marker not in t:
    raise SystemExit('M9A test insertion point changed; refusing blind patch')
t = t.replace(marker, addition + marker, 1)
test.write_text(t)
