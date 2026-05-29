import * as THREE from "three";
import Boxel from "./Boxel.js";
import BoxelMesher from "../../Game/Optimization/Meshing/BoxelMesher.js";
import Voxel from "../Voxel/Voxel.js";

export class BoxelTool {
  constructor({ editor, name = "BoxelTool", color = 0xffffff, opacity = 0.2 } = {}) {
    this.editor = editor;
    this.name = name;
    this.color = color;
    this.opacity = opacity;
    this.first = null;
    this.second = null;
    this.mesh = this.createMesh();
    this.mesh.name = name;
    this.editor?.scene?.add(this.mesh);
    this.hide();
  }

  createMesh() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: this.color,
        opacity: this.opacity,
        transparent: true,
        depthWrite: false
      })
    );

    mesh.raycast = () => { };
    return mesh;
  }

  begin(position) {
    this.first = clonePosition(position);
    this.second = clonePosition(position);
    this.sync();
  }

  update(position) {
    if (!this.first) return;

    this.second = clonePosition(position || this.first);
    this.sync();
  }

  bounds() {
    if (!this.first) return null;

    const second = this.second || this.first;

    return normalizeBounds(this.first, second);
  }

  sync() {
    const bounds = this.bounds();

    if (!bounds) {
      this.hide();
      return;
    }

    this.drawBounds(bounds);
  }

  drawBounds(bounds) {
    const mapper = this.editor?.mapper;
    if (!mapper) return this.hide();

    const size = boundsSize(bounds);
    const center = mapper.toRenderPosition({
      x: bounds.min.x + (size.x - 1) / 2,
      y: bounds.min.y + (size.y - 1) / 2,
      z: bounds.min.z + (size.z - 1) / 2
    });

    const padding = this.editor?.padding ?? 0.1;

    this.mesh.position.set(center.x, center.y, center.z);
    this.mesh.scale.set(
      size.x + padding,
      size.y + padding,
      size.z + padding
    );
    this.mesh.visible = true;
  }

  hide() {
    this.mesh.visible = false;
  }

  clear() {
    this.first = null;
    this.second = null;
    this.hide();
  }
}

export class BlueBoxel extends BoxelTool {
  constructor(editor) {
    super({ editor, name: "BlueBoxel", color: 0x000fff, opacity: 0.2 });
  }
}

export class GreenBoxel extends BoxelTool {
  constructor(editor) {
    super({ editor, name: "GreenBoxel", color: 0x00ff66, opacity: 0.22 });
  }

  commit(voxel) {
    const bounds = this.bounds();
    if (!bounds || !voxel) return null;

    return this.editor?.mapper?.placeBounds(bounds, voxel) || null;
  }
}

export class RedBoxel extends BoxelTool {
  constructor(editor) {
    super({ editor, name: "RedBoxel", color: 0xff1f1f, opacity: 0.22 });
  }

  commit() {
    const bounds = this.bounds();
    if (!bounds) return null;

    return this.editor?.mapper?.removeTerrainBounds(bounds) || null;
  }
}

export class BoxelEditor {
  constructor({ scene, mapper } = {}) {
    this.scene = scene;
    this.mapper = mapper;
    this.active = false;
    this.mode = "selection";
    this.first = null;
    this.second = null;

    this.easyEdit = null;
    this.tools = {
      blue: new BlueBoxel(this),
      green: new GreenBoxel(this),
      red: new RedBoxel(this)
    };

    this.placementSourceBoxel = null;
    this.placementBoxel = null;
    this.placementAnchor = null;
    this.placementOrientationKey = null;

    this.lastBlueprintKey = null;
    this.padding = 0.1;
    this.hoverOpacity = 0.25;
    this.blueBoxelOpacity = 0.2;

    this.blueprintVoxel = {
      id: "blueprint",
      name: "blueprint",
      solid: true,
      color: "#000fff"
    };

    this.blueprintMesher = new BoxelMesher({
      isSolid: position => this.blueprintVoxelKeys?.has(this.mapper.voxelKey(position)),
      renderOffset: this.mapper.renderOffset()
    });

    this.hover = this.createBox(1 + this.padding, this.hoverOpacity, 0x000fff);
    this.hover.name = "BoxelEditorHover";

    this.blueBoxel = this.tools.blue.mesh;
    this.greenBoxel = this.tools.green.mesh;
    this.redBoxel = this.tools.red.mesh;

    this.blueprint = null;
    this.blueprintVoxelKeys = new Set();

    this.scene?.add(this.hover);
    this.clear();
  }

