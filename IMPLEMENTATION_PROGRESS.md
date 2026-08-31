注意事項: 実装・修正・進捗更新を行う前に必ず `ILLUSTRO_DESIGN_MEMO.md` の該当仕様・後続のAUTHORITATIVE/CLOSED/SUPERSEDED記述を確認すること。UI・UX・Visual・Icon・Motionを扱う場合は文章だけで判断せず、同メモで指定された該当画像・canonical visual reference（特に `ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png` と採用済みapp icon）を実際に参照し、SHA/指定対象を確認してから実装すること。コードやテスト結果が設計図メモを黙って上書きしてはならない。各項目は成立した時点で `未完了` を `完了` に変更する。内部検査項目は検査PASS時のみ完了、ユーザー確認項目はユーザーから明示的なPASSが出た場合のみ完了とする。

# Illustro Implementation Progress

Design baseline: `IMPLEMENTATION READY — DESIGN FREEZE` / 2026-08-30
Canonical specification: `ILLUSTRO_DESIGN_MEMO.md`
Status values: `未完了` / `完了`

## M0 — Repository / Build / Engineering Foundation
M0-001 Web/PWAプロジェクト初期化:完了
M0-002 TypeScript構成:完了
M0-003 production build構成:完了
M0-004 development build構成:完了
M0-005 WebGPU build path:完了
M0-006 WGSL shader asset pipeline:完了
M0-007 Dedicated Worker build構成:完了
M0-008 Storage Worker build構成:完了
M0-009 Service Worker基盤:完了
M0-010 PWA manifest基盤:完了
M0-011 static asset管理構造:完了
M0-012 environment/runtime configuration基盤:完了
M0-013 capability情報取得基盤:完了
M0-014 structured logging基盤:完了
M0-015 diagnostics基盤:完了
M0-016 performance instrumentation基盤:完了
M0-017 fixture/golden-data配置構造:完了
M0-018 benchmark harness基盤:完了
M0-019 build identity/commit SHA埋め込み:完了
M0-020 formatting構成:完了
M0-021 lint構成:完了
M0-022 typecheck構成:完了
M0-023 unit test runner構成:完了
M0-024 integration test runner構成:完了
M0-025 CI基盤:完了
M0-026 dependency lock構成:完了
M0-027 Apache-2.0 LICENSE生成配置基盤:完了
M0-028 NOTICE生成基盤:完了
M0-029 third-party provenance manifest基盤:完了
M0-030 third-party license bundle生成基盤:完了
M0-031 CycloneDX SBOM生成基盤:完了
M0-032 offline Open Source Licensesデータ生成基盤:完了
M0-033 minimal application shell:完了
M0-034 clean checkoutからreproducible build可能化:完了
M0-検査 M0内部検査:完了

## M0.5 — Public Preview / Deployment Foundation
M0.5-001 HTTPS deployment基盤:完了
M0.5-002 Production deployment target作成:完了
M0.5-003 Preview deployment target作成:完了
M0.5-004 main branchからProduction自動更新:完了
M0.5-005 branch/commit Preview deployment:完了
M0.5-006 Preview URL固定導線:完了
M0.5-007 COOP header構成:完了
M0.5-008 COEP header構成:完了
M0.5-009 cross-origin isolation対応asset配信:完了
M0.5-010 critical asset self-hosting:完了
M0.5-011 公開版build SHA表示:完了
M0.5-012 公開版diagnostics入口:完了
M0.5-013 secure-context runtime確認導線:完了
M0.5-014 PreviewからPWA manifest取得可能化:完了
M0.5-検査 M0.5公開基盤内部検査:完了

## M1 — Canonical Contracts / Data / Command Registry
M1-001 Document ID:完了
M1-002 Layer ID:完了
M1-003 Resource ID:完了
M1-004 Object ID:完了
M1-005 Node ID:完了
M1-006 revision model:完了
M1-007 DocumentV1:完了
M1-008 CanvasSpec:完了
M1-009 document color metadata:完了
M1-010 document precision metadata:完了
M1-011 resolution/DPI metadata:完了
M1-012 project metadata state:完了
M1-013 workspace/session state store:完了
M1-014 derived/cache state boundary:完了
M1-015 common Layer base schema:完了
M1-016 Raster Layer schema:完了
M1-017 Folder Layer schema:完了
M1-018 Vector/Shape Layer schema:完了
M1-019 Adjustment Layer schema:完了
M1-020 Fill Layer schema:完了
M1-021 Gradient Layer schema:完了
M1-022 Mask schema:完了
M1-023 Linked Object schema:完了
M1-024 Lineart Group schema:完了
M1-025 Lineart Boundary schema:完了
M1-026 Reference Layer metadata schema:完了
M1-027 Draft/Sketch Layer metadata schema:完了
M1-028 Brush schema/version identifiers:完了
M1-029 Resource provenance schema:完了
M1-030 canonical Command Registry:完了
M1-031 command ID contract:完了
M1-032 command parameter schema:完了
M1-033 command context/availability model:完了
M1-034 command transaction identity:完了
M1-035 command enable/disable semantics:完了
M1-036 serialization primitives:完了
M1-037 deserialization primitives:完了
M1-038 schema validation:完了
M1-039 version handling:完了
M1-040 migration framework:完了
M1-041 structured compatibility report:完了
M1-042 structured fidelity report:完了
M1-043 structured error record:完了
M1-044 runtime capability-profile model:完了
M1-045 workspace-state schema:完了
M1-046 user-settings schema:完了
M1-047 locale-neutral internal ID policy:完了
M1-検査 M1内部検査:完了

## M2 — Persistence / History / Recovery / Local Project State
M2-001 OPFS project root:完了
M2-002 project directory layout:完了
M2-003 immutable object storage:完了
M2-004 SHA-256 content-addressed asset storage:完了
M2-005 stable entity ID + revision storage:完了
M2-006 Storage Worker:完了
M2-007 FileSystemSyncAccessHandle access layer:完了
M2-008 transactional project write:完了
M2-009 framed journal format:完了
M2-010 journal append:完了
M2-011 journal integrity/checksum metadata:完了
M2-012 checkpoint format:完了
M2-013 checkpoint publication:完了
M2-014 dual-head recovery state:完了
M2-015 autosave scheduler:完了
M2-016 recovery flush scheduler:完了
M2-017 raw raster tile codec:完了
M2-018 LZ4-block raster tile codec:完了
M2-019 raw/LZ4 automatic selection policy:完了
M2-020 mask single-channel persistence:完了
M2-021 history transaction model:完了
M2-022 hybrid delta/snapshot history strategy:完了
M2-023 Undo:完了
M2-024 Redo:完了
M2-025 history pruning:完了
M2-026 history spill-to-storage:完了
M2-027 history state restoration across reload:完了
M2-028 project create:完了
M2-029 project open:完了
M2-030 project close:完了
M2-031 project rename:完了
M2-032 project duplicate:完了
M2-033 project timestamps:完了
M2-034 project preview metadata:完了
M2-035 local project delete:完了
M2-036 Recently Deleted/trash:完了
M2-037 deleted-project restore:完了
M2-038 Web Locks writer ownership:完了
M2-039 BroadcastChannel project-state propagation:完了
M2-040 second-tab state propagation:完了
M2-041 storage quota accounting:完了
M2-042 storage safety reserve policy:完了
M2-043 persistent-storage request plumbing:完了
M2-044 garbage collection foundation:完了
M2-検査 M2内部検査:完了

