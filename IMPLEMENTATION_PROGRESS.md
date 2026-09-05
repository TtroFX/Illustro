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
M3-012 canonical 128px sparse tile model:完了
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
M4-017 PNG flatten/render:完了
M4-018 PNG export:完了
M4-検査 M4内部検査:完了
PUB-01 ユーザー確認1用Preview公開:完了
USER-01 新規作成・描画・Undo/Redo・保存再読込・PNG Exportユーザー確認PASS:完了

### USER-01 performance remediation — Raster Tile canonical state
USER-01-PERF-001 128×128 Raster Tile canonical state基盤（affected-tile before/after capture・CPU復元・GPU dirty-tile patch）:完了
USER-01-PERF-002 production renderer/sessionをlayer別canonical Raster Tileへ接続:完了
USER-01-PERF-003 Tile差分Undo/Redo（全stroke replay除去）:完了
USER-01-PERF-004 dirty Tile journal・bounded history spill・Autosave差分化:完了
USER-01-PERF-005 旧stroke snapshot一回限りmigration・Tile復元・Export互換:完了
USER-01-PERF-006 100/1,000/10,000 stroke scaling回帰確認・typecheck/test/build:完了
USER-01-PERF-007 main統合・GitHub Pages preview更新:完了
USER-01-EXPORT-001 スマホPNG Export direct handler接続・hidden button中継除去・Exportのcheckpoint依存除去・可視status feedback:完了
USER-01-MOBILE-001 スマホ新規キャンバス作成ユーザー実機PASS:完了
USER-01-MOBILE-002 スマホ1本指描画ユーザー実機PASS:完了
USER-01-PERF-008 スマホ描画・キャンバス移動・ストローク確定の軽さユーザー実機PASS:完了
USER-01-EXPORT-003 スマホ書出ボタンstale availability lockout除去・single production handler ownership:完了
USER-01-EXPORT-002 スマホPNG Exportユーザー実機PASS:完了
USER-01-MOBILE-003 スマホUndo/Redo・保存再読込ユーザー実機PASS:完了
再開メモ: Raster Tile canonical state性能修正はmainへ統合済み。Brush Undo/Redoはaffected Tileのbefore/after復元のみで動作し、Tile履歴はOPFS payloadRefから必要分だけ再読込できる。stroke確定は変更Tileのみ非同期保存し、Autosave snapshotには現在Tile参照・bounded履歴参照・未焼込strokeだけを含める。旧stroke snapshotはopen時に一度だけreplayしてTileへ移行し、PNG ExportもStroke LogではなくComposite Raster Tileを使用する。GPU dab instance bufferは容量拡張式で再利用する。100/1,000/10,000件のUndo/Redoは約0.02–0.19ms範囲、100-stroke finalize窓は約2.93/0.87/0.66msで線形悪化なし。format、lint（既存warningのみ）、typecheck、unit 80 files / 302 tests、integration 2 files / 4 tests、production build、M4 contractがPASS。GitHub Pages `https://ttrofx.github.io/Illustro/` のbuild-infoとmain SHAの一致を確認済み。USER-01は2026-09-02のスマホ実機確認で新規作成・1本指描画・性能・Undo/Redo・保存再読込・PNG Exportまで全項目明示PASS済み。M5B-045〜050 Reference/Draft roles・Draft final-output除外・Linked Object canonical embedded snapshotまで完了。M5C-001〜010のbase blend modeはcanonical Raster Tile compositorへ接続済み。M5C-001〜027のblend/color-space semanticsに加え、M5C-028でRaster Mask coverage・invert・affine mask transform・feather/blur softening・raster clipping alphaをcanonical Raster Tile compositorへ接続し、M5C内部検査まで完了。M5D-001〜028とM5D内部検査まで完了。次はM6A-001 Raster Brush modeから再開する。

USER-01は2026-09-02のスマホ実機確認で全項目明示PASS済み。

## M5A — Document / Canvas / Navigation
M5A-001 custom canvas width/height:完了
M5A-002 document presets:完了
M5A-003 transparent background:完了
M5A-004 colored background:完了
M5A-005 DPI/resolution metadata editing:完了
M5A-006 RGBA8 document precision:完了
M5A-007 RGBA16F-class document precision:完了
M5A-008 sRGB document mode foundation:完了
M5A-009 Display-P3 document mode foundation:完了
M5A-010 canvas resize:完了
M5A-011 image resize:完了
M5A-012 crop:完了
M5A-013 trim:完了
M5A-014 canvas expansion:完了
M5A-015 destructive document rotate:完了
M5A-016 horizontal flip:完了
M5A-017 vertical flip:完了
M5A-018 pan:完了
M5A-019 zoom:完了
M5A-020 viewport rotation:完了
M5A-021 reset view:完了
M5A-022 fit-to-screen:完了
M5A-023 fullscreen/workspace presentation:完了
M5A-024 mirror preview:完了
M5A-025 pixel/non-interpolated preview:完了
M5A-026 grid display:完了
M5A-027 grid spacing:完了
M5A-028 grid offset:完了
M5A-029 grid color:完了
M5A-030 create/resize/import admission control integration:完了
M5A-検査 M5A内部検査:完了

## M5B — Layer / Mask / Linked Object System
M5B-001 Raster Layer creation:完了
M5B-002 Folder creation:完了
M5B-003 Vector/Shape Layer creation:完了
M5B-004 Adjustment Layer creation:完了
M5B-005 Fill Layer creation:完了
M5B-006 Gradient Layer creation:完了
M5B-007 Layer Mask creation:完了
M5B-008 Linked/File Object Layer creation:完了
M5B-009 layer duplicate:完了
M5B-010 layer delete:完了
M5B-011 layer rename:完了
M5B-012 layer reorder:完了
M5B-013 layer visibility:完了
M5B-014 layer opacity:完了
M5B-015 layer lock:完了
M5B-016 alpha lock:完了
M5B-017 clipping:完了
M5B-018 layer clear:完了
M5B-019 merge down:完了
M5B-020 merge visible copy:完了
M5B-021 rasterize:完了
M5B-022 layer invert:完了
M5B-023 layer horizontal flip:完了
M5B-024 layer vertical flip:完了
M5B-025 multi-layer selection:完了
M5B-026 multi-layer move:完了
M5B-027 grouped transform:完了
M5B-028 folder-level transform:完了
M5B-029 layer search:完了
M5B-030 layer filtering:完了
M5B-031 empty-layer cleanup:完了
M5B-032 hidden-layer cleanup:完了
M5B-033 Folder Pass Through:完了
M5B-034 Layer Comps create/save:完了
M5B-035 Layer Comps switch:完了
M5B-036 Mask painting:完了
M5B-037 Mask invert:完了
M5B-038 Mask link/unlink:完了
M5B-039 Mask independent move:完了
M5B-040 Mask independent transform:完了
M5B-041 Mask feather:完了
M5B-042 Mask blur:完了
M5B-043 Mask→Selection:完了
M5B-044 Selection→Mask:完了
M5B-045 Reference Layer designation:完了
M5B-046 Reference Layer解除:完了
M5B-047 Draft/Sketch Layer attribute:完了
M5B-048 Draftをfinal outputから除外:完了
M5B-049 Linked Object embedded snapshot:完了
M5B-050 Linked Object canonical embedded representation:完了
M5B-検査 M5B内部検査:完了

## M5C — Blend Modes / Compositor
M5C-001 Normal:完了
M5C-002 Darken:完了
M5C-003 Multiply:完了
M5C-004 Color Burn:完了
M5C-005 Linear Burn:完了
M5C-006 Darker Color:完了
M5C-007 Lighten:完了
M5C-008 Screen:完了
M5C-009 Color Dodge:完了
M5C-010 Linear Dodge/Add:完了
M5C-011 Lighter Color:完了
M5C-012 Overlay:完了
M5C-013 Soft Light:完了
M5C-014 Hard Light:完了
M5C-015 Vivid Light:完了
M5C-016 Linear Light:完了
M5C-017 Pin Light:完了
M5C-018 Hard Mix:完了
M5C-019 Difference:完了
M5C-020 Exclusion:完了
M5C-021 Subtract:完了
M5C-022 Divide:完了
M5C-023 Hue:完了
M5C-024 Saturation:完了
M5C-025 Color:完了
M5C-026 Luminosity:完了
M5C-027 explicit color-space blend semantics:完了
M5C-028 mask/clipping compositor integration:完了
M5C-検査 M5C内部検査:完了