  toggle() {
    this.setActive(!this.active);
  }

  setActive(active) {
    this.active = active;
    if (!active) this.clear();
  }

  update(hit, orientation = null) {
    if (this.easyEdit) {
      this.updateEasyEdit(hit);
      return;
    }

    if (!this.active) return;

    if (this.isPlacementMode()) {
      this.syncPlacementOrientation(orientation);
      this.updatePlacement(hit);
      return;
    }

    const position = this.hitPosition(hit, false);

    if (!position) {
      this.hover.visible = false;
      return;
    }

    this.placeUnitBox(this.hover, position);
    this.hover.visible = true;
  }

  onMouseDown(event, hit) {
    if (!this.active) return false;
    if (this.isPlacementMode()) return this.onPlacementMouseDown(event, hit);

    const position = this.hitPosition(hit, event.button === 2);

    if (!position) {
      this.clearBlueSelection();
      return true;
    }

    if (!this.first) this.first = position;
    else if (!this.second) this.second = position;
    else {
      this.first = this.second;
      this.second = position;
    }

    this.updateBlueBoxel();
    return { handled: true };
  }

  beginEasyEdit({ button = 2, hit = null, voxel = null } = {}) {
    if (this.isPlacementMode()) return { handled: false };

    const kind = button === 0 ? "red" : "green";
    const useFacingVoxel = kind === "green";
    const tool = this.tools[kind];

    if (kind === "green" && !voxel) return { handled: false };

    const position = this.hitPosition(hit, useFacingVoxel);
    if (!position) return { handled: false };

    this.clearEasyEdit();
    this.hover.visible = false;

    this.easyEdit = {
      kind,
      tool,
      voxel,
      useFacingVoxel
    };

    tool.begin(position);
    return { handled: true };
  }

  updateEasyEdit(hit = null) {
    if (!this.easyEdit) return { handled: false };

    const position = this.hitPosition(hit, this.easyEdit.useFacingVoxel);
    if (!position) return { handled: true };

    this.easyEdit.tool.update(position);
    return { handled: true };
  }

  endEasyEdit() {
    if (!this.easyEdit) return { handled: false };

    const { kind, tool, voxel } = this.easyEdit;
    const boxels = kind === "green"
      ? tool.commit(voxel)
      : tool.commit();

    this.clearEasyEdit();

    return {
      handled: true,
      boxels
    };
  }

  clearEasyEdit() {
    this.easyEdit = null;
    this.tools.green.clear();
    this.tools.red.clear();
  }

  isEasyEditing() {
    return Boolean(this.easyEdit);
  }

  isVisualEditing() {
    return Boolean(this.active || this.easyEdit);
  }

  hitPosition(hit, useFacingVoxel = false) {
    const voxel = this.mapper?.hitVoxel(hit);
    if (!voxel) return null;

    const position = { ...voxel.position };

    if (useFacingVoxel && hit.face) {
      position.x += Math.round(hit.face.normal.x);
      position.y += Math.round(hit.face.normal.y);
      position.z += Math.round(hit.face.normal.z);
    }

    return this.mapper.contains(position) ? position : null;
  }

  updateBlueBoxel() {
    if (!this.first) {
      this.tools.blue.hide();
      return;
    }

    this.tools.blue.first = clonePosition(this.first);
    this.tools.blue.second = clonePosition(this.second || this.first);
    this.tools.blue.sync();
  }

