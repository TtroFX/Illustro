from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"expected one anchor in {path}, found {count}: {before[:140]!r}")
    p.write_text(text.replace(before, after, 1))


verify_path = Path("scripts/verify-m5b-layer-foundation.mjs")
verify = verify_path.read_text()
marker = "console.log('M5B layer system verification passed');"
if verify.count(marker) != 1:
    raise SystemExit("M5B verifier completion marker missing")
additions = r'''requireText('src/app/layer-role-flags.ts', [
  'setReferenceLayerSnapshotV1',
  'setDraftLayerSnapshotV1',
  "'reference'",
  "'draft'",
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'#layer-reference'",
  "'#layer-draft'",
  "'layer.reference.designate'",
  "'layer.reference.release'",
  "'layer.draft.enable'",
  "'layer.draft.disable'",
]);
requireText('src/index.html', ['id="layer-reference"', 'id="layer-draft"']);
requireText('src/gpu/baseline-raster-tile-store.ts', [
  'readonly draft?: boolean',
  'readonly includeDraft?: boolean',
  'layer.draft !== true',
]);
requireText('src/app/paint-session-controller.ts', ['draft: layer.roleFlags.draft']);
requireText('src/app/renderer-controller.ts', ['includeDraft: false']);
requireText('src/workers/render.worker.ts', ['includeDraft?: boolean', 'includeDraft: request.includeDraft ?? true']);
requireText('src/domain/special-layers.ts', [
  'createLinkedObjectLayer',
  'embeddedSnapshot: DocumentV1',
  'externalSource: LinkedObjectExternalSourceV1 | null',
]);
requireText('tests/unit/linked-object-canonical.test.ts', [
  'canonical embedded representation',
  'serializeJson',
  'externalSource',
]);
'''
verify_path.write_text(verify.replace(marker, additions + marker, 1))

progress_path = Path("IMPLEMENTATION_PROGRESS.md")
progress = progress_path.read_text()
replacements = {
    "M5B-045 Reference Layer designation:未完了": "M5B-045 Reference Layer designation:完了",
    "M5B-046 Reference Layer解除:未完了": "M5B-046 Reference Layer解除:完了",
    "M5B-047 Draft/Sketch Layer attribute:未完了": "M5B-047 Draft/Sketch Layer attribute:完了",
    "M5B-048 Draftをfinal outputから除外:未完了": "M5B-048 Draftをfinal outputから除外:完了",
    "M5B-049 Linked Object embedded snapshot:未完了": "M5B-049 Linked Object embedded snapshot:完了",
    "M5B-050 Linked Object canonical embedded representation:未完了": "M5B-050 Linked Object canonical embedded representation:完了",
    "M5B-検査 M5B内部検査:未完了": "M5B-検査 M5B内部検査:完了",
    "M5B-043/044 Mask↔Selection conversionまで完了しており、次はM5B-045 Reference Layer designationから再開する。":
        "M5B-045〜050 Reference/Draft roles・Draft final-output除外・Linked Object canonical embedded snapshotまで完了。次はM5C-001 Normal blend modeから再開する。",
}
for before, after in replacements.items():
    if progress.count(before) != 1:
        raise SystemExit(f"expected one progress anchor: {before}")
    progress = progress.replace(before, after, 1)
progress_path.write_text(progress)
