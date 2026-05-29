import { DEFAULT_MICROXEL_COLOR } from './MicroxelPalette.js';

function createMicroxelDataGrid(size, { color = DEFAULT_MICROXEL_COLOR, active = true } = {}) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        color,
        active,
      }))
    )
  );
}

export const VoxelPresets = {
  empty: {
    type: 'microxeled',
    color: DEFAULT_MICROXEL_COLOR,
    microxelSize: 7,
    microxels: createMicroxelDataGrid(7, { active: false }),
  },
  full: {
    type: 'microxeled',
    color: DEFAULT_MICROXEL_COLOR,
    microxelSize: 7,
    microxels: createMicroxelDataGrid(7, { active: true }),
  },
  random: {
    type: 'microxeled',
    color: DEFAULT_MICROXEL_COLOR,
    microxelSize: 7,
    microxels: Array.from({ length: 7 }, () =>
      Array.from({ length: 7 }, () =>
        Array.from({ length: 7 }, () => ({
          color: DEFAULT_MICROXEL_COLOR,
          active: Math.random() >= 0.5,
        }))
      )
    ),
  },
};

