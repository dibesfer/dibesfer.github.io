export class Binarier {
  constructor(options = {}) {
    this.magic = options.magic ?? 'KL3B';
    this.version = options.version ?? 1;
    this.mimeType = options.mimeType ?? 'application/octet-stream';
  }

  async encode(data = {}) {
    const json = JSON.stringify(data);
    const rawPayload = new TextEncoder().encode(json);
    const canCompress = typeof CompressionStream !== 'undefined';
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
      throw new Error('Invalid KL3 binary file.');
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
    if (typeof CompressionStream === 'undefined') {
      return bytes.buffer;
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));

    return new Response(stream).arrayBuffer();
  }

  async decompress(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot decompress KL3 binary files.');
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));

    return new Response(stream).arrayBuffer();
  }
}

export default Binarier;
