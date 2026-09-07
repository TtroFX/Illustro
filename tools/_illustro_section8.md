## 8. 技術Architecture — 確定

### 8.0 この章の位置づけ

本章は、Section 1〜7で確定した製品Semanticsと非機能Targetを満たすための**System Architecture / Runtime Ownership / Data Flow / Persistence Topology**を確定する。

本章では、どのSubsystemが何を所有し、どの経路がRealtime Hot Pathで、どこからBackgroundへ分離し、Canonical State・GPU State・Persistent Stateをどう接続するかを決める。

Brush dab生成式、Raster coverage、Blend math、Selection topology、Stable Region tracking、Effect kernel、Color transform math、Delta encoding、Compression / Checksumの具体AlgorithmはSection 9へ送る。Benchmark fixture、fault injection、PASS / FAIL判定はSection 10へ送る。

本章のArchitectureは次を最上位制約とする。

1. **Main Threadを重いArtwork計算の常用実行場所にしない。**
2. **Direct InteractionはStorage / History serialization / Thumbnail / Search / Export / Networkを待たない。**
3. **GPU-firstでCurrent Visible Resultを作るが、GPU volatile memoryを唯一のCanonical recovery sourceにしない。**
4. **Commit時の同期CPU readbackをCanonical correctness条件にしない。**
5. **Realtime / Undo / Export / RecoveryでCanonical Semanticsを共有する。**
6. **Full-canvas / full-document workをPointer sampleごとの既定経路にしない。**
7. **Queueはbounded / coalescibleで、Background workの無制限蓄積を許さない。**
8. **Recovery-critical workにはForegroundを妨げないstarvation-free Safety Laneを持たせる。**
9. **Local-first / Offline-firstを維持し、通常制作をNetwork ACKへ依存させない。**
10. **Capability不足をsilent semantics downgradeで隠さない。**

---

### 8.1 Architecture Topology / Ownership

#### 8.1.1 Logical layers

Runtimeを少なくとも次の論理層へ分離する。

```text
UI / Accessibility / OS Integration
            ↓ commands / input
Realtime Core + Interaction Runtime
            ↓ canonical revisions / render demand
Render / GPU Runtime
            ↕
Document Model / Dependency Runtime
            ↓ persistence packets
Persistence / Recovery Runtime
            ↓
Project Store / Platform Storage

Side lanes:
Utility Workers / Import-Export / Search / Thumbnail / Timelapse
Collaboration Transport
```

論理層の分離は必ずしも1層=1 Threadを意味しない。Platform capabilityに応じて同じThreadへco-locateできるが、Ownership / API boundary / Priority semanticsは維持する。

#### 8.1.2 Single Owner principle

Mutable Runtime resourceは原則として**1つのOwner**を持つ。

例:
- DOM / Accessibility Tree / browser navigation: UI Main Thread owner
- Active Interaction State: Realtime Core owner
- GPUDevice / GPUTexture / Render Pipeline Cache: Render Owner
- Canonical Document Runtime Root: Realtime Core / Document Runtime owner
- OPFS Sync Access Handle等のexclusive storage handle: Persistence Worker owner
- Background encode task: Utility Worker owner

複数Threadが同じmutable objectを自由に共有する設計を避け、Message / immutable snapshot / bounded shared transportで接続する。

#### 8.1.3 Portable Core + Platform Adapters

Canonical Document、Interaction semantics、Scheduler work classes、Project format contractを特定Browser APIへ直接埋め込まない。

Platform依存部はAdapterとして分離する。

- Graphics Backend
- Canvas / Presentation Surface
- Input Adapter
- Frame Clock
- Local Project Store
- User-visible File Adapter
- Clipboard / Share
- Font / Text Platform Adapter
- Network / Collaboration Transport

現在のWeb runtimeではWeb Platform APIを利用できるが、Canonical modelがWeb-specific handleやDOM objectを保存しない。

---

### 8.2 Runtime Domains

#### 8.2.1 UI Main Thread

Main ThreadのPrimary responsibilities:
- DOM UI
- Accessibility semantics
- Pointer / Keyboard / Wheel / Gesture event capture
- OS / browser permission promptとの接続
- Menu / Panel / Sheet / Settings UI
- File picker / Share等、Window contextを必要とするPlatform API入口
- Render Workerへ渡すPresentation Surface初期化
- Worker fallback時のFrame Clock relay

Main Threadで常用しないもの:
- Brush rasterization
- Full document composite
- Effect evaluation
- History serialization
- Project compression
- Large image decode / encode
- Search indexing
- Thumbnail generation
- Recovery journal write

Main ThreadはInput eventを受けたら最小限の正規化とtransportを行い、長い同期処理へ入らない。

#### 8.2.2 Realtime Core Domain

Realtime CoreはDirect Interactionの意味を最短経路で成立させる中心Domainとする。

Primary ownership:
- Current Logical Revision Root
- Active Interactive Working State
- Prepared Interaction Context
- Runtime Handle Registry
- Current View / Tool generationのArtwork側state
- Direct Interaction command processing
- Canonical Commit construction
- Visible Working Set demand
- Work Scheduler foreground lanes

Realtime Coreは「UI state全部」を持たず、Artworkに関係しないPanel scrollやTheme等はUI domainへ残す。

#### 8.2.3 Render / GPU Domain

GPU resourceを1つのRender Ownerへ集中させる。

Web runtimeでOffscreenCanvas + Worker WebGPUが成立する場合、**Realtime CoreとRender Ownerを同じDedicated Workerへco-locateすることをPrimary構成**とする。

目的:
- Input transport後の余計なWorker hopを減らす
- Interaction StateとVisible Render demandの同期costを減らす
- GPUDevice / texture ownershipを一意化する
- Main ThreadをDOM / Accessibilityへ専念させる

Platform上Worker presentationが利用できない場合、Render OwnerをMain Threadへ置けるが、Render Scheduler / Retained Renderer / bounded work architecture自体は変更しない。

