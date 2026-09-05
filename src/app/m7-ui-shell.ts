export type M7ToolShellStateV1 = 'available' | 'planned';

export interface M7ToolFamilyShellV1 {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly progress: string;
  readonly state: M7ToolShellStateV1;
  readonly targetId: string | null;
  readonly note: string;
}

export const M7_TOOL_FAMILIES_V1: readonly M7ToolFamilyShellV1[] = Object.freeze([
  Object.freeze({
    id: 'brush',
    label: 'Brush',
    icon: '●',
    progress: 'M8C-005 / M6A',
    state: 'available',
    targetId: 'brush-mode-raster',
    note: 'ブラシ',
  }),
  Object.freeze({
    id: 'eraser',
    label: 'Eraser',
    icon: '◇',
    progress: 'M8C-006 / M6A',
    state: 'available',
    targetId: 'brush-mode-eraser',
    note: '消しゴム',
  }),
  Object.freeze({
    id: 'blend',
    label: 'Blend',
    icon: '≈',
    progress: 'M8C-007 / M6A',
    state: 'available',
    targetId: 'brush-mode-smudge',
    note: '指先・ぼかし',
  }),
  Object.freeze({
    id: 'fill',
    label: 'Fill',
    icon: '▣',
    progress: 'M8C-008 / M7B',
    state: 'planned',
    targetId: null,
    note: 'M7Bで接続',
  }),
  Object.freeze({
    id: 'eyedropper',
    label: 'Pick',
    icon: '◉',
    progress: 'M8C-009 / M7',
    state: 'planned',
    targetId: null,
    note: 'M7で接続',
  }),
  Object.freeze({
    id: 'selection',
    label: 'Select',
    icon: '▱',
    progress: 'M8C-010 / M7A',
    state: 'planned',
    targetId: null,
    note: 'M7Aで接続',
  }),
  Object.freeze({
    id: 'transform',
    label: 'Move',
    icon: '↗',
    progress: 'M8C-011 / M7C',
    state: 'planned',
    targetId: null,
    note: 'M7Cで接続',
  }),
  Object.freeze({
    id: 'liquify',
    label: 'Liquify',
    icon: '≋',
    progress: 'M8C-012 / M7I',
    state: 'planned',
    targetId: null,
    note: 'M7Iで接続',
  }),
  Object.freeze({
    id: 'gradient',
    label: 'Gradient',
    icon: '◩',
    progress: 'M8C-013 / M7B',
    state: 'planned',
    targetId: null,
    note: 'M7Bで接続',
  }),
  Object.freeze({
    id: 'shape',
    label: 'Shape',
    icon: '◇',
    progress: 'M8C-014 / M7D',
    state: 'planned',
    targetId: null,
    note: 'M7Dで接続',
  }),
  Object.freeze({
    id: 'text',
    label: 'Text',
    icon: 'T',
    progress: 'M8C-015 / M7E',
    state: 'planned',
    targetId: null,
    note: 'M7Eで接続',
  }),
  Object.freeze({
    id: 'repair',
    label: 'Repair',
    icon: '✚',
    progress: 'M8C-016 / M7I',
    state: 'planned',
    targetId: null,
    note: 'M7Iで接続',
  }),
  Object.freeze({
    id: 'ruler',
    label: 'Ruler',
    icon: '∠',
    progress: 'M8C-017 / M7D',
    state: 'planned',
    targetId: null,
    note: 'M7Dで接続',
  }),
  Object.freeze({
    id: 'navigation',
    label: 'View',
    icon: '⌖',
    progress: 'M8C-018 / M7J',
    state: 'available',
    targetId: 'view-fit',
    note: '基本表示操作は利用可',
  }),
]);

export type M7InspectorSurfaceV1 =
  | 'layers'
  | 'color'
  | 'brush'
  | 'effects'
  | 'navigator'
  | 'reference';

export interface M7UiSkeletonHandleV1 {
  setInspectorSurface(surface: M7InspectorSurfaceV1): void;
  dispose(): void;
}

const STYLE_ID = 'm7-ui-shell-style';
const TOOL_DRAWER_ID = 'm7-tool-drawer';

