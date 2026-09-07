# Illustro Work Plan

このファイルは、`TtroFX/Illustro` における作業計画・進捗・検証結果を逐次記録するための運用ファイルである。

## 0. 運用原則

- 現行repoは `TtroFX/Illustro` のみを対象とする。
- 設計・仕様のSource of Truthは `main` の最新版 `ILLUSTRO_MASTER_DESIGN.md` とする。
- 旧Illustro、backup repo、旧設計図は、ユーザーから明示的な指示がない限り参照しない。
- 作業開始前に、対象ファイル・関連設計・main最新状態を確認する。
- 作業は「調査 → 設計判断 → 実装/編集 → 検証 → 修正 → 再検証 → 完了判定」の順で進める。
- 問題を発見した場合、可能な範囲で報告だけで止めず、その場で修正し再検証する。
- 完了扱いにする前に、依頼内容を満たした証拠を確認する。
- 重要な設計判断が確定した場合は、必要に応じて `ILLUSTRO_MASTER_DESIGN.md` へ最小差分で反映する。
- 実装中は**ユーザーが確認可能な機能の区切り1つ**を基本作業単位とし、`1機能区切りを実装 → AI最小検査 → ユーザー確認 → 必要なら修正 → ユーザー承認後に次の区切りへ進む`を基本サイクルとする。
- ユーザー確認前に、AI側の判断だけで複数の機能区切りをまとめて先へ進めない。
- 通常の1機能区切りに対するAI検査は、ユーザーが安全に確認できる状態であることを確かめるための最小限に留める。原則として、変更範囲に必要なbuild / typecheck等、起動不能・致命的runtime error・明白な破損の確認を中心とする。
- 広範なregression、性能計測、長時間試験、fault injection、全端末確認、網羅的edge case検査は、当該機能で直ちに必要な場合を除き、節目またはRelease品質固めでまとめて実施する。
- ユーザー確認は主に見た目、操作感、機能挙動、導線、期待との一致を確定するGateとする。Architecture / Data integrity / 保存安全性等、ユーザー確認だけでは判定できない最低限の技術的正しさはAI側で維持する。

## 1. ステータス定義

各作業項目には必ず以下のいずれかを付ける。

- `[ ] 未着手`
- `[-] 進行中`
- `[x] 完了`
- `[!] 問題あり / 要修正`
- `[?] 未確認 / 検証不能`
- `[~] 保留`

完了した項目には、可能な限り確認方法・結果・commit SHA・workflow結果などの根拠を追記する。

## 2. 作業手順

### Phase 1: 最新状態の取得

- [ ] `main` の最新HEADを確認する。
- [ ] `ILLUSTRO_MASTER_DESIGN.md` の最新版を取得する。
- [ ] 今回の対象ファイル・対象機能の最新版を取得する。
- [ ] 関連する既存仕様・関連Section・関連実装を確認する。
- [ ] 既存の未完了作業・既知問題・workflow状態を確認する。

### Phase 2: 要求整理

- [ ] ユーザー要求を実装可能な単位へ分解する。
- [ ] 必須条件と任意条件を分離する。
- [ ] 変更してよい範囲と変更禁止範囲を明確化する。
- [ ] 完了条件・検証条件を定義する。
- [ ] 既存仕様との競合がないか確認する。

### Phase 3: 調査・原因分析

- [ ] 関連コード・設計・データフローを確認する。
- [ ] 現在の挙動を構造化して整理する。
- [ ] 問題の再現条件を特定する。
- [ ] 症状と根本原因を分離する。
- [ ] 必要に応じて成熟アプリ・既存技術の設計知見を調査する。
- [ ] 推測と確認済み事実を区別する。

### Phase 4: 設計

- [ ] 採用案を決定する。
- [ ] 不採用案がある場合は理由を記録する。
- [ ] UI/UX、性能、データ整合性、Undo/Redo、保存、復旧、互換性への影響を確認する。
- [ ] 直接操作では体感0ラグを阻害する同期処理・待機・不要な再計算を排除する設計になっているか確認する。
- [ ] 実装前に必要な検証項目を定義する。

### Phase 5: 実装 / 編集

