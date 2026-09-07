## 7. 非機能要件・性能 / Reliability / Accessibility Target — 確定

### 7.0 この章の位置づけ

本章は、Section 1〜6で確定した製品Semanticsを、**測定可能な品質Target**へ変換する。

本章で決めるのは、どの程度速く、滑らかに、壊れにくく、復旧可能で、長時間安定し、入力方式やAccessibility条件が変わっても使えるべきかという製品品質の契約である。

本章はArchitectureやAlgorithmを規定しない。Queue、Thread / Worker、GPU backend、Storage API、Chunking、Cache、Scheduling、Compression、Rasterization、Journal、Memory allocator等の実装方式はSection 8 / 9へ送る。具体Benchmark fixture、fault injection、measurement harness、PASS / FAIL gateはSection 10で定義する。

後続技術都合で次を弱めてはならない。
- Direct manipulationをBackground work待ちにしない。
- `Saved` / Recovery / Compatibilityの意味を性能都合で偽装しない。
- Fake low-quality previewを別Semanticsとして見せない。
- History長、Stroke数、Project経過時間が増えるほどHot Pathが線形劣化する設計を許容しない。
- AccessibilityをDesktop keyboardだけ、Touchだけ、Colorだけ等の単一経路へ依存させない。
- Offline solo制作をNetwork availabilityへ依存させない。

### 7.1 Measurement Model / Quality Classes

#### 7.1.1 Percentile-based target

性能評価はbest caseや平均値だけで判定しない。

主要Interactive metricは原則として次を記録する。
- p50
- p95
- p99
- worst observed / stall count

平均値が良くても周期的な大stallが残る場合はZero-lag要件を満たさない。

#### 7.1.2 Display-frame normalized latency

Canvas直接操作は固定60Hz前提にしない。

現在の表示Refresh Rateを`R Hz`、1 display frameを`Tframe = 1000 / R ms`として評価する。

例:
- 60Hz: Tframe ≈ 16.7ms
- 90Hz: Tframe ≈ 11.1ms
- 120Hz: Tframe ≈ 8.3ms
- 144Hz: Tframe ≈ 6.9ms

High-refresh deviceで60Hz相当の更新しか行わない状態を`十分高速`とみなさない。

#### 7.1.3 Direct Interaction Latency

**Direct Interaction Latency**は、Appが有効なInput sample / parameter changeを受理した時点から、その意味に一致するCurrent Effective Stateが最初にpresentされるまでとする。

内部queue enqueueまで、CPU処理完了まで、GPU submitまで等をVisible latencyの代替指標にしない。

Exact presentation timestamp取得方法はSection 10。

#### 7.1.4 UI Response Latency

**UI Response Latency**は、Tap / Click / Key / Command等を受理してから、押下状態、選択状態、Panel表示、Status変更等の意味あるvisual feedbackがpresentされるまでとする。

重い処理を開始しただけでvisual feedbackがない状態をResponse完了と数えない。

#### 7.1.5 Reference Performance Classes

Section 10では最低限次のclassを用意する。

- **Baseline 60**: 正式Support対象の現実的な60Hz端末class。
- **High Refresh**: 90 / 120Hz以上の対応端末class。
- **Constrained Mobile**: Memory / thermal / storage条件が厳しい正式Support端末class。

特定vendor / modelを製品仕様に固定せず、Section 10の実機fixtureで代表端末を選ぶ。

Performance targetを満たすためだけに正式Support対象を不自然に狭めない。

### 7.2 Zero-Lag Direct Manipulation Target

#### 7.2.1 Core latency target

Brush、Eraser、Blend、Liquify、Transform handle、Selection handle、Effect anchor、Canvas Pan / Zoom / Rotate、Color direct manipulation等、Current Effective Stateを直接操作する経路は次をTargetとする。

- **p50 ≤ 1 display frame**
- **p95 ≤ 2 display frames**
- **p99 ≤ 3 display frames**

60Hz換算ではおおむね:
- p50 ≤ 16.7ms
- p95 ≤ 33.3ms
- p99 ≤ 50ms

