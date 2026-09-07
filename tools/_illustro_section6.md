## 6. 保存・File format・Compatibility・Durabilityの詳細 — 確定

### 6.0 この章の位置づけ

本章は、Section 2 / 3 / 5で確定したユーザー可視Semanticsを、保存・復旧・互換・可搬性の契約へ落とし込む。

本章で決めるのは、何がNative Projectとして保持されるか、いつ`Saved`と呼べるか、クラッシュ後に何を復元できるか、外部Formatとの変換で何を保証するか、ResourceやColor Profileをどう持ち運ぶか、破損時にどこまで安全に退避できるかである。

Storage backend、Database / File System API、Chunk size、Compression codec、Write batching、Journal physical layout、Tile serialization、Checksum algorithm、Scheduler implementation等の物理実装はSection 8 / 9へ送る。

後続技術都合でSection 5の次を壊してはならない。
- Drawing中のAutosaveでForeground interactionを止めない。
- Logical Current StateとDurable Saved Stateを混同しない。
- Last Good Saveを新Save成功前に破壊しない。
- Recoveryを通常Historyへ混ぜない。
- PSDをNative ongoing formatとして扱わない。
- Exportは開始Snapshot固定でCurrent Saved stateを変更しない。
- Missing Resource / unsupported compatibility / corruptionでsilent fallbackしない。

### 6.1 Persistence State Model

#### 6.1.1 Logical / Durable / Recovery / Exported

Project persistenceは少なくとも次の4状態を分離する。

1. **Logical Current State**: 現在の正しい編集状態。Document Logical RevisionとCurrent Effective Stateに従う。
2. **Durable Saved State**: crash / process loss / normal reopenを越えてNative Projectとして安全に再構成できる最新状態。
3. **Recovery-Protected State**: Last Durable以降の変更をRecovery情報から安全に再構成できる状態。Native Durable Saveそのものとは別。
4. **Exported State**: PSD / PNG / JPEG / TIFF / SVG等へ書き出された固定Snapshot。Native Saved statusとは無関係。

`Saved`はCurrent Logical StateとDurable Saved Stateが一致している場合だけ表示する。Recoveryだけが最新でも`Saved`とは呼ばない。

#### 6.1.2 Durability Watermark

ProjectはCurrent Logical Revisionとは別に**Durability Watermark**を持つ。

例:
- Current Logical Revision = R150
- Durable Watermark = R147
- Recovery-Protected Through = R150

この場合Artworkの正しい現在状態はR150であり、R148-R150はFake Previewではない。Top Barは`Saving`相当で、異常終了してもRecoveryからR150を再構成できる。

Durability WatermarkがCurrent Revisionへ追いついた時点で`Saved`になる。

#### 6.1.3 Status semantics

Top Bar / Project Library statusは次を共通利用する。
- **Saved**: Current canonical project stateがDurable。
- **Saving**: newer canonical stateが存在し、durability workがpending / in-flight、既知failureなし。
- **Save Issue**: durability workが失敗、Storage不足、permission loss、integrity validation failure等でCurrentへ追いつけない。
- **Recovery Available**: abnormal termination等の後、Last Durableより新しいvalid Recovery candidateが存在。
- **Missing Resource / Compatibility Issue**: Project自体は開けても依存解決や変換判断が必要。

Thumbnail / Search index / derived cache failureだけで`Save Issue`にしない。

### 6.2 Native `.illustro` Format Contract

#### 6.2.1 Canonical role

`.illustro`をIllustro唯一のCanonical editable project formatとする。

`.illustro`はSection 2 / 3 / 5のCanonical semanticsを保持できなければならない。少なくとも次をNative保持対象とする。
- Document / Canvas metadata
- Raster / Vector / Text / Generator / Material / Reference構造
- Layer / Group / Mask / Clipping / Blend / Modifier / Effect
- Brush / Fill / Selection / Stable Region / Persistent Fillに必要なCanonical state
- Shared Definition / Linked Parameter / Object stable identity
- Color profile / document color metadata
- History Graph / Branch / Named Checkpoint
- Project Resource / asset definitions / dependency metadata
- Reference metadata / link metadata
- Export Recipe / Frame Variant / View Anchor等のProject-owned state
- Timelapse metadata / retained stream
- Project identity / origin relation / compatibility metadata

PSD / SVG等に表現できないIllustro-only semanticsが存在しても、`.illustro`では失われない。

#### 6.2.2 Logical package segments