## M3 — WebGPU / Sparse Tile / Input Foundation
M3-001 secure-context startup gate:完了
M3-002 navigator.gpu capability gate:完了
M3-003 GPU adapter selection:完了
M3-004 GPU device creation:完了
M3-005 required capability profile gate:完了
M3-006 optional shader-f16 capability handling:完了
M3-007 Render Worker ownership path:完了
M3-008 OffscreenCanvas transfer path:完了
M3-009 main-context WebGPU fallback:完了
M3-010 GPU device-loss detection:完了
M3-011 GPU device-loss reconstruction:完了
M3-012 canonical 256px sparse tile model:完了
M3-013 edge-tile valid bounds:完了
M3-014 tile addressing:完了
M3-015 dirty-tile tracking:完了
M3-016 per-tile dirty rectangle:完了
M3-017 50% dirty-region whole-tile promotion:完了
M3-018 tile allocation:完了
M3-019 tile deallocation:完了
M3-020 GPU tile cache:完了
M3-021 CPU/backing tile cache:完了
M3-022 2048px atlas-page management:完了
M3-023 atlas slot allocation:完了
M3-024 viewport tile visibility resolver:完了
M3-025 tile upload:完了
M3-026 tile readback:完了
M3-027 transient halo/filter target management:完了
M3-028 render scheduling:完了
M3-029 priority scheduling foundation:完了
M3-030 frame compositor foundation:完了
M3-031 Pointer Events ingestion:完了
M3-032 pressure ingestion:完了
M3-033 tilt ingestion:完了
M3-034 orientation ingestion:完了
M3-035 coalesced-event ingestion:完了
M3-036 raw-update ingestion:完了
M3-037 predicted-sample presentation path:完了
M3-038 bounded input queue:完了
M3-039 input coalescing/backpressure:完了
M3-040 Transferable message transport:完了
M3-041 SAB/Atomics optimized path:完了
M3-042 non-SAB functional fallback:完了
M3-043 Pen/Touch/Mouse source arbitration:完了
M3-044 application-side palm/touch rejection foundation:完了
M3-045 hover data foundation:完了
M3-046 canvas admission-control foundation:完了
M3-047 maximum width/height admission check:完了
M3-048 logical-area admission check:完了
M3-049 scratch/storage-headroom admission estimation:完了
M3-検査 M3内部検査:完了

## M4 — Production End-to-End Paint Vertical Slice
M4-001 New Documentからrenderer接続:完了
M4-002 initial Raster Layer生成:完了
M4-003 pen stroke開始:完了
M4-004 mouse stroke開始:完了
M4-005 stroke sample accumulation:完了
M4-006 baseline brush dab生成:完了
M4-007 GPU rasterization:完了
M4-008 tile dirty update:完了
M4-009 canvasへの可視結果表示:完了
M4-010 strokeを1 history transactionとしてcommit:完了
M4-011 stroke Undo:完了
M4-012 stroke Redo:完了
M4-013 autosave接続:完了
M4-014 checkpoint接続:完了
M4-015 reload/recovery接続:完了
M4-016 GPU rebuild後のcanonical state再構築:完了
M4-017 PNG flatten/render:未完了
M4-018 PNG export:未完了
M4-検査 M4内部検査:未完了
PUB-01 ユーザー確認1用Preview公開:未完了
USER-01 新規作成・描画・Undo/Redo・保存再読込・PNG Exportユーザー確認PASS:未完了

## M5A — Document / Canvas / Navigation
M5A-001 custom canvas width/height:未完了
M5A-002 document presets:未完了
M5A-003 transparent background:未完了
M5A-004 colored background:未完了
M5A-005 DPI/resolution metadata editing:未完了
M5A-006 RGBA8 document precision:未完了
M5A-007 RGBA16F-class document precision:未完了
M5A-008 sRGB document mode foundation:未完了
M5A-009 Display-P3 document mode foundation:未完了
M5A-010 canvas resize:未完了
M5A-011 image resize:未完了
M5A-012 crop:未完了
M5A-013 trim:未完了
M5A-014 canvas expansion:未完了
M5A-015 destructive document rotate:未完了
M5A-016 horizontal flip:未完了
M5A-017 vertical flip:未完了
M5A-018 pan:未完了
M5A-019 zoom:未完了
M5A-020 viewport rotation:未完了
M5A-021 reset view:未完了
M5A-022 fit-to-screen:未完了
M5A-023 fullscreen/workspace presentation:未完了
M5A-024 mirror preview:未完了
M5A-025 pixel/non-interpolated preview:未完了
M5A-026 grid display:未完了
M5A-027 grid spacing:未完了
M5A-028 grid offset:未完了
M5A-029 grid color:未完了
M5A-030 create/resize/import admission control integration:未完了
M5A-検査 M5A内部検査:未完了

## M5B — Layer / Mask / Linked Object System
M5B-001 Raster Layer creation:未完了
M5B-002 Folder creation:未完了
M5B-003 Vector/Shape Layer creation:未完了
M5B-004 Adjustment Layer creation:未完了
M5B-005 Fill Layer creation:未完了
M5B-006 Gradient Layer creation:未完了
M5B-007 Layer Mask creation:未完了
M5B-008 Linked/File Object Layer creation:未完了
M5B-009 layer duplicate:未完了
M5B-010 layer delete:未完了
M5B-011 layer rename:未完了
M5B-012 layer reorder:未完了
M5B-013 layer visibility:未完了
M5B-014 layer opacity:未完了
M5B-015 layer lock:未完了
M5B-016 alpha lock:未完了
M5B-017 clipping:未完了
M5B-018 layer clear:未完了
M5B-019 merge down:未完了
M5B-020 merge visible copy:未完了
M5B-021 rasterize:未完了
M5B-022 layer invert:未完了
M5B-023 layer horizontal flip:未完了
M5B-024 layer vertical flip:未完了
M5B-025 multi-layer selection:未完了
M5B-026 multi-layer move:未完了
M5B-027 grouped transform:未完了
M5B-028 folder-level transform:未完了
M5B-029 layer search:未完了
M5B-030 layer filtering:未完了
M5B-031 empty-layer cleanup:未完了
M5B-032 hidden-layer cleanup:未完了
M5B-033 Folder Pass Through:未完了
M5B-034 Layer Comps create/save:未完了
M5B-035 Layer Comps switch:未完了
M5B-036 Mask painting:未完了
M5B-037 Mask invert:未完了
M5B-038 Mask link/unlink:未完了
M5B-039 Mask independent move:未完了
M5B-040 Mask independent transform:未完了
M5B-041 Mask feather:未完了
M5B-042 Mask blur:未完了
M5B-043 Mask→Selection:未完了
M5B-044 Selection→Mask:未完了
M5B-045 Reference Layer designation:未完了
M5B-046 Reference Layer解除:未完了
M5B-047 Draft/Sketch Layer attribute:未完了
M5B-048 Draftをfinal outputから除外:未完了
M5B-049 Linked Object embedded snapshot:未完了
M5B-050 Linked Object canonical embedded representation:未完了
M5B-検査 M5B内部検査:未完了

