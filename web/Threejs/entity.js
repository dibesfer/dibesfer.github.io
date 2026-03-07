import * as THREE from 'three';
import { createHumanoidModel, applyHumanoidIdleAnimation, applyHumanoidWalkAnimation } from './entityModel.js';

const ENTITY_NAME_PARTS_A = ['Neo', 'Rex', 'Kira', 'Nova', 'Axel', 'Iris', 'Vex', 'Luna', 'Zed', 'Milo'];
const ENTITY_NAME_PARTS_B = ['Stone', 'Blade', 'Runner', 'Flux', 'Byte', 'Echo', 'Volt', 'Shade', 'Forge', 'Drift'];

function randomEntityName() {
  const a = ENTITY_NAME_PARTS_A[Math.floor(Math.random() * ENTITY_NAME_PARTS_A.length)];
  const b = ENTITY_NAME_PARTS_B[Math.floor(Math.random() * ENTITY_NAME_PARTS_B.length)];
  return `${a} ${b}`;
}

function createEntityLabelSprite(name, type) {
  const canvas = document.createElement('canvas');
  canvas.width = 272;
  canvas.height = 92;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(28, 20, 216, 52);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(name, canvas.width * 0.5, 40);

  ctx.fillStyle = '#d0d0d0';
  ctx.font = '14px Arial';
  ctx.fillText(type, canvas.width * 0.5, 62);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.62, 0.53, 1);
  return sprite;
}

function createDialogSprite(lines) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.fillRect(16, 16, canvas.width - 32, canvas.height - 32);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const normalizedLines = (Array.isArray(lines) ? lines : [String(lines)]).slice(0, 3);
  const lineY = [92, 136, 180];
  const fonts = ['bold 36px Arial', '30px Arial', '30px Arial'];
  for (let i = 0; i < normalizedLines.length; i++) {
    ctx.font = fonts[i];
    ctx.fillText(normalizedLines[i], canvas.width * 0.5, lineY[i]);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.1, 1.3, 1);
  return sprite;
}

function createHealthBarSprite(healthRatio = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 136;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  );
  sprite.scale.set(1.3, 0.23, 1);
  sprite.userData.healthCanvas = canvas;
  sprite.userData.healthCtx = ctx;
  sprite.userData.healthTexture = texture;
  drawHealthBarSprite(sprite, healthRatio);
  return sprite;
}

function drawHealthBarSprite(sprite, healthRatio) {
  const canvas = sprite.userData.healthCanvas;
  const ctx = sprite.userData.healthCtx;
  const texture = sprite.userData.healthTexture;
  if (!canvas || !ctx || !texture) return;

  const w = canvas.width;
  const h = canvas.height;
  const padding = 6;
  const barW = w - padding * 2;
  const barH = 9;
  const barX = padding;
  const barY = Math.floor((h - barH) * 0.5);

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);

  ctx.fillStyle = 'rgba(40, 40, 40, 0.95)';
  ctx.fillRect(barX, barY, barW, barH);

  const clampedRatio = THREE.MathUtils.clamp(healthRatio, 0, 1);
  const fillW = Math.floor(barW * clampedRatio);
  ctx.fillStyle = '#25d14a';
  ctx.fillRect(barX, barY, fillW, barH);

  texture.needsUpdate = true;
}

