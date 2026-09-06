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

## 3. 基本概念・データモデル — 設計中

### 3.0 この章の位置づけ

本章は、Section 2で確定した機能群を共通の概念・データ構造で成立させるための基礎モデルを定義する。

UIの最終配置、内部実装言語、GPU API、保存フォーマットの物理構造、具体的アルゴリズムは後続章で決定する。本章では、機能間で意味が食い違わないための概念境界、所有関係、座標、識別、依存関係、状態モデルを確定する。

### 3.1 Project / Document / Canvas / View — 確定

#### 3.1.1 基本分離

Illustroでは、Project、Document、Document Space、Canvas Rect、Frame Variant、Viewを別概念とする。

- **Project**: `.illustro`として保存される作品パッケージ全体。Document本体に加え、履歴、Branch、Checkpoint、埋め込みResource、Reference、Export設定、Recovery metadata等を収容できる。
- **Document**: 一枚の作品の編集可能な正本。Layer構造、色空間、Canvas、非破壊情報等を所有する。
- **Document Space**: Artworkが存在できる共通座標空間。Canvas境界より広く存在できる。
- **Canvas Rect**: Document Space上にある有限矩形。通常の作品表示・標準Exportの基準領域。
- **Frame Variant**: Canvasを破壊せず保存する追加の出力矩形。
- **View**: Pan、Zoom、Rotation、Mirror等のArtworkを変更しない表示状態。

1 Project : 1 Documentを基本とする。UI上はProjectとDocumentを強く意識させる必要はないが、データモデル上は分離する。

#### 3.1.2 Canvas外Artwork

Document SpaceはCanvas Rectに制限されない。Layer、Object、Pixel等はCanvas外にも存在でき、Canvas外へ移動しただけでは破棄しない。

Canvas縮小、非破壊Crop、Frame変更ではCanvas外Artworkを保持する。Canvas外Dataを本当に削除する場合は、「キャンバス外データをトリミング」等の明示的な破壊操作として扱う。

Canvas Size変更はArtwork DataのCropと同義にしない。

#### 3.1.3 Viewの独立

View TransformはDocument Dataから完全に分離する。Zoom、Pan、View Rotation、Mirrorを変更しても、Pixel座標、Layer位置、Selection、Mask、Export結果等のCanonical Artworkは変更しない。

View StateはUndo / Redo対象とは原則分離するが、作業状態としてProject metadataへ保存可能とする。

### 3.2 座標系 — 確定

#### 3.2.1 Document Space

Document Spaceを作品全体の唯一の安定した世界座標系とする。

- 初期原点は新規Canvas左上 `(0, 0)` とする。
- +Xは右、+Yは下とする。
- 単位はDocument Pixel相当とする。
- 整数だけでなく連続値・小数座標を正式に許可する。
- Canvasを左・上へ拡張した場合、Canvas Rectを負座標へ伸ばし、既存ArtworkのDocument座標は書き換えない。

例: 初期Canvas `(0, 0, 4000, 3000)` を左へ500px拡張する場合、Canvas Rectは `(-500, 0, 4500, 3000)` となる。Document原点と既存Artwork座標は動かさない。

#### 3.2.2 Canvas座標

CanvasをDocument Spaceと別の恒久座標系にはしない。CanvasはDocument Space上のRectである。

UI等でCanvas相対座標が必要な場合は、`canvasX = documentX - canvasRect.x`、`canvasY = documentY - canvasRect.y` のような派生座標として求める。

Frame VariantもDocument Space上のRectとしてCanvas Rectと同列に扱う。

#### 3.2.3 Local Spaceと親子Transform

Layer、Object、Text、Vector、Image Material、Embedded Object、Lineart Group等は必要に応じて自身のLocal Spaceを持つ。

Source Dataの座標とDocument上の配置を分離し、Local → Parent → DocumentのTransform連鎖で位置を求める。子は所有者のLocal Spaceで表現できる。

具体的なMatrix表現や数値型は技術設計で決める。

#### 3.2.4 Raster Pixel規約

Raster Pixel `(x, y)` は `[x, x+1) × [y, y+1)` の1×1セルとして扱い、Pixel中心は `(x+0.5, y+0.5)` とする。

