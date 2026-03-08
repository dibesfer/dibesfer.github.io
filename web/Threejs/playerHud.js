import * as THREE from 'three';

export function createPlayerHud({ fillEl, textEl, maxHealth }) {
  function setHealth(value) {
    const clampedHealth = THREE.MathUtils.clamp(value, 0, maxHealth);
    const ratio = clampedHealth / maxHealth;

    if (fillEl) {
      fillEl.style.width = `${ratio * 100}%`;
    }

    if (textEl) {
      textEl.textContent = `${Math.round(clampedHealth)} / ${maxHealth}`;
    }
  }

  return {
    setHealth,
  };
}
