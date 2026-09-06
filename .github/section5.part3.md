### 5.13 フィルター / 色調補正

#### 5.13.1 Apply Model

Filter / AdjustmentのPrimary Routeは`Filter` Menu、Layers `Effect`、Command Search。対象がLayer / Selection / Modifier-compatible Objectの場合、**Non-destructive Effectとして適用**をDefaultとする。`Apply Destructively` / `Bake`は明示Command。

Filter Dialogを巨大Modalにせず、Properties / Effect Detail + Canvas interactive anchorを基本にする。Effect適用中もCanvas contextを維持する。

#### 5.13.2 Color Adjustments

Brightness / Contrast、Levels、Tone Curve、Hue / Saturation / Lightness、Color Balance、Grayscale、Threshold、Posterize、Invert、Gradient Map、Color Replace、Drawing Color Changeを提供。

- Levels: channel / input black / gamma / input white / output levels。
- Tone Curve: composite + channel curve、node add/delete、numeric input。
- HSL: master / hue range、Hue/Saturation/Lightness。
- Color Balance: shadows/midtones/highlights等のrangeを明示。
- Threshold / Posterize: live scalar adjustment。

Current Effective StateへInteractive反映し、Confirmまでold resultだけを表示しない。

#### 5.13.3 Line / Edge Filters

Line Extraction、Edge Detection、Outline等はThreshold / Width / sensitivity等をPropertiesで調整。Lineart作成へ利用可能な結果では`Create Lineart Source`への明示routeを提供するが、自動でLineart Groupへ変換しない。

#### 5.13.4 Blur / Sharpen

Gaussian / Motion / Zoom / Radial-Rotation / Lens Blur、Sharpen / Unsharp Maskを提供。

方向・中心・radiusを持つEffectはCanvas Effect Anchorで直接操作。Motion angle、Zoom center、Radial center等がPropertiesと同期する。

#### 5.13.5 Stylize / Lighting / Noise

Mosaic、Pixelate、Emboss、Bevel、Inner/Outer Glow、Drop Shadow、Satin、Wet Edge、Bloom、Cross Filter、Light Rays、Noise、Perlin Noise、JPEG Noise Reduction、Frosted Glass、Stained Glass、Pointillize等をEffect catalogへ分類。

Effect catalogはSearch + categoryで選び、巨大なMenu階層だけに依存しない。

#### 5.13.6 Style Filters

Illustration / Pencil / Film / Retro Game / Glitch / Chromatic Aberration / Anime Background等はPreset starting point + editable parameters。ResultをAI生成機能として扱わず、deterministic image effectとして設計する。

#### 5.13.7 Generators

Cloud、Linear/Radial/Concentric Gradient、Radial Line、Speed Line GeneratorはGenerator Layer / Modifierとして非破壊生成をDefault。Canvas anchor / direction / center / spacing等を直接操作可能。

#### 5.13.8 Geometric Distortion Filters

Bloat / Sphere / Lens Distortion / Wave / Ripple / Twirl / Polar Coordinates / Shear / Distortion Correction / Panorama Transform / Extrude等は可能な限りEffect Modifierとして適用。中心 / axis / intensity等はCanvas Anchorを使う。

#### 5.13.9 Effect Recipe

複数Effect chainをNamed Recipeとして保存。Recipe適用はEffect instancesを作成し、後のRecipe preset変更で既適用作品を暗黙更新しない。明示`Relink to Shared Recipe`を将来導入する場合はShared semanticsを別扱いにする。

#### 5.13.10 Parameter Sweep

1〜2個の選択Parameterについて候補Gridを生成し、同一Viewport / cropで比較。Candidate Tapでcurrent working stateへ反映、Fine Tune後Apply。Sweep candidate generationをForeground direct manipulationより優先しない。

---

### 5.14 非破壊編集

#### 5.14.1 Modifier UI

Layers `Effect`からAdjustment / Filter / Transform / Displacement等を追加。Attached ModifierはOwner child、Stack ModifierはVisual Stack participantとして表示。

PropertiesはEnabled、Opacity / Strength（該当時）、Mask、主要Parameter、Detailへの入口を持つ。

#### 5.14.2 Enable / Reorder / Remove

Enable toggleはState保持。ReorderはEffect result orderを変更し、CanvasへInteractive反映。RemoveはModifierだけ削除しSource artworkを保持。

#### 5.14.3 Effect Mask

各ModifierへMask追加可能。Mask selected時はBrush等でCoverage edit。Effect MaskとLayer MaskはOwnership / labelを区別する。

#### 5.14.4 Multiple Layer Apply

複数Layerへ同じEffect parameterを個別instanceとして適用するかShared Modifierを作るかを明示選択。Defaultは独立instanceで意図しない後続連動を作らない。

#### 5.14.5 Shared Modifier

Shared Modifier creation時にShared DefinitionとApplicationsを表示。`Edit Shared` scopeを明示し、local Application mask / enabled state等と混同しない。

`Make Independent`でDefinition clone。Shared definition変更を全Applicationの同期再計算完了待ちにしない。

#### 5.14.6 Parameter Link