const M7_UI_SHELL_CSS = `
.m7-tool-slot { position: relative; display: grid; place-items: center; min-width: 0; }
.shell-rail-slots { align-content: start; gap: 3px; overflow: auto; scrollbar-width: none; }
.shell-rail-slots::-webkit-scrollbar { display: none; }
.m7-family-button { position: relative; display: grid; grid-template-rows: 24px 11px; place-items: center; width: 100%; min-width: 44px; min-height: 44px; padding: 4px 2px 3px; border: 0; border-radius: 10px; background: transparent; color: #465267; font: inherit; line-height: 1; cursor: pointer; }
.m7-family-button .m7-tool-icon { font-size: 20px; font-weight: 650; line-height: 24px; }
.m7-family-button .m7-tool-label { overflow: hidden; max-width: 100%; font-size: 9px; font-weight: 720; line-height: 11px; text-overflow: ellipsis; white-space: nowrap; }
.m7-family-button:hover:not(:disabled) { background: #f4f6fa; }
.m7-family-button:active:not(:disabled) { transform: scale(.96); }
.m7-family-button[aria-pressed="true"], .m7-tool-slot:has(.shell-brush-mode[aria-pressed="true"]) > .m7-family-button { background: #fff0dc; color: #9a5100; box-shadow: inset 0 0 0 1px #f3c681; }
.m7-family-button:disabled { cursor: default; opacity: .48; }
.m7-family-button:disabled::after { content: ''; position: absolute; right: 5px; top: 5px; width: 5px; height: 5px; border-radius: 99px; background: #aab2bf; }
.m7-subtool-toggle { position: absolute; right: 1px; bottom: 1px; z-index: 2; width: 17px; height: 17px; padding: 0; border: 0; border-radius: 6px; background: #fff; color: #6a7382; font: 9px/1 sans-serif; box-shadow: 0 1px 4px rgb(20 30 50 / 16%); }
.m7-subtool-popover { position: absolute; z-index: 80; left: calc(100% + 7px); top: 0; display: none; min-width: 108px; padding: 6px; border: 1px solid #e3e7ee; border-radius: 10px; background: rgb(255 255 255 / 98%); box-shadow: 0 10px 30px rgb(30 38 55 / 16%); }
.m7-tool-slot.is-subtool-open .m7-subtool-popover { display: grid; gap: 4px; }
.m7-subtool-popover button { min-height: 34px; padding: 0 10px; border: 0; border-radius: 8px; background: #f7f8fb; color: #394457; text-align: left; font: 600 11px/1 system-ui, sans-serif; }
.shell-inspector.m7-inspector-ready { grid-template-rows: auto minmax(0, 1fr) auto; }
.m7-inspector-body { min-height: 0; overflow: hidden; }
.m7-inspector-surface { display: grid; min-height: 0; height: 100%; align-content: start; overflow: auto; }
.m7-inspector-surface[hidden] { display: none !important; }
.m7-inspector-surface[data-m7-inspector-surface="layers"] { grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; }
.m7-inspector-tabs { display: grid !important; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 3px; padding: 5px 6px; border-bottom: 1px solid #e7eaf0; background: #fff; }
.m7-inspector-tabs button { min-width: 0; min-height: 32px; padding: 3px 2px; border: 0; border-radius: 8px; background: transparent; color: #667084; font: 700 9px/1.1 system-ui, sans-serif; white-space: nowrap; cursor: pointer; }
.m7-inspector-tabs button[aria-selected="true"] { background: #fff0dc; color: #8a4b08; box-shadow: inset 0 0 0 1px #f2cc96; }
.m7-shell-panel { gap: 8px; padding: 10px; }
.m7-shell-panel header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.m7-shell-panel header strong { font-size: 12px; }
.m7-shell-panel .m7-shell-note { margin: 0; color: #7a8391; font-size: 10px; line-height: 1.45; }
.m7-shell-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.m7-shell-actions button { min-height: 34px; padding: 4px 6px; border: 1px solid #e3e7ee; border-radius: 8px; background: #fff; color: #4b5668; font: 650 10px/1.2 system-ui, sans-serif; }
.m7-shell-actions button:disabled { color: #9aa2af; background: #f6f7f9; }
.m7-inspector-action-strip { position: sticky; z-index: 4; bottom: 0; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 4px; padding: 6px; border-top: 1px solid #e5e9ef; background: rgb(255 255 255 / 95%); backdrop-filter: blur(12px); }
.m7-inspector-action-strip button { min-height: 36px; border: 0; border-radius: 9px; background: #f5f7fa; color: #536073; font: 700 9px/1 system-ui, sans-serif; }
.m7-inspector-action-strip button:hover { background: #eef1f5; }
.m7-tool-drawer { position: fixed; z-index: 90; inset: 48px 8px calc(72px + env(safe-area-inset-bottom, 0px)) 8px; display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; border: 1px solid rgb(213 219 228 / 95%); border-radius: 18px; background: rgb(255 255 255 / 97%); box-shadow: 0 18px 50px rgb(24 31 45 / 24%); backdrop-filter: blur(18px); }
.m7-tool-drawer[hidden] { display: none !important; }
.m7-tool-drawer-header { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 10px 0 14px; border-bottom: 1px solid #e8ebf0; }
.m7-tool-drawer-header strong { font-size: 14px; }
.m7-tool-drawer-header button { width: 38px; height: 38px; border: 0; border-radius: 10px; background: transparent; color: #596477; font-size: 20px; }
.m7-tool-drawer-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; align-content: start; overflow: auto; padding: 10px; }
.m7-tool-drawer-grid .m7-family-button { min-height: 58px; border: 1px solid #e7eaf0; background: #fff; }
.m7-tool-drawer-grid .m7-lasso-shortcut { border-style: dashed; }
@media (max-width: 799px) and (pointer: coarse) {
  .shell-mobile-toolbar { grid-template-columns: 1.05fr repeat(6, minmax(40px, 1fr)) !important; }
  .shell-mobile-toolbar #mobile-tools { display: grid; }
  .shell-inspector.m7-inspector-ready { grid-template-rows: 48px auto minmax(0, 1fr) !important; }
  .m7-inspector-surface:not([hidden]) > .shell-inspector-card { display: grid !important; }
  .m7-inspector-action-strip { display: none; }
  .m7-inspector-tabs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .m7-inspector-tabs button { min-height: 36px; font-size: 10px; }
}
`;

