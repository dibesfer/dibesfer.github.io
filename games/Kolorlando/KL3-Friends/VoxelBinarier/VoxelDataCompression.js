// /assets/code/Game/Optimization/Data/VoxelDataCompression.js

const MAGIC = [75, 76, 50, 86]; // KL2V
const VERSION = 1;

const KIND = {
  VOXEL: 1
};

const MODE = {
  RAW4: 1,
  RLE4: 2
};

const RLE_MAX_RUN = 65535;

export class VoxelDataCompression {
  static encode_json_text(json_text) {
    return this.encode_voxel(JSON.parse(json_text));
  }

  static decode_json_text(bytes_like, space = 2) {
    return JSON.stringify(this.decode_voxel(bytes_like), null, space);
  }

  static encode_voxel(voxel) {
    const clean_voxel = this.clean_voxel(voxel);
    const size = this.get_size(clean_voxel);
    const palette = this.get_palette(clean_voxel, size);
    const metadata = this.get_metadata(clean_voxel);
    const values = this.voxel_to_values(clean_voxel, size, palette);

    const palette_bytes = this.palette_to_bytes(palette);
    const metadata_bytes = this.text_to_bytes(JSON.stringify(metadata));
    const best = this.best_body(values);

    const header = this.write_header({
      kind: KIND.VOXEL,
      mode: best.mode,
      size,
      palette_length: palette.length,
      metadata_length: metadata_bytes.length
    });

    return this.concat(header, palette_bytes, metadata_bytes, best.bytes);
  }

  static decode_voxel(bytes_like) {
    const bytes = this.as_bytes(bytes_like);
    const header = this.read_header(bytes);

    if (header.kind !== KIND.VOXEL) {
      throw new Error("Only voxel binary data is supported here.");
    }

    const palette_start = header.offset;
    const palette_end = palette_start + header.palette_length * 3;
    const metadata_start = palette_end;
    const metadata_end = metadata_start + header.metadata_length;
    const body_start = metadata_end;

    const palette = this.bytes_to_palette(bytes.slice(palette_start, palette_end));
    const metadata = JSON.parse(this.bytes_to_text(bytes.slice(metadata_start, metadata_end)));
    const body = bytes.slice(body_start);
    const count = header.size ** 3;
    const values = this.unpack_body(body, count, header.mode);

    return {
      ...metadata,
      type: header.size > 1 ? "microxeled" : metadata.type || "colored",
      microxelSize: header.size,
      microxels: this.values_to_microxels(values, header.size, palette),
      active: values.some(value => value !== 0)
    };
  }

  static is_binary(value) {
    try {
      const bytes = this.as_bytes(value);

      return MAGIC.every((byte, index) => bytes[index] === byte);
    } catch {
      return false;
    }
  }

  static smart_decode(value) {
    if (typeof value === "string") {
      const text = value.trim();

      if (text.startsWith("{")) return JSON.parse(text);
      return this.decode_voxel(this.base64_to_bytes(text));
    }

    return this.decode_voxel(value);
  }

  static to_base64(bytes_like) {
    const bytes = this.as_bytes(bytes_like);
    let text = "";

    bytes.forEach(byte => {
      text += String.fromCharCode(byte);
    });

    return btoa(text);
  }

  static from_base64(text) {
    return this.base64_to_bytes(text);
  }

  static to_byte_text(bytes_like) {
    return [...this.as_bytes(bytes_like)].join(",");
  }

  static from_byte_text(text) {
    return new Uint8Array(
      String(text)
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(value => Number(value) & 255)
    );
  }

  static report(voxel_or_json_text) {
    const voxel = typeof voxel_or_json_text === "string"
      ? JSON.parse(voxel_or_json_text)
      : voxel_or_json_text;

    const json_bytes = this.text_to_bytes(JSON.stringify(voxel)).length;
    const binary = this.encode_voxel(voxel);
    const header = this.read_header(binary);

    return {
      jsonBytes: json_bytes,
      binaryBytes: binary.length,
      savedBytes: json_bytes - binary.length,
      ratio: binary.length / Math.max(1, json_bytes),
      mode: this.mode_name(header.mode)
    };
  }

  static clean_voxel(voxel) {
    if (!voxel || typeof voxel !== "object") {
      throw new Error("Invalid voxel JSON.");
    }

    return voxel.toJSON?.() || voxel;
  }

  static get_metadata(voxel) {
    const { microxels, ...metadata } = voxel;

    return {
      format: metadata.format || "voxel-editor",
      version: metadata.version || 1,
      ...metadata
    };
  }

  static get_size(voxel) {
    const size = Number(voxel.microxelSize || 1);

    if (!Number.isInteger(size) || size < 1 || size > 255) {
      throw new Error("Voxel microxelSize must be an integer from 1 to 255.");
    }

    return size;
  }

