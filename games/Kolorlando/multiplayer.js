import * as THREE from 'three';
import {
  createHumanoidModel,
  applyHumanoidIdleAnimation,
  applyHumanoidWalkAnimation,
} from './entityModel.js';

const PRESENCE_CHANNEL_NAME = 'kolorlando-world';
const LOCAL_PLAYER_ID_STORAGE_KEY = 'kolorlando.multiplayer.localPlayerId';
const LOCAL_PRESENCE_PUSH_INTERVAL = 0.1;
const REMOTE_POSITION_LERP_SPEED = 10;
const REMOTE_ROTATION_LERP_SPEED = 12;
const REMOTE_MOVE_DISTANCE_THRESHOLD = 0.0004;
const REMOTE_PLAYER_HEIGHT = 1.8;

function roundPresenceNumber(value, digits = 3) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  const factor = 10 ** digits;
  return Math.round(numericValue * factor) / factor;
}

function readFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeAngleRadians(value) {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function countPresenceSessions(state) {
  return Object.values(state).reduce((total, sessions) => {
    if (!Array.isArray(sessions)) return total;
    return total + sessions.length;
  }, 0);
}

function generateId(prefix) {
  /* Some browsers or local test contexts may not expose randomUUID(). This
  fallback keeps multiplayer bootable instead of failing before Presence starts. */
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

function getOrCreateLocalPlayerId() {
  const existingPlayerId = window.localStorage.getItem(LOCAL_PLAYER_ID_STORAGE_KEY);
  if (existingPlayerId) return existingPlayerId;

  const generatedPlayerId = generateId('player');
  window.localStorage.setItem(LOCAL_PLAYER_ID_STORAGE_KEY, generatedPlayerId);
  return generatedPlayerId;
}

function buildRemoteOutfit() {
  return {
    skin: 0xf0c9a5,
    shirt: 0x4f86f7,
    sleeves: 0x4f86f7,
    pants: 0x2d3a50,
    shoes: 0x161616,
    hair: 0x221710,
    faceEmoji: '🙂',
  };
}

function createRemoteAvatar(playerId) {
  const root = new THREE.Group();
  const humanoid = createHumanoidModel({
    outfit: buildRemoteOutfit(),
    castShadow: true,
    receiveShadow: false,
  });

  root.add(humanoid.root);
  root.scale.setScalar(REMOTE_PLAYER_HEIGHT / humanoid.baseHeight);

  /* A bright floating beacon makes remote players much easier to spot during
  early multiplayer testing, especially when two sessions begin at the exact
  same spawn point or when the camera is still in a tight first-person view. */
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x3ddcff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    })
  );
  beacon.position.set(0, 3.2, 0);
  beacon.renderOrder = 3000;
  root.add(beacon);

  /* A tall always-on-top pillar gives us a guaranteed visual anchor for each
  remote player even if the humanoid rig is hidden by world geometry, spawn
  overlap, or an unexpected animation/scale issue. */
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3.2, 10),
    new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
      depthWrite: false,
    })
  );
  pillar.position.set(0, 1.6, 0);
  pillar.renderOrder = 2999;
  root.add(pillar);

  /* The ring gives each remote avatar a second clear silhouette cue at ground
  level, which helps when the body overlaps props or stands at the same spawn
  point as the local player. */
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.52, 24),
    new THREE.MeshBasicMaterial({
      color: 0x3ddcff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.03;
  groundRing.renderOrder = 2998;
  root.add(groundRing);

  /* Remote avatars are display-only. Disabling raycast participation now keeps
  future gameplay interactions focused on the local world until multiplayer
  rules for combat, chat, and targeting are designed deliberately. */
  root.traverse(part => {
    if (part.isObject3D) {
      part.userData.isRemotePlayer = true;
      part.raycast = () => null;
    }
  });

  return {
    root,
    humanoid,
    walkCycle: Math.random() * Math.PI * 2,
    idleCycle: Math.random() * Math.PI * 2,
    targetPosition: new THREE.Vector3(),
    currentPosition: new THREE.Vector3(),
    targetRotationY: 0,
    initialized: false,
    isMoving: false,
  };
}

function snapshotPresencePayload(state, localPlayerId) {
  return {
    playerId: localPlayerId,
    sessionId: state.sessionId,
    x: roundPresenceNumber(state.x),
    y: roundPresenceNumber(state.y),
    z: roundPresenceNumber(state.z),
    rotationY: roundPresenceNumber(state.rotationY),
    isMoving: Boolean(state.isMoving),
    online_at: new Date().toISOString(),
  };
}

function arePresencePayloadsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.playerId === b.playerId
    && a.sessionId === b.sessionId
    && a.x === b.x
    && a.y === b.y
    && a.z === b.z
    && a.rotationY === b.rotationY
    && a.isMoving === b.isMoving
  );
}