#### 8.2.4 Persistence Worker

Persistence専用Dedicated Workerを持つ。

Primary responsibilities:
- Recovery Store
- Durable Generation write
- `.illustro` chunk / manifest IO
- Last Good / Previous Good activation
- Storage integrity verification
- Project Store GCのIO側
- Storage quota / free-space information取得

Web runtimeでは、利用可能な場合OPFSのworker-only synchronous accessをPersistence Worker内部で利用する。

Persistence Workerの同期IOはWorker内で完結させ、Main Thread同期blockへ変換しない。

#### 8.2.5 Utility Worker Pool

低優先度またはCPU-heavy task用のbounded Worker Poolを持つ。

対象例:
- Import parse / decode
- Export encode
- PSD / SVG compatibility analysis
- Thumbnail generation
- Search indexing
- Timelapse encode preparation
- Large resource hashing / compression preparation
- Project Health background scan

Pool sizeはlogical core数をそのまま使い切らず、Foreground interaction / thermal / memory状態を見てResource Governorが制御する。

#### 8.2.6 Collaboration Domain

Collaboration active時だけNetwork transport / remote operation handlingを独立Domainとして有効化する。

Local Direct InteractionをNetwork round-tripへ接続しない。Remote operationはCanonical conflict semanticsに従ってRealtime Coreへ明示operationとして渡す。

---

### 8.3 Platform Capability / Graphics Backend

#### 8.3.1 Capability discovery

起動時に固定User-Agent listではなくruntime capabilityを検査する。

Graphics例:
- WebGPU adapter / device
- supported limits / features
- Workerでのpresentation可否
- OffscreenCanvas availability
- required texture format / storage texture capability
- device memory / texture dimension constraints

Storage例:
- OPFS
- Worker sync access
- user-visible File System Access capability
- persistent storage status
- quota estimate

Capability結果はRuntime Profileへ保存し、Backend選択とProject feasibility判定に使う。

#### 8.3.2 Graphics tiers

Graphics backendを少なくとも次に分ける。

1. **Primary GPU Backend: WebGPU**
2. **Compatibility GPU Backend: WebGL2等、Section 5 semanticsを正しく表現できるbackend**
3. **CPU / WASM fallback: limited recovery / decode / specific operation用途**

CPU rendererを高機能Canvas直接操作のsilent equivalentとして扱わない。

Formal Support対象として宣言するRuntime Profileは、選択BackendでSection 7の必須TargetとCanonical semanticsを満たせることをSection 10で検証する。

#### 8.3.3 No silent backend downgrade

WebGPU device loss / unsupported capabilityで別backendへ移る場合:
- Artwork semanticsが維持できるか
- Current project capabilityが維持できるか
- Performance classがformal supportを満たすか

を判定する。

維持できない場合は`Compatibility Mode`等のstatusと具体reasonを示し、機能を黙って別意味へ変更しない。

#### 8.3.4 GPU ownership

1 Project session内で通常1つのGPUDevice ownerを持つ。

GPUDevice object / textureをWorker間で場当たり的に移送せず、GPU taskはRender OwnerへCommand / Render Demandとして送る。

Background GPU taskも同じGPU Schedulerを通し、Foreground submissionを横取りしない。

---

### 8.4 Input Transport / Prepared Interaction

#### 8.4.1 Input Broker

UI Main ThreadにInput Brokerを置く。

Input BrokerはPointer / Pen / Touch / Mouse / Wheel / KeyboardからArtwork関連sampleを受け、最低限次を保持する。
- timestamp
- pointer identity / type
- Workspace position
- pressure
- tilt / orientation where available
- buttons / modifiers
- coalesced sample relation
- View Generation

Raw event objectやDOM nodeをRealtime Coreへ持ち込まない。

#### 8.4.2 Transport

Main→Realtime transportはallocation churnとunbounded queueを避ける。

Primary candidate:
- preallocated bounded Shared Memory ring where platform / isolation permits

Fallback:
- compact transferable / structured messages with batched coalesced samples

Transport implementation差でCanonical sample semanticsを変えない。

Shared Memoryが使えないことを理由にPointer sampleを無断で大幅間引きしない。必要なcoalescingはSection 9の意味規則に従う。

#### 8.4.3 View Generation mapping

Artwork sampleはSection 3どおり受信時View Generationに関連付ける。

Realtime CoreはPrepared View Transformを使いDocument Spaceへ解決する。後からPan / Zoom / Rotateが変わっても過去sampleを新Viewで再解釈しない。

#### 8.4.4 Prepared Interaction Context

Tool / Target / Selection / Mask / Clip / Ruler / Brush / Effect relation等が変化した時点でPrepared Contextを更新する。

Pointer Down時:
1. Generation stamp比較
2. valid部分を即利用
3. stale dependencyだけpatch
4. 全Document graph scanを避ける

Prepared ContextにはStable ID文字列ではなく解決済みRuntime Handleを保持できる。

#### 8.4.5 Multi-input routing

Artwork pointerとView navigation pointerを別routing laneにする。

例:
- Pen: Artwork Interaction
- 2-finger Touch: View Pan / Zoom / Rotate

同時入力時もArtwork sampleのDocument coordinateを固定し、View操作がStroke座標を後から歪めない。

---

### 8.5 Global Work Scheduler

#### 8.5.1 Priority lanes

Global Schedulerは少なくとも次のLaneを持つ。

**P0 Realtime Input / Present**
- Pointer sample consume
- Direct manipulation update
- current frame visible render

**P1 Required Visible Dependencies**
- Current interactionを意味的に正しく表示するため必要なlocal dependency
- visible tile decode / effect dependency

**P2 Logical Commit**
- Atomic Revision Root publish
- transaction change capture
- read-your-writes成立に必要な最小処理