- [ ] 変更対象を最小限に限定する。
- [ ] 正常な既存挙動を維持する。
- [ ] 必要なコード・設計文書・テストを更新する。
- [ ] 重要な処理についてエラー処理・fallback・device loss・recovery等を確認する。
- [ ] 変更内容を逐次この `PLAN.md` に記録する。

### Phase 6: 静的検証

通常の1機能区切りでは、ユーザー確認へ渡せることを保証するために必要な項目だけを最小限実行する。以下の全項目を毎回一律実行する必要はなく、広範な検査は節目 / Release Gateでまとめて行う。

- [ ] 構文エラーがないことを確認する。
- [ ] typecheckを実行する。
- [ ] lintを実行する。
- [ ] unit testを実行する。
- [ ] integration testを実行する。
- [ ] buildを実行する。
- [ ] 既存テストのregressionを確認する。

### Phase 7: 実動作検証

通常の1機能区切りでは、その機能をユーザーが実際に確認できる主要経路と致命的破損の有無を中心に見る。網羅的な端末 / 性能 / 長時間 / 回帰確認は必要な節目へ送る。

- [ ] 対象機能の主要フローを実際に確認する。
- [ ] UI表示崩れがないことを確認する。
- [ ] console error / warningを確認する。
- [ ] network errorを確認する。
- [ ] 性能が重要な場合は計測値で確認する。
- [ ] 長時間利用・大量データ・連続操作でも劣化しないか確認する。
- [ ] touch / pen / mouse 等、対象入力系の回帰を確認する。

### Phase 8: 修正ループ

- [ ] 検証で見つかった問題を記録する。
- [ ] 問題を修正する。
- [ ] 修正箇所を再検証する。
- [ ] 関連箇所への副作用を回帰確認する。
- [ ] 問題が残る場合は再度修正ループへ戻る。

### Phase 9: 設計図反映

- [ ] 重要な設計判断が確定しているか確認する。
- [ ] 必要な場合のみ `ILLUSTRO_MASTER_DESIGN.md` の対象箇所を最小差分で更新する。
- [ ] 更新後にdiffを確認する。
- [ ] 対象外の文章・順序・表記・改行が変わっていないことを確認する。

### Phase 10: Git / CI / 完了判定

- [ ] 変更差分を確認する。
- [ ] 意図しないファイル変更がないことを確認する。
- [ ] commitを作成する。
- [ ] pushする。
- [ ] workflow / CI結果を確認する。
- [ ] 必要に応じて公開環境・Pages等で最終確認する。
- [ ] 完了条件をすべて満たしているか最終確認する。
- [ ] この `PLAN.md` の該当項目を `[x] 完了` に更新する。

## 3. 現在の作業

### Task 0: PLAN.md 導入

- [x] `PLAN.md` の運用方針を定義する。
- [x] 作業ステータス表記を定義する。
- [x] 標準作業フローを定義する。
- [x] 未完了 / 完了を逐次記録する形式を用意する。
- [-] 今後の具体的な作業内容をこのファイルへ追加して運用する。

### Task 1: Illustroで実装・構築するもの — 大分類

この一覧は「ユーザー向け機能一覧」ではなく、Illustroを製品として成立させるために実際に構築する**実装物 / Subsystem / 基盤**の大分類である。
`ILLUSTRO_MASTER_DESIGN.md` Section 3 / 4 / 6 / 7 / 8を中心に、Section 2 / 5の機能群がどの土台へ載るかを整理する。
この段階では細かなClass / Module / Tool単位へ分解しない。現行repoの実装監査もまだ行っていないため、原則 `[?]` とする。

#### A. Application / Platform基盤

- [?] **Application Shell / 起動基盤** — アプリ起動、Project Libraryへの導線、PWA / Browser runtime、Lifecycle、Background / Resume等を成立させる外殻。
- [?] **Platform Adapter / Capability Discovery** — WebGPU、Worker、OffscreenCanvas、Storage、Input等のPlatform差を吸収し、利用可能Capabilityを実行時に判定する層。
- [?] **Runtime Domain / Worker構成** — UI Main Thread、Realtime Core / Render Owner、Persistence Worker、Utility Worker Pool、Collaboration Domainの責務と通信基盤。

