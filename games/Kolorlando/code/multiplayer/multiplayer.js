import * as THREE from 'three';
import {
  createHumanoidModel,
  applyHumanoidIdleAnimation,
  applyHumanoidWalkAnimation,
  createPlayerNameSprite,
  updatePlayerNameSprite,
} from '../entities/entityModel.js';
import { createHealthBarSprite, drawHealthBarSprite } from '../entities/entity.js';
import {
  PLAYER_STATE_BROADCAST_EVENT,
  PLAYER_DAMAGE_ATTEMPT_EVENT,
  snapshotPlayerStatePayload,
  arePlayerStatePayloadsEqual,
  readPlayerStatePayload,
  createDamageAttemptPayload,
  readDamageAttemptPayload,
} from './multiplayerCombat.js';
import { normalizeSfcFaceData } from '../avatar/sfcFace.js';

const PRESENCE_CHANNEL_NAME = 'kolorlando-world';
const PLAYER_TRANSFORM_BROADCAST_EVENT = 'player:transform';
const LOCAL_PLAYER_NAME_STORAGE_KEY = 'kolorlando.playerName';
const LOCAL_BROADCAST_PUSH_INTERVAL = 0.1;
const LOCAL_STATE_PUSH_INTERVAL = 0.12;
const REMOTE_POSITION_LERP_SPEED = 10;
const REMOTE_ROTATION_LERP_SPEED = 12;
const REMOTE_MOVE_DISTANCE_THRESHOLD = 0.0004;
const REMOTE_PLAYER_HEIGHT = 1.8;
const REMOTE_PLAYER_MAX_HEALTH = 100;
const KOLORLANDO_DEBUG_MODE_EVENT = 'kolorlando:debug-mode-change';
const REMOTE_PLAYER_HALF_WIDTH = 0.36;
const REMOTE_PLAYER_HALF_DEPTH = 0.28;
const DAMAGE_ATTEMPT_MAX_AGE_MS = 1600;
const DAMAGE_ATTEMPT_VALIDATION_PADDING = 1.1;

function isDebugModeEnabled() {
  return window.kolorlandoDebugModeEnabled === true;
}

