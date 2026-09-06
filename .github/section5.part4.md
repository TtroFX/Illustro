### 5.19 ワークスペース / 操作環境

#### 5.19.1 Workspace Preset

WorkspaceはTool Rail構成、Right Page状態、Panel / PiP placement、Collapse / Size、Quick Hole placement、UI density等のUI stateをNamed Presetとして保存可能。Artwork stateは含めない。

Default Workspace、Custom Workspace、Resetを持つ。Device regime差は同名Workspace内にdevice-specific layout variantを保持可能。

#### 5.19.2 Tool Rail Customization

Default 9 Familyを基準にReorder / Hide / Add / Group / Reset。非表示ToolはGlobal Command Searchから必ず到達可能。

Customization mode以外で誤drag reorderしない。Touchでは明示Edit modeをDefaultとする。

#### 5.19.3 Quick Access / Command Bar

Section 2のQuick Access / Command Barは、Global Command Searchと競合しない形で**ユーザー定義Favorite command surface**として提供する。

登録可能:
- Tool / Tool Family
- Command
- Page / Panel open
- Auto Action
- Drawing Color / Palette color
- Workspace

Desktopではoptional compact bar / PiP、Tablet / PhoneではQuick Access sheetとして表示可能。Default UIでは常設せず、ユーザーが有効化した場合のみ表示する。

#### 5.19.4 Global Command Search

`Ctrl/Cmd + K`、Main Menuから起動。Command name、synonym、Tool、Panel、Settingを検索。

Resultには現在実行可能か、Shortcut、Menu pathを表示。Disabled resultも必要なら表示しreasonを説明する。Search履歴 / frequently usedをLocalに学習できるが、個人情報送信を前提にしない。

#### 5.19.5 Selection Launcher Customization

Default command setをReorder / Add / Remove / Reset。Selectionに不適合なCommandはruntimeでdisabled reasonを持つ。Launcherが大きくなりすぎる場合はPrimary + Moreへ自動整理。

#### 5.19.6 Tool Properties / Detail Settings

Propertiesはcurrent Tool / Objectの高頻度項目。Detail Settingsは全Parameter。UserはDetail項目を`Show in Properties`へ昇格、逆にlow-frequency項目をPropertiesから隠せる。

#### 5.19.7 Tool Slider

Brush Size / Opacity等の専用SliderをWorkspaceへ配置可能。Sliderは同じCanonical Parameterへbindingし、PiP / Propertiesと値を共有。

#### 5.19.8 PiP

Sidebar BlockをHeader drag-outでDetach。専用PiP buttonは常設しない。Context Menu / KeyboardからDetachでき、drag操作の代替を確保する。

PiPはMove、Resize、Block Collapse、whole PiP Collapseを持つ。`×`はRedock。Sidebar collapseと独立して残る。Redock candidateへ近づけるとDock Preview、Dropで確定。

#### 5.19.9 Quick Hole Controller

Quick HoleはSection 4確定形状を維持する。

- 6 independent hex tiles
- tile centersは同一円周上、60°間隔
- whole arrangementは30°回転
- tile間に一定Gap
- centerは空洞
- leftmost=Undo
- rightmost=Redo

Defaultの残り4 tile:
- upper-left: Brush ↔ Eraser toggle
- upper-right: Quick Eyedropper
- lower-left: Color Page focus
- lower-right: Layers Page focus

4 tileはFull Remap可能。Undo / RedoもSettingsからRemap可能にできるが`Restore Default`で左右Undo/Redoへ戻る。

Quick HoleはDefault visible。Drawing pointer downでHide、stroke end後に元Anchorへ復帰。Quick Hole自身や他UI操作ではAnchorを移動しない。

**Center hole drag**でcontroller全体を移動する。Center hole Tapは何もしないため誤Commandを防ぐ。Scale、Radius、Button Size、OpacityはWorkspace settingsで変更。

Temporary DismissはContext Menu / Workspace commandから行い、Main Menu > Workspace > Quick Hole > Showで復帰できる。Gestureだけを復帰routeにしない。