## M5C — Blend Modes / Compositor
M5C-001 Normal:未完了
M5C-002 Darken:未完了
M5C-003 Multiply:未完了
M5C-004 Color Burn:未完了
M5C-005 Linear Burn:未完了
M5C-006 Darker Color:未完了
M5C-007 Lighten:未完了
M5C-008 Screen:未完了
M5C-009 Color Dodge:未完了
M5C-010 Linear Dodge/Add:未完了
M5C-011 Lighter Color:未完了
M5C-012 Overlay:未完了
M5C-013 Soft Light:未完了
M5C-014 Hard Light:未完了
M5C-015 Vivid Light:未完了
M5C-016 Linear Light:未完了
M5C-017 Pin Light:未完了
M5C-018 Hard Mix:未完了
M5C-019 Difference:未完了
M5C-020 Exclusion:未完了
M5C-021 Subtract:未完了
M5C-022 Divide:未完了
M5C-023 Hue:未完了
M5C-024 Saturation:未完了
M5C-025 Color:未完了
M5C-026 Luminosity:未完了
M5C-027 explicit color-space blend semantics:未完了
M5C-028 mask/clipping compositor integration:未完了
M5C-検査 M5C内部検査:未完了

## M5D — Color / Palette / Sampling
M5D-001 Color Wheel:未完了
M5D-002 RGB entry:未完了
M5D-003 HSV/HSB entry:未完了
M5D-004 HEX entry:未完了
M5D-005 current color:未完了
M5D-006 previous color:未完了
M5D-007 color history:未完了
M5D-008 palette create:未完了
M5D-009 palette rename:未完了
M5D-010 palette delete:未完了
M5D-011 multiple named palettes:未完了
M5D-012 palette reorder:未完了
M5D-013 palette-color reorder:未完了
M5D-014 palette import:未完了
M5D-015 palette export:未完了
M5D-016 Eyedropper:未完了
M5D-017 quick Eyedropper:未完了
M5D-018 active-layer sampling:未完了
M5D-019 merged-canvas sampling:未完了
M5D-020 reference-image sampling:未完了
M5D-021 sRGB processing:未完了
M5D-022 Display-P3 processing:未完了
M5D-023 color-profile metadata:未完了
M5D-024 profile-aware conversion:未完了
M5D-025 ICC/profile-aware preview boundary:未完了
M5D-026 Color Mixing Palette:未完了
M5D-027 Intermediate/Approximate Color helper:未完了
M5D-028 Color Match:未完了
M5D-検査 M5D内部検査:未完了

## M6A — Canonical Brush Engine
M6A-001 Raster Brush mode:未完了
M6A-002 Eraser mode:未完了
M6A-003 Smudge/Finger mode:未完了
M6A-004 Blur brush mode:未完了
M6A-005 preset create:未完了
M6A-006 preset duplicate:未完了
M6A-007 preset rename:未完了
M6A-008 preset delete:未完了
M6A-009 preset search:未完了
M6A-010 preset categories:未完了
M6A-011 preset lock:未完了
M6A-012 preset reset:未完了
M6A-013 brush size:未完了
M6A-014 opacity:未完了
M6A-015 flow/density:未完了
M6A-016 per-brush parameter limits:未完了
M6A-017 procedural tip:未完了
M6A-018 sampled image tip:未完了
M6A-019 custom tip creation:未完了
M6A-020 multiple tip assets without Dual Brush semantics:未完了
M6A-021 hardness:未完了
M6A-022 tip density:未完了
M6A-023 spacing/gap:未完了
M6A-024 tip angle:未完了
M6A-025 tip direction:未完了
M6A-026 follow stroke rotation:未完了
M6A-027 stroke repetition:未完了
M6A-028 stroke-start behavior:未完了
M6A-029 stroke-end behavior:未完了
M6A-030 size taper:未完了
M6A-031 opacity taper:未完了
M6A-032 forced taper:未完了
M6A-033 real-time stabilization:未完了
M6A-034 post-stroke correction:未完了
M6A-035 grain selection:未完了
M6A-036 paper texture selection:未完了
M6A-037 texture strength:未完了
M6A-038 texture scale:未完了
M6A-039 texture rotation:未完了
M6A-040 texture blend behavior:未完了
M6A-041 pressure→size:未完了
M6A-042 pressure→opacity:未完了
M6A-043 pressure→flow:未完了
M6A-044 pressure response curve:未完了
M6A-045 tilt mapping:未完了
M6A-046 orientation mapping:未完了
M6A-047 velocity mapping:未完了
M6A-048 random dynamics:未完了
M6A-049 minimum response:未完了
M6A-050 maximum response:未完了
M6A-051 size jitter:未完了
M6A-052 opacity jitter:未完了
M6A-053 rotation jitter:未完了
M6A-054 position/scatter jitter:未完了
M6A-055 density jitter:未完了
M6A-056 color jitter:未完了
M6A-057 spray/particle mode:未完了
M6A-058 particle size:未完了
M6A-059 particle density:未完了
M6A-060 particle spread:未完了
M6A-061 particle orientation:未完了
M6A-062 ordinary raster color mixing:未完了
M6A-063 wet/smudge-style pickup:未完了
M6A-064 main/sub color behavior:未完了
M6A-065 reference-aware anti-overflow painting:未完了
M6A-066 hover brush outline:未完了
M6A-067 hover crosshair option:未完了
M6A-068 global/default pressure response controls:未完了
M6A-069 touch-position/input correction policy:未完了
M6A-070 configurable stylus-button action plumbing:未完了
M6A-071 final 77 sampled resources loader:未完了
M6A-072 brush-tip resource manager:未完了
M6A-073 grain resource manager:未完了
M6A-074 paper resource manager:未完了
M6A-075 pattern resource manager:未完了
M6A-076 48-preset Default Brush Pack integration:未完了
M6A-077 deterministic brush thumbnails:未完了
M6A-検査 M6A内部検査:未完了