120Hz換算ではおおむね:
- p50 ≤ 8.3ms
- p95 ≤ 16.7ms
- p99 ≤ 25ms

これは内部処理時間ではなく、Input acceptanceから意味一致Visible ResultまでのTargetである。

#### 7.2.2 Pointer Down / First Mark

Brush系ToolはPointer Downから最初の有効Markが見えるまでp95 ≤ 2 frameをTargetとする。

Stroke開始時のResource resolve、Autosave、History準備、Thumbnail更新等を同期条件にしない。

#### 7.2.3 Stroke continuation

連続Stroke中はInput sampleが溜まって数frameごとにまとめてジャンプ表示される`chunky progression`を許容しない。

Stable Prefix / Mutable Tail等の内部方式はSection 8 / 9へ送るが、Visible resultはdisplay cadenceへ継続的に追従すること。

#### 7.2.4 Pen Up / Finalize

Pen Up / Pointer Up後、Stroke semantic finalizeのためにCanvasが停止して見える状態を作らない。

ReleaseからCurrent canonical visual resultが確定して見えるまでp95 ≤ 2 frameをTargetとする。

History entry、Autosave、Index、Timelapse、offscreen canonical work等はVisible finalizeの同期条件にしない。

#### 7.2.5 Selection finalize

Lasso / Polygonal / Region Selection等でgestureが完了してから、確定Selection boundary / haloが見えるまでp95 ≤ 2 frameをTargetとする。

Selection確定後に必要なThumbnail / Search / persistence処理はBackgroundへ送る。

#### 7.2.6 Transform / Effect / Liquify

Handle drag、Effect parameter slider、Liquify gestureはPointer movementへ同じCore latency targetで追従する。

操作中だけ別意味の低品質Resultを見せ、release後に形が飛ぶ設計は禁止する。

内部LODは最終意味と一致し、interaction中のVisible Stateとfinal semantic resultが連続である場合のみ許容する。

#### 7.2.7 Canvas navigation

Pan / Zoom / View Rotate / Mirror等のViewport操作もp50 ≤ 1 frame / p95 ≤ 2 frameをTargetとする。

高解像度tileやoffscreen detailのcatch-upをViewport movement同期条件にしない。

### 7.3 Frame Pacing / Jank Target

#### 7.3.1 Refresh adaptation

Foreground direct interaction中は利用可能なDisplay refreshへ追従する。

60 / 90 / 120 / 144Hz等に対して固定interval timerを前提にしない。

#### 7.3.2 Frame interval quality

Steady direct manipulation中のApp-attributable frame pacingは次をTargetとする。

- frame interval p95 ≤ 1.5 × Tframe
- frame interval p99 ≤ 2 × Tframe
- 3 display opportunity以上連続してCurrent interaction resultが更新されないburstをRelease-qualityでは許容しない

OS compositor pause、browser tab suspension等のApp外要因はSection 10で別分類するが、GC pressureや自前Background task起因のstallはApp-attributableとして扱う。

#### 7.3.3 Long task rule

Active direct manipulation中の**App-attributable main-thread blocking > 50ms**はRelease blockerとする。

Autosave、Export、Thumbnail、Search indexing、History pruning、Resource cleanup等が周期的Long Taskを作る状態を許容しない。

#### 7.3.4 No periodic hitching

同じ長尺Strokeを続けたとき、一定sample数 / tile数 / save intervalごとにカクつく周期性を許容しない。

平均FPSが高くてもperiodic hitchが再現する場合はFailとする。

### 7.4 Common UI Responsiveness

#### 7.4.1 Tool switch

既に利用可能なTool / Subtoolへの通常切替は:
- p95 ≤ 50ms
- p99 ≤ 100ms

をVisual selection + usable stateまでのTargetとする。

必要Resourceのlazy loadがある場合でもTool selected visualを100ms以内に返し、Resource load reason / stateを明示する。

#### 7.4.2 Panel / Menu / Sheet

Local UIのMenu、Context Menu、Properties、Page、Dialog、Sheet等は最初の意味ある表示をp95 ≤ 100msとする。

大量Asset / Font / History list等はcontainerを先に表示し、全item decodeを開く同期条件にしない。

