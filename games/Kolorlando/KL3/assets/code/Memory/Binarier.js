export class Binarier {
    constructor(options = {}) {
        this.magic = options.magic ?? "KL3B";
        this.version = options.version ?? 1;
        this.mimeType = options.mimeType ?? "application/octet-stream";
    }

    async encode(data = {}) {
        const json = JSON.stringify(data);
        const rawPayload = new TextEncoder().encode(json);
        const canCompress = typeof CompressionStream !== "undefined";
        const payload = canCompress
            ? new Uint8Array(await this.compress(rawPayload))
            : rawPayload;
        const header = this.createHeader(canCompress ? 1 : 0);
        const bytes = new Uint8Array(header.length + payload.length);

        bytes.set(header, 0);
        bytes.set(payload, header.length);

        return new Blob([bytes], { type: this.mimeType });
    }

    async decode(blobOrBuffer) {
        const buffer = blobOrBuffer instanceof Blob
            ? await blobOrBuffer.arrayBuffer()
            : blobOrBuffer;
        const bytes = new Uint8Array(buffer);
        const header = this.readHeader(bytes);
        const payload = bytes.slice(header.headerLength);
        const rawPayload = header.compression === 1
            ? new Uint8Array(await this.decompress(payload))
            : payload;
        const json = new TextDecoder().decode(rawPayload);

        return JSON.parse(json);
    }

    createHeader(compression = 0) {
        const magicBytes = new TextEncoder().encode(this.magic);
        const header = new Uint8Array(6);

        header.set(magicBytes.slice(0, 4), 0);
        header[4] = this.version;
        header[5] = compression;

        return header;
    }

    readHeader(bytes) {
        const magic = new TextDecoder().decode(bytes.slice(0, 4));

        if (magic !== this.magic) {
            throw new Error("Invalid KL3 binary file.");
        }

        const version = bytes[4];
        if (version !== this.version) {
            throw new Error(`Unsupported KL3 binary version: ${version}`);
        }

        return {
            version,
            compression: bytes[5],
            headerLength: 6,
        };
    }

    async compress(bytes) {
        if (typeof CompressionStream === "undefined") {
            return bytes.buffer;
        }

        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));

        return new Response(stream).arrayBuffer();
    }

    async decompress(bytes) {
        if (typeof DecompressionStream === "undefined") {
            throw new Error("This browser cannot decompress KL3 .woxel files.");
        }

        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));

        return new Response(stream).arrayBuffer();
    }

    static typedArrayToBinaryData(typedArray = new Uint8Array()) {
        const type = Binarier.getTypedArrayName(typedArray);
        const bytes = typedArray instanceof Uint8Array
            ? typedArray
            : new Uint8Array(typedArray.buffer.slice(
                typedArray.byteOffset,
                typedArray.byteOffset + typedArray.byteLength
            ));

        return {
            encoding: `${type}-base64`,
            type,
            length: typedArray.length,
            byteLength: bytes.byteLength,
            data: Binarier.bytesToBase64(bytes),
        };
    }

    static typedArrayFromBinaryData(data = {}, fallbackType = "uint8") {
        if (!data) return Binarier.createTypedArray([], fallbackType);

        const type = Binarier.getBinaryDataType(data, fallbackType);
        const bytes = Binarier.base64ToBytes(data.data ?? "");

        if (type === "uint16") {
            const alignedLength = bytes.byteLength - (bytes.byteLength % 2);
            const buffer = bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + alignedLength
            );

            return new Uint16Array(buffer).slice(0, data.length ?? undefined);
        }

        return bytes.slice(0, data.length ?? undefined);
    }

    static createTypedArray(values = [], type = "uint8") {
        return Binarier.normalizeTypedArrayName(type) === "uint16"
            ? Uint16Array.from(values)
            : Uint8Array.from(values);
    }

    static getBinaryDataType(data = {}, fallbackType = "uint8") {
        if (data.type) return Binarier.normalizeTypedArrayName(data.type);

        const encoding = String(data.encoding ?? "");
        if (encoding) {
            return Binarier.normalizeTypedArrayName(encoding.replace("-base64", ""));
        }

        return Binarier.normalizeTypedArrayName(fallbackType);
    }

    static bytesToBase64(bytes = new Uint8Array()) {
        if (typeof Buffer !== "undefined") {
            return Buffer.from(bytes).toString("base64");
        }

        let binary = "";
        const chunkSize = 0x8000;

        for (let index = 0; index < bytes.length; index += chunkSize) {
            const chunk = bytes.subarray(index, index + chunkSize);
            binary += String.fromCharCode(...chunk);
        }

        return btoa(binary);
    }

    static base64ToBytes(base64 = "") {
        if (!base64) return new Uint8Array();

        if (typeof Buffer !== "undefined") {
            return new Uint8Array(Buffer.from(base64, "base64"));
        }

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }

        return bytes;
    }

    static getTypedArrayName(typedArray = new Uint8Array()) {
        if (typedArray instanceof Uint16Array) return "uint16";

        return "uint8";
    }

    static normalizeTypedArrayName(value = "uint8") {
        const text = String(value).toLowerCase();

        return text.includes("16") ? "uint16" : "uint8";
    }
}

export default Binarier;