  static get_palette(voxel, size) {
    const colors = [];

    this.each_cell(voxel, size, cell => {
      if (!this.is_active(cell)) return;

      const color = this.clean_color(cell?.color || voxel.color || "#ffffff");

      if (!colors.includes(color)) colors.push(color);
    });

    if (colors.length > 15) {
      throw new Error("RAW4/RLE4 supports air + 15 colors max.");
    }

    return colors;
  }

  static voxel_to_values(voxel, size, palette) {
    const values = [];

    this.each_cell(voxel, size, cell => {
      if (!this.is_active(cell)) {
        values.push(0);
        return;
      }

      const color = this.clean_color(cell?.color || voxel.color || "#ffffff");
      const index = palette.indexOf(color);

      values.push(index >= 0 ? index + 1 : 0);
    });

    return values;
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

  static each_cell(voxel, size, callback) {
    const grid = voxel.microxels || null;

    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        for (let z = 0; z < size; z += 1) {
          callback(grid?.[x]?.[y]?.[z] || voxel, x, y, z);
        }
      }
    }
  }

  static is_active(cell) {
    return Boolean(cell?.active ?? cell?.filled ?? true);
  }

  static best_body(values) {
    const raw4 = this.pack_raw4(values);
    const rle4 = this.pack_rle4(values);

    if (rle4.length < raw4.length) {
      return {
        mode: MODE.RLE4,
        bytes: rle4
      };
    }

    return {
      mode: MODE.RAW4,
      bytes: raw4
    };
  }

  static unpack_body(bytes, count, mode) {
    if (mode === MODE.RAW4) return this.unpack_raw4(bytes, count);
    if (mode === MODE.RLE4) return this.unpack_rle4(bytes, count);

    throw new Error(`Unsupported voxel compression mode: ${mode}`);
  }

  static pack_raw4(values) {
    const bytes = new Uint8Array(Math.ceil(values.length / 2));

    values.forEach((value, index) => {
      const byte_index = Math.floor(index / 2);

      if (index % 2 === 0) bytes[byte_index] |= value << 4;
      else bytes[byte_index] |= value;
    });

    return bytes;
  }

  static unpack_raw4(bytes, count) {
    const values = [];

    for (let index = 0; index < count; index += 1) {
      const byte = bytes[Math.floor(index / 2)] ?? 0;

      values.push(index % 2 === 0 ? byte >> 4 : byte & 15);
    }

    return values;
  }

  static pack_rle4(values) {
    const runs = [];

    let index = 0;

    while (index < values.length) {
      const value = values[index] & 15;
      let count = 1;

      while (
        index + count < values.length
        && values[index + count] === value
        && count < RLE_MAX_RUN
      ) {
        count += 1;
      }

      runs.push(value, count >> 8, count & 255);
      index += count;
    }

    return new Uint8Array(runs);
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

  static write_header({ kind, mode, size, palette_length, metadata_length }) {
    const bytes = new Uint8Array(13);

    bytes.set(MAGIC, 0);
    bytes[4] = VERSION;
    bytes[5] = kind;
    bytes[6] = mode;
    bytes[7] = size;
    bytes[8] = palette_length;
    this.write_u32(bytes, 9, metadata_length);

    return bytes;
  }

  static read_header(bytes) {
    if (!MAGIC.every((byte, index) => bytes[index] === byte)) {
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

  static palette_to_bytes(palette) {
    const bytes = new Uint8Array(palette.length * 3);

    palette.forEach((color, index) => {
      const [r, g, b] = this.hex_to_rgb(color);
      const offset = index * 3;

      bytes[offset] = r;
      bytes[offset + 1] = g;
      bytes[offset + 2] = b;
    });

    return bytes;
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

  static write_u32(bytes, offset, value) {
    bytes[offset] = value >>> 24;
    bytes[offset + 1] = value >>> 16;
    bytes[offset + 2] = value >>> 8;
    bytes[offset + 3] = value;
  }

  static read_u32(bytes, offset) {
    return (
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    ) >>> 0;
  }

  static text_to_bytes(text) {
    return new TextEncoder().encode(text);
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

  static base64_to_bytes(text) {
    const binary = atob(String(text).trim());
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  static mode_name(mode) {
    if (mode === MODE.RAW4) return "RAW4";
    if (mode === MODE.RLE4) return "RLE4";

    return "UNKNOWN";
  }

  static clean_color(color = "#ffffff") {
    return String(color).trim().toLowerCase();
  }

  static hex_to_rgb(color) {
    const hex = this.clean_color(color).replace("#", "");

    return [
      parseInt(hex.slice(0, 2), 16) || 0,
      parseInt(hex.slice(2, 4), 16) || 0,
      parseInt(hex.slice(4, 6), 16) || 0
    ];
  }

  static rgb_to_hex(r = 0, g = 0, b = 0) {
    return `#${[r, g, b]
      .map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
      .join("")}`;
  }
}

export default VoxelDataCompression;