#### 7.4.3 Command feedback

Commandが重い場合でもCommand acceptance / progress / state transitionをp95 ≤ 100msで視認可能にする。

200msを超えて無反応に見えるoperationを通常UXにしない。

#### 7.4.4 Local search

Global Command Search、Settings Search、Asset metadata search等、Local indexがreadyな検索は入力から結果更新までp95 ≤ 100msをTargetとする。

Cold index buildはForeground入力をBlockせず、未index状態を明示してfallback search可能にする。

### 7.5 Startup / Resume / Project Open

#### 7.5.1 Cold launch

Baseline Reference ClassでCold LaunchからProject Libraryが操作可能になるまで:
- p95 ≤ 1.5s
- p99 ≤ 2.5s

をTargetとする。

全Project thumbnail decode、Search index rebuild、Asset full scanをStartup同期条件にしない。

#### 7.5.2 Warm resume

Appが既にmemory-residentで通常resume可能な場合、Library / current projectが操作可能になるまでp95 ≤ 500msをTargetとする。

#### 7.5.3 Project open

Section 10で定義するReference Medium Projectは、Open commandから**正しいCurrent Canvasが見え、基本編集を開始可能**になるまでp95 ≤ 1.0sをTargetとする。

Reference Large Projectはp95 ≤ 2.5sをTargetとする。

全History thumbnail、全offscreen raster、全Reference、全Asset、全Effect cacheの復元をEdit Ready条件にしない。

#### 7.5.4 Progressive readiness

Project Openでは次を区別可能とする。
1. Project metadata ready
2. Current visible working set ready
3. Edit ready
4. Background optional data ready

3まで到達すればUserは制作を開始できる。4待ちでCanvasをBlockしない。

#### 7.5.5 Thumbnail failure isolation

Project Library thumbnailがmissing / stale / decode failureでもLibrary navigationとProject open targetを維持する。

### 7.6 Undo / Redo / History Responsiveness

#### 7.6.1 Recent Undo / Redo

Current visible working setに必要な直近Historyがwarmな場合、Undo / Redo target visible resultはCore direct target:
- p50 ≤ 1 frame
- p95 ≤ 2 frame

を目標とする。

#### 7.6.2 Cold retained History

Storageから追加materializationが必要なretained History / Branch / Checkpointでも、操作受理visualを100ms以内に返す。

Section 10 Reference Large History fixtureでTarget stateのfirst correct visible resultをp95 ≤ 500msとする。

#### 7.6.3 History scale isolation

History transaction数が増えるだけでCurrent Brush / Transform / Pan等のHot Path latencyが線形増加しないこと。

Current Branch 1000 transaction baseline保持はSection 6どおりであり、その保持自体を理由にinteractive latencyを劣化させない。

### 7.7 Long Session / Scale Stability

#### 7.7.1 No age-based degradation

同じVisible Scene / Tool条件で、長時間制作したという理由だけでDirect Interaction latencyが継続悪化しないこと。

Section 10の10,000 semantic transaction / long-stroke / long-session fixture後も、warm baselineに対してp95 latency劣化を**20%以内**に抑える。

Absolute targetである7.2も同時に満たす必要があり、20%以内なら遅くてもよいという意味ではない。

#### 7.7.2 Hidden complexity isolation

非表示Layer、未使用Asset、古いHistory、offscreen Reference等の数が増えても、Current visible brush pathへ毎sample比例costを持ち込まない。

#### 7.7.3 Memory growth

同じ操作cycleを繰り返したとき、Canonical requirementが増えていないのにretained memoryが無制限に単調増加しない。

Section 10のrepeat workloadでwarm-up後にGC / cache eviction可能状態を作り、cycleごとのretained memory増加が継続する場合はFailとする。

Exact memory budget / cache policyはSection 8。

#### 7.7.4 Layer / Stroke count independence

Stroke count / History countそのものを毎Pointer Moveで全走査する設計を品質上許容しない。

Visible complexityが同等なら、100 / 1,000 / 10,000 prior stroke stateでCore direct latencyが同じclassへ留まることをSection 10で検証する。

### 7.8 Memory Pressure / Thermal / Power Behavior

