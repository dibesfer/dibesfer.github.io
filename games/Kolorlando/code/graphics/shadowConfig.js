import * as THREE from 'three';

export const DEFAULT_SHADOW_PRESET = 'default';

export const SHADOW_PRESETS = {
  default: {
    name: 'default',
    label: 'Default',
    rendererShadowMapType: THREE.PCFShadowMap,
    mapSize: 512,
    bias: 0,
    normalBias: 0,
  },
  crisp: {
    name: 'crisp',
    label: 'Crisp',
    rendererShadowMapType: THREE.PCFSoftShadowMap,
    mapSize: 1024,
    bias: -0.0002,
    normalBias: 0.02,
  },
};

export function resolveShadowPresetName(value) {
  return Object.prototype.hasOwnProperty.call(SHADOW_PRESETS, value)
    ? value
    : DEFAULT_SHADOW_PRESET;
}

export function applyShadowPreset({
  renderer,
  directionalLight,
  presetName,
}) {
  const resolvedPresetName = resolveShadowPresetName(presetName);
  const preset = SHADOW_PRESETS[resolvedPresetName];

  if (!renderer || !directionalLight) {
    return resolvedPresetName;
  }

  /* Centralizing renderer and light shadow settings keeps visual presets in
  the graphics layer while the game runtime only decides which preset to use. */
  renderer.shadowMap.type = preset.rendererShadowMapType;
  directionalLight.shadow.mapSize.set(preset.mapSize, preset.mapSize);
  directionalLight.shadow.bias = preset.bias;
  directionalLight.shadow.normalBias = preset.normalBias;

  if (directionalLight.shadow.map) {
    directionalLight.shadow.map.dispose();
    directionalLight.shadow.map = null;
  }

  return resolvedPresetName;
}
