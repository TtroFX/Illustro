export type M8ToolFamilyIdV1 =
  | 'brush'
  | 'eraser'
  | 'blend'
  | 'fill'
  | 'selection'
  | 'transform'
  | 'liquify'
  | 'gradient'
  | 'eyedropper'
  | 'text'
  | 'shape-path'
  | 'repair'
  | 'ruler-guide'
  | 'navigation';

export type M8ToolRailEntryIdV1 = M8ToolFamilyIdV1 | 'lasso-direct';

export interface M8ToolSubtoolV1 {
  readonly id: string;
  readonly label: string;
  readonly proxyId: string | null;
}

export interface M8ToolFamilyV1 {
  readonly id: M8ToolFamilyIdV1;
  readonly label: string;
  readonly tone: string;
  readonly icon: string;
  readonly subtools: readonly M8ToolSubtoolV1[];
}

export const M8_TOOL_RAIL_WIDTH_V1 = Object.freeze({ min: 56, default: 64, max: 88 });

const iconV1 = (body: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

const FAMILY_ICONS_V1: Readonly<Record<M8ToolFamilyIdV1, string>> = Object.freeze({
  brush: iconV1(
    '<path d="M5 19c2.6-.1 4.3-1.4 4.6-3.8L18.2 6.6l-1.8-1.8-8.6 8.6C5.4 13.8 4.1 15.6 5 19Z"/><path d="m15.1 6.1 2.8 2.8"/>',
  ),
  eraser: iconV1(
    '<path d="m5.4 14.8 7.8-9 5.4 4.7-7.8 9H7.9l-2.5-2.2a1.7 1.7 0 0 1 0-2.5Z"/><path d="m10.7 10.4 5.3 4.7M10.8 19.5h8"/>',
  ),
  blend: iconV1(
    '<path d="M3.8 8.1c3.2-3.5 6.3-2.9 8.6.1 2.2 2.9 5.2 3.4 7.8.8"/><path d="M3.8 15.7c3.3-2.9 6.4-2.5 8.7.1 2.4 2.8 5.1 2.8 7.7.2"/><path d="M9.2 5.8c1.5 3.8 1.7 7.8.1 12.1"/>',
  ),
  fill: iconV1(
    '<path d="m5.1 11 6.1-6.1 6.7 6.7-6.1 6.1H7.4L4.9 15a2.8 2.8 0 0 1 .2-4Z"/><path d="m8.5 7.7 6.8 6.7"/><path d="M18.2 15.4c1.5 1.8 2.1 2.7 2.1 3.6a2 2 0 0 1-4 0c0-.9.6-1.8 1.9-3.6Z"/>',
  ),
  eyedropper: iconV1(
    '<path d="m7 16.9 9.1-9.1"/><path d="m13.8 5.5 4.7 4.7 1.3-1.3a2.1 2.1 0 0 0-3-3l-1.3 1.3"/><path d="M9.2 14.7 6 17.9v1.7H4.3v-1.7l3.2-3.2"/>',
  ),
  selection: iconV1(
    '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.1" stroke-dasharray="3 2"/><path d="M8 8h3M8 8v3"/>',
  ),
  transform: iconV1(
    '<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="2.1"/><path d="M12 6v12M6 12h12"/>',
  ),
  liquify: iconV1(
    '<path d="M3.5 7.3c3.5-2.7 5.7 2.4 9.1 0 3.4-2.5 5.6 2.4 7.9-.2M3.5 12c3.5-2.6 5.7 2.5 9.1 0 3.4-2.4 5.6 2.5 7.9-.1M3.5 16.8c3.5-2.7 5.7 2.4 9.1 0 3.4-2.5 5.6 2.4 7.9-.2"/><circle cx="7.5" cy="7.2" r="1"/><circle cx="16.5" cy="16.7" r="1"/>',
  ),
  gradient: iconV1(
    '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 6v12M12 6v12M16 6v12" opacity=".45"/><path d="m7 16 9-8M13 8h3v3"/>',
  ),
  'shape-path': iconV1(
    '<path d="M5 18c1-8 3.5-12 8-12 3.7 0 5.2 2.8 6 6"/><circle cx="5" cy="18" r="1.6"/><circle cx="13" cy="6" r="1.6"/><circle cx="19" cy="12" r="1.6"/><path d="M8 6h10" opacity=".55"/>',
  ),
  text: iconV1('<path d="M5 5h14M12 5v14M8.5 19h7"/>'),
  repair: iconV1(
    '<rect x="5.2" y="8.1" width="13.6" height="7.8" rx="3.8" transform="rotate(-33 12 12)"/><path d="m9.7 13 4.6-3M10.8 10.2l2.4 3.6"/><path d="M18 4v3M16.5 5.5h3"/>',
  ),
  'ruler-guide': iconV1(
    '<path d="m5 18 10.8-13 3.2 2.7L8.2 20.5 5 18Z"/><path d="m9.1 15.7 2 1.6M11 13.4l1.4 1.2M13 11l2 1.6M14.9 8.7l1.4 1.2"/>',
  ),
  navigation: iconV1(
    '<path d="M8.7 11V6.2a1.4 1.4 0 0 1 2.8 0v3.4-5a1.4 1.4 0 0 1 2.8 0v5.1-3.5a1.4 1.4 0 0 1 2.8 0v4.3-2.2a1.4 1.4 0 0 1 2.8 0v5.3c0 4-2.7 6.4-6.5 6.4h-1.1c-2 0-3.4-.7-4.6-2.2l-3-3.8a1.5 1.5 0 0 1 2.2-2l1.8 1Z"/>',
  ),
});

const lassoIconV1 = iconV1(
  '<path d="M5.2 8.8c2.4-4.5 9.8-5.2 13.2-1.1 3 3.6.1 8.2-4.6 8.8-5 .7-9.2-1.4-8.9-4.5.2-2 2.3-2.8 4-1.6 1.5 1 1.4 3.3-.2 4.2-1.2.7-2.4.3-3.3-.4"/><path d="M5.4 14.2c-.8 1.7-.8 3.3.1 4.9"/>',
);

export const M8_TOOL_FAMILIES_V1: readonly M8ToolFamilyV1[] = Object.freeze([
  { id: 'brush', label: 'ブラシ', tone: 'pink', icon: FAMILY_ICONS_V1.brush, subtools: [
    { id: 'raster-brush', label: 'ブラシ', proxyId: 'brush-mode-raster' },
    { id: 'lasso-paint', label: '投げ縄塗り', proxyId: null },
  ] },
  { id: 'eraser', label: '消しゴム', tone: 'cyan', icon: FAMILY_ICONS_V1.eraser, subtools: [
    { id: 'raster-eraser', label: '消しゴム', proxyId: 'brush-mode-eraser' },
    { id: 'lasso-erase', label: '投げ縄消去', proxyId: null },
    { id: 'enclose-erase', label: '囲って消去', proxyId: null },
  ] },
  { id: 'blend', label: 'ブレンド', tone: 'violet', icon: FAMILY_ICONS_V1.blend, subtools: [
    { id: 'smudge', label: '指先 / Smudge', proxyId: 'brush-mode-smudge' },
    { id: 'blur-brush', label: 'ぼかし', proxyId: 'brush-mode-blur' },
  ] },
  { id: 'fill', label: '塗りつぶし', tone: 'mint', icon: FAMILY_ICONS_V1.fill, subtools: [
    { id: 'flood-fill', label: '塗りつぶし', proxyId: null },
    { id: 'continuous-fill', label: '連続塗り', proxyId: null },
    { id: 'enclose-fill', label: '囲って塗る', proxyId: null },
    { id: 'pattern-fill', label: 'パターン塗り', proxyId: null },
    { id: 'flatting-seed', label: '自動色分けシード', proxyId: null },
  ] },
  { id: 'selection', label: '選択', tone: 'magenta', icon: FAMILY_ICONS_V1.selection, subtools: [
    { id: 'rectangle', label: '矩形選択', proxyId: null },
    { id: 'ellipse', label: '楕円選択', proxyId: null },
    { id: 'lasso', label: '投げ縄選択', proxyId: null },
    { id: 'polygon', label: '多角形選択', proxyId: null },
    { id: 'brush-selection', label: 'ブラシ選択', proxyId: null },
    { id: 'auto-selection', label: '自動 / Magic選択', proxyId: null },
    { id: 'color-range', label: '色域選択', proxyId: null },
    { id: 'magnetic-selection', label: 'マグネット選択', proxyId: null },
    { id: 'enclose-selection', label: '囲って選択', proxyId: null },
  ] },
  { id: 'transform', label: '変形', tone: 'orange', icon: FAMILY_ICONS_V1.transform, subtools: [
    { id: 'move', label: '移動', proxyId: null },
    { id: 'scale-rotate', label: '拡大縮小 / 回転', proxyId: null },
    { id: 'free-transform', label: '自由変形', proxyId: null },
    { id: 'perspective', label: '遠近変形', proxyId: null },
    { id: 'mesh', label: 'メッシュ変形', proxyId: null },
    { id: 'puppet', label: 'パペットワープ', proxyId: null },
    { id: 'repeat-transform', label: '反復 / ミラー変形', proxyId: null },
  ] },
  { id: 'liquify', label: 'ゆがみ', tone: 'aqua', icon: FAMILY_ICONS_V1.liquify, subtools: [
    { id: 'local-warp', label: 'ローカルワープ', proxyId: null },
  ] },
  { id: 'gradient', label: 'グラデーション', tone: 'gradient', icon: FAMILY_ICONS_V1.gradient, subtools: [
    { id: 'linear', label: '線形', proxyId: null },
    { id: 'radial', label: '放射', proxyId: null },
    { id: 'sweep', label: '円錐 / Sweep', proxyId: null },
    { id: 'freeform', label: 'フリーフォーム', proxyId: null },
  ] },
  { id: 'eyedropper', label: 'スポイト', tone: 'violet', icon: FAMILY_ICONS_V1.eyedropper, subtools: [
    { id: 'canvas-sample', label: 'キャンバスから取得', proxyId: null },
    { id: 'merged-sample', label: '統合 / 参照込み取得', proxyId: null },
    { id: 'reference-sample', label: '参照画像から取得', proxyId: null },
  ] },
  { id: 'text', label: 'テキスト', tone: 'text', icon: FAMILY_ICONS_V1.text, subtools: [
    { id: 'point-text', label: 'ポイントテキスト', proxyId: null },
    { id: 'box-text', label: 'ボックステキスト', proxyId: null },
  ] },
  { id: 'shape-path', label: '図形 / パス', tone: 'coral', icon: FAMILY_ICONS_V1['shape-path'], subtools: [
    { id: 'line', label: '直線', proxyId: null },
    { id: 'rectangle', label: '長方形', proxyId: null },
    { id: 'rounded-rectangle', label: '角丸長方形', proxyId: null },
    { id: 'ellipse', label: '楕円', proxyId: null },
    { id: 'polygon', label: '正多角形', proxyId: null },
    { id: 'polyline', label: '折れ線', proxyId: null },
    { id: 'bezier', label: 'ベジェ', proxyId: null },
    { id: 'node-edit', label: 'ノード / パス編集', proxyId: null },
  ] },
  { id: 'repair', label: '修復', tone: 'orange', icon: FAMILY_ICONS_V1.repair, subtools: [
    { id: 'clone', label: 'クローン / コピーペン', proxyId: null },
    { id: 'smart-patch', label: 'スマートパッチ', proxyId: null },
  ] },
  { id: 'ruler-guide', label: '定規 / ガイド', tone: 'yellow', icon: FAMILY_ICONS_V1['ruler-guide'], subtools: [
    { id: 'straight', label: '直線定規', proxyId: null },
    { id: 'ellipse', label: '円 / 楕円定規', proxyId: null },
    { id: 'radial', label: '放射 / 集中線', proxyId: null },
    { id: 'symmetry', label: '対称定規', proxyId: null },
    { id: 'kaleidoscope', label: '万華鏡', proxyId: null },
    { id: 'array', label: '配列', proxyId: null },
    { id: 'perspective', label: '1 / 2 / 3点透視', proxyId: null },
    { id: 'hatching', label: 'ハッチングガイド', proxyId: null },
  ] },
  { id: 'navigation', label: 'ナビゲーション', tone: 'blue', icon: FAMILY_ICONS_V1.navigation, subtools: [
    { id: 'hand-pan', label: '手のひら / Pan', proxyId: null },
    { id: 'fit', label: '画面に合わせる', proxyId: 'view-fit' },
  ] },
].map((family) => Object.freeze({ ...family, subtools: Object.freeze(family.subtools.map((item) => Object.freeze(item))) })));

export const M8_TOOL_RAIL_ORDER_V1: readonly M8ToolRailEntryIdV1[] = Object.freeze([
  'brush',
  'eraser',
  'blend',
  'fill',
  'selection',
  'transform',
  'liquify',
  'gradient',
  'eyedropper',
  'lasso-direct',
  'text',
  'shape-path',
  'repair',
  'ruler-guide',
  'navigation',
]);

export interface M8ToolRailHandleV1 {
  readonly element: HTMLElement;
  setWidth(width: number): void;
  resetWidth(): void;
  dispose(): void;
}

const STYLE_LINK_ID = 'm8-tool-rail-style';
const FAMILY_BY_ID_V1 = new Map(M8_TOOL_FAMILIES_V1.map((family) => [family.id, family]));
const PRIMARY_PROXY_BY_FAMILY_V1: Readonly<Partial<Record<M8ToolFamilyIdV1, string>>> = Object.freeze({
  brush: 'brush-mode-raster',
  eraser: 'brush-mode-eraser',
  blend: 'brush-mode-smudge',
});

function ensureStyleLinkV1(): HTMLLinkElement {
  const existing = document.getElementById(STYLE_LINK_ID);
  if (existing instanceof HTMLLinkElement) return existing;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = './m8-tool-rail.css';
  document.head.append(link);
  return link;
}

function clampWidthV1(value: number): number {
  return Math.min(M8_TOOL_RAIL_WIDTH_V1.max, Math.max(M8_TOOL_RAIL_WIDTH_V1.min, Math.round(value)));
}

function productionProxyV1(proxyId: string | null): HTMLButtonElement | null {
  if (!proxyId) return null;
  const target = document.getElementById(proxyId);
  return target instanceof HTMLButtonElement ? target : null;
}

function createFamilyButtonV1(family: M8ToolFamilyV1): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'm8c-family-button';
  button.dataset.m8cFamily = family.id;
  button.dataset.tone = family.tone;
  button.dataset.m8Tooltip = family.label;
  button.setAttribute('aria-label', family.label);
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span class="m8c-family-glyph">${family.icon}</span><span class="m8c-family-affordance" aria-hidden="true"></span>`;
  return button;
}

function createDirectLassoButtonV1(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'm8c-family-button m8c-lasso-direct';
  button.dataset.m8cEntry = 'lasso-direct';
  button.dataset.tone = 'magenta';
  button.dataset.m8Tooltip = '投げ縄選択';
  button.dataset.productionState = 'planned';
  button.setAttribute('aria-label', '投げ縄選択');
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span class="m8c-family-glyph">${lassoIconV1}</span><span class="m8c-planned-dot" aria-hidden="true"></span>`;
  return button;
}