#### 7.8.1 Eviction priority

Memory pressure時は次の順で守る。
1. Current canonical edit state
2. Recovery-critical state
3. Current visible working set
4. Required current dependencies
5. Derived offscreen / thumbnail / search / export cache

Derived cacheを守るためにCanonical / Recoveryを破壊しない。

#### 7.8.2 Graceful pressure handling

Memory allocation failureが予測 / 検出された場合、無限retryやprocess crashを通常経路にしない。

可能な場合はDerived cache eviction、operation scope縮小、explicit failure reason、Save / Recovery保護へ移る。

Current artworkをsilent downsample / flattenしない。

#### 7.8.3 Idle behavior

User inputもBackground jobもないIdle状態で、Canvasを理由なくcontinuous redrawし続けない。

Hidden / background状態では通常render loopを停止し、Recovery-critical / user-requested Background export等の必要workだけを行う。

#### 7.8.4 Thermal degradation order

Thermal / power pressureでworkを減らす必要がある場合、まずoffscreen refresh、thumbnail、search index、preview cache、noncritical export priority等を下げる。

Direct input sampleを意図的に粗く捨てる、final semantic品質を変える、Autosave integrityを弱めることをPrimary mitigationにしない。

### 7.9 Durability / Recovery Service Level Target

#### 7.9.1 Recovery protection latency

Storageがhealthyで正常write可能な状態では、**completed semantic transaction**がRecovery-Protectedになるまで:
- p95 ≤ 1.0s
- p99 ≤ 2.0s

をTargetとする。

Active未完了Stroke等、まだDocument semantic transactionとしてCommitされていないinteractionはこのmetricとは分離する。

#### 7.9.2 Recovery loss window

正常条件では、Current committed Logical RevisionとRecovery-Protected Throughの時間差をp99で2秒以内に保つ。

これを超える状態が継続する場合、Recovery backlogとして診断可能にする。

#### 7.9.3 Durable autosave cadence

Section 6.5のDefault policyを品質Target化する。

Storage healthy時:
- continuous editing中、Durable Watermarkのtarget ageを30秒以内に保つ
- foreground interactionが約2秒idleになった後、current revisionへのDurable catch-upを優先し、Section 10 Reference Medium dirty setで追加3秒以内p95をTargetとする

つまり通常Medium workloadでは、約2秒idle開始からp95 5秒以内にCurrentが`Saved`へ追いつくことを目標とする。

#### 7.9.4 Save Now

Reference Medium dirty setで`Save Now`対象RevisionがDurableになるまでp95 ≤ 2sをTargetとする。

Reference Large dirty setではp95 ≤ 5sをTargetとする。

Drawingはその間もCore interaction targetを維持する。

#### 7.9.5 Background / suspend signal

OS / browserからvisibility loss、background、suspend予告等のsignalを受けた場合はRecovery-critical flushを最優先する。

Platformが十分なexecution windowを保証しない場合、`background signalを受ければ必ずdurableになる`とは偽保証しない。利用可能window内でRecovery protection成功率を最大化し、Section 10でplatform別に検証する。

#### 7.9.6 Fault-injection durability

Saveの任意phaseでprocess kill / write failure / storage full等を注入しても:
- 直前Last Goodがreadableであること: **100%**
- Recovery-Protectedと判定済みRevisionがvalid recovery candidateとして再構成可能であること: **100%**
- partial generationを`Saved`扱いしないこと: **100%**

をRelease gateとする。

### 7.10 Reliability / Correctness Target

#### 7.10.1 Native round-trip

`.illustro` Save -> Close -> Reopenで、supported Canonical Project semanticsは100%保持する。

Pixel / Object / Layer / Effect / Text / Stable ID / History / Branch / Checkpoint / Resource / Color metadata等について、Section 6 Canonical setのlossを許容しない。

#### 7.10.2 Deterministic state

Stable seedやexplicit parameterでDeterministicと定義されたoperationは、同じCanonical input / versioned semanticsで同じCanonical resultを得る。

Cache hit / miss、Worker count、render timingでArtwork意味が変わらない。

#### 7.10.3 Failure isolation

