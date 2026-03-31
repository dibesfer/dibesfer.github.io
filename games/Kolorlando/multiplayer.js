import * as THREE from 'three';
import {
  createHumanoidModel,
  applyHumanoidIdleAnimation,
  applyHumanoidWalkAnimation,
} from './entityModel.js';

const PRESENCE_CHANNEL_NAME = 'kolorlando-world';
const PLAYER_TRANSFORM_BROADCAST_EVENT = 'player:transform';
const LOCAL_PLAYER_NAME_STORAGE_KEY = 'kolorlando.playerName';
const LOCAL_BROADCAST_PUSH_INTERVAL = 0.1;
const REMOTE_POSITION_LERP_SPEED = 10;
const REMOTE_ROTATION_LERP_SPEED = 12;
const REMOTE_MOVE_DISTANCE_THRESHOLD = 0.0004;
const REMOTE_PLAYER_HEIGHT = 1.8;

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

function resolvePresenceDisplayName(payloadDisplayName = '') {
  /* Keep the multiplayer name logic tiny: use the payload name when present,
  otherwise fall back to the locally cached username, and finally to Anon. */
  const payloadName = typeof payloadDisplayName === 'string' ? payloadDisplayName.trim() : '';
  if (payloadName) return payloadName;

  const storedName = window.localStorage.getItem(LOCAL_PLAYER_NAME_STORAGE_KEY);
  const trimmedStoredName = typeof storedName === 'string' ? storedName.trim() : '';
  return trimmedStoredName || 'Anon';
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

function createRemoteAvatar() {
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

function snapshotPresencePayload(state) {
  return {
    /* Keep Presence minimal while still exposing a human-readable player name
    in the online list and debug console. The shared lobby roster also needs
    the current page url so it can label where each live session currently is. */
    sessionId: state.sessionId,
    displayName: resolvePresenceDisplayName(),
    url: resolvePresenceUrl(),
  };
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
  let lastBroadcastPayload = null;
  let lastPresenceState = {};
  const latestTransformsBySessionId = new Map();

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
        const displayName = resolvePresenceDisplayName(latestSession?.displayName);
        return `<div>${index + 1}. ${escapeHtml(displayName)}${escapeHtml(ownLabel)} ${escapeHtml(coordsLabel)}</div>`;
      })
      .join('');
  }

  function removeRemotePlayer(sessionId) {
    const remotePlayer = remotePlayers.get(sessionId);
    latestTransformsBySessionId.delete(sessionId);
    if (!remotePlayer) return;
    if (remotePlayer.root.parent) {
      remotePlayer.root.parent.remove(remotePlayer.root);
    }
    remotePlayers.delete(sessionId);
  }

  function getOrCreateRemotePlayer(sessionId) {
    const existingRemotePlayer = remotePlayers.get(sessionId);
    if (existingRemotePlayer) return existingRemotePlayer;

    const remotePlayer = createRemoteAvatar();
    scene.add(remotePlayer.root);
    remotePlayers.set(sessionId, remotePlayer);
    return remotePlayer;
  }

  function applyRemoteBroadcast(sessionId, payload) {
    const remotePlayer = getOrCreateRemotePlayer(sessionId);

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
    }
  }

  function syncRemotePlayersFromState(state) {
    const seenRemoteSessionIds = new Set();

    Object.entries(state).forEach(([presenceKey, sessions]) => {
      if (!Array.isArray(sessions) || sessions.length === 0) return;

      const latestPayload = sessions[sessions.length - 1];
      const sessionId = String(latestPayload?.sessionId || presenceKey || '');
      if (!sessionId) return;
      if (sessionId === localSessionId) return;

      /* Presence tells us which remote sessions are alive, but not where they
      are. We therefore wait for the first transform broadcast before creating
      a visible avatar, which avoids phantom players appearing at spawn. */
      seenRemoteSessionIds.add(sessionId);
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
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          isSubscribed = true;
          setRealtimeConnectionState(true);
          await publishLocalPresence();
          await broadcastLocalPlayerState();
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
    if (broadcastAccumulator < LOCAL_BROADCAST_PUSH_INTERVAL) return;

    broadcastAccumulator = 0;
    broadcastLocalPlayerState().catch(error => {
      console.error('Failed to broadcast multiplayer transform.', error);
    });
  }

  window.addEventListener('kolorlando:player-name-change', () => {
    /* Re-tracking the existing Presence session is enough to refresh the lobby
    roster whenever auth updates the cached player name on an already-open page. */
    publishLocalPresence().catch(error => {
      console.error('Failed to refresh Kolorlando scene Presence.', error);
    });
  });

  return {
    update,
    localSessionId,
  };
}
