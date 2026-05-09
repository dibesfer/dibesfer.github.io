function createMicroxelDataGrid(size, { color = '#ffffff', active = true } = {}) {
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
    color: '#ffffff',
    microxelSize: 7,
    microxels: createMicroxelDataGrid(7, { active: false }),
  },
  full: {
    type: 'microxeled',
    color: '#ffffff',
    microxelSize: 7,
    microxels: createMicroxelDataGrid(7, { active: true }),
  },
  random: {
    type: 'microxeled',
    color: '#ffffff',
    microxelSize: 7,
    microxels: Array.from({ length: 7 }, () =>
      Array.from({ length: 7 }, () =>
        Array.from({ length: 7 }, () => ({
          color: '#ffffff',
          active: Math.random() >= 0.5,
        }))
      )
    ),
  },
};