## M5D — Color / Palette / Sampling
M5D-001 Color Wheel:完了
M5D-002 RGB entry:完了
M5D-003 HSV/HSB entry:完了
M5D-004 HEX entry:完了
M5D-005 current color:完了
M5D-006 previous color:完了
M5D-007 color history:完了
M5D-008 palette create:完了
M5D-009 palette rename:完了
M5D-010 palette delete:完了
M5D-011 multiple named palettes:完了
M5D-012 palette reorder:完了
M5D-013 palette-color reorder:完了
M5D-014 palette import:完了
M5D-015 palette export:完了
M5D-016 Eyedropper:完了
M5D-017 quick Eyedropper:完了
M5D-018 active-layer sampling:完了
M5D-019 merged-canvas sampling:完了
M5D-020 reference-image sampling:完了
M5D-021 sRGB processing:完了
M5D-022 Display-P3 processing:完了
M5D-023 color-profile metadata:完了
M5D-024 profile-aware conversion:完了
M5D-025 ICC/profile-aware preview boundary:完了
M5D-026 Color Mixing Palette:完了
M5D-027 Intermediate/Approximate Color helper:完了
M5D-028 Color Match:完了
M5D-検査 M5D内部検査:完了
再開メモ: M5D-001〜028は完了。Color MatchはSub View参照画像を既存Color Managementでドキュメント色空間へ正規化し、alpha-weighted RGB統計を用いたローカル決定論的matchingをpreview-onlyで調整後、Apply時のみcanonical Raster Tileへ永続化して単一History transactionとしてcommitする。Cancelはdocument/historyを変更しない。次はM6A-001 Raster Brush modeから再開する。

