# ILLUSTRO MASTER DESIGN

## 1. 製品の前提 — 確定

### 1.1 製品の最低基準
Illustroは、ユーザーが一枚絵を最初から完成まで制作できるペイント／イラスト制作アプリとする。

「一枚絵を完成させられること」を製品としての最低基準とし、単機能のスケッチツールや簡易お絵描きツールにはしない。

### 1.2 対象ユーザー
初心者から上級者までを対象とする。

初心者でも使い始められ、上級者にも制作上の不足を感じさせないことを目標とする。

### 1.3 対応端末・入力方式
スマートフォン、タブレット、PCを正式な対象とする。

入力方式は、ペン、タッチ、マウス、キーボードに対応する。

特定の端末種別だけを前提に製品全体を設計しない。

### 1.4 オンライン機能の位置づけ
Illustroの中心は一人で行うイラスト制作とする。

絵チャット／共同お絵描き機能も搭載対象とするが、本体の制作機能に対する副次的なオンライン機能として扱う。

通常のイラスト制作をクラウドサービスへの依存前提にはしない。

### 1.5 アカウント
通常の制作機能を利用するためにアカウントを必須としない。

アカウントは、絵チャットなど最低限のオンライン機能を利用するために必要となる場合に用いる。

### 1.6 クラウド保存
クラウド保存はIllustroの必須機能としない。

オンラインストレージを製品の成立条件にしない。

### 1.7 料金
Illustroはユーザーに対して完全無料で提供する。

ユーザーから利用料金、サブスクリプション料金、機能解放料金を取ることを前提としない。

オンライン機能についても、有料インフラへの恒常的な依存を前提としない。

### 1.8 機能規模の基準
機能面では、ibisPaintが備えるイラスト制作機能を一つの最低基準として捉え、その上でCLIP STUDIO PAINT等のより高度な制作アプリから有用な機能を追加していく方向とする。

具体的に採用する機能の一覧、優先順位、初期実装範囲は「2. 製品スコープ／機能一覧」で決定する。

高度な混色など、一部の高度機能を必須とするかどうかは製品スコープ決定時に個別判断する。

## 2. 製品スコープ／機能一覧 — 確定

### 2.0 この章の位置づけ

本章は、Illustroが製品として備える機能範囲を確定するための機能インベントリとする。

ここで「採用」とした機能は製品スコープに含める。ただし、個々の機能の詳細UI、細かなパラメータ既定値、内部データ構造、アルゴリズム、実装方式、互換精度、初期リリースでの実装順序は後続章で決定する。

大手アプリで成熟している機能については、CLIP STUDIO PAINT、ibisPaint、Photoshop、Procreate、Krita等の一般的な意味・操作体系と極力整合させる。Illustro独自機能は既存機能と混同せず、独自拡張として扱う。

### 2.0.1 明示的に製品スコープから外すもの

以下は現行設計では採用しない。

- 漫画・ページ作品向けのコマ割り、複数ページ、冊子・書籍制作機能。
- 素材マーケットプレイス、オンライン素材カタログ、素材配布エコシステムそのもの。
- 3D作成、3Dポーズ、3D参照機能。
- 複数ドキュメントを同時処理するバッチ制作機能。
- AI超解像、AI学習妨害、AI背景除去、AI水彩等のAI専用制作機能。
- スクリーントーン制作に特化した専用体系。
- 高度な物理水彩・顔料・流体シミュレーションを前提とする描画体系。通常のデジタル混色は採用する。
- Dual Brush。
- ベクターブラシ、ベクター消しゴム。通常のベクターパス・図形は採用する。
- Photoshop `.abr` 互換。
- 魚眼透視定規。
- アニメーション／複数フレーム制作機能。
- カメラ／スキャナー専用取り込みUI。
- 端末間ローカルファイル転送機能。
- 作業時間計測。
- アプリ内印刷UI。印刷向けデータ出力・色管理は採用する。
- BMP / TGA / PSB入出力。
- アプリ外画面を対象とする画面全体スポイト。
- 漫画背景風フィルター。
- Normal Map生成。
- ベクター線描き直し、線幅描き直し、中心線表示、線密度補正などの高度なベクター線補正。

---

### 2.1 ドキュメント / キャンバス

作品そのものの論理領域・寸法・色表現と、ユーザーが見る作業ビューを管理する。

- **新規ドキュメント作成**（新しい作品を指定条件で生成する）
  - 任意ピクセルサイズ（幅・高さをpx単位で自由指定する）
  - サイズプリセット（頻繁に使う寸法・縦横比・DPI等を再利用する）
  - DPI / 解像度情報（印刷時の物理寸法換算等に用いるメタデータ）
  - 背景色（新規作品の初期背景色）
  - 透明背景（背景をAlpha=0として開始する）
  - カラープロファイル（sRGB、Display-P3等、RGB値が意味する色空間）
  - 基本表現モード（内部保存方式は技術設計で別途決定する）
    - カラー（RGBカラー作品）
    - グレースケール（無彩色階調を基本表現とする）
    - 白黒 / モノクロ（二値表現を基本とする）
- **キャンバスサイズ変更**（描画内容の基本スケールを変えず作品領域を変更する）
- **画像サイズ変更**（作品内容を新しいピクセル寸法へ再サンプリングする）
- **リサンプリング**（画像サイズ変更時のピクセル再計算方式を選ぶ）
- **クロップ**（指定矩形を作品の表示・出力領域とする）
- **トリミング**（透明余白等の不要外周を削る）
- **キャンバス拡張**（作品領域を外側へ広げる）
- **キャンバス用紙 / 背景**（紙色やキャンバス背景表示を設定する）
- **作品水平反転**（実データを左右反転する）
- **作品垂直反転**（実データを上下反転する）
- **作品回転**（実データを回転する）
- **パン**（作品を変更せずViewport位置を移動する）
- **ズーム**（作品を変更せずViewport倍率を変える）
- **ビュー回転**（作品データを変更せず作業面のみ回転する）
- **ビュー回転リセット**（作業面を標準角度へ戻す）
- **ビュー回転状態保存**（現在の作業角度を保持する）
- **画面に合わせる**（キャンバス全体が表示領域へ収まる倍率にする）
- **100%表示**（原則として画像Pixelと表示Pixelを1:1で確認する）
- **ミラー表示**（作品自体を変更せず左右反転して形状確認する）
- **ピクセル表示**（補間を抑えPixel境界を確認しやすくする）
- **ビュー補間方式**（拡大・縮小表示時のPreview補間を指定する）
- **グリッド**（非描画格子を表示する）
  - 間隔（格子間隔）
  - 原点（格子基準位置）
  - 分割（主Grid内を細分化する）
  - 色（表示色）
  - スナップ（描画・配置等をGridへ吸着する）
- **ガイド**（水平・垂直等の非描画補助線）
- **透明領域表示**（Alpha=0部分を市松模様等で識別する）
- **印刷サイズ表示**（DPIと画面情報を使い物理サイズを確認する）
- **全画面 / キャンバス集中表示**（不要UIを一時的に隠す）
- **オーバースキャン・キャンバス【Illustro拡張】**（現在の作品枠外へ出た画像データを破棄せず保持する）
  - 枠外データ保持（Canvas Bounds外のPixel/Objectを削除しない）
  - 非破壊クロップ（Crop後も外側データを保持する）
  - 非破壊キャンバス縮小（Canvasを小さくしても隠れた内容を保持する）
  - 再拡張復元（後から領域を広げると隠れていた内容を再表示する）
- **フレーム・バリアント【Illustro拡張】**（同じ原画上に複数の非破壊出力フレームを保存する）
  - フレーム追加
  - 任意縦横比
  - フレーム移動 / サイズ変更
  - 名前付け
  - 出力連携（各FrameをExport Recipeへ渡す）
- **ビュー・アンカー【Illustro拡張】**（よく確認するCanvas位置を名前付きViewportとして保存する）
  - 中心位置保存
  - 倍率保存
  - 回転保存
  - 名前付け
  - 瞬間移動

### 2.2 描画 / ブラシ

Raster Paintingに使用するStroke、Brush Tip、質感、混色、入力応答を管理する。

- ラスターブラシ（PixelへColor/Alphaを描画する基本Paint Tool）
- 消しゴム（Brush形状・Dynamicsを使いAlphaを減らす）
- 色伸ばし / 指（既存Pixelを周囲へ引き延ばし混ぜる）
- ぼかしブラシ（局所的にPixel差を平滑化する）
- 水彩系ブラシ（下地色との混色・水分量・色伸び等を持つ）
- **ブラシプリセット**（Brush設定一式を保存・管理する）
  - 作成、複製、名前変更、削除、検索、カテゴリ、お気に入り、ロック、リセット、Import、Export
- **太さ**（Strokeの基本Brush Diameter）
  - 現在値
  - 最小値
  - 最大値
- 不透明度（Brush Strokeの基本Alpha上限）
- ブラシ濃度（各Brush Tip自体のOpacity。Stroke全体の不透明度とは区別する）
- Flow / 塗布量（Stroke中にColorが継続的に堆積する量）
- パターン不透明度（Brush Pattern Alphaの作用量）
- ストローク単位の連続性（Pen Upを跨いでEffect状態を継続するかStrokeごとに区切るかを指定する）
- ブラシ合成モード（各Dabと既存CanvasをどのBlend演算で合成するか指定する）
- **ブラシ先端**（Strokeを構成するStamp Shape）
  - 円形先端
  - 画像先端
  - カスタム先端
  - 複数先端
  - 硬さ
  - 縦横比
  - 初期角度
  - 描画方向追従
  - 水平反転
  - 垂直反転
  - アンチエイリアス
- **Dab間隔**
  - 基本間隔
  - 間隔ランダム
- MSAA / 高品質エッジ（対応Brush RasterizationでMulti-sampling等を使いEdge品質を高める）
- **入り / 抜き**
  - 入り太さ
  - 抜き太さ
  - 入り不透明度
  - 抜き不透明度
  - 強制抜き
- **かすれ**
  - かすれ形状
  - かすれ強度
  - 入りかすれ
  - 中間かすれ
  - 抜きかすれ
  - かすれランダム
- **手ブレ補正**
  - リアルタイム補正
  - 描画後補正
  - 強度
- **テクスチャ / 紙質**
  - 素材
  - 強度
  - Scale
  - Rotation
  - Offset
  - 反転
  - 合成方式
- **ランダム / Jitter**
  - 位置ランダム
  - 太さランダム
  - 不透明度ランダム
  - 間隔ランダム
  - 回転ランダム
  - 色ランダム
- **散布 / スプレー**
  - 散布ON/OFF
  - 粒子サイズ
  - 絶対粒子サイズ
  - 粒子密度
  - 散布幅
  - 偏り
  - 粒子方向
- **ブラシタイプ**
  - 単色
  - カラーTip
  - 二色
  - 水彩 / 混色
- **水彩 / 混色パラメータ**
  - 混色
  - 水分量
  - 色延び
  - 透明色混合
- **Dynamics**（入力値をBrush Parameterへ連続Mappingする）
  - 筆圧 → 太さ
  - 筆圧 → 不透明度
  - 筆圧 → ぼかし / かすれ
  - 筆圧 → 濃度
  - 速度 → 太さ
  - 速度 → 不透明度
  - 速度 → ぼかし / かすれ
  - 傾き
  - ペン方向 / 回転
  - 描画方向
  - ランダム
  - 応答カーブ
- メインカラー / サブカラー（Brushが使うPrimary/Secondary Color）
- 色ゆらぎ（Stroke/DabごとにColor Componentsを変化させる）
- はみ出し防止（Reference/Selection等から求めた境界外への描画を制限する）
- 線画内描画（Lineart Boundary等で定義されたRegion内だけPaintする）
- **直前ストローク再編集【Illustro拡張】**（最近のStroke入力を一時保持し再Rasterizeする）
  - Brush変更
  - 太さ変更
  - 色変更
  - 不透明度変更
  - Dynamics変更
  - 補正変更
  - 入り抜き変更
- **ブラシ・モーフ【Illustro拡張】**（互換性のある2つのBrush Preset間でParameterを連続補間する）
  - Source A
  - Source B
  - 補間率
  - 非互換Parameter処理
- **継承型ブラシファミリー【Illustro拡張】**（共通Brush設定を親へ持たせ子Presetは差分だけ保持する）
  - 親Preset
  - 子Preset
  - Override
  - 継承状態表示
  - 親変更伝播

- **Region Constraint【Illustro拡張】**（Brush / Eraser / Blend等のStroke作用範囲をSelectionまたはLineart Stable Regionへ制約する共通能力）
  - None
  - Stroke-start Region
  - Selected Regions
  - Lineart Regions
  - Selection
  - Boundary Crossing Policy

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.2 -->
#### 2.2.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- legacy opacity accumulation termsをAccumulation Mode(Capped/Build-up) + Spacing Compensation(On/Off)へ整理。
- Opacity=Stroke-wide cap、Density=Dab local coverage、Flow=distance-normalized depositionを明記。
- Paint Load。
- Pigment Edge / Watercolor Edge。
- Airbrush Accumulation。
- Particle Size Mode Relative/Absolute。
- Texture Anchor Canvas/Stroke。
- Raster Coverage Mode Normal/Pixel-aligned。
- Preset Target Scope。
- Brush Studio。
- Test Pad / input simulator。
- Runtime Quick Override。
- Save Current Values as Preset Defaults。
- Curve Presets: Linear / Ease In / Ease Out / S / Reverse / Custom。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.2 -->


### 2.3 ペン / タッチ / 入力

Pen、Touch、Mouse、Keyboardを一貫した直接操作体系へ統合する。

- **ペン入力**
  - 筆圧
  - 傾き
  - 方位 / 回転
  - ホバー
  - ペンボタン
  - カーソル / Brush輪郭
- 全体筆圧補正（端末・Pen・ユーザーによるPressure特性を全Tool共通で補正する）
- Brush別筆圧Curve（Preset単位でResponseを調整する）
- Touch入力
- Mouse入力
- Keyboard入力
- パームリジェクション
- 入力所有権制御（同時Pen/Touch時にDrawing/Navigation担当を明確にする）
- Coalesced / Raw Input活用（対応環境の高頻度Pointer Sampleを取り込む）
- **ジェスチャー**
  - 2本指Undo
  - 3本指Redo
  - Pinch Zoom
  - Canvas Rotate
  - Pan
  - Quick Eyedropper
  - Gesture Binding
- Quick Eyedropper起動時間
- 手によるUI遮蔽回避【Illustro拡張】（利き手・Pen位置からPopupや値表示を隠れにくい位置へ出す）
- **入力役割プロファイル【Illustro拡張】**
  - 線画用
  - 塗り用
  - ユーザー定義
- ジェスチャー競合診断【Illustro拡張】（同じGesture/Buttonへの競合割当を検出する）

### 2.4 カラー

色を選択、取得、保存、比較、関連付けする。

- カラーホイール
- RGB入力
- HSV / HSB入力
- HEX入力
- Alpha
- メインカラー
- サブカラー
- 前の色
- 色履歴
- **パレット**
  - 複数Palette
  - 名前変更
  - 色追加 / 削除
  - 並べ替え
  - Palette並べ替え
  - Import
  - Export
- **スポイト**
  - 現在レイヤー（Active Layerのみを参照して採色する）
  - 統合表示（Visible Compositeの見た目から採色する）
  - 参考画像
  - Sampling範囲
  - 拡大Loupe
  - 現在色 / 取得予定色比較
  - 寄与Layer候補（Composite色へ寄与するLayer候補を示し、明示操作で移動可能にする）
- **グラデーション**
  - 線形
  - 放射
  - 色停止点
  - Alpha停止点
  - グラデーションレイヤー
  - 自由グラデーション
  - グラデーションマップ
- 混色パレット
- 中間色
- 類似色
- Color Match
- sRGB
- Display-P3
- **色関係ロック【Illustro拡張】**（複数色の相対関係を維持してPaletteを変更する）
  - 基準色
  - 色相差
  - 彩度差
  - 明度差
  - 追従更新
- **ライブ作品パレット【Illustro拡張】**（現在のArtworkから主要色を動的に抽出する）
  - Canvas
  - Layer
  - Selection
  - 使用頻度
- **色成分ロック【Illustro拡張】**
  - Hue Lock
  - Saturation Lock
  - Lightness / Value Lock

- **相対色適用【Illustro拡張】**（固定色ではなくReference Colorに対するHue / Chroma / Lightness等の相対変化として色を生成し、Brush / Fill等から共有利用する）
  - Relative Shade
  - Relative Light
  - Custom Relative Relation
  - Reference Color Source

### 2.5 レイヤー / 合成

Artworkを独立要素へ分割し、階層、Mask、Effect、Composite関係を管理する。

- ラスターレイヤー
- ベクター / パスレイヤー
- フォルダー
- 塗りレイヤー
- グラデーションレイヤー
- **非破壊調整レイヤー**
  - 色調補正（Levels、Curve等）
  - 対応Filter Effect
- 画像素材レイヤー
- 選択レイヤー / 保存選択
- **レイヤーマスク**
  - 白（表示）
  - 黒（非表示）
  - Gray（部分表示）
  - Invert
  - Link / Unlink
  - 独立移動
  - 独立変形
  - Feather
- クリッピング
- 透明ピクセルロック
- 参照レイヤー
- 下描き / 草稿属性
- 外部参照ファイルオブジェクト（元FileへのLinkを保持し、元File更新をArtworkへ反映できるObject）
- 埋め込みオブジェクト（Source DataをProject内部に保持し、元Pixelを直接破壊せずTransform等する）
- レイヤーカンプ
- 複数レイヤー選択
- Layer Search
- Layer Filter
- **Layer整理**
  - 空Layer検出
  - 非表示Layer検出
- Layer作成
- Layer複製
- Layer削除
- Layer名前変更
- Layer並べ替え
- 表示 / 非表示
- Layer不透明度
- Layer Lock
- Layer Clear
- 下へ統合
- 選択Layer統合
- 表示状態を統合コピー
- 下レイヤーへ転写
- Rasterize
- 水平 / 垂直反転
- Layer単体画像Export
- Folder Pass-through
- 定規関連付け
- Raster → Vector変換
- **Layer Property Effect**
  - 境界線
    - 色
    - 幅
  - 水彩境界
  - Layer Color
  - Texture Effect
- **合成モード**（上位Layerと下位CompositeをBlend式で合成する）
  - 通常
  - 比較（暗）
  - 乗算
  - 焼き込み
  - 比較（明）
  - Screen
  - 覆い焼き
  - Add
  - Overlay
  - Soft Light
  - Hard Light
  - Vivid Light
  - Linear Light
  - Pin Light
  - Hard Mix
  - Difference
  - Exclusion
  - Subtract
  - Divide
  - Hue
  - Saturation
  - Color
  - Luminosity
- **レイヤー役割【Illustro拡張】**（Layerへ意味的Roleを付与し他Toolが名前ではなくRoleで参照できるようにする）
  - 線画
  - ベース色
  - 影
  - Highlight
  - 背景
  - Reference
  - User-defined
- **フォーカスセット【Illustro拡張】**
  - Set登録
  - 一時Solo
  - 完全復元
- **影響関係ビュー【Illustro拡張】**
  - Mask
  - Clipping
  - Adjustment
  - Reference
  - Object Link

### 2.6 選択 / マスク

画像の一部分を一時または永続的な編集対象として定義する。

- 一時選択
- 投げ縄選択
- 矩形選択
- 楕円選択
- 多角形選択
- 自動選択 / Magic Wand
- 色域選択
- ブラシ選択
- 選択消しゴム
- 定規への選択スナップ
- 定規から選択範囲作成
- 新規
- 追加
- 減算
- 交差
- 選択解除
- 反転
- 拡張
- 縮小
- Feather
- Selection Border / Outline
- Quick Mask（一時SelectionをMask OverlayとしてBrush編集するモード）
- 保存選択 / Selection Layer（Selection Dataを永続保存して再利用する）
- Alpha → Selection
- Selection → Layer Mask
- Layer Mask → Selection
- Selection対象Transform
- Selection対象Filter
- Selection対象Fill
- Cut
- Copy
- Paste
- 選択履歴（最近使用したSelectionを自動保持する）
- 任意Selection固定（履歴から重要Selectionを保存対象へ昇格する）
- **投げ縄確定前編集【Illustro拡張】**
  - 即時確定（通常はRelease時に直ちに確定する）
  - Handle修正（必要時のみ微修正する）
- **選択レシピ【Illustro拡張】**（Selection結果ではなく生成手順を再実行可能に保存する）
  - Source
  - Add / Subtract / Intersect
  - Expand / Contract
  - Feather
  - Live Rebuild

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.6 -->
#### 2.6.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- continuous 0-100% Coverage canonical。
- Magnetic Selection。
- Enclose Selection。
- Selection Display: Outline / Mask Overlay / Hidden。
- Move Selection。
- Smooth Selection。
- Refine Path。
- Recent Selection Registry。
- Saved Selection stable ID。
- Layer Alpha <-> Selection/Mask continuous conversion。
- Selection Recipe Apply Frozen / Bind Live / Freeze / Rebind / Unbind。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.6 -->


### 2.7 塗りつぶし / 領域処理

閉領域や類似色領域を解析してColor、Selection、Transparencyを一括適用する。

- バケツ塗り
- 許容値
- 塗り残し認識
- **境界判定方式**
  - Color
  - Opacity
- すき間認識
- すき間閉じ
- 境界拡張
- 境界縮小
- 線の下への拡張
- 連続塗り
- Swipe Fill
- 透明 / 消去塗り
- 囲って塗る
- 囲って消す
- 隙間塗りペン
- 閉領域塗り
- 等高線塗り
- **Reference Source**
  - Current Layer
  - Reference Layer
  - Visible Composite
  - Lineart Boundary
- Color Drag → Fill
- Live Tolerance
- **永続領域塗り【Illustro拡張】**（Stable Region IDへColor Assignmentを関連付ける）
  - Region ID → Color
  - Lineart変更追従
  - Region再対応付け
  - Manual Override
- **塗り漏れ診断【Illustro拡張】**
  - Leak Path
  - Gap Candidate
  - Canvas Overlay
- **領域スイープ【Illustro拡張】**
  - Add
  - Remove
  - Toggle
  - Backtrack Cancel
  - Live Preview
  - Release Commit

- **境界距離塗り【Illustro拡張】**（Resolved Region Boundaryからの距離に応じてColor / Opacity等を変化させるFill Style）
  - Inner Edge
  - Outer Edge
  - Both
  - Width / Falloff
  - Absolute / Relative Color Application

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.7 -->
#### 2.7.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- generic Strength削除、Application Opacity追加。
- Reference / Region Detection / Boundary Correction / Applicationの4段階。
- Sample Radius。
- Under-line Completion。
- Area Scaling Corner。
- Continuous Mode Any Touched / Match First。
- Backtrack Undo。
- Enclose interpretation Lasso Area / Closed Regions / Stable Regions。
- Enclose Region Match Any Inside / Fully Inside / Touched。
- Shared Region Resolver。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.7 -->


### 2.8 線画システム【Illustro独自】

Visible Lineartと独立した理想化Region Topologyを管理し、塗り・選択を安定化するIllustro中核システム。

- **Lineart Group**
  - 1 Layer
  - Multiple Layers
- Lineart Boundary Layer（作品には描画されないBoundary専用Data Layer）
- 理想化境界（Anti-alias PixelそのものではなくRegionを分ける論理Boundary）
- Boundary自動生成
- Endpoint認識
- 通常Node認識
- Junction認識
- **Gap Bridge自動生成**
  - 距離
  - 接線方向
  - 周辺Context
  - Confidence
- **Boundary手動編集**
  - Add
  - Connect
  - Remove
  - Split
  - Disconnect
  - Reject Auto Bridge
- No-Reconnect Constraint
- Auto / Manual Provenance
- Manual Override保持
- 複数Boundary参照
- Virtual Union Boundary
- **Boundary Preview**
  - Color
  - Opacity
  - Width
  - Show / Hide
- Fill連携
- Auto Select連携
- Enclose Fill連携
- Anti-overflow連携
- Under-line Fill
- Incremental Regeneration（Lineart変更周辺だけBoundaryを再解析する）
- Transform同期
- Liquify同期
- 境界信頼度ヒートマップ
- **Stable Region ID**
  - Region Identity
  - Shape Change Tracking
  - Split Detection
  - Merge Detection
  - Persistent Fill連携
- **Topology Diff**
  - New Region
  - Deleted Region
  - Split / Merge
  - Connection Change

- **Boundary Pen / Boundary Eraser【Illustro拡張】**（Lineart Group編集時に、作品へVisible Pixelを描かず論理BoundaryをBrush-like inputで追加 / 除去する）
- **Region Hint Pen【Illustro拡張】**（Lineart Group内で不可視のRegion membership hintを描き、曖昧なTopologyへRegion seed / extensionを与える）
  - New Region Hint
  - Add to Region
  - Erase Hint
  - Explicit Boundary Respect

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.8 -->
#### 2.8.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Ideal Boundary。
- Boundary Source toggle。
- Analysis Auto/Alpha/Luminance。
- Solid-area Handling Auto/Edge。
- Role Normal/Ignore。
- Auto Boundary Accepted/Candidate/Unresolved/Rejected。
- Accepted Gap Bridge / Manual Suppression / No-Reconnect。
- Boundary Pen endpoint snap / Boundary Eraser suppression。
- Region Hint。
- Leak Diagnostics integration。
- Region state Current/Updating/Ambiguous/Retired。
- Persistent Fill conflict/rebind。
- Pipeline: Visible Lineart Source -> Source Evidence -> Auto Boundary + Accepted Gap Bridge + Manual Boundary - Manual Suppression -> Ideal Boundary -> Region Topology -> Fill/Selection/Brush Constraint。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.8 -->


### 2.9 変形 / 配置

Layer、Selection、Objectの位置、Scale、Shape、Perspective等を変更する。

- Move
- Scale
- Rotate
- Free Transform
- Distort
- Skew
- Perspective Transform
- **Mesh Transform**
  - Grid Division
  - Smoothing
- Puppet Warp
- **Numeric Transform**
  - X
  - Y
  - Width
  - Height
  - Scale %
  - Angle
- Repeat X
- Repeat Y
- Mirror Repeat
- Repeat Phase
- **Resampling**
  - Nearest
  - Bilinear
  - Bicubic
  - Area
  - Lanczos 2
  - Lanczos 3
- **Transform対象**
  - Current Layer
  - Multiple Layers
  - Selection
  - Whole Canvas
- Align
- Distribute
- Smart Guides
- Snap
- Transform中Snap
- Non-destructive Transform
- **Transform Stack【Illustro拡張】**
  - Add
  - Reorder
  - Edit
  - Disable
  - Remove
- Transform Variant【Illustro拡張】
- **Persistent Layout Constraint【Illustro拡張】**
  - Center
  - Equal Spacing
  - Axis Alignment
  - Linked Position

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.9 -->
#### 2.9.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Target vocabulary: Current Target / Multiple Targets / Selected Content / Selection Shape / Whole Artwork。
- Pivot 3x3 locator。
- Positional / Angular / Pixel snapping。
- As Group / Individually。
- linked/unlinked Layer Mask transform behavior。
- Align/Distribute reference Canvas/Selection/Parent Group/Key Object。
- Transform Session local Undo/Redo。
- Transform Variant parameters-only。
- Transform Stack typed entry。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.9 -->


### 2.10 ベクター / 図形

Pixelではなく編集可能なPath / Geometryとして線・Shapeを扱う。

- Vector Layer
- Path
- Node
- Bézier Handle
- Corner / Smooth
- Stroke Color
- Stroke Width
- Simplify
- Join
- Shape Edit
- Vector Snap
- Line
- Curve
- Continuous Curve
- Rectangle
- Rounded Rectangle
- Ellipse / Circle
- Regular Polygon
- Polyline
- Bézier Shape
- Fill
- Stroke
- Post-edit
- Smart Shape（手描き→Hold等から認識した幾何Shapeへ補正する）
- SVG Import / Export
- **Geometric Constraints【Illustro拡張】**
  - Parallel
  - Perpendicular
  - Tangent
  - Equal Length
  - Equal Radius
  - Symmetry
- **Parametric Shape【Illustro拡張】**
  - Vertex Count
  - Radius
  - Inner Radius
  - Corner Radius
  - Rotation
- **Linked Shape【Illustro拡張】**
  - Geometry共有
  - Color Override
  - Transform Override

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.10 -->
#### 2.10.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Parametric Shape / Path Shape / Compound Shape。
- Object Edit / Node Edit。
- Corner / Smooth / Symmetric nodes。
- Open/Closed explicit。
- Fill Rule Non-zero/Even-odd。
- Stroke Alignment/Cap/Join/Miter/Dash/Dash Offset。
- Boolean Union/Subtract/Intersect/Exclude + Boolean Compound + Operand Edit。
- Convert to Path / Direct Segment Drag / Smart Shape hold candidate / Linked Shape Make Unique。
- SVG unsupported appearance report。
- vector brush / vector eraser / variable-width vector brushは除外維持。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.10 -->


### 2.11 定規 / 描画補助

Brush / Geometryを特定の幾何条件へSnapさせ、正確な線を描く。

- Straight Ruler
- Curve Ruler
- Shape Ruler
- Ruler Pen
- Guide
- Parallel Line
- Parallel Curve
- Multiple Curve
- Circle / Ellipse Ruler
- Radial Line
- Radial Curve
- Concentric Circle
- Symmetry Ruler
- Kaleidoscope
- Array Ruler
- Perspective Array Ruler
- One-point Perspective
- Two-point Perspective
- Three-point Perspective
- Ruler Snap ON/OFF
- Ruler Position
- Ruler Angle
- Ruler Center
- Ruler Phase
- 線からPerspective Ruler生成【Illustro拡張】（既存画像上の複数線からVanishing Pointを推定する）
- 領域限定アシスト（指定Canvas領域内だけAssistant/Rulerを有効にする）
- 位置 / LayerによるAssistant Set切替【Illustro拡張】（Canvas位置やActive Layerに応じて指定Ruler Setを切り替える）

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.11 -->
#### 2.11.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Guide / Stroke Constraint / Replicationの3能力分離。
- per-assistant Visible/Stroke Assist/Object Snap/Locked。
- multiple assistants coexist。
- per-stroke Assistant Lock。
- Capture Range。
- Named Assistant Set。
- Temporary Assist Bypass。
- Solo Assistant candidate。
- Perspective Grid XY/YZ/XZ。
- Offscreen VP indicator。
- Perspective from Lines。
- Return-to-start Re-arm。
- Symmetry replication semantics。
- Array Assist / Perspective Array。
- Layer-linked / Position-linked set + priority。
- Region-limited scope。
- fish-eye/curvilinear perspective除外維持。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.11 -->


### 2.12 ゆがみ / 特殊描画 / 修正

通常Brush・Transform外の局所修正、複製、Cleanup操作を提供する。

- Liquify Push
- Liquify Pinch
- Liquify Expand
- Liquify Smooth
- Liquify Reconstruct
- Local Warp
- Lasso Paint
- Lasso Erase
- Clone / Copy Pen
- Smudge
- Local Blur
- Dust Removal
- Dust Selection
- Fill Leftover
- Smart Smoothing
- Non-destructive Displacement Field【Illustro拡張】（Liquify結果をPixelへ焼き付けず変位場として保持する）
- Reconstruct【Illustro拡張】（非破壊変位をBrush範囲だけ元へ戻す）
- **Warp Guard【Illustro拡張】**（Maskで変形許容量を制御する）
  - Free
  - Partial
  - Protected

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.12 -->
#### 2.12.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Core: Push / Side Push / Pinch / Expand / Twirl / Smooth / Reconstruct。
- Invert Liquify Effect。
- Reconstruct reference Session Start / Modifier Base。
- Reset Modifier。
- Guard Protect/Unprotect。
- Selection+Guard eligibility。
- linked mask modes。
- Clone Aligned/Non-aligned。
- Dust Candidate Review。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.12 -->


### 2.13 フィルター / 色調補正

画像の色、周波数、形状、質感を処理する。