function installStyleV1(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = M7_UI_SHELL_CSS;
  document.head.append(style);
}

function decorateFamilyButtonV1(button: HTMLButtonElement, family: M7ToolFamilyShellV1): void {
  button.classList.add('m7-family-button');
  button.dataset.m7ToolFamily = family.id;
  button.dataset.m7Progress = family.progress;
  button.title = `${family.label} — ${family.note}`;
  button.setAttribute('aria-label', `${family.label}: ${family.note}`);
  button.innerHTML =
    `<span class="m7-tool-icon" aria-hidden="true">${family.icon}</span>` +
    `<span class="m7-tool-label">${family.label}</span>`;
  if (family.state === 'planned') {
    button.disabled = true;
    button.dataset.m7State = 'planned';
  } else {
    button.disabled = false;
    button.dataset.m7State = 'available';
  }
}

function createPlannedFamilyButtonV1(family: M7ToolFamilyShellV1): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = `tool-family-${family.id}`;
  decorateFamilyButtonV1(button, family);
  return button;
}

function installToolRailV1(app: HTMLElement, cleanup: Array<() => void>): void {
  const slots = app.querySelector<HTMLElement>('.shell-rail-slots');
  if (!slots) return;

  const existing = new Map<string, HTMLButtonElement>();
  for (const id of [
    'brush-mode-raster',
    'brush-mode-eraser',
    'brush-mode-smudge',
    'brush-mode-blur',
  ]) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) existing.set(id, button);
  }

  const fragment = document.createDocumentFragment();
  for (const family of M7_TOOL_FAMILIES_V1) {
    const slot = document.createElement('div');
    slot.className = 'm7-tool-slot';
    slot.dataset.m7ToolSlot = family.id;

    let button: HTMLButtonElement;
    if (family.targetId !== null && existing.has(family.targetId)) {
      button = existing.get(family.targetId) as HTMLButtonElement;
      decorateFamilyButtonV1(button, family);
    } else {
      button = createPlannedFamilyButtonV1(family);
      if (family.id === 'navigation') {
        button.disabled = false;
        button.dataset.m7State = 'available';
        const onNavigation = (): void => document.getElementById('view-fit')?.click();
        button.addEventListener('click', onNavigation);
        cleanup.push(() => button.removeEventListener('click', onNavigation));
      }
    }
    slot.append(button);

    if (family.id === 'blend') {
      const blurButton = existing.get('brush-mode-blur');
      if (blurButton) {
        blurButton.className = 'shell-brush-mode';
        blurButton.type = 'button';
        blurButton.textContent = 'ぼかし';
        blurButton.title = 'ぼかし / Blur';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'm7-subtool-toggle';
        toggle.textContent = '▸';
        toggle.setAttribute('aria-label', 'Blendサブツール');
        toggle.setAttribute('aria-expanded', 'false');
        const popover = document.createElement('div');
        popover.className = 'm7-subtool-popover';
        popover.append(blurButton);
        const onToggle = (event: Event): void => {
          event.stopPropagation();
          const open = slot.classList.toggle('is-subtool-open');
          toggle.setAttribute('aria-expanded', String(open));
        };
        const onBlur = (): void => {
          slot.classList.remove('is-subtool-open');
          toggle.setAttribute('aria-expanded', 'false');
        };
        toggle.addEventListener('click', onToggle);
        blurButton.addEventListener('click', onBlur);
        cleanup.push(() => toggle.removeEventListener('click', onToggle));
        cleanup.push(() => blurButton.removeEventListener('click', onBlur));
        slot.append(toggle, popover);
      }
    }
    fragment.append(slot);
  }
  slots.replaceChildren(fragment);
}