**P3 Recovery Safety Lane**
- committed changeのRecovery packet生成 / durable append
- deadlineを持つstarvation-free work

**P4 Visible Background Catch-up**
- visible but non-blocking exact materialization
- neighboring tiles / current view refinement where same semantics

**P5 Durable Autosave / Project Store**
- Last Good generation catch-up

**P6 User Background Jobs**
- Export / Import finalize / Timelapse encode

**P7 Maintenance / Speculative**
- Thumbnail
- Search indexing
- offscreen cache
- cleanup / compaction / GC

Lane番号は実装enum名を強制しないが、優先関係は維持する。

#### 8.5.2 Deadline-aware frame budget

P0は次Display opportunityをdeadlineとして扱う。

SchedulerはFrame Clockから次present deadlineを見積もり、Background CPU / GPU workをdeadline直前まで無制限実行しない。

Background taskはcooperative yield / chunking可能でなければならない。1つの巨大Taskを投入し、終わるまでRealtimeが待つ設計を禁止する。

#### 8.5.3 Recovery Safety Lane guarantee

P3はForegroundを同期blockしないが、Section 7のRecovery Protection deadlineを守るためminimum serviceを保証する。

Speculative taskやExportがP3を永久に押し出してはならない。

Realtime interactionが長時間連続する場合も、短いRecovery service slice / independent storage worker progressによってstarvationを防ぐ。

#### 8.5.4 Work semantics classes

Queue itemは少なくとも次の性質を宣言する。

- **Must Preserve**: semantic commit、recovery-critical record等。drop不可。
- **Latest Wins**: thumbnail / navigator preview / stale UI summary等。古い未開始workを置換可能。
- **Mergeable**: dirty region / invalidation / changed block set等。union / coalesce可能。
- **Cancelable Snapshot Job**: export candidate / sweep / preview等。snapshot identityを持ちcancel可能。

全workを同じFIFOへ入れない。

#### 8.5.5 Bounded queue

Realtime / render / utility queueに無制限growthを許さない。

Queue pressure時:
1. stale Latest Winsを捨てる
2. Mergeableを統合
3. Speculativeをcancel
4. producer rateを調整
5. Must Preserveは意味を失わずcompact representationへ移す

Foreground InputをBackground backlog解消待ちにしない。

#### 8.5.6 GPU submission policy

通常のdirect interactionでは、pointer eventごとにGPU submitしない。

1 display frame内のvisible GPU workを可能な限り1 command sequenceへまとめ、**通常1 GPU queue submission / presentation surface / display frame**をPrimary policyとする。

複数Compute / Raster / Composite passは同一frame submissionへencode可能とする。

追加submitが必要な特殊caseは許容するが、常態化してframe pacingを崩さない。

---

### 8.6 Realtime Direct Manipulation Pipeline

#### 8.6.1 Common pipeline

Brush / Eraser / Blend / Liquify / Transform / Selection direct manipulation等は概念的に次を通る。

```text
Input Broker
  ↓
Realtime Transport
  ↓
Prepared Context validation
  ↓
Interaction Update
  ↓
Affected Working Set / Dirty Region
  ↓
Visible Evaluation
  ↓
Frame-aligned GPU Work
  ↓
Present Current Effective State
  ↓
Atomic Logical Commit when semantic boundary
  ↓
Recovery / Durable / Derived background lanes
```

#### 8.6.2 First visible sample

Pointer Down時に次を同期条件にしない。
- Autosave
- project manifest update
- History thumbnail
- search index
- Timelapse encode
- full layer tree traversal
- full canvas CPU tile copy
- GPU→CPU readback

First sampleに必要なBrush / Target / Selection等はPrepared Contextから取得する。

#### 8.6.3 Sustained stroke

長尺Strokeは過去全sampleを毎Update再処理しない。

Architecture上:
- processed stable portion
- bounded interactive tail
- pending input batch

を分離できる状態を要求する。

Stable Prefix / Dab spacing / resamplingの具体AlgorithmはSection 9。

#### 8.6.4 Release / Commit

Release時はCurrent Visible Resultをすでに正しいInteractive Stateとして持っているため、`final renderを最初から作り直す`ことをCommit protocolにしない。

Commitは:
- final interaction parameters
- affected entities / bounds
- immutable content revision references
- reconstructible raster mutation payload where required
- transaction metadata

をLogical Revisionへpublishする。

Persistence / materializationが残っていても次Interactionは新RevisionをBaseとして開始できる。

#### 8.6.5 No canonical reconciliation stage

`Realtime result`を一度見せ、Release後に`Canonical renderer`でもう一度別結果を作って差し替える通常stageを設けない。

Realtime Pathで未materializedなCanonical payloadがある場合も、同一semanticsを後からMaterializeするだけであり、Visible resultの意味を変更しない。

---

### 8.7 Retained GPU Renderer / Presentation

#### 8.7.1 Retained rendering

Canvas rendererをImmediate full-document redraw engineにしない。

Runtimeは少なくとも次を保持する。
- visible scene evaluation plan
- retained raster / effect tiles
- dirty region / dirty tile set
- viewport coverage
- resource residency
- previous valid derived results keyed by revision

変更のない領域をPointer sampleごとに再Rasterize / 再Compositeしない。

#### 8.7.2 Viewport-first

Current Viewport + dependency marginを最優先Working Setとする。

Pan / Zoom時は既存retained tilesを再利用し、新しく露出する領域だけをDemandする。

Offscreen document completionをnavigationの同期条件にしない。

#### 8.7.3 Dirty Region First

Canonical changeはAffected Entity / Bounds / dependency influenceからdirty propagationする。

Rendererは可能な限りdirty tile / dirty rectのみ更新する。

通常Brush sampleでCanvas全体を`copyTextureToTexture`または同等full-surface copyする構造を禁止する。

#### 8.7.4 Presentation surface

GPUCanvasContext等のpresentation textureは最終present targetであり、Canonical Artwork storeではない。