#### 5.19.10 Quick Hole Input

Tile Tapでcommand実行。Pointer down→別tileへslide→releaseでrelease tile commandを実行するradial marking behaviorをoptional settingとして提供し、DefaultはOFF。誤操作防止を優先する。

Undo / Redo disabled時はtileをdisabled visualにし、Tapしても新History operationを作らない。

#### 5.19.11 Task-linked Workspace

UserがTool / production taskとWorkspace Presetを関連付け可能。Defaultは自動切替OFF。ONの場合もTool切替のたびに強制layout変更せず、User-defined trigger条件に従う。

#### 5.19.12 Spring-loaded Panel

Shortcutを押している間だけColor / Layers / Properties等を一時表示。Releaseで閉じ、元focus / pointer contextを復元。Panel内をクリックしてPinするOptionを持つ。

#### 5.19.13 Reachability Workspace

Left-handed / Right-handed / Mirror Layoutを提供。Tool Rail / Page Rail / transient popup placementをMirror可能。Artwork coordinatesやexport結果は変えない。

---

### 5.20 共通インタラクションシステム

#### 5.20.1 Direct / Quick / Detail

すべての新機能は実装前に、Direct、Quick、Detailのどこへ主操作を置くか定義する。高頻度ParameterをDetailだけへ置くこと、低頻度全ParameterをCanvasへ露出することを避ける。

#### 5.20.2 Adaptive Scalar

広い値域を持つSliderはcurrent value / rangeに応じてdrag sensitivityを適応。Fine modifierまたはtrack perpendicular distanceでgainを下げる。Pointer jumpを起こさず連続値を保持。

#### 5.20.3 Saved Parameter Marks

Brush Size、Opacity、Angle等のscalarにNamed / unlabeled marksを保存可能。Mark Tapで値へ移動。Presetとは別で、parameter-specific shortcutとして扱う。

#### 5.20.4 Exact / Relative Numeric Input

Numeric fieldはabsolute valueに加え`+10`, `-5`, `×2`, `÷2`を解釈。Mixed multi-selection stateでもrelative inputは各current valueへ適用可能。

#### 5.20.5 Semantic Picker

Layer、Role、Reference、Source、Palette等を選ぶfieldはSearchable semantic pickerを共通利用。NameだけでなくType / Role / statusを表示し、曖昧なfirst-matchを禁止する。

#### 5.20.6 Thumbnail Asset Picker

Brush Tip、Texture、Pattern、Material等はThumbnail grid + Search / category / favorite。Keyboard navigation、Touch scroll、large previewを共通化。

#### 5.20.7 Searchable Long List

Font、Blend Mode、Command、Asset等の長いlistはSearch、recent、categoryを提供。Scroll positionをsurface reopenで保持する。

#### 5.20.8 Canvas Direct Manipulation

Canvas handleは対象へ近接配置し、Propertiesと同期。HandleがArtworkを隠す場合はvisibility / minimal modeを提供。Pointer hit areaは視覚sizeより大きくできる。

#### 5.20.9 Color Drag → Fill

Color chip / swatchをCanvasへdragし、eligible region / layerへdropするとFill candidateを表示。Drop target highlight後にApply。Ambiguous targetではcandidate selectorを出し、誤Layerへsilent fillしない。

#### 5.20.10 Eyedropper Preview

Sample中はLoupe、Current / Candidate、sampling sourceをlocal overlay表示。ReleaseでMain Color commit。Cancelで元Color維持。

#### 5.20.11 Live Tolerance

Fill / Auto Select等のthreshold系はresultを見ながらcontinuous adjustment可能。Parameter interaction全体を1 Undo / Selection transactionとして扱う。

#### 5.20.12 Preview → Commit規約

Section 2の`Preview → Commit`表現はSection 3に合わせ、Previewを**Current Effective Interactive State**として定義する。低品質fake previewを別意味状態として使わない。

#### 5.20.13 Spring-loaded Tool

Shortcut holdでEyedropper / Pan等へ一時切替。Releaseで元Toolへ戻る。Temporary tool使用だけで元ToolのPrepared Contextやcontinuous transactionを不必要に破壊しない。