- 明るさ / コントラスト
- Levels
- Tone Curve
- Hue / Saturation / Lightness
- Color Balance
- Grayscale
- Threshold / Binarize
- Posterize
- Invert
- Gradient Map
- Color Replace
- Drawing Color Change
- Line Extraction
- Edge Detection
- Gaussian Blur
- Motion Blur
- Zoom Blur
- Radial / Rotation Blur
- Lens Blur
- Mosaic
- Pixelate
- Sharpen
- Unsharp Mask
- Outline
- Inner Glow
- Outer Glow
- Bevel
- Emboss
- Drop Shadow
- Satin
- Wet / Watercolor Edge
- Bloom
- Cross Filter
- Light Rays
- Noise
- Procedural Noise
- JPEG Artifact Reduction
- Frosted Glass
- Stained Glass
- Pointillize / Dot
- Illustration Style
- Pencil Style
- Film Style
- Retro Game
- Glitch
- Chromatic Aberration
- Procedural Noise Generator（Cloud preset）
- Linear Gradient Generator
- Radial Gradient Generator
- Concentric Gradient Generator
- Radial Line Generator
- Speed Line Generator
- Bloat / Bulge
- Sphere / Lens Distortion
- Wave
- Ripple
- Twirl
- Polar Coordinates
- Shear
- Distortion Correction
- Panorama Transform
- Extrude
- Effect Recipe【Illustro拡張】（複数EffectとParameterを再利用可能な処理Presetとして保存する）
- Canvas Effect Anchor【Illustro拡張】（Effect中心・Angle・Radius等をCanvas上で直接操作する）
- **Parameter Sweep【Illustro拡張】**（複数Parameter候補を同時Previewして比較する）
  - Candidate Grid
  - Select
  - Fine Tune

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.13 -->
#### 2.13.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

RENAME: JPEG Artifact Reduction / Procedural Noise Generator / Cloud preset。
RECLASSIFY: Extrude -> Stylize。
ADD classes: Adjustment / Spatial Filter / Geometric Effect / Generator。
ADD common: Effect Mix / Effect Mask / Effect Group / Owner-attached Effect / Stack Effect / Before-After Compare / Canvas Effect Anchor / Effect Preset / Effect Recipe / stable seed / Spatial Edge Behavior。
Stylize: Mosaic / Pixelate / Emboss / Bevel / Inner Glow / Outer Glow / Drop Shadow / Satin / Wet Edge / Frosted Glass / Stained Glass / Pointillize / Extrude。
Lighting: Bloom / Cross Filter / Light Rays。
Noise/Repair: Add Noise / JPEG Artifact Reduction。
Generators: Procedural Noise + Cloud preset / Linear / Radial / Concentric Gradient / Radial Line / Speed Line。
Geometric: Bloat / Sphere / Lens Distortion / Wave / Ripple / Twirl / Polar / nonlinear Shear / Distortion Correction / Panorama Transform。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.13 -->


### 2.14 非破壊編集

元Dataを直接破壊せず、後から変更、無効化、比較できる編集方式を統合する。

- Non-destructive Adjustment Layer
- Non-destructive Filter
- Filter Mask
- Effect ON/OFF
- Effect Reorder
- Parameter Re-edit
- Effect Mask
- Multiple Layer Apply
- Shared Modifier Node【Illustro拡張】（1つのEffect Definitionを複数Layerから参照する）
- Parameter Link【Illustro拡張】（離れたEffect Parameterを同期する）
- Effect Variant【Illustro拡張】（複数Effect案を保持しA/B比較する）

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.14 -->
#### 2.14.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Modifier Definition/Application separation。
- Effect Mix / Effect Group。
- Make Independent / Share Definition / typed Parameter Link。
- Replace Source / Replace Content。
- Rebind / Freeze Last Valid Result / Remove Modifier。
- Bake This / Group / Chain / Bake Copy / Bake & Replace。
- same-document sharing semantics / cross-document clone semantics。
- Adjustment/Filter/Layer StyleをEffect Modifier体系へ統合。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.14 -->


### 2.15 テキスト

文字を編集可能なText Objectとして扱う。

- Editable Text Layer
- Point Text
- Box Text
- Horizontal Writing
- Vertical Writing
- Font Selection
- Font File Import
- Font Size
- Bold
- Italic
- Other Font Styles
- Left Align
- Center Align
- Right Align
- Character Spacing
- Line Spacing
- Text Outline
- Text Style Preset
- Character / Symbol Picker
- Ruby
- Inline Editing
- Non-destructive Text Transform
- PSD Text Compatibility（Photoshop Text Layerとの編集可能な互換を目標とするが、対応範囲は互換性設計で確定する）
- Linked Text Style【Illustro拡張】（複数Text Objectが同一Style Definitionを共有する）
- Live Text Boundary【Illustro拡張】（Text Glyph輪郭をRasterizeせずSelection/Fill/Boundary参照に使う）
- **Auto Fit【Illustro拡張】**
  - Font Size
  - Character Spacing
  - Line Spacing
  - Box Resize

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.15 -->
#### 2.15.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Auto Width / Auto Height / Fixed Frame / Text Overflow。
- Mixed Style / Variable Font / OpenType / Missing Glyph fallback。
- Tate-chu-yoko。
- Text on Path / Circular Text / Text inside Shape。
- Convert Text to Path / Rasterize Text Copy/Replace。
- Requested Font vs Resolved Fallback。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.15 -->


### 2.16 参考画像 / 制作補助

Artworkを変更せず観察、比較、Navigationを補助する。

- Sub View
- Multiple References
- Add
- Remove
- Reorder
- Replace
- Reference Pan
- Reference Zoom
- Reference Rotate
- Reference Reset
- State Persistence
- Reference Eyedropper
- Navigator
- **Reference Lens【Illustro拡張】**
  - Grayscale
  - Blur
  - Horizontal Flip
  - Desaturate
  - Edge Emphasis
  - Value Only
- **Canvas ↔ Reference Anchor【Illustro拡張】**
  - Anchor Points
  - Sync Pan
  - Sync Zoom
- Reference Set【Illustro拡張】（用途別Reference群を保存する）

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.16 -->
#### 2.16.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Embedded / Linked / Live Canvas Reference。
- Clipboard Reference / Missing cached preview / multiple PiP。
- Value Lens / Saturation / Named Anchor / Reference Set view state / Live Canvas Reference。
- Reference Lens listをValue/Blur/Edge Emphasis/Saturationへ整理しFlipをView Transformへ移す。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.16 -->


### 2.17 履歴 / 自動化

編集履歴を戻す、分岐する、再利用する。

- Undo
- Redo
- History List
- 任意地点Preview
- 任意地点Restore
- Operation-level Recovery State
- **Auto Action**
  - Record
  - Play
  - Save
  - Import
  - Export
- **Timelapse**
  - History Playback
  - Video Export
- **Branching History【Illustro拡張】**（Undo後の旧Redo経路を捨てずBranchとして保持する）
  - Branch Create
  - Branch Switch
  - Branch Compare
  - Branch Merge Policy
- **History Search【Illustro拡張】**
  - Layer
  - Tool
  - Command
  - Effect
- **Named Checkpoint【Illustro拡張】**
  - Name
  - Jump
  - Compare

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.17 -->
#### 2.17.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- History Preview read-only / Continue From Here / Apply Changes From Branch。
- persistent Checkpoint。
- Auto Action typed inputs / Target Current-Named-Step Output。
- Repeat Last / Repeat With。
- Timelapse Pause / branch-aware Timelapse / atomic Action default。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.17 -->


### 2.18 ファイル / プロジェクト管理

作品のLocal保存、Recovery、互換入出力を扱う。

- Local Gallery / Project Library
- Search
- Sort
- Folder / Collection
- Duplicate
- Rename
- Recently Deleted
- Autosave
- Crash Recovery
- Native `.illustro`（Illustro全編集構造を保持するNative Format）
- PNG
- Transparent PNG
- JPEG
- TIFF
- PSD（対応可能なLayer / Mask等をPhotoshop形式と交換する）
- SVG
- ibisPaint Brush Import
- ibisPaint Brush QR Import
- CSP `.sut` Import
- Illustro Brush Format
- ibisPaint Project Compatibility（直接または変換Importの対応範囲は互換性設計で確定する）
- OS Share
- **Copy-on-Write Project Variant【Illustro拡張】**
  - Shared Base
  - Changed Tiles
  - Changed Layers
  - Lightweight Variant
- **Project Health Check【Illustro拡張】**
  - Missing Font
  - Missing Linked File
  - PSD Compatibility
  - Color Profile
  - Excessive Resource
  - Export Loss
- **描きながらExport【Illustro拡張】**
  - Snapshot
  - Background Processing
  - Continue Editing

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.18 -->
#### 2.18.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- New Document即Local Project。
- Save Now / Save Project Copy / Portable Project Copy。
- Open Read-only / single writable session。
- Import route New Project / Place as Layer / Add Reference / Register Material。
- Project HealthとExport Preflight分離。
- Variant Compare。
- DuplicateとVariantの意味分離。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.18 -->


### 2.19 ワークスペース / 操作環境

機能へのアクセス方法、Panel配置、Shortcutをユーザー環境へ最適化する。

- Keyboard Shortcuts
- Stylus Button Binding
- Tool Group Customization
- Toolbar Customization
- Quick Access
- Quick Access Customization
- Command Bar
- Selection Launcher
- Selection Launcher Customization
- Tool Properties
- Detail Settings
- Tool Slider
- UI Theme
- Menu / Title UI Hide
- Workspace Save
- Workspace Switch
- Workspace Reset
- Resizable Tool Rail
- Resizable Inspector
- **Dockable Inspector / PiP【Illustro独自】**
  - Block Reorder（Dock内順序変更）
  - Drag-out Detach（直接DragしてFloating化）
  - Floating PiP（独立Panel表示）
  - Move（PiP位置変更）
  - Resize（PiP Size変更）
  - Inspector Collapse Independence（Main Inspectorを閉じてもPiPを保持）
  - Magnetic Redock（Dock候補へ吸着して戻す）
  - Close = Redock（×は破棄ではなく元Dockへ戻す）
- **Quick Hole Controller【Illustro独自】**（Canvas-localなRing状Quick Command Surface）
  - 6 Slots
  - Full Remap
  - Canvas Anchor
  - UI InteractionではAnchor維持
  - Hide While Drawing
  - Temporary Dismiss
  - Scale
  - Radius
  - Button Size
  - Opacity
- Task-linked Workspace【Illustro拡張】（作業工程とWorkspace Presetを任意関連付けする）
- Spring-loaded Panel【Illustro拡張】（Shortcut等を押している間だけPanelを表示する）
- **Reachability Workspace【Illustro拡張】**
  - Left-handed
  - Right-handed
  - Mirror Layout

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.19 -->
#### 2.19.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Workspace DefinitionにTool Rail/Quick Access/Quick Hole mapping/Properties/Panels/PiP/Device Layout Variants Desktop-Tablet-Phone。
- Density defaultはDevice Profile、Workspace OverrideはInherit/Compact/Comfortable/Touch。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.19 -->


### 2.20 共通インタラクションシステム【Illustro独自】

Toolごとの操作差を減らし、同じ意味の操作を同じ方法で扱うIllustro全体規約。

- Direct（最も高頻度な操作をCanvas上で直接行う）
- Quick（高頻度Parameterだけ近距離UIで調整する）
- Detail（詳細設定Panelで全Parameterを編集する）
- Canonical Parameter State（Slider、Canvas Handle、数値入力等が同じParameter状態を共有する）
- Adaptive Scalar（値域に応じて操作Sensitivityを変える）
- Fine Adjustment
- Touch Perpendicular Fine Control（Slider Trackから垂直方向へ指を離すほどGainを下げる等の精密操作）
- Saved Parameter Marks（頻用値をParameter上へBookmarkする）
- Exact Numeric Input
- **Relative Numeric Input**
  - `+N`
  - `-N`
  - `×N`
  - `÷N`
- Unit-aware Input（px、%、deg等の単位を解釈する）
- Semantic Picker
- Thumbnail Asset Picker
- Searchable Long List
- Canvas Direct Manipulation
- Color Drag → Fill
- Eyedropper Preview
- Gradient Direct Editing
- Selection Launcher
- Fill / Auto Select Live Tolerance
- Quick Mask Direct Editing
- Smart Shape Direct Correction
- **Preview → Commit規約**（直接操作をPreviewとCanonical確定に分離する）
  - Begin
  - Live Preview
  - Commit
  - Cancel
- Spring-loaded Tool（押している間だけToolを一時切替する）
- Continuous Transaction（Canvas / Inspector / 数値入力を跨いでも同一論理操作を1 Undo単位にする）

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.20 -->
#### 2.20.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Disabled+Reason / Mixed Values / Pointer Capture / screen-space hit target / document-space geometry / one Canonical Parameter / destructive confirmation policy。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.20 -->


### 2.21 オンライン / 共同制作

通常制作とは分離された副次機能として複数人Drawingを提供する。

- 絵チャット
- Real-time Collaboration
- Room
- Session
- Participant Management
- Online-only Account（共同機能に必要な場合のみIdentityを使い、本体制作には必須としない）
- **Shared Production State【Illustro拡張】**
  - Palette
  - Reference
  - Lineart Boundary
  - Ruler
  - Selection
- Private Layer（自分だけが見える作業Layer）
- Shared Layer（参加者が共有するLayer）
- Private → Shared
- Follow View（他参加者のViewportへ一時追従する）

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.21 -->
#### 2.21.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Owner / Editor / Viewer。
- Share Live / Send Copy。
- Collaboration Undo = Undo My Last Eligible Change。
- Synced / Syncing / Offline / Conflict。
- local-first visibility / explicit structural conflict。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.21 -->


### 2.22 素材 / リソース

制作で再利用する画像、Texture、Pattern、Brush AssetをLocal中心で管理する。素材マーケットプレイスは含めない。

- Image Material
- Texture
- Pattern
- Brush Tip
- Stamp
- Gradient Material
- User Material
- Canvasから素材登録
- Selectionから素材登録
- Material Type Classification
- Category
- Tag
- Search
- Sort
- Material History
- Favorite
- Thumbnail Preview
- Material Move
- Material Scale
- Material Rotate
- Material Tiling
- Image Material Layer Conversion
- Material Import
- Material Export
- **Smart Material【Illustro拡張】**
  - Color
  - Scale
  - Rotation
  - Density
  - Randomness
- **Procedural Material【Illustro拡張】**
  - Dot
  - Stripe
  - Grid
  - Noise
  - Cloud
  - Paper
- **Seamless Material Builder【Illustro拡張】**
  - Wrap Preview
  - Seam Detection
  - Seam Editing
  - Register

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.22 -->
#### 2.22.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- Resource: Brush Tip / Texture / Pattern / Gradient / Stamp。
- Material: Image / User / Smart / Procedural。
- Scope Built-in/User Library/Project Resource/Imported Pack。
- Project Resource Capture。
- Place as Material Object / Place as Pixels。
- Illustro Asset Pack。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.22 -->


### 2.23 設定 / 環境設定 / アクセシビリティ

ユーザー、端末ごとのアプリ挙動を永続設定する。

- General
- Pen
- Pressure Calibration
- Pen Buttons
- Touch
- Gesture
- Mouse
- Keyboard
- Shortcuts
- Quick Eyedropper
- Canvas Rotation
- Zoom Interpolation
- Canvas-relative Brush Size
- State Persistence
- UI Theme
- Workspace
- Tool Layout
- Font Management
- Accessibility
- Settings Backup
- Settings Restore
- Reset to Defaults
- **Device Profile【Illustro拡張】**
  - Desktop
  - Tablet
  - Phone
  - User-defined
- 「この挙動の設定」【Illustro拡張】（現在操作中のControlから関連Preferenceへ直接移動する）
- **Settings Trial Mode【Illustro拡張】**
  - Temporary Apply
  - Commit
  - Revert All

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.23 -->
#### 2.23.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- ownership Global User / Device Profile / Workspace / Document。
- Device Pressure Calibration pipeline。
- Safe Revert / Settings Search current value+path / configurable hold+gesture timing / cursor+handle visibility。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.23 -->


### 2.24 出力 / カラーマネジメント

完成作品を目的別Format・Color Spaceへ検証、変換して書き出す。通常制作はRGBを中心とし、CMYKは主としてSoft Proof / Profile変換 / 対応形式への出力で扱う。

- Document Color Profile
- ICC Profile
- Profile Assignment（Color数値を変えず解釈Profileを変更する）
- Profile Conversion（見た目を保つ方向でColor値を別Profileへ変換する）
- **Rendering Intent**
  - Perceptual
  - Relative Colorimetric
  - Absolute Colorimetric
  - Saturation
- Soft Proof
- Gamut Warning
- CMYK Preview
- Print-size Preview
- RGB Export
- CMYK Export
- Grayscale Export
- Monochrome / 1bit Export
- **Export Recipe【Illustro拡張】**
  - Format
  - Dimensions
  - Frame Variant
  - Color Profile
  - Bit Depth
  - Metadata
  - Naming
  - Named Preset
- **Multi-target Export【Illustro拡張】**
  - SNS
  - Thumbnail
  - High Resolution
  - Print
  - Backup
- **Export Preflight【Illustro拡張】**
  - Resolution
  - Gamut
  - Profile
  - Transparency
  - Unsupported Layer Structure
  - Missing Font
  - File Size Estimate
- **Proof Compare【Illustro拡張】**
  - sRGB
  - Display-P3
  - CMYK
  - Synchronized View

<!-- ILLUSTRO-V2-FULL:INVENTORY:2.24 -->
#### 2.24.1 Section 5統合による機能Inventory同期

本項はこの節の既存記述を保持したまま、Section 5で確定した機能Inventoryを同期する。同節内の旧表記と直接矛盾する場合は、本項のCanonical名称・分類・意味を優先する。

- per-view Soft Proof。
- Black Point Compensation where applicable。
- Simulate Paper White/Black where supported。
- accessible Gamut Warning pattern。
- Export Profile Conversion does not mutate Document Profile。
- Embed Profile default where supported。
- privacy-safe metadata default。
- Naming Tokens。
- Preflight Fix routes。
<!-- /ILLUSTRO-V2-FULL:INVENTORY:2.24 -->


### 2.25 Section 2 完了条件

本章の目的は「Illustroが製品として何を備えるか」を確定することである。

上記24系統の機能群と明示的除外事項をもって、製品スコープ／機能一覧の決定を完了とする。

今後、各機能の具体的な挙動を詰める際に、実現不可能性や大手アプリとの仕様整合、性能要件との衝突が判明した場合は、勝手に削除せず設計判断として本章へ戻って改訂する。

次章では、これらの機能を支える「基本概念・データモデル」を定義する。

## 3. 基本概念・データモデル — 確定

### 3.0 この章の位置づけと最上位原則

本章は、Section 2で確定した機能群を共通の概念・状態モデルで成立させるための基礎設計を定義する。UIの最終配置、保存形式の物理構造、GPU API、具体的なTile / Chunk構成、Scheduler、Cache Eviction、Stable Prefix / Bounded Mutable Tail等の具体Algorithmは後続章で確定する。

Section 3の最上位判断基準は、内部モデルの美しさではなく、ユーザー体験、一貫した意味、直接操作の体感0ラグである。

Canonical Data ModelとRealtime Runtime Modelは同一の物理構造である必要はない。ただし意味論は一致しなければならない。Interaction中だけTransient Mutable Stateを許可し、Commit時には変更Working SetをLogical Canonical Revisionへ原子的に採用する。Commit後に遅延してよいのはCanonical化そのものではなく、Persistence、Recovery補助、Derived Data更新、Indexing、Collaboration送信、Maintenance等である。

直接操作の基準経路は概念上、次とする。

```text
Idle / Hover
  ↓
Prepared Interaction Context
  ↓
Input
  ↓
Resolved Runtime Context
  ↓
Minimum Necessary Exact Computation
  ↓
Retained Interactive State
  ↓
Visible Result
  ↓
Atomic Logical Commit / Cancel
```

以下をSection 3共通の不変条件とする。

1. Pointer Sample / DabごとにProject、Visual Tree、Dependency Graph、History全体を走査しない。
2. Pointer Downを重いContext構築の開始点にしない。高頻度Toolでは可能な範囲で事前解決したPrepared Contextを利用する。
3. Pointer Up / ReleaseをCanvas全面Rasterize、全Document Composite、History Serialization、Persistence等の重処理開始点にし、その完了を表示や次操作開始の条件にしない。
4. Commit / Cancelの必須処理をCanvas面積、総Layer数、History長、Dependency Graph規模、総Instance数へ比例させない。原則として今回変更したWorking Set / Bounded Workに比例させる。
5. Interactive StateはFake Previewではなく、その場で継続操作できる第一級の作業状態とする。
6. Logical Commit済みの変更は直後のInteractionから必ず観測可能とする。Commit済み結果をPending Overlayとして意味的に保留しない。
7. Active / Visible / Next-needed Dataを優先し、非表示・画面外・未使用Derived DataはLazy評価を許可する。ただしLazy化によって次の直接操作へ大きな遅延を単純移送しない。
8. Dependency、History、Persistence、Boundary / Region、Source propagation等の高度機能をBrush、Lasso、Transform等の直接操作Latency悪化の当然の理由にしない。
9. Background Work、Input backlog、Derived recomputation等を無制限Queueとして蓄積しない。Work種別ごとにCoalesce / Merge / Demand-driven化できる意味を持たせる。
10. Realtime PathとExport / Recovery等の別Pathは実装を共有する必要はないが、Brush、Blend、Selection Coverage、Mask、Modifier等のCanonical Semanticsは一致させる。

---

### 3.1 Project / Document / Canvas / View — 確定

#### 3.1.1 基本分離

IllustroではProject、Document、Document Space、Canvas Rect、Frame Variant、Viewを別概念とする。

- **Project**: `.illustro`として保存される作品パッケージ全体。Document、History、Branch、Checkpoint、埋め込みResource、Reference、Export設定、Recovery metadata等を収容できる。
- **Document**: 一枚の作品のCanonical Editable State。Layer構造、色空間、Canvas、Selection、非破壊編集状態等を所有する。
- **Document Space**: Artworkが存在できる共通の安定World Space。Canvas境界より広く存在できる。
- **Canvas Rect**: Document Space上の有限矩形。標準表示・標準Exportの基準領域。
- **Frame Variant**: Artworkを破壊せず保存する追加出力矩形。
- **View**: Pan、Zoom、Rotation、Mirror等のArtworkを変更しない表示状態。

基本関係は `1 Project : 1 Document` とする。UI上でProject / Documentの区別を常時意識させる必要はない。

#### 3.1.2 Canvas外Artwork

Document SpaceはCanvas Rectに制限されない。Layer、Object、Raster Content等はCanvas外にも存在でき、Canvas外へ移動しただけでは破棄しない。

Canvas縮小、非破壊Crop、Frame変更ではCanvas外Artworkを保持する。Canvas外Dataを削除する場合は明示的な破壊Commandとする。Canvas Size変更をArtwork Dataの破壊的Cropと同義にしない。

Canvas外を保持することは、Canvas外全域へ巨大な透明Rasterを常時割り当てることを意味しない。物理Storage方式はSection 8 / 9で決定する。

#### 3.1.3 Viewの独立

View TransformはArtwork Dataから分離する。Zoom、Pan、View Rotation、Mirrorを変更してもPixel座標、Layer位置、Selection Value、Mask、Export結果等のCanonical Artworkは変更しない。

View Stateは原則Artwork Undo / Redo対象に含めないが、作業状態としてProject metadataへ保存可能とする。

#### 3.1.4 Working Set

ProjectがDataを所有することと、起動時・操作時に全DataをLoad / Evaluateすることを同義にしない。

Active Document、Active Target、Current Viewport、Current Tool、現在必要なSelection / Mask / Source / Modifier等をWorking Setとして優先できる。Cold History、非表示Branch、未使用Reference、画面外Derived Data等は必要時にLoad / Resolve可能とする。

---

### 3.2 Coordinate Systems — 確定

#### 3.2.1 Document Space

Document Spaceを作品全体の唯一の安定World Spaceとする。

- 初期Canvas左上をDocument座標 `(0, 0)` とする。
- +Xは右、+Yは下とする。
- 単位はDocument Pixel相当とする。
- 整数だけでなく連続値・Subpixel座標を正式に許可する。
- Canvasを左・上へ拡張してもDocument原点や既存Artwork座標を移動しない。

例として初期Canvas `(0, 0, 4000, 3000)` を左へ500px拡張する場合、Canvas Rectを `(-500, 0, 4500, 3000)` とし、既存Artwork座標は維持する。

#### 3.2.2 Canvas / Frame

Canvasを別の恒久World Spaceにはしない。CanvasはDocument Space上のRectである。Canvas相対座標が必要な場合だけ派生値として求める。

Frame VariantもDocument Space上のRectとして扱う。

#### 3.2.3 Local Space

Layer、Object、Text、Vector、Material、Embedded Object、Lineart Group等は必要に応じてLocal Spaceを持つ。

```text
Local Space
  ↓ Owner Transform
Parent Space
  ↓
Document Space
```

Source Geometry / ContentとDocument上の配置Transformを分離する。具体Matrix表現や数値型はSection 8で決定する。

#### 3.2.4 Raster Pixel規約

Raster Pixel `(x, y)` は `[x, x+1) × [y, y+1)` の1×1セル、Pixel中心は `(x+0.5, y+0.5)` とする。

Stroke、Selection、Vector、Transform等を早期整数丸めしない。Rasterize時にCoverageへ変換することで、1px線、Vector→Raster、Selection Edge、Snap、Subpixel Transform等の0.5pxずれを避ける。

#### 3.2.5 View / Workspace / Device Space

```text
Document Space
  ↓ View Transform
Workspace / UI Space
  ↓ Device Scale
Device Pixel Space
```

- **Workspace / UI Space**: Tool Rail、Inspector、Floating PiP、Quick Hole、Popup、Selection Launcher等を配置する。
- **Device Pixel Space**: 最終表示端末の物理Pixel座標。

PiPやQuick HoleはWorkspace Spaceに存在し、Canvas Zoom / Rotationと一緒に回転・拡縮しない。Device Pixel値はCanonical Artworkへ保存しない。

#### 3.2.6 Input Mapping / Prepared Transform Context

Pen / Touch / Mouse入力はWorkspace側の位置とtimestamp、pressure、tilt、orientation、pointer type等の利用可能情報を保持する。

Artwork入力は原則、受信時点で対応するView Generationを用いてDocument / Owner Local Spaceへ解決し、過去SampleのArtwork座標が後続Pan / Zoomによって変化しないようにする。

Active Tool、Active Target、View、Selection等が変化した際、高頻度操作で必要なTransformやRuntime HandleをPrepared Interaction Contextとして事前解決可能とする。Pointer Down時はContext全再構築ではなくGeneration整合確認と必要差分のPatchを基本とする。

#### 3.2.7 Selection / Mask / Boundary / Ruler

- Active / Saved Selection Valueは原則Document Space上の意味を持つ。
- Selection Recipe SourceはOwner Local Space等をDynamic参照できる。
- Layer MaskはOwner Local Spaceを基本とし、Unlink時は独立Transformを持てる。
- Lineart Boundary / Stable Region topologyはLineart Group Local Spaceを基本とする。
- Global Ruler / GuideはDocument Spaceを基本とする。
- Layer-linked RulerはOwner Local Spaceへ関連付け可能とする。

#### 3.2.8 Collaboration

Canonical Collaboration Dataとして同期するArtwork座標はDocument Spaceまたは明示されたOwner Local Spaceとし、Screen / Workspace / Device依存座標をArtwork Dataとして同期しない。

---

### 3.3 Layer Tree / Node Model — 確定

#### 3.3.1 Visual Tree + Typed Relations

DocumentのContainmentとVisual Stack順はVisual Treeを基本とする。一方、Source sharing、Reference、Persistent relation、Parameter sharing、Constraint等の非親子関係はTyped Relation / Dependency Systemとして分離する。

日常的な見た目を理解するために巨大Dependency Graphの理解を必要とする設計は避ける。見た目を決める主要関係は可能な限りTree / Stack semanticsで理解可能にする。

#### 3.3.2 Common Node

Visual Tree上のNodeは少なくとも以下の概念を持つ。

- Identity
- Type
- Name
- Parent
- Sibling Order
- Visibility
- Lock State
- Local Transform
- Metadata

Tool capabilityはNode Type + Stateから導出しRuntime Cache可能とする。`canPaint`等の大量BooleanをCanonical Dataへ冗長に常設することを必須にしない。

#### 3.3.3 Content / Container

主なContent NodeにはRaster、Vector、Text、Fill、Gradient、Image Material、External / Embedded Object等を含む。

主なContainer NodeにはFolderとLineart Groupを含む。Lineart Groupは単なるFolderではなく、Visible Lineart ChildrenとBoundary topology / Stable Region関連Dataを所有する特殊Semantic Containerとする。

#### 3.3.4 Attachment

常に明確なOwnerへ付属するDataは普通のSibling Layerとして無理にVisual Stackへ置かずAttachmentとして扱える。

- Layer Mask
- Effect Mask
- Attached Modifier
- Lineart Boundary / Region Table等

UI上Layer Panelに表示する場合でも、内部Ownershipを曖昧にしない。

#### 3.3.5 Modifier / Visual Stack Participant

非破壊処理では少なくとも次を区別する。

- **Attached Modifier**: 特定Ownerへ付くAttachment。Ownerの内部処理順に参加する。
- **Stack Modifier**: Visual Stack位置によって下位Compositeへ作用するAdjustment等。Visual Stackへ参加する第一級EntityとしてStable ID、Parent、Sibling Order、Visibility / Lock等のStack上必要な状態を持ち、Attached Modifierとは区別する。
- **Shared Modifier**: Shared Definitionを複数Applicationが参照する。共有Definitionそのものと各Applicationの配置・Mask・Enabled state等を分離できる。

したがってVisual Stack ParticipantにはContent Node / Container Nodeに加えてStack Modifier Node / Entryを含められる。詳細なEffect semanticsは3.8で定義する。

#### 3.3.6 Auxiliary Registry

Compositeへ直接参加しないDataはVisual Treeへ無理に混在させず、Saved Selection、Global Ruler、Guide、Frame Variant等のRegistryとして管理可能とする。

#### 3.3.7 Composite Participation

Layer Panelに見えることとColor Compositeへ参加することを同義にしない。Raster、Vector、Text等は描画内容として参加し、Mask、Selection、Boundary、Ruler、Guide等は通常Color Compositeへ直接参加しない。

FolderはIsolated CompositeとPass-through Compositeをサポートする。

#### 3.3.8 Clipping

ClippingのCanonical UX Semanticsは成熟アプリ同様のLayer Stack / adjacency基準とする。連続したClipped Layer群とBase Layerの関係をLayer順から理解できることを優先する。

内部ではBase解決、Invalidation、Render preparation等のためにDerived Dependency / Runtime Cacheを持てるが、Layerを並べ替えても残り続ける不可視の永続Base tetherをClippingのCanonical意味にはしない。

#### 3.3.9 Role / Metadata

Lineart、Base Color、Shadow、Reference、Draft、Private / Shared等のRole / StateはNode Typeと分離する。

Semantic Roleは便利なDynamic Reference補助であり、Role未設定でも基本編集機能が成立することを要求する。

#### 3.3.10 Tree Invariants / Realtime

- Visual Treeの1 Nodeは同時に複数Parentを持たない。
- Visual Tree Cycleは禁止する。
- Source共有はReference / Instanceを使う。
- Dependency Cycle PolicyはRelation Typeごとに定義する。
- 通常Raster PaintingではActive Raster Runtimeへ直接到達可能とし、汎用Tree / Node traversalをDabごとの関所にしない。

---

### 3.4 Identity / Revision / Stable ID — 確定

#### 3.4.1 Identity、Revision、Transactionを分離する

Illustroでは次を明確に別概念とする。

- **Entity ID**: Layer、Object、Mask、Modifier、Source、Saved Selection等の論理Entityを永続識別する。
- **Entity Revision**: 同一Entityの特定時点のState / Content Version。
- **Document Logical Revision Root**: ある瞬間のDocument全体の正しい論理状態を不変に指すRoot。
- **Transaction ID**: ユーザーが1回のUndoで戻したい論理操作を識別する。
- **Runtime Handle**: Session中の高速参照用。一時的でCanonical Identityではない。
- **Runtime Generation**: Prepared Context、Cache、Derived Data等のFreshness確認に使える軽量世代。
- **Stable Region ID**: Lineart topology内Region追跡用の特殊Identity。

Document RevisionとTransactionは同一ではない。1 Transactionは1つ以上のAtomic Logical Revision更新を内包できる。

例:

```text
R100
  ↓ Canvas Drag
R101
  ↓ Inspector adjustment
R102
  ↓ Numeric adjustment
R103

Transaction T
base = R100
final = R103
```

