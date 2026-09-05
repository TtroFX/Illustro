from pathlib import Path

path = Path('src/app/m8-tool-rail.ts')
s = path.read_text()

for old in [
    "  button.dataset.m8Tooltip = family.label;\n",
    "  button.dataset.m8Tooltip = '投げ縄選択';\n",
]:
    if old not in s:
        raise SystemExit(f'missing tooltip assignment: {old!r}')
    s = s.replace(old, '', 1)

old = """  let activeFamily: M8ToolFamilyIdV1 | null = null;
  let longPressTimer: number | null = null;
  let longPressFired = false;
"""
new = """  let activeFamily: M8ToolFamilyIdV1 | null = null;
  let openFlyoutEntry: M8ToolRailEntryIdV1 | null = null;
  let longPressTimer: number | null = null;
  let longPressPointerId: number | null = null;
  let longPressStartX = 0;
  let longPressStartY = 0;
  let longPressFired = false;
  let suppressNextClick = false;
  const longPressDelayMs = 520;
  const longPressMoveTolerancePx = 10;
"""
if old not in s:
    raise SystemExit('state declaration block not found')
s = s.replace(old, new, 1)

old = """  const closeFlyout = (): void => {
    flyout.hidden = true;
  };
"""
new = """  const closeFlyout = (): void => {
    flyout.hidden = true;
    openFlyoutEntry = null;
  };
"""
if old not in s:
    raise SystemExit('closeFlyout block not found')
s = s.replace(old, new, 1)

old = """    flyout.style.setProperty('--m8c-flyout-top', `${top}px`);
    flyout.hidden = false;
  };

  const activatePrimary"""
new = """    flyout.style.setProperty('--m8c-flyout-top', `${top}px`);
    flyout.hidden = false;
    openFlyoutEntry = entryId;
  };

  const toggleFlyout = (entryId: M8ToolRailEntryIdV1): void => {
    if (!flyout.hidden && openFlyoutEntry === entryId) {
      closeFlyout();
      return;
    }
    openFlyout(entryId);
  };

  const activatePrimary"""
if old not in s:
    raise SystemExit('openFlyout tail not found')
s = s.replace(old, new, 1)

old = """  const activatePrimary = (familyId: M8ToolFamilyIdV1): void => {
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
"""
new = """  const activatePrimary = (familyId: M8ToolFamilyIdV1): void => {
    const family = FAMILY_BY_ID_V1.get(familyId);
    if (!family) return;
    const primaryId = PRIMARY_PROXY_BY_FAMILY_V1[familyId];
    const target = primaryId ? productionProxyV1(primaryId) : null;
    if (!target || activeFamily === familyId) {
      closeFlyout();
      return;
    }
    target.click();
    setActiveFamily(familyId);
    closeFlyout();
  };
"""
if old not in s:
    raise SystemExit('activatePrimary block not found')
s = s.replace(old, new, 1)

start = s.index('  const cancelLongPress = (): void => {')
end = s.index("  scroller.addEventListener('click', onRailClick);", start)
replacement = """  const cancelLongPress = (): void => {
    if (longPressTimer !== null) globalThis.clearTimeout(longPressTimer);
    longPressTimer = null;
  };

  const clearLongPressState = (): void => {
    cancelLongPress();
    longPressPointerId = null;
    longPressFired = false;
  };

  const onRailClick = (event: Event): void => {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('.m8c-family-button')
        : null;
    if (!target) return;
    const entryId = (target.dataset.m8cEntry ?? target.dataset.m8cFamily) as
      | M8ToolRailEntryIdV1
      | undefined;
    if (!entryId) return;
    if (!flyout.hidden && openFlyoutEntry === entryId) {
      closeFlyout();
      return;
    }
    if (entryId === 'lasso-direct') {
      closeFlyout();
      return;
    }
    activatePrimary(entryId);
  };

  const onPointerDown = (event: PointerEvent): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('.m8c-family-button')
        : null;
    if (!target || event.button !== 0) return;
    clearLongPressState();
    longPressPointerId = event.pointerId;
    longPressStartX = event.clientX;
    longPressStartY = event.clientY;
    const entryId = (target.dataset.m8cEntry ?? target.dataset.m8cFamily) as
      | M8ToolRailEntryIdV1
      | undefined;
    if (!entryId) return;
    target.setPointerCapture?.(event.pointerId);
    longPressTimer = globalThis.setTimeout(() => {
      if (longPressPointerId !== event.pointerId) return;
      longPressTimer = null;
      longPressFired = true;
      openFlyout(entryId);
    }, longPressDelayMs);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (longPressPointerId !== event.pointerId || longPressTimer === null) return;
    const distance = Math.hypot(event.clientX - longPressStartX, event.clientY - longPressStartY);
    if (distance > longPressMoveTolerancePx) cancelLongPress();
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (longPressPointerId !== event.pointerId) return;
    cancelLongPress();
    if (longPressFired) {
      suppressNextClick = true;
      globalThis.setTimeout(() => {
        suppressNextClick = false;
      }, 0);
      event.preventDefault();
      event.stopPropagation();
    }
    longPressPointerId = null;
    longPressFired = false;
  };

  const onPointerCancel = (): void => {
    clearLongPressState();
  };

  const onPointerLeave = (): void => {
    if (!longPressFired) cancelLongPress();
  };

  const onContextMenu = (event: MouseEvent): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('.m8c-family-button')
        : null;
    if (!target) return;
    event.preventDefault();
    const entryId = (target.dataset.m8cEntry ?? target.dataset.m8cFamily) as
      | M8ToolRailEntryIdV1
      | undefined;
    if (entryId) toggleFlyout(entryId);
  };

"""
s = s[:start] + replacement + s[end:]

