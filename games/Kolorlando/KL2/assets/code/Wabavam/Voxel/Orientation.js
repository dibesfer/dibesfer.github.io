export const ORIENTATION_DIRECTIONS = {
  NORTH: "north",
  EAST: "east",
  SOUTH: "south",
  WEST: "west"
};

export const ORIENTATION_YAW_DEGREES = {
  [ORIENTATION_DIRECTIONS.NORTH]: 0,
  [ORIENTATION_DIRECTIONS.EAST]: 90,
  [ORIENTATION_DIRECTIONS.SOUTH]: 180,
  [ORIENTATION_DIRECTIONS.WEST]: 270
};

export const ORIENTATION_STEPS = {
  [ORIENTATION_DIRECTIONS.NORTH]: 0,
  [ORIENTATION_DIRECTIONS.EAST]: 1,
  [ORIENTATION_DIRECTIONS.SOUTH]: 2,
  [ORIENTATION_DIRECTIONS.WEST]: 3
};

export const ORIENTABLE_VOXEL_NAMES = new Set([
  "blue_stair",
  "stair"
]);

export function isOrientableVoxelName(name = "") {
  return ORIENTABLE_VOXEL_NAMES.has(String(name).trim().toLowerCase());
}

export function normalizeOrientation(value = null, fallback = ORIENTATION_DIRECTIONS.NORTH) {
  if (typeof value === "string") return normalizeDirection(value, fallback);

  if (value && typeof value === "object") {
    if (value.direction) return normalizeDirection(value.direction, fallback);
    if (value.yaw !== undefined) return normalizeYawDegrees(value.yaw).direction;
    if (value.y !== undefined) return normalizeYawRadians(value.y).direction;
  }

  return normalizeDirection(fallback, ORIENTATION_DIRECTIONS.NORTH);
}

export function orientationData(value = null) {
  const direction = normalizeOrientation(value);

  return {
    direction,
    yaw: ORIENTATION_YAW_DEGREES[direction],
    steps: ORIENTATION_STEPS[direction]
  };
}

export function yawToCameraFacing(yawRadians = 0) {
  const yaw = Number(yawRadians) || 0;
  const x = -Math.sin(yaw);
  const z = -Math.cos(yaw);

  return vectorToCardinal(x, z);
}

export function yawToVoxelFacingPlayer(yawRadians = 0) {
  const yaw = Number(yawRadians) || 0;
  const x = Math.sin(yaw);
  const z = Math.cos(yaw);

  return vectorToCardinal(x, z);
}

export function desiredOrientationFromCameraYaw(yawRadians = 0) {
  return orientationData(yawToCameraFacing(yawRadians));
}

export function rotateYawPositionToSource(position = {}, size = 1, orientation = null) {
  const steps = orientationData(orientation).steps;
  const max = size - 1;
  const x = Math.max(0, Math.min(max, Math.floor(Number(position.x) || 0)));
  const y = Math.max(0, Math.min(max, Math.floor(Number(position.y) || 0)));
  const z = Math.max(0, Math.min(max, Math.floor(Number(position.z) || 0)));

  if (steps === 1) return { x: z, y, z: max - x };
  if (steps === 2) return { x: max - x, y, z: max - z };
  if (steps === 3) return { x: max - z, y, z: x };

  return { x, y, z };
}

function normalizeDirection(value = "", fallback = ORIENTATION_DIRECTIONS.NORTH) {
  const direction = String(value).trim().toLowerCase();

  return Object.values(ORIENTATION_DIRECTIONS).includes(direction)
    ? direction
    : fallback;
}

function normalizeYawDegrees(yawDegrees = 0) {
  const normalized = ((Math.round((Number(yawDegrees) || 0) / 90) * 90) % 360 + 360) % 360;
  const direction = Object.entries(ORIENTATION_YAW_DEGREES)
    .find(([, degrees]) => degrees === normalized)?.[0]
    || ORIENTATION_DIRECTIONS.NORTH;

  return orientationData(direction);
}

function normalizeYawRadians(yawRadians = 0) {
  return normalizeYawDegrees((Number(yawRadians) || 0) * 180 / Math.PI);
}

function vectorToCardinal(x = 0, z = -1) {
  if (Math.abs(x) > Math.abs(z)) {
    return x >= 0 ? ORIENTATION_DIRECTIONS.EAST : ORIENTATION_DIRECTIONS.WEST;
  }

  return z >= 0 ? ORIENTATION_DIRECTIONS.SOUTH : ORIENTATION_DIRECTIONS.NORTH;
}

export default {
  ORIENTATION_DIRECTIONS,
  ORIENTATION_YAW_DEGREES,
  ORIENTATION_STEPS,
  ORIENTABLE_VOXEL_NAMES,
  isOrientableVoxelName,
  normalizeOrientation,
  orientationData,
  yawToCameraFacing,
  yawToVoxelFacingPlayer,
  desiredOrientationFromCameraYaw,
  rotateYawPositionToSource
};
