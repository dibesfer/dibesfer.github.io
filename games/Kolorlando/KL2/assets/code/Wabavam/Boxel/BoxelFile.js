// /assets/code/Wabavam/Boxel/BoxelFile.js

const MAGIC = [75, 76, 50, 66]; // KL2B
const VERSION = 1;

const KIND = {
  BOXEL: 2
};

const MODE = {
  RAW8: 1,
  RLE8: 2
};

const RLE_MAX_RUN = 65535;

export class BoxelFile {
  static encode(boxel) {
    const cleanBoxel = this.cleanBoxel(boxel);
    const bounds = this.bounds(cleanBoxel.voxels);
    const size = this.boundsSize(bounds);
    const { bank, values } = this.boxelToBankAndValues(cleanBoxel, bounds, size);
    const best = this.bestBody(values);

    const metadata = {
      format: "KL2.boxel",
      version: VERSION,
      name: cleanBoxel.name || "",
      persisted: cleanBoxel.persisted !== false,
      position: this.position(cleanBoxel.position),
      bounds,
      voxelBank: bank
    };

    const metadataBytes = this.textToBytes(JSON.stringify(metadata));
    const header = this.writeHeader({
      mode: best.mode,
      width: size.x,
      height: size.y,
      depth: size.z,
      metadataLength: metadataBytes.length
    });

    return this.concat(header, metadataBytes, best.bytes);
  }

  static decode(value) {
    if (value === null || value === undefined) return null;

    if (this.isJsonLike(value)) return this.decodeJson(value);

    const bytes = this.asBytes(value);
    const header = this.readHeader(bytes);
    const metadataStart = header.offset;
    const metadataEnd = metadataStart + header.metadataLength;
    const bodyStart = metadataEnd;
    const metadata = JSON.parse(this.bytesToText(bytes.slice(metadataStart, metadataEnd)));
    const count = header.width * header.height * header.depth;
    const values = this.unpackBody(bytes.slice(bodyStart), count, header.mode);

    return {
      name: metadata.name || "",
      persisted: metadata.persisted !== false,
      position: this.position(metadata.position),
      voxels: this.valuesToVoxels(values, metadata, header)
    };
  }