物理filename / encodingを固定せず、Native Projectは論理的に次のsegmentを持つ。

1. **Manifest**: Format version、Capability declaration、Project identity、active durable generation、integrity metadata。
2. **Document Model**: Canvas、Layer/Object graph、Stable IDs、Parameters、dependencies。
3. **Artwork Payload**: Raster content、Vector geometry、Text content、Mask/Coverage、Generator inputs等のCanonical payload。
4. **History Package**: Current branch、retained branches、transactions、Checkpoint anchors。
5. **Resources**: Project-captured Brush/Material/Texture/Pattern/Image/Reference等。
6. **Color Package**: ICC profile、working-space metadata、proof configurationのProject-owned部分。
7. **Project Metadata**: title、created/modified、origin relation、user-explicit metadata。
8. **Timelapse Package**: retained Timelapse stream / metadata。
9. **Derived Preview Data**: thumbnail、preview、search/index helper等。Canonicalではない。

Exact byte container、entry naming、compression、incremental chunkingはSection 8で決定する。

#### 6.2.3 Canonical vs Derived

Thumbnail、Navigator preview、search index、render cache、GPU cache、effect cache等はDerived Dataであり、消失してもCanonical Projectを再構成できること。

`Saved`判定はDerived cache completionを待たない。

一方、Current artwork、required dependency、Named Checkpoint、Section 6で保証するpersistent History等はCanonical Durability Setに含める。

#### 6.2.4 No executable project payload

`.illustro`はProjectを開くためにJavaScript、shell、native executable等の任意コード実行を要求しない。

Auto ActionもSection 5どおりSemantic Command dataであり、Project fileを開くだけで任意コードが実行される形式にしない。

### 6.3 Format Versioning / Migration / Forward Compatibility

#### 6.3.1 Version fields

Native Manifestは少なくとも次を持つ。
- Format Major
- Format Minor
- Writer App Version
- Required Capabilities
- Optional / Preserve-safe Capabilities

Feature判定をapp version文字列だけに依存させない。

#### 6.3.2 Older project open

現行Illustroが旧`.illustro`を開く場合、MigrationはProject open直後に元dataを破壊しない。

Migration結果はCurrent Logical Stateとして構築し、最初のsuccessful durable saveで新generationへ確定する。旧Last Good Generationは新save成功前に保持する。

#### 6.3.3 Newer project open

Readerが知らない**Required Capability**を含む場合、editable openを無理に行わない。

可能なroute:
- Open Read-only with preserved appearance / available structure
- Extract / Export available preview or supported assets
- Open with newer Illustro
- Cancel

Unknown Required dataを捨てて`正常に開けた`扱いにしない。

Unknown Optional capabilityが明示的にpreserve-safeで、Current readerがopaque保持できる場合だけ、未関係部分の編集を許可できる。対象操作がUnknown payloadを無効化する可能性がある場合はeditable operation前に警告 / conversion routeを出す。

#### 6.3.4 No silent downsave

古いformat versionへ落とす操作は通常`Save`にしない。

明示的Compatibility Copy / ExportとしてPreflightし、失われるCapabilityを列挙する。Native current projectは新formatのまま保持する。

### 6.4 Durable Save / Atomic Save Contract

#### 6.4.1 Save Snapshot

Durable saveは開始時点のCanonical Revision / Project metadata stateを**Save Snapshot**として固定できる。

Drawingはその後も継続してよい。Save Snapshotより新しいeditが発生した場合、save完了でそのSnapshotまではDurableになるが、Currentがさらに先ならTop Barは`Saving`を継続する。

#### 6.4.2 Last Good Generation

新しいdurable generation `N+1`を作る間、現在validな`N`を破壊しない。

`N+1`が完全に書かれ、required canonical dataとintegrity条件を満たし、active durable generationとして確定した後に初めて`N+1`をLast Goodとする。

途中failure、process crash、power loss、Storage full、permission failureが起きた場合、`N`が引き続き開けることを必須とする。

#### 6.4.3 Previous Good retention

Local Project StoreではLast Goodに加え、**1つ前のsuccessful durable generation**をPrevious Goodとして原則保持する。

さらに古いgenerationは、Named Checkpoint / Branch / Recovery / user backup等から参照されない場合にGC対象となる。

Storage pressureでPrevious Goodを破棄する場合も、Current Last Goodを先に危険へさらさない。

#### 6.4.4 Saved commit point