## M6B — Brush Interoperability
M6B-001 `.illbrush` parser:未完了
M6B-002 `.illbrush` writer:未完了
M6B-003 Illustro brush import:未完了
M6B-004 Illustro brush export:未完了
M6B-005 ibisPaint custom brush parser:未完了
M6B-006 ibisPaint brush QR carrier decode:未完了
M6B-007 ibis→Illustro parameter mapper:未完了
M6B-008 CSP `.sut` parser:未完了
M6B-009 CSP→Illustro parameter mapper:未完了
M6B-010 unsupported brush property reporting:未完了
M6B-011 imported brush canonical normalization:未完了
M6B-検査 M6B内部検査:未完了
PUB-02 ユーザー確認2用Preview公開:未完了
USER-02 Layer・Color・Blend・Brush Engine・48 Brushes・筆圧傾き・ibis/CSP brush importユーザー確認PASS:未完了

## M7A — Selection / Mask Workflow
M7A-001 rectangular selection:未完了
M7A-002 elliptical selection:未完了
M7A-003 Lasso selection:未完了
M7A-004 freehand selection:未完了
M7A-005 brush-painted selection:未完了
M7A-006 Magic Wand/Auto Select:未完了
M7A-007 color-range selection:未完了
M7A-008 selection Replace mode:未完了
M7A-009 selection Add mode:未完了
M7A-010 selection Subtract mode:未完了
M7A-011 selection Intersect mode:未完了
M7A-012 deselect:未完了
M7A-013 invert selection:未完了
M7A-014 expand selection:未完了
M7A-015 contract selection:未完了
M7A-016 feather selection:未完了
M7A-017 Quick Mask:未完了
M7A-018 alpha/transparency→selection:未完了
M7A-019 selection cut:未完了
M7A-020 selection copy:未完了
M7A-021 selection paste:未完了
M7A-022 selection-scoped transform:未完了
M7A-023 selection-scoped filter:未完了
M7A-024 selection-scoped fill:未完了
M7A-025 selection-scoped layer operations:未完了
M7A-検査 M7A内部検査:未完了

## M7B — Fill / Gradient / Region Tools
M7B-001 Flood Fill:未完了
M7B-002 fill tolerance:未完了
M7B-003 fill strength:未完了
M7B-004 gap recognition:未完了
M7B-005 gap closing:未完了
M7B-006 under-line expansion:未完了
M7B-007 boundary expansion:未完了
M7B-008 boundary contraction:未完了
M7B-009 continuous/swipe fill:未完了
M7B-010 active-layer fill reference:未完了
M7B-011 designated Reference Layer fill reference:未完了
M7B-012 merged-canvas fill reference:未完了
M7B-013 Lineart Boundary fill reference:未完了
M7B-014 multiple Boundary union reference:未完了
M7B-015 anti-aliased under-line coverage integration:未完了
M7B-016 Enclose-and-Fill:未完了
M7B-017 Enclose-and-Erase:未完了
M7B-018 transparent/erase fill:未完了
M7B-019 pattern fill:未完了
M7B-020 standard gradient:未完了
M7B-021 editable gradient stops:未完了
M7B-022 gradient tool behavior:未完了
M7B-023 Gradient Layer rendering:未完了
M7B-024 Freeform Gradient:未完了
M7B-025 Gradient Map:未完了
M7B-検査 M7B内部検査:未完了

## M7C — Transform / Alignment / Snapping
M7C-001 Move:未完了
M7C-002 Scale:未完了
M7C-003 Rotate:未完了
M7C-004 numeric X/Y:未完了
M7C-005 numeric scale:未完了
M7C-006 numeric angle:未完了
M7C-007 perspective transform:未完了
M7C-008 mesh transform:未完了
M7C-009 mesh subdivisions:未完了
M7C-010 mesh smoothing:未完了
M7C-011 repeat transform:未完了
M7C-012 mirror-repeat:未完了
M7C-013 Puppet Warp:未完了
M7C-014 non-destructive transform representation:未完了
M7C-015 Nearest Neighbor resampling:未完了
M7C-016 Area/Average resampling:未完了
M7C-017 Bilinear resampling:未完了
M7C-018 Bicubic resampling:未完了
M7C-019 Lanczos 2 resampling:未完了
M7C-020 Lanczos 3 resampling:未完了
M7C-021 Align:未完了
M7C-022 Distribute:未完了
M7C-023 Smart Guides:未完了
M7C-024 snapping to canvas center/axes:未完了
M7C-025 snapping to grid/guides:未完了
M7C-026 snapping to eligible object/layer geometry:未完了
M7C-検査 M7C内部検査:未完了

## M7D — Shape / Vector / Ruler
M7D-001 Line Shape:未完了
M7D-002 Rectangle:未完了
M7D-003 Rounded Rectangle:未完了
M7D-004 Circle/Ellipse:未完了
M7D-005 Regular Polygon:未完了
M7D-006 Polyline:未完了
M7D-007 Bézier Curve:未完了
M7D-008 shape fill:未完了
M7D-009 shape stroke:未完了
M7D-010 post-creation shape adjustment:未完了
M7D-011 vector object selection:未完了
M7D-012 vector lasso selection:未完了
M7D-013 node editing:未完了
M7D-014 Bézier handle editing:未完了
M7D-015 corner/smooth node conversion:未完了
M7D-016 vector simplify:未完了
M7D-017 vector connect:未完了
M7D-018 vector pinch/reshape:未完了
M7D-019 vector line-width adjustment:未完了
M7D-020 vector stroke recolor:未完了
M7D-021 vector stroke width edit:未完了
M7D-022 vector mask:未完了
M7D-023 straight ruler:未完了
M7D-024 circular ruler:未完了
M7D-025 elliptical ruler:未完了
M7D-026 radial/concentration ruler:未完了
M7D-027 symmetry ruler:未完了
M7D-028 kaleidoscope ruler:未完了
M7D-029 array ruler:未完了
M7D-030 1-point Perspective Ruler:未完了
M7D-031 2-point Perspective Ruler:未完了
M7D-032 3-point Perspective Ruler:未完了
M7D-033 ruler movement:未完了
M7D-034 ruler angle adjustment:未完了
M7D-035 ruler center/phase adjustment:未完了
M7D-036 ruler snap toggle:未完了
M7D-037 Smart Shape recognition/correction:未完了
M7D-検査 M7D内部検査:未完了