Retained scene / tile resourcesからcurrent presentation textureへ必要領域をcomposeする。

Presentation texture消失でArtworkを失わない。

#### 8.7.5 Canvas UI overlay separation

Selection halo、Transform handle、Ruler、Guide、Cursor、Quick Hole等のUI / interaction overlayをArtwork canonical pixelへBakeしない。

Artwork render layerとoverlay layerをlogicalに分離し、Overlay更新だけでArtwork tilesをinvalidateしない。

#### 8.7.6 Multiple views

Normal / Soft Proof / Compare / Navigator等のViewは同一Canonical Documentを参照し、View-specific render configを持つ。

View追加のためDocument copyを作らない。

---

### 8.8 Raster Canonical Content / Tile Residency

#### 8.8.1 Sparse tiled raster

Raster ContentはCanvas全面1枚の巨大mutable bitmapを唯一表現としない。

論理的にはDocument / Layer Local Space上のsparse tile / block単位Content Revisionとして扱えるArchitectureを採用する。

Tile dimension / border / compression / pixel formatはSection 9。

#### 8.8.2 Immutable tile revision

Logical Revisionから参照されるRaster tile revisionはimmutable semanticsを持つ。

Interaction中はmutable working tileを持てるがCommit後は新Content Revisionとしてfreezeし、過去Revisionから参照されるtileをin-place書換えしない。

#### 8.8.3 GPU-first working tiles

Direct Painting中のCurrent visible tileはGPU resident working representationをPrimaryにできる。

ただしCommit済みArtworkをGPU textureだけでしか再構成できない状態へ長時間置かない。

Canonical Raster Revisionは次のいずれか、または組合せで再構成可能でなければならない。
- materialized immutable tile payload
- deterministic mutation record + immutable base revision
- canonical source / operation payload

具体Delta形式はSection 9。

#### 8.8.4 No synchronous readback requirement

Stroke CommitのためにGPU texture全体 / affected tile全体を同期readbackすることを要求しない。

Input / generated dab / source snapshot / parameters等からRecovery / materialization payloadを構成できる設計を優先する。

Readbackが必要な特殊operationはasync laneへ分離し、User-visible semanticsに必要な最小領域へ限定する。

#### 8.8.5 Bounded replay distance

未materialized mutation chainを無制限に深くしない。

Runtime / Persistenceはbackground materialization / checkpointを行い、Undo / reopen / device recoveryが巨大Operation streamの先頭からReplayする構造を避ける。

Exact thresholdはSection 9 / 10。

#### 8.8.6 Overscan artwork

Canvas Bounds外Artworkも同じsparse content systemで保持する。

Canvas Rectはvisibility / export frameであり、Raster Storeのhard clipping boundaryにしない。

---

### 8.9 Visual Stack / Dependency / Effect Runtime

#### 8.9.1 Canonical graph vs Runtime Evaluation Plan

Visual Tree / Typed Relation / Modifier semanticsはCanonical Modelに保持する。

Render runtimeはそこから**Resolved Evaluation Plan**をDerived生成してよい。

PlanはGeneration Stampを持ち、Structureが変わらないParameter editでは全Plan rebuildを要求しない。

#### 8.9.2 Demand-driven evaluation

Dependency evaluationはDemand-drivenとする。

Demand例:
- Current Viewport tile
- Export Snapshot target
- Navigator thumbnail
- Selection source

未表示・未参照resultをForeground direct interactionの同期条件にしない。

#### 8.9.3 Dependency cache key

Derived resultは少なくとも意味上:
- Source Revision(s)
- Modifier / Parameter Revision
- Mask / Selection dependency revision
- tile / bounds identity
- Color / render config

をkeyにしてfreshnessを判断できる。

名前やUI selection indexでcache identityを作らない。

#### 8.9.4 Influence propagation

Effect / ModifierはSection 3のLocal / Bounded Expansion / Global influence semanticsをRuntimeへ渡す。

Dirty propagationはChanged Bounds + Influenceから必要領域へ拡張する。

Global effectでも每sample full-document eager evaluationを既定にしない。

#### 8.9.5 Visible exact result

Current Viewportで必要なresultはCurrent Effective Stateに対して意味的に正しくする。

LODを使う場合もSemantic equivalenceを保つ。

Release後に別Algorithmへswitchして形 /色 /mask boundaryが飛ぶ方式は禁止する。

#### 8.9.6 Effect / generator background preparation

Shader / pipeline compilation、large LUT preparation、resource decode等は可能な限りTool selection / effect creation / idle時にprepareする。

Pointer drag開始後に初めて全pipeline compileを行うことを常態化させない。

---

### 8.10 Document Revision / Interactive Commit Architecture

#### 8.10.1 Canonical Root

Current Documentはimmutable Revision Rootを指す。

Rootはpersistent structureを利用し、変更していないNode / Entity / Content Revisionを共有する。

1 editごとのFull Document cloneを禁止する。

#### 8.10.2 Interactive Working State

Interaction中だけmutable / transient Working Stateを許可する。

Working Stateは:
- Interaction Base Root
- target Runtime Handles
- changed content working references
- parameter overrides
- affected bounds
- cancellation data

を持つ。

#### 8.10.3 Atomic publish

Semantic Commit時、変更されたEntity Revision / Content Revision / relationだけから新Revision Rootを構成し、Current Root pointerをAtomicにpublishする。

Publish後、次commandは必ずnew rootを観測する。

#### 8.10.4 Commit cost boundary

Commit hot pathは今回変更されたWorking Setへ比例することを原則とする。

次への比例を通常caseで避ける。
- Canvas area
- total layer count
- total history length
- total project resource count
- total branch count

#### 8.10.5 Change Capture

Interaction中にAffected Entity / Bounds / semantic command / dependency invalidationをCaptureし、Commit後のbefore-after full document diffを不要にする。

