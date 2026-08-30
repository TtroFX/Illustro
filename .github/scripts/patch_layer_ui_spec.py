from pathlib import Path

path = Path("ILLUSTRO_DESIGN_MEMO.md")
text = path.read_text(encoding="utf-8")

old_layers_block = """### Layers block

- The layer tree shows identity/state needed for scanning: visibility, thumbnail/type, name and compact state indicators.
- Blend, opacity, locks, clipping/mask/reference metadata and other detailed values belong in **Layer Properties**, preventing layer rows from becoming control dashboards.
- Layer/folder ordering is direct drag manipulation.
"""

new_layers_block = """### Layers block

- The layer tree is **scan-first and compact**: each row shows visibility, thumbnail/type, name and only the minimum state needed to identify the layer quickly.
- A selected layer **must not expand vertically into an inline settings card**. Routine selection therefore preserves list density and keeps many layers visible at once.
- The **right side inside each individual layer row is reserved for exactly two direct controls: Blend Mode and Clipping**. These controls belong to that row rather than to a separate Layer Properties navigation step.
- Blend Mode and Clipping use a **symbol/icon-first presentation**. Permanent long text such as `Multiply` or `Clipping` is not shown in the row. Exact icon geometry is defined by the canonical icon system; active/non-default state must remain visually distinguishable without relying on color alone.
- **Clipping is a one-tap row toggle**. The control gives immediate local state feedback and invokes the same canonical document command/Undo path as any other clipping command surface.
- **Blend Mode opens a compact popover/menu anchored to the row control**. The full localized blend-mode name and current value are available inside that popover and through tooltip/focus/accessibility labeling; the layer row itself remains symbol-first.
- All other selected-layer settings — including **Rename, Opacity, Lock, Alpha Lock, Mask operations, Effects entry points, metadata and other lower-frequency properties** — stay out of the row body. They are operated from a **separate selected-layer action/settings area associated with the Layers block**, spatially separated from the scrolling layer rows. The canonical default is a compact fixed footer below the layer list; responsive layouts may place the same area above the list when that better preserves usable workspace, but it must remain bound to the current selection and must not make the selected row taller.
- The selected-layer action/settings area is also **symbol/icon-first**. Controls that need values or lists open compact contextual popovers/sheets rather than permanently consuming vertical space. Rename has an explicit icon-driven action; an accelerated direct-name edit gesture may additionally exist if it does not create accidental renames.
- **Layer Properties is retained only as the deeper/secondary inspector for detailed or type-specific layer properties and as an accessible alternate path where appropriate. It is not the primary path for Blend Mode or Clipping.** High-frequency layer editing should not require leaving the Layers block.
- Layer/folder ordering remains direct drag manipulation.
- Every symbol-only control must expose a localized tooltip/focus label and semantic accessible name. Symbol-first presentation must not reduce keyboard, screen-reader or discoverability support.
"""

block_count = text.count(old_layers_block)
if block_count == 0:
    raise SystemExit("Expected legacy Layers block wording was not found; refusing silent patch.")
text = text.replace(old_layers_block, new_layers_block)

replacements = {
    "5. **Layers** — hierarchy, visibility, selection, reorder, grouping, clipping/reference/draft state and layer-type creation entry points.":
    "5. **Layers** — hierarchy, visibility, selection, reorder and grouping, plus compact per-row symbol controls for Blend Mode and Clipping and a separate symbol-first selected-layer action/settings area.",
    "6. **Layer Properties** — opacity/blend/locks, masks/clipping/reference properties, transforms/metadata and type-specific properties.":
    "6. **Layer Properties** — deeper/secondary selected-layer inspection for detailed or type-specific properties, transforms and metadata; Blend Mode and Clipping remain directly operable from the corresponding layer row.",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"Expected inspector inventory wording not found: {old}")
    text = text.replace(old, new)

old_editing = "Reorder/group/clipping/mask/reference changes are direct document commands and Undoable where semantically appropriate. Delete uses Undo as the primary recovery mechanism; confirmation is required only when deletion would cross an irreversible boundary not covered by history/storage policy."
new_editing = "Reorder/group/mask/reference changes are direct document commands and Undoable where semantically appropriate. **Blend Mode and Clipping are directly operable from the symbol controls inside the affected layer row; Clipping is a one-tap toggle and Blend Mode opens a row-anchored compact chooser.** Delete uses Undo as the primary recovery mechanism; confirmation is required only when deletion would cross an irreversible boundary not covered by history/storage policy."
if old_editing not in text:
    raise SystemExit("Expected Layer creation/editing wording was not found.")
text = text.replace(old_editing, new_editing)

marker = "<!-- ILLUSTRO-LAYER-ROW-DIRECT-CONTROLS-2026-08-30 -->"
if marker not in text:
    text += """

<!-- ILLUSTRO-LAYER-ROW-DIRECT-CONTROLS-2026-08-30 -->
## Layer-list compact interaction revision — 2026-08-30 — AUTHORITATIVE

**Status: AUTHORITATIVE.** This controlled post-freeze revision supersedes earlier UI-placement statements that put Blend Mode, Clipping and all other detailed layer values exclusively in **Layer Properties**.

Canonical interaction rule:

1. Layer rows remain compact and do not expand merely because they are selected.
2. The **right side inside each layer row contains the direct Blend Mode control and direct Clipping control**.
3. These row controls are **symbol/icon-first**; Clipping toggles in one action, while Blend Mode opens a compact chooser anchored to that row.
4. Other selected-layer operations, including Rename and the rest of the layer settings, are surfaced through a **separate symbol-first selected-layer action/settings area** associated with the Layers block rather than being stacked vertically inside each row.
5. Layer Properties remains available for deeper/type-specific detail and accessibility/alternate access, but it no longer owns the primary Blend Mode or Clipping workflow.
6. Text labels remain available where needed in popovers, tooltips, keyboard/focus surfaces and accessibility semantics; the compact persistent layer-list chrome remains predominantly symbolic.
7. This revision changes UI placement and interaction density only. It does **not** change the canonical layer data model, Command Registry semantics, Undo/Redo requirements, blend mathematics, clipping semantics or persistence requirements.
8. Exact final glyph geometry, spacing and visual styling must still follow the canonical visual reference and iconography rules; no generated exploratory mockup becomes a canonical visual asset merely because this interaction revision is adopted.

**Superseded rule:** the earlier statement that Blend, opacity, locks, clipping/mask/reference metadata and all detailed values belong in Layer Properties is no longer authoritative. The current rule is the compact per-row Blend/Clipping model above.
"""

path.write_text(text, encoding="utf-8")
print(f"Replaced {block_count} legacy Layers block occurrence(s) and applied authoritative supersession.")