`Saved`へ遷移するcommit pointは、新generationが完全かつ再読込可能であることを確認した後とする。

OSへのwrite callが成功した、queueが空になった、manifestだけ書けた、という理由だけで`Saved`にしない。

Exact atomic replace / fsync / transaction protocolはSection 8。

#### 6.4.5 Save Now

`Save Now`は押した時点のCurrent Revisionを最低限durableにするBarrierであり、Checkpoint作成ではない。

Foreground drawingは継続可能。Save Now中にnew editsが発生しても操作をBlockしない。

### 6.5 Autosave / Close Safety

#### 6.5.1 Default policy

AutosaveはDefault ON。

Current Logical Stateが進んだらdirty stateを即認識し、Foreground interactionを止めずにDurabilityへ追従する。

Default policy:
- continuous editing中でもDurable autosave targetを**30秒以上放置しない**。
- foreground interactionが約**2秒idle**になった場合はcatch-up durable saveを優先要求する。
- App background / visibility loss / OS suspend前signalではRecovery-critical flushを最優先し、可能ならDurable catch-upも要求する。

これらはuser-facing durability cadenceであり、exact batching / scheduling / deadline実装はSection 8、達成率targetはSection 7。

#### 6.5.2 Autosave vs Recovery Protection

Autosave ProjectとRecovery Protectionは別概念とする。

AutosaveをUserがOFFにしても、Recovery ProtectionはDefault ONのままにできる。Recoveryも明示OFFにする場合はData-loss riskを説明する。

#### 6.5.3 Save Issue

Save failureでCurrent Logical Stateをrollbackしない。

Actions:
- Retry
- Save Project Copy
- Free Space / Fix Permission / Reconnect Storage等のissue-specific Fix
- Details

Last Good Generationは維持する。

#### 6.5.4 Close safety

最新変更がDurableでもRecovery-Protectedでもない場合だけ、close時にData-loss blockingを出す。

Options:
- Retry Save
- Save Project Copy
- Keep Editing
- Discard Latest Changes

DiscardはDefaultにしない。

最新変更がRecovery-Protectedなら、通常closeで不要なmodalを出さない。ただしCurrentがNative Durableまで追いついていなければ`Saved`表示にはしない。

### 6.6 Crash Recovery

#### 6.6.1 Separate Recovery Store

Recovery dataはNormal History / Normal `.illustro` Last Good Generationと分離する。

RecoveryはLast Durable Revisionをbaseとして、そこからCurrent Logical Stateを再構成するために必要なRecovery-critical changesを保持する。

Exact journal / delta / chunk layoutはSection 8。

#### 6.6.2 Recovery-safe definition

Revision `R`をRecovery-Protectedと呼ぶには、Last Durableから`R`までを再構成するために必要なRecovery dataがlocal durable storageへ書かれ、minimum integrity validationを通過していること。

Memory queueに存在するだけではRecovery-Protectedと呼ばない。

#### 6.6.3 Abnormal termination

異常終了後にvalid Recovery candidateがLast Durableより新しければ、Library card / open時に`Recovery Available`を表示する。

Default routeはRecovered candidateを保護したまま開き、`Recovered` badgeを表示する。必要ならLast SavedとA/B / Split Compareできる。

Recoveredを開いた時点ではLast Good Generationを即上書きしない。Userが作業を続け、successful durable saveが完了した時点でRecovered stateが新Last Goodになる。

#### 6.6.4 Multiple / damaged candidates

複数Recovery candidateがある場合は、Revision / timestamp / integrity / base relationからvalidな候補を整理し、最新valid候補をPrimaryにする。ambiguousな場合は候補選択を出す。

Damaged Recoveryを理由にvalid Last Goodへsilent rollbackして`復元済み`と表示しない。Last Saved、Recovered candidate、damaged statusを区別する。

#### 6.6.5 Recovery lifecycle

Recovery dataは、それを包含するnew durable generationが成功し、abnormal-recovery用途がなくなった後にcleanup対象となる。

Recovery cleanup failureはArtwork Save failureとは分離し、後で再試行できる。

### 6.7 History / Branch / Checkpoint Persistence

#### 6.7.1 Persistence guarantee

Project reopen後もHistoryを完全にゼロへ戻す設計にしない。

