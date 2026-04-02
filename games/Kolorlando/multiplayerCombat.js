const PLAYER_STATE_BROADCAST_EVENT = 'player:state';
const PLAYER_DAMAGE_ATTEMPT_EVENT = 'player:damage-attempt';

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

function normalizeSessionId(value) {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue || '';
}

export {
  PLAYER_STATE_BROADCAST_EVENT,
  PLAYER_DAMAGE_ATTEMPT_EVENT,
};

export function snapshotPlayerStatePayload(state, localSessionId) {
  const maxHealth = Math.max(1, readFiniteNumber(state?.maxHealth, 100));
  const health = Math.min(maxHealth, Math.max(0, readFiniteNumber(state?.health, maxHealth)));

  return {
    sessionId: normalizeSessionId(localSessionId),
    health: roundNetworkNumber(health, 2),
    maxHealth: roundNetworkNumber(maxHealth, 2),
    isDead: Boolean(state?.isDead) || health <= 0,
    sentAt: Date.now(),
  };
}

export function arePlayerStatePayloadsEqual(a, b) {
  if (!a || !b) return false;

  return (
    a.sessionId === b.sessionId
    && a.health === b.health
    && a.maxHealth === b.maxHealth
    && a.isDead === b.isDead
  );
}

export function readPlayerStatePayload(payload) {
  const sessionId = normalizeSessionId(payload?.sessionId);
  if (!sessionId) return null;

  const maxHealth = Math.max(1, readFiniteNumber(payload?.maxHealth, 100));
  const health = Math.min(maxHealth, Math.max(0, readFiniteNumber(payload?.health, maxHealth)));

  return {
    sessionId,
    health,
    maxHealth,
    isDead: Boolean(payload?.isDead) || health <= 0,
    sentAt: readFiniteNumber(payload?.sentAt, Date.now()),
  };
}

export function createDamageAttemptPayload({
  attackerSessionId,
  targetSessionId,
  damage,
  sourceType,
  origin,
  maxDistance,
} = {}) {
  return {
    attackerSessionId: normalizeSessionId(attackerSessionId),
    targetSessionId: normalizeSessionId(targetSessionId),
    damage: roundNetworkNumber(Math.max(0, readFiniteNumber(damage, 0)), 2),
    sourceType: typeof sourceType === 'string' && sourceType.trim() ? sourceType.trim() : 'unknown',
    originX: roundNetworkNumber(origin?.x, 3),
    originY: roundNetworkNumber(origin?.y, 3),
    originZ: roundNetworkNumber(origin?.z, 3),
    maxDistance: roundNetworkNumber(Math.max(0, readFiniteNumber(maxDistance, 0)), 3),
    sentAt: Date.now(),
  };
}

export function readDamageAttemptPayload(payload) {
  const attackerSessionId = normalizeSessionId(payload?.attackerSessionId);
  const targetSessionId = normalizeSessionId(payload?.targetSessionId);
  const damage = Math.max(0, readFiniteNumber(payload?.damage, 0));

  if (!attackerSessionId || !targetSessionId || damage <= 0) {
    return null;
  }

  return {
    attackerSessionId,
    targetSessionId,
    damage,
    sourceType: typeof payload?.sourceType === 'string' && payload.sourceType.trim()
      ? payload.sourceType.trim()
      : 'unknown',
    origin: {
      x: readFiniteNumber(payload?.originX),
      y: readFiniteNumber(payload?.originY),
      z: readFiniteNumber(payload?.originZ),
    },
    maxDistance: Math.max(0, readFiniteNumber(payload?.maxDistance, 0)),
    sentAt: readFiniteNumber(payload?.sentAt, Date.now()),
  };
}
