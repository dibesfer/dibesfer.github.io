import * as THREE from 'three';
import { drawSfcFaceToContext, normalizeSfcFaceData } from '../avatar/sfcFace.js';

const MODEL_PART_SCALE = 0.9;
const LIMB_PART_GAP = 0.04;
const HEAD_FACE_SIZE = 0.404;
const HEAD_FACE_Z_OFFSET = 0.201;
export const SHOULDER_WEARABLE_CUBE_SIZE = 0.22;
export const SHOULDER_WEARABLE_TOP_OFFSET = 0;
export const HELMET_WEARABLE_BOX_SIZE = 0.5;
export const CAPE_WEARABLE_WIDTH = 0.48;
export const CAPE_WEARABLE_HEIGHT = 1.4;
export const CAPE_WEARABLE_TOP_Y = 1.52;
export const CAPE_WEARABLE_BACK_Z = -0.16;
export const TABARD_WEARABLE_WIDTH = 0.48;
export const TABARD_WEARABLE_HEIGHT = 0.42;
export const TABARD_WEARABLE_Y = 1.27;
export const TABARD_WEARABLE_FRONT_Z = 0.151;

const tabardWearableTextureLoader = new THREE.TextureLoader();

function createPartMaterial(color, roughness, metalness) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createFacePlaneMaterial(texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    roughness: 0.85,
    metalness: 0.03,
    depthTest: true,
    depthWrite: false,
  });
}

function setShadow(mesh, castShadow, receiveShadow) {
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
}

function removeAllChildren(group) {
  if (!group) return;
  while (group.children.length) {
    group.remove(group.children[0]);
  }
}

function createChestWearablePartMeshes({
  color = 0xffffff,
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const armorMaterial = createPartMaterial(color, 0.6, 0.12);
  const wearablePartScale = MODEL_PART_SCALE;

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.28), armorMaterial);
  hips.name = 'wearableChestHips';
  hips.position.set(0, 0.91, 0);
  hips.scale.setScalar(wearablePartScale);
  setShadow(hips, castShadow, receiveShadow);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.3), armorMaterial);
  chest.name = 'wearableChestTorso';
  chest.position.set(0, 1.27, 0);
  chest.scale.setScalar(wearablePartScale);
  setShadow(chest, castShadow, receiveShadow);

  const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.33, 0.18), armorMaterial);
  leftUpperArm.name = 'wearableLeftUpperArm';
  leftUpperArm.position.set(0, -0.165, 0);
  leftUpperArm.scale.setScalar(wearablePartScale);
  setShadow(leftUpperArm, castShadow, receiveShadow);

  const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.33, 0.18), armorMaterial);
  rightUpperArm.name = 'wearableRightUpperArm';
  rightUpperArm.position.set(0, -0.165, 0);
  rightUpperArm.scale.setScalar(wearablePartScale);
  setShadow(rightUpperArm, castShadow, receiveShadow);

  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), armorMaterial);
  leftForearm.name = 'wearableLeftForearm';
  leftForearm.position.set(0, -0.15, 0);
  leftForearm.scale.setScalar(wearablePartScale);
  setShadow(leftForearm, castShadow, receiveShadow);

  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), armorMaterial);
  rightForearm.name = 'wearableRightForearm';
  rightForearm.position.set(0, -0.15, 0);
  rightForearm.scale.setScalar(wearablePartScale);
  setShadow(rightForearm, castShadow, receiveShadow);

  return {
    hips,
    chest,
    leftUpperArm,
    rightUpperArm,
    leftForearm,
    rightForearm,
  };
}

function createPantsWearablePartMeshes({
  color = 0xffffff,
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const armorMaterial = createPartMaterial(color, 0.6, 0.12);
  const wearablePartScale = MODEL_PART_SCALE;

  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), armorMaterial);
  leftThigh.name = 'wearableLeftThigh';
  leftThigh.position.set(0, -0.17, 0);
  leftThigh.scale.setScalar(wearablePartScale);
  setShadow(leftThigh, castShadow, receiveShadow);

  const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), armorMaterial);
  rightThigh.name = 'wearableRightThigh';
  rightThigh.position.set(0, -0.17, 0);
  rightThigh.scale.setScalar(wearablePartScale);
  setShadow(rightThigh, castShadow, receiveShadow);

  const leftShin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), armorMaterial);
  leftShin.name = 'wearableLeftShin';
  leftShin.position.set(0, -0.14, 0);
  leftShin.scale.setScalar(wearablePartScale);
  setShadow(leftShin, castShadow, receiveShadow);

  const rightShin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), armorMaterial);
  rightShin.name = 'wearableRightShin';
  rightShin.position.set(0, -0.14, 0);
  rightShin.scale.setScalar(wearablePartScale);
  setShadow(rightShin, castShadow, receiveShadow);

  return {
    leftThigh,
    rightThigh,
    leftShin,
    rightShin,
  };
}

function createBootsWearablePartMeshes({
  color = 0xffffff,
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const armorMaterial = createPartMaterial(color, 0.6, 0.12);
  const wearablePartScale = MODEL_PART_SCALE;

  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.29), armorMaterial);
  leftBoot.name = 'wearableLeftBoot';
  leftBoot.position.set(0, -0.38, 0.06);
  leftBoot.scale.setScalar(wearablePartScale);
  setShadow(leftBoot, castShadow, receiveShadow);

  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.29), armorMaterial);
  rightBoot.name = 'wearableRightBoot';
  rightBoot.position.set(0, -0.38, 0.06);
  rightBoot.scale.setScalar(wearablePartScale);
  setShadow(rightBoot, castShadow, receiveShadow);

  return {
    leftBoot,
    rightBoot,
  };
}