## M6A — Canonical Brush Engine
M6A-001 Raster Brush mode:完了
再開メモ: M6A-001 Raster Brush modeはproduction PaintSessionをCanonicalRasterBrushStrokeV1へ接続し、既存M4 dab builderを低レベル決定論kernelとして再利用する構成で完了。strokeにはbrushMode=rasterを保存し、旧snapshotはmode欠落時にrasterへ互換復元する。通常pointer batchは新規confirmed sampleだけをappendConfirmedへ渡し、stable-prefix再処理数を0として観測可能にした。M6A-PERF-001〜004は専用scaling/renderer検証が必要なため未完了のまま。次はM6A-002 Eraser modeから再開する。
M6A-002 Eraser mode:完了
再開メモ: M6A-002 Eraser modeはRaster Brushと同じ増分dab geometryを共有し、canonical Raster Tile上でactive layerのalphaをdestination-out相当で削る。flatten済みsceneを直接消さず、影響Tileのみ再compositeして下層レイヤーを正しく露出する。Worker/Main/Canvas2D fallback・stroke永続化/旧raster互換・Tile差分Undo/Redoへoperationを接続し、Primary Tool RailからBrush/Eraserを48pxボタンで切替可能。次はM6A-003 Smudge/Finger modeから再開する。
M6A-003 Smudge/Finger mode:完了
再開メモ: M6A-003 Smudge/Finger modeはactive Raster Layer内だけを対象に、連続dabの移動差で直前位置側のpixelを現在位置へ引くdisplacement型として実装。各dabは変更前source tile snapshotを使い、premultiplied RGBAでbilinear sampleしてalpha縁の色にじみと同一dab内feedbackを避ける。Tile境界を跨いでsamplingでき、変更Tileだけcanonical patch化してWorker/Main/Canvas2D fallbackを再compositeする。wet/pickup型の混色はM6A-063として別途未完了。次はM6A-004 Blur brush modeから再開する。
M6A-004 Blur brush mode:完了
再開メモ: M6A-004 Blur brush modeはactive Raster Layerのcanonical pixelだけを対象に、各dab開始時のimmutable source tile snapshotへ5×5 binomial Gaussian近似を適用し、premultiplied RGBAで局所blurした結果をbrush coverage/opacityで戻す。kernel workはradiusに対して固定上限で、source samplingはTile境界を跨ぎ、実際に変化したdestination TileだけをHistory patch化する。Worker/Main/Canvas2D fallbackは既存non-paint再composite経路を共有。次はM6A-005 preset createから再開する。
M6A-005 preset create:完了
M6A-006 preset duplicate:完了
M6A-007 preset rename:完了
M6A-008 preset delete:完了
M6A-009 preset search:完了
M6A-010 preset categories:完了
M6A-011 preset lock:完了
M6A-012 preset reset:完了
再開メモ: M6A-005〜012 Brush Preset管理はfactory baselineを不変reset anchorとして保持し、user/factory overrideをlocal persistenceへ保存する構成で完了。M6A-013〜016ではTool Propertiesのsize/opacity/flowを選択presetへ保存し、stroke開始時に値をcaptureする。flowはdabごとのdeposit、opacityはpaint stroke全体のalpha上限としてcanonical Raster Tile上で累積し、低opacity/flow時のinteractive previewはcanonical changed Tileをpatchして最終結果と一致させる。各presetはextensions.parameterLimitsに独立したmin/maxを保持でき、UIと更新APIがその範囲を強制する。次はM6A-017 procedural tipから再開する。
M6A-013 brush size:完了
M6A-014 opacity:完了
M6A-015 flow/density:完了
M6A-016 per-brush parameter limits:完了
M6A-017 procedural tip:完了
M6A-018 sampled image tip:完了
M6A-019 custom tip creation:完了
再開メモ: M6A-019 custom tip creationは選択preset内に単一5×5 alpha maskを保持し、画像入力を中央square crop→5×5へ縮小→黒/暗部をcoverageとして正規化する。stroke開始時にcustom alphaをcaptureし、M6A-018と同じprimitive round dab展開へ流すためrenderer/History/Persistenceの別経路は追加しない。centerが透明なcustom tipでも終端重複しないようlogical stamp位置をdab列とは別に追跡する。次はM6A-020 multiple tip assets without Dual Brush semanticsから再開する。
M6A-020 multiple tip assets without Dual Brush semantics:完了
再開メモ: M6A-020はbrush preset内のextensionsに最大16個のsampled tip assetを保持し、selectedTipAssetIdで常に1個だけをactive tipへ投影する。既存M6A-019の単一custom tipは最初の追加時にasset collectionへ昇格する。選択・置換・削除はpreset revision/lock/persistenceを通し、runtimeには選択済みalpha maskだけを渡すためDual Brushの同時合成・ランダム混合・複数tip同時描画は実装しない。次はM6A-021 hardnessから再開する。
M6A-021 hardness:完了
再開メモ: M6A-021 hardnessはtip.hardnessの0..1静的値をpreset正本として扱い、stroke開始時にcaptureして全primitive dabへ保存する。旧strokeでhardness未保存の場合は0.85へfallbackする。Canonical Raster Tileのedge coverageがhardness正本で、既存WebGPU shaderが持つ0.85 fast pathはdefault値だけ維持し、非default hardnessはcanonical previewへ切替えて表示と保存結果の不一致を避ける。sampled/custom tipのmicro dabにも同じhardnessを伝播する。次はM6A-022 tip densityから再開する。
M6A-022 tip density:完了
M6A-023 spacing/gap:完了
M6A-024 tip angle:完了
M6A-025 tip direction:完了
再開メモ: M6A-025 tip directionはtip.directionDegreesを先端アセット固有の前方向として0..360°に正規化し、固定モードの実効角をtip.angleDegrees - tip.directionDegreesとしてstroke開始時に解決する。primitive dabには既存tipAngleDegreesへ解決済み角度だけを保存し、directionをdab schemaへ重複保存しない。procedural/sampled/custom tipはM6A-024の同一回転経路を共有する。次はM6A-026 follow stroke rotationから再開し、stroke tangentをこの固定角へ合成する。
M6A-026 follow stroke rotation:完了
再開メモ: M6A-026 follow stroke rotationはstroke.followRotationのbooleanをpreset正本とし、falseではM6A-025の固定実効角、trueでは各新規logical stampに局所stroke tangent + tip.angleDegrees - tip.directionDegreesを適用する。開始stampはまだtangentが無いため固定角のまま確定し、後から回し直さない。短い終端stampは最後に確認した移動方向を使う。解決済みtipAngleDegreesだけをdabへ保存するためWorker/History schemaは増やさずstable-prefixを維持する。次はM6A-027 stroke repetitionから再開する。
M6A-027 stroke repetition:完了
再開メモ: M6A-027 stroke repetitionはCanonical Brush Modelのtip selection modeをfixed/sequence/random-per-stampとして実装し、M6A-020のordered tipAssetsからlogical stampごとに常に1つだけ選択する。fixedはselected asset、sequenceはselected assetを起点に順番反復、random-per-stampはstrokeId由来の保存済みuint32 randomSeedでdeterministic選択する。primitive dabは選択後の既存M6A-018 micro-dabへ解決されるためDual Brush合成や新renderer pathは追加しない。次はM6A-028 stroke-start behaviorから再開する。
M6A-028 stroke-start behavior:完了
再開メモ: M6A-028 stroke-start behaviorはstroke.startLengthPxを0..4096 document pxで保持し、0は従来どおり即時開始とする。startLengthPx>0では開始からの累積path distanceに対する線形envelopeを各新規logical stamp生成時だけ計算し、現段階ではradiusとper-dab flow/depositを0→baseへ同率で解決しつつ、whole-stroke opacity capはstroke内で一定に保つ。開始点0% stampは出力せずtip repetition indexも消費しない。確定済みdabを後から変更しないためstable-prefixを維持する。M6A-030/031ではこの共通envelopeに対するsize/opacity各々の最小比率・強度を独立設定へ拡張する。次はM6A-029 stroke-end behaviorから再開する。
M6A-029 stroke-end behavior:完了
再開メモ: M6A-029 stroke-end behaviorはstroke.endLengthPxを0..4096 document pxで保持し、0は従来の即時終了を維持する。endLengthPx>0ではactive中に現在末尾からendLengthPx内のlogical stampsだけをmutable tailとして識別し、pointerupで総path lengthが確定した時にそのtailだけをstart/end envelopeのminで再生成する。stable prefixはkernel上で再生成しない。whole-stroke opacity capは一定のままradiusとper-dab flow/depositを減衰し、終端0% stampは最終dab列から除外する。現rendererのactive Raster transactionはtail置換APIをまだ持たないため、final dabsがprovisional prefixと一致しない場合だけrelease時に一度cancel→最終dab列再適用で整合する。毎入力のwhole-stroke replayは行わず、tail-only raster reconciliationへの最適化はM6A-PERF-001/002に残す。次はM6A-030 size taperから再開する。
M6A-030 size taper:完了
再開メモ: M6A-030 size taperはstartLengthPx/endLengthPxが定義する共通0..1距離envelopeとは独立に、stroke.sizeTaperMinimumRatioを0..1で保持する。size scaleはminimumRatio + (1-minimumRatio)*envelopeで解決し、既定0はM6A-028/029の従来テーパーを保持、1はサイズ縮小だけを無効化する。per-dab flow/depositはまだ共通envelopeをそのまま使いwhole-stroke opacity capは一定なので、サイズとopacity/depositの責務を分離した。sampled/custom tipもmicro-dab展開前のlogical radiusへ同じsize scaleを適用する。primitive dabへ解決済みradiusを保存するためWorker/history schema追加は不要。次はM6A-031 opacity taperから再開する。
M6A-031 opacity taper:完了
再開メモ: M6A-031 opacity taperはstroke.opacityTaperMinimumRatioを0..1で保持し、M6A-028/029の共通start/end envelopeからper-dab deposit scale = minimumRatio + (1-minimumRatio)*envelopeを解決する。既定0は従来どおり0までフェードし、1はopacity/deposit fadeだけを無効化する。whole-stroke strokeOpacity capは一定のまま、base flowへdeposit scaleを掛けるためM6A-030 size taperとは独立する。size minimumとopacity minimumの双方が非0ならraw envelope=0の開始/終端stampも可視になり得るため、その場合だけ通常のlogical stampとして保持・tip selectionを消費する。primitive dabには解決済みflow/opacityのみ保存しWorker/history schema追加は不要。次はM6A-032 forced taperから再開する。
M6A-032 forced taper:完了
再開メモ: M6A-032 forced taperはstroke.forceStartTaper / stroke.forceEndTaperを独立booleanとして保持する。通常のM6A-030/031ではsizeTaperMinimumRatio / opacityTaperMinimumRatioが各端の最小値を決めるが、Force In側ではstart envelopeそのものをsize/deposit scaleとして使い始点を0へ、Force Out側ではend envelopeそのものを使い終点を0へ強制する。片側だけ有効化可能で、start/end windowが重なる場合は各sideから得たscaleのminを採用して両zero-endpoint契約を保つ。既定false/falseなので既存presetは変更されない。whole-stroke strokeOpacity capは一定、primitive dabには解決済みradius/flowのみ保存する。将来のpressure/velocity dynamicsはforced taperのzero endpointを打ち消してはならない。次はM6A-033 real-time stabilizationから再開する。
M6A-033 real-time stabilization:完了
再開メモ: M6A-033 real-time stabilizationは既存presetのstabilization.amountを0..1 canonical値として接続し、amount=0を完全identity pathとする。描画geometryには独自実装のOne-Euro-style速度適応ローパスを因果的に適用し、低速時はjitterを強く抑え、高速時はfiltered velocityに応じてcutoffを上げ追従性を確保する。状態量と処理量はstroke長に依存せず1 sampleあたりO(1)。PaintStrokeSampleV1のraw confirmed samplesは履歴/保存正本として一切書き換えず、filter出力だけをCanonical Raster Brush builderへ渡すためstable prefixを再計算しない。pointerup時は最後のconfirmed raw座標へ追加segmentで1回だけ収束し、通常入力中の過去dabを巻き戻さない。predicted samplesは引き続きcanonical stateへ混入させない。次はM6A-034 post-stroke correctionから再開する。
M6A-034 post-stroke correction:完了
再開メモ: M6A-034 post-stroke correctionはpreset.stabilization.postStrokeAmountを0..1で保持し、0を完全identity/defaultとする。補正ON時だけpointerup後にraw confirmed samplesからM6A-033の因果filter geometryを決定的に再現し、そのgeometryへ距離比を使う対称neighbor-chord補正を最大4passで適用する。始点/終点は固定し、特に終点はconfirmed raw release位置を維持する。raw PaintStrokeSampleV1は変更せず、補正済みgeometryから同じstroke-start時brush config/random seedで最終dab列だけを1回再構築し、既存renderer.finalizeBaselineStrokeのrelease reconciliationへ渡す。通常入力中のincremental hot pathにはpost correctionのO(n)処理を入れない。M6A-033 real-time stabilizationとM6A-034 post correctionは独立設定で、後者は明示的に有効なstrokeだけrelease時O(n)、pass数は定数上限4。次はM6A-035 grain selectionから再開する。
M6A-035 grain selection:完了
再開メモ: M6A-035 grain selectionはBrushPresetV1.textureのresourceKind='grain' + resourceIdをcanonical選択契約とし、未選択は両fieldなし/nullで表現する。I-FINALの非paper grain 20件（fine 6 / rough 6 / fiber 5 / canvas 3）にはbuiltin.grain.<family>.<NN>の安定alias IDを確定した。これらはM6A-071/073で実payloadへmapするresource identityであり、schema helperはimport済みuser resource IDも保持できる。選択はpreset library永続化・PaintSession runtime snapshot・Brush Properties UIまで接続済み。M6A-037 strengthが0の間は選択だけで描画結果を変えず、M6A-036では同じtexture resource契約をpaper subtypeへ拡張する。次はM6A-036 paper texture selectionから再開する。
M6A-036 paper texture selection:完了
再開メモ: M6A-036 paper texture selectionはI-FINALの12 paper resourcesにbuiltin.grain.paper.01..12の安定aliasを割当て、ResourceV1.kindはgrainのままBrushPresetV1.texture.resourceSubtype='paper'で識別する。通常grainはresourceSubtype='grain'へ正規化し、grain/paperは同一texture resource slotを排他的に使用するため二重適用スタックにはしない。preset helper・library永続化・PaintSessionのkind/subtype/id snapshot・Brush Properties paper chooserまで接続済み。imported paper IDもcanonical resource identityとして保持可能。次はM6A-037 texture strengthから再開する。
M6A-037 texture strength:完了
再開メモ: M6A-037 texture strengthはBrushPresetV1.texture.strengthを0..1で保持し、0をexact identity/defaultとしてfield自体を省略可能にした。grain/paperのsingle texture resource slotとは独立parameterとしてpreset persistence・PaintSession snapshot・Brush Propertiesへ接続し、resource subtypeを切替えてもstrengthを保持する。I-FINAL sampled grain/paper payloadはM6A-071/073でロードされるため、この段階では仮procedural textureをcanonical Rasterへ焼き込まず、strength>0でもpayload未解決なら描画結果を変えない。実payload接続後は同じstrengthをcoverage modulationの正本として使う。次はM6A-038 texture scaleから再開する。
M6A-038 texture scale:完了
再開メモ: M6A-038 texture scaleはBrushPresetV1.texture.scaleをtexture-space倍率として0.01..16で保持し、1.0をidentity/defaultとしてfield省略可能にした。UIは1..1600%で編集し、grain/paper resource identity・strengthとは独立にpreset persistenceとPaintSession snapshotへcaptureする。M6A-071/073のsampled payloadが未解決な間はscaleだけで描画結果を変えず、実payload接続後に同じ倍率をsampling transformへ適用する。次はM6A-039 texture rotationから再開する。
M6A-039 texture rotation:完了
再開メモ: M6A-039 texture rotationはBrushPresetV1.texture.rotationDegreesを有限degreeとして受け、0..360へ正規化して0°をidentity/defaultとしてfield省略可能にした。UIは0..359°、PaintSessionも同じ正規化済み値を保持し、resource subtype・strength・scaleから独立する。sampled payload未解決中はrotationだけでcanonical pixelsを変えず、M6A-071/073接続後にscaleと合成したsampling transformへ適用する。次はM6A-040 texture blend behaviorから再開する。
M6A-040 texture blend behavior:完了
再開メモ: M6A-040 texture blend behaviorはBrushPresetV1.texture.blendModeをmultiply/subtract/addの3種coverage-domain modeとして定義し、multiplyをdefault/field省略値にした。layer RGB Blend Modeとは別系統で、pure helper combineBrushTextureCoverageV1がbrush coverage・sampled texture scalar・strengthだけを0..1で決定論的に合成し、RGB/色空間へ触れない。preset persistence・PaintSession snapshot・Brush Properties chooserへ接続済み。M6A-071/073で実sampled payloadが解決されるまではこのhelperをcanonical raster hot pathへ接続せず、既存stroke pixelsを変更しない。次はM6A-041 pressure→sizeから再開する。
M6A-041 pressure→size:完了
再開メモ: M6A-041 pressure→sizeはBrushPresetV1.dynamics.pressureSizeEnabledをopt-in booleanとして追加し、既定falseで既存strokeを完全互換にした。有効時はPenの保存済みraw pressure 0..1をstabilized geometryへ対応付け、logical stamp位置で距離比例補間してbase radius × taper size scale × pressureへ解決する。Mouseはpressure対応入力ではないためsize mapping上は1.0扱い。primitive dabには解決済みradiusだけを保存し、新しいdab/history schemaは増やさない。post-stroke correction再構築でも補正前geometry indexに対応するpressureを維持する。M6A-044 curveとM6A-049/050 min/maxはこのlinear 0..1基礎経路を後から拡張し、M6A-032 forced taperのzero endpointを打ち消してはならない。次はM6A-042 pressure→opacityから再開する。
M6A-042 pressure→opacity:完了
再開メモ: M6A-042 pressure→opacityはBrushPresetV1.dynamics.pressureOpacityEnabledをopt-in booleanとして追加し、既定falseで既存strokeを互換維持する。有効時はM6A-041と同じPen raw pressure 0..1をlogical stamp位置へ距離比例補間し、base strokeOpacity cap × pressureへ解決する一方、per-dab flow/depositは変更しない。Raster paintのcoverage累積は固定opacityで従来式と代数的に等価なeffectiveNext = effectivePrev + max(0, opacityCap-effectivePrev) × depositへ整理し、pressure低下で既描画alphaを巻き戻さず、pressure上昇時はflowで新しいcapへ収束する。追加per-tile bufferは不要。Mouseはpressure mapping上1.0、primitive dabは既存strokeOpacityへ解決済み値を保存するためdab/history schema追加はない。次はM6A-043 pressure→flowから再開する。
M6A-043 pressure→flow:完了
再開メモ: M6A-043 pressure→flowはBrushPresetV1.dynamics.pressureFlowEnabledをopt-in booleanとして追加し、既定falseで既存strokeを互換維持する。有効時はM6A-041/042と同じPen raw pressureをlogical stamp位置へ距離比例補間し、base flow × taper deposit scale × pressureへ解決する。strokeOpacity capは変更しないためM6A-042とは独立し、Raster paintではflowが現在のeffective coverageからopacity capへ近づく速度だけを制御する。Mouseはneutral 1.0、primitive dabには既存flowへ解決済み値だけを保存するためrenderer/history schema追加は不要。pressure→size/opacity/flowを同時に有効化しても同一pressure scalarから各軸を独立解決する。次はM6A-044 pressure response curveから再開する。
M6A-044 pressure response curve:完了
再開メモ: M6A-044 pressure response curveはIP-12 Shared Curve Editor契約に従い、0→0 / 1→1固定・input昇順・output単調の2..16 node canonical curveを追加した。runtime評価はmonotone PCHIP/Fritsch-Carlson-style補間をstroke開始時にcompileし、logical stampごとに補間済みraw pressureをcurveへ1回だけ通して、その同一responseをM6A-041 size / 042 opacity / 043 flowの各opt-in mappingへ配る。linearはexact identity/defaultでpreset fieldを省略する。Tool Propertiesには共有Curve Editorを接続し、canvas上tapでnode追加、drag編集、選択nodeの正確な入出力%、Delete、Reset、Linear/Soft/Hard/S presetsを提供する。Mouseはneutral 1.0のまま。M6A-049/050のminimum/maximum responseは未適用で、forced taper zero endpointは引き続き優先する。次はM6A-045 tilt mappingから再開する。
M6A-045 tilt mapping:完了
再開メモ: M6A-045 tilt mappingはPenのaltitudeAngleを優先し、未提供時はPointer Events tiltX/tiltYから同じ高度角へ変換して、0=水平・1=直立のnormalized tilt uprightnessをlogical stamp位置へ距離比例補間する。直立/tilt未報告/Mouseは1.0となるため既存ブラシはneutral fallbackを維持する。BrushPresetV1.dynamicsにはtiltSizeEnabled / tiltOpacityEnabled / tiltFlowEnabled（既定false）とtiltResponseCurve（linear既定）を追加し、shared Curve Editorを再利用する。各mappingはpressureとは独立に同じtilt responseをsize / opacity cap / flowへ乗算し、primitive dabには解決済みradius/strokeOpacity/flowのみを残す。M6A-046 orientation mappingがazimuth/pen direction/twist系の角度方向を所有し、M6A-049/050が後続のminimum/maximum responseを所有する。次はM6A-046 orientation mappingから再開する。
M6A-046 orientation mapping:完了
再開メモ: M6A-046 orientation mappingはPenのazimuthAngleを画面+X基準の時計回り方位として優先し、未提供時はPointer Events仕様のtiltX/tiltY→azimuth変換規則で復元する。twistはスタイラス主軸回りの時計回り追加回転として方位へ加算する。stamp間の角度補間は最短円弧を使い、359°→1°で180°側へ回り込まない。`dynamics.penOrientationEnabled`は既定false。ON時の最終先端角は `pen orientation + tip.angleDegrees - tip.directionDegrees`、OFF時は既存のstroke.followRotation/fixed規則を保持する。Pen orientationはstroke-followより優先し、UIでは両者を排他的rotation sourceとして選択する。primitive dabには従来どおり解決済みtipAngleDegreesだけを保存しWorker/history ABIは増やさない。次はM6A-047 velocity mappingから再開する。
M6A-047 velocity mapping:完了
再開メモ: M6A-047 velocity mappingはraw confirmed PaintStrokeSampleV1のdocument-space距離とtimestampMs差から速度を算出し、既定2000 document px/s（設定可能100..20000）をnormalized 1.0として0..1へclampする。初回sampleは0、timestampが同一または逆行するsampleは直前normalized速度を保持して無限大spikeを作らない。velocity値はstabilization前のraw入力を正本とし、stabilized geometry上のlogical stamp位置へ線形補間するためFPSや手ブレ補正強度に依存しない。dynamics.velocitySizeEnabled / velocityOpacityEnabled / velocityFlowEnabledは既定false、velocityResponseCurveはShared Curve Editorのlinear既定で、pressure/tiltと独立にsize / strokeOpacity cap / flowへ乗算する。post-stroke correction時もraw samplesから同じ速度列を決定的に再生成する。primitive dabには解決済みradius/strokeOpacity/flowだけを保存しvelocity専用renderer/history fieldは追加しない。次はM6A-048 random dynamicsから再開する。
M6A-048 random dynamics:完了
再開メモ: M6A-048 random dynamicsはstrokeId由来の保存済みuint32 randomSeedからlogical stamp attemptごとに決定的な0..1 random inputを生成する。tip random selectionとは固定saltとattempt indexを分離し、random dynamicsのON/OFFやseedがM6A-027のtip選択順を変えない。randomSizeEnabled / randomOpacityEnabled / randomFlowEnabledは既定false、randomResponseCurveはShared Curve Editorのlinear既定で、1つのrandom responseをsize / strokeOpacity cap / flowへ独立に乗算する。randomStampIndexはtaperやresponseでstampが非表示になってもattemptごとに進み、可視logical stamp recordには生成済みrandomInputを保持するためend-tail reconciliationで再抽選しない。random dynamicsが有効ならtip random未使用でもstroke randomSeedを保存し、post-stroke correctionの再構築も同じseedで決定的に一致する。primitive dab / Worker / Historyにはrandom専用fieldを追加せず解決済みradius/strokeOpacity/flowだけを保存する。M6A-049/050のminimum/maximum responseは未実装のまま保持し、次はM6A-049 min responseから再開する。
M6A-049 minimum response:完了
再開メモ: M6A-049 minimum responseはCanonical Brush ModelのDynamicMappingV1 clamp.minに対応し、source個別ではなく動的targetごとのsizeMinimumResponse / opacityMinimumResponse / flowMinimumResponseを0..1で保持する。既定0は従来挙動と完全互換。pressure / tilt / velocity / randomのうち各targetで有効なresponseを従来どおり乗算した後、その合成responseへtarget別minimumを適用し、最後にbase size / strokeOpacity cap / flowへ解決する。動的sourceが無効なtargetはneutral response=1なのでminimumを設定してもbase値を下げない。start/end taperはminimum clampの外側で乗算されるためM6A-032 forced taperの0 endpointを復活させない。primitive dab / Worker / Historyにはminimum専用fieldを追加せず解決済みradius/strokeOpacity/flowのみを保持する。次はM6A-050 maximum responseから再開する。
M6A-050 maximum response:完了
再開メモ: M6A-050 maximum responseはM6A-049と対になるDynamicMappingV1 clamp.maxとしてsizeMaximumResponse / opacityMaximumResponse / flowMaximumResponseを0..1で保持し、既定1を完全互換値とする。各targetにpressure / tilt / velocity / randomのいずれかが有効な場合だけ、source responseを従来どおり乗算した結果へ[min,max] clampを適用する。dynamic sourceが1つも無いtargetはneutral response=1を維持するためmaximumを下げても静的base size/opacity/flowは変化しない。preset/runtimeはminimum <= maximumを強制し、preset切替時は3 targetのboundsをatomicにcaptureする。UIも各minimum/maximumの相互範囲を制約する。start/end/forced taperはresponse clampの外側に残りzero endpointを維持する。primitive dab / Worker / Historyにはbounds専用fieldを追加しない。次はM6A-051 size jitterから再開する。
M6A-051 size jitter:完了
再開メモ: M6A-051 size jitterはCanonical Brush Modelのjitter.sizeを0..1の直接変動量として保持し、0を完全identity/defaultとする。logical stamp attemptごとにstroke randomSeed + size-jitter専用saltから決定的0..1値を生成し、最終radiusへ(1 - amount * random)を乗算するためbase sizeを上回らない一方向variationとなる。M6A-048 generalized random dynamicsとはrandom channelとattempt indexを分離し、tip random selectionとも独立する。start/end taper・dynamic min/max responseの外側でサイズへ乗算するためforced taperの0 endpointを復活させない。可視logical stamp recordには解決済みsizeJitterScaleを保持し、end-tail reconciliationで再抽選しない。size jitterが有効なら他のrandom機能がOFFでもstrokeId由来uint32 randomSeedを保存し、post-stroke correction再構築でも同一結果を得る。primitive dab / Worker / Historyにはjitter専用fieldを追加せず解決済みradiusのみを保存する。次はM6A-052 opacity jitterから再開する。
M6A-052 opacity jitter:完了
再開メモ: M6A-052 opacity jitterはCanonical Brush Modelのjitter.opacityを0..1の直接変動量として保持し、0を完全identity/defaultとする。logical stamp attemptごとにstroke randomSeed + opacity-jitter専用saltから決定的0..1値を生成し、dynamic responseで解決したstrokeOpacity capへ(1 - amount * random)を乗算するためbase opacityを上回らない一方向variationとなる。M6A-051 size jitter / M6A-048 generalized random dynamics / M6A-027 random tip selectionとはsaltとattempt indexを分離し、各機能のON/OFFで他系列をずらさない。start/end/forced taperはper-dab flow側の責務を維持し、opacity jitterはflow/depositを変更しない。可視logical stamp recordには解決済みopacityJitterScaleを保持しend-tail reconciliationで再抽選しない。opacity jitterが有効なら他のrandom機能がOFFでもstrokeId由来uint32 randomSeedを保存し、post-stroke correction再構築でも同一結果を得る。primitive dab / Worker / Historyにはjitter専用fieldを追加せず解決済みstrokeOpacityだけを保存する。次はM6A-053 rotation jitterから再開する。
M6A-053 rotation jitter:完了
再開メモ: M6A-053 rotation jitterはCanonical Brush Modelのjitter.rotationを0..1のランダム強度として保持し、0を完全identity/defaultとする。logical stamp attemptごとにstroke randomSeed + rotation-jitter専用saltから決定的0..1値を生成し、(random - 0.5) * 360° * amountをstatic tip angle / intrinsic direction / follow-stroke rotation / pen orientationで解決済みの角度へ最後に加算する。100%は-180°以上+180°未満の全方位offsetを覆い、0%は既存angle pathを一切変更しない。M6A-051 size / M6A-052 opacity / M6A-048 generalized random / M6A-027 tip selectionとはsaltとattempt indexを分離する。taper等で非表示になったlogical attemptでもindexは進め、可視recordにはjitter適用済みtipAngleDegreesを保持するためend-tail reconciliationで再抽選しない。rotation jitterが有効なら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一角度列を再構築する。primitive dab / Worker / HistoryにはrotationJitter専用fieldを追加せず既存tipAngleDegreesだけを保存する。次はM6A-054 position/scatter jitterから再開する。
M6A-054 position/scatter jitter:完了
再開メモ: M6A-054 position/scatter jitterはCanonical Brush Modelのjitter.positionを0..1で保持し、0を完全identity/defaultとする。M6A-057のSpray/particle modeとは分離し、本段階ではlogical stamp中心だけを2Dランダム移動する。stroke randomSeed + position-jitter専用angle/radius saltからlogical stamp attemptごとに等方なunit-disk vectorを決定論的に生成し、base brush diameter * amountを最大半径としてdocument-spaceへ加算する。spacing、path distance、stroke tangent、stabilization geometry、velocity計算にはjitter後座標をfeedbackせず、元のcanonical stroke centerlineを維持する。M6A-051 size / M6A-052 opacity / M6A-053 rotation / M6A-048 generalized random / M6A-027 tip selectionとはrandom channelとattempt indexを分離し、非表示attemptでもposition indexを進める。可視logical recordへjitter済みx/yを保存するためend-tail reconciliationで再抽選しない。position jitterが有効なら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一位置列を再構築する。primitive dab / Worker / HistoryにはpositionJitter専用fieldを追加せず解決済みx/yだけを保存する。次はM6A-055 density jitterから再開する。
M6A-055 density jitter:完了
再開メモ: M6A-055 density jitterはCanonical Brush Modelのjitter.densityを0..1で保持し、M6A-022 tipDensity（先端mask coverage密度）へlogical stamp単位の直接variationとして適用する。0は完全identity/default、scaleは1 - amount * deterministicRandomでbase tipDensityを上回らない。これはM6A-057 Sprayのparticle density/個数ではなく、通常の1 logical stamp = 1 selected tipという境界を維持する。sampled-image tipが複数micro-dabへ展開される場合も1つのlogical stampで解決した同一density scaleを全micro-dabが共有する。Flow/Opacity/Textureとは独立し、M6A-051 size / 052 opacity / 053 rotation / 054 position / 048 generalized random / 027 tip selectionとはsaltとattempt indexを分離する。非表示attemptでもdensity indexを進め、可視logical recordにはdensityJitterScaleを保持するためend-tail reconciliationで再抽選しない。density jitterが有効なら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一coverage列を再構築する。primitive dab / Worker / HistoryにはdensityJitter専用fieldを追加せず解決済みtipDensityだけを保存する。次はM6A-056 color jitterから再開する。
M6A-056 color jitter:完了
再開メモ: M6A-056 color jitterはCanonical Brush Modelのjitter hue / saturation / valueを各0..1で保持し、0を完全identity/defaultとする。main/sub color選択・混合はM6A-064へ残し、本段階では現在のbrush RGBをworking-space RGB上のHSVへ一時変換してlogical stamp attemptごとに色相・彩度・明度を独立に揺らし、再び既存RGB primitive colorへ解決する。色相100%は±180°、彩度/明度100%は各±1.0の対称deltaをclampして使用する。3成分はstroke randomSeed + 成分別saltから同一color-attempt indexで決定し、他のrandom/jitter系列と独立する。非表示attemptでもcolor indexを進め、可視logical recordに解決済みRGBを保持するためend-tail reconciliationで再抽選しない。sampled-image tipのmicro-dab群は同じlogical stamp色を共有する。color jitterが有効なら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一色列を再構築する。primitive dab / Worker / Historyにはcolor-jitter専用fieldを追加せず既存colorだけを保存する。次はM6A-057 spray/particle modeから再開する。
M6A-057 spray/particle mode:完了
再開メモ: M6A-057 spray/particle modeはCanonical Brush Modelのspray.enabledをbooleanとして保持し、falseを完全identity/defaultとする。ONでは通常の1 logical stamp = 1 tip出力を、同じlogical stamp属性を共有する決定論的multi-particle burstへ切り替える。M6A-057ではモード境界を成立させるため暫定baselineとして4 particles / particle radius scale 0.35 / spread radius = base brush radius / orientationは親logical stamp角度継承を固定使用し、M6A-058 size、059 density/count-rate、060 spread/distribution、061 orientationで各値を順次canonical parameter化する。各particle中心はstroke randomSeed + spray専用angle/radius salt + logical attempt index + particle indexから等方unit-disk上に決定し、position jitter後のlogical centerをburst中心とするがspacing/path/tangentへfeedbackしない。spray attempt indexは非表示attemptでも進み、可視logical recordには解決済みparticle centersを保持するためend-tail reconciliationで再抽選しない。size/opacity/density/color/angle/tip assetは親logical stampで一度解決されburst内で共有し、sampled tipは各particleごとに既存micro-dab展開を使う。sprayがONなら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一particle列を再構築する。primitive dab / Worker / Historyにはspray専用fieldを追加せず既存x/y/radius/color等だけを保存する。次はM6A-058 particle sizeから再開する。
M6A-058 particle size:完了
再開メモ: M6A-058 particle sizeはM6A-057で固定していたparticle radius scale 0.35をspray.particleSizeRatioとして0.01..4でcanonical parameter化し、既定0.35で057出力を完全互換に保つ。値は親logical stampのsize taper / pressure・tilt・velocity・random dynamics / dynamic min-max clamp / size jitterで解決済みradiusへ最後に乗算するため、粒子サイズだけを変更してburst中心・particle count・spread・orientation・color・opacity・densityを変えない。Scatter OFFではこの値を設定しても通常stampへ影響しない。preset/runtime/facade/UIを接続し、primitive dab / Worker / Historyには専用fieldを追加せず解決済みradiusのみ保存する。UIは1..400%で、Scatter OFF時は無効化する。次はM6A-059 particle densityから再開する。
M6A-059 particle density:完了
再開メモ: M6A-059 particle densityはSprayの散布量を通常tipのM6A-022 tipDensity / M6A-055 density jitterから分離し、spray.particleDensityを1 logical stampあたり1..32 particlesの明示単位として保持する。既定4でM6A-057/058出力を完全互換にする。粒子index 0..N-1へ既存のstroke seed + spray stamp index + particle index決定列を使うため、densityを増やした場合も既存先頭particleの位置・radius・angle・color等は不変で末尾にparticleが増える。spread radius/distributionはM6A-060、orientationはM6A-061の責務として本段階では変更しない。M6A-055 density jitterはtip mask coverageのみを変えparticle countには影響しない。Scatter OFFではparticleDensityはinert。上限32でlogical stamp fanoutを有界化し、sampled-tip micro-dab展開時の過剰fanoutを抑える。preset/runtime/facade/UIを接続し、primitive/Worker/Historyには専用fieldを追加せず解決済みdab列のみ保存する。次はM6A-060 particle spreadから再開する。
M6A-060 particle spread:完了
再開メモ: M6A-060 particle spreadはCanonical Brush Modelのradial scatter distributionをspray.spreadRadiusRatio（base brush radius比0..4、既定1）とspray.deviation（-1..1、既定0）で実装する。既定1/0ではM6A-057〜059のunit-disk散布を完全互換に維持する。spreadRadiusRatioはposition-jitter後のlogical centerからの最大散布半径だけをscaleし、粒子radius/count/angle/color/opacity/densityやstroke spacing/path/tangentへfeedbackしない。deviationは同じdeterministic particle angle/radial sampleを再利用し、正値ではradiusを中心側へ線形圧縮、負値では外周側へ線形補間するため新しい乱数系列を追加しない。0は既存uniform-area unit-diskをそのまま返し、+1は中心、-1は外周へ極限化する。可視logical recordは変換後particle centerを保持するためend-tail reconciliationで再抽選しない。Scatter OFFでは両値ともinert。preset/runtime/facade/UIを接続しprimitive/Worker/Historyには専用fieldを追加しない。次はM6A-061 particle orientationから再開する。
M6A-061 particle orientation:完了
再開メモ: M6A-061 particle orientationはspray.angleBasedOnCenter boolean（既定false）で実装する。falseはM6A-057〜060と完全互換で全particleが親logical stampの解決済みtipAngleDegreesを継承する。trueではposition jitter / spread / deviation適用後のlogical center→particle center径方向角を親の解決済みtip angleへ加算してnormalizeし、static angle/direction・follow rotation・pen orientation・rotation jitterを相対offsetとして保つ。spread=0やdeviation=+1等で径方向長が0の場合は親角度へfallbackする。particle count/center/radius/color/opacity/densityは変えず、可視logical recordのsprayParticlesへ解決済みparticle tipAngleDegreesを保持するためend-tail reconciliationで角度を再計算・再抽選しない。sampled-image tipもparticle単位で同じ解決角度をmicro-dab expansionへ渡す。Scatter OFFではinert。preset/runtime/facade/UIを接続しprimitive/Worker/Historyには新しい設定fieldを追加せず既存tipAngleDegreesのみ保存する。次はM6A-062 ordinary raster color mixingから再開する。
M6A-062 ordinary raster color mixing:完了
再開メモ: M6A-062はcolorMix.enabled / canvasRatio / depositAmountを通常Raster paintへ接続した。canvasRatioは0..1（既定0.5）で現在のactive Raster Layer画素をdestination alphaで重み付けしてlinear-light RGB混色するため透明画素のhidden/black RGBを取り込まない。depositAmountは0..1（既定1）で既存flow/stroke-opacity accumulationの前にcoverageをscaleする。解決済み設定はcanonical dabへ保存されWorker/History/Recoveryで決定的に再生される。mix-enabled dabはdestination samplingが必要なためcanonical Raster Tile preview/recompositionへfallbackし、OFF時は既存GPU fast path/outputを維持する。sample/pickup radius・pickup amount・carried color・drag/extensionはM6A-063の責務として未実装のまま残す。次はM6A-063 wet/smudge-style pickupから再開する。
M6A-063 wet/smudge-style pickup:完了
再開メモ: M6A-063はcolorMix.sampleRadiusRatio（0..3、既定0.5）/ pickupAmount（0..1、既定0）/ carryAmount（0..1、既定0.85）を通常Raster paintのstateful reservoirへ接続した。pickupAmount=0はM6A-062と完全互換。pickup有効時は各dabの変更前active Raster Layerだけを固定13点disk latticeでO(1) samplingし、premultiplied RGBAでreservoirへ取り込む。carryAmountは前dab reservoirの保持率、pickupAmountは現在sampleの取り込み率として独立し、reservoir alphaを含めて下地色比率へ反映する。解決済み3値はcanonical dab/Worker/Historyへ保存され、再生時は同じ初期Tile+dabsからreservoirを決定論的に再構築する。基本Smudge displacement（M6A-003）とは別経路で、merged compositeや下位layerはsampleしない。次はM6A-064 main/sub color behaviorから再開する。
M6A-064 main/sub color behavior:完了
再開メモ: M6A-064はBrush ink.subColorRatio（0..1、既定0）を実装し、既存M5D Color WorkspaceのcurrentをMain、previousをSub/Swap色としてcanonical stroke開始時にcaptureする。0は既存Main-only出力と完全互換、1はSub-only、中間値はshared RGB transferによるlinear-light補間。main/sub解決後にM6A-056 HSV jitterを適用し、primitive dabには最終RGBだけを保存するためWorker/History/Undo/Redo/Recovery ABIは増やさない。Tool Propertiesへ副色比率slider+数値入力を接続しpreset/runtimeへ保存する。次はM6A-065 reference-aware anti-overflow paintingから再開する。
M6A-065 reference-aware anti-overflow painting:完了
再開メモ: M6A-065はBrush ink.referenceAntiOverflow boolean（既定false）を通常Raster paintへ接続し、既存roleFlags.referenceのvisible root Raster Layersを境界sourceとして再利用する。active target layerは自己生成pixelを境界化しないよう除外し、参照Rasterが無い場合とOFF時は既存出力を完全identityに保つ。各logical stampは解決済みreference originをprimitive dabへ共有し、sampled-tip micro dab/Spray particleも同一origin判定を使う。参照alpha>1/255をbarrierとし、前回受理origin→新originのsegmentがbarrierを横切るstampを拒否、受理stampはprimitive union bounds内だけscanline 4-connect flood fillしてoriginから到達可能な非barrier pixelへcoverageをclipするため、中心の飛び越しとbrush-radiusの線越えを両方防ぐ。whole canvas flood fill/region labelは作らず有効時のlocal boundsだけ処理する。anti-overflow dabはcanonical Raster Tile previewへ切替え、resolved enable/originをWorker/History/Recoveryへ保持する。Eraser/Smudge/Blur、M6A-062/063 reservoir、将来のLineart Boundary topology unionは別責務。次はM6A-066 hover brush outlineから再開する。
M6A-066 hover brush outline:完了
再開メモ: M6A-066は既存PointerHoverTrackerV1のpen/mouse非接触hoverをproductionのscreen-space brush outlineへ接続した。hover snapshotへclientX/clientYを保持し、Viewport Controllerの既存mapPointerToDocumentでpan/zoom/rotation/mirror後もdocument内判定を行う。円の中心はstage内の実pointer位置、直径は現在Brush Parametersのnominal sizePxをfit base scale×zoomでCSS pxへ投影する。hover pressure=0で径を潰さず、touch/contact/pointerleave/document外/no-documentでは非表示。overlayはpointer-events:noneかつRenderer/History/Persistence/Exportへ入らず、viewport変更とpreset/property変更でも即refreshする。M6A-067のcrosshairは未実装のまま分離。次はM6A-067 hover crosshair optionから再開する。
M6A-067 hover crosshair option:完了
再開メモ: M6A-067はM6A-066のscreen-space hover overlayへ任意中心十字を追加した。これはBrush Presetの画材属性ではなく表示設定としてBrushHoverDisplaySettingsV1が保持し、既定OFF。表示メニューの「ブラシ中心十字」buttonで切替え、outlineのdata-crosshairだけを更新するためhover位置/径計算・Renderer・stroke/history/persistenceには影響しない。十字はCSS pseudo-elementsでscreen-space固定9px、白線+暗縁の高コントラスト表示とし、outline hidden時は同時に消える。次はM6A-068 global/default pressure response controlsから再開する。
M6A-068 global/default pressure response controls:完了
再開メモ: M6A-068はapplication-levelのglobal/default pressure response curve（既定linear、localStorage永続）をShared Curve Editorへ接続した。Brush presetに`dynamics.pressureResponseCurve`が無い場合だけglobalを継承し、明示curveはglobalをoverrideする。globalがnon-linearでもper-brush explicit Linearを表現できるようLinear選択でもoverride fieldを保持し、「既定に戻す」でのみfieldを削除する。global変更はinherit中の選択brushへ即時再解決するがpreset payload自体は書換えず、解決後curveは既存PaintSessionへ渡すためRenderer/Worker/History/Persistence ABIは不変。次はM6A-069 touch-position/input correction policyから再開する。
M6A-069 touch-position/input correction policy:完了
再開メモ: M6A-069は既存PointerInputArbitrationV1のpalm rejection/finger-drawing境界を維持し、application-level touch policyをlocalStorage永続UIへ接続した。指描画ON/OFFとX/Y補正（各±256 CSS px、既定0）を設定でき、補正はtouchが単指toolと判定された後のbridgeだけでconfirmed/predicted双方のclientX/clientYとsurfaceX/surfaceYへ適用する。raw batchはimmutable、pen/mouse・palm reject・multi-touch navigation/pinch/panは完全identity。OS/driver/browser内部の未公開palm rejectionやdigitizer calibrationは制御対象外。次はM6A-070 configurable stylus-button action plumbingから再開する。
M6A-070 configurable stylus-button action plumbing:完了
再開メモ: M6A-070は標準Pointer Eventsで公開されるPen第1バレル（buttons bit 2）をconfirmed sampleの状態遷移で検出し、generic commandId binding + press/release invocationへ接続した。既定はtool.eyedropper.temporaryで、既存ColorSamplingOwnershipのquick pathを再利用する。keyboard Altとstylusは独立source ownershipなので片方のreleaseが他方を解除しない。設定はlocalStorage永続・View→ペンボタン設定から一時スポイト/なしを選択可能。predicted/mouseはactionを発火せず、blur/cancelでheld actionを解放する。完全なCommand Registry選択肢はM8Gへ接続するがbinding形式は同じcommandId境界を使用する。次はM6A-071 final 77 sampled resources loaderから再開する。
M6A-071 final 77 sampled resources loader:完了
再開メモ: M6A-071はI-FINALの凍結済み77件inventory semanticsを維持しつつ、消失したaccepted ZIP bytesについてユーザー明示許可を得て決定論的再生成へ移行した。新canonical packageは`ILLUSTRO_I_FINAL_PRODUCTION_ASSETS_2026-09-04.zip`、SHA-256=`7ba886fd15e22fcce3d6b0ae0004c85eb8370626346a00cff3d40c0955ad2eec`、source manifest SHA-256=`97d44976ab0e87b8f3ae5538afa8f5c809b7497a6c060559d74902e0cfaa1355`。33 brush-tip / 32 grain（paper 12）/ 12 patternの77件、exact duplicate 0、maximum same-kind correlation 0.9694<=0.995、maximum seam score 0.0237<=0.12、再生成2回のZIP SHA一致を確認した。production buildはdeterministic generatorから`.build/generated-public/assets/sampled`を生成してdistへ統合し、manifest/payload loaderはsafe relative path・frozen grain/paper alias・byteLength/SHA-256・verified-only lazy cacheをfail-closedで検証する。標準CI run 33864874154 / commit cb6f53fc02414ac6cd1defb515a37c531a89a486でformat/lint/typecheck/unit/M1-M5D/build/integration/deployment/build identityが全PASS。設計正本には旧2026-08-30 hashを履歴として残し、I-FINAL-5で2026-09-04 identityへのsupersessionを明示した。次はM6A-072 brush-tip resource managerから再開する。
M6A-072 brush-tip resource manager:完了
M6A-073 grain resource manager:完了
M6A-074 paper resource manager:完了
M6A-075 pattern resource manager:完了
M6A-076 48-preset Default Brush Pack integration:完了
M6A-077 deterministic brush thumbnails:完了
M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:完了
M6A-PERF-002 retained tile/dirty-region presentation（normal hot pathでwhole-stroke/whole-history replay禁止）:完了
M6A-PERF-003 incremental GPU/transfer submission（累積stroke比例の毎回allocate/copy/destroy禁止）:完了
M6A-PERF-004 long-stroke scaling workload verification:完了
M6A-検査 M6A内部検査:完了

