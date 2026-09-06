### 5.7 塗りつぶし / 領域処理

#### 5.7.1 Fill Family

Default SubtoolsはFlood Fill、Continuous Fill、Enclose Fill、Pattern Fill、Flatting Seed。GradientはColor / Fill系機能だが独立Family ButtonにはせずFill / Color routeから起動する。

#### 5.7.2 Flood Fill

Properties:
- Tolerance
- Strength
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

Lasso状に囲った領域内のeligible regionを解析し一括Fill / Erase。囲みGeometryのRelease後に結果を即成立させ、offscreen全解析を同期必須にしない。

#### 5.7.7 Gap Paint / Closed-area Fill / Contour Fill

Gap PaintはBrush-like inputで小さな塗り残しを対象。Closed-area Fillは閉領域候補を連続検出。Contour Fillは複数色 / lineから囲まれた範囲を指定方式で補間する。各ModeはPropertiesで作用範囲を明示する。

#### 5.7.8 Persistent Region Fill

Lineart Stable Region IDへColor Assignmentを関連付ける。Lineart変更後のSplit / Mergeでは自動再対応付け結果を表示し、曖昧な場合はManual Overrideを要求する。誤ったRegionへ黙ってColorを移さない。

#### 5.7.9 Leak Diagnostics

Fillが意図せず外へ漏れた場合、`Diagnose Leak`でLeak Path / Gap CandidateをCanvas Overlay表示。候補選択でAssist > Lineart / Gap Closeへ移動できる。Diagnostics自体はArtworkを変更しない。

#### 5.7.10 Region Sweep

Pointer移動でRegionを連続Addし、Backtrackで直近追加を取消可能。Releaseで1 TransactionとしてCommit。Sweep中の対象Regionはhighlightし、既追加Regionを視覚識別する。

---

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

### 5.12 ゆがみ / 特殊描画 / 修正

#### 5.12.1 Liquify Entry

`Filter > Liquify`またはCommand SearchからCanvas direct Liquify Modeへ入る。Primary routeはnon-destructive Displacement Modifier。

PropertiesはBrush Size、Strength、Mode、Guard、Reconstruct / Restoreを表示。

#### 5.12.2 Liquify Modes

Drag / Push / Pinch / Expand / Smooth / Reconstructを提供。Pointer drag中Current Effective Stateへ即反映。Mode switchは同一Continuous Transaction内で可能。

#### 5.12.3 Non-destructive Displacement Field

Liquify結果はDefaultでDisplacement Modifierとして保持し、後からEdit / Disable / Reorder可能。`Bake Liquify`のみrasterize。

#### 5.12.4 Restore Brush

Restore BrushはDisplacementを局所的に元へ戻す。Strength 100%でoriginal displacement stateへ近づける。元Raster contentを描き直すToolではない。

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
