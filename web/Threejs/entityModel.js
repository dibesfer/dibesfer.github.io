import * as THREE from 'three';

function createPartMaterial(color, roughness, metalness) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function setShadow(mesh, castShadow, receiveShadow) {
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
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
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.39), material);
  plane.renderOrder = 2;
  return plane;
}

export function createHumanoidModel({
  outfit = {},
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const resolvedOutfit = {
    skin: outfit.skin ?? 0xf0c9a5,
    shirt: outfit.shirt ?? 0x7aa8ff,
    sleeves: outfit.sleeves ?? outfit.shirt ?? 0x7aa8ff,
    pants: outfit.pants ?? 0x3d4b64,
    shoes: outfit.shoes ?? 0x1d1d1d,
    hair: outfit.hair ?? 0x2a1d16,
    faceEmoji: outfit.faceEmoji ?? '🙂',
  };

  const skinMat = createPartMaterial(resolvedOutfit.skin, 0.85, 0.03);
  const shirtMat = createPartMaterial(resolvedOutfit.shirt, 0.82, 0.05);
  const sleeveMat = createPartMaterial(resolvedOutfit.sleeves, 0.82, 0.05);
  const pantsMat = createPartMaterial(resolvedOutfit.pants, 0.86, 0.04);
  const shoesMat = createPartMaterial(resolvedOutfit.shoes, 0.92, 0.02);
  const hairMat = createPartMaterial(resolvedOutfit.hair, 0.88, 0.02);

  const root = new THREE.Group();

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.3), shirtMat);
  belly.position.set(0, 0.9, 0);
  setShadow(belly, castShadow, receiveShadow);
  root.add(belly);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.32), shirtMat);
  chest.position.set(0, 1.27, 0);
  setShadow(chest, castShadow, receiveShadow);
  root.add(chest);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
  head.position.set(0, 1.68, 0);
  setShadow(head, castShadow, receiveShadow);
  root.add(head);

  const faceEmoji = createEmojiFace(resolvedOutfit.faceEmoji);
  if (faceEmoji) {
    faceEmoji.position.set(0, 0.01, 0.212);
    head.add(faceEmoji);
  }

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), hairMat);
  hairTop.position.set(0, 0.2, 0);
  setShadow(hairTop, castShadow, receiveShadow);
  head.add(hairTop);

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.16), hairMat);
  hairBack.position.set(0, 0.04, -0.16);
  setShadow(hairBack, castShadow, receiveShadow);
  head.add(hairBack);

  const hairLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.24), hairMat);
  hairLeft.position.set(-0.23, 0.06, 0);
  setShadow(hairLeft, castShadow, receiveShadow);
  head.add(hairLeft);

  const hairRight = hairLeft.clone();
  hairRight.position.x = 0.23;
  head.add(hairRight);

  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.38, 1.38, 0);
  root.add(leftShoulder);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.38, 1.38, 0);
  root.add(rightShoulder);

  const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.2), sleeveMat);
  leftUpperArm.position.set(0, -0.18, 0);
  setShadow(leftUpperArm, castShadow, receiveShadow);
  leftShoulder.add(leftUpperArm);

  const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.2), sleeveMat);
  rightUpperArm.position.set(0, -0.18, 0);
  setShadow(rightUpperArm, castShadow, receiveShadow);
  rightShoulder.add(rightUpperArm);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.36, 0);
  leftShoulder.add(leftElbow);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.36, 0);
  rightShoulder.add(rightElbow);

  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.18), sleeveMat);
  leftForearm.position.set(0, -0.16, 0);
  setShadow(leftForearm, castShadow, receiveShadow);
  leftElbow.add(leftForearm);

  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.18), sleeveMat);
  rightForearm.position.set(0, -0.16, 0);
  setShadow(rightForearm, castShadow, receiveShadow);
  rightElbow.add(rightForearm);

  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.2), skinMat);
  leftHand.position.set(0, -0.34, 0.01);
  setShadow(leftHand, castShadow, receiveShadow);
  leftElbow.add(leftHand);

  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.2), skinMat);
  rightHand.position.set(0, -0.34, 0.01);
  setShadow(rightHand, castShadow, receiveShadow);
  rightElbow.add(rightHand);

  const leftHip = new THREE.Group();
  leftHip.position.set(-0.17, 0.82, 0);
  root.add(leftHip);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.17, 0.82, 0);
  root.add(rightHip);

  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 0.24), pantsMat);
  leftThigh.position.set(0, -0.22, 0);
  setShadow(leftThigh, castShadow, receiveShadow);
  leftHip.add(leftThigh);

  const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 0.24), pantsMat);
  rightThigh.position.set(0, -0.22, 0);
  setShadow(rightThigh, castShadow, receiveShadow);
  rightHip.add(rightThigh);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.44, 0);
  leftHip.add(leftKnee);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.44, 0);
  rightHip.add(rightKnee);

  const leftShin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.22), pantsMat);
  leftShin.position.set(0, -0.18, 0);
  setShadow(leftShin, castShadow, receiveShadow);
  leftKnee.add(leftShin);

  const rightShin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.22), pantsMat);
  rightShin.position.set(0, -0.18, 0);
  setShadow(rightShin, castShadow, receiveShadow);
  rightKnee.add(rightShin);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.36), shoesMat);
  leftShoe.position.set(0, -0.32, 0.07);
  setShadow(leftShoe, castShadow, receiveShadow);
  leftKnee.add(leftShoe);

  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.36), shoesMat);
  rightShoe.position.set(0, -0.32, 0.07);
  setShadow(rightShoe, castShadow, receiveShadow);
  rightKnee.add(rightShoe);

  return {
    root,
    joints: {
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
    },
    baseHeight: 1.9,
  };
}

export function applyHumanoidWalkAnimation(joints, walkCycle, gaitStrength = 1) {
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