Default Persistent History guarantee:
- **Current Branch**: 最新**1000 Semantic Transactions**を保持。
- **各retained non-current Branch**: Branch Headのexact state + 最新**200 Semantic Transactions**を保持。
- **Named Checkpoint**: Checkpointが存在する限り、そのexact target stateを保持。
- **Branch metadata**: Stable ID、origin、name、head、last edit、Checkpoint relationを保持。

Transaction countはSection 5のSemantic Transaction粒度で数え、pointer samplesやslider samplesを数えない。

#### 6.7.2 Retention boundary

保証範囲より古いunanchored HistoryはGC可能だが、UI上でreopen後に存在しない可能性を明確にする。

History Pageは必要なら`Persistent History Boundary`を表示し、存在しない古いstateへJumpできるように見せない。

#### 6.7.3 Checkpoint anchor

Named CheckpointはHistory retention anchorであり、通常transaction count pruningから除外する。

Checkpoint deleteはanchor解除であり、referenced physical dataの即時削除を意味しない。GCはBackgroundで行う。

Save != Checkpoint。AutosaveもCheckpointを自動大量生成しない。

#### 6.7.4 Branch head preservation

Retained Branchは少なくともHead stateをexactに再構成できなければならない。

古いintermediate transactionsがprunedされても、Branch switch / CompareでHead appearanceを失わない。

#### 6.7.5 Storage pressure

Current artwork durabilityをHistory retentionより優先する。

ただし保証済みHistoryをStorage pressureでsilent削除しない。保持不能になる場合は`History retention limited`をProject Health / File-Recovery settingsで示し、Reduce History / Delete unused Branch / Delete Checkpoint / Save Project Copy等のFix routeを出す。

#### 6.7.6 Timelapse separation

Timelapse retentionはHistory retentionと別。History pruneでTimelapseを自動削除せず、Timelapse clearでHistoryを削除しない。

### 6.8 Resource Embedding / Linking

#### 6.8.1 Resource modes

External / library-origin resourceは次の意味を区別する。
- **Embedded / Project-captured**: Project単独で必要dataを持つ。
- **Linked**: External source identityを維持し、Project外sourceへ依存する。
- **Generated / Internal**: Project内parameterから再構成される。

名前が同じという理由だけでResource identityを再bindingしない。

#### 6.8.2 Default capture policy

User LibraryのBrush / Material / Texture / Pattern / Gradient / Stamp等をProjectで使用した時点で、Section 5どおり必要Definition / dependencyをProject Resourceとしてsnapshot captureする。

後でUser Library側を編集 / 削除しても既存Projectがsilent変化しない。

通常のimage import / Register as Materialは**Embedded SnapshotをDefault**とし、Linked behaviorは明示選択にする。

#### 6.8.3 Linked resource identity

Linked Resourceは少なくとも次を保持する。
- Stable Resource ID
- expected type
- last resolved fingerprint / content identity
- display name
- locator information
- last known metadata
- optional last-resolved preview / fallback data

External path文字列だけをidentityにしない。

External fileが変化してもProject resultをsilentに書き換えない。Defaultは`Refresh Available`を示し、RefreshをSemantic Revisionとして適用する。UserがAuto Refreshを明示ONにした場合もrefresh結果はLogical Revision / dependency changeとして追跡する。

#### 6.8.4 Missing linked resource

Missing Linkで別の同名fileへsilent substitutionしない。

Actions:
- Locate / Relink
- Use Embedded Fallback where available
- Embed Current Resolved Copy
- Remove Reference / Dependency if safe

Fallbackを表示に利用する場合も、Linked SourceがMissingであるstatusを隠さない。

#### 6.8.5 Fonts

TextはFont identity / style / variation axis等の必要metadataを保持する。

Font file embeddingはlicense / OS restrictionに従う。Embedding不可の場合、ProjectはFont referenceを保持し、Missing Font時にReplace / Locate / Import permitted font / appearance fallback routeを提示する。

Fontを勝手に別Fontへ置換して`正常`扱いにしない。

### 6.9 Project Portability / Portable Project Copy

#### 6.9.1 Portable Project Copy

`Portable Project Copy`はNative `.illustro` copyを作り、eligible Linked ResourcesをProject内へembedして外部依存を減らす。

元ProjectのLink semanticsは変更しない。

Portable copyは独立Project IDを持ち、Origin Project ID / Origin Revision / Created timeをprovenanceとして持てる。Import時に元Projectへ勝手にmerge / overwriteしない。

#### 6.9.2 Portability modes