function createFlyoutV1(): HTMLElement {
  const flyout = document.createElement('section');
  flyout.className = 'm8c-subtool-flyout';
  flyout.hidden = true;
  flyout.setAttribute('aria-label', 'サブツール');
  flyout.innerHTML = '<header><strong></strong><span></span></header><div class="m8c-subtool-list"></div>';
  return flyout;
}

export function installM8ToolRailV1(app: HTMLElement): M8ToolRailHandleV1 {
  ensureStyleLinkV1();
  const canonicalShell = app.querySelector<HTMLElement>('.m8-canonical-shell');
  const rail = app.querySelector<HTMLElement>('.m8-tool-rail');
  if (!canonicalShell || !rail) throw new Error('M8C requires the canonical M8B shell.');

  rail.replaceChildren();
  rail.classList.add('m8c-tool-rail');
  rail.dataset.m8cState = 'provisional';
  rail.setAttribute('aria-label', 'Primary Tool Rail');

  const scroller = document.createElement('div');
  scroller.className = 'm8c-rail-scroller';
  scroller.setAttribute('role', 'toolbar');
  scroller.setAttribute('aria-orientation', 'vertical');
  scroller.setAttribute('aria-label', 'ツール');

  const buttons = new Map<M8ToolRailEntryIdV1, HTMLButtonElement>();
  for (const entryId of M8_TOOL_RAIL_ORDER_V1) {
    if (entryId === 'lasso-direct') {
      const button = createDirectLassoButtonV1();
      buttons.set(entryId, button);
      scroller.append(button);
      continue;
    }
    const family = FAMILY_BY_ID_V1.get(entryId);
    if (!family) throw new Error(`M8C family is missing: ${entryId}`);
    const button = createFamilyButtonV1(family);
    const hasProductionPath = family.subtools.some((item) => productionProxyV1(item.proxyId));
    button.dataset.productionState = hasProductionPath ? 'partial' : 'planned';
    buttons.set(entryId, button);
    scroller.append(button);
  }

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'm8c-rail-resize-handle';
  resizeHandle.setAttribute('role', 'separator');
  resizeHandle.setAttribute('aria-label', 'ツールレール幅');
  resizeHandle.setAttribute('aria-orientation', 'vertical');
  resizeHandle.tabIndex = 0;

  const flyout = createFlyoutV1();
  rail.append(scroller, resizeHandle, flyout);

  let activeFamily: M8ToolFamilyIdV1 | null = null;
  let flyoutFamily: M8ToolFamilyIdV1 | 'lasso-direct' | null = null;
  let longPressTimer: number | null = null;
  let longPressFired = false;

  const setActiveFamily = (familyId: M8ToolFamilyIdV1 | null): void => {
    activeFamily = familyId;
    for (const [id, button] of buttons) {
      button.setAttribute('aria-pressed', id === familyId ? 'true' : 'false');
    }
  };

  const closeFlyout = (): void => {
    flyout.hidden = true;
    flyoutFamily = null;
  };

  const openFlyout = (entryId: M8ToolFamilyIdV1 | 'lasso-direct'): void => {
    const title = flyout.querySelector<HTMLElement>('header strong');
    const meta = flyout.querySelector<HTMLElement>('header span');
    const list = flyout.querySelector<HTMLElement>('.m8c-subtool-list');
    if (!title || !meta || !list) return;
    list.replaceChildren();

    if (entryId === 'lasso-direct') {
      title.textContent = '投げ縄選択';
      meta.textContent = 'Selection family';
      const pending = document.createElement('button');
      pending.type = 'button';
      pending.disabled = true;
      pending.dataset.productionState = 'planned';
      pending.innerHTML = '<span>投げ縄選択</span><small>production接続待ち</small>';
      list.append(pending);
    } else {
      const family = FAMILY_BY_ID_V1.get(entryId);
      if (!family) return;
      title.textContent = family.label;
      meta.textContent = `${family.subtools.length} subtools`;
      for (const subtool of family.subtools) {
        const button = document.createElement('button');
        button.type = 'button';
        const proxy = productionProxyV1(subtool.proxyId);
        button.dataset.m8cSubtool = subtool.id;
        button.dataset.productionState = proxy ? 'available' : 'planned';
        button.innerHTML = `<span>${subtool.label}</span><small>${proxy ? '利用可能' : '接続待ち'}</small>`;
        if (!proxy) {
          button.disabled = true;
        } else {
          button.addEventListener('click', () => {
            proxy.click();
            setActiveFamily(family.id);
            closeFlyout();
          });
        }
        list.append(button);
      }
    }

    const source = buttons.get(entryId);
    if (!source) return;
    const railRect = rail.getBoundingClientRect();
    const buttonRect = source.getBoundingClientRect();
    const top = Math.max(6, Math.min(buttonRect.top - railRect.top - 8, railRect.height - 270));
    flyout.style.setProperty('--m8c-flyout-top', `${top}px`);
    flyout.hidden = false;
    flyoutFamily = entryId;
  };

  const activatePrimary = (familyId: M8ToolFamilyIdV1): void => {
    const family = FAMILY_BY_ID_V1.get(familyId);
    if (!family) return;
    const primaryId = PRIMARY_PROXY_BY_FAMILY_V1[familyId];
    const target = primaryId ? productionProxyV1(primaryId) : null;
    if (!target) {
      openFlyout(familyId);
      return;
    }
    if (activeFamily === familyId) {
      openFlyout(familyId);
      return;
    }
    target.click();
    setActiveFamily(familyId);
    closeFlyout();
  };

  const cancelLongPress = (): void => {
    if (longPressTimer !== null) globalThis.clearTimeout(longPressTimer);
    longPressTimer = null;
  };

  const onRailClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.m8c-family-button') : null;
    if (!target) return;
    const direct = target.dataset.m8cEntry;
    if (direct === 'lasso-direct') {
      openFlyout('lasso-direct');
      return;
    }
    const familyId = target.dataset.m8cFamily as M8ToolFamilyIdV1 | undefined;
    if (familyId) activatePrimary(familyId);
  };

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.m8c-family-button') : null;
    if (!target || event.button !== 0) return;
    cancelLongPress();
    longPressFired = false;
    const entryId = (target.dataset.m8cEntry ?? target.dataset.m8cFamily) as M8ToolRailEntryIdV1 | undefined;
    if (!entryId) return;
    longPressTimer = globalThis.setTimeout(() => {
      longPressFired = true;
      openFlyout(entryId);
    }, 460);
  };

  const onPointerUp = (event: PointerEvent): void => {
    cancelLongPress();
    if (!longPressFired) return;
    event.preventDefault();
    event.stopPropagation();
    longPressFired = false;
  };

  const onContextMenu = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.m8c-family-button') : null;
    if (!target) return;
    event.preventDefault();
    const entryId = (target.dataset.m8cEntry ?? target.dataset.m8cFamily) as M8ToolRailEntryIdV1 | undefined;
    if (entryId) openFlyout(entryId);
  };

  scroller.addEventListener('click', onRailClick);
  scroller.addEventListener('pointerdown', onPointerDown);
  scroller.addEventListener('pointerup', onPointerUp);
  scroller.addEventListener('pointercancel', cancelLongPress);
  scroller.addEventListener('contextmenu', onContextMenu);

  const updateWidth = (width: number): void => {
    const next = clampWidthV1(width);
    canonicalShell.style.setProperty('--m8-rail-width', `${next}px`);
    resizeHandle.setAttribute('aria-valuemin', String(M8_TOOL_RAIL_WIDTH_V1.min));
    resizeHandle.setAttribute('aria-valuemax', String(M8_TOOL_RAIL_WIDTH_V1.max));
    resizeHandle.setAttribute('aria-valuenow', String(next));
  };

  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartWidth = M8_TOOL_RAIL_WIDTH_V1.default;

  const onResizePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartWidth = rail.getBoundingClientRect().width;
    resizeHandle.setPointerCapture?.(event.pointerId);
    resizeHandle.classList.add('is-dragging');
    event.preventDefault();
  };
  const onResizePointerMove = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) return;
    updateWidth(dragStartWidth + event.clientX - dragStartX);
  };
  const finishResize = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) return;
    dragPointerId = null;
    resizeHandle.classList.remove('is-dragging');
  };
  const onResizeKeyDown = (event: KeyboardEvent): void => {
    const current = Number(resizeHandle.getAttribute('aria-valuenow')) || M8_TOOL_RAIL_WIDTH_V1.default;
    if (event.key === 'ArrowLeft') {
      updateWidth(current - 4);
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      updateWidth(current + 4);
      event.preventDefault();
    } else if (event.key === 'Home') {
      updateWidth(M8_TOOL_RAIL_WIDTH_V1.min);
      event.preventDefault();
    } else if (event.key === 'End') {
      updateWidth(M8_TOOL_RAIL_WIDTH_V1.max);
      event.preventDefault();
    }
  };
  const resetWidth = (): void => updateWidth(M8_TOOL_RAIL_WIDTH_V1.default);

  resizeHandle.addEventListener('pointerdown', onResizePointerDown);
  resizeHandle.addEventListener('pointermove', onResizePointerMove);
  resizeHandle.addEventListener('pointerup', finishResize);
  resizeHandle.addEventListener('pointercancel', finishResize);
  resizeHandle.addEventListener('keydown', onResizeKeyDown);
  resizeHandle.addEventListener('dblclick', resetWidth);

  const observedTargets = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#brush-mode-raster, #brush-mode-eraser, #brush-mode-smudge, #brush-mode-blur'),
  );
  const syncFromProduction = (): void => {
    const active = observedTargets.find((target) => target.getAttribute('aria-pressed') === 'true');
    if (!active) return;
    if (active.id === 'brush-mode-raster') setActiveFamily('brush');
    else if (active.id === 'brush-mode-eraser') setActiveFamily('eraser');
    else if (active.id === 'brush-mode-smudge' || active.id === 'brush-mode-blur') setActiveFamily('blend');
  };
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(syncFromProduction) : null;
  for (const target of observedTargets) observer?.observe(target, { attributes: true, attributeFilter: ['aria-pressed', 'class'] });

  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (flyout.hidden) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (flyout.contains(target) || rail.contains(target)) return;
    closeFlyout();
  };
  document.addEventListener('pointerdown', onDocumentPointerDown, true);

  resetWidth();
  syncFromProduction();
  app.dataset.m8ToolRail = 'provisional';

  return {
    element: rail,
    setWidth: updateWidth,
    resetWidth,
    dispose(): void {
      cancelLongPress();
      observer?.disconnect();
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      scroller.removeEventListener('click', onRailClick);
      scroller.removeEventListener('pointerdown', onPointerDown);
      scroller.removeEventListener('pointerup', onPointerUp);
      scroller.removeEventListener('pointercancel', cancelLongPress);
      scroller.removeEventListener('contextmenu', onContextMenu);
      resizeHandle.removeEventListener('pointerdown', onResizePointerDown);
      resizeHandle.removeEventListener('pointermove', onResizePointerMove);
      resizeHandle.removeEventListener('pointerup', finishResize);
      resizeHandle.removeEventListener('pointercancel', finishResize);
      resizeHandle.removeEventListener('keydown', onResizeKeyDown);
      resizeHandle.removeEventListener('dblclick', resetWidth);
      canonicalShell.style.removeProperty('--m8-rail-width');
      rail.classList.remove('m8c-tool-rail');
      rail.removeAttribute('data-m8c-state');
      delete app.dataset.m8ToolRail;
    },
  };
}