Thumbnail、Search index、Navigator、Export preview、Reference preview、optional Effect cache等のDerived subsystem failureでCurrent Projectをcorrupt扱いにしない。

Subsystem failureはaffected capabilityへ局所化し、Artwork edit / saveが継続可能なら継続させる。

#### 7.10.4 Graphics context / device reset

Rendering backendのcontext / device resetが起きてもCanonical Document stateを失わない。

復旧可能ならCanvasを再構成する。復旧不能なら保存可能なCurrent Logical Stateを保護し、明確なRestart / Reopen routeを出す。silent artwork lossは禁止する。

Exact backend recoveryはSection 8。

#### 7.10.5 Soak stability

Section 10の長時間SoakでUnhandled fatal error、silent corruption、unbounded queue growth、unbounded cache growthを0件とする。

### 7.11 Storage Pressure / Quota Behavior

#### 7.11.1 Storage state

Project Storeは少なくとも論理的に:
- Healthy
- Low
- Critical / Cannot Safely Save

を区別できること。

Exact quota estimate / reserve formulaはSection 8で決定する。

#### 7.11.2 Low storage behavior

Low状態ではnonblocking warningとFix routeを提供し、Derived cache cleanup、unused Project Resource review、Save Project Copy先変更等を案内できる。

LowになっただけでCurrent Last GoodやNamed Checkpointを自動削除しない。

#### 7.11.3 Critical storage behavior

次Durable generation / Recovery-critical writeを安全に完了できないと判断した場合はSave Issueを明示する。

優先順位:
1. Last Goodを守る
2. Recovery-critical dataを可能な限り守る
3. Derived cacheを破棄
4. New optional background outputを抑制

partial writeをLast Goodへ昇格しない。

#### 7.11.4 No silent project shrink

Storage pressure解消のためにLayer flatten、History anchor破棄、embedded Resource削除、Canvas downsample等のCanonical lossをsilent実行しない。

### 7.12 Import / Untrusted Input Resource-Safety Target

#### 7.12.1 Bounded failure

Malformed / adversarial `.illustro`、PSD、SVG、Asset Pack、Brush / Resource等を開いても、無制限memory allocation、unbounded recursion、path traversal、arbitrary code execution、automatic remote fetchへ進まない。

#### 7.12.2 Pre-allocation validation

File header / manifest / declared dimensions / entry count / nesting / expansion estimate等、allocation前に確認可能な情報は大規模decode前に検証する。

Exact parser constants、decompression budget、entry count limit、nesting depth、maximum single allocationはSection 8で固定する。

#### 7.12.3 User-visible limits

Format / device / memory safety上のlimitに達した場合、値をsilent clampして別Artworkとして開かない。

`Too large for safe import`、`Unsupported dimension`、`Resource limit exceeded`等のreasonを示し、可能なら:
- Import reduced copy
- Rasterize selected scope
- Extract supported assets
- Open on more capable environment
- Cancel

等の明示routeを提供する。

#### 7.12.4 No low creative cap as optimization

性能実装を簡単にするためだけに、一般的な高解像度一枚絵制作を妨げる低い固定Canvas / Layer capを導入しない。

正式Hard LimitはSecurity / addressability / platform成立性から説明可能でなければならない。

### 7.13 Compatibility / Color Correctness Quality Target

#### 7.13.1 Compatibility classification accuracy

PSD / SVG / Brush等のCompatibility ReportでExact / Equivalent / Approximate / Rasterized / Omittedと判定した結果は、実際のImport / Export resultと一致すること。

`Exact`と表示した項目にknown semantic lossがある状態を許容しない。

#### 7.13.2 Native lossless image round-trip

Color profile変換を要求しないPNG / lossless TIFF等のsupported lossless raster routeでは、defined channel / alpha precision内でround-trip exactnessを維持する。

Format自体が保持しないmetadata / bit depth等はPreflightで区別する。

#### 7.13.3 Alpha invariance

Section 6どおりColor profile conversionでAlpha coverageを変更しない。

Lossless test fixtureではconversion前後のAlpha mismatchを0とする。

#### 7.13.4 ICC numerical quality

