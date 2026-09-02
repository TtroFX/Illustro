# Illustro Master Design Memo

This single Markdown file is the **canonical design/specification source of truth** for the Illustro rebuild.

## Status

- Rebuild mode: clean-sheet / from zero
- Repository: `TtroFX/Illustro`
- Active branch: `main`
- Canonical specification file: `ILLUSTRO_DESIGN_MEMO.md`

## Canonical-document rule

Illustroの設計・仕様に関する正本は、この1つの `.md` に統合する。

別々のJSONや複数の仕様書を正本として運用しない。今後このチャットで確定した事項は、必要に応じてこのファイルの該当セクションへ逐次反映する。

このファイルに統合する対象は、少なくとも以下を含む。

- Product definition / product principles
- Target users / target devices / platform policy
- Functional requirements / feature inventory
- UX / information architecture / interaction design
- Visual design system / UI layout / color / typography / iconography
- Canvas / document model
- Brush / stroke / eraser / color architecture
- Layer / folder / mask / clipping / blending model
- Selection / transform / fill / lineart / text / shape systems
- Command model / Undo / Redo / history
- Renderer / compositor / tile architecture / WebGPU / fallback
- Worker / scheduling / caching / memory policy
- Persistence / autosave / recovery / OPFS
- `.illustro` file format
- Import / export
- Materials / reference / Sub View and other production tools
- Performance targets and limits
- PWA / offline / update behavior
- Accessibility / input / pen / touch / keyboard
- Error handling and recovery behavior
- Asset strategy
- Testing / verification / completion gates
- Implementation stages / roadmap
- Release criteria
- Confirmed design decisions and supersession history

補助ファイル・テストデータ・生成物・コード内schemaは将来存在してよいが、**設計上の意味・原則・判断の正本は必ずこのMarkdownへ戻す**。

## Confirmed decisions

### 2026-08-30

1. Illustro will be rebuilt from scratch.
2. The previous codebase and previous architecture are not to be used as the implementation base.
3. The previous design/specification is not authoritative for the rebuild.
4. Old Illustro materials may be consulted only as reference, lessons learned, or candidate requirements; they do not constrain the new design unless explicitly re-adopted.
5. The design itself will be redone from zero before implementation proceeds.
6. A persistent design memo must be maintained in Git. Decisions made during design discussions are to be recorded here as they are confirmed, so that important decisions do not exist only in chat history.
7. The latest approved UI mockup is adopted as the **provisional visual completion target**. It is authoritative for visual direction and layout atmosphere, but not for the exact feature/button inventory; unnecessary or incorrect controls shown in the mockup may be removed during specification.
8. Product, UX, UI, technical architecture, data model, file format, performance, testing, roadmap, and release design are **not to be split into separate canonical specification files**. They are all maintained in this one Markdown document.
9. The latest approved generated UI image itself is preserved as a canonical visual-reference asset. UI implementation must inspect the actual image, not rely on prose alone.
10. Illustro is a **single-illustration-focused painting application**. Its functional baseline is all ibisPaint functionality that is relevant to producing a single illustration, subject to explicit exclusions recorded in this memo, rather than comic/page-production or content-distribution workflows.
11. Functional scope is not considered complete at a minimal/basic editor milestone. After reaching the adopted ibisPaint single-illustration baseline, Illustro will additionally adopt useful painting/productivity capabilities from CLIP STUDIO PAINT and other paid or free creative applications when they materially improve a single-illustration workflow and remain technically proportionate.
12. Comic-specific panel/page-production features and built-in material/content-library functionality are outside the required completion scope unless a later explicit decision re-adopts an individual capability because it is useful for single-illustration work.
13. **Feature implementation is complete only when the adopted single-illustration feature inventory has been systematically audited, implemented, and verified, with any intentionally excluded reference-app features recorded explicitly rather than silently omitted.**
14. Illustro's primary application architecture is **Web/PWA-first over HTTPS**, with the exact minimum browser/device support matrix to be fixed separately.
15. Rendering and GPU compute are **WebGPU-first**. WebGPU is the primary accelerator for brush rendering, layer compositing, masks, transforms, filters, and other image-processing work; document correctness and persistence must not depend on GPU state.
16. Heavy rendering, storage, and CPU-compute work should be moved off the main thread through **Dedicated Web Workers**. The main thread is reserved primarily for UI, DOM integration, and input coordination.
17. **SharedArrayBuffer + Atomics** are adopted for low-latency bounded shared-memory queues where they provide a measurable benefit, with cross-origin isolation treated as part of the production deployment contract.
18. **Transferable objects** are the default for ownership-moving data such as `ArrayBuffer`, `ImageBitmap`, and `OffscreenCanvas`; avoid unnecessary structured-clone copies of large image data.
19. The working persistence layer is **OPFS**, with `FileSystemSyncAccessHandle` used inside Dedicated Workers where appropriate for high-throughput random/synchronous file access.
20. Runtime capability detection is mandatory. Optional GPU/input capabilities are enabled only when supported, and compatibility behavior must degrade by capability rather than making the entire editor unusable.
21. Large documents use a **sparse tiled canvas architecture** rather than a single giant CPU/GPU bitmap or texture. Exact tile dimensions and cache budgets remain benchmark-driven decisions.
22. The color/rendering architecture must not hard-code an 8-bit sRGB-only future: it must support **sRGB and Display-P3** and permit **RGBA8 and RGBA16F-class** internal/render targets where the selected document mode and device capability justify them.
23. CPU-heavy algorithms must be implementable behind a compute abstraction that can use **WebAssembly, SIMD, and threads** when profiling shows a real benefit; the application is not to be rewritten wholesale in WASM merely for theoretical speed.
24. Cross-tab/project coordination uses **Web Locks** for write ownership and **BroadcastChannel** for same-origin status/event propagation.
25. Input processing is Pointer Events based and should consume the richest supported pen data, including pressure, tilt, orientation data, coalesced samples, raw updates, and predicted samples through progressive enhancement.
26. Illustro includes runtime performance instrumentation and an **adaptive performance policy** so cache sizes, worker count, GPU batch sizes, preview quality, and similar parameters can respond to measured device capability rather than fixed assumptions.
27. The right inspector and primary tool rail are **user-resizable in thickness/width**. Exact ergonomic minimum/maximum limits are implementation details, but the user must be able to continuously adjust workspace density rather than being locked to one fixed panel width.
28. The right inspector uses a **dockable block model**. Any normal right-inspector block can be reordered, torn away into a floating PiP panel, remain visible while the main inspector is collapsed, and be re-docked by bringing it near the inspector with a Scratch-like magnetic insertion interaction. Closing a detached block with its upper-right `×` returns it to the inspector rather than destroying its state.
29. Illustro adopts a **Quick Hole Controller**: an idle, donut-shaped six-slot radial command controller anchored only by eligible **canvas interaction**. Interacting with the right inspector, tool rail, top bar, detached PiP panels, or other application UI does not move its anchor; after UI interaction it remains at the previous canvas-derived position until the canvas is operated again. It is hidden while active drawing/contact is occurring. Tapping an eligible non-UI workspace area outside the canvas dismisses it, and it stays dismissed until a later eligible canvas interaction causes it to appear again. Its default mapping is Undo at left, Redo at right, Brush/Eraser Toggle and Eyedropper in the two upper slots, and Lasso and Fill in the two lower slots. All six slot positions and assigned commands are user-configurable through the shared command system.
30. Illustro adopts a **customization-first workspace principle**. Workflow-affecting UI presentation should be user-adjustable wherever doing so does not compromise correctness or basic usability. This includes panel/rail dimensions, dock order, detached PiP placement, show/hide state, workspace layout, Quick Hole command mapping and ordering, Quick Hole size/radius and button sizing, and the opacity/translucency of overlay-style controls. Defaults must remain coherent and usable, every customizable surface must have a safe reset/default path, and ergonomic minimum/maximum constraints may prevent unusable configurations without otherwise restricting meaningful customization.
31. Illustro adopts a **Lineart Group / Lineart Boundary Layer system**. A Lineart Group is a special folder-like container created from one or more existing visible lineart source layers and contains a generated non-rendering Lineart Boundary Layer. The boundary layer stores idealized line-boundary topology derived from the source rather than visible artwork pixels. Selecting it enters a dedicated edit mode for fixing unwanted automatic connections, adding missing connections, removing/splitting boundaries, and explicitly forbidding a rejected auto-connection from reappearing after regeneration. Automatic topology and manual overrides are stored separately. Multiple Lineart Boundary Layers can be selected as a union reference for Fill, Auto Select, Enclose Fill and compatible anti-overflow workflows. Group-level transforms and deformation, including Liquify-compatible displacement, keep visible lineart and boundary topology synchronized, while direct source edits trigger dirty-region boundary regeneration with manual overrides preserved.
32. Lineart Boundary topology uses explicit **graph semantics**. A boundary endpoint is a graph node of degree 1, an ordinary interior line node is degree 2, and a junction/branch node is degree 3 or greater. Connecting two endpoints creates a boundary edge and atomically removes both nodes from the endpoint set when their resulting degree is no longer 1; stale endpoint metadata must never remain after a successful connection. Splitting/disconnecting a boundary creates/reclassifies endpoint nodes from the resulting graph. Connect/disconnect operations, endpoint classification changes, manual/automatic connection metadata and no-connect constraints are part of the normal Undo/Redo command state so Undo restores the exact pre-operation endpoint topology and Redo restores the exact post-operation topology.
33. To keep the production target proportionate and technically realistic, the following previously considered high-cost capabilities are **explicitly removed from the required scope**: realistic general-purpose physical paint mixing, Dual Brush, vector-brush/vector-eraser behavior, Photoshop `.abr` import, and Fisheye Perspective Ruler. Ordinary raster brush mixing/smudge behavior, ordinary vector paths/shapes, and normal 1/2/3-point perspective rulers remain adopted.
34. **Non-destructive Filter Stack and Adjustment Layers remain adopted**, but their editing preview is explicitly allowed to use reduced resolution/quality. Interactive parameter changes may render at reduced resolution; when interaction settles, visible tiles converge to full quality; export/final render always uses the canonical full-quality pipeline.
35. Illustro adopts a **license-aware algorithm/reference-implementation policy**: public algorithms, papers, standards and open-source implementations should be actively researched and reused where useful, but direct source-code reuse is allowed only when the license is compatible and obligations are recorded. Prefer public-domain/CC0 and permissive MIT/BSD/Apache-2.0 implementations for directly incorporated code. Strong-copyleft, source-available, or proprietary code may be studied as a reference, but must not be copied into the core unless the project's licensing decision explicitly accepts the resulting obligations.
36. The implementation target must distinguish **logical capability from unlimited resource claims**. User-defined canvas dimensions are supported within validated document, storage, codec, CPU/GPU and platform limits; no specification may require literally unbounded dimensions or guaranteed identical performance across devices.

### 2026-09-01

1. The production Canonical Brush Engine must use **incremental active-stroke rendering**: ordinary per-input presentation must not replay the already-confirmed stroke prefix or all committed document strokes merely to show newly confirmed input.
2. The current M4 baseline paint/replay path is a functional vertical-slice/reference path, **not the performance-complete production brush architecture**. The incremental-rendering invariant becomes a required M6A Canonical Brush Engine gate. M5A–M5D work does not need to be interrupted solely to retrofit this optimization unless a current feature or measurement requires it.
3. Stabilization/interpolation may keep a bounded mutable tail whose geometry can still change; once a prefix is outside that dependency window it is treated as stable for normal presentation and is not repeatedly resampled, restabilized, regenerated into dabs, or rasterized.
4. Stroke/history data may remain available for Undo/Redo, persistence, recovery, deterministic reconstruction and diagnostics, but ordinary frame presentation must use retained raster/tile state and incremental dirty-region work rather than whole-history replay.

## Working rules for this memo

- Record confirmed product, UX, technical, data-model, file-format, performance, asset, testing, implementation-stage, and release decisions here.
- Distinguish confirmed decisions from proposals and unresolved questions.
- Do not silently carry forward old Illustro requirements.
- When a prior decision is changed, keep a short supersession note instead of erasing the history of the decision.
- Prefer concise entries with enough detail to reconstruct why the current design is the way it is.
- For visual mockups, distinguish **visual-language approval** from **functional approval**. A button appearing in an approved mockup does not by itself make that button a product requirement.
- Implementation must consult this file before making architecture or product decisions.
- If implementation and this memo conflict, the conflict must be resolved explicitly; implementation must not silently redefine the specification.
- Before implementing the editor UI, implementation must open the canonical visual-reference image named below and compare the actual output against it.

# Product / System Specification

## Functional scope and completion definition — 2026-08-30

### Product focus

Illustro is designed first and foremost for creating a **single finished illustration on one canvas/document**. The feature set should be deep enough for serious illustration work rather than broad merely for feature-count parity.

### Baseline feature target

The baseline functional target is:

> **All ibisPaint capabilities that materially participate in a single-illustration workflow, except capabilities explicitly excluded in this memo for technical, product-scope or cost/benefit reasons.**

This baseline is intentionally workflow-scoped rather than brand-clone-scoped. The purpose is to achieve comparable practical capability for drawing, painting, editing, layer work, color work, selection/transform, correction, finishing, file handling, and other operations used to complete one illustration.

### Additional feature target

After the adopted ibisPaint single-illustration baseline is covered, evaluate and adopt useful features from **CLIP STUDIO PAINT and other paid or free painting/creative applications**. A feature is a candidate when it materially improves one or more of the following and remains proportionate to implementation complexity:

- drawing or painting quality
- speed of common illustration operations
- precision or controllability
- non-destructive editing
- layer/document management
- color workflow
- selection, transform, correction, or cleanup
- reference-assisted work
- finishing/export workflow
- pen/touch ergonomics
- reliability, recovery, or efficiency during long illustration sessions

The goal is not to reproduce every feature of every reference application. The goal is to make the **single-illustration workflow functionally complete and unusually convenient**.

### Explicitly non-required categories

The following are not required for the functional-completion gate unless later explicitly re-adopted:

- comic/manga panel splitting and panel-management workflows
- multi-page comic/book production workflows
- built-in material/content catalog or distribution ecosystem
- features explicitly excluded by the canonical inventory after technical/cost review
- other features whose primary purpose is not the creation of a single illustration

A reference application may still contain an individual capability inside one of these broader areas that is useful for single-illustration work; such a capability may be adopted separately by explicit decision.

### Feature-inventory rule

Before declaring implementation complete, maintain a structured feature inventory in this canonical memo that maps reference capabilities to one of:

- **ADOPTED — IMPLEMENTED / VERIFIED**
- **ADOPTED — NOT YET IMPLEMENTED**
- **EXCLUDED — OUTSIDE SINGLE-ILLUSTRATION SCOPE OR DISPROPORTIONATE TECHNICAL COST**
- **SUPERSEDED — REPLACED BY A BETTER ILLUSTRO WORKFLOW**

No reference feature may disappear from the audit simply because Illustro uses a different UI or terminology.

### Functional completion gate

The functional implementation phase is complete only when:

1. the current ibisPaint single-illustration-relevant feature set has been audited against the Illustro inventory;
2. every adopted baseline capability is implemented and verified;
3. selected high-value capabilities from CLIP STUDIO PAINT and other relevant paid/free applications are implemented and verified;
4. exclusions are explicit and consistent with product focus and technical feasibility;
5. no known required feature remains merely planned, stubbed, UI-only, or disconnected from the production path.

This gate defines **feature completeness**. Performance, reliability, visual fidelity, compatibility, testing, and release-readiness retain their own gates and are not automatically satisfied merely because feature coverage is complete.

## Canonical feature inventory — 2026-08-30

This is the current authoritative functional inventory for the single-illustration product scope. Items listed as adopted define the implementation target; implementation status is tracked separately from scope status. The inventory is a capability specification, not a requirement to copy another application's UI or proprietary assets. Requirements are written as realizable product capabilities, not as unlimited guarantees beyond browser/device/resource constraints.

### 1. Document, canvas, navigation, and basic editing — ADOPTED

- Create documents with user-defined pixel dimensions **within validated platform/document/storage/codec resource limits**, presets, DPI/resolution metadata, transparent or colored background, and explicit color-space/precision metadata.
- Canvas/image resize and resampling; crop/trim; canvas expansion; horizontal/vertical flip; destructive document-level rotate/transform where applicable.
- Pan, zoom, viewport rotation, reset view, fit-to-screen, full-screen/workspace presentation, mirror/flip preview, pixel/non-interpolated inspection, grid display and configurable grid spacing/position/color.
- Undo/Redo across production editing commands, including parameterized operations; numeric entry for transforms and tool parameters.
- Image import as a document or layer; drag-and-drop import where the platform permits it.
- PNG, JPEG, transparent PNG export; native `.illustro` project/archive format preserving all adopted editable structures.

### 2. Reference and navigation aids — ADOPTED

- Reference/Sub View window with multiple reference images, switching, move/resize, zoom/rotate/reset, color picking from references, and current-canvas navigator mode.
- Navigator/overview support for rapid movement around large canvases.
- Floating/quick color access and configurable compact production panels where useful.

### 3. Canonical Brush Engine — ADOPTED

Illustro's brush engine is a canonical model covering the **adopted practical raster-brush capabilities** needed for the single-illustration workflow and for useful ibisPaint/CSP interoperability. It is intentionally not required to reproduce every proprietary or high-cost brush subsystem of those applications.

Core capabilities include:

- Raster brush, eraser, smudge/finger, blur and compatible paint/removal modes.
- Brush preset create, duplicate, rename, delete, search, categorize, lock, reset, import/export and custom-tip/pattern creation.
- Brush size, opacity, flow/density and per-brush limits.
- Brush-tip shape/image controls, multiple tip assets where representable without Dual-Brush semantics, hardness, density, spacing/gap, angle, direction/follow-rotation behavior and stroke repetition.
- Stroke start/end behavior, taper/entry/exit size and opacity, forced taper, stabilizer/correction and post-stroke correction where appropriate.
- Paper/texture selection and strength, scale, rotation and blend behavior.
- Random/jitter controls for size, opacity, rotation, position/scatter, density and color.
- Spray/particle behavior including particle size, density, spread and orientation.
- Generalized dynamics mapping from pen pressure, tilt/orientation, velocity and randomness to supported brush parameters, with response curves and minimum/maximum response.
- Anti-aliasing/high-quality edge controls and suitable small-/large-brush spacing behavior.
- Practical digital color behavior including opacity/density mixing, smudge/color extension/drag and ordinary raster paint blending; **realistic general-purpose physical paint simulation is not required**.
- Main/sub color and color-jitter behavior where supported by the canonical model.
- Reference-layer-aware anti-overflow/inside-line painting behavior.

**Watercolor scope:** useful watercolor-like raster brushes, texture, ordinary blending and edge expression are supported; highly specialized physical watercolor simulation and realistic general-purpose pigment/fluid simulation are excluded.

### 4. Brush compatibility — ADOPTED

- Import ibisPaint custom brushes, including parsing the ibisPaint brush-QR carrier when required for interoperability. This QR requirement applies to brush compatibility only.
- Import CLIP STUDIO PAINT brush assets (`.sut`) **only to the extent their parameters map to adopted Illustro brush capabilities**. Unsupported or intentionally excluded source parameters must be reported rather than silently pretending to preserve them.
- Illustro-native brush import/export with a documented, versioned schema suitable for local sharing.
- Imported brushes are normalized into the Illustro Canonical Brush Model; the renderer does not depend on executing another application's format directly.
- Photoshop `.abr` import is **not** a required compatibility target.

### 5. Stylus, pointer and stroke input — ADOPTED

- Pressure, tilt/orientation and supported pen-axis input; per-brush pressure curves and global/default response controls.
- Stabilization/smoothing, real-time and post-stroke correction where appropriate, taper/start/end control.
- Hover presentation where supported, including brush-outline/crosshair options.
- Application-side palm/touch rejection and touch-position/input correction policies using information exposed by the browser/platform; Illustro does not claim control over OS/driver-level palm-rejection behavior that is not exposed to the web application.
- Configurable stylus-button/shortcut actions when exposed by the platform.
- Rich Pointer Events ingestion, including coalesced/raw/predicted samples as progressive enhancements without making them correctness requirements.

### 6. Color system — ADOPTED


#### M5D color-control semantic boundary — 2026-09-02

- Color Wheel, RGB, HSV/HSB and HEX controls share one canonical workspace color state with current/previous/history semantics; normal changes update all representations immediately rather than maintaining independent per-widget colors.
- For M5D-001 through M5D-007, numeric RGB/HSV/HEX values are interpreted as **encoded component values in the active document working space**. This keeps UI state compatible with both sRGB and Display-P3 documents without falsely claiming profile conversion has already been completed.
- The current color is production-connected to baseline raster painting and is captured at stroke start. Canonical CPU tile rasterization, WebGPU provisional presentation and Canvas2D compatibility presentation use the same per-dab encoded RGB value. Legacy recovered dabs without a color field retain black semantics.
- Color workspace state (current/previous/history) is user/workspace state and may persist locally without changing the native document schema. Document color-profile conversion, ICC-aware preview boundaries and profile metadata remain the responsibility of M5D-021 through M5D-025.

- Color wheel and direct RGB, HSV/HSB and HEX entry.
- Current/previous color, color history, editable palettes, multiple named palettes, palette reordering and color reordering.
- Palette import/export through normal data/file interchange. **QR-code palette sharing is explicitly excluded.**
- Eyedropper/quick eyedropper; merged-canvas, active-layer and reference-image sampling modes.
- Standard gradients, editable gradient stops, gradient pen/tool behavior, Gradient Layers, Freeform Gradient and Gradient Map.
- Color Mixing Palette plus Intermediate/Approximate Color-style helpers for practical palette exploration.
- Explicit color-profile management for adopted RGB workflows, including sRGB and Display-P3; ICC/profile-aware conversion/preview architecture where supported by Illustro's own color pipeline.

### 7. Layer model and non-destructive editing — ADOPTED

- Raster layers, path/shape-oriented vector layers, adjustment layers, selection/mask structures, layer folders, fill layers and gradient layers.
- Layer create, duplicate, delete, rename, reorder, visibility, opacity, lock, alpha lock, clipping, clear, merge-down/merge-visible-copy, rasterize, invert, flip and folder-level operations.
- Multi-layer selection and grouped movement/transform/organization.
- Layer Masks with paint/edit, invert, link/unlink, independent move/transform, feather/blur as applicable, and conversion to/from selections.
- Reference Layer designation usable by fill, selection and anti-overflow brush workflows.
- **Lineart Group** as a special folder-like layer container that owns one or more visible source lineart layers plus a non-rendering **Lineart Boundary Layer** used for idealized fill/selection boundaries.
- Draft/sketch layer attribute with the ability to exclude/hide draft content from final-output workflows.
- Linked/File Object-style layers use an **embedded or internally snapshotted source as the canonical project-preserved representation**. On platforms where persistent external file handles are available, Illustro may additionally retain/relink an external source, but project correctness must not depend on permanent permission to an arbitrary OS file.
- Layer Comps for saving and switching named visibility/state alternatives within one illustration document.
- Layer search/filtering and bulk cleanup such as empty/hidden layer cleanup.
- Folder **Pass Through** compositing semantics where needed for expected adjustment/blend behavior and PSD-style compatibility.
- Non-destructive Layer Property/effect attributes where useful, integrated with the common effect/compositor architecture rather than duplicated as unrelated one-off implementations.

### 8. Blend modes — ADOPTED

Support the common ibisPaint/Photoshop-class set required by the audited workflow, including at minimum Normal; Darken; Multiply; Color Burn; Linear Burn; Darker Color; Lighten; Screen; Color Dodge; Linear Dodge/Add; Lighter Color; Overlay; Soft Light; Hard Light; Vivid Light; Linear Light; Pin Light; Hard Mix; Difference; Exclusion; Subtract; Divide; Hue; Saturation; Color; and Luminosity, with explicit color-space/blend semantics.

### 9. Vector drawing and vector correction — ADOPTED, REDUCED SCOPE

- Vector layers for editable paths, shapes and simple stroked geometry.
- Post-creation stroke color and width editing for supported vector path/shape objects.
- Shape/lasso selection of vector objects/paths; node/vertex and Bézier-handle editing; corner/smooth control; simplification/reduction.
- Useful geometric correction operations such as magnet/snap, pinch/reshape, simplify, connect, line-width adjustment and redraw/edit of vector paths where representable.
- SVG-compatible vector interchange/export where practical, including copy/export of supported vector content to SVG.
- **Vector brush rendering/reassignment and vector eraser modes such as whole-line or erase-to-intersection are not required.**

### 10. Selection and masking workflow — ADOPTED

- Lasso/free selection, automatic/magic-wand selection, color-range selection and brush-painted selection.
- Add/subtract/intersect where applicable; clear/deselect; invert; expand; contract.
- Selection Feather/soft edge.
- Quick Mask workflow and selection↔mask conversion.
- Alpha/transparency-to-selection from a layer.
- Selection-scoped transform, filter, fill, cut/copy/paste and layer operations.
- Auto Select and compatible selection operations may use one or more enabled Lineart Boundary Layers as a combined idealized boundary source.

### 11. Fill and enclosed-area tools — ADOPTED

- Flood fill with tolerance/strength, gap recognition/closing, under-line expansion, boundary expansion/contraction and continuous/swipe filling.
- Configurable reference source: active layer, designated Reference Layer(s), merged canvas, or selected Lineart Boundary Layer(s).
- When multiple Lineart Boundary Layers are enabled, their topology is unioned into one virtual boundary set for the operation without destructively merging the source layers/groups.
- Fill using Lineart Boundary topology is intentionally independent of visible stroke anti-aliasing and line thickness. The fill pipeline should use source-line coverage to extend color safely beneath the visible lineart edge while using the idealized topology to prevent crossing into neighboring regions, avoiding the common light/transparent halo along anti-aliased lineart.
- Enclose-and-Fill and Enclose-and-Erase workflows.
- Transparent/erase fill where applicable.
- Automatic-selection boundary logic should share the same high-quality region/contour foundations where possible.

### 11A. Lineart Groups and Lineart Boundary Layers — ADOPTED

The Lineart system separates **visible artistic linework** from the **idealized topology used to define closed paint regions**. The artist is therefore not required to compromise line quality merely to make a flood-fill algorithm recognize a boundary.

#### Structure and creation

- A **Lineart Group** behaves like a special folder in the layer hierarchy.
- Creating a Lineart Group from existing selected layer(s) wraps/preserves those layers as the visible lineart source rather than rasterizing or replacing them.
- A typical structure is:

  - `Lineart Group`
    - visible raster/vector/source lineart layer(s)
    - `Lineart Boundary Layer`

- The Lineart Boundary Layer is a dedicated derived-data child. It does not participate in normal artwork compositing and is never exported as visible artwork.
- A group normally has one canonical boundary child representing the union/analysis of its configured source content; multiple independent Lineart Groups may exist in one document.

#### Boundary generation model

- Boundary generation analyzes the visible source lineart into an idealized thin barrier representation, conceptually near a one-pixel/centerline topology at document resolution rather than copying the antialiased stroke silhouette as-is.
- The derived representation is an explicit boundary graph. **Endpoint nodes are exactly graph nodes of degree 1; ordinary interior line nodes are degree 2; junction/branch nodes are degree 3 or greater.** Endpoint status is derived from current topology and must not survive as stale independent metadata after the topology changes.
- The representation preserves endpoints, intersections, branches and closed-region connectivity needed for region operations.
- Small endpoint gaps can be bridged automatically. Candidate bridging should consider at least endpoint distance, endpoint direction/tangent and nearby boundary context rather than connecting every nearby point blindly.
- Auto-generated gap bridges are tagged distinctly from extracted source boundaries and from explicit user edits.
- Gap-closing can expose user settings such as enabled/disabled state, maximum connection distance and connection aggressiveness/sensitivity.

#### Manual boundary editing and correction

- Selecting the **Lineart Boundary Layer** enters a dedicated boundary-edit mode rather than an ordinary paint-layer mode.
- In this mode the user can at minimum:
  - add a missing boundary segment;
  - connect two intended endpoints;
  - erase/remove a boundary segment;
  - split/disconnect an unwanted connection;
  - reject an automatically generated bridge;
  - explicitly mark a rejected endpoint pair/bridge as **do not reconnect automatically**;
  - regenerate/reanalyze automatic topology without discarding valid manual corrections.
- **Connecting two endpoints is one atomic graph-edit operation:** create the new boundary edge, recompute node degrees, and immediately remove either/both nodes from the endpoint set when their resulting degree is no longer 1. A successfully connected node must not remain available as an endpoint/gap-closing candidate merely because it used to be an endpoint.
- **Splitting or disconnecting a boundary is the inverse topology operation:** remove/split the edge, recompute local node degrees, and create/reclassify degree-1 nodes as endpoints. If the disconnection represents an intentional rejection of an automatic bridge, the corresponding no-connect constraint is recorded so regeneration does not immediately recreate the rejected bridge.
- Automatic extraction, automatic gap bridges, manual additions, manual removals/splits, explicit manual connections and explicit no-connect constraints are stored as separate semantic data. This prevents a regeneration pass from silently restoring a connection that the user deliberately removed.
- Undo/Redo applies to these boundary-edit operations through the normal command/history system.

#### Endpoint and Undo/Redo invariants

- Endpoint membership is a consequence of the graph after each committed operation, not a separate long-lived flag that can diverge from topology.
- A connect command records enough state to restore the previous edge set, node identities/positions, endpoint classifications and connection provenance. Undoing a connection must therefore remove the added edge and restore the original endpoints exactly; Redo must recreate the connection and remove those endpoint classifications again where appropriate.
- A disconnect/split command likewise records enough state to Undo back to the connected graph and Redo back to the split graph, including any explicit no-connect decision created by the split.
- Automatic/manual provenance, rejected-auto-bridge state and no-connect constraints participate in the same history transaction when they are changed by the operation.
- These mutations are atomic from the document/history perspective: rendering, Fill and auto-gap search must never observe a state in which the edge has changed but endpoint classification has not yet been updated.

#### Preview and editing overlay

- In normal artwork view the boundary child is invisible.
- When the boundary layer is selected, being edited, or explicitly previewed as an active Fill/selection reference, its topology is shown as a temporary **topmost overlay** above artwork.
- The default overlay is a clear semi-transparent blue or similar high-contrast editing color; it is presentation-only and is not part of the artwork.
- Endpoint nodes may be visually distinguished in boundary-edit mode so the user can understand which points are currently connectable; this visualization derives from the current degree-1 node set.
- Overlay visibility can be toggled. Overlay color, opacity and practical preview width are user-configurable under Illustro's customization-first principle.
- When multiple Lineart Boundary Layers are active as references, the UI can show their combined boundary preview; implementations may optionally distinguish constituent groups by preview color while retaining a combined-operation view.

#### Multiple boundary references

- Fill/Auto Select/Enclose Fill and other compatible region tools expose a selector for which Lineart Boundary Layers are active.
- One or many boundary layers may be enabled simultaneously.
- Multiple enabled boundaries are combined as a **virtual union boundary topology** for the operation. The underlying groups/layers remain independent and are not destructively merged.
- This allows, for example, character, clothing, accessory and background lineart groups to be enabled in any combination depending on the region being painted.

#### Synchronization with source lineart

- The boundary child maintains source references and a source-generation revision/state.
- Direct edits to source lineart invalidate only affected/dirty regions where practical; boundary regeneration should be incremental rather than requiring a full-document analysis for every stroke.
- Manual additions/removals/connections/no-connect constraints are preserved and reapplied/validated across source-driven regeneration instead of being overwritten wholesale.
- Group-level Move, Scale, Rotate, Mesh/Perspective-compatible transform and other applicable deformation operations act on the visible source and its boundary data as one logical unit.
- For Liquify/local-warp style operations applied to the Lineart Group, the same displacement field must be applied to both visible source lineart and the boundary representation so they remain registered. A later local regeneration may refine the topology where the source itself changed materially.

#### Region-operation behavior

- Region tools using a Lineart Boundary Layer make inside/outside decisions from the idealized topology instead of directly treating semi-transparent anti-aliased source pixels as the barrier.
- Fill coverage may extend underneath the visible source-line coverage while the boundary topology blocks passage to neighboring regions. This is intended to eliminate visible unpainted fringes beneath anti-aliased lineart without relying on an excessively large global expansion value.
- The same boundary source is available to Auto Select, Enclose Fill/Erase and compatible anti-overflow/inside-line brush behavior so these tools do not each implement a separate inconsistent lineart interpretation.

#### Native persistence

The native `.illustro` project representation must preserve enough data to round-trip the Lineart system, including:

- Lineart Group/source membership and source references;
- derived/extracted boundary graph/topology or its reproducible cached representation, including stable node/edge identity where required for manual overrides and history;
- automatic gap bridges and their generation settings;
- manual boundary additions and explicit manual connections;
- manual removals/splits;
- explicit no-connect constraints/rejected auto bridges;
- generation/source revision metadata;
- preview/customization state where that state belongs to the project/workspace model.

### 12. Transform, alignment and snapping — ADOPTED

- Move, scale, rotate and numeric X/Y/scale/angle entry.
- Perspective transform, mesh transform, configurable mesh subdivisions/smoothing, repeat/mirror-repeat patterns where useful.
- Nearest Neighbor, Area/Average, Bilinear, Bicubic, Lanczos 2 and Lanczos 3 resampling/interpolation modes where the operation requires explicit choice.
- Puppet Warp for practical local deformation without 3D.
- **Non-destructive Transform** representation equivalent in capability to transform-mask/smart-object-style editing where useful, so repeated transform does not force repeated raster degradation.
- Align and Distribute for layers/objects.
- Smart Guides/Snapping/Magnetics to canvas center/axes, grid/guides and other eligible objects/layers with configurable snapping behavior.
- Lineart Group transforms/deformations must keep visible source lineart and its Lineart Boundary Layer registered as specified in the Lineart system above.

### 13. Shape and ruler systems — ADOPTED

- Line, rectangle, rounded rectangle, circle/ellipse, regular polygon, polyline and Bézier curve drawing.
- Fill/stroke on/off, simple vector/path stroke styling where useful, anti-aliased fills and post-creation shape adjustment.
- Straight, circular, elliptical, radial/concentration, symmetry, kaleidoscope, array and perspective-related rulers useful to single illustrations.
- 1/2/3-point Perspective Ruler; ruler move/angle/center/phase adjustment and snap enable/disable.
- Smart Shape-style post-stroke recognition/correction for common geometric forms.
- **Fisheye Perspective Ruler is excluded from the required scope.**

### 14. Filters, tonal correction and effects — ADOPTED

Static-image ibisPaint-relevant filter/effect capability is part of the baseline, implemented through a common effect architecture where possible. Required families include:

- Tonal/color: brightness/contrast, Tone Curve, hue/saturation/lightness, Color Balance, Levels, grayscale, monochrome/binarize, posterize, invert, Gradient Map, color replacement and line/color-extraction-related corrections.
- Blur/sharpen: Gaussian, motion, zoom/radial/rotation/lens-style blur as applicable, mosaic/pixelation and Unsharp Mask.
- Style/edge/light: stroke/outline, inner/outer glow, bevel/emboss/relief, drop shadow, satin-like effects, bloom and related static finishing effects.
- Noise/glitch/aberration/retro-style static image effects relevant to illustration finishing.
- Distortion: bloat, fisheye image distortion, spherical/lens, wave/ripple, twirl and polar-coordinate-style transforms.
- Applicable generated graphic effects such as line/radial/parallel wave or cloud-style generation where useful for a single illustration.

Adjustment Layers/non-destructive effect application must reuse the same underlying effect implementations instead of maintaining inconsistent duplicate algorithms.

### 15. Non-destructive filter/effect stack — ADOPTED WITH MULTI-RESOLUTION PREVIEW

- A layer-local non-destructive Filter Stack / Filter Mask capability is retained in addition to global/stack-position Adjustment Layers.
- Effects can be enabled/disabled, reordered, reconfigured and masked without destructive baking until explicitly rasterized/applied.
- The effect architecture should support the same processing kernel being invoked destructively or non-destructively where semantics allow it.
- Non-destructive rendering uses a **tile-based dependency graph**. Cache identity must account for effect/node identity, tile coordinates, source/content revision, parameter revision, resolution/quality level and other inputs that affect output.
- Interactive manipulation may use reduced-quality preview. A typical target is approximately **1/2 linear resolution**, with **1/4 linear resolution or another adaptive level permitted for especially expensive operations/devices**.
- When interaction stops, prioritize full-resolution recomputation of **currently visible dirty tiles** and replace the reduced-quality preview progressively. Off-screen tiles may be deferred until needed or background budget is available.
- Export/final render/rasterization uses the full canonical quality and must not inherit preview approximation.
- Cheap pixel-local effects may remain full-resolution during interaction when they meet latency budget; quality reduction is an available performance tool, not a mandatory degradation for every effect.
- Neighborhood filters such as blur/sharpen must use explicit tile halo/border handling. Wide-radius filters may use multi-scale/downsampled intermediate algorithms where mathematically/visually appropriate.
- Filters requiring global statistics may use approximate/downsampled statistics during interactive preview, followed by full-resolution recomputation after settling or for final output.
- Preview quality differences may affect only transient presentation; they must not modify canonical layer/effect parameters or silently change final artwork semantics.

### 16. Liquify, correction and special paint tools — ADOPTED

- Liquify/local warp, lasso paint, lasso erase, clone/copy pen, smudge and blur tools.
- Liquify/local-warp applied to a Lineart Group must share the same displacement field between its visible lineart source and Lineart Boundary Layer so boundary registration is maintained.
- Practical special drawing/correction tools from the audited ibis/CSP single-illustration workflow where they do not introduce comic/page or 3D dependencies.

### 17. Productivity and interface customization — ADOPTED

- Configurable keyboard shortcuts for Undo/Redo, brush/eraser, brush size, copy/cut/paste, navigation, eyedropper, tool commands and dialogs.
- Quick Access panel for tools, commands, colors and Auto Actions.
- Custom Command Bar/compact command strip.
- Workspace layout save/switch for panel and shortcut arrangements.
- Selection Launcher / contextual selected-area commands.
- Auto Actions: record/replay appropriate command sequences, with local import/export of action definitions when safe and representable.
- Layer/object alignment/distribution and other repetitive-operation accelerators already listed above must be accessible through these command surfaces.
- Right-inspector blocks are freely reorderable and detachable into persistent floating PiP panels; they support magnetic re-docking and remain available when the main inspector is collapsed.
- Right-inspector width and primary tool-rail thickness are user-adjustable and stored as workspace layout state.
- Quick Hole Controller provides six user-remappable radial command slots at the last eligible canvas-derived anchor. UI interactions do not move that anchor. The default commands are Undo, Redo, Brush/Eraser Toggle, Eyedropper, Lasso and Fill, and it uses the same canonical Command Registry as shortcuts/Quick Access rather than a separate hard-coded command path.
- Quick Hole visual presentation is customizable, including overall/controller scale, ring radius, button sizing and overlay translucency/opacity within ergonomic limits. Overlay opacity settings must preserve sufficient command legibility and hit-target clarity.
- Workspace/user settings provide reset-to-default behavior for configurable layout and overlay controls.

### 18. Reliability, history and native project preservation — ADOPTED

- Autosave and continuous crash-recovery data sufficient to restore a **recent coherent document state** after abnormal termination; the specification does not claim that an OS/browser termination can always preserve the final in-flight sample that had not yet reached a committed recovery boundary.
- Native `.illustro` format must preserve all adopted editable structures needed for round-trip editing, including raster/path-vector content, folders, masks, adjustment/effect structures, transforms, layer metadata, color/document metadata, Lineart Groups/Boundary Layers and references that are part of the project model.
- OPFS working state is not a substitute for user-controlled project export/backup.

### 19. Import/export and interoperability — ADOPTED BASELINE

- PNG/JPEG/transparent PNG image interchange.
- Native `.illustro` project import/export.
- Brush interoperability described above for ibisPaint and CSP, plus Illustro-native brushes, limited to parameters representable by the adopted Canonical Brush Model.
- SVG-compatible vector interchange where applicable to supported path/shape content.
- File/profile metadata must be explicit enough to avoid silently misinterpreting wide-gamut RGB assets.

### 20. Explicitly excluded capabilities

The following are **not** part of the required functional-completion target unless a later explicit decision supersedes this list:

- Comic/manga panel splitting, page management, book/multi-page production and other primarily multi-page workflows.
- Built-in material/content marketplace/catalog/distribution ecosystem.
- **All 3D creation/posing/reference functionality** as an Illustro subsystem, including 3D figures, heads/hands, primitives/background scenes, All Sides View, 3D painting, 3D-derived perspective workflows, pose/hand scanners and 3D-based LT conversion.
- Multi-canvas/batch processing whose purpose is to run operations across multiple open documents.
- AI Super-resolution.
- AI learning-disturbance/protection processing.
- AI Watercolor filter.
- AI background-removal feature.
- Screentone-focused functionality.
- Wacom Yuify integration.
- QR-code-based **color-palette** sharing.
- Highly specialized/overly complex watercolor-specific physical simulation.
- **Realistic general-purpose physical paint/pigment/fluid mixing simulation.** Ordinary digital opacity/density blending and smudge/color-drag behavior remain supported.
- **Dual Brush** as a two-brush compositing/dynamics subsystem.
- **Vector brush and vector eraser behavior**, including whole-line/erase-to-intersection vector eraser semantics. Path/shape vector editing remains supported.
- **Photoshop `.abr` brush import.**
- **Fisheye Perspective Ruler.** Normal 1/2/3-point perspective rulers remain supported.
- Animation/multi-frame production is outside the current single-illustration completion target.

### 21. Initial-release adoption decisions — RESOLVED 2026-08-30

The former pending-adoption list is closed for the initial release. The authoritative dispositions are:

- **Text Tool — ADOPTED FOR INITIAL RELEASE.** Editable point/box text layers, common typographic controls, transform, and non-destructive re-editing. Comic/page-specific balloon and story-layout systems remain excluded.
- **CMYK / print ICC workflow — POST-BASELINE CANDIDATE.** Initial release remains RGB-first with profile-aware conversion. Dedicated CMYK document/output workflow is not an initial-release gate.
- **Dedicated grayscale 8-bit / monochrome 1-bit modes — EXCLUDED FROM INITIAL RELEASE.** Ordinary grayscale/monochrome conversion through corrections, filters, and compatible export remains available; manga/screentone-driven 1-bit production is outside the current focus.
- **Cloud Sync — POST-BASELINE CANDIDATE.** Initial release is local-first/offline-capable and does not require an account or server for document correctness.
- **Local Gallery / Project Library / Recently Deleted — ADOPTED FOR INITIAL RELEASE.** Provide local project browsing, search/sort/organization, create/open/import, recovery visibility, and reversible trash/recovery. This is local project management, not a public material/content catalog.
- **Timelapse / drawing-history playback and export — ADOPTED FOR INITIAL RELEASE.** This records and plays back the creation process of one illustration; it does not create an animation/multi-frame editing product.
- **PSD import/export — ADOPTED FOR INITIAL RELEASE WITH BOUNDED FIDELITY.** Support is test-corpus/matrix based. Unsupported or approximated Photoshop semantics must be reported explicitly; silent destructive claims of full fidelity are prohibited.
- **Shading Assist — POST-BASELINE CANDIDATE.** A later deterministic/local lighting-assist capability may be adopted, but initial completion does not depend on it.
- **Color Match — ADOPTED FOR INITIAL RELEASE.** Provide deterministic/local reference-based color matching/grading without a cloud generative-AI dependency.
- **Companion-device mode — EXCLUDED FROM INITIAL RELEASE.** Cross-device networking/state synchronization is disproportionate to the core single-device painting path.
- **Photoshop `.grd` gradient import — EXCLUDED FROM INITIAL RELEASE.** Illustro-native versioned gradient interchange is the authoritative gradient-sharing path.

These dispositions can change only through a later explicit supersession decision.

### 22. Post-baseline feature-audit rule

The **initial 2026-08-30 external-application feature audit is closed** under FC-1 and P1-2. Illustro is not required to keep chasing newly released reference-app features during initial implementation.

- Reference-app capabilities publicly available by the frozen 2026-08-30 audit date are governed by the canonical inventory and Phase-1 closure.
- Reference-app releases or newly discovered capabilities after that freeze enter a **POST-BASELINE CANDIDATE** queue by default.
- A post-baseline candidate affects the implementation/release gate only after an explicit Illustro adoption decision.
- Duplicate brand-specific implementations should continue to be normalized into a single stronger Illustro capability rather than copied redundantly.
- This rule does not prevent later product evolution; it prevents the initial implementation target from becoming a moving completion gate.

# UX / UI Specification

## Canonical visual reference asset — 2026-08-30

The following image is the currently approved **visual reference source of truth** for the Illustro editor UI. This is the latest generated image approved by the user as the provisional completion target.

- Asset filename: `ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png`
- Storage: Google Drive
- Drive file ID: `1PvkSCaSNNMBZfnn9aRUwGSkja5janHqQ`
- View URL: `https://drive.google.com/file/d/1PvkSCaSNNMBZfnn9aRUwGSkja5janHqQ/view?usp=drivesdk`
- Image dimensions: `1536 × 1024 px`
- Source format: PNG
- SHA-256: `32a6cb3991c9baa5b5e097943ce0550a3968d2dcde1be68e132f30ce03341a13`

### Reference rule

- UI implementation must **open and visually inspect this exact image before implementation and during visual QA**.
- The prose in this Markdown explains the image and records later functional decisions, but it is **not a substitute for viewing the image** when reproducing composition, spacing, density, color balance, borders, radii, icon treatment, panel proportions, and overall atmosphere.
- Treat the image as authoritative for the provisional visual composition and visual language.
- Treat this Markdown as authoritative for actual product behavior, feature inventory, interaction semantics, architecture, and any later explicit visual overrides.
- Some controls visible in the image are placeholders/provisional artifacts of image generation. Their presence does not create a feature requirement unless the feature is separately adopted in this Markdown.
- If a functional decision in this Markdown requires removing or changing a control shown in the image, preserve the image's **visual system and spatial discipline** while applying the newer functional decision.
- Do not silently replace this asset. When a later image is explicitly approved as the new target, preserve a supersession note, upload the new image, and update this section with its exact file ID, dimensions, and SHA-256.

## Provisional UI visual target — 2026-08-30

The currently approved mockup establishes the following visual and structural direction for Illustro.

### Overall visual language

- Use a **crisp white base with clear, vivid accent colors** rather than a washed-out or uniformly pastel surface.
- The UI remains colorful, but must feel **futuristic, precise, professional, and refined**, not toy-like or childish.
- The color philosophy may retain the enjoyable, approachable multicolor character associated with Scratch-style UI, but the execution should be more mature: controlled saturation, disciplined spacing, restrained decoration, and strong visual hierarchy.
- Prefer white and very-light neutral surfaces for the majority of panels. Color should be concentrated in icons, active states, selection highlights, sliders, compact accents, and status indicators.
- Use a broad but coordinated accent palette: pink/magenta, cyan/blue, mint/green, violet, yellow/orange, etc. Colors should identify controls and state without turning entire panels into large colored blocks.
- Avoid excessive gradients, candy-like decoration, mascot-like ornamentation, oversized rounded cards, or other cues that make the product look juvenile.
- Rounded geometry is acceptable, but corner radii should be moderate and consistent. Shadows/borders should be subtle and used primarily to establish depth and panel separation.
- Typography and iconography should remain sharp and legible against the colorful accents.

### Customization-first UI principle

- Illustro treats the workspace as **user-configurable production equipment**, not a fixed arrangement that every artist must accept.
- Workflow-relevant dimensions, ordering, docking, visibility, overlay size and overlay opacity should be configurable when practical.
- Customization must be discoverable but must not clutter the default workspace; sensible defaults remain the primary first-run experience.
- Configurable values are persisted in workspace/user settings and provide a reliable reset-to-default path.
- Customization can be constrained by ergonomic minimums/maximums when necessary to preserve touch targets, icon legibility, accessibility and editor operability.
- This principle applies especially to the inspector, tool rail, detachable PiPs, Quick Hole Controller, Quick Access/Command surfaces and future workflow overlays.

### Main workspace composition

- The editor is a **large central canvas workspace** with a persistent tool column on the left and a dedicated inspector/panel column on the right.
- The canvas area and the right-side UI are visually and structurally **separate regions**. The right panel must not look like controls floating on top of the canvas.
- The main canvas should dominate available space and remain visually quiet so artwork is the focus.
- The canvas/workspace may use a very light neutral surround and a thin boundary, but should not be surrounded by heavy card chrome.
- A desktop-class top bar/menu may provide document/application commands, undo/redo, save status, etc., while drawing-oriented controls remain in the appropriate tool/panel areas.

### Left tool rail

- Preserve the basic interaction concept of the supplied reference: a **narrow, vertically stacked drawing-tool rail on the left**.
- The rail should provide immediately recognizable tool icons with compact labels where useful.
- Each tool icon may use its own accent color or soft tinted background, creating a multicolor identity while maintaining a consistent icon system.
- Active-tool state should be obvious through a stronger accent/background/border rather than through oversized decoration.
- This rail is intended to be compact, fast to scan, and suitable for pen/touch use.
- The rail's thickness/width is user-resizable and is part of the persisted workspace layout rather than a fixed visual constant.

### Right-side UI / inspector area

- The right side should behave more like a professional illustration application's inspector stack, broadly comparable in information architecture to CLIP STUDIO-style side panels while retaining Illustro's own visual identity.
- Panels such as Layers, Color, Brush Presets, Brush Settings, Navigator, Materials/Sub View, etc. may live in this region as the functional specification is finalized.
- The region should support clear sectioning and compact information density; it must not become a series of oversized playful cards.
- Panel headers, selected tabs, active layers, and key values can use strong accent colors, while panel bodies remain predominantly white/light-neutral.
- The right inspector is independent from the canvas, with a clear vertical boundary and its own scrolling behavior.
- The right inspector's width is directly user-resizable and persisted with the workspace.

## Dockable inspector blocks and detachable PiP panels — 2026-08-30

The right inspector is not a fixed monolithic sidebar. It is a **reorderable dock made of independent functional blocks**.

### Reordering

- Normal inspector blocks can be reordered freely by drag interaction.
- Dragging within the inspector shows an insertion position and moves neighboring blocks to make the resulting order unambiguous.
- User-defined order is persisted as part of the active workspace.

### Tear-off / PiP behavior

- Dragging a block away from the right inspector can tear it off into a floating **PiP panel** without changing the tool's underlying state.
- A detached PiP is an alternate presentation of the same block, not a duplicated tool instance.
- Detached PiPs remain visible and usable even if the entire right inspector is collapsed, allowing the user to keep only the controls needed for the current task on the canvas/workspace.
- Collapsing or reopening the right inspector does not implicitly re-dock detached PiPs.

### Magnetic re-docking

- Bringing a detached PiP close to the right inspector activates a **Scratch-like magnetic docking interaction**.
- The UI shows the candidate insertion point before drop; dropping there inserts the block into that position and updates the inspector order.
- Re-docking is therefore also an ordering operation: the user does not need a separate panel-order dialog.

### Close-to-return behavior

- A detached PiP exposes an upper-right `×` control.
- For these detached blocks, `×` means **return to dock**, not destroy, reset, or permanently hide the feature.
- The block returns to its previous/remembered dock position where possible; if that slot no longer exists, it returns to the nearest valid insertion position while preserving the current block state.

### Layout persistence

Workspace persistence must include, at minimum:

- right-inspector width;
- primary tool-rail thickness;
- docked block order;
- which blocks are detached;
- detached PiP positions;
- right-inspector collapsed/expanded state.

The exact ergonomic minimum/maximum dimensions for rails/panels are implementation/QA decisions; they must prevent unusable zero-size controls without removing the user's ability to meaningfully choose workspace density.

## Quick Hole Controller — 2026-08-30

The **Quick Hole Controller** is a pen/touch-first shortcut system intended to make fast illustration work practical without requiring a keyboard, macro pad, or secondary companion device.

### Presentation, anchor and dismissal behavior

- The controller is donut/ring-shaped, leaving a clear center and arranging six command buttons around the ring.
- Its anchor is updated by **eligible canvas interaction only**. On a pointer/hover-capable device, an eligible canvas pointer/pen position may become the current anchor; on touch-first tablets without useful hover tracking, the latest eligible tap/pen-contact location on the canvas becomes the anchor.
- Interacting with the right inspector, left tool rail, top/application bars, dialogs, detached PiPs, Quick Access, or any other application UI **does not update the Quick Hole anchor**.
- After any UI interaction, the controller therefore remains at its existing canvas-derived position until the canvas itself is operated again.
- The controller is an **idle-state control**: it is hidden while a pen/touch drawing contact or active stroke is in progress so it does not obstruct drawing, then becomes available again at the current eligible anchor when contact ends unless it has been explicitly dismissed.
- Tapping an eligible **non-UI workspace area outside the canvas** dismisses the controller immediately. That dismissal does not trigger a drawing command and the controller remains hidden until a subsequent eligible canvas interaction causes it to appear again.

### Visual treatment and opacity customization

- The donut/ring surface is **translucent**, allowing the artwork/workspace beneath it to remain partially visible.
- The six command-button surfaces are also translucent rather than fully opaque blocks.
- Ring/background opacity and command-button surface opacity are user-adjustable in settings; they may be exposed as independent controls or as a linked overall-opacity control plus an advanced override, provided the final implementation preserves the ability to tune the controller's transparency meaningfully.
- Quick Hole scale, ring radius and button size are also user-adjustable within ergonomic bounds.
- Icons, focus/selection states and hit targets must remain readable and operable at supported opacity values; the implementation may use outlines, contrast adaptation or similar non-destructive presentation aids rather than forcing an opaque background.
- The default appearance should be visibly translucent without becoming visually noisy or difficult to identify over artwork.

### Default six-slot layout

The default layout is:

- left: **Undo**;
- right: **Redo**;
- upper-left: **Brush / Eraser Toggle**;
- upper-right: **Eyedropper**;
- lower-left: **Lasso**;
- lower-right: **Fill**.

This default is optimized for the repeated actions needed during ordinary lineart, painting and cleanup rather than for feature discoverability.

### Full customization

- All six slots can be reordered.
- The command assigned to every slot can be changed by the user.
- Eligible commands come from the same canonical **Command Registry** used by keyboard shortcuts, Quick Access, Command Bar and other command surfaces.
- The controller must therefore not implement Undo, Fill, Lasso, etc. as private one-off code paths; each button invokes the same underlying command as other UI/shortcut surfaces.
- Custom mappings, size/geometry and opacity settings are saved as workspace/user settings.
- A clear reset-to-default command restores the standard six-slot layout and standard visual settings.

### Interaction principle

The Quick Hole Controller is not a replacement for normal tools, shortcuts or Quick Access. It is the **lowest-travel canvas-local command surface**, specifically intended to reduce hand movement and dependence on external shortcut hardware during tablet drawing.

### Canvas upper-right controls

- Do **not** place the previously generated floating group of utility buttons in the canvas upper-right corner as part of the target layout.
- Canvas-space controls should be kept minimal. Commands that belong to panels/application UI should live outside the canvas rather than floating over the artwork.
- The Quick Hole Controller is an intentional exception because it is transient, canvas-anchored and directly serves the active drawing workflow rather than acting as a permanent floating toolbar.
- Any other future canvas-overlay control must be justified by a direct canvas interaction need and specified explicitly before inclusion.

### Right inspector fixed-bottom controls

- The earlier full-width bottom toolbar concept is rejected as the primary target.
- Bottom/quick controls associated with the inspector must be **contained within the right-side UI column**.
- This right-side bottom toolbar/control strip must remain **fixed to the bottom of the right inspector** while the inspector's panel content above it can scroll.
- Treat the right column as two vertical regions: a scrollable panel stack and a non-scrolling fixed bottom action/control area.
- The fixed area should stay compact and visually consistent with the rest of the inspector; it must not consume excessive canvas width or height.

### Color and state treatment

- White is the dominant surface color; accent colors provide clarity and personality.
- Selected layers/tools may use a light tinted fill plus a stronger colored edge/indicator.
- Icons should not all be monochrome: controlled multicolor icon accents are part of the intended identity.
- Sliders, toggles, selection borders, badges, and small status elements may use brighter accent colors for a clean high-tech feel.
- Maintain sufficient contrast and avoid making every element equally saturated; color hierarchy is essential.

### Maturity / sophistication constraint

- The application should feel approachable and enjoyable without looking designed for very young children.
- Target impression: **modern creative software with playful color**, not a children's drawing toy.
- When choosing between decorative charm and professional clarity, prioritize professional clarity.
- "Pastel colorful" should be interpreted as a coordinated light-spectrum palette, not as low-contrast washed-out UI.
- The approved direction is therefore closer to **white + crisp chromatic accents + subtle pastel support surfaces**.

### Status of the mockup

- The approved image is a **visual benchmark**, not a literal screen specification.
- Exact button count, labels, menu names, visible panels, and feature availability remain subject to product/UX specification.
- Future mockups should preserve the approved visual language and major structural decisions unless explicitly superseded.

# Technical Architecture

## Primary platform and execution model — 2026-08-30

### Web/PWA foundation

- Illustro is implemented as a **Web/PWA-first** application served from a secure HTTPS context.
- PWA/offline application behavior is part of the architecture, while the exact minimum supported browser/device versions remain a separate compatibility decision.
- The application must use runtime feature detection instead of user-agent assumptions for GPU, pen, storage, and optional acceleration capabilities.

### Threading and ownership

- Keep the main thread focused on UI, DOM integration, and lightweight input coordination.
- Use **Dedicated Web Workers** for rendering, storage, and CPU-heavy compute paths when separation improves responsiveness or isolation.
- Rendering may execute WebGPU from a worker. `OffscreenCanvas` is used when canvas ownership is moved off the main thread.
- Use **SharedArrayBuffer + Atomics** for bounded shared-memory queues such as high-frequency pointer samples and renderer commands when the measured latency/throughput benefit justifies shared state.
- Use **Transferable objects** instead of cloning large transferable payloads.
- Shared-memory paths require cross-origin isolation. Production deployment must therefore configure compatible COOP/COEP policy and verify `crossOriginIsolated` at runtime.
- External assets/dependencies must be hosted or served with policies compatible with the cross-origin-isolation contract; prefer self-hosted critical assets to avoid making the renderer depend on incompatible third-party responses.

### Cross-context coordination

- Use **Web Locks** to coordinate exclusive project write ownership across tabs/workers.
- Use **BroadcastChannel** for same-origin notifications such as project-open state, save status, rename/status propagation, or read-only transitions.
- Do not rely on multiple tabs independently writing the same project state without a coordination lock.

### CPU acceleration

- Keep CPU-heavy algorithms behind interfaces that permit TypeScript/JavaScript and WebAssembly implementations.
- **WebAssembly SIMD and threads** are optimization backends for measured hotspots such as flood fill, contour/selection processing, resampling, compression, or geometry work; they are not mandatory implementation languages for the whole application.

### Algorithm and reference-implementation reuse policy

Illustro should actively avoid re-inventing mature image-processing and computational-geometry algorithms when reliable public work already exists.

- Search established papers, specifications, standards, public-domain implementations and open-source projects before inventing a new algorithm for mature problems such as filtering, resampling, flood fill, contour extraction, morphology, path geometry, image transforms, graph algorithms, caching and compression.
- **Algorithms/concepts may be independently reimplemented** for Illustro when appropriate. Reimplementation should target Illustro's own data model, WebGPU/WGSL, TypeScript or WASM architecture rather than mechanically preserving another project's code structure.
- Direct code incorporation requires an explicit license check before merge. Prefer **public-domain/CC0, MIT, BSD-family and Apache-2.0** code for reusable core implementation when technically suitable.
- Preserve all required attribution, copyright notices, license texts and NOTICE obligations for incorporated third-party code/assets.
- Strong-copyleft code such as GPL/AGPL, source-available code, or proprietary source must **not be copied into the core by default**. It may be studied as a reference for behavior/algorithm understanding, but direct reuse requires an explicit project-level licensing decision and compliance review first.
- Do not assume that "source visible on the Internet" means "free to copy". Copyright/license terms remain authoritative for source-code expression even when the underlying algorithm or mathematical idea is independently implementable.
- For format interoperability, prefer public specifications/documented behavior and clean independent parsers/converters. Unsupported or uncertain proprietary-format semantics must be surfaced explicitly rather than guessed into silent data loss.
- Maintain implementation provenance for materially reused third-party code/algorithms: source/project, source URL or publication identifier, version/commit where relevant, license, what was reused versus independently reimplemented, modifications, and required notices. This record may live in auxiliary third-party-notice/provenance files, while this memo remains the canonical policy.
- Third-party/reference implementations are inputs to engineering judgment, not automatic truth. Compare behavior, test against Illustro requirements, and replace unsuitable implementations rather than inheriting accidental limitations.

### Lifecycle and observability

- Treat page visibility/lifecycle changes as persistence and resource-management signals: flush/queue critical state, reduce unnecessary GPU work while hidden, and restore state safely when returning.
- Use **PerformanceObserver** and explicit application timings/counters for development and diagnostic telemetry around input latency, frame time, tile I/O, autosave, cache behavior, dropped/coalesced input, and long tasks where measurable.
- Screen Wake Lock may be exposed as a user setting for long drawing sessions; the editor must continue to behave correctly if the lock is unavailable or revoked.

# Data Model / File Format

## Phase 3 Data / Format Closure — 2026-08-30

**Status:** authoritative Phase-3 specification. This closes K/L/M/N/O/P/T: canonical document data model, layer model, brush/resource schema, Undo/Redo transaction model, native `.illustro` v1 archive, initial-release color pipeline, and import/export/interoperability contracts. Numeric tile/cache/performance budgets and OPFS runtime layout remain Phase 4 decisions; visual/icon/texture/motion choices F/G/H/I/V remain unfrozen.

### P3-1. Canonical state boundaries — CLOSED

Illustro separates four kinds of state and never conflates them:

1. **Canonical document state** — everything required to reproduce the editable artwork deterministically.
2. **Project metadata/state** — project name, timestamps, preview references, compatibility/provenance metadata and project-local settings that are not pixel content.
3. **Workspace/session state** — active tool, panel positions, Quick Hole bindings, zoom/rotation, current selection presentation, focused field and other UI state. This is not document Undo state unless an operation explicitly changes artwork.
4. **Derived/cache state** — GPU textures, thumbnails, mip/previews, extracted Lineart caches, effect caches and decoded resource caches. These may be discarded and rebuilt without changing the document.

GPU resources are never canonical. A valid project must be reconstructible from canonical CPU/storage data after renderer loss.

### P3-2. Identity, revisions and references — CLOSED

- Every persistent semantic entity uses a locale-neutral **UUID string**. New runtime-created IDs use cryptographically random UUIDs (`crypto.randomUUID()` or an equivalent standards-compliant generator).
- IDs are stable for the lifetime of the semantic entity. Copy/Duplicate creates new IDs unless the operation explicitly represents a reference to the same entity.
- Mutable canonical entities also carry a monotonically increasing non-negative integer `revision` within JavaScript safe-integer range. Revisions are comparison/invalidation counters, not globally unique IDs.
- References use IDs, never array indexes, localized names or UI positions.
- Missing required references are validation errors; optional references may be null. Importers may construct temporary staging IDs but must resolve them before canonical commit.
- Content-addressed binary resources additionally carry a lowercase SHA-256 hex `contentHash`; resource identity and content identity are distinct so metadata can change without changing bytes.

### P3-3. Canonical Document root — CLOSED

The conceptual `DocumentV1` root contains at least:

```text
DocumentV1
  schema: "illustro.document/1"
  documentId: UUID
  projectId: UUID
  revision: integer
  createdAt / modifiedAt: RFC3339 UTC timestamps
  canvas: CanvasSpec
  color: DocumentColorSpec
  layerTree: LayerTree
  resources: ResourceTable
  guidesAndRulers: GuideRulerState
  documentSettings: DocumentSettings
  featureFlags: required/optional feature IDs
  extensions: namespaced extension records
```

`CanvasSpec` contains logical pixel width/height, resolution metadata (PPI; metadata only unless an explicit physical-size operation uses it), background/display checker policy, and document bounds. Canvas dimensions are positive bounded integers validated before allocation.

The document does **not** serialize transient GPU handles, DOM state, browser object URLs, FileSystemHandle permission state, active pointer contacts or unresolved UI widgets.

### P3-4. Layer tree and common layer contract — CLOSED

The layer tree is an ordered rooted hierarchy. Every layer has a common base:

```text
LayerBaseV1
  id: UUID
  type: LayerTypeId
  revision: integer
  parentId: UUID | null
  name: string
  visible: boolean
  opacity: 0..1
  blendMode: BlendModeId
  locks: { all, pixels, alpha, position }
  clipping: ClippingSpec | null
  roleFlags: { reference, draft }
  masks: ordered MaskAttachment[]
  transformStack: TransformNode[]
  effectStack: EffectNode[]
  boundsHint: optional derived/cached bounds
  metadata: namespaced records
```

`boundsHint` is an optimization and may be recomputed. Layer ordering is represented explicitly by the parent's child-ID list, not inferred from IDs.

### P3-5. Initial-release layer types — CLOSED

The canonical `LayerTypeId` set is:

- `raster` — sparse canonical pixel tiles.
- `vector` — editable paths/shapes and vector style data; this does not introduce vector brush/eraser semantics.
- `text` — editable point/box text runs, layout box, typography and transform; rasterization is explicit.
- `fill` — parametric solid/pattern fill layer.
- `gradient` — parametric linear/radial/conical/freeform gradient layer.
- `adjustment` — ordered parameterized effect operation without intrinsic artwork pixels.
- `folder` — ordered child container. Folder blend semantics include the adopted Pass Through mode.
- `linkedObject` — embedded/snapshotted external-object representation with optional external-source linkage metadata.
- `lineartBoundary` — non-rendering derived/manual topology payload and semantic overrides; valid only in the Lineart system.

A **Lineart Group** is represented by a `folder` carrying `role = "lineart-group"`, configured source membership, and one canonical `lineartBoundary` child. It is not a separate incompatible tree implementation.

### P3-6. Masks, clipping and transforms — CLOSED

Masks are ordered attachments to eligible layers/folders rather than free-floating top-level artwork layers. Initial mask attachment kinds are:

- `raster-mask` — sparse single-channel coverage tiles;
- `vector-mask` — editable path coverage;
- `effect-mask` — coverage associated with a non-destructive effect/adjustment when required.

Each mask has its own UUID/revision, enabled state, invert state and transform where semantically valid.

Clipping references a deterministic eligible preceding/base layer relationship in the same compositing group. The canonical model stores the resolved semantic relationship, not only a UI checkbox.

`transformStack` is non-destructive and may contain affine, perspective, mesh and puppet/deformation nodes. Preview handles are transient; committed transform parameters are canonical. Explicit rasterize/apply bakes a transform and removes/replaces the corresponding node in one history transaction.

### P3-7. Raster tile semantics — CLOSED

Raster layers and raster masks are sparse maps keyed by integer tile coordinates. Exact tile dimensions are Phase 4 benchmark decisions, but semantics are fixed now:

- absent artwork tile = fully transparent zero content;
- absent full-white raster mask tile = full coverage and may be represented by a mask-level default value rather than materialized bytes;
- tile coordinates are document-space integer indices and are independent of viewport zoom;
- canonical tile sample format follows the document precision mode defined in P3-15;
- canonical tile bytes are never GPU-compressed texture formats;
- edits create new tile revisions; caches identify tile content by layer/mask ID + coordinate + revision/quality inputs;
- edge/halo pixels used by filters are derived working data, not duplicated canonical artwork.

### P3-8. Linked object contract — CLOSED

A `linkedObject` always contains an **embedded canonical snapshot/subdocument sufficient for project round-trip correctness**. It may additionally remember an external source descriptor (original filename, format, source hash, optional permission-capable file handle reference in runtime storage), but loss of external permission/file must not destroy the project.

External refresh is explicit and history-aware: detect source change → stage/validate → preview/report incompatibilities → Commit creates one document transaction. Illustro never silently replaces the embedded canonical snapshot merely because an external file changed.

### P3-9. Resource Table and production-asset schema — CLOSED

All reusable binary/user resources are referenced through `ResourceTableV1` entries:

```text
ResourceV1
  resourceId: UUID
  revision: integer
  kind: brush-tip | grain | pattern | reference-image | palette | gradient | font-ref | imported-source | other
  contentHash: SHA-256
  mimeType: string
  byteLength: integer
  originalName: optional string
  dimensions/channels: optional typed metadata
  colorSpace: none | srgb | display-p3 | embedded-profile | data
  channelSemantics: rgba | rgb | luminance | alpha | coverage | data
  seamless: boolean | unknown
  provenance: ProvenanceV1
  extensions: namespaced records
```

Binary bytes are deduplicated by `contentHash`; separate Resource entries may point to the same bytes while carrying different semantic metadata.

`ProvenanceV1` records at least source class (`builtin`, `user-created`, `user-imported`, `third-party`), source name/URL/publication when applicable, version/commit when applicable, license/SPDX identifier or `user-supplied/unknown`, attribution/NOTICE requirements, whether bytes/code were directly reused versus independently recreated, and modification notes. User-created/imported private artwork does not require the user to invent a public license.

### P3-10. Brush/image asset representation — CLOSED

The canonical resource model supports the later I/J production-asset phase without choosing the actual visual textures yet.

**Brush tip source assets**:
- raster source with explicit `coverage`/`alpha` semantics;
- arbitrary rectangular dimensions are representable; production presets should normally use centered assets and practical power-of-two-friendly sizes, but the schema does not require square images;
- PNG is the preferred authored interchange source for generated/built-in tips; imported formats are normalized to canonical decoded coverage data plus provenance;
- 8-bit and 16-bit authored coverage sources are accepted; runtime/GPU representation may differ without changing brush semantics.

**Grain/paper/pattern assets**:
- luminance/coverage or RGB/RGBA data as required by the preset;
- explicit seamless flag and repeat/transform metadata;
- explicit color-space/data classification so numeric texture data is never accidentally color-managed as artwork.

**Thumbnails** are derived presentation assets and never define brush behavior.

Phase I will decide the concrete built-in texture images, resolutions and artistic appearance; those choices must fit this schema rather than changing the engine contract.

### P3-11. Canonical Brush Schema v1 — CLOSED

Illustro-native brushes use `schema = "illustro.brush/1"`. A preset contains stable identity/metadata plus the canonical engine parameters below.

```text
BrushPresetV1
  id / revision / name / category / tags
  behavior: paint | erase | smudge | blur
  defaultSizePx
  tip
  stroke
  ink
  dynamics
  jitter
  spray
  texture
  colorMix
  antiOverflow
  stabilization
  antiAlias
  provenance/importCompatibility
  extensions
```

#### Tip

`tip` defines an ordered set of one or more tip-resource references, selection mode (`fixed`, `sequence`, `random-per-stamp`), base scale, aspect/roundness, rotation, center/origin and optional per-tip weight. Multiple source tip images are allowed as alternatives in one stamp generator; **two independently rendered brushes composited as Dual Brush remain excluded**.

#### Stroke placement

`stroke` defines spacing as a ratio of effective tip diameter, continuous/interpolated placement policy, direction-following rotation, start/end taper, minimum stamp distance and stroke-seed policy. Every committed stroke stores a deterministic random seed when any randomized behavior is active.

#### Ink

`ink` defines base opacity, flow/deposit, buildup/accumulation policy, selected paint blend behavior and main/sub-color contribution. Eraser uses the same stamp/dynamics path with erase semantics rather than a separate incompatible engine.

#### Generic dynamics

Every dynamically mappable scalar uses a common `DynamicMappingV1`:

```text
baseValue
sources[] where source = pressure | tilt | altitude | azimuth | twist | velocity | direction | strokeProgress | random
curve: normalized control points
amount: signed scalar
combine: multiply | add | replace
clamp: min/max
```

Supported dynamic targets include at minimum size, opacity, flow, rotation, roundness/aspect, scatter, spacing, texture strength, color jitter and color-mix parameters where meaningful. Missing device inputs evaluate to the parameter's neutral/default value rather than making the brush unusable.

#### Jitter and spray

`jitter` defines normalized/randomized position, size, rotation, opacity and main/sub or hue/saturation/value variation. `spray` defines enabled state, particle count/rate, radial scatter distribution, particle scale/orientation and seed behavior.

#### Texture/grain

`texture` references a Resource, with scale, rotation, offset/phase, movement space (`canvas`, `stroke`, `stamp`), strength/depth and supported combination mode. No texture field may implicitly change document color space.

#### Digital color mixing

`colorMix` is deliberately digital rather than a physical pigment/fluid simulator. It contains enabled state, sample/pickup radius, pickup amount, carry/drag amount, source-vs-brush mix ratio and deposit amount. The sampled/mixed color is deterministic from canonical canvas samples and stroke history inputs.

#### Stabilization/correction and anti-aliasing

`stabilization` contains realtime stabilization amount, correction/smoothing mode and post-stroke correction parameters where supported. `antiAlias` is an explicit enum/quality policy understood by the renderer; imported values that cannot be represented exactly are reported by FC-2 compatibility logic.

#### Import extensions

Unsupported proprietary source fields are **not** copied into active canonical parameters. The preset may retain an opaque original-source blob/resource and a namespaced compatibility report for provenance/re-export diagnostics, but rendering uses only understood canonical fields.

### P3-12. Native brush package — CLOSED

Illustro brush sharing uses `.illbrush` v1, a ZIP/ZIP64 package containing UTF-8 `manifest.json`, `brush.json`, required content-addressed tip/grain/pattern resources, optional preview, and per-entry SHA-256 metadata. It uses the same `BrushPresetV1` and `ResourceV1` semantics as projects. A brush package cannot execute code.

### P3-13. Undo / Redo transaction model — CLOSED

Document history is a linear **committed transaction spine** with a current cursor.

- One user intent normally produces one history transaction.
- Pointer samples/stamps inside one brush stroke are not individual Undo entries; pointer-down through committed stroke end is one transaction.
- Transform/effect/Color Match previews are ephemeral; Commit creates one transaction, Cancel creates none.
- Continuous slider/scrub edits coalesce from interaction start to interaction end into one logical transaction unless the user explicitly creates separate commits.
- An Auto Action may group multiple eligible commands into one composite transaction when atomicity is declared; otherwise it emits its declared deterministic transaction sequence.
- Undo moves the cursor backward by restoring the exact previous canonical state for that transaction; Redo reapplies the exact committed after-state.
- Performing a new document mutation while the cursor is not at the history tip invalidates the active Redo branch. Obsolete spill data may be garbage-collected later.
- Workspace/UI changes do not enter document history.
- Autosave/checkpoint does not clear Undo/Redo.

### P3-14. Hybrid history payload strategy — CLOSED

History does not depend on replaying high-level commands from scratch. Each transaction stores enough exact before/after information for deterministic restoration.

Use a hybrid strategy by mutation class:

- metadata/property/tree operations: compact typed before/after records or invertible structural deltas;
- raster/mask painting: changed-tile patches using copy-on-write tile revisions and before/after tile references or lossless deltas;
- large destructive raster operations: snapshot/revision references when cheaper/safer than enormous inverse command streams;
- vector/text/parametric/effect edits: typed before/after object payloads with structural sharing;
- Lineart topology/regeneration: exact graph revision/delta plus semantic override state required by FC-5;
- document resize/crop/color-mode conversion: explicit transaction snapshots/references sufficient to restore exact pre/post canonical content.

Recent history remains in a bounded hot in-memory tier; older eligible payloads spill to OPFS. **Numeric memory/spill thresholds are Phase 4 performance decisions**, but correctness may never depend on a history payload remaining resident in RAM.

Normal local working projects preserve the bounded retained Undo spine across ordinary app restarts when the retention data is still available. Exported `.illustro` archives do **not** include the live Undo journal by default; history inclusion is an explicit export option if later exposed. Timelapse data is a separate representation and is not treated as Undo storage.

### P3-15. Document color modes and precision — CLOSED

Initial release document working spaces are:

- `srgb` — sRGB primaries/white point/transfer semantics;
- `display-p3` — Display-P3 primaries with D65 and the standard Display-P3/sRGB-style transfer function.

Canonical raster precision modes are:

- `rgba8-unorm` — 8 bits per component normalized RGBA;
- `rgba16-float` — IEEE-754 binary16 RGBA canonical samples for higher precision/extended intermediate range.

**Default new document:** `srgb + rgba8-unorm` for broad interoperability and tablet memory efficiency. Users may explicitly create/convert to Display-P3 and/or 16F. Precision or working-space conversion is a document transaction and never occurs silently.

Canonical file/pixel semantics use **straight/unassociated alpha**. Renderer/compositor working buffers may use premultiplied alpha as an implementation detail, but conversion at canonical boundaries must be exact enough to avoid accumulating hidden alpha errors.

### P3-16. Color-processing semantics — CLOSED

- Every color-bearing value knows its source/working color space; legacy/imported untagged RGB is handled by the import policy rather than silently reinterpreted as wide-gamut.
- ICC/profile-aware imports convert recognized source RGB into the document working space before canonical commit, preserving the original profile/source as provenance where useful.
- Unsupported profiles trigger explicit convert/warn/reject UX under FC-4.
- Resampling, blur, convolution, physically additive light operations and other operations whose correctness requires linear-light math operate on linearized working RGB.
- Photoshop/W3C-style artistic layer blend functions are evaluated deterministically in the document's transfer-encoded working RGB domain unless that specific effect is explicitly defined as linear-light; alpha composition uses mathematically correct premultiplied working values.
- Color-space conversion, profile conversion and gamut mapping are centralized services shared by import, document conversion, preview and export; tools do not implement private inconsistent conversions.
- Display output requests the matching web canvas/output color space when supported. When the platform cannot present the document gamut directly, preview converts to a supported output space while preserving canonical document samples.
- Alpha/mask/coverage/data channels are not color-managed.

### P3-17. Native `.illustro` v1 container — CLOSED

The external/native project file is a **standard ZIP64-capable archive** with extension `.illustro`. ZIP is a transport/container, not the live OPFS database layout.

Required top-level entries:

```text
mimetype
manifest.json
document.json
layers/<layerId>/...
assets/<sha256>...
```

Optional/conditional namespaces include:

```text
objects/<objectId>/...
preview/...
timelapse/...
provenance/...
extensions/<namespace>/...
```

`mimetype` contains `application/x-illustro-project+zip` and should be stored uncompressed for fast identification.

`manifest.json` includes at least archive schema/version, project/document IDs, creation/modification timestamps, required/optional feature flags, document entry path, and an entry index containing uncompressed size, stored size/codec where known and SHA-256 for canonical/required payloads.

`document.json` contains the canonical root/tree/resource references but not large binary tile bytes.

### P3-18. `.illustro` layer/resource encoding — CLOSED

- Typed layer metadata/payloads use versioned UTF-8 JSON unless a defined binary payload is materially more appropriate.
- Raster/mask tiles are stored losslessly. V1 canonical tile entries use raw little-endian sample bytes matching the declared canonical pixel format, compressed by the ZIP entry's lossless method when beneficial. This preserves `rgba16-float` exactly and avoids making PNG/JPEG semantics part of the project model.
- Tile entry metadata records coordinate, dimensions for edge tiles, pixel format, byte order and expected byte length.
- Binary reusable assets are stored content-addressed under `assets/` and verified against `ResourceV1.contentHash`.
- A linked object's embedded canonical snapshot/subdocument is stored below its `objects/<objectId>/` namespace; an original imported source blob may additionally be retained as a Resource when policy/storage allows.
- Preview thumbnails are explicitly non-canonical; corruption/loss of a preview must not invalidate otherwise intact artwork.

The internal OPFS representation may use a different benchmark-selected tile codec/index because Phase 4 optimizes live working storage. Import/export converts between live storage and the stable archive contract.

### P3-19. Versioning, corruption and forward compatibility — CLOSED

- Archive version is semantic `major.minor`; v1 readers must reject unsupported future major versions for writable editing rather than guessing.
- Unknown optional fields are ignored/preserved where practical through namespaced `extensions` records.
- Unknown **required feature flags** prevent writable open and produce an explicit compatibility report; safe metadata/preview/recovery extraction may still be offered.
- Every required canonical payload is checksum-verified before being trusted. A mismatch marks the archive damaged; Illustro attempts bounded recovery only from independently valid entries/checkpoints and reports what was recovered.
- Import is staged. Canonical project state is created/changed only after required validation succeeds.
- Schema migrations are explicit deterministic transforms from an older supported version to the current internal model; the original external file remains untouched unless the user explicitly overwrites/re-exports.

### P3-20. Import contract — CLOSED

All imports follow: **decode → validate → normalize/profile-convert → build staging model → compatibility report when needed → user acceptance when materially lossy → canonical commit**.

Initial-release import classes:

- `.illustro` — required full-fidelity native project import for supported schema/features.
- PNG — flattened raster image with alpha/profile/metadata handling where present.
- JPEG — flattened opaque raster image with profile/metadata handling where present.
- SVG — supported paths/shapes/text/images normalized into vector/text/raster resources where representable; unsupported SVG features are explicitly rasterized, approximated or rejected with a report.
- PSD — bounded-fidelity layered import defined below.
- ibisPaint brush QR and CSP `.sut` — FC-2 version-scoped brush import into staging `BrushPresetV1` plus fidelity report.
- `.illbrush` — native full-fidelity supported brush/resource import.
- ordinary image files may also be imported as raster layers/reference images through the corresponding command context.

No import parser may mutate the open document incrementally before validation reaches its canonical-commit boundary.

### P3-21. PSD bounded-fidelity matrix — CLOSED

PSD support is **feature-class based, test-corpus verified, and never advertised as universal Photoshop round-trip fidelity**.

Required direct mappings when source data is valid and the corresponding Illustro feature exists:

- canvas dimensions/resolution metadata;
- raster layers and pixel alpha;
- layer names, order, visibility and opacity;
- folders/groups;
- common blend modes present in Illustro's adopted blend registry;
- raster masks and basic clipping relationships;
- supported text that can be represented by Illustro text runs/layout when required fonts/metrics are available;
- supported vector/path data when representable;
- supported adjustment/effect semantics when an equivalent canonical effect exists.

Potentially lossy classes must be identified individually in the compatibility report and either mapped approximately with user-visible status, rasterized/flattened at an explicit boundary, or left unsupported. This includes Photoshop-specific Smart Object behavior, layer styles/effects without an Illustro equivalent, unsupported adjustment semantics, advanced text/layout features, unsupported color modes, proprietary metadata and other Photoshop-only constructs.

Illustro-only structures with no PSD equivalent — Lineart Boundary semantic graphs, live Undo journal, Quick Hole/workspace state, Illustro brush-engine metadata, Auto Actions and similar app-specific data — are not silently encoded as if Photoshop could round-trip them. PSD export must warn when such editable semantics would be lost.

The release gate uses a maintained PSD fixture corpus covering every **claimed** mapping class; a newly observed PSD variant is not considered supported until added to that matrix/tests.

### P3-22. Export contract — CLOSED

All exports follow: **preflight → explicit loss/profile/flattening decisions → full-quality canonical render/serialization → temporary output → finalize → success/failure result**. Export failure never marks the project as backed up.

Initial-release exports:

- `.illustro` — canonical full-fidelity supported project archive.
- PNG — flattened full-quality image; alpha optional/preserved when requested; 8/16-bit integer output variants may be offered where the encoder supports them, with explicit conversion from 16F/extended values.
- JPEG — flattened opaque image with explicit background handling and quality setting; alpha is never silently discarded without flatten/background semantics.
- SVG — preserves supported vector/path/text/gradient content where possible; raster layers or unsupported effects may be embedded/rasterized with preflight disclosure.
- PSD — layered bounded-fidelity export according to P3-21, with mandatory preflight when adopted Illustro semantics cannot be represented.
- `.illbrush` — native brush package.
- Timelapse media — separate task using canonical timelapse history; it is not a project backup.

Export color options always state output color space/profile and required conversion. Unsupported/unsafe combinations are blocked or require an explicit supported conversion; no export changes canonical document color merely to satisfy a file format.

### P3-23. Image/metadata and fidelity reporting — CLOSED

Compatibility/preflight reports use structured machine-readable issue records plus localized presentation. Each issue contains at least:

- stable issue code;
- severity (`info`, `warning`, `lossy`, `unsupported`, `error`);
- source object/path when identifiable;
- source semantic/format feature;
- chosen mapping (`exact`, `converted`, `approximated`, `rasterized`, `flattened`, `ignored`, `rejected`);
- resulting Illustro object when applicable;
- localized explanation/remediation key.

Reports are preserved with project/import provenance when useful so the user can later inspect how imported material was normalized.

### P3-24. Phase 3 completion result — CLOSED

The following previously open implementation decisions are closed:

1. canonical document identity/state model;
2. initial-release layer/mask/linked-object representation;
3. Resource/asset/provenance schema sufficient for later generated textures and brush assets;
4. versioned Canonical Brush Schema and `.illbrush` package;
5. Undo/Redo transaction and hybrid delta/snapshot strategy;
6. initial document RGB/precision modes and deterministic color-processing boundaries;
7. `.illustro` v1 ZIP64 archive structure, checksums and migration rules;
8. import/export staging/preflight rules, native/image/SVG/PSD/brush interoperability boundaries and structured fidelity reporting.

Phase 3 intentionally leaves **tile dimensions/cache budgets/performance numbers and live OPFS layout** to Phase 4, because those require benchmark/runtime policy rather than changing canonical semantics. It also leaves F/G/H/I/V appearance/assets/motion to the later joint-design phases. This is not the final global Design Freeze.

### Phase 3 change-log entry

- 2026-08-30: Closed Phase 3 internal data/interchange design: defined UUID/revision-based canonical document and layer models, sparse raster semantics, resource/provenance and canonical brush schemas, hybrid exact Undo/Redo transactions, sRGB/Display-P3 with RGBA8/16F document modes, ZIP64-based `.illustro` v1 and `.illbrush`, and staged/preflighted PNG/JPEG/SVG/PSD/brush import-export contracts with explicit fidelity reporting.

# Rendering / Brush / Performance

# Phase 4 Renderer / Performance / Persistence Closure — 2026-08-30

**Status:** authoritative Phase-4 specification. This closes Q/R/S and the remaining renderer/storage numeric decisions: WebGPU baseline limits, execution topology, canonical tile geometry, dirty/dependency scheduling, cache/memory budgets, input/render queues, canvas admission limits, performance targets, live OPFS layout, journal/checkpoint/autosave behavior, Undo spill retention, quota-pressure policy, and device/storage recovery. F/G/H/I/V visual/icon/asset/motion work remains intentionally unfrozen, and release criteria/testing orchestration remain Phase 7.

## P4-1. WebGPU baseline capability profile — CLOSED

The initial full editor requests **core WebGPU**, not compatibility mode. Illustro deliberately avoids requiring limits above the WebGPU core defaults for its baseline renderer.

Minimum full-editor adapter/device profile:

- core WebGPU adapter/device successfully acquired;
- `maxTextureDimension2D >= 8192`;
- `maxBufferSize >= 268435456` bytes (256 MiB);
- `maxStorageBufferBindingSize >= 134217728` bytes (128 MiB);
- `maxUniformBufferBindingSize >= 65536` bytes;
- `maxBindGroups >= 4`;
- `maxComputeInvocationsPerWorkgroup >= 256`;
- all other core limits at least the current WebGPU core defaults required by the pipelines actually instantiated.

No optional WebGPU feature is an initial-release runtime requirement. `shader-f16`, texture-compression features and elevated limits are optimization paths only. `requestDevice()` requests only the elevated limits a selected implementation path truly needs; baseline code must remain valid at the core defaults.

Capability values are treated as tiered/fingerprinting-limited reports rather than exact physical-GPU specifications. Runtime calibration and measured behavior therefore participate in performance-profile selection.

Reference basis at closure: WebGPU core defaults specify 8192 for 2D texture dimension, 256 MiB for maximum buffer size and 128 MiB for a storage-buffer binding; browser-reported adapter limits may be tiered rather than exposing exact hardware maxima.

## P4-2. Execution topology and ownership — CLOSED

The default production topology is:

- **Main thread:** DOM/UI, accessibility tree, lightweight pointer capture/arbitration, command dispatch, task surfaces and presentation state.
- **Render Worker:** owns OffscreenCanvas/WebGPU device when the qualifying browser exposes worker WebGPU reliably; owns render graph, GPU caches, compositing and GPU compute scheduling.
- **Storage Worker:** owns OPFS high-throughput access, SyncAccessHandles, journal/checkpoint publication, history spill, garbage collection and project storage metadata.
- **Compute Worker pool:** CPU/WASM-heavy non-GPU tasks such as contour/fill geometry, compression, parsing and format conversion where parallelism helps.

Render Worker ownership is preferred, but **worker WebGPU is not a second product gate beyond core WebGPU**. If a Tier-A browser has qualifying core WebGPU only on the main execution context, the renderer may run on the main thread provided all Phase-4 performance and responsiveness gates still pass; storage remains off-main-thread.

Compute-pool worker count starts at `clamp(hardwareConcurrency - 2, 1, 4)` when the signal is available, otherwise 1. It may shrink under memory/performance pressure. Render and Storage workers are not counted in this pool.

SharedArrayBuffer paths are enabled only when `crossOriginIsolated` is true. Transferable-message fallback remains functionally complete for environments where shared memory is unavailable but the rest of the Tier-A gate passes.

No synchronous OPFS operation, format encode/decode, shader compilation wait, or large buffer copy is allowed to block the main UI/input loop.

## P4-3. Canonical tile geometry — CLOSED

The initial-release canonical raster/mask tile core is **256 × 256 logical pixels**.

- Tile coordinate `(tx, ty)` maps to document pixels `[tx*256, (tx+1)*256)` × `[ty*256, (ty+1)*256)` clipped at document bounds.
- Edge tiles carry their valid width/height but retain the same coordinate grid.
- Canonical artwork stores only the 256-pixel core; filter halos, mip levels, antialias guard pixels and atlas padding are derived cache state.
- One full RGBA8 tile is 262144 bytes before compression; one full RGBA16F tile is 524288 bytes.
- Raster-mask canonical payloads use one logical coverage channel and are not expanded to RGBA merely for persistence.
- Tile size is part of the v1 internal/runtime contract for the initial implementation. A future change requires an explicit migration/runtime-version decision; it is not silently selected per document.

256 is chosen as the balance between dispatch/index overhead, localized dirty updates, brush locality and cache granularity. The renderer may batch many tiles in one GPU dispatch without changing canonical tile identity.

## P4-4. GPU tile cache, atlases and dirty scheduling — CLOSED

Resident canonical/render tiles are cached in GPU **atlas pages** rather than relying on one GPU texture object per document tile.

- Baseline atlas page: **2048 × 2048 pixels**, giving an 8 × 8 grid of 256-pixel core slots before any atlas-specific padding policy.
- RGBA8 atlas page payload is approximately 16 MiB; RGBA16F approximately 32 MiB before implementation overhead.
- Atlas allocation is incremental; cache budgets are soft caps and are never preallocated wholesale.
- Temporary filter/halo targets are separate transient resources and do not change canonical atlas contents.

Every mutable raster/effect node tracks dirty tile coordinates plus an optional per-tile dirty rectangle. Dirty rectangles union during a transaction; once the union covers **>= 50% of a tile core**, the tile is treated as wholly dirty to reduce bookkeeping.

### Active-stroke incremental rendering invariant — AUTHORITATIVE

This rule constrains the production M6A Canonical Brush Engine and its renderer integration. It supplements the sparse-tile/dirty-region architecture above; it does not require the earlier M4 baseline vertical slice to already be the final optimized implementation.

- **No whole-stroke replay on the normal hot path.** When a pointer/input batch contributes newly confirmed samples, the normal presentation path processes only the newly required sample/interpolation/dab work plus a bounded dependency tail. It must not regenerate or rerasterize the already-stable prefix simply because the stroke has become longer.
- **No whole-document brush-history replay on the normal hot path.** Previously committed strokes may remain in canonical history/persistence structures, but adding or previewing a new brush segment must not flatten/re-submit every historical dab/stroke merely to reconstruct the current frame. Retained raster/tile/atlas state is the normal presentation source.
- **Stable prefix + mutable tail.** Stabilization, smoothing, interpolation, prediction reconciliation or other algorithms that need look-ahead may keep a bounded mutable tail. The tail bound is determined by the selected algorithm/brush semantics and must not grow with total stroke duration. Samples/dabs older than that dependency window become a stable prefix and are not normally revisited.
- **Incremental dirty work.** Newly stable dabs/coverage invalidate only the raster tiles and dirty rectangles they can affect, including any explicitly required halo/dependency region. Unaffected tiles remain reusable. A local brush update must not invalidate unrelated visible or off-screen tiles.
- **Predicted input remains provisional.** Predicted samples may be redrawn/replaced as confirmed input arrives, but prediction must not force already-confirmed stable stroke content back into the mutable/replay set. Prediction state is not canonical history.
- **Hot-path complexity invariant.** With the same brush, local geometry, newly delivered sample count and affected-tile count, per-batch CPU preparation, transfer/submission volume and GPU brush work should remain approximately independent of the number of dabs in the already-stable stroke prefix and of unrelated committed strokes. An implementation whose ordinary pointer-move cost is O(total active-stroke dabs) or O(total document brush-history dabs) violates this invariant even if WebGPU masks the issue on fast hardware.
- **Allocation discipline.** Production rendering should reuse/batch GPU and transfer resources where practical. Repeated allocation/copy/destruction whose size is proportional to the entire accumulated stroke is not an acceptable substitute for incremental submission. Exact ring-buffer/pool/batch strategy remains benchmark-driven.
- **Full replay is exceptional, not interactive presentation.** Replay/reconstruction is permitted for explicit recovery, device-loss rebuild, canonical-state verification, migration, export paths that require it, or other deliberate reconstruction operations. Such work must be scheduled separately from the ordinary low-latency pointer hot path and should use tile/checkpoint/cache state where available.
- **Undo/Redo correctness is separate from presentation cost.** History may store stroke commands, tile deltas, snapshots or equivalent canonical information. Undo/Redo may invalidate/reconstruct the tiles actually affected by the transaction; preserving exact history does not justify replaying all history every frame.
- **M6A verification requirement.** Before the Canonical Brush Engine is marked internally complete, include a long-stroke scaling workload that holds newly delivered work approximately constant while increasing the already-confirmed prefix. Instrument at least generated/reprocessed dabs, affected tiles/dirty area, CPU preparation/submission time and GPU submission/work counters where measurable. The result must demonstrate that stable-prefix length does not cause linear whole-prefix replay on ordinary pointer updates.

The M4 baseline renderer may continue to exist temporarily as a correctness/reference implementation while M5A–M5D proceed, but it must not be promoted unchanged as the final M6A production brush path if it clears/rebuilds the presentation from cumulative active/committed dab history on each update.

Work scheduling uses four priorities:

1. **P0 — interaction critical:** active stroke, transform handles, cursor-local preview and tiles required for the current frame.
2. **P1 — visible convergence:** currently visible dirty full-quality tiles and visible dependency ancestors.
3. **P2 — near viewport:** neighboring tiles/mips likely to become visible during navigation.
4. **P3 — background:** off-screen effect convergence, thumbnails, prefetch and non-urgent cache work.

P0 work can pre-empt P2/P3 scheduling. Storage/checkpoint work never holds a renderer lock required to produce P0 feedback.

Pan/zoom/rotation of already-rendered content changes the viewport transform and sampling path; it does **not** rerasterize document content merely because the view moved. Per-tile mip chains are derived lazily for zoomed-out presentation and may be discarded under pressure.

## P4-5. Compositing/effect dependency planner and seam policy — CLOSED

Layer/folder/effect compositing is evaluated as a revision-keyed tile dependency graph.

- Cache keys include node/layer identity, relevant revision(s), tile coordinate, color/precision mode, quality level and effect parameters that affect output.
- A source edit invalidates only affected downstream tile dependencies unless an operation is explicitly global.
- Folder/pass-through, clipping, masks and adjustment/effect dependencies participate in the same planner; there is no separate inconsistent full-canvas compositor.

Neighborhood filters request an exact logical **halo/support radius** from the effect implementation.

- Direct single-tile working surfaces may use halos up to **64 px per side** around a 256 core.
- Wider support is not clipped. The planner instead uses separable passes, multi-scale/downsampled algorithms, or expanded multi-tile dependency regions appropriate to the effect.
- Every filter implementation has seam tests comparing tiled output against a trusted untiled/reference evaluation on representative boundaries.
- Resampling/transform operations include the mathematical reconstruction support required by the selected kernel; Lanczos/bicubic support is never truncated at a tile edge merely to fit a cache slot.
- Global-statistic operations use reduction passes/cache nodes; interactive approximation is allowed only under the existing preview policy and must converge to canonical full-quality values.

No visible seam, halo truncation or tile-coordinate discontinuity is an acceptable performance tradeoff in final-quality output.

## P4-6. Adaptive memory/cache budgets — CLOSED

Illustro uses three **soft** runtime cache profiles. These numbers are ceilings for resident cache working sets, not amounts allocated at startup.

| Budget | Conservative | Standard | Large |
| --- | ---: | ---: | ---: |
| GPU tile/effect cache | 128 MiB | 256 MiB | 512 MiB |
| decoded CPU tile/cache | 192 MiB | 384 MiB | 768 MiB |
| decoded brush/asset cache | 48 MiB | 96 MiB | 192 MiB |
| hot in-memory Undo payload | 64 MiB | 128 MiB | 256 MiB |

Rules:

- Startup begins **Conservative** until capability/performance sampling establishes headroom; promotion to Standard/Large is automatic and reversible.
- A single GPU allocation should normally stay below `min(64 MiB, 25% of current GPU-cache soft budget)`; larger one-off resources require an explicit planner path and must still fit device limits.
- Cache eviction order favors P0/P1 visible/current-stroke resources, then near-viewport resources, then derived/off-screen data.
- Derived mip/effect/thumbnail caches are evicted before canonical CPU state required for unpersisted transactions.
- Allocation errors, repeated long frames, queue growth or device-loss/resource-pressure signals immediately permit stepping down a profile.
- Promotion occurs only after sustained measured headroom; it must never be based solely on a guessed hardware model or marketing device name.
- Cache profile changes cannot alter canonical pixels, brush semantics, effect parameters, Undo meaning or export quality.

## P4-7. Input and render queues — CLOSED

High-frequency input is bounded end-to-end.

- Shared-memory pointer ring capacity: **4096 samples per active pointer stream** when SAB is enabled.
- Transferable fallback batches pointer samples with the same logical bound.
- Renderer command queue soft bound: **1024 pending command descriptors**; bulky pixel/resource payloads are referenced/transferred separately rather than copied into descriptors.
- Pointer down/up/cancel, the final confirmed position of a stroke segment, mode changes and transaction boundaries are **non-droppable** events.
- If motion samples approach queue capacity, intermediate move samples may be coalesced using time/geometry-aware reduction while preserving ordering, endpoints, pressure/extrema important to the brush mapping and the latest confirmed sample.
- Predicted samples are kept outside canonical stroke history. They may be replaced without Undo/history impact when confirmed samples arrive.
- Input sampling, stabilization and stamp generation operate in document coordinates with timestamped samples so variable display refresh does not change canonical geometry merely because frames were skipped.

The main-thread pointer/arbitration handler target is **<= 1 ms p95 CPU time per delivered event batch** under the Phase-4 reference workloads; expensive brush/effect work belongs off the main thread.

## P4-8. Canvas admission and hard logical bounds — CLOSED

Initial-release document creation/import uses both absolute bounds and resource preflight.

Absolute v1 bounds:

- width: **1..32768 px**;
- height: **1..32768 px**;
- logical pixel area: **<= 268435456 pixels (2^28)**.

This permits, for example, 16384 × 16384 or 32768 × 8192 documents while preventing pathological allocations/exports that exceed the initial product contract.

Before create/resize/import commit, admission also estimates:

- canonical precision cost (RGBA8 versus RGBA16F);
- projected touched-tile count rather than assuming every sparse tile exists;
- minimum checkpoint/journal headroom;
- requested operation scratch space;
- current storage safety reserve.

A document within the absolute bounds may still be rejected for a specific device/session when the operation cannot maintain storage/correctness guarantees. The UI reports the limiting resource and allows adjusted dimensions/precision. Existing valid projects are never silently downsampled to fit.

## P4-9. Numeric interaction/performance targets — CLOSED

Phase 4 defines engineering targets; Phase 7 converts them into final release QA matrices on selected Tier-A devices.

### Frame/latency targets

For ordinary cached navigation and baseline painting workloads on supported Tier-A reference hardware:

- target display cadence: **60 fps or the display refresh rate when lower**;
- cached pan/zoom/rotate frame time: **p95 <= 16.7 ms**, **p99 <= 33.3 ms**;
- simple baseline brush confirmed-input-to-visible-feedback: **p50 <= 16.7 ms**, **p95 <= 33.3 ms** measured from event timestamp to the first frame containing the corresponding confirmed/provisional visual response;
- UI command acknowledgement/state feedback: **<= 100 ms p95** for commands that do not inherently wait for a long-running task;
- ordinary drawing/navigation must not create main-thread Long Tasks >= 50 ms as a steady-state behavior.

On 90/120 Hz devices the scheduler should exploit the higher refresh rate when the workload fits the tighter budget; **60 fps is the initial cross-device release baseline**, not a frame-rate cap.

### Reference engineering workloads

The implementation maintains reproducible benchmark fixtures at least equivalent to:

- **W0 Stroke:** 4096×4096 RGBA8, 32 raster layers, 100 px ordinary round/textured brush, dense high-frequency pointer stream.
- **W1 Composite:** 4096×4096 RGBA8, 64 visible layers with representative masks/clipping/common blend modes.
- **W2 Effects:** 8192×8192 RGBA8, 48 layers, representative adjustment/effect stack with an interactively scrubbed expensive parameter.
- **W3 High Precision:** 4096×4096 Display-P3 RGBA16F, 32 layers with painting/compositing.
- **W4 Large Sparse:** 16384×16384 RGBA8, 96 layers, sparse painted coverage and ordinary navigation/painting.

W2/W4 are allowed to use reduced interactive preview under the canonical policy; visible full-quality convergence begins immediately after interaction stops and P1 visible tiles outrank background work. Final export is never judged by interactive-preview approximations.

If a reference workload misses the target, adaptation first reduces transient cache/background/preview cost; it must not modify canonical brush/effect output to manufacture a benchmark pass.

## P4-10. Live OPFS project layout — CLOSED

The live working store is an internal generation/object store, not a mounted copy of the `.illustro` ZIP archive.

Canonical v1 conceptual layout:

```text
/illustro-v1/
  library/
    head-a.json
    head-b.json
    generations/<generation>.json
  projects/<projectId>/
    heads/
      head-a.json
      head-b.json
    checkpoints/<generation>/manifest.json
    objects/
      entities/<entityId>/<revision>.json
      tiles/<ownerId>/<tx>/<ty>/<revision>.tile
      assets/<sha256>
      linked/<objectId>/...
    journal/<segment>.ilj
    history/<segment>.ilh
    previews/...
    timelapse/...
    tmp/...
```

The exact directory fan-out may be optimized without changing these ownership semantics.

### Working tile blob

A `.tile` object has a small versioned binary header containing owner/tile coordinate/revision, valid edge dimensions, channel/pixel format, uncompressed byte length, codec and payload checksum.

Live tile payload codec is selected per blob:

- `raw` for incompressible/already-small data;
- **LZ4-block lossless** for working raster/mask tile payloads when compressed size is <= **87.5%** of raw size.

LZ4 is an internal working-storage optimization only; `.illustro` archive semantics remain P3-defined. Codec implementation/reuse must satisfy the project license/provenance policy.

Assets remain SHA-256 content-addressed. Mutable document entities use stable ID + revision objects rather than forcing expensive cryptographic hashing into every interactive mutation path.

## P4-11. Journal, checkpoint and autosave publication — CLOSED

### Journal framing

Each project journal is append-only and split into bounded segments. A record contains a version/magic, monotonically increasing sequence, transaction ID, payload length, UTF-8 JSON transaction/revision references, and **CRC32C** for torn/corrupt-record detection. Large binary tile/entity payloads are written as immutable objects and referenced by the commit record rather than embedded repeatedly in the journal.

Recovery ignores an incomplete/corrupt tail after the last valid framed record; it never guesses the contents of a partially written transaction.

### Transaction persistence order

For a recoverable committed transaction:

1. write new immutable entity/tile objects;
2. flush required object files;
3. append a transaction-commit journal frame referencing those objects and the expected prior/new document revision;
4. flush the journal according to the recovery-flush schedule;
5. advance the in-memory persisted/recovery watermark only after the durable boundary succeeds.

A UI/document transaction may become interactively committed before its disk flush completes, but the save indicator must distinguish **dirty/unflushed** from **recovery-safe** state.

### Recovery flush schedule

Under ordinary operation, committed changes are flushed to the recovery journal when any of these occurs first:

- **2 seconds** since the oldest unflushed committed transaction;
- **8 MiB** of unflushed object/journal data;
- explicit Save/checkpoint request;
- document close/switch handoff;
- `visibilitychange` to hidden / page lifecycle persistence signal when execution time remains available;
- before an operation that requires a guaranteed persisted pre-state.

This is a best-effort recent-state guarantee within web/OS lifecycle constraints, not a promise that a sudden power/OS kill preserves the final in-flight sample.

### Checkpoint schedule

Publish a new coherent checkpoint when any of these occurs first while dirty:

- **30 seconds** since the previous checkpoint and background budget is available;
- **128 committed transactions** since the previous checkpoint;
- active journal data since checkpoint reaches **64 MiB**;
- explicit `project.saveCheckpoint`;
- safe close/switch;
- before schema migration or other operation requiring a stable rollback anchor.

Checkpoint creation references immutable objects; it does not duplicate every unchanged tile.

### Dual-head publication

Each project keeps `head-a.json` and `head-b.json`. A head record includes generation number, checkpoint-manifest path/hash, journal sequence watermark and its own validation checksum.

To publish generation N:

1. write/flush all required objects;
2. write and SHA-256-verify `checkpoints/N/manifest.json`;
3. write/flush the **inactive** head slot with N;
4. only after validation treat N as published.

Open/recovery chooses the highest-generation valid head whose manifest and required references validate. A torn newest head therefore falls back to the other slot instead of destroying the last coherent state.

Keep a normal target of **8 checkpoint generations**. Garbage collection may reduce this under pressure but must retain at least the newest **3 independently valid generations** unless the user explicitly permanently deletes/discards recovery data.

Explicit Save does not report `Saved` until the required recovery journal is flushed and a coherent checkpoint/head publication completes.

## P4-12. Undo spill, retention and garbage collection — CLOSED

The P3 hybrid history uses the memory budget from P4-6 plus OPFS history segments.

- Hot recent payloads remain in RAM up to the active profile's Undo soft budget.
- Colder exact payloads spill to `history/` in append/immutable segments using the same tile/entity revision references where possible.
- History-disk soft cap is `min(4 GiB, max(256 MiB, 15% of current origin quota))`, further reduced as necessary to preserve the storage safety reserve.
- Retention target is the most recent **1000 committed document transactions** when they fit the disk budget.
- If the cap is exceeded, prune the oldest complete transactions/now-unreachable revision objects first. Never truncate a transaction in the middle.
- If storage constraints force retained history below **100 transactions**, expose a persistent storage/history warning; document correctness/autosave still takes priority over deep Undo.
- A new mutation after Undo invalidates the active Redo branch. Its unreachable spill payloads become GC candidates only after no retained checkpoint/history/timelapse/reference points to them.
- GC is mark-and-sweep over published checkpoint heads, retained checkpoint generations, retained history spine, active journal, timelapse/resource references and temporary in-progress transaction roots.
- GC never deletes an object referenced by the currently published head or unflushed active transaction.

## P4-13. Quota and storage-pressure policy — CLOSED

Illustro samples `navigator.storage.estimate()` and requests persistent storage when supported. Because browser quota is approximate and platform-controlled, thresholds are based on the reported quota/free space and projected writes rather than assuming a fixed disk size.

Let `Q = reported quota`, `U = reported usage`, `F = max(0, Q-U)`.

Thresholds:

- **Warning reserve:** `max(512 MiB, 15% of Q)`.
- **Critical reserve:** `max(256 MiB, 8% of Q)`.
- **Hard safety reserve:** `max(128 MiB, 5% of Q)`.

Behavior:

- If `F` falls below Warning reserve, show actionable storage warning and accelerate eviction of derived caches/old trash/eligible history.
- Below Critical reserve, pause optional background growth such as nonessential thumbnails/prefetch and require projected-space checks for large operations.
- Illustro must not begin a mutation/export/import/checkpoint whose estimated required additional durable bytes would push remaining space below the Hard safety reserve, unless the operation itself is a user-directed safe export that does not consume origin storage materially.
- `QuotaExceededError` is always treated as a data-safety signal, not as an ordinary retriable toast.
- Derived GPU/CPU caches are not counted as reclaimable durable-storage safety unless they actually occupy OPFS and can be synchronously identified for deletion.

Recently Deleted participates in quota reporting. The user is offered targeted cleanup before the app proposes permanent deletion of active project recovery/history.

## P4-14. Recovery and device-loss state machines — CLOSED

### Project open/recovery

Open order:

1. acquire/resolve project write ownership;
2. validate both head slots;
3. select highest valid published checkpoint;
4. validate its manifest and required objects;
5. replay only complete valid journal commits after its watermark in sequence/revision order;
6. if the newest journal tail is damaged, stop at the last coherent transaction and report the discarded/incomplete tail;
7. build derived indexes/caches lazily after canonical state is coherent.

Recovery writes a **new recovered project/copy** when source integrity is suspect rather than overwriting the only damaged source immediately.

### GPU device loss

`device.lost` is observed for the lifetime of every device.

On unexpected loss:

- stop submitting work to the lost device;
- preserve canonical RAM/OPFS transaction state and continue/force persistence work that does not require GPU;
- cancel/reconcile only provisional predicted render state;
- automatically request a new qualifying adapter/device and rebuild pipelines/atlases from canonical/cacheable state;
- block new canvas-mutating gestures until a coherent renderer is available, while retaining safe project/save/recovery controls;
- if reacquisition repeatedly fails, transition to the P2 compatibility/recovery UX with manual Retry and safe export/checkpoint options rather than looping indefinitely.

All resources from the old device are considered invalid and recreated; no GPU handle may survive into the new-device graph.

### Storage-worker failure

If the Storage Worker or SyncAccessHandle path fails:

- stop advancing the persisted watermark;
- keep already committed RAM state when safe;
- restart/reopen storage ownership once;
- validate heads/journal before resuming writes;
- if safe persistence cannot be re-established, enter the persistent data-safety state and offer external Safe Copy/export where technically possible.

The renderer never marks storage work successful on behalf of the Storage Worker.

## P4-15. Phase 4 completion result — CLOSED

Phase 4 closes the remaining pre-visual technical runtime decisions:

1. core WebGPU minimum limits and no-extra-feature baseline;
2. worker/thread ownership and fallback boundary;
3. 256×256 canonical tiles, 2048×2048 GPU atlas pages and seam/halo policy;
4. dirty/dependency scheduling and cache eviction priorities;
5. Conservative/Standard/Large numeric memory budgets;
6. bounded input/render queues and coalescing semantics;
7. absolute canvas bounds and resource-admission preflight;
8. numeric interaction/performance targets and benchmark workload classes;
9. live OPFS generation/object-store layout and working tile codec;
10. framed journal, 2-second/8-MiB recovery flush, checkpoint triggers and dual-head publication;
11. Undo spill/retention/GC policy;
12. quota warning/critical/hard reserves;
13. deterministic project recovery, GPU device-loss and storage-worker recovery state machines.

After this closure, the remaining canonical Open Questions before joint F/G/H/I/V work and final integration are **project-level software license / third-party NOTICE packaging** and **final release criteria/testing orchestration**. The latter is intentionally Phase 7. This Phase does not declare global `IMPLEMENTATION READY` or Design Freeze.

### Phase 4 change-log entry

- 2026-08-30: Closed Phase 4 renderer/performance/persistence design: fixed core-WebGPU minimums, 256px sparse tiles with 2048px atlas pages, dependency/halo scheduling, adaptive memory tiers, bounded input queues, canvas limits and latency targets, plus an immutable-object OPFS store with LZ4/raw working tiles, framed journals, dual-head checkpoints, autosave/recovery timing, bounded Undo spill and quota/device-loss recovery policies.

## GPU/rendering architecture — 2026-08-30

### WebGPU-first renderer

- **WebGPU is the primary rendering and compute backend.**
- Appropriate GPU workloads include brush/stamp rendering, layer compositing, blend modes, masks, selection previews, transforms, blur/sharpen/noise/distortion and other filters, liquify-like processing, color adjustments, histogram/analysis work, thumbnails, and other parallel image-processing operations where profiling supports GPU execution.
- WebGPU resources are acceleration/cache state, not the canonical document source of truth. Loss of the GPU device must not corrupt the document.
- The renderer must implement **GPU device-loss detection and recovery**, rebuilding device-dependent resources from canonical document/storage state.

### Capability profile

- Query `GPUAdapter.features` and `GPUAdapter.limits` and derive an internal capability profile rather than assuming desktop-class limits.
- Optional features such as `shader-f16` may be used only when supported and only after correctness/performance validation.
- Prefer f32 for correctness-critical shader computation. f16 is an optional bandwidth/performance optimization for suitable intermediate calculations, not a universal precision downgrade.
- Cache sizes, texture allocation, workgroup sizing, batch sizes, and similar parameters should derive from capability and measurement rather than hard-coded assumptions.

### Sparse tiled canvas

- Large documents are represented as a **sparse tile map**. Do not allocate the full document as one giant texture/bitmap solely because its logical dimensions are large.
- Only active/visible/recently needed tiles and bounded working sets should occupy expensive CPU/GPU caches.
- Canonical tile dimensions, seam/halo rules, dirty scheduling, eviction priorities and adaptive numeric memory budgets are defined by **P4-3 through P4-6**. Benchmarks validate those choices; they no longer remain unspecified implementation decisions.
- Logical document dimensions are validated against implementation/platform limits; sparse tiling enables very large canvases but does not create literally unbounded resources.

### Pen/input pipeline

- Base input is **Pointer Events** with pen/mouse/touch discrimination.
- Consume supported pen information relevant to brush behavior, including pressure, `tiltX`/`tiltY`, twist/orientation, `altitudeAngle`, and `azimuthAngle` where exposed by the device/browser.
- Use `getCoalescedEvents()` when available to recover high-granularity samples that the browser coalesced.
- Use `pointerrawupdate` when available and beneficial as a higher-frequency/raw path; retain a normal Pointer Events path as the compatibility baseline.
- Use `getPredictedEvents()` when available to reduce perceived stroke latency. Predicted geometry is provisional presentation state and must be replaced/reconciled by confirmed samples as real input arrives.
- Feed input through a bounded queue and stabilizer/interpolation/brush pipeline; high-frequency input must not create an unbounded memory queue.

### Color and precision

- Renderer and document APIs must represent color space explicitly rather than assuming sRGB everywhere.
- Support **sRGB and Display-P3** output/workflows where platform/display capability permits.
- Architecture supports the canonical **`rgba8-unorm`** and **`rgba16-float`** document modes defined by P3-15. The initial default is `srgb + rgba8-unorm`; runtime cache/intermediate precision may still adapt by capability without changing canonical document semantics.
- Color conversion and blend semantics must be explicit and testable; wide-gamut support must not silently reinterpret legacy sRGB assets.

### Multi-resolution non-destructive preview policy

- Canonical document/effect state is resolution-independent; reduced-quality preview is a transient renderer optimization only.
- Interactive adjustment/filter manipulation may reduce preview resolution/quality to maintain responsiveness.
- After interaction settles, visible dirty tiles are prioritized for full-resolution recomputation and progressively replace the temporary preview.
- Final export, explicit rasterization/apply, and other final-quality operations always execute the canonical full-quality path.
- Preview resolution is adaptive rather than fixed: approximately 1/2 linear resolution is a normal target for expensive effects, with lower levels permitted when device/effect cost requires them.
- Effect caches and invalidation operate per tile/node/revision/quality level so changing one parameter does not force unrelated document regions to be recomputed.
- Pixel-local effects should stay full-resolution when inexpensive. Neighborhood effects use tile halos; wide-radius effects may use validated multi-scale algorithms; global-statistical effects may use approximate preview statistics and later converge to full-quality results.

### Adaptive performance policy

Illustro should maintain an internal performance/capability profile based on available GPU limits/features, renderer timings, storage I/O behavior, and suitable coarse platform signals. The profile may adapt:

- GPU tile/cache budget
- brush/material cache budget
- Undo memory budget before spill/offload
- worker count
- preview/intermediate resolution
- batch/workgroup sizing
- optional precision/acceleration paths
- background work scheduling

Adaptation must preserve document correctness and final visual semantics; performance tiers may reduce cache or transient preview cost, not silently change final artwork output.

# Persistence / Undo / Recovery

## Local working storage — 2026-08-30

- **OPFS is the canonical local working-storage layer** for active Illustro projects and internal caches/journals.
- Perform high-throughput OPFS operations in a Dedicated Storage Worker. Use `FileSystemSyncAccessHandle` where appropriate for synchronous random read/write inside that worker.
- Storage writes must be transactional/journaled at the application level where needed so interruption does not leave the canonical project in an ambiguous half-written state.
- Autosave and recovery are first-class persistence behaviors. The live OPFS layout, journal/checkpoint cadence, recovery publication and Undo spill/retention policy are defined by **P4-10 through P4-14**.

### Storage durability and quota

- Request persistent storage with `navigator.storage.persist()` where supported and record/check the result; persistence permission is an optimization to durability, not a guarantee the application may assume blindly.
- Use `navigator.storage.persisted()` and `navigator.storage.estimate()` to monitor persistence state, usage, and quota.
- Surface actionable storage-pressure warnings before the application reaches a condition where continued editing is unsafe.
- OPFS is browser-managed working storage, not a substitute for an explicit user-controlled backup/export. The **`.illustro` v1 archive defined by P3-17 through P3-19** is the user-controlled project exchange/backup format outside origin storage.

### Project ownership

- Acquire a named **Web Lock per writable project** before entering writable mode.
- If another context owns the write lock, the second context must not independently autosave over the same project. Read-only/open-elsewhere UX can be designed separately.
- Broadcast save/open/ownership state through BroadcastChannel where useful.

# Import / Export / Compatibility

## Compatibility principles — 2026-08-30

- Core project editing uses the internal OPFS working model; external files enter and leave through explicit import/export flows.
- The public `.illustro` v1 container/manifest/tile contract is defined by P3-17 through P3-19. Live OPFS storage remains an internal runtime representation and may differ while preserving the same canonical semantics.
- OS/PWA file association may be added as progressive enhancement on platforms that support it; the application must not require file association for normal import/export.
- External linked-object acceleration may be used when a platform provides a persistent file handle, but `.illustro` correctness/round-trip preservation must rely on embedded/internal project state rather than assuming permanent external-file permission.
- **WebCodecs** is the preferred browser-native acceleration path when implementing timelapse/video encoding or decoding that benefits from it, with capability detection rather than unconditional dependency.
- **CompressionStream** may be used for compatible metadata or auxiliary streams where useful. Live working raster/mask tile storage uses the **raw/LZ4-block policy in P4-10**; external `.illustro` archive encoding remains governed by P3-17/P3-18.

# Testing / Completion Gates

_Not yet defined beyond the functional-completion gate above._

# Implementation Roadmap

The detailed implementation stages are not yet defined. However, feature planning and implementation must use the functional-scope/completion definition above as the terminal feature-coverage gate rather than stopping at a smaller MVP/basic-editor milestone.

# Proposals under consideration

_None are authoritative yet beyond the provisional UI visual target and confirmed decisions above._

# Open questions

- Project-level software license and final third-party NOTICE packaging policy
- Release criteria

# Change log

- 2026-08-30: Created the design memo and recorded the clean-sheet rebuild decision.
- 2026-08-30: Adopted the latest generated editor mockup as the provisional visual completion target and documented its visual language, left/right workspace structure, removal of canvas upper-right floating controls, and fixed-bottom behavior for the right-side inspector toolbar.
- 2026-08-30: Promoted this file from a design-only memo to the **single canonical master specification** for all Illustro product, UX, technical, data, performance, testing, roadmap, and release decisions.
- 2026-08-30: Preserved the latest approved generated UI image as `ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png` on Google Drive and pinned its exact file ID, dimensions, URL, and SHA-256 here so implementation can inspect the same visual target directly.
- 2026-08-30: Defined the functional-completion policy: ibisPaint's single-illustration-relevant capabilities form the baseline; selected high-value CLIP STUDIO PAINT and other paid/free-app capabilities extend it; comic/page-production and built-in material/content-library workflows are outside the required scope; feature completeness requires an explicit audited inventory with implemented/verified or intentionally excluded status.
- 2026-08-30: Defined the initial production technical architecture: Web/PWA + WebGPU-first rendering/compute; Dedicated Workers; SharedArrayBuffer/Atomics with cross-origin isolation; Transferables; OPFS/SyncAccessHandle; Web Locks/BroadcastChannel; sparse tiled canvas; progressive pen-input enhancements; capability-adaptive GPU/performance policy; sRGB/Display-P3 and 8-bit/16F-ready color architecture; WASM optimization hooks; persistent-storage/quota handling; device-loss recovery; and explicit import/export compatibility principles.
- 2026-08-30: Added the canonical feature inventory covering the adopted ibisPaint single-illustration baseline, selected CSP productivity/non-destructive/vector capabilities, mandatory cross-application painting features, the ibis+CSP Canonical Brush Engine, interoperability targets, explicit exclusions, and unresolved adoption candidates.
- 2026-08-30: Adopted the resizable/reorderable right-inspector architecture with tear-off PiP blocks, Scratch-like magnetic re-docking, persistent detached panels across inspector collapse, and the six-slot fully remappable Quick Hole Controller for tablet-first shortcut access.
- 2026-08-30: Refined Quick Hole behavior so UI interactions do not move its canvas-derived anchor, non-UI workspace taps can dismiss it until the next canvas interaction, the ring/buttons use configurable translucency, and the wider UI follows a customization-first workspace principle.
- 2026-08-30: Adopted the Lineart Group / Lineart Boundary Layer system: visible source lineart is wrapped in a special folder-like group with non-rendering idealized boundary topology, editable automatic/manual gap connections, persistent no-connect overrides, multi-boundary union references for region tools, anti-alias-aware under-line fill behavior, and transform/Liquify synchronization.
- 2026-08-30: Defined Lineart Boundary graph invariants: endpoints are degree-1 graph nodes, connecting endpoints atomically removes stale endpoint status when degree changes, splitting/disconnecting regenerates endpoint classification, and Undo/Redo restores topology, endpoint state, connection provenance and no-connect decisions exactly.
- 2026-08-30: Reworked the feature inventory for technical realizability: bounded user-defined canvas dimensions; embedded-safe linked-object semantics; application-level palm rejection; removed realistic general-purpose paint mixing, Dual Brush, vector brush/vector eraser, Photoshop `.abr`, and Fisheye Perspective Ruler; retained path/shape vectors and ordinary digital mixing.
- 2026-08-30: Retained Non-destructive Filter Stack/Adjustment Layers with a tile dependency graph and adaptive multi-resolution interactive preview that converges to full quality after interaction and always renders full quality for final output.
- 2026-08-30: Added the license-aware public-algorithm/open-source reuse policy, including preference for permissive/public-domain code, provenance/notice tracking, independent reimplementation where appropriate, and prohibition on casually copying incompatible/proprietary source into the core.

# Feasibility Closure — 2026-08-30

This section closes the feasibility/ambiguity review performed on 2026-08-30. **Where wording in an earlier section can reasonably be read as conflicting with this section, this section is the newer authoritative rule and supersedes that ambiguity.** These rules do not remove previously adopted capabilities; they bound them so implementation and completion can be tested objectively.

## FC-1. Frozen external-reference feature baseline — PASS

Illustro's external-application feature-completeness target is a **frozen audit snapshot**, not a permanently moving target.

- Baseline snapshot date: **2026-08-30 (JST)**.
- ibisPaint baseline: capabilities publicly released/documented by the snapshot date in the **14.0.x family**. Traceability observations at closure include ibisPaint for Windows **14.0.10** (released 2026-08-05), ibisPaint X **14.0.9** (released 2026-07-29), and ibisPaint **14.0.8** (released 2026-07-28). When a capability differs by platform/edition, the feature inventory records the source platform/edition/version relevant to that capability.
- CLIP STUDIO PAINT baseline: capabilities publicly released/documented by the snapshot date in the **5.1.x family**. Traceability observation at closure: Windows EX/PRO **5.1.2** was released 2026-08-06; platform-specific patch levels may differ and must be recorded where relevant to an audited capability.
- Procreate, Krita, Photoshop, Infinite Painter and any other reference applications use the same snapshot-date rule when they are audited for the initial release baseline.
- A reference application release **after 2026-08-30 does not retroactively make Illustro incomplete**. New capabilities enter a `POST-BASELINE CANDIDATE` queue and affect the completion gate only after an explicit Illustro adoption decision updates this memo.
- The terminal feature gate therefore evaluates the frozen inventory derived from this snapshot plus capabilities explicitly adopted later; the phrase "current feature set" elsewhere in this memo must be read according to this frozen-baseline rule.

Verification evidence used when closing this item:

- ibisPaint official history: `https://ibispaint.com/historyAndRights.jsp?lang=en-GB%2F1000`
- CLIP STUDIO PAINT official release notes: `https://www.clipstudio.net/en/dl/release_note/latest/`

## FC-2. ibisPaint / CLIP STUDIO brush-import compatibility contract — PASS

Brush interoperability is **version-scoped, parser-scoped and best-effort with explicit fidelity reporting**. It is not a promise of universal or perpetual compatibility with proprietary formats.

- ibisPaint brush-QR import and CLIP STUDIO PAINT `.sut` import are required only for source variants that are present in Illustro's maintained compatibility matrix and test corpus.
- The importer may decode documented behavior and independently understood format structures, then normalize supported information into the Illustro Canonical Brush Model.
- Unknown format revisions, opaque/private fields, malformed carriers and semantics not confidently understood must never be guessed into apparently successful output. The importer must instead report `UNSUPPORTED`, `PARTIAL`, or an equivalent explicit fidelity status.
- Every successful non-native import exposes a compatibility/fidelity report identifying at least: detected source family/version or variant when determinable, mapped fields, unsupported/ignored fields, substitutions/approximations, warnings and the resulting Illustro brush-schema version.
- Unsupported source parameters that correspond to intentionally excluded Illustro capabilities remain unsupported rather than forcing those excluded subsystems back into scope.
- The original imported source bytes/carrier may be retained as provenance/reference data where legally and technically appropriate, but rendering always uses the normalized Illustro representation.
- Future ibisPaint/CSP format changes are not automatically required for the release gate. They become new compatibility work only after the compatibility matrix is explicitly extended.
- Compatibility is considered verified only when fixtures for every claimed supported source variant parse deterministically, mapped canonical fields are tested, malformed/unknown variants fail safely, and no unsupported source semantics are silently represented as lossless.

## FC-3. WebGPU runtime boundary — PASS

**A usable WebGPU implementation is a minimum runtime requirement for the full Illustro production editor.** Illustro will not maintain a second feature-complete Canvas 2D or WebGL2 renderer merely to support environments without WebGPU.

- Startup must perform WebGPU adapter/device capability detection before entering the production editing surface.
- If no usable WebGPU adapter/device satisfying Illustro's minimum capability profile is available, the environment is classified as **unsupported for full editing**.
- An unsupported environment may still display a lightweight compatibility/recovery shell and, when safe and technically possible, allow diagnostics or recovery/export of locally stored project data. This shell is not considered the production editor.
- Optional WebGPU features such as `shader-f16`, larger limits or device-specific acceleration paths remain progressive enhancements. Their absence must fall back to baseline WebGPU code paths rather than make an otherwise qualifying environment unusable.
- Any earlier statement that optional capability absence should not make the editor unusable applies to **optional capabilities**, not to absence of the required WebGPU baseline itself.
- Exact minimum browser versions, tested device families and numeric adapter limits remain a compatibility-matrix decision, but the single-renderer architectural boundary is fixed by this section.

## FC-4. RGB / ICC / Display-P3 color-management boundary — PASS

Illustro owns **document color semantics and explicit color transforms inside its supported pipeline**, while final physical-display calibration remains the responsibility of the browser/OS/display stack.

- Supported document/working RGB spaces include sRGB and Display-P3 as already adopted.
- Imported files with recognized embedded profiles must be interpreted through an explicit profile-aware conversion path rather than having their sample values silently treated as sRGB.
- Where an ICC profile can be processed by Illustro's selected color-management implementation, Illustro may convert that source into a supported internal/working representation with defined rendering intent/transform semantics appropriate to the adopted scope.
- If a profile or transform cannot be supported reliably, Illustro must explicitly warn, require conversion, or reject the operation; it must not silently reinterpret color values.
- Illustro does **not** require arbitrary access to the operating system's active monitor ICC profile, GPU calibration LUT, display hardware calibration or printer-driver color pipeline. Final screen presentation after Illustro emits correctly tagged/defined output is delegated to the browser/OS color-management stack.
- sRGB/Display-P3 support therefore means Illustro preserves and converts document color semantics correctly within the web platform's controllable boundary; it is not a claim of native control over every physical display's calibration.
- CMYK/print-output scope and advanced print rendering-intent UI remain **POST-BASELINE** under P1-2/section 21 and are not implied by this RGB closure.

## FC-5. Lineart Boundary regeneration identity model — PASS

Auto-extracted graph node/edge identifiers are **not required to remain globally stable across source-driven boundary regeneration**. Canonical manual intent must not depend on an ephemeral extraction ID surviving arbitrary raster/vector source edits.

- Within one committed boundary-graph revision, nodes and edges have exact identities sufficient for atomic edits and exact Undo/Redo of that revision.
- Across a regeneration caused by source-lineart changes, auto-generated node/edge IDs may be replaced. They are generation/revision-local unless the implementation can prove an identity is preserved.
- Manual additions/connections/removals, rejected bridges and no-connect constraints are persisted as semantic override records with stable Illustro-owned identities and enough anchoring information to remap them. Anchoring may include source-layer/object identity where available, source-relative/document coordinates, local curve/segment position, tangent/neighborhood geometry signatures, provenance and source revision metadata.
- Regeneration performs deterministic remapping/validation of semantic overrides onto the new extracted graph. The remapper uses bounded tolerances and provenance/geometry checks rather than assuming equal transient IDs imply equal topology.
- If an override cannot be mapped with sufficient confidence, it enters an explicit unresolved/manual-review state or remains as an independent manual boundary element where its semantics permit. The system must never silently attach a constraint to a different nearby endpoint merely to avoid reporting ambiguity.
- Undo/Redo spanning a regeneration boundary stores the graph snapshot/delta and semantic-override state required to restore the exact committed before/after topology. It must not reconstruct historical state by guessing old auto-node identities from the latest extraction.
- The `.illustro` format may cache extracted graph data for performance, but long-lived user intent is represented by source references plus stable semantic/manual records; cached auto-extraction IDs alone are not the canonical persistence mechanism.
- Accordingly, earlier wording about "stable node/edge identity where required" means stable identity **within the scope where exact history/manual semantics require it**, not an impossible guarantee that every automatically re-extracted node retains one ID forever.

## FC-6. Canonical UI visual-reference durability — PASS

The canonical visual reference is identified by **content hash**, not by one mutable storage location.

- Canonical content SHA-256: `32a6cb3991c9baa5b5e097943ce0550a3968d2dcde1be68e132f30ce03341a13`.
- Primary Drive copy: `1PvkSCaSNNMBZfnn9aRUwGSkja5janHqQ` (`ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png`).
- Verified backup Drive copy created during feasibility closure: `10CNPXcQ_Iwlz1v7Fgttlly9x4ff2xhhV` (`ILLUSTRO_UI_VISUAL_TARGET_2026-08-30_BACKUP.png`).
- Either storage copy is acceptable only when its bytes match the canonical SHA-256. Location or filename alone never overrides a hash mismatch.
- Before visual implementation/QA, the implementation environment must materialize a local working copy and verify its SHA-256. Once verified, that local copy may be cached for the duration of the build/QA run so transient Drive availability does not interrupt the run.
- Loss, permission failure or corruption of one Drive object does not supersede the visual target; recover from the other verified object or another byte-identical copy matching the canonical hash.
- A future replacement visual target requires an explicit supersession entry with a new filename/identifier, dimensions and SHA-256. Re-uploading different bytes under an old name or file role is not an acceptable silent update.
- A Git repository copy may additionally be added later for clone-local convenience, but **the canonical identity is the pinned SHA plus the redundant verified copies**, so Git-binary co-location is not a correctness dependency.

## Feasibility-closure result

The six issues raised by the 2026-08-30 design-feasibility review are closed at specification level:

1. external-app feature scope is frozen and finishable;
2. proprietary brush compatibility is bounded and testable;
3. WebGPU absence has an explicit unsupported-environment policy rather than an undefined renderer fallback;
4. color-management responsibility stops at the web application's controllable boundary;
5. Lineart regeneration no longer requires impossible permanent identity for auto-extracted graph nodes;
6. the UI target is hash-addressed and redundantly stored rather than dependent on a single Drive object.

None of these closures removes an already adopted user-facing painting capability. They convert ambiguous guarantees into explicit, verifiable engineering contracts.

## Feasibility closure change-log entry

- 2026-08-30: Closed the six feasibility-review findings by freezing the external-reference audit baseline, bounding proprietary brush-format support, making WebGPU the explicit full-editor minimum requirement, defining the web color-management boundary, replacing permanent auto-graph identity assumptions with semantic Lineart override remapping, and creating a redundant SHA-pinned UI-reference backup.

# Phase 1 Product / Platform Closure — 2026-08-30

**Status:** authoritative Phase-1 specification. This is **not** the final global Design Freeze. F/G/H/I/V visual/asset decisions and later technical phases may still expose integration adjustments; any such change requires an explicit supersession rather than silently reopening Phase-1 decisions.

## P1-1. Product definition and target users — CLOSED

Illustro is a **serious single-illustration raster-first painting and image-editing application** with deep non-destructive, vector-path/shape, color, lineart and productivity support.

### Primary users

- Digital illustrators who primarily create one finished illustration per document and want a pen/touch-first workflow without giving up desktop-class depth.
- Serious hobbyists through professional/advanced users. First-run defaults must remain learnable for less experienced artists, but the product must not reduce capability merely to remain beginner-simple.
- Artists working mainly on pen-enabled tablets are the **primary interaction target**.

### Secondary users

- Desktop/laptop artists using mouse + keyboard, pen tablet, or pen display.
- Users who open projects without a stylus must still be able to perform ordinary editing, selection, transform, layer, color, file and navigation operations.

### Explicit non-target product categories

- Comic/book/multi-page production as the primary workflow.
- Animation/multi-frame artwork production.
- 3D creation/posing/reference subsystems.
- Public content/material marketplace or social-distribution platform.
- Server/account-dependent collaborative editing or cloud-first document correctness.
- Phone-first production UI for the initial release.

The application may later grow beyond these boundaries only through explicit adoption decisions.

## P1-2. Final initial-release feature-scope decisions — CLOSED

The initial release includes all previously adopted capabilities plus the resolved decisions in section 21 above. The following additional capabilities are adopted from the completed Procreate/Krita/Photoshop/Infinite Painter audit because they materially improve one-illustration work and do not require excluded product categories.

### Newly adopted capabilities

1. **Seeded Auto-Colorize / Flatting Assist.** The user can place color-indication strokes/seeds over lineart and compute region colors automatically. It should integrate with Lineart Boundary/region infrastructure where useful and remain editable/recomputable before conversion to ordinary paint data.
2. **Gamut Mask / Palette Constraint.** User-definable gamut masks can constrain compatible color selectors and be saved/imported/exported as Illustro resources.
3. **Split by Color.** Convert color regions into separate paint layers and/or reusable selection-mask regions using configurable tolerance/fuzziness; useful after flatting and colorize-assist workflows.
4. **Pattern Fill.** Local/user-imported seamless pattern tiles can fill selections/regions/layers with transformable scale/rotation/offset and ordinary color/opacity adjustment. No online material catalog is implied.
5. **Magnetic / Edge-aware Selection.** Add an edge-following magnetic selection mode to the existing lasso/automatic/color-range/brush selection family.
6. **Content-Aware Fill / Smart Patch.** Provide a deterministic/local context-aware repair/fill tool for removing or replacing selected image regions. This is distinct from cloud/generative image synthesis and must not require a generative-AI backend.
7. **Hatching Guide.** Provide a guide that helps produce repeated controlled hatch strokes with configurable direction/spacing behavior using the current brush.
8. **Conical/Sweep Gradient.** Explicitly include conical/sweep gradient geometry alongside linear/radial and already-adopted advanced gradient workflows.

### Audit items already covered by existing Illustro capability

- Procreate-style QuickShape is covered by the adopted Smart Shape/post-stroke recognition system.
- Procreate Drawing Assist, perspective and symmetry behavior are covered by the ruler/guide and assisted drawing systems.
- Procreate Reference Layer is already covered by Reference Layer + Fill/Selection/anti-overflow workflows.
- Krita Transform Mask capability is covered by the adopted non-destructive transform representation.
- Krita Enclose and Fill is already adopted.
- Photoshop Smart Object/Smart Filter-class needs are covered by linked/embedded object-style layers, non-destructive transform and non-destructive filter stacks.
- Infinite Painter reference images, lazy/stabilized drawing, pattern assets and geometric guides are either already covered or explicitly adopted above.

### Explicit audit exclusions / post-baseline items

- Krita-style Wrap-Around/seamless-canvas authoring mode is not an initial-release requirement; pattern resources can still be imported/created through normal asset workflows.
- HDR-display/mastering workflow is not an initial-release completion gate. RGBA16F-class internal capability remains an architectural option; a dedicated HDR product workflow requires later adoption.
- Cloud generative-image creation/editing features are **not part of the initial release baseline**. Local deterministic tools such as Color Match, Smart Patch, selection/fill analysis and future Shading Assist are not classified as generative-image features merely because they automate image processing.

The 2026-08-30 external-application audit is therefore **closed for the initial release baseline**. New reference-app releases after the frozen audit date follow FC-1 and enter the post-baseline candidate queue unless explicitly adopted.

## P1-3. Supported platform / browser matrix — CLOSED

Full-editor support requires **all** of: a supported OS/browser combination below, secure HTTPS context, a qualifying WebGPU core adapter/device, required storage APIs, and the full-editor viewport tier. Browser/OS version alone never overrides a failed runtime capability gate.

### Tier A — supported and release-QA required

| Platform | Minimum OS | Minimum browser | Full-editor status |
| --- | --- | --- | --- |
| iPad | **iPadOS 26.6** | **Safari 26.6** / installed Safari Web App | Supported when runtime gates pass |
| Android tablet | **Android 12** | **Chrome 152** | Supported when runtime gates pass |
| Windows desktop/laptop | **Windows 11 25H2** | **Chrome 152** or **Edge 152** | Supported when runtime gates pass |
| macOS desktop/laptop | **macOS Sonoma 14.8.8** or later | **Safari 26.6** or **Chrome 152** | Supported when runtime gates pass |

Later stable releases of those browsers/OS families remain in scope unless a known regression is documented. Exact release-QA device samples will be fixed in the later testing/release phase; this matrix defines the minimum product contract.

### Tier B — best-effort / not an initial release gate

- ChromeOS/Chromium systems with a qualifying WebGPU adapter.
- Firefox desktop/Android when its WebGPU/storage implementation passes Illustro runtime detection.
- Chromium-derived browsers other than tested Chrome/Edge.

Tier B environments may work but are not entitled to release-blocking compatibility treatment until explicitly promoted to Tier A.

### Unsupported for the initial full editor

- Browsers without a qualifying WebGPU implementation.
- iPhone/Android-phone narrow layouts below the full-editor viewport gate.
- Legacy OS/browser combinations below Tier-A minimums.
- Embedded/in-app WebViews unless explicitly tested and promoted later.

### Runtime gates

Before entering full editing, startup must verify at minimum:

- secure context;
- `navigator.gpu` and successful request of a **core** WebGPU adapter/device satisfying the later numeric minimum capability profile;
- OPFS availability through `navigator.storage.getDirectory()`;
- required Worker/Transferable functionality;
- required cross-origin-isolation contract when enabling SharedArrayBuffer paths;
- full-editor viewport eligibility;
- sufficient available storage for safe project creation/opening, evaluated by the storage subsystem rather than a hard-coded browser-name assumption.

WebGPU compatibility-mode adapters may be experimented with later, but **core WebGPU is the initial Tier-A full-editor baseline**. Missing optional features such as `shader-f16` do not by themselves fail support.

### Rationale snapshot

At this closure date, Chrome 152 is the stable desktop/Android baseline and Edge 152 is stable; Safari 26.6 is the stable Safari line, and Safari 26 introduced WebGPU. OPFS is broadly available across modern browsers. WebGPU itself still has uneven browser-wide availability, so runtime capability detection remains authoritative over version labels.

## P1-4. Responsive product behavior — CLOSED

Responsive behavior is divided into **functional viewport tiers**. Exact visual arrangement, component dimensions, color and motion belong to F/G/V and are intentionally not frozen here.

### Wide full editor — viewport width >= 1100 CSS px

- Full production editor.
- May present left tool rail, central canvas and right inspector simultaneously.
- Detached panels/PiPs and desktop-style command surfaces are allowed.

### Compact full editor — viewport width 600–1099 CSS px

- Full production capability remains available.
- The UI may collapse, overlay, temporarily hide or single-stack inspectors/tool groups to protect canvas space.
- No adopted editing capability may disappear solely because the viewport is in this tier; access may move behind contextual/progressive-disclosure surfaces.

### Narrow shell — viewport width < 600 CSS px

- **Not a full-production-editor target for the initial release.**
- Provide a coherent narrow shell for project listing/open metadata, compatibility diagnostics, recovery/export/backup where technically safe, settings/help and an explanation that full editing requires a larger viewport.
- Do not create a separate phone-first editing architecture merely to claim feature parity on narrow screens.

### Resize/orientation behavior

- Crossing a viewport tier must preserve document state, active tool, selections and workspace state; responsive layout changes are presentation changes, not document commands.
- Tablet portrait is supported when it remains >=600 CSS px wide; compact presentation is expected.
- Orientation changes and desktop window resizes must not discard detached-panel/workspace state. When a saved position becomes invalid, clamp/reflow it into the visible work area while preserving its logical detached/docked state.

## P1-5. Accessibility and inclusive-input contract — CLOSED

Illustro targets **WCAG 2.2 AA for application UI** where applicable to a highly interactive graphics editor, with additional pen/touch ergonomics beyond minimum AA requirements.

### Required accessibility behavior

- Ordinary text targets at least **4.5:1** contrast; large text may use the WCAG large-text threshold; essential UI component/focus boundaries target at least **3:1** against adjacent colors.
- State must never be conveyed by hue alone. Selected/error/warning/success states require shape, label, icon, border, pattern or other redundant indication.
- Visible keyboard focus is mandatory for keyboard-focusable controls.
- All ordinary application commands and controls must be operable by keyboard where the command itself does not intrinsically require freehand pointer geometry. Freehand drawing does not need to be recreated through arrow-key pixel painting.
- Toolbars, menus, dialogs, fields, sliders, tabs, layer trees and command surfaces require semantic accessible names/roles/states compatible with platform accessibility APIs.
- The artwork canvas must expose meaningful editor/document context and focusable associated commands, but Illustro does not claim to generate a semantic description of arbitrary user artwork pixels.
- Respect `prefers-reduced-motion`; non-essential motion must be suppressible/reduced without removing functional feedback.
- Support UI scaling and user-resizable workspace surfaces. Exact scale presets/ranges are finalized with G, but implementation must not assume one immutable pixel density.
- Support left-handed workspace rearrangement through the adopted customizable workspace rather than hard-coding critical controls to one side only.
- Pen pressure, tilt, hover or stylus buttons may improve drawing but cannot be mandatory for basic document editing; ordinary mouse/touch alternatives remain available.
- Touch-first primary controls should target approximately **44×44 CSS px or larger hit regions** when practical. Dense pointer-oriented surfaces may visually appear smaller only when spacing/expanded hit regions/alternate access preserve reliable operation; never fall below WCAG 2.2 minimum target-size semantics without an allowed exception.
- Shortcut customization must detect/report conflicts and must always provide a reset-to-default path.
- Error/recovery flows must not rely on transient toast color alone; persistent actionable text is required for data-safety failures.

## P1-6. Localization / terminology contract — CLOSED

Initial release UI languages are:

- **Japanese (`ja-JP`)**
- **English (`en`)**

### Localization architecture

- Detect the user's preferred locale on first run; allow explicit language override in settings.
- Unsupported locales fall back to English.
- All user-facing application strings, accessibility labels, menu names, dialog copy, error/recovery messages, built-in preset names/descriptions and shortcut labels use localization keys rather than hard-coded concatenated prose.
- Stable internal IDs, schema keys, command IDs, file-format fields and resource IDs are locale-neutral and never translated.
- User-created layer/preset/project/resource names remain exactly as entered unless the user edits them.
- Use `Intl`/BCP-47-aware formatting for dates, times and locale-facing numbers. Persisted numeric/schema values remain locale-independent.
- Canonical units use explicit semantics (pixels, percent, degrees, DPI/PPI metadata as defined later); decimal display follows locale while serialized data does not.
- Avoid embedding translatable text into icons, generated textures or other raster assets. Text-bearing onboarding/help imagery requires localized variants or live text overlays.
- Maintain a terminology glossary so Japanese/English names for tools, layer types, Lineart concepts, blend modes and import/export warnings remain consistent across UI, help and compatibility reports.

## P1-7. Phase 1 completion result

The following previously open pre-implementation decisions are closed:

1. product definition and target audience;
2. initial-release adoption/exclusion/post-baseline decisions for all previously pending features;
3. remaining 2026-08-30 external-application feature audit for the initial baseline;
4. exact minimum Tier-A OS/browser matrix and runtime-gate policy;
5. phone/narrow-tablet responsive product policy;
6. accessibility/inclusive-input contract;
7. Japanese/English localization contract.

This Phase-1 closure does **not** finalize F/G/H/I/V visual or asset work and does **not** declare Illustro globally `IMPLEMENTATION READY`. Global Design Freeze remains reserved for the final integration phase after the jointly decided visual/icon/texture/motion work and the remaining internal technical phases are complete.

## Phase 1 change-log entry

- 2026-08-30: Closed Phase 1 product/platform planning: fixed the target audience and supported runtime matrix, resolved all previously pending feature candidates, completed the frozen external-app feature audit with additional single-illustration capabilities, defined wide/compact/narrow responsive behavior, adopted WCAG-2.2-AA-oriented accessibility requirements, and fixed Japanese/English localization architecture without declaring the final global Design Freeze.

# Phase 2 UX / Interaction Closure — 2026-08-30

**Status:** authoritative Phase-2 specification. This closes B/C/D/E/U: editor information architecture, tool/panel inventory, core user flows, multimodal input arbitration, canonical Command Registry behavior, and error/recovery UX. It does **not** freeze F/G/H/V visual composition, color tokens, dimensions, icon artwork, or motion design. Those later joint decisions may change presentation, but must preserve the semantics and access paths defined here unless explicitly superseded.

## P2-1. Top-level product information architecture — CLOSED

Illustro has three product-level surfaces:

1. **Library shell** — local Gallery/Project Library, Recently Deleted, recovery visibility, import/create/open, settings/help, and compatibility diagnostics.
2. **Editor shell** — one active illustration document, its canvas/workspace, tools, inspectors, commands, and document-local transient modes.
3. **Task surfaces** — dialogs/sheets/popovers for bounded tasks such as New Document, Export, Import report, preferences, shortcut/workspace customization, and destructive confirmations.

The initial release does not use multiple editable canvases/documents in one editor workspace. Switching projects returns through the project/library flow rather than creating a multi-document tabbed production environment.

### Editor shell regions

The editor shell has five structural regions plus transient overlays:

- **Application / Document Bar**: project/library navigation, document identity, save/recovery state, Undo/Redo access, document/application menus, workspace/view entry points, Export, settings/help and other global commands. Drawing-tool parameter editing does not permanently occupy this bar.
- **Primary Tool Rail**: the persistent left-side family selector defined in P2-2.
- **Canvas Workspace**: central artwork, off-canvas surround, canvas transforms, rulers/guides, selection/transform handles and justified contextual overlays.
- **Inspector Dock**: the right-side reorderable/detachable block stack defined in P2-3.
- **Inspector Action Strip**: a non-scrolling fixed-bottom area whose commands follow the focused inspector block/context.

Transient surfaces may include Quick Hole, Selection Launcher, transform/shape handles, ruler controls, detached inspector PiPs, tool-family flyouts, popovers, menus, tooltips, task dialogs, persistent data-safety banners and non-critical toasts.

### Contextual-surface rule

A control belongs on the canvas only when spatial proximity to the artwork materially improves the operation. Permanent application/file/panel commands stay outside the canvas. Canvas overlays must disappear or reduce interference during active drawing when they are not needed for the stroke itself.

## P2-2. Primary Tool Rail inventory and order — CLOSED

The primary rail uses **14 stable Tool Family slots**. A family slot activates its most recently used subtool. Long-press, secondary activation, or an explicit family-expander opens the family list without changing the canonical family order. Exact icon artwork, rail dimensions and label presentation remain H/F/G decisions.

Default top-to-bottom family order:

1. **Brush**
   - ordinary raster Brush
   - Lasso Paint
2. **Eraser**
   - ordinary raster Eraser
   - Lasso Erase
   - Enclose Erase
3. **Blend**
   - Smudge
   - Blur brush
4. **Fill**
   - Flood Fill
   - Continuous Fill
   - Enclose Fill
   - Pattern Fill
   - Seeded Auto-Colorize / Flatting seed tool
5. **Eyedropper**
   - canvas sample
   - merged/reference-aware sample
   - reference-image sample when a reference source is active
6. **Selection**
   - Rectangle
   - Ellipse
   - Lasso
   - Polygon
   - Brush Selection
   - Auto/Magic Selection
   - Color Range
   - Magnetic/Edge-aware Selection
   - Enclose Selection
7. **Transform**
   - Move
   - Scale/Rotate
   - Free Transform
   - Perspective
   - Mesh
   - Puppet Warp
   - Repeat/Mirror-repeat transform modes
8. **Liquify**
   - local warp modes supported by the canonical Liquify implementation
9. **Gradient**
   - Linear
   - Radial
   - Conical/Sweep
   - Freeform/advanced gradient modes adopted by the document/effect model
10. **Shape / Path**
    - Line
    - Rectangle
    - Rounded Rectangle
    - Ellipse
    - Regular Polygon
    - Polyline
    - Bézier
    - Node/Path Edit
11. **Text**
    - Point Text
    - Box Text
12. **Repair**
    - Clone/Copy tool
    - Content-Aware Fill / Smart Patch initiation
13. **Ruler / Guide**
    - Straight
    - Circular/Elliptical
    - Radial/Concentration
    - Symmetry
    - Kaleidoscope
    - Array
    - 1/2/3-point Perspective
    - Hatching Guide
14. **Navigation**
    - Hand/Pan
    - Zoom
    - Rotate View

### Context-only editing modes

The following do **not** receive permanent primary-rail slots:

- Lineart Boundary editing — entered by selecting/activating a Lineart Boundary Layer or its explicit edit command.
- Layer-mask editing — entered through layer/mask state.
- Adjustment/effect editing — entered through the effect/layer inspector.
- Vector-node editing — available as the Shape/Path family's Node/Path Edit subtool and automatically entered when appropriate vector content is targeted.
- Timelapse playback — a task/panel mode, not a drawing tool.
- Split by Color and Color Match — document/layer commands, not persistent cursor tools.

This prevents the rail from growing with every specialized operation while retaining direct access through the Command Registry, Quick Access and relevant inspectors.

## P2-3. Right Inspector block inventory and default order — CLOSED

The Inspector Dock supports the existing reorder/tear-off/magnetic-redock model. The initial release contains these **13 normal dockable blocks**, in this default top-to-bottom order:

1. **Tool Properties** — parameters for the active tool/subtool; changes contextually but the block identity is stable.
2. **Brush Presets** — preset browser, favorites/recent/category access and preset-management entry points.
3. **Brush Studio** — deeper canonical brush-engine parameter editing and preset authoring.
4. **Color** — wheel/selectors, numeric color values, main/sub/previous colors, palettes, history, color mixing/intermediate helpers and Gamut Masks.
5. **Layers** — hierarchy, visibility, selection, reorder and grouping, plus compact per-row symbol controls for Blend Mode and Clipping and a separate symbol-first selected-layer action/settings area.
6. **Layer Properties** — deeper/secondary selected-layer inspection for detailed or type-specific properties, transforms and metadata; Blend Mode and Clipping remain directly operable from the corresponding layer row.
7. **Effects / Adjustments** — layer-local non-destructive filter stack plus adjustment-layer editing and effect-mask controls.
8. **Navigator** — document overview and navigation state.
9. **Reference / Sub View** — local reference images and reference-view controls; it is not an online material browser.
10. **History** — document history inspection/navigation consistent with the later Undo model.
11. **Quick Access** — user-configured Command Registry bindings, colors and safe Auto Action launchers.
12. **Assets** — local/imported project/user resources such as brush tips, grains, patterns, palettes and gradients. `Assets` is the canonical name; this block must not imply a built-in marketplace/catalog ecosystem.
13. **Auto Actions / Timelapse** — recorded safe command sequences and single-illustration process-history capture/playback/export entry points. These may use internal tabs but remain one dockable productivity block for the initial layout.

**Document / Canvas Properties** is exposed as a task/context surface reached from the Application/Document Bar and relevant commands rather than as a permanently docked default block. It may later be made an optional block without changing the Phase-2 IA.

### Block behavior

- Every normal block can be reordered, collapsed, detached into an internal floating panel and re-docked.
- Block visibility is user-configurable through a Panel Manager. Hiding a block removes only its presentation, never the underlying feature or state.
- Tool Properties may change content immediately when tool/context changes; user-edited values remain owned by the underlying tool/document state, not by the block instance.
- When a Lineart Boundary Layer is selected, Tool Properties becomes the authoritative Lineart Boundary edit inspector: regenerate, automatic-gap settings, reference membership, unresolved override review and overlay controls are available there.
- When Text/Transform/Shape/Vector content is actively edited, Tool Properties exposes the corresponding type-specific properties while Layer Properties continues to expose layer-level state.

### Fixed-bottom Inspector Action Strip

The fixed strip is **contextual and registry-driven**, not a second hard-coded toolbar.

- It always provides access to **Inspector Collapse/Expand** and **Panel Manager / More**.
- Its middle primary-action area follows the currently focused block. Examples: Layers → Add Layer / Add Folder / Add Mask / Delete or More; Brush Presets → Save/Add Preset / Import / More; Assets → Import/Add / Delete / More.
- If no block has focus, the middle area may be empty; it must not invent unrelated global commands merely to fill space.
- Destructive commands respect the same confirmation/Undo policy as every other command surface.

## P2-4. Contextual canvas UI — CLOSED

### Quick Hole

Existing Quick Hole behavior remains authoritative. It uses six Command Registry bindings and never owns private implementations of those commands.

### Selection Launcher

When a non-empty selection exists, Illustro may show a dismissible **Selection Launcher** near but not covering the selected region. It exposes registry-driven high-frequency actions such as Transform, Cut/Copy, Clear, Invert, Feather/Expand/Shrink and Fill where applicable.

- It is hidden during active drawing/stroke input.
- Dismissal does not clear the selection.
- Its placement is recomputed to stay inside the usable workspace and avoid major handles/inspector surfaces.
- Exact visual form and motion remain F/G/V decisions.

### Transform/shape/ruler handles

Handles directly manipulating geometry are part of the canvas interaction layer. Commit/Cancel must always have keyboard equivalents and an accessible non-canvas command path.

## P2-5. Canonical user flows — CLOSED

These flows define state transitions and required exits, not visual styling.

### Startup / Library

1. Start app → run required runtime/capability checks.
2. If full-editor gates pass → Library shell.
3. If a gate fails → compatibility/recovery shell with diagnostics and safe recovery/export options where available.
4. Library lists active projects plus explicit Recently Deleted/Recovery states.
5. User chooses New, Open, Import, Recover or Settings.

### New Document

Library/Project command → New Document task → choose dimensions/resolution/color-working settings/background/template as supported → validation → Create → allocate canonical project → initial coherent checkpoint → Editor.

Cancel before Create makes no project mutation. Invalid/unsafe dimensions are rejected before allocation with an actionable reason.

### Open / Project ownership

Open project → validate manifest/checkpoint/recovery state → acquire writable project lock → open Editor.

If another context owns the write lock, present **Open Read-only**, **Retry**, **Duplicate from latest coherent state** when possible, and **Return to Library**. Illustro never allows two independent writers to autosave over the same project.

### Ordinary save semantics

Editing continuously updates canonical working state and autosave/recovery according to the later persistence model. `Save` means force/await a coherent local checkpoint/flush; it does not require choosing an external file on every save. Explicit `.illustro` backup/export remains a separate command.

### Close / switch project

Close/Switch → ensure pending committed document transactions have reached the persistence handoff required by S/N → if safe, return to Library. If persistence is failing, show a blocking data-safety decision surface rather than silently closing and claiming success.

### Brush / Eraser

Activate Brush/Eraser family → last-used subtool becomes active → choose preset or retain current → Tool Properties exposes high-frequency parameters → Brush Studio exposes deep parameters → draw.

Preset editing never mutates a factory/default preset silently: edits create an explicit modified state; Save/Update/Duplicate behavior is clear. Import from ibis QR / `.sut` occurs into a staging representation, generates the FC-2 fidelity report, then the user accepts the normalized Illustro preset or cancels.

### Color

Open/use Color block or Eyedropper → change main/sub color or sample → update active color state immediately. Palette/history/gamut operations do not change painted pixels until a painting/effect/document command uses the selected color. Color Match operates as an explicit previewable document/layer command with Apply/Cancel.

### Layer creation and editing

Layers block → Add → choose layer type when multiple types are relevant → layer is inserted at a deterministic location near current selection → becomes selected.

Reorder/group/mask/reference changes are direct document commands and Undoable where semantically appropriate. **Blend Mode and Clipping are directly operable from the symbol controls inside the affected layer row; Clipping is a one-tap toggle and Blend Mode opens a row-anchored compact chooser.** Delete uses Undo as the primary recovery mechanism; confirmation is required only when deletion would cross an irreversible boundary not covered by history/storage policy.

### Selection

Activate Selection family → choose subtool → create/modify selection using Replace/Add/Subtract/Intersect modes → Selection Launcher and Tool Properties expose selection operations. `Esc` cancels the in-progress gesture first; when no gesture is active it clears/dismisses the transient operation according to context. Clearing an established selection is an explicit command.

### Transform

Invoke Transform on eligible target/selection → enter transform transaction → manipulate handles or numeric Tool Properties → Preview updates without repeated destructive resampling → **Commit** creates one document-history transaction; **Cancel** restores exact pre-transform state. Switching to an incompatible tool requests Commit/Cancel rather than silently applying an ambiguous transform.

### Shape / Vector path

Activate Shape/Path → create geometry → remain editable with post-creation handles/Tool Properties → Commit preserves canonical vector/path representation when the target layer/type supports it. Node/Path Edit modifies existing geometry through document-history transactions.

### Text

Activate Text → click/drag for Point/Box Text → enter text editing → Tool Properties provides typography → Commit creates/updates editable text content; Escape exits the current editing operation without unexpectedly rasterizing the text layer. Rasterization is always an explicit command.

### Fill / Pattern / Auto-Colorize

Activate Fill family → choose reference policy and subtool → perform region operation → preview where operation cost/ambiguity warrants it → commit as one history transaction.

Seeded Auto-Colorize: enter seed mode → place/edit color seeds → choose/review lineart/reference sources → Compute → preview region result → adjust seeds/recompute → Commit to configured paint output. The intermediate seed/result state is not silently destroyed until Commit/Cancel is resolved.

Pattern Fill exposes pattern choice and transformable pattern placement before Commit.

### Lineart Boundary

Select Lineart Boundary Layer or invoke `lineart.edit` → boundary-edit mode → overlay appears → automatic topology and unresolved overrides visible → user may add/connect/remove/split/reject/no-connect/regenerate → each committed logical edit is history-aware → leaving mode with an unfinished gesture cancels that gesture only; committed boundary edits remain.

Regeneration that creates unresolved manual-override mappings completes the safe automatic portion but raises a persistent review state; it never silently attaches an uncertain override to a different endpoint.

### Effects / Adjustments / Color Match

Choose destructive Filter command, add Adjustment Layer, or add layer-local Effect → select effect from Effect Registry → edit parameters with live preview → Apply/Commit for destructive path or retain parameterized non-destructive node for non-destructive path → Cancel leaves source unchanged. The same effect implementation is reused where semantics permit.

### Repair / Smart Patch

Select source/target region as required → preview deterministic repair → Commit or Cancel. Smart Patch never sends artwork to a cloud generative service in the initial-release baseline.

### Import

Import file/resource → parse into staging model → validate/convert color/profile/format → generate compatibility report when fidelity is not trivially lossless → user accepts, chooses supported conversion where required, or cancels → only then create/modify canonical project/resource state.

### Export

Export → choose format/options/destination → run preflight for unsupported semantics/color/flattening → present warnings requiring a choice when material loss is expected → render/encode to temporary output → atomically finalize/download/save when possible → success confirmation. A failed export never marks the project as externally backed up.

### Gallery / Recently Deleted

Deleting a project from Library moves it to Recently Deleted/reversible trash when the local model permits; permanent deletion is a separate, clearly destructive action. Recover returns the project to the active library without rewriting artwork semantics.

### Timelapse

Open Auto Actions/Timelapse → capture control / playback history → playback never mutates the document → Export produces a media output through an explicit task. Timelapse history is not an animation layer/timeline editor.

### Workspace / shortcut customization

Open customization → edit panel visibility/order/workspace, Quick Access, Quick Hole or command bindings → conflicts/invalid bindings are shown before acceptance → Apply/save workspace → Reset to Default always available. Workspace changes are not document-history commands.

## P2-6. Input-device role and arbitration matrix — CLOSED

### Canonical roles

- **Pen**: drawing, precise selection/editing, handle/node manipulation and ordinary UI activation.
- **Touch**: canvas navigation and UI by default; finger drawing is an explicit user setting.
- **Mouse**: desktop precision for the active tool plus desktop-standard navigation/context menus.
- **Keyboard**: accelerators, modifiers, temporary tools and explicit Commit/Cancel.

### Pen behavior

- Pen primary contact on canvas executes the active pen-capable tool.
- Pressure/tilt/orientation affect the tool only when mapped by the active brush/tool and supported by the device/browser.
- Pen hover may update cursor/eligible Quick Hole anchor state but never paints.
- A reported eraser-end input temporarily invokes the canonical Eraser behavior while that end is active.
- Reported stylus barrel buttons are user-remappable command/temporary-tool bindings. Default first-barrel behavior is **temporary Eyedropper** where the browser exposes a reliable button state.

### Touch behavior

Default on pen-capable devices:

- one-finger canvas drag → Pan;
- two-finger drag/pinch/twist → Pan/Zoom/Rotate as a combined navigation gesture;
- two-finger tap → Undo when the platform/browser does not reserve the gesture;
- three-finger tap → Redo when the platform/browser does not reserve the gesture;
- UI touch → normal control activation.

`Finger Drawing` is OFF by default on pen-capable devices. When enabled, one-finger contact uses the active drawing tool and two-finger gestures remain navigation. On a touch-only full-editor device, first-run may offer Finger Drawing explicitly and remember the choice.

### Pen + touch arbitration / palm rejection

- While a pen stroke/contact transaction is active on the canvas, new touch contacts in the canvas drawing region are ignored for document editing and navigation until the pen contact ends, unless a later explicitly tested simultaneous-navigation mode is adopted.
- Touch on application UI remains eligible when it can be distinguished safely, but it must never corrupt the active stroke transaction.
- Recent pen proximity/contact biases ambiguous touch contacts toward palm rejection.
- Illustro makes no claim to replace OS/driver palm rejection; application-side arbitration handles only events actually delivered by the browser.

### Mouse behavior

- Primary button → active tool.
- Secondary button → context menu where meaningful; during a modal geometry transaction it must not silently commit.
- Middle-button drag → temporary Pan.
- Wheel/trackpad scroll → Zoom by default when over canvas; modifier/configuration may provide scroll/pan behavior without changing document state.

### Keyboard and temporary-tool semantics

- `Esc` = Cancel current uncommitted modal/gesture operation; if none, dismiss the highest-priority dismissible transient surface.
- `Enter` = Commit the active transform/text/shape/effect task when a commit action exists and text-field semantics do not consume Enter.
- Hold `Space` = temporary Hand/Pan; release restores the previous tool.
- Hold `Alt/Option` on canvas = temporary Eyedropper where the active context allows color sampling; release restores the previous tool.
- Temporary-tool invocation never changes the user's remembered primary Tool Family/subtool selection.

### Input precedence

Highest to lowest for an event sequence:

1. blocking modal/task surface;
2. active text/numeric field editing;
3. active committed-mode geometry transaction (transform/path/shape etc.);
4. direct UI control under pointer;
5. pen stroke/tool contact;
6. canvas navigation gesture;
7. ordinary canvas tool activation;
8. global shortcut/gesture that is not reserved by a higher context.

No single physical event may execute two document-mutating commands because two recognizers both accepted it.

## P2-7. Default keyboard bindings — CLOSED

Bindings use `Ctrl` on Windows/Linux-like environments and `Command` on macOS/iPad hardware keyboards where appropriate. Browser/OS-reserved shortcuts are intercepted only when the platform permits; every command remains reachable from UI even when a shortcut cannot be claimed.

- Undo: `Ctrl/Cmd+Z`
- Redo: `Ctrl/Cmd+Shift+Z`
- Explicit local checkpoint/Save: `Ctrl/Cmd+S`
- Copy/Cut/Paste: standard `Ctrl/Cmd+C/X/V`
- Select All: `Ctrl/Cmd+A`
- Deselect: `Ctrl/Cmd+D`
- Brush: `B`
- Eraser: `E`
- Fill family: `F`
- Selection family: `M`
- Transform: `V`
- Gradient: `G`
- Text: `T`
- Navigation/Hand: `H`
- Ruler/Guide family: `R`
- Temporary Hand: hold `Space`
- Temporary Eyedropper: hold `Alt/Option`
- Brush size decrease/increase: `[` / `]`
- Fit Canvas: `0`
- 100% zoom: `1`
- Commit current task: `Enter`
- Cancel/dismiss current task: `Esc`
- Toggle most UI chrome for canvas-focus view: `Tab`

All defaults are user-remappable except platform-required/non-overridable behavior. Shortcut conflicts are rejected or explicitly resolved; the system never silently lets two enabled bindings compete in the same context.

## P2-8. Canonical Command Registry — CLOSED

All user-invokable actions from menus, tool rail, Quick Hole, Quick Access, Inspector Action Strip, Selection Launcher, shortcuts, stylus buttons and Auto Actions resolve through a **single Command Registry**.

### Command definition contract

Every command definition has at least:

- stable locale-neutral `id`;
- localized `labelKey` and optional description key;
- category/namespace;
- invocation kind: `instant`, `toggle`, `tool`, `temporary-tool`, `modal-task`, or `parameterized`;
- availability/enabled predicate;
- context requirements;
- Undo policy: `none`, `document-transaction`, `workspace-state`, or `external-side-effect`;
- Quick Hole eligibility;
- Quick Access/Command Bar eligibility;
- shortcut/stylus/gesture binding eligibility;
- Auto Action recordability and parameter schema;
- destructive/safety classification;
- repeat/coalescing policy where relevant.

A **Command Binding** is `{ commandId, args? }`. Parameterized registries such as Tool Registry, Effect Registry, Layer-Type Registry, Export-Format Registry and Workspace Registry are referenced through `args`; this avoids creating hundreds of unrelated code paths while still allowing a binding such as “activate Magnetic Selection” or “add Gaussian Blur” to be stored explicitly.

### Required top-level command namespaces

`app`, `project`, `document`, `history`, `clipboard`, `view`, `tool`, `brush`, `color`, `selection`, `transform`, `layer`, `mask`, `vector`, `text`, `fill`, `lineart`, `effect`, `asset`, `action`, `timelapse`, `workspace`, `import`, `export`, `recovery`.

### Required stable command catalog

The following command IDs are canonical initial-release entries; parameterized commands use the relevant registry IDs in `args`:

**Application / Project**
- `app.settings.open`
- `app.help.open`
- `project.library.open`
- `project.new`
- `project.open`
- `project.close`
- `project.duplicate`
- `project.rename`
- `project.saveCheckpoint`
- `project.moveToTrash`
- `project.restoreFromTrash`
- `project.deletePermanently`

**Import / Export / Recovery**
- `import.file`
- `import.brush`
- `import.asset`
- `export.image`
- `export.project`
- `export.brush`
- `export.timelapse`
- `recovery.open`
- `recovery.restoreCheckpoint`
- `recovery.exportSafeCopy`

**History / Clipboard**
- `history.undo`
- `history.redo`
- `clipboard.cut`
- `clipboard.copy`
- `clipboard.paste`

**View / Workspace**
- `view.fitCanvas`
- `view.actualPixels`
- `view.zoomIn`
- `view.zoomOut`
- `view.resetRotation`
- `view.flipHorizontalPreview`
- `view.toggleCanvasOnly`
- `view.toggleRulersGuides`
- `workspace.inspector.toggle`
- `workspace.panelManager.open`
- `workspace.quickHole.configure`
- `workspace.quickAccess.configure`
- `workspace.shortcuts.configure`
- `workspace.save`
- `workspace.switch`
- `workspace.reset`

**Tool activation**
- `tool.activate` with `toolId`
- `tool.activateTemporary` with `toolId`
- `tool.previous`
- `tool.toggleBrushEraser`

**Brush / Color**
- `brush.size.increment`
- `brush.size.decrement`
- `brush.preset.select` with `presetId`
- `brush.preset.save`
- `brush.preset.duplicate`
- `brush.preset.rename`
- `brush.preset.delete`
- `color.swapMainSub`
- `color.resetMainSub`
- `color.palette.apply` with `colorId`
- `color.match.open`

**Selection**
- `selection.selectAll`
- `selection.clear`
- `selection.invert`
- `selection.feather`
- `selection.expand`
- `selection.shrink`
- `selection.convertFromAlpha`
- `selection.saveMask`

**Transform / Vector / Text**
- `transform.begin`
- `transform.commit`
- `transform.cancel`
- `transform.align` with `alignment`
- `transform.distribute` with `distribution`
- `vector.editNodes`
- `vector.simplify`
- `vector.connect`
- `vector.split`
- `text.edit`
- `text.rasterize`

**Layers / Masks**
- `layer.add` with `layerTypeId`
- `layer.duplicate`
- `layer.delete`
- `layer.rename`
- `layer.group`
- `layer.ungroup`
- `layer.mergeDown`
- `layer.mergeSelected`
- `layer.flattenVisible`
- `layer.toggleVisibility`
- `layer.toggleLock`
- `layer.toggleAlphaLock`
- `layer.toggleClipping`
- `layer.setReference`
- `layer.setDraft`
- `layer.splitByColor`
- `mask.add`
- `mask.delete`
- `mask.invert`
- `mask.apply`

**Fill / Lineart**
- `fill.execute` with active fill/tool parameters
- `fill.references.configure`
- `fill.autoColorize.compute`
- `fill.autoColorize.commit`
- `fill.autoColorize.cancel`
- `lineart.edit`
- `lineart.regenerate`
- `lineart.connect`
- `lineart.disconnect`
- `lineart.rejectBridge`
- `lineart.toggleNoConnect`
- `lineart.reviewUnresolved`

**Effects**
- `effect.applyDestructive` with `effectId`
- `effect.addAdjustmentLayer` with `effectId`
- `effect.addToStack` with `effectId`
- `effect.toggle`
- `effect.reorder`
- `effect.remove`
- `effect.commitPreview`
- `effect.cancelPreview`

**Assets / Auto Actions / Timelapse**
- `asset.import`
- `asset.delete`
- `asset.rename`
- `action.record.start`
- `action.record.stop`
- `action.run` with `actionId`
- `action.delete`
- `timelapse.capture.toggle`
- `timelapse.play`
- `timelapse.pause`
- `timelapse.seek`

### Registry rules

- Menus/UI surfaces do not call document mutations directly; they dispatch commands.
- A disabled command reports why when invoked through an indirect surface such as shortcut/Quick Hole.
- Auto Actions may record deterministic document/workspace-safe commands but must not record permission prompts, external file pickers, permanent deletion, recovery destruction, browser security decisions or other unsafe external side effects as blindly replayable steps.
- Document-mutating command dispatch creates/joins the canonical transaction boundary defined by **P3-13/P3-14**; workspace commands never pollute document Undo history.
- Visual icon identifiers are references added during H; command identity never depends on icon artwork.

## P2-9. Error, warning and recovery UX contract — CLOSED

### Severity model

- **Informational**: transient toast/status is acceptable; no user action required.
- **Recoverable warning**: persistent banner/panel until resolved or explicitly dismissed when safe; includes an action.
- **Blocking task error**: task cannot complete, but editor/project remains coherent; keep user in the task with actionable retry/change/cancel paths.
- **Data-safety critical**: autosave/storage/corruption/ownership conditions that can risk work; persistent non-color-only warning and, where needed, block unsafe close/mutation until the user chooses a safe path.

Data-safety failures are never communicated only by a disappearing toast.

### Required failure flows

**WebGPU/runtime gate failure** → compatibility shell → explain failed capability → diagnostics → retry after environment change → safe project recovery/export when possible. Do not enter a fake reduced full editor.

**GPU device loss during editing** → stop issuing document-dependent GPU work → preserve canonical CPU/storage state → show non-destructive Recovering state → rebuild renderer → resume when successful. If rebuild fails, keep document state and offer Retry / safe checkpoint/export / return to Library as available.

**OPFS/storage API unavailable after startup** → stop claiming autosave success → retain safe in-memory state as far as possible → persistent critical warning → retry storage, safe external project export if possible, or read-only/recovery exit. Do not continue indefinitely as though persistence works.

**Storage pressure** → staged warnings before unsafe capacity → offer project export/cleanup/Recently Deleted cleanup → when the later S-defined safety reserve is breached, block operations that require unsafe persistence growth rather than letting the project fail unpredictably.

**Autosave/checkpoint failure** → visible persistent save-state failure → Retry / Export Safe Copy / diagnostics. Closing/switching cannot silently discard the warning.

**Project locked elsewhere** → Open Read-only / Retry / Duplicate coherent snapshot / Return to Library. No forced second writer.

**Corrupt project** → never overwrite the only suspect source while attempting recovery → inspect latest coherent checkpoints/journal → offer recovered copy and safe external export → preserve original until the user explicitly permanently deletes it.

**Unsupported/partial brush import** → staging parse → explicit `UNSUPPORTED`/`PARTIAL` fidelity report → mapped/ignored/substituted fields → Accept normalized brush or Cancel.

**PSD or other partial document import** → staging project + pre-commit fidelity report; unsupported constructs require explicit flatten/convert/omit choices where possible. Silent destructive import is prohibited.

**Unsupported color/ICC profile** → warn before conversion → offer supported conversion when reliable or Cancel/Reject; never silently treat profile samples as sRGB.

**Unsafe/oversized canvas request** → validation failure before canonical allocation → show limiting dimension/resource reason and allow adjusted values.

**Out-of-memory/resource exhaustion during operation** → abort current uncommitted operation where possible → return to last coherent document state → recommend lower transient workload/close other projects/export; do not corrupt canonical state.

**Export failure** → keep project unchanged and destination not falsely marked complete → Retry/change destination/options → report whether any temporary/partial output was discarded.

**Linked/external object unavailable** → use embedded/snapshotted canonical project representation when available → show missing-link warning → Relink / Keep Embedded Snapshot. Missing permission never makes the whole project unopenable solely because an external acceleration link disappeared.

**Lineart regeneration ambiguity** → preserve safe regenerated topology + unresolved override records → persistent badge/review list → user resolves mappings; uncertain overrides are never silently attached elsewhere.

### Confirmation policy

- If an action is fully and reliably Undoable within the active history contract, prefer immediate action + Undo over confirmation spam.
- Require explicit confirmation for permanent project deletion, irreversible external overwrite where the platform cannot provide atomic replacement/recovery, destructive operations outside available Undo/recovery capacity, and actions that intentionally discard unresolved recovery data.
- Confirmation text states the concrete consequence and the recovery path, if any.

## P2-10. Phase 2 completion result

Phase 2 closes the following previously open pre-implementation questions:

1. exact editor information architecture and panel inventory;
2. exact primary left-toolbar family inventory/order;
3. exact right-inspector block inventory/default order and fixed-bottom control semantics;
4. core user flows for project, drawing, selection, transform, layer, Lineart, effect, import/export, gallery, timelapse and customization;
5. Pen/Touch/Mouse/Keyboard roles and event arbitration;
6. default shortcut semantics;
7. the canonical Command Registry contract, namespaces and required initial command catalog;
8. error/warning/recovery UX including data-safety failures.

This phase intentionally leaves F/G/H/V visual/layout-detail decisions to the later joint visual-design phase. It does not declare global `IMPLEMENTATION READY` or final Design Freeze.

## Phase 2 change-log entry

- 2026-08-30: Closed Phase 2 UX/interaction planning by fixing the three-surface product IA, 14-family primary Tool Rail, 13-block dockable Inspector and contextual action strip, canonical user flows, multimodal input arbitration/default shortcuts, a single registry-driven command architecture, and data-safety/error/recovery UX without freezing later visual/icon/motion design.

# Phase 5A F/G UI Structure + Visual Design Closure — 2026-08-30

**Status:** AUTHORITATIVE / CLOSED for **F — screen/layout/UI composition** and **G — visual design system**. This section supersedes earlier provisional F/G mockup details and any older presentational wording that conflicts with it. Phase-2 functional semantics, Command Registry, feature access paths, input arbitration and the 13 inspector-block identities remain authoritative unless explicitly superseded below. **H — final icon artwork** and **V — motion design** remain open and will be closed separately. This section does not declare global Design Freeze.

## FG-1. Governing UI principles — CLOSED

Every Illustro production surface must satisfy these rules together:

1. **Canvas First:** the artwork/canvas dominates the editor. Permanent canvas overlays are exceptional; application/file/panel commands remain outside the canvas unless spatial proximity materially improves the operation.
2. **Direct Manipulation:** users directly drag layers, panel boundaries, inspector blocks, detached PiPs, transform handles, vector nodes and docking positions instead of routing ordinary spatial actions through settings dialogs.
3. **Recognition over Recall:** tool families, subtool availability, draggable inspector blocks, detachable PiP capability, current mode, Commit/Cancel state and data-safety state must be visually discoverable without memorized gestures.
4. **Progressive Disclosure:** high-frequency parameters stay exposed; medium-frequency controls live in the appropriate inspector/context surface; specialist settings live in expandable deep blocks or bounded task surfaces.
5. **Contextual UI:** selection launchers, transform/vector handles, Lineart overlays and similar controls exist only while the corresponding context exists.
6. **Immediate Feedback:** tool/context changes update their inspector immediately; drag/reorder/docking shows the resulting target before drop; parameter changes preview locally when safe; persistent operations report save/recovery state without delay.
7. **Input-role separation:** Pen = drawing/precision; Touch = canvas navigation/UI by default; Keyboard = acceleration/temporary tools; Mouse = desktop precision. UI placement must not force one device into another device's primary role.
8. **Customization First:** rail/inspector dimensions, dock order, visibility, PiP placement, Quick Access and Quick Hole presentation are user-configurable within ergonomic bounds and always have a reset path.
9. **One command model:** Quick Hole, Quick Access, shortcuts, menus, tool surfaces and automation invoke the canonical Command Registry rather than private duplicate implementations.

## FG-2. F-stage map — CLOSED

F is organized into eight implementation/mockup stages. These are design groupings, not separate applications:

1. **Home / Library**
2. **Canvas Main / Editor Shell**
3. **Tool Rail + Tool/Brush UI**
4. **Color / Layers / Selection / Transform**
5. **Vector / Text / Fill / Lineart / Effects**
6. **Supporting Inspector Blocks + PiP workspace**
7. **Settings / Customization / New / Import / Export task surfaces**
8. **Error / Recovery / shared UI components**

## FG-3. Stage 1 — Home / Library — CLOSED

The Library is intentionally quieter than the editor and contains no drawing inspector/tool chrome.

### Wide layout

- Thin application header: Illustro identity at left; Search, Sort, View and **New** at the right.
- Left navigation: **Projects, Recent, Recovery, Recently Deleted, Import**, with **Settings** fixed at the lower end.
- Center/right content: project grid/list. Artwork thumbnails are the dominant visual content; cards do not expose many permanent action buttons.
- Project secondary actions appear on selection/hover/context activation: Open, Rename, Duplicate, Export/Backup, Delete as applicable.
- Recovery/storage/data-safety conditions use persistent notices/badges, never color-only or toast-only communication.

### Compact layout

At 600–1099 CSS px the navigation may become a drawer/list-to-detail presentation, while Project/New/Import/Recovery remain directly reachable.

## FG-4. Stage 2 — Canvas Main / Editor Shell — CLOSED

The default wide editor has exactly these persistent structural regions:

1. **Document Bar** at top.
2. **Primary Tool Rail** at left.
3. **Canvas Workspace** in the center and behind permitted detached/contextual overlays.
4. **Inspector Dock** at right.
5. **Fixed Inspector Action Strip** contained entirely within the right-inspector width.

### Document Bar

Default height: **48 CSS px**.

Left cluster: Back/Library, project/document name, coherent save/recovery state.

Center/right cluster: Undo, Redo, zoom/view/workspace entry, Export and More/application commands. Drawing parameters such as brush size do not permanently occupy this bar.

### Canvas Workspace

- The workspace uses all remaining area between the rail and inspector; the canvas is not presented as a heavy decorative card.
- Canvas surround is very-light neutral; artwork/document boundary is subtle.
- Permanent canvas utility toolbars are prohibited. The intentional persistent/idle exception is Quick Hole; selection/geometry/Lineart controls are contextual.
- A Selection Launcher is **not shown when no non-empty selection exists**.

## FG-5. Stage 3 — Primary Tool Rail + Tool/Brush UI — CLOSED

### Rail geometry

- Default rail width: **64 CSS px**.
- User-resizable range: **56–88 CSS px**.
- Each family uses a colored icon above/with a very small label; it must not become a wide text toolbar.
- Visual tool icon size target: **22 CSS px**; effective primary hit region is at least **44 CSS px** where practical.
- Family/subtool affordance is visible without consuming a second permanent column.

### Canonical 14-family order

1. Brush
2. Eraser
3. Blend
4. Fill
5. Eyedropper
6. Selection
7. Transform
8. Liquify
9. Gradient
10. Shape / Path
11. Text
12. Repair
13. Ruler / Guide
14. Navigation

Lasso is a Selection subtool, **not** an independent rail family. Layers are inspector content, **not** a rail family. A generic rail slot labelled merely “Other” must not replace canonical families.

### Subtool presentation

Activating the family-expander/long-press/secondary affordance opens a compact flyout **toward the canvas side of the rail**. Selecting a subtool closes the flyout and makes it the remembered primary subtool for that family.

### Brush hierarchy

For Brush/Eraser workflows:

- **Tool Properties:** high-frequency values (size, opacity, flow/deposit where applicable, stabilization and other immediate controls).
- **Brush Presets:** preset search/category/favorites/recent/management.
- **Brush Studio:** deep canonical-engine authoring (Tip, Stroke, Ink, Dynamics, Jitter, Spray, Texture, Color Mixing, Anti-overflow, Stabilization, Anti-alias and future schema-compatible sections).

This hierarchy is mandatory Progressive Disclosure; ordinary size/opacity changes must not require opening Brush Studio.

## FG-6. Stage 4 — Color / Layers / Selection / Transform — CLOSED

### Color block

Located in the Inspector Dock and organized from frequent to specialist: selector/wheel, Main/Sub/Previous, numeric values, palette/history, mixing and Gamut Mask. Color Match is a command/task, not a permanent rail tool.

### Layers block

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

### Selection

A non-empty selection may expose a small Selection Launcher near—but not covering—the target. It contains high-frequency registry commands only and disappears when the context no longer exists or while active drawing makes it obstructive.

### Transform

Canvas: bounding geometry, pivot, mesh/warp/path handles and other spatial controls.

Tool Properties: numeric position/size/rotation, mode/interpolation/alignment and non-spatial values.

Commit/Cancel remain available through accessible contextual/inspector paths and Enter/Esc; they are not placed permanently in the bottom inspector strip.

## FG-7. Stage 5 — Vector / Text / Fill / Lineart / Effects — CLOSED

- **Vector/Shape:** nodes, Bézier handles, snap indicators and geometry are manipulated on canvas; styles/numeric properties live in Tool Properties/Layer Properties.
- **Text:** text content is edited directly on canvas; typography is edited in Tool Properties; rasterization remains an explicit command.
- **Fill:** direct canvas initiation; tolerance/reference/gap closing/under-line expansion/continuous/pattern/seed options in Tool Properties.
- **Lineart Boundary:** no permanent rail family. Selecting/invoking a Lineart Boundary enters context mode, shows topology/endpoints/automatic/manual/rejected/unresolved state on canvas, and turns Tool Properties into the Lineart Boundary inspector.
- **Effects/Adjustments:** ordered stack in its inspector block; reorder by drag; parameter changes use live preview; destructive Apply/Cancel appears only for the active operation.

## FG-8. Stage 6 — Inspector Dock and detachable PiP workspace — CLOSED

### Canonical block order

The 13 normal blocks remain:

1. Tool Properties
2. Brush Presets
3. Brush Studio
4. Color
5. Layers
6. Layer Properties
7. Effects / Adjustments
8. Navigator
9. Reference / Sub View
10. History
11. Quick Access
12. Assets
13. Auto Actions / Timelapse

### Default expansion policy

On first-run Brush context, **Tool Properties, Brush Presets, Color and Layers** are the principal exposed blocks; Brush Studio and lower-frequency blocks may start collapsed. After user reconfiguration, persisted user state wins.

### Inspector dimensions

- Default width: **320 CSS px**.
- User-resizable range: **260–480 CSS px** on wide layouts, clamped further when the viewport cannot preserve a usable canvas.
- Standard block-header height: **36 CSS px**.
- Inspector contents scroll above a fixed bottom strip.

### Block-header affordances

Every normal block visibly communicates that it is movable and detachable. A header provides:

- drag/reorder handle/affordance;
- stable block title and accent identity;
- explicit detach/PiP affordance;
- collapse/expand affordance.

Final icon artwork belongs to H, but the affordances themselves are mandatory F behavior.

### PiP behavior

- Dragging a block away or invoking its detach affordance tears it off without duplicating tool state.
- Detached PiPs are movable and resizable, stay visible when the main inspector collapses, and remain the same underlying block.
- Recommended initial detached width is **280 CSS px**; minimum functional footprint is approximately **220 × 140 CSS px**, with block-specific larger minimums allowed.
- Detached `×` means **return/re-dock**, never reset/destroy.
- Moving a PiP near the Inspector Dock opens a visible candidate insertion region and neighboring blocks make room before drop. Dropping there re-docks at that exact order position.
- Inspector/PiP boundaries use direct resize affordances; workspace persistence records their sizes and positions.

## FG-9. Quick Hole Controller — CLOSED / SUPERSEDES EARLIER MAPPING AND RING DEPICTIONS

This subsection is authoritative over every earlier Quick Hole slot mapping or visual depiction that conflicts with it.

### Geometry

- **There is no visible ring.**
- The controller consists of **six separate regular-hexagon translucent panels** around a completely empty center.
- Button centers lie on the six vertices of one regular hexagon whose left/right vertices are horizontal. Equivalently, clockwise center angles from the positive x-axis are **0°, 60°, 120°, 180°, 240°, 300°**. This is the required **30° rotation** relative to the incorrect top/bottom-vertex orientation used in earlier mockups.
- Default visual diameter of each hex panel: approximately **36 CSS px across corners**.
- Default center radius: approximately **36 CSS px**, producing an overall visible controller diameter of about **108 CSS px**.
- Effective interaction regions may extend beyond the visible hexes and are partitioned to preserve reliable ~44 CSS px touch targeting without visually enlarging the controller.
- Size/radius/button sizing remain user-adjustable within safe bounds.

### Authoritative default slot mapping

Clockwise from the **right** vertex:

- **0° / right:** Redo
- **60° / upper-right:** Fill
- **120° / upper-left:** Brush / Eraser Toggle
- **180° / left:** Undo
- **240° / lower-left:** Lasso
- **300° / lower-right:** Eyedropper

This explicitly supersedes the older mapping that placed Eyedropper upper-right and Fill lower-right.

### Visual surface

- Hex panels are translucent glass-like surfaces; the artwork remains clearly visible through them.
- Default hex fill target: approximately `rgba(255,255,255,0.26)` over the canvas, adjusted by contrast handling rather than replaced by an opaque white card.
- No surrounding white donut/ring surface is drawn.
- The center remains visually empty so the most recently operated canvas position is minimally obscured.
- Normal state uses **colored glyphs only**; persistent text labels around the six buttons are not shown. Labels may appear in tooltip/long-press/customization/accessibility presentation.
- Chromatic command glyphs must not contain black internal strokes/fills merely for detail. Black is not mixed into the colorful Lasso, Brush/Eraser, Fill, Eyedropper, Undo or Redo glyphs. Contrast is achieved through the assigned chromatic color, outline treatment and local surface adaptation.

### Behavior

Existing canvas-anchor behavior remains: eligible canvas interaction updates the anchor; UI interaction does not. Active drawing hides the controller. Eligible non-UI workspace dismissal hides it until a subsequent eligible canvas interaction. Six command assignments/order and presentation parameters remain user-configurable through the Command Registry/workspace system.

## FG-10. Fixed Inspector Action Strip — CLOSED / SUPERSEDES EARLIER CONTEXTUAL PRIMARY-AREA DEFAULT

The bottom strip is entirely inside the right-inspector column and does not extend under the canvas.

Default persistent command set is exactly:

1. **Undo**
2. **Redo**
3. **Horizontal Flip / Mirror View**
4. **Vertical Flip View**

It does not contain New/Open/Save/Canvas/Rotate/Crop or other application commands. Inspector collapse and Panel Manager/More are available from inspector/header controls rather than consuming these four slots. Context-specific Commit/Cancel/Add/Delete operations remain available in their relevant contextual block/task surface rather than silently replacing the four default strip commands.

Default strip height: **52 CSS px**.

## FG-11. Stage 7 — Settings / Customization / New / Import / Export — CLOSED

### Settings

A dedicated task/screen surface, not a tiny popover. Wide layout uses left categories + right details; compact uses category → detail navigation.

Canonical categories: General, Interface, Input/Pen, Canvas, Color, Performance, Storage, Accessibility, Language, Workspace, Diagnostics.

### Workspace Customization

Workspace customization is direct and preview-based rather than a list of abstract checkboxes. It exposes rail width, inspector width, panel order/visibility, PiP positions, Quick Access, Quick Hole and shortcuts, with Reset.

### New / Import / Export

These are bounded central task surfaces. Import performs staging/validation and shows a compatibility report only when needed. Export shows preflight when material loss/conversion is expected. These task surfaces do not become permanent editor sidebars.

## FG-12. Stage 8 — Error / Recovery / shared components — CLOSED

Severity determines presentation:

- **Toast:** brief non-critical acknowledgement.
- **Persistent banner:** continuing warning that does not block editing, e.g. low storage/degraded autosave.
- **Canvas/editor overlay:** temporarily blocks only the affected interaction, e.g. renderer rebuild, while safe recovery/save actions remain reachable.
- **Dedicated compatibility/recovery screen:** editor cannot safely operate, e.g. unsupported WebGPU or corrupt project recovery.

Data-safety failures always include icon/shape + text + action; color alone is never sufficient.

Shared component families include button, icon button, segmented control, tabs, field, numeric field, slider, toggle, dropdown, search, tree row, asset/preset tile, menu, popover, tooltip, sheet/dialog, banner, toast, progress and empty/loading/disabled states. H/V may change icon art or motion, but not these component semantics.

# G Visual Design System — CLOSED

## G-1. Visual identity

The canonical initial-release visual theme is **Light-first: crisp white / very-light neutral surfaces with distributed vivid chromatic accents and restrained pastel-tint states**.

Illustro must not drift into either of these failure modes:

- a dark/black editor used as the default visual identity;
- a de-facto blue application where blue is the universal button/slider/selection color and other colors are decorative.

Large saturated panel backgrounds, candy-like rainbow cards and excessive gradients are prohibited in production UI. Color density is low by area but broad by hue.

## G-2. Neutral tokens

Canonical light-theme base tokens:

- `canvas-surround`: **#F7F8FC**
- `surface-0`: **#FFFFFF**
- `surface-1`: **#F6F8FB**
- `surface-hover-neutral`: **#F1F4F8**
- `border-default`: **#E4E9F1**
- `divider`: **#EDF1F6**
- `text-primary`: **#182033**
- `text-secondary`: **#667085**
- `text-muted`: **#98A2B3**

Pure black is not the standard UI text/icon color; dark neutrals are used for ordinary neutral information.

## G-3. Chromatic spectrum

Primary functional accents:

- Pink: **#FF4F9A**
- Magenta: **#E84DCE**
- Violet: **#8B5CF6**
- Cyan: **#22B8F0**
- Mint: **#2ED3A7**
- Orange: **#FF9A3C**
- Yellow: **#F6C84A**
- Blue: **#4E8DF7** — one spectrum member, never the universal default accent.

Default mockup/release review should avoid letting Blue/Cyan collectively dominate the chromatic UI. As a visual-review heuristic, Blue/Cyan should normally remain below roughly **35% of chromatic accent area** on a default editor screen unless the active artwork/tool context itself justifies more.

## G-4. Tool-family accent mapping

Default family identities:

- Brush → Pink
- Eraser → Cyan
- Blend → Violet
- Fill → Mint
- Eyedropper → Magenta/Violet
- Selection → Magenta
- Transform → Orange
- Liquify → Cyan/Mint
- Gradient → Violet/Pink
- Shape / Path → Coral/Pink family
- Text → Magenta/Violet
- Repair → Orange
- Ruler / Guide → Yellow
- Navigation → Blue

A family color colors the glyph/indicator/active-tint details; it does **not** paint the whole rail or panel body.

## G-5. Inspector-block accent mapping

Default identities:

- Tool Properties → active Tool Family color
- Brush Presets → Pink
- Brush Studio → Violet/Pink
- Color → multicolor functional spectrum
- Layers → Violet
- Layer Properties → Magenta/Violet
- Effects / Adjustments → Orange/Yellow
- Navigator → Cyan
- Reference / Sub View → Mint/Violet
- History → neutral-violet
- Quick Access → Magenta
- Assets → Orange/Yellow
- Auto Actions / Timelapse → Violet

Inspector and PiP bodies remain neutral/white. Accent is concentrated in glyphs, slim indicators, selected states, tiny badges and active controls.

## G-6. Color-use levels

1. **Neutral:** default surface/text/border; most of the UI.
2. **Accent mark:** icon, slim indicator, slider thumb/active segment, compact underline.
3. **Soft tint:** approximately **8–15% visual tint strength** for hover/selected contextual surfaces.
4. **Strong accent:** small focus/active/drag-insertion/high-priority details.
5. **Large saturated surface:** prohibited by default except inherently chromatic content such as the actual color picker/artwork.

Rainbow/spectrum gradients are reserved for the logo, actual color/gradient controls and rare brand flourishes; they are not ordinary button/panel backgrounds.

## G-7. Typography

Use a self-hostable/system-compatible sans-serif stack; no UI correctness depends on one proprietary font. Preferred stack:

`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif`

Canonical sizes:

- task/page title: **18 px / 24 px**, weight 600
- document/project title: **14 px / 20 px**, weight 600
- panel/block header: **13 px / 18 px**, weight 600
- ordinary UI/body/value: **12.5–13 px / 18 px**, weight 400–500
- compact secondary label: **11 px / 16 px**, weight 500
- Tool Rail label: **9.5–10 px / 12 px**, weight 500

Do not use decorative display type in production controls. Japanese/English labels must fit without forcing the rail or common controls to become substantially wider.

## G-8. Spacing, density and control dimensions

Base spacing rhythm: **4 px grid**, with practical tokens **4 / 8 / 12 / 16 / 24 / 32 px** and 6 px permitted for compact internal gaps.

Common dimensions:

- Document Bar: 48 px
- Tool Rail: 64 px default, 56–88 px adjustable
- Inspector: 320 px default, 260–480 px adjustable
- Inspector header: 36 px
- Inspector Action Strip: 52 px
- standard compact field/button visual height: **32–36 px**
- touch-priority primary hit target: approximately **44 px or greater** where practical
- rail icon visual size: approximately 22 px

Dense pointer-oriented rows may be visually smaller only when expanded hit regions or alternate access preserve usability.

## G-9. Radius and geometry

Canonical radius family:

- small/internal: **4 px**
- fields/compact buttons: **8 px**
- ordinary panels/popovers: **10–12 px**
- prominent dialog/task/PiP outer frame: **12 px**
- pill/chip only when semantically justified: full-pill radius
- Quick Hole: regular-hexagon geometry defined in FG-9, not rounded circular buttons and not a surrounding donut ring.

Avoid oversized toy-like rounded cards.

## G-10. Borders and depth

- Ordinary structural border: **1 px #E4E9F1**.
- Dividers: **1 px #EDF1F6**.
- Focus/selected edge: approximately **2 px** using the relevant accent plus redundant shape/tint state.
- Dock insertion uses an accent edge/tint and actual layout gap; no rainbow glow.
- Docked inspector blocks generally use borders/dividers rather than independent shadows.
- PiP/popover shadow target: approximately `0 6px 18px rgba(24,32,51,0.10)`.
- modal/task elevation may use approximately `0 12px 32px rgba(24,32,51,0.14)`.
- Canvas itself must not look like a heavy elevated card.

## G-11. Translucency

Translucency is limited to overlays where seeing the artwork underneath is useful.

- Quick Hole hex panels: approximately **26% white fill** by default, with artwork clearly visible through them; user-adjustable.
- Selection/context launchers: translucent light surface, normally more opaque than Quick Hole for text/action legibility.
- Detached PiP body: predominantly opaque/white for parameter readability; PiP is not required to reveal artwork through complex controls.
- Contrast adaptation may add subtle outline/local backdrop treatment; it must not turn Quick Hole into opaque white hex cards.

## G-12. Interaction-state visuals

- **Hover:** small soft tint / border or glyph emphasis; no large recoloring.
- **Pressed:** stronger local tint/edge while preserving the control's family identity.
- **Selected/active:** accent glyph + soft tint + structural edge/indicator; never hue alone.
- **Keyboard focus:** visible ~2 px focus treatment using the relevant accent or canonical Violet focus accent where no functional color exists.
- **Disabled:** reduced emphasis via neutralized text/glyph/surface while retaining readable labels; disabled state is not represented by opacity alone when that would violate contrast.
- **Drag/reorder:** grabbed block remains identifiable; target insertion region opens before drop.

## G-13. Semantic status colors

Semantic state is separate from Tool Family identity:

- success: **#17B26A**
- warning: **#F79009**
- error: **#F04438**
- informational/system focus when no feature color exists: **Violet family**, not universal Blue

Every semantic state includes icon/shape/text in addition to color.

## G-14. Icon-color constraint passed to H

H will define final glyph construction, but G fixes the color rule now:

- Chromatic Tool/Quick-Hole/feature glyphs do **not** mix black strokes/fills inside an otherwise colored symbol.
- In particular, Lasso and other colorful glyphs must remain chromatic throughout.
- Neutral system icons may use `text-primary`/`text-secondary` dark neutral when they are intentionally neutral rather than feature-colored.
- Active/selected icon identity is created through accent/tint/edge changes, not by replacing a colorful glyph with black.

## G-15. F/G completion result — CLOSED

F and G are considered complete when implementation/mockup work follows this section plus the unchanged Phase-2 functional semantics. The following are intentionally **not** part of this closure:

- exact final icon drawing/stroke language and the complete icon asset set → **H**;
- animation durations, easing, spring behavior and transition choreography → **V**;
- brush-tip/grain/paper/pattern production assets → **I/J**.

No later image-generation artifact silently supersedes this closure. A mockup becomes canonical only through explicit approval/supersession. The existing Drive visual reference remains the base atmosphere reference, while this section is authoritative for all later F/G structural/color refinements.

### F/G change-log entry

- 2026-08-30: Closed F/G. Fixed the eight-stage UI composition, compact 14-family left rail, 13-block dock/PiP model, small ringless six-hex Quick Hole with a 30°-rotated regular-hexagon center layout and revised command mapping, four-command inspector footer, task/error surfaces, exact light-first neutral/chromatic token system, non-blue-dominant accent rules, typography, spacing, dimensions, radii, borders, depth, translucency and interaction-state rules. H and V remain separate joint design phases.


# Phase 5B H Iconography Closure — 2026-08-30

**Status:** AUTHORITATIVE / CLOSED for **H — app icon and UI iconography design**. This section builds on the closed F/G structure and color system. It does not close V motion design, I/J texture/brush assets, testing/release criteria, or the global Design Freeze.

## H-1. Canonical app icon — CLOSED

The adopted app icon is the user-approved raster artwork with a white rounded-square base, an eight-segment chromatic hue ring and a centered chromatic fountain-pen nib. Later glow-heavy, wordmark-inside-icon, brush, or other generated variants do **not** supersede this adopted image.

### Canonical visual source

- Canonical source filename: `ILLUSTRO_APP_ICON_MASTER_2026-08-30.jpg`
- Dimensions: **1536 × 1536 px**
- MIME: `image/jpeg`
- Size: **157,659 bytes**
- SHA-256: `bcfe9b5f2a007ce4e451289e66b866052ce81d43e82d78efffa55b9eeb51fa8d`
- Primary Drive copy: `1nQh5dKvma5fuj-8xPkX31Ah1NdVxVv4G`
- Backup Drive copy: `1rDr-yG50UmIP63tf2OsvuxSuVbMgnlB1`
- The two Drive copies were independently materialized and verified byte-identical to the canonical SHA-256.

The accepted raster is the **visual master**, not permission to re-generate an approximation. Production icon exports should be derived from this visual identity or a manually reconstructed vector-equivalent that is visually matched against it.

### App-icon composition contract

- White / near-white rounded-square base.
- Eight discrete hue-ring segments distributed continuously around the hue cycle: yellow → orange → pink/coral → magenta/violet → violet/blue → blue → cyan → green, with no single hue dominating the ring.
- Ring segments have modest soft depth/highlight and a restrained outer glow; glow may strengthen slightly in large marketing artwork but must not erase segment boundaries.
- Center mark is a fountain-pen nib, not a brush, pencil, letter `I`, or wordmark.
- Nib uses a pink/violet/blue/cyan chromatic gradient and preserves the white center slit/breather opening as the defining negative-space detail.
- **No black** is used inside the chromatic ring or nib.
- The launcher/app icon contains **no text**. `Illustro` wordmarks are separate branding assets for splash/marketing surfaces and are never required inside the launcher icon.

### Platform derivatives

- Standard full-color launcher/PWA icon preserves the master composition.
- Maskable/adaptive variants extend the white background to the full source bounds and keep the entire ring+nib critical mark inside the platform-safe center zone; masking may remove only peripheral whitespace, never hue-ring segments or the nib.
- Small-size variants may reduce glow, increase negative-space separation and slightly thicken the nib slit/segment gaps for legibility, but may not change the eight-segment count or central nib silhouette.
- Optional monochrome/themed variants may reduce the mark to a single-color ring+nib silhouette only when required by the platform; they are derivatives, not the canonical brand icon.
- Production export set must include the sizes/formats required by the final PWA/platform packaging, generated from one master pipeline rather than hand-edited independently.

## H-2. UI iconography language — CLOSED

Illustro UI icons are **vector-first, compact, chromatic where the feature has an identity, and neutral where the control is purely structural/system-level**.

### Canonical construction grid

- Primary icon viewBox: **24 × 24**.
- Normal visible live area: approximately **20 × 20**, optically centered with ~2 px breathing room.
- Canonical tool/feature stroke: **1.8–2.0 px** at 24 px.
- Compact 16 px derivative: approximately **1.5–1.6 px** stroke with geometry simplified rather than merely scaled.
- Rounded line caps and joins.
- Consistent optical stroke weight; avoid hand-drawn wobble, skeuomorphic engraving or excessive internal detail.
- Use outline-first construction with selective filled regions only where the fill materially improves recognition. Most icons should remain primarily line-based.
- Do not add decorative hue arcs/rings around every UI glyph; chromatic identity comes from the glyph itself and F/G state surfaces.

### Color behavior

- Tool/feature glyphs use the functional color token assigned in G.
- A chromatic glyph never mixes black strokes/fills into the colored symbol. Lasso, Eyedropper, Fill and all other colored glyphs remain chromatic throughout.
- Neutral/system icons may use the G neutral foreground colors because they intentionally have no feature hue.
- Active state keeps the icon’s hue and adds the G soft-tint/structural selected treatment; active icons do not switch to black.
- Disabled state reduces emphasis through neutralization plus state treatment while retaining accessible recognition.
- Multicolor glyphs are exceptional and allowed only where multicolor is intrinsic: principally Color/Hue, Gradient and the Pen/Eraser dual-toggle when both states must be visible simultaneously.

## H-3. Fourteen Tool Family glyphs — CLOSED

The primary Tool Rail uses these canonical metaphors. Subtools derive their own literal geometry while inheriting the family hue and stroke language.

1. **Brush** — angled drawing brush/pen stroke tool with clearly defined active tip; Pink.
2. **Eraser** — tilted eraser with a distinct cut/erase edge; Cyan.
3. **Blend** — two flowing forms/strokes visibly merging into one; Violet/Aqua family.
4. **Fill** — tilted paint bucket with a short poured-paint/drop motif; Mint.
5. **Eyedropper** — classic eyedropper/pipette silhouette; Violet.
6. **Selection** — dashed selection boundary as the family mark; Magenta. Lasso is a separate loop/rope subtool glyph, not the family glyph and not a permanent rail slot.
7. **Transform** — four-corner/node transform frame emphasizing editable bounds; Orange.
8. **Liquify** — compact warped mesh/wave with displaced control points; Cyan/Mint.
9. **Gradient** — gradient field plus direction/handle cue; Violet/Pink and may be genuinely bichromatic.
10. **Shape / Path** — Bézier/path with anchors and a control handle; Coral/Pink.
11. **Text** — clean typographic `T`-class glyph with no decorative font styling; Magenta/Violet.
12. **Repair** — patch/repair mark with small deterministic repair/spark cue; Orange.
13. **Ruler / Guide** — ruler/guide line combination, not a generic settings slider; Yellow.
14. **Navigation** — open hand/pan silhouette; Blue.

Family flyout/subtool icons must remain instantly distinguishable at 20–24 px and may use literal shape metaphors such as rectangle/ellipse/lasso/magnetic selection, perspective guides or geometry nodes without inventing new permanent family colors.

## H-4. Inspector-block icons — CLOSED

Default metaphors follow the 13 canonical blocks:

- **Tool Properties** — compact sliders/parameter controls; inherits active Tool Family hue.
- **Brush Presets** — small preset/stroke tiles; Pink.
- **Brush Studio** — brush + parameter/edit cue; Violet/Pink.
- **Color** — simplified hue ring; multicolor allowed.
- **Layers** — stacked sheets/layers; Violet.
- **Layer Properties** — layer sheet + parameter/sliders cue; Magenta/Violet.
- **Effects / Adjustments** — adjustment/effect sparkle/curve cue; Orange/Yellow.
- **Navigator** — framed mini-map/viewfinder/navigation cue; Cyan.
- **Reference / Sub View** — image/reference frame; Mint/Violet.
- **History** — clock/history-list metaphor, visually distinct from Undo; neutral-violet.
- **Quick Access** — compact configurable command cluster/shortcut mark; Magenta.
- **Assets** — asset tray/library tiles, not a shopping-bag/marketplace icon; Orange/Yellow.
- **Auto Actions / Timelapse** — action/playback loop combining sequence + time/play cue; Violet.

## H-5. Quick Hole command glyphs — CLOSED

Quick Hole does not own a separate icon set. Each slot renders the **same canonical command glyph** used by other command surfaces.

Default six-slot glyphs:

- left: Undo;
- right: Redo;
- upper-left: Pen/Eraser Toggle — a compact dual-state two-glyph mark using Brush Pink + Eraser Cyan with no black;
- upper-right: Fill — Mint bucket glyph;
- lower-left: Lasso — fully chromatic Magenta loop glyph;
- lower-right: Eyedropper — Violet eyedropper glyph.

The six translucent hex panels defined by F/G remain the surfaces; H supplies only glyph geometry/color. Quick Hole icons normally appear without persistent text labels; accessible names/tooltips/long-press help provide text when needed.

## H-6. Layer, object and state icon policy — CLOSED

Layer trees must not become visually noisy through unrestricted rainbow decoration.

- Generic tree controls, visibility, expand/collapse, lock and structural folder controls are neutral system glyphs.
- Layer-type identity may use a small feature-colored glyph/badge where it speeds recognition: raster/paint → Brush/Pink family; vector/path → Violet/Coral path family; text → Text hue; fill → Mint; gradient → Violet/Pink; adjustment/effect → Orange/Yellow; linked/reference → Cyan/Mint; lineart-boundary → dedicated graph/boundary glyph using an accent distinct from ordinary raster artwork.
- Masks use a consistent mask silhouette plus type modifier rather than unrelated icons for every mask subtype.
- Draft/reference/clipping/alpha-lock and similar states use small reusable state badges, never full-row recoloring by themselves.
- Every state remains recognizable by shape/icon/label and not color alone.

## H-7. Structural/system controls — CLOSED

System controls are intentionally neutral so they do not compete with feature color identity.

Canonical metaphors include:

- drag/reorder handle → six-dot/grip mark;
- collapse/expand → chevron;
- detach to PiP → panel/square with outward arrow;
- PiP return/close → the F-defined `×` behavior returns the block to the dock and must expose an accessible label/tooltip that makes this semantic explicit;
- panel manager/layout → layout/panel-grid mark;
- more → ellipsis;
- Undo / Redo → paired curved arrows;
- horizontal flip → mirrored halves across a vertical axis;
- vertical flip → mirrored halves across a horizontal axis;
- import/export → explicit inward/outward file/arrow metaphors;
- destructive Delete → trash glyph using neutral foreground until destructive emphasis is contextually required.

Structural controls must not acquire arbitrary feature colors merely to make the UI more colorful.

## H-8. Status / safety iconography — CLOSED

Semantic icons follow G status colors and always combine color with distinct shape:

- success → check/confirmation form;
- warning → caution triangle or equivalent unmistakable warning form;
- error → error/stop form;
- info → information form;
- recovery → recovery/restore arrow + project/document cue;
- storage pressure → storage/device cue + warning form;
- GPU/device-loss → renderer/device cue + warning/error form.

Data-safety states are never represented by color-only dots.

## H-9. Canvas cursor and contrast behavior — CLOSED

- Tool cursor glyphs reuse simplified canonical tool silhouettes rather than inventing another icon family.
- On arbitrary artwork, chromatic glyphs may receive a thin adaptive light/neutral contrast halo/backplate. The halo is presentation support and is not a black detail inside the glyph.
- Pen/brush cursors prioritize actual brush-size/shape feedback; tool identity iconography must not obscure the drawing contact point.
- Selection/transform/vector handles remain geometry controls under F/G, not decorative icon badges.

## H-10. Asset implementation contract

UI icon assets are authored as SVG/vector sources with semantic stable IDs such as `icon.tool.brush`, `icon.tool.selection.lasso`, `icon.inspector.layers`, `icon.command.undo`, `icon.system.detach` and `icon.status.warning`.

- Prefer `currentColor`/CSS token driven paths for single-color glyphs rather than baking black into SVG source.
- Intrinsically multicolor icons use explicit approved accent-token channels, not arbitrary embedded RGB values.
- One semantic glyph source must be reused wherever the same command appears (Tool Rail, Quick Access, Quick Hole, menus, shortcuts help, Inspector Action Strip).
- Platform rasterizations are generated from canonical vector sources; they are not redrawn independently.
- SVGs must have accessible labels supplied by the consuming UI; decorative duplicates are hidden from accessibility APIs where appropriate.

## H-11. H completion gate — CLOSED

H is complete at design-specification level when implementation follows this section without making new iconography decisions. Before release, the asset-build/implementation phase must instantiate and verify the complete vector inventory for:

- all 14 Tool Families and required subtools;
- all 13 Inspector blocks;
- the six default Quick Hole command glyphs via shared Command Registry assets;
- layer/object/state glyphs required by the canonical layer model;
- PiP/dock/reorder/system commands;
- semantic safety/recovery statuses;
- launcher/PWA/platform derivatives of the canonical app icon.

Verification includes visual legibility at **16, 20 and 24 px**, no black mixed into chromatic feature glyphs, consistent stroke/optical weight, command-glyph reuse and accessibility labels. Producing the SVG files is an implementation/asset-build task; **no icon design decision remains open**.

### H change-log entry

- 2026-08-30: Closed H. Adopted and SHA-pinned the eight-segment hue-ring + central fountain-pen-nib app icon with redundant Drive copies; fixed vector UI icon geometry, 14 Tool Family metaphors, 13 Inspector block metaphors, Quick Hole glyph reuse, layer/state/system/status icon policy, chromatic/no-black rules, cursor contrast behavior, stable asset IDs and the 16/20/24 px verification gate. V motion and I/J production-art assets remain open.


# Phase 5C V Motion Design Closure — 2026-08-30

**Status:** AUTHORITATIVE / CLOSED for **V — motion, transition and spatial-feedback design**. This section builds on closed F/G/H. It does not close I/J production-art assets, testing/release criteria or the global Design Freeze.

## V-1. Motion principles — CLOSED

Illustro motion exists to explain state, preserve spatial continuity and provide immediate local feedback. It is not decorative animation.

Priority order:

1. **Drawing/input latency and direct manipulation always win.** No animation may delay pen samples, pointer tracking, transform dragging, layer dragging, PiP dragging, panel resizing or other directly manipulated geometry.
2. **Spatial continuity.** Motion should show where UI came from, where it is going and what became attached/detached.
3. **Immediate feedback.** Press, selection, docking, insertion and mode changes react locally within the same frame or next visual frame.
4. **Canvas First.** Animation must not expand visual clutter or pull attention away from artwork.
5. **No gratuitous bounce, elastic overshoot, parallax, rainbow sweep or continuous decorative motion** in the production editor.
6. Prefer compositor-friendly `transform` and `opacity` animations; layout animation is used only when the layout change itself is the information being communicated.

## V-2. Canonical motion tokens

Durations are defaults, not permission to delay functional state. State changes happen immediately; animation only presents the new state.

| Token | Duration | Typical use |
| --- | ---: | --- |
| `motion.instant` | **0 ms** | pen/pointer tracking, canvas geometry, drag following, resize following, active-stroke Quick Hole hide |
| `motion.micro` | **80 ms** | press feedback, icon/tint changes, dismiss/fade, handle appearance |
| `motion.quick` | **120 ms** | menus, tool flyouts, selection launcher, small popovers |
| `motion.standard` | **160 ms** | inspector collapse/expand, layer-tree expansion, banner layout change |
| `motion.spatial` | **200 ms** | PiP detach/redock settle, responsive panel relocation, moderate spatial reflow |
| `motion.task` | **220 ms** | full task surface/dialog/editor-library transition |

Normal editor motion should not exceed **220 ms**. Longer progress operations use real progress indication rather than stretching transition duration.

### Easing tokens

- `ease.standard` = `cubic-bezier(0.20, 0.00, 0.00, 1.00)`
- `ease.enter` = `cubic-bezier(0.16, 1.00, 0.30, 1.00)`
- `ease.exit` = `cubic-bezier(0.40, 0.00, 1.00, 1.00)`
- `ease.snap` = `cubic-bezier(0.22, 1.00, 0.36, 1.00)`
- direct manipulation uses **no easing while the pointer/pen is active**.

`ease.snap` is allowed for magnetic docking and short spatial settling but must have **no visible overshoot**.

## V-3. Frame-rate and latency contract

- Animation logic must be refresh-rate independent and timestamp based.
- Target smoothness is the display refresh rate available to the browser; 60 Hz is the minimum normal QA baseline and 90/120 Hz displays must not be artificially capped by animation logic.
- Input-critical rendering must not wait for unrelated UI animation completion.
- If performance pressure requires dropping decorative/UI animation frames, **drop/simplify motion before dropping pen-response quality**.
- During active drawing/contact, background UI transitions that could trigger expensive layout/repaint should be deferred or simplified when practical.

## V-4. Tool Rail and tool switching

### Active tool change

- Command/tool state changes immediately.
- Glyph emphasis, soft tint and active edge transition over `motion.micro` (**80 ms**).
- No sliding highlight traveling through intermediate tools.

### Family flyout

- Open: `motion.quick` (**120 ms**), `ease.enter`, opacity + approximately 4 px origin-relative translation/scale equivalent.
- Close: `motion.micro` (**80 ms**), `ease.exit`.
- Flyout originates spatially from its Tool Family control and must not cover the active pen contact point when an alternative placement is available.
- Keyboard shortcuts may switch directly without requiring the flyout to animate.

### Temporary tools

Keyboard-held temporary tools and stylus-button temporary modes switch **instantly**; any visual indicator uses only a micro-duration fade/tint and never blocks the temporary state.

## V-5. Inspector blocks

### Collapse / expand

- `motion.standard` (**160 ms**), `ease.standard`.
- Header remains fixed; body clips/reveals vertically with a short opacity assist.
- Content is not individually staggered.
- The block’s new logical state is committed immediately at interaction start.

### Reorder

- Grabbed block follows pointer/touch **1:1 with `motion.instant`**.
- Neighboring blocks open an insertion gap over **80–100 ms**.
- On drop, the block settles into the open slot over **120 ms** maximum.
- No spring bounce.

### Inspector / Tool Rail resize

- Boundary follows pointer/touch **1:1** with no easing.
- Neighbor content relayout is direct during resize.
- If a released size must be clamped to ergonomic bounds, the final clamp may settle over **80–120 ms**.

## V-6. PiP detach and magnetic re-dock

PiP motion must make the relationship between docked block and detached representation obvious.

### Detach

1. User grabs the block/header; movement is direct.
2. Crossing the detach threshold immediately changes the object to floating/PiP presentation while preserving pointer ownership and content state.
3. The visual surface adapts its border/shadow over **120 ms**; it must not jump back to a predefined floating location.
4. Releasing the PiP leaves it exactly at the user-chosen position, subject only to visible-work-area clamping.

### Magnetic re-dock preview

- Approaching an eligible inspector insertion zone opens the actual insertion gap over **80–100 ms**.
- Target border/tint appears over `motion.micro`.
- The PiP itself remains under direct pointer control; magnetic preview must not steal it from the pointer before release.

### Re-dock commit

- On release into a valid target, the PiP settles into the open dock slot over `motion.standard` to `motion.spatial` (**160–200 ms**) using `ease.snap` with **zero overshoot**.
- The floating shadow disappears during the settle and the docked border state takes over.

### PiP `×` return-to-dock

- `×` semantically means **return to inspector**, not destroy.
- If the destination dock location is visible, animate spatial return over **200 ms**.
- If the destination is off-screen/collapsed, fade the PiP over **120 ms** and immediately show a local dock/inspector confirmation cue; do not animate a misleading path to an invisible target.

## V-7. Quick Hole motion — CLOSED

Quick Hole is the F/G-defined **ringless six-hex controller**. V does not add a ring.

### During drawing

- On eligible pen/touch drawing contact: **hide immediately (`motion.instant`)**. No fade is allowed to linger over the contact area.
- During the active stroke it remains absent.

### Reappearance

- After eligible canvas interaction ends, the controller appears at the current canvas-derived anchor using **80 ms opacity + subtle 0.96→1.00 scale**.
- It does **not travel across the artwork** from its previous anchor to the new anchor. Re-anchoring materializes locally at the new eligible position.

### Dismiss

- Eligible non-UI workspace dismissal: **80 ms opacity exit**.
- It remains dismissed until the next eligible canvas interaction, per F.

### Button feedback

- Pressed hex: **60–80 ms** local scale/tint response, approximately 0.94–0.97 visual scale depending on final hit-region implementation.
- The translucent hex background remains translucent; motion must not flash it to opaque white.
- No persistent text labels animate around the six buttons.

## V-8. Canvas contextual UI

### Selection Launcher

- Exists only for a non-empty relevant selection.
- Enter: `motion.quick` (**120 ms**) with opacity + approximately 4 px local rise/shift from the chosen placement.
- Exit: `motion.micro` (**80 ms**).
- Repositioning to avoid selection/artwork occlusion may animate over **100–120 ms**, unless active dragging requires immediate movement.

### Selection / Transform / Vector handles

- Handle availability appears via **80 ms opacity/emphasis**, but handle geometry itself tracks edits directly.
- Transform/mesh/vector nodes never ease behind the pointer.
- Commit/cancel removes transient handles in **80–120 ms** while the resulting document state is already committed/reverted.

### Ruler / snap feedback

Snap guides and alignment indicators appear/disappear in **<=80 ms** and follow measured geometry directly. No decorative trails.

### Lineart Boundary mode

Endpoint/bridge/override overlays use only micro fades/tint transitions. Graph edits, node movement and bridge manipulation remain direct with no interpolated topology that could misrepresent the committed graph.

## V-9. Layers, trees and lists

### Layer reorder

- Row follows pointer/touch directly.
- Target gap opens over **80–100 ms**.
- Drop settle: **100–120 ms**.
- Auto-scroll near list edges may accelerate smoothly, but the dragged row must remain under pointer ownership.

### Folder/tree expand-collapse

- **140–160 ms** vertical reveal/collapse.
- No per-row cascade/stagger.
- Selection state changes use `motion.micro`.

### Create/delete/duplicate rows

- New row: **120 ms** local reveal.
- Non-destructive removal from visible list: **100 ms** collapse/fade after the command is committed.
- Destructive confirmation UX is controlled by the error/task rules, not by dramatic animation.

## V-10. Menus, popovers, dialogs and task surfaces

### Menus / compact popovers

- Enter: **120 ms**, `ease.enter`, opacity + 2–4 px origin-relative transform.
- Exit: **80 ms**, `ease.exit`.
- Transform origin follows the invoking control where possible.

### Dialogs

- Enter: **160–180 ms** opacity + very small scale (approximately 0.98→1.00).
- Exit: **120 ms**.
- Do not blur/zoom the entire editor dramatically.

### Full task surfaces

Settings, New, Import, Export and Recovery task surfaces use **180–220 ms** transition with restrained opacity/translation. Returning to the editor preserves spatial context rather than replaying an app-start animation.

### Home / Library → Editor

- Project open uses `motion.task` (**220 ms max**).
- Prefer short crossfade/position continuity between project card/document identity and editor shell; do not animate the artwork thumbnail flying across the whole screen.

## V-11. Inspector Action Strip

The fixed right-inspector footer never slides across the canvas.

- Command press feedback: **80 ms**.
- If contextual command availability changes, replace/fade controls over **100–120 ms** while keeping strip height fixed.
- Undo/Redo and horizontal/vertical Flip commands execute immediately; visual feedback must never delay history or transform commands.

## V-12. Status, error and recovery motion

### Toast

- Enter: **120 ms**.
- Exit: **100 ms**.
- Toasts may auto-dismiss only for non-critical ephemeral status.

### Persistent banner

- Height/layout insertion: **160 ms**.
- Data-safety/storage/recovery warnings remain until resolved/dismissed according to their semantic policy; animation never substitutes for persistent text.

### Blocking overlay / GPU rebuilding

- Overlay visibility transition: **120 ms**.
- Use measurable progress when progress can be quantified; otherwise use a restrained activity indicator.
- Avoid continuously rotating rainbow/chromatic brand effects.

### Unsupported/recovery screens

- Task/screen entry: **180–220 ms**.
- Critical failure information is immediately readable; text/actions do not wait for animation completion.

## V-13. Responsive and orientation reflow

- While no active direct manipulation is occurring, layout-tier changes may reflow over **180–200 ms** using `ease.standard`.
- During an active pen stroke, drag, resize or transform, reflow affecting the manipulated surface is deferred where safe or applied immediately without decorative interpolation.
- Detached PiPs preserve logical detached state. If viewport/orientation invalidates their coordinates, clamp/reposition into the visible work area over **160–200 ms** when idle.
- Inspector collapse/overlay changes in compact mode must preserve canvas state, active tool and command focus.

## V-14. Reduced Motion — CLOSED

When `prefers-reduced-motion: reduce` is active, or when the user enables Illustro Reduced Motion:

- direct manipulation remains direct;
- non-essential translation, scale, spring-like snap and spatial travel are removed;
- most state transitions become **0–80 ms opacity/tint changes**;
- Quick Hole still hides immediately on drawing contact and reappears locally without travel;
- PiP detach/redock uses immediate state change plus short opacity/border confirmation rather than spatial flight;
- task/dialog surfaces use short fades only;
- no functional feedback, focus state, warning or data-safety indication may disappear merely because motion is reduced.

Reduced Motion must be testable as a first-class UI mode, not a best-effort afterthought.

## V-15. Motion composition rules

- Do not start more than one large spatial transition merely for visual polish. Related child changes should be grouped into one parent transition.
- Avoid staggered list animations in production editing surfaces.
- Do not animate numeric values by counting through intermediate values unless the changing number itself is continuous direct feedback.
- Do not animate canvas pixels merely to make commands feel smooth; document/result rendering follows canonical rendering semantics.
- Effects/adjustment previews may update continuously or converge from reduced to full quality, but that is render-preview behavior, not a decorative crossfade requirement.
- Hover animation must never be required to discover a control on touch-only devices.

## V-16. Implementation contract

Motion must be centralized through named design tokens rather than scattered literal durations/easing curves.

Recommended semantic IDs include:

- `motion.tool.activate`
- `motion.flyout.open`
- `motion.block.collapse`
- `motion.block.reorder-gap`
- `motion.pip.detach`
- `motion.pip.redock`
- `motion.quickhole.show`
- `motion.quickhole.hide`
- `motion.selection-launcher.show`
- `motion.layer.reorder`
- `motion.dialog.open`
- `motion.task.transition`
- `motion.banner.insert`
- `motion.reduced.*`

Implementation may use CSS Transitions/Animations, Web Animations API or compositor-driven framework primitives, but the observable behavior must match this section. Animation work must not be coupled to document-command completion promises.

## V-17. V completion gate — CLOSED

V is complete at design-specification level. Implementation/release verification must confirm:

- no input-critical geometry eases behind the pointer/pen;
- Quick Hole hides instantly during drawing and never travels across artwork between anchors;
- PiP detach/re-dock clearly preserves block identity and uses no overshoot;
- Inspector/layer reorder insertion gaps communicate target position before drop;
- normal editor transitions remain <=220 ms unless representing real operation progress;
- all motion uses shared tokens rather than arbitrary local constants;
- 60 Hz baseline and high-refresh behavior are visually stable;
- motion degrades before drawing responsiveness under performance pressure;
- Reduced Motion removes non-essential spatial motion while preserving feedback and safety information;
- no decorative continuous animation competes with the canvas.

**No motion-design decision remains open after this closure.**

### V change-log entry

- 2026-08-30: Closed V. Fixed motion principles, shared duration/easing tokens, input-latency priority, Tool/Inspector/PiP/Quick-Hole/selection/layer/task/error/responsive transitions, no-overshoot magnetic docking, refresh-rate behavior, Reduced Motion and the release verification gate. I/J brush/texture production assets remain open before final integration/Design Freeze.


# Phase 6 I/J Asset Production — I-2 / I-3 Update — 2026-08-30

**I-2 — Texture / Brush Asset Direction: CLOSED.** The user approved the representative sample board as the direction for all seven families: Ink/Pen, Pencil/Dry, Paint/Bristle, Marker/Soft, Scatter/Stamp, Grain/Paper, and Pattern/Texture. Production does not copy the sample board cell-for-cell; it retains all approved families while curating them into the fixed I-1 inventory so near-duplicate assets do not become redundant presets/resources.

**I-3 — Production Asset Generation: COMPLETE; pending I-4 QA.** The fixed I-1 inventory has been materialized as 100 independent original built-in production resources with no external source asset reused:

- 56 `brush-tip` resources: 8 shape, 8 ink, 10 pencil/dry, 12 paint/bristle, 6 marker/soft, 12 scatter/stamp.
- 32 `grain` resources: 6 fine, 6 dry/rough, 5 fiber/graphite, 3 canvas/fabric, 12 paper.
- 12 seamless `pattern` resources: 4 geometric, 4 organic, 4 texture.
- Paper remains `ResourceV1.kind = grain` with subtype `paper`; Scatter/Stamp remains `ResourceV1.kind = brush-tip` with subtype `scatter`.
- Brush thumbnails are not behavior resources and remain deferred to J-3.

Production package:

- Filename: `ILLUSTRO_I3_PRODUCTION_ASSETS_2026-08-30.zip`
- Size: **39,321,494 bytes**
- SHA-256: `9506804676bcd49d63997a311663597270f6ead0426cd026b459262b6f442a5d`
- Manifest SHA-256: `fa45ebac36f96bb01126c6cd2a792d98314f592332ec7167a01d9a3522f762c5`
- Google Drive ID: `1oLminq97D62Wldm0U5nynMONCLQjUbRK`
- Manifest status: `PRODUCTION_GENERATED_PENDING_I4_QA`

I-4 must verify seamlessness, alpha/coverage correctness, accidental similarity/duplication, practical visual quality, dimensions/channels, package integrity, and performance/memory suitability before I is closed. No I-3 asset is release-canonical merely because it was generated; I-4 is the acceptance gate.


# Phase I-4 Asset QA Closure — 2026-08-30

**Status:** AUTHORITATIVE / CLOSED for **I — built-in production brush-tip / grain / paper / pattern resources**. J default brush preset construction and brush-feel QA remain open.

## I-4 final inventory

The I-1 inventory is retained without count inflation:

- Brush-tip resources: **56**
- Grain resources, including paper subtype: **32**
- Pattern resources: **12**
- Total behavior resources: **100**

Paper remains `ResourceV1.kind = grain` with a paper subtype. Scatter/stamp sources remain `ResourceV1.kind = brush-tip`; no new resource kind is introduced by I.

## I-4 QA result — PASS

All 100 production resources were re-verified after repair.

- File existence / PNG mode / declared dimensions / SHA-256 integrity: **PASS; 0 failures**
- Brush-tip alpha/coverage and border-containment checks: **PASS; 0 failures**
- Seam/repeat discontinuity-outlier check for every declared seamless grain/paper/pattern: **PASS; 0 failures**
- Exact duplicate content hashes: **PASS; 0 duplicate groups**
- Same-kind perceptual duplicate gate at correlation `> 0.995`: **PASS; 0 failures**
- Highest remaining same-kind similarity: approximately **0.987458**, between two related ink-tip variants; accepted as distinct related pen resources rather than duplicates.
- Raw behavior-resource payload: approximately **37.345 MiB**, inside the I-1 target of <= 40 MiB and hard cap of <= 64 MiB.

## Repairs performed during I-4

The first QA pass correctly rejected defects rather than silently accepting them:

1. two exact duplicate marker-tip pairs were detected and regenerated as materially distinct marker resources;
2. pencil tips 07–10 were diversified in silhouette/material response to avoid unnecessary near-duplication;
3. canvas/fiber/paper resources containing non-periodic directional components were rebuilt with integer-cycle periodic construction;
4. Organic Pattern 03 was rebuilt to remove its non-periodic modulation;
5. every affected asset SHA-256, manifest entry and QA preview was regenerated before the final pass.

## Accepted production package identity

Final generated package filename:

`ILLUSTRO_I_PRODUCTION_ASSETS_FINAL_2026-08-30.zip`

- Package SHA-256: `e0d91f11f9bdbf5bf29cd61793c4ada0f36024b7f04e6e19f8e0aaebd7322809`
- Final manifest SHA-256: `7fd498fddeced73351f87c5b94324dad59d238c44d8e2d393ed3f0db41ba72e3`
- QA report SHA-256: `063deffa3394868db4c142c8df3b05b5ded69dad9a581edade24a8c8b96702d7`

These hashes identify the accepted I resource set. Later J preset tuning may reference these resources, but it must not silently replace an I resource with a different image under the same accepted identity. Any required asset replacement must be explicit and must rerun the relevant I-4 QA.

## Visual-resource acceptance boundary

I verifies that the built-in source resources are valid, distinct enough, technically usable, bounded in size and appropriate as brush-engine inputs. **Actual brush feel is not claimed by I alone.** Spacing, pressure response, opacity/flow, dynamics, mixing, scatter behavior and representative painted-stroke quality are verified when J constructs and tunes the default brush presets.

## I completion gate — CLOSED

I is complete. No production texture/image resource decision remains open for the initial built-in set. J may choose which accepted resources each preset uses and how the canonical `BrushPresetV1` parameters combine them, but does not reopen the I inventory unless QA exposes a concrete asset defect.

### I change-log entry

- 2026-08-30: Closed I after production generation and repair-driven QA. Accepted 56 brush tips, 32 grain/paper resources and 12 patterns; removed marker duplicates, diversified pencil tips, repaired non-periodic seamless textures, verified 0 integrity/seam/duplicate failures and fixed the final 100-resource package by SHA-256. J remains open for the 48 default presets, tuning, stroke thumbnails and brush QA.


# Phase I Final Sampled-Asset Closure — 2026-08-30

**Status:** AUTHORITATIVE / CLOSED for **I — production sampled brush/texture assets**. This section supersedes the earlier provisional I inventory and the earlier 100-raster-resource closure where they conflict. J remains OPEN.

## I-FINAL-1. Procedural-first asset rule — CLOSED

Illustro must not store a raster texture/tip merely because a brush preset has a familiar name. A sampled image resource is justified only when sampled irregularity materially contributes to rendering.

The following are **procedural/analytic and do not receive dedicated raster tip assets**:

- G Pen, Round Pen, Mapping Pen, Brush Pen and other clean line pens whose behavior is defined by analytic tip geometry plus pressure/taper/spacing/stabilization;
- primitive round, soft-round, ellipse, square, rounded-square, diamond/chisel and equivalent basic tip geometry;
- ordinary hard/soft marker geometry and ordinary hard/soft airbrush falloff;
- ordinary erasers using the same procedural tip system;
- Flat/Round/Filbert paint geometry and simple Palette-Knife/chisel geometry where sampled breakup is not required.

A sampled resource remains appropriate for dry/real ink breakup, pencil/charcoal/pastel material, irregular bristles/dry paint/sponge, scatter/stamp silhouettes, grain/paper microstructure and intentional pattern imagery.

## I-FINAL-2. Final built-in sampled-resource inventory — CLOSED

The final I inventory contains **77 sampled behavior resources**:

- **33 brush-tip resources**
  - textured/dry/real ink: 3
  - pencil/dry-media: 10
  - irregular paint/bristle/dry/sponge/textured-paint: 8
  - scatter/stamp: 12
- **32 grain resources**
  - fine: 6
  - dry/rough: 6
  - fiber/graphite: 5
  - canvas/fabric: 3
  - paper: 12
- **12 pattern resources**
  - geometric: 4
  - organic: 4
  - texture: 4

**23 previously generated raster tips were removed** because the canonical brush engine can represent them more compactly and controllably as procedural/analytic geometry and dynamics.

Paper continues to use `ResourceV1.kind = grain` with a `paper` subtype. Scatter/stamp resources continue to use `ResourceV1.kind = brush-tip`. This does not alter the Phase-3 resource schema.

## I-FINAL-3. Final QA — PASS

The pruned 77-resource pack was regenerated and re-verified after procedural pruning.

- file existence / mode / dimensions / SHA-256 integrity: PASS, 0 failures;
- brush-tip alpha/coverage and border containment: PASS, 0 failures;
- seamless-repeat outlier check: PASS, 0 failures;
- exact duplicate check: PASS, 0 duplicate groups;
- same-kind perceptual duplicate threshold `> 0.995`: PASS, 0 failing pairs;
- sampled-resource payload: **35.919 MiB**;
- final package SHA-256: `c23ccd51d37e6081c21c0961102d1d320e0d6a6e67c9ea97eaaf4828f65ec0f2`;
- final manifest SHA-256: `5db86732c5e8b250599e74b0c85a0474272d48998e0d1863240a40d4d2ff1776`;
- final closure-report SHA-256: `d0ec4849d01b37bff939b18a24faf86f84cf9edacb4fa5fbbcb8ac77d49bb0f1`.

## I-FINAL-4. Closure rule

**I is formally CLOSED.** No knowingly unnecessary raster brush-tip resource remains in the built-in I inventory. J must build default presets from the canonical procedural brush system plus these retained sampled resources; J must not reintroduce dedicated raster tips for clean G-Pen/round/marker/airbrush/eraser classes unless a later measured rendering requirement explicitly demonstrates that analytic geometry is insufficient.

### I final change-log entry

- 2026-08-30: Re-opened the provisional I closure after identifying unnecessary raster tips. Removed 23 procedural-replaceable raster resources, fixed the final sampled-resource inventory at 77, reran integrity/seam/duplicate/coverage QA with zero failures, and formally CLOSED I under a procedural-first resource policy. J remains OPEN.


# Phase 6 J — Default Brush Pack Closure — 2026-08-30

**Status:** AUTHORITATIVE / CLOSED for **J — default brush preset inventory, tuning, thumbnails and design-stage brush QA**. This section builds on the final closed I sampled-resource inventory and supersedes any earlier provisional J counts/parameter suggestions. Production WebGPU implementation/release QA remains separate and does not reopen J unless it exposes a real incompatibility with this specification.

## J-1. Final default brush inventory — CLOSED

Illustro ships an initial **48-preset Default Brush Pack** using canonical `illustro.brush/1` presets:

- Ink / Pen — **8**
- Pencil — **6**
- Marker — **5**
- Paint — **9**
- Airbrush — **3**
- Digital Watercolor-style — **5**
- Eraser — **4**
- Blend / Smudge / Blur — **3**
- Scatter / Special — **5**

Every preset has a unique stable ID, user-facing name, category, behavior, canonical parameter set and deterministic thumbnail asset.

## J-2. Procedural-first brush policy — CLOSED

J preserves the final I rule that sampled resources exist only when irregular sampled structure materially contributes to the output.

The clean defaults **G Pen, Round Pen, Mapping Pen, Technical Pen and Brush Pen** use procedural/analytic tip geometry and **no sampled texture**. Ordinary Hard/Soft Airbrush and ordinary Hard/Soft/Precision Eraser likewise use analytic/procedural geometry or radial falloff. Basic marker geometry is procedural unless a named preset is intentionally the textured variant.

Sampled I resources are referenced for dry/real ink breakup, pencil/charcoal/dry media, bristles/sponge/textured paint, paper/grain behavior and scatter/stamp silhouettes. J must not reintroduce a raster `G Pen texture`, ordinary round-tip bitmap or equivalent redundant sampled asset.

## J-3. Preset tuning — CLOSED

The 48 presets are deliberately separated by combinations of default size, spacing, pressure response, taper, stabilization, procedural or sampled tip identity, opacity/flow/buildup, texture, digital mixing, jitter and spray. Different names are not accepted merely as cosmetic duplicates.

Digital Watercolor presets are digital watercolor-style behaviors built from texture, buildup and canonical digital mixing controls; they do not imply the excluded general-purpose physical pigment/fluid simulation.

Randomized presets use per-stroke deterministic seed policy. Clean line-art presets remain stable and predictable, while dry/scatter/texture categories use randomness only where it is intrinsic to their role.

## J-4. Thumbnail contract — CLOSED

Each default preset has a **256×256 deterministic representative-stroke thumbnail** derived from its preset semantics. Thumbnails communicate pressure/texture/stamp character and remain presentation assets; they do not define brush behavior.

The final J asset set also contains low/high-pressure reference renders and representative category QA imagery. These reference renders are design/asset verification outputs, not a substitute for later production WebGPU renderer verification.

## J-5. Final J QA — PASS

Final design/asset QA passed with **zero failures**. Gates include:

- exactly **48** presets with unique IDs and names;
- exact category counts above;
- `illustro.brush/1` schema/range validation;
- all sampled tip/texture references resolve against the final closed I inventory;
- clean Pen/Airbrush/Eraser defaults do not depend on unnecessary sampled tips;
- clean line-art defaults do not attach unnecessary texture resources;
- same-category semantic duplicate detection passes, with minimum remaining semantic distance **0.2209** against the **0.18** duplicate threshold;
- all **48** production thumbnails pass existence/dimensions/legibility checks;
- all **48** low/high-pressure reference strips and pressure semantics pass;
- 1px-class source validity, large-size source validity, deterministic randomized behavior and estimated 4096px long-stroke boundedness pass for every preset.

Actual device latency, WebGPU stamp fidelity, production color/compositing fidelity and real-engine stress tests remain implementation/release QA responsibilities.

## J-6. Final artifact identities

The completed J package created on 2026-08-30 has:

- package: `ILLUSTRO_J_DEFAULT_BRUSH_PACK_FINAL_2026-08-30.zip`
- package SHA-256: `62c0c3ad4aed9f0d2b49a41bcccfc7e30d2b9f3b1278ec60bcb15b19126a5dc6`
- package manifest SHA-256: `0c6bed36ef58246a090cff3b7395b4d7cf6456616a4cf23d68cdbe0df5f36cd5`
- QA report SHA-256: `083136163c628cec2e1f70448dce77a623af2f870c2472cc4d5477eca79397ca`
- 48-brush contact-sheet SHA-256: `ca7fe4f898391c94f4cfa73313d3cf6822aacc9ebfb40815242f771a132bf633`
- representative QA image SHA-256: `f6da327f10344b0e49cd2c320e255696a8b6584fc1521cf3eaa29dc7fdc354c2`

Hashes identify the completed design/asset artifacts. Release packaging may relocate the same bytes without changing J design meaning.

## J-7. Closure gate — CLOSED

**J is formally CLOSED.** No default-brush inventory, tuning, procedural-vs-sampled resource choice, thumbnail-language or design-stage brush-QA decision remains open. Future implementation must instantiate these presets through the canonical brush engine rather than silently redesigning them.

### J change-log entry

- 2026-08-30: Closed J with 48 tuned default presets, procedural-first clean Pen/Airbrush/Eraser defaults, sampled-resource use only where intrinsic, 48 deterministic thumbnails, pressure/stress reference QA and zero final design-stage failures. I and J are both CLOSED; final integration/testing/roadmap/release Design Freeze work remains separate.



# Phase 7A Final Integration — Stages 1–3 Closure — 2026-08-30

**Status:** AUTHORITATIVE / CLOSED for **Stage 1 — Canonical Consistency Audit**, **Stage 2 — Residual Decision Closure**, and **Stage 3 — Testing / Verification Architecture**. This section is an integration layer over the already closed Phase 1–6 design. It does **not** reopen or redesign closed product, UX, data, renderer, visual, icon, motion, sampled-asset, or default-brush decisions. Stage 4 Implementation Roadmap / Dependency Graph, Stage 5 Release Criteria, Stage 6 project license / third-party NOTICE packaging, and the final Completion Gate / Design Freeze remain separate later work.

## FI-1. Canonical consistency audit — CLOSED

The entire canonical memo was audited as a precedence-ordered specification rather than as a flat collection of sentences. The audit found **no unresolved design contradiction that requires re-design of a closed capability**. It did find historical/planning wording that is stale when read without the later explicit closures. Those cases are resolved below by canonical precedence; the older text remains only as design history.

### Canonical precedence rule

When two statements address the same design subject, implementation and verification must use this order:

1. a later section explicitly marked **AUTHORITATIVE / CLOSED**, **CLOSED**, or **PASS** that states or clearly scopes a supersession;
2. a later explicit feasibility/integration clarification that resolves an earlier ambiguity without changing the adopted capability;
3. the earlier confirmed requirement or phase closure;
4. provisional mockup/planning wording;
5. historical change-log/status wording.

A later implementation artifact, generated image, test, or code path never silently supersedes this memo. If future implementation evidence exposes an actual incompatibility, the memo must record an explicit supersession decision before the product contract changes.

### Audited stale/superseded wording

The following are **not open design questions**:

- Early Confirmed Decision 14 says the exact browser/device matrix would be fixed separately. **P1-3 is now authoritative and CLOSED** with the Tier-A platform/browser/runtime-gate contract; the earlier sentence is historical.
- Early Confirmed Decision 21 says exact tile dimensions/cache budgets remained benchmark-driven. **Phase 4 is now authoritative and CLOSED**, including the 256 px canonical sparse tile geometry, 2048 px atlas-page policy, adaptive memory profiles and associated numeric budgets.
- Early Quick Hole wording describes a donut/ring presentation and the earlier slot arrangement. **Phase 5A F/G is authoritative for final presentation and placement**: the controller is the ringless six-hex design with the 30°-rotated center geometry and the F/G-closed command arrangement. Earlier semantic requirements that it is six-slot, remappable, canvas-anchored, hidden during active drawing and registry-driven remain valid where they do not conflict with F/G.
- Earlier references to Quick Hole `ring radius` are interpreted as the **radial center distance/controller radius**, not as permission to render a visible ring. V likewise must not add a ring.
- Early SharedArrayBuffer wording can be read as making cross-origin isolation a universal full-editor requirement. **P4-2 is authoritative**: SharedArrayBuffer paths require `crossOriginIsolated`; a functionally complete Transferable-message path remains valid on an otherwise qualifying Tier-A environment. The deployment should enable isolation where intended, but lack of SAB alone is not a second product gate.
- Early architecture wording broadly prefers heavy work off the main thread. **P4-2 is authoritative** that Render Worker ownership is preferred, while main-context WebGPU is allowed when the qualifying browser requires it and all responsiveness/performance gates still pass. Storage remains off-main-thread.
- Phase 3 and Phase 4 text saying F/G/H/I/V were still unfrozen is historical phase-boundary text. F/G, H, V and the final I closure are now CLOSED; J is also CLOSED by Phase 6 J.
- The provisional 100-raster-resource I closure and intermediate I-4 counts are superseded where they conflict with **Phase I Final Sampled-Asset Closure**, which fixes the procedural-first sampled-resource inventory at 77 retained sampled resources.
- Intermediate I wording stating `J remains OPEN` is historical. **Phase 6 J — Default Brush Pack Closure** is authoritative and CLOSED for the 48-preset default pack, tuning, thumbnails and design-stage brush QA.
- The original `Testing / Completion Gates — Not yet defined` placeholder is superseded for testing architecture by this Phase 7A section. Final Release Criteria remain intentionally separate and are not implied by this testing closure.
- The original Open Questions entry for Release Criteria remains intentionally open until Stage 5. The project-level software license / final third-party NOTICE packaging entry remains intentionally open until Stage 6.

### Cross-domain consistency result

The following closed domains were cross-checked and are mutually compatible at design level:

- **Product/platform ↔ renderer:** Tier-A full editing requires the closed WebGPU/runtime/storage/viewport gates; optional GPU features remain progressive enhancement.
- **Renderer ↔ canonical data:** GPU state is derived/cache state only; project correctness remains reconstructible from canonical CPU/storage data.
- **Tile/render ↔ file format:** Phase-4 live OPFS/tile storage is an internal runtime representation and does not replace the Phase-3 `.illustro` v1 archive contract.
- **History ↔ Lineart topology:** graph edits, manual overrides, regeneration state and exact Undo/Redo restoration use the closed transaction/history semantics; auto-extraction identity is generation-local while user intent uses stable semantic records.
- **Effects ↔ performance:** reduced-quality interactive previews are transient only; canonical parameters and final/export rendering remain full-quality.
- **Workspace/UI ↔ command semantics:** F/G/H/V presentation changes do not create independent command paths; Tool Rail, Inspector actions, Quick Hole, shortcuts and Quick Access continue to route through the Phase-2 Command Registry.
- **Accessibility ↔ visual/motion:** chromatic UI, icon design and motion remain subject to non-color-only state communication, target-size/legibility constraints and Reduced Motion behavior.
- **I assets ↔ J presets ↔ brush schema:** final sampled assets remain resources under the Phase-3 schema; J presets may combine procedural geometry with retained sampled assets and do not redefine brush-engine semantics.
- **Local-first/PWA ↔ linked resources:** linked/external sources may accelerate workflows, but embedded canonical snapshots and local recovery semantics preserve project correctness without permanent external permission.
- **Color ↔ export:** the document pipeline owns supported RGB semantics and explicit transforms; dedicated CMYK/HDR product workflows are not initial-release gates unless later explicitly adopted.

**Stage-1 audit result: PASS.** No closed design area is reopened. All discovered apparent contradictions are either explicitly superseded historical wording or terminology clarified above.

## FI-2. Residual decision closure — CLOSED

After applying FI-1 precedence, the pre-roadmap residual set contains **no additional hidden product/UX/architecture/data/visual/asset decision that must be invented before implementation planning**.

### Closed residuals

- External-reference feature baseline is frozen at the already closed 2026-08-30 audit snapshot; implementation does not chase later reference-app releases unless Illustro explicitly adopts them.
- Initial-release adoption/exclusion/post-baseline dispositions are already closed by Phase 1 and the canonical inventory.
- Tier-A platform/browser minimums and runtime gates are already closed by P1-3.
- Canvas/tile/cache/queue/performance/storage/autosave/recovery numbers are already closed by Phase 4.
- F/G/H/V visual, icon and motion contracts are closed.
- I/J built-in sampled-resource/default-brush design is closed.
- Testing architecture is closed by FI-3 below.

### Intentionally deferred items — not defects

Only the following remain intentionally outside Stage 2 because they are named later final-integration stages:

1. **Stage 4 — Implementation Roadmap / Dependency Graph.** This decides implementation order and dependency gates, not product semantics.
2. **Stage 5 — Release Criteria.** This converts the verification architecture and closed numeric contracts into the final release-blocking decision matrix, including the exact physical reference-device sample set.
3. **Stage 6 — Project-level software license / third-party NOTICE packaging.** Existing reuse/provenance rules remain in force meanwhile; no incompatible direct third-party reuse may be merged before this is closed.
4. **Final Completion Gate / `IMPLEMENTATION READY — DESIGN FREEZE`.** This may be declared only after Stages 4–6 and final integration verification are complete.

No other unresolved item may be silently treated as an implementation-team choice if it changes observable product behavior, canonical data semantics, compatibility, recovery guarantees, or a closed numeric contract. Such a finding must be surfaced as a specification defect and resolved explicitly in this memo.

**Stage-2 residual decision result: PASS.** Remaining open work is fully enumerated above and belongs to the later requested stages.

# Testing / Completion Gates

## FI-3. Testing / Verification Architecture — CLOSED

This section supersedes the earlier placeholder that testing was not yet defined. It defines **how Illustro proves conformance to the canonical design**. It does not by itself declare a release candidate releasable; Stage 5 will define the final release decision using this evidence model.

### TV-1. Verification principles

1. **Requirement-traceable:** every ADOPTED capability, CLOSED invariant and release-relevant numeric requirement must map to one or more verification cases. A UI element being present is never evidence that its production path works.
2. **Evidence-backed:** PASS requires reproducible evidence tied to an exact Git commit, environment and fixture/workload. Tool/test self-report alone is insufficient when an independent observable can be checked.
3. **Production-path only:** mocks, isolated demos, debug-only routes and synthetic UI state do not satisfy a capability gate unless the gate specifically targets that component.
4. **Deterministic where semantics require it:** serialization, schema validation, history state restoration, graph invariants, checksums and recovery-head selection use exact assertions. Floating-point/rendering paths use defined numeric/perceptual tolerances rather than unbounded visual judgment.
5. **Failure-path tested:** recovery/error contracts are first-class requirements. A success-only test suite cannot close persistence, WebGPU, import/export or project-safety gates.
6. **Capability-aware:** optional hardware/browser features are tested both present and absent. Fallback means the explicitly designed fallback path, not silent feature deletion.
7. **No silent waiver:** a required failing/flaky test remains non-PASS until the defect or the test is resolved. `N/A` is allowed only when the canonical support/adoption matrix says the case does not apply.
8. **Physical behavior requires physical evidence:** pen pressure/tilt, palm rejection, touch arbitration, real display/input latency, PWA lifecycle behavior and device-loss/storage-pressure behavior that cannot be faithfully simulated require supported physical devices.

### TV-2. Canonical verification statuses and evidence record

Every tracked case uses one of:

- `NOT_RUN`
- `PASS`
- `FAIL`
- `BLOCKED`
- `N/A` — only with a canonical reason/reference

A verification record must include, as applicable:

- stable test/case ID and mapped memo requirement IDs/section references;
- Git commit SHA;
- automated/manual/physical classification;
- OS, browser/version, device/GPU and relevant capability flags;
- fixture/corpus/workload ID and content hash where practical;
- actual result and expected criterion;
- logs, screenshots, traces, exported artifacts, hashes or metric samples sufficient to reproduce/inspect the result;
- tester/tool identity and timestamp for manual/physical evidence;
- linked defect when `FAIL` or `BLOCKED`.

Evidence artifacts may live outside this memo, but the **meaning of the gate and its required fields remain canonical here**.

### TV-3. Verification layers

#### A. Static / schema / build integrity

Verify at minimum:

- type correctness and production buildability;
- schema validators for document, layer, resource, brush, `.illbrush` and `.illustro` metadata;
- unknown/invalid required fields, broken references, UUID/revision constraints and content-hash validation;
- no production dependency on DOM/GPU/browser handles in canonical serialized state;
- asset manifest integrity, IDs, hashes and package membership;
- localization key completeness for the supported Japanese/English contract;
- third-party provenance metadata presence for any directly reused code/assets once such dependencies exist.

#### B. Unit / property / algorithm correctness

Use deterministic fixtures and property-based tests where they give stronger guarantees. Required families include:

- tile coordinate/bounds/dirty-region/halo logic;
- blend/mask/clipping/reference-resolution semantics;
- color transforms and precision-mode invariants;
- selection, fill, geometry, transform and effect parameter behavior;
- brush dynamics mapping, interpolation/stabilization and deterministic preset interpretation;
- Lineart graph invariants: node degree classification, atomic connect/disconnect, endpoint-set consistency, no-connect constraints and semantic-override remapping;
- Undo/Redo transaction invariants including branch invalidation and exact before/after restoration;
- archive path validation, checksums, size/count limits and parser rejection of invalid input;
- journal framing, CRC32C validation, sequence ordering and coherent-head selection.

For any randomized/property test, failures must emit a reproducible seed/minimized case.

#### C. Component / worker / concurrency integration

Verify actual message/ownership boundaries among Main, Render, Storage and Compute workers:

- bounded queues, coalescing and backpressure;
- Transferable ownership and no unintended large structured-clone copies on hot paths;
- SharedArrayBuffer path when isolated and Transferable fallback when SAB is unavailable;
- Web Locks single-writer semantics and BroadcastChannel status propagation;
- renderer placement in worker when available and allowed main-context WebGPU fallback without blocking forbidden storage/format work on main;
- worker restart/failure handling without corrupting canonical state.

#### D. Rendering / compositing / visual correctness

Maintain deterministic scene/brush/effect fixtures covering raster, vector, masks, clipping, folders, transforms, adjustment/effect stacks, color modes, tile edges and large-radius halo dependencies.

- CPU/reference implementations or mathematically independent fixtures should be used where practical to avoid comparing a renderer only against itself.
- Exact byte comparison is used where the output is specified as exact.
- GPU/floating output uses documented numeric error bounds plus image-difference/perceptual checks; tolerance must be chosen per operation and may not hide seams, alpha errors, clipping errors, missing tiles or visible state corruption.
- Tile-boundary/seam tests must explicitly cover brush strokes, transforms, blur/sharpen/neighborhood effects, masks and compositing across tile/atlas boundaries.
- Full-quality final/export output is compared separately from reduced-quality interactive preview.

#### E. History / persistence / recovery / data-safety verification

Exercise real canonical mutations, then verify byte/state coherence across save, close, reload and failure injection:

- one logical action ↔ one intended committed history transaction where specified;
- exact Undo/Redo across raster edits, layer tree edits, transforms, effects, text/vector changes and Lineart topology operations;
- history spill/pruning respects complete-transaction boundaries and published-reference reachability;
- journal recovery after torn/corrupt/truncated last records;
- dual-head/checkpoint selection and fallback to the newest coherent generation;
- the Phase-4 recovery flush/checkpoint triggers, including the **2-second / 8-MiB** recovery-flush policy;
- abrupt tab/process termination, storage-worker failure and restart;
- GPU device loss/rebuild with canonical artwork unchanged;
- quota warning/critical/hard-reserve behavior and mutation blocking when safe persistence cannot be guaranteed;
- second-tab writer contention: never two independent writable autosave owners for one project;
- export-safe-copy/recovery UX remains reachable in the specified critical states.

A data-safety test passes only if both **artwork/state correctness** and the required user-visible failure/recovery state are correct.

#### F. Native format / import / export / interoperability

Maintain versioned corpora for:

- `.illustro` round trip of every canonical layer/resource/effect/history-preserved structure that the format promises;
- `.illbrush` package round trip and invalid-package rejection;
- PNG/JPEG/SVG and other adopted image paths;
- PSD bounded-fidelity import/export cases covering supported, approximated and unsupported semantics;
- adopted ibisPaint/CSP brush-import paths using legally redistributable, user-created or otherwise authorized fixtures.

Required checks include deterministic preflight, structured fidelity reporting, no silent destructive approximation, checksums, archive path validation, and re-open validation of exported native files. Proprietary fixtures must not be committed/distributed without permission merely for test convenience.

#### G. UX / command / accessibility / visual / motion verification

Verify the real production UI against Phase 1/2 and F/G/H/V:

- every required capability has a discoverable production access path and invokes the canonical Command Registry where specified;
- Tool Rail, Inspector, detached PiP, contextual actions, shortcuts, Quick Access and Quick Hole remain semantically synchronized rather than duplicating divergent commands;
- dock/reorder/detach/re-dock, workspace persistence/reset and responsive wide/compact/narrow behavior;
- Quick Hole final ringless six-hex geometry, eligible-canvas anchoring, dismissal/reappearance rules, hit regions and active-drawing hiding;
- canonical F/G dimensions/tokens, H icon assets at required verification sizes, and the SHA-pinned visual target as an atmosphere/reference check without overriding newer F/G rules;
- V duration/easing/spatial rules and no misleading overshoot/path behavior;
- Reduced Motion removes/reduces motion exactly as specified without deleting state feedback;
- keyboard operation, focus order/visibility, semantic labels, non-color-only status, target sizing and contrast/legibility requirements under the closed accessibility contract;
- Japanese and English layouts with long-string/overflow stress cases.

Visual verification combines automated geometry/token/snapshot checks with human review for composition/legibility. Human review may not override a failing measurable requirement.

#### H. Performance / resource / stress verification

Phase-4 numbers are the source of truth. Stage 3 adds no weaker replacement thresholds.

At minimum, benchmark on the eventual Stage-5 Tier-A reference-device set:

- cached pan/zoom/rotate: **p95 <= 16.7 ms**, **p99 <= 33.3 ms** under the P4 reference workload;
- simple baseline-brush confirmed-input-to-visible feedback: **p50 <= 16.7 ms**, **p95 <= 33.3 ms**;
- ordinary non-long-running UI command acknowledgement/state feedback: **<= 100 ms p95**;
- main-thread pointer/arbitration handling: **<= 1 ms p95 CPU time per delivered event batch**;
- all other Phase-4 numeric queue, memory, cache, admission, storage and recovery thresholds exactly as specified in P4.

Performance reports must state warm-up, sample count/duration, document/workload, device power/thermal state where observable, browser build, display refresh rate and percentile method. Tests should capture frame-time/latency distributions rather than average-only numbers.

Stress suites cover at least the absolute v1 canvas boundary logic (**1..32768 px each dimension; <= 2^28 logical pixels**) without requiring every device to admit every theoretically bounded document when P4 resource preflight correctly rejects it. Also test large brushes, many layers/masks/effects, cache churn, Undo pressure, low quota, repeated import/export and long editing sessions.

#### I. Platform / PWA / lifecycle / offline / update verification

For every Tier-A platform family selected by Stage 5, verify the P1-3 product contract and runtime gates:

- HTTPS secure context and full-editor capability gate;
- required WebGPU core capability and optional-feature fallback;
- OPFS/storage/Worker/Transferable requirements;
- installable PWA/Web App behavior where supported;
- cold start and reopen from installed and browser entry points;
- offline launch and continued local editing of already available projects/resources as promised by the local-first contract;
- service-worker/application update behavior without silently losing unsaved/recovery state;
- page visibility/background/foreground lifecycle handling;
- unsupported environments enter the compatibility/recovery shell rather than a fake reduced full editor;
- recovery/export of local data from the compatibility shell when the required capability and safety conditions permit it.

#### J. Physical pen / touch / keyboard / mouse verification

Physical Tier-A devices must cover:

- pressure response and configured minimum/maximum curves;
- tilt/orientation only on hardware/browser paths that report them, with correct capability fallback when absent;
- coalesced/raw/predicted samples when exposed, ensuring predicted samples never become canonical history;
- application-level palm rejection and simultaneous pen/touch arbitration;
- pen drawing while touch performs the intended canvas/UI roles;
- hover/cursor behavior where hardware supports it;
- keyboard temporary tools/modifiers and shortcut conflicts;
- mouse precision, wheel/gesture navigation and context behavior;
- long continuous strokes and rapid tool switching without sample-order corruption or unbounded queue growth.

A feature unavailable from the physical device/browser API is not fabricated; the test instead verifies the designed capability-detection/fallback behavior.

### TV-4. Test execution tiers

Implementation should maintain three execution tiers, independent of implementation-stage numbering:

- **Fast change gate:** static/type/schema checks, focused unit/property tests, small deterministic render/serialization fixtures and changed-area integration tests. Intended to run on normal code changes.
- **Extended integration gate:** full unit/property suites, worker/concurrency integration, rendering goldens, format corpora, browser automation, recovery/fault-injection subsets and representative performance smoke checks.
- **Physical / pre-release verification gate:** Tier-A physical devices, stylus/touch, complete PWA/offline/update flows, full performance matrix, long soak/stress, fault injection on disposable test projects, visual/accessibility review and interoperability corpus completion.

Stage 4 may assign these tiers to implementation milestones, but may not weaken their semantics.

### TV-5. Regression and change-control rule

- Every confirmed defect that escaped an existing test should gain a regression case where technically reproducible.
- Changing an expected value because implementation differs from the memo is prohibited unless the memo has first been explicitly superseded.
- Updating a visual/render golden requires review of the actual before/after difference and the canonical reason; bulk blind golden refresh is not a valid verification method.
- A dependency/browser/OS update that changes observable behavior reruns the affected compatibility, rendering, persistence and performance gates.
- Schema/file-format migration tests keep fixtures from every shipped native-format version that must remain readable under the declared compatibility contract.

### TV-6. Stage-3 completion gate

Testing / Verification Architecture is complete when all of the following are true:

1. every canonical requirement class has a defined verification layer;
2. functional success, performance, visual/motion, interoperability, accessibility, PWA/platform and data-safety failures all have explicit evidence paths;
3. physical-device-only behavior is not falsely declared covered by desktop simulation;
4. Phase-4 numeric thresholds are preserved rather than replaced by vague targets;
5. PASS semantics require commit/environment/fixture evidence;
6. no later roadmap implementation stage is permitted to declare global completion from build/typecheck/unit tests alone;
7. Release Criteria remain a separate Stage-5 decision using this architecture rather than being silently invented during implementation.

**Stage-3 Testing / Verification result: PASS / CLOSED at design level.** No implementation tests have been executed by this design closure; this PASS means the verification contract is now specified, not that the future application has passed it.

### Phase 7A change-log entry

- 2026-08-30: Completed final-integration Stages 1–3. Audited canonical cross-phase consistency without reopening closed design, established explicit precedence for stale historical wording, closed all unexpected residual design questions, enumerated the intentionally deferred roadmap/release/license/final-freeze work, and replaced the testing placeholder with a traceable multi-layer verification architecture covering functional correctness, renderer/data/history, recovery, interoperability, UI/accessibility/motion, performance, Tier-A PWA/platform behavior and physical pen/touch evidence.



# Phase 7B Final Integration — Stages 4–6 Closure — 2026-08-30

**Status:** AUTHORITATIVE / CLOSED for **Stage 4 — Implementation Roadmap / Dependency Graph**, **Stage 5 — Release Criteria**, and **Stage 6 — project-level software license / third-party NOTICE policy**. This section builds on the closed Phase 1–7A design and does not reopen product, UX, canonical data, renderer, visual, icon, motion, sampled-asset, brush-pack, or testing decisions. The only remaining design action after this section is the final Completion Gate / `IMPLEMENTATION READY — DESIGN FREEZE` audit.

# Implementation Roadmap

## FI-4. Implementation Roadmap / Dependency Graph — CLOSED

### IR-1. Governing implementation rules

Implementation must preserve these rules throughout the roadmap:

- The rebuild starts from the canonical memo, not the old Illustro codebase.
- Closed design is not silently redesigned during coding. If implementation exposes a real contradiction or impossible requirement, log it as a specification defect and resolve it explicitly in this memo before changing product semantics.
- Production paths are built as connected vertical slices. UI-only stubs, renderer-only demos, or persistence-only prototypes do not count as implemented product capability.
- Canonical document correctness, Undo/Redo, persistence and recovery remain independent of GPU cache state.
- Verification from FI-3 is continuous. A milestone is CLOSED only when its own exit evidence is PASS; later integration cannot retroactively excuse an earlier failed invariant.
- Performance instrumentation, deterministic fixtures and failure-injection hooks are introduced with the subsystem they verify rather than postponed until release week.
- Meaningful implementation units are committed and pushed after their defined verification passes. Do not accumulate large amounts of verified work only in an unpushed local state; equally, do not fragment commits into trivial line-by-line changes.
- The roadmap is dependency-driven, not calendar-driven. Parallel work is allowed only where the graph permits it.
- The early vertical slice is an architecture/integration gate, **not an MVP completion target**. Illustro is not feature-complete until the frozen canonical inventory is fully reconciled.

### IR-2. Milestones

#### M0 — Repository / build / verification foundation

Establish the new implementation workspace and repeatable engineering harness:

- TypeScript/JavaScript Web/PWA project foundation and WebGPU/WGSL build path;
- formatting, lint, typecheck, unit/integration test runners and production build;
- CI capable of running deterministic non-physical gates on every integration change;
- local HTTPS/secure-context development path and deployment headers required by the supported runtime contract;
- fixture/golden-data layout, benchmark harness, diagnostics hooks and structured test-result output;
- release provenance scaffolding from FI-6 (`LICENSE`, `NOTICE`, third-party manifest/SBOM generation path) before third-party implementation code begins accumulating.

**Exit gate:** clean checkout can install/restore dependencies, typecheck, test and produce the minimal application shell reproducibly; CI reports the exact commit SHA and artifacts it verified.

#### M1 — Canonical contracts / validation / Command Registry core

Implement the semantic foundation before production pixels depend on it:

- `DocumentV1`, layer/mask/resource identities and revision contracts;
- brush/resource schemas and version identifiers;
- Command Registry namespaces, command metadata and dispatch boundary;
- canonical transaction interfaces for document mutations;
- capability/runtime-profile model;
- validation, serialization primitives, migration/version plumbing and structured fidelity/error records.

**Exit gate:** schema/validation/property tests prove round-trip and invariant behavior without renderer or UI dependence.

#### M2 — Persistence / history / local project system

Implement canonical durability using synthetic document payloads before depending on the renderer:

- OPFS immutable-object working store;
- framed journal, checkpoint publication, dual-head recovery state and autosave timing;
- Web Lock ownership and BroadcastChannel coordination;
- exact Undo/Redo transaction spine, history spill/retention and GC roots;
- quota/safety-reserve policy, Recently Deleted and local Library metadata;
- storage-worker failure/restart and deterministic recovery machinery.

**Depends on:** M1.

**Exit gate:** kill/reload/torn-write/lock/contention/quota fixtures recover the latest coherent committed state according to Phase 4, and Undo/Redo exactness survives persistence boundaries.

#### M3 — WebGPU / sparse-tile / input foundation

Implement the rendering and input substrate:

- startup WebGPU capability gate and unsupported compatibility shell boundary;
- Render Worker/main-context ownership fallback exactly as Phase 4 permits;
- 256 px sparse canonical tile scheduling and 2048 px atlas-page policy;
- minimal layer compositing, dirty/dependency/halo scheduling and cache identities;
- bounded pointer/input queues, coalesced/raw/predicted-sample handling and timestamped document-coordinate pipeline;
- device-loss rebuild path;
- render/input timing counters from FI-3/P4.

**Depends on:** M1. May proceed in parallel with M2 after M1 closes.

**Exit gate:** deterministic raster fixtures render correct baseline pixels, input queues remain bounded, device-loss reconstruction preserves canonical state, and the performance harness can measure the Phase-4 metrics.

#### M4 — Production end-to-end paint vertical slice

Join M1–M3 into the first real production path:

`create/open document → raster layer → confirmed pen/mouse stroke → visible WebGPU result → one history transaction → Undo/Redo → autosave/checkpoint → reload/recovery → PNG export`.

A minimal internal UI/harness is sufficient here; final F/G/H/V presentation is not required yet.

**Depends on:** M1 + M2 + M3.

**Exit gate:** the same canonical stroke and transaction survive Undo/Redo, forced reload and GPU rebuild and produce deterministic export output. No step may be a disconnected stub.

#### M5 — Core document / layer / compositor / color systems

Expand the vertical slice into the complete shared editing substrate:

- document resize/crop/rotate/flip and navigation contracts;
- raster/vector/folder/adjustment/linked-object/Lineart Boundary layer structures as already specified;
- masks, clipping, blending, transforms and non-destructive stack plumbing;
- sRGB/Display-P3 document semantics and RGBA8/RGBA16F paths;
- Color/Palette/History/Eyedropper infrastructure;
- selection/reference relationships needed by later tools.

**Depends on:** M4.

**Exit gate:** canonical layer/compositor golden tests, document-operation history tests and color round-trip/reference fixtures PASS.

#### M6 — Canonical brush engine / resource system / Default Brush Pack

Implement the full adopted raster-brush contract and integrate closed I/J assets:

- procedural and sampled tip paths, texture/grain/pattern resources;
- pressure/tilt/velocity/random dynamics and response curves;
- opacity/flow/density, spacing, angle, jitter, scatter/spray, stabilization and taper;
- ordinary raster color mixing/smudge/blur/eraser behavior within the adopted scope;
- preset editing/search/category/import/export and `.illbrush` integration;
- final 48 J presets, deterministic thumbnails and built-in resource provenance.

**Depends on:** M3 + M4 + M5 and the closed I/J design assets.

**Exit gate:** canonical brush fixtures, pressure/dynamics tests, sampled-resource integrity, `.illbrush` round-trip and physical stylus brush-feel verification reach their FI-3 PASS criteria.

#### M7 — Advanced editing feature systems

Implement the remaining adopted single-illustration production systems. Internal lanes may overlap, but each lane depends on the common M5 substrate and on any explicitly used earlier lane:

- **M7A Selection / Fill / Rulers / Snap / Transform:** selection types, fill/gradient/pattern, Auto Select/Enclose Fill, transforms, alignment, rulers and snapping.
- **M7B Vector / Shape / Text:** editable paths/shapes, vector masks and editable initial-release text layers without reintroducing excluded vector-brush semantics.
- **M7C Lineart Boundary:** extraction graph, semantic manual overrides/no-connect rules, incremental regeneration, multi-boundary union references and exact history behavior. Depends on M7A region/reference infrastructure.
- **M7D Effects / Adjustments / Liquify:** destructive/non-destructive shared kernels, adjustment layers, effect stacks, reduced-quality interactive previews, full-quality settle/export and synchronized Lineart deformation where applicable.
- **M7E Production aids:** Reference/Sub View, Navigator, local materials/resource workflows, Auto Actions and other adopted command-driven productivity aids.

**Exit gate:** every lane has production-path integration, history/persistence coverage and feature-specific verification; no adopted capability is represented only by UI.

#### M8 — Full F/G/H/V UX and interaction integration

The final workspace may begin as a shell after M1, but this milestone cannot close until the feature systems it exposes are production-connected.

Implement and verify:

- the three-surface IA and canonical flows;
- 14-family Tool Rail, 13-block Inspector, contextual footer/action surfaces;
- dock/reorder/detach/PiP behavior and persistent workspace customization;
- ringless six-hex Quick Hole geometry/mapping/anchoring;
- final F/G visual tokens/layout, H iconography and V motion including Reduced Motion;
- keyboard/mouse/pen/touch arbitration and Command Registry binding;
- Japanese/English localization and accessibility semantics;
- wide/compact supported editor layouts and narrow-layout compatibility behavior.

**Depends for closure on:** M6 + all relevant M7 lanes. Shell work may start after M1.

**Exit gate:** canonical user-flow, visual/icon/motion, input, localization and accessibility verification from FI-3 PASS on production-connected features.

#### M9 — Native format / interoperability / timelapse completion

Implement the complete external boundary:

- `.illustro` v1 ZIP64 archive, checksums, validation and migration behavior;
- PNG/JPEG/SVG import/export;
- bounded-fidelity PSD import/export with structured fidelity reports;
- adopted ibisPaint/CSP brush interoperability within the frozen compatibility contract;
- linked-object refresh/relink semantics;
- drag/drop and File System Access progressive enhancements where supported;
- timelapse recording/playback/export using capability-detected WebCodecs where applicable.

**May start after:** M1/M2 format primitives. **Cannot close before:** M6/M7 structures that must round-trip are implemented.

**Exit gate:** corpus/matrix tests, malformed-input rejection, round-trip invariants and fidelity reports PASS.

#### M10 — PWA / reliability / performance / platform hardening

No new feature scope is introduced here. Harden the complete production editor:

- install/offline/update/service-worker behavior;
- lifecycle/visibility handling and safe persistence handoff;
- storage-pressure, autosave/checkpoint, worker-failure and GPU-loss recovery UX;
- adaptive memory/cache/worker policy;
- shader/pipeline/cache warm-up and measured hotspot optimization, including WASM/SIMD only where profiling justifies it;
- all Phase-4 performance targets on the Stage-5 reference hardware matrix;
- long-session/stress and large-document admission tests.

**Depends on:** M8 + M9 production-complete paths.

**Exit gate:** FI-3 reliability, PWA, stress and performance suites PASS with no unresolved data-safety defect.

#### M11 — Frozen feature-inventory closure

Reconcile the implementation against the 2026-08-30 frozen canonical inventory:

- every ADOPTED item is `IMPLEMENTED / VERIFIED`;
- every EXCLUDED item remains explicit and is not accidentally relied on;
- every SUPERSEDED capability points to the verified Illustro replacement path;
- post-baseline candidates remain non-gating unless explicitly adopted later;
- no required capability is planned-only, UI-only, dead code or disconnected from persistence/production paths.

**Depends on:** M10.

**Exit gate:** functional-completion gate PASS with traceable evidence for every frozen inventory item.

#### M12 — Release Candidate construction and verification

Create one immutable release-candidate identity and execute all Stage-5 gates against it. No functionality is declared complete merely because build/typecheck/unit tests pass.

**Depends on:** M11.

**Exit gate:** Stage-5 Release Criteria return `GO`; otherwise the candidate is `NO-GO` and must be corrected before a new immutable RC is created.

### IR-3. Dependency graph

```text
M0  Repository / verification foundation
 |
 v
M1  Canonical contracts / Command Registry
 |\
 | +--------------------+
 v                      v
M2  Persistence/history M3  WebGPU/input/render foundation
  \                    /
   +--------+----------+
            v
M4  End-to-end production paint vertical slice
            |
            v
M5  Core document/layer/compositor/color
        /             \
       v               v
M6  Brush engine       M7  Advanced editing systems
       \               /
        +------+-------+
               v
M8  Full F/G/H/V UX integration
               |
M9  Native/interoperability/timelapse  <--- may begin earlier after M1/M2,
               |                            closes after M6/M7 structures exist
               +-----------+
                           v
M10 PWA/reliability/performance/platform hardening
                           |
                           v
M11 Frozen feature-inventory closure
                           |
                           v
M12 Immutable Release Candidate + Stage-5 verification
```

### IR-4. Parallelization boundaries

- M2 and M3 are the first major parallel lanes after M1.
- M6 and independent portions of M7 may run in parallel after M5.
- M8 shell/component infrastructure may begin after M1, but final behavior cannot be accepted against mock data when production feature paths exist.
- M9 archive/parser infrastructure may begin after M1/M2, but final round-trip coverage waits for the structures it must serialize.
- Test fixtures, provenance capture and performance instrumentation are continuous lanes from M0 onward.
- M10–M12 are convergence stages and should not be bypassed by parallel feature branches.

**Stage-4 result: PASS / CLOSED at design level.** The implementation order, dependency graph, parallel boundaries and milestone exit gates are fixed without starting implementation.

# Release Criteria

## FI-5. Initial-release GO / NO-GO contract — CLOSED

A release is permitted only from an immutable **Release Candidate (RC)** identified by exact Git commit SHA and exact build/artifact hashes. Evidence from different unpinned builds may not be combined to manufacture a PASS.

### RC-1. Release decision semantics

- `GO`: every mandatory gate below is PASS on the same RC or on a reproducible artifact proven byte/semantically equivalent where the gate is environment-specific.
- `NO-GO`: any mandatory gate is FAIL or BLOCKED, any required evidence is missing, or an unresolved release-blocking defect exists.
- `N/A` is valid only when the canonical specification explicitly makes the capability inapplicable to that target; convenience is not an N/A reason.
- A release cannot be declared on “mostly passing” evidence.

### RC-2. Build / identity / reproducibility gate

Required:

- clean source state at the RC SHA;
- production build, typecheck and required static checks PASS;
- deterministic/repeatable generation of schemas, built-in manifests, notice files and SBOM from the same declared inputs;
- released files/artifacts carry recorded cryptographic hashes;
- development-only diagnostics or test shortcuts cannot silently replace production behavior.

### RC-3. Functional-completeness gate

Required:

- M11 frozen feature inventory is 100% reconciled;
- all ADOPTED initial-release capabilities are `IMPLEMENTED / VERIFIED`;
- exclusions and post-baseline candidates are explicit;
- no required feature remains stubbed, disconnected, hidden behind a non-production flag, or dependent on mock data;
- J's 48 default brushes and final I resource inventory are present through the canonical production resource path.

### RC-4. Canonical correctness / history / data-safety gate

Required:

- canonical schema, validation, layer/compositor and deterministic algorithm suites PASS;
- Undo/Redo exactness PASS across strokes, transforms, layer edits, Lineart topology, regeneration boundaries and other adopted transaction classes;
- journal/checkpoint/autosave/recovery fault-injection matrices PASS, including torn/corrupt-tail handling, forced close/reload, storage-worker restart and published-head recovery;
- Web Lock multi-context ownership behavior PASS;
- GPU device loss never destroys canonical document state and renderer rebuild/recovery PASS;
- quota-pressure and persistence-failure UX never falsely reports a successful save;
- **zero known reproducible data-loss or silent project-corruption defect** remains open.

### RC-5. Native-format / interoperability gate

Required:

- `.illustro` v1 save/open/round-trip preserves every adopted editable structure and rejects malformed/incompatible archives safely;
- migration fixtures for every supported prior schema revision PASS once such revisions exist;
- `.illbrush` round-trip and malformed-package handling PASS;
- PNG/JPEG/SVG behavior PASS against the canonical matrix;
- PSD and proprietary brush import/export claims are bounded by tested corpora and structured fidelity reports; no unsupported semantic is silently claimed as exact;
- linked-object missing-source/relink behavior preserves embedded project correctness.

### RC-6. Tier-A platform / physical-input gate

The initial release reference matrix is the closed P1-3 Tier-A contract:

- iPadOS 26.6 / Safari 26.6 or installed Safari Web App;
- Android 12 / Chrome 152 tablet class;
- Windows 11 25H2 / Chrome 152 and Edge 152;
- macOS Sonoma 14.8.8+ / Safari 26.6 and Chrome 152.

Later stable versions remain test targets as required by P1-3. Browser/OS labels never override failed runtime capability gates.

Mandatory physical evidence:

- at least one qualifying **Apple Pencil-capable iPad** for pen/touch workflows;
- at least one qualifying **active-stylus Android tablet** for pen/touch workflows;
- Windows and macOS hardware covering their Tier-A browser combinations with mouse/keyboard, plus pen input where qualifying hardware is available;
- pressure, tilt/orientation where exposed, palm-rejection/arbitration behavior, touch navigation, keyboard modifiers/shortcuts and pointer capture are exercised through real input devices rather than synthetic events alone.

Every Tier-A browser combination must pass startup/runtime gating, production editing smoke flows, persistence/recovery smoke, import/export smoke, PWA/offline behavior where applicable and the accessibility checks assigned to that platform.

### RC-7. Performance / memory / stress gate

Use the FI-3 benchmark protocol and Phase-4 reference workloads. The existing numeric contracts remain authoritative, including at minimum:

- cached pan/zoom/rotate: p95 `<= 16.7 ms`, p99 `<= 33.3 ms` on the reference workload;
- simple baseline brush confirmed-input-to-visible feedback: p50 `<= 16.7 ms`, p95 `<= 33.3 ms`;
- ordinary UI command acknowledgement: p95 `<= 100 ms` when not inherently waiting on a long task;
- main-thread pointer/arbitration CPU: p95 `<= 1 ms` per delivered event batch;
- bounded input/render queues without unbounded latency or memory growth;
- Phase-4 memory tiers, tile/cache budgets, canvas admission limits, autosave/recovery timing, Undo spill and storage reserves remain within contract.

Run long-session and large/sparse-document stress on each release reference hardware class. A slower device may use the already specified adaptive quality/cache policies; it may not silently violate correctness or data-safety contracts.

### RC-8. UI / visual / motion / accessibility gate

Required:

- F/G layout and visual tokens verified against the canonical visual reference and authoritative later F/G refinements;
- H iconography verified at required 16/20/24 px contexts and app-icon assets remain hash/identity consistent with the canonical design;
- ringless six-hex Quick Hole geometry, mapping, anchoring, dismissal and customization behavior PASS;
- Inspector/PiP docking, reordering, resizing, collapse/persistence and magnetic return behavior PASS;
- V motion timing/spatial rules and Reduced Motion behavior PASS without delaying input acknowledgement;
- Japanese and English localization smoke/overflow checks PASS;
- keyboard-only access, focus behavior, accessible names/roles/states, non-color-only communication, target/legibility rules and contrast requirements PASS;
- automated accessibility tooling is supplemented by manual keyboard and screen-reader checks on representative desktop and mobile/tablet environments. No known critical accessibility blocker in a required production flow may remain open.

### RC-9. PWA / offline / lifecycle / update gate

Required:

- installability and application launch PASS on supported installable targets;
- after the documented first-load/setup boundary, required local editing/open/save functionality survives network loss according to the local-first contract;
- service-worker/update flow never silently replaces a running editor into an incompatible state or loses unsaved committed work;
- reload, page hide/show, suspend/resume and storage lifecycle flows preserve the persistence contract;
- production deployment headers satisfy secure-context and optional SharedArrayBuffer/cross-origin-isolation behavior without making Transferable fallback environments falsely unsupported;
- unsupported WebGPU/runtime environments enter the compatibility/recovery shell rather than a fake reduced editor.

### RC-10. License / provenance / supply-chain gate

Required:

- FI-6 project license and third-party policy are implemented exactly;
- every distributed runtime dependency, copied code fragment, bundled font and non-first-party asset has reviewed provenance and an identified license;
- no prohibited or unresolved-license component is present in the production distribution;
- `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, required third-party license texts and the release SBOM are generated and mutually consistent;
- the in-app/offline Licenses surface is generated from the same reviewed source of truth;
- no known high-impact vulnerability that is reachable in the production path is knowingly shipped without an explicit release-blocking review and resolution.

### RC-11. Defect severity and waiver policy

- **S0 — Release Blocker:** reproducible data loss/corruption, unsafe persistence claims, exploitable critical production flaw, cannot open/save required projects, or inability to start the supported editor on a Tier-A target. **Zero open allowed.**
- **S1 — Critical:** an adopted core workflow is materially broken with no safe practical workaround; severe Undo/Redo/render/interoperability/accessibility failure in a required path. **Zero open allowed.**
- **S2 — Major:** material defect with a safe workaround that does not violate a canonical completion/release gate. Release requires an explicit documented waiver; an S2 cannot waive a failed mandatory gate.
- **S3 — Minor/Cosmetic:** non-blocking defect that does not violate canonical semantics, data safety, accessibility minimums, or release criteria. May ship only when tracked.

### RC-12. Final release record

A `GO` decision records at minimum:

- RC commit SHA and release tag/version;
- production artifact hashes;
- Tier-A environments/device identifiers sufficient for reproduction;
- verification summary with links/identifiers to machine and physical evidence;
- accepted S2/S3 known issues and waivers, if any;
- final license/NOTICE/SBOM hashes;
- date and person/process approving the release.

**Stage-5 result: PASS / CLOSED at design level.** The release decision is now objective and evidence-based; no release candidate has yet been executed against these gates.

# Project License / Third-Party NOTICE Policy

## FI-6. Licensing and provenance closure — CLOSED

This is a project policy and release-engineering contract, not legal advice. If a future dependency or distribution arrangement creates obligations outside this defined policy, it must be reviewed explicitly before inclusion rather than silently weakening this closure.

### LIC-1. First-party project license — Apache-2.0

Illustro adopts **Apache License 2.0 (`Apache-2.0`)** as the project-level license for first-party source code, documentation and original built-in resources distributed from this repository unless a specific file is explicitly and intentionally marked otherwise.

Rationale for this project:

- permissive commercial and non-commercial reuse remains possible;
- the license provides an explicit patent-license framework suitable for a technically complex graphics application;
- it has a standardized SPDX identifier and a well-understood attribution/NOTICE mechanism;
- it is compatible with the already adopted preference for permissive third-party implementation code.

The project license does **not** relicense user-created artwork or user-imported resources. User project contents retain their own copyright/license status. Illustro name/logo/trade identity is not granted as a trademark right merely by the software license.

The final I sampled-resource inventory and J first-party preset/thumbnail assets are first-party Illustro distribution resources under this policy unless a later explicit provenance record says otherwise.

### LIC-2. Dependency / copied-code default policy

**Default-compatible direct inclusion classes** when technically suitable and obligations are satisfied:

- public domain / CC0-1.0;
- 0BSD, MIT, ISC;
- BSD-2-Clause / BSD-3-Clause;
- Zlib and similarly minimal permissive licenses after identifier/notice validation;
- Apache-2.0.

**Specialized allowed classes:**

- OFL-1.1 may be used for fonts only when reserved-font-name, redistribution and notice obligations are respected;
- CC BY 4.0 may be used for non-code assets only when attribution can be preserved reliably in the product/distribution. Prefer first-party/CC0 assets where practical.

**Conditional / explicit-review classes:** file- or library-level copyleft and other licenses with source-disclosure/relinking/reciprocity conditions (for example MPL/LGPL/EPL families) are not part of the default allowlist. They require a documented compatibility and distribution review before merge.

**Prohibited by default for distributed core/product code:** GPL/AGPL strong-copyleft code, source-available-but-not-open licenses, code with no usable license, and proprietary source copied from reference applications. Inclusion requires a later explicit project-level supersession and compliance review; behavior may still be independently reimplemented from public specifications/algorithms where copyright expression is not copied.

A transitive dependency is not exempt from review merely because Illustro did not choose it directly.

### LIC-3. Provenance record required before merge/distribution

For every materially reused third-party component or asset, record at least:

- component/resource name and package identity;
- exact version and, where relevant, source commit/hash;
- canonical source URL/project/publication;
- SPDX license identifier or explicit reviewed custom-license label;
- copyright/attribution holder information when required;
- whether it is runtime-distributed, vendored, build-only, test-only or documentation-only;
- whether Illustro links/depends on it, copies/modifies source, bundles bytes/assets, or merely independently reimplements an algorithm after reference study;
- local modifications/patches;
- required license text, attribution, NOTICE or source/relinking obligations;
- review status and reviewer/date.

`ResourceV1.ProvenanceV1` remains the canonical project-data provenance mechanism for resources stored inside Illustro projects. Release dependency provenance may live in auxiliary generated files, but the policy itself remains canonical here.

### LIC-4. Required repository/distribution notice artifacts

Before implementation code is distributed beyond private experimentation, the repository and production distribution must contain:

1. **`LICENSE`** — exact full Apache License 2.0 text for the first-party collective work.
2. **`NOTICE`** — concise human-readable project notice plus only attribution/NOTICE statements that must be preserved in a NOTICE-style file. Do not dump every dependency into NOTICE when its license does not require that form.
3. **`THIRD_PARTY_NOTICES.md`** — comprehensive human-readable list of distributed third-party components/assets, versions, sources, SPDX identifiers and required attribution notes.
4. **`third_party/licenses/`** — exact third-party license texts where redistribution of the text is required or where inclusion materially improves compliance clarity.
5. **`bom.cdx.json`** — machine-readable **CycloneDX 1.7 JSON** SBOM for the production distribution, generated from the resolved dependency/build inputs. A later SBOM format/version change requires an explicit tooling-policy update but does not change the licensing principles here.

The PWA includes an offline-accessible **About / Open Source Licenses** surface generated from the same reviewed third-party manifest used to create `THIRD_PARTY_NOTICES.md`; the UI is not maintained as a separate manual source of truth.

Release archives/installable web assets include the applicable license/notice material in a retrievable form even when the app is offline.

### LIC-5. What belongs in the app notice set

- Runtime/bundled third-party code and assets: included according to their obligations.
- Vendored source: included and reviewed even if a package manager is not involved.
- Build/test-only tools that are not redistributed: tracked in the dependency/SBOM process; they need not be represented to end users as runtime components unless their license or actual distribution requires it.
- User-imported brushes/images/fonts/projects: **not** converted into Illustro's own third-party notice obligations merely because the user opens them locally. Illustro preserves known provenance where the project schema supports it and never falsely relabels ownership/license.
- Independently reimplemented algorithms: record the paper/spec/reference implementation when materially useful for engineering traceability, but do not claim copied source when none was copied.

### LIC-6. Automated compliance gate

The production CI/release pipeline must:

1. resolve the exact dependency graph/lock state;
2. identify package/resource licenses and provenance;
3. fail on unknown/unreviewed production licenses or any default-prohibited distributed dependency;
4. verify required attribution/NOTICE/license-text obligations;
5. generate `THIRD_PARTY_NOTICES.md`, applicable license-text bundle and `bom.cdx.json` from reviewed metadata;
6. verify that generated files match the RC dependency graph and built-in resource manifest;
7. make the same reviewed notice data available to the offline in-app Licenses surface;
8. retain the generated files/hashes with release evidence.

Manual edits to generated notice output must flow back to the reviewed provenance source instead of creating divergent copies.

### LIC-7. Stage-6 closure result

**Project-level license: Apache-2.0.**

**Third-party NOTICE policy: CLOSED.** Direct reuse remains permit-first and provenance-tracked; strong-copyleft/source-available/proprietary copied code remains excluded by default; first-party I/J assets remain under the project policy; release distributions require synchronized `LICENSE`, `NOTICE`, third-party notice/license bundle, CycloneDX SBOM and offline in-app license presentation.

**Stage-6 result: PASS / CLOSED at design level.** The policy is defined; the actual implementation dependency inventory and generated notice/SBOM artifacts will be produced from the real implementation graph beginning at M0 and verified again at every RC.

### Phase 7B change-log entry

- 2026-08-30: Closed final-integration Stages 4–6. Defined a dependency-driven M0–M12 implementation roadmap from canonical contracts through storage/render vertical slice, complete feature/UI/interoperability integration, hardening, frozen feature closure and immutable RC verification; fixed objective GO/NO-GO release criteria covering canonical correctness, data safety, Tier-A physical devices, performance, interoperability, PWA, accessibility and provenance; selected Apache-2.0 for first-party Illustro work and fixed synchronized LICENSE/NOTICE/third-party-license/CycloneDX-SBOM/offline-license packaging with default exclusion of incompatible or unresolved copied code. Final Completion Gate / `IMPLEMENTATION READY — DESIGN FREEZE` remains the only open final-integration design action.



# Phase 7C Final Completion Gate — IMPLEMENTATION READY / DESIGN FREEZE — 2026-08-30

**Status:** AUTHORITATIVE / FINAL / DESIGN FREEZE. This section is the final design-integration gate for the Illustro rebuild. It is based on the canonical `ILLUSTRO_DESIGN_MEMO.md` state at pre-freeze `main` commit `cfd26e8031d6963d9d778bd05e34b449368e57e9` and the Phase 7A/7B closures already recorded there. It does not claim that the application has been implemented, feature-complete, release-tested or released. It declares that the canonical design is sufficiently complete, internally integrated and bounded to begin implementation under the frozen specification.

## FI-7. Final reverse-audit — PASS

The final audit traversed the canonical design in reverse dependency order, from release/licensing/roadmap/testing back through assets/visual/UX/technical/data/product scope.

### Closed design domains

The following are all closed and mutually integrated at design level:

1. **Phase 1 — Product / Platform:** product definition, frozen external-reference baseline, initial-release adopted/excluded/post-baseline dispositions, Tier-A platform/browser/runtime matrix, responsive policy, accessibility and localization.
2. **Phase 2 — UX / Interaction:** information architecture, Tool Rail / Inspector / contextual surfaces, user flows, multimodal input arbitration, Command Registry, error/recovery UX.
3. **Phase 3 — Data / File Format:** canonical document/layer/resource/brush/history models, `.illustro` v1 / `.illbrush`, color semantics and interoperability contracts.
4. **Phase 4 — Renderer / Performance / Persistence:** WebGPU baseline, worker topology, sparse tile geometry, scheduling/cache/memory/input limits, canvas bounds, numeric performance targets, OPFS/journal/checkpoint/autosave/Undo/quota/recovery contracts.
5. **Phase 5A F/G:** final UI structure and visual design system.
6. **Phase 5B H:** app icon and UI iconography.
7. **Phase 5C V:** motion and spatial-feedback system.
8. **Phase I Final:** procedural-first production sampled-resource inventory.
9. **Phase 6 J:** 48-preset default brush pack, tuning, thumbnails and design-stage QA.
10. **Phase 7A Stages 1–3:** consistency audit, residual-decision closure and testing/verification architecture.
11. **Phase 7B Stages 4–6:** implementation roadmap/dependency graph, objective release criteria, Apache-2.0 project license and third-party NOTICE/provenance/SBOM policy.

**Result:** no current authoritative design domain remains OPEN.

## FI-7.1. Residual marker audit — PASS

The memo still intentionally preserves historical phase wording for traceability. The final audit specifically rechecked `OPEN`, `Not yet defined`, pending/provisional language and the original `Open questions` section.

The following residual strings are **historical/superseded, not active design state**:

- original `Testing / Completion Gates — Not yet defined` and detailed-roadmap placeholder → superseded by FI-3 and FI-4;
- original Open Questions for Release Criteria and project license / third-party NOTICE → superseded by FI-5 and FI-6;
- earlier F/G/H/V/I/J phase-boundary statements saying later visual/asset phases remained open → superseded by their later AUTHORITATIVE / CLOSED sections;
- intermediate I inventory/counts and `J remains OPEN` statements → superseded by Phase I Final and Phase 6 J;
- early browser/worker/SAB/tile/cache wording → superseded or bounded by Phase 1, Feasibility Closure and Phase 4 as already recorded by FI-1 precedence.

The canonical precedence rule from FI-1 remains binding after Design Freeze. Historical text must not be interpreted as reopening a later explicit closure.

## FI-7.2. Remaining blocker classification — PASS

### Design blockers

**Count: 0.**

There is no remaining undefined product behavior, required feature-scope decision, canonical data semantic, UI/interaction contract, renderer/storage architecture decision, asset/brush design decision, testing contract, implementation-order dependency, release criterion or project-license/NOTICE policy that must be invented before implementation begins.

### Intentionally implementation-time work

The following are not design blockers because the memo already defines their governing contracts and acceptance gates:

- writing production source code, shaders, schemas and tests;
- selecting exact implementation libraries only after license/provenance review;
- generating the real dependency inventory, `LICENSE`, `NOTICE`, third-party license bundle and CycloneDX SBOM from the implementation graph;
- implementation-specific tuning explicitly delegated to profiling/adaptive policies inside already closed numeric or semantic bounds;
- executing FI-3 verification suites and Stage-5 release matrices on real builds/devices;
- fixing implementation defects that do not change canonical semantics;
- measuring actual RC performance, fidelity, recovery and physical-input results.

Any implementation discovery that would change observable product behavior, canonical persistence semantics, compatibility guarantees, closed numeric limits, required scope or release criteria is a **specification defect**, not an implementation-team discretion. It must follow the post-freeze change-control rule below.

## FI-7.3. Post-freeze change control — CLOSED

After this declaration, `ILLUSTRO_DESIGN_MEMO.md` remains the canonical source of truth, but its frozen design may change only through explicit change control.

A post-freeze design change must:

1. be recorded as an explicit **DESIGN CHANGE / SUPERSESSION** entry in the canonical memo;
2. identify the exact frozen rule(s) being changed and the reason;
3. identify every dependent phase/gate affected;
4. reopen only the affected design gate(s), not unrelated closed domains;
5. define any required `.illustro` / `.illbrush` migration, compatibility or user-data consequences before merge when persistent semantics change;
6. update tests/fixtures/release criteria/provenance obligations affected by the change;
7. rerun the applicable consistency and completion gates before the changed design is treated as frozen again.

Implementation details, refactors, optimizations and bug fixes that preserve the frozen observable/canonical contract do **not** reopen Design Freeze.

Post-baseline candidate features remain outside the frozen initial-release gate unless a later explicit adoption change reopens the appropriate scope gate.

## FI-7.4. Implementation-entry contract — CLOSED

Implementation is now authorized to begin at **M0** from FI-4. M0 establishes the repository/build/CI/verification/provenance foundation; later milestones must respect the dependency graph and milestone exit gates rather than jumping directly to disconnected feature accumulation.

During implementation:

- consult this memo before architecture/product decisions;
- never silently redefine a frozen specification because code is easier another way;
- maintain feature-inventory status as implementation/verification progresses;
- attach FI-3 evidence to milestone/release claims;
- use Stage-5 GO/NO-GO criteria for release, not implementation progress alone;
- create meaningful Git commits and push them after coherent verified work units rather than accumulating large verified changes only locally.

## FI-7.5. Meaning of this freeze

This freeze means:

- **Design complete enough to implement:** YES.
- **All planned initial-release design domains integrated:** YES.
- **Remaining authoritative design blockers:** 0.
- **Implementation started by this gate:** NO.
- **Feature implementation complete:** NO.
- **Future FI-3 verification executed against the application:** NO.
- **Release candidate Stage-5 GO:** NO; no RC exists yet.
- **Production release ready:** NO.

Those later implementation/release states can be achieved only through M0–M12 and the defined verification/release gates.

# FINAL COMPLETION GATE

**Stage 7 final reverse-audit result: PASS.**

**Remaining pre-implementation design blockers: 0.**

**Remaining final-integration design stages: 0.**

# `IMPLEMENTATION READY — DESIGN FREEZE`

The Illustro rebuild specification is now frozen for implementation as of 2026-08-30. The next authorized project phase is **M0 — implementation foundation**, not additional unconstrained design expansion.

### Phase 7C change-log entry

- 2026-08-30: Passed the final Completion Gate after reverse-auditing every closed product/platform/UX/data/renderer/persistence/visual/icon/motion/asset/brush/testing/roadmap/release/licensing domain; classified all remaining OPEN/placeholder strings as explicitly superseded history; confirmed zero authoritative pre-implementation design blockers; fixed post-freeze supersession/change-control rules; and declared **`IMPLEMENTATION READY — DESIGN FREEZE`** without claiming implementation or release completion.



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

## Editor UI refinement — Tool Rail / Color Parameters / Quick Hole — 2026-08-31 — AUTHORITATIVE

**Status: AUTHORITATIVE.** This section refines the closed Editor UI specification. Where it conflicts with earlier presentational details for persistent Tool Rail labels, Lasso placement, Color Block parameter exposure, or Quick Hole surface treatment, this section takes precedence. It does not change the underlying Command Registry, tool semantics, color model, input arbitration, or the already-authoritative Quick Hole command mapping.

### Primary Tool Rail — icon-only persistent presentation

The Primary Tool Rail uses an **icon-only persistent presentation** in the production editor.

- Tool names are not permanently rendered beside Tool Rail icons.
- The rail remains compact so horizontal space is preferentially allocated to the Canvas Workspace.
- Every Tool Family remains identifiable through its canonical H iconography and G functional accent mapping.
- Active state is communicated through the canonical combination of feature-colored glyph, restrained soft tint, and structural selection indicator; a large saturated row background is not used.
- Removing permanent text labels must not convert the rail into a recall-only interface. Every icon exposes a localized tooltip for hover-capable input, a localized semantic accessible name, a visible identification label on keyboard focus where needed, and a touch/pen long-press identification surface where appropriate.
- Subtool availability remains visually discoverable through the canonical subtool/flyout affordance rather than permanently displayed tool names.
- Tool Rail resizing continues to obey the existing ergonomic width and hit-target rules; icon-only presentation does not permit undersized interactive targets.

This rule **supersedes earlier default presentation details that permanently displayed Tool Rail text labels beside icons**. Existing Tool Rail label typography tokens remain usable for transient tooltip, flyout, focus-identification, onboarding, and accessibility-related surfaces rather than persistent rail chrome.

### Lasso placement in the Primary Tool Rail

Lasso is a directly reachable high-frequency tool entry and is positioned **between Eyedropper and Text** in the canonical default Tool Rail ordering.

The relevant ordering is:

`… → Gradient → Eyedropper → Lasso → Text → Shape / Path → …`

- Lasso uses the canonical Selection-family semantics and Magenta-family visual identity.
- Its glyph must make freeform/lasso selection recognizable without requiring the user to open a generic Selection menu first.
- Additional selection methods may remain available through the Selection/Lasso subtool surface.
- This placement supersedes earlier mockup arrangements that placed Lasso near the bottom of the rail or separated it from the drawing/editing tools with unrelated utility entries.

### Color Block — switchable HSV / RGB numeric parameter editing

The Color Inspector Block includes a compact numeric color-parameter area in addition to the graphical color selector.

- The numeric parameter area supports at minimum **HSV (H, S, V)** and **RGB (R, G, B)**.
- HSV and RGB are shown through a **mutually switchable compact mode**, rather than permanently stacking both complete parameter sets vertically.
- The persistent selector may use a compact tab, segmented control, or equivalent low-height switch consistent with the canonical component system.
- Switching HSV/RGB changes only the representation; it does not alter the current color.
- Graphical picker changes update the visible numeric values immediately.
- Numeric edits update the canonical active color and graphical picker immediately.
- Values are validated and clamped to their defined ranges before canonical color-state commit.
- Locale-facing decimal formatting follows the existing localization rules; underlying numeric state remains locale-neutral.
- HEX access may coexist with this numeric area when useful, but it must not force both HSV and RGB to remain simultaneously expanded.
- Parameter presentation remains compact enough that the Color Block does not become unnecessarily tall.

The intended information hierarchy is: graphical color selector → compact representation switch → currently selected numeric parameter set → deeper palette/history/specialist color tools through existing progressive-disclosure surfaces.

### Quick Hole — independent hex geometry

The Quick Hole consists of **six spatially independent regular-hexagonal command surfaces** surrounding a clearly visible empty center.

- Adjacent hexagons must not overlap, intersect, visually merge, or share a combined silhouette.
- A visible gap is maintained between neighboring hexagons.
- The center remains visually open and must not be filled by a central plate, donut background, merged flower surface, or other persistent backing element.
- The six hexagons must read as six individual direct-manipulation targets rather than one decorative compound control.
- Hit regions may be ergonomically enlarged internally where necessary, but overlapping hit targets must not create ambiguous command ownership.
- The existing 30°-rotated regular-hexagon construction and canonical six-command mapping remain unchanged unless separately superseded.

### Quick Hole — canonical translucency

Each Quick Hole command surface is genuinely translucent so that the underlying artwork remains visibly readable through it.

- The canonical default uses approximately **26% white surface fill**, consistent with the existing G translucency rule.
- The result must not visually become an opaque white button merely because the artwork underneath is bright or complex.
- The user-adjustable Quick Hole opacity/customization contract remains in force.
- Icon contrast must remain sufficient across arbitrary artwork without increasing the entire hex surface to an opaque card.
- When contrast support is necessary, use restrained local edge/highlight treatment or the canonical adaptive glyph contrast support rather than a large dark backing plate.

### Quick Hole — highlight-defined relief, not drop-shadow elevation

Quick Hole depth is expressed primarily through **light/highlight behavior**, not through conventional floating-card drop shadows. The intended physical impression is a thin translucent interactive material whose edges catch light, rather than an opaque card floating above the artwork.

- Strong external drop shadows are not used around individual Quick Hole hexagons.
- Black or dark blurred halos are prohibited as the primary separation mechanism.
- Large soft elevation shadows around the six-hex cluster are prohibited.
- The six controls must not be visually unified by one shared shadow or backing surface.
- Permitted depth cues include a restrained highlight along the light-facing edge, subtle inner luminance variation, a very thin translucent boundary treatment, localized bright edge contrast, and minimal internal shading sufficient to communicate pressable surface geometry.
- Relief remains subtle and exists only to improve target recognition and material legibility without distracting from the artwork.

### Quick Hole interaction-state treatment

Quick Hole interaction states preserve the same translucent material language.

- **Idle:** approximately 26% white translucent surface with restrained edge highlight.
- **Hover/focus:** local highlight/tint emphasis; no large opaque recoloring.
- **Pressed:** immediate localized change in highlight/internal luminance sufficient to communicate depression.
- **Active/toggled state where applicable:** canonical feature accent plus structural state cue; state must not rely on hue alone.
- **Drawing contact:** Quick Hole hides immediately according to the existing canvas-anchor/input rule.

Press feedback must not introduce delayed bounce, elastic overshoot, or shadow-heavy elevation animation. Motion follows the existing V immediate-feedback and Reduced Motion contracts.

### Supersession note

This revision explicitly supersedes:

- persistent Tool Rail text labels as the default rail presentation;
- earlier Lasso positions outside the Eyedropper–Text interval;
- Color Block mockups that expose only a graphical picker without directly editable HSV/RGB numeric values;
- Quick Hole mockups where neighboring hexagons overlap or visually merge;
- Quick Hole mockups rendered as effectively opaque white buttons;
- Quick Hole depth treatments based primarily on external dark drop shadows.

All unchanged F/G/H/V Editor Shell, iconography, accessibility, responsive, input-role, Command Registry, Layer UI revision, and Quick Hole behavioral rules remain authoritative.

# Post-freeze Performance Correction — Incremental Baseline Paint — 2026-09-01

**Status: AUTHORITATIVE / IMPLEMENTATION CORRECTION.**

This controlled correction does not alter user-visible brush semantics. It supersedes only the deferral wording in the 2026-09-01 confirmed performance decision / P4-4 that allowed the current M4 baseline replay path to remain unchanged until M6A. Direct inspection of the production-connected baseline path showed that ordinary `renderer.paint.present` could redraw `committed + active`, while the session repeatedly materialized cumulative sample/dab arrays per input batch. Because that behavior violates the P4-4 hot-path invariant on a live interaction path, the baseline hot path is corrected now rather than deferred.

## Immediate invariant

1. For each confirmed input batch, Main → Renderer transfers only newly generated dabs. The cumulative active-stroke dab list must not be resent on the ordinary paint hot path.
2. Canonical/history sample and dab accumulation must not require O(total stroke length) copying on every pointer batch. The mutable active accumulator is frozen/materialized only at an explicit snapshot/finalization boundary.
3. The baseline renderer retains a GPU raster scene across ordinary presentation. Newly confirmed dabs are composited exactly once with `load`, after which the retained scene is presented without replaying stable brush history.
4. Stroke finalization stores the exact full canonical stroke/history and marks affected sparse tiles, but it must not repaint dabs already committed to the retained raster scene. Only a missing pointer-up/final tail may be appended.
5. Whole-history replay is an exceptional recovery operation only: provisional-stroke cancellation/rollback, explicit history restore such as Undo/Redo, GPU device replacement, retained-scene recreation, or an incompatible render-surface change.
6. The retained full-surface GPU scene introduced by this correction is an interim M4/M5 hot-path fix, not the final large-document architecture. M6A remains responsible for canonical sparse tile/atlas retention, dirty-tile compositing, bounded mutable-tail smoothing, and tighter reusable/ring-buffer allocation.
7. Regression coverage must prove that repeated presentation work scales with the dab delta rather than the accumulated stroke prefix or unrelated committed history.

## Complexity target

Ordinary active-stroke work must be **O(new dabs + bounded presentation cost)** and independent of both the stable stroke prefix and unrelated committed stroke history. Whole-history O(N) reconstruction is permitted only on the exceptional recovery paths listed above.

## Implementation note

The baseline implementation therefore uses **Committed Prefix + Incremental Append** now. Future smoothing/stabilization may replace the final few points with a bounded mutable tail, but it must preserve the same invariant: once a prefix is stable, normal pointer updates never recalculate or rerasterize that stable prefix.

# Post-freeze Performance Correction — Raster Tile Canonical Paint State — 2026-09-01

**Status: AUTHORITATIVE / DESIGN CHANGE / SUPERSESSION.**

USER-01 physical-device verification found that retained GPU presentation removed ordinary full-history redraw, but stroke finalization, persistence and Undo/Redo still depended on the total committed stroke/dab log. This section corrects that architectural defect without changing brush appearance, editor UI, document dimensions, layer semantics or export behavior.

## Superseded rules

1. The Phase 4 **256px canonical tile edge** is superseded by a **128×128px canonical sparse Raster Tile** for the production paint state. The 2048px atlas-page contract remains unchanged; it therefore contains 16×16 canonical slots per page.
2. A committed stroke/dab list is no longer the canonical current image. Earlier M4 wording that permitted ordinary Undo/Redo or retained-scene recovery to replay all committed strokes is superseded.
3. The immediately preceding Incremental Baseline Paint correction remains authoritative for active-stroke GPU append, except that whole-history replay is no longer an allowed Undo/Redo path and GPU-device/surface recovery must prefer canonical Raster Tiles.

## Canonical state separation

- **Raster Tile State:** canonical current pixels, partitioned by raster layer and 128×128 tile coordinate; CPU/storage state is authoritative and GPU resources are derived.
- **Tile History:** one bounded transaction per edit, containing only affected tile identities and before/after tile states or content-addressed references.
- **Stroke/Event Log:** optional replay, timelapse, diagnostics and statistics data. Its absence must not prevent current-image reconstruction, Undo/Redo or device-loss recovery.

## Production invariants

1. Active brush input is rasterized incrementally into only the affected canonical tiles while the existing retained GPU scene receives only new dabs.
2. Finalization captures before state once per first-touched tile and emits after state only for the affected tiles. It must not scan, copy, clone or replay unrelated committed strokes.
3. Undo restores transaction before tiles; Redo restores transaction after tiles. Cost is proportional to affected tile count and bytes, not total stroke/dab count.
4. GPU retained textures, atlas pages and canvas surfaces are caches/presentation resources. Device loss reconstructs them from canonical tiles without requiring the Stroke/Event Log.
5. Autosave journals only changed tile content/references plus bounded metadata/history changes. Full-project checkpoints may be coalesced and asynchronous, but ordinary stroke finalization must not synchronously structured-clone the accumulated stroke log.
6. Tile-history memory is bounded. Content-addressed deduplication, compression and the existing OPFS history-spill mechanism are used for cold states; unlimited per-edit image duplication is prohibited.
7. Legacy stroke-based snapshots remain readable through a one-time replay-to-tiles migration. Once migrated, normal open, save, render and history operations use tile state rather than repeating legacy replay.
8. PNG/export flattening consumes canonical raster tiles for migrated/current data and retains the legacy replay path only as compatibility fallback.

## Complexity and verification target

New-stroke presentation/finalization is **O(new dabs + affected tiles)**. Undo/Redo is **O(affected tiles)**. Regression verification compares at least 100 and 1,000 pre-existing strokes and, where the development environment permits, 10,000; increasing unrelated history must not produce proportional finalize, Undo, Redo or autosave-scheduling growth.

## Change-control impact

This correction reopens only implementation verification for M3-012 tile geometry, M4-010 through M4-016 paint/history/persistence recovery, M6A-PERF-001 through M6A-PERF-004, and the related M10 device-loss/performance gates. Existing persisted stroke snapshots are not invalidated, but migration and compatibility tests are required before the corrected path is considered integrated. USER-01 remains incomplete until a newly published preview receives an explicit physical-device PASS from the user.

## Mobile full-editor target supersession — 2026-09-02

**Status: AUTHORITATIVE / SUPERSEDES THE PREVIOUS NARROW-SHELL RESTRICTION.**

This decision supersedes the earlier `Narrow shell — viewport width < 600 CSS px` rule that classified narrow phone-sized viewports as not being a full-production-editor target. It also supersedes any earlier wording that excludes Android phones, iPhones, or other phone-class devices from the normal single-illustration editing workflow solely because of viewport width or lack of the preferred GPU acceleration path.

1. **Phone-class devices are full editor targets.** Android smartphones and other supported phone-class mobile browsers are part of the full-production-editor target together with tablets and desktop-class devices. A phone-sized viewport must not be classified as editor-ineligible merely because it is narrower than 600 CSS px.
2. **Viewport width controls presentation, not functional eligibility.** The 600 CSS px boundary, if retained at all, is only a responsive-layout breakpoint. Narrow layouts may collapse, overlay, stack, temporarily hide, or progressively disclose tool groups and inspectors, but the adopted editing capability set must remain reachable.
3. **The ibisPaint-relevant single-illustration baseline applies on phones as well.** Required drawing, layer, selection, transform, history, persistence, import/export, correction, finishing, and related single-illustration capabilities are not optional merely because the device is a smartphone. Device-specific UI may differ while command semantics and document behavior remain shared.
4. **WebGPU remains preferred, not mandatory for editor availability.** WebGPU Worker and main-thread WebGPU remain the primary acceleration paths when usable, but failure to expose a usable adapter/device must not make the entire editor unavailable. Renderer capability must degrade through compatible backends while preserving canonical document correctness.
5. **Renderer choice is capability-based and replaceable.** Canonical Raster Tile state, command/history state, persistence, recovery, and file/export semantics are backend-independent. Render backends are acceleration/presentation implementations and may be selected or replaced at runtime according to device capability.
6. **Lower-capability devices may receive adaptive resource policies, not silent feature removal.** Cache sizes, batch sizes, worker use, preview quality, temporary resolution, memory budgets, and admission limits may adapt to measured device capability. Final/canonical results and required editor semantics remain correct; any unavoidable hard platform limit must be explicit and narrowly scoped rather than represented as a blanket phone exclusion.
7. **GPU/API failure must have a functional compatibility path.** A device where `navigator.gpu` exists but `requestAdapter()` returns no adapter is a supported compatibility case, not an application-fatal state. The production renderer architecture must provide an appropriate fallback rather than exposing `renderer ... unavailable` as the normal outcome.
8. **Responsive UX remains Canvas First.** Narrow screens should protect drawing space through contextual UI, progressive disclosure, sheets/overlays, and direct manipulation rather than by creating a separate reduced-capability phone product.

### Supersession note

The previous statement:

> `Narrow shell — viewport width < 600 CSS px` is not a full-production-editor target for the initial release.

is **SUPERSEDED** by this section. Existing implementation/tests that still encode `<600 CSS px => full editor ineligible` are legacy constraints and must be updated in the dedicated compatibility remediation steps; this design decision by itself does not falsely mark those implementation changes complete.

### Evidence motivating the supersession

The USER-01 phone diagnostics on build `da2a9c5fd42582c8131ea4694877c8920d075c8f` showed WebGPU API exposure on both main and worker contexts while adapter acquisition returned `adapter-unavailable`; the Render Worker consequently reported device state `unavailable`. This confirms that phone support cannot be defined as "WebGPU adapter available or no editor" and must use capability-based renderer fallback.


## Phone touch and narrow-editor UX supersession — 2026-09-02

**Status: AUTHORITATIVE / DESIGN CHANGE / SUPERSESSION**

This section supersedes the earlier P2-6 / FG-1 single-finger Touch=Pan default only for the phone-class narrow full-editor presentation. Tablet/desktop Pen-first behavior remains unchanged.

1. On a phone-class narrow full-editor surface with coarse primary pointing, one-finger canvas contact targets the active drawing-capable tool by default when no Pen transaction is active.
2. Arrival of a second Touch atomically cancels the provisional one-finger drawing transaction before that gesture changes ownership to canvas navigation. A navigation gesture must never leave a partial committed stroke behind.
3. Once a gesture owns two or more Touch contacts, those contacts are navigation-only until the Touch transaction fully ends. Two-finger drag/pinch/twist maps to Pan/Zoom/Rotate through the existing viewport transform.
4. Pen contact and recent-Pen palm rejection continue to outrank finger drawing. Wider Pen-capable tablet/desktop surfaces may keep Finger Drawing disabled by default.
5. Tool-facing compatibility adaptation may translate Touch metadata at the input boundary while the existing paint/history persistence schema is retained; canonical Raster Tile state, Tile History, persistence, Undo/Redo and export remain unchanged.
6. Phone UI follows Canvas First: a compact top command surface, a persistent bottom action strip for current drawing state and frequent actions, and Inspector content exposed as a dismissible sheet rather than being hidden solely because of viewport width.
7. Required phone controls use at least 44 CSS px interactive targets and respect safe-area insets. Width reduction may collapse or overlay controls but must not silently remove required functions.
8. This is a responsive interaction specialization, not a separate reduced-feature phone application.

## USER-01 physical-device change log and verification guardrails — 2026-09-02

**Status: AUTHORITATIVE / USER-TEST EVIDENCE / IMPLEMENTATION GUARDRAIL.**

This section records product and architecture corrections established during USER-01 smartphone physical-device testing. It must be read together with the authoritative `Mobile full-editor target supersession` and `Phone touch and narrow-editor UX supersession` sections. Later implementation must not silently regress these decisions.

1. **Phone full editor remains mandatory.** Phone-class devices are full editor targets. Viewport width and preferred GPU availability may alter presentation or acceleration policy, but may not remove adopted single-illustration editing capabilities.
2. **Phone touch ownership is fixed by physical testing.** On the phone narrow editor, one Touch draws with the active drawing-capable tool; multi-touch owns canvas navigation. Arrival of a second Touch cancels the provisional one-finger stroke before navigation takes ownership so no partial stroke is committed accidentally.
3. **Phone Canvas First shell is required.** Frequent actions must remain reachable from the narrow editor, Layers must remain accessible through a sheet/overlay rather than disappearing, safe-area insets must be honored, and required touch targets use at least 44 CSS px effective target size.
4. **WebGPU remains the preferred accelerator, never the sole editor-admission condition.** WebGPU Worker, then main-thread WebGPU, remain preferred whenever usable. `navigator.gpu` with `requestAdapter() == null` is a supported compatibility case. Compatibility presentation must preserve the same canonical Raster Tiles, Tile History, persistence, recovery and export semantics.
5. **USER-01 smartphone performance evidence is scoped.** Physical testing explicitly accepted the current drawing, canvas-navigation and stroke-finalization lightness. This is a performance-only PASS; it does not by itself complete USER-01 or any unrelated functional check.
6. **Visible required phone commands must remain actionable.** USER-01 exposed that the visible mobile PNG Export action could become untappable because a derived availability flag and initial `disabled` state jointly locked it. A required phone command must not be made non-interactive solely because a derived or stale availability signal says `unavailable`. Mobile PNG Export may be temporarily disabled while an export is actually in flight. If no document is ready, tapping the visible action must produce explicit unavailable/not-ready feedback instead of silently doing nothing.
7. **PNG Export has one production command path.** Desktop Export, File-menu Export and phone Export invoke the same production export handler directly. Hidden-button forwarding and duplicate controller ownership of the same export command are prohibited. PNG flattening continues to consume canonical Composite Raster Tiles rather than replaying the Stroke/Event Log.
8. **USER-* truth comes only from explicit user evidence.** CI, unit tests, integration tests, build checks, bots and implementation completion may close internal implementation/check items, but must never mark a `USER-*` gate PASS. A `USER-*` item becomes complete only after explicit user confirmation. A later contradictory physical-device report reopens the affected USER-* gate even if an automation previously marked it complete.
9. **USER-01 state at this correction.** Smartphone new-document creation, one-finger drawing and performance/lightness have explicit user PASS. Undo/Redo, persistence across reload and PNG Export do not yet have explicit user PASS in the current verification cycle. Therefore USER-01 remains open until those remaining checks are explicitly accepted by the user.

### USER-01 final physical-device verification closure — 2026-09-02

**Status: USER-VERIFIED / CLOSED.** The user explicitly confirmed that the remaining smartphone checks all passed: Undo/Redo, persistence/recovery after reload, and PNG Export. Combined with the previously explicit PASS for new-document creation, one-finger drawing, and drawing/navigation/finalization performance, USER-01 is complete. This closure records user evidence only; it does not repeat or supersede already completed implementation/CI work.


### M5C canonical Raster Mask / clipping compositor semantics — 2026-09-02

- Canonical Raster Layer compositing applies every enabled Raster Mask multiplicatively to source alpha before blend-mode evaluation and source-over composition. Disabled masks do not affect coverage; mask inversion is applied to effective coverage.
- Raster Mask sparse tiles remain content-addressed persistence payloads in the document model. Rendering hydrates their immutable RGBA8 coverage payloads on demand through the persistence port and keeps a bounded 128-tile session LRU-style cache; mask bytes are not duplicated into the document schema or history snapshot.
- Independent affine Raster Mask transforms are evaluated by inverse document-to-mask sampling. The current M5C raster compositor rejects unsupported non-affine mask transforms rather than silently producing incorrect output.
- Mask feather/blur remain non-destructive coverage effects. The M5C canonical CPU/fallback path uses a bounded 5×5 binomial Gaussian approximation with combined radial variance so work per output pixel is independent of an arbitrarily large configured radius; a future WebGPU separable implementation may replace this kernel only if it preserves the same visible semantics within verified tolerance.
- Raster clipping uses the referenced base Raster Layer's effective alpha after its own visibility, opacity, Raster Masks and upstream clipping. Clipping chains are recursive and cycle-checked. A hidden/excluded base contributes zero clipping coverage. Draft exclusion therefore also excludes a Draft layer when it is used as the clipping base of final output.
- M5C's mask/clipping integration is the canonical currently-renderable Raster Layer path. Enabled Vector/Effect masks or clipping bases that are not configured root Raster Layers fail explicitly until their own canonical renderers are integrated; they are never silently ignored.


#### M5D named-palette semantic boundary — 2026-09-02

- M5D-008 through M5D-015 implement editable **workspace/user named palettes** without changing the canonical native document schema. Palette creation, rename, deletion, active-palette selection, palette ordering and per-palette color ordering persist through the existing local color-workspace state.
- Palette colors use the same canonical `RgbUnitColorV1` encoded-component representation as current/previous/history. Applying a swatch enters the normal current-color commit path, so subsequent baseline painting captures exactly the palette-selected encoded RGB value.
- Palette file interchange uses versioned JSON `illustro.palette-bundle/1` with `encoding: encoded-rgb-unit`, source `workingSpace` metadata and one or more named palettes. Import validates structure/ranges, preserves palette order, and resolves ID collisions without overwriting existing palettes. Export writes the complete named-palette workspace as normal JSON file interchange. QR-code palette sharing remains explicitly excluded.
- Until M5D-021 through M5D-025 are complete, palette import **does not claim profile conversion**. If source and active document working spaces differ, encoded component values remain intact and the UI reports that profile-aware conversion is deferred to the later color-management stage.
- Palette controls are placed under compact progressive disclosure inside the Color block so the existing selector/current/history hierarchy remains primary. The visual implementation was checked against canonical visual reference `ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png`, whose materialized bytes matched SHA-256 `32a6cb3991c9baa5b5e097943ce0550a3968d2dcde1be68e132f30ce03341a13` before this UI change.


## Unified touch drawing ownership supersession — 2026-09-02

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



#### M5D eyedropper sampling semantic boundary — 2026-09-02

- M5D-016 through M5D-019 add a production-connected Eyedropper without creating a parallel input stack. Eyedropper ownership is evaluated after Pointer Arbitration and before Mask Paint / normal Paint ingestion, so a consumed sampling transaction cannot simultaneously create or finalize a paint stroke.
- Explicit Eyedropper mode and quick Eyedropper (`Alt` / `Option` while held) use the same pointer-transaction ownership state. Once sampling owns a pointer-down transaction it retains that pointer until up/cancel; a cancellation restores the pre-sampling color and does not commit color history. This allows the existing second-Touch cancellation path to transfer ownership to multi-touch navigation atomically.
- `active-layer` sampling reads the canonical sparse Raster Tile state for the active layer only. A fully transparent active-layer pixel produces no color sample. `merged-canvas` sampling reads the canonical compositor output after visibility, layer opacity, blend modes, masks and clipping; the document's solid canvas background is composited for the sampled display color when present.
- Sampling supports both canonical `rgba8-unorm` and `rgba16-float` tile precision through one exported canonical raster-pixel reader. A per-gesture tile-coordinate index is built once so pointer-move sampling does not linearly rescan all sparse tiles on every sample.
- Sampled RGB components remain encoded values in the active document working space. M5D-016 through M5D-019 do **not** claim sRGB/Display-P3 conversion or ICC/profile conversion; those semantics remain assigned to M5D-021 through M5D-025.
- Reference-image sampling remains intentionally separate as M5D-020 and must not be marked complete until the Reference/Sub View resource path is production-connected.



#### M5D reference-image sampling production boundary — 2026-09-02

- M5D-020 is production-connected through a real Reference / Sub View block rather than a dead sampler helper. Users can import multiple local image references, switch the active reference, remove references, zoom, rotate/reset the reference view, and tap/click the visible reference image to commit its sampled color into the same canonical Color Workspace current/previous/history path used by canvas Eyedropper and painting.
- Reference source bytes are stored once in the existing OPFS SHA-256 immutable-object store. Workspace reference metadata persists separately as `illustro.reference-workspace/1` and carries a real `ResourceV1(kind = reference-image)` record with content hash, MIME type, dimensions and user-import provenance. Switching/reloading reads bytes back by content hash; object URLs or transient DOM handles are never the persisted source of truth.
- The Reference workspace is user/workspace presentation state in M5D-020 and therefore does not create document Undo entries merely for zoom/rotation/switching. Reference bytes remain compatible with the canonical Resource schema so later project/native-format Reference/Sub View integration does not require inventing an incompatible asset representation.
- At most one active decoded `ImageBitmap` is retained by this initial Reference panel controller; switching or disposing closes the previous bitmap. This prevents multiple large reference images from being eagerly decoded into resident memory merely because their metadata remains in the workspace list.
- Reference sampling maps the visible transformed view point back to the source image pixel and samples a one-pixel scratch surface, avoiding a permanent full-size CPU `ImageData` copy. Transparent pixels do not change the current color.
- M5D-020 deliberately labels imported reference color space as unresolved (`none`) and requests decode without browser-side color-space conversion where the platform supports `createImageBitmap` options. The sampled component values are treated as decoded encoded RGB values only. **No ICC/profile-aware conversion claim is made here**; sRGB, Display-P3, metadata, conversion and preview-boundary semantics remain M5D-021 through M5D-025.


#### M5D color-management semantic boundary — 2026-09-02

- M5D-021 through M5D-025 centralize RGB color-management rather than changing the existing canonical encoded-component storage model. Canonical document/palette/paint RGB remains encoded in the active working space; color conversion occurs only at an explicit source-profile, document-conversion, import/export or presentation boundary.
- The supported built-in document profiles are sRGB and Display-P3, both D65 with the standard sRGB-style transfer curve. Conversion decodes transfer values, converts through linear-light XYZ D65 using fixed standard RGB matrices, converts to the target primaries, re-encodes, and applies an explicit `clip` gamut policy at the current bounded RGB UI/canonical boundary.
- `DocumentColorSpec` now carries additive built-in profile metadata (`builtin-rgb`, working-space identity, D65 white point and sRGB transfer). Legacy v1 snapshots without this additive field resolve the same profile deterministically from their existing `workingSpace`, so this M5D change does not invalidate prior persisted projects.
- Profile-aware input conversion additionally supports ordinary RGB ICC matrix/TRC profiles using ICC `rXYZ/gXYZ/bXYZ` plus `rTRC/gTRC/bTRC`, with both `curveType` and ICC parametric curve function types 0–4. ICC PCS XYZ D50 values are Bradford-adapted to D65 before conversion into the supported document space. Non-RGB, non-XYZ-PCS, LUT-only or otherwise unsupported ICC profiles fail explicitly and are never silently treated as sRGB.
- Palette bundles already identify their source working space; a mismatched sRGB/Display-P3 palette import now performs the centralized profile-aware conversion before entering Color Workspace state instead of preserving mismatched encoded components.
- WebGPU presentation explicitly requests the document color space in `GPUCanvasContext.configure`. If a Display-P3 WebGPU presentation boundary cannot be configured, Illustro uses the backend-independent canonical Raster Tiles and hands presentation to the Canvas2D compatibility backend rather than displaying P3 numbers as sRGB.
- Canvas2D compatibility presentation requests matching `CanvasRenderingContext2D` / `ImageData` color space when available. If only sRGB presentation is available for a Display-P3 document, tile pixels and provisional dab colors are converted from Display-P3 to sRGB at the presentation boundary; canonical tiles remain unchanged.
- Illustro's color-management responsibility ends at correctly defined/tagged web-canvas output. Physical display calibration, active monitor ICC/LUT state and final device characterization remain owned by the browser/OS/display stack under FC-4.
- The matrix/TRC ICC implementation is an independent implementation of the ICC profile-format semantics, guided by ICC.1:2022 and the public ICC parametric-curve definitions; no third-party source code is incorporated.


#### M5D Color Mixing Palette semantic boundary — 2026-09-02

- M5D-026 provides a reachable **Color Mixing Palette** inside the existing Color inspector through progressive disclosure. It is a dedicated digital mixing workspace inspired by established illustration-editor workflows: Brush lays down the current Color Workspace color, Blend locally mixes colors already on the mixing surface, and Eyedropper commits a sampled mixing-surface color through the same canonical current/previous/history path used by the normal color picker.
- The mixing surface is **workspace/presentation state, not document or layer image state**. Painting, blending, clearing and mixer Undo/Redo never create document history transactions, mutate canonical Raster Tiles, alter layer data or participate in PNG/native output. Mixer Undo/Redo is separately bounded to 12 snapshots so repeated experimentation cannot grow without bound.
- The initial canonical mixer surface is a compact opaque RGBA8 encoded-RGB buffer. Brush and Blend touch only their bounded brush footprints; ordinary pointer movement never scans or rerenders the document. Blend uses a bounded local neighborhood average plus soft dab application rather than a full-surface blur, keeping work proportional to the local tool footprint.
- Mixer interpolation is performed through the shared sRGB-style transfer decode/encode used by the current sRGB and Display-P3 document spaces. This is a **digital color-mixing helper**, not a physical pigment/Kubelka-Munk simulation; no claim of real-media spectral mixing is made.
- Mixer pixels are interpreted in the active document working space. Switching between sRGB and Display-P3 converts the small mixing buffer through the centralized M5D profile-aware conversion service and clears mixer-local history. The Color UI canvas remains an sRGB presentation surface in this implementation, so Display-P3 mixer pixels are converted only for presentation; the mixer's canonical encoded values are not silently reinterpreted.
- Pointer Events provide direct manipulation for mouse, Pen and Touch. A canceled pointer gesture restores its pre-gesture mixer snapshot and creates no mixer-history entry. Coarse-pointer buttons preserve the adopted 44 CSS px touch target minimum.
- The compact quick-color row is derived from current color, previous color and the active named palette. It creates no second palette database and therefore preserves the M5D-008 through M5D-015 named-palette semantic boundary.

#### M5D intermediate / approximate color helper semantic boundary — 2026-09-02

- M5D-027 adds a production-connected color-candidate helper inside the existing Color block. It does not create a second drawing-color state: selecting a candidate commits through the existing Color Workspace current/previous/history path and therefore immediately becomes the canonical paint color.
- Intermediate Color follows the established four-corner palette interaction used by mature painting software: the user registers the current drawing color into any of four corner swatches, and Illustro generates a bounded 9×9 bilinear grid from those four encoded RGB corner values. The interpolation is intentionally performed in the active document's encoded RGB working space so the result remains compatible with the canonical Color Workspace representation.
- Approximate Color is centered on the current drawing color and exposes independent horizontal/vertical axes chosen from Hue, Saturation, Value, Lightness, Red, Green and Blue. The current color is always the center cell. Axis variation is bounded and clamped; Hue wraps, HSV axes preserve the remaining HSV components, Lightness uses an HSL-style lightness transform, and RGB axes adjust only their encoded component.
- Dense candidate grids are canvas-rendered rather than represented as dozens of persistent DOM nodes. This keeps Color Wheel/entry interactions lightweight and avoids adding an avoidable layout/GC hot path. The helper only redraws its candidate grid while its progressive-disclosure panel is open.
- If the active document working space changes between sRGB and Display-P3, registered intermediate corner colors are profile-aware converted through the centralized M5D color-management path before further interpolation. Candidate selection itself remains in the active document working space.
- The behavior is an independent implementation informed by the public CLIP STUDIO PAINT Intermediate Color and Approximate Color palette interaction model; no third-party source code or assets are incorporated.

### 2026-09-02 — M5D Color Match implementation boundary

- Color Match is an explicit document/layer task, not a persistent rail tool. Its initial production source is the active Sub View/reference image and its target is the active editable Raster Layer.
- Reference pixels are decoded locally, treated as the reference-workspace sRGB baseline, and converted through the existing Color Management path into the active document working space before statistics are computed. No cloud or generative-AI dependency is used.
- The deterministic baseline uses alpha-weighted per-channel first/second moments (mean and standard deviation), with a bounded contrast-ratio transfer to avoid pathological amplification. This follows the classical statistical color-transfer family (Reinhard et al., 2001, DOI 10.1109/38.946629) as an algorithmic reference; no external implementation source code is copied.
- Preview preparation reads canonical Raster Tiles and keeps transformed bytes in memory only. Strength changes recompute the in-memory preview. Cancel creates no document mutation and no History transaction.
- Apply persists the prepared Raster Tiles, then commits exactly one `color.match` History transaction through the existing snapshot/history/persistence path. Existing layer identity/properties are preserved; pending compatible stroke content is materialized through the existing Rasterize path when required.


### 2026-09-02 — M6A Raster Brush production boundary

- M6A starts by promoting the already-proven incremental M4 raster dab path behind an explicit Canonical Brush Engine facade rather than replacing its deterministic low-level raster kernel.
- The production stroke record carries an explicit `brushMode`; legacy M4/M5 snapshots without that field normalize to `raster`, preserving recovery compatibility while creating the extension boundary for Eraser, Smudge/Finger and Blur modes.
- Raster Brush sends only newly confirmed samples into the incremental dab kernel. Its current mutable stabilization tail is zero, so all emitted raster dabs immediately become stable-prefix work; stable-prefix reprocessing is instrumented explicitly and must remain zero on the ordinary path.
- This M6A-001 promotion does not by itself close M6A-PERF-001〜004. Those gates remain separate and require renderer/transfer counters plus the authoritative long-stroke scaling workload before being marked complete.


### 2026-09-02 — M6A Eraser compositing semantics

- Canonical Eraser is an alpha-removal operation on the targeted Raster Layer, never a white-paint approximation.
- Eraser shares Raster Brush geometry/spacing and the incremental confirmed-sample path, but its canonical pixel operation reduces destination alpha by brush coverage while preserving surviving RGB values.
- Because the visible retained scene is a composite of multiple layers, erasing the flattened presentation directly is incorrect: it would punch through lower layers. Eraser therefore mutates only the active layer's canonical Raster Tiles and recomposites/presents only affected tile coordinates so lower layers are revealed correctly.
- Erasing an already-transparent/unallocated tile is a no-op and must not allocate a canonical tile or history payload.