function createProxyActionV1(
  label: string,
  targetId: string,
  cleanup: Array<() => void>,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  const onClick = (): void => document.getElementById(targetId)?.click();
  button.addEventListener('click', onClick);
  cleanup.push(() => button.removeEventListener('click', onClick));
  return button;
}

function createEffectsPanelV1(cleanup: Array<() => void>): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'shell-inspector-card m7-shell-panel';
  panel.dataset.m7InspectorSurface = 'effects';
  const header = document.createElement('header');
  const title = document.createElement('strong');
  title.textContent = 'Effects / Adjustments';
  header.append(title);
  const note = document.createElement('p');
  note.className = 'm7-shell-note';
  note.textContent = 'M7G / M7Hの各効果はここへ接続します。既存のColor Matchは利用できます。';
  const actions = document.createElement('div');
  actions.className = 'm7-shell-actions';
  actions.append(createProxyActionV1('Color Match', 'color-match-command', cleanup));
  for (const label of ['補正', 'Filter Stack']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = true;
    button.textContent = label;
    actions.append(button);
  }
  panel.append(header, note, actions);
  return panel;
}

function createNavigatorPanelV1(cleanup: Array<() => void>): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'shell-inspector-card m7-shell-panel';
  panel.dataset.m7InspectorSurface = 'navigator';
  const header = document.createElement('header');
  const title = document.createElement('strong');
  title.textContent = 'Navigator';
  header.append(title);
  const actions = document.createElement('div');
  actions.className = 'm7-shell-actions';
  for (const [label, target] of [
    ['−', 'view-zoom-out'],
    ['Fit', 'view-fit'],
    ['＋', 'view-zoom-in'],
    ['↶', 'view-rotate-left'],
    ['Reset', 'view-reset'],
    ['↷', 'view-rotate-right'],
    ['Mirror', 'view-mirror'],
    ['Grid', 'view-grid-toggle'],
    ['Pixel', 'view-pixel'],
  ] as const) {
    actions.append(createProxyActionV1(label, target, cleanup));
  }
  panel.append(header, actions);
  return panel;
}