User History上はTを1 Undo単位として扱える。

#### 3.4.2 Document Revision Root

Document Logical Revision Rootは、その時点のNode Revision、Source Revision、Selection Revision、**Canonical Relation Semantics / References**等を論理的に束ねる不変Rootとする。

Runtime Generation、Dirty flag、`lastSeenGeneration`、Resolved Dependency Cache等のFreshness / Derived StateはDocument Logical Revision Rootの意味を構成しない。これらが更新されてもCanonical Artworkの意味が変わらない限り、新しいDocument Logical Revisionを発行する必要はない。

変更されていないEntity / Contentを次Revisionで共有できる概念を許可し、Revision生成のためのDocument全体物理Copyを要求しない。Copy-on-Write、Structural Sharing、Immutable Block等の具体方式はSection 8 / 9で決定する。

#### 3.4.3 Immutable Semantics

Logical Revisionから参照されるContent Versionは、そのRevisionの意味を後から変更してはならない。GPU上に存在するかCPU上に存在するかは問わないが、後続Interactionが過去Revisionの見た目を暗黙に書き換えてはならない。

Canonical correctnessを「同期CPU Readback済みPixelが存在すること」と同義にしない。

#### 3.4.4 Persistent ID対象

後で他Entityから参照される可能性があるProject、Document、Visual Node、Object、Mask、Modifier、Source、Instance、Saved Selection、Selection Recipe、Ruler、Guide、Frame Variant、Material、Palette、Boundary、Stable Region、Constraint等にはStable Entity IDを付与できる。

名前、Layer index、座標、現在Stack位置をIdentity代わりに使わない。

#### 3.4.5 Rename / Reorder / Duplicate / Merge

- Rename、Move、Reorder、Visibility、Parameter変更では論理的に同じEntityならID維持。
- 通常Duplicateは新Entity ID。
- Shared Sourceでは各Instanceが別IDを持ち、Source IDのみ共有。
- Undo / Redoで復元するEntityは元IDを復元。
- Text→Rasterize等で意味的に同じNodeを表現方式変更する場合はNode ID維持可能。
- 複数Entityを統合して新しい論理Entityを作るMergeは新IDを発行し、元EntityとのLineageを保持可能。

削除済みIDを別Entityへ再利用しない。Tombstone / Cold History上の保持方式はHistory / Storage設計で決める。

#### 3.4.6 Stable Region ID

- 1対1で同一Regionと追跡できるShape ChangeではID維持。
- Splitでは元Regionをretireし、新Regionへ新ID + `derivedFrom`。
- Mergeでは新Regionへ新ID + parent lineage。

Region identity / lineage整合のためにLineart直接操作の表示を待たせない。使用時に必要領域のFreshnessを保証するモデルを採る。

#### 3.4.7 Offline / Runtime

Stable ID生成にServerを必要としない。IDはSecretやPermissionの代替にしない。

Realtime hot loopではStable IDの文字列 / hash lookup等を毎Sample行うことを要求せず、解決済みRuntime Handleを利用可能とする。

---

### 3.5 Source / Instance Model — 確定

#### 3.5.1 Selective Source / Instance

Source / Instanceを全Contentへ強制しない。共有する意味があるDataだけに利用する。

主な対象:

- Linked Shape
- Image / Smart / Procedural Material
- Embedded Object / External File Object
- Linked Text Style
- Shared Modifier

通常Raster Layer等、共有Semanticが不要なContentは直接Contentを持てる。

#### 3.5.2 Source / Instance State

- **Source**: 共有されるCanonical Content / DefinitionとRevision。
- **Instance**: SourceをDocument内で利用するEntity。独自Entity ID、Transform、許可されたOverride、Mask、Modifier等を持てる。

Instance OverrideはSource全Copyではなく差分として保持可能とし、Override可能項目はSource Typeごとに定義する。

#### 3.5.3 Edit Scope

高頻度なMove、Scale、Rotate、許可されたInstance Override等では毎回Source編集確認を要求しない。

一方、共有内容そのものを変更するときはEdit Scopeを `Shared Source` として明確に区別する。同じGestureが状況によって無言でInstance Local編集とShared Source編集を切り替えることを避ける。具体UIはSection 4 / 5で決定する。

#### 3.5.4 Duplicate / Linked Instance / Make Unique

通常DuplicateとLinked Instance生成は別操作とする。通常Duplicateしただけで意図しない共有関係を作らない。

Make UniqueではSourceを複製して新Source IDを作り、対象Instanceを新SourceへRebindする。Instance自身のEntity IDと配置は原則維持する。

Detach / Rasterize等で通常Local Contentへ変換する場合は3.4のIdentity規則に従う。

#### 3.5.5 Internal / External Source

- **Internal Source**: Project内部にCanonical Dataを保持する。
- **External Source**: 外部File等をCanonical Originとして参照する。

External SourceはLocator、Last-known Content / Revision、Status等を保持可能とし、外部SourceがMissingでも最後に正常取得した状態を利用して作品全体を開けなくしない。

外部Source更新検出とArtworkへの即時適用を同義にしない。自動更新Policy等の具体UXはSection 4 / 5 / 6で決定する。

#### 3.5.6 Source Revision / Snapshot

通常InstanceはSourceのCurrent Revisionへ追従できる。一方、History、Checkpoint、Snapshot、Branch等で過去状態を正確に再現するため、Document Revision Rootから特定Source Revisionを不変参照できる。

#### 3.5.7 Propagation

Source変更時に全Dependent Instanceを同期再計算してから操作を返さない。Source Generation / Revision更新によってFreshnessを判定し、Active / Visible / Next-needed Instanceを優先してResolveできる。

Source更新時の大量Fan-outを直接操作Latencyへ乗せない。

#### 3.5.8 Source削除

参照中Internal Sourceを暗黙削除してDangling Referenceを作らない。Delete、Make Unique、Local Content化等の解決Semanticを用意する。External MissingはInternal Dangling Referenceとは別概念とする。

---

### 3.6 Dependency / Relation Model — 確定

#### 3.6.1 万能Graphを作らない

概念上Dependency Systemを持つが、すべてを1個の巨大General-purpose Graph Engineへ押し込むことを要求しない。Relation Typeごとに専用Index / Runtime表現を持てる。

主な系統:

- Source relations
- Render dependencies
- Derived-data dependencies
- Semantic references
- Parameter sharing
- Constraint relations
- External-resource relations

Containment、Ownership、Dependencyを分離する。

#### 3.6.2 Relation Semantics

Dependencyは少なくともHard / Soft / Derived / Semantic(Query)等の性質を区別できる。

- **Hard**: Sourceが失われるとTargetの意味が成立しない。
- **Soft**: Missing時もLast-known / degraded stateで作品を維持できる。
- **Derived**: Layer Stack等のCanonical semanticsから計算可能なRuntime relation。
- **Semantic / Query**: `role=lineart`等のDynamic relation。

Semantic QueryはQuery + Resolution Policy + Resolved Setとして意味を明確にし、暗黙のfirst-matchを禁止する。例えば `all role=lineart`、`active role=lineart`、明示Set等を区別できる。

#### 3.6.3 Generation-based Freshness

大規模Fan-out relationではSource側Generationを進め、Consumerが利用時に `lastSeenGeneration` と比較してFreshnessを確認するPull方式を基本にできる。

Small / latency-critical relationでは軽量なPush notificationを許可する。ただし、**Push notificationは許可してもPush recursive computationは原則禁止**する。

```text
Mutation
  ↓
Generation / ChangeSet update
  ↓
Optional bounded notification
  ↓
Return

Consumer demand
  ↓
Freshness check
  ↓
Needed region / result resolve
```

#### 3.6.4 ChangeSet

変更は単なる `Document changed` だけでなく、少なくとも次を表現可能とする。

- changed entity
- change kind
- affected bounds / scope
- generation / revision
- relation-specific metadata

これにより後続章でDirty Region中心の局所処理を可能にする。

#### 3.6.5 Demand Priority

Dependency recomputationは概念上、Active Interaction、Current Viewport、Next-needed Dataを優先し、非表示・画面外・未使用Derived Dataを後回しにできる。

具体Scheduler / Resource BudgetはSection 8 / 9で決定する。

#### 3.6.6 Lineart Dependency

Lineart → Boundary → Stable Region → Persistent Fill等のChainは局所Change propagationを前提とし、全Topology再解析をBrush Hot Pathへ置かない。

ユーザーがFill / Selection等で現在利用しようとしているRegionについては、その利用範囲のFreshnessを確認してから正しい結果を返す。古いTopologyを黙って利用しない。

#### 3.6.7 Parameter / Constraint / Cycle

Parameter LinkはA→B→AのEvent連鎖ではなくShared Parameterを複数Consumerが参照するモデルを基本とする。

Geometric Constraintは通常Evaluation Graphとは分離したConstraint Solver Networkとして扱える。Cycle PolicyはRelation Typeごとに定め、Source→Instance、Modifier evaluation、Selection Recipe等で無限再評価を許さない。

---

### 3.7 Selection / Mask / Region Model — 確定

#### 3.7.1 Selection Value / Recipe / Live Bindingを分離する

Illustroでは以下を別概念とする。

- Active Selection Value
- Selection Construction State
- Quick Mask Edit State
- Saved Selection Value
- Selection Recipe
- Live Selection Binding
- Stable Region

**Active Selection Value / Saved Selection ValueはFrozen Value、Selection RecipeはDynamic Procedure、Live Selection BindingはRecipe等のDynamic SourceをToolの現在Selection入力へ明示的に接続する別状態である。** Active Selection Valueそのものを暗黙にDynamic化しない。

例えばLayer Alphaから通常Selectionを作成した場合、その時点のLayer Revisionに基づくSelection Valueを成立させ、元Layerが後から変化しても通常Selectionが勝手に変形しない。一方Selection RecipeはSourceのCurrent Revisionを再評価できる。追従Selectionが必要な場合のみ、明示的なLive Selection Bindingを利用する。

#### 3.7.2 Logical SelectionとMaterialized Coverage

Selection Valueは必ずしもCanvas全面Raster Maskとして物理化する必要はない。意味を固定したまま、次のようなLogical Representationを利用可能とする。

- closed lasso / geometric representation
- rectangle / ellipse geometry
- immutable source revisionに基づくvalue representation
- sparse / partial coverage representation
- selection expression
- materialized coverage

Toolが実際に必要とする領域だけExact CoverageへMaterializeできる。

Logical representationを採用してもSelection Valueの意味はFrozenであり、元SourceのCurrent Stateへ自動追従してはならない。

#### 3.7.3 Selection Coverage

Selectionは1bitだけでなく連続Coverageを表現可能とし、Feather、Anti-alias、Soft Brush Selection、Quick Mask等を共通に扱える。

Selection、Layer Mask、Effect MaskはCoverage技術を共有可能だが、Semantic Entity、Ownership、Lifetimeは別とする。

#### 3.7.4 Lasso / Construction

LassoのPointer Releaseを重いCanvas全面Selection生成の開始点にしない。

```text
Pointer Move
  ↓
Geometry / Constructionを逐次更新
  ↓
Pointer Up
  ↓
Bounded Tail close
  ↓
Frozen Logical Selection ValueをCommit
```

Release後にCanvas全面Polygon Rasterization、History Serialization、全Dependency評価等を完了してからSelectionを成立させる構造は禁止する。

必要なMaterialized CoverageはActive / likely-needed範囲を優先して準備可能とするが、その準備自体がForeground Interactionを奪わないことを要求する。

#### 3.7.5 Add / Subtract / Intersect

New / Add / Subtract / Intersectを同じTransaction semanticsへ載せる。内部的にSelection Expressionとして保持可能だが、Expressionが無制限に深くなり次操作を重くすることを許容しない。Compaction / Materializationの具体方式はSection 9で決定する。

#### 3.7.6 Quick Mask / Saved Selection

Quick MaskはActive Selection ValueをBrush等で編集するInteraction Modeであり、別の恒久Artwork Entityではない。開始時のFull Canvas Copyを要求しない。

Saved SelectionはStable IDを持つFrozen Selection ValueとしてRegistryへ保存する。Visual Composite Treeへ普通のColor Layerとして無理に混在させない。

#### 3.7.7 Selection Recipe / Live Selection Binding

Selection RecipeはInput、Operation、Parameter等からSelection Valueを生成する再評価可能Procedureとする。Cached Resultを持てるが、未使用Recipeの再評価を直接操作の同期条件にしない。

通常の「Recipeを選択へ適用」は、その時点のRecipe評価結果からFrozen Active Selection Valueを生成する。

明示的にSource追従を望む機能では、Active Selection Valueを書き換えてDynamic化するのではなく、**Live Selection Binding**を別状態として作り、RecipeのCurrent ResultをToolのSelection Inputへ供給する。Binding解除時のFrozen化、対象Tool、表示方法等の具体UXはSection 5で確定する。

#### 3.7.8 Stable Region / Persistent Fill

Stable RegionはSelectionとは別Entityで、Lineart GroupのBoundary Topology / Region Tableに属する。

通常の `Select Region` は、その時点のRegion形状をFrozen Selection Valueとして取得する。Lineart変更後に既存Selectionが勝手に変形しない。

一方Persistent Fill、Boundary-based paint restriction等、明示的にRegion追従を目的とする機能はStable Region IDへのLive Referenceを利用できる。

Region IdentityとRaster Coverageを分離し、RegionごとにCanvas-size Maskを恒常保持することを要求しない。

#### 3.7.9 Layer Mask

Layer MaskはOwner Local Spaceを基本とし、Link / Unlinkに応じて独立Transformを持てる。内部モデルとして複数Mask Stackを許容できるが、初期UI露出はSection 4 / 5で決める。

#### 3.7.10 Selection History / Latency

Selection変更は原則Undo対象だがPointer Sampleごとではなく論理Selection操作単位で扱う。Selection HistoryはDocument Historyとは別のRecent Selection Registryとして保持可能とする。

Selection高機能化をLasso Release latencyや次Brush開始latency悪化の当然の理由にしない。

---

### 3.8 Effect / Modifier Model — 確定

#### 3.8.1 Modifier分類

Modifierは元Dataを直接破壊せずParameterに従って派生結果を生成する処理Entityとする。

- **Attached Modifier**: 特定Ownerへ付く。Filter、Transform、Displacement等。
- **Stack Modifier**: Visual Stack位置によって下位Compositeへ作用するAdjustment等。Visual Stack ParticipantとしてStable IdentityとStack Orderを持つ。
- **Shared Modifier**: Shared Definitionを複数Applicationが参照する。

Effect DefinitionとModifier Applicationを分離可能とし、順序、Enabled state、Parameter、Mask等をCanonical Stateとして保持する。

#### 3.8.2 Interactive Parameter Editing

Slider、Canvas Handle、Transform等の高頻度Parameter操作はInteractive Stateとして即時反映し、Logical RevisionへAtomic Commitする。Parameter SampleごとにHistory Serialization、全Modifier再評価、全Document Compositeを同期必須にしない。

低品質Previewへ別Algorithmを切り替えて本処理の遅さを隠すことを0ラグ達成とはみなさない。目標は必要な現在領域へSemanticに正しい結果を効率よく求めることである。

#### 3.8.3 Influence Semantics

EffectはLocal / Bounded Expansion / Global等のInfluence特性を表現可能とし、Input Bounds、Output Bounds、Influence Boundsを区別できる。

これにより後続Algorithmで変更範囲中心の評価を可能にする。Global Effectであっても毎Sample全CanvasをゼロからScanする実装を当然とはしない。具体的なhierarchical summary等はSection 9で決定する。

#### 3.8.4 Derived State / Evaluation Preparation

Modifierの中間Render結果、Resolved Input、Cached Bounds、Evaluation preparation等はDerived Runtime StateでありCanonical Artwork Dataではない。

Modifier Stack / Structureが変わった際にResolved Evaluation Plan等を準備・Cache可能とするが、Parameter変更だけで毎回全Structureを再構築することを要求しない。具体的Compile / Cache方式はSection 8 / 9で決定する。

#### 3.8.5 Visible Exactness / Current Effective State

Current Viewport / Active Targetでは、**Current Effective State**に対して意味的に正しい結果を最優先する。

Current Effective Stateは通常時はCurrent Logical Revisionそのものであり、Interaction中は `Current Logical Revision + Active Interactive Working State` が表す現在の意味状態である。したがってSlider Drag、Transform、Brush等のInteraction中も、表示はCommit前の旧Logical Revisionだけではなく現在のInteractive Resultを正しく反映する。

Document全域を常に事前計算済みにする必要はなく、画面外はDirty / Lazy状態を許可する。これは品質を落とすApproximationではなく、計算対象を必要領域へ限定する考え方である。

#### 3.8.6 Mask / Transform / Liquify

Effect MaskはModifier ApplicationのAttachmentとし、3.7のCoverage semanticsを利用可能とする。

TransformはModifier概念へ統合可能だが、高頻度直接操作であるためRuntime専用Fast Pathを許可する。Canonical Conceptの統一を理由に汎用Modifier engineをHot Pathの関所にしない。

Non-destructive LiquifyはDisplacement Modifierとして扱える。ReconstructはDisplacement Stateを局所的に戻す操作として設計可能とする。

#### 3.8.7 Recipe / Variant / Sweep / Bake

- Effect Recipe: 再利用可能なModifier Chain Template。Preset変更で既適用作品を暗黙更新しない。
- Shared Modifier: 明示的な共有Definition。
- Effect Variant: 保存されたParameter候補状態。
- Parameter Sweep: 一時Interactive比較状態。

DisableではModifier Stateを保持する。Bake / Rasterizeは明示的な破壊操作とし、性能都合だけで勝手に実行しない。

#### 3.8.8 Fast Path Consistency

Realtime Fast PathとExport / Background Pathは実装が異なってよいが、Blend、Mask、Sampling、Modifier Parameter等のCanonical Semanticsを共有する。Fast Pathだけ結果が変わることを許容しない。

Modifier Chainの長さや高度Effectの存在をBrush / Pen latency悪化の当然の理由にしない。

---

### 3.9 History / Snapshot / Branch Model — 確定

#### 3.9.1 Operation / Revision / Transaction / History Node

Operation、Document Logical Revision、Transaction、History Node / History State、Snapshot、Checkpoint、Branchを別概念とする。

- **Document Logical Revision**: Artworkの正しい論理状態そのもの。
- **Transaction**: ユーザーが1回のUndo / Redoで移動したいBase Revision → Final Revisionの論理操作単位。
- **History Node / History State**: 特定Document Logical Revisionへの参照に、incoming Transaction、parent / branch relation、timestamp、history metadata等を付与してHistory Graph上へ配置する履歴上の節点。Artwork StateそのものをDocument Revisionとは別に二重保持する概念ではない。

Pointer Sample単位でHistory Nodeや永続Revisionを作らない。一方、Continuous Transaction中でも意味的に成立した直接操作結果はAtomic Logical Revisionへ採用できる。

1 Transactionは複数Logical Revisionを束ねられる。

```text
base R100
  ↓ Interaction A
R101
  ↓ Interaction B
R102
  ↓ Interaction C
final R103

Transaction T = R100 → R103
```

UndoではTのBaseへ戻り、RedoではFinalへ進める。

#### 3.9.2 Change Capture

Commit後にBefore / AfterのCanvas全体を比較してHistory差分を探すことを要求しない。Interaction中に既に判明しているAffected Entity、Affected Bounds、Operation semantics等を軽量にCapture可能とする。

History生成のためのFull Document Copy、History Serialization、Thumbnail、Search Index更新等を直接操作の表示・次操作開始条件にしない。

#### 3.9.3 Immutable Revision / Structural Sharing

Logical Revisionは不変の意味を持ち、変更されていないEntity / Content Revisionを共有可能とする。Branch、Snapshot、UndoのためにDocument全体を毎回物理Copyすることを要求しない。

物理的なCopy-on-Write、Tile versioning、Immutable Block等はSection 8 / 9で決定する。

#### 3.9.4 Undo / Redo

Undo / RedoはTarget History StateのVisible Resultを最優先する。Storage、Indexing、Thumbnail等を待たせない。

直近Historyを高速に再利用するためRuntime上Recent State / Derived Cacheを優先保持可能とするが、Hot / Warm / Coldの具体PolicyはSection 8 / 9で決定する。

古いHistoryへ移動した瞬間だけ無制限Replayが必要になる構造を避け、Snapshot / Checkpoint等によって復元距離をBound可能とする。

#### 3.9.5 Branching History

Undo後に新規編集した場合、旧Redo経路を破棄せずBranchとして保持する。

```text
      R100
      /  \
   R101A R101B
```

Branch作成のためにDocument全体をCopyすることを要求しない。通常UIでは内部Graph複雑性を常時露出せず、現在Branchを普通のUndo / Redoとして扱える。

Branch MergeはCommon Ancestorを基準とし、安全に統合可能な変更だけを自動統合する。意味が曖昧なConflictを勝手に破壊的解決しない。

#### 3.9.6 Snapshot / Checkpoint

Snapshotは特定Document Logical Revision Rootを不変に参照する概念であり、Full Physical Copyを意味しない。

Background Export、Compare、Variant Base等の共通基盤とする。

Named CheckpointはStable ID、対象Revision / History State、Name等を持つ永続地点とし、Project再Open後も保持可能とする。

Autosave / Recovery CheckpointはUser Undo Historyと分離し、Undo一覧をMaintenance項目で汚さない。

#### 3.9.7 Project Variant

Copy-on-Write Project VariantはProject Library上で独立して扱える作品案、History Branchは1 Project内の編集履歴経路として区別する。Variantは共通Base Revisionから開始し、未変更Dataを論理共有可能とする。

#### 3.9.8 Recent Stroke Re-edit

直前Stroke再編集は過去Revisionを破壊的に書き換えない。再編集結果は新しいLogical Revisionとして生成する。

同じContinuous Transaction内であればUndo上は元Stroke作成と再編集を1 Transactionへ束ねられる。別の論理操作を挟んだ後の再編集は通常新Transactionとして扱う。

#### 3.9.9 Timelapse / Search / Compaction

History EntryはTool、Command、Affected Entity / Bounds、Timestamp等のMetadataを持てるが、IndexingをInput Hot Pathへ入れない。

TimelapseはMeaningful Operation Stream / Visual Checkpointを利用でき、Storage compaction等のMaintenanceを作品操作として扱わない。

History規模増大を現在のBrush / Lasso latency悪化の理由にしない。CompactionやCold Storageの物理方式は後続章で決定する。

---

### 3.10 Transaction / Interactive State / Commit / Cancel Model — 確定

#### 3.10.1 Common Lifecycle

Brush、Lasso、Transform、Fill、Gradient、Effect Parameter、Liquify、Shape Editing等の直接操作を原則として次のLifecycleへ載せる。

```text
Idle
  ↓
Begin
  ↓
Interactive Update
  ↓
Atomic Logical Commit / Interaction Cancel
  ↓
Idle or next Interaction
```

Toolごとに実装は異なってよいが、Begin / Interactive / Commit / Interaction Cancelの意味を可能な限り統一する。

#### 3.10.2 Prepared Interaction Context

Active Tool、Active Target、Selection、Mask、Clip、Ruler、Modifier relation等が変化した時点で、高頻度操作に必要なPrepared Contextを事前解決可能とする。

Prepared Contextには各SubsystemのGeneration Stamp等を保持できる。Pointer Down時はCurrent Generationとの軽量比較を行い、有効なら即利用し、一部だけStaleなら必要部分だけPatchする。

Prepared ContextのValidity確認のためにGraph全走査を行わない。

#### 3.10.3 First Sample / Sustained Interaction

Pointer Down直後のFirst Visible Sampleを優先し、前InteractionのMaintenance、Thumbnail、Offscreen Derived Work等がFirst Sampleを遅らせないことを要求する。

同時にFirst Sampleだけ速く後続が詰まることを許容しない。長尺Stroke等でもInteraction処理量が無制限に過去入力へ比例しない構造を要求する。Stable Prefix、Bounded Mutable Tail、Frame-aligned batching等の具体AlgorithmはSection 9で確定する。

#### 3.10.4 Interactive Working State

Interaction中だけTransient Mutable Stateを持てる。

例:

```text
Interaction Base Logical Revision R100
+
Active Interaction Working State
+
Current Interactive Result
```

Interactive StateはFake Previewではなく、そのInteractionで継続利用できる第一級状態とする。

#### 3.10.5 Atomic Logical Commit

CommitはInteractive Resultを新しいDocument Logical Revisionへ原子的に採用する境界である。

```text
R100
  ↓ Interactive Working State
Commit
  ↓
R101 = Current Logical Revision
```

Commitされた瞬間、R101が作品の正しい現在状態となる。Commit後に「Canonical化待ち」の意味的Pending Stateを残さない。

Commit後に遅延してよいのはPersistence、Recovery補助、Derived Data更新、History Index、Collaboration送信、Maintenance等であり、Canonical Reconciliationという概念を通常経路に置かない。

次Interactionは直前Commit済みRevisionを必ずBaseとして観測できる。このRead-your-writes保証をSection 3不変条件とする。

#### 3.10.6 Commit Complexity

Pointer Up / Release / Commit時に、Canvas全面Rasterize、全Document Composite、全History Serialize、全Graph Evaluate等を行い、その完了を次操作開始条件にしない。

Commit必須処理は原則として今回変更したWorking Set / Bounded Tailに比例させる。Canvas Area、総Layer数、History長、Graph規模、総Instance数への比例を避ける。

#### 3.10.7 Interaction Cancel / Transaction Revert

**Interaction Cancel**と、Continuous Transaction全体を取り消す**Transaction Revert**を別概念とする。

Interaction Cancelは、現在進行中のInteractionだけを開始直前の**Interaction Base Logical Revision**へ戻す。すでに同じContinuous Transaction内でAtomic Commit済みの以前のInteraction結果まで暗黙に消さない。

例:

```text
Transaction Base R100
  ↓ Interaction A Commit
R101
  ↓ Interaction B in progress

Interaction B Cancel
  ↓
R101
```

一方、ユーザーがContinuous Transaction全体の取り消しを明示した場合だけ、**Transaction Revert**としてTransaction Base Revision R100へ戻せる。

Cancel / RevertのためにBegin時Full Canvas Copyを要求しない。Transient Working StateのdiscardやRevision Root切替等を利用できる。具体的COW / Reversible Delta等はSection 8 / 9で決定する。

Cancel可能Toolは現在Interactionの確定前に、そのInteraction Baseへ戻れない不可逆Mutationを完了させない。

#### 3.10.8 Continuous Transaction

多くの場合1 Interaction = 1 Transactionとするが、Canvas Handle、Inspector、Slider、Numeric Input等を跨いで同じ意味の編集を継続する場合はContinuous Transactionとして複数Atomic Logical Revisionを1 Undo単位へ束ねられる。

Continuous TransactionはTransaction Base RevisionとCurrent / Final Revisionを保持し、各内部Interactionは独自のInteraction Base Revisionを持てる。これにより途中InteractionのCancelとTransaction全体のUndo / Revertを混同しない。

Temporary / Spring-loaded Tool ContextとDocument Transactionを分離し、一時Eyedropper等のTool切替だけで不必要にArtwork Transactionを破壊しない。

Tool切替時のCommit / Interaction Cancel PolicyはTool semanticsごとに明示し、場当たり的な暗黙動作を避ける。

#### 3.10.9 Multi-input / View Interaction

Artwork InteractionとPan / Zoom / View Rotation等のView Interactionを分離し、Pen DrawingとTouch Navigation等の同時操作を成立可能とする。

各Artwork Input Sampleは受信時View GenerationでDocument Spaceへ解決し、後からViewが変化しても過去Sample座標を再解釈しない。

View操作を原則Artwork Undoへ混在させない。

#### 3.10.10 Backpressure / Pending Work

Realtime Input、Derived Work、Persistence補助等を無制限Queueとして蓄積することを前提としない。

Workには少なくとも次の意味的性質を持たせられる。

- **must preserve**: 失ってはいけないSemantic Operation / History等。
- **latest wins**: Thumbnail、Project Preview、Offscreen derived result等。
- **mergeable / coalescible**: Dependency invalidation、保存対象changed blocks等。

具体Queue、Frame scheduler、Coalescing algorithmはSection 8 / 9で決定する。

#### 3.10.11 Canonical vs Durable

**Logical Canonical State**と**Durable Persistent State**を分離する。

例えばCurrent Logical RevisionがR150、Storageへ安全に反映済みのDurable RevisionがR147という状態はあり得る。この場合Artworkの正しい現在状態はR150であり、R148〜R150がFake Previewという意味ではない。

Durability Watermark、Recovery Journal、Autosave cadence等の具体設計はSection 6 / 8で確定する。

ただし直接操作を優先する結果、Recovery-critical workが永久に実行されないことも許容しない。後続SchedulerではRealtime foregroundを最優先しつつ、最低限のDurability処理へstarvation-freeなSafety Laneを確保することを要求する。

#### 3.10.12 Background Resource Isolation

History、Persistence、Boundary、Offscreen evaluation等を非同期化してもCPU / GPU / Memory bandwidthは共有Resourceである。

したがって後続技術設計では、Direct InteractionとVisible PresentationがBackground WorkよりResource優先権を持つことを要求する。Speculative / Warm workはForeground Budgetを侵食した場合にYield可能でなければならない。

具体的Resource Governor、GPU submission policy、Memory budget、Thermal / Battery制御はSection 7 / 8 / 9で決定する。

#### 3.10.13 Failure Semantics

Persistence、Autosave、External Source、Collaboration等のBackground failureと、既にLogical CommitしたArtwork Stateを分離する。保存失敗だけを理由にCommit済みArtworkをその場で消さない。

一方、Durabilityが追いついていないことによるData-loss riskを「0ラグ」の名目で隠してはならない。Operational Status / Error FeedbackのUXはSection 4 / 6で決定する。

#### 3.10.14 Realtime Semantic Consistency

Realtime Fast Path、Undo表示、Background Renderer、Export Renderer等は実装が異なってもCanonical Semanticsを共有する。

特にBrush、Blend、Selection Coverage、Mask、Clipping、Modifier、Color management等について「Realtimeだけ見た目が違う」「Exportすると変わる」を構造上の許容事項にしない。

---

### 3.11 Section 3 完了条件

Project / Document / Canvas / View、Coordinate Systems、Layer Tree / Node、Identity / Revision、Source / Instance、Dependency / Relation、Selection / Mask / Region、Effect / Modifier、History / Snapshot / Branch、Transaction / Interactive Stateの基本概念をもってSection 3「基本概念・データモデル」を完了とする。

本章では以下を最終不変条件として確認する。

1. Interaction中だけTransient Mutable Stateを持ち、Commit時にはLogical Canonical Revisionが成立する。
2. Document Logical RevisionとUser Transactionを分離し、Continuous Transactionと即時Logical Commitを両立する。
3. Active / Saved SelectionはFrozen Value、Selection RecipeはDynamic Procedure、Live Selection Bindingは明示的なDynamic Bindingとして別概念にする。
4. ClippingのCanonical意味はLayer Stack / adjacencyとし、Runtime relationはDerivedとする。
5. DependencyはGeneration / Demand-driven評価を利用可能とし、Recursive eager recomputationを直接操作へ強制しない。
6. History、Branch、SnapshotはImmutable Revision semanticsと整合し、Document全体物理Copyを必須にしない。
7. Logical Canonical StateとDurable Persistent Stateを分離しつつ、Recovery-critical処理の永久starvationを許容しない。
8. Active / Visible結果を優先し、画面外・非表示・未使用Derived DataをLazyにできる。
9. Canonical Modelの高度さを直接操作Hot Pathへそのまま持ち込まない。
10. Interaction Cancelは現在Interaction Baseへ、Transaction Revert / UndoはTransaction Baseへ戻るものとして区別する。
11. Current Effective Stateは通常時Logical Revision、Interaction中はLogical Revision + Active Interactive Working Stateとして扱い、Visible Resultはその現在意味状態に整合させる。
12. Runtime Generation / Dirty / Cache更新だけでCanonical Artwork意味が変わらない限りDocument Logical Revisionを進めない。
13. Stack ModifierはVisual Stack ParticipantとしてStable Identity / Stack Orderを持ち、Attached Modifierと区別する。
14. History NodeはDocument Logical Revisionへの参照と履歴Graph metadataを持つ節点であり、Artwork Stateを二重保持しない。
15. Undo後に新規編集しても旧Redo経路を破棄せずBranchとして保持する。
16. 後続のUX、保存、非機能、技術、Algorithm設計で本章と矛盾が判明した場合は例外実装で隠さず、本Source of Truthへ戻って改訂する。