#### B. Canonical Core / データモデル基盤

- [?] **Project / Document Canonical Model** — Project、Document、Canvas、View、Layer / Object、Selection、Resource等の正本状態を保持するCore。
- [?] **Identity / Revision / Dependency基盤** — Stable ID、Revision、Source / Instance、Relation、Dependency、Dirty / Freshness等を一貫して扱う基盤。
- [?] **Coordinate / Transform基盤** — Document / Local / Workspace / Device SpaceとTransformを統一管理する基盤。
- [?] **Command / Transaction / Interaction Lifecycle** — Begin → Interactive Update → Commit / Cancel、Atomic Transaction、Continuous Transaction、Command実行を統一する基盤。
- [?] **History / Undo / Redo / Branch / Checkpoint基盤** — Revisionを履歴Graphとして扱い、Undo後の分岐やCheckpointを保持する基盤。

#### C. Realtime / Rendering / Performance基盤

- [?] **Input Routing / Gesture Ownership** — Pen / Touch / Mouse / Keyboard入力の正規化、Pointer ownership、Gesture競合解決、Prepared Interaction Contextを扱う入力Hot Path。
- [?] **Realtime Core / Work Scheduler** — Direct Interactionを最優先し、Foreground / Background work、bounded queue、coalescing、priority、cancellationを管理する実行基盤。
- [?] **GPU Rendering / Retained Renderer / Compositor** — WebGPUを中心とするCanvas描画、Layer Composite、Viewport表示、dirty region / retained state、presentationを担う描画基盤。
- [?] **Memory / Cache / Resource Governor** — Working Set、GPU / CPU cache、eviction、memory pressure、thermal / power pressureを管理する基盤。
- [~] **Algorithm Layer** — Brush sampling、Stable Prefix、Dab生成、Raster coverage、Blend、Selection / Region topology、Effect、Color transform、Delta / Compression / Integrity等。Section 8からSection 9へ送られている領域であり、現行正本にはまだSection 9が統合されていないため詳細確定待ち。

#### D. Artwork Editing Engine群

- [?] **Raster Paint / Brush Engine** — Brush、Eraser、Blend、Watercolor、Texture、Dynamics等のRaster描画体系。
- [?] **Layer / Composite / Non-destructive Engine** — Layer tree、Mask、Clipping、Blend、Modifier、Adjustment、Effect Stack等。
- [?] **Selection / Mask / Fill / Region Engine** — Selection coverage、Mask、Flood / Enclose Fill、Lineart Boundary、Stable Region等の領域処理体系。
- [?] **Transform / Vector / Text / Assist Engine** — Transform、Vector / Shape、Text、Ruler / Guide / Perspective等のGeometry系編集体系。
- [?] **Filter / Effect / Color Processing Engine** — Filter、色調補正、Generator、Liquify / Retouch、Color processing等の画像処理体系。

#### E. UI / UX基盤

- [?] **Workspace Shell / Access Architecture** — Top Bar、Left Tool Rail、Right Sidebar / Page Rail、Canvas Overlay、Main Menu、Command Search等の全体UI骨格。
- [?] **Design System / UI Component基盤** — Typography、spacing、icon、control、state、focus、feedback、popup / dialog / sheet等の共通Visual / Component体系。
- [?] **Tool / Properties / Context UI** — Direct / Quick / Detail、Properties、Context Bar、Quick Hole、PiP、Selection Launcher等、編集機能を操作する共通UI。
- [?] **Responsive / Device Layout** — Desktop / Tablet / Phoneを単純縮小ではなく再構成するResponsive Workspaceと入力方式別Layout。
- [?] **Accessibility / Feedback / Settings UI** — Keyboard access、screen reader semantics、hit target、focus、Disabled reason、error / loading / status feedback、User / Device / Workspace設定。

#### F. Persistence / File / Resource基盤