## M7E — Text
M7E-001 Point Text:未完了
M7E-002 Box Text:未完了
M7E-003 editable Text Layer:未完了
M7E-004 font family:未完了
M7E-005 font size:未完了
M7E-006 font style/weight:未完了
M7E-007 text color:未完了
M7E-008 text alignment:未完了
M7E-009 character/line spacing controls:未完了
M7E-010 text box sizing:未完了
M7E-011 text transform:未完了
M7E-012 non-destructive text re-edit:未完了
M7E-013 rasterize text:未完了
M7E-検査 M7E内部検査:未完了

## M7F — Lineart Group / Boundary Graph
M7F-001 Lineart Group creation:未完了
M7F-002 source-lineart registration:未完了
M7F-003 Boundary Layer creation:未完了
M7F-004 line-boundary extraction:未完了
M7F-005 idealized centerline/barrier representation:未完了
M7F-006 graph node model:未完了
M7F-007 graph edge model:未完了
M7F-008 endpoint degree-1 classification:未完了
M7F-009 interior degree-2 classification:未完了
M7F-010 junction degree>=3 classification:未完了
M7F-011 automatic gap candidate detection:未完了
M7F-012 endpoint distance scoring:未完了
M7F-013 endpoint tangent/direction scoring:未完了
M7F-014 nearby-boundary context scoring:未完了
M7F-015 automatic gap connection:未完了
M7F-016 automatic-gap settings enabled/disabled:未完了
M7F-017 maximum connection distance setting:未完了
M7F-018 connection aggressiveness setting:未完了
M7F-019 manual boundary addition:未完了
M7F-020 endpoint connect:未完了
M7F-021 disconnect:未完了
M7F-022 edge split:未完了
M7F-023 boundary removal:未完了
M7F-024 rejected auto-connection:未完了
M7F-025 no-connect constraint:未完了
M7F-026 auto/manual provenance:未完了
M7F-027 source-revision tracking:未完了
M7F-028 dirty-region regeneration:未完了
M7F-029 semantic override persistence:未完了
M7F-030 semantic anchoring metadata:未完了
M7F-031 deterministic override remapping:未完了
M7F-032 unresolved mapping state:未完了
M7F-033 independent manual boundary fallback:未完了
M7F-034 unresolved review state:未完了
M7F-035 multiple Boundary reference union:未完了
M7F-036 under-line Fill integration:未完了
M7F-037 Auto Select integration:未完了
M7F-038 Enclose Fill integration:未完了
M7F-039 group transform synchronization:未完了
M7F-040 Liquify displacement synchronization:未完了
M7F-041 topology/history exact Undo:未完了
M7F-042 topology/history exact Redo:未完了
M7F-043 regeneration-boundary history snapshot/delta:未完了
M7F-044 cached extracted graph persistence semantics:未完了
M7F-検査 M7F内部検査:未完了

## M7G — Filters / Tonal Correction / Generated Effects
M7G-001 Brightness/Contrast:未完了
M7G-002 Tone Curve:未完了
M7G-003 Hue/Saturation/Lightness:未完了
M7G-004 Color Balance:未完了
M7G-005 Levels:未完了
M7G-006 Grayscale:未完了
M7G-007 Monochrome/Binarize:未完了
M7G-008 Posterize:未完了
M7G-009 Invert:未完了
M7G-010 Gradient Map effect:未完了
M7G-011 Color Replacement:未完了
M7G-012 line/color extraction correction:未完了
M7G-013 Gaussian Blur:未完了
M7G-014 Motion Blur:未完了
M7G-015 Zoom/Radial Blur:未完了
M7G-016 Rotation Blur:未完了
M7G-017 Lens-style Blur:未完了
M7G-018 Mosaic/Pixelation:未完了
M7G-019 Unsharp Mask:未完了
M7G-020 Bloat:未完了
M7G-021 image Fisheye distortion:未完了
M7G-022 Spherical/Lens distortion:未完了
M7G-023 Wave/Ripple:未完了
M7G-024 Twirl:未完了
M7G-025 Polar-coordinate transform:未完了
M7G-026 line-wave generator:未完了
M7G-027 radial-wave generator:未完了
M7G-028 parallel-wave generator:未完了
M7G-029 cloud-style generation:未完了
M7G-検査 M7G内部検査:未完了

## M7H — Non-destructive Effects / Adjustment Architecture
M7H-001 destructive effect execution:未完了
M7H-002 Adjustment Layer processor:未完了
M7H-003 layer-local Filter Stack:未完了
M7H-004 Filter Mask:未完了
M7H-005 effect enable/disable:未完了
M7H-006 effect reorder:未完了
M7H-007 effect parameter editing:未完了
M7H-008 effect masking:未完了
M7H-009 explicit bake/rasterize:未完了
M7H-010 common destructive/non-destructive kernel:未完了
M7H-011 tile dependency graph:未完了
M7H-012 effect cache identity:未完了
M7H-013 reduced-resolution live preview:未完了
M7H-014 cheap-effect full-resolution interactive path:未完了
M7H-015 full-quality settle:未完了
M7H-016 full-quality export evaluation:未完了
M7H-017 filter tile halo handling:未完了
M7H-018 wide-radius multiscale processing:未完了
M7H-019 approximate interactive global statistics:未完了
M7H-020 final full-resolution global statistics:未完了
M7H-検査 M7H内部検査:未完了

## M7I — Liquify / Repair / Special Paint
M7I-001 Liquify push/warp:未完了
M7I-002 local warp:未完了
M7I-003 Lasso Paint:未完了
M7I-004 Lasso Erase:未完了
M7I-005 Clone/Copy Pen:未完了
M7I-006 Smudge Tool:未完了
M7I-007 Blur Tool:未完了
M7I-008 Repair tool family production functions:未完了
M7I-009 shared Lineart displacement field:未完了
M7I-検査 M7I内部検査:未完了

## M7J — Reference / Navigator / Productivity / Auto Actions
M7J-001 Reference/Sub View panel core:未完了
M7J-002 multiple reference images:未完了
M7J-003 reference switching:未完了
M7J-004 reference move/resize:未完了
M7J-005 reference zoom:未完了
M7J-006 reference rotate:未完了
M7J-007 reference reset:未完了
M7J-008 color picking from reference:未完了
M7J-009 current-canvas Navigator mode:未完了
M7J-010 Navigator overview:未完了
M7J-011 large-canvas navigator movement:未完了
M7J-012 Quick Access command surface logic:未完了
M7J-013 Quick Access colors:未完了
M7J-014 Custom Command Bar logic:未完了
M7J-015 Auto Action record:未完了
M7J-016 Auto Action replay:未完了
M7J-017 Auto Action import:未完了
M7J-018 Auto Action export:未完了
M7J-019 local resource/material workflow:未完了
M7J-020 alignment/distribution command-surface access:未完了
M7J-検査 M7J内部検査:未完了
PUB-03 ユーザー確認3用Preview公開:未完了
USER-03 Selection・Fill・Transform・Vector/Shape・Text・Lineart・Filters・Adjustment・Liquify・Reference/Navigatorユーザー確認PASS:未完了

