import * as THREE from "https://unpkg.com/three@0.184.0/build/three.module.js";

export class BoxelMesher {
  constructor({ isSolid, voxelAt = null, renderOffset = { x: 0, y: 0, z: 0 }, lodMode = "full-detail" } = {}) {
    this.isSolid = isSolid;
    this.voxelAt = voxelAt;
    this.renderOffset = renderOffset;
    this.material = null;
    this.wireframeMode = false;
    this.wireframeVertexColors = false;
    this.lodMode = this.normalizeLodMode(lodMode);
    this.lightDirection = new THREE.Vector3(-0.55, 0.72, 0.29).normalize();
    this.shade = {
      min: 0.03,
      max: 1.3,
      power: 3
    };
    this.faces = [
      { axis: "x", u: "z", v: "y", direction: 1, normal: { x: 1, y: 0, z: 0 } },
      { axis: "x", u: "z", v: "y", direction: -1, normal: { x: -1, y: 0, z: 0 } },
      { axis: "y", u: "x", v: "z", direction: 1, normal: { x: 0, y: 1, z: 0 } },
      { axis: "y", u: "x", v: "z", direction: -1, normal: { x: 0, y: -1, z: 0 } },
      { axis: "z", u: "x", v: "y", direction: 1, normal: { x: 0, y: 0, z: 1 } },
      { axis: "z", u: "x", v: "y", direction: -1, normal: { x: 0, y: 0, z: -1 } }
    ];
    this.faces.forEach(face => {
      face.shade = this.faceShade(face.normal);
    });
    this.colorCache = new Map();
    this.currentVoxelMap = new Map();
  }

  createChunkMesh(boxel, options = {}) {
    const geometryData = this.createGeometryData(boxel, options);

    return this.createMeshFromGeometryData(boxel, geometryData);
  }

  createMeshFromGeometryData(boxel, geometryData) {
    if (geometryData.faceVoxels.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(geometryData.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(geometryData.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(geometryData.colors, 3));
    geometry.setIndex(geometryData.indices);
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, this.getMaterial());

    mesh.name = "Boxel15";
    mesh.userData.boxel = boxel;
    mesh.userData.voxels = geometryData.voxels;
    mesh.userData.faceVoxels = geometryData.faceVoxels;
    mesh.userData.lodMode = geometryData.lodMode || this.lodMode;

    return mesh;
  }

  usesSharedMaterial() {
    return Boolean(this.getMaterial());
  }

  getMaterial() {
    if (!this.material) {
      this.material = new THREE.MeshBasicMaterial({
        vertexColors: this.effectiveVertexColors(),
        side: THREE.DoubleSide,
        fog: true,
        wireframe: this.wireframeMode,
        color: 0xffffff
      });
    }

    return this.material;
  }

  setRenderStyle({ wireframeMode = this.wireframeMode, wireframeVertexColors = this.wireframeVertexColors } = {}) {
    this.wireframeMode = Boolean(wireframeMode);
    this.wireframeVertexColors = Boolean(wireframeVertexColors);

    const material = this.getMaterial();

    material.wireframe = this.wireframeMode;
    material.vertexColors = this.effectiveVertexColors();
    material.color.set(0xffffff);
    material.needsUpdate = true;

    return material;
  }

  effectiveVertexColors() {
    return !this.wireframeMode || this.wireframeVertexColors;
  }

  createGeometryData(boxel, options = {}) {
    const previousLodMode = this.lodMode;
    this.lodMode = this.normalizeLodMode(options.lodMode || this.lodMode);
    this.currentVoxelMap = this.voxelMap(boxel);

    const faces = this.createGreedyFaces(boxel);
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];
    const voxels = [];
    const faceVoxels = [];

    faces.forEach(face => {
      const vertexIndex = positions.length / 3;
      const color = this.colorToRgb(face.color);
      const shade = face.shade ?? this.faceShade(face.normal);

      this.pushFaceVertices(face, positions, normals, colors, color, shade);

      indices.push(
        vertexIndex,
        vertexIndex + 1,
        vertexIndex + 2,
        vertexIndex,
        vertexIndex + 2,
        vertexIndex + 3
      );
      voxels.push(face.voxel);
      faceVoxels.push(face.voxel);
    });

    this.currentVoxelMap = new Map();

    const geometryData = { positions, normals, colors, indices, voxels, faceVoxels, lodMode: this.lodMode };

    this.lodMode = previousLodMode;
    return geometryData;
  }