ICC v2 / v4 RGB profile transformは、Section 10で採用するreference color-management implementation / official profile test setと比較する。

通常in-gamut patchで:
- ΔE00 p95 ≤ 1.0
- ΔE00 max ≤ 2.0

をbaseline targetとする。

Profile自体のCLUT / rendering intent差によりreference実装間で定義差があるcaseはtest fixtureから別分類し、都合よくFailを除外しない。

#### 7.13.5 Transparent edge quality

Profile conversion / resize / export後、partially transparent edgeへblack / white fringeを新規生成しない。

Section 10ではtransparent colored edge fixtureをpixel / visual regressionで検証する。

### 7.14 Accessibility Baseline

#### 7.14.1 Standard baseline

IllustroのApp UIは、Web / hybrid UIとして適用可能な範囲で**WCAG 2.2 Level AA**をbaselineとする。

Canvas上の自由描画そのもの等、2D spatial interactionとして本質的にPointer位置を必要とする行為と、通常UI controlのAccessibility requirementを混同しない。

#### 7.14.2 Target size

Default Comfortable / Touch UIの主要Touch controlは**44 × 44 CSS px級以上のeffective hit target**を基本Targetとする。

Compact UIでも、WCAG 2.2 AA Target Size相当の**24 × 24 CSS pxまたは同等spacing / equivalent control**を下回る密集targetを通常設計にしない。

Canvas handle等はvisual sizeよりhit targetを大きくできるSection 5仕様を活用する。

#### 7.14.3 Text contrast

通常Text / image-of-textのcontrastは原則4.5:1以上。

Large textは3:1以上。

Disabled / decorative等の標準例外を除き、Theme変更でbaselineを破らない。

#### 7.14.4 Non-text contrast

重要なUI component boundary、icon、focus / selection state等は背景等との3:1級contrastをbaselineとする。

Colorだけに意味を依存せず、icon / shape / pattern / label等を必要に応じて併用する。

#### 7.14.5 Focus visibility

Keyboard focusは常に視認可能にする。

Focus indicatorは少なくとも2 CSS px perimeter相当の視認面積と3:1級contrastを目標とし、author-created sticky UI / overlayでfocus targetが完全に隠れないようにする。

#### 7.14.6 Keyboard reachability

Artworkの自由な筆跡そのものを除き、Menu、Tool selection、Properties、Layer management、History、Export、Settings等の非空間UI commandはKeyboard-onlyで到達・実行可能にする。

Pointer Dragだけが唯一のrouteとなるUI reorder / resize等には、Keyboard / command / numeric等の代替routeを提供する。

#### 7.14.7 Screen reader semantics

Interactive controlはName / Role / Value / Stateをprogrammatically取得可能にする。

Save / Export / Recovery / error等の重要statusはScreen Readerへ伝達可能にするが、Pointer sampleやBrush dabごとのlive announcementでspamしない。

Canvas artwork内容の自動意味認識をAccessibility baselineとして要求しない。

#### 7.14.8 Reduced Motion / Transparency

Reduced Motionではdecorative spring / fade / parallax等を抑制し、Direct manipulationによる実位置変化や必要feedbackは維持する。

Reduced Transparencyでは背景透過によって可読性が落ちるUIをopaque / higher-contrast表現へ切り替え可能にする。

#### 7.14.9 Reflow / scaling

UI Scale 150%設定に加え、OS / browser text scalingやzoomが増えても主要commandが消失しないResponsive layoutを目標とする。

WCAG 2.2 AAのText Resize / Reflow要件を適用可能なUI領域で満たす。Canvas自体は2D作業面としてscroll / pan / zoomを許容する。

#### 7.14.10 Timing / hold accessibility

Long Press / Hold等のTimingはSection 5どおり設定可能にし、motor accessibilityのため極端に短い固定timeoutだけへ依存しない。

Critical confirmationをgesture timingだけでしか実行できない設計は禁止する。

### 7.15 Multi-Input / Device Adaptation

#### 7.15.1 Concurrent input

Pen、Touch、Mouse、Keyboardが同時接続されても、1種類を使ったことを理由に他Input mechanismを不必要に無効化しない。