#### 5.20.14 Continuous Transaction

Canvas handle→Properties slider→Numeric fieldのように同じ意味編集を跨ぐ場合、複数Atomic Logical Revisionを1 Undo unitへ束ねる。Explicit finish、Tool semantic boundary、timeout等のclosing ruleはfeatureごとに定義する。

---

### 5.21 オンライン / 共同制作

#### 5.21.1 Positioning

Collaborationは通常制作から分離した副次機能。Offline / accountなしの通常制作を阻害しない。AccountはRoom利用時だけ必要にできる。

#### 5.21.2 Room Create / Join

Main Menu > CollaborationからCreate Room / Join Room。Room create時にName、access policy、participant limit等を設定。JoinにはRoom link / code等の明示identifierを使う。

#### 5.21.3 Session UI

Room active時のみTop BarへRoom status / participant countを表示。Participants panelはpresence、name、current shared/private stateを表示し、通常Solo時は存在しない。

#### 5.21.4 Shared / Private Layers

LayerごとにPrivate / Shared stateを明示。New layer defaultはRoom policyで設定可能だが、安全側としてPrivateをDefaultとする。`Share Layer`で明示公開。

Private→Shared時にcurrent contentをsessionへpublish。Shared→Privateで他participantが参照中の場合はimpactを示す。

#### 5.21.5 Shared Production State

Palette、Reference、Lineart Boundary、Ruler、Selection等はShared stateとして明示publish可能。Local stateを自動で全部共有しない。

#### 5.21.6 Concurrent Editing

Shared Layerへの同時editはoperation / region semanticsで統合可能なものをrealtime適用。意味的conflictがある場合、silent last-write-winsで他人の内容を破壊しない。

Direct drawing latencyをnetwork roundtrip待ちにしない。Local committed operationを即表示し、remote synchronizationは別lane。

#### 5.21.7 Presence / Remote Cursor

Optional remote cursor / viewport indicatorを表示。Artworkへ焼き込まない。ParticipantごとShow / Hide可能。

#### 5.21.8 Follow View

Participantを選択してFollow View。Follow中はremote Pan / Zoomへ追従するが、local navigation inputで即解除可能。Follow ViewはArtwork stateを変更しない。

#### 5.21.9 Connection Loss

切断時も可能な限りLocal editing継続。Unsynced operation count / reconnect stateを表示。Reconnect時にconflictがあれば明示resolutionへ進み、local committed artworkを勝手に消さない。

---

### 5.22 素材 / リソース

#### 5.22.1 Assets Page

Asset types:
- Image Material
- Texture
- Pattern
- Brush Tip
- Stamp
- Gradient
- User Material
- Smart Material
- Procedural Material

Category、Tag、Search、Sort、Favorite、Recent historyを共通提供。

#### 5.22.2 Register from Canvas / Selection

Canvas / Selectionから`Register as Material`。Name、Type、tags、preview crop、repeat behavior等を指定。元Artworkとmaterial instanceは自動linkしない。

#### 5.22.3 Material Placement

Image MaterialをCanvasへdrag/dropでMaterial Layer / contentとして配置。Move / Scale / Rotate / TilingをCanvas direct + Propertiesで編集。

#### 5.22.4 Import / Export

Supported material formatをImport / Export。Unknown metadataは可能な範囲で保持し、unsupported parameterはreport。

#### 5.22.5 Smart Material

Color、Scale、Rotation、Density、Randomness等のeditable parametersを持つMaterial definition。Placementごとにoverride可能。Definition edit scopeをSharedとして明示。

#### 5.22.6 Procedural Material

Dot、Stripe、Grid、Noise、Cloud、Paperをgeneratorとして提供。Resolution-independent parameterを可能な範囲で保持し、Raster bakeは明示。

#### 5.22.7 Seamless Material Builder

Selected image / materialをWrap Previewし、Seam candidateを検出。Offset / clone / blend等のediting routeを提供し、final `Register`でseamless materialへ保存。

---

