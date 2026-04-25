import { Humanoid } from './entities/humanoid.js';

export class Player {
  constructor({
    outfit,
    castShadow = true,
    receiveShadow = false,
  } = {}) {
    this.humanoid = new Humanoid({
      outfit,
      castShadow,
      receiveShadow,
      name: 'Player',
      typeLabel: 'Player',
      showLabel: false,
      showHealthBar: false,
    });

    this.root = this.humanoid.modelRoot;
    this.joints = this.humanoid.joints;
    this.parts = this.humanoid.parts;
    this.equipmentRoots = this.humanoid.equipmentRoots;
    this.baseHeight = this.humanoid.baseHeight;
  }
}
