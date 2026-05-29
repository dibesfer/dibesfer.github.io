// /assets/code/Wabavam/Woxel/WoxelFile.js

const MAGIC = [75, 76, 50, 87]; // KL2W
const VERSION = 1;

const KIND = {
  WOXEL: 3
};

const MODE = {
  RAW8: 1,
  RLE8: 2,
  RAW32: 3,
  RLE32: 4
};

const RLE8_MAX_RUN = 65535;
const RLE32_MAX_RUN = 65535;

export class WoxelFile {
  static encode(woxelData) {
    const clean = this.cleanWoxelData(woxelData);
    const patches = clean.patches || { placed: [], removed: [] };
    const placed = this.sortedPlaced(patches.placed || []);
    const removed = this.sortedPositions(patches.removed || []);
    const voxelBankData = this.voxelBank(placed);
    const placedValues = voxelBankData.values;
    const placedPositions = placed.map(voxel => this.position(voxel.position));

    const placedValueBody = this.bestValueBody(placedValues);
    const placedPositionBody = this.bestPositionBody(placedPositions, clean.size);
    const removedPositionBody = this.bestPositionBody(removed, clean.size);

    const { patches: ignoredPatches, ...metadataSource } = clean;
    const metadata = {
      format: "KL2.patchWoxel",
      binaryFormat: "KL2.woxel",
      version: VERSION,
      ...metadataSource,
      patches: {
        placedCount: placed.length,
        removedCount: removed.length,
        voxelBank: voxelBankData.bank
      }
    };

    const metadataBytes = this.textToBytes(JSON.stringify(metadata));
    const header = this.writeHeader({
      placedValueMode: placedValueBody.mode,
      placedPositionMode: placedPositionBody.mode,
      removedPositionMode: removedPositionBody.mode,
      metadataLength: metadataBytes.length,
      placedValueLength: placedValueBody.bytes.length,
      placedPositionLength: placedPositionBody.bytes.length,
      removedPositionLength: removedPositionBody.bytes.length
    });

    return this.concat(
      header,
      metadataBytes,
      placedValueBody.bytes,
      placedPositionBody.bytes,
      removedPositionBody.bytes
    );
  }

  static decode(value) {
    if (value === null || value === undefined) return null;

    if (this.isJsonLike(value)) return this.decodeJson(value);

    const bytes = this.asBytes(value);
    const header = this.readHeader(bytes);
    const metadataStart = header.offset;
    const metadataEnd = metadataStart + header.metadataLength;
    const placedValueStart = metadataEnd;
    const placedValueEnd = placedValueStart + header.placedValueLength;
    const placedPositionStart = placedValueEnd;
    const placedPositionEnd = placedPositionStart + header.placedPositionLength;
    const removedPositionStart = placedPositionEnd;
    const removedPositionEnd = removedPositionStart + header.removedPositionLength;

    const metadata = JSON.parse(this.bytesToText(bytes.slice(metadataStart, metadataEnd)));
    const size = this.position(metadata.size || { x: 1, y: 1, z: 1 });
    const patchInfo = metadata.patches || {};
    const placedCount = patchInfo.placedCount || 0;
    const removedCount = patchInfo.removedCount || 0;
    const bank = patchInfo.voxelBank || [];

    const placedValues = this.unpackValueBody(
      bytes.slice(placedValueStart, placedValueEnd),
      placedCount,
      header.placedValueMode
    );
    const placedPositions = this.unpackPositionBody(
      bytes.slice(placedPositionStart, placedPositionEnd),
      placedCount,
      header.placedPositionMode,
      size
    );
    const removedPositions = this.unpackPositionBody(
      bytes.slice(removedPositionStart, removedPositionEnd),
      removedCount,
      header.removedPositionMode,
      size
    );

    const { patches: ignoredPatches, binaryFormat, ...woxel } = metadata;

    return {
      ...woxel,
      format: "KL2.patchWoxel",
      version: metadata.version || VERSION,
      patches: {
        placed: placedPositions.map((position, index) => ({
          ...this.cloneData(bank[placedValues[index] - 1] || {}),
          position,
          active: (bank[placedValues[index] - 1]?.active) !== false
        })),
        removed: removedPositions
      }
    };
  }

  static decodeJson(value) {
    const data = typeof value === "string" ? JSON.parse(value) : value;

    return this.cleanWoxelData(data);
  }

  static isBinary(value) {
    try {
      const bytes = this.asBytes(value);

      return MAGIC.every((byte, index) => bytes[index] === byte);
    } catch {
      return false;
    }
  }

  static isJsonLike(value) {
    if (typeof value === "string") return value.trim().startsWith("{");
    if (value && typeof value === "object" && !(value instanceof ArrayBuffer) && !(value instanceof Uint8Array)) return true;

    return false;
  }