function createGlovesWearablePartMeshes({
  color = 0xffffff,
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const armorMaterial = createPartMaterial(color, 0.6, 0.12);
  const wearablePartScale = MODEL_PART_SCALE;

  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.17), armorMaterial);
  rightGlove.name = 'wearableRightGlove';
  rightGlove.position.set(0, 0, 0);
  rightGlove.scale.setScalar(wearablePartScale);
  setShadow(rightGlove, castShadow, receiveShadow);

  const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.17), armorMaterial);
  leftGlove.name = 'wearableLeftGlove';
  leftGlove.position.set(0, 0, 0);
  leftGlove.scale.setScalar(wearablePartScale);
  setShadow(leftGlove, castShadow, receiveShadow);

  return {
    rightGlove,
    leftGlove,
  };
}

function createShouldersWearablePartMeshes({
  color = 0xffffff,
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const armorMaterial = createPartMaterial(color, 0.6, 0.12);
  const wearablePartScale = MODEL_PART_SCALE;

  const rightShoulderCube = new THREE.Mesh(
    new THREE.BoxGeometry(
      SHOULDER_WEARABLE_CUBE_SIZE,
      SHOULDER_WEARABLE_CUBE_SIZE,
      SHOULDER_WEARABLE_CUBE_SIZE
    ),
    armorMaterial
  );
  rightShoulderCube.name = 'wearableRightShoulder';
  rightShoulderCube.position.set(0, SHOULDER_WEARABLE_TOP_OFFSET, 0);
  rightShoulderCube.scale.setScalar(wearablePartScale);
  setShadow(rightShoulderCube, castShadow, receiveShadow);

  const leftShoulderCube = new THREE.Mesh(
    new THREE.BoxGeometry(
      SHOULDER_WEARABLE_CUBE_SIZE,
      SHOULDER_WEARABLE_CUBE_SIZE,
      SHOULDER_WEARABLE_CUBE_SIZE
    ),
    armorMaterial
  );
  leftShoulderCube.name = 'wearableLeftShoulder';
  leftShoulderCube.position.set(0, SHOULDER_WEARABLE_TOP_OFFSET, 0);
  leftShoulderCube.scale.setScalar(wearablePartScale);
  setShadow(leftShoulderCube, castShadow, receiveShadow);

  return {
    rightShoulderCube,
    leftShoulderCube,
  };
}

function createHelmetWearablePartMeshes({
  color = 0xffffff,
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const armorMaterial = createPartMaterial(color, 0.6, 0.12);
  const wearablePartScale = MODEL_PART_SCALE;

  const helmet = new THREE.Mesh(
    new THREE.BoxGeometry(
      HELMET_WEARABLE_BOX_SIZE,
      HELMET_WEARABLE_BOX_SIZE,
      HELMET_WEARABLE_BOX_SIZE
    ),
    armorMaterial
  );
  helmet.name = 'wearableHelmet';
  helmet.position.set(0, 1.68, 0);
  helmet.scale.setScalar(wearablePartScale);
  setShadow(helmet, castShadow, receiveShadow);

  return {
    helmet,
  };
}

function createCapeWearablePartMeshes({
  color = 0xffffff,
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const armorMaterial = createPartMaterial(color, 0.62, 0.08);
  armorMaterial.side = THREE.DoubleSide;
  const wearablePartScale = MODEL_PART_SCALE;

  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(CAPE_WEARABLE_WIDTH, CAPE_WEARABLE_HEIGHT),
    armorMaterial
  );
  cape.name = 'wearableCape';
  cape.position.set(0, CAPE_WEARABLE_TOP_Y - (CAPE_WEARABLE_HEIGHT * 0.5), CAPE_WEARABLE_BACK_Z);
  cape.scale.setScalar(wearablePartScale);
  setShadow(cape, castShadow, receiveShadow);

  return {
    cape,
  };
}

function createTabardWearablePartMeshes({
  imageUrl = 'games/Kolorlando/assets/icons/Asymmetrical_symbol_of_Chaos.png',
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const texture = tabardWearableTextureLoader.load(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const tabardMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const wearablePartScale = MODEL_PART_SCALE;

  const tabard = new THREE.Mesh(
    new THREE.PlaneGeometry(TABARD_WEARABLE_WIDTH, TABARD_WEARABLE_HEIGHT),
    tabardMaterial
  );
  tabard.name = 'wearableTabard';
  tabard.position.set(0, TABARD_WEARABLE_Y, TABARD_WEARABLE_FRONT_Z);
  tabard.scale.setScalar(wearablePartScale);
  setShadow(tabard, castShadow, receiveShadow);

  return {
    tabard,
  };
}

function resolveChestWearableDefinition(itemDefinition) {
  const wearableDescriptor = itemDefinition?.metadata?.humanoidWearable;
  if (!wearableDescriptor || wearableDescriptor.type !== 'chest') {
    return null;
  }

  return {
    color: wearableDescriptor.color ?? 0xffffff,
  };
}

function resolvePantsWearableDefinition(itemDefinition) {
  const wearableDescriptor = itemDefinition?.metadata?.humanoidWearable;
  if (!wearableDescriptor || wearableDescriptor.type !== 'pants') {
    return null;
  }

  return {
    color: wearableDescriptor.color ?? 0xffffff,
  };
}

function resolveBootsWearableDefinition(itemDefinition) {
  const wearableDescriptor = itemDefinition?.metadata?.humanoidWearable;
  if (!wearableDescriptor || wearableDescriptor.type !== 'boots') {
    return null;
  }

  return {
    color: wearableDescriptor.color ?? 0xffffff,
  };
}

function resolveShouldersWearableDefinition(itemDefinition) {
  const wearableDescriptor = itemDefinition?.metadata?.humanoidWearable;
  if (!wearableDescriptor || wearableDescriptor.type !== 'shoulders') {
    return null;
  }

  return {
    color: wearableDescriptor.color ?? 0xffffff,
  };
}

function resolveHelmetWearableDefinition(itemDefinition) {
  const wearableDescriptor = itemDefinition?.metadata?.humanoidWearable;
  if (!wearableDescriptor || wearableDescriptor.type !== 'helmet') {
    return null;
  }

  return {
    color: wearableDescriptor.color ?? 0xffffff,
  };
}

function resolveCapeWearableDefinition(itemDefinition) {
  const wearableDescriptor = itemDefinition?.metadata?.humanoidWearable;
  if (!wearableDescriptor || wearableDescriptor.type !== 'cape') {
    return null;
  }

  return {
    color: wearableDescriptor.color ?? 0xffffff,
  };
}

function resolveTabardWearableDefinition(itemDefinition) {
  const wearableDescriptor = itemDefinition?.metadata?.humanoidWearable;
  if (!wearableDescriptor || wearableDescriptor.type !== 'tabard') {
    return null;
  }

  return {
    imageUrl: wearableDescriptor.imageUrl ?? 'games/Kolorlando/assets/icons/Asymmetrical_symbol_of_Chaos.png',
  };
}

function resolveGlovesWearableDefinition(itemDefinition) {
  const wearableDescriptor = itemDefinition?.metadata?.humanoidWearable;
  if (!wearableDescriptor || wearableDescriptor.type !== 'gloves') {
    return null;
  }

  return {
    color: wearableDescriptor.color ?? 0xffffff,
  };
}

function setChestWearableVisibility(humanoid, visible) {
  if (!humanoid?.parts) return;

  [
    humanoid.parts.belly,
    humanoid.parts.chest,
    humanoid.parts.leftUpperArm,
    humanoid.parts.rightUpperArm,
    humanoid.parts.leftForearm,
    humanoid.parts.rightForearm,
  ].forEach(function (part) {
    if (!part) return;
    part.visible = visible;
  });
}

function setPantsWearableVisibility(humanoid, visible) {
  if (!humanoid?.parts) return;

  [
    humanoid.parts.leftThigh,
    humanoid.parts.rightThigh,
    humanoid.parts.leftShin,
    humanoid.parts.rightShin,
  ].forEach(function (part) {
    if (!part) return;
    part.visible = visible;
  });
}

function setBootsWearableVisibility(humanoid, visible) {
  if (!humanoid?.parts) return;

  [
    humanoid.parts.leftShoe,
    humanoid.parts.rightShoe,
  ].forEach(function (part) {
    if (!part) return;
    part.visible = visible;
  });
}

function setGlovesWearableVisibility(humanoid, visible) {
  if (!humanoid?.parts) return;

  [humanoid.parts.rightHand, humanoid.parts.leftHand].forEach(function (part) {
    if (!part) return;
    part.visible = visible;
  });
}

function setHelmetWearableVisibility(humanoid, visible) {
  if (!humanoid?.parts) return;

  [
    humanoid.parts.head,
    humanoid.parts.faceMesh,
    humanoid.parts.hairTop,
    humanoid.parts.hairBack,
    humanoid.parts.hairLeft,
    humanoid.parts.hairRight,
  ].forEach(function (part) {
    if (!part) return;
    part.visible = visible;
  });
}

function mountChestWearableParts(humanoid, chestWearableDefinition) {
  if (!humanoid?.equipmentRoots || !chestWearableDefinition) return;

  const wearables = createChestWearablePartMeshes({
    color: chestWearableDefinition.color,
    castShadow: humanoid.castShadow,
    receiveShadow: humanoid.receiveShadow,
  });

  humanoid.equipmentRoots.torso.add(wearables.hips, wearables.chest);
  humanoid.equipmentRoots.leftShoulder.add(wearables.leftUpperArm);
  humanoid.equipmentRoots.rightShoulder.add(wearables.rightUpperArm);
  humanoid.equipmentRoots.leftElbow.add(wearables.leftForearm);
  humanoid.equipmentRoots.rightElbow.add(wearables.rightForearm);
}

function mountPantsWearableParts(humanoid, pantsWearableDefinition) {
  if (!humanoid?.equipmentRoots || !pantsWearableDefinition) return;

  const wearables = createPantsWearablePartMeshes({
    color: pantsWearableDefinition.color,
    castShadow: humanoid.castShadow,
    receiveShadow: humanoid.receiveShadow,
  });

  humanoid.equipmentRoots.leftHip.add(wearables.leftThigh);
  humanoid.equipmentRoots.rightHip.add(wearables.rightThigh);
  humanoid.equipmentRoots.leftKnee.add(wearables.leftShin);
  humanoid.equipmentRoots.rightKnee.add(wearables.rightShin);
}

function mountBootsWearableParts(humanoid, bootsWearableDefinition) {
  if (!humanoid?.equipmentRoots || !bootsWearableDefinition) return;

  const wearables = createBootsWearablePartMeshes({
    color: bootsWearableDefinition.color,
    castShadow: humanoid.castShadow,
    receiveShadow: humanoid.receiveShadow,
  });

  humanoid.equipmentRoots.leftKnee.add(wearables.leftBoot);
  humanoid.equipmentRoots.rightKnee.add(wearables.rightBoot);
}

function mountGlovesWearableParts(humanoid, glovesWearableDefinition) {
  if (!humanoid?.equipmentRoots || !glovesWearableDefinition) return;

  const wearables = createGlovesWearablePartMeshes({
    color: glovesWearableDefinition.color,
    castShadow: humanoid.castShadow,
    receiveShadow: humanoid.receiveShadow,
  });

  // Hand anchors own both the visible hand and the holdable slot, so gloves can
  // replace the hand mesh while still inheriting the final authored pose.
  humanoid.equipmentRoots.rightHand?.add(wearables.rightGlove);
  humanoid.equipmentRoots.leftHand?.add(wearables.leftGlove);
}

function mountShouldersWearableParts(humanoid, shouldersWearableDefinition) {
  if (!humanoid?.equipmentRoots || !shouldersWearableDefinition) return;

  const wearables = createShouldersWearablePartMeshes({
    color: shouldersWearableDefinition.color,
    castShadow: humanoid.castShadow,
    receiveShadow: humanoid.receiveShadow,
  });

  humanoid.equipmentRoots.leftShoulder.add(wearables.rightShoulderCube);
  humanoid.equipmentRoots.rightShoulder.add(wearables.leftShoulderCube);
}

function mountHelmetWearableParts(humanoid, helmetWearableDefinition) {
  if (!humanoid?.equipmentRoots || !helmetWearableDefinition) return;

  const wearables = createHelmetWearablePartMeshes({
    color: helmetWearableDefinition.color,
    castShadow: humanoid.castShadow,
    receiveShadow: humanoid.receiveShadow,
  });

  humanoid.equipmentRoots.torso.add(wearables.helmet);
}

function mountCapeWearableParts(humanoid, capeWearableDefinition) {
  if (!humanoid?.equipmentRoots || !capeWearableDefinition) return;

  const wearables = createCapeWearablePartMeshes({
    color: capeWearableDefinition.color,
    castShadow: humanoid.castShadow,
    receiveShadow: humanoid.receiveShadow,
  });

  humanoid.equipmentRoots.back.add(wearables.cape);
}

function mountTabardWearableParts(humanoid, tabardWearableDefinition) {
  if (!humanoid?.equipmentRoots || !tabardWearableDefinition) return;

  const wearables = createTabardWearablePartMeshes({
    imageUrl: tabardWearableDefinition.imageUrl,
    castShadow: humanoid.castShadow,
    receiveShadow: humanoid.receiveShadow,
  });

  humanoid.equipmentRoots.front.add(wearables.tabard);
}

export function applyHumanoidEquipment(humanoid, equipment = null, resolveItemDefinition = null) {
  if (!humanoid?.equipmentRoots) return;

  const chestItemId = typeof equipment?.getEquippedItemId === 'function'
    ? equipment.getEquippedItemId('chest')
    : null;
  const pantsItemId = typeof equipment?.getEquippedItemId === 'function'
    ? equipment.getEquippedItemId('pants')
    : null;
  const bootsItemId = typeof equipment?.getEquippedItemId === 'function'
    ? equipment.getEquippedItemId('boots')
    : null;
  const glovesItemId = typeof equipment?.getEquippedItemId === 'function'
    ? equipment.getEquippedItemId('gloves')
    : null;
  const shouldersItemId = typeof equipment?.getEquippedItemId === 'function'
    ? equipment.getEquippedItemId('shoulders')
    : null;
  const helmetItemId = typeof equipment?.getEquippedItemId === 'function'
    ? equipment.getEquippedItemId('helmet')
    : null;
  const capeItemId = typeof equipment?.getEquippedItemId === 'function'
    ? equipment.getEquippedItemId('cape')
    : null;
  const tabardItemId = typeof equipment?.getEquippedItemId === 'function'
    ? equipment.getEquippedItemId('tabard')
    : null;
  const chestItemDefinition = chestItemId && typeof resolveItemDefinition === 'function'
    ? resolveItemDefinition(chestItemId)
    : null;
  const pantsItemDefinition = pantsItemId && typeof resolveItemDefinition === 'function'
    ? resolveItemDefinition(pantsItemId)
    : null;
  const bootsItemDefinition = bootsItemId && typeof resolveItemDefinition === 'function'
    ? resolveItemDefinition(bootsItemId)
    : null;
  const glovesItemDefinition = glovesItemId && typeof resolveItemDefinition === 'function'
    ? resolveItemDefinition(glovesItemId)
    : null;
  const shouldersItemDefinition = shouldersItemId && typeof resolveItemDefinition === 'function'
    ? resolveItemDefinition(shouldersItemId)
    : null;
  const helmetItemDefinition = helmetItemId && typeof resolveItemDefinition === 'function'
    ? resolveItemDefinition(helmetItemId)
    : null;
  const capeItemDefinition = capeItemId && typeof resolveItemDefinition === 'function'
    ? resolveItemDefinition(capeItemId)
    : null;
  const tabardItemDefinition = tabardItemId && typeof resolveItemDefinition === 'function'
    ? resolveItemDefinition(tabardItemId)
    : null;
  const chestWearableDefinition = resolveChestWearableDefinition(chestItemDefinition);
  const pantsWearableDefinition = resolvePantsWearableDefinition(pantsItemDefinition);
  const bootsWearableDefinition = resolveBootsWearableDefinition(bootsItemDefinition);
  const glovesWearableDefinition = resolveGlovesWearableDefinition(glovesItemDefinition);
  const shouldersWearableDefinition = resolveShouldersWearableDefinition(shouldersItemDefinition);
  const helmetWearableDefinition = resolveHelmetWearableDefinition(helmetItemDefinition);
  const capeWearableDefinition = resolveCapeWearableDefinition(capeItemDefinition);
  const tabardWearableDefinition = resolveTabardWearableDefinition(tabardItemDefinition);

  Object.values(humanoid.equipmentRoots).forEach(removeAllChildren);

  if (!chestWearableDefinition) {
    setChestWearableVisibility(humanoid, true);
  } else {
    setChestWearableVisibility(humanoid, false);
    mountChestWearableParts(humanoid, chestWearableDefinition);
  }

  if (!pantsWearableDefinition) {
    setPantsWearableVisibility(humanoid, true);
  } else {
    setPantsWearableVisibility(humanoid, false);
    mountPantsWearableParts(humanoid, pantsWearableDefinition);
  }

  if (!bootsWearableDefinition) {
    setBootsWearableVisibility(humanoid, true);
  } else {
    setBootsWearableVisibility(humanoid, false);
    mountBootsWearableParts(humanoid, bootsWearableDefinition);
  }

  if (!glovesWearableDefinition) {
    setGlovesWearableVisibility(humanoid, true);
  } else {
    setGlovesWearableVisibility(humanoid, false);
    mountGlovesWearableParts(humanoid, glovesWearableDefinition);
  }

  if (shouldersWearableDefinition) {
    mountShouldersWearableParts(humanoid, shouldersWearableDefinition);
  }

  if (capeWearableDefinition) {
    mountCapeWearableParts(humanoid, capeWearableDefinition);
  }

  if (tabardWearableDefinition) {
    mountTabardWearableParts(humanoid, tabardWearableDefinition);
  }

  if (!helmetWearableDefinition) {
    setHelmetWearableVisibility(humanoid, true);
    return;
  }

  setHelmetWearableVisibility(humanoid, false);
  mountHelmetWearableParts(humanoid, helmetWearableDefinition);
}

function createEmojiFace(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '96px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, canvas.width * 0.5, canvas.height * 0.53);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = createFacePlaneMaterial(texture);
  /* Matching the head box face exactly keeps the emoji texture flush with the
  front square of the cube instead of hanging slightly wider than the head. */
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(HEAD_FACE_SIZE, HEAD_FACE_SIZE), material);
  /* The face should participate in the normal character depth stack so any
  floating HUD sprites that intentionally render later can appear above it. */
  plane.renderOrder = 0;
  plane.userData.skipHumanoidPartScale = true;
  return plane;
}

function createSfcFace(faceData) {
  const normalizedFaceData = normalizeSfcFaceData(faceData);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = createFacePlaneMaterial(texture);

  /* The SFC face uses the same exact square as the head front so both the
  default preset and imported faces fit the cube face cleanly edge to edge. */
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(HEAD_FACE_SIZE, HEAD_FACE_SIZE), material);
  /* Keeping the SFC plane in the base character layer prevents it from
  jumping in front of later-rendered world-space labels or dialog bubbles. */
  plane.renderOrder = 0;
  plane.userData.skipHumanoidPartScale = true;

  /* The face plane can appear immediately with the normalized base color while
  the SFC layer images stream in asynchronously, then the same texture is
  refreshed in place so the head mesh does not need to be rebuilt. */
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = normalizedFaceData.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  texture.needsUpdate = true;

  drawSfcFaceToContext(ctx, canvas.width, normalizedFaceData)
    .then(() => {
      texture.needsUpdate = true;
    })
    .catch(error => {
      console.error('Failed to draw Square Face Creator data on a humanoid face.', error);
    });

  return plane;
}

function drawPlayerNameLabel(context, canvas, name) {
  /* One shared renderer keeps local and remote player labels visually aligned
  so identity reads the same everywhere in the world. */
  const safeName = typeof name === 'string' && name.trim() ? name.trim() : 'Anonymous';

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(0, 0, 0, 0.6)';
  context.fillRect(32, 22, canvas.width - 64, 52);
  context.lineWidth = 4;
  context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  context.strokeRect(32, 22, canvas.width - 64, 52);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 28px "Ubuntu Sans Mono", monospace';
  context.fillStyle = '#ffffff';
  context.fillText(safeName, canvas.width * 0.5, canvas.height * 0.5);
}

export function createPlayerNameSprite(name) {
  /* Canvas sprites keep in-world labels lightweight and easy to attach to any
  humanoid without introducing a separate DOM overlay system. */
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 96;
  const context = canvas.getContext('2d');

  if (!context) return null;

  drawPlayerNameLabel(context, canvas, name);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    /* Nameplates are part of the 3D world, so they should participate in the
    depth buffer instead of rendering as HUD overlays through geometry. */
    depthWrite: true,
    depthTest: true,
    alphaTest: 0.12,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.85, 0.56, 1);
  sprite.frustumCulled = false;
  sprite.renderOrder = 10;
  sprite.userData.playerNameCanvas = canvas;
  sprite.userData.playerNameContext = context;
  sprite.userData.playerNameTexture = texture;
  return sprite;
}

export function updatePlayerNameSprite(sprite, name) {
  /* Updating the existing sprite keeps avatar identity changes cheap and
  avoids rebuilding any world-space UI attachments. */
  const canvas = sprite?.userData?.playerNameCanvas;
  const context = sprite?.userData?.playerNameContext;
  const texture = sprite?.userData?.playerNameTexture;

  if (!canvas || !context || !texture) return;

  drawPlayerNameLabel(context, canvas, name);
  texture.needsUpdate = true;
}

export function createHumanoidModel({
  outfit = {},
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const normalizedFaceData = outfit.faceData
    ? normalizeSfcFaceData(outfit.faceData)
    : null;

  const resolvedOutfit = {
    /* The SFC background is the player's base body-shell color, so the default
    unarmored torso, arms, legs, and feet all read from the same source. */
    skin: normalizedFaceData?.background ?? outfit.skin ?? 0xf0c9a5,
    shirt: outfit.shirt ?? normalizedFaceData?.background ?? outfit.skin ?? 0xf0c9a5,
    sleeves: outfit.sleeves ?? outfit.shirt ?? normalizedFaceData?.background ?? outfit.skin ?? 0xf0c9a5,
    pants: outfit.pants ?? normalizedFaceData?.background ?? outfit.skin ?? 0xf0c9a5,
    shoes: outfit.shoes ?? normalizedFaceData?.background ?? outfit.skin ?? 0xf0c9a5,
    hair: outfit.hair ?? 0x2a1d16,
    faceEmoji: outfit.faceEmoji ?? '🙂',
    /* Reusing the normalized payload below avoids skin and face reading from
    slightly different SFC values when old or partial save data is loaded. */
    faceData: normalizedFaceData,
  };

  const skinMat = createPartMaterial(resolvedOutfit.skin, 0.85, 0.03);
  const shirtMat = createPartMaterial(resolvedOutfit.shirt, 0.82, 0.05);
  const sleeveMat = createPartMaterial(resolvedOutfit.sleeves, 0.82, 0.05);
  const pantsMat = createPartMaterial(resolvedOutfit.pants, 0.86, 0.04);
  const shoesMat = createPartMaterial(resolvedOutfit.shoes, 0.92, 0.02);
  const hairMat = createPartMaterial(resolvedOutfit.hair, 0.88, 0.02);

  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.28), shirtMat);
  belly.name = 'hips';
  belly.position.set(0, 0.91, 0);
  setShadow(belly, castShadow, receiveShadow);
  torso.add(belly);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.3), shirtMat);
  chest.name = 'chest';
  chest.position.set(0, 1.27, 0);
  setShadow(chest, castShadow, receiveShadow);
  torso.add(chest);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
  head.name = 'head';
  head.position.set(0, 1.68, 0);
  setShadow(head, castShadow, receiveShadow);
  torso.add(head);

  const faceMesh = resolvedOutfit.faceData
    ? createSfcFace(resolvedOutfit.faceData)
    : createEmojiFace(resolvedOutfit.faceEmoji);
  if (faceMesh) {
    /* The plane sits just in front of the head's half-depth to avoid z-fight
    shimmer while still reading as perfectly attached to the box face. */
    faceMesh.position.set(0, 0, HEAD_FACE_Z_OFFSET);
    head.add(faceMesh);
  }

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), hairMat);
  hairTop.name = 'hairTop';
  hairTop.position.set(0, 0.2, 0);
  setShadow(hairTop, castShadow, receiveShadow);
  head.add(hairTop);

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.16), hairMat);
  hairBack.name = 'hairBack';
  hairBack.position.set(0, 0.04, -0.16);
  setShadow(hairBack, castShadow, receiveShadow);
  head.add(hairBack);

  const hairLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.24), hairMat);
  hairLeft.name = 'hairLeft';
  hairLeft.position.set(-0.23, 0.06, 0);
  setShadow(hairLeft, castShadow, receiveShadow);
  head.add(hairLeft);

  const hairRight = hairLeft.clone();
  hairRight.name = 'hairRight';
  hairRight.position.x = 0.23;
  head.add(hairRight);

  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.36, 1.48, 0);
  torso.add(leftShoulder);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.36, 1.48, 0);
  torso.add(rightShoulder);

  const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.33, 0.18), sleeveMat);
  leftUpperArm.name = 'leftUpperArm';
  leftUpperArm.position.set(0, -0.165, 0);
  setShadow(leftUpperArm, castShadow, receiveShadow);
  leftShoulder.add(leftUpperArm);

  const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.33, 0.18), sleeveMat);
  rightUpperArm.name = 'rightUpperArm';
  rightUpperArm.position.set(0, -0.165, 0);
  setShadow(rightUpperArm, castShadow, receiveShadow);
  rightShoulder.add(rightUpperArm);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.33 - LIMB_PART_GAP, 0);
  leftShoulder.add(leftElbow);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.33 - LIMB_PART_GAP, 0);
  rightShoulder.add(rightElbow);

  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), sleeveMat);
  leftForearm.name = 'leftForearm';
  leftForearm.position.set(0, -0.15, 0);
  setShadow(leftForearm, castShadow, receiveShadow);
  leftElbow.add(leftForearm);

  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), sleeveMat);
  rightForearm.name = 'rightForearm';
  rightForearm.position.set(0, -0.15, 0);
  setShadow(rightForearm, castShadow, receiveShadow);
  rightElbow.add(rightForearm);

  const backViewRightHandAnchor = new THREE.Group();
  backViewRightHandAnchor.name = 'rightHandAnchor';
  backViewRightHandAnchor.position.set(0, -0.41, 0.015);
  leftElbow.add(backViewRightHandAnchor);

  const backViewRightHand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.17), skinMat);
  // Names follow the player's back-view reading: negative X is exposed as right.
  backViewRightHand.name = 'rightHand';
  backViewRightHand.position.set(0, 0, 0);
  setShadow(backViewRightHand, castShadow, receiveShadow);
  backViewRightHandAnchor.add(backViewRightHand);

  const backViewRightHandSlot = new THREE.Group();
  backViewRightHandSlot.name = 'rightHandSlot';
  backViewRightHandAnchor.add(backViewRightHandSlot);

  const backViewRightHandEquipmentRoot = new THREE.Group();
  backViewRightHandEquipmentRoot.name = 'rightHandEquipmentRoot';
  backViewRightHandAnchor.add(backViewRightHandEquipmentRoot);

  const backViewLeftHandAnchor = new THREE.Group();
  backViewLeftHandAnchor.name = 'leftHandAnchor';
  backViewLeftHandAnchor.position.set(0, -0.41, 0.015);
  rightElbow.add(backViewLeftHandAnchor);

  const backViewLeftHand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.17), skinMat);
  // Positive X is exposed as left under the same back-view convention.
  backViewLeftHand.name = 'leftHand';
  backViewLeftHand.position.set(0, 0, 0);
  setShadow(backViewLeftHand, castShadow, receiveShadow);
  backViewLeftHandAnchor.add(backViewLeftHand);

  const backViewLeftHandSlot = new THREE.Group();
  backViewLeftHandSlot.name = 'leftHandSlot';
  backViewLeftHandAnchor.add(backViewLeftHandSlot);

  const backViewLeftHandEquipmentRoot = new THREE.Group();
  backViewLeftHandEquipmentRoot.name = 'leftHandEquipmentRoot';
  backViewLeftHandAnchor.add(backViewLeftHandEquipmentRoot);

  const leftHip = new THREE.Group();
  leftHip.position.set(-0.12, 0.82, 0);
  root.add(leftHip);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.12, 0.82, 0);
  root.add(rightHip);

  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), pantsMat);
  leftThigh.name = 'leftThigh';
  leftThigh.position.set(0, -0.17, 0);
  setShadow(leftThigh, castShadow, receiveShadow);
  leftHip.add(leftThigh);

  const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), pantsMat);
  rightThigh.name = 'rightThigh';
  rightThigh.position.set(0, -0.17, 0);
  setShadow(rightThigh, castShadow, receiveShadow);
  rightHip.add(rightThigh);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.34 - LIMB_PART_GAP, 0);
  leftHip.add(leftKnee);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.34 - LIMB_PART_GAP, 0);
  rightHip.add(rightKnee);

  const leftShin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), pantsMat);
  leftShin.name = 'leftShin';
  leftShin.position.set(0, -0.14, 0);
  setShadow(leftShin, castShadow, receiveShadow);
  leftKnee.add(leftShin);

  const rightShin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), pantsMat);
  rightShin.name = 'rightShin';
  rightShin.position.set(0, -0.14, 0);
  setShadow(rightShin, castShadow, receiveShadow);
  rightKnee.add(rightShin);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.29), shoesMat);
  leftShoe.name = 'leftShoe';
  leftShoe.position.set(0, -0.38, 0.06);
  setShadow(leftShoe, castShadow, receiveShadow);
  leftKnee.add(leftShoe);

  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.29), shoesMat);
  rightShoe.name = 'rightShoe';
  rightShoe.position.set(0, -0.38, 0.06);
  setShadow(rightShoe, castShadow, receiveShadow);
  rightKnee.add(rightShoe);

  const torsoEquipmentRoot = new THREE.Group();
  torsoEquipmentRoot.name = 'torsoEquipmentRoot';
  torso.add(torsoEquipmentRoot);

  const backEquipmentRoot = new THREE.Group();
  backEquipmentRoot.name = 'backEquipmentRoot';
  torso.add(backEquipmentRoot);

  const frontEquipmentRoot = new THREE.Group();
  frontEquipmentRoot.name = 'frontEquipmentRoot';
  torso.add(frontEquipmentRoot);

  const leftShoulderEquipmentRoot = new THREE.Group();
  leftShoulderEquipmentRoot.name = 'leftShoulderEquipmentRoot';
  leftShoulder.add(leftShoulderEquipmentRoot);

  const rightShoulderEquipmentRoot = new THREE.Group();
  rightShoulderEquipmentRoot.name = 'rightShoulderEquipmentRoot';
  rightShoulder.add(rightShoulderEquipmentRoot);

  const leftElbowEquipmentRoot = new THREE.Group();
  leftElbowEquipmentRoot.name = 'leftElbowEquipmentRoot';
  leftElbow.add(leftElbowEquipmentRoot);

  const rightElbowEquipmentRoot = new THREE.Group();
  rightElbowEquipmentRoot.name = 'rightElbowEquipmentRoot';
  rightElbow.add(rightElbowEquipmentRoot);

  const leftHipEquipmentRoot = new THREE.Group();
  leftHipEquipmentRoot.name = 'leftHipEquipmentRoot';
  leftHip.add(leftHipEquipmentRoot);

  const rightHipEquipmentRoot = new THREE.Group();
  rightHipEquipmentRoot.name = 'rightHipEquipmentRoot';
  rightHip.add(rightHipEquipmentRoot);

  const leftKneeEquipmentRoot = new THREE.Group();
  leftKneeEquipmentRoot.name = 'leftKneeEquipmentRoot';
  leftKnee.add(leftKneeEquipmentRoot);

  const rightKneeEquipmentRoot = new THREE.Group();
  rightKneeEquipmentRoot.name = 'rightKneeEquipmentRoot';
  rightKnee.add(rightKneeEquipmentRoot);

  root.traverse(part => {
    if (part.isMesh) {
      if (part.userData?.skipHumanoidPartScale) return;
      part.scale.multiplyScalar(MODEL_PART_SCALE);
    }
  });

  torso.userData.baseY = torso.position.y;
  leftShoulder.userData.baseY = leftShoulder.position.y;
  rightShoulder.userData.baseY = rightShoulder.position.y;

  return {
    root,
    castShadow,
    receiveShadow,
    joints: {
      torso,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftHand: backViewLeftHandAnchor,
      rightHand: backViewRightHandAnchor,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      // Slot keys follow the same back-view naming exposed by the hand meshes.
      leftHandSlot: backViewLeftHandSlot,
      rightHandSlot: backViewRightHandSlot,
    },
    parts: {
      belly,
      chest,
      head,
      faceMesh,
      hairTop,
      hairBack,
      hairLeft,
      hairRight,
      leftUpperArm,
      rightUpperArm,
      leftForearm,
      rightForearm,
      leftThigh,
      rightThigh,
      leftShin,
      rightShin,
      leftShoe,
      rightShoe,
      rightHand: backViewRightHand,
      leftHand: backViewLeftHand,
    },
    equipmentRoots: {
      torso: torsoEquipmentRoot,
      front: frontEquipmentRoot,
      back: backEquipmentRoot,
      leftShoulder: leftShoulderEquipmentRoot,
      rightShoulder: rightShoulderEquipmentRoot,
      leftElbow: leftElbowEquipmentRoot,
      rightElbow: rightElbowEquipmentRoot,
      leftHand: backViewLeftHandEquipmentRoot,
      rightHand: backViewRightHandEquipmentRoot,
      leftHip: leftHipEquipmentRoot,
      rightHip: rightHipEquipmentRoot,
      leftKnee: leftKneeEquipmentRoot,
      rightKnee: rightKneeEquipmentRoot,
    },
    baseHeight: 1.9,
  };
}