export class Entity {
  constructor({
    scene,
    position,
    groundY = 0,
    color = 0xff9a9a,
    outfit = null,
    name = randomEntityName(),
    typeLabel = 'Walker',
    dialogLines = null,
    speed = 2.2,
    clearance = 1.0,
    miniMapType = 'walker',
    maxHealth = 100,
  }) {
    this.scene = scene;
    this.position = position.clone();
    this.groundY = groundY;
    this.speed = speed;
    this.clearance = clearance;
    this.name = name;
    this.typeLabel = typeLabel;
    this.dialogLines = dialogLines;
    this.miniMapType = miniMapType;
    this.maxHealth = Math.max(1, maxHealth);
    this.health = this.maxHealth;

    this.bodyWidth = 0.8;
    this.bodyDepth = 0.55;
    this.bodyHeight = 1.8;
    this.modelBaseHeight = 1.9;
    this.visualLift = 0.03;

    this.collider = new THREE.Box3();
    this.group = new THREE.Group();
    this.group.scale.set(1, this.bodyHeight / this.modelBaseHeight, 1);
    this.group.position.set(this.position.x, this.groundY + this.visualLift, this.position.z);

    const resolvedOutfit = outfit ?? {
      skin: 0xf0c9a5,
      shirt: color,
      sleeves: color,
      pants: 0x4b4f64,
      shoes: 0x1d1d1d,
      hair: 0x2a1d16,
    };

    const humanoid = createHumanoidModel({
      outfit: resolvedOutfit,
      castShadow: true,
      receiveShadow: false,
    });
    this.group.add(humanoid.root);
    this.joints = humanoid.joints;
    this.modelBaseHeight = humanoid.baseHeight;
    this.group.scale.set(1, this.bodyHeight / this.modelBaseHeight, 1);
    this.labelSprite = createEntityLabelSprite(this.name, this.typeLabel);
    this.labelSprite.position.set(0, this.bodyHeight + 0.5, 0);
    this.group.add(this.labelSprite);
    this.healthBarSprite = createHealthBarSprite(1);
    this.healthBarSprite.position.set(0, this.bodyHeight + 0.82, 0);
    this.group.add(this.healthBarSprite);
    if (this.dialogLines && this.dialogLines.length > 0) {
      this.dialogSprite = createDialogSprite(this.dialogLines);
      this.dialogSprite.position.set(0, this.bodyHeight + 1.85, 0);
      this.group.add(this.dialogSprite);
    }
    this.scene.add(this.group);

    this.direction = new THREE.Vector3(1, 0, 0);
    this.turnTimer = 0;
    this.walkCycle = Math.random() * Math.PI * 2;
    this.idleCycle = Math.random() * Math.PI * 2;
    this._testBox = new THREE.Box3();
    this._nextPos = new THREE.Vector3();
    this._toPlayer = new THREE.Vector3();

    this.pickRandomDirection();
    this.updateCollider();
  }

  applyDamage(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    drawHealthBarSprite(this.healthBarSprite, this.health / this.maxHealth);
    return this.health <= 0;
  }

  pickRandomDirection() {
    const angle = Math.random() * Math.PI * 2;
    this.direction.set(Math.cos(angle), 0, Math.sin(angle));
    this.turnTimer = 1.2 + Math.random() * 2.8;
  }

  updateCollider() {
    const halfW = this.bodyWidth * 0.5;
    const halfD = this.bodyDepth * 0.5;
    this.collider.min.set(
      this.position.x - halfW,
      this.groundY,
      this.position.z - halfD
    );
    this.collider.max.set(
      this.position.x + halfW,
      this.groundY + this.bodyHeight,
      this.position.z + halfD
    );
  }

  willHitObstacleAt(nextPos, colliders) {
    const halfW = this.bodyWidth * 0.5;
    const halfD = this.bodyDepth * 0.5;
    this._testBox.min.set(
      nextPos.x - halfW,
      this.groundY,
      nextPos.z - halfD
    );
    this._testBox.max.set(
      nextPos.x + halfW,
      this.groundY + this.bodyHeight,
      nextPos.z + halfD
    );

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (
        this._testBox.max.x < c.min.x - this.clearance ||
        this._testBox.min.x > c.max.x + this.clearance ||
        this._testBox.max.y < c.min.y ||
        this._testBox.min.y > c.max.y ||
        this._testBox.max.z < c.min.z - this.clearance ||
        this._testBox.min.z > c.max.z + this.clearance
      ) {
        continue;
      }
      return true;
    }

    return false;
  }

  tryFindOpenDirection(colliders, deltaTime) {
    const stepDistance = this.speed * deltaTime;
    for (let i = 0; i < 10; i++) {
      this.pickRandomDirection();
      this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);
      if (!this.willHitObstacleAt(this._nextPos, colliders)) {
        return true;
      }
    }
    return false;
  }

  updateAnimation(deltaTime, isMoving) {
    if (isMoving) {
      this.walkCycle += deltaTime * 8;
      applyHumanoidWalkAnimation(this.joints, this.walkCycle, 1);
      return;
    }

    this.idleCycle += deltaTime * 2.2;
    applyHumanoidIdleAnimation(this.joints, this.idleCycle, 1);
  }

  update(deltaTime, colliders) {
    this.turnTimer -= deltaTime;
    if (this.turnTimer <= 0) {
      this.pickRandomDirection();
    }

    const stepDistance = this.speed * deltaTime;
    this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);

    if (this.willHitObstacleAt(this._nextPos, colliders)) {
      if (!this.tryFindOpenDirection(colliders, deltaTime)) {
        return;
      }
      this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);
    }

    this.position.copy(this._nextPos);
    this.group.position.set(this.position.x, this.groundY + this.visualLift, this.position.z);
    this.group.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.updateCollider();

    this.updateAnimation(deltaTime, true);
  }
}

