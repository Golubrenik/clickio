class EventEmitter {
  listeners = new Map();

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event);
    listeners.push(callback);
    this.listeners.set(event, listeners);

    return this;
  }

  async emit(event, ...data) {
    const listeners = this.listeners.get(event);

    if (!listeners) {
      if (Object.hasOwn(this, event)) {
        return this[event](...data);
      }
      return null;
    }

    for (let i = 0; i < listeners.length; i++) {
      const callback = listeners.at(i);

      if (listeners.length === 1) {
        return callback.call(this, ...data);
      }

      await callback.call(this, ...data);
    }
  }
}

window.EventEmitter = EventEmitter;