Stroke、Selection、Vector、Transform等の座標は早期に整数丸めしない。連続座標を保持し、Rasterize時にPixel Coverageへ変換する。

これにより1px線、Vector→Raster、Selection Edge、Snap、Subpixel Transform等での0.5pxずれを避ける。

#### 3.2.5 View / Workspace / Device Space

- **View Transform**: Document SpaceからWorkspace上のCanvas表示へ変換する。Pan、Zoom、Rotation、Mirrorを含む。
- **Workspace / UI Space**: Tool Rail、Inspector、Floating PiP、Quick Hole、Popup、Selection Launcher等のアプリUIを配置する座標系。
- **Device Pixel Space**: Workspace logical pixelをdevicePixelRatio等で物理Display pixelへ変換した最終表示座標。

PiPやQuick HoleのUI GeometryはWorkspace Spaceに置き、CanvasのZoom / Rotationと一緒に拡大・回転させない。Quick HoleはDocument / Canvas interactionをAnchor情報として利用できるが、UI本体はWorkspace Spaceに存在する。

Device Pixel値は端末依存であるためCanonical Artwork Dataへ保存しない。

#### 3.2.6 入力座標

Pen / Touch / Mouse入力はWorkspace側のPointer positionと、timestamp、pressure、tilt、orientation、pointer type等の利用可能な情報を保持する。

描画対象に応じて、Workspace → inverse View → Document → inverse Owner Transform → Local Spaceへ変換する。

座標変換の都合でRaw / Coalesced Input Sampleを早期に捨てない。

#### 3.2.7 Selection / Mask / Boundary / Ruler

- Selection MaskのCanonical結果は原則Document Spaceに置く。
- Selection RecipeのSourceはLayer Alpha等のOwner Local Spaceを参照できる。Source変更時は最終SelectionをDocument Spaceへ再評価する。
- Layer MaskはOwner LayerのLocal Spaceを基本とし、Link / Unlink時は独自Transformを追加できる。
- Lineart BoundaryとStable Region topologyはLineart Group Local Spaceを基本とする。Group TransformのみではRegion Identityを変更しない。
- Global Ruler / GuideはDocument Spaceを基本とする。
- Layer-linked RulerはOwner Local Spaceへ関連付けられる。

#### 3.2.8 共同編集の座標

共同編集でCanonical Dataとして同期する座標はDocument Spaceまたは明示されたOwner Local Spaceとする。Screen / Workspace / Device依存座標を作品データとして同期しない。

異なる端末、Zoom、画面解像度でも同じStroke / Objectを再現できることを前提とする。

### 3.3 Layer Tree / Node Model — 確定

#### 3.3.1 Tree + Dependency Graph

DocumentのArtwork構造はVisual Treeを基本とする。ただし、Visual TreeはContainmentとStack順のみを担当し、Reference、Sharing、Constraint、Source / Instance等の非親子関係はDependency Graphとして別管理する。

つまり、Illustroの基本構造は「Visual Tree + Dependency Graph」とする。

#### 3.3.2 共通Node基盤

Visual Tree上の編集対象は共通Node基盤を持つ。

Nodeは少なくとも以下の概念を持つ。

- identity
- type
- name
- parent
- sibling order
- visibility
- lock state
- local transform
- metadata
- optional capabilities

Tool側はNode Typeの列挙だけに強く依存せず、`canPaint`、`canTransform`、`canMask`、`canClip`、`canHaveChildren`、`canRasterize`、`canProvideBoundary`、`canBeReference`、`canExportVector`等のCapabilityによって操作可否を判断できる構造を前提とする。

#### 3.3.3 Content Node

Artwork内容を生成・保持するNode系をContent Nodeとして扱う。

主な種類:

- RasterNode
- VectorNode
- TextNode
- FillNode
- GradientNode
- ImageMaterialNode
- FileObjectNode
- EmbeddedObjectNode

RasterNodeはPixel Dataを、VectorNodeはPath / Shape Geometryを、TextNodeは文字列とTypography状態を保持する。Fill / Gradient等は固定RasterではなくParameterから描画結果を生成できる。

