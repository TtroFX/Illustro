from pathlib import Path

path = Path('scripts/.tmp-implement-m5b-folder-pass-through.py')
text = path.read_text()
old_anchor = '''    "    groupedTransformButton.title =\\n      groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形';\\n    deleteButton.disabled",'''
new_anchor = '''    "    groupedTransformButton.title =\\n      folderTransformEligibility?.eligible === true\\n        ? 'フォルダをまとめて変形'\\n        : (groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形');\\n    deleteButton.disabled",'''
old_replacement = '''    "    groupedTransformButton.title =\\n      groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形';\\n    const passThroughEligibility ='''
new_replacement = '''    "    groupedTransformButton.title =\\n      folderTransformEligibility?.eligible === true\\n        ? 'フォルダをまとめて変形'\\n        : (groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形');\\n    const passThroughEligibility ='''
if text.count(old_anchor) != 1:
    raise SystemExit(f'old pass-through anchor count: {text.count(old_anchor)}')
if text.count(old_replacement) != 1:
    raise SystemExit(f'old pass-through replacement count: {text.count(old_replacement)}')
path.write_text(text.replace(old_anchor, new_anchor, 1).replace(old_replacement, new_replacement, 1))