function installInspectorV1(
  app: HTMLElement,
  cleanup: Array<() => void>,
): (surface: M7InspectorSurfaceV1) => void {
  const inspector = app.querySelector<HTMLElement>('.shell-inspector');
  if (!inspector) return () => undefined;
  inspector.classList.add('m7-inspector-ready');

  const tabs = inspector.querySelector<HTMLElement>('.shell-inspector-tabs');
  const surfaces: readonly { readonly id: M7InspectorSurfaceV1; readonly label: string }[] = [
    { id: 'layers', label: 'Layer' },
    { id: 'color', label: 'Color' },
    { id: 'brush', label: 'Brush' },
    { id: 'effects', label: 'Effects' },
    { id: 'navigator', label: 'Nav' },
    { id: 'reference', label: 'Ref' },
  ];

  const body = document.createElement('div');
  body.className = 'm7-inspector-body';
  const surfaceNodes = new Map<M7InspectorSurfaceV1, HTMLElement>();
  for (const surface of surfaces) {
    const node = document.createElement('div');
    node.className = 'm7-inspector-surface';
    node.dataset.m7InspectorSurface = surface.id;
    node.setAttribute('role', 'tabpanel');
    body.append(node);
    surfaceNodes.set(surface.id, node);
  }

  const moveInto = (selector: string, surface: M7InspectorSurfaceV1): void => {
    const destination = surfaceNodes.get(surface);
    if (!destination) return;
    inspector
      .querySelectorAll<HTMLElement>(selector)
      .forEach((element) => destination.append(element));
  };
  moveInto('.shell-brush-presets-panel, .shell-brush-properties-panel', 'brush');
  moveInto('.shell-color-panel', 'color');
  moveInto('.shell-reference-panel', 'reference');
  moveInto('.shell-layer-search, #layer-list, #layer-actions', 'layers');

  surfaceNodes.get('effects')?.append(createEffectsPanelV1(cleanup));
  surfaceNodes.get('navigator')?.append(createNavigatorPanelV1(cleanup));

  const decorativeLower = inspector.querySelector<HTMLElement>('.shell-inspector-card-lower');
  if (decorativeLower) decorativeLower.hidden = true;
  if (tabs) tabs.after(body);
  else inspector.prepend(body);

  const actionStrip = document.createElement('nav');
  actionStrip.className = 'm7-inspector-action-strip';
  actionStrip.setAttribute('aria-label', 'Inspector quick access');
  inspector.append(actionStrip);

  let active: M7InspectorSurfaceV1 = 'layers';
  const tabButtons = new Map<M7InspectorSurfaceV1, HTMLButtonElement>();
  const mobileHeader = inspector.querySelector<HTMLElement>(
    '.shell-mobile-inspector-header strong',
  );

  const setSurface = (surface: M7InspectorSurfaceV1): void => {
    active = surface;
    inspector.dataset.m7InspectorActive = surface;
    for (const [id, node] of surfaceNodes) {
      node.hidden = id !== surface;
    }
    for (const [id, button] of tabButtons) {
      button.setAttribute('aria-selected', String(id === surface));
    }
    if (mobileHeader) {
      mobileHeader.textContent =
        surfaces.find((entry) => entry.id === surface)?.label ?? 'Inspector';
    }
  };

  if (tabs) {
    tabs.className = 'shell-inspector-tabs m7-inspector-tabs';
    tabs.removeAttribute('aria-hidden');
    tabs.setAttribute('role', 'tablist');
    const fragment = document.createDocumentFragment();
    for (const surface of surfaces) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = surface.label;
      button.dataset.m7InspectorTab = surface.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', 'false');
      const onClick = (): void => setSurface(surface.id);
      button.addEventListener('click', onClick);
      cleanup.push(() => button.removeEventListener('click', onClick));
      tabButtons.set(surface.id, button);
      fragment.append(button);
    }
    tabs.replaceChildren(fragment);
  }

  const addQuick = (
    label: string,
    surface: M7InspectorSurfaceV1,
    targetId: string | null,
  ): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    const onClick = (): void => {
      setSurface(surface);
      if (targetId !== null) document.getElementById(targetId)?.click();
    };
    button.addEventListener('click', onClick);
    cleanup.push(() => button.removeEventListener('click', onClick));
    actionStrip.append(button);
  };
  addQuick('+ Layer', 'layers', 'layer-add-raster');
  addQuick('Color', 'color', null);
  addQuick('Brush', 'brush', null);
  addQuick('Ref', 'reference', null);

  const mobileLayers = document.getElementById('mobile-layers');
  if (mobileLayers instanceof HTMLButtonElement) {
    const onMobileLayers = (): void => setSurface('layers');
    mobileLayers.addEventListener('click', onMobileLayers);
    cleanup.push(() => mobileLayers.removeEventListener('click', onMobileLayers));
  }

  setSurface(active);
  return setSurface;
}