  static cleanWoxelData(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid .woxel data.");
    if (data.format && data.format !== "KL2.patchWoxel") throw new Error("Unsupported .woxel format.");

    return {
      ...data,
      format: data.format || "KL2.patchWoxel",
      version: data.version || VERSION,
      name: data.name || "Example",
      size: this.position(data.size || { x: 1000, y: 1000, z: 1000 }),
      land: this.position(data.land || { x: 1000, y: 50, z: 1000 }),
      landVoxel: data.landVoxel || null,
      spawnPosition: this.position(data.spawnPosition || { x: 0, y: 53, z: 0 }),
      patches: data.patches || { placed: [], removed: [] }
    };
  }

  static sortedPlaced(placed = []) {
    return [...placed]
      .filter(voxel => voxel?.position)
      .sort((a, b) => {
        const voxelA = JSON.stringify(this.voxelPrototype(a));
        const voxelB = JSON.stringify(this.voxelPrototype(b));
        if (voxelA !== voxelB) return voxelA < voxelB ? -1 : 1;

        return this.comparePositions(a.position, b.position);
      });
  }

  static sortedPositions(positions = []) {
    const unique = new Map();

    positions.forEach(position => {
      const clean = this.position(position);
      unique.set(`${clean.x},${clean.y},${clean.z}`, clean);
    });

    return [...unique.values()].sort((a, b) => this.comparePositions(a, b));
  }

  static comparePositions(a, b) {
    return (a.x - b.x) || (a.y - b.y) || (a.z - b.z);
  }

  static voxelBank(placed = []) {
    const bank = [];
    const keys = new Map();
    const values = new Uint8Array(placed.length);

    placed.forEach((voxel, valueIndex) => {
      const prototype = this.voxelPrototype(voxel);
      const key = JSON.stringify(prototype);
      let index = keys.get(key);

      if (!index) {
        if (bank.length >= 255) throw new Error("Woxel binary supports air + 255 voxel prototypes max.");

        bank.push(prototype);
        index = bank.length;
        keys.set(key, index);
      }

      values[valueIndex] = index;
    });

    return { bank, values };
  }

  static voxelPrototype(voxel) {
    const { position, ...prototype } = voxel || {};

    return {
      id: prototype.id || prototype.name || "voxel",
      name: prototype.name || prototype.id || "voxel",
      solid: prototype.solid !== false,
      color: prototype.color || "#ffffff",
      ...prototype,
      active: prototype.active !== false
    };
  }

  static bestValueBody(values) {
    const raw = this.packRaw8(values);
    const rle = this.packRle8(values);

    return rle.length < raw.length
      ? { mode: MODE.RLE8, bytes: rle }
      : { mode: MODE.RAW8, bytes: raw };
  }

  static unpackValueBody(bytes, count, mode) {
    if (mode === MODE.RAW8) return this.unpackRaw8(bytes, count);
    if (mode === MODE.RLE8) return this.unpackRle8(bytes, count);

    throw new Error(`Unsupported woxel value mode: ${mode}`);
  }

  static bestPositionBody(positions, size) {
    const indexes = this.positionsToIndexes(positions, size);
    const raw = this.packRaw32(indexes);
    const rle = this.packRle32(indexes);

    return rle.length < raw.length
      ? { mode: MODE.RLE32, bytes: rle }
      : { mode: MODE.RAW32, bytes: raw };
  }

  static unpackPositionBody(bytes, count, mode, size) {
    if (mode === MODE.RAW32) return this.indexesToPositions(this.unpackRaw32(bytes, count), size);
    if (mode === MODE.RLE32) return this.indexesToPositions(this.unpackRle32(bytes, count), size);

    throw new Error(`Unsupported woxel position mode: ${mode}`);
  }

  static packRaw8(values) {
    return new Uint8Array(values);
  }

  static unpackRaw8(bytes, count) {
    const values = new Uint8Array(count);
    values.set(bytes.slice(0, count));
    return values;
  }

  static packRle8(values) {
    const runs = [];
    let index = 0;

    while (index < values.length) {
      const value = values[index] & 255;
      let count = 1;

      while (index + count < values.length && values[index + count] === value && count < RLE8_MAX_RUN) {
        count += 1;
      }

      runs.push(value, count >> 8, count & 255);
      index += count;
    }

    return new Uint8Array(runs);
  }

  static unpackRle8(bytes, count) {
    const values = new Uint8Array(count);
    let cursor = 0;

    for (let index = 0; index < bytes.length; index += 3) {
      const value = bytes[index] & 255;
      const run = (bytes[index + 1] << 8) | bytes[index + 2];

      for (let n = 0; n < run; n += 1) {
        if (cursor >= count) throw new Error("RLE8 woxel data exceeds expected count.");
        values[cursor++] = value;
      }
    }

    if (cursor !== count) throw new Error("RLE8 woxel data does not match expected count.");

    return values;
  }