  static decodeJson(value) {
    if (typeof value === "string") return JSON.parse(value);
    return value;
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

  static cleanBoxel(boxel) {
    if (!boxel || typeof boxel !== "object") throw new Error("Invalid boxel.");

    return {
      name: boxel.name || "",
      persisted: boxel.persisted !== false,
      position: this.position(boxel.position),
      voxels: (boxel.voxels || []).map(voxel => voxel?.toJSON?.() || voxel)
    };
  }

  static boxelToBankAndValues(boxel, bounds, size) {
    const bank = [];
    const bankKeys = new Map();
    const values = new Uint8Array(size.x * size.y * size.z);

    boxel.voxels.forEach(voxel => {
      if (!voxel || voxel.active === false) return;

      const position = this.position(voxel.position);
      const local = {
        x: position.x - bounds.min.x,
        y: position.y - bounds.min.y,
        z: position.z - bounds.min.z
      };

      if (!this.inside(local, size)) return;

      const prototype = this.voxelPrototype(voxel);
      const key = JSON.stringify(prototype);
      let index = bankKeys.get(key);

      if (!index) {
        if (bank.length >= 255) {
          throw new Error("Boxel binary supports air + 255 voxel prototypes max.");
        }

        bank.push(prototype);
        index = bank.length;
        bankKeys.set(key, index);
      }

      values[this.localIndex(local, size)] = index;
    });

    return { bank, values };
  }

  static valuesToVoxels(values, metadata, header) {
    const bounds = metadata.bounds || this.emptyBounds(metadata.position);
    const bank = metadata.voxelBank || [];
    const size = { x: header.width, y: header.height, z: header.depth };
    const voxels = [];

    for (let x = 0; x < size.x; x += 1) {
      for (let y = 0; y < size.y; y += 1) {
        for (let z = 0; z < size.z; z += 1) {
          const value = values[this.localIndex({ x, y, z }, size)];
          if (value === 0) continue;

          const prototype = bank[value - 1];
          if (!prototype) continue;

          voxels.push({
            ...this.cloneData(prototype),
            position: {
              x: bounds.min.x + x,
              y: bounds.min.y + y,
              z: bounds.min.z + z
            },
            active: prototype.active !== false
          });
        }
      }
    }

    return voxels;
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

  static bounds(voxels = []) {
    const activeVoxels = voxels.filter(voxel => voxel && voxel.active !== false);

    if (activeVoxels.length === 0) return this.emptyBounds();

    return activeVoxels.reduce((bounds, voxel) => {
      const position = this.position(voxel.position);

      return {
        min: {
          x: Math.min(bounds.min.x, position.x),
          y: Math.min(bounds.min.y, position.y),
          z: Math.min(bounds.min.z, position.z)
        },
        max: {
          x: Math.max(bounds.max.x, position.x),
          y: Math.max(bounds.max.y, position.y),
          z: Math.max(bounds.max.z, position.z)
        }
      };
    }, {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    });
  }

  static emptyBounds(position = { x: 0, y: 0, z: 0 }) {
    const clean = this.position(position);

    return {
      min: clean,
      max: { ...clean }
    };
  }

  static boundsSize(bounds) {
    const size = {
      x: Math.max(1, bounds.max.x - bounds.min.x + 1),
      y: Math.max(1, bounds.max.y - bounds.min.y + 1),
      z: Math.max(1, bounds.max.z - bounds.min.z + 1)
    };

    if (size.x > 255 || size.y > 255 || size.z > 255) {
      throw new Error("Boxel binary bounds are limited to 255 cells per axis.");
    }

    return size;
  }

  static inside(position, size) {
    return position.x >= 0 && position.y >= 0 && position.z >= 0
      && position.x < size.x && position.y < size.y && position.z < size.z;
  }

  static localIndex(position, size) {
    return position.x * size.y * size.z + position.y * size.z + position.z;
  }

  static bestBody(values) {
    const raw = this.packRaw8(values);
    const rle = this.packRle8(values);

    if (rle.length < raw.length) {
      return { mode: MODE.RLE8, bytes: rle };
    }

    return { mode: MODE.RAW8, bytes: raw };
  }

  static unpackBody(bytes, count, mode) {
    if (mode === MODE.RAW8) return this.unpackRaw8(bytes, count);
    if (mode === MODE.RLE8) return this.unpackRle8(bytes, count);

    throw new Error(`Unsupported boxel binary mode: ${mode}`);
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

      while (index + count < values.length && values[index + count] === value && count < RLE_MAX_RUN) {
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
        if (cursor >= count) throw new Error("RLE8 boxel data exceeds expected cell count.");
        values[cursor++] = value;
      }
    }

    if (cursor !== count) throw new Error("RLE8 boxel data does not match expected cell count.");

    return values;
  }

  static writeHeader({ mode, width, height, depth, metadataLength }) {
    const bytes = new Uint8Array(14);

    bytes.set(MAGIC, 0);
    bytes[4] = VERSION;
    bytes[5] = KIND.BOXEL;
    bytes[6] = mode;
    bytes[7] = width;
    bytes[8] = height;
    bytes[9] = depth;
    this.writeU32(bytes, 10, metadataLength);

    return bytes;
  }

  static readHeader(bytes) {
    if (!this.isBinary(bytes)) throw new Error("Invalid KL2 boxel binary.");

    const version = bytes[4];
    if (version !== VERSION) throw new Error(`Unsupported KL2 boxel binary version: ${version}`);
    if (bytes[5] !== KIND.BOXEL) throw new Error("Invalid boxel binary kind.");

    return {
      version,
      kind: bytes[5],
      mode: bytes[6],
      width: bytes[7],
      height: bytes[8],
      depth: bytes[9],
      metadataLength: this.readU32(bytes, 10),
      offset: 14
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

export default BoxelFile;