同じChange CaptureをHistory、Recovery、Collaboration、Incremental Saveへfan-outできる。

#### 8.10.6 Cancel

Interaction CancelはInteraction Base Root / working overlay discardで戻せる。

CancelのためBegin時Full Canvas Copyを行わない。

---

### 8.11 History / Snapshot / Branch Runtime

#### 8.11.1 Revision-root history

History NodeはCanonical Revision Root参照を持つ。

Artwork payloadをHistory Nodeごとに二重Full Copyしない。

#### 8.11.2 Structural sharing

Branch / Snapshot / Checkpoint / Variant Baseはimmutable roots / content blocksを共有可能とする。

Logical independenceとphysical dedupを分離し、Variant編集が元Projectへ伝播しない。

#### 8.11.3 Hot / Warm / Cold

Runtime historyを少なくとも概念上:
- Hot: recent state / GPU / decoded resource ready
- Warm: local materialized blocks ready
- Cold: persistent blocksからreconstruct可能

に分けられる。

Hot cache容量はmemory pressureで変えられ、Section 6のpersistent History保証を減らさない。

#### 8.11.4 Bounded restore

Cold History restoreはnearest materialized root / checkpointからBounded復元する。

History先頭から全operation replayを既定にしない。

#### 8.11.5 Retention roots

GCで保持すべきRoot:
- Current Root
- Last Good
- Previous Good
- Current / retained Branch Head
- Named Checkpoint
- active Export Snapshot
- Project Variant shared base while referenced
- Recovery Base / protected target

Derived thumbnail / search cacheはretention rootにしない。

---

### 8.12 Memory / Cache / Resource Governor

#### 8.12.1 Explicit budgets

CPU heap、GPU memory、decoded image cache、tile cache、history hot cache、worker buffersをbudget管理する。

`available memoryがあるだけ使う`方式にしない。

Exact budget値 / device-class scalingはSection 10 reference device測定とSection 9 implementationへ送る。

#### 8.12.2 Pin classes

Resourceを概念上:

**Pinned Critical**
- Current canonical rootに必要なsmall structural state
- Active interaction working set
- Recovery-critical unsaved payload

**Pinned Visible**
- current viewport render dependencies
- current Tool required resource

**Warm**
- nearby tiles
- recent Undo target
- recent effects

**Evictable Derived**
- offscreen composite
- thumbnail
- search helper
- navigator cache
- speculative decode

に分類する。

Memory pressure時は下からevictする。

#### 8.12.3 GPU memory pressure

GPU cache evictionでCanonical Artworkを失わない。

Evicted tileはCanonical materialized blockまたはreconstructible payloadから再生成できること。

#### 8.12.4 Allocation discipline

Pointer sample / dab loopで大きなtemporary object / ArrayBufferを毎回生成しない。

Buffer pool / arena / reusable command structureを利用可能とする。

Exact allocatorはSection 9。

#### 8.12.5 Thermal / battery governor

Thermal / battery pressureで最初に落とすもの:
- speculative preload
- thumbnail
- search indexing
- timelapse encode
- offscreen effect completion

Direct Inputのsemantic qualityを先に落とさない。

Idle時はcontinuous render / pollingを停止する。

---

### 8.13 Project Store / `.illustro` Physical Architecture

#### 8.13.1 Two physical contexts, one native schema

Native Project formatは同じLogical Package Schemaを使い、物理contextを分ける。

1. **Working Project Store**: Local Library内でincremental / atomic saveに最適化したinternal segmented representation。
2. **Portable `.illustro` Container**: Share / Save Project Copy / external file用のsingle-file native package。

両者のCanonical semantics / Format Version / Capability Manifestは同じであり、Working Storeだけに存在してPortable Copyで失われるArtwork semanticsを作らない。

#### 8.13.2 Browser local store mapping

Web runtimeのLocal Project Libraryは**OPFSをPrimary canonical byte store**とする。

理由:
- origin-private
- large binary / in-place access向け
- Workerからaccess可能
- Worker-only synchronous access handleを利用可能

Project card search / sort等のsmall derived indexはIndexedDB等を利用可能だが、Index喪失でCanonical Projectを失わない。

OPFSはuser-visible backupそのものではないため、Portable Project Copy / external backup routeを別途維持する。

#### 8.13.3 Persistent storage request

Platformがpersistent storage requestを提供する場合、Project Libraryを継続利用する段階で適切にrequestできる。

拒否されても制作不能にせず、Storage Healthでeviction risk / backup routeを説明する。

#### 8.13.4 Working project layout

Working Projectは論理的に:
- Project identity
- generation manifests
- immutable content chunks / blocks
- resource blobs
- history blocks
- recovery relation metadata
- derived preview/index namespace

を分離する。

Canonical blockとDerived blockを同じGC priorityにしない。

#### 8.13.5 Content-addressed immutable blocks

大きなCanonical payload / Resourceはimmutable blockとして保存し、content identity / integrity identityを持てる。

同一Project内のRevision sharing、Variant physical dedup、Checkpoint retentionへ利用可能とする。

Hash algorithm / chunk size / compressionはSection 9。

#### 8.13.6 Portable container

`.illustro` single-file containerは少なくとも:
- Magic / format identification
- Version / capability header
- Generation manifest
- indexed chunks / resources
- integrity metadata
- optional preview

を持つself-describing packageとする。

任意code payloadを実行しない。

Physical byte layoutはSection 9で固定する。

#### 8.13.7 Large-file streaming

Portable import / export時にProject全体を1巨大ArrayBufferへ読み込むことを要求しない。

Stream / chunk単位でvalidate / copy / encodeできるArchitectureを採る。

---

### 8.14 Durable Save / Recovery Architecture

#### 8.14.1 Generation-based durable save

Durable saveはCurrent Working Storeをin-place破壊的上書きするのではなく、新**Generation**を構成する。

