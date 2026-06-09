/**
 * eventBus.js  —  EVENT_SYSTEM
 * -----------------------------------------------------------------------------
 * The single decoupling layer between the roulette GAME and the COMPANION.
 *
 * The game NEVER calls the widget directly and the widget NEVER reaches into
 * the game. They only ever talk through this tiny pub/sub bus. That keeps the
 * character logic 100% independent from the roulette implementation — you can
 * delete roulette.js and drop in any other game that emits the same events.
 *
 * Contract (the only thing both sides agree on):
 *   Game  -> emits  "roulette:event"  { type, payload }
 *   where type is one of: WIN | LOSE | BIG_WIN | IDLE
 *
 * Generic helpers (on/off/emit/once) make it reusable for anything else too.
 */

(function () {
  const cfg = (window.YUKI_CONFIG && window.YUKI_CONFIG.EVENT_SYSTEM) || {};
  const DEBUG = !!cfg.debug;

  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  function on(eventName, handler) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);
    return () => off(eventName, handler); // returns an unsubscribe fn
  }

  function once(eventName, handler) {
    const wrapped = (data) => {
      off(eventName, wrapped);
      handler(data);
    };
    return on(eventName, wrapped);
  }

  function off(eventName, handler) {
    const set = listeners.get(eventName);
    if (set) set.delete(handler);
  }

  function emit(eventName, data) {
    if (DEBUG) console.log(`[EVENT_SYSTEM] ${eventName}`, data ?? "");
    const set = listeners.get(eventName);
    if (!set) return;
    // Copy to allow handlers to unsubscribe during dispatch.
    [...set].forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EVENT_SYSTEM] handler for "${eventName}" threw:`, err);
      }
    });
  }

  // The canonical game-event channel name + the valid roulette outcomes.
  const ROULETTE_EVENT = "roulette:event";
  const ROULETTE_TYPES = Object.freeze({
    WIN: "WIN",
    LOSE: "LOSE",
    BIG_WIN: "BIG_WIN",
    IDLE: "IDLE",
  });

  // Convenience wrappers so callers don't hand-type the channel string.
  function emitRoulette(type, payload = {}) {
    emit(ROULETTE_EVENT, { type, payload, at: Date.now() });
  }
  function onRoulette(handler) {
    return on(ROULETTE_EVENT, handler);
  }

  window.EventBus = {
    on,
    once,
    off,
    emit,
    ROULETTE_EVENT,
    ROULETTE_TYPES,
    emitRoulette,
    onRoulette,
  };
})();