#### 3.3.4 Container Node

複数Nodeを所有するNodeをContainer Nodeとして扱う。

- FolderNode
- LineartGroupNode

Folderは子Nodeを階層化し、Visibility、Transform、Mask等をまとめて扱える。

LineartGroupは単なるFolderではなく、Folder的Container能力に加えてLineart固有Semanticを持つ特殊Containerとする。Visible Lineart Childrenと、Boundary topology、Stable Region Table等を同じGroupへ所属させる。

#### 3.3.5 Attachment

MaskやLineart Boundary等、常に明確なOwnerへ付属するDataを普通のSibling Layerとして無理にVisual Stackへ置かず、Attachmentとして扱える構造にする。

- Layer MaskはOwner NodeのMask Attachmentとする。
- Maskは将来複数Stackを許可できる内部モデルとする。
- Lineart Boundary / Stable Region TableはLineart Groupの非描画Attachmentとする。

UI上で「Layer」「Boundary Layer」等として見せる場合でも、内部の所有関係を曖昧にしない。

#### 3.3.6 Modifier

非破壊処理にはStack ModifierとAttached Modifierを区別する。

- **Stack Modifier**: Visual Stack上の位置によって下位Compositeへ作用する。Adjustment Layer等。
- **Attached Modifier**: 特定Owner Nodeへ直接付く。Non-destructive Filter、Transform等。

1 Nodeへ複数Modifierを順序付きModifier Stackとして保持でき、個別Edit、Disable、Reorder、Removeを可能にする。

Shared Modifierは同じEffectをTreeへ複製するのではなく、一つのModifier Sourceを複数NodeがDependency Edgeで参照するモデルを前提とする。

Adjustment LayerとShared Modifierは別概念とし、前者はStack位置、後者は明示Referenceで対象を決める。

#### 3.3.7 Source / Instance対応

Linked Shape、Image / Material Source、Embedded Object等のために、Source DataとInstance Nodeを分離できる構造を前提とする。

InstanceはSource Referenceに加え、独自Transform、Override、Mask、Effect等を持てる。詳細はSource / Instance Modelで確定する。

#### 3.3.8 Auxiliary Registry

Compositeへ直接参加しないDocument DataはVisual Treeへ無理に混在させず、必要に応じRegistryとして管理する。

- Saved Selection Registry
- Global Ruler Registry
- Guide Registry
- Frame Variant Registry

Layer-linked Ruler等はOwner NodeへのDependencyを持てる。

#### 3.3.9 Composite参加

「Layer Panelに見えること」と「画像Compositeへ参加すること」を同義にしない。

Raster、Vector、Text等は描画内容としてCompositeへ参加する。AdjustmentはEffectとして参加する。Mask、Selection、Boundary、Ruler、Guide等は通常のColor Compositeには直接参加しない。

FolderはIsolated CompositeとPass-through Compositeの両方式を正式サポートする。

#### 3.3.10 Clipping / Reference / Metadata

Clippingは単純な名前や現在順序の暗黙推測だけに依存せず、Source NodeとClip Base Nodeの関係を追跡可能なDependencyとして扱えるようにする。UX上は大手アプリと同様の「下のLayerへClip」という操作を維持する。

Layer Role、Draft、Reference、Private / Shared等はNode Typeとは分離したMetadata / Stateとする。

例:

- RasterNode + role=lineart
- VectorNode + role=lineart
- RasterNode + visibilityScope=private
- TextNode + role=reference

描画方式、意味的役割、共同編集範囲を混同しない。

#### 3.3.11 Tree不変条件

- Visual Tree内の1 Nodeは同時に複数Parentを持たない。
- Visual TreeのCycleは禁止する。
- 同じSourceを複数箇所で利用したい場合はReference / Instanceを用いる。
- Dependency GraphのCycle可否はDependency Typeごとに明示規則を持つ。無限再評価を起こすCycleを許可しない。

次項では、名前変更、並べ替え、Undo / Redo、Branch、共同編集等を跨いでも同じEntityを追跡するIdentity / Stable ID Modelを定義する。