  static positionsToIndexes(positions, size) {
    return positions.map(position => this.positionToIndex(position, size));
  }

  static indexesToPositions(indexes, size) {
    return indexes.map(index => this.indexToPosition(index, size));
  }

  static positionToIndex(position, size) {
    const clean = this.position(position);
    const sx = Math.max(1, size.x);
    const sy = Math.max(1, size.y);

    return (clean.x + sx * (clean.y + sy * clean.z)) >>> 0;
  }

  static indexToPosition(index, size) {
    const sx = Math.max(1, size.x);
    const sy = Math.max(1, size.y);
    const z = Math.floor(index / (sx * sy));
    const rest = index - z * sx * sy;
    const y = Math.floor(rest / sx);
    const x = rest - y * sx;

    return { x, y, z };
  }

  static packRaw32(values) {
    const bytes = new Uint8Array(values.length * 4);

    values.forEach((value, index) => this.writeU32(bytes, index * 4, value));
    return bytes;
  }

  static unpackRaw32(bytes, count) {
    const values = [];

    for (let index = 0; index < count; index += 1) {
      values.push(this.readU32(bytes, index * 4));
    }

    return values;
  }

  static packRle32(values) {
    const runs = [];
    let index = 0;

    while (index < values.length) {
      const start = values[index] >>> 0;
      let count = 1;

      while (
        index + count < values.length
        && values[index + count] === start + count
        && count < RLE32_MAX_RUN
      ) {
        count += 1;
      }

      const bytes = new Uint8Array(6);
      this.writeU32(bytes, 0, start);
      bytes[4] = count >> 8;
      bytes[5] = count & 255;
      runs.push(bytes);
      index += count;
    }

    return this.concat(...runs);
  }

  static unpackRle32(bytes, count) {
    const values = [];

    for (let index = 0; index < bytes.length; index += 6) {
      const start = this.readU32(bytes, index);
      const run = (bytes[index + 4] << 8) | bytes[index + 5];

      for (let n = 0; n < run; n += 1) {
        values.push(start + n);
        if (values.length > count) throw new Error("RLE32 position data exceeds expected count.");
      }
    }

    if (values.length !== count) throw new Error("RLE32 position data does not match expected count.");

    return values;
  }

  static writeHeader({
    placedValueMode,
    placedPositionMode,
    removedPositionMode,
    metadataLength,
    placedValueLength,
    placedPositionLength,
    removedPositionLength
  }) {
    const bytes = new Uint8Array(26);

    bytes.set(MAGIC, 0);
    bytes[4] = VERSION;
    bytes[5] = KIND.WOXEL;
    bytes[6] = placedValueMode;
    bytes[7] = placedPositionMode;
    bytes[8] = removedPositionMode;
    bytes[9] = 0;
    this.writeU32(bytes, 10, metadataLength);
    this.writeU32(bytes, 14, placedValueLength);
    this.writeU32(bytes, 18, placedPositionLength);
    this.writeU32(bytes, 22, removedPositionLength);

    return bytes;
  }

  static readHeader(bytes) {
    if (!this.isBinary(bytes)) throw new Error("Invalid KL2 woxel binary.");

    const version = bytes[4];
    if (version !== VERSION) throw new Error(`Unsupported KL2 woxel binary version: ${version}`);
    if (bytes[5] !== KIND.WOXEL) throw new Error("Invalid woxel binary kind.");

    return {
      version,
      kind: bytes[5],
      placedValueMode: bytes[6],
      placedPositionMode: bytes[7],
      removedPositionMode: bytes[8],
      metadataLength: this.readU32(bytes, 10),
      placedValueLength: this.readU32(bytes, 14),
      placedPositionLength: this.readU32(bytes, 18),
      removedPositionLength: this.readU32(bytes, 22),
      offset: 26
    };
  }

  static position(position = {}) {
    return {
      x: Math.floor(Number(position.x) || 0),
      y: Math.floor(Number(position.y) || 0),
      z: Math.floor(Number(position.z) || 0)
    };
  }

  static cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  static writeU32(bytes, offset, value) {
    bytes[offset] = value >>> 24;
    bytes[offset + 1] = value >>> 16;
    bytes[offset + 2] = value >>> 8;
    bytes[offset + 3] = value;
  }

  static readU32(bytes, offset) {
    return (
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    ) >>> 0;
  }

  static textToBytes(text) {
    return new TextEncoder().encode(text);
  }

  static bytesToText(bytes) {
    return new TextDecoder().decode(bytes);
  }

  static asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (Array.isArray(value)) return new Uint8Array(value);

    throw new Error("Expected Uint8Array, ArrayBuffer, or byte array.");
  }

  static concat(...chunks) {
    const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const result = new Uint8Array(size);
    let offset = 0;

    chunks.forEach(chunk => {
      result.set(chunk, offset);
      offset += chunk.length;
    });

    return result;
  }
}

export default WoxelFile;