export function createMultiplayerController({
  scene,
  getLocalPlayerState,
  peopleOnlineCountElement = document.getElementById('peopleOnlineCount'),
  peopleOnlineHudElement = document.getElementById('peopleOnlineHud'),
  peopleOnlineToggleElement = document.getElementById('peopleOnlineToggle'),
  peopleOnlineListElement = document.getElementById('peopleOnlineList'),
} = {}) {
  const localPlayerId = getOrCreateLocalPlayerId();
  /* This id intentionally lives only in memory for the lifetime of this page.
  Some browsers copy sessionStorage when duplicating a tab, which can make two
  different tabs look like the same Presence session and hide remote players. */
  const localSessionId = generateId('session');
  const remotePlayers = new Map();
  let channel = null;
  let isSubscribed = false;
  let publishAccumulator = 0;
  let lastPublishedPresence = null;

  /* The small dropdown is a debugging aid so we can inspect the raw Presence
  player/session data without opening devtools every time a sync arrives. */
  if (peopleOnlineHudElement && peopleOnlineToggleElement) {
    peopleOnlineHudElement.addEventListener('click', () => {
      const nextIsOpen = !peopleOnlineHudElement.classList.contains('is-open');
      peopleOnlineHudElement.classList.toggle('is-open', nextIsOpen);
      peopleOnlineToggleElement.setAttribute('aria-expanded', String(nextIsOpen));
    });
  }

  function setPeopleOnlineCount(totalSessions) {
    if (!peopleOnlineCountElement) return;
    peopleOnlineCountElement.textContent = String(totalSessions);
  }

  function formatPresenceDebugValue(value) {
    return readFiniteNumber(value).toFixed(2);
  }

  function renderPeopleOnlineList(state) {
    if (!peopleOnlineListElement) return;

    const rows = [];
    Object.entries(state).forEach(([, sessions]) => {
      if (!Array.isArray(sessions)) return;

      sessions.forEach(payload => {
        if (!payload?.sessionId) return;
        rows.push({
          id: String(payload.sessionId),
          onlineAt: Date.parse(payload.online_at ?? '') || 0,
          x: formatPresenceDebugValue(payload.x),
          y: formatPresenceDebugValue(payload.y),
          z: formatPresenceDebugValue(payload.z),
        });
      });
    });

    rows.sort((left, right) => {
      if (left.onlineAt !== right.onlineAt) {
        return left.onlineAt - right.onlineAt;
      }

      return left.id.localeCompare(right.id);
    });

    if (rows.length === 0) {
      peopleOnlineListElement.textContent = 'No players yet.';
      return;
    }

    peopleOnlineListElement.innerHTML = rows
      .map((row, index) => `<div>${index + 1} | X ${row.x} Y ${row.y} Z ${row.z}</div>`)
      .join('');
  }

  function removeRemotePlayer(sessionId) {
    const remotePlayer = remotePlayers.get(sessionId);
    if (!remotePlayer) return;
    if (remotePlayer.root.parent) {
      remotePlayer.root.parent.remove(remotePlayer.root);
    }
    remotePlayers.delete(sessionId);
  }

  function getOrCreateRemotePlayer(sessionId) {
    const existingRemotePlayer = remotePlayers.get(sessionId);
    if (existingRemotePlayer) return existingRemotePlayer;

    const remotePlayer = createRemoteAvatar(sessionId);
    scene.add(remotePlayer.root);
    remotePlayers.set(sessionId, remotePlayer);
    return remotePlayer;
  }

  function applyRemotePresence(sessionId, payload) {
    const remotePlayer = getOrCreateRemotePlayer(sessionId);

    remotePlayer.targetPosition.set(
      readFiniteNumber(payload.x),
      readFiniteNumber(payload.y),
      readFiniteNumber(payload.z)
    );
    remotePlayer.targetRotationY = readFiniteNumber(payload.rotationY, remotePlayer.targetRotationY);
    remotePlayer.isMoving = Boolean(payload.isMoving);

    /* The first payload should place the avatar immediately in the right spot
    so newly joined players do not slide in from world origin on their first
    visible frame. */
    if (!remotePlayer.initialized) {
      remotePlayer.currentPosition.copy(remotePlayer.targetPosition);
      remotePlayer.root.position.copy(remotePlayer.targetPosition);
      remotePlayer.root.rotation.y = remotePlayer.targetRotationY;
      remotePlayer.initialized = true;
    }
  }

  function syncRemotePlayersFromState(state) {
    const seenRemoteSessionIds = new Set();

    Object.entries(state).forEach(([, sessions]) => {
      if (!Array.isArray(sessions) || sessions.length === 0) return;

      const latestPayload = sessions[sessions.length - 1];
      if (!latestPayload || !latestPayload.sessionId) return;
      if (latestPayload.sessionId === localSessionId) return;

      seenRemoteSessionIds.add(latestPayload.sessionId);
      applyRemotePresence(latestPayload.sessionId, latestPayload);
    });

    Array.from(remotePlayers.keys()).forEach(sessionId => {
      if (!seenRemoteSessionIds.has(sessionId)) {
        removeRemotePlayer(sessionId);
      }
    });
  }

  function handlePresenceSync(state) {
    setPeopleOnlineCount(countPresenceSessions(state));
    renderPeopleOnlineList(state);
    syncRemotePlayersFromState(state);
  }

  async function publishLocalPresence(force = false) {
    if (!isSubscribed || !channel || typeof getLocalPlayerState !== 'function') return;

    const localPlayerState = getLocalPlayerState();
    if (!localPlayerState) return;

    const nextPresencePayload = snapshotPresencePayload({
      ...localPlayerState,
      sessionId: localSessionId,
    }, localPlayerId);
    if (!force && arePresencePayloadsEqual(lastPublishedPresence, nextPresencePayload)) return;

    lastPublishedPresence = nextPresencePayload;
    await channel.track(nextPresencePayload);
  }

  function connect() {
    const database = window.database;
    if (channel || !database?.channel) return;

    channel = database.channel(PRESENCE_CHANNEL_NAME);

    channel
      .on('presence', { event: 'sync' }, () => {
        handlePresenceSync(channel.presenceState());
      })
      .subscribe(async status => {
        if (status !== 'SUBSCRIBED') return;
        isSubscribed = true;
        await publishLocalPresence(true);
      });
  }

  function updateRemotePlayers(deltaTime) {
    remotePlayers.forEach(remotePlayer => {
      if (!remotePlayer.initialized) return;

      const lerpAlpha = Math.min(1, deltaTime * REMOTE_POSITION_LERP_SPEED);
      remotePlayer.currentPosition.lerp(remotePlayer.targetPosition, lerpAlpha);
      remotePlayer.root.position.copy(remotePlayer.currentPosition);

      const rotationDelta = normalizeAngleRadians(remotePlayer.targetRotationY - remotePlayer.root.rotation.y);
      const maxRotationStep = deltaTime * REMOTE_ROTATION_LERP_SPEED;
      const clampedRotationStep = Math.max(-maxRotationStep, Math.min(maxRotationStep, rotationDelta));
      remotePlayer.root.rotation.y += clampedRotationStep;

      const distanceToTarget = remotePlayer.currentPosition.distanceToSquared(remotePlayer.targetPosition);
      const shouldAnimateWalking = remotePlayer.isMoving || distanceToTarget > REMOTE_MOVE_DISTANCE_THRESHOLD;

      if (shouldAnimateWalking) {
        remotePlayer.walkCycle += deltaTime * 10;
        applyHumanoidWalkAnimation(remotePlayer.humanoid.joints, remotePlayer.walkCycle, 1);
        return;
      }

      remotePlayer.idleCycle += deltaTime * 2.2;
      applyHumanoidIdleAnimation(remotePlayer.humanoid.joints, remotePlayer.idleCycle, 1);
    });
  }

  function update(deltaTime) {
    connect();
    updateRemotePlayers(deltaTime);

    publishAccumulator += deltaTime;
    if (publishAccumulator < LOCAL_PRESENCE_PUSH_INTERVAL) return;

    publishAccumulator = 0;
    publishLocalPresence().catch(error => {
      console.error('Failed to publish multiplayer presence.', error);
    });
  }

  return {
    update,
    localPlayerId,
    localSessionId,
  };
}
