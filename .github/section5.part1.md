## 5. 各機能の詳細仕様 — 確定

### 5.0 この章の位置づけと共通規約

本章はSection 2で採用した全機能について、ユーザーから見える挙動、主要Parameter、状態遷移、Default、相互作用、導線、Commit / Cancel、Error / Empty / Disabled stateを確定する。内部Data Layout、GPU API、Tile Size、Scheduler、Cache Policy、具体AlgorithmはSection 8 / 9へ送る。

#### 5.0.1 Direct / Quick / Detailの3段階

全Tool / Object / Effectは可能な限り次の3段階へ整理する。

- **Direct**: Canvas上の直接操作。Stroke、Handle、Node、Guide等。
- **Quick**: Properties、Context Bar、PiP、Quick Hole等の高頻度Parameter / Command。
- **Detail**: 詳細設定、Studio、Advanced Settings、Effect Detail等。

同じParameterが複数Surfaceに現れる場合もCanonical Parameter Stateを共有し、Surfaceごとに別値を持たない。

#### 5.0.2 Interaction Lifecycle

Canvas直接操作、Slider drag、Numeric scrub等の連続編集は原則Section 3.10のLifecycleへ載せる。

`Begin → Interactive Update → Atomic Logical Commit / Interaction Cancel`

表示中のInteractive ResultはFake PreviewではなくCurrent Effective Stateの一部であり、低品質版へ切り替えて遅延を隠すことをDefault解決にしない。

#### 5.0.3 Parameter Control共通仕様

- SliderはDrag中連続更新、pointer upでInteractionを閉じる。
- 数値Fieldは直接入力、Arrow key increment、scrub、Relative Input `+N / -N / ×N / ÷N` を共通対応する。
- 単位がある値はUnit-awareとし、px / % / deg等を明示する。
- Reset可能Parameterは個別ResetとGroup Resetを持つ。
- Defaultから変更された値は必要に応じて視覚識別できる。
- Fine AdjustmentはmodifierまたはPointer perpendicular controlで利用可能にする。
- Parameter rangeを超える入力は安全な有効範囲へClampし、勝手な別単位解釈をしない。

#### 5.0.4 Destructive / Non-destructive

非破壊表現がSection 2で採用されている処理は、可能な場合**非破壊適用をPrimary Route**とする。破壊適用 / Bake / Rasterizeは明示Commandとし、性能都合だけで暗黙Bakeしない。

破壊操作でもUndoで完全復元可能な通常操作には毎回Confirmationを出さない。Undoで戻せない、外部Dataを失う、History範囲を越えて不可逆になる操作だけ強い確認を要求する。

#### 5.0.5 Tool Family / Subtool

Tool Rail Familyは1 Tapで直近Subtoolを再選択し、Active Family再Tap、Long Press、Mouse secondary affordance等でSubtool Flyoutを開く。Long Pressだけを唯一の入口にしない。

Tool切替時に進行中Interactionがある場合、各Toolの明示Policyに従いCommit / Cancelを決める。Tool切替自体だけで不要なArtwork Transactionを生成しない。

#### 5.0.6 Default Shortcut Map

主要Defaultを次とする。すべてRemap可能とする。