Preflightで次を区別する。
- **Fully Portable**: Canonical projectを再現するのに外部file dependency不要。
- **Portable with Exceptions**: Font license等で外部dependencyが残る。
- **Keep Links**: Link semanticsを意図的に保持。

`Fully Portable`を名乗る場合、unresolved required linkを残さない。

#### 6.9.3 Sensitive locator stripping

Fully Portable copyではembedded済みresourceのabsolute local path、private directory structure、hidden reference path等をDefaultで削除する。

必要なprovenanceはdisplay name / hash / source type等のprivacy-safe metadataへ縮退できる。

#### 6.9.4 Font / restricted resource Preflight

Embedding不可Resourceがある場合、Preflightはaffected objectとreasonを示す。

Possible routes:
- Keep External Reference
- Replace Resource
- Convert to Outline Copy where semantically valid
- Rasterize Appearance Copy
- Cancel

No silent illegal embedding / silent text appearance loss。

### 6.10 Common Import / Export Compatibility Contract

#### 6.10.1 Compatibility classes

Import / Export reportはfeature mappingを次で分類する。
- **Exact Editable**: 意味・appearance・主要parametersを保持。
- **Equivalent Editable**: 内部表現は異なるがobservable semanticsが実質同一。
- **Approximate Editable**: editableだがappearance / parameter semantics差がある。
- **Rasterized Appearance**: appearanceを優先し編集構造を画像化。
- **Omitted**: targetへ含めない。
- **Missing Dependency**: font / linked file / profile等が不足。
- **Blocked for Safety / Invalid Data**: security / corruptionで読み込まない。

同名featureだからExactと判定しない。

#### 6.10.2 Minimum-loss fallback

Unsupported featureをRasterizeする場合、Document全体Flattenを安易なDefaultにしない。

Appearanceを保てる最小subtree / object / effect scopeでRasterized fallbackし、その周囲のeditable structureを維持する。

Rasterized resultには可能な範囲で`Rasterized from unsupported <source feature>` provenanceを残す。

#### 6.10.3 Clean path

loss / ambiguityがないImportでは巨大なCompatibility modalを出さない。

問題がある場合だけsummaryを出し、Detailsでentity単位mappingを確認可能にする。

#### 6.10.4 Frozen export snapshot

すべての外部Exportは開始時Document Snapshotを固定する。

Background drawingは継続可能で、途中editを一部targetだけへ混ぜない。Export成功 / failureはNative Saved stateを変更しない。

### 6.11 PSD Compatibility — Exchange Format

#### 6.11.1 Positioning

PSDはAdobe Photoshopとの**editable exchange format**であり、Illustro Native formatではない。

Open PSD -> Import -> Illustro Project。以後の通常Save targetは`.illustro`。

PSDへ戻す場合は明示`Export PSD`を使う。

Section 2でPSBは非採用のため、PSDのformat limitを超える場合にPSBへsilent切替しない。

#### 6.11.2 PSD import default

Defaultは**Preserve Appearance**。

Supported basic structuresは可能な限りEditable mappingする。
- Raster Layer / Group
- Visibility / Opacity
- supported Blend Mode
- Layer Mask / compatible clipping relation
- Basic Text when font / layout semantics can be preserved
- Basic Vector Path / Shape when geometry / fill / stroke semantics match
- supported Effect / Adjustment only whenparameter meaning and compositing are compatible

Exact mappingできないLayer Style / Smart Object / Adjustment / advanced Text / Vector / blend behavior等はCompatibility classを付ける。

#### 6.11.3 Preserve Editability option

`Preserve Editability` routeでは、Approximate Editable mappingを許容し、appearance differenceをBefore / Afterまたはissue listで示す。

Default Preserve Appearanceではunsupported appearanceを最小scope Rasterizeし、Document全体Flattenを避ける。

#### 6.11.4 Smart Object / unsupported embedded structures

PSD Smart Object等をIllustroの別機能へ名前だけで偽装mappingしない。

可能なroute:
- Keep editable substructure where exact mapping exists
- Rasterize Appearance
- Preserve original source payload as optional provenance resource
- Skip / Cancel

#### 6.11.5 CMYK / Lab PSD

IllustroのCanonical creation modeはSection 2どおりRGB Color / Grayscale / 1bitを基本とし、CMYKはProofで扱う。

CMYK / Lab PSDをImportする場合、embedded ICC / source profileを使ってIllustro supported working representationへ変換し、`Converted from CMYK/Lab`をCompatibility summaryへ出す。Profile不明の場合はsilent sRGB扱いせず、Assign / Choose assumption routeを出す。