## M8A — Canonical UI Reference Materialization
M8A-001 canonical visual referenceの保存先/ID確認:未完了
M8A-002 `ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png` 実物取得:未完了
M8A-003 canonical visual reference SHA-256照合:未完了
M8A-004 backup visual reference一致確認導線:未完了
M8A-005 adopted app icon実物取得:未完了
M8A-006 adopted app icon canonical identity確認:未完了
M8A-検査 M8A visual reference準備検査:未完了

## M8B — Product Surfaces / Editor Shell
M8B-001 Library shell:未完了
M8B-002 Editor shell:未完了
M8B-003 Task surfaces framework:未完了
M8B-004 Application/Document Bar:未完了
M8B-005 Canvas Workspace:未完了
M8B-006 Primary Tool Rail shell:未完了
M8B-007 Inspector Dock shell:未完了
M8B-008 Inspector Action Strip:未完了
M8B-009 contextual action surfaces:未完了
M8B-010 task/error surfaces:未完了
M8B-011 persistent data-safety banner:未完了
M8B-012 non-critical toast:未完了
M8B-013 menus:未完了
M8B-014 popovers:未完了
M8B-015 tooltips:未完了
M8B-016 tool-family flyouts:未完了
M8B-017 New Document dialog/sheet:未完了
M8B-018 Import report surface:未完了
M8B-019 Export dialog/sheet:未完了
M8B-020 Preferences surface:未完了
M8B-021 Settings surface:未完了
M8B-022 Help surface:未完了
M8B-023 Compatibility diagnostics surface:未完了
M8B-024 shortcut customization surface:未完了
M8B-025 workspace customization surface:未完了
M8B-026 destructive confirmation surface:未完了
M8B-検査 M8B内部検査:未完了

## M8C — 14-family Tool Rail
M8C-001 Tool Rail canonical ordering:未完了
M8C-002 rail resize 56–88 CSS px:未完了
M8C-003 family/subtool affordance:未完了
M8C-004 active tool presentation:未完了
M8C-005 Brush family:未完了
M8C-006 Eraser family:未完了
M8C-007 Blend family:未完了
M8C-008 Fill family:未完了
M8C-009 Eyedropper family:未完了
M8C-010 Selection family:未完了
M8C-011 Transform family:未完了
M8C-012 Liquify family:未完了
M8C-013 Gradient family:未完了
M8C-014 Shape/Path family:未完了
M8C-015 Text family:未完了
M8C-016 Repair family:未完了
M8C-017 Ruler/Guide family:未完了
M8C-018 Navigation family:未完了
M8C-検査 M8C内部検査:未完了

## M8D — 13-block Inspector / PiP / Workspace Customization
M8D-001 Tool Properties block:未完了
M8D-002 Brush Presets block:未完了
M8D-003 Brush Studio block:未完了
M8D-004 Color block:未完了
M8D-005 Layers block:未完了
M8D-006 Layer Properties block:未完了
M8D-007 Effects/Adjustments block:未完了
M8D-008 Navigator block:未完了
M8D-009 Reference/Sub View block:未完了
M8D-010 History block:未完了
M8D-011 Quick Access block:未完了
M8D-012 Assets block:未完了
M8D-013 Auto Actions/Timelapse block:未完了
M8D-014 block collapse:未完了
M8D-015 block reorder:未完了
M8D-016 block detach:未完了
M8D-017 floating PiP creation:未完了
M8D-018 PiP positioning:未完了
M8D-019 PiP persistence:未完了
M8D-020 magnetic redocking:未完了
M8D-021 close detached block→Inspector return:未完了
M8D-022 Inspector collapse:未完了
M8D-023 detached PiP remains visible on Inspector collapse:未完了
M8D-024 Inspector width resize:未完了
M8D-025 Panel Manager:未完了
M8D-026 right-inspector block visibility settings:未完了
M8D-027 workspace reset:未完了
M8D-028 workspace save:未完了
M8D-029 workspace switching:未完了
M8D-030 Tool Rail thickness persistence:未完了
M8D-031 Inspector width persistence:未完了
M8D-検査 M8D内部検査:未完了

## M8E — Selection Launcher / Contextual Canvas UI
M8E-001 Selection Launcher creation:未完了
M8E-002 non-empty selection only visibility:未完了
M8E-003 Transform launcher command:未完了
M8E-004 Cut/Copy launcher commands:未完了
M8E-005 Clear launcher command:未完了
M8E-006 Invert launcher command:未完了
M8E-007 Feather/Expand/Shrink launcher commands:未完了
M8E-008 Fill launcher command:未完了
M8E-009 Selection Launcher placement:未完了
M8E-010 workspace boundary avoidance:未完了
M8E-011 handle/Inspector avoidance:未完了
M8E-012 hide during active drawing:未完了
M8E-013 dismissal without clearing selection:未完了
M8E-014 transform on-canvas handles:未完了
M8E-015 ruler contextual controls:未完了
M8E-016 Lineart contextual overlay:未完了
M8E-検査 M8E内部検査:未完了

## M8F — Quick Hole Controller
M8F-001 canvas-derived anchor:未完了
M8F-002 six separate regular-hex panels:未完了
M8F-003 empty center:未完了
M8F-004 0/60/120/180/240/300° centers:未完了
M8F-005 final 30° corrected hex orientation:未完了
M8F-006 ringless presentation:未完了
M8F-007 canonical default six-command mapping:未完了
M8F-008 per-slot command remapping:未完了
M8F-009 slot reorder:未完了
M8F-010 controller scale setting:未完了
M8F-011 radial center-distance setting:未完了
M8F-012 button sizing setting:未完了
M8F-013 overlay opacity setting:未完了
M8F-014 hit-target minimum behavior:未完了
M8F-015 icon contrast adaptation:未完了
M8F-016 hide while drawing/contact:未完了
M8F-017 non-UI workspace tap dismissal:未完了
M8F-018 later canvas-operation reappearance:未完了
M8F-019 UI interaction does not move anchor:未完了
M8F-020 same Command Registry invocation path:未完了
M8F-021 reset-to-default:未完了
M8F-検査 M8F内部検査:未完了

