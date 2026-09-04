from pathlib import Path

bootstrap = Path('.github/m6a-064-apply-once.py').read_text(encoding='utf-8')
old = """replace_once(\n    'src/app/color-workflow-controller.ts',\n    '    input.paintSession.setPaintColor(state.current);\\n',\n    '    input.paintSession.setPaintColor(state.current);\\n    input.paintSession.setPaintSubColor(state.previous);\\n',\n)\n"""
new = """replace_once(\n    'src/app/color-workflow-controller.ts',\n    '    input.paintSession.setPaintColor(state.current);\\n    input.root.dataset.illustroCurrentColor = formatHexRgbV1(state.current);\\n',\n    '    input.paintSession.setPaintColor(state.current);\\n    input.paintSession.setPaintSubColor(state.previous);\\n    input.root.dataset.illustroCurrentColor = formatHexRgbV1(state.current);\\n',\n)\n"""
if bootstrap.count(old) != 1:
    raise SystemExit(f'unexpected M6A-064 color-workflow bootstrap anchor count: {bootstrap.count(old)}')
exec(compile(bootstrap.replace(old, new, 1), '<m6a064-fixed>', 'exec'))