export function applyHumanoidWalkAnimation(joints, walkCycle, gaitStrength = 1) {
  if (joints.torso) {
    joints.torso.position.y = joints.torso.userData.baseY ?? 0;
  }
  if (joints.leftShoulder) {
    joints.leftShoulder.position.y = joints.leftShoulder.userData.baseY ?? joints.leftShoulder.position.y;
  }
  if (joints.rightShoulder) {
    joints.rightShoulder.position.y = joints.rightShoulder.userData.baseY ?? joints.rightShoulder.position.y;
  }

  const leftStride = Math.sin(walkCycle) * gaitStrength;
  const rightStride = Math.sin(walkCycle + Math.PI) * gaitStrength;

  const leftHipRot = leftStride * 0.42;
  const rightHipRot = rightStride * 0.42;
  joints.leftHip.rotation.x = leftHipRot;
  joints.rightHip.rotation.x = rightHipRot;

  joints.leftKnee.rotation.x = 0.12 + Math.max(0, leftStride) * 0.72;
  joints.rightKnee.rotation.x = 0.12 + Math.max(0, rightStride) * 0.72;

  const leftShoulderRot = -leftHipRot * 0.65;
  const rightShoulderRot = -rightHipRot * 0.65;
  joints.leftShoulder.rotation.x = leftShoulderRot;
  joints.rightShoulder.rotation.x = rightShoulderRot;

  // Smooth elbow bend cycle, avoiding abrupt max() transitions.
  const leftElbowPhase = 0.5 + 0.5 * Math.sin(walkCycle + Math.PI * 0.5);
  const rightElbowPhase = 0.5 + 0.5 * Math.sin(walkCycle + Math.PI * 1.5);
  joints.leftElbow.rotation.x = -(0.14 + leftElbowPhase * 0.18);
  joints.rightElbow.rotation.x = -(0.14 + rightElbowPhase * 0.18);
}

