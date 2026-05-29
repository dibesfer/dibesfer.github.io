export function createMenuUI(options) {
  const menuCentral = options.menuCentral;
  const menuTabs = options.menuTabs || null;
  const menuTabButtons = options.menuTabButtons || [];
  const menuPanels = options.menuPanels || [];
  const settingsFullScreen = options.settingsFullScreen;
  const settingsMenuThemeDark = options.settingsMenuThemeDark;
  const systemMenuThemeQuery = options.systemMenuThemeQuery;
  const onTabChange = typeof options.onTabChange === 'function' ? options.onTabChange : null;
  const onVisibilityChange = typeof options.onVisibilityChange === 'function' ? options.onVisibilityChange : null;
  let activeTab = options.initialTab || 'settings';
  let themePreference = options.initialThemePreference || 'system';
  const MENU_TABS_DRAG_THRESHOLD_PX = 8;
  let menuTabsDragPointerId = null;
  let menuTabsDragStartX = 0;
  let menuTabsDragStartScrollLeft = 0;
  let menuTabsDraggingActive = false;

  function setElementHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
  }

  function resolveMenuTheme() {
    if (themePreference === 'dark') return 'dark';
    if (themePreference === 'light') return 'light';
    return systemMenuThemeQuery && systemMenuThemeQuery.matches ? 'dark' : 'light';
  }

  function syncMenuThemeSetting() {
    if (!settingsMenuThemeDark) return;
    settingsMenuThemeDark.checked = resolveMenuTheme() === 'dark';
  }

  function applyMenuTheme() {
    if (!menuCentral) return;
    menuCentral.dataset.theme = resolveMenuTheme();
    syncMenuThemeSetting();
  }

  function setThemePreference(nextPreference) {
    themePreference = nextPreference;
    applyMenuTheme();
  }

  function isMobileMode() {
    return document.body?.dataset?.mode === 'mobile-portrait'
      || document.body?.dataset?.mode === 'mobile-landscape';
  }

  function isVisible() {
    return Boolean(menuCentral && !menuCentral.hidden);
  }

  function getActiveTab() {
    return activeTab;
  }

  function setTab(tabName) {
    activeTab = tabName || activeTab;

    for (let i = 0; i < menuTabButtons.length; i += 1) {
      const isActive = menuTabButtons[i].dataset.menuTab === activeTab;
      menuTabButtons[i].classList.toggle('is-active', isActive);
    }

    for (let i = 0; i < menuPanels.length; i += 1) {
      const isActive = menuPanels[i].dataset.menuPanel === activeTab;
      menuPanels[i].classList.toggle('is-active', isActive);
    }

    onTabChange?.(activeTab);
  }

  function show(tabName) {
    setTab(tabName || activeTab);
    setElementHidden(menuCentral, false);
    document.body.classList.add('menu-central-open');
    onVisibilityChange?.(true, activeTab);
  }

  function hide() {
    setElementHidden(menuCentral, true);
    document.body.classList.remove('menu-central-open');
    onVisibilityChange?.(false, activeTab);
  }

  function syncFullScreenSetting() {
    if (!settingsFullScreen) return;
    settingsFullScreen.checked = document.fullscreenElement != null;
  }

  async function setFullScreenEnabled(nextEnabled) {
    if (nextEnabled) {
      if (document.fullscreenElement) return true;
      try {
        await document.documentElement.requestFullscreen();
        return true;
      } catch (error) {
        console.error('Failed to enter fullscreen mode.', error);
        syncFullScreenSetting();
        return false;
      }
    }

    if (!document.fullscreenElement) return true;
    try {
      await document.exitFullscreen();
      return true;
    } catch (error) {
      console.error('Failed to exit fullscreen mode.', error);
      syncFullScreenSetting();
      return false;
    }
  }

  if (typeof systemMenuThemeQuery?.addEventListener === 'function') {
    systemMenuThemeQuery.addEventListener('change', function () {
      if (themePreference !== 'system') return;
      applyMenuTheme();
    });
  }

  if (menuCentral) {
    menuCentral.addEventListener('click', function (event) {
      event.stopPropagation();
    });
  }

  if (menuTabs) {
    menuTabs.addEventListener('pointerdown', function (event) {
      if (isMobileMode() || event.pointerType === 'touch' || event.button !== 0) return;
      menuTabsDragPointerId = event.pointerId;
      menuTabsDragStartX = event.clientX;
      menuTabsDragStartScrollLeft = menuTabs.scrollLeft;
      menuTabsDraggingActive = false;
    });

    menuTabs.addEventListener('pointermove', function (event) {
      if (menuTabsDragPointerId !== event.pointerId) return;
      const dragOffsetX = event.clientX - menuTabsDragStartX;

      if (!menuTabsDraggingActive && Math.abs(dragOffsetX) < MENU_TABS_DRAG_THRESHOLD_PX) {
        return;
      }

      if (!menuTabsDraggingActive) {
        menuTabsDraggingActive = true;
        menuTabs.classList.add('is-dragging');
        menuTabs.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
      menuTabs.scrollLeft = menuTabsDragStartScrollLeft - dragOffsetX;
    });

    function stopMenuTabsDrag(event) {
      if (menuTabsDragPointerId == null) return;
      if (event && menuTabsDragPointerId !== event.pointerId) return;

      if (event && menuTabsDraggingActive && menuTabs.hasPointerCapture?.(event.pointerId)) {
        menuTabs.releasePointerCapture(event.pointerId);
      }

      menuTabsDragPointerId = null;
      menuTabsDraggingActive = false;
      menuTabs.classList.remove('is-dragging');
    }

    menuTabs.addEventListener('pointerup', stopMenuTabsDrag);
    menuTabs.addEventListener('pointercancel', stopMenuTabsDrag);
    menuTabs.addEventListener('lostpointercapture', stopMenuTabsDrag);
  }

  if (settingsFullScreen) {
    settingsFullScreen.addEventListener('change', function () {
      setFullScreenEnabled(settingsFullScreen.checked);
    });
  }

  if (settingsMenuThemeDark) {
    settingsMenuThemeDark.addEventListener('change', function () {
      setThemePreference(settingsMenuThemeDark.checked ? 'dark' : 'light');
    });
  }

  for (let i = 0; i < menuTabButtons.length; i += 1) {
    menuTabButtons[i].addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      const nextTab = menuTabButtons[i].dataset.menuTab;
      if (!nextTab) return;
      setTab(nextTab);
    });
  }

  document.addEventListener('fullscreenchange', syncFullScreenSetting);

  setTab(activeTab);
  syncFullScreenSetting();
  applyMenuTheme();

  return {
    applyMenuTheme,
    getActiveTab,
    hide,
    isVisible,
    setFullScreenEnabled,
    setTab,
    setThemePreference,
    show,
    syncFullScreenSetting,
  };
}
