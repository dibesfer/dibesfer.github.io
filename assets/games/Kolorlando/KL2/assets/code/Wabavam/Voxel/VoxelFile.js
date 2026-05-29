// /assets/code/Wabavam/Voxel/VoxelFile.js

const MAGIC = [75, 76, 50, 86]; // KL2V
const VERSION = 1;

const KIND = {
  VOXEL: 1
};

const MODE = {
  RAW4: 1,
  RLE4: 2
};

export class VoxelFile {
  static async load(path) {
    const response = await fetch(path, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Voxel file could not be loaded: ${path}`);
    }

    return this.decode(await response.arrayBuffer());
  }

  static decode(buffer) {
    const bytes = this.as_bytes(buffer);

    if (this.is_binary(bytes)) {
      return this.decode_binary(bytes);
    }

    return this.decode_json(bytes);
  }

  static decode_json(bytes) {
    return JSON.parse(this.bytes_to_text(bytes));
  }

  static decode_binary(bytes) {
    const header = this.read_header(bytes);

    if (header.kind !== KIND.VOXEL) {
      throw new Error("Invalid voxel binary kind.");
    }

    const palette_start = header.offset;
    const palette_end = palette_start + header.palette_length * 3;

    const metadata_start = palette_end;
    const metadata_end = metadata_start + header.metadata_length;

    const body_start = metadata_end;

    const palette = this.bytes_to_palette(bytes.slice(palette_start, palette_end));
    const metadata = JSON.parse(this.bytes_to_text(bytes.slice(metadata_start, metadata_end)));
    const values = this.unpack_body(bytes.slice(body_start), header.size ** 3, header.mode);

    return {
      ...metadata,
      type: header.size > 1 ? "microxeled" : metadata.type || "colored",
      microxelSize: header.size,
      microxels: this.values_to_microxels(values, header.size, palette),
      active: values.some(value => value !== 0)
    };
  }

  static is_binary(bytes_like) {
    const bytes = this.as_bytes(bytes_like);

    return MAGIC.every((value, index) => bytes[index] === value);
  }

  static read_header(bytes) {
    if (!this.is_binary(bytes)) {
      throw new Error("Invalid KL2 voxel binary.");
    }

    const version = bytes[4];

    if (version !== VERSION) {
      throw new Error(`Unsupported KL2 voxel binary version: ${version}`);
    }

    return {
      version,
      kind: bytes[5],
      mode: bytes[6],
      size: bytes[7],
      palette_length: bytes[8],
      metadata_length: this.read_u32(bytes, 9),
      offset: 13
    };
  }

  static values_to_microxels(values, size, palette) {
    const microxels = Array.from({ length: size }, () =>
      Array.from({ length: size }, () =>
        Array.from({ length: size }, () => null)
      )
    );

    let index = 0;

    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        for (let z = 0; z < size; z += 1) {
          const value = values[index++];
          const active = value !== 0;

          microxels[x][y][z] = {
            position: { x, y, z },
            color: active ? palette[value - 1] : "#ffffff",
            active
          };
        }
      }
    }

    return microxels;
  }

  static unpack_body(bytes, count, mode) {
    if (mode === MODE.RAW4) return this.unpack_raw4(bytes, count);
    if (mode === MODE.RLE4) return this.unpack_rle4(bytes, count);

    throw new Error(`Unsupported voxel binary mode: ${mode}`);
  }

  static unpack_raw4(bytes, count) {
    const values = [];

    for (let index = 0; index < count; index += 1) {
      const byte = bytes[Math.floor(index / 2)] ?? 0;

      values.push(index % 2 === 0 ? byte >> 4 : byte & 15);
    }

    return values;
  }

  static unpack_rle4(bytes, count) {
    const values = [];

    for (let index = 0; index < bytes.length; index += 3) {
      const value = bytes[index] & 15;
      const run = (bytes[index + 1] << 8) | bytes[index + 2];

      for (let n = 0; n < run; n += 1) {
        values.push(value);

        if (values.length > count) {
          throw new Error("RLE4 voxel data exceeds expected voxel count.");
        }
      }
    }

    if (values.length !== count) {
      throw new Error("RLE4 voxel data does not match expected voxel count.");
    }

    return values;
  }

  static bytes_to_palette(bytes) {
    const palette = [];

    for (let index = 0; index < bytes.length; index += 3) {
      palette.push(this.rgb_to_hex(
        bytes[index],
        bytes[index + 1],
        bytes[index + 2]
      ));
    }

    return palette;
  }

  static read_u32(bytes, offset) {
    return (
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    ) >>> 0;
  }

  static bytes_to_text(bytes) {
    return new TextDecoder().decode(bytes);
  }

  static as_bytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (Array.isArray(value)) return new Uint8Array(value);

    throw new Error("Expected Uint8Array, ArrayBuffer, or byte array.");
  }

  static rgb_to_hex(r = 0, g = 0, b = 0) {
    return `#${[r, g, b]
      .map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
      .join("")}`;
  }
}

export default VoxelFile;