Pen drawing中のPalm rejection等、Tool semantic上必要なtemporary suppressionは明示的Input policyとして扱う。

#### 7.15.2 Input role stability

Device auto-detectionは初期suggestionに留め、User-defined Device Profile / mappingを勝手に上書きしないSection 5仕様を維持する。

#### 7.15.3 Display change

Refresh rate変更、window resize、orientation change、external display move等でArtwork coordinates / Canonical stateを変更しない。

Display change後もframe schedulerは新Refresh Rateへ追従する。

### 7.16 Offline / Network / Collaboration Quality

#### 7.16.1 Offline-first solo

Normal Project open / edit / save / history / export / asset use等のSolo制作はNetwork接続なしで成立する。

Network timeoutやDNS failureをLocal drawing Hot Pathへ持ち込まない。

#### 7.16.2 Collaboration local latency

Collaboration active時もLocal participantの自身のBrush / Transform等はNetwork round-trip完了をVisible update条件にしない。

Normal network fixtureで、Solo時と比較したLocal direct interaction p95 overheadを**1 display frame以内**に抑えることをTargetとする。

#### 7.16.3 Network outage isolation

Room通信断でCanvas入力をfreezeしない。

Connection stateを明示し、queued / unsynced shared changesがある場合はbounded backlogとして管理する。unbounded memory growthは禁止する。

Exact sync / reconnect algorithmはSection 8 / 9。

#### 7.16.4 Presence / cursor priority

Remote cursor、presence、participant thumbnail等はLocal artwork interactionより低priority。

Remote UI更新のためLocal frame pacing targetを破らない。

### 7.17 Privacy / Diagnostics / Observability

#### 7.17.1 Required local instrumentation

Section 10で品質を検証できるよう、development / diagnostic buildでは最低限次を測定可能にする。
- accepted input timestamp
- first matching present timestamp
- frame interval / missed presentation opportunity
- active queue depth
- current logical revision
- recovery-protected revision
- durability watermark
- autosave / Save Now duration
- History materialization latency
- Project open readiness milestones
- memory / cache pressure events
- graphics context / device reset
- import / integrity failure reason

Measurement instrumentation自体がrelease latencyを有意に変えないこと。

#### 7.17.2 No cloud telemetry dependency

Quality計測の成立をCloud account / mandatory analytics送信へ依存させない。

Local benchmark / diagnosticsだけでRelease Gateを実行可能にする。

#### 7.17.3 Privacy-safe diagnostics

診断dataを外部共有する機能を将来持つ場合も、Artwork pixels、absolute local path、Reference private path、Author metadata等をDefault添付しない。

### 7.18 Degradation / Failure UX Priority

#### 7.18.1 Degradation order

Resource不足 / heavy workload時は原則:
1. Direct input / current visible interaction
2. Current logical result
3. Recovery-critical work
4. Current visible dependencies
5. Durable autosave
6. Offscreen refresh
7. Thumbnail / Search / Timelapse encode / Export / cleanup

の順で守る。

Section 6のPersistence priorityと矛盾する場合は、Current artwork safetyを満たすためRecovery-critical laneをstarvation-freeで確保する。

#### 7.18.2 Same semantics under degradation

Performance pressure下でも、Selection、Transform、Effect、Color等の意味を別Algorithmの見た目だけ似たPreviewへ無断変更しない。

同じSemanticsを保つLOD / cache / viewport-first evaluationは許容する。

#### 7.18.3 Explain blocked operations

安全性 / memory / compatibility / missing resource等でoperationを実行できない場合、無反応やsilent no-opにしない。

Reason + recovery / alternate routeを示す。

### 7.19 Section 7 完了条件 / Invariants

本章の確定事項を次のInvariantsとする。