  voxelMap(boxel) {
    const map = new Map();

    (boxel?.voxels || []).forEach(voxel => {
      if (voxel?.active === false) return;

      map.set(voxelKey(voxel.position), voxel);
    });

    return map;
  }

  voxelAtPosition(position) {
    return this.currentVoxelMap.get(voxelKey(position))
      || this.voxelAt?.(position)
      || null;
  }

  createGreedyFaces(boxel) {
    if (this.lodMode === "minimal-detail") {
      return this.createMinimalBoxelFaces(boxel);
    }

    return [
      ...this.faces.flatMap(face => this.mergeFaceGroup(this.collectFaceCells(boxel, face), face)),
      ...this.createMicroxelFaces(boxel),
      ...this.createFullVoxelFacesAgainstMicroxelNeighbors(boxel)
    ];
  }

  createMinimalBoxelFaces(boxel) {
    const voxels = (boxel?.voxels || []).filter(voxel => voxel?.active !== false);

    if (voxels.length === 0) return [];

    const bounds = voxels.reduce((next, voxel) => {
      const position = voxel.position || {};

      next.min.x = Math.min(next.min.x, Number(position.x) || 0);
      next.min.y = Math.min(next.min.y, Number(position.y) || 0);
      next.min.z = Math.min(next.min.z, Number(position.z) || 0);
      next.max.x = Math.max(next.max.x, Number(position.x) || 0);
      next.max.y = Math.max(next.max.y, Number(position.y) || 0);
      next.max.z = Math.max(next.max.z, Number(position.z) || 0);

      return next;
    }, {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    });

    const color = this.dominantVoxelColor(voxels);
    const proxyVoxel = {
      name: "LOD minimal Boxel15",
      color,
      active: true,
      position: {
        x: bounds.min.x,
        y: bounds.min.y,
        z: bounds.min.z
      }
    };

    return this.faces.map(face => ({
      ...face,
      plane: face.direction > 0
        ? bounds.max[face.axis] + 1
        : bounds.min[face.axis],
      uStart: bounds.min[face.u],
      vStart: bounds.min[face.v],
      uEnd: bounds.max[face.u] + 1,
      vEnd: bounds.max[face.v] + 1,
      color,
      voxel: proxyVoxel
    }));
  }

