from pathlib import Path

path = Path('ILLUSTRO_DESIGN_MEMO.md')
text = path.read_text()
old = '''#### Touch drawing default — 2026-09-02

- Canvas touch arbitration is device-size independent: one touch contact defaults to the active drawing tool on phones and tablets alike.
- A second simultaneous touch cancels any active one-finger drawing transaction before promoting the touch set to canvas navigation (pan/zoom/rotate); three or more touches must never continue the one-finger paint transaction.
- Pen input keeps priority and existing palm/recent-pen rejection remains authoritative. An explicit workspace/input setting may disable finger drawing, in which case touch remains navigation-only.
'''
new = '''## Unified touch drawing ownership supersession — 2026-09-02

**Status: AUTHORITATIVE / DESIGN CHANGE / SUPERSESSION.**

This section supersedes earlier P2-6 / FG-1 wording that assigned one-finger Touch to Pan/navigation by default on the basis of device class, pen capability, viewport width or coarse-pointer media queries. It also supersedes the phone-only limitation that previously left wider tablet/desktop-class full-editor surfaces on the older Touch=Pan default.

1. **One Touch draws by default on every full-editor canvas.** When Touch events are delivered, no active Pen transaction owns the canvas, and palm-rejection rules do not reject the contact, the first Touch contact is routed to the active drawing-capable tool. This default must not depend on viewport width, orientation, phone/tablet classification, `(pointer: coarse)`, or a maximum-width media query.
2. **The second Touch transfers ownership atomically to navigation.** Arrival of a second simultaneous Touch cancels the provisional one-finger drawing transaction before multi-touch navigation takes ownership. The ownership transition must not leave a partial committed stroke behind.
3. **Two or more Touch contacts are navigation-only for that Touch transaction.** Pan/Zoom/Rotate use the existing viewport navigation path, and the first contact must not resume painting until the multi-touch transaction has fully ended and a later new one-finger transaction begins.
4. **Pen and palm rejection retain precedence.** Active Pen contact and the existing recent-Pen/large-contact palm-rejection rules outrank finger drawing. This change does not weaken application-side palm rejection or alter Pen drawing semantics.
5. **Explicit Finger Drawing disable remains supported.** A user/workspace input setting may disable Finger Drawing; when explicitly disabled, one-finger Touch may remain navigation-only. The production default, however, is Finger Drawing enabled.
6. **Input adaptation does not change document semantics.** Touch may be translated at the input/tool boundary into the existing active-tool contract. Canonical Raster Tile state, Tile History, Undo/Redo, persistence/recovery, export and brush output semantics remain unchanged.
7. **Regression verification is mandatory.** Tests must cover default one-finger drawing without viewport/device media-query dependence, explicit Finger Drawing disable, and second-touch cancellation before multi-touch navigation.

### Supersession note

The older rules stating `Touch = canvas navigation/UI by default`, `one-finger canvas drag → Pan`, or that wider Pen-capable tablet/desktop surfaces keep Finger Drawing disabled by default are historical where they conflict with this section. The current canonical default is **one Touch = active drawing tool; two or more Touch contacts = canvas navigation after atomic stroke cancellation**.
'''
if new in text:
    raise SystemExit('touch supersession already applied')
if old not in text:
    raise SystemExit('expected touch-default block not found')
path.write_text(text.replace(old, new, 1))