export function applyHumanoidIdleAnimation(joints, idleCycle, breathStrength = 1) {
  const s = THREE.MathUtils.clamp(breathStrength, 0, 1.5);
  const inhale = Math.sin(idleCycle) * s;
  const torsoLift = inhale * 0.025;
  const shoulderLift = inhale * 0.012;

  if (joints.torso) {
    const baseY = joints.torso.userData.baseY ?? 0;
    joints.torso.position.y = baseY + torsoLift;
  }

  const leftShoulderBaseY = joints.leftShoulder.userData.baseY ?? joints.leftShoulder.position.y;
  const rightShoulderBaseY = joints.rightShoulder.userData.baseY ?? joints.rightShoulder.position.y;
  joints.leftShoulder.position.y = leftShoulderBaseY + shoulderLift;
  joints.rightShoulder.position.y = rightShoulderBaseY + shoulderLift;

  joints.leftShoulder.rotation.x = -0.06 + inhale * 0.05;
  joints.rightShoulder.rotation.x = -0.06 + inhale * 0.05;
  joints.leftElbow.rotation.x = -0.22 + inhale * 0.03;
  joints.rightElbow.rotation.x = -0.22 + inhale * 0.03;

  joints.leftHip.rotation.x = 0.04 - inhale * 0.025;
  joints.rightHip.rotation.x = 0.04 - inhale * 0.025;
  joints.leftKnee.rotation.x = 0.1 + inhale * 0.02;
  joints.rightKnee.rotation.x = 0.1 + inhale * 0.02;
}

function applyHumanoidPunchAnimation(joints, side, punchStrength = 0, lookPitch = 0) {
  if (!joints) return;
  const shoulder = side === 'left' ? joints.leftShoulder : joints.rightShoulder;
  if (!shoulder) return;

  const p = THREE.MathUtils.clamp(punchStrength, 0, 1);
  // Fixed vertical swing from shoulder: always 90deg forward, independent of camera direction.
  const baseRotX = shoulder.rotation.x;
  const targetRotX = baseRotX - Math.PI * 0.5;
  shoulder.rotation.x = THREE.MathUtils.lerp(baseRotX, targetRotX, p);
}

export function applyHumanoidRightPunchAnimation(joints, punchStrength = 0, lookPitch = 0) {
  applyHumanoidPunchAnimation(joints, 'right', punchStrength, lookPitch);
}

export function applyHumanoidLeftPunchAnimation(joints, punchStrength = 0, lookPitch = 0) {
  applyHumanoidPunchAnimation(joints, 'left', punchStrength, lookPitch);
}
