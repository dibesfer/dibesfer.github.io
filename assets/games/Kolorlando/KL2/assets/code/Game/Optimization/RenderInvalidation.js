export class RenderInvalidation {
  static Flags = {
    RENDER: "render",
    CHUNKS: "chunks",
    RAYCAST: "raycast",
    MESH: "mesh"
  };

  constructor() {
    this.flags = new Set();
    this.reasons = new Map();
  }

  mark(flag = RenderInvalidation.Flags.RENDER, reason = "unknown") {
    this.flags.add(flag);
    this.reasons.set(flag, reason);
    return this;
  }

  markRender(reason = "render") {
    return this.mark(RenderInvalidation.Flags.RENDER, reason);
  }

  markChunks(reason = "chunks") {
    return this.mark(RenderInvalidation.Flags.CHUNKS, reason).markRender(reason);
  }

  markRaycast(reason = "raycast") {
    return this.mark(RenderInvalidation.Flags.RAYCAST, reason);
  }

  markMesh(reason = "mesh") {
    return this.mark(RenderInvalidation.Flags.MESH, reason)
      .markChunks(reason)
      .markRaycast(reason);
  }

  markEdit(reason = "edit") {
    return this.markMesh(reason).markRender(reason);
  }

  has(flag = null) {
    return flag ? this.flags.has(flag) : this.flags.size > 0;
  }

  consume(flag = null) {
    if (!flag) {
      const snapshot = this.snapshot();
      this.clear();
      return snapshot;
    }

    const active = this.flags.has(flag);
    const reason = this.reasons.get(flag) || null;

    this.flags.delete(flag);
    this.reasons.delete(flag);

    return { active, reason };
  }

  clear(flag = null) {
    if (!flag) {
      this.flags.clear();
      this.reasons.clear();
      return this;
    }

    this.flags.delete(flag);
    this.reasons.delete(flag);
    return this;
  }

  snapshot() {
    return {
      flags: [...this.flags],
      reasons: Object.fromEntries(this.reasons)
    };
  }
}

export default RenderInvalidation;