export class HunterEntity extends Entity {
  constructor(options = {}) {
    super({
      ...options,
      color: options.color ?? 0x7e1313,
      typeLabel: options.typeLabel ?? 'Chaser',
      outfit: options.outfit ?? {
        skin: 0xd5a788,
        shirt: 0x6c1111,
        sleeves: 0x4f0f0f,
        pants: 0x2d0c0c,
        shoes: 0x120707,
        hair: 0x120707,
        faceEmoji: '😠',
      },
      speed: options.speed ?? 2.5,
      miniMapType: 'chaser',
    });
    this.detectionRadius = options.detectionRadius ?? 5.0;
    this.stopDistance = options.stopDistance ?? 1.5;
    this.disengageDistance = options.disengageDistance ?? 10.0;
    this.isAggro = false;
  }

  update(deltaTime, colliders, playerPosition) {
    this.turnTimer -= deltaTime;

    let chasing = false;
    let shouldMove = true;
    if (playerPosition) {
      this._toPlayer.set(
        playerPosition.x - this.position.x,
        0,
        playerPosition.z - this.position.z
      );
      const distanceSq = this._toPlayer.lengthSq();
      const detectSq = this.detectionRadius * this.detectionRadius;
      const disengageSq = this.disengageDistance * this.disengageDistance;
      const stopSq = this.stopDistance * this.stopDistance;

      if (!this.isAggro && distanceSq <= detectSq) {
        this.isAggro = true;
      } else if (this.isAggro && distanceSq > disengageSq) {
        this.isAggro = false;
      }

      if (this.isAggro && distanceSq > 0.0001) {
        this._toPlayer.normalize();
        this.direction.copy(this._toPlayer);
        chasing = true;
        shouldMove = distanceSq > stopSq;
      }
    }

    if (!chasing && this.turnTimer <= 0) {
      this.pickRandomDirection();
    } else if (chasing) {
      this.turnTimer = 0.2;
    }

    if (shouldMove) {
      const stepDistance = this.speed * deltaTime;
      this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);

      if (this.willHitObstacleAt(this._nextPos, colliders)) {
        if (!this.tryFindOpenDirection(colliders, deltaTime)) {
          this.updateAnimation(deltaTime, false);
          return;
        }
        this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);
      }

      this.position.copy(this._nextPos);
    }
    this.group.position.set(this.position.x, this.groundY + this.visualLift, this.position.z);
    this.group.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.updateCollider();

    this.updateAnimation(deltaTime, shouldMove);
  }
}

export class TalkerEntity extends Entity {
  constructor(options = {}) {
    super({
      ...options,
      name: options.name ?? 'Talker',
      typeLabel: options.typeLabel ?? 'Talker',
      dialogLines: options.dialogLines ?? ['Hola viajero', 'Pulsa click para disparar', 'Mira el minimapa'],
      speed: 0,
      outfit: options.outfit ?? {
        skin: 0xe4c3a2,
        shirt: 0x4f6fd1,
        sleeves: 0x4f6fd1,
        pants: 0x3d4f77,
        shoes: 0x1a1a1a,
        hair: 0x2a1b10,
        faceEmoji: '🗣️',
      },
      miniMapType: 'talker',
    });
  }

  update(deltaTime, colliders, playerPosition) {
    if (playerPosition) {
      this._toPlayer.set(
        playerPosition.x - this.position.x,
        0,
        playerPosition.z - this.position.z
      );
      if (this._toPlayer.lengthSq() > 0.0001) {
        this._toPlayer.normalize();
        this.direction.copy(this._toPlayer);
      }
    }

    this.group.position.set(this.position.x, this.groundY + this.visualLift, this.position.z);
    this.group.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.updateCollider();
    this.updateAnimation(deltaTime, false);
  }
}