概念手順:
1. Save Snapshot Revisionを固定
2. 新規 / 変更Canonical blocksを書込
3. generation manifestを書込
4. required block integrityを確認
5. storage flush / durable boundaryを通す
6. active generation pointerをcommit
7. N+1をLast Goodへ昇格
8. NをPrevious Goodとして保持

Step 6前にNを破棄しない。

Exact atomic pointer / double-superblock / rename protocolはSection 9 / platform adapterで決定する。

#### 8.14.2 Save snapshot isolation

Save中にDrawingが進んでもSave Snapshotは固定する。

新editは次generationへ入り、現在save中のmanifestへ途中混入しない。

#### 8.14.3 Recovery Store separation

Recovery StoreはNormal Project generationと別namespace / journalとして保持する。

Realtime CoreのCommit Change Captureから**Recovery Packet**を生成し、Persistence WorkerのP3 laneへ送る。

Recovery PacketはLast Durableからtarget Revisionを再構成するため必要なSemantic / changed block dataを含む。

#### 8.14.4 Recovery Packet path

```text
Logical Commit
  ↓ lightweight Change Capture
Recovery Packet Queue (Must Preserve)
  ↓
Persistence Worker Safety Lane
  ↓ write + integrity
Recovery-Protected Through = Rn
```

Memory queueに入っただけではRecovery-Protectedを進めない。

#### 8.14.5 Recovery and raster GPU state

Raster interactionでGPU resultが先行しても、Stroke source / generated canonical mutation dataをRealtime Core側で保持し、GPU readbackだけをRecovery Packet生成手段にしない。

GPU device loss時はLast materialized content + retained deterministic mutationからCurrent Canonical Resultを再構成可能にする。

#### 8.14.6 Autosave catch-up

Recovery-Protected StateとDurable Saved Stateを別watermarkとして追跡する。

```text
Current Revision
Recovery-Protected Through
Durable Watermark
```

Autosave workerはdirty block setをcoalesceし、Section 6 / 7 cadenceでDurable Watermarkを追いかける。

#### 8.14.7 External file durability

User-visible external `.illustro`へ保存するPlatform Adapterは、Last Good破壊を避けるため:
- transactional writable stream / temp replacementが保証される場合はそれを利用
- 保証できない場合はnew complete copyを先に作り、validation後に明示replace

を行う。

外部APIのwrite成功だけで`Saved`とせず、Section 6のcommit pointを満たす。

#### 8.14.8 GC / Compaction

GC / compactionはCurrent interaction同期条件にしない。

Mark rootsは8.11.5を利用し、Unreferenced blockだけを削除する。

Storage pressure時もCurrent Last Good / Recovery-critical blockを先に削除しない。

---

### 8.15 Import / Export / Untrusted Data Architecture

#### 8.15.1 Staged import

External fileは直接Current Project graphへparseしながら書き込まない。

Pipeline:
1. untrusted input stream
2. parser limits / type validation
3. staged intermediate representation
4. compatibility analysis
5. resource / profile resolution
6. user choice where ambiguity exists
7. atomic canonical import commit

Failure時にhalf-imported projectをCurrent stateへ残さない。

#### 8.15.2 Parser isolation

PSD / SVG / image / asset package parseはUtility Workerへ分離する。

SVG script / event / remote fetchを実行しない。

Path traversal / archive expansion / entry count / dimension等をparser boundaryで検査する。

#### 8.15.3 Export snapshot

Export開始時にDocument Revision Rootをpinし、Export JobはそのSnapshotだけを参照する。

以後のDrawingは別Revisionへ進み、Export workerへ混入しない。

#### 8.15.4 Export render scheduling

ExportのGPU render demandがある場合もRender OwnerのP6 laneを通す。

Foreground direct interaction中はExport tileを大量submitしてCurrent frameを遅らせない。

Encode / container writeはUtility / Persistence側へ分離する。

#### 8.15.5 Compatibility provenance

Rasterized fallback / Approximate mapping等はIntermediate representationへprovenanceを付け、UI Compatibility Reportと実際のresultが同じclassificationを参照する。

---

### 8.16 Color Management Architecture

#### 8.16.1 Canonical color ownership

Document working color space / embedded ICC profileをCanonical Document metadataとして持つ。

Display transform、Soft Proof、Export transformを別Derived pipelineとする。

#### 8.16.2 Color Transform Service

Profile digest + source/destination profile + Rendering Intent + BPC等からColor Transformを生成する共通Serviceを持つ。

同一transformをcacheし、pixelごとにprofile parse / transform compileを行わない。

#### 8.16.3 Reference CPU transform + GPU application

Color transform correctnessのReference pathをCPU / WASM側に持ち、Realtime displayではvalidation済みLUT / GPU representationへ変換して適用できる。

GPU displayとExport CPU pathで別のColor semanticsを実装しない。

Section 7のΔE targetはSection 10でreference transformと照合する。

#### 8.16.4 Alpha separation

Color transform pipelineとAlpha coverageを分離する。

Premultiply / unpremultiply等のrepresentation boundaryを明示し、profile conversionでAlpha値を変更しない。

Transparent edge RGBを不用意にzero / whiteへ置換しない。

#### 8.16.5 Proof views

Soft ProofはView-specific transformとしてRender Planへ挿入する。

Canonical pixelsを書換えず、Normal ViewとProof Viewが同時に同じDocument Revisionを参照できる。

---

### 8.17 Device Loss / Worker Failure / Backend Recovery

#### 8.17.1 GPU device loss

GPU device lossをCanonical data lossとして扱わない。

Recovery sequence:
1. presentation / submit停止
2. Device Lost status
3. volatile GPU cache破棄
4. adapter / backend再取得
5. pipeline / resource registry再構築
6. Current Canonical Root + retained mutationからvisible working set再生成
7. presentation resume

Document Logical Revisionをolder stateへsilent rollbackしない。

#### 8.17.2 During device recovery

