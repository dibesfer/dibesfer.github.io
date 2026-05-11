// /assets/code/Memory/Memory.js

import Boxel from "../Wabavam/Boxel/Boxel.js";
import BoxelFile from "../Wabavam/Boxel/BoxelFile.js";
import WoxelFile from "../Wabavam/Woxel/WoxelFile.js";

export class Memory {
  constructor(worldName = "Example", storage = new IndexedDbMemoryStore()) {
    this.worldName = worldName;
    this.storage = storage;
    this.prefix = `KL2.world.${worldName}`;
    this.boxelIndexKey = "KL2.boxels.index";
    this.legacyBoxelsKey = "KL2.boxels";
    this.boxelPrefix = "KL2.boxel";
  }

  async loadWoxel() {
    const value = await this.read(`${this.prefix}.woxel`);

    if (!value) return null;

    try {
      return this.validateWoxelData(WoxelFile.decode(value));
    } catch (error) {
      console.warn("Woxel binary load failed, trying legacy JSON", error);
      return this.validateWoxelData(value);
    }
  }

  async saveWoxel(woxel, patches = null) {
    const data = this.serializeWoxel(woxel, patches);

    return this.write(`${this.prefix}.woxel`, WoxelFile.encode(data));
  }

  async saveWoxelData(data) {
    const woxel = this.validateWoxelData(data);

    return this.write(`${this.prefix}.woxel`, WoxelFile.encode(woxel));
  }

  exportWoxelFile(woxel, patches = null) {
    const data = this.serializeWoxel(woxel, patches);
    const bytes = WoxelFile.encode(data);
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = `${this.fileSafeName(data.name || this.worldName)}.woxel`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);