### 5.23 設定 / 環境設定 / アクセシビリティ

#### 5.23.1 Settings Categories

- General
- Pen / Pressure
- Touch / Gesture
- Mouse
- Keyboard / Shortcuts
- Canvas / View
- Workspace / Tool Layout
- Appearance / Theme
- Font Management
- Accessibility
- File / Recovery
- Online / Collaboration

Search Settingsを提供。

#### 5.23.2 Device Profile

Desktop / Tablet / Phone / User-defined profileを持ち、UI scale、density、input roles、gesture、button mapping等を保存。端末種別推定だけでuser-defined profileを上書きしない。

#### 5.23.3 UI Scale / Density

UI Scale preset: 80 / 90 / 100 / 110 / 125 / 150% + Auto。

Density:
- Compact
- Comfortable (Default)
- Touch

Responsive Layoutと別概念。Touch densityでは主要hit targetを44級へ拡張。

#### 5.23.4 Theme

Light Default、Dark対応。Semantic Tool colorsを両Themeで維持しつつcontrastを調整。Reduced Transparency / High Contrast preferenceを反映。

#### 5.23.5 Shortcut / Gesture Editor

Command Searchと同じcommand registryを使い、Key / Pen button / Gesture bindingを編集。Conflict detection、Restore Default、Export / Import profileを提供。

#### 5.23.6 State Persistence

Workspace、last tool、panel state、view state等の保持可否をcategoryごと設定可能。Privacy / shared device用途で`Do not restore recent documents`等のOptionを持てる。

#### 5.23.7 「この挙動の設定」

Context Menu / Help affordanceから現在Controlに関連するSettingsへ直接navigate。該当Settingがない場合はGeneral settingsへ曖昧に飛ばさない。

#### 5.23.8 Settings Trial Mode

複数設定をTemporary Applyし、画面下 / Settings headerに`Trial active`を表示。`Commit`で保存、`Revert All`でTrial開始前へ戻す。Input mapping変更で操作不能になった場合のsafe revert shortcutを確保。

#### 5.23.9 Backup / Restore / Reset

Settings backupはLocal fileへExport可能。Restore前に差分categoryを選択。Reset to Defaultsはcategory単位とallを分ける。

#### 5.23.10 Accessibility

Color-only state禁止、Keyboard focus、Reduced Motion、High Contrast、Left/Right handed、Touch target、screen reader accessible namesを基本要件とする。

Motion reduction時もDirect Manipulationの位置変化そのものは保持し、装飾transitionだけ削減。

---

### 5.24 出力 / カラーマネジメント

#### 5.24.1 Color Profile

Document ProfileはDocument Menu > Color Profile。Assign ProfileとConvert Profileを分離。

- Assign: numeric values維持、interpretation変更。
- Convert: appearance維持方向でvalues変換。

操作結果 / warningを明確化し、両者を同じ`Change Profile`にしない。

#### 5.24.2 ICC / Rendering Intent

ICC profile選択とPerceptual / Relative Colorimetric / Absolute Colorimetric / Saturationを提供。Black point compensation等、採用する追加OptionはSection 6互換設計で最終化。

#### 5.24.3 Soft Proof / Gamut Warning

View Menu / View PageからSoft Proof toggle。Proof profile、Rendering Intentを選択。Gamut Warningはoverlayで表示しArtworkを変更しない。

#### 5.24.4 CMYK Preview / Print-size Preview

CMYK Previewはproof representationとして扱い、RGB制作stateを自動CMYKへ変換しない。Print-size PreviewはDPI / monitor informationからphysical size approximationを表示し、calibration limitationを説明可能にする。

#### 5.24.5 Export Workspace

Top Bar Exportから独立Workspace / Sheetを開き、Format、Dimensions、Frame、Profile、Bit Depth、Transparency、Metadata、Namingを設定。

Export設定変更はArtwork revisionを作らない。

#### 5.24.6 Format Defaults

- Web / general default: PNG, sRGB, 8-bit
- JPEG: quality 90% baseline、Alpha不可をwarning
- TIFF: high-quality / print route
- PSD: editable compatibility route
- SVG: vector route