## 4. 全体UX / UI設計 — 確定

### 4.0 この章の位置づけ

本章は、Section 2で採用した機能群とSection 3で確定したCanonical / Interactive semanticsを、ユーザーが実際に理解・発見・操作できる全体UXへ落とし込む。

本章で確定するのは、主にWorkspaceの骨格、機能への導線、Tool / Panel / Context UIの責務、Canvas直接操作、端末適応、入力方式、Feedback、Accessibility、Visual Languageである。個々のToolが持つ全Parameterの厳密な初期値、Brush Presetの具体ラインナップ、Filterごとの詳細項目、Shortcutの最終Key Map等はSection 5以降で確定する。

Illustroの全体UXは次を最上位原則とする。

1. **Canvas First**: Artworkを画面の主役とし、UIのためにCanvasを過度に圧迫しない。
2. **Direct Manipulation First**: 対象をCanvas上で直接動かせる場合は直接操作を第一候補とする。
3. **Recognition over Recall**: Gesture / Shortcutだけを唯一の入口にせず、発見可能なGUI routeを用意する。
4. **Progressive Disclosure**: 高頻度操作を近く、低頻度・高度設定を深い階層へ置く。
5. **Immediate Local Feedback**: 入力結果は可能な限り同じ場所・次Display Frameで見えるようにする。
6. **Context Preservation**: Panel切替、PiP化、Resize、Collapse等で作業Contextを不用意に失わせない。
7. **Reversibility**: Undo / Redo / Cancel / Reset / Redock等の復帰経路を明確にする。
8. **Mode Clarity**: Active Tool、Active Target、Interaction Mode、Save / Error状態を視覚的に識別可能にする。
9. **Responsive Recomposition**: 狭い画面ではDesktop UIを縮小せず、構造を再配置する。
10. **0-Lag UX**: AnimationやPreviewで遅延を隠すことを完成とせず、直接操作の実Latencyそのものを減らす。

---

### 4.1 Access Architecture / 導線規約

#### 4.1.1 4層Access Architecture

Illustroの機能入口を次の4層へ整理する。

**Layer 1 — Global**
- Main Menu
- Global Command Search

**Layer 2 — Frequent**
- Left Tool Rail
- Right Page Rail
- Top Bar
- Quick Hole

**Layer 3 — Context**
- Properties Page
- Canvas Context Bar
- Selection Launcher
- Context Menu

**Layer 4 — Deep**
- Detail Settings
- Brush Studio
- Assist blocks
- History subpages
- Effect / Modifier detail
- Export workspace
- Settings

高頻度機能を深いMenuへ追いやらず、逆に低頻度機能を常設Surfaceへ大量に並べない。

#### 4.1.2 Primary GUI Routeの必須化

Section 2で採用された**すべてのユーザー操作可能機能**は、最低1つの明示的かつ発見可能なPrimary GUI Routeを持たなければならない。

Gesture、Shortcut、Long Press、Right Click / Context Menuのみを唯一の入口にしてはならない。

Commandとして表現可能な機能はGlobal Command Searchから検索・実行可能にする。

今後Section 5以降で機能を追加・詳細化する場合、原則として次の導線情報を持たせる。

```text
Feature
  → Primary GUI Route
  → Context Route
  → Global Command Search
  → Shortcut / Gesture（存在する場合）
```

#### 4.1.3 Command Search

Global Command Searchを正式なFallback導線とする。Desktopでは `Ctrl/Cmd + K` をDefault候補とするが、最終Key MapはSection 5で確定する。

Command SearchはTool、Menu Command、Panel Focus、Setting、Effect、Selection Operation、Layer Operation、Ruler、Export等を横断検索できる。

非表示にしたToolやCustom Workspaceで隠れた機能もCommand Searchから到達可能とする。

#### 4.1.4 Dismissal Stack

Esc、OS Back、外側Tap等が複数状態と競合しないよう、一番手前の一時状態から閉じる共通規約を持つ。

優先順位は原則として次とする。

1. Tooltip / temporary hint
2. Context menu / dropdown
3. Modal-less popup
4. Sidebar overlay / bottom sheet
5. Canvas contextual sub-mode
6. Active Interaction Cancel
7. Document / Workspace navigation

一度のBack / Escで複数階層を同時に破壊しない。

---

### 4.2 Workspace / Screen Architecture

#### 4.2.1 基本骨格

Wide layoutの基本構造を次とする。

```text
Top Bar
Left Tool Rail | Canvas Workspace | Right Sidebar
```

役割を明確に分離する。

- **Top**: Application / Document
- **Left**: Tool selection
- **Center**: Artwork / Direct Manipulation
- **Right**: Properties / Information / Structure / Resources
- **Canvas Overlay**: Contextual interaction / Quick Hole / PiP

Canvasを常に最大の視覚領域とする。

#### 4.2.2 Right Sidebar

Right Sidebarは「複数の巨大Panelを常時縦積み」する方式ではなく、**Page Rail + Current Page**を基本とする。必要なBlockはPiPとして外へ持ち出せるため、1ページ集中表示と複数同時参照を両立する。

DesktopのSidebar幅はDefault 320px、Min 280px、Max 440pxを基準とし、Drag Resize可能とする。Collapse時はPage Railを残し、再表示場所を失わせない。

#### 4.2.3 Right Page Railの8ページ

Default Page構成を次の8つとする。

1. **Properties**
2. **Color**
3. **Brush**
4. **Layers**
5. **Assist**
6. **View**
7. **History**
8. **Assets**

役割は次の通り。

- **Properties**: 現在のTool / Object / Selection / Modifier等に追従する高頻度設定。
- **Color**: Color Wheel、Palette、History、Harmony、Color relation等。
- **Brush**: Brush Preset、Brush管理、Brush Studio等。現在Brushの即時ParameterはPropertiesと連携する。
- **Layers**: Visual Stack、Mask、Modifier、Source / Instance、Layer organization。
- **Assist**: Ruler、Guide、Perspective、Symmetry、Snap、Lineart Boundary / Region関連。
- **View**: Navigator、Reference、View Anchor、Frame View等。
- **History**: History、Branch、Checkpoint、Auto Action、Timelapse。
- **Assets**: Material、Texture、Pattern、Brush Tip、Stamp等。

Page切替は即時で、不要な長いTransitionを挟まない。各PageはScroll位置、展開状態、選択状態等を保持する。

#### 4.2.4 Page Bottom Action Strip

Page固有の高頻度Actionを最下部固定Stripへ置ける。

例:
- Layers: Add / Folder / Mask / Effect / More / Delete
- Assets: Add / Import / More
- History: Checkpoint / More

Action StripはPage内容に追従し、不要なPageでは表示しない。

---

### 4.3 Left Tool Rail

#### 4.3.1 Default Tool Families

Tool RailのDefault構成を次の9 Familyとする。

1. Brush
2. Eraser
3. Blend
4. Fill
5. Selection
6. Transform
7. Eyedropper
8. Shape / Path
9. Text

これは**固定不可変の9個ではなくDefault構成**である。Section 2で採用済みのTool Group / Toolbar Customizationと整合させ、Reorder / Hide / Add / Group / Resetを可能とする。

Default整理では次を採用する。

- GradientはFill Familyへ統合。
- Lasso DirectはSelection Familyへ統合。
- Repair / Clone等はBrush / Retouch系Subtoolとして到達可能にする。
- Ruler / GuideはAssistへ移す。
- Navigationは常設ToolではなくTouch / Mouse / Keyboard等のView Interactionを基本とする。
- LiquifyはMain Menu / Command Searchから起動できるCanvas Direct Modeとし、起動後はPropertiesで操作する。

#### 4.3.2 Family / Subtool操作

Family buttonの1 Tap / Clickは前回使用したSubtoolを即選択する。

Subtool Flyoutは少なくとも次の通常GUI経路を持つ。
- Active Familyを再Tap / Click
- 明示的なSubtool indicator
- Long Press

Long Pressだけを唯一の入口にはしない。

#### 4.3.3 Current Color Chip

Tool Rail下部にMain / Sub Colorを示すColor Chipを常設する。Right SidebarがLayers等を表示中でも現在色を確認可能にする。

Color ChipからColor Pageへフォーカスできる。色だけでMain / Sub / Transparency状態を表さず、Shape / Layering / icon等も併用する。

---

### 4.4 Top Bar / Main Menu

#### 4.4.1 Top Barの責務

Top BarはApplication / Document層へ限定する。Desktopの基本高さは52pxを基準とする。

基本構成:
- Illustro / Main Menu入口
- Document name
- File
- Export
- Workspace
- Save status
- Settings

Brush Size、Opacity、Layer一覧、Color detail、Selection operation等をTop Barへ常設しない。

Undo / Redoの常設ButtonもTop Barには置かない。Undo / RedoはQuick Hole、Gesture、Keyboard、Edit Menu等から到達する。

#### 4.4.2 Main Menu

Main Menuは最低限、次のカテゴリを持つ。

- File
- Edit
- Document
- Layer
- Selection
- Filter
- View
- Collaboration
- Window / Workspace
- Help

全機能をTop Barへ直接並べず、低頻度Commandの発見可能性をMain Menuで担保する。

主要責務例:
- **Document**: Canvas Size、Image Size、Crop、Frame Variant、Color Profile、Document Settings。
- **View**: Fit、100%、Mirror、Pixel View、Grid、Guide、Soft Proof、Gamut Warning、Canvas Focus。
- **Edit**: Undo / Redo等。
- **Filter**: Filter、Liquify等の起動。

#### 4.4.3 Save Status

通常は静かな `Saved` 表示とし、Saving / Save Issue等だけ状態変化を明示する。

Persistenceが遅れてもLogical Commit済みArtworkを消したり直接操作を止めたりしない。ただしData-loss riskを隠さない。

#### 4.4.4 Collaboration Status

通常制作時はCollaboration UIを常設しない。Main Menu > CollaborationからCreate / Joinへ入る。

Room参加中だけTop BarへRoom Name、Participant count等のSession Statusを出せる。

---

### 4.5 Canvas Workspace

#### 4.5.1 Canvas First

Canvas Workspaceは画面最大領域を占める。周囲は低彩度Neutral Surfaceとし、ArtworkよりUI背景が目立たないようにする。

Light ThemeのCanvas SurroundはCool Neutral Grayを基本とする。Canvas自体はUI card化せず、角丸を付けない。必要な1px境界と非常に弱いShadowのみ許容する。

Fit時はCanvas周囲に適切な操作余白を確保し、Viewport端へ密着させない。

#### 4.5.2 Navigation

Pan / Zoom / View RotateはArtworkを変更しないView Interactionとして扱う。

- Touch pinch / pan / rotate
- Wheel / Trackpad
- Mouse / keyboard modifier
- View Page

等から操作可能にする。

Canvas Rotate時もUIは回転しない。

#### 4.5.3 Canvas Overlay Layering

Canvas周辺のVisual hierarchyを概念的に次の順に分ける。

1. Artwork
2. Artwork Assist: Ruler / Guide / Grid / Perspective等
3. Direct Manipulation: Selection / Transform / Vector node等
4. Temporary UI: Quick Hole / Launcher / tooltip / context bar等

Artwork DataとUI Overlayを意味的に混在させない。

#### 4.5.4 Canvas Focus Mode

Canvas Focus Modeを持つ。Top Bar、Tool Rail、Sidebarを一時的に隠し、必要ならQuick Holeと指定PiPだけ残せる。

---

### 4.6 Quick Hole Controller

#### 4.6.1 Shape / Geometry

Quick HoleはCanvas-localなQuick Command Surfaceとする。

**6枚の独立した六角形Tile**を、1つの中心点を共有する同一円周上へ60°間隔で配置する。Tile同士は接触させず、一定の小さなGapを空ける。中央は空洞とする。

配置全体を30°回転し、明確な左右端を形成する。

右方向を0°としたTile中心角は次とする。

- 0°: **Redo**
- 60°: Remappable Command
- 120°: Remappable Command
- 180°: **Undo**
- 240°: Remappable Command
- 300°: Remappable Command

したがって左端をUndo、右端をRedoへ固定し、残り4 TileをユーザーRemap可能とする。

#### 4.6.2 Anchor / Movement

Quick HoleはWorkspace Spaceに存在し、Canvas Zoom / Rotate / Panに追従して回転・拡縮しない。

中心の空洞を移動用Hit Regionとして利用でき、DragでAnchorを移動する。中央は視覚的には空洞のまま維持する。

Anchor位置、Scale、Radius、Tile Size、Opacity等はWorkspace stateとして保持可能とする。

UI操作によってCanvas Viewが変化してもAnchorを不用意に移動しない。Viewport resize等で完全に画面外へ出る場合のみ安全領域へClampする。

#### 4.6.3 Drawingとの競合

Artwork Stroke / Lasso等の直接描画中はQuick Holeを非表示にし、直接操作を遮らない。Interaction終了後は同Anchorへ戻る。

Quick Hole自身から開始したPointerはQuick HoleがPointer ownershipを持ち、Canvasへはみ出してもStrokeを開始しない。

Temporary DismissおよびShow / HideはWorkspace MenuとCommand Searchから必ず到達可能とし、Gestureだけを唯一の入口にしない。

#### 4.6.4 Visual

各Tileは機能FamilyのSemantic Colorを利用できる。Normalでは淡く、Hover / Focus / Active / Pressedで同一色相内のGradientを強める。

Undo / Redoは左右位置そのものでも識別できるようにし、色だけに意味を依存させない。

---

### 4.7 Dockable Inspector / Floating PiP

#### 4.7.1 PiPの意味

PiPはSidebar Blockを別物へ変換したPanelではなく、**同じBlockをWorkspaceへDetachした配置状態**とする。

#### 4.7.2 Detach

Sidebar内の対象Blockを直接Drag-outするとPiP化する。

常設の「PiP化ボタン」「Pin button」は置かない。

ただしDrag操作だけに依存しないため、Context Menu / Keyboard Navigation等からDetachできる代替操作を提供する。

#### 4.7.3 PiP能力

PiPは次をサポートする。
- Move
- Resize
- Collapse / Expand
- Block内部の個別Collapse
- 複数PiP
- Sidebar Collapseからの独立
- Position / Size / Collapse / Scroll / Block order等の状態保持

PiPでもDock内と同じCollapse capabilityを失わない。

#### 4.7.4 Redock

PiPの `×` は内容破棄ではなくRedockを意味する。

Sidebar近傍へDragするとDock Previewを表示し、Drop時だけMagnetic Redockを確定する。近づいただけで勝手に吸着させない。

#### 4.7.5 Input Ownership

CanvasでPointer DownしたInteractionはPointer UpまでCanvas側が所有する。PiPでDownしたInteractionはPiP側が所有する。途中でSurface境界を跨いでもOwnershipを奪い合わない。

#### 4.7.6 PiP内容

PiPはRight Sidebar全体の縮小コピーではなく、継続調整価値の高いBlockを近距離へ持ち出す用途を基本とする。

例:
- Brush: Size / Opacity / Flow / Stabilization / preset summary
- Color: Current / Previous、Compact picker、Palette subset
- Layers: Active Layer、Visibility、Opacity、Blend summary
- Transform: X / Y / Scale / Angle / Snap

Quick HoleはInstant Command、PiPはContinuous Parameter adjustmentという役割分担を維持する。

---

### 4.8 Selection / Transform Direct Manipulation

#### 4.8.1 Selection Visual

Selection境界は明暗双方で読めるContrast Halo + Selection Accentを基本とし、古典的な白黒Marching Antsだけへ依存しない。

通常表示はOutlineを基本とし、必要時にSelection外側等を半透明表示するMask Overlay表示へ切替可能とする。これはQuick Mask edit modeとは別の表示方式である。

#### 4.8.2 Selection Construction

Lasso等のConstructionは入力中からGeometryを逐次表示し、Release後に重い全Canvas処理を待つUIを出さない。Section 3のFrozen Logical Selection Value / bounded commit semanticsと整合させる。

#### 4.8.3 Selection Launcher

Selection成立後、選択範囲近傍へContextual Launcherを表示できる。

Default主要項目:
- Transform
- Fill
- Cut
- Copy
- Invert
- Deselect
- More

配置は対象Bounds、Viewport空き領域、Pen / Hand Occlusionを考慮して上 / 下 / 反対側へ退避する。

高度Selection操作、Saved Selection、Selection Recipe、Live Selection Binding等はProperties / Selection Menu / Registryから発見可能にする。

#### 4.8.4 Transform

Transform開始時は対象実BoundsへBounding Boxを表示する。

基本Handle:
- 4 Corner
- 4 Edge midpoint
- Pivot
- Rotation affordance

視覚HandleとHit Areaを分離し、Touch環境では十分なHit Targetを確保する。

Canvas上ではMove / Scale / Rotate / Distort / Warp等を直接操作し、詳細数値はPropertiesで編集する。

Transform Context BarはUniform / Free / Distort / Warp / Snap / Cancel / Commit等、現在操作に必要な項目だけを対象近傍へ表示する。

操作中のLive ReadoutはPointer / Pen Tipや利き手を覆わない側へ表示する。

---

### 4.9 Layers / Object Navigation

#### 4.9.1 Layer Row

基本Row:

```text
[visibility] [thumbnail] Name [state]
```

通常時に大量Badgeを常時露出しない。

常時表示候補:
- Visibility
- Thumbnail
- Name
- Active state
- Lock（必要時）
- Expand（childrenあり）

#### 4.9.2 高度構造の見せ方

Section 3の高度内部モデルを通常Layer ListへそのままGraphとして露出しない。

- Layer Mask / Attached Modifier: Ownerの子としてIndent。
- Stack Modifier: Visual Stack Participantとして通常Row。
- Clipping: Indentation + lightweight connector。
- Source / Instance: 小さなLink status。
- Semantic Role: 必要時だけTag。
- Dependency: 通常非表示。Influence / Dependency Viewを明示的に開いた場合のみ露出。

#### 4.9.3 Reorder / Multi-select

Layer ReorderはDragでbefore / after / inside folderを明確にPreviewする。

DesktopではCtrl/Cmd / Shift、TouchではMulti-select mode等を利用可能にする。

複数選択時はBottom Action Stripを対象群用Actionへ切り替えられる。

#### 4.9.4 Effect / Modifier入口

Layers Bottom Stripの `Effect` をModifier追加のPrimary Routeとする。

追加後のModifierを選択するとPropertiesへ詳細を表示する。

#### 4.9.5 Source / Instance入口

Linked Source / Instanceを選択した場合、Propertiesから少なくとも次へ到達可能にする。

- Source identity / status
- Edit Source
- Overrides
- Update / Reload（外部Source等で必要な場合）
- Make Unique
- Reveal Source

Linked duplicate / Make Unique等はContext Menuだけを唯一の入口にせず、Main Menu / Properties / Command SearchのいずれかにもPrimary routeを持つ。

---

### 4.10 Responsive / Device Adaptation

#### 4.10.1 Layout Regime

厳密Breakpointは実装検証で微調整可能だが、UX上次の3 Regimeを持つ。

**Wide — 約1100 CSS px以上**
- Top Bar
- Vertical Tool Rail
- Canvas
- Full Right Sidebar

**Medium — 約700〜1099 CSS px**
- Tool Rail
- Canvas
- Page Rail常設
- Page本体はSide Sheet / Overlayを基本とする

**Compact — 約700 CSS px未満**
- Top Bar簡略化
- Tool Rail / Tool Stripを利用可能領域に応じてReflow
- Right Sidebar本体はOverlay Sheet
- PiP size制約を強める
- Quick Hole利用可能

高さ不足のLandscapeではVertical Railを無理にScrollさせ続けず、Horizontal Tool StripへReflow可能とする。

#### 4.10.2 Canvas Priority

Sidebarを固定表示するとCanvasが極端に狭くなる場合、Pinned SidebarよりOverlayを優先する。

ResponsiveはDesktop UIの単純縮小ではなく、同じ機能責務を保った再構成とする。

#### 4.10.3 UI Scale / Density

Responsiveとは別にUI ScaleとDensityを持つ。

UI Scale候補:
- Auto
- 80%
- 90%
- 100%
- 110%
- 125%
- 150%

Density:
- Compact
- Comfortable（Default）
- Touch

Responsive = 配置構造、Density = Control密度、UI Scale = 物理的大きさとして区別する。

---

### 4.11 Input / Gesture / Shortcut UX

#### 4.11.1 Default Input Roles

Defaultを次とする。

- Pen: Artwork Direct Manipulation
- Touch: Navigation + Gesture。設定でDrawing可。
- Mouse: Tool operation + Navigation
- Keyboard: Accelerator / Modifier / exact command

Penが利用中のDefault profileではPen = Artwork、Finger = Navigationを基本とする。

#### 4.11.2 Gesture

Section 2と整合し、Default候補として次を持つ。

- 2 finger tap = Undo
- 3 finger tap = Redo
- 2 finger pan / pinch / rotate = View interaction
- Quick Eyedropper gesture

Gestureしか入口がないCommandは作らない。

#### 4.11.3 Mouse / Keyboard

Mouse:
- Primary = Tool action
- Wheel / Trackpad = configurable Zoom / Navigation
- Middle or Space+Drag = Pan候補
- Right click = Context Menu

Keyboard:
- Undo / Redo
- Esc Cancel / dismissal
- Enter Commit
- Space temporary Pan
- Modifier constraint
- temporary Eyedropper

具体Key MapはSection 5で確定する。

#### 4.11.4 Hand Occlusion

Pen / Touch位置とLeft / Right handed profileから、Tooltip、Numeric Readout、Selection Launcher、Context Bar、Popupを手で隠れにくい側へ退避する。

---

### 4.12 Feedback / Status / Accessibility / Visual System

#### 4.12.1 Feedback hierarchy

Direct InteractionではArtwork自身の変化を第一Feedbackとし、意味のないSpinnerや「適用中」でLatencyを隠さない。

表示場所の基本:
- Tool state: Control自身
- Parameter change: Control + local readout
- Canvas interaction: Canvas上
- Save state: Top Bar
- Recoverable issue: Non-modal banner
- Local validation: Field付近
- Destructive / irreversible: 明示確認
- Critical failure: Recovery surface

Toastは日常操作に乱用せず、Export完了等のCanvasだけでは結果が分からない操作へ限定する。

#### 4.12.2 Offline / Failure

通常制作はOfflineで成立するため常時大きなOffline警告は出さない。Online機能利用時だけ関連箇所へ状態を表示する。

Graphics / Device failureは可能ならRuntimeを再構築し、Logical Artworkを維持する。復旧不能時はRecovery routeを提示する。

#### 4.12.3 Accessibility baseline

AccessibilityはWCAG 2.2 AA相当以上を最低基準候補とし、少なくとも次を要求する。

- 色だけに状態意味を依存させない。
- Keyboard focusを明確に表示する。
- Drag操作に非Drag代替を用意する。
- Touch主要Controlは44px / pt級のHit Areaを基本とする。
- Reduced Motionへ対応する。
- Reduced Transparency / High Contrastで可読性を維持する。
- Left / Right handed Workspace mirrorをサポートする。
- Screen Reader等でControl名 / Stateを解釈可能にする。

#### 4.12.4 Visual Language

Default themeは明るくカラフルなLight Themeとし、Dark Themeも提供する。

中核Visual原則:

> **Neutral Canvas Environment + Colorful Semantic UI + Monochromatic Hue Gradients**

Canvas周囲・Panel大面積はNeutralを基本とし、ColorはTool icon、Active state、Slider、Handle、Quick Hole、Focus、Page identity等へ集中させる。

同一Control内のGradientは原則として**同一色相Family内**で作る。Rainbow GradientをUI装飾として濫用せず、Color Wheel / Spectrum等、色そのものを扱うControlに限定する。

Default Semantic Tool Hue Family:
- Brush: Rose / Pink
- Eraser: Cyan
- Blend: Violet
- Fill: Green
- Selection: Magenta
- Transform: Orange
- Eyedropper: Blue
- Shape / Path: Coral
- Text: Indigo

Status ColorとTool Identity Colorを混同しない。Error / Warning / Success等はTool Family色とは別の意味体系を持つ。

#### 4.12.5 Surface / Radius / Spacing

基本Spacingは4px Gridとし、4 / 8 / 12 / 16 / 24 / 32を主要値とする。

Radiusの基準:
- Small control: 8px
- Button / field: 10px
- Panel block: 12px
- Floating PiP: 14px
- Major sheet: 16px

Quick Holeは六角形のため例外。

Panel全面を過剰なGlassmorphismにせず、Neutral surface + subtle border + restrained shadowを基本とする。PiP等で透明感を使う場合もArtwork色によって可読性が崩れないSurface opacityを確保する。

#### 4.12.6 Typography / Icon / Motion

TypographyはSystem Sansを基本とし、日本語はOS標準日本語Sansを利用する。極端に小さな文字で高機能感を演出しない。

目安:
- Metadata: 12px
- Standard UI: 13–14px
- Button / Control: 14px
- Panel title: 15–16px
- Major title: 18–20px

Iconは統一Stroke / silhouette systemを持ち、意味が不明確なIconにはTooltip / Accessible Nameを付ける。

通常Panel transitionは80〜160ms程度の短いMotionを基準とする。ただしBrush Stroke、Slider、Transform Handle等のDirect ManipulationにAnimation delayを挟まない。Motionはinterruptibleとする。

---

### 4.13 Feature-to-Route Matrix — 確定

Section 2の24カテゴリに対するPrimary routeを次のように確保する。

1. **Document / Canvas** → Main Menu > Document / View、View Page、Canvas direct navigation
2. **Drawing / Brush** → Tool Rail > Brush / Eraser / Blend、Properties、Brush Page
3. **Pen / Touch / Input** → Settings > Input / Gesture / Shortcut
4. **Color** → Color Page、Color Chip、Eyedropper
5. **Layers / Composite** → Layers Page、Properties、Layer Menu
6. **Selection / Mask** → Selection Tool、Properties、Selection Launcher、Selection Menu
7. **Fill / Region** → Fill Tool、Properties
8. **Lineart System** → Assist > Lineart、LayersのLineart Group、Canvas contextual editing
9. **Transform / Placement** → Transform Tool、Canvas handles、Properties
10. **Vector / Shapes** → Shape / Path Tool、Properties、Canvas direct nodes
11. **Ruler / Assistants** → Assist Page、Canvas direct assistant editing
12. **Liquify / Special Correction** → Filter / Command Searchから起動、Canvas direct mode、Properties。Repair系はBrush / Retouch route
13. **Filters / Color Correction** → Filter Menu、Layers > Effect、Properties / Effect detail
14. **Non-destructive Editing** → Layers > Effect / Modifier、Properties
15. **Text** → Text Tool、Canvas inline edit、Properties
16. **Reference / Production Support** → View > Reference / Navigator / View Anchors、PiP
17. **History / Automation** → History Page > History / Branch / Checkpoint / Auto Actions / Timelapse
18. **File / Project Management** → Illustro / Project Library、File Menu
19. **Workspace / Environment** → Workspace Menu、Settings > Workspace、Command Search
20. **Common Interaction System** → Canvas Direct / Quick Hole / Properties / Detail Settings / PiP
21. **Online / Collaboration** → Main Menu > Collaboration、active-session status UI
22. **Materials / Resources** → Assets Page
23. **Settings / Accessibility** → Settings
24. **Output / Color Management** → Export、Document > Color Profile、View > Soft Proof / Gamut / Proof Compare

このMatrixでPrimary routeが存在しない新機能をSection 5以降で発見した場合、実装へ進む前に導線を追加する。

---

### 4.14 Section 4 完了条件

Section 4は次を満たした時点で完了とする。

1. Application / Document / Tool / Canvas / Properties / Structureの役割が明確に分離されている。
2. Canvasが全Layout Regimeで主要領域として維持される。
3. Default Tool Rail、Right Sidebar 8 Page、Top Bar / Main Menu、Quick Hole、PiPの責務が確定している。
4. Quick Holeは円周上の6 Hex Tile、60°間隔、30°回転、Gapあり、左Undo / 右Redoとして確定している。
5. PiPはDrag-out Detachを基本とし、専用PiP buttonを置かず、PiPでもCollapse / Resize / Redockが可能である。
6. Selection / Transformの主要操作はCanvas Direct Manipulationで成立し、詳細値はPropertiesへ接続される。
7. Layer / Modifier / Source / Instanceの高度な内部Modelを通常UIへ過剰露出せず、必要な編集routeは失わない。
8. Wide / Medium / Compactで単純縮小ではないResponsive Recompositionが定義されている。
9. Pen / Touch / Mouse / Keyboardに一貫したInput ownershipと代替操作がある。
10. Feedback、Save / Error、Back / Esc、Recoveryの責務が定義されている。
11. Accessibility、Left / Right handed、Reduced Motion、UI Scale / Densityを製品仕様として扱う。
12. Visual SystemはNeutral Surfaceを土台にSemantic Colorと同一色相Gradientを使う。
13. Section 2の全ユーザー操作可能機能にPrimary GUI Routeがあり、Command SearchがGlobal fallbackとして機能する。
14. Gesture / Shortcut / Context Menuだけを唯一の機能入口にしない。
15. UIの美観や共通化のために直接操作Latencyを犠牲にしない。

以上をもってSection 4「全体UX / UI設計」を確定・完了とする。

次章では、Section 2で採用した各機能について、Toolごとの挙動、Parameter、状態遷移、Default、相互作用、詳細UIをSection 5「各機能の詳細仕様」として確定する。

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

TextureはAsset、Scale、Rotation、Offset、Strength、Invert、Blendに加え、Coverage (`Full` / `Edge-biased`)、Edge Width、Falloffを持つ。`Edge-biased`はTip中心部への影響を抑え、外縁側へTextureを作用させ、Solidな中心部を保ったまま微細な欠け / Density variation / Dry textureを付与する。Texture表現のためにAntialias品質を意図的に低下させない。Texture Strength / Edge influenceはDynamics SourceからMapping可能とする。

JitterはPosition / Size / Opacity / Rotation / Color等を独立調整。ScatterはParticle size / density / width / bias / directionを持つ。

乱数またはNoiseを使うPresetは、同一Stroke再編集 / History再現で視覚結果を再現できるSemantic Seedまたは安定した座標基準を保持する。

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

初期内蔵Presetは**41種**をBaselineとし、過剰な重複を避ける。

- Sketch 6: HB Pencil / 2B Pencil / Mechanical Pencil / Rough Pencil / Colored Pencil / Soft Graphite
- Ink 9: G Pen / Mapping Pen / Round Pen / Technical Pen / Brush Pen / Dry Ink / Felt Pen / Monoline / ととろペン
- Paint 8: Opaque Round / Flat Paint / Gouache / Acrylic / Soft Paint / Chalk Paint / Oil-like / Poster Brush
- Watercolor 6: Round Wash / Wet Wash / Edge Watercolor / Granulating Wash / Water Blend / Dry Watercolor
- Air / Spray 4: Soft Airbrush / Hard Airbrush / Fine Spray / Grain Spray
- Dry / Texture 5: Charcoal / Crayon / Pastel / Dry Media / Paper Grain
- Utility 3: Pixel 1px / Fill Brush / Soft Mask Brush

Preset名はLocalized表示可能だがStable internal IDを持つ。User presetを内蔵Preset更新で上書きしない。

##### 5.2.13.1 ととろペン

「ととろペン」はIllustro標準の汎用Ink Brush Presetとする。線画専用の特殊Penではなく、線画、ラフ、小面積の塗り、影、細部描き込みまで1本で扱える主力Brushを目的とし、G Penの単純上位互換にはしない。

基本Characterは **Solid Core + Character Edge** とする。中心部は高密度で安定した描画結果を維持し、外縁だけへ微細なInk / Dry textureを加える。

主要な固有挙動は次の5点とする。

1. 弱筆圧では細く軽快に描ける。
2. 中筆圧で線幅が明確に増加する。
3. 強筆圧では線幅変化を緩やかにし、太さが暴れにくい。
4. 高速Strokeでは少し細くなり、外縁のDry textureがわずかに強くなる。
5. Stroke終端は通常よりやや長く細く抜ける。

Pressure → Sizeは単純Linearではなく、中筆圧域の変化を強くし、高筆圧域で緩やかにPlateauするCurveをDefaultとする。

