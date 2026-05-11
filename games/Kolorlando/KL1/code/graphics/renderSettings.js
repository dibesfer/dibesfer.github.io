import * as THREE from 'three';
import {
  applyShadowPreset,
  DEFAULT_SHADOW_PRESET,
  resolveShadowPresetName,
} from './shadowConfig.js';

export const DEFAULT_RENDER_SCALE = 1;
export const DEFAULT_MOBILE_RENDER_SCALE = 0.5;
export const DEFAULT_SHADOWS_ENABLED = false;
export const DEFAULT_PIXELATED_UPSCALE = false;
export const DEFAULT_FOG_RENDER_DISTANCE = 30;

const SHADOWS_STORAGE_KEY = 'kolorlando.settings.shadows';
const SHADOW_PRESET_STORAGE_KEY = 'kolorlando.settings.shadowPreset';
const RENDER_SCALE_STORAGE_KEY = 'kolorlando.settings.renderScale';
const PIXELATED_UPSCALE_STORAGE_KEY = 'kolorlando.settings.pixelatedUpscale';
const FOG_RENDER_DISTANCE_STORAGE_KEY = 'kolorlando.settings.fogRenderDistance';
const MIN_FOG_RENDER_DISTANCE = 15;
const MAX_FOG_RENDER_DISTANCE = 180;
const FOG_NEAR_DISTANCE_RATIO = 14 / 30;
const FOG_FAR_DISTANCE_RATIO = 25 / 30;
const MIN_RENDER_SCALE = 0.25;
const VALID_RENDER_SCALE_VALUES = new Set(['1', '0.75', '0.5', '0.33', '0.25']);

function readStorageValue(storageKey) {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeStorageValue(storageKey, value, warningMessage) {
  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch (error) {
    if (warningMessage) {
      console.warn(warningMessage, error);
    }
  }
}

function clearPersistedSetting(storageKey) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn(`Failed to clear the Kolorlando setting "${storageKey}".`, error);
  }
}

