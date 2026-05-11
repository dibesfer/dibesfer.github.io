export class RemeshDebouncer {
  constructor() {
    this.pending = new Map();
  }

  add() {}
  flush() {}
  clear() { this.pending.clear(); }
  hasWork() { return false; }
}

export default RemeshDebouncer;