| Pressure | Size |
| --- | --- |
| 0% | 22% |
| 15% | 28% |
| 30% | 42% |
| 45% | 68% |
| 60% | 86% |
| 75% | 96% |
| 100% | 100% |

Stroke途中では極端な低筆圧で意図せず針状に細くなりにくいMinimum responseを持たせる。Exit TaperはこのMinimum responseとは独立し、終端ではさらに細くできる。

Speedは離散的Mode切替ではなく連続Dynamicsとして作用し、高速になるほどDefaultでSizeを最大約9%縮小、Densityを最大約4%低下、Edge Texture Strengthを最大約6%増加させる。高速StrokeのCharacterは主としてSizeとEdge Textureで表現し、Stroke全体を強く薄くしたり全面を激しくかすれさせたりしない。

Texture Coverageは`Edge-biased`をDefaultとする。中心部は原則Solidに保ち、外縁へ微細な欠け、Density variation、Ink / Dry mediaらしい輪郭を与える。中心部へ強いPaper grainや穴を生成せず、Texture表現のためにAntialias品質を低下させない。

TipはほぼRoundなCustom TipをDefaultとし、Aspect約98%、Hardness高め、Position Jitter 0、Rotation Jitter 0、Spacing約3–4% Diameterを基準とする。完全な幾何学円よりわずかに有機的な外周を許容するが、Stroke自体を揺らして個性を作らない。

DefaultはOpacity 100%、Flow 100%、Core Densityほぼ100%とする。弱筆圧時のみDensityを緩やかに低下させ、最低値は約82%を基準とする。軽さや質感を低Flowそのものから作らず、Pressure responseとEdge Textureを主に利用する。

Entry Taperは短く約0.5 Brush Diameter、Exit Taperは約1.5–1.7 Brush Diameterを基準とする。Taperは主にSizeへ作用し、Opacity fadeは弱くする。

StabilizationはPreset固有Characterには含めず、Preset DefaultのみRealtime約8–10%、Post-correction 0%を初期基準とする。ユーザーがStabilizationを変更しても主要Characterを維持する。

Tilt MappingはDefault OFFとする。ととろペンの基本CharacterをTilt対応Deviceへ依存させない。Pressure非対応InputではNeutral Pressure responseを用い、Speed response、Edge Texture、Tip Character、Exit Taperを維持する。

Region ConstraintおよびAbsolute / Relative Shade / Relative Light / Custom Relative Color Applicationは通常Brush共通機能として利用可能とし、ととろペン専用処理にはしない。

Default Brush Sizeは12 pxを初期基準とする。Preset Previewは弱筆圧 → 中筆圧 → 強筆圧 → 高速Stroke → Exit Taperを1 Stroke内で確認できる標準Previewを使い、Texture / Noiseは再現可能なSeedを使用する。

Preset説明文は次をDefaultとする。

> 中筆圧でぐっと太く、強筆圧では暴れにくい。速描きでは少し細く、縁だけ軽く乾き、長めの抜きが残る。線画、ラフ、塗りまで使えるIllustroの汎用ペン。

---

#### 5.2.14 Region Constraint

`Region Wash`のような専用Brushを別Toolとして増やさず、Region-aware paintingをBrush / Eraser / Blendの共通Constraintとして提供する。

Target:
- None
- Stroke-start Region: Pointer Down地点でResolveしたStable RegionへStroke全体を固定
- Selected Regions: 明示選択したStable Region集合
- Lineart Regions: Current Lineart GroupのResolved Region集合
- Selection: Active Selection Value

Boundary Crossing Policy:
- Hard Stop: Boundary外へ作用しない
- Soft Edge: Boundary内側で指定幅だけFalloff
- Pressure Gate: PressureがThresholdを超えた場合のみ隣Regionへ越境可能

Region ConstraintはPresetへ保存可能だが、特定DocumentのStable Region ID自体を通常Presetへ暗黙保存しない。Topologyがstaleな場合はStroke開始に必要な局所Regionだけを優先Resolveし、古いBoundaryへ黙ってFallbackして塗り漏らさない。

<!-- ILLUSTRO-V2-FULL:DETAIL:5.2 -->
#### 5.2.15 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

##### Brush共通 / Shared semantics

Brush / Eraser / Blend share stroke interaction but differ semantics:
- Brush adds Color / Alpha。
- Eraser reduces Alpha。
- Blend redistributes / smooths existing artwork。

Properties Quick:
1. Preset
2. Size
3. Opacity
4. Flow
5. Stabilization
6. Main / Sub Color

Advanced:
Tip / Spacing / Texture / Dynamics / Jitter / Scatter / Watercolor / Taper / Paint & Mixing / Behavior / Preview。

Size:
- Document-space default。
- Canvas-relative option in Settings。

Opacity:
- Stroke-wide effective alpha cap。
Density:
- Dab itself's local coverage / density。
Flow:
- Continued deposition normalized by travel distance。
- raw dab countではない。

Tip:
Round / Image / Custom / Multiple。
Parameters:
Aspect / Hardness / Initial Angle / Direction Follow / Horizontal Flip / Vertical Flip / Antialias。

Spacing:
- % Brush Diameter。
- very low spacingを性能都合でsilent raiseしない。

Dynamics Sources:
Pressure / Speed / Tilt / Rotation / Direction / Random。
Targets:
Size / Opacity / Density / Blur or Texture / Flow where supported / Relative Amount where supported。
Each mapping:
Enable / Min Influence / Max Influence / Curve。
Device missing source:
- mappingだけNeutral value。
- presetを破壊変更しない。

Stabilization:
- RealtimeとPost-correctionを分離。
- 0 = raw pathに最も近い。
- cursor/pathをfake qualityで遅延隠蔽しない。

Taper:
Entry Size / Exit Size / Entry Opacity / Exit Opacity / Forced Taper。
- finalizeで同期full-stroke replayを要求しない。

Texture:
Asset / Scale / Rotation / Offset / Strength / Invert / Blend / Coverage(Full, Edge-biased) / Edge Width / Falloff。
Edge-biased:
- solid centerを保護。
- outer edge中心。
- AA品質を意図的に落とさない。
Texture Strength / Edge InfluenceはDynamics mapping可能。

Jitter:
Position / Size / Opacity / Rotation / Color。
Scatter:
Particle Size / Density / Width / Bias / Direction。

Determinism:
- random/noise presetはsemantic seedまたはstable coordinate basis。
- same semantic state + same seed = same result。

Watercolor / Mixing:
Mixing / Water Amount / Color Extension / Transparent Mixing。
- Quick group + Detail。
- advanced physical fluid simulationは採用しない。

Anti-overflow / Paint Inside Lineart:
- Selection / Reference / Boundary source。
- lineart boundary freshnessを確認。
- required local areaをresolve。
- stale silent fallback禁止。

Recent Stroke Re-edit:
- Properties / History context。
- Size / Color / Opacity / Dynamics / Stabilization / Taper / compatible Brush。
- 後のsemantic editならnew transaction/revision。

Brush Morph:
- compatible A/B。
- 0-100%。
- incompatible parameter policyを明示。
- resultをnew preset保存可能。

Inherited Brush Family:
- child stores overrides。
- inherited link indicator。
- override accent。
- Reset to Inherited。
- parent changes propagate only to non-overridden fields。

Shared rules:
- Position Jitterでhand-drawnらしさを偽装しない。
- material characterはTexture/Dynamics中心。
- physical tiltだけを使う。
- speed mappingは有用な場合だけ。
- textureはcategory identityを壊さない範囲。
- no-pressure deviceでもpreset identity維持。
- previewはpreset personalityを伝える。

##### Sketch 6

1. HB Pencil
Default Size: 6 px
Tip/texture: fine graphite grain, Round/slightly irregular
Hardness: medium-high
Spacing: 3-4%
Opacity: 100%
Flow: ~90%
Pressure:
- Pressure->Size weak
- Pressure primarily controls Density
- minimum Size ~55%
Tilt:
- meaningful response begins around ~45°
- increases Size
- decreases Density
- broadens texture width
Texture: medium Canvas-fixed
Taper: short
Stabilization: low
Character: 「線幅より濃淡で筆圧が伝わる、素直な鉛筆」

2. 2B Pencil
Default Size: 8 px
Tip: softer / irregular
Hardness: medium
Flow: ~92%
Pressure:
- light-pressure Density higher than HB
- Pressure->Density medium
- Pressure->Size slightly stronger than HB
- minimum Size ~50%
Tilt: strong broad-area behavior
Texture: coarser than HB
Taper: short

3. Mechanical Pencil
Default Size: 2.5 px
Tip: hard round
Spacing: 2-3%
Opacity: 100%
Flow: 100%
Pressure:
- Pressure->Size very weak
- minimum Size ~75%
- Pressure->Density medium
Tilt: OFF
Speed: OFF
Texture: ultra-fine
Taper: minimal
Stabilization: low-medium
Position Jitter: 0

4. Rough Pencil
Default Size: 7 px
Tip: irregular graphite
Hardness: medium
Spacing: 4-5%
Flow: ~85%
Pressure:
- Pressure->Size medium
- Pressure->Density strong
Tilt: medium
Texture: strong
Edge: rough
Position Jitter: 0
Size Jitter: tiny
Speed: high speed slightly decreases Density
Taper: short
Stabilization: 0
Rule: roughness comes from texture, not artificial stroke-path jitter。

5. Colored Pencil
Default Size: 9 px
Tip/texture: wax / pigment fine grain
Hardness: medium
Flow: 85-90%
Pressure:
- Pressure->Size weak-medium
- Pressure->Density strong
Tilt: medium-strong
Texture: medium-strong, more uniform than graphite
Build: repeated strokes build pigment
Color Jitter: 0
Taper: short

6. Soft Graphite
Default Size: 24 px
Tip: broad soft graphite
Hardness: low-medium
Flow: 75-80%
Pressure:
- Pressure->Size medium
- Pressure->Density strong
Tilt:
- very strong
- increases Size
- softens edge
- decreases Density
- broadens grain
Texture: medium
Spacing: 3-4%
Taper: none
Stabilization: 0

##### Ink 9

1. G Pen
Default Size: 8 px
Tip: hard round
Pressure->Size: strong, minimum 18%
Exact Curve:
Pressure 0%   -> Size 18%
Pressure 15%  -> Size 24%
Pressure 30%  -> Size 36%
Pressure 50%  -> Size 55%
Pressure 70%  -> Size 75%
Pressure 85%  -> Size 90%
Pressure 100% -> Size 100%
Pressure->Opacity: OFF
Speed: OFF
Tilt: OFF
Texture: none
Taper: medium

2. Mapping Pen
Default Size: 4 px
Pressure->Size: medium-strong, minimum 28%
Exact Curve:
Pressure 0%   -> Size 28%
Pressure 20%  -> Size 34%
Pressure 40%  -> Size 47%
Pressure 60%  -> Size 64%
Pressure 80%  -> Size 82%
Pressure 100% -> Size 100%
Texture: none
Tilt: OFF
Speed: OFF
Pressure->Opacity: OFF

3. Round Pen
Default Size: 6 px
Pressure->Size: medium, minimum 35%, mild high-pressure plateau
Exact Curve:
Pressure 0%   -> Size 35%
Pressure 20%  -> Size 40%
Pressure 40%  -> Size 52%
Pressure 60%  -> Size 68%
Pressure 80%  -> Size 86%
Pressure 100% -> Size 100%
Texture: none
Tilt: OFF
Speed: OFF

4. Technical Pen
Default Size: 3 px
Tip: perfect round
Hardness: 100%
Spacing: 1.5-2%
Dynamics: all OFF
Texture: OFF
Taper: OFF

5. Brush Pen
Default Size: 14 px
Tip: slight oval
Aspect: 80-90%
Pressure->Size: very strong, minimum ~12%
Speed: high-speed Size reduction maximum ~5%
Tilt: weak
Taper: medium Entry, long Exit

6. Dry Ink
Default Size: 10 px
Tip: irregular
Texture: Full coverage, visible interior grain
Speed: higher speed increases texture/dryness
Distinction: unlike Totoro Pen, dryness is not restricted to edge-only texture。

7. Felt Pen
Default Size: 9 px
Hardness: 85-90%
Pressure->Size: weak, minimum ~70%
Texture: tiny
Taper: short

8. Monoline
Default Size: 7 px
Tip: perfect round
Dynamics: OFF
Texture: OFF
Taper: OFF
Stabilization: medium-high
Ends: rounded

9. ととろペン
Full specification: 5.2-I。

Curve PresetsはInk専用ではなくBrush Studio共通能力。

##### Paint 8

Paint Load 0-100%:
- stroke start時にloadするdrawing color quantity。
- supporting presetはtravel distanceでdeplete。
- Pen Up reload。
- redundant Attack parameterは追加しない。
- Water Amount = dilution。
- Color Extension = pull/stretch。
- Mixing = existing artworkとのmix。

1. Opaque Round
Default Size: 20 px
Hardness: 95-100%
Pressure->Size: medium

2. Flat Paint
Default Size: 28 px
Tip: flat
Aspect: 35-45%
Direction Follow: ON
Tilt/rotation: optional weak response / neutral fallback

3. Gouache
Default Size: 24 px
Tip: irregular / flat-round
Mixing: very weak
Paint Load: high
Texture: fine

4. Acrylic
Default Size: 30 px
Tip: flat-round bristle
Paint Load: high
Mixing: low
Texture: medium
Speed: slight texture increase

5. Soft Paint
Default Size: 36 px
Hardness: 25-35%
Flow: 60-70%
Pressure->Flow: strong
Mixing: weak-medium
Distinction: remains Paint, not Airbrush。

6. Chalk Paint
Default Size: 26 px
Texture: strong coarse
Texture Anchor: Canvas

7. Oil-like
Default Size: 32 px
Tip: flat-round bristle
Mixing: medium-strong
Paint Load: medium
Color Extension: medium
Water Amount: 0
Behavior: long stroke loses loaded drawing color; Pen Up reload。

8. Poster Brush
Default Size: 24 px
Hardness: 100%
Behavior: constant graphic / flat paint character。

##### Watercolor 6

Pigment Edge / Watercolor Edge:
- pigment density accumulation near watercolor stroke outer boundary。
- Edge-biased Textureとは別。
Fields: Strength / Width / Falloff。
- current pigment color/densityを利用。

1. Round Wash
Default Size: 28 px
Hardness: soft
Mixing: 30-35
Water Amount: 50-55
Color Extension: 20-25
Paint Load: 65
Pigment Edge: weak

2. Wet Wash
Default Size: 48 px
Mixing: 60-70
Water Amount: 80
Color Extension: 60
Paint Load: 45-50

3. Edge Watercolor
Default Size: 32 px
Pigment Edge: medium-strong
Width: 6-10%

4. Granulating Wash
Default Size: 36 px
Texture: deterministic Canvas-fixed Full texture
Strength: medium-strong

5. Water Blend
Category: Watercolor
Action Family: Blend
Drawing Color Contribution: none
Mixing/Pickup: very strong
Water Amount: 80
Color Extension: 75-85

6. Dry Watercolor
Default Size: 20 px
Tip: irregular
Water Amount: 10-15
Texture: Full strong + edge texture

##### Air / Spray 4

Airbrush Accumulation:
- Enabled / Rate。
- pointerが同じ位置付近でactiveな時間に基づく。
- distance-based Flowとは別。

Particle Size Mode: Relative / Absolute。

1. Soft Airbrush
Default Size: 80 px
Hardness: 5-10%
Flow: 20-25%
Pressure->Flow: strong
Airbrush Accumulation: medium

2. Hard Airbrush
Default Size: 50 px
Hardness: 70-80%
Flow: 30-35%
Airbrush Accumulation: enabled

3. Fine Spray
Brush Diameter: 60 px
Particle Size: 1-1.5 px
Particle Size Mode: Absolute
Density: medium-high
Distribution: mostly uniform
Pressure->Density

4. Grain Spray
Brush Diameter: 90 px
Particle Size: 2.5-5 px
Particle Size Mode: Absolute
Distribution: irregular
Density: low-medium
Scatter: wide
Seed: deterministic

##### Dry / Texture 5

Texture Anchor: Canvas / Stroke。
- Canvas: paper/granulation fixed to document surface。
- Stroke: bristle/dragged texture moves with stroke。
- Per-Dab anchor UIは初期仕様に入れない。

1. Charcoal
Default Size: 18 px
Tip: irregular elongated
Texture: strong paper
Tilt: very strong

2. Crayon
Default Size: 14 px
Tip: irregular stick
Texture: medium-strong

3. Pastel
Default Size: 24 px
Tip: broad soft irregular
Texture: strong grain

4. Dry Media
Default Size: 22 px
Tip: flat-round irregular
Texture: neutral medium surface
Speed: slight speed->texture

5. Paper Grain
Default Size: 120 px
Tip: soft
Purpose: texture-application brush
Color/Alpha: current Color / Alpha through Canvas-fixed grain
Accumulation: Build-up

##### Utility 3

Raster Coverage Mode: Normal / Pixel-aligned。
Preset Target Scope: eligible target family metadata。

1. Pixel 1px
Size: exactly 1 Document Pixel
Tip: 1x1
Antialias: OFF
Coverage: binary
Dynamics: OFF
Canvas-relative Brush Size: ignored
Alignment: document pixel grid

2. Fill Brush
Display name candidate: Solid Fill Brush
Internal ID may remain: fill_brush
Default Size: 48 px
Hardness: hard / solid
Interior: consistent solid coverage

3. Soft Mask Brush
Preset Target Scope: Mask / Selection / Quick Mask / compatible coverage targets
Incompatible normal color target: disabled with reason
Default Size: 80 px
Hardness: soft
Flow: 25-30%
Pressure->Flow/Coverage: strong
Brush/Add increases coverage
Eraser/Subtract decreases coverage

##### ととろペン / Totoro Pen

Purpose:
- Illustro universal main Ink preset。
- lineart / rough / small fills / shadow / detail。
- G Penの単純上位互換ではない。

Character: Solid Core + Character Edge。

Core behavior:
1. weak pressure = fine/light。
2. medium pressure = clearly widens。
3. strong pressure = plateauしてwidth instabilityを抑える。
4. high speed = slightly narrows + edge dry texture rises。
5. exit = longer/thinner taper。

Pressure->Size exact curve:
Pressure 0%   -> Size 22%
Pressure 15%  -> Size 28%
Pressure 30%  -> Size 42%
Pressure 45%  -> Size 68%
Pressure 60%  -> Size 86%
Pressure 75%  -> Size 96%
Pressure 100% -> Size 100%

Minimum response:
- stroke途中のneedle-thin accidental responseを防ぐ。
- Exit Taperは独立しminimum以下へ行ける。

Speed dynamics:
- Size maximum reduction ≈9%
- Density maximum reduction ≈4%
- Edge Texture Strength maximum increase ≈6%
- continuous response。

Texture Coverage: Edge-biased。
Center: solid。
Edge: subtle chip / density variation / dry ink character。
AA: textureのために意図的に劣化させない。

Tip: nearly round Custom Tip
Aspect: ≈98%
Hardness: high
Position Jitter: 0
Rotation Jitter: 0
Spacing: ≈3-4% Diameter

Opacity: 100%
Flow: 100%
Core Density: near 100%
Weak-pressure minimum Density: ≈82%

Taper:
Entry: ≈0.5 Brush Diameter
Exit: ≈1.5-1.7 Brush Diameter
Primary target: Size
Opacity fade: weak

Stabilization:
- brush characterそのものではない。
Preset default Realtime: ≈8-10%
Post-correction: 0%

Tilt: default OFF。

No-pressure fallback:
- neutral pressure response。
- Speed / Edge Texture / Tip Character / Exit Taperは維持。

Region Constraint / Relative Color:
- shared common features。
- Totoro-specificではない。

Default Size: 12 px。

Standard Preview:
weak pressure -> medium -> strong -> fast -> exit taperを1 stroke内。
Stable seed。

Default description:
「中筆圧でぐっと太く、強筆圧では暴れにくい。速描きでは少し細く、縁だけ軽く乾き、長めの抜きが残る。線画、ラフ、塗りまで使えるIllustroの汎用ペン。」

##### Brush Studio / Common Settings

Wide layout: Category | Parameter Editor | Test Pad。
Tablet/Phone: same IAをsheet/collapseで再構成。Desktop縮小コピー禁止。

Top categories:
Basics / Tip / Stroke / Dynamics / Taper & Stabilization / Texture / Scatter & Airbrush / Paint & Mixing / Color / Behavior / Preview。

Quick Override model:
Preset Definition -> Active Runtime Brush State -> Quick Override。

Quick changes that do not dirty preset:
- Size
- Opacity
- Flow
- Stabilization

Last-used quick values: local user/runtime state。
Explicit: Save Current Values as Preset Defaults。

Built-in: Factory Definition + Local Override。
Reset: Parameter / Category / Brush。
Built-in update never overwrites user preset。

Dynamics mapping row:
- one row per target。
- Enable / Source / Min/Max Influence / Curve。

Curve Presets:
Linear / Ease In / Ease Out / S / Reverse / Custom。
Composition: deterministic / order-independent semantics。Exact formula Section 9。

Test Pad Input Simulator:
Pressure / Speed / Tilt / Rotation。
Modes: Actual / Simulated。
Standard Preview: fixed stroke + capability samples + stable seed。

Consolidated parameters:
Paint Load / Pigment Edge / Airbrush Accumulation / Particle Size Mode / Texture Anchor / Raster Coverage Mode / Preset Target Scope。

Do not adopt:
- global parameter locks
- Dual Brush
- engine-name clutter
- device-dependent setting disappearance
- visibly low-quality preview
- all parameters in Properties

##### Brush Deposit / Alpha Accumulation

Canonical conceptual pipeline:
Tip Shape -> Hardness/AA -> Texture -> Density -> Dynamics -> Distance/Time Deposit -> Accumulation -> Stroke Opacity/Composition。

Opacity:
- stroke-wide effective alpha ceiling。
- Capped modeでは同じPen Down self-overlapがceilingを超えない。

Density conceptual local contribution:
Tip Coverage x Density x Texture x Dynamics。

Flow:
- distance-normalized deposition rate。
- raw dab countではない。

Accumulation Mode:
1. Capped
2. Build-up

Capped:
- normal Brushes / Washes / Masks。
- same-stroke overlap respects stroke ceiling。

Build-up:
- same stroke keeps depositing toward full。
- Air / Spray / Paper Grain / selected texture presets。

Airbrush Accumulation:
- separate time-based deposition。

Spacing Compensation:
- default ON。
- spacing変更時のdistanceあたりdepositを概ねstableにする。
- stamp/scatter semanticsではOFF可能。

Legacy rationalization:
- Opacity Saturation -> Accumulation Mode。
- Constant Opacity -> Spacing Compensation。
- Decrease Opacity -> canonical control削除。
- Add Opacity -> import/compatibility-only if required。

Mixing: coverage/depositとは別。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.2 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.6 -->
#### 5.6.14 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Selection value:
- continuous 0-100% Coverage。
- binary only where target format explicitly requires it。

Creation lifecycle:
Gesture / Parameter Edit -> Live Candidate Selection -> Selection Mode composition -> Frozen Active Selection。
Candidate: no Document History。
Commit: 1 Selection Transaction。
Logical selection existence does not wait full-canvas rasterization。

Modes:
- New
- Add
- Subtract
- Intersect

Desktop temporary modifiers:
- Shift = Add
- Alt / Option = Subtract
- Shift + Alt = Intersect

Empty selection:
- Add ≈ New
- Subtract disabled
- Intersect disabled

Common:
Antialias: ON default
Feather: 0 default
Creation Feather: candidateへmode composition前に適用。

Lasso:
- drag path
- release closes
- closing segment preview
- minimal smoothing
- Refine Pathはeligible sourceでoptional後編集。

Rectangle / Ellipse:
- Free
- 1:1
- Fixed Ratio
- Fixed Size
- From Center
- live W x H readout
- release commit

Polygon:
- Tap = vertex
- Double Tap = close
- Enter = close
- Tap start point = close
- Backspace = delete last vertex
- Esc = cancel
- next segment live preview

Brush Selection dedicated coverage editor:
- Size 40
- Hardness 100
- Strength 100
- Flow 100
- Stabilization 0
Optional:
- Pressure->Size weak-medium
- Pressure->Strength
Default: Strength fixed。
No Texture / Scatter / Watercolor。
Advanced painting: Quick Mask。

Auto / Magic:
- contiguous only。
Properties:
- Tolerance
- Reference
- Sample Radius: Point / 3x3 / 5x5
- Antialias
- Close Gap
- Area Scale
Interaction:
- simple Tap = immediate candidate/result
- Tap+Hold+horizontal drag = live Tolerance HUD
Shared Region Resolver where topology semantics apply。

Color Range:
- non-contiguous across reference。
Live session:
- Sample
- Add Sample
- Remove Sample
- Fuzziness
- Locality Global / Localized
- Radius
- Preview
- Apply
- Cancel
Preview: overlay。
Apply: 1 Selection Transaction。

Magnetic:
Properties:
- Detection Width
- Edge Sensitivity
- Anchor Spacing
- Reference Source
Interaction:
- Drag = continuous trace
- Tap = anchor construction
- manual anchors
- Backspace = last anchor
- close
- Esc cancel
Semantic: corridor edge tracing, not object segmentation。

Enclose Selection:
- gesture is search scope。
- result is resolved region set。
Properties:
- Reference Source
- Target Rule
- Tolerance
- Close Gap
- Area Scale
- Antialias
- Shared Region Resolver

Selection Display:
- Outline
- Mask Overlay
- Hidden

Default Outline:
- Contrast Halo
- Magenta/Violet accent
- screen-space visual thickness
- 50% Coverage isoline

Mask Overlay:
- tints unselected side。
Hidden:
- selection remains active。
- Properties shows `Selection Active`。
Soft selection editing may temporarily combine overlay。

Selection Launcher default:
Transform / Fill / Cut / Copy / Invert / Deselect / More。
Placement:
- avoid UI
- avoid hand/pen occlusion
- stable during interaction
- manual drag persists until new selection

Expand / Contract:
- live preview
- px
- Corner Round / Sharp
- Apply = 1 transaction

Feather:
- one primary radius
- symmetric boundary softening

Smooth:
- distinct from Feather
- More only

Invert:
S' = 1 - S。

Move Selection:
- moves Coverage only。
- artwork unchanged。
Transform:
- moves artwork。
Nudge:
- Arrow 1 Document px
- Shift+Arrow 10 Document px

Quick Mask:
- transient internal Undo/Redo
- Done = 1 Selection Transaction
- Cancel = pre-Quick-Mask restore
- explicit `Editing Selection Mask`
- never silently retarget artwork paint

Refine Path:
Eligible: Lasso / Polygon / Magnetic。
Invalid after modifiers that destroy source correspondence。

Recent Selection Registry:
- 20
- Pin
- thumbnail
- type
- time
- bounds
- no duplicates
- display/mode changes do not add entries

Saved Selection:
- stable ID
- name
- thumbnail
- frozen coverage
- explicit update

Layer Alpha <-> Selection / Mask:
- continuous coverage。

Selection Recipe:
- deterministic。
- Apply gives Frozen。
- Bind Live explicit。

Live source missing:
- Rebind
- Freeze Last Valid
- Unbind
- no silent stale use。

No dedicated Select and Mask workspace。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.6 -->


### 5.7 塗りつぶし / 領域処理

#### 5.7.1 Fill Family

Default SubtoolsはFlood Fill、Continuous Fill、Enclose Fill、Pattern Fill、Flatting Seed。GradientはColor / Fill系機能だが独立Family ButtonにはせずFill / Color routeから起動する。

#### 5.7.2 Flood Fill

Properties:
- Tolerance
- Boundary basis: Color / Opacity
- Gap detection / Gap close
- Expand / Contract
- Under-line expansion
- Reference source
- Anti-alias
- Transparent / erase mode

Tapでseedを指定し、結果は即Canvasへ反映。必要Region resolveを優先し、Canvas全面解析をTap応答の前提にしない。

#### 5.7.3 Reference Source

Current Layer / Reference Layer / Visible Composite / Lineart Boundaryを明示選択。Reference Layerが複数ある場合はresolved setをPropertiesで確認可能。Missing referenceは無反応にせずreason表示。

#### 5.7.4 Live Tolerance

Fill直後または専用gesture中にToleranceを連続変更し、Current Effective Resultを即更新できる。確定まで同一Continuous Transaction。EscでInteraction Baseへ戻る。

#### 5.7.5 Continuous Fill / Swipe Fill

Drag中に通過したRegionを追加し、同一Regionへの重複Applyを避ける。Backtrack Cancelが有効なModeでは軌跡を戻ることで直近追加Regionを解除可能。

#### 5.7.6 Enclose Fill / Enclose Erase

Lasso状に囲った範囲を一括Fill / Eraseする。従来型のPixel interior処理を維持した上で、Illustro独自のStable Region targetingを選択できる。

Target Interpretation:
- Interior Pixels: 囲み内部のPixel領域を通常のEnclose Fillとして処理
- Stable Regions: 囲みGestureからStable Region集合をResolveしてRegion単位で処理

Stable RegionsのMatch Mode:
- Seed Inside: Region representative / seedが囲み内にあるRegion
- Fully Inside: Region全体が囲み内にあるRegion
- Touched: 囲み内部または囲みStrokeに触れたRegion

DefaultはInterior Pixelsとし、Stable RegionsはPropertiesから明示選択する。囲みGeometryのRelease後に結果を即成立させ、offscreen全解析を同期必須にしない。

#### 5.7.7 Gap Paint / Closed-area Fill / Contour Fill

Gap PaintはBrush-like inputで小さな塗り残しを対象。Closed-area Fillは閉領域候補を連続検出。Contour Fillは複数色 / lineから囲まれた範囲を指定方式で補間する。各ModeはPropertiesで作用範囲を明示する。

#### 5.7.8 Persistent Region Fill

Lineart Stable Region IDへColor Assignmentを関連付ける。Lineart変更後のSplit / Mergeでは自動再対応付け結果を表示し、曖昧な場合はManual Overrideを要求する。誤ったRegionへ黙ってColorを移さない。

#### 5.7.9 Leak Diagnostics

Fillが意図せず外へ漏れた場合、`Diagnose Leak`でLeak Path / Gap CandidateをCanvas Overlay表示。候補選択でAssist > Lineart / Gap Closeへ移動できる。Diagnostics自体はArtworkを変更しない。

#### 5.7.10 Region Sweep

Pointer pathが通過したStable Regionを連続Resolveし、Region集合へAdd / Remove / Toggleする。Fill Family内では、ざっくりStrokeで触れたRegion群をまとめてFill / Eraseする用途をPrimaryとする。

Backtrackで直近追加Regionを取消可能。Releaseで1 TransactionとしてCommit。Sweep中の対象Regionはhighlightし、既追加Regionを視覚識別する。

Region SweepのGesture→Region集合Resolve semanticsはSelection / Mask等からも再利用可能とし、Toolごとに別のRegion判定規則を作らない。

---


Resolved Region Boundaryからの距離を入力としてFill結果を生成する。独立BrushではなくFill Styleとして扱う。

Properties:
- Side: Inner / Outer / Both
- Width
- Falloff Curve
- Opacity Curve
- Color Application: Absolute / Relative

用途例はEdge Shadow、Inner Glow、Cel-shading edge band、Watercolor-like edge darkening。Boundaryが未確定の場合は対象Region周辺だけResolveし、誤った旧Boundaryで確定しない。

<!-- ILLUSTRO-V2-FULL:DETAIL:5.7 -->
#### 5.7.11 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Canonical stages:
1. Reference
2. Region Detection
3. Boundary Correction
4. Application

Reference:
- Current Layer
- Reference Layer
- Visible Composite
- Lineart Boundary

Reference Revision:
- fixed during one Continuous Transaction。
- prevents self-feedback。

Detection:
- Tolerance
- Sample Radius where applicable

Application:
- Application Opacity default100%
- color / erase / relative application

Boundary Basis:
- Color
- Opacity
Lineart: topology-based when selected。

Flood Fill:
Tap seed -> Candidate Region -> Boundary Correction -> Visible Result -> Commit。
Tap+Hold: horizontal drag live Tolerance HUD。

Close Gap:
- independent of Tolerance。
- virtual bridge only。
- optional Show Gap Bridges。
- leak diagnostics。

Area Scaling:
- +/- px
- Corner Round / Sharp

Under-line Completion:
- Off
- Adaptive
- distinct from Area Scaling。
- extends under AA / line band。