export function createRenderSettings({
  scene,
  getRenderer,
  getMiniMapUI,
  getCharacterPreviewRenderer,
  markCharacterPreviewSizeDirty,
  updateCharacterPreviewSize,
  updateSceneViewSize,
  getDirectionalLight,
  getIsMobileMode,
  getWorldDistanceTarget,
  getPlayerEye,
  settingsShadows,
  settingsShadowPreset,
  settingsUndersampling,
  settingsPixelatedUpscale,
  settingsFogRenderDistance,
} = {}) {
  let rendererPixelRatioBase = Math.min(window.devicePixelRatio, 2);
  let renderScaleMultiplier = DEFAULT_RENDER_SCALE;
  let pixelatedUpscaleEnabled = DEFAULT_PIXELATED_UPSCALE;
  let shadowPresetName = DEFAULT_SHADOW_PRESET;
  let fogRenderDistance = DEFAULT_FOG_RENDER_DISTANCE;

  function getEffectiveRenderPixelRatio() {
    return Math.max(MIN_RENDER_SCALE, rendererPixelRatioBase * renderScaleMultiplier);
  }

  function syncRenderScaleSetting() {
    if (!settingsUndersampling) return;
    settingsUndersampling.value = String(renderScaleMultiplier);
  }

  function syncPixelatedUpscaleSetting() {
    if (!settingsPixelatedUpscale) return;
    settingsPixelatedUpscale.checked = pixelatedUpscaleEnabled;
  }

  function syncFogRenderDistanceSetting() {
    if (!settingsFogRenderDistance) return;
    settingsFogRenderDistance.value = String(fogRenderDistance);
  }

  function syncShadowPresetSetting() {
    if (!settingsShadowPreset) return;
    settingsShadowPreset.value = shadowPresetName;
  }

  function resolvePixelatedUpscalePreference(rawValue) {
    return rawValue === 'true';
  }

  function normalizeFogRenderDistance(rawValue) {
    const parsedDistance = Math.round(Number(rawValue));
    if (!Number.isFinite(parsedDistance)) {
      return DEFAULT_FOG_RENDER_DISTANCE;
    }

    return THREE.MathUtils.clamp(
      parsedDistance,
      MIN_FOG_RENDER_DISTANCE,
      MAX_FOG_RENDER_DISTANCE
    );
  }

  function resolveRenderScalePreference(rawValue) {
    const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (VALID_RENDER_SCALE_VALUES.has(normalizedValue)) {
      return Number(normalizedValue);
    }
    return DEFAULT_RENDER_SCALE;
  }

  function applyFogRenderDistanceToScene(nextDistance) {
    if (!scene?.fog) return;

    const resolvedDistance = normalizeFogRenderDistance(nextDistance);
    const nextFogNear = Math.max(4, Math.round(resolvedDistance * FOG_NEAR_DISTANCE_RATIO));
    const nextFogFar = Math.max(nextFogNear + 1, Math.round(resolvedDistance * FOG_FAR_DISTANCE_RATIO));

    scene.fog.near = nextFogNear;
    scene.fog.far = nextFogFar;
  }

  function setFogRenderDistance(nextDistance, options = {}) {
    const shouldPersist = options.persist !== false;
    fogRenderDistance = normalizeFogRenderDistance(nextDistance);

    syncFogRenderDistanceSetting();
    applyFogRenderDistanceToScene(fogRenderDistance);

    const worldDistanceTarget = getWorldDistanceTarget?.();
    if (worldDistanceTarget?.boxel15DistanceRendering?.setRadiusInVoxels) {
      worldDistanceTarget.boxel15DistanceRendering.setRadiusInVoxels(fogRenderDistance);
      worldDistanceTarget.updateActiveChunks?.(getPlayerEye?.());
    }

    if (shouldPersist) {
      writeStorageValue(
        FOG_RENDER_DISTANCE_STORAGE_KEY,
        fogRenderDistance,
        'Failed to persist the Kolorlando fog render distance setting.'
      );
    }
  }

  function applyCanvasUpscaleMode(canvas) {
    if (!canvas) return;
    canvas.style.imageRendering = pixelatedUpscaleEnabled ? 'pixelated' : 'auto';
  }

  function applyRenderScale(options = {}) {
    const shouldResize = options.resize !== false;
    const effectivePixelRatio = getEffectiveRenderPixelRatio();
    const renderer = getRenderer?.();
    const miniMapUI = getMiniMapUI?.();
    const characterPreviewRenderer = getCharacterPreviewRenderer?.();

    renderer?.setPixelRatio(effectivePixelRatio);
    miniMapUI?.setPixelRatio(effectivePixelRatio);

    if (characterPreviewRenderer) {
      characterPreviewRenderer.setPixelRatio(effectivePixelRatio);
      markCharacterPreviewSizeDirty?.();
    }

    syncRenderScaleSetting();

    if (!shouldResize) return;

    updateSceneViewSize?.();
    miniMapUI?.updateMiniMapSize();
    if (characterPreviewRenderer) {
      markCharacterPreviewSizeDirty?.();
      updateCharacterPreviewSize?.();
    }
  }

  function applyPixelatedUpscale() {
    applyCanvasUpscaleMode(getRenderer?.()?.domElement);
    applyCanvasUpscaleMode(getCharacterPreviewRenderer?.()?.domElement);
    syncPixelatedUpscaleSetting();
  }

  function setRenderScale(nextScale, options = {}) {
    const shouldPersist = options.persist !== false;
    renderScaleMultiplier = resolveRenderScalePreference(String(nextScale));
    applyRenderScale({ resize: options.resize !== false });

    if (shouldPersist) {
      writeStorageValue(
        RENDER_SCALE_STORAGE_KEY,
        renderScaleMultiplier,
        'Failed to persist the Kolorlando render scale setting.'
      );
    }
  }

  function setPixelatedUpscaleEnabled(nextEnabled, options = {}) {
    const shouldPersist = options.persist !== false;
    pixelatedUpscaleEnabled = nextEnabled === true;
    applyPixelatedUpscale();

    if (shouldPersist) {
      writeStorageValue(
        PIXELATED_UPSCALE_STORAGE_KEY,
        pixelatedUpscaleEnabled,
        'Failed to persist the Kolorlando pixelated upscale setting.'
      );
    }
  }

  function markSceneMaterialsForUpdate() {
    scene?.traverse?.(part => {
      if (!part?.isMesh) return;
      if (part.material) {
        part.material.needsUpdate = true;
      }
    });
  }

  function setShadowsEnabled(nextEnabled, options = {}) {
    const shouldPersist = options.persist !== false;
    const enabled = nextEnabled !== false;
    const renderer = getRenderer?.();
    const directionalLight = getDirectionalLight?.();

    if (renderer?.shadowMap) {
      renderer.shadowMap.enabled = enabled;
    }
    if (directionalLight) {
      directionalLight.castShadow = enabled;
    }

    markSceneMaterialsForUpdate();

    if (settingsShadows) {
      settingsShadows.checked = enabled;
    }

    if (shouldPersist) {
      writeStorageValue(SHADOWS_STORAGE_KEY, enabled ? 'true' : 'false', '');
    }
  }

  function setShadowPreset(nextPresetName, options = {}) {
    const shouldPersist = options.persist !== false;
    shadowPresetName = applyShadowPreset({
      renderer: getRenderer?.(),
      directionalLight: getDirectionalLight?.(),
      presetName: nextPresetName,
    });

    syncShadowPresetSetting();
    markSceneMaterialsForUpdate();

    if (shouldPersist) {
      writeStorageValue(
        SHADOW_PRESET_STORAGE_KEY,
        resolveShadowPresetName(shadowPresetName),
        ''
      );
    }
  }

  function applyRenderScaleForCurrentMode() {
    if (getIsMobileMode?.()) {
      setRenderScale(DEFAULT_MOBILE_RENDER_SCALE, {
        persist: false,
        resize: false,
      });
      return;
    }

    setRenderScale(resolveRenderScalePreference(readStorageValue(RENDER_SCALE_STORAGE_KEY)), {
      persist: false,
      resize: false,
    });
  }

  function readSavedFogRenderDistancePreference() {
    return readStorageValue(FOG_RENDER_DISTANCE_STORAGE_KEY);
  }

  function restoreGraphicsDefaults() {
    setShadowsEnabled(DEFAULT_SHADOWS_ENABLED, { persist: false });
    setShadowPreset(DEFAULT_SHADOW_PRESET, { persist: false });
    setRenderScale(getIsMobileMode?.() ? DEFAULT_MOBILE_RENDER_SCALE : DEFAULT_RENDER_SCALE, {
      persist: false,
    });
    setPixelatedUpscaleEnabled(DEFAULT_PIXELATED_UPSCALE, { persist: false });
    setFogRenderDistance(DEFAULT_FOG_RENDER_DISTANCE, { persist: false });

    clearPersistedSetting(SHADOWS_STORAGE_KEY);
    clearPersistedSetting(SHADOW_PRESET_STORAGE_KEY);
    clearPersistedSetting(RENDER_SCALE_STORAGE_KEY);
    clearPersistedSetting(PIXELATED_UPSCALE_STORAGE_KEY);
    clearPersistedSetting(FOG_RENDER_DISTANCE_STORAGE_KEY);
  }

  function setPixelRatioBase(nextPixelRatio) {
    rendererPixelRatioBase = Number.isFinite(nextPixelRatio)
      ? nextPixelRatio
      : Math.min(window.devicePixelRatio, 2);
    applyRenderScale();
  }

  function init() {
    setShadowPreset(resolveShadowPresetName(readStorageValue(SHADOW_PRESET_STORAGE_KEY)), {
      persist: false,
    });

    const savedShadowsPreference = readStorageValue(SHADOWS_STORAGE_KEY);
    if (savedShadowsPreference === 'true' || savedShadowsPreference === 'false') {
      setShadowsEnabled(savedShadowsPreference === 'true', { persist: false });
    } else {
      setShadowsEnabled(DEFAULT_SHADOWS_ENABLED, { persist: false });
    }

    setPixelatedUpscaleEnabled(
      resolvePixelatedUpscalePreference(readStorageValue(PIXELATED_UPSCALE_STORAGE_KEY)),
      { persist: false }
    );
  }

  function bindControls() {
    if (settingsShadows) {
      settingsShadows.addEventListener('change', () => {
        setShadowsEnabled(settingsShadows.checked);
      });
    }

    if (settingsShadowPreset) {
      settingsShadowPreset.addEventListener('change', () => {
        setShadowPreset(settingsShadowPreset.value);
      });
    }

    if (settingsUndersampling) {
      settingsUndersampling.addEventListener('change', () => {
        setRenderScale(settingsUndersampling.value);
      });
    }

    if (settingsPixelatedUpscale) {
      settingsPixelatedUpscale.addEventListener('change', () => {
        setPixelatedUpscaleEnabled(settingsPixelatedUpscale.checked);
      });
    }

    if (settingsFogRenderDistance) {
      const applySettingsFogRenderDistance = () => {
        setFogRenderDistance(settingsFogRenderDistance.value);
      };

      settingsFogRenderDistance.addEventListener('change', applySettingsFogRenderDistance);
      settingsFogRenderDistance.addEventListener('input', applySettingsFogRenderDistance);
    }
  }

  return {
    applyCanvasUpscaleMode,
    applyRenderScale,
    applyRenderScaleForCurrentMode,
    bindControls,
    getEffectiveRenderPixelRatio,
    init,
    readSavedFogRenderDistancePreference,
    restoreGraphicsDefaults,
    setFogRenderDistance,
    setPixelRatioBase,
    setPixelatedUpscaleEnabled,
    setRenderScale,
    setShadowPreset,
    setShadowsEnabled,
  };
}