複数Effect parameterをShared Parameterへlink。Link indicatorをPropertiesへ表示し、Edit時にlinked consumers数を確認可能。Unlinkはcurrent valueをlocal copyとして保持する。

#### 5.14.7 Effect Variant

Modifier / chainのparameter setをVariantとして保存。Compare modeでA/B instant switch。Apply VariantはCurrent canonical parameterへCommitし、unused variantは候補として残せる。

#### 5.14.8 Bake / Rasterize

Bakeは対象Modifier chainのCurrent Effective ResultをRaster / supported targetへ固定し、元Modifierを保持する`Bake Copy`と置換する`Bake & Replace`を分ける。Historyで復元可能でも操作意味を明示する。

---

### 5.15 テキスト

#### 5.15.1 Text Creation

Text Tool TapでPoint Text、dragでBox Text。Creation直後からCanvas inline editingへ入る。Horizontal / VerticalをPropertiesで切替。

#### 5.15.2 Inline Editing

Canvas上Caret、selection、IME compositionをOS標準期待に合わせる。Text box corner / edge handlesでbox resize。Text content edit中とTransform modeを明確に区別する。

#### 5.15.3 Text Properties

Primary:
- Font
- Font Size
- Style / Weight
- Color
- Alignment
- Character Spacing
- Line Spacing
- Direction

Detail:
- Outline
- Ruby
- Text Style Preset
- Glyph / Symbol
- Auto Fit

Font listはSearch、recent、favorite対応。Missing fontは代替状態を明示し、silent permanent substitutionしない。

#### 5.15.4 Font Import

User font fileをLocal ResourceとしてImport可能。License / embedding可否のmetadataが取得できる場合はExport compatibilityへ利用するが、利用可否を推測だけで禁止しない。

#### 5.15.5 Point / Box Text

Point Textはcontentに応じてbounds拡張。Box Textはbox内reflow。Point↔Box conversionを明示Commandで行い、current style / transformを維持する。

#### 5.15.6 Vertical Writing / Ruby

Vertical Writingではpunctuation / orientationを対応可能なfont / shaping engineに従う。Rubyはbase text rangeへannotationとして保持し、Font Size / offset等をPropertiesで調整。

#### 5.15.7 Text Outline / Style Preset

Outlineはnon-destructive text effectとして保持。Style Presetはfont / size / spacing / outline等を再利用可能。Applying presetでText contentは変更しない。

#### 5.15.8 Linked Text Style

複数Text ObjectがStyle Definitionを共有可能。Shared style edit時はscopeを明示。Object固有Overrideは差分表示。`Make Local Style`で独立化。

#### 5.15.9 Live Text Boundary

Text glyph outlineをSelection / Fill / Boundary sourceとして参照可能。Text変更時にdependent current regionが必要ならfreshnessを解決するが、全Document同期更新をTyping latencyへ載せない。

#### 5.15.10 Auto Fit

Box constraintに対しFont Size、Character Spacing、Line Spacing、Box Resizeの許可項目を選択し、Fit targetを満たす。Auto Fit stateは明示badgeを持ち、manual editがconstraintを解除するかoverrideするかをUIで示す。

#### 5.15.11 PSD Text Compatibility

PSD Import時、supported text semanticsはeditable Text Objectへ保持。unsupported typographyはWarningとし、可能ならappearance fallback + original metadataを保持。Export前にPreflightでlossを列挙する。

---

### 5.16 参考画像 / 制作補助

#### 5.16.1 Reference Block

View Page > ReferenceからReferenceをAdd。BlockはPiP化可能。ReferenceはArtwork Compositeへ含めない。

#### 5.16.2 Multiple References

複数Referenceをlist / tab / gridで管理。Add / Remove / Reorder / Replace。RemoveはProject reference entryを削除するが元Fileは削除しない。

#### 5.16.3 Reference Navigation

ReferenceごとにPan / Zoom / Rotate / Reset stateを保持。Canvas Viewとは独立。Reference stateはProject metadataへ保存可能。

#### 5.16.4 Reference Eyedropper

Reference上でEyedropperを使うとMain Color candidateを取得。Color managementがある場合はdisplay / document color space conversion ruleを一貫させる。

#### 5.16.5 Reference Lens

Grayscale、Blur、Horizontal Flip、Desaturate、Edge Emphasis、Value Onlyを非破壊View effectとして適用。複数Lensを同時stackする場合はactive statesをBlock headerに示す。

#### 5.16.6 Canvas ↔ Reference Anchor

Canvas pointとReference pointをAnchor pairとして登録し、Sync Pan / Sync Zoomを任意有効化。Anchor mismatch / missing reference時はSyncを停止しstatus表示。

#### 5.16.7 Reference Set

用途別Reference群をNamed Setとして保存。Set切替で表示Referenceとview stateを復元。Reference file missing時もSet定義は保持しRelink可能。

#### 5.16.8 Navigator

View Page Navigatorはcurrent viewport rect、zoom、rotation、mirror stateを表示。Thumbnail上dragでPan、wheel / pinchでZoom。Navigator更新がBrush inputを奪うBackground workにならない。

---

### 5.17 履歴 / 自動化

