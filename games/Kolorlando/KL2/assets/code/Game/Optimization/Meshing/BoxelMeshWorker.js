import BoxelMesher from "./BoxelMesher.js";

self.onmessage = event => {
  const { id, boxel, solidKeys, neighborVoxels, land, lodMode: requestedLodMode = "full-detail" } = event.data || {};
  const lodMode = normalizeLodMode(requestedLodMode);
  const solids = new Set(solidKeys || []);
  const neighborVoxelMap = new Map(
    (neighborVoxels || [])
      .map(hydrateVoxel)
      .filter(voxel => voxel?.active !== false)
      .map(voxel => [voxelKey(voxel.position), voxel])
  );

  const mesher = new BoxelMesher({
    isSolid: position => solids.has(voxelKey(position)) || neighborVoxelMap.has(voxelKey(position)),
    voxelAt: position => neighborVoxelMap.get(voxelKey(position)) || null,
    renderOffset: renderOffset(land),
    lodMode
  });

  try {
    const startedAt = performance.now();
    const geometryData = mesher.createGeometryData(hydrateBoxel(boxel), { lodMode });

    self.postMessage({
      id,
      geometryData: serializeGeometryData(geometryData),
      meshMs: performance.now() - startedAt,
      lodMode
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error?.message || "Boxel mesh worker failed"
    });
  }
};

function normalizeLodMode(mode = "full-detail") {
  if (mode === "minimal-detail") return "minimal-detail";
  if (mode === "medium-detail") return "medium-detail";

  return "full-detail";
}

function hydrateBoxel(boxel = {}) {
  return {
    ...boxel,
    voxels: (boxel.voxels || []).map(hydrateVoxel)
  };
}

function hydrateVoxel(voxel = {}) {
  return {
    ...voxel,
    position: { ...voxel.position },
    hasMicroxels() {
      return this.type === "microxeled" && this.microxelSize > 1 && Array.isArray(this.microxels);
    },
    get(x, y, z) {
      const source = rotateYawPositionToSource(
        { x, y, z },
        this.microxelSize,
        this.orientable ? this.orientation || this.rotation : null
      );

      return this.microxels?.[source.x]?.[source.y]?.[source.z] ?? null;
    }
  };
}

function rotateYawPositionToSource(position = {}, size = 1, orientation = null) {
  const steps = orientationSteps(orientation);
  const max = size - 1;
  const x = Math.max(0, Math.min(max, Math.floor(Number(position.x) || 0)));
  const y = Math.max(0, Math.min(max, Math.floor(Number(position.y) || 0)));
  const z = Math.max(0, Math.min(max, Math.floor(Number(position.z) || 0)));

  if (steps === 1) return { x: z, y, z: max - x };
  if (steps === 2) return { x: max - x, y, z: max - z };
  if (steps === 3) return { x: max - z, y, z: x };

  return { x, y, z };
}

function orientationSteps(orientation = null) {
  if (!orientation || typeof orientation !== "object") return 0;
  if (Number.isInteger(orientation.steps)) return ((orientation.steps % 4) + 4) % 4;

  const direction = String(orientation.direction || "north").toLowerCase();
  if (direction === "east") return 1;
  if (direction === "south") return 2;
  if (direction === "west") return 3;

  if (orientation.yaw !== undefined) {
    return (((Math.round((Number(orientation.yaw) || 0) / 90) % 4) + 4) % 4);
  }

  if (orientation.y !== undefined) {
    return (((Math.round(((Number(orientation.y) || 0) * 180 / Math.PI) / 90) % 4) + 4) % 4);
  }

  return 0;
}

function renderOffset(land = { x: 0, y: 0, z: 0 }) {
  return {
    x: -land.x / 2,
    y: -land.y,
    z: -land.z / 2
  };
}

function voxelKey(position) {
  return `${position.x},${position.y},${position.z}`;
}

function serializeGeometryData(geometryData) {
  return {
    ...geometryData,
    positions: Array.from(geometryData.positions || []),
    normals: Array.from(geometryData.normals || []),
    colors: Array.from(geometryData.colors || []),
    indices: Array.from(geometryData.indices || []),
    voxels: serializeVoxels(geometryData.voxels),
    faceVoxels: serializeVoxels(geometryData.faceVoxels),
    lodMode: geometryData.lodMode || "full-detail"
  };
}

function serializeVoxels(voxels = []) {
  return voxels.map(voxel => ({
    position: { ...voxel.position },
    name: voxel.name,
    orientable: Boolean(voxel.orientable),
    orientation: voxel.orientation ? { ...voxel.orientation } : null,
    rotation: voxel.rotation ? { ...voxel.rotation } : null
  }));
}
