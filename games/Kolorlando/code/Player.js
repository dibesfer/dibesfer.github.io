import { createHumanoidModel } from './entities/entityModel.js';

export class Player {
  constructor({
    outfit,
    castShadow = true,
    receiveShadow = false,
  } = {}) {
    this.humanoid = createHumanoidModel({
      outfit,
      castShadow,
      receiveShadow,
    });

    this.root = this.humanoid.root;
    this.joints = this.humanoid.joints;
    this.parts = this.humanoid.parts;
    this.equipmentRoots = this.humanoid.equipmentRoots;
    this.baseHeight = this.humanoid.baseHeight;
  }
}