#### 6.11.6 PSD export baseline

PSD Exportは可能な範囲で次を保持する。
- Layer / Group hierarchy
- Raster content
- Visibility / Opacity
- supported Blend / Mask / clipping
- compatible Text
- compatible Vector Path / Shape
- exact-compatible Effect / Adjustment mapping

Illustro-only Stable Region、History、Branch、Checkpoint、Generator semantics、Shared Definitions等はPSD Native semanticsではない。必要なappearanceはraster fallback、metadataはInfoとしてPreflightに示す。

PSD composite imageはexported layer resultと整合するappearanceを持たせ、他readerがcompositeを使う場合にも破綻しにくくする。

#### 6.11.7 PSD hard limits

PSD targetがformat limitを超える場合はBlocking Preflight。

Current compatibility baselineでは少なくとも次を検査する。
- width / heightがPSD互換上限を超える
- estimated encoded file sizeが2GB級上限を超える
- target feature / bit depthがwriter対応外

PSBへのsilent fallbackは禁止。Native `.illustro`継続、compatible TIFF / raster export等の代替routeを提示する。

### 6.12 SVG Compatibility — Static Vector Exchange

#### 6.12.1 Positioning

SVGはstatic vector / mixed vector-raster exchange formatとして扱う。

IllustroはSVGを任意Web applicationとして実行せず、Artwork import dataとして扱う。

#### 6.12.2 Exact editable core

Section 5で確定したcore editable baseline:
- path
- compound path
- fill
- stroke
- transform
- basic shapes

これらはmeaningが一致する範囲でEditable Vectorへmappingする。

#### 6.12.3 Conditional features

Gradient、clip / mask、text、embedded raster、filter等は個別mapping可能でも、Exact互換を前提にしない。

Unsupported appearanceは次から選ぶ。
- Rasterize Unsupported Appearance
- Convert to Path where semantics allow
- Skip
- Cancel

Convert to Path != Rasterize。TextをPath化した場合はText editability lossを明示する。

#### 6.12.4 Unsupported dynamic content

Animation、script、event handler、interactive foreign contentはIllustro Artworkとして実行しない。

Static appearanceへ安全に解決できない場合はUnsupported / Blockedとしてreportする。

Remote external resourceはImportだけを理由に自動network fetchしない。Userが明示Locate / Allowしたresourceだけ解決する。

#### 6.12.5 SVG export modes

SVG Exportは次の2modeを持つ。
- **Preserve Appearance**: vectorを保持しつつ、必要なunsupported / raster contentをembedded raster fallbackとして含めることを許可。
- **Vector Only**: raster fallbackを禁止し、表現不能箇所をBlocking Preflightにする。

DefaultはPreserve Appearance。

Web互換性を優先し、SVG export default color spaceはsRGB。Document Profileを勝手に変更せず、Export conversionとして処理する。

### 6.13 PNG / JPEG / TIFF Compatibility

#### 6.13.1 Common raster import

PNG / JPEG / TIFF importはflattened raster sourceとして扱う。Layered editable interchangeを期待させない。

Import時に可能な範囲で次を読む。
- pixel dimensions
- alpha / transparency
- bit depth
- embedded ICC profile
- resolution / DPI metadata
- orientation metadata
- selected standard metadata

Document / Layerへの配置後はIllustro Project-local Canonical contentになる。

#### 6.13.2 Orientation

EXIF等のorientationがある場合、Canvas上では意図されたvisual orientationで表示する。

Import後のCanonical pixel/object orientationは一度だけ正規化し、Exportで同じorientation transformを二重適用しない。Original orientation metadataはprovenanceとして保持可能。

#### 6.13.3 Untagged RGB

ICC profileを持たないRGB PNG / JPEG / ordinary raster Referenceは**sRGB assumptionをDefault**とする。

ただし`Assumed sRGB`をColor/Profile detailで確認可能にし、Assign Profile / Convert Profile routeを持つ。

Profileがないことを`profile確認済み`扱いにしない。

#### 6.13.4 PNG

PNGはGeneral / Web lossless raster route。

Alphaを持つsourceはAlpha保持をDefault。Color profile / selected metadataを対応範囲でembed可能。

PNGへexportしてもLayer / Vector / History等のNative editabilityは保持されない。

#### 6.13.5 JPEG

JPEGはopaque lossy raster route。