function roundNetworkNumber(value, digits = 3) {
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
  /* Keep the counter tied to the actual Presence keys so one connected session
  shows up exactly once in the HUD. */
  return Object.keys(state).length;
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

function escapeHtml(text) {
  /* Presence data can come from other clients, so escaping keeps the debug
  list safe even if a display name contains characters that look like HTML. */
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveRemoteDisplayName(payloadDisplayName = '') {
  /* Remote avatars should only trust the replicated payload; if another
  session has no published name yet, Anonymous is safer than leaking this
  browser's cached local username onto someone else's character. */
  const payloadName = typeof payloadDisplayName === 'string' ? payloadDisplayName.trim() : '';
  if (payloadName) return payloadName;

  return 'Anonymous';
}

function resolveLocalPresenceDisplayName() {
  /* The publishing client can enrich its own Presence payload from the cached
  auth name so other sessions receive a stable display string. */
  const storedName = window.localStorage.getItem(LOCAL_PLAYER_NAME_STORAGE_KEY);
  const trimmedStoredName = typeof storedName === 'string' ? storedName.trim() : '';
  return trimmedStoredName || 'Anonymous';
}

function normalizePresenceFaceData(faceData) {
  if (!faceData) return null;

  try {
    return normalizeSfcFaceData(faceData);
  } catch (error) {
    console.warn('Ignoring invalid remote SFC face data.', error);
    return null;
  }
}

function serializeFaceData(faceData) {
  return JSON.stringify(faceData ?? null);
}

function buildRemoteOutfit(faceData = null) {
  const normalizedFaceData = normalizePresenceFaceData(faceData);

  return {
    skin: 0xf0c9a5,
    shirt: 0x4f86f7,
    sleeves: 0x4f86f7,
    pants: 0x2d3a50,
    shoes: 0x161616,
    hair: 0x221710,
    faceEmoji: '🙂',
    faceData: normalizedFaceData,
  };
}

function createRemoteHumanoid(faceData) {
  return createHumanoidModel({
    outfit: buildRemoteOutfit(faceData),
    castShadow: true,
    receiveShadow: false,
  });
}

function markRemoteAvatarParts(root) {
  /* Remote avatars are display-only. Disabling raycast participation now keeps
  future gameplay interactions focused on the local world until multiplayer
  rules for combat, chat, and targeting are designed deliberately. */
  root.traverse(part => {
    if (part.isObject3D) {
      part.userData.isRemotePlayer = true;
      part.raycast = () => null;
    }
  });
}

function createRemoteAvatar(faceData = null) {
  const root = new THREE.Group();
  const normalizedFaceData = normalizePresenceFaceData(faceData);
  const humanoid = createRemoteHumanoid(normalizedFaceData);

  root.add(humanoid.root);
  root.scale.setScalar(REMOTE_PLAYER_HEIGHT / humanoid.baseHeight);

  const nameSprite = createPlayerNameSprite('Anonymous');
  if (nameSprite) {
    /* Remote labels follow the same head-relative anchor as the local player
    so both identities read from a single shared world-space system. */
    nameSprite.position.set(0, REMOTE_PLAYER_HEIGHT + 0.62, 0);
    root.add(nameSprite);
  }

  const healthBarSprite = createHealthBarSprite(1);
  if (healthBarSprite) {
    /* Remote players reuse the same head-space life bar language as enemies so
    combat readability stays consistent across the world. */
    healthBarSprite.position.set(0, REMOTE_PLAYER_HEIGHT + 0.94, 0);
    root.add(healthBarSprite);
  }

  const debugVisuals = new THREE.Group();
  debugVisuals.visible = isDebugModeEnabled();
  root.add(debugVisuals);

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
  debugVisuals.add(beacon);

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
  debugVisuals.add(pillar);

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
  debugVisuals.add(groundRing);

  markRemoteAvatarParts(root);

  return {
    root,
    humanoid,
    faceDataSignature: serializeFaceData(normalizedFaceData),
    nameSprite,
    healthBarSprite,
    debugVisuals,
    collider: new THREE.Box3(),
    displayName: 'Anonymous',
    walkCycle: Math.random() * Math.PI * 2,
    idleCycle: Math.random() * Math.PI * 2,
    targetPosition: new THREE.Vector3(),
    currentPosition: new THREE.Vector3(),
    targetRotationY: 0,
    initialized: false,
    isMoving: false,
    health: REMOTE_PLAYER_MAX_HEALTH,
    maxHealth: REMOTE_PLAYER_MAX_HEALTH,
    isDead: false,
  };
}

function syncRemotePlayerFace(remotePlayer, faceData) {
  if (!remotePlayer) return;

  const normalizedFaceData = normalizePresenceFaceData(faceData);
  const nextSignature = serializeFaceData(normalizedFaceData);
  if (remotePlayer.faceDataSignature === nextSignature) return;

  const previousHumanoid = remotePlayer.humanoid;
  const nextHumanoid = createRemoteHumanoid(normalizedFaceData);
  if (previousHumanoid?.root?.parent === remotePlayer.root) {
    remotePlayer.root.remove(previousHumanoid.root);
  }

  remotePlayer.humanoid = nextHumanoid;
  remotePlayer.faceDataSignature = nextSignature;
  remotePlayer.root.add(nextHumanoid.root);
  markRemoteAvatarParts(nextHumanoid.root);
  remotePlayer.root.scale.setScalar(REMOTE_PLAYER_HEIGHT / nextHumanoid.baseHeight);
}

function findPresenceSessionBySessionId(state, targetSessionId) {
  return Object.values(state).flat().find(session => String(session?.sessionId || '') === targetSessionId) || null;
}

function syncRemotePlayerDisplayName(remotePlayer, displayName) {
  if (!remotePlayer?.nameSprite) return;
  remotePlayer.displayName = resolveRemoteDisplayName(displayName);
  updatePlayerNameSprite(remotePlayer.nameSprite, remotePlayer.displayName);
}

function syncRemotePlayerHealthBar(remotePlayer) {
  if (!remotePlayer?.healthBarSprite) return;
  drawHealthBarSprite(
    remotePlayer.healthBarSprite,
    remotePlayer.health / Math.max(1, remotePlayer.maxHealth)
  );
}

function syncRemotePlayerLifeState(remotePlayer) {
  if (!remotePlayer) return;

  /* Remote death should be immediately readable to other clients. Hiding the
  whole avatar stack keeps the state crisp until the owner respawns and
  publishes fresh health plus transform again. */
  remotePlayer.root.visible = !remotePlayer.isDead;

  if (remotePlayer.isDead && remotePlayer.collider) {
    remotePlayer.collider.makeEmpty();
  }
}

function syncRemotePlayerCollider(remotePlayer) {
  if (!remotePlayer?.collider) return;

  const basePosition = remotePlayer.root.position;
  remotePlayer.collider.min.set(
    basePosition.x - REMOTE_PLAYER_HALF_WIDTH,
    basePosition.y,
    basePosition.z - REMOTE_PLAYER_HALF_DEPTH
  );
  remotePlayer.collider.max.set(
    basePosition.x + REMOTE_PLAYER_HALF_WIDTH,
    basePosition.y + REMOTE_PLAYER_HEIGHT,
    basePosition.z + REMOTE_PLAYER_HALF_DEPTH
  );
}

function snapshotPresencePayload(state) {
  const payload = {
    /* Keep Presence minimal while still exposing a human-readable player name
    in the online list and debug console. The shared lobby roster also needs
    the current page url so it can label where each live session currently is. */
    sessionId: state.sessionId,
    displayName: resolveLocalPresenceDisplayName(),
    url: resolvePresenceUrl(),
  };

  const faceData = normalizePresenceFaceData(state.faceData);
  if (faceData) {
    payload.faceData = faceData;
  }

  return payload;
}

function snapshotBroadcastPayload(state, localSessionId) {
  /* Broadcast carries the short-lived high-frequency gameplay state that would
  otherwise make Presence feel sluggish for moment-to-moment avatar motion. */
  return {
    sessionId: localSessionId,
    x: roundNetworkNumber(state.x),
    y: roundNetworkNumber(state.y),
    z: roundNetworkNumber(state.z),
    rotationY: roundNetworkNumber(state.rotationY),
    isMoving: Boolean(state.isMoving),
    animation: state.isMoving ? 'walk' : 'idle',
    sentAt: Date.now(),
  };
}

function areBroadcastPayloadsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.sessionId === b.sessionId
    && a.x === b.x
    && a.y === b.y
    && a.z === b.z
    && a.rotationY === b.rotationY
    && a.isMoving === b.isMoving
    && a.animation === b.animation
  );
}