- `B`: Brush
- `E`: Eraser
- `S`: Blend / Smudge family
- `G`: Fill
- `L`: Selection family
- `V`: Transform
- `I`: Eyedropper
- `U`: Shape / Path
- `T`: Text
- `Space` hold: Temporary Pan
- `R` hold: Temporary View Rotate
- `[` / `]`: Brush Size down / up
- `X`: Main / Sub Color swap
- `D`: Main / Sub Color reset
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z`: Redo
- `Ctrl/Cmd + K`: Global Command Search
- `Tab`: Canvas Focus Mode toggle
- `Enter`: Commit current cancellable interaction
- `Esc`: Dismissal Stack最前面 / current interaction cancel

OS予約Shortcutと競合する場合はPlatform profileで代替する。

#### 5.0.7 Empty / Loading / Error

- Empty stateは次に行えるPrimary Actionを1つ以上提示する。
- LoadingでCanvas Direct Interactionを不必要にBlockingしない。
- Background処理中も編集可能なら明示して継続を許可する。
- Errorは発生箇所に近いSurfaceへ出し、Global fatal errorと局所Errorを分ける。
- unsupported / unavailable featureはDisabled理由をTooltip / Detailで説明する。

---

### 5.1 ドキュメント / キャンバス

#### 5.1.1 New Document

Primary Routeは `File > New` / Project Library `New`。DialogはWidth、Height、DPI、Background、Transparency、Color Profile、Basic Expression Mode、Presetを持つ。

Default:
- Color mode: RGB Color
- Profile: sRGB（端末 / OSがDisplay-P3制作を明示選択した場合のみP3）
- Background: White
- DPI: 300
- Unit display: px

最近使ったSizeをRecent Presetとして保持し、Named Presetを作成可能。Preset変更後も個別値を編集できる。

#### 5.1.2 Canvas Size / Image Size

**Canvas Size**はArtwork scaleを変えずCanvas Rectだけ変更する。Anchor positionを3×3 gridで選べ、数値Offsetも入力可能。Canvas外ArtworkはSection 3.1に従い保持する。

**Image Size**はArtwork自体をResampleする。Width / Height link、Aspect lock、Interpolationを持ち、Apply前に結果寸法と推定Memory impactを表示する。変更は1 Transaction。

#### 5.1.3 Crop / Trim / Extend

CropはCanvas上の直接矩形＋Propertiesの数値入力。Defaultは非破壊CropとしてCanvas Rectを変更し、枠外Artworkを保持する。明示`Delete outside artwork`のみ破壊Crop。

TrimはTransparent / Background-equivalent edgeを解析してCanvas Rectを縮める。実行前に対象基準を選択する。

Canvas Extendは方向別数値、Anchor、Background treatmentを持つ。

#### 5.1.4 Artwork Flip / Rotate

Artwork Flip / RotateはDocument Menuから実Dataへ適用し、View Mirror / View Rotateと明確に区別する。Command名に`Artwork` / `View`の意味を反映する。

#### 5.1.5 View Navigation

Pan / Zoom / View Rotate / MirrorはArtworkを変更せずHistoryに混在させない。

- Fit: Canvas / Active Frame全体をViewportへ収める。
- 100%: Document pixelとdisplay pixelの1:1を基本とする。
- Mirror View: Artwork未変更の左右反転表示。
- Pixel View: 拡大時に補間を抑えPixel boundaryを確認しやすくする。
- View Rotate Reset: 0°へ即復帰。

Zoom levelはView Pageと必要時の小型readoutに表示し、常時大型Sliderを置かない。

#### 5.1.6 Grid / Guide / Transparency

GridはSpacing、Subdivision、Origin、Color、Opacity、SnapをAssist / Viewから編集する。GuideはCanvas drag生成と数値作成の両方を持つ。GuideのDeleteはCanvas外へdragまたはContext Command。

透明領域はcheckerboardをDefaultとし、色 / sizeをSettingsから変更可能。Artworkの白とCanvas外領域を混同しない。

#### 5.1.7 Overscan Canvas

Canvas外Artworkは通常編集可能だが、標準ExportにはCanvas / Frame Rectだけを使用する。Canvas外内容はView設定で`Show outside canvas`を切替可能。非表示にしてもDataは保持する。

#### 5.1.8 Frame Variant

View PageのFrame blockから追加・複製・名前変更・削除・Active切替。Canvas上ではFrame boundary / handlesでMove / Resizeし、Aspect Ratio Presetまたは任意比率を選べる。

Frame VariantはArtworkをCropせず出力矩形だけ定義する。Export RecipeはFrameを明示参照できる。Active Frame削除時はDefault Canvasへ戻る。

#### 5.1.9 View Anchor

View PageからCurrent Pan / Zoom / Rotationを名前付きAnchorとして保存する。Tapで瞬間移動。Anchor更新は明示`Update from current view`。Artwork Historyとは別。

---

### 5.2 描画 / ブラシ

#### 5.2.1 Brush Family

Brush / Eraser / Blendは同一Stroke interaction規約を共有しつつ、作用Semanticsを分ける。

- Brush: Color / Alphaを付与。
- Eraser: Alphaを減少。
- Blend: Existing artworkをSmudge / Blur等で再配置・平滑化。

Stroke開始時にActive targetがPaint不可ならCanvas近傍へ理由を表示し、無反応にしない。

#### 5.2.2 Brush Properties

Propertiesの高頻度項目をDefaultで次とする。

1. Preset
2. Size
3. Opacity
4. Flow
5. Stabilization
6. Main / Sub Color

Brush Page / Advanced SettingsではTip、Spacing、Texture、Dynamics、Jitter、Scatter、Watercolor、Taper等を編集する。

#### 5.2.3 Size / Opacity / Flow / Density

- SizeはDocument-space基準をDefaultとし、Canvas-relative optionをSettingsで選べる。
- OpacityはStroke全体の実効Alpha上限。
- Brush DensityはDab自体の濃度。
- Flowは移動距離に伴う継続堆積量。

名前とTooltipで違いを明示し、OpacityとFlowを同義扱いしない。

#### 5.2.4 Tip / Spacing / Angle

TipはRound / Image / Custom / Multipleを許可。Aspect、Hardness、Initial Angle、Direction-follow、Flip、Antialiasを持つ。

SpacingはBrush Diameter比率表示を基本とし、非常に低いSpacingで性能負荷が高くなる場合も勝手に値を上げず、必要なら警告する。

#### 5.2.5 Dynamics

Pressure / Speed / Tilt / Rotation / Direction / Randomを入力SourceとしてSize、Opacity、Density、Blur / texture等へMappingする。各MappingはEnable、Min/Max influence、Curveを持つ。

入力DeviceがSourceを提供しない場合はそのMappingだけNeutral valueを使い、Preset自体を破壊的変更しない。

#### 5.2.6 Stabilization / Taper

StabilizationはRealtimeとPost-correctionを別Parameterとして見せる。強度0はRaw pathに最も近い挙動。Drawing中のCursor / path feedbackを遅延の隠蔽目的で別品質にしない。

TaperはEntry / Exit Size、Opacity、Forced taperを持つ。Stroke finalize時に全Stroke replayを同期必須にしない。

#### 5.2.7 Texture / Jitter / Scatter

TextureはAsset、Scale、Rotation、Offset、Strength、Invert、Blendを持つ。JitterはPosition / Size / Opacity / Rotation / Color等を独立調整。ScatterはParticle size / density / width / bias / directionを持つ。

乱数を使うPresetは同一Stroke再編集 / History再現で視覚結果を再現できるSemantic Seedを保持する。

#### 5.2.8 Watercolor / Mixing

Watercolor familyはMixing、Water amount、Color extension、Transparent mixing等をProperties quick group + Detailで扱う。高度な物理流体SimulationはSection 2除外どおり導入しない。

#### 5.2.9 Anti-overflow / Lineart-limited Paint

`Anti-overflow`はSelection / Reference / Boundary sourceをPropertiesから選ぶ。`Paint inside lineart`はLineart Boundary / Stable Region freshnessを確認し、古いTopologyを黙って使用しない。

Boundary準備不足時はCanvas上で対象範囲だけResolveし、全Document処理をStroke開始の前提にしない。

#### 5.2.10 Recent Stroke Re-edit

直近再編集可能Strokeがある場合、Properties / History contextual commandから`Re-edit Last Stroke`を起動。Size、Color、Opacity、Dynamics、Stabilization、Taper、互換Brush変更をInteractiveに再評価する。

別の意味的編集を挟んだ後は新Transaction。元Historyを破壊せず新Revisionを作る。

#### 5.2.11 Brush Morph

互換Preset A/Bを選択し0–100% Morph値で連続補間。非互換ParameterはCategoryごとに`A until midpoint / B after midpoint`等の明示PolicyをUIに示し、黙って欠落させない。Morph結果は新Presetとして保存可能。

#### 5.2.12 Inherited Brush Family

Child PresetはParentとの差分Overrideを表示する。Inherited valueはlink indicator、Overrideはaccent indicator。`Reset to inherited`で個別Override解除。Parent変更時はChildの非Override項目だけ追従。

#### 5.2.13 Built-in Preset Baseline

初期内蔵Presetは**40種**をBaselineとし、過剰な重複を避ける。

- Sketch 6: HB Pencil / 2B Pencil / Mechanical Pencil / Rough Pencil / Colored Pencil / Soft Graphite
- Ink 8: G Pen / Mapping Pen / Round Pen / Technical Pen / Brush Pen / Dry Ink / Felt Pen / Monoline
- Paint 8: Opaque Round / Flat Paint / Gouache / Acrylic / Soft Paint / Chalk Paint / Oil-like / Poster Brush
- Watercolor 6: Round Wash / Wet Wash / Edge Watercolor / Granulating Wash / Water Blend / Dry Watercolor
- Air / Spray 4: Soft Airbrush / Hard Airbrush / Fine Spray / Grain Spray
- Dry / Texture 5: Charcoal / Crayon / Pastel / Dry Media / Paper Grain
- Utility 3: Pixel 1px / Fill Brush / Soft Mask Brush

Preset名はLocalized表示可能だがStable internal IDを持つ。User presetを内蔵Preset更新で上書きしない。

---

### 5.3 ペン / タッチ / 入力

#### 5.3.1 Pen

PenはDefaultでArtwork Direct Manipulation owner。Pressure / Tilt / Azimuth / Rotation / Hover / Buttonsを利用可能な範囲で取得する。Hover時はBrush outline / target previewを表示可能。

Pen button defaultはQuick Eyedropper候補とするがRemap可能。

#### 5.3.2 Touch

Penが利用中のDefault profileではFingerはNavigation。Finger DrawingはSettingsで有効化可能。Palm rejection中に無効化したTouchをGestureとして誤解釈しない。

#### 5.3.3 Mouse / Trackpad

Primary clickはTool action。Middle / Space+dragはPan。Wheel / trackpad pinchはZoom、trackpad rotate対応環境ではView Rotateを利用可能。Right clickはContext Menu。

#### 5.3.4 Pressure Calibration

Global pressure curveはDevice Profile単位。Calibration UIはlight / normal / hard stroke sampleを複数回取得し、結果CurveをPreviewする。Apply前にTest padで確認できる。

Brush preset側CurveはGlobal補正後の入力へ追加Mappingする。

#### 5.3.5 Gesture Defaults

- Two-finger tap: Undo
- Three-finger tap: Redo
- Two-finger move: Pan / Pinch Zoom / Rotate
- Configurable long press: Quick Eyedropper

GestureとArtwork inputが競合する場合、Pointer ownershipとmovement thresholdで確定し、一度Artwork Strokeとして開始したPointerを途中でGestureへ奪わない。

#### 5.3.6 Coalesced / Raw Input

対応環境では高頻度Sampleを利用する。API差により取得不能でも同じTool semanticsを維持する。Sample量増大を無制限queue化しないことはSection 8 / 9で扱う。

#### 5.3.7 Hand Occlusion

利き手、Pointer位置、画面端を考慮し、Tooltip、Numeric readout、Context Bar等を手の反対側へ配置する。ユーザーが移動したFloating UIを毎回自動移動しない。

#### 5.3.8 Input Role Profile / Conflict Diagnostics

Preset profileは`Drawing / Navigation balanced`をDefaultとし、Lineart / Painting / User-definedを作成可能。Gesture / button / shortcutの同一割当を検出した場合、Conflict diagnosticsが両方を一覧化し、優先順位を明示する。

---

### 5.4 カラー

#### 5.4.1 Color Page

Color PageはCurrent / Previous、Main / Sub、Wheel、Components、History、Paletteを基本Blockとし、Block単位Collapse / PiP可能。

WheelはHue ring + Saturation/Value areaをDefaultとし、HSV / RGB / HEX / Alphaの数値入力へ即切替できる。

#### 5.4.2 Main / Sub / Previous

Main ColorがPrimary drawing color、Sub ColorがSecondary。`X`でswap、`D`でDefaultへReset。Previous Colorは直前確定Colorを保持し、Current editing中の一時値と区別する。

#### 5.4.3 Palette

Paletteは複数作成、Rename、Reorder、Import / Export。Swatchはdrag reorder、Tap apply、ContextでRename / Delete / Duplicate。Current colorを空Slotへ追加可能。

#### 5.4.4 Eyedropper

Sampling sourceはCurrent Layer / Visible Composite / Reference。Sample radiusを1px / average regionで選択。Hover / drag中はLoupe、Current→Candidate comparisonを表示。

Visible Composite samplingで寄与Layer候補が取得可能な場合、明示Commandから候補Layerへ移動できる。自動でActive Layerを変更しない。

#### 5.4.5 Gradient Editing

Linear / Radial / Free GradientはCanvas上Handleでstart / end / center / radius等を直接操作し、StopはColor / Alphaを別管理できる。Stop reorder、duplicate、delete、midpointをサポート。

Gradient Layer / Mapは非破壊Modifier / Layerとして再編集可能。Raster bakeは明示Command。

#### 5.4.6 Mixing / Intermediate / Similar

Mixing Paletteは複数色をStroke / blendして一時混色を作り、ResultをMain Color / Paletteへ送れる。Intermediate / Similar Colorは現在色から関係色候補を生成し、候補Tapで適用する。

#### 5.4.7 Color Match

Reference sourceをCanvas / Layer / Selection / Reference Imageから選び、Targetへ色関係を合わせる。Strength / preserve luminance等の高頻度ParameterをPropertiesへ出し、非破壊Effectとして適用するのをDefaultとする。

#### 5.4.8 Color Relation Lock / Component Lock

Relation Lockは基準色とHue / Saturation / Lightness差を保持し、Palette全体を相対移動する。Component LockはHue / Saturation / Lightness(Value)単位で固定。Lock状態はColor Pageに常時識別可能に表示する。

#### 5.4.9 Live Artwork Palette

Canvas / Layer / Selectionから主要色を抽出するDynamic block。SourceとRefresh状態を表示し、抽出候補をPaletteへ保存した時点で通常Swatchになる。Live Palette自体はArtwork revisionを変更しない。

---

### 5.5 レイヤー / 合成

#### 5.5.1 Layer Row / Selection

Layer RowはVisibility、Thumbnail、Name、必要時Status badgeを基本とする。Single tapでActive、modifier / multi-select modeでMultiple Selection。

Folder / Mask / AttachmentはIndentでOwnershipを表現。高度Relationを通常Rowへ過剰表示しない。

#### 5.5.2 Layer Creation

`+`からRaster / Vector / Text / Fill / Gradient / Adjustment / Image Material / Folder等を選択。最頻Rasterは1 Tap creationを許可。新Layerは現在位置の上へ追加をDefaultとする。

#### 5.5.3 Reorder / Folder

DragでBefore / After / Insideを明確にPreview。Folder Pass-through / IsolatedはPropertiesで切替。Cycleや不正OwnershipになるDropは拒否し理由表示。

#### 5.5.4 Visibility / Lock / Alpha Lock

EyeでVisibility。Lock badgeはLocked時のみ強く表示。Transparent Pixel LockはProperties / Row contextから切替。Locked targetへ描画しようとした場合、無反応ではなくlocal feedbackを出す。

#### 5.5.5 Opacity / Blend Mode

Selected layerのOpacity / Blend ModeはProperties上部へ常設。Blend ModeはSearchable list + category grouping。複数Layer選択で値が混在する場合Mixed stateを表示する。

#### 5.5.6 Mask

Layer Mask追加はBottom Strip `Mask`。Mask rowはOwner childとして表示し、Thumbnail選択でMask edit targetになる。Link / UnlinkはProperties。Featherは非破壊Parameter。

Selection↔Mask conversionはSelection Menu / Mask context両方から到達可能。

#### 5.5.7 Clipping

ClippingはStack adjacency semanticsをUIでも維持する。Clipped rowをindent / connectorで表示し、Base変更はReorderで理解可能。不可視の永続Base tetherをPrimary UXにしない。

#### 5.5.8 Object / External / Embedded Source

Embedded / External objectはLink badgeを持ち、PropertiesにSource name / status / Edit Source / Update / Relink / Make Uniqueを表示。Missing external sourceでもLast-known表示を維持し、Relink actionを提示する。

#### 5.5.9 Layer Role

RoleはPropertiesからLineart / Base Color / Shadow / Highlight / Background / Reference / User-definedを割当。通常制作で必須入力にしない。Role Filter / semantic queryに使用できる。

#### 5.5.10 Focus Set

複数Layer visibility状態をFocus Setとして保存。Activateで一時Solo等を適用し、Deactivateで元Visibilityを完全復元する。Focus Set変更は通常Artwork pixel editではなくWorkspace / Document semantic stateとして扱う。

#### 5.5.11 Influence View

明示`Influence View`でMask / Clipping / Adjustment / Reference / Object Link等をOverlay / connector表示。通常Layers Pageへ常設Graphを出さない。

#### 5.5.12 Layer Property Effects

Border / Watercolor Edge / Layer Color / Texture EffectはPropertiesのEffect blockから非破壊設定。Stack ModifierとOwner-attached effectをUI上で区別できるlabel / nestingを用意する。

---

### 5.6 選択 / マスク

#### 5.6.1 Selection Family

Default SubtoolsはLasso、Rectangle、Ellipse、Polygon、Brush、Auto / Magic、Color Range、Magnetic、Enclose。Family Tapは直近Subtool、Flyoutから切替。

#### 5.6.2 Selection Mode

Properties先頭にNew / Add / Subtract / IntersectをSegmented Controlで表示。Mode変更はSelection Constructionの意味を変えるが、それ自体でSelection revisionを生成しない。

#### 5.6.3 Lasso / Geometric Selection

Pointer move中にPath / geometryを逐次表示。ReleaseでBounded tail close後すぐFrozen Logical Selection Valueを成立させる。Canvas全面Rasterization完了をSelection成立条件にしない。

Rectangle / Ellipseはdrag中にBounds / size readout、modifierでcenter / aspect constraintを使える。

PolygonはTapでvertex、double tap / Enterでclose、Backspaceで直前vertex削除、EscでInteraction cancel。

#### 5.6.4 Auto / Magic / Color Range

Auto SelectionはTap candidateからToleranceをLive調整可能。Drag gestureでToleranceを連続調整するOptionを持つ。Reference sourceはCurrent Layer / Reference Layer / Visible Composite / Lineart Boundary。

Color RangeはSample color、Tolerance / Fuzziness、Selection previewを持つ。

#### 5.6.5 Brush Selection / Quick Mask

Brush SelectionはPaintしてCoverageを増減する。Quick MaskはActive SelectionをMask Overlayで直接編集するMode。Quick Mask exit時にFrozen Active SelectionをCommitし、普通のColor Layerを作らない。

#### 5.6.6 Selection Display

DefaultはContrast halo + Magenta/Violet accent outline。表示ModeとしてOutline / Mask Overlayを切替可能。Overlay opacity / colorはSettingsで変更可能。

#### 5.6.7 Selection Launcher

Selection成立時、対象近傍にTransform / Fill / Cut / Copy / Invert / Deselect / MoreをDefault表示。ユーザーCustomize可能。手 / pen occlusionを避けて配置し、描画中やTransform中は不要に重ねない。

#### 5.6.8 Expand / Contract / Feather / Invert

Expand / Contractはpx数値、FeatherはradiusをInteractive Previewできる。Applyで1 Selection Transaction。Preview中のCancelは元Selectionへ戻る。

#### 5.6.9 Selection ↔ Layer / Mask

Alpha→Selectionはその時点のSource RevisionからFrozen Selectionを作る。Selection→Mask、Mask→Selectionも明示Command。元Source後変更でFrozen Selectionが勝手に変わらない。

#### 5.6.10 Selection History / Pinning

Recent Selection RegistryをHistory Page / Selection contextから開く。Recent itemをTapでrestore、PinでSaved Selectionへ昇格。通常Document Historyとは別表示。

#### 5.6.11 Saved Selection

Named Saved SelectionはStable IDを持ち、Rename / Duplicate / Delete / Applyが可能。ApplyはFrozen Active Selectionを生成する。

#### 5.6.12 Pre-confirm Lasso Edit

Lasso Release後は通常即確定。必要時のみ`Refine Path`で直近Lasso geometryのHandle編集へ入り、修正結果を新Selection revisionとしてCommit。通常操作をHandle編集待ちにしない。

#### 5.6.13 Selection Recipe / Live Binding

RecipeはSource + Add/Subtract/Intersect + Expand/Contract + Feather等のProcedureとして保存。`Apply`はFrozen Selection生成。`Bind Live`を明示選択した場合だけToolのSelection InputへLive Selection Bindingを作る。

Binding状態はPropertiesに明示し、`Freeze`でCurrent ResultをFrozen Selectionへ変換、`Unbind`でBinding解除。通常Selectionを暗黙Dynamic化しない。