- [?] **Native Project Store / `.illustro` Format** — Manifest、Document Model、Content、History、Resource、Checkpoint等をNative Projectとして保持する保存基盤。
- [?] **Autosave / Recovery / Durability基盤** — Durability Watermark、Recovery protection、Last Good / Previous Good、atomic save、fault recoveryを扱う基盤。
- [?] **Asset / Resource Management** — Brush Tip、Texture、Pattern、Gradient、Material、Font、Reference等のLocal resource管理とProject Resource Capture。
- [?] **Import / Export / Compatibility基盤** — PSD / PNG / JPEG / TIFF / SVG等との変換、Compatibility Report、Preflight、Migrationを扱う基盤。
- [?] **Color Management / Output基盤** — ICC、Document profile、Soft Proof、Color conversion、Export Recipe等の出力品質基盤。

#### G. Online / Collaboration基盤

- [?] **Collaboration / Network Domain** — 絵チャット、Realtime Collaboration、Presence、Shared / Private state、Conflict、Offline / ReconnectをLocal-first semanticsの上で成立させる基盤。
- [?] **Online Identity / Permission** — オンライン機能で必要な範囲のAccount / Owner / Editor / Viewer等を扱う認証・権限層。通常制作はAccount必須にしない。

#### H. Reliability / Quality / Release基盤

- [?] **Diagnostics / Instrumentation** — Input-to-Present、frame pacing、queue、memory、save / recovery lag、open等をDevelopment buildで観測する計測基盤。
- [?] **Automated Test / Reference Fixture基盤** — Unit / Integration / Rendering correctness / round-trip / accessibility / compatibility等を継続検証するTest基盤。
- [?] **Performance / Soak / Fault Injection Gate** — 60 / High-refresh端末、long session、10,000 transaction、GPU loss、storage full、process kill、corruption等を検証するRelease Gate。
- [?] **Security / Untrusted Input / Failure Isolation** — malformed file、resource exhaustion、path traversal、unexpected remote fetch等を防ぎ、Subsystem failureをArtwork corruptionへ波及させない保護基盤。
- [?] **Build / CI / Packaging / Deployment基盤** — typecheck、lint、test、build、PWA packaging、deployment、versioning、migration、release validationを安定運用する基盤。

#### I. Product Feature群

Section 2で確定している24系統のユーザー向け機能は、上記A〜Hの基盤上へ実装する。
ここでは重複して24項目を最上位Taskとして並べず、後続で各Engine / UI / Persistence等へ紐付けて細分化する。
対象には、Document / Canvas、Brush、Input、Color、Layer、Selection、Fill、Lineart、Transform、Vector、Assist、Retouch、Filter、Non-destructive editing、Text、Reference、History、Project management、Workspace、Common interaction、Collaboration、Assets、Settings、Output / Color managementが含まれる。

### Task 2: 暫定実装順序 — UI先行 / ユーザー確認重視

この順序は現時点の**暫定案**であり、ユーザー確認を多めに取りながら更新する。
各Phaseを一度で完成させ切ってから次へ進むのではなく、必要な範囲で前後しながら進める。ただし、UIだけを完成させて後からArchitectureを無理に合わせることはしない。
Task 2の番号はロードマップ上の大きな順序であり、その番号全体を1つのユーザー確認単位にはしない。各段階の中を**ユーザーが確認可能な機能の区切り1つずつ**へ分け、各区切りごとに確認を受けてから次へ進む。