GPU unavailable中にArtwork direct operationを受理して結果が見えない状態を無制限に作らない。

短時間のrecovering statusとし、必要ならArtwork editだけ一時disabled + reasonを示す。UI / Save / Recovery protectionは可能な範囲で維持する。

#### 8.17.3 Worker crash

Realtime Worker自体のunexpected terminationはprocess-level recovery eventとして扱う。

Persistence Worker上のLast Good / Recovery-Protected ThroughからProjectを再構成する。

Recovery-Protected以降のmemory-only editが存在した可能性を隠さない。

#### 8.17.4 Storage worker failure

Persistence Worker failureでLogical Currentをrollbackしない。

新Persistence Workerを再起動し、未protected committed payloadがRealtime Core memoryに残る場合は再送する。

復旧不能ならSave Issueを表示する。

#### 8.17.5 Backend fallback

Device reacquireでPrimary GPU backendが使えない場合、Compatibility Backendへ移行可能。

Current Project semanticsを完全維持できない場合はread-only / save-copy / restart routeを出し、silent rasterize等を行わない。

---

### 8.18 Collaboration / Network Isolation

#### 8.18.1 Local-first commit

Collaboration activeでもLocal allowed operationはまずLocal Logical RevisionへCommitし、visible resultをNetwork ACK待ちにしない。

#### 8.18.2 Operation transport

Networkへ送るのはCanonical semantic operation / changed content reference / collaboration metadataであり、screen pixelsやUI pointer positionをArtwork canonical stateとして送らない。

#### 8.18.3 Remote operation apply

Remote operationはRealtime Coreへ明示source / ordering metadata付きで入り、Section 5 conflict semanticsに従う。

Same raster target conflict等をnetwork layerのLast Writer Winsだけで解決しない。

#### 8.18.4 Offline transition

Network disconnectでSolo local editingを停止しない。

Shared stateのpending statusを分離し、Local Project durabilityは通常どおり継続する。

---

### 8.19 UI / Accessibility Architecture

#### 8.19.1 Semantic UI outside artwork pixels

Tool / Menu / Panel / Properties / Layer / Status等の操作UIをGPU canvas pixelだけで構成しない。

Accessibility Name / Role / Value / Focus / Keyboard routeを持つsemantic UI layerを維持する。

Canvas overlayでも操作可能controlはAccessibility proxy / semantic counterpartを持つ。

#### 8.19.2 Main Thread budget

Accessibility tree更新 / DOM diffがCanvas Inputを長時間blockしないよう、Artwork direct interaction中は不要なlarge UI rerenderを避ける。

High-frequency scalar表示は必要値だけ更新し、Layer Panel全再render等をsampleごとに行わない。

#### 8.19.3 Focus ownership

Canvas / Panel / Dialog / PiP間のFocus stateをUI Domainで管理し、Realtime Worker crash / render resetでKeyboard focusを無関係に失わせない。

#### 8.19.4 Reduced Motion / Transparency

Appearance preferenceはUI render configへ入り、Artwork Document Revisionを変更しない。

---

### 8.20 Diagnostics / Observability Architecture

#### 8.20.1 Local instrumentation

Development / diagnostic buildでは少なくとも次のtimestamp / counterを取得可能にする。

Input:
- event received
- realtime transport enqueue/dequeue
- prepared context validation

Render:
- visible demand created
- command encoding start/end
- GPU submit
- presentation frame id / timestamp where measurable
- dirty tile count
- visible tile count

Queue:
- per-lane depth
- coalesce count
- dropped stale work
- oldest Recovery Safety item age

Persistence:
- Logical Revision
- Recovery-Protected Through
- Durable Watermark
- recovery append latency
- generation write / flush / activate timing

Memory:
- CPU retained bytes by cache class
- GPU estimated resource bytes
- eviction count

#### 8.20.2 Diagnostic overlay

開発用OverlayはInput-to-Present、frame pacing、queue depth、GPU submit/frame、dirty tiles、Recovery lag等を表示可能にする。

Release user UIへ常時露出する必要はない。

#### 8.20.3 Instrumentation isolation

Detailed tracingはOFF可能とし、Release performanceを有意に変えない。

InstrumentationのためにPointer sampleごと大量string log / DOM updateを行わない。

#### 8.20.4 Architecture assertions

Development buildで次をassert / detect可能にする。
- pointer eventごとのfull-surface copy
- unbounded queue growth
- stale generation use
- GPU resource owner violation
- Last Good activation前delete
- Recovery watermarkのfalse advance
- main-thread long task source
- unexpected remote fetch from import

---

### 8.21 Section 8 完了条件 / Architecture Invariants

本章の確定事項を次のInvariantsとする。