Antialias:
- affects output boundary Coverage, not detection semantics。
- default ON。
- Pixel / 1bit may default OFF。

Selection:
- clips final fill。
- no Ignore Selection toggle。

Erase:
- same resolver。
- alpha clear/reduction semantics。

Continuous Fill:
- Any Touched default
- Match First
- deduplicate regions
- highlight resolved set
Backtrack Undo:
- optional
- default OFF for Continuous Fill

Region Sweep:
- default Backtrack Undo ON
- generic set builder
- Add / Remove / Toggle
- dedup
- release 1 transaction

Enclose interpretations:
- Lasso Area
- Closed Regions
- Stable Regions
Region Match:
- Any Inside default
- Fully Inside
- Touched

Release:
- logical result immediate。
- no full-global synchronization requirement。

Quick Properties:
Color/Application / Tolerance / Reference / Boundary Basis / Close Gap / Under-line Completion / Area Scaling。
Advanced:
Antialias / Application Opacity / Scaling Corner / Sample Radius / Gap Preview / Continuous Mode。

##### SHARED REGION RESOLVER / STABLE REGION / PERSISTENT FILL

Strict separation:
- Region Detection
- Stable Region Identity
- Region Application

Resolver Input:
- Source
- Source Revision
- Gesture: Tap / Sweep / Enclose / Explicit Pick
- Match Rule
- Boundary Policy
- Existing Set
- Selection Constraint

Resolver Output:
- Resolved Region Set
- Stable Region refs
- geometry
- status
- diagnostics

Consumers:
- Fill
- Selection
- Mask
- Brush / Eraser / Blend Region Constraint
- Lineart inspection
Rule: consumer tools cannot reinterpret boundaries independently。

Gesture semantics:
Tap = containing region。
Sweep = crossed regions。
Enclose = regions satisfying selected match rule。
Explicit Pick = exact chosen region。

Region Set operations:
- Replace
- Add
- Remove
- Toggle

Hover preview where hover exists。
Touch requires no mandatory delay before region result。

Stable ID:
- retain only with clear 1:1 logical continuity。

Topology outcomes:
- Continued
- Split
- Merge
- Removed
- New

User-facing status:
- Current
- Updating
- Ambiguous
- Retired

Matcher may use:
- geometry
- spatial relation
- neighbor relation
- owner/group
- lineage
Exact scoring: Section 9。

Optional Region Name separate from ID。

Incremental topology:
- affected = Updating
- unaffected = Current
- needed local region priority
- never silently use stale topology

Persistent Fill:
Stable Region Ref + Fill Assignment -> topology-derived output。

Assignment fields:
- Region Ref
- Application
- Target
- Status
- User Override

Split: children inherit assignment。
Merge:
- all equivalent assignments -> inherit
- conflicting assignments -> Conflict
- Assigned + Unassigned -> Conflict
New with no lineage -> Unassigned。
Removed -> orphaned/retired assignment。

Ambiguous:
- no nearest silent remap。
- show ghost old region + candidates。
- manual rebind。

Manual Rebind:
- Rebind
- Bind to Multiple
- Clear
- Keep Unresolved

Unresolved visual:
- Last Valid Visual diagnostic only。
- warning required。
- Export / Flatten / Bake requires Resolve OR explicit Last-valid output choice。

Preflight surfaces unresolved/conflicts。

Topology inheritance/remap follows lineart transaction。
Explicit recolor = separate transaction。

Stable Region -> Selection:
- Frozen default
- Live explicit

Brush Stroke-start Region:
- resolve at pointer down
- fixed set for stroke
Selected Regions:
- fixed set for stroke

Named Region Set distinct Saved Selection。
Region Inspector optional。

Confidence simplified normal UI:
- Current / Problem
Heatmap diagnostics only。

Architecture:
Tap/Sweep/Enclose/Pick -> Resolver -> Stable Region Set -> Fill/Selection/Brush Constraint。
Persistent Fill and live/frozen bindings sit above。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.7 -->


### 5.8 線画システム

#### 5.8.1 Lineart Group作成

Layers `+ > Lineart Group`または選択Layerから`Create Lineart Group`。1 Layer / Multiple LayersをSourceとして指定可能。GroupはVisible lineart childrenとBoundary topologyを関連付ける。

#### 5.8.2 Boundary Preview

Assist > LineartでShow / Hide、Color、Opacity、Widthを変更。DefaultはArtworkを邪魔しないCyan系細線。PreviewはArtwork exportへ含めない。

#### 5.8.3 Auto Boundary Generation

Lineart Group作成 / source変更後にincremental generationを開始。Active viewport / requested regionを優先。Generation中もDrawingをBlockingしない。

Endpoint / Junction / normal boundary nodeをCanvas overlayでinspection可能。

#### 5.8.4 Gap Bridge

Auto bridge candidateはConfidenceを持ち、High confidenceは通常Boundaryとして利用可能。Low confidence / ambiguousはUnresolvedとして表示し、Fill利用時に必要Regionで明示resolveする。

`Reject`したcandidateにはNo-Reconnect Constraintを保存し、同条件で自動復活しない。

#### 5.8.5 Manual Boundary Editing

Assist > Lineart `Edit Boundary`でAdd / Connect / Remove / Split / Disconnect / Reject Auto Bridge。Manual editはdistinct provenanceを持ち、incremental regenerationで勝手に上書きしない。

既存Commandに加えてBrush-like interactionとしてBoundary Pen / Boundary Eraserを提供する。Boundary PenはVisible artworkへPixelを描かず論理Boundary segmentを連続追加し、Boundary Eraserは通過したmanual / eligible auto boundaryを除去候補としてPreviewする。Endpoint付近ではConnect semanticsを利用できる。

Node / handle操作はCanvas上Direct、exact coordinate / relationはProperties。

#### 5.8.6 Virtual Union Boundary

複数Boundary sourceを1つのvirtual unionとしてFill / Selectionへ供給可能。Unionはsourceを物理mergeせずreference setとして扱う。

#### 5.8.7 Incremental Regeneration

Lineart変更後はAffected areaをstale表示可能。現在使おうとしているFill / Selection regionのfreshnessを優先し、古いTopologyを黙って使わない。全Document再生成完了をBrush strokeの条件にしない。

#### 5.8.8 Transform / Liquify Sync

Lineart GroupをTransform / Liquifyした場合、Boundary / Region relationも意味的に同期する。Derived topology更新が必要でもCurrent Effective visual resultを優先する。

#### 5.8.9 Confidence Heatmap

Assist > Lineart DiagnosticsでBoundary confidenceをheatmap表示。通常制作では非表示。Unresolved / rejected stateは色だけでなくpattern / iconでも識別可能。

#### 5.8.10 Stable Region ID

Region inspectionでStable ID、lineage、Current statusを確認可能。通常ユーザーへID文字列を露出せず、Named / visual regionとして扱う。

Split / Merge発生時、Persistent Fill等のdependent featureへstatus badgeを出す。Manual rebind可能。

#### 5.8.11 Topology Diff

Lineart更新後のNew / Deleted / Split / Merge / Connection ChangeをDiagnosticsで一覧化。通常は問題があるdependent featureだけにbadgeを出し、毎回Modalを出さない。

---

#### 5.8.12 Region Hint Pen

Lineart Group編集時だけ利用できる不可視のTopology auxiliary inputとする。Artwork LayerへColor / Alphaを描かない。

Modes:
- New Region Hint: painted areaを新しいRegion seed / membership hintとして登録
- Add to Region: 選択中Regionのmembership hintを曖昧領域へ拡張
- Erase Hint: manual hintを除去

Region HintはAccepted explicit BoundaryをDefaultでは越えない。Boundaryを無視してHintを跨がせる場合は明示Override操作を要求する。Auto Boundary regenerationはmanual Region Hintを勝手に破棄しない。

通常Layer一覧へRegion Hint Dataを独立Color Layerとして並べず、Lineart GroupのAssist / Diagnosticsから編集する。

<!-- ILLUSTRO-V2-FULL:DETAIL:5.8 -->
#### 5.8.13 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Canonical pipeline:
Visible Lineart Source -> Source Evidence -> Auto Boundary + Accepted Gap Bridge + Manual Boundary - Manual Suppression -> Ideal Boundary -> Region Topology -> Fill / Selection / Brush Constraint。

Lineart Group = Source + Logical Boundary + Region Topology container。

Per-source:
Boundary Source: ON/OFF
Analysis: Auto / Alpha / Luminance
Solid-area Handling: Auto / Edge
Role: Normal / Ignore

Visibility != boundary participation。
Hidden source may remain boundary-active with indicator。

Vector source:
- path geometry = high-precision evidence。
- open path can be boundary。
Raster:
- alpha/luminance/edge evidence。
Raster Line Interpretation: Auto default / Alpha / Luminance。
Solid Area Edge Detection advanced Auto。

Auto Boundary states:
Accepted / Candidate / Unresolved / Rejected。
Confidence internal; no normal-UI percentage。

Gap Bridge:
- logical
- non-rendering
Auto Bridge Max Gap: small default。
Factors:
- endpoint proximity
- direction continuity
- edge evidence
- competing endpoints
- existing geometry
Exact score Section 9。

Fill encountering local unresolved gap:
`Possible boundary gap`
Actions: Connect / Keep Open / Edit。
No global modal。

Reject:
- creates No-Reconnect Constraint until reset or invalidating geometry change。

Manual internal types:
Segment / Connection / Suppression / Rejected Bridge。

Boundary Pen:
- logical only
- endpoint snap default ON
- Snap Radius
- endpoint preview

Boundary Eraser:
- deletes manual boundary
- erasing auto creates Suppression Constraint
- bridge erase can reject
- red/dashed preview
- release one transaction

Connect = manual connection。
Disconnect = cut junction / suppression where relevant。
Split = logical node。
Remove = delete manual / suppress eligible auto。
Manual > auto regeneration。

Region Hint:
- topology/identity membership hint
- not boundary
- not color
Modes: New / Add / Erase。
Default does not cross accepted boundary。
Uses: stable tracking / ambiguity / weak boundary / persistent remap。

Virtual Union retains source provenance。

Incremental regeneration:
- local priority
- no full topology per sample

Transform:
- group transform moves boundary/regions immediately。
Source-layer-only transform:
- update affected relation。
Liquify:
- deform lineart + Ideal Boundary + stable region geometry together, then local reconcile。

Topology Diff:
New / Deleted / Split / Merge / Connection Change。
No modal unless dependencies impacted。

Boundary Confidence != Region Status。
Accessibility: line style/icon + color。
Leak Diagnostics: probable leak -> Bridge / Boundary Pen / Ignore。
Lineart Group not required for basic Fill。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.8 -->


### 5.9 変形 / 配置

#### 5.9.1 Transform Entry / Target

Tool Rail TransformまたはSelection Launcherから起動。TargetはCurrent Layer / Multiple Layers / Selection / Whole Canvas / eligible Object。

起動時にBounding BoxとPropertiesを表示。Transform中も元Target identityを維持し、選択変更は明示操作とする。

#### 5.9.2 Modes

Default modes:
- Move
- Scale / Rotate
- Free Transform
- Distort
- Skew
- Perspective
- Mesh
- Puppet Warp

Mode切替は同一Continuous Transaction内で可能。Mode変更だけではCommitしない。

#### 5.9.3 Direct Handles

Bounds interior drag=Move、Corner=Scale、Edge=axis adjustment、Rotate affordance=Rotate、Pivot drag=Pivot。Distort / Perspective / Meshではmode-specific handlesへ切替。

Touch hit targetとvisual handle sizeを分離する。

#### 5.9.4 Numeric Transform

PropertiesにX / Y / Width / Height / Scale% / Angle。Aspect lock、relative input、unit-aware input対応。Canvas dragとNumeric inputが同じCanonical Parameterを更新する。

#### 5.9.5 Snap / Smart Guides

SnapはGrid / Guide / Object / Canvas center / Frame / Ruler等のsourceを個別toggle可能。Snap成立時はline / point indicator + small labelを表示。強制Snapを一時無効にするmodifierを持つ。

#### 5.9.6 Resampling

Raster transformのInterpolationはNearest / Bilinear / Bicubic / Area / Lanczos2 / Lanczos3。DefaultはBicubic。Pixel art modeではNearestをQuick choiceへ出す。

#### 5.9.7 Align / Distribute

Multiple targetsでCanvas / Selection / Key Object基準を選び、Left/Center/Right、Top/Middle/Bottom、Equal spacingを実行。Key Objectは明示選択。

#### 5.9.8 Repeat / Mirror Repeat

Repeat X/Y、Mirror Repeat、PhaseをPropertiesで設定し、Canvas上ghost instancesを表示。Defaultはnon-destructive repeat modifier。Bakeは明示。

#### 5.9.9 Non-destructive Transform / Stack

`Add to Transform Stack`をPrimary non-destructive routeとする。StackはLayers / PropertiesでAdd / Reorder / Edit / Disable / Remove。

Transform ToolでStack entryを選択するとCanvas handlesへ戻れる。

#### 5.9.10 Transform Variant

Current transform parameter setをVariantとして保存。A/B compare、rename、apply。Variant switchingはInteractive comparison、Applyでcurrent modifier stateをCommit。

#### 5.9.11 Persistent Layout Constraint

Center / Equal Spacing / Axis Alignment / Linked Position等をConstraintとして追加。Constraint active時のManual dragはsolver resultをInteractive表示。Constraint解除で現在位置を保持するかoriginal relationへ戻すかを明示Commandで選ぶ。

#### 5.9.12 Commit / Cancel

`✓` / EnterでCommit、`×` / EscでCurrent Interaction Cancel。Continuous Transaction全体のRevertは別Command。Tool切替時Defaultはcurrent valid transformをCommitするが、destructive ambiguous modeでは確認ではなくContext BarにCommit / Cancelを明示する。

---

<!-- ILLUSTRO-V2-FULL:DETAIL:5.9 -->
#### 5.9.13 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Transform Session fixes at Begin:
- Target
- Source Revision
- Initial Transform
- Selection/Mask state

Raster preview/final:
- always Session Source + accumulated transform。
- never repeated destructive resampling。

Target vocabulary:
Current Target / Multiple Targets / Selected Content / Selection Shape / Whole Artwork。

Selection Launcher Transform default: Transform Selected Content。
Separate: Transform Selection。
Properties shows current target。

Selected raster content:
- internal Transient Transform Payload。
- no visible floating layer。
Commit atomically: source clear/update + transformed result + transformed selection state。
Soft Selection continuous coverage preserved。

Active Selection follows transformed selected content default。
Advanced: Keep Selection in Place。

Multi-layer selected content preserves ownership; no flatten。

Bounds: transformable content / selection / union。
Advanced candidate Bounds Source: Layer / Selection / Canvas。

Pivot:
- center default
- 3x3 locator
- direct drag anywhere
- used by rotate / pivot-scale / repeat

Scale:
- corner anchored opposite handle
- temporary/touch Scale from Pivot
- aspect lock ON default
- corner uniform
- interior move
- rotate affordance
- edge axis scale
- unlock nonuniform

Free Transform: Move / Nonuniform Scale / Rotate / Skew。
Distort: independent corners。
Skew: parallel edge。
Perspective: coupled projective。

Mode switch:
- preserves accumulated composition
- no commit
- evaluate from original Session Source

Rotation:
- continuous
- temporary 15° constraint
- 90 CW / 90 CCW / 180
- Flip H / Flip V

Numeric:
Position X/Y / Size W/H / Scale X/Y% / Rotation° / Pivot locator。
Coordinates use selected Reference Locator in Document coordinates。
Relative input supported。

Nudge: arrow 1 Document px; Shift 10 Document px。

Snapping categories:
Positional: Grid / Guide / Object / Canvas Edge / Canvas Center / Frame / Selection。
Angular: angle increments / Ruler / Assistant。
Pixel: Document Pixel Grid。

Activation threshold screen-space。
Geometry document-space。
Feedback: guide line / snap point / semantic label。
Temporary bypass available。
Hysteresis required。

Pixel Snap:
- OFF default normal workflow
- Quick ON candidate Pixel Art
- integer translation / bounds / pivot
- recommend Nearest
- do not silently switch

Resampling:
Default Bicubic。
Pixel Nearest。
Strong downscale Area/Lanczos。
Final high-quality Lanczos where appropriate。
No cumulative preview resampling。
No silent per-operation switch。

Transform Stack entry minimum:
Enabled / Mode / Parameters / Pivot / Interpolation / Mask-Scope / Name。

Everyday Selection Transform:
- do not force Stack
- Direct default
Whole Layer/Object:
- Direct / Add to Stack
- last-used per target candidate
- smart/linked object nondestructive recommended

Multi-target: As Group default / Individually。
Parent+child normalization avoids double transform and shows target count。

Layer Mask:
- linked follows owner
- unlinked stays

Outside Canvas content preserved; Trim/Crop explicit。

Align/Distribute:
Reference Canvas / Selection / Parent Group / Key Object。
Equal Centers vs Equal Gaps。
Ghost preview。
1 transaction。

Mesh:
Rows/Columns / multi-point selection / reset selected / reset mesh / changing density preserves deformation as much as possible。

Puppet:
Add/Move/Delete/Rotate Pin / Rigidity / Influence。

Transform Variant: parameters only, no source copy。

Persistent Layout Constraints:
- stable object targets only
- Axis / Center / Equal Gap / Linked Position / Equal Size
- solver live
- bypass explicit
- Break explicit

Commit semantics:
- Enter/✓ whole Session Commit
- Esc/× whole Session Cancel to baseline
- Local Undo/Redo suboperations
- final Apply one Document Transaction
Tool switch:
- valid -> commit
- invalid/unresolved -> Finish or Cancel Transform

Zero-lag:
- no per-move full Layer Tree traversal
- no per-move full-document recompose
- no destructive resample per move
- no storage wait
- preview semantics same as final
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.9 -->


### 5.10 ベクター / 図形

#### 5.10.1 Shape / Path Family

SubtoolsはLine、Curve、Continuous Curve、Rectangle、Rounded Rectangle、Ellipse、Regular Polygon、Polyline、Bezier Shape、Path Select / Edit。

CreationはCanvas direct drag / tap。PropertiesにFill、Stroke、Stroke Width、Geometry parameters。

#### 5.10.2 Path / Node Editing

Node選択、multi-select、Move、Corner / Smooth conversion、Bezier handle direct edit。Handleは必要Nodeだけ表示しCanvas clutterを抑える。

Delete Node、Join、Split / Separate、Close / Open pathをContext Bar / Propertiesから実行。

#### 5.10.3 Shape Post-edit

作成後もRectangle size、Corner radius、Ellipse bounds、Polygon vertex count等をeditable geometryとして保持。Rasterizeするまで再編集可能。

#### 5.10.4 Smart Shape

Freehand strokeをHold等でrecognized shapeへ変換するOption。Recognition candidateをCanvas上に即表示し、release後短時間の`Keep Raw / Accept Shape` routeを提供。誤認識で元strokeを失わない。

#### 5.10.5 Simplify

Selected pathのnode数を減らす。StrengthをInteractive previewし、shape deviationをCanvas上比較可能。Applyでnew vector revision。

#### 5.10.6 SVG Import / Export

SVG Importはsupported vector geometryをeditable objectへ変換。Unsupported effect / featureはImport reportで明示し、可能ならraster fallbackをユーザー選択。

SVG Exportはselected vector / document vectorを出力し、raster contentはembed / omit policyを明示する。

#### 5.10.7 Geometric Constraints

Parallel / Perpendicular / Tangent / Equal Length / Equal Radius / Symmetryをselected geometry間に追加。Constraint iconはCanvas上必要時だけ表示し、Propertiesでrelation listを編集。

#### 5.10.8 Parametric Shape

Vertex Count、Radius、Inner Radius、Corner Radius、Rotation等をPropertiesで編集。Canvas handlesは意味的parameterへ直接対応。

#### 5.10.9 Linked Shape

`Create Linked Instance`でGeometry sourceを共有。InstanceはColor / Transform overrideを持てる。Source edit時はShared Source scopeを明示。`Make Unique`でsource cloneして同Instanceへrebind。

---

<!-- ILLUSTRO-V2-FULL:DETAIL:5.10 -->
#### 5.10.10 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Formal object types:
1. Parametric Shape
2. Path Shape
3. Compound Shape
Do not immediately convert all shapes to Bezier。Convert to Path explicit。

Object Edit: Move/Scale/Rotate/Fill/Stroke。
Node Edit: geometry; only needed nodes/handles。

Bezier creation:
Tap=Corner。Drag=Smooth+handles。
Touch has Corner/Smooth context toggle; no keyboard-only design。

Node types:
Corner: handles independent。
Smooth: collinear, lengths independent。
Symmetric: collinear + equal length。

Add Node: split curve preserving shape as possible。
Delete Node: reconnect minimizing jump。
Endpoints: Split / Join。

Open/Closed explicit。
Open Path + Fill:
- Fill implicitly closes endpoints straight。
- Stroke remains open。
- dashed implicit closing edge during node edit。

Fill Rule: Non-zero default / Even-odd advanced。
Fill: None / Solid / Gradient / Pattern。
Stroke: None / Solid / Gradient / Pattern。
Stroke props:
- Width Document px
- Alignment Inside/Center/Outside
- Cap Butt/Round/Square
- Join Miter/Round/Bevel
- Miter Limit
- Solid/Dash/Dot/Custom Dash
- Dash Offset
Open/ambiguous path: Center alignment only where needed。

Do not add variable-width Vector Brush / Vector Eraser。

Rectangle:
X/Y/W/H/Rotation + corner radius TL/TR/BR/BL; linked/independent; canvas handles; continuous clamp。

Ellipse candidate:
Full Ellipse / Arc / Pie / Chord + Start/End Angles + handles。

Regular Polygon:
Vertex Count / Outer Radius / Inner Radius / Rotation / Corner Radius。
Inner Radius enables star; no separate Star Tool。

Generic Path Corner Radius advanced candidate; nondestructive; Expand Corner explicit。

Compound Path: multiple subpaths and holes。

Boolean:
Union / Subtract / Intersect / Exclude。
Default nondestructive Boolean Compound preserving operands。
Expand Boolean explicit。
Operand Edit allows transform/parameter edits live。

Selection: Object Selection vs Node Selection。
Node multi-select: Shift / marquee / lasso。Touch Add Selection toggle。
Direct Segment Drag adjusts adjacent handles。

Snap reuse shared system:
Grid / Guide / Node / Endpoint / Midpoint / Intersection / Shape Center / Ruler。
Semantic feedback labels。

Persistent Geometric Constraints:
Parallel / Perpendicular / Tangent / Equal Length / Equal Radius / Symmetry。
Solver live。
Conflict: no silent disabling; show Disable A / Disable B / Remove。

Simplify:
live preview / Strength / node-count reduction / optional max deviation。
Preserve endpoints / sharp corners / locked nodes / constraint anchors。
Apply one Vector Revision。

Smart Shape first-recognized:
Line / Rectangle / Square / Ellipse / Circle / Polygon。
Hold candidate; Accept Shape / Keep Raw。
Accepted result parametric when possible。
Low confidence no auto-convert。
Deterministic, not AI。

Unsupported raster-only tool:
Rasterize / Rasterize Copy / Cancel。Rasterize Copy recommended default。No silent rasterize。
Convert to Path != Rasterize。

SVG supported core editable: path / compound / fill / stroke / transform / basic shapes。
Unsupported report。Fallback: Rasterize Unsupported Appearance / Skip / Cancel。No silent broken appearance。
Exact mapping Section 6。

Linked Shape:
shared geometry source; instance overrides Transform/Fill/Stroke。
Editing geometry: Edit Shared Source / Make Unique。
Shared-source edit badge。
Make Unique clones source and rebinds only instance; preserve instance placement/identity where possible。
Source defaults flow to non-overridden values; overrides preserved。

Node drag transient; release one Vector Transaction; local session Undo possible。
Zero-lag: local node/segment/bounds/boolean region/constraint neighborhood; no full doc/vector/SVG/constraint graph per sample。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.10 -->


### 5.11 定規 / 描画補助

#### 5.11.1 Assist Page構成

Assist PageはRuler、Guide、Perspective、Symmetry、Lineartの主要Block。Active assistantはCanvas overlayとPropertiesに状態表示。

#### 5.11.2 Ruler Types

Straight、Curve、Shape、Parallel Line / Curve、Multiple Curve、Circle/Ellipse、Radial Line / Curve、Concentric Circle、Symmetry、Kaleidoscope、Array、Perspective Array、1/2/3-point Perspectiveを提供。

Ruler createはCanvas direct。種類選択後、必要なanchor / line / centerを配置する。

#### 5.11.3 Ruler Editing

Position、Angle、Center、Phase等はCanvas handles + Properties。Ruler Snapはper-rulerとglobal master toggleを分離する。

#### 5.11.4 Guide

Horizontal / Vertical Guideはruler edge / Assistから生成。Named guide setへ保存可能。Guide lockで誤移動を防ぐ。

#### 5.11.5 Symmetry / Kaleidoscope

Axis count、center、angle、mirror / rotational modeをPropertiesで編集。Brush preview / strokeは現在effective assistantに即従う。

#### 5.11.6 Perspective

1/2/3-point Perspectiveはvanishing points / horizonをCanvas上で編集。画面外VPもedge indicatorで追跡可能。Perspective snap on/offをQuick toggle。

#### 5.11.7 Perspective from Lines

既存Artwork上で複数Line segmentを指定しVanishing Point candidateを推定。candidate confidenceとresidual errorを視覚表示し、AcceptでRuler生成。元Artworkを変更しない。

#### 5.11.8 Region-limited Assist

Assistantの作用範囲をCanvas region / Selectionへ限定可能。BoundaryはOverlayで表示し、outsideではsnapしない。

#### 5.11.9 Layer / Position-linked Assistant Set

Assistant SetをNamed保存し、Active Layer / Canvas position条件へ任意関連付け。自動切替時はsmall status feedbackを出し、現在SetをAssist Pageで確認できる。

---

<!-- ILLUSTRO-V2-FULL:DETAIL:5.11 -->
#### 5.11.10 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Capability split:
Guide = visual helper。
Stroke Constraint = constrains drawing path。
Replication = creates multiple strokes。
One assistant can combine: Perspective=Guide+Constraint; Symmetry=Guide+Replication。

Per assistant: Visible / Stroke Assist / Object Snap / Locked。
Hide != Disable。Hidden but active shows small Assist Active state。
Stroke Assist and Placement Snap separate; geometry may be shared; no master toggle conflation。
Multiple assistants coexist and may be active。

Per-stroke Assistant Lock:
Pointer Down -> eligible assistants -> initial movement/position -> score -> lock best for stroke。
Factors: distance / initial direction / primary designation / scope。Exact scoring Section 9。
No partial Assist Strength。Use exact snap + Capture Range。Capture Range screen-space。

Ruler types:
Straight / Curve / Shape / Parallel Line / Parallel Curve / Multiple Curve / Radial Line / Radial Curve / Concentric。
Straight Advanced Extent: Segment / Infinite。
Curve Ruler reuses Vector node editor: Corner/Smooth/Symmetric/Add/Delete/Segment Drag。

Perspective unified 1/2/3-point Assistant:
VP1/VP2/VP3 / Horizon-Eye Level / Plane Grids。
Each direction independently ON/OFF。
2-point semantic directions: VP Left / VP Right / Vertical。
3-point: X/Y/Z。
Initial stroke vector chooses direction then locks。
Return-to-start Re-arm optional: if stroke returns to start region while pen remains down, direction can be reselected。

Offscreen VP:
edge indicator / direction / distance / edge-mediated manipulation; no zoom-out requirement。

Perspective Grid:
XY / YZ / XZ planes。
Grid Spacing / Origin / Density / Show / Snap。
Reusable by Transform Placement Snap。

Perspective from Lines:
select existing line pairs -> candidate VP/horizon + residual/deviation overlay -> Accept creates Assistant。Artwork unchanged。

Symmetry = Replication, not path snap。
Modes Mirror / Rotational。
Geometry Center / Axis Angle / Division Count。
Replica transforms position/direction/tip angle/tilt/azimuth/rotation-dependent dynamics; pressure/time preserved。
Replicated stroke = 1 Transaction。
Brush/Eraser/Blend compatible。Selection/Region Constraint clips each replica individually。

Kaleidoscope:
wedge reflection+rotation; separate user-facing type, may share engine。Quick: Segments/Center/Rotation/Mirror。

Array Assist distinct Transform Repeat。
Transform Repeat duplicates existing objects; Array Assist live stroke replication。
2D: Rows/Columns/Step X/Step Y/Origin。All replicas one transaction。

Perspective Array:
Perspective Plane / Grid Step / Repeat Count -> projected replicas。No 3D object system。

Region-limited Assist Scope:
Everywhere / Active Selection / Saved Selection / Stable Region Set / Custom Area。
Scope crossing: assist only inside; outside freehand; screen-space hysteresis。Scope does not clip paint; separate Region Constraint。

Named Assistant Set stores assistants/visibility/stroke assist/object snap/scope/appearance。
Layer-linked Set auto switches with active layer/group and shows small status e.g. Assist: Background Perspective。No silent switch。
Position-linked Set uses viewport-center entering binding area with hysteresis。
Priority:
Explicit Manual Override > Layer/Group Binding > Position Binding > Document Default Set。
Manual override persists until Resume Auto Assist Set。

Guide creation:
Desktop ruler-bar drag。Tablet/Phone + Guide then canvas drag。
Guide props Position/Orientation/Color/Lock/Snap/Name。
Guide/Set Lock prevents move while snap works。

Overlay line width screen-space。Appearance Color/Opacity/Display Width/Handle Visibility。Handles edit mode only。

Temporary Assist Bypass: common one-stroke command assignable keyboard/pen button/touch; no setting mutation。
Solo Assistant candidate: temporary hide/disable others, restore prior state。

Assistant geometry edits Create/Move/Rotate/Perspective/Delete/Scope are undoable。UI visibility/collapse not Artwork History。
Fish-eye / Curvilinear Perspective excluded。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.11 -->


### 5.12 ゆがみ / 特殊描画 / 修正

#### 5.12.1 Liquify Entry

`Filter > Liquify`またはCommand SearchからCanvas direct Liquify Modeへ入る。Primary routeはnon-destructive Displacement Modifier。

PropertiesはBrush Size、Strength、Mode、Guard、Reconstruct / Restoreを表示。

#### 5.12.2 Liquify Modes

Drag / Push / Pinch / Expand / Smooth / Reconstructを提供。Pointer drag中Current Effective Stateへ即反映。Mode switchは同一Continuous Transaction内で可能。

#### 5.12.3 Non-destructive Displacement Field

Liquify結果はDefaultでDisplacement Modifierとして保持し、後からEdit / Disable / Reorder可能。`Bake Liquify`のみrasterize。

#### 5.12.4 Reconstruct

ReconstructはDisplacementを局所的に元へ戻す。Strength 100%でoriginal displacement stateへ近づける。元Raster contentを描き直すToolではない。

#### 5.12.5 Warp Guard

Free / Partial / ProtectedのMaskをBrushで編集。Guard overlayをtoggle可能。Protected areaをLiquifyしてもvisual no-opだけにせずcursor / overlayで保護状態を示す。

#### 5.12.6 Lasso Paint / Lasso Erase

Brush family / special routeから起動。囲ったGeometry内をPaint / Eraseし、releaseで1 Transaction。Selectionを別途作らず直接作用するModeとして識別する。

#### 5.12.7 Clone / Copy Pen

Source anchorをAlt/Option系temporary pickまたはPropertiesから指定。Source indicatorとoffset vectorをCanvas表示可能。Aligned / non-aligned samplingを切替。

#### 5.12.8 Smudge / Local Blur

Blend FamilyからSmudge / Blurを選択。Size、Strength、Sample source等をPropertiesへ。Brush stroke semanticsで作用し、direct feedbackを維持。

#### 5.12.9 Dust Removal / Dust Selection / Fill Leftover

Cleanup系はFilter / Repair routeから起動。Automatic candidate検出後、candidate overlayを表示し、Accept allではなくindividual review可能。Dust SelectionはcandidateをSelectionとして返せる。

#### 5.12.10 Smart Smoothing

Line / edgeを局所的にsmoothするInteractive Tool。Strength / preserve cornerをPropertiesで調整。Vectorではgeometry edit、Rasterではsupported non-destructive effectを優先する。