Transparent artworkでPNGを選ぶ場合Alpha保持をDefault。JPEG選択時はBackground compositing colorを明示する。

#### 5.24.7 Export Recipe

Named RecipeはFormat、Dimensions、Frame Variant、Profile、Bit Depth、Metadata、Namingを保存。Recipe applyingでArtworkを変更しない。

Built-in recipes:
- Web PNG
- Web JPEG
- Transparent PNG
- High Resolution Archive
- Print RGB
- PSD Exchange

User recipe作成 / duplicate / rename / delete / export / import。

#### 5.24.8 Multi-target Export

複数Recipeを1 jobにまとめ、SNS / Thumbnail / High Resolution / Print / Backup等を一括生成。各targetは同一Snapshot revisionから生成し途中editを混ぜない。

#### 5.24.9 Export Preflight

Export前にResolution、Gamut、Profile、Transparency、Unsupported Layer Structure、Missing Font、File Size Estimate等を検査。

Severity:
- Info
- Warning
- Blocking

BlockingはFormat上成立しない場合だけ。Warningを無視してExportするrouteを必要に応じて許可。

#### 5.24.10 Proof Compare

sRGB / Display-P3 / CMYK等をSynchronized Viewで比較。Split / side-by-side / toggleを提供。Comparison UI自体はArtworkへ影響しない。

#### 5.24.11 Background Export

ExportはSnapshot固定後Background processing。Progress、Cancel、Result location / Shareを表示。CancelでArtwork stateを変更しない。

---

### 5.25 Section 5 完了条件 / Default UX Baseline

#### 5.25.1 24カテゴリCoverage

Section 2の24カテゴリすべてについて、本章でPrimary behavior / entry / parameter grouping / state / interaction semanticsを定義した。Section 5で新たにSection 2の採用外機能を暗黙追加しない。

#### 5.25.2 Default Quick Hole

- left: Undo
- right: Redo
- upper-left: Brush/Eraser toggle
- upper-right: Quick Eyedropper
- lower-left: Color Page
- lower-right: Layers Page

6 Hex geometryはSection 4を唯一の形状仕様とする。

#### 5.25.3 Default Shortcut Baseline

5.0.6のKey MapをDefaultとし、全項目Remap可能。Gesture / ShortcutはGUI Primary Routeのacceleratorであり唯一の入口にしない。

#### 5.25.4 Default Brush Baseline

Built-in 40 Presetを5.2.13の初期Baselineとする。Preset count増加を機能完成の代替指標にしない。基本描画、線画、塗り、混色、水彩、Air、Texture、Pixel用途を初期状態でカバーする。

#### 5.25.5 UI / State Consistency

1. PropertiesはCurrent Tool / Objectの高頻度設定。
2. Detailは全Parameter。
3. Canvas direct operationとPropertiesは同じCanonical Parameter stateを共有。
4. Interaction中表示はCurrent Effective Stateへ一致。
5. Commit / Cancel / Undoの意味はSection 3と一致。
6. Non-destructive capabilityがある処理はPrimary Routeで非破壊適用を優先。
7. Background operationの都合でForeground direct interactionを不必要にBlockingしない。
8. User inputが無効な場合は無反応ではなくreasonを伝える。
9. Color / shortcut / gestureだけに意味を依存しない。
10. Section 4 Feature-to-Route Matrixを維持する。

#### 5.25.6 Section 5と後続章の境界

本章で確定したのはユーザーが見る機能Semantics / UXである。

後続章:
- Section 6: 保存・File format・Compatibility・Durabilityの詳細
- Section 7: 非機能要件・性能 / reliability / accessibility target
- Section 8: 技術Architecture
- Section 9: Algorithms / scheduling / rasterization / topology等
- Section 10: 性能検証基準
- Section 11: 実装順序

後続技術都合で本章UXを暗黙に劣化させない。成立しない仕様が判明した場合は本Source of Truthへ戻して明示改訂する。

以上をもってSection 5「各機能の詳細仕様」を確定・完了とする。