function installMobileToolDrawerV1(app: HTMLElement, cleanup: Array<() => void>): void {
  const toolbar = app.querySelector<HTMLElement>('.shell-mobile-toolbar');
  if (!toolbar || document.getElementById(TOOL_DRAWER_ID)) return;

  const toggle = document.createElement('button');
  toggle.id = 'mobile-tools';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'ツール');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span aria-hidden="true">◆</span><small>ツール</small>';

  const drawer = document.createElement('section');
  drawer.id = TOOL_DRAWER_ID;
  drawer.className = 'm7-tool-drawer';
  drawer.hidden = true;
  drawer.setAttribute('aria-label', 'M7ツール');
  const header = document.createElement('header');
  header.className = 'm7-tool-drawer-header';
  const title = document.createElement('strong');
  title.textContent = 'Tools';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'ツールを閉じる');
  header.append(title, close);
  const grid = document.createElement('div');
  grid.className = 'm7-tool-drawer-grid';

  const closeDrawer = (): void => {
    drawer.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };
  const openDrawer = (): void => {
    drawer.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    app.classList.remove('is-mobile-inspector-open');
    document.getElementById('mobile-layers')?.setAttribute('aria-expanded', 'false');
  };
  const onToggle = (): void => (drawer.hidden ? openDrawer() : closeDrawer());
  toggle.addEventListener('click', onToggle);
  close.addEventListener('click', closeDrawer);
  cleanup.push(() => toggle.removeEventListener('click', onToggle));
  cleanup.push(() => close.removeEventListener('click', closeDrawer));

  for (const family of M7_TOOL_FAMILIES_V1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'm7-family-button';
    button.dataset.m7ToolFamily = family.id;
    button.innerHTML =
      `<span class="m7-tool-icon" aria-hidden="true">${family.icon}</span>` +
      `<span class="m7-tool-label">${family.label}</span>`;
    button.title = `${family.label} — ${family.note}`;
    if (family.state === 'planned') {
      button.disabled = true;
    } else {
      const onClick = (): void => {
        if (family.id === 'navigation') document.getElementById('view-fit')?.click();
        else if (family.targetId !== null) document.getElementById(family.targetId)?.click();
        closeDrawer();
      };
      button.addEventListener('click', onClick);
      cleanup.push(() => button.removeEventListener('click', onClick));
    }
    grid.append(button);
  }
  const lasso = document.createElement('button');
  lasso.type = 'button';
  lasso.disabled = true;
  lasso.className = 'm7-family-button m7-lasso-shortcut';
  lasso.dataset.m7DirectTool = 'lasso';
  lasso.title = 'Lasso — M7Aで接続';
  lasso.innerHTML =
    '<span class="m7-tool-icon" aria-hidden="true">⌁</span>' +
    '<span class="m7-tool-label">Lasso</span>';
  grid.append(lasso);

  drawer.append(header, grid);
  const layersButton = document.getElementById('mobile-layers');
  if (layersButton?.parentElement === toolbar) toolbar.insertBefore(toggle, layersButton);
  else toolbar.append(toggle);
  app.append(drawer);
}

export function installM7UiSkeletonV1(app: HTMLElement): M7UiSkeletonHandleV1 {
  if (app.dataset.m7UiShell === 'installed') {
    return Object.freeze({ setInspectorSurface: () => undefined, dispose: () => undefined });
  }
  app.dataset.m7UiShell = 'installed';
  installStyleV1();
  const cleanup: Array<() => void> = [];
  installToolRailV1(app, cleanup);
  const setInspectorSurface = installInspectorV1(app, cleanup);
  installMobileToolDrawerV1(app, cleanup);

  return Object.freeze({
    setInspectorSurface,
    dispose(): void {
      for (const dispose of cleanup.splice(0).reverse()) dispose();
      document.getElementById(TOOL_DRAWER_ID)?.remove();
      app.dataset.m7UiShell = 'disposed';
    },
  });
}