1. Main ThreadはDOM / Accessibility / Input Broker / Platform UI integrationを主責務とし、Brush raster / full composite / persistence encodeを常用しない。
2. Web runtimeのPrimary構成はRealtime Core + Render OwnerをDedicated Workerへco-locateし、Offscreen presentationを利用可能なら利用する。
3. GPU resourceはsingle Render Ownerへ集中し、Worker間でmutable GPU stateを共有しない。
4. PersistenceはDedicated Worker ownerとし、OPFS worker accessをPrimary local byte storeとして利用する。
5. Utility Worker Poolはboundedで、Foreground CPU budgetを使い切らない。
6. Canonical CoreをDOM / Web-specific handleへ依存させずPlatform Adapter境界を持つ。
7. WebGPUをPrimary GPU Backendとし、Compatibility backendは同じCanonical semanticsを満たす場合のみformal supportに利用する。
8. CPU fallbackを高機能Realtime Canvasのsilent equivalentにしない。
9. Backend downgrade / capability不足をsilentに隠さない。
10. Pointer sampleはtimestamp / input properties / View Generationを保持し、後のView変更で再解釈しない。
11. Prepared Interaction Contextを使いPointer Down時のfull graph traversalを避ける。
12. Hot input transportはbounded / low-allocationとし、Shared transport不可でもCanonical sample semanticsを変えない。
13. SchedulerはP0 Realtime / P1 Required Visible / P2 Commit / P3 Recovery / P4 Visible Catch-up / P5 Autosave / P6 Background Job / P7 Maintenance相当の優先関係を持つ。
14. Recovery Safety Laneはstarvation-freeでSection 7 deadlineを守れるArchitectureとする。
15. WorkをMust Preserve / Latest Wins / Mergeable / Cancelable等へ分類し、全workを1 FIFOへ入れない。
16. Realtime / utility queueをunboundedにしない。
17. GPU workをpointer eventごとsubmitせず、通常1 submission / surface / display frameをPrimary policyとする。
18. Release時にfinal canvasを最初から再構築することをCommit protocolにしない。
19. `Realtime result -> Canonical reconciliation result`の別意味二段階表示を通常pipelineにしない。
20. Rendererはretained / viewport-first / dirty-region-firstとする。
21. Pointer sampleごとのfull-surface texture copyを通常経路にしない。
22. Presentation textureはCanonical Artwork storeではない。
23. Overlay UI更新だけでArtwork canonical tilesをinvalidateしない。
24. Raster contentはsparse tiled / block-addressable Architectureを持つ。
25. Commit済みRaster tile revisionはimmutable semanticsを持つ。
26. GPU-first working resultを許可するが、GPU memoryだけを唯一のrecovery sourceにしない。
27. Commitのための同期GPU→CPU full readbackを要求しない。
28. 未materialized mutation chainを無制限に深くせず、restore replay distanceをBound可能にする。
29. Canvas外Artworkを同じsparse content systemで保持する。
30. Canonical dependency graphとDerived Evaluation Planを分離する。
31. Parameter editだけで全Evaluation Plan rebuildを要求しない。
32. Dependency evaluationはDemand-driven / Viewport-firstを許容し、offscreen全評価をForeground条件にしない。
33. Dirty propagationはAffected Bounds + Influence semanticsを利用する。
34. Document Revision Rootはimmutable persistent structureを使い、1 editごとのFull Document copyを要求しない。
35. Interaction中だけTransient Working Stateを持ち、CommitでAtomic new rootをpublishする。
36. Commit後の次Interactionはnew rootを必ず観測する。
37. Change CaptureをInteraction中に行い、Commit後full-document diffを不要にする。
38. History / Branch / Snapshot / CheckpointはRevision Root / immutable blocksをstructural shareする。
39. Cold History restoreをnearest materialized rootからBound可能にし、history先頭からの無制限replayを既定にしない。
40. GC retention rootにCurrent / Last Good / Previous Good / Branch Head / Checkpoint / Recovery / active Snapshotを含める。
41. MemoryはCPU / GPU / decoded / history / worker bufferをbudget管理する。
42. Memory pressureではDerived / speculative cacheからevictし、Canonical / Recovery / Active Interactionを守る。
43. GPU cache evictionでCanonical Artworkを失わない。
44. Pointer hot loopのlarge allocation churnを避ける。
45. Native schemaはWorking Project StoreとPortable `.illustro` Containerの両物理contextで同じCanonical semanticsを保持する。
46. Web Local LibraryのCanonical byte storeはOPFSをPrimaryとし、IndexedDB等のIndex喪失でArtworkを失わない。
47. Portable `.illustro`はsingle-file self-describing indexed chunk packageとし、streaming可能なArchitectureにする。
48. Durable saveはGeneration-basedで、N+1 activation前にNを破壊しない。
49. Save Snapshotへ後続editを混入させない。
50. Recovery StoreをNormal Project Generationから分離する。
51. Recovery-Protected watermarkはdurable write + integrity確認後だけ進める。
52. Raster Recovery Packet生成をGPU full readbackへ依存させない。
53. AutosaveはRecovery-Protected ThroughとDurable Watermarkを別追跡する。
54. External save adapterもLast Good survival contractを満たす。
55. GC / compactionをDirect Interaction同期条件にしない。
56. Importはstaged parse -> compatibility -> atomic commitとし、half-importをCurrent Projectへ残さない。
57. Untrusted parserをWorker隔離し、script / remote fetch / path traversalを許さない。
58. Exportは開始Revision Snapshot固定で、Drawing後続editを混入させない。
59. Export GPU workはForegroundより低いScheduler laneを通す。
60. Color ManagementはCanonical Document Profile / Display / Proof / Export transformを分離する。
61. Realtime GPU color transformとExport reference transformは同じColor semanticsを共有する。
62. Color transformでAlpha coverageを変更しない。
63. GPU device lossでCanonical Artworkを失わず、Current Rootからvisible stateを再構築する。
64. Worker failure / Persistence failureをLogical Current rollbackと同義にしない。
65. Collaboration local editをNetwork ACK待ちにしない。
66. Interactive UIはsemantic DOM / Accessibility layerを持ち、GPU canvas pixelだけを操作UIにしない。
67. Development buildでInput-to-Present / frame / queue / Recovery / Save / Memoryを観測可能にする。
68. Instrumentation自体をHot Pathのstall原因にしない。
69. Section 9のAlgorithmは本ArchitectureのOwnership / Priority / Durability contractを弱めない。
70. Section 10のGateでSection 7 targetを満たせないArchitecture上の原因が判明した場合、小手先のPreviewやTarget緩和ではなくSection 8へ戻って修正する。

Section 9では、Brush sampling / Stable Prefix / Dab generation / GPU raster / tile format / blend / dirty propagation / Region topology / Effect evaluation / Color transform / persistent structures / delta / chunk / compression / integrity等の具体Algorithmを決定する。

Section 10では、このArchitectureがSection 7 targetを満たすことをReference Device、long-session、GPU loss、storage fault、corruption、import fuzz、Accessibility等で検証する。

以上をもってSection 8「技術Architecture」を確定する。