old = """  scroller.addEventListener('click', onRailClick);
  scroller.addEventListener('pointerdown', onPointerDown);
  scroller.addEventListener('pointerup', onPointerUp);
  scroller.addEventListener('pointercancel', cancelLongPress);
  scroller.addEventListener('contextmenu', onContextMenu);
"""
new = """  scroller.addEventListener('click', onRailClick);
  scroller.addEventListener('pointerdown', onPointerDown);
  scroller.addEventListener('pointermove', onPointerMove);
  scroller.addEventListener('pointerup', onPointerUp);
  scroller.addEventListener('pointercancel', onPointerCancel);
  scroller.addEventListener('pointerleave', onPointerLeave);
  scroller.addEventListener('contextmenu', onContextMenu);
"""
if old not in s:
    raise SystemExit('listener block not found')
s = s.replace(old, new, 1)

old = """      scroller.removeEventListener('click', onRailClick);
      scroller.removeEventListener('pointerdown', onPointerDown);
      scroller.removeEventListener('pointerup', onPointerUp);
      scroller.removeEventListener('pointercancel', cancelLongPress);
      scroller.removeEventListener('contextmenu', onContextMenu);
"""
new = """      scroller.removeEventListener('click', onRailClick);
      scroller.removeEventListener('pointerdown', onPointerDown);
      scroller.removeEventListener('pointermove', onPointerMove);
      scroller.removeEventListener('pointerup', onPointerUp);
      scroller.removeEventListener('pointercancel', onPointerCancel);
      scroller.removeEventListener('pointerleave', onPointerLeave);
      scroller.removeEventListener('contextmenu', onContextMenu);
"""
if old not in s:
    raise SystemExit('dispose listener block not found')
s = s.replace(old, new, 1)
path.write_text(s)

test = Path('tests/unit/m8-tool-rail.test.ts')
t = test.read_text()
old = "    expect(source).toContain('button.dataset.m8Tooltip = family.label');\n"
new = "    expect(source).not.toContain('dataset.m8Tooltip');\n"
if old not in t:
    raise SystemExit('tooltip test assertion not found')
t = t.replace(old, new, 1)

old = """  it('provides family flyout discovery through long press and secondary activation', () => {
    expect(source).toContain('}, 460)');
    expect(source).toContain("scroller.addEventListener('contextmenu', onContextMenu)");
    expect(source).toContain("flyout.className = 'm8c-subtool-flyout'");
  });
"""
new = """  it('keeps details on deliberate long press or secondary activation only', () => {
    expect(source).toContain('const longPressDelayMs = 520');
    expect(source).toContain('const longPressMoveTolerancePx = 10');
    expect(source).toContain("scroller.addEventListener('pointermove', onPointerMove)");
    expect(source).toContain('suppressNextClick = true');
    expect(source).toContain("if (entryId === 'lasso-direct')");
    expect(source).toContain("scroller.addEventListener('contextmenu', onContextMenu)");
    expect(source).toContain("flyout.className = 'm8c-subtool-flyout'");
  });

  it('closes an already-open detail flyout when the same icon is pressed again', () => {
    expect(source).toContain('if (!flyout.hidden && openFlyoutEntry === entryId)');
    expect(source).toContain('openFlyoutEntry = null');
    expect(source).toContain('openFlyoutEntry = entryId');
  });
"""
if old not in t:
    raise SystemExit('M8C flyout test block not found')
t = t.replace(old, new, 1)
test.write_text(t)