function formatCoordValue(value) {
  return readFiniteNumber(value).toFixed(2);
}

function formatCoordsLabel(transform) {
  /* The online list is meant to be human-readable during multiplayer tests, so
  we format the latest known position as a short XYZ triplet instead of showing
  anonymous ids that are harder to scan while moving around the world. */
  if (!transform) return 'waiting for coords...';
  return `x:${formatCoordValue(transform.x)} y:${formatCoordValue(transform.y)} z:${formatCoordValue(transform.z)}`;
}

function resolvePresenceUrl() {
  /* The landing page roster groups sessions by page, so every gameplay page
  must publish the same pathname-style location into Presence. Using only the
  pathname keeps local development and deployed hosting aligned automatically. */
  return window.location.pathname;
}

export function createMultiplayerController({
  scene,
  getLocalPlayerState,
  getLocalPresenceFaceData,
  getSharedWorldPlayerStates,
  onApplyLocalDamage,
  presenceOnly = false,
  peopleOnlineCountElement = document.getElementById('peopleOnlineCount'),
  peopleOnlineHudElement = document.getElementById('peopleOnlineHud'),
  peopleOnlineToggleElement = document.getElementById('peopleOnlineToggle'),
  peopleOnlineListElement = document.getElementById('peopleOnlineList'),
} = {}) {
  /* This id intentionally lives only in memory for the lifetime of this page.
  Some browsers copy sessionStorage when duplicating a tab, which can make two
  different tabs look like the same Presence session and hide remote players. */
  const localSessionId = generateId('session');
  const remotePlayers = new Map();
  let channel = null;
  let isSubscribed = false;
  let isRealtimeConnected = false;
  let broadcastAccumulator = 0;
  let stateBroadcastAccumulator = 0;
  let lastBroadcastPayload = null;
  let lastPlayerStatePayload = null;
  let lastPresenceState = {};
  const latestTransformsBySessionId = new Map();
  const latestPlayerStateBySessionId = new Map();

  function syncRemoteDebugVisibility() {
    const nextVisible = isDebugModeEnabled();
    remotePlayers.forEach(remotePlayer => {
      if (remotePlayer?.debugVisuals) {
        remotePlayer.debugVisuals.visible = nextVisible;
      }
    });
  }

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

  function renderPeopleOnlineList(state) {
    if (!peopleOnlineListElement) return;

    const sessionIds = Object.keys(state).sort();

    if (sessionIds.length === 0) {
      peopleOnlineListElement.textContent = 'No players yet.';
      return;
    }

    peopleOnlineListElement.innerHTML = sessionIds
      .map((sessionId, index) => {
        const ownLabel = sessionId === localSessionId ? ' (you)' : '';
        const coordsLabel = formatCoordsLabel(latestTransformsBySessionId.get(sessionId));
        const latestSession = Array.isArray(state[sessionId]) && state[sessionId].length > 0
          ? state[sessionId][state[sessionId].length - 1]
          : null;
        const displayName = resolveRemoteDisplayName(latestSession?.displayName);
        return `<div>${index + 1}. ${escapeHtml(displayName)}${escapeHtml(ownLabel)} ${escapeHtml(coordsLabel)}</div>`;
      })
      .join('');
  }

  function removeRemotePlayer(sessionId) {
    const remotePlayer = remotePlayers.get(sessionId);
    latestTransformsBySessionId.delete(sessionId);
    latestPlayerStateBySessionId.delete(sessionId);
    if (!remotePlayer) return;
    if (remotePlayer.root.parent) {
      remotePlayer.root.parent.remove(remotePlayer.root);
    }
    remotePlayers.delete(sessionId);
  }

  function getOrCreateRemotePlayer(sessionId, faceData = null) {
    const existingRemotePlayer = remotePlayers.get(sessionId);
    if (existingRemotePlayer) {
      syncRemotePlayerFace(existingRemotePlayer, faceData);
      return existingRemotePlayer;
    }

    const remotePlayer = createRemoteAvatar(faceData);
    const latestPlayerState = latestPlayerStateBySessionId.get(sessionId);
    if (latestPlayerState) {
      remotePlayer.health = latestPlayerState.health;
      remotePlayer.maxHealth = latestPlayerState.maxHealth;
      remotePlayer.isDead = latestPlayerState.isDead;
      syncRemotePlayerHealthBar(remotePlayer);
      syncRemotePlayerLifeState(remotePlayer);
    }
    scene.add(remotePlayer.root);
    remotePlayers.set(sessionId, remotePlayer);
    return remotePlayer;
  }

  function applyRemoteBroadcast(sessionId, payload) {
    const latestPresenceSession = findPresenceSessionBySessionId(lastPresenceState, sessionId);
    const remotePlayer = getOrCreateRemotePlayer(sessionId, latestPresenceSession?.faceData);
    syncRemotePlayerDisplayName(remotePlayer, latestPresenceSession?.displayName);

    /* Cache the most recent network transform so the "People online" panel can
    show live coordinates for each connected session instead of opaque ids. */
    latestTransformsBySessionId.set(sessionId, {
      x: readFiniteNumber(payload.x),
      y: readFiniteNumber(payload.y),
      z: readFiniteNumber(payload.z),
    });

    remotePlayer.targetPosition.set(
      readFiniteNumber(payload.x),
      readFiniteNumber(payload.y),
      readFiniteNumber(payload.z)
    );
    remotePlayer.targetRotationY = readFiniteNumber(payload.rotationY, remotePlayer.targetRotationY);
    remotePlayer.isMoving = payload.animation === 'walk' || Boolean(payload.isMoving);

    /* The first transform packet should place the avatar immediately in the
    right spot so a late join does not visibly lerp from world origin. */
    if (!remotePlayer.initialized) {
      remotePlayer.currentPosition.copy(remotePlayer.targetPosition);
      remotePlayer.root.position.copy(remotePlayer.targetPosition);
      remotePlayer.root.rotation.y = remotePlayer.targetRotationY;
      remotePlayer.initialized = true;
      syncRemotePlayerCollider(remotePlayer);
    }
  }

  function applyRemotePlayerState(payload) {
    const nextPlayerState = readPlayerStatePayload(payload);
    if (!nextPlayerState || nextPlayerState.sessionId === localSessionId) return;

    latestPlayerStateBySessionId.set(nextPlayerState.sessionId, nextPlayerState);

    const remotePlayer = remotePlayers.get(nextPlayerState.sessionId);
    if (!remotePlayer) return;

    remotePlayer.health = nextPlayerState.health;
    remotePlayer.maxHealth = nextPlayerState.maxHealth;
    remotePlayer.isDead = nextPlayerState.isDead;
    syncRemotePlayerHealthBar(remotePlayer);
    syncRemotePlayerLifeState(remotePlayer);
  }

  function readSharedWorldPlayerTransform(playerRecord) {
    if (!playerRecord || typeof playerRecord !== 'object') return null;

    return {
      x: readFiniteNumber(playerRecord.x),
      y: readFiniteNumber(playerRecord.y),
      z: readFiniteNumber(playerRecord.z),
      rotationY: readFiniteNumber(playerRecord.rotationY),
      isMoving: false,
    };
  }

  function applySharedWorldPlayerBootstrap(sessionId, playerRecord) {
    if (!sessionId || sessionId === localSessionId) return;

    const bootstrapTransform = readSharedWorldPlayerTransform(playerRecord);
    if (!bootstrapTransform) return;

    const latestPresenceSession = findPresenceSessionBySessionId(lastPresenceState, sessionId);
    const remotePlayer = getOrCreateRemotePlayer(sessionId, latestPresenceSession?.faceData);
    remotePlayer.targetPosition.set(
      bootstrapTransform.x,
      bootstrapTransform.y,
      bootstrapTransform.z
    );
    remotePlayer.targetRotationY = bootstrapTransform.rotationY;
    remotePlayer.isMoving = false;
    latestTransformsBySessionId.set(sessionId, {
      x: bootstrapTransform.x,
      y: bootstrapTransform.y,
      z: bootstrapTransform.z,
    });

    if (!remotePlayer.initialized) {
      /* A late join should be able to materialize already-connected players
      from the persisted world snapshot before any fresh movement packet lands. */
      remotePlayer.currentPosition.copy(remotePlayer.targetPosition);
      remotePlayer.root.position.copy(remotePlayer.targetPosition);
      remotePlayer.root.rotation.y = remotePlayer.targetRotationY;
      remotePlayer.initialized = true;
      syncRemotePlayerCollider(remotePlayer);
    }

    if (playerRecord.displayName) {
      syncRemotePlayerDisplayName(remotePlayer, playerRecord.displayName);
    }

    if (Number.isFinite(playerRecord.health) || Number.isFinite(playerRecord.maxHealth) || typeof playerRecord.isDead === 'boolean') {
      remotePlayer.health = readFiniteNumber(playerRecord.health, remotePlayer.health);
      remotePlayer.maxHealth = Math.max(1, readFiniteNumber(playerRecord.maxHealth, remotePlayer.maxHealth));
      remotePlayer.isDead = Boolean(playerRecord.isDead) || remotePlayer.health <= 0;
      syncRemotePlayerHealthBar(remotePlayer);
      syncRemotePlayerLifeState(remotePlayer);
    }
  }

  function syncRemotePlayersFromState(state) {
    const seenRemoteSessionIds = new Set();
    const sharedWorldPlayerStates = typeof getSharedWorldPlayerStates === 'function'
      ? getSharedWorldPlayerStates()
      : null;

    Object.entries(state).forEach(([presenceKey, sessions]) => {
      if (!Array.isArray(sessions) || sessions.length === 0) return;

      const latestPayload = sessions[sessions.length - 1];
      const sessionId = String(latestPayload?.sessionId || presenceKey || '');
      if (!sessionId) return;
      if (sessionId === localSessionId) return;

      seenRemoteSessionIds.add(sessionId);

      /* Presence tells us which sessions are alive; the shared world snapshot
      fills the initial transform gap for motionless players on late joins. */
      if (sharedWorldPlayerStates && typeof sharedWorldPlayerStates === 'object') {
        applySharedWorldPlayerBootstrap(sessionId, sharedWorldPlayerStates[sessionId]);
      }
    });

    Array.from(remotePlayers.keys()).forEach(sessionId => {
      if (!seenRemoteSessionIds.has(sessionId)) {
        removeRemotePlayer(sessionId);
      }
    });
  }

  function handlePresenceSync(state) {
    lastPresenceState = state;
    setPeopleOnlineCount(countPresenceSessions(state));
    renderPeopleOnlineList(state);
    syncRemotePlayersFromState(state);
    remotePlayers.forEach((remotePlayer, sessionId) => {
      const latestPresenceSession = findPresenceSessionBySessionId(state, sessionId);
      syncRemotePlayerFace(remotePlayer, latestPresenceSession?.faceData);
      syncRemotePlayerDisplayName(remotePlayer, latestPresenceSession?.displayName);
    });
  }

  function setRealtimeConnectionState(nextConnected) {
    /* Broadcast movement is only useful over the live websocket path. When the
    channel drops or is still rejoining, suppressing sends avoids the new
    Supabase warning about send() silently downgrading itself to REST. */
    isRealtimeConnected = nextConnected;
  }

  async function publishLocalPresence() {
    if (!channel) return;

    await channel.track(snapshotPresencePayload({
      sessionId: localSessionId,
      faceData: typeof getLocalPresenceFaceData === 'function'
        ? getLocalPresenceFaceData()
        : null,
    }));
  }

  async function broadcastLocalPlayerState() {
    /* Presence now runs for both singleplayer and multiplayer, but transform
    broadcast still belongs only to the multiplayer simulation path. */
    if (presenceOnly) return;
    if (!isSubscribed || !isRealtimeConnected || !channel || typeof getLocalPlayerState !== 'function') return;

    const localPlayerState = getLocalPlayerState();
    if (!localPlayerState) return;

    const nextBroadcastPayload = snapshotBroadcastPayload(
      localPlayerState,
      localSessionId
    );
    if (areBroadcastPayloadsEqual(lastBroadcastPayload, nextBroadcastPayload)) return;

    lastBroadcastPayload = nextBroadcastPayload;
    latestTransformsBySessionId.set(localSessionId, {
      x: nextBroadcastPayload.x,
      y: nextBroadcastPayload.y,
      z: nextBroadcastPayload.z,
    });
    renderPeopleOnlineList(lastPresenceState);
    await channel.send({
      type: 'broadcast',
      event: PLAYER_TRANSFORM_BROADCAST_EVENT,
      payload: nextBroadcastPayload,
    });
  }

  async function broadcastLocalCombatState(force = false) {
    if (presenceOnly) return;
    if (!isSubscribed || !isRealtimeConnected || !channel || typeof getLocalPlayerState !== 'function') return;

    const localPlayerState = getLocalPlayerState();
    if (!localPlayerState) return;

    const nextPlayerStatePayload = snapshotPlayerStatePayload(localPlayerState, localSessionId);
    if (!force && arePlayerStatePayloadsEqual(lastPlayerStatePayload, nextPlayerStatePayload)) return;

    lastPlayerStatePayload = nextPlayerStatePayload;
    latestPlayerStateBySessionId.set(localSessionId, nextPlayerStatePayload);
    await channel.send({
      type: 'broadcast',
      event: PLAYER_STATE_BROADCAST_EVENT,
      payload: nextPlayerStatePayload,
    });
  }

  async function notifyLocalStateChanged() {
    if (presenceOnly) return;

    /* Health, death, and respawn transitions should replicate immediately so
    remote HUD state does not wait for the normal movement tick cadence. */
    await broadcastLocalPlayerState();
    await broadcastLocalCombatState(true);
  }

  function isLocalDamageAttemptValid(payload) {
    if (!payload) return false;
    if (Date.now() - payload.sentAt > DAMAGE_ATTEMPT_MAX_AGE_MS) return false;

    const localPlayerState = typeof getLocalPlayerState === 'function' ? getLocalPlayerState() : null;
    if (!localPlayerState) return false;
    if (Boolean(localPlayerState.isDead) || readFiniteNumber(localPlayerState.health, 0) <= 0) return false;

    const localX = readFiniteNumber(localPlayerState.x);
    const localY = readFiniteNumber(localPlayerState.y);
    const localZ = readFiniteNumber(localPlayerState.z);
    const deltaX = localX - payload.origin.x;
    const deltaY = localY - payload.origin.y;
    const deltaZ = localZ - payload.origin.z;
    const allowedDistance = Math.max(0.4, payload.maxDistance + DAMAGE_ATTEMPT_VALIDATION_PADDING);

    return (deltaX * deltaX) + (deltaY * deltaY) + (deltaZ * deltaZ) <= allowedDistance * allowedDistance;
  }

  function applyIncomingDamageAttempt(payload) {
    if (presenceOnly) return;

    const damageAttempt = readDamageAttemptPayload(payload);
    if (!damageAttempt) return;
    if (damageAttempt.targetSessionId !== localSessionId) return;
    if (!isLocalDamageAttemptValid(damageAttempt)) return;
    if (typeof onApplyLocalDamage !== 'function') return;

    onApplyLocalDamage(damageAttempt.damage, {
      sourceType: damageAttempt.sourceType,
      attackerSessionId: damageAttempt.attackerSessionId,
    });
  }

  function sendDamageAttempt({
    targetSessionId,
    damage,
    sourceType,
    origin,
    maxDistance,
  } = {}) {
    if (presenceOnly) return false;
    if (!isSubscribed || !isRealtimeConnected || !channel) return false;

    const payload = createDamageAttemptPayload({
      attackerSessionId: localSessionId,
      targetSessionId,
      damage,
      sourceType,
      origin,
      maxDistance,
    });

    if (!payload.targetSessionId || payload.damage <= 0) return false;

    Promise.resolve(channel.send({
      type: 'broadcast',
      event: PLAYER_DAMAGE_ATTEMPT_EVENT,
      payload,
    })).catch(error => {
      console.error('Failed to broadcast multiplayer damage attempt.', error);
    });
    return true;
  }

  function findRemotePlayerIntersectingSphere(sphere, ignoredSessionIds) {
    let hitSessionId = '';
    let hitDistanceSq = Infinity;

    remotePlayers.forEach((remotePlayer, sessionId) => {
      if (!remotePlayer.initialized) return;
      if ((ignoredSessionIds instanceof Set) && ignoredSessionIds.has(sessionId)) return;
      if (remotePlayer.health <= 0) return;
      if (!remotePlayer.collider.intersectsSphere(sphere)) return;

      const distanceSq = remotePlayer.currentPosition.distanceToSquared(sphere.center);
      if (distanceSq >= hitDistanceSq) return;

      hitDistanceSq = distanceSq;
      hitSessionId = sessionId;
    });

    return hitSessionId;
  }

  function tryApplyDamageToRemotePlayersIntersectingSphere({
    sphere,
    damage,
    sourceType,
    maxDistance,
    ignoredSessionIds,
  } = {}) {
    if (presenceOnly || !sphere) return false;

    const hitSessionId = findRemotePlayerIntersectingSphere(sphere, ignoredSessionIds);
    if (!hitSessionId) return false;

    if (ignoredSessionIds instanceof Set) {
      ignoredSessionIds.add(hitSessionId);
    }

    return sendDamageAttempt({
      targetSessionId: hitSessionId,
      damage,
      sourceType,
      origin: sphere.center,
      maxDistance,
    });
  }

  function getRemotePlayerRaycastHit(origin, ray, maxDistance, reusablePoint) {
    let closestHit = null;
    let closestDistance = maxDistance;

    remotePlayers.forEach((remotePlayer, sessionId) => {
      if (!remotePlayer.initialized || remotePlayer.isDead) return;
      if (!remotePlayer.collider || !ray.intersectBox(remotePlayer.collider, reusablePoint)) return;

      const distance = origin.distanceTo(reusablePoint);
      if (!Number.isFinite(distance) || distance > maxDistance || distance >= closestDistance) return;

      closestDistance = distance;
      closestHit = {
        kind: 'remote-player',
        label: `Player (${remotePlayer.displayName || 'Anonymous'})`,
        entity: remotePlayer,
        sessionId,
        distance,
        point: reusablePoint.clone(),
      };
    });

    return closestHit;
  }

  function connect() {
    const database = window.database;
    if (channel || !database?.channel) return;

    channel = database.channel(PRESENCE_CHANNEL_NAME, {
      config: {
        presence: {
          key: localSessionId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        handlePresenceSync(channel.presenceState());
      })
      .on('broadcast', { event: PLAYER_TRANSFORM_BROADCAST_EVENT }, ({ payload }) => {
        if (presenceOnly) return;
        if (!payload?.sessionId || payload.sessionId === localSessionId) return;
        applyRemoteBroadcast(payload.sessionId, payload);
        renderPeopleOnlineList(lastPresenceState);
      })
      .on('broadcast', { event: PLAYER_STATE_BROADCAST_EVENT }, ({ payload }) => {
        applyRemotePlayerState(payload);
      })
      .on('broadcast', { event: PLAYER_DAMAGE_ATTEMPT_EVENT }, ({ payload }) => {
        applyIncomingDamageAttempt(payload);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          isSubscribed = true;
          setRealtimeConnectionState(true);
          await publishLocalPresence();
          await broadcastLocalPlayerState();
          await broadcastLocalCombatState(true);
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isSubscribed = false;
          setRealtimeConnectionState(false);
        }
      });
  }

  function updateRemotePlayers(deltaTime) {
    if (presenceOnly) return;

    remotePlayers.forEach(remotePlayer => {
      if (!remotePlayer.initialized) return;

      const lerpAlpha = Math.min(1, deltaTime * REMOTE_POSITION_LERP_SPEED);
      remotePlayer.currentPosition.lerp(remotePlayer.targetPosition, lerpAlpha);
      remotePlayer.root.position.copy(remotePlayer.currentPosition);
      syncRemotePlayerCollider(remotePlayer);

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

    broadcastAccumulator += deltaTime;
    if (broadcastAccumulator >= LOCAL_BROADCAST_PUSH_INTERVAL) {
      broadcastAccumulator = 0;
      broadcastLocalPlayerState().catch(error => {
        console.error('Failed to broadcast multiplayer transform.', error);
      });
    }

    stateBroadcastAccumulator += deltaTime;
    if (stateBroadcastAccumulator < LOCAL_STATE_PUSH_INTERVAL) return;

    stateBroadcastAccumulator = 0;
    broadcastLocalCombatState().catch(error => {
      console.error('Failed to broadcast multiplayer combat state.', error);
    });
  }

  window.addEventListener('kolorlando:player-name-change', () => {
    /* Re-tracking the existing Presence session is enough to refresh the lobby
    roster whenever auth updates the cached player name on an already-open page. */
    publishLocalPresence().catch(error => {
      console.error('Failed to refresh Kolorlando scene Presence.', error);
    });
  });

  window.addEventListener(KOLORLANDO_DEBUG_MODE_EVENT, () => {
    /* Remote avatar helpers belong to the same runtime debug switch as the
    rest of the gameplay diagnostics, so they flip in place on every session. */
    syncRemoteDebugVisibility();
  });

  return {
    update,
    localSessionId,
    notifyLocalStateChanged,
    tryApplyDamageToRemotePlayersIntersectingSphere,
    getRemotePlayerRaycastHit,
  };
}