<!-- ILLUSTRO-V2-FULL:DETAIL:5.12 -->
#### 5.12.11 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Core modes: Push / Side Push / Pinch / Expand / Twirl / Smooth / Reconstruct。
Drag standalone removed。
Twirl brush-local displacement, distinct Twirl Effect。Direction CW/CCW。
Side Push Left/Right。

Temporary `Invert Liquify Effect`:
Expand<->Pinch / Twirl CW<->CCW / Side Push Left<->Right / Push reverse displacement direction。

Do not add core: Crystals / Edge / Momentum / random distortion stylization。

Common params:
Size / Strength / Hardness / Rate / Pressure Response / Mode / Guard。
Strength = maximum deformation influence。
Rate = accumulation over movement/time。

Pressure default:
Pressure->Strength ON。Pressure->Size OFF。Configurable。
Mouse/finger no-pressure fallback uses fixed Strength, preserves identity。

Hold accumulation: Pinch/Expand/Twirl continue on hold。Push mainly movement-vector based。

Reconstruct:
- canonical name。
- moves displacement toward reference, not pixels。
Reference: Session Start default / Modifier Base optional。
Reset Modifier resets entire modifier。
Smooth smooths displacement field, not image blur。

Primary: Non-destructive Displacement Modifier。Bake Liquify explicit。
Liquify Session: fixed Session Base; mode switches same session; Local Undo/Redo; final one Document Transaction。Editing existing modifier updates same modifier revision。
Apply/Done exits retaining modifier。

Guard continuous 0-100% Coverage: 0 Free / 100 Protected / partial attenuation。
Edit modes Protect / Unprotect; reuse coverage editor。
Active Selection limits target; Guard attenuates within eligible area。Selection != Guard。
Selection boundary default Clamp; advanced sampling across boundary candidate。
Guard overlay Color/Opacity configurable; partial visible; full protected may use pattern。

Lineart Group Liquify deforms visible lineart + Ideal Boundary + Stable Region geometry together, then local reconcile。
Stable Region simple deformation keeps ID; true Split/Merge uses lineage/conflict。Persistent Fill follows geometry。

Linked mask default Content + Linked Masks。Explicit Content Only / Mask Only。
Vector/Text/Parametric Shape: no silent rasterize; preferred post-render nondestructive displacement; alternatives Rasterize Copy / Cancel。Geometry editing belongs Vector/Mesh。
Mesh vs Liquify: Mesh structural handles; Liquify local brush deformation。Guard != Puppet Pin。

Cursor: circle + direction/side/twirl/pinch/expand/reconstruct glyph + size/hardness rings。

Lasso Paint/Erase direct apply without active Selection。Reuse lasso AA/Feather。Release one transaction。Lasso Paint may reuse Fill Application。

Clone/Copy Pen: Aligned/Non-aligned; source marker/target/offset; Stroke-start Source Revision fixed。Reference Current Layer / Chosen Layer / Visible Composite。

Smudge=color transport/mixing, Blend Family。Liquify Push=coordinate displacement。Local Blur=pixel smoothing。Liquify Smooth=displacement smoothing。

Dust Removal: Candidate Detection -> Overlay -> Accept/Reject -> Repair。Detection no artwork edit。Target small isolated specks, not semantic AI object removal。
Dust Selection returns candidates as Selection。
Fill Leftover detects underfilled/halo/tiny unfilled; reuses Fill/Lineart Resolver。Actions Fill/Ignore/Diagnose Boundary。
Smart Smoothing: Vector geometry simplify/smooth; Raster nondestructive edge/line repair。Primary Strength + Preserve Corners。

Zero-lag: local displacement working set; no full-layer composite/full-canvas bake/global Guard scan/topology rebuild/storage wait per sample/up。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.12 -->


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

Mosaic、Pixelate、Emboss、Bevel、Inner/Outer Glow、Drop Shadow、Satin、Wet Edge、Bloom、Cross Filter、Light Rays、Noise、Procedural Noise、JPEG Artifact Reduction、Frosted Glass、Stained Glass、Pointillize等をEffect catalogへ分類。

Effect catalogはSearch + categoryで選び、巨大なMenu階層だけに依存しない。

#### 5.13.6 Style Filters


#### 5.13.7 Generators

Cloud、Linear/Radial/Concentric Gradient、Radial Line、Speed Line GeneratorはGenerator Layer / Modifierとして非破壊生成をDefault。Canvas anchor / direction / center / spacing等を直接操作可能。

#### 5.13.8 Geometric Distortion Filters

Bloat / Sphere / Lens Distortion / Wave / Ripple / Twirl / Polar Coordinates / Shear / Distortion Correction / Panorama Transform / Extrude等は可能な限りEffect Modifierとして適用。中心 / axis / intensity等はCanvas Anchorを使う。

#### 5.13.9 Effect Recipe

複数Effect chainをNamed Recipeとして保存。Recipe適用はEffect instancesを作成し、後のRecipe preset変更で既適用作品を暗黙更新しない。明示`Relink to Shared Recipe`を将来導入する場合はShared semanticsを別扱いにする。

#### 5.13.10 Parameter Sweep

1〜2個の選択Parameterについて候補Gridを生成し、同一Viewport / cropで比較。Candidate Tapでcurrent working stateへ反映、Fine Tune後Apply。Sweep candidate generationをForeground direct manipulationより優先しない。

---

<!-- ILLUSTRO-V2-FULL:DETAIL:5.13 -->
#### 5.13.11 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

##### Common Effect Model

Effect classes:
1. Adjustment
2. Spatial Filter
3. Geometric Effect
4. Generator

Canonical user concept: Effect Modifier。
Do not proliferate separate Adjustment Layer engine / Smart Filter engine / Layer Style engine。

Scope:
Owner-attached = target-specific。
Stack Effect = acts on lower composite at stack position。
Single-layer default = Attach to Current Target。Stack Effect explicit。

Active Selection at effect creation -> Frozen Effect Mask。No implicit live Selection binding。
Each Effect has independent Effect Mask by default。Common/shared mask via Effect Group。No global Shared Mask subsystem initial。

Effect Mask = continuous Coverage。0=no effect, 100=full effect。Editor labels Add Effect / Remove Effect; black/white metaphor not mandatory。
Effect Mix = common Original/Effect Result mix。Distinct from effect-specific parameters。Conceptual effective presence = Effect Mix x Mask Coverage。

Live Preview mandatory。No wait-for-preview modal。Preview/final same semantics。Internal LOD/scheduling only if no visibly different algorithm。
Viewport/needed tiles priority。No full-document recompute required per slider sample。

Compare:
- Hold Original
- Toggle Effect
- Split Compare
Split same canvas with synchronized view。

Reset:
- Reset Parameter
- Reset Effect
- Revert Session

Numeric common: Slider / input / scrub / reset。

Canvas Effect Anchor:
- direct manipulation for canonical Center/Direction/Offset/Radius/Bounds parameters。
- Properties and Anchor edit same state。
- Anchor is UI, not export content。

Color-space-dependent effects respect Document Profile。Exact transforms Section 9。
Alpha separate by default; color adjustments do not alter alpha unless explicitly alpha-targeting。
Premultiplied/straight correctness internal, not routine UI setting。

Spatial Advanced Edge Behavior where relevant:
Clamp / Transparent / Mirror / Wrap。

Effect Scope:
- Whole Target
- Effect Mask
- explicit Live Selection Recipe binding
- Stable Region Set
Stable Region binding tracks ID and Split/Merge conflict rules。

Effect Stack UI/evaluation:
Source -> Effect1 -> Effect2 -> Result。Displayed direction = processing direction。Live reorder。

Effect Group:
- Enable
- Effect Mix
- Mask
Group Mask multiplies Child Effect Mask。

Disable preserves params/mask/anchor/name。Effect instance renamable separately from type。
Missing source shows unavailable; no silent reassignment。

Unsupported target:
- prefer post-render Effect for Vector when possible。
- otherwise Rasterize Copy / Cancel。
- no silent rasterize。

Destructive application explicit。
Bake This Effect / Bake Group / Bake Stack explicit; appearance preserved。

Effect edit session:
- Enter/✓ commit
- Esc/× restore pre-session
- newly-created uncommitted effect: Esc removes it
- Local Undo/Redo
- final one Document Transaction

Effect Preset = single-effect snapshot。
Effect Recipe = ordered multi-effect snapshot。Applying creates normal editable instances。No linked/shared Recipe in initial spec。

Parameter Sweep:
- max 2 axes
- same Source Revision
- no document copies
- candidate generation lower priority than direct interaction

Catalog:
Search / Category / Favorite / Recent / Preset。
Disabled incompatible effect remains visible with reason。
Grayscale/1bit compatibility explicit; no silent mode conversion。
Random effects use stable seed; Randomize explicit。

Scheduling priority:
Direct manipulation > visible effect > offscreen refresh > thumbnails/sweep/cache。

##### Color Adjustments

Common pipeline:
Input -> Adjustment -> Effect Mix -> Effect Mask -> Result。
Alpha preserved by default。

Histogram:
- Current Effect Input, not post-effect feedback。
- recompute if upstream changes。
- masked area default if Effect Mask exists。
- Whole Target toggle。

Brightness / Contrast:
Brightness -100..+100。
Contrast -100..+100。
0 neutral。
Perceptual tone behavior; no naive RGB add。No legacy algorithm toggle。

Levels:
Channels Composite / R / G / B or document-model equivalent。
Input Black / Midtone / White。
Output Black / White。
Canonical UI 0-100% independent of bit depth; optional detail underlying values。
Clipping Preview temporary; highlight/shadow distinct by color + pattern where needed。

Tone Curve:
Point Curve only initial。
X=input, Y=output。
Add/move/delete nodes; numeric Input/Output。
Composite/document channels。
Input histogram behind curve。
Default endpoints 0->0, 100->100。
Preserve monotonic input-node ordering; no foldback in normal tone curve。
Freehand draw curve excluded initial。

HSL:
Ranges Master / Reds / Yellows / Greens / Cyans / Blues / Magentas。
Hue -180..+180。
Saturation -100..+100。
Lightness -100..+100。
Range editor Center/Core/Falloff + eyedropper sampling。
No HSL Colorize; overlaps Drawing Color Change / Color Replace。

Color Balance:
Shadows / Midtones / Highlights。
Cyan<->Red / Magenta<->Green / Yellow<->Blue。
Smooth overlapping tone weights, not hard thirds。
Preserve Lightness ON default。

Grayscale:
- nondestructive effect, not Document mode conversion。
- profile-aware perceptual grayscale。
- no RGB mixer initial。
- Effect Mix can blend。

Threshold:
- one threshold。
- hard black/white output。
- alpha preserved。
- no AA inside result。
- not Document 1bit conversion。

Posterize:
Levels 2-256。
Default candidate ~8。
Color only; alpha not quantized。
Dither optional OFF default; stable seed if ON。

Invert:
- parameterless color invert。
- alpha unchanged。
- distinct Selection/Mask invert。

Gradient Map:
perceptual lightness -> shared Gradient Editor。
Reverse / Interpolation / Dither。
Dither OFF default, stable seed。
No gradient alpha stops in canonical Gradient Map; transparency via Effect Mask/Mix。

Color Replace:
reuse Color Range matcher。
Sample/Add/Remove / Fuzziness / Global-Localized / overlay preview。
Primary replacement = Hue/Saturation/Lightness shifts preserving shading。
Advanced candidate Replace Toward Color + Preserve Lightness。
No auto-active-selection。Explicit Create Selection from Match。

Drawing Color Change:
all nontransparent artwork RGB -> chosen color while alpha coverage preserved。
Fully transparent pixels unchanged。AA partial alpha preserved。No lightness preservation。Works beyond Lineart Group。

Common Hold Original。Presets are snapshots。
Do not add now: Exposure / Vibrance / Selective Color / Channel Mixer / Photo Filter。

##### Blur / Sharpen / Line & Edge

Spatial Effect Mask primarily result-mix mask, not sampling boundary。Default may sample Source outside mask to avoid seams。
Advanced Sampling Boundary: Source / Effect Scope。
Radius in Document px。

Gaussian Blur:
Primary Radius only。Radius0 identity。No quality/kernel/iterations UI。Correct alpha handling; no halos。

Motion Blur:
Distance + Angle。Canvas direction vector。Anchor position itself does not affect result。No Path Blur initial。

Zoom Blur:
Center + Amount。Center Document-space, canvas anchor。

Radial-Rotation Blur:
Center + signed Rotation Amount。Separate from Zoom。

Lens Blur:
Primary Radius / Focus / Depth Source。
Depth Source: None / Layer Mask / Alpha / Saved Selection / Chosen Coverage Source。
Effect Mask distinct Depth Map。
Focus Depth 0-100 + Pick Focus canvas tap。
Advanced Aperture: Blade Count / Curvature / Rotation。
Highlight Threshold / Boost。
Noise Match optional default0 stable seed。

Sharpen:
quick conservative edge-aware Amount-only。Do not inflate into Smart Sharpen。

Unsharp Mask:
Amount / Radius / Threshold。Threshold=edge difference eligibility, not brightness threshold。
Diagnostic candidate Show Sharpen Difference。Quick candidate 100% View。

Edge Detection:
Primary Radius / Sensitivity。
Output Grayscale default / Alpha。
Do not expose Sobel/Prewitt/Scharr as primary choices。
Polarity Dark lines / Light lines。

Line Extraction:
illustration-oriented。Primary Line Width / Sensitivity / Cleanup。
Width distinct detector radius。
Advanced direction toggles candidate。Pre-simplify Off/Levels candidate。
Black fill threshold not primary。

Outline:
silhouette boundary only; ignores internal color changes。
Primary Width / Position Inside-Center-Outside / Color。
Canonical same engine as Layer Border / Text Outline。

Selection/Mask continuous result mix。
Create Lineart Source from suitable Edge/Line Extraction:
- Use Live Effect Result default candidate
- Bake as Raster Source
- Cancel
Never auto-convert。

Live Lineart Effect parameter change triggers topology update using Stable Region rules。
Create Selection from Result explicit; no auto selection mutation。
Lineart source uses Current Effective Result; no stale topology fallback。
Canvas-outside artwork valid source。
Large radius not artificially capped for performance hiding。
Dependency radius informs Section 8/9 incremental scheduling。

##### Geometric Distortion

Classify Creative Coordinate Distortion / Optical-Geometric Correction / brush-local Liquify separately。
Common pipeline: Source -> Coordinate Mapping -> Sampling/Edge -> Effect Mix -> Effect Mask -> Result。
Canvas Effect Anchor may control Center/Radius/Direction/Rotation/Bounds。

Outside Sampling: Transparent / Clamp / Mirror / Wrap with effect-specific default。
Selection Mask = result-mix mask; mapping may sample around it unless advanced scope restriction。
Interpolation shared Transform family; no silent Nearest switching。
Effect Mask not warped by its own distortion by default。
Owner-attached anchors use Owner Local Space; Stack Effect anchors Document Space。
Non-destructive source reevaluation avoids accumulated resampling。Multiple warps stack, order matters。
No AI/content-aware fill for new transparent areas; Outside Sampling explicit。Canvas-outside artwork valid source。

Bloat:
Center / signed Amount / Radius。Positive outward, negative inward/pinch。Smooth falloff default。

Sphere:
Center / Amount / Aspect。Positive convex, negative concave。2D spherical warp only, no 3D scene。

Twirl Effect:
Center / Radius / signed Angle / Radius Falloff。Separate Liquify Twirl。

Ripple:
Center / Amplitude / Wavelength / Phase。Radial periodic。

Wave:
Direction / Amplitude / Wavelength / Phase。Advanced Waveform Sine default / Triangle / Square。No generator-count parameter; stack Wave effects。
Ripple and Wave remain separate。

Polar Coordinates:
Rectangular->Polar / Polar->Rectangular。Candidate Seam Position / Rotation。
Tentative: center fixed Target Bounds center for predictable mapping。Keep Tentative label until later technical review。

Shear Effect:
nonlinear curve-based displacement along X/Y。Distinct Transform Skew。Curve UI reuses node interaction concept。

Lens Distortion:
manual radial barrel/pincushion warp。Distortion / Center / Scale。

Distortion Correction:
Primary Distortion / Vertical / Horizontal / Rotation / Scale。
Advanced Chromatic Fringe / Vignette candidate。
No camera/lens profile DB or EXIF auto correction initial。Correction Grid display-only candidate。
Distinct Perspective Transform by correction intent / neutral-zero / grid。

Panorama Transform:
Tentative scope: projection transform, not stitching/3D。
Candidate projection Rectilinear / Cylindrical / Equirectangular。Center/FOV/Yaw/Pitch/Roll as applicable。
Initial limited scope: cylindrical<->rectilinear and equirectangular viewport reorientation。

Extrude removed from Geometric; see Stylize。

Direct manipulation viewport/affected-area priority; no full-doc completion requirement for anchor drag。

##### Stylize / Lighting / Noise / Generator

User-facing groups:
1. Surface / Edge Style
2. Pixel Stylize
3. Lighting
4. Noise / Repair
5. Generator

No separate Layer Style engine。Layer Shadow/Glow/Bevel quick entries instantiate canonical Effect Modifiers。

Drop Shadow:
Source Coverage/silhouette。Primary Offset / Blur / Spread / Color / Shadow Opacity。Canvas offset vector。Shadow Opacity distinct Effect Mix。
No hidden Global Light initial。If later needed, explicit Linked Light Direction only。

Inner/Outer Glow:
silhouette boundary。Primary Size / Spread / Color / Opacity。Advanced Falloff Curve。
Glow=alpha-boundary; Bloom=brightness。

Bevel:
silhouette-edge relief。Primary Size / Depth / Light Angle / Light Elevation。Advanced Inner/Outer / Softness / highlight/shadow colors+opacity。

Emboss:
image internal luminance/detail gradient relief。Primary Amount / Depth / Light Angle。No forced grayscale-only legacy UI。

Satin:
deterministic interior shading。Primary Color / Distance / Size / Angle。Advanced Contour / Invert。

Wet Edge Effect:
post-effect on completed coverage boundary。Primary Width / Strength / Falloff。Distinct Brush Pigment Edge deposition-time behavior。

Bloom:
Threshold / Radius / Intensity。bright extraction -> blur -> light contribution。Not alpha-boundary。

Cross Filter:
bright highlight starburst。Threshold / Ray Length / Ray Count / Rotation。No camera/lens simulation complexity。

Light Rays:
Source Point + source luminance -> directional rays。Source / Length / Intensity / Threshold。Distinct Cross Filter local stars。
Lighting effects add light contribution and do not silently alter source tone。

Pixelate:
coarse low-resolution/nearest-like pixel aesthetic。Pixel Size + Grid Origin。Hard cell boundaries/no AA; Effect Mask edge remains continuous separately。

Mosaic:
block average/representative aggregation。Cell Size + Grid Origin。Distinct Pixelate。

Frosted Glass:
deterministic noise-based local displacement + softening。Distortion / Scale / Softness / stable Seed。

Stained Glass:
irregular cells + borders。Cell Size / Border Width / Border Color / Regularity / stable Seed。Distinct Mosaic square grid。

Pointillize:
dots from source colors。Dot Size / Density / Spacing Jitter / stable Seed。No implicit Main/Sub/background dependency。
Gap Fill: Original / Transparent / Color。Default candidate Original。

Add Noise:
Amount / Color Mode Luminance-Color。Advanced Distribution Uniform/Gaussian + Seed。Seed fixed until Randomize; document-coordinate deterministic。

Procedural Noise Generator:
Scale/Frequency / Detail / Contrast / Aspect / Tileable / Seed。Exact algorithm Section 9。Tileable official candidate; generator bounds loop seamlessly。
Cloud = Procedural Noise preset with large-scale smooth fractal noise / 2-color mapping。

JPEG Artifact Reduction:
Repair。Strength / Preserve Detail。Targets blocking/ringing/mosquito artifacts。Deterministic; AI not required。

Generator = source class, Parameters -> Result, no source required。Primary representation Generator Layer。
Generator Layer supports Transform / Mask / Blend / Opacity / Effect / Group / Visibility。
Painting onto generator: Rasterize Copy / Rasterize / Cancel, no silent rasterize。

Gradient Generator reuses common Gradient Definition/Editor。
Linear: start/end。
Radial: center/radius。
Concentric: repeating same gradient; Center / Spacing / Phase。

Speed Line Generator editable parametric:
Direction / Density / Line Length / Line Width / Area-Bounds。Advanced length/spacing/position jitter + stable Seed。No immediate raster bake。

Radial Line Generator:
Center / Inner Radius / Outer Radius / Density / Line Width。

Ruler vs Generator:
Ruler constrains user stroke; Generator automatically creates line family。
Generator line style Primary Line Width / Color。Advanced limited Line Style Preset possible; do not import full Brush engine。

Random stylize/generator same definition+seed -> same result; Randomize explicit。

Style Filters use Effect Recipe whenever fully representable:
Illustration / Pencil / Film / Retro Game / Glitch / Chromatic Aberration。
Applied Recipe expands to normal editable Effect instances。Dedicated effect allowed only when recipe cannot represent semantics。
Retro Game may reveal Palette Reduction need later; do not add now without separate audit。

Extrude Stylize:
Direction / Length / Step or Density。Advanced Perspective/Fade。2D appearance only; no 3D material/light/camera。

Zero-lag: direct parameter/anchor manipulation viewport-first; offscreen/thumbnails lower priority。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.13 -->


### 5.14 非破壊編集

#### 5.14.1 Modifier UI

Layers `Effect`からAdjustment / Filter / Transform / Displacement等を追加。Attached ModifierはOwner child、Stack ModifierはVisual Stack participantとして表示。

PropertiesはEnabled、Effect Mix（該当時）、Mask、主要Parameter、Detailへの入口を持つ。

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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.14 -->
#### 5.14.9 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Canonical split:
Modifier Definition -> Modifier Application -> Target。

Definition = effect intrinsic semantic parameters。
Application = Target / Enabled / Effect Mix / Effect Mask / Scope / application coordinate-anchor / ownership。

Examples Definition:
Gaussian Radius / Motion Blur Angle / Tone Curve / Bloom Threshold / Drop Shadow Color。
Examples Application:
Enabled / Effect Mix / Effect Mask / Target / Zoom Blur Center / Ripple Center / Owner-local Anchor / Stable Region binding。

Shared Modifier shares Definition。Applications keep local Mask/Enabled/Mix/Target/Anchor-Scope。

Multiple Layer Apply default: independent instances/definitions。
Explicit Apply as Shared Modifier。

Independent->Shared: Share Definition。
If same values, share directly。If different: Use A / Use B / Use C / Cancel。Never average。

Shared->Independent: Make Independent clones current resolved values, preserves visual, future edits independent。

Parameter Link distinct Shared Modifier。Only semantic-compatible types:
Angle<->Angle / Length<->compatible Length / Color<->Color / Normalized Amount<->compatible Amount。
Do not link arbitrary numerics such as Blur Radius<->Hue Angle。
Unlink retains current resolved local value。Cycles prohibited; reject before commit with reason such as Cannot link: dependency cycle。

Effect Group: Enabled / Effect Mix / Mask + ordered child Effects。Group Mask x Child Mask。Use this for common mask; no separate Shared Mask subsystem initial。

Modifier Stack UI/evaluation displays Source -> Effect1 -> Effect2 -> Result。Display direction equals evaluation direction。
Reorder live Canvas; release one transaction; no bake。

Source edit preserves Modifier Definition/Stack and reevaluates current source revision。

Replace Source / Replace Content only source-bearing objects。Preserve compatible chain。
If new size/aspect differs: Keep Current Transform / Fit New Source / Cancel。
Preserve Effect Definitions/masks where semantically valid。If source-local geometry/anchor invalid, warning; no silent reset。

Dependency state: Current / Updating / Unresolved / Source Missing。Specific states may include Missing Asset / Missing Region / Unsupported Target / Cycle / Conflict。
Missing Source recovery: Rebind / Freeze Last Valid Result / Remove Modifier。
Freeze Last Valid explicit supported frozen result; no silent stale truth。

Duplicate:
Local Modifier -> independent clone。
Existing Shared Modifier -> new Application to same Shared Definition, preserving explicit sharing semantics。

Same-document Copy/Paste:
Local -> independent copy。
Shared -> same-document Shared Definition preserved。
Effect Mask copied with Application。

Cross-document Paste:
- no hidden live dependency to source document。
- clone required Definition/local dependency into destination。
- destination Shared Definition independent from source document。
- preserve relative appearance as possible。
- do not silently recenter Document-space anchor。

Mask ownership labels:
Layer Mask / Effect Mask / Effect Group Mask / Transform Scope Mask / Liquify Guard。
Mask drag actions Move Mask / Copy Mask。No initial Link Mask; use Effect Group。

Effect Variant stores Parameter State only。Does not store Target / Source / Effect Mask / Stable Region binding / ownership / Shared relationship。
Chain Variant does not change graph topology; structural edits belong Recipe/Stack。

Bake:
Bake This Modifier / Bake Modifier Group / Bake Chain。
Bake Copy creates independent raster/supported frozen result while source+modifier remains。
Bake & Replace replaces target with current result and removes baked modifier; one transaction; Undo restores graph。

Rasterize=source type conversion。Flatten=structure merge。Export=no bake。

Remove Modifier preserves source artwork; owned mask removed。Shared Definition remains while consumers exist。Unnamed zero-consumer internal definition cleanup; explicitly saved reusable Definition may remain Asset。

History units:
Parameter Edit Session / Reorder / Make Independent / Share Definition / Bake / Rebind each semantic transaction。No slider-sample history spam。

Evaluation semantics:
Source -> Modifier DAG -> Current Effective Result。Dirty downstream only where dependency permits。Cache derived/discardable, not canonical。
Priority: Direct input > visible affected modifier result > visible downstream composition > offscreen refresh > thumbnails/variants/caches。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.14 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.15 -->
#### 5.15.12 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Canonical Text Object:
Text Content + Character Runs + Paragraph Runs + Font References + Layout Mode/Frame + Writing Direction + Transform + optional Path Binding + Text Style/Overrides。
Glyph raster is derived output, not canonical text。

Resize Modes:
Auto Width / Auto Height / Fixed Frame。
Point Text default Auto Width。Area/Box uses Auto Height or Fixed Frame。
Resize Mode != Auto Fit。

Overflow:
explicit Text Overflow indicator。Actions Expand Frame / Enable Auto Height / Auto Fit / Keep Overflow。Preflight candidate if unresolved。

Text Edit Mode: caret/range/IME/Ruby/frame resize。
Object Transform Mode: move/scale/rotate, no caret。
Mode clarity Editing Text / Transforming Text。

Text input session:
no Document History per key or IME candidate; semantic text-edit transaction。

Character props:
Font / Style-Weight / Size / Color / Character Spacing / Horizontal Scale / Vertical Scale / Baseline Shift / Underline / Strikethrough / OpenType Features / Variable Font Axes。
Paragraph:
Alignment / Justification / Line Spacing / Paragraph Before-After / Indent / Writing Direction / Frame Vertical Alignment。
Primary: Font/Weight/Size/Color/Alignment/Character Spacing/Line Spacing。Rest Detail。

Mixed Style:
range-level formatting。Property shows Mixed when multiple values。No selection uses Insertion Style; selected range receives change。

Font Reference: Family + Face/Style + metadata。
Variable Font: show only axes provided by font: Weight/Width/Slant/Optical Size/custom axes。No fake unsupported axis transform。

OpenType Features only if font supplies them。Examples Ligatures / Contextual Alternates / Fractions / Stylistic Alternates。Typography Details, not primary clutter。

Glyph/Symbol: grid+search。Use Unicode when representable。Font-specific alternate/private glyph keeps substitution metadata。Clipboard does not silently map to unrelated Unicode。

Font fallback separates Requested Font and Resolved Glyph Fallback。Fallback is display resolution only, does not rewrite requested font; later availability can restore。

Missing Font badge `Missing Font: <name>`。Actions Replace Font / Import Font / Keep Temporary Substitute。
Missing Glyph is character-run fallback, not whole font missing。Inspector may show count such as 3 glyphs using fallback。

Font Import local resource。Use licensing/embedding metadata if available for Export compatibility; lack of metadata is not automatic block。

Vertical Writing uses true vertical shaping/metrics and punctuation orientation; no whole-string 90° hack。

Tate-chu-yoko Auto: Off / 1 / 2 / 3 / 4 characters。Manual selected range support。

Ruby binds annotation to base text range。Reading Text / Size / Position / Spacing。If base edit breaks relation -> Needs Review, no silent reattach。

Text on Path relation:
Text Object + Path Reference + Start/End + Offset + Side/Direction。Path Node Edit live reflow。

Circular Text = Circle Path + Text on Path preset。Radius / Start/End / Direction / Inside-Outside / Offset。Circle stays Parametric until explicit conversion。

Text inside Shape: Text references Shape/Path frame geometry; Shape Fill/Stroke separate。Shape edit reflows。Missing source -> Rebind / Freeze Current Frame。

Auto Fit managed fields:
Font Size / Character Spacing / Line Spacing / Frame Resize。Deterministic。AUTO FIT badge。Manual change -> Update Auto Fit constraint / Disable fitting for that field; no silent snap-back。

Text Style Preset = snapshot, no sharing。
Linked Text Style = shared Definition。Shares Font/Weight/Size/Color/Character spacing/Line spacing/Paragraph alignment/Outline style。Does not share Content/Position/Frame Size/Path Binding。Override diff, Reset to Style, Make Local Style clones resolved style。

Text Outline reuses Outline Effect Modifier。Shadow/Glow/Bevel same common Effect Modifiers。

Text Transform keeps editable Text。Transform Scale != Font Size。
Perspective/Mesh/Liquify preserve editable source via post-render nondestructive modifier default。Alternatives Rasterize Copy / Cancel。No silent rasterize。

Convert Text to Path explicit; Convert to Path Copy recommended option to retain original。
Rasterize Text: Rasterize Copy / Rasterize & Replace / Cancel。Raster result not text-editable。

Live Text Boundary feeds Selection/Fill/Lineart Boundary/Region Constraint。Typing does not force full-document topology sync。Missing source -> Rebind / Freeze Last Valid / Unbind。

Copy/Paste same doc preserves editable text/font refs/mixed style/Ruby/path binding。
Path Text without path -> Paste with Path Copy / Convert to standalone text / Cancel。
External Plain Text uses insertion style。Rich text preserves supported formatting only。
Cross-document font missing -> keep Requested identity + Missing Font; no hidden source-document font link。

PSD supported semantics editable。Unsupported -> appearance fallback + original metadata where possible + warning。Preflight Missing Font / unsupported OpenType / Path Text incompatibility / Ruby unsupported / Effect raster fallback。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.15 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.16 -->
#### 5.16.9 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Reference = Assist Resource。Not Artwork Layer / Composite / standard artwork Export。
Source types:
1. Embedded Reference
2. Linked Reference
3. Live Canvas Reference

File import default: Embed。Link optional。
Clipboard: Embedded Reference。

Linked external update:
Status `Reference updated externally`。Actions Reload / Keep Current。
Auto Reload Linked References: candidate Setting, default OFF candidate。Do not silently replace during work。

Missing Linked Reference:
Status Reference Missing。Actions Relink / Locate / Remove。
Cached preview allowed with explicit `Missing - showing cached preview` badge。

Reference Block: View Page, PiP detachable。Multiple PiP References simultaneously。
Library views: List / Tabs / Grid / Pin as PiP。
Metadata: Name / Source Status / Source Type / Thumbnail / optional Tags。No requirement for deep folder hierarchy inside Reference system。

Per-reference navigation:
Pan / Zoom / Rotation / Horizontal Flip / Fit。
Persist Pan/Zoom/Rotation/Horizontal Flip/Lens state。
Horizontal Flip primary。Vertical Flip More/lower-frequency。View transform only, never source rewrite。

Reference Eyedropper:
Touch normal=Pan; Pick mode or Temporary Eyedropper=sample。Pen button may map。
Color management: Reference Pixel -> Reference Color Profile -> Document Working Color Space -> Main Color candidate。
Untagged reference likely sRGB candidate, final in Section 6; no separate incompatible Reference color rule。
Pick Preview shows Reference candidate vs Current; release/tap commit。

Lens cleanup:
View Transform: Flip / Rotate / Pan / Zoom。
View Lens: Value / Saturation / Blur / Edge Emphasis。
Value = perceptual lightness/value view。
Saturation 0-100%; 100 original, 0 saturation removed。
Blur Radius removes detail for large masses。
Edge Emphasis Strength, viewing aid only, no generated artwork。
Lens Stack multiple allowed; header e.g. `2 Lens Active`。
Reset View resets Pan/Zoom/Rotation/Flip/Lens。Individual Reset Position / Clear Lenses may exist。