## M6B — Brush Interoperability
M6B-001 `.illbrush` parser:完了
M6B-002 `.illbrush` writer:完了
M6B-003 Illustro brush import:完了
M6B-004 Illustro brush export:完了
M6B-005 ibisPaint custom brush parser:完了
M6B-006 ibisPaint brush QR carrier decode:完了
M6B-007 ibis→Illustro parameter mapper:完了
M6B-008 CSP `.sut` parser:完了
M6B-009 CSP→Illustro parameter mapper:完了
M6B-010 unsupported brush property reporting:完了
M6B-011 imported brush canonical normalization:完了
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
M8C-019 Lasso direct high-frequency entry in canonical Eyedropper→Lasso→Text interval:未完了
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
M8G-018 Touch one-finger draw / two-or-more navigation arbitration:未完了
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
M8I-003 Narrow full-editor responsive layout:未完了
M8I-004 narrow full-editor compact top command surface:未完了
M8I-005 narrow full-editor persistent bottom action strip:未完了
M8I-006 narrow full-editor Inspector sheet/overlay access:未完了
M8I-007 narrow full-editor safe-area / capability-preserving access:未完了
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
M8I-検査 M8I内部検査:未完了

## M8J — Canonical Input / Parameter Interaction System
M8J-001 Direct / Quick / Detail 3-layer input hierarchy:未完了
M8J-002 one canonical parameter state with multiple presentation/input paths:未完了
M8J-003 canonical input-component taxonomy and parameter metadata registry:未完了
M8J-004 semantic value-mapping policy（linear / perceptual / bipolar / stepped / circular / range / curve）:未完了
M8J-005 Adaptive Scalar Control shared component:未完了
M8J-006 Brush Size small-value-priority perceptual mapping:未完了
M8J-007 Eraser/Blur/Scatter/Texture Scale wide-range perceptual mapping where applicable:未完了
M8J-008 soft interaction range / hard numeric range separation:未完了
M8J-009 per-tool/per-brush meaningful soft-range limits:未完了
M8J-010 Bipolar Slider with explicit neutral-zero marker/reset:未完了
M8J-011 stepped integer / semantic-step controls:未完了
M8J-012 Range/Min-Max control with touch-safe handle ownership:未完了
M8J-013 angle/circular parameter control policy:未完了
M8J-014 shared Curve Editor component:未完了
M8J-015 XY/2D field control for genuinely two-dimensional parameters:未完了
M8J-016 tap-to-edit numeric value editor:未完了
M8J-017 numeric expression and compatible unit entry（+/-/*//, px, %, degree, physical units where valid）:未完了
M8J-018 Touch slider-distance Fine Adjustment:未完了
M8J-019 Mouse/trackpad label/value scrub with variable precision:未完了
M8J-020 Keyboard Arrow/modifier precision stepping:未完了
M8J-021 magnitude-aware semantic step sizing:未完了
M8J-022 Saved Parameter Marks / per-preset quick-value memory:未完了
M8J-023 saved/neutral/snap-point feedback and optional restrained haptics:未完了
M8J-024 per-parameter modified/default indication and one-action reset:未完了
M8J-025 transient live preview→release/Apply single history transaction:未完了
M8J-026 Cancel/Esc restores exact pre-interaction parameter state:未完了
M8J-027 parameter-specific visual result preview（brush outline / affected region / direction / stroke preview）:未完了
M8J-028 tool Quick Controls limited to highest-frequency ~3 controls:未完了
M8J-029 Tool Properties automatic contextual content switching:未完了
M8J-030 responsive parameter-control compaction without capability loss:未完了
M8J-031 choice-control taxonomy（toggle / segmented / popover / sheet / visual grid）:未完了
M8J-032 large picker Recent / Favorites / Category-Tag / Search hierarchy:未完了
M8J-033 categorized searchable Blend Mode chooser with Recent/Favorites:未完了
M8J-034 Brush Tip/Texture/Pattern/Gradient visual Asset Picker:未完了
M8J-035 Layer/Object/Reference semantic picker:未完了
M8J-036 Color direct interactions（current-color tap, previous-color recall, swatch drag-to-fill）:未完了
M8J-037 Eyedropper split current/new loupe and magnified sampling feedback:未完了
M8J-038 Eyedropper source/radius/averaging + sampled-content layer reverse lookup:未完了
M8J-039 Color compact primary selector + progressive RGB/HSV/HEX/Alpha detail:未完了
M8J-040 Gradient on-canvas line/stop/midpoint editing and drag-out delete preview:未完了
M8J-041 Transform direct handles paired with exact numeric Inspector editing:未完了
M8J-042 Vector/Ruler/Lineart controls show only contextually relevant handles:未完了
M8J-043 Draw-and-Hold Smart Shape interaction:未完了
M8J-044 Fill/Auto Select hold-drag threshold/tolerance adjustment with live region feedback:未完了
M8J-045 Quick Mask direct brush add/subtract editing with configurable overlay:未完了
M8J-046 Dynamics entry attached to applicable parameter without permanent visual clutter:未完了
M8J-047 Pressure/Tilt/Velocity shared curve editing + reusable curve presets:未完了
M8J-048 live stylus-input monitor during dynamics setup where capability exists:未完了
M8J-049 Brush preset temporary Modified state / Reset / Save / Save As workflow:未完了
M8J-050 Brush Studio shared Drawing Pad/live stroke preview:未完了
M8J-051 multi-selection Mixed Value presentation:未完了
M8J-052 multi-selection Mixed Value absolute edit + explicit/modifier relative-adjust semantics:未完了
M8J-053 layer/filter/panel/asset reorder insertion target live preview before drop:未完了
M8J-054 contextual mini-surface placement avoids target, active pen, handles and workspace boundaries:未完了
M8J-055 Quick Hole tap + press-slide/marking accelerator without making empty center a canvas-blocking permanent hit target:未完了
M8J-056 gesture accelerators remain supplemental; every required action has discoverable UI/command path:未完了
M8J-057 shortcut/stylus binding recorder captures actual key/button input and reports conflicts:未完了
M8J-058 input-device specialization（Pen precision, Touch UI/direct, Mouse scrub, Keyboard acceleration）:未完了
M8J-059 visual handle size separated from >=44 CSS px effective touch target where required:未完了
M8J-060 responsive Popover/Sheet selection based on available space/input modality:未完了
M8J-061 accessibility semantics/labels/focus for symbolic and custom controls:未完了
M8J-062 locale-safe numeric display, entry and unit parsing:未完了
M8J-063 interaction-state consistency across slider/curve/gradient/transform/context controls:未完了
M8J-064 no independent duplicate state between Direct/Quick/Detail controls:未完了
M8J-065 Canonical Input System component/integration regression suite:未完了
M8J-066 Touch/Pen/Mouse/Keyboard physical-device interaction verification:未完了
M8J-検査 M8J内部検査:未完了
M8-検査 M8全体内部検査:未完了

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

### USER-01 mobile compatibility remediation — 2026-09-02
MOBILE-001 Service Worker build-aware update/cache strategy:完了
MOBILE-002 WebGPU/Renderer failure diagnostics（main/worker/adapter/device/limit/surface）:完了
MOBILE-003 phone full-editor targetを設計正本で正式採用・旧<600px非対応方針をSUPERSEDE:完了
MOBILE-004 600 CSS px hard eligibility gateを廃止しresponsive layout条件へ変更:完了
MOBILE-005 Renderer fallback chain（WebGPU Worker/Main → compatibility backend）を実装:完了
MOBILE-006 Canonical Raster Tile / History / Persistenceを全renderer backendで共通化:完了
MOBILE-008 phone single-finger draw → multi-touch navigation arbitration:完了
MOBILE-009 smartphone Canvas First operation shell（compact top / bottom actions / Inspector sheet）:完了
MOBILE-010 smartphone safe-area・44px touch target responsive hardening:完了
MOBILE-007 smartphone実機・最低限のcompatibility regression確認:未完了
再開メモ: USER-01スマホdiagnosticsではmain/workerともWebGPU `requestAdapter()` が `adapter-unavailable`。viewport幅やIllustro独自core-limit gate以前の失敗であり、MOBILE-004だけでは編集可能にならない。MOBILE-005のWebGPU非依存compatibility rendererを実装済み。MOBILE-006ではWorker/Main WebGPUが復旧不能になった場合もcanonical Raster TileをStroke replayなしでcompatibility Canvas2Dへ引き継ぎ、History / Persistence / Exportの正本をrenderer backendから分離した。スマホPNG ExportはFile menu導線も共通handlerへ接続し、Androidの非同期download処理より先にBlob URLを破棄しないようobject URL保持を60秒へ延長した。MOBILE-007はスマホ新規作成・描画・性能のみ実機PASS。Undo/Redo・保存再読込・PNG Exportの明示PASSが残るため未完了。USER-01を閉じるまで通常の後続実装へ自動復帰しない。検査は必要最低限とし、実装を優先する。

再開メモ: M6A-018 sampled image tipは、単一のcanonical sampled alpha imageを論理brush tipとしてプリセットへ保存し、stroke開始時に既存BaselineBrushDabBuilderへ固定する構成で完了。sampled stampは5×5 alpha maskを既存rendererが理解するalpha-weighted round primitive dabsへ決定論的に展開するため、WebGPU/Main/Worker/Canvas2D/History/Persistenceにsampled専用renderer分岐やfull-stroke replayを追加しない。M6A-019 custom tip creation、M6A-020 multiple tip assets、M6A-071/072 resource loader/managerは未完了のまま分離する。次はM6A-019 custom tip creationから再開する。

### M6A-022 tip-density resume memo — 2026-09-03

- `tipDensity` is a static `0..1` brush-tip mask coverage strength and is intentionally separate from M6A-015 `flow`, which controls repeated-stamp ink deposit.
- The value is captured at stroke start and persisted on each primitive dab. Missing legacy values resolve to `1.0`.
- Shared canonical tip coverage applies density to paint/erase/smudge/blur paths. Default density `1.0` keeps the existing direct WebGPU fast path; non-default density uses canonical tile preview.
- Worker dab parsing now preserves both M6A-021 `hardness` and M6A-022 `tipDensity`, closing the Worker/Main semantic mismatch discovered during M6A-022 inspection.
- M6A-023 spacing / gap remains intentionally separate and is the next incomplete item.

### M6A-023 spacing/gap resume memo — 2026-09-03

- `stroke.spacingRatio` is the user-facing logical stamp interval relative to current brush size; factory/default value remains `0.25` (25%).
- `stroke.minimumStampDistancePx` is the safety/performance floor; the existing canonical preset value `1px` is now honored by the kernel instead of the old hard-coded `0.25px` floor.
- Spacing is captured when the stroke kernel is created. It is not redundantly serialized onto each dab because the resolved dab coordinates are already the exact history/save/recovery representation.
- The UI exposes 1..400% spacing while the schema stores 0.01..4. Endpoint retention and incremental confirmed-sample processing remain unchanged.
- Next incomplete item is M6A-024 tip angle.

### M6A-024 tip-angle resume memo — 2026-09-03

- `tip.angleDegrees` is a static preset-local angle normalized to `0 <= angle < 360`; legacy presets/dabs resolve to `0°`.
- Procedural square coverage inverse-rotates pixel coordinates in Canonical Raster and rotated dirty bounds prevent clipped corners. Round tips remain visually invariant under angle.
- Sampled/custom tips rotate the logical 5×5 mask offsets before primitive round-dab expansion, preserving the existing renderer/history architecture.
- The resolved angle is copied to primitive dabs and preserved through save/recovery and Worker parsing. This remains static angle only; M6A-025 direction and M6A-026 follow-stroke rotation are not implemented here.
- Next incomplete item is M6A-025 tip direction.