    return data;
  }

  async importWoxelFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const data = this.validateWoxelData(
      WoxelFile.isBinary(bytes)
        ? WoxelFile.decode(bytes)
        : JSON.parse(new TextDecoder().decode(bytes))
    );

    await Promise.all([
      this.write(`${this.prefix}.woxel`, WoxelFile.encode(data)),
      this.storage.remove(`${this.prefix}.player`)
    ]);

    return data;
  }

  async loadPlayer() {
    return this.read(`${this.prefix}.player`);
  }

  async savePlayer(player) {
    if (!player) return;

    return this.write(`${this.prefix}.player`, {
      position: this.position(player.position),
      rotation: this.rotation(player.rotation),
      cameraDirection: player.cameraDirection
    });
  }

  async loadBoxels() {
    const names = await this.loadBoxelNames();
    const boxels = {};

    await Promise.all(names.map(async name => {
      const boxel = await this.loadBoxel(name);

      if (boxel) boxels[name] = boxel;
    }));

    return {
      ...await this.loadLegacyBoxels(),
      ...boxels
    };
  }

  async loadBoxelNames() {
    const index = await this.read(this.boxelIndexKey);

    if (Array.isArray(index)) return index;

    return Object.keys(await this.loadLegacyBoxels());
  }

  async loadLegacyBoxels() {
    const legacy = await this.read(this.legacyBoxelsKey);

    return legacy && typeof legacy === "object" && !this.isByteLike(legacy)
      ? legacy
      : {};
  }

  async loadBoxel(name = "") {
    const cleanName = this.cleanBoxelName(name);
    if (!cleanName) return null;

    const value = await this.read(this.boxelKey(cleanName));

    if (value) {
      try {
        return new Boxel(BoxelFile.decode(value));
      } catch (error) {
        console.warn("Boxel binary load failed", cleanName, error);
      }
    }

    const legacy = await this.loadLegacyBoxels();
    const legacyBoxel = legacy[cleanName] || null;

    return legacyBoxel ? new Boxel(legacyBoxel) : null;
  }

  async saveBoxel(name = "", boxel) {
    const cleanName = this.cleanBoxelName(name || boxel?.name || "");
    if (!cleanName || !boxel) return false;
    if (await this.loadBoxel(cleanName)) return false;

    const boxelData = this.serializeBoxel({ ...boxel, name: cleanName });

    await Promise.all([
      this.write(this.boxelKey(cleanName), BoxelFile.encode(boxelData)),
      this.addBoxelName(cleanName)
    ]);

    return true;
  }

  async addBoxelName(name = "") {
    const cleanName = this.cleanBoxelName(name);
    const names = new Set(await this.loadBoxelNames());

    names.add(cleanName);

    return this.write(this.boxelIndexKey, [...names].sort((a, b) => a.localeCompare(b)));
  }

  async clearWorld() {
    try {
      await Promise.all([
        this.storage.remove(`${this.prefix}.woxel`),
        this.storage.remove(`${this.prefix}.player`)
      ]);
    } catch (error) {
      console.warn("Memory clear failed", this.prefix, error);
    }
  }

  serializeWoxel(woxel, patches = null) {
    return this.validateWoxelData({
      format: "KL2.patchWoxel",
      version: 1,
      name: this.worldName,
      size: this.position(woxel.size),
      land: this.position(woxel.land),
      landVoxel: woxel.landVoxel?.toJSON?.() || woxel.landVoxel,
      spawnPosition: this.position(woxel.spawnPosition),
      patches: patches || { placed: [], removed: [] }
    });
  }

  validateWoxelData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid .woxel file");
    }
    if (data.format && data.format !== "KL2.patchWoxel") {
      throw new Error("Unsupported .woxel format");
    }

    const size = this.position(data.size);
    const hasValidSize = size.x > 0 && size.y > 0 && size.z > 0;
    const safeSize = hasValidSize ? size : { x: 1000, y: 1000, z: 1000 };

    const land = this.position(data.land);
    const hasValidLand = land.x > 0 && land.y > 0 && land.z > 0;
    const safeLand = hasValidLand
      ? land
      : { x: safeSize.x, y: Math.min(50, safeSize.y), z: safeSize.z };

    return {
      ...data,
      format: data.format || "KL2.patchWoxel",
      version: data.version || 1,
      name: data.name || this.worldName,
      size: safeSize,
      land: safeLand,
      landVoxel: data.landVoxel || null,
      spawnPosition: this.position(data.spawnPosition || { x: 0, y: safeLand.y + 3, z: 0 }),
      patches: data.patches || { placed: [], removed: [] }
    };
  }

  fileSafeName(name = "world") {
    return String(name).trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "world";
  }

  cleanBoxelName(name = "") {
    return String(name).trim();
  }

  boxelKey(name = "") {
    return `${this.boxelPrefix}.${encodeURIComponent(name)}`;
  }

  serializeBoxel(boxel) {
    return {
      name: boxel.name || "",
      persisted: true,
      position: this.position(boxel.position),
      voxels: (boxel.voxels || []).map(voxel => this.serializeVoxel(voxel))
    };
  }

  serializeVoxel(voxel) {
    if (voxel?.hasMicroxels?.() || voxel?.type === "textured" || (voxel?.shape && voxel.shape !== "voxel")) {
      return voxel?.toJSON ? voxel.toJSON() : voxel;
    }

    return {
      id: voxel.id,
      name: voxel.name,
      position: this.position(voxel.position),
      solid: voxel.solid,
      color: voxel.color,
      ...(voxel.active === false ? { active: false } : {})
    };
  }

  async read(key) {
    try {
      const value = await this.storage.get(key);

      return value !== undefined && value !== null ? value : null;
    } catch (error) {
      console.warn("Memory read failed", key, error);
      return null;
    }
  }

  async write(key, value) {
    try {
      await this.storage.set(key, value);
    } catch (error) {
      if (error?.name === "QuotaExceededError") {
        try {
          await this.storage.remove(key);
          await this.storage.set(key, value);
          return;
        } catch (retryError) {
          console.warn("Memory write failed after cleanup", key, retryError);
          return;
        }
      }
      console.warn("Memory write failed", key, error);
    }
  }

  isByteLike(value) {
    return value instanceof Uint8Array
      || value instanceof ArrayBuffer
      || ArrayBuffer.isView(value);
  }

  position(position = {}) {
    return {
      x: Math.floor(Number(position.x) || 0),
      y: Math.floor(Number(position.y) || 0),
      z: Math.floor(Number(position.z) || 0)
    };
  }

  rotation(rotation = {}) {
    return {
      x: rotation.x || 0,
      y: rotation.y || 0,
      z: rotation.z || 0
    };
  }
}

export class IndexedDbMemoryStore {
  constructor(databaseName = "KL2.memory", storeName = "entries") {
    this.databaseName = databaseName;
    this.storeName = storeName;
    this.database = this.open();
  }

  open() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.databaseName, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    return this.request("readonly", store => store.get(key));
  }

  async set(key, value) {
    return this.request("readwrite", store => store.put(value, key));
  }

  async remove(key) {
    return this.request("readwrite", store => store.delete(key));
  }

  async request(mode, createRequest) {
    const database = await this.database;

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, mode);
      const request = createRequest(transaction.objectStore(this.storeName));
      let result = null;

      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export default Memory;



