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
- 不透明度飽和（同一Stroke中の重ね描きがOpacity上限を超えるかを制御する）
- 不透明度を弱める（設定Opacityより弱い実効濃度へ補正する）
- 不透明度加算（Dab Alphaを加算的に蓄積する）
- 不透明度一定（Spacing等によらず実効濃度を一定化する）
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

### 2.7 塗りつぶし / 領域処理

閉領域や類似色領域を解析してColor、Selection、Transparencyを一括適用する。

- バケツ塗り
- 許容値
- 強さ
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
  - Backtrack Cancel
  - Live Preview
  - Release Commit

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

### 2.12 ゆがみ / 特殊描画 / 修正

通常Brush・Transform外の局所修正、複製、Cleanup操作を提供する。

- Liquify Drag
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
- Restore Brush【Illustro拡張】（非破壊変位をBrush範囲だけ元へ戻す）
- **Warp Guard【Illustro拡張】**（Maskで変形許容量を制御する）
  - Free
  - Partial
  - Protected

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
- Perlin Noise
- JPEG Noise Reduction
- Frosted Glass
- Stained Glass
- Pointillize / Dot
- Illustration Style
- Pencil Style
- Film Style
- Retro Game
- Glitch
- Chromatic Aberration
- Anime Background
- Cloud Generator
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

Non-destructive LiquifyはDisplacement Modifierとして扱える。Restore BrushはDisplacement Stateを局所的に戻す操作として設計可能とする。

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