  createSelectedBoxel(name = "", orientation = null) {
    if (!this.blueBoxel.visible || !this.first) return null;

    const bounds = this.selectionBounds();
    const voxels = [];

    for (let x = bounds.min.x; x <= bounds.max.x; x += 1) {
      for (let y = bounds.min.y; y <= bounds.max.y; y += 1) {
        for (let z = bounds.min.z; z <= bounds.max.z; z += 1) {
          const position = { x, y, z };
          const voxel = this.mapper?.voxels.get(this.mapper.voxelKey(position));

          if (!voxel) continue;

          const voxelData = voxel.toJSON?.() || voxel;

          voxels.push(new Voxel({
            ...voxelData,
            position: {
              x: voxel.position.x - bounds.min.x,
              y: voxel.position.y - bounds.min.y,
              z: voxel.position.z - bounds.min.z
            }
          }));
        }
      }
    }

    return new Boxel({ name, position: bounds.min, orientation: null, voxels })
      .normalizedForSave(orientation);
  }

  loadPlacementBoxel(boxel, hit = null, orientation = null) {
    if (!this.active || !boxel?.voxels?.length) return false;

    this.clearEasyEdit();
    this.placementSourceBoxel = new Boxel({
      name: boxel.name,
      persisted: boxel.persisted,
      position: { ...boxel.position },
      orientation: null,
      voxels: boxel.voxels.map(voxel => new Voxel(voxel.toJSON?.() || voxel))
    });

    this.mode = "placement";
    this.placementBoxel = null;
    this.placementAnchor = null;
    this.placementOrientationKey = null;
    this.lastBlueprintKey = null;
    this.first = null;
    this.second = null;

    this.hover.visible = false;
    this.tools.blue.hide();

    this.syncPlacementOrientation(orientation);
    this.updatePlacement(hit);

    return true;
  }

  syncPlacementOrientation(orientation = null) {
    if (!this.placementSourceBoxel) return;

    const key = this.orientationKey(orientation);
    if (key === this.placementOrientationKey && this.placementBoxel) return;

    this.placementOrientationKey = key;

    this.placementBoxel = this.placementSourceBoxel.orientedForPlacement(orientation);
    this.placementAnchor = this.placementAnchorOffset();
    this.lastBlueprintKey = null;

    this.createBlueprint();
  }

  orientationKey(orientation = null) {
    if (!orientation) return "none";

    return [
      orientation.direction ?? "",
      orientation.steps ?? "",
      orientation.yaw ?? ""
    ].join(":");
  }

  onPlacementMouseDown(event, hit) {
    if (event.button === 0) {
      this.endPlacement();
      return { handled: true };
    }

    const position = this.hitPosition(hit, true);
    if (!position) return { handled: true };

    const anchor = this.anchorPosition(position);
    if (!this.canPlacePlacement(anchor)) return { handled: true };

    return {
      handled: true,
      placement: {
        boxel: this.placementBoxel,
        anchor
      }
    };
  }

  updatePlacement(hit) {
    if (!this.placementBoxel || !this.placementAnchor) return;

    const position = this.hitPosition(hit, true);

    if (!position) {
      if (this.blueprint) this.blueprint.visible = false;
      return;
    }

    this.drawBlueprint(this.anchorPosition(position));
  }

  endPlacement() {
    this.mode = "selection";
    this.placementSourceBoxel = null;
    this.placementBoxel = null;
    this.placementAnchor = null;
    this.placementOrientationKey = null;
    this.lastBlueprintKey = null;

    if (this.blueprint) this.blueprint.visible = false;
  }

  isPlacementMode() {
    return this.mode === "placement";
  }

  anchorPosition(position) {
    return {
      x: position.x - this.placementAnchor.x,
      y: position.y - this.placementAnchor.y,
      z: position.z - this.placementAnchor.z
    };
  }

  placementAnchorOffset() {
    const bounds = this.boxelBounds(this.placementBoxel);

    return {
      x: bounds.min.x + Math.floor((bounds.max.x - bounds.min.x) / 2),
      y: bounds.min.y,
      z: bounds.min.z + Math.floor((bounds.max.z - bounds.min.z) / 2)
    };
  }

  canPlacePlacement(anchor) {
    return this.placementBoxel?.voxels?.every(voxel => this.mapper.contains({
      x: anchor.x + voxel.position.x,
      y: anchor.y + voxel.position.y,
      z: anchor.z + voxel.position.z
    })) || false;
  }