Canvas <-> Reference Anchor:
view-navigation relation only, not overlay transform。
Anchor Pair = Canvas Point + Reference Point。
Sync Pan aligns corresponding points。
Sync Zoom captures current Canvas<->Reference scale ratio at anchor setup and maintains it。
Sync Rotation not initial because one anchor insufficient。
Multiple named anchors per reference allowed。

Reference Set stores membership / order / active item / grid-tab state / view states / lens states / PiP arrangement refs / anchor-sync states。Grouping/view definition only; no duplicate image data。
Global reusable Reference library not required initial; Project Set canonical。

Live Canvas Reference:
Source = Current Effective Artwork Composite。
Use: main Canvas detail while reference shows full art, or normal color vs Value/Blur alternate view。
Exclude Guides / Selection outline / Reference PiP / Cursor / Assist overlay / temporary UI。
Update priority: Main Canvas visible first; Live Reference frame-aligned after; only visible-block resolution; no full-res per brush sample。

Navigator distinct small navigation tool。Shows current viewport footprint / zoom / rotation / mirror。Tap to pan; drag footprint to pan; wheel/pinch zoom。
Rotated Canvas shows actual rotated footprint, not misleading axis-aligned only。Mirror state explicit。
Navigator Eyedropper if offered samples canonical/current composite, never low-res thumbnail as truth。

Reference PiP positioning does not use Artwork Transform Tool。Reference view pan/zoom/rotate separate。
Drag&Drop into Reference Block -> Add Reference。Ambiguous Canvas drop shows Import as Artwork / Add as Reference。
Place Reference as Artwork explicit, creates imported content; reference entry remains by default。
Add Current Layer as Reference Snapshot candidate; snapshot, not live link。Live current art uses Live Canvas Reference。

Privacy/export:
- Reference not artwork export。
- Reference not timelapse artwork frames。
- Linked original not silently embedded in export package。
- Embedded reference remains native Project Resource according format policy。

Performance priority:
Direct Brush/Transform > Current Canvas visible result > Visible Live Reference > visible static reference decode > Navigator thumbnail > Reference grid thumbnails > offscreen preload。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.16 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.17 -->
#### 5.17.10 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Internal History Graph; normal UX linear Undo/Redo。
Undo = one semantic transaction back current branch。Redo = one forward current branch; never cycles branches。
Undo then edit preserves old redo path as branch。

History Preview read-only:
- no current pointer move
- no save-state change
- no Undo/Redo-position change
- badge Previewing
Editing while Preview blocked until Continue From Here。
Continue From Here restores state; first edit creates branch。
Restore Here moves current state without deleting future; no edit means easy return possible。

Transaction granularity: Brush 1 Stroke / Fill 1 operation / Transform whole Session / Liquify whole Session / Effect edit Session / Text semantic edit Session / Auto Action whole Action default。No pointer-move/slider-sample history。

History entry naming: Command + affected target + optional summary。Examples Brush Stroke-Hair / Transform-Character / Gaussian Blur-Background / Edit Text-Title / Fill 4 Regions-Flats。No internal ID normal UI。

History Page primary current-branch linear list; branch point indicator; advanced Show Branch Graph。
Branch creation automatic, no naming modal。Auto name Branch from time or origin Checkpoint; rename later。

Branch Compare A/B Toggle / Split View, synchronized Pan/Zoom/Rotation; compare does not move pointer。

Branch Merge only safe independent/commutative changes: different independent layers, independent modifier params, non-conflicting metadata。Conflicts same raster layer edits / same effect parameter / delete-vs-edit / topology conflict。No pixel averaging or Last Writer Wins。

Apply Changes From Branch:
select transaction(s) -> preview -> apply if dependencies valid。Incompatible target reason, no silent retarget。Preferred selective reuse route。

Checkpoint persistent named pointer to History State。Fields Stable ID / Name / Time / optional Note / Thumbnail。Persists Project reopen。Acts retention anchor; physical GC Section 6/8。Save != Checkpoint。Optional Saved marker not Undo step。

History persistence direction: Current Branch / recent History / Named Checkpoints / retained Branch metadata。Exact budget Section 6。
Recovery separate; no Recovery entries in normal History。

History Search: Layer/Object/Tool/Tool Family/Command/Effect/Text metadata/Checkpoint/Branch。Index background lower priority。

Auto Action = Semantic Command Recorder, not pointer recorder。Example Add Layer / Set Opacity60 / Add Gaussian Blur Radius12 / Duplicate Layer / Transform Scale80。
Freehand Brush Stroke excluded from normal Action recording by default; future Stroke Macro separate spec。

Action Target: Current Target / Named Target / Step Output。Step Output lets later steps refer to object created earlier, avoiding same-name ambiguity。
Typed Action Inputs: Number / Length / Angle / Color / Choice / Boolean。No arbitrary script expression。
Action editor: Reorder / Enable-Disable / Edit safe params / Duplicate Step。

Playback atomic default; whole Action one Undo。Failure at later step rolls back earlier steps by default, avoiding half-applied document。
Failure actions: Fix/Rebind / Retry / Skip This Step / Cancel Action。Skip incompatible configurable default OFF; no silent skip。
Recording REC indicator。Playback status `Action: Name - 3/7` + Cancel。

Action Import/Export contains semantic command ID / version / parameters / target rules / optional inputs / metadata。No JavaScript/shell/plugin code。Unknown version -> Compatibility Report。

Repeat Last = last repeatable semantic command on current target。Examples effect add / transform amount / duplicate+move / fill / adjustment preset。Freehand stroke default excluded。
Repeat With... edits parameters then re-executes。
Transform Repeat Modifier = nondestructive spatial repetition; Repeat Last = command re-execution。

Timelapse independent meaningful visual stream, not identical History Graph。History may prune while Timelapse retains required visual evolution stream。
Default Current Branch。Other Branch selectable。Undo/Redo UI operations are not frames。Abandoned transactions not current-branch timelapse。
Pause Recording stops timelapse capture while artwork editing continues; Resume from current result。
Clear Timelapse != Clear History。History prune does not automatically clear Timelapse。
Replay Speed / Pause / Scrub / Pan / Zoom; replay view nav does not modify record。
Timelapse Export fixes Source Branch Revision at export start; later strokes excluded from in-progress export。
Exclude Cursor / Sidebar / Reference PiP / Guides / Selection Halo / Transform Handles / Quick Hole。

Performance priority:
Direct manipulation > Current visible revision > Undo/Redo target visible result > current branch structural history > recovery persistence > thumbnails/search index > Timelapse encoding。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.17 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.18 -->
#### 5.18.13 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

New Document -> immediate local Untitled Project -> Autosave begins。No first manual save requirement。Initial naming Untitled 1/increment candidate。

Project Library is real Project index, not only Recent Files。Card Thumbnail/Project Name/Modified/Status。Status Saved/Saving/Save Issue/Recovery Available/Missing Resource/Compatibility Issue; normal quiet。Thumbnail failure must not block open。

Folder vs Collection:
Folder = primary hierarchy, one primary folder。
Collection = virtual grouping, multi-membership。

State distinction:
1 Logical Current State
2 Durable Saved State
3 Exported State
Top Bar Saved = current logical revision durable。

Autosave ON default, no full-canvas periodic blocking semantics。Drawing continues during save。
Save Now prioritizes current revision durability; not Checkpoint。

Last Good Save must not be destroyed before new durable state succeeds。If N+1 save fails, N remains valid。
Save Issue actions Retry / Save Project Copy / Details; current logical artwork preserved。

Close safety only if latest changes nowhere safely durable。Options Retry Save / Save Project Copy / Keep Editing / Discard Latest Changes。Discard never default。If recovery-safe latest exists, avoid unnecessary modal。

`.illustro` canonical editable format preserving Layer/Object/Brush semantics/Modifier/Generator/Text/Stable Region/Persistent Fill/History Graph/Branch/Checkpoint/Reference metadata/Resources/Timelapse metadata。Physical package Section 6。

PSD is exchange format。Open PSD -> Import -> Illustro Project。Do not use PSD as native ongoing file for Illustro-only semantics。Export PSD explicit。

Import routes:
Open Project(.illustro) / Import as New Project / Place into Current Project / Add as Reference / Register as Material。
Drag&Drop shows eligible targets; does not silently replace project。

PSD Import Policy:
Preserve Appearance default。
Preserve Editability maps semantics and reports appearance differences。
Review Issues only when ambiguity/loss exists。Clean import no giant modal。
Unsupported fallback provenance visible e.g. Rasterized from unsupported PSD effect。Preserve original metadata where possible。
PSD Export Preflight gives issue-specific rasterize appearance/omit/cancel route; warning alone need not block valid export。

Brush Import report Exact / Approximate / Unsupported。Imported Brush becomes independent Illustro Definition snapshot, no live link to .sut/ibis source。Original file may remain Resource。

Recovery:
Recovered vs Last Saved compare via A/B or Split。Opening Recovered does not immediately overwrite last-known good durable state; only successful later save makes it current durable。Recovery not History entry。

Duplicate = independent project。
Variant = Origin Project / Origin Revision / Created time, related Library display, no later synchronization。Copy-on-Write storage optimization only。Variant Compare A/B/Split。No Variant Merge initial。

Delete -> Recently Deleted -> Restore/Delete Permanently。Never delete external Linked Reference/original PSD/external Font/original Brush file。Restore Folder/Collections/Variant relation/Project title when possible。

Single Writable Session: one local Project one writable session by default。Duplicate open options Focus Existing / Open Read-only / Create Variant。Crash stale lock detected/recovered, no permanent lock。
Read-only can inspect Canvas/History; edit attempt -> Create Editable Copy / Create Variant。No silent lock stealing。

Project Health split:
Structural Health: Missing Font / Missing Linked Reference / broken live binding / unresolved Stable Region dependency / Save-Recovery problem / damaged Resource / Color Profile problem。
Format Readiness belongs Export Preflight。Do not constantly show PSD compatibility if not exporting PSD。
Severity Info/Warning/Blocking; Blocking only if current operation cannot proceed。Every issue has Fix route。
Examples Missing Font Replace/Import/Locate; Missing Reference Relink/Remove; Unresolved Region Rebind/Freeze。

Resource Cleanup reviews unused imported source / unused embedded reference / orphan thumbnail-cache / unreferenced generated resource。Never remove referenced resource。

Portable Project Copy creates .illustro copy embedding eligible linked resources; original link semantics unchanged。Font/resource embedding restrictions -> Preflight。

Distinct commands:
Save Now=current project durable。
Save Project Copy=native snapshot/copy separate target。
Duplicate=Library independent copy。
Export=derived output。

Background Export fixed snapshot at start, drawing continues, export does not alter Saved state。
OS Share: Share Export Result / Share Project。Failure no project mutation。
Library metadata/thumbnail index first; no full decode all projects; missing thumbnail background lower priority。

Persistence priority:
Direct manipulation > Current visible result > Logical commit > Critical recovery state > Durable autosave > Export > Thumbnail/indexing/cleanup。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.18 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.19 -->
#### 5.19.14 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Workspace Definition:
Tool Rail configuration / Quick Access / Quick Hole mapping / Properties visible fields / Panels-PiP / Device Layout Variants Desktop-Tablet-Phone。
Same workspace meaning, device-specific physical layout。

UI Density ownership:
Device Profile owns UI Scale / Default Density / Touch target regime / Input roles。
Workspace Density Override: Inherit / Compact / Comfortable / Touch。Default Inherit。

Tool Rail keeps existing 9 Family baseline。Reorder/Hide/Group/Favorite/Reset。Explicit Edit Layout Mode; normal use no accidental reorder。Hidden tools reachable Command Search。

Quick Access = user-selected frequent surface, distinct Global Command Search。Can register Tool / Command / Panel-Page / Auto Action / Color / Workspace。Owned by Workspace Definition。

Global Command Search desktop default Ctrl/Cmd+K。Search Commands/Tools/Pages/Panels/Settings/Auto Actions/Workspaces。Result Name/Shortcut/Menu Path/Availability。Unavailable remains visible when useful with reason。Ranking Exact > localized alias > current context > recent/frequent。No cloud AI dependency。

Properties customization: Detail field can Show in Properties; low-frequency hide。Cannot hide Apply/Cancel/Target/Error-Conflict semantic-essential controls。

PiP position saved per Device Layout Variant。If viewport changes, clamp to Safe Workspace Bounds。×=Redock。Preserve intent/state where possible。

Quick Hole exact Section4 geometry unchanged。Marking Mode optional default OFF。Marking press->slide->release; safer tap mode default。

Task-linked Workspace auto switch default OFF。Temporary Tool changes do not switch。Continuous Transaction中はauto switchを延期しinteraction後に評価。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.19 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.20 -->
#### 5.20.15 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

One Parameter, One Canonical Value。Canvas Handle / Properties Slider / Numeric Field / PiP Slider all same state。
Every feature defines Direct / Quick / Detail。

Scalar Control: Drag / Fine Drag / Numeric / Relative Numeric / Saved Marks。
Numeric +10 / -5 / x2 / ÷2。Unit-aware px/%/°。Unit mismatch rejected with reason, no silent reinterpretation。

Semantic Picker displays Name/Type/Role/Status; no ambiguous first match。
Hidden vs Disabled: exists but unavailable -> Disabled+Reason; no semantic relevance -> may Hide。

Mixed Values: e.g. 20/40/80 -> Mixed; +10 -> 30/50/90。Do not copy first value to all。

Canvas Handle geometry Document Space, hit target Screen Space; Touch hit area can exceed visual size。Minimal/hide mode if obscures artwork。
Touch occlusion: HUD/readout offset away from finger。

Pointer Capture: initial control owns until Release/Cancel; crossing does not transfer。Exception optional Quick Hole marking mode。

Eyedropper overlay Current/Candidate/Source; Loupe only sampling; Release Commit; Cancel restores original。
Preview = Current Effective Interactive State, not fake semantic preview。Internal LOD allowed only same meaning/result。

Continuous Transaction may span Canvas drag/Slider/Numeric if same semantic edit。Tool/target semantic boundary closes。

Destructive confirmation primarily permanent delete / destructive bake-flatten losing editable structure / unresolved compatibility loss / overwrite risk。No modal spam for normal Undoable operations。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.20 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.21 -->
#### 5.21.10 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Optional Session overlay on local-first Illustro; Solo project remains base; normal production no cloud requirement。
Room Roles Owner / Editor / Viewer。Viewer sees permitted canvas/state/cursors, cannot edit。Room link/code has access policy。

New Layer Private default。Share Layer explicit。References/Selection/production state local unless Published。
Shared state modes Share Live vs Send Copy。Share Live future sync; Send Copy snapshot only。

Raster concurrent drawing preserves both participants' committed operations; no last-write-wins deletion。Same-pixel deterministic canonical order Section8/9。
Structural semantic conflicts include Delete Layer vs remote Stroke / whole-Layer Transform vs remote Stroke / Clear Layer vs remote Stroke / same semantic property conflict; explicit conflict handling。

Collaboration Undo = Undo My Last Eligible Change。Do not rewind whole document and erase others' later work。If simple inverse impossible, use inverse operation/conflict resolution。

Local-first: pointer -> local visible result -> local logical commit -> network sync。Network RTT never in stroke visible feedback。
Status Synced / Syncing / Offline / Conflict, quiet when normal。
Remote Cursor/Viewport optional。Follow View selected participant; any local Pan/Zoom breaks follow immediately。

Connection loss: local editing continues; unsynced operation count。Reconnect safe merge where possible, explicit conflict otherwise; never silently discard local committed work。
Room end leaves Local Project。If unsynced, show Unsynced changes remain。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.21 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.22 -->
#### 5.22.8 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Resource: Brush Tip / Texture / Pattern / Gradient / Stamp。
Material: Image Material / User Material / Smart Material / Procedural Material。
Unified Assets Page。

Storage Scope Built-in / User Library / Project Resource / Imported Pack。

Project Resource Capture: when User Library resource used, project captures sufficient Definition/dependency so deleting Library original does not break existing Project。No silent Library updates flowing into old project。

Register as Material = Snapshot default, no live source artwork link。
Placement:
1 Place as Material Object retains transform/tiling/parameters。
2 Place as Pixels raster content。
Do not bake Image Material immediately by default。

Smart Material Definition: Color / Scale / Rotation / Density / Randomness / semantic params。
Application: Transform / Mask / Local Overrides。Shared edit indicator。
User Library Smart Material placement creates Project-local Definition snapshot; same Project may share instances; Library update does not silently affect project。

Procedural Material Dot / Stripe / Grid / Noise / Cloud / Paper。Noise/Cloud share 5.13 Procedural Noise semantics。

Illustro Asset Pack local import/export。Contains selected assets/dependencies/Tags/thumbnails/compatibility metadata。Preview before import。Stable identity, not name-only collision。No online marketplace。

Seamless Material Builder: Source -> Wrap Preview -> Offset/Clone/Blend -> Register。Original not destructively changed; Replace Existing explicit。
Assets performance metadata/thumbnail index first; full Resource decode on demand; background lower priority。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.22 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.23 -->
#### 5.23.11 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Setting scopes:
1 Global User
2 Device Profile
3 Workspace
4 Document
One canonical owner per setting。

Device Profile Desktop / Tablet / Phone / Custom。Stores UI Scale / Density / Pen Pressure Profile / Touch Roles / Mouse behavior / Gesture bindings / Pen Button bindings / Handedness-Reachability default。Auto-detection initial suggestion only, never overwrite Custom。

Pen Pressure Calibration pipeline Raw Device Pressure -> Device Calibration -> Brush Dynamics。Controls Minimum Pressure / Maximum Pressure / Response Curve / Test Pad。Device calibration separate preset curve。

UI Scale Auto / 80 / 90 / 100 / 110 / 125 / 150。Density Compact / Comfortable / Touch。Extreme impractical combination warns, not silently changes。

Shortcut/Gesture Editor shared Command Registry。Inputs Key / Modifier / Pen Button / Touch Gesture。Conflict shows existing binding+reason。

Trial Mode Trial active with Commit/Revert All。Relevant Theme/Gesture/Shortcut/UI Scale/Handedness。Safe Revert always available for risky mapping。Crash during Trial must not persist uncommitted dangerous config。

Settings for this behavior navigates exact relevant setting; if none, do not dump into unrelated General。
Settings Search shows Setting Name / Current Value / Path; simple toggle may edit inline, complex navigate。

Accessibility:
- color-only state prohibited
- keyboard focus indicator
- keyboard-only reachable commands
- screen reader accessible names
- Reduced Motion
- Reduced Transparency
- High Contrast
- adjustable UI Scale
- Touch target sizing
- Left/Right handed layout
- configurable hold timing
- configurable gesture timing
- cursor visibility enhancement
- handle visibility enhancement
- pattern/icon in addition to color for critical states

Reduced Motion removes decorative fade/spring/unnecessary transitions but retains actual direct-manipulation movement。
Settings Backup Local file; Restore category-selective Workspace/Input/Shortcuts/Appearance/Accessibility and defined groups。Incompatible device mapping -> Compatibility Report。
Cloud Settings Sync not required initial; account-free complete settings management。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.23 -->


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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.24 -->
#### 5.24.12 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Display pipeline: Document Color -> Document Profile Interpretation -> Display Conversion -> Monitor。
Export: Document -> Output Profile Conversion -> Encoded File。
Soft Proof: Document -> Simulated Output Profile -> Display。Do not conflate。

Assign Profile: numeric pixel values unchanged, interpretation changes, appearance may change。Warning Numeric values unchanged - appearance may change。
Convert Profile: numeric values transform, appearance preserved as much as possible。Both Before/After preview。

Rendering Intent: Perceptual / Relative Colorimetric / Absolute Colorimetric / Saturation。
Black Point Compensation where supported。Default candidate ON for normal conversions; exact default Section6。

Soft Proof per-view: View A Normal / View B CMYK Proof possible。Artwork pixels unchanged; config may be view/document metadata。
Primary Proof controls Profile / Intent / Gamut Warning。Advanced BPC / Simulate Paper White / Simulate Black-Ink。
Gamut Warning overlay only, configurable warning color, optional hatch accessibility。

CMYK Preview proof only, does not convert RGB Document or Brush state。
Print-size Preview from DPI+display scale; if physical display data unreliable show Approximate。Future physical calibration possible。

Export Workspace order:
1 Target
2 Format
3 Dimensions
4 Color
5 Transparency
6 Metadata
7 Naming/Destination
8 Preflight

Dimensions Original / Percentage / Pixel W-H / Frame Variant / Physical Size+DPI where supported / Aspect Lock。Resampling shared Transform family, no separate confusing names。

Format defaults:
General/Web PNG sRGB 8-bit。
JPEG Quality90 baseline, no alpha。
TIFF high-quality/print。
PSD editable exchange。
SVG vector exchange。
JPEG with alpha source requires explicit Background Color; no silent white。

Output Profile conversion does not mutate Document Profile。Embed Profile default where supported。
Alpha separate from color conversion; RGB profile conversion must not change alpha。Transparent-edge exact handling Section6/9。

Metadata privacy-safe default。
May include Project Title / explicitly configured Author / Copyright / Color Profile。
Default exclude local file paths / hidden Reference paths / device identifiers / inherited GPS-location metadata。All Metadata explicit opt-in。

Export Recipe stores Format/Dimensions/Frame/Profile/Bit Depth/Transparency/Metadata/Naming; no artwork。Built-in Web PNG / Web JPEG / Transparent PNG / High Resolution Archive / Print RGB / PSD Exchange。
Naming Tokens {project} / {frame} / {recipe} / {width} / {height}。No arbitrary scripts。

Multi-target Export uses one frozen Document Snapshot for all targets; drawing after start never appears only in later outputs。

Export Preflight target-specific checks Missing Font / Unsupported Effect / SVG Raster Fallback / PSD unsupported structure / JPEG Transparency / Profile incompatibility / Bit-depth loss / Resolution / Gamut / File Size Estimate。
Severity Info/Warning/Blocking; Blocking only when target cannot be represented without choice。Every issue has Fix route。
Examples JPEG transparency -> Set Background Color / Choose PNG。PSD unsupported modifier -> Rasterize Appearance Copy / Skip Effect / Cancel。
Project Health separate。

Proof Compare Toggle / Split / Side-by-side; synchronized nav; Original/sRGB/Display-P3/selected print proof; one canonical document, no copies。

Background Export freezes Revision at start; continue drawing; Cancel no artwork mutation; finish Open Location / Share / Export Again。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.24 -->


### 5.25 Illustro Cross-Tool Region / Relative Color System — 確定

#### 5.25.1 Classification / 重複防止

次は既存機能として扱い、新Toolとして重複追加しない。
- Enclose Fill / Enclose Erase
- Region Sweep
- Persistent Region Fill
- Manual Boundary Editing
- Anti-overflow / Lineart-limited Paint
- Recent Stroke Re-edit
- Brush Morph

今回の独自拡張は、既存機能へ共通能力を接続する形で成立させる。

#### 5.25.2 Shared Region Resolver

Tap / Sweep / Enclose / Explicit Pick等のGestureからStable Region集合をResolveする意味規則を共通化する。

Consumers:
- Fill: Region単位Fill / Erase
- Selection: Region単位Selection
- Mask: Region集合からMask生成
- Brush / Eraser / Blend: Region Constraint
- Lineart: Region inspection / topology editing

同じGestureなのにFillとSelectionで異なるRegion判定になる状態を避ける。具体Data structure / schedulingはSection 8 / 9で決定する。

#### 5.25.3 Relative Color Application

Smart Shade / Smart Lightを固定専用Brushとして閉じ込めず、Brush / Fill等が共有できるColor Application Modeとする。

Modes:
- Absolute: 通常の固定Color
- Relative Shade: Reference Colorから暗部方向へ相対変化
- Relative Light: Reference Colorから明部方向へ相対変化
- Custom Relative: Hue shift / Chroma change / Lightness change等を明示設定

Reference Color Source:
- Destination / Under-paint: 現在作用地点の下地
- Region Base Color: Persistent Fill等でStable Regionに基準色がある場合はそれを優先
- Explicit Reference Color: ユーザー指定色

BrushでRelative Colorを使う場合、赤・青・緑等の異なる下地へ同じShadow / Light relationを描ける。Fillで使う場合、選択した複数RegionそれぞれのReference Colorを基準として相対色を適用できる。

UIはHue / Chroma / Lightness等の知覚的な意味で表示し、厳密なColor transform / gamut handlingはSection 9 / 24系Color Management仕様と整合させる。

#### 5.25.4 Independent Toolsを増やさない原則

Illustro独自性は`特殊Toolを増やすこと`ではなく、通常のBrush / Fill / Selection / Lineart / ColorがStable Region / Boundary / Relative Colorを共通理解することに置く。

したがってDefault Tool RailへRegion Wash、Smart Shade、Smart Light、Boundary Pen、Region Sweep等を独立Familyとして追加しない。既存FamilyのSubtool / Property / Interaction Modeとして露出する。

#### 5.25.5 Naming


---

<!-- ILLUSTRO-V2-FULL:DETAIL:5.25 -->
#### 5.25.6 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

##### Shared Region Resolver final integration:
No redundant Tool families for Enclose Fill/Erase / Region Sweep / Persistent Region Fill / Manual Boundary Editing / Anti-overflow / Lineart-limited Paint / Recent Stroke Re-edit / Brush Morph。
Illustro novelty = common semantics across tools。
Shared Resolver Input Source / Source Revision / Gesture / Match Rule / Boundary Policy / Existing Set / Selection Constraint。
Output Resolved Region Set / Stable refs / geometry / status / diagnostics。
All consumers use same boundary meaning; no independent reinterpretation; no stale silent use。
Stable Region -> Selection Frozen default; Live explicit。Live missing -> Rebind / Freeze Last Valid / Unbind。

##### Relative Color final integration:
Canonical pipeline Reference Color -> Color Application -> Generated Paint Color -> Brush/Fill Deposit -> Blend Mode -> Result。
Relative Color != Blend Mode。

Modes:
Absolute = fixed Main Color independent reference。
Relative Shade = Hue change0 default / Chroma change0 default / Lightness decrease / quick Shade Amount。
Relative Light = Lightness increase。
Custom Relative = explicit Hue/Chroma/Lightness changes。
No naive RGB add/subtract; perceptual semantics; exact gamut Section9/5.24。

Reference Source:
1 Destination/Under-paint
2 Region Base Color
3 Explicit Reference
Destination/Under-paint uses current underlying color。Same Brush Stroke fixes Under-paint Source Revision at Stroke Start, no recursive self-feedback。

Relative Amount distinct Opacity/Flow/Density。Generate Target Color first, then deposit。Dynamics candidate Relative Amount default OFF unless preset。

Region Base stable semantic base; repeated shade strokes do not use newly shaded result as new base。Never auto-average current region。
Priority:
1 Explicit Region Base
2 Absolute Persistent Fill Assignment
3 Undefined
Undefined -> No Base Color status + Set from Current / Pick / Use Destination。No silent Destination fallback。
Stable continuation keeps base; Split children inherit; Merge differing base -> Conflict。
Explicit Reference fixed snapshot。
Relative modes do not overwrite Main/Sub。
Color Page has Color Application block。Preview multi-reference swatches。Canvas/Fill hover preview where supported。

Multi-region Fill applies same relative relation independently to each Region Base, not one absolute output color。
Transparent Destination Policy: Skip default / Use Explicit / Use Region Base。No silent black/white。
Relative changes color not alpha。Mixing separate。Blend Mode separate, default Normal; do not auto Multiply for Shade。
Shade/Light presets use same engine。Small Color Application Presets candidate。
Advanced dynamics Hue/Chroma/Relative Amount with restrained mostly-OFF defaults。
Persistent Fill may use Relative; Base change reevaluates。
Dependency cycles forbidden; chain must have absolute anchor。
Boundary-distance Fill reuses same Color Application。
Grayscale Lightness works, Hue/Chroma disabled。1bit Relative unavailable default。
Gamut deterministic/profile-aware/hue-stable strategy; exact Section9。Not AI。

Naming:
Optional preset/style names Region Wash / Smart Shade / Smart Light。
Canonical names Region Constraint / Relative Color Application / Boundary-distance Fill。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.25 -->


### 5.26 Section 5 完了条件 / Default UX Baseline

#### 5.26.1 24カテゴリCoverage

Section 2の24カテゴリすべてについて、本章でPrimary behavior / entry / parameter grouping / state / interaction semanticsを定義した。Section 5で新たにSection 2の採用外機能を暗黙追加しない。

#### 5.26.2 Default Quick Hole

- left: Undo
- right: Redo
- upper-left: Brush/Eraser toggle
- upper-right: Quick Eyedropper
- lower-left: Color Page
- lower-right: Layers Page

6 Hex geometryはSection 4を唯一の形状仕様とする。

#### 5.26.3 Default Shortcut Baseline

5.0.6のKey MapをDefaultとし、全項目Remap可能。Gesture / ShortcutはGUI Primary Routeのacceleratorであり唯一の入口にしない。

#### 5.26.4 Default Brush Baseline

Built-in 41 Presetを5.2.13の初期Baselineとする。Preset count増加を機能完成の代替指標にしない。基本描画、線画、塗り、混色、水彩、Air、Texture、Pixel用途を初期状態でカバーする。

#### 5.26.5 UI / State Consistency

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

#### 5.26.6 Section 5と後続章の境界

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

<!-- ILLUSTRO-V2-FULL:DETAIL:5.26 -->
#### 5.26.7 Section 5詳細設計統合

本項はこの節の既存仕様を失わず、詳細検討で確定した追加仕様・Default・例外・Failure semanticsを統合する。同節内の旧記述と直接矛盾する場合は、本項の後発確定仕様を優先する。

Keep 24-category coverage / Quick Hole baseline / Shortcut baseline / 41 Brush baseline / UI-State consistency / Section6-11 boundary。

18 Final Invariants:
1. 24カテゴリすべてにEntry / Primary behavior / state / parameter grouping / commit semantics。
2. Section 2採用/除外Scopeと一致。
3. Cross-tool capabilityの重複Engineを作らない。
4. Direct / Quick / Detailを定義。
5. Canonical Parameter一意。
6. PreviewとFinalの意味一致。
7. Undo粒度Semantic Transaction。
8. Non-destructive primary route優先。
9. Silent fallback / silent rasterize / silent stale state禁止。
10. Dependency failureにRecovery route。
11. Selection / Mask / Effect Mask / Guard等のCoverage semantics統一。
12. Source/Revision固定が必要な操作でself-feedback禁止。
13. Color Management共通化。
14. Random operation deterministic。
15. 特定Device/Inputだけが唯一入口になる設計禁止。
16. Accessibility baseline。
17. Background workでForeground direct interactionをBlockingしない。
18. Section6-11へ送る技術事項とSection5 user-facing semanticsを混同しない。

Foreground priority:
Direct Input -> Current Visible Working Set -> Current Logical Result -> Required Local Dependencies -> Offscreen Update -> Persistence/Thumbnail/Search/Export/Cache。

Resolved Conflicts:
3 Generic Modifier Opacity/Strength -> Effect Mix。
4 Duplicate vs Project Variant ->分離。
5 Procedural Noise vs Procedural Noise Generator（Cloud preset） -> Procedural Noise + Cloud preset。
6 Extrude -> Stylize。
8 Reconstruct vs Reconstruct -> Reconstruct統合。
9 Fill Strength ambiguity -> Tolerance + Application Opacity。
10 Reference Grayscale/Desaturate/Value Only -> Value + Saturation。
11 Layer Border/Text Outline/Outline Filter -> common Outline Effect Modifier。
12 Layer Style subsystem -> Effect Modifier。
13 Adjustment Layer/Smart Filter subsystem -> Attached/Stack Effect Modifier。
14 Transform Esc/× current-interaction conflict -> whole Transform Session Cancel。
15 Rasterize/Bake/Flatten/Export -> separate semantics。

Section2 major capability additions that must be reflected:
Text on Path / Text inside Shape / Tate-chu-yoko / Live Canvas Reference / Repeat Last / Repeat With / Effect Group / Portable Project Copy / Illustro Asset Pack / Collaboration Undo / per-view Soft Proof / Project Resource Capture。
<!-- /ILLUSTRO-V2-FULL:DETAIL:5.26 -->

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