  dominantVoxelColor(voxels = []) {
    const counts = new Map();

    voxels.forEach(voxel => {
      const color = this.voxelColor(voxel);

      counts.set(color, (counts.get(color) || 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0]
      || "#ffffff";
  }

  collectFaceCells(boxel, face) {
    const groups = new Map();

    boxel.voxels.forEach(voxel => {
      if (voxel.active === false || this.shouldRenderVoxelAsMicroxels(voxel)) return;

      const neighborPosition = {
        ...voxel.position,
        [face.axis]: voxel.position[face.axis] + face.direction
      };
      const neighborVoxel = this.voxelAtPosition(neighborPosition);

      if (this.shouldRenderVoxelAsMicroxels(neighborVoxel)) return;
      if (neighborVoxel || this.isSolid(neighborPosition)) return;

      const color = this.voxelColor(voxel);
      const plane = voxel.position[face.axis] + (face.direction > 0 ? 1 : 0);
      const key = `${plane}|${color}`;

      if (!groups.has(key)) {
        groups.set(key, {
          plane,
          color,
          cells: new Map()
        });
      }

      groups.get(key).cells.set(this.cellKey(voxel.position[face.u], voxel.position[face.v]), voxel);
    });

    return [...groups.values()];
  }

  createMicroxelFaces(boxel) {
    if (this.lodMode !== "full-detail") return [];

    const faces = [];

    boxel.voxels.forEach(voxel => {
      if (voxel.active === false || !voxel.hasMicroxels?.()) return;

      const size = voxel.microxelSize;
      const step = 1 / size;
      const groups = new Map();

      for (let x = 0; x < size; x += 1) {
        for (let y = 0; y < size; y += 1) {
          for (let z = 0; z < size; z += 1) {
            const microxel = voxel.get(x, y, z);
            if (!microxel?.active) continue;

            this.faces.forEach(face => {
              if (!this.isMicroxelFaceVisible(voxel, { x, y, z }, face)) return;

              const plane = microxelPositionPlane({ x, y, z }, face);
              const key = `${face.axis}|${face.direction}|${plane}|${microxel.color}`;

              if (!groups.has(key)) {
                groups.set(key, {
                  face,
                  plane,
                  color: microxel.color,
                  cells: new Map()
                });
              }

              groups.get(key).cells.set(
                this.cellKey({ x, y, z }[face.u], { x, y, z }[face.v]),
                { x, y, z }
              );
            });
          }
        }
      }

      groups.forEach(group => {
        faces.push(...this.mergeMicroxelFaceGroup(voxel, group, step));
      });
    });

    return faces;
  }

  createFullVoxelFacesAgainstMicroxelNeighbors(boxel) {
    if (this.lodMode !== "full-detail") return [];

    const faces = [];

    boxel.voxels.forEach(voxel => {
      if (voxel.active === false || this.shouldRenderVoxelAsMicroxels(voxel)) return;

      this.faces.forEach(face => {
        const neighborPosition = {
          ...voxel.position,
          [face.axis]: voxel.position[face.axis] + face.direction
        };
        const neighborVoxel = this.voxelAtPosition(neighborPosition);

        if (!neighborVoxel?.hasMicroxels?.()) return;

        const size = neighborVoxel.microxelSize;
        const step = 1 / size;
        const cells = new Map();

        for (let u = 0; u < size; u += 1) {
          for (let v = 0; v < size; v += 1) {
            if (this.neighborBoundaryMicroxelIsActive(neighborVoxel, face, u, v)) continue;

            cells.set(this.cellKey(u, v), { u, v });
          }
        }

        if (cells.size === 0) return;

        faces.push(...this.mergePartialFullVoxelFaceGroup(voxel, {
          face,
          color: voxel.color,
          cells
        }, step));
      });
    });

    return faces;
  }

  neighborBoundaryMicroxelIsActive(neighborVoxel, face, u, v) {
    const size = neighborVoxel.microxelSize;
    const position = {
      x: 0,
      y: 0,
      z: 0
    };

    position[face.axis] = face.direction > 0 ? 0 : size - 1;
    position[face.u] = u;
    position[face.v] = v;

    return Boolean(neighborVoxel.get(position.x, position.y, position.z)?.active);
  }

  mergePartialFullVoxelFaceGroup(voxel, group, step) {
    const merged = [];
    const consumed = new Set();
    const cells = [...group.cells.entries()]
      .map(([key, position]) => ({ key, position, ...this.parseCellKey(key) }))
      .sort((a, b) => a.v - b.v || a.u - b.u);

    cells.forEach(cell => {
      if (consumed.has(cell.key)) return;

      const width = this.findWidth(group.cells, consumed, cell);
      const height = this.findHeight(group.cells, consumed, cell, width);

      for (let v = cell.v; v < cell.v + height; v += 1) {
        for (let u = cell.u; u < cell.u + width; u += 1) {
          consumed.add(this.cellKey(u, v));
        }
      }

      merged.push({
        ...group.face,
        ...this.partialFullVoxelFaceBounds(voxel.position, group.face, cell.u, cell.v, width, height, step),
        color: group.color,
        voxel
      });
    });

    return merged;
  }

  partialFullVoxelFaceBounds(voxelPosition, face, u, v, width, height, step) {
    return {
      plane: voxelPosition[face.axis] + (face.direction > 0 ? 1 : 0),
      uStart: voxelPosition[face.u] + u * step,
      vStart: voxelPosition[face.v] + v * step,
      uEnd: voxelPosition[face.u] + (u + width) * step,
      vEnd: voxelPosition[face.v] + (v + height) * step
    };
  }

  mergeMicroxelFaceGroup(voxel, group, step) {
    const merged = [];
    const consumed = new Set();
    const cells = [...group.cells.entries()]
      .map(([key, position]) => ({ key, position, ...this.parseCellKey(key) }))
      .sort((a, b) => a.v - b.v || a.u - b.u);

    cells.forEach(cell => {
      if (consumed.has(cell.key)) return;

      const width = this.findWidth(group.cells, consumed, cell);
      const height = this.findHeight(group.cells, consumed, cell, width);

      for (let v = cell.v; v < cell.v + height; v += 1) {
        for (let u = cell.u; u < cell.u + width; u += 1) {
          consumed.add(this.cellKey(u, v));
        }
      }

      merged.push({
        ...group.face,
        ...this.microxelFaceBounds(voxel.position, group.face, group.plane, cell.u, cell.v, width, height, step),
        color: group.color,
        voxel
      });
    });

    return merged;
  }

  isMicroxelFaceVisible(voxel, microxelPosition, face) {
    const size = voxel.microxelSize;
    const neighborMicroxel = {
      ...microxelPosition,
      [face.axis]: microxelPosition[face.axis] + face.direction
    };

    if (
      neighborMicroxel.x >= 0 && neighborMicroxel.x < size
      && neighborMicroxel.y >= 0 && neighborMicroxel.y < size
      && neighborMicroxel.z >= 0 && neighborMicroxel.z < size
    ) {
      return !voxel.get(neighborMicroxel.x, neighborMicroxel.y, neighborMicroxel.z)?.active;
    }

    const neighborVoxelPosition = {
      ...voxel.position,
      [face.axis]: voxel.position[face.axis] + face.direction
    };
    const neighborVoxel = this.voxelAtPosition(neighborVoxelPosition);

    if (!neighborVoxel) return !this.isSolid(neighborVoxelPosition);
    if (neighborVoxel.active === false) return true;
    if (!neighborVoxel.hasMicroxels?.()) return false;

    return !this.neighborMicroxelAtBoundaryIsActive(
      neighborVoxel,
      microxelPosition,
      voxel.microxelSize,
      face
    );
  }

  neighborMicroxelAtBoundaryIsActive(neighborVoxel, sourceMicroxelPosition, sourceSize, face) {
    const neighborSize = neighborVoxel.microxelSize;
    const position = {
      x: this.mapMicroxelCoordinate(sourceMicroxelPosition.x, sourceSize, neighborSize),
      y: this.mapMicroxelCoordinate(sourceMicroxelPosition.y, sourceSize, neighborSize),
      z: this.mapMicroxelCoordinate(sourceMicroxelPosition.z, sourceSize, neighborSize)
    };

    position[face.axis] = face.direction > 0 ? 0 : neighborSize - 1;

    return Boolean(neighborVoxel.get(position.x, position.y, position.z)?.active);
  }

  mapMicroxelCoordinate(value, sourceSize, targetSize) {
    const normalizedCenter = (value + 0.5) / sourceSize;

    return Math.max(0, Math.min(targetSize - 1, Math.floor(normalizedCenter * targetSize)));
  }

  microxelFaceBounds(voxelPosition, face, plane, u, v, width, height, step) {
    return {
      plane: voxelPosition[face.axis] + plane * step,
      uStart: voxelPosition[face.u] + u * step,
      vStart: voxelPosition[face.v] + v * step,
      uEnd: voxelPosition[face.u] + (u + width) * step,
      vEnd: voxelPosition[face.v] + (v + height) * step
    };
  }

  mergeFaceGroup(groups, face) {
    const merged = [];

    groups.forEach(group => {
      const consumed = new Set();
      const cells = [...group.cells.entries()]
        .map(([key, voxel]) => ({ key, voxel, ...this.parseCellKey(key) }))
        .sort((a, b) => a.v - b.v || a.u - b.u);

      cells.forEach(cell => {
        if (consumed.has(cell.key)) return;

        const width = this.findWidth(group.cells, consumed, cell);
        const height = this.findHeight(group.cells, consumed, cell, width);

        for (let v = cell.v; v < cell.v + height; v += 1) {
          for (let u = cell.u; u < cell.u + width; u += 1) {
            consumed.add(this.cellKey(u, v));
          }
        }

        merged.push({
          ...face,
          plane: group.plane,
          color: group.color,
          uStart: cell.u,
          vStart: cell.v,
          uEnd: cell.u + width,
          vEnd: cell.v + height,
          voxel: cell.voxel
        });
      });
    });

    return merged;
  }

  findWidth(cells, consumed, cell) {
    let width = 0;

    while (cells.has(this.cellKey(cell.u + width, cell.v))
      && !consumed.has(this.cellKey(cell.u + width, cell.v))) {
      width += 1;
    }

    return width;
  }

  findHeight(cells, consumed, cell, width) {
    let height = 1;

    while (this.canExtendHeight(cells, consumed, cell, width, height)) {
      height += 1;
    }

    return height;
  }

  canExtendHeight(cells, consumed, cell, width, height) {
    for (let u = cell.u; u < cell.u + width; u += 1) {
      const key = this.cellKey(u, cell.v + height);

      if (!cells.has(key) || consumed.has(key)) return false;
    }

    return true;
  }

  createCorners(face) {
    const min = { [face.u]: face.uStart, [face.v]: face.vStart, [face.axis]: face.plane };
    const max = { [face.u]: face.uEnd, [face.v]: face.vEnd, [face.axis]: face.plane };

    if (face.axis === "x" && face.direction > 0) {
      return [
        { x: face.plane, y: min.y, z: min.z },
        { x: face.plane, y: max.y, z: min.z },
        { x: face.plane, y: max.y, z: max.z },
        { x: face.plane, y: min.y, z: max.z }
      ];
    }

    if (face.axis === "x") {
      return [
        { x: face.plane, y: min.y, z: max.z },
        { x: face.plane, y: max.y, z: max.z },
        { x: face.plane, y: max.y, z: min.z },
        { x: face.plane, y: min.y, z: min.z }
      ];
    }

    if (face.axis === "y" && face.direction > 0) {
      return [
        { x: min.x, y: face.plane, z: max.z },
        { x: max.x, y: face.plane, z: max.z },
        { x: max.x, y: face.plane, z: min.z },
        { x: min.x, y: face.plane, z: min.z }
      ];
    }

    if (face.axis === "y") {
      return [
        { x: min.x, y: face.plane, z: min.z },
        { x: max.x, y: face.plane, z: min.z },
        { x: max.x, y: face.plane, z: max.z },
        { x: min.x, y: face.plane, z: max.z }
      ];
    }

    if (face.direction > 0) {
      return [
        { x: max.x, y: min.y, z: face.plane },
        { x: max.x, y: max.y, z: face.plane },
        { x: min.x, y: max.y, z: face.plane },
        { x: min.x, y: min.y, z: face.plane }
      ];
    }

    return [
      { x: min.x, y: min.y, z: face.plane },
      { x: min.x, y: max.y, z: face.plane },
      { x: max.x, y: max.y, z: face.plane },
      { x: max.x, y: min.y, z: face.plane }
    ];
  }

  pushFaceVertices(face, positions, normals, colors, color, shade = 1) {
    const corners = this.createCorners(face);

    corners.forEach(point => {
      positions.push(
        point.x + this.renderOffset.x,
        point.y + this.renderOffset.y,
        point.z + this.renderOffset.z
      );
      normals.push(face.normal.x, face.normal.y, face.normal.z);
      colors.push(color.r * shade, color.g * shade, color.b * shade);
    });
  }

  faceShade(normal) {
    const dot = this.lightDirection.x * normal.x
      + this.lightDirection.y * normal.y
      + this.lightDirection.z * normal.z;

    const light = Math.pow((dot + 1) * 0.5, this.shade.power);

    return THREE.MathUtils.clamp(
      this.shade.min + (this.shade.max - this.shade.min) * light,
      0.04,
      1.35
    );
  }


  normalizeLodMode(mode = "full-detail") {
    if (mode === "minimal-detail") return "minimal-detail";
    if (mode === "medium-detail") return "medium-detail";

    return "full-detail";
  }

  shouldRenderVoxelAsMicroxels(voxel = null) {
    return Boolean(this.lodMode === "full-detail" && voxel?.hasMicroxels?.());
  }

  voxelColor(voxel = null) {
    if (!voxel) return "#ffffff";
    if (!voxel.hasMicroxels?.() || this.lodMode === "full-detail") return voxel.color || "#ffffff";

    return this.dominantMicroxelColor(voxel);
  }

  dominantMicroxelColor(voxel = null) {
    const counts = new Map();
    const size = Number(voxel?.microxelSize) || 0;

    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        for (let z = 0; z < size; z += 1) {
          const microxel = voxel.get?.(x, y, z);

          if (!microxel?.active) continue;

          const color = microxel.color || voxel.color || "#ffffff";
          counts.set(color, (counts.get(color) || 0) + 1);
        }
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0]
      || voxel.color
      || "#ffffff";
  }

  cellKey(u, v) {
    return u * 1024 + v;
  }

  parseCellKey(key) {
    return {
      u: Math.floor(key / 1024),
      v: key % 1024
    };
  }

  colorToRgb(color = "#ffffff") {
    if (!this.colorCache.has(color)) this.colorCache.set(color, colorToRgb(color));

    return this.colorCache.get(color);
  }
}

function microxelPositionPlane(position, face) {
  return position[face.axis] + (face.direction > 0 ? 1 : 0);
}

function voxelKey(position) {
  return `${position.x},${position.y},${position.z}`;
}

function colorToRgb(color = "#ffffff") {
  return new THREE.Color(color);
}

export default BoxelMesher;