1. Interactive qualityは平均値だけでなくp50 / p95 / p99とstallで評価する。
2. Direct Interactionはdisplay-refresh normalizedで評価し、60Hz固定設計にしない。
3. Core direct manipulation targetはp50≤1 frame / p95≤2 frame / p99≤3 frame。
4. Pointer Down first mark p95≤2 frame。
5. Pen Up / Selection finalize p95≤2 frameをTargetとし、release後freezeを許容しない。
6. Direct manipulation中のApp-attributable >50ms main-thread blockはRelease blocker。
7. Periodic hitchingは平均FPSが高くてもFail。
8. Common Tool switch p95≤50ms、local Panel/Menu first feedback p95≤100ms。
9. Cold Launch Library interactive p95≤1.5s、Warm Resume p95≤500msをTarget。
10. Reference Medium Project edit-ready p95≤1.0s、Large p95≤2.5sをTarget。
11. Recent Undo / Redo warm stateはp95≤2 frame。
12. History / Stroke countだけでCurrent Hot Pathが線形劣化しない。
13. 10,000 transaction / long-session後もabsolute direct targetを維持し、warm baseline比p95劣化≤20%。
14. Canonical growthがないrepeat workloadでretained memoryを無制限増加させない。
15. Memory / thermal pressureではDerived workから落とし、Canonical / Recoveryを守る。
16. Idle / hidden状態で不要continuous renderを続けない。
17. completed semantic transactionのRecovery Protection p95≤1s / p99≤2s。
18. 正常時Committed-to-Recovery loss window p99≤2s。
19. Autosave target ageはcontinuous editing中30秒以内を維持する。
20. Medium workload Save Now p95≤2s、Large p95≤5sをTargetとしDrawingをBlockしない。
21. Save fault injectionでLast Good survival 100%。
22. Recovery-Protectedと判定済みRevisionのreconstruction success 100%。
23. Native `.illustro` canonical round-trip loss 0。
24. Derived subsystem failureをProject corruptionへ波及させない。
25. Graphics context / device resetでCanonical Artworkを失わない。
26. Storage pressureでLast Goodを先に破壊せず、Canonical dataをsilent shrinkしない。
27. Malformed importはbounded resourceでsafe failureし、arbitrary code / path traversal / automatic remote fetchへ進まない。
28. Hard creative limitを実装都合だけで低く設定しない。
29. Compatibility ReportのExact / Equivalent / Approximate / Rasterized / Omitted表示と実結果を一致させる。
30. Color conversionでAlpha mismatch 0。
31. ICC transform quality baselineは通常in-gamutでΔE00 p95≤1.0 / max≤2.0。
32. App UI Accessibility baselineは適用可能範囲でWCAG 2.2 Level AA。
33. Default Touch主要targetは44×44 CSS px級、Compactでも24×24 CSS pxまたは同等spacing / equivalent routeを下回らない。
34. Normal text contrast 4.5:1、重要non-text UI 3:1級をbaselineとする。
35. Color-only critical state禁止、Keyboard focus visible、non-spatial UIはKeyboard-only reachable。
36. Screen Reader向けName / Role / Value / Stateを提供する。
37. Reduced Motion / Reduced Transparencyを尊重する。
38. Pen / Touch / Mouse / KeyboardのConcurrent Inputを不必要に制限しない。
39. Solo制作はOffline completeでありNetwork round-tripをLocal drawingへ要求しない。
40. Collaboration active時もLocal direct interactionをnetwork ACK待ちにしない。
41. Development / diagnostic buildでInput-to-Present / frame / recovery lag / save / open等を測定可能にする。
42. Quality validationをMandatory cloud telemetryへ依存させない。
43. Resource不足時もCurrent semanticsをFake Previewへsilent変更しない。
44. Blocked operationはReason + Recovery routeを持つ。
45. Section 8 / 9のArchitecture / Algorithmは本章のTargetを満たすために選び、本章を実装都合で暗黙緩和しない。

Section 8では、これらTargetを満たすRealtime Pipeline、Scheduler、Memory / Cache、Project Store、Worker / GPU ownership、Recovery lane、platform storage mapping等を設計する。

Section 9ではBrush / Raster / Region / Effect / Color / history materialization / persistence delta等のAlgorithmを設計する。

Section 10ではReference Device / Project fixtures、measurement timestamp、percentile calculation、long-session、fault injection、corruption、Accessibility testを固定し、Release Gateへ落とし込む。

以上をもってSection 7「非機能要件・性能 / Reliability / Accessibility Target」を確定する。