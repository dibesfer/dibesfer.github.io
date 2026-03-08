import * as THREE from 'three';
import { Entity, HunterEntity, TalkerEntity } from '../entity.js';

const ENTITY_MIN_SPAWN_DIST_SQ = 6.25;

const nameParts1 = ['Neo', 'Cyber', 'Quantum', 'Nova', 'Hyper', 'Astra', 'Meta'];
const nameParts2 = ['Corp', 'Tower', 'Labs', 'Systems', 'Group', 'Industries', 'Center'];

function randomName() {
  return (
    nameParts1[Math.floor(Math.random() * nameParts1.length)] +
    ' ' +
    nameParts2[Math.floor(Math.random() * nameParts2.length)]
  );
}

function createWallSign(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = 512;
  canvas.height = 128;

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'white';
  ctx.font = '42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const geometry = new THREE.PlaneGeometry(3, 0.8);

  return new THREE.Mesh(geometry, material);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createWalkerOutfit() {
  const walkerSkinTones = [0xf0c9a5, 0xd8aa89, 0xb78562];
  const walkerShirts = [0xff9a9a, 0xb5d3ff, 0xbff0b1, 0xf7d48b, 0xd8b8ff];
  const walkerPants = [0x3f4d6b, 0x4d4d4d, 0x2e4a3a, 0x5a4638];
  const walkerShoes = [0x1a1a1a, 0x2a1f18, 0x101820];
  const walkerHair = [0x1f130d, 0x3a271a, 0x5a3a23, 0x111111, 0x8b5b2b];
  const walkerFaceEmoji = ['🙂', '😄', '😎', '🤖', '😴', '😶'];
  const shirt = pickRandom(walkerShirts);

  return {
    skin: pickRandom(walkerSkinTones),
    shirt,
    sleeves: shirt,
    pants: pickRandom(walkerPants),
    shoes: pickRandom(walkerShoes),
    hair: pickRandom(walkerHair),
    faceEmoji: pickRandom(walkerFaceEmoji),
  };
}

export function buildCityMap({
  scene,
  camera,
  playerEye,
  groundTexture,
  brickTexture,
  spawnPadTexture,
  brickTileSize = 2.2,
}) {
  const CITY_MIN = -100;
  const CITY_MAX = 100;
  const BUILDING_FOOTPRINT = 6;
  const CITY_MARGIN = 15;
  const CITY_OUTER_LIMIT = CITY_MAX + BUILDING_FOOTPRINT * 0.5 + CITY_MARGIN;
  const CITY_GROUND_SIZE = CITY_OUTER_LIMIT * 2;
  const SHADOW_RANGE = CITY_OUTER_LIMIT + 20;
  const groundY = 0;

  const SPAWN_CENTER = new THREE.Vector2(playerEye.x, playerEye.z);
  const SPAWN_PAD_DIAMETER = BUILDING_FOOTPRINT * 3;
  const SPAWN_CLEAR_RADIUS = SPAWN_PAD_DIAMETER * 0.5;

  const buildingColliders = [];
  const entities = [];
  const wallHeight = 6;
  const wallThickness = 0.8;

  const groundTileRepeat = CITY_GROUND_SIZE / 12;
  groundTexture.repeat.set(groundTileRepeat, groundTileRepeat);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_GROUND_SIZE, CITY_GROUND_SIZE),
    new THREE.MeshStandardMaterial({
      map: groundTexture,
      color: 0xffffff,
      roughness: 1.0,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const spawnPad = new THREE.Mesh(
    new THREE.CircleGeometry(SPAWN_PAD_DIAMETER * 0.5, 48),
    new THREE.MeshStandardMaterial({
      map: spawnPadTexture,
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0,
    })
  );
  spawnPad.rotation.x = -Math.PI / 2;
  spawnPad.position.set(SPAWN_CENTER.x, groundY + 0.03, SPAWN_CENTER.y);
  spawnPad.receiveShadow = true;
  scene.add(spawnPad);

  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const spacing = 10;
  const EMPTY_PLOT_CHANCE = 0.5;

  for (let x = CITY_MIN; x <= CITY_MAX; x += spacing) {
    for (let z = CITY_MIN; z <= CITY_MAX; z += spacing) {
      const spawnDistance = Math.hypot(x - SPAWN_CENTER.x, z - SPAWN_CENTER.y);
      if (spawnDistance < SPAWN_CLEAR_RADIUS + BUILDING_FOOTPRINT * 0.5) {
        continue;
      }

      if (Math.random() < EMPTY_PLOT_CHANCE) {
        continue;
      }

      let height = 2 + Math.random() * 10;
      if (Math.random() < 0.04) {
        height = 25 + Math.random() * 35;
      }

      const tintHue = Math.random();
      const tintSat = 0.25 + Math.random() * 0.45;
      const tintLight = 0.42 + Math.random() * 0.28;
      const buildingTint = new THREE.Color().setHSL(tintHue, tintSat, tintLight);
      const buildingTexture = brickTexture.clone();
      buildingTexture.needsUpdate = true;
      buildingTexture.repeat.set(
        BUILDING_FOOTPRINT / brickTileSize,
        height / brickTileSize
      );

      const building = new THREE.Mesh(
        buildingGeo,
        new THREE.MeshStandardMaterial({
          map: buildingTexture,
          color: buildingTint,
          roughness: 0.88,
          metalness: 0.08,
        })
      );
      building.scale.set(BUILDING_FOOTPRINT, height, BUILDING_FOOTPRINT);
      building.position.set(x, height / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);

      buildingColliders.push(new THREE.Box3().setFromObject(building));

      const sign = createWallSign(randomName());
      const halfSize = BUILDING_FOOTPRINT * 0.5;
      const face = Math.floor(Math.random() * 4);

      switch (face) {
        case 0:
          sign.position.set(x, 2, z + halfSize + 0.01);
          break;
        case 1:
          sign.position.set(x, 2, z - halfSize - 0.01);
          sign.rotation.y = Math.PI;
          break;
        case 2:
          sign.position.set(x + halfSize + 0.01, 2, z);
          sign.rotation.y = Math.PI / 2;
          break;
        case 3:
          sign.position.set(x - halfSize - 0.01, 2, z);
          sign.rotation.y = -Math.PI / 2;
          break;
      }

      scene.add(sign);
    }
  }

  function addCityWall(width, depth, x, z) {
    const wallTexture = brickTexture.clone();
    wallTexture.needsUpdate = true;
    wallTexture.repeat.set(
      Math.max(width, depth) / brickTileSize,
      wallHeight / brickTileSize
    );
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, wallHeight, depth),
      new THREE.MeshStandardMaterial({
        map: wallTexture,
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.05,
      })
    );
    wall.position.set(x, wallHeight * 0.5, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    buildingColliders.push(new THREE.Box3().setFromObject(wall));
  }

  addCityWall(CITY_GROUND_SIZE, wallThickness, 0, CITY_OUTER_LIMIT);
  addCityWall(CITY_GROUND_SIZE, wallThickness, 0, -CITY_OUTER_LIMIT);
  addCityWall(wallThickness, CITY_GROUND_SIZE, CITY_OUTER_LIMIT, 0);
  addCityWall(wallThickness, CITY_GROUND_SIZE, -CITY_OUTER_LIMIT, 0);

  const entitySpawnBox = new THREE.Box3();
  const spawnTestPos = new THREE.Vector3();
  const entitySpawnPos = new THREE.Vector3();
  const spawnForwardDir = new THREE.Vector3();
  const ENTITY_COUNT = 7;
  const HUNTER_ENTITY_COUNT = 8;
  const ENTITY_SPAWN_MARGIN = 1.2;

  function collidesWithBuildings(box) {
    for (let i = 0; i < buildingColliders.length; i++) {
      if (box.intersectsBox(buildingColliders[i])) return true;
    }
    return false;
  }

  function collidesAtGround(x, z, halfSize) {
    entitySpawnBox.min.set(x - halfSize, groundY, z - halfSize);
    entitySpawnBox.max.set(x + halfSize, groundY + 2, z + halfSize);
    return collidesWithBuildings(entitySpawnBox);
  }

  let attempts = 0;
  while (entities.length < ENTITY_COUNT + HUNTER_ENTITY_COUNT && attempts < 2400) {
    attempts++;
    const x = THREE.MathUtils.randFloat(CITY_MIN + 5, CITY_MAX - 5);
    const z = THREE.MathUtils.randFloat(CITY_MIN + 5, CITY_MAX - 5);
    if (collidesAtGround(x, z, ENTITY_SPAWN_MARGIN)) continue;

    let tooClose = false;
    spawnTestPos.set(x, groundY, z);
    for (let i = 0; i < entities.length; i++) {
      if (entities[i].position.distanceToSquared(spawnTestPos) < ENTITY_MIN_SPAWN_DIST_SQ) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    entitySpawnPos.set(x, groundY, z);
    if (entities.length < ENTITY_COUNT) {
      entities.push(new Entity({
        scene,
        position: entitySpawnPos,
        groundY,
        outfit: createWalkerOutfit(),
        speed: THREE.MathUtils.randFloat(1.2, 2.2),
        clearance: 1.0,
      }));
    } else {
      entities.push(new HunterEntity({
        scene,
        position: entitySpawnPos,
        groundY,
        color: 0x7e1313,
        speed: THREE.MathUtils.randFloat(2.0, 2.8),
        clearance: 1.0,
        detectionRadius: 10.0,
        stopDistance: 1.5,
      }));
    }
  }

  camera.getWorldDirection(spawnForwardDir);
  spawnForwardDir.y = 0;
  if (spawnForwardDir.lengthSq() < 0.0001) {
    spawnForwardDir.set(0, 0, -1);
  } else {
    spawnForwardDir.normalize();
  }

  const talkerPos = new THREE.Vector3(
    SPAWN_CENTER.x + spawnForwardDir.x * 4,
    groundY,
    SPAWN_CENTER.y + spawnForwardDir.z * 4
  );
  entities.push(new TalkerEntity({
    scene,
    position: talkerPos,
    groundY,
    name: 'Guide',
    dialogLines: ['Bienvenido a Colorlandia', 'Los Chasers te siguen', 'si te ven de cerca'],
  }));

  return {
    groundY,
    spawnPoint: new THREE.Vector3(SPAWN_CENTER.x, 1.7, SPAWN_CENTER.y),
    buildingColliders,
    entities,
    shadowRange: SHADOW_RANGE,
    miniMapViewSize: 90,
    miniMapHeight: 130,
  };
}
