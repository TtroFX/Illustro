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
10. Illustro is a **single-illustration-focused painting application**. Its functional baseline is all ibisPaint functionality that is relevant to producing a single illustration, rather than comic/page-production or content-distribution workflows.
11. Functional scope is not considered complete at a minimal/basic editor milestone. After reaching the ibisPaint single-illustration baseline, Illustro will additionally adopt useful painting/productivity capabilities from CLIP STUDIO PAINT and other paid or free creative applications when they materially improve a single-illustration workflow.
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

> **All ibisPaint capabilities that materially participate in a single-illustration workflow.**

This baseline is intentionally workflow-scoped rather than brand-clone-scoped. The purpose is to achieve comparable practical capability for drawing, painting, editing, layer work, color work, selection/transform, correction, finishing, file handling, and other operations used to complete one illustration.

### Additional feature target

After the ibisPaint single-illustration baseline is covered, evaluate and adopt useful features from **CLIP STUDIO PAINT and other paid or free painting/creative applications**. A feature is a candidate when it materially improves one or more of the following:

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
- other features whose primary purpose is not the creation of a single illustration

A reference application may still contain an individual capability inside one of these broader areas that is useful for single-illustration work; such a capability may be adopted separately by explicit decision.

### Feature-inventory rule

Before declaring implementation complete, maintain a structured feature inventory in this canonical memo that maps reference capabilities to one of:

- **ADOPTED — IMPLEMENTED / VERIFIED**
- **ADOPTED — NOT YET IMPLEMENTED**
- **EXCLUDED — OUTSIDE SINGLE-ILLUSTRATION SCOPE**
- **SUPERSEDED — REPLACED BY A BETTER ILLUSTRO WORKFLOW**

No reference feature may disappear from the audit simply because Illustro uses a different UI or terminology.

### Functional completion gate

The functional implementation phase is complete only when:

1. the current ibisPaint single-illustration-relevant feature set has been audited against the Illustro inventory;
2. every adopted baseline capability is implemented and verified;
3. selected high-value capabilities from CLIP STUDIO PAINT and other relevant paid/free applications are implemented and verified;
4. exclusions are explicit and consistent with the single-illustration product focus;
5. no known required feature remains merely planned, stubbed, UI-only, or disconnected from the production path.

This gate defines **feature completeness**. Performance, reliability, visual fidelity, compatibility, testing, and release-readiness retain their own gates and are not automatically satisfied merely because feature coverage is complete.

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

### Right-side UI / inspector area

- The right side should behave more like a professional illustration application's inspector stack, broadly comparable in information architecture to CLIP STUDIO-style side panels while retaining Illustro's own visual identity.
- Panels such as Layers, Color, Brush Presets, Brush Settings, Navigator, Materials/Sub View, etc. may live in this region as the functional specification is finalized.
- The region should support clear sectioning and compact information density; it must not become a series of oversized playful cards.
- Panel headers, selected tabs, active layers, and key values can use strong accent colors, while panel bodies remain predominantly white/light-neutral.
- The right inspector is independent from the canvas, with a clear vertical boundary and its own scrolling behavior.

### Canvas upper-right controls

- Do **not** place the previously generated floating group of utility buttons in the canvas upper-right corner as part of the target layout.
- Canvas-space controls should be kept minimal. Commands that belong to panels/application UI should live outside the canvas rather than floating over the artwork.
- Any future canvas-overlay control must be justified by a direct canvas interaction need and specified explicitly before inclusion.

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

Adaptation must preserve document correctness and visual semantics; performance tiers may reduce cache or preview cost, not silently change final artwork output.

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
- **WebCodecs** is the preferred browser-native acceleration path when implementing timelapse/video encoding or decoding that benefits from it, with capability detection rather than unconditional dependency.
- **CompressionStream** may be used for compatible metadata, logs, journals, or auxiliary streams. Image-tile compression/storage codecs are to be chosen separately from benchmarks and quality/storage requirements rather than assuming gzip/deflate is optimal for pixel tiles.

# Testing / Completion Gates

_Not yet defined beyond the functional-completion gate above._

# Implementation Roadmap

The detailed implementation stages are not yet defined. However, feature planning and implementation must use the functional-scope/completion definition above as the terminal feature-coverage gate rather than stopping at a smaller MVP/basic-editor milestone.

# Proposals under consideration

_None are authoritative yet beyond the provisional UI visual target and confirmed decisions above._

# Open questions

- Product definition and target user beyond the confirmed single-illustration focus
- Exact minimum supported device/browser matrix and compatibility tiers
- Exact audited feature inventory and Illustro grouping/terminology
- Exact set of additional CLIP STUDIO PAINT / other-app convenience features to adopt after the ibisPaint baseline audit
- Exact editor information architecture and panel inventory
- Exact left-toolbar tool inventory/order
- Exact right-inspector tabs/panels and fixed-bottom controls
- Responsive behavior for narrower tablets/phones
- Document data model
- Brush engine semantics, brush-asset schema, and preset representation
- Layer model
- Undo/Redo command model, snapshot/delta strategy, and spill thresholds
- Tile dimensions, seam/border policy, cache budgets, and numeric performance targets
- Default color precision/document color modes and exact wide-gamut conversion policy
- `.illustro` file format
- Exact import/export format scope
- Release criteria

# Change log

- 2026-08-30: Created the design memo and recorded the clean-sheet rebuild decision.
- 2026-08-30: Adopted the latest generated editor mockup as the provisional visual completion target and documented its visual language, left/right workspace structure, removal of canvas upper-right floating controls, and fixed-bottom behavior for the right-side inspector toolbar.
- 2026-08-30: Promoted this file from a design-only memo to the **single canonical master specification** for all Illustro product, UX, technical, data, performance, testing, roadmap, and release decisions.
- 2026-08-30: Preserved the latest approved generated UI image as `ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png` on Google Drive and pinned its exact file ID, dimensions, URL, and SHA-256 here so implementation can inspect the same visual target directly.
- 2026-08-30: Defined the functional-completion policy: ibisPaint's single-illustration-relevant capabilities form the baseline; selected high-value CLIP STUDIO PAINT and other paid/free-app capabilities extend it; comic/page-production and built-in material/content-library workflows are outside the required scope; feature completeness requires an explicit audited inventory with implemented/verified or intentionally excluded status.
- 2026-08-30: Defined the initial production technical architecture: Web/PWA + WebGPU-first rendering/compute; Dedicated Workers; SharedArrayBuffer/Atomics with cross-origin isolation; Transferables; OPFS/SyncAccessHandle; Web Locks/BroadcastChannel; sparse tiled canvas; progressive pen-input enhancements; capability-adaptive GPU/performance policy; sRGB/Display-P3 and 8-bit/16F-ready color architecture; WASM optimization hooks; persistent-storage/quota handling; device-loss recovery; and explicit import/export compatibility principles.