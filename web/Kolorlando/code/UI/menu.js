export function createMenuUI(options) {
  const menuCentral = options.menuCentral;
  const menuTabButtons = options.menuTabButtons || [];
  const menuPanels = options.menuPanels || [];
  const settingsFullScreen = options.settingsFullScreen;
  const settingsMenuThemeDark = options.settingsMenuThemeDark;
  const systemMenuThemeQuery = options.systemMenuThemeQuery;
  let activeTab = options.initialTab || 'settings';
  let themePreference = options.initialThemePreference || 'system';

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
  }

  function show(tabName) {
    setTab(tabName || activeTab);
    setElementHidden(menuCentral, false);
    document.body.classList.add('menu-central-open');
  }

  function hide() {
    setElementHidden(menuCentral, true);
    document.body.classList.remove('menu-central-open');
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