Alpha sourceではBackground Colorを明示させ、silent white compositingをしない。Quality defaultはSection 5どおり90 baseline。

#### 6.13.6 TIFF

TIFFはhigh-quality / print-oriented raster route。

ICC / alpha / supported high bit depthを可能な範囲で保持するが、Photoshop-specific layered TIFF等をIllustro editable exchange baselineにはしない。

Multi-page TIFF等を受け取った場合、Illustroは一枚絵scopeを維持し、importするpage / imageを明示選択する。全pageをsilent結合しない。

### 6.14 ICC / Color Profile / Metadata

#### 6.14.1 ICC support baseline

ICC profile compatibility baselineは**ICC v2 input compatibility + ICC v4 primary support**とする。

Current ICC v4系profileをNative Document / import / export / proofで扱えることを基本とし、legacy v2も読み込めるようにする。

iccMAX等、現行baselineを超えるprofileを受け取った場合はraw metadataを可能なら保持しつつ、Current color engineで正しく処理できない場合にUnsupported Profileとして明示する。silent sRGB conversionしない。

#### 6.14.2 Native profile persistence

Custom Document ICC ProfileはProject portabilityを失わないようNative Projectへ必要profile dataを保持する。

Well-known built-in profileはStable profile identityを利用できるが、Custom / imported profileはnameだけで再解決しない。

#### 6.14.3 Assign vs Convert

Section 5どおり:
- **Assign Profile**: numeric values維持、interpretation変更。
- **Convert Profile**: appearance維持方向でnumeric values変換。

同一commandへ統合しない。

#### 6.14.4 Rendering Intent default

General profile conversionのDefaultは**Relative Colorimetric + Black Point Compensation ON where supported**とする。

Perceptual / Absolute Colorimetric / Saturationを選択可能。Absoluteは主にproof / special reproduction用途。

BPC非対応の変換でON表示だけ残さず、Unavailable reasonを示す。

#### 6.14.5 Alpha and transparent-edge rule

Color profile conversionはAlpha coverageを変更しない。

Transparent / partially transparent pixelのcolor informationを不用意にzero / white / blackへ置換し、edge haloを作らない。Straight / premultiplied等のexact representationと変換mathはSection 8 / 9。

#### 6.14.6 Metadata model

Native Project metadataとExport metadataを分ける。

Native may hold:
- Project Title
- explicit Author
- Copyright
- Created / Modified
- Color Profile
- Origin Project / Revision
- user-defined safe project metadata
- internal link/provenance metadata

Raster / exchange exportではEXIF / XMP / IPTC等のsupported standard fieldへmappingできるが、Section 5どおりprivacy-safe defaultとする。

Default export exclusions:
- absolute local file paths
- hidden Reference paths
- device identifiers
- application-private storage locator
- inherited GPS / precise location metadata
- unrelated source-file metadata not explicitly selected

Author / Copyright / Project Title等もMetadata export toggleで明示選択する。

#### 6.14.7 Source metadata provenance

Imported source metadataはProject内部でprovenanceとして保持できるが、次のExportへ自動連鎖させない。

`Preserve Source Metadata`を選んだ場合もPrivacy Preflightを通し、GPS / local path等は個別確認できるようにする。

### 6.15 Corruption Safety / Salvage / External Conflict

#### 6.15.1 Integrity validation

Native Project open時はManifest / critical graph / required canonical referencesのintegrityを先に確認する。

大容量Resourceはlazy validation可能だが、破損を検出したentityをvalid扱いでrender / saveし直さない。

Exact checksum / hash / validation implementationはSection 8。

#### 6.15.2 Partial corruption

一部Resource / History / previewが破損しても、validなCurrent Artworkを救出できる場合はProject全体を即廃棄しない。

Open modes:
- Open Normal if all required canonical data valid
- Open with Issues if noncritical / isolated damage
- Open Read-only Salvage Copy
- Recover Previous Good
- Cancel

Salvageで元file / Last Goodをin-place修復しない。Repair結果はnew copy / new valid generationとして確定する。

#### 6.15.3 Previous Good recovery

Current Last GoodがcorruptでPrevious Goodがvalidな場合、Previous GoodをRecovery candidateとして提示する。

勝手にolder stateへ戻して`Saved`と表示しない。Current damaged generation / Previous Good / Recovery candidateの時間差を明示する。

#### 6.15.4 Storage full / permission loss