## M8G — Keyboard / Pen / Touch / Mouse Interaction
M8G-001 keyboard shortcut editor:未完了
M8G-002 Undo shortcut:未完了
M8G-003 Redo shortcut:未完了
M8G-004 Brush/Eraser shortcut:未完了
M8G-005 brush-size shortcuts:未完了
M8G-006 cut shortcut:未完了
M8G-007 copy shortcut:未完了
M8G-008 paste shortcut:未完了
M8G-009 navigation shortcuts:未完了
M8G-010 Eyedropper shortcut:未完了
M8G-011 tool-command shortcuts:未完了
M8G-012 dialog shortcuts:未完了
M8G-013 temporary tool/modifier behavior:未完了
M8G-014 shortcut conflict detection:未完了
M8G-015 shortcut conflict explicit resolution:未完了
M8G-016 stylus-button binding:未完了
M8G-017 Pen=draw/precision arbitration:未完了
M8G-018 Touch=canvas/UI arbitration:未完了
M8G-019 Mouse=desktop precision arbitration:未完了
M8G-020 Keyboard=fast/temporary action arbitration:未完了
M8G-検査 M8G内部検査:未完了

## M8H — Visual Design / Iconography / Motion
M8H-001 F/G design tokens:未完了
M8H-002 typography system:未完了
M8H-003 spacing system:未完了
M8H-004 dimensions system:未完了
M8H-005 radii system:未完了
M8H-006 border system:未完了
M8H-007 depth/shadow system:未完了
M8H-008 translucency system:未完了
M8H-009 chromatic accent system:未完了
M8H-010 non-blue-dominant accent behavior:未完了
M8H-011 interaction states:未完了
M8H-012 canonical UI icon geometry:未完了
M8H-013 14 Tool Family icons:未完了
M8H-014 13 Inspector block icons:未完了
M8H-015 Quick Hole glyph reuse:未完了
M8H-016 layer/state/system/status icons:未完了
M8H-017 16px icon path:未完了
M8H-018 20px icon path:未完了
M8H-019 24px icon path:未完了
M8H-020 adopted app icon integration:未完了
M8H-021 cursor contrast behavior:未完了
M8H-022 panel transitions:未完了
M8H-023 tool state transitions:未完了
M8H-024 docking motion:未完了
M8H-025 PiP detach motion:未完了
M8H-026 PiP redock motion:未完了
M8H-027 Quick Hole motion:未完了
M8H-028 Selection Launcher motion:未完了
M8H-029 local command feedback:未完了
M8H-030 Reduced Motion:未完了
M8H-検査 M8H内部検査:未完了

## M8I — Responsive / Accessibility / Localization
M8I-001 Wide layout:未完了
M8I-002 Compact layout:未完了
M8I-003 Narrow compatibility shell:未完了
M8I-004 narrow shell project listing/open metadata:未完了
M8I-005 narrow shell compatibility diagnostics:未完了
M8I-006 narrow shell recovery/export/backup:未完了
M8I-007 narrow shell settings/help:未完了
M8I-008 orientation change state preservation:未完了
M8I-009 viewport-tier transition state preservation:未完了
M8I-010 keyboard focus navigation:未完了
M8I-011 semantic accessible names:未完了
M8I-012 non-color-only state indicators:未完了
M8I-013 effective target-size behavior:未完了
M8I-014 contrast behavior:未完了
M8I-015 first-run locale detection:未完了
M8I-016 explicit language override:未完了
M8I-017 unsupported locale→English fallback:未完了
M8I-018 Japanese localization:未完了
M8I-019 English localization:未完了
M8I-020 localization keys for all user-facing strings:未完了
M8I-021 built-in preset name localization:未完了
M8I-022 error/recovery message localization:未完了
M8I-023 shortcut-label localization:未完了
M8I-024 `Intl` date/time formatting:未完了
M8I-025 `Intl` locale-facing number formatting:未完了
M8I-026 dynamic text overflow handling:未完了
M8I-検査 M8全体内部検査:未完了

## M9A — Local Project Library
M9A-001 local Project Library:未完了
M9A-002 project thumbnails:未完了
M9A-003 project search:未完了
M9A-004 project sorting:未完了
M9A-005 project organization:未完了
M9A-006 create from Library:未完了
M9A-007 open from Library:未完了
M9A-008 import from Library:未完了
M9A-009 recovery-project visibility:未完了
M9A-010 Recently Deleted Library surface:未完了
M9A-検査 M9A内部検査:未完了

## M9B — Native `.illustro` Format
M9B-001 `.illustro` archive writer:未完了
M9B-002 `.illustro` archive reader:未完了
M9B-003 ZIP64:未完了
M9B-004 archive checksums:未完了
M9B-005 manifest:未完了
M9B-006 raster tile persistence:未完了
M9B-007 vector persistence:未完了
M9B-008 folder persistence:未完了
M9B-009 mask persistence:未完了
M9B-010 adjustment persistence:未完了
M9B-011 effect-stack persistence:未完了
M9B-012 transform persistence:未完了
M9B-013 layer metadata persistence:未完了
M9B-014 color/document metadata persistence:未完了
M9B-015 Lineart Group persistence:未完了
M9B-016 Lineart Boundary persistence:未完了
M9B-017 linked-resource embedded snapshot persistence:未完了
M9B-018 archive migration:未完了
M9B-019 malformed data rejection:未完了
M9B-020 unsupported-version reporting:未完了
M9B-検査 M9B内部検査:未完了

## M9C — Image / Vector Interchange
M9C-001 image import as Document:未完了
M9C-002 image import as Layer:未完了
M9C-003 PNG import:未完了
M9C-004 PNG export:未完了
M9C-005 transparent PNG export:未完了
M9C-006 JPEG import:未完了
M9C-007 JPEG export:未完了
M9C-008 SVG import for supported content:未完了
M9C-009 SVG export:未完了
M9C-010 vector copy/export to SVG:未完了
M9C-011 imported image profile metadata interpretation:未完了
M9C-012 exported image profile metadata:未完了
M9C-013 Drag & Drop import:未完了
M9C-014 File System Access progressive enhancement:未完了
M9C-015 File System Access permission-loss handling:未完了
M9C-016 OS/PWA file association progressive enhancement:未完了
M9C-検査 M9C内部検査:未完了

## M9D — Linked Object External Acceleration
M9D-001 external persistent file handle optional link:未完了
M9D-002 linked object refresh:未完了
M9D-003 linked object relink:未完了
M9D-004 missing external source warning:未完了
M9D-005 keep embedded snapshot path:未完了
M9D-006 permission-loss without project breakage:未完了
M9D-検査 M9D内部検査:未完了

## M9E — PSD Bounded-Fidelity Interoperability
M9E-001 PSD parser:未完了
M9E-002 PSD raster layer mapping:未完了
M9E-003 PSD folder mapping:未完了
M9E-004 PSD mask mapping:未完了
M9E-005 PSD blend-mode mapping:未完了
M9E-006 PSD text representable mapping:未完了
M9E-007 PSD vector representable mapping:未完了
M9E-008 PSD adjustment/effect representable mapping:未完了
M9E-009 PSD export:未完了
M9E-010 PSD approximation reporting:未完了
M9E-011 PSD unsupported semantics reporting:未完了
M9E-検査 M9E内部検査:未完了

