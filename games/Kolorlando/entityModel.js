import * as THREE from 'three';

const MODEL_PART_SCALE = 0.9;
const LIMB_PART_GAP = 0.04;

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
  const torso = new THREE.Group();
  root.add(torso);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.28), shirtMat);
  belly.position.set(0, 0.91, 0);
  setShadow(belly, castShadow, receiveShadow);
  torso.add(belly);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.3), shirtMat);
  chest.position.set(0, 1.27, 0);
  setShadow(chest, castShadow, receiveShadow);
  torso.add(chest);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
  head.position.set(0, 1.68, 0);
  setShadow(head, castShadow, receiveShadow);
  torso.add(head);

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
  leftShoulder.position.set(-0.36, 1.48, 0);
  torso.add(leftShoulder);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.36, 1.48, 0);
  torso.add(rightShoulder);

  const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.33, 0.18), sleeveMat);
  leftUpperArm.position.set(0, -0.165, 0);
  setShadow(leftUpperArm, castShadow, receiveShadow);
  leftShoulder.add(leftUpperArm);

  const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.33, 0.18), sleeveMat);
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

  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.17), skinMat);
  leftHand.name = 'leftHand';
  leftHand.position.set(0, -0.41, 0.015);
  setShadow(leftHand, castShadow, receiveShadow);
  leftElbow.add(leftHand);

  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.17), skinMat);
  rightHand.name = 'rightHand';
  rightHand.position.set(0, -0.41, 0.015);
  setShadow(rightHand, castShadow, receiveShadow);
  rightElbow.add(rightHand);

  const leftHip = new THREE.Group();
  leftHip.position.set(-0.12, 0.82, 0);
  root.add(leftHip);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.12, 0.82, 0);
  root.add(rightHip);

  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), pantsMat);
  leftThigh.position.set(0, -0.17, 0);
  setShadow(leftThigh, castShadow, receiveShadow);
  leftHip.add(leftThigh);

  const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), pantsMat);
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
  leftShin.position.set(0, -0.14, 0);
  setShadow(leftShin, castShadow, receiveShadow);
  leftKnee.add(leftShin);

  const rightShin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), pantsMat);
  rightShin.position.set(0, -0.14, 0);
  setShadow(rightShin, castShadow, receiveShadow);
  rightKnee.add(rightShin);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.29), shoesMat);
  leftShoe.position.set(0, -0.38, 0.06);
  setShadow(leftShoe, castShadow, receiveShadow);
  leftKnee.add(leftShoe);

  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.29), shoesMat);
  rightShoe.position.set(0, -0.38, 0.06);
  setShadow(rightShoe, castShadow, receiveShadow);
  rightKnee.add(rightShoe);

  root.traverse(part => {
    if (part.isMesh) {
      part.scale.multiplyScalar(MODEL_PART_SCALE);
    }
  });

  torso.userData.baseY = torso.position.y;
  leftShoulder.userData.baseY = leftShoulder.position.y;
  rightShoulder.userData.baseY = rightShoulder.position.y;

  return {
    root,
    joints: {
      torso,
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