#### 5.17.1 Undo / Redo

Quick Hole左=Undo、右=Redoを固定。Keyboard / Menu / History Pageにもrouteを持つ。Target History Stateのvisible resultを最優先し、Storage / Thumbnail / Indexingを待たせない。

Undo後のnew editはold redo pathをBranchとして保持する。

#### 5.17.2 History Page

History Pageはsubsections:
- History
- Branches
- Checkpoints
- Auto Actions
- Timelapse

History listはOperation name、time、affected target等のcompact metadataを表示。Tapでpreview、明示`Restore Here`でcurrent branchをそのstateへ移す。

#### 5.17.3 Branches

Branch listはName / origin checkpoint / last editを表示。Switchはcurrent branch stateを保存してtargetへ移動。CompareはA/Bまたはsplit view。Mergeはsafe automatic changesのみ自動適用し、ambiguous conflictはuser choice。

#### 5.17.4 Named Checkpoint

Current History StateをNamed Checkpointとして保存。Jump / Compare / Rename / Delete。Checkpoint deleteでreferenced artwork revisionを即物理削除する意味にはしない。

#### 5.17.5 History Search

Layer / Tool / Command / Effect / text queryでHistory metadataを絞る。Search indexingがForeground interactionの同期条件にならない。

#### 5.17.6 Auto Action Record

Record開始後、recordable semantic commandsをAction stepsへ保存。Pointer raw samplesそのものを無制限記録する方式をDefaultにしない。Record中は明確なstatus indicator。

#### 5.17.7 Auto Action Edit / Play

Step reorder、disable、parameter edit（safeなもの）を可能にする。Playはcurrent documentへ適用し、複数Step全体を1 TransactionとしてUndo可能にするOptionをDefault ON。

Target missing / incompatible stepでは停止点とreasonを示し、silent skipをDefaultにしない。Userが`Skip incompatible`を選べる。

#### 5.17.8 Auto Action Import / Export

Illustro action formatでImport / Export。Unknown command versionはCompatibility reportを表示。External code executionを含むMacro形式にはしない。

#### 5.17.9 Timelapse

Meaningful Operation Stream / visual checkpointsからPlayback。Playback speed、Pause、Scrub。ExportはBackground Video Exportとして行いDrawing継続可能。

TimelapseはArtwork Historyの保持Policyと連携するが、TimelapseのためにBrushごと全Canvas screenshotを必須にしない。

---

### 5.18 ファイル / プロジェクト管理

#### 5.18.1 Project Library

App entryはLocal Project Library。Grid / List切替、Search、Sort、Folder / Collection、Recent、Recently Deletedを提供。

Project cardはThumbnail、Name、Modified time、status。Thumbnail generation失敗でProject自体を開けなくしない。

#### 5.18.2 Native `.illustro`

Native formatはSection 2/3の全編集構造、History / Branch / Checkpoint、Resources、Reference metadata等を保持可能。物理formatはSection 6 / 8で確定。

#### 5.18.3 Autosave

Default ON。Logical CommitとDurable saveを分離し、Autosave中もDrawingを止めない。Top BarにSaved / Saving / Save issueを表示。

#### 5.18.4 Crash Recovery

Abnormal close後、Library / open時にRecovery candidateがある場合、`Recovered` stateを提示。Recovered version / last durable versionを必要ならCompare可能。勝手にolder durable stateへrollbackしない。

#### 5.18.5 Duplicate / Rename / Delete

Duplicateはindependent Project VariantをDefault。Renameはinline / context。DeleteはRecently Deletedへ移動し、一定期間またはexplicit permanent deleteまで復元可能。

#### 5.18.6 Import

PNG / JPEG / TIFF / PSD / SVG / supported brush / project compatibility formatをImport。Import前後にCompatibility summaryを表示するのはlossがある場合のみ。

画像ImportはNew Document / Layer / Materialの目的をrouteで分ける。

#### 5.18.7 PSD

PSD Import / Exportはsupported Layers / Masks / Blend / Text等をeditable保持。Unsupported featureはRasterized fallback / omit / warning policyをPreflightで明示。見た目優先fallbackとeditability優先fallbackを必要時選べる。

#### 5.18.8 ibisPaint / CSP Brush Compatibility

ibisPaint brush / QR、CSP `.sut`をImportし、Illustro Brush modelへmapping。unsupported parameterはImport reportに列挙。Original fileは必要ならresourceとして保持可能。

#### 5.18.9 Project Variant

`Create Variant`はShared BaseからCopy-on-Write意味で独立Project案を作る。Library上は別Card。Variant間で後から勝手にedit syncしない。

#### 5.18.10 Project Health Check

Missing Font / Linked File、PSD compatibility、Color profile、excess resource、export loss等を一覧化。Severity、affected entity、Fix routeを持つ。

#### 5.18.11 Background Export While Drawing

Export開始時にSnapshotを固定しBackground processing。以後のDrawingは次Revisionへ継続。Export resultは開始Snapshotに対応し、途中editが混入しない。

#### 5.18.12 OS Share

Export result / selected fileをOS Shareへ渡す。Share失敗でProject stateを変更しない。