## M9F — Timelapse
M9F-001 drawing-event capture:未完了
M9F-002 timelapse timeline:未完了
M9F-003 timelapse playback:未完了
M9F-004 playback speed:未完了
M9F-005 timelapse rendering:未完了
M9F-006 WebCodecs capability detection:未完了
M9F-007 WebCodecs video encode path:未完了
M9F-008 compatible fallback behavior:未完了
M9F-009 timelapse export:未完了
M9F-010 CompressionStream auxiliary-stream use where applicable:未完了
M9F-検査 M9全体内部検査:未完了
PUB-04 ユーザー確認4用Preview公開:未完了
USER-04 完成UI・Quick Hole・Inspector/PiP・入力・`.illustro`・PNG/JPEG/SVG・PSD・Timelapse・brush import/exportユーザー確認PASS:未完了

## M10 — PWA / Reliability / Platform / Performance Hardening
M10-001 installability:未完了
M10-002 installed-app startup:未完了
M10-003 browser-mode startup:未完了
M10-004 offline application shell:未完了
M10-005 offline local editing:未完了
M10-006 offline project open/save:未完了
M10-007 Service Worker caching:未完了
M10-008 application update discovery:未完了
M10-009 safe update activation:未完了
M10-010 update without project loss:未完了
M10-011 visibility-state handling:未完了
M10-012 page hide/show handling:未完了
M10-013 background transition:未完了
M10-014 foreground restoration:未完了
M10-015 suspend/resume handling:未完了
M10-016 safe persistence handoff:未完了
M10-017 crash reopen:未完了
M10-018 corrupt journal recovery path:未完了
M10-019 checkpoint fallback recovery:未完了
M10-020 GPU loss recovery UI:未完了
M10-021 Storage Worker restart recovery:未完了
M10-022 second-tab read-only/contention UI:未完了
M10-023 low-quota UI:未完了
M10-024 persistent-storage permission handling:未完了
M10-025 unsupported-browser compatibility shell:未完了
M10-026 missing-WebGPU compatibility shell:未完了
M10-027 Transferable fallback environment support:未完了
M10-028 adaptive worker count:未完了
M10-029 adaptive GPU batching:未完了
M10-030 adaptive cache sizing:未完了
M10-031 adaptive preview quality:未完了
M10-032 memory-pressure adaptation:未完了
M10-033 thermal/resource-pressure adaptation:未完了
M10-034 W0 Stroke workload support:未完了
M10-035 W1 Composite workload support:未完了
M10-036 W2 Effects workload support:未完了
M10-037 W3 High Precision workload support:未完了
M10-038 W4 Large Sparse workload support:未完了
M10-039 cached navigation frame-budget optimization:未完了
M10-040 brush input-to-visible latency optimization:未完了
M10-041 UI command acknowledgement latency optimization:未完了
M10-042 main-thread pointer/arbitration CPU optimization:未完了
M10-043 long-session resource cleanup:未完了
M10-044 large-document hardening:未完了
M10-045 production deployment header hardening:未完了
M10-検査 M10内部検査:未完了

## M11 — Frozen Feature Inventory Closure
M11-001 Document/Canvas inventory reconciliation:未完了
M11-002 Reference/Navigator inventory reconciliation:未完了
M11-003 Brush Engine inventory reconciliation:未完了
M11-004 Brush compatibility inventory reconciliation:未完了
M11-005 Stylus/Input inventory reconciliation:未完了
M11-006 Color inventory reconciliation:未完了
M11-007 Layer inventory reconciliation:未完了
M11-008 Blend Mode inventory reconciliation:未完了
M11-009 Vector inventory reconciliation:未完了
M11-010 Selection inventory reconciliation:未完了
M11-011 Fill inventory reconciliation:未完了
M11-012 Lineart inventory reconciliation:未完了
M11-013 Transform inventory reconciliation:未完了
M11-014 Shape/Ruler inventory reconciliation:未完了
M11-015 Filter/Tonal inventory reconciliation:未完了
M11-016 Non-destructive Effect inventory reconciliation:未完了
M11-017 Liquify/Special Paint inventory reconciliation:未完了
M11-018 Productivity inventory reconciliation:未完了
M11-019 Reliability/History inventory reconciliation:未完了
M11-020 Native/Import/Export inventory reconciliation:未完了
M11-021 Local Gallery inventory reconciliation:未完了
M11-022 Timelapse inventory reconciliation:未完了
M11-023 PSD bounded-fidelity inventory reconciliation:未完了
M11-024 Color Match inventory reconciliation:未完了
M11-025 UI/Customization inventory reconciliation:未完了
M11-026 Accessibility/Localization inventory reconciliation:未完了
M11-027 PWA/Offline inventory reconciliation:未完了
M11-028 explicit excluded-feature boundary reconciliation:未完了
M11-029 post-baseline candidates remain non-blocking確認:未完了
M11-030 remaining adopted microfeatures completion:未完了
M11-031 all ADOPTED items production-connected:未完了
M11-032 all EXCLUDED items not accidentally required:未完了
M11-033 all SUPERSEDED items canonical replacementへ接続:未完了
M11-検査 M11 frozen inventory内部検査:未完了

## M12 — Release Candidate / Distribution Assembly
M12-001 release version identity:未完了
M12-002 immutable RC commit identity:未完了
M12-003 production PWA artifact:未完了
M12-004 app metadata:未完了
M12-005 production icons/assets packaging:未完了
M12-006 LICENSE生成:未完了
M12-007 NOTICE生成:未完了
M12-008 THIRD_PARTY_NOTICES.md生成:未完了
M12-009 third-party license bundle生成:未完了
M12-010 CycloneDX 1.7 JSON SBOM生成:未完了
M12-011 offline Open Source Licenses screen生成/接続:未完了
M12-012 dependency graphとnotice/SBOM同期:未完了
M12-013 built-in resources provenance同期:未完了
M12-014 final distribution package:未完了
M12-015 RC deployment artifact固定:未完了
M12-016 Production release deployment:未完了
M12-017 公開Productionを固定RCへ紐付け:未完了
M12-検査 M12最終内部検査:未完了
PUB-05 最終ユーザー確認用Production/RC公開:未完了
USER-05 PWA install/offline・長時間利用・Recovery・Library・主要導線・UI・保存再起動・Import/Export・実機Pen/Touch最終ユーザー確認PASS:未完了

## Completion
PROJECT-001 全実装項目完了:未完了
PROJECT-002 全内部検査PASS:未完了
PROJECT-003 全5回ユーザー確認PASS:未完了
PROJECT-004 Frozen Inventory 100% closure:未完了
PROJECT-005 Release Candidate成立:未完了
PROJECT-006 Illustro initial release完成:未完了