Storage fullやwrite permission消失ではCurrent Logical Stateを維持し、Last Goodを保持する。

Save Issueは具体reasonとFix routeを表示する。partial new generationをLast Goodへ昇格しない。

#### 6.15.5 External modification conflict

同じexternal `.illustro` package / linked fileが別process等で変更されたことを検出した場合、silent overwriteしない。

Possible routes:
- Open External Version
- Keep Current and Save Project Copy
- Compare where semantics allow
- Replace external target explicitly
- Cancel

Single Writable Session policyと整合し、stale lockを永久lockにしない。

### 6.16 Untrusted File Safety

#### 6.16.1 Native package safety

`.illustro` / imported packageはpath traversal、unexpected external path write、arbitrary code executionを許さない。

Package内entryがProject root外へ展開されることを許容しない。Exact parser limits / decompression limitsはSection 7 / 8。

#### 6.16.2 SVG / external resource safety

SVG script / event / executable foreign contentを実行しない。

External network URL / local pathを含むSVGを開いただけで自動送信 / 自動fetchしない。

#### 6.16.3 Resource exhaustion

極端なdimension、entry count、nested structure、compressed expansion、path count等でapplicationを不安定化させる入力はsafe failureできるようにする。

Exact maximum / staged decode / sandboxingはSection 7 / 8で決定する。

### 6.17 Section 6 完了条件 / Invariants

本章の確定事項を次のInvariantsとする。

1. `.illustro`が唯一のCanonical editable project format。
2. Logical Current / Durable Saved / Recovery-Protected / Exportedを分離する。
3. `Saved`はCurrent canonical stateがdurableな場合だけ。
4. Recoveryだけが最新でも`Saved`と偽表示しない。
5. New durable generation成功前にLast Goodを破壊しない。
6. Local storeは原則Previous Goodを1世代保持する。
7. Drawing / direct manipulationをAutosave completion待ちにしない。
8. RecoveryはNormal Historyへ混ぜない。
9. Save != Checkpoint、Export != Save、Save Project Copy != Duplicateを維持する。
10. Current Branch 1000 / retained Branch 200 Transactionのpersistent History baselineを保証する。
11. Named Checkpoint / retained Branch Headはreopen後もexact target stateを保持する。
12. Project Resource CaptureによりLibrary asset変更が既存Projectへsilent伝播しない。
13. Embeddedを通常importのDefault、Linked behaviorを明示選択とする。
14. Missing Linkを同名fileへsilent substitutionしない。
15. Portable Project Copyはexternal dependencyとsensitive pathをPreflightする。
16. PSDはexchange formatでありNative ongoing formatにしない。
17. PSB非採用を維持し、PSD limit超過をsilent fallbackしない。
18. SVG core editable baselineはpath / compound / fill / stroke / transform / basic shapes。
19. SVG script / remote resourceを自動実行 / fetchしない。
20. PNG / JPEG / TIFFはraster interchangeでありNative editabilityを装わない。
21. Untagged RGBはsRGB assumptionをDefaultとし、assumption statusを確認可能にする。
22. ICC v4 primary + v2 compatibilityをbaselineとする。
23. General profile conversion defaultはRelative Colorimetric + BPC ON where supported。
24. Color conversionでAlphaを変更せず、transparent-edge colorを不用意に破壊しない。
25. Export metadataはprivacy-safe opt-in。GPS / local path / device ID等をdefault継承しない。
26. Compatibility mappingはExact / Equivalent / Approximate / Rasterized / Omitted等を区別する。
27. Unsupported appearanceのRasterizeは最小scopeを優先し、whole-document flattenを安易なDefaultにしない。
28. Corruption repairは元Last Goodをin-place破壊せず、Salvage Copy / new generationで行う。
29. External modification / writable-session conflictをsilent overwriteしない。
30. Project / SVG importを任意code実行routeにしない。
31. Derived thumbnail / cache failureをArtwork Save failureと混同しない。
32. Section 8 / 9の物理実装は、本章のDurability / Compatibility contractを弱めてはならない。

Section 7ではReliability / recovery loss window / storage pressure / import limit等の非機能targetを定める。Section 8ではProject Store、physical `.illustro` package、atomic transaction、journal、resource/chunk persistence、platform storage mappingを決める。Section 9ではserialization-adjacent algorithm、delta / compaction / integrity / color transform等の具体方式を決める。

以上をもってSection 6「保存・File format・Compatibility・Durabilityの詳細」を確定する。
