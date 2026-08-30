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

_Not yet defined._

# Rendering / Brush / Performance

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
- Tile dimensions, border/seam strategy, dirty-region representation, eviction policy, and exact memory budgets are to be selected by benchmark and visual correctness testing rather than fixed prematurely.
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
- Architecture must support both **RGBA8-class** and **RGBA16F-class** render/intermediate targets. The default document precision and exact storage encoding remain to be selected from memory/performance/quality tests.
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
- Autosave and recovery are first-class persistence behaviors. Exact checkpoint cadence, journal format, tile-delta representation, and Undo spill format remain to be specified.

### Storage durability and quota

- Request persistent storage with `navigator.storage.persist()` where supported and record/check the result; persistence permission is an optimization to durability, not a guarantee the application may assume blindly.
- Use `navigator.storage.persisted()` and `navigator.storage.estimate()` to monitor persistence state, usage, and quota.
- Surface actionable storage-pressure warnings before the application reaches a condition where continued editing is unsafe.
- OPFS is browser-managed working storage, not a substitute for an explicit user-controlled backup/export. The future `.illustro` exchange/archive format must allow projects to be exported outside origin storage.

### Project ownership

- Acquire a named **Web Lock per writable project** before entering writable mode.
- If another context owns the write lock, the second context must not independently autosave over the same project. Read-only/open-elsewhere UX can be designed separately.
- Broadcast save/open/ownership state through BroadcastChannel where useful.

# Import / Export / Compatibility

## Compatibility principles — 2026-08-30

- Core project editing uses the internal OPFS working model; external files enter and leave through explicit import/export flows.
- The exact public `.illustro` container/manifest/tile/history format is not yet defined, but it must be independent of live GPU resources and suitable for backup/exchange/migration.
- OS/PWA file association may be added as progressive enhancement on platforms that support it; the application must not require file association for normal import/export.
- External linked-object acceleration may be used when a platform provides a persistent file handle, but `.illustro` correctness/round-trip preservation must rely on embedded/internal project state rather than assuming permanent external-file permission.
- **WebCodecs** is the preferred browser-native acceleration path when implementing timelapse/video encoding or decoding that benefits from it, with capability detection rather than unconditional dependency.
- **CompressionStream** may be used for compatible metadata, logs, journals, or auxiliary streams. Image-tile compression/storage codecs are to be chosen separately from benchmarks and quality/storage requirements rather than assuming gzip/deflate is optimal for pixel tiles.

# Testing / Completion Gates

_Not yet defined beyond the functional-completion gate above._

# Implementation Roadmap

The detailed implementation stages are not yet defined. However, feature planning and implementation must use the functional-scope/completion definition above as the terminal feature-coverage gate rather than stopping at a smaller MVP/basic-editor milestone.

# Proposals under consideration

_None are authoritative yet beyond the provisional UI visual target and confirmed decisions above._

# Open questions

- Exact editor information architecture and panel inventory
- Exact left-toolbar tool inventory/order
- Exact right-inspector tabs/panels and fixed-bottom controls
- Document data model
- Brush-asset schema details and versioned preset representation beneath the adopted canonical brush capabilities
- Layer model implementation details beyond the adopted Lineart Group semantics
- Undo/Redo command model, snapshot/delta strategy, and spill thresholds
- Tile dimensions, seam/border policy, cache budgets, and numeric performance targets
- Default color precision/document color modes and exact wide-gamut conversion policy
- `.illustro` file format details
- Exact final import/export compatibility contracts and fidelity matrices, including adopted PSD and deferred CMYK boundaries
- Exact third-party-code/provenance record format and project-level software license
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
- CMYK/print-output scope and advanced print rendering-intent UI remain governed by the separate pending-adoption decision and are not implied by this RGB closure.

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