1. [ ] **UI骨格 / Visual Prototype** — Workspace Shell、Top Bar、Tool Rail、Canvas、Right Sidebar、主要Panel、Project Library等をまず実物に近い形で作る。処理本体はMock / 仮Stateでもよい。
2. [ ] **UI操作Prototype / Responsive確認** — Tool切替、Panel切替、Popup / Sheet、Properties、Context UI、Desktop / Tablet / Phone再構成などを動かし、主要操作感を確認できる状態にする。
3. [ ] **UI第1節目確認Gate** — 各機能区切りでの逐次確認に加え、画面構成、導線、操作感、情報密度、端末別Layoutを節目としてまとめて確認し、必要な修正を行う。
4. [ ] **Application / Platform基盤** — Application Shell、Capability Discovery、Platform Adapter、Runtime Domain / Worker境界など、UIとCoreを支える実行土台を整える。
5. [ ] **Canonical Core基盤** — Project / Document Model、Stable ID、Revision、Coordinate、Command / Transaction、Interaction Lifecycle、History基盤を構築する。
6. [ ] **UI ↔ Core接続契約** — Active Document / Tool / Layer / Selection / Brush / View等のState、Command、Loading / Disabled / Error semanticsを固定し、UIをMockから実Stateへ段階的に接続する。
7. [ ] **Realtime / Rendering基盤** — Input Routing、Realtime Core、Scheduler、GPU Renderer / Compositor、Working Set、Memory / Cache管理を構築し、体感0ラグのHot Pathを成立させる。
8. [ ] **最小制作Vertical Slice** — Canvas、基本Brush / Eraser、Layer、Color、Undo / Redo、基本Navigationなどを一本につなぎ、実際に描ける最小の制作経路を成立させる。
9. [ ] **UI第2節目確認Gate** — 各機能区切りでの逐次確認に加え、実Core上での描画、操作感、Latency、Tool / Properties連携を節目としてまとめて確認し、UIと基盤の不整合を修正する。
10. [ ] **Native保存 / Recovery基盤** — `.illustro`、Project Store、Autosave、Recovery、Durability、Project Library実Data接続を実装し、作品を安全に閉じて再開できる状態にする。
11. [ ] **主要編集Engine拡張** — Selection / Mask / Fill / Region、Transform、Layer Composite / Non-destructive、Brush高度化など、一枚絵制作の中心機能を順次実装する。
12. [ ] **高度制作機能** — Vector / Shape、Text、Ruler / Assist、Filter / Effect、Reference、Lineart system、Advanced Color等を追加する。
13. [ ] **Asset / Import / Export / Color Management** — Resource管理、外部Format互換、Export、Preflight、ICC / Soft Proof等を完成させる。
14. [ ] **Online / Collaboration** — Solo制作を完成させた土台の上に、絵チャット / Collaboration、Identity / Permission、Offline / Reconnectを追加する。
15. [ ] **全体品質固め / Release Gate** — Accessibility、Performance、long session、10,000 transaction、GPU loss、storage fault、corruption、security、compatibility、CI / packaging / deploymentを総合検証し、問題を修正する。
16. [ ] **最終ユーザー確認 / 完成判定** — 実機で主要制作フローを通し、残るUX問題・不足機能・品質問題を確認して、Release可能か判定する。

## 4. 作業ログ

### 2026-09-07

- `[x]` repoルートに `PLAN.md` を新規作成。
- `[x]` 今後の作業について、手順・進捗・検証結果を逐次記録するための基本構造を追加。
- `[x]` 最新 `ILLUSTRO_MASTER_DESIGN.md` Section 2を基準に、当初は作るものを24の機能大項目として追加。
- `[x]` Section 3 / 4 / 6 / 7 / 8を再確認し、「機能一覧」ではなくApplication / Core / Realtime / Editing Engine / UI / Persistence / Online / Quality基盤を含む実装物の大分類へ再構成。
- `[x]` ユーザー確認を多めに取る前提で、UI先行の暫定実装順序をTask 2として追加。
- `[x]` 運用を「ユーザー確認可能な機能区切り1つごとに停止・確認」へ変更し、通常のAI側検査は確認可能性と致命的破損の有無を中心とする最小検査へ変更。
- `[?]` 各大分類の現行実装状況は未監査。今後、repo実装を確認して状態を更新する。
- `[~]` Algorithm LayerはSection 8からSection 9へ送られているが、現行 `ILLUSTRO_MASTER_DESIGN.md` にはSection 9がまだ統合されていないため詳細確定待ち。

## 5. 完了判定ルール

以下を満たさない限り、原則として作業全体を「完了」としない。

- 要求事項がすべて処理済みである。
- 必須テスト・検証が完了している。
- 既知の重大問題が残っていない。
- 回帰問題が確認されていない。
- 必要な設計文書更新が完了している。
- Git差分が意図通りである。
- CI / workflowが必要な場合、結果を確認済みである。
- `PLAN.md` に最終状態と検証根拠が記録されている。