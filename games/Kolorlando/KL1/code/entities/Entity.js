import * as THREE from 'three';

export class Entity {
  constructor({
    scene,
    position,
    groundY = 0,
    name = 'Entity',
    typeLabel = 'Entity',
    miniMapType = 'entity',
  } = {}) {
    this.scene = scene;
    this.position = position?.clone ? position.clone() : new THREE.Vector3();
    this.groundY = groundY;
    this.name = name;
    this.typeLabel = typeLabel;
    this.miniMapType = miniMapType;
    this.collider = null;
    this.raycastShape = null;
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.scene?.add?.(this.group);
  }

  update() {}

  getRaycastShape() {
    return this.raycastShape;
  }
}