  drawBlueprint(anchor) {
    if (!this.canPlacePlacement(anchor)) {
      if (this.blueprint) this.blueprint.visible = false;
      this.lastBlueprintKey = null;
      return;
    }

    const key = [
      this.placementOrientationKey,
      this.mapper.voxelKey(anchor)
    ].join("|");

    if (key === this.lastBlueprintKey && this.blueprint?.visible) return;

    this.createBlueprint(anchor);
    if (!this.blueprint) return;

    this.blueprint.visible = true;
    this.lastBlueprintKey = key;
  }

  createBlueprint(anchor = { x: 0, y: 0, z: 0 }) {
    if (this.blueprint) {
      this.scene?.remove(this.blueprint);
      this.blueprint.geometry?.dispose?.();
    }

    if (!this.placementBoxel) return;

    this.blueprint = this.blueprintMesher.createChunkMesh(this.createBlueprintBoxel(anchor));
    if (!this.blueprint) return;

    this.blueprint.name = "BlueBoxelBlueprint";
    this.blueprint.raycast = () => { };
    this.blueprint.frustumCulled = false;
    this.blueprint.material.opacity = this.blueBoxelOpacity;
    this.blueprint.material.transparent = true;
    this.blueprint.material.depthWrite = false;
    this.blueprint.visible = false;

    this.scene?.add(this.blueprint);
  }

  createBlueprintBoxel(anchor) {
    const voxels = this.placementBoxel.voxels.map(voxel => new Voxel({
      ...this.blueprintVoxel,
      position: {
        x: anchor.x + voxel.position.x,
        y: anchor.y + voxel.position.y,
        z: anchor.z + voxel.position.z
      }
    }));

    this.blueprintVoxelKeys = new Set(voxels.map(voxel => this.mapper.voxelKey(voxel.position)));

    return new Boxel({ position: anchor, orientation: null, voxels });
  }

  boxelBounds(boxel) {
    if (!boxel?.voxels?.length) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }

    return boxel.voxels.reduce((bounds, voxel) => ({
      min: {
        x: Math.min(bounds.min.x, voxel.position.x),
        y: Math.min(bounds.min.y, voxel.position.y),
        z: Math.min(bounds.min.z, voxel.position.z)
      },
      max: {
        x: Math.max(bounds.max.x, voxel.position.x),
        y: Math.max(bounds.max.y, voxel.position.y),
        z: Math.max(bounds.max.z, voxel.position.z)
      }
    }), {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    });
  }

  selectionBounds() {
    const second = this.second || this.first;

    return normalizeBounds(this.first, second);
  }

  placeUnitBox(mesh, position) {
    const renderPosition = this.mapper.toRenderPosition(position);

    mesh.position.set(renderPosition.x, renderPosition.y, renderPosition.z);
    mesh.scale.set(1 + this.padding, 1 + this.padding, 1 + this.padding);
  }

  createBox(size, opacity, color = 0x000fff) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial({
        color,
        opacity,
        transparent: true,
        depthWrite: false
      })
    );

    mesh.raycast = () => { };
    return mesh;
  }

  clearBlueSelection() {
    this.first = null;
    this.second = null;
    this.tools.blue.clear();
  }

  clear() {
    this.clearBlueSelection();
    this.clearEasyEdit();
    this.mode = "selection";

    this.placementSourceBoxel = null;
    this.placementBoxel = null;
    this.placementAnchor = null;
    this.placementOrientationKey = null;
    this.lastBlueprintKey = null;

    this.hover.visible = false;

    if (this.blueprint) this.blueprint.visible = false;
  }
}

function clonePosition(position = {}) {
  return {
    x: Math.floor(Number(position.x) || 0),
    y: Math.floor(Number(position.y) || 0),
    z: Math.floor(Number(position.z) || 0)
  };
}

function normalizeBounds(first = {}, second = first) {
  const a = clonePosition(first);
  const b = clonePosition(second);

  return {
    min: {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      z: Math.min(a.z, b.z)
    },
    max: {
      x: Math.max(a.x, b.x),
      y: Math.max(a.y, b.y),
      z: Math.max(a.z, b.z)
    }
  };
}

function boundsSize(bounds) {
  return {
    x: bounds.max.x - bounds.min.x + 1,
    y: bounds.max.y - bounds.min.y + 1,
    z: bounds.max.z - bounds.min.z + 1
  };
}

export default BoxelEditor;

