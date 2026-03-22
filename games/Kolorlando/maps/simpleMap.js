import * as THREE from 'three';

export function buildSimpleMap({ scene }) {
  const floorSize = 10;
  const groundY = 0;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(floorSize, floorSize),
    new THREE.MeshStandardMaterial({
      color: 0x2fba4e,
      roughness: 0.95,
      metalness: 0.0,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    groundY,
    spawnPoint: new THREE.Vector3(0, 1.7, 0),
    buildingColliders: [],
    entities: [],
    shadowRange: 28,
    miniMapViewSize: 16,
    miniMapHeight: 30,
  };
}
