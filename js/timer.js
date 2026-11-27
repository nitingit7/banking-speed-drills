/**
 * timer.js
 * Timestamp-based timer utilities.
 * Uses Date.now() differences so accuracy is maintained when the tab is hidden.
 */

const Timer = (() => {
  // Active interval handles, keyed by timer id
  const _handles = {};
  let _idCounter = 0;

  /**
   * Create a countdown timer.
   * @param {object} opts
   * @param {number} opts.endTimestamp   – absolute ms timestamp when timer ends
   * @param {function} opts.onTick       – called every second with { secondsLeft }
   * @param {function} opts.onExpire     – called when time is up
   * @returns {string} timerId (use to stop)
   */
  function createCountdown({ endTimestamp, onTick, onExpire }) {
    const id = `timer_${++_idCounter}`;
    const getEnd = typeof endTimestamp === 'function' ? endTimestamp : () => endTimestamp;

    function tick() {
      const endVal = getEnd();
      const left = Math.max(0, Math.round((endVal - Date.now()) / 1000));
      if (typeof onTick === 'function') onTick({ secondsLeft: left });
      if (left <= 0) {
        clearInterval(_handles[id]);
        delete _handles[id];
        if (typeof onExpire === 'function') onExpire();
      }
    }

    // Run immediately then every second
    tick();
    _handles[id] = setInterval(tick, 1000);
    return id;
  }

  /**
   * Stop a countdown by its id.
   * @param {string} id
   */
  function stop(id) {
    if (_handles[id]) {
      clearInterval(_handles[id]);
      delete _handles[id];
    }
  }

  /**
   * Stop all active timers.
   */
  function stopAll() {
    Object.keys(_handles).forEach(stop);
  }

  /**
   * Format seconds as MM:SS.
   * @param {number} secs
   * @returns {string}
   */
  function formatMMSS(secs) {
    if (secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Format seconds as standard duration:
   * under 60 seconds "34s", 60 seconds or more "2m34s" (no space), one hour or more "1h05m12s".
   * @param {number} secs
   * @returns {string}
   */
  function formatDuration(secs) {
    if (secs == null || isNaN(secs) || secs < 0) secs = 0;
    secs = Math.round(secs);
    if (secs < 60) {
      return `${secs}s`;
    }
    if (secs < 3600) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m${String(s).padStart(2, '0')}s`;
    }
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
  }

  /**
   * Format seconds as a human readable duration (delegates to formatDuration).
   * @param {number} secs
   * @returns {string}
   */
  function formatHuman(secs) {
    return formatDuration(secs);
  }

  /**
   * Compute how many seconds are left given an end timestamp.
   * @param {number} endTimestamp
   * @returns {number} seconds remaining (>= 0)
   */
  function secondsLeft(endTimestamp) {
    return Math.max(0, Math.round((endTimestamp - Date.now()) / 1000));
  }

  /**
   * Create a count-up stopwatch for question time tracking.
   * @param {function} onTick – called every second with { elapsed }
   * @returns {string} timerId
   */
  function createStopwatch(onTick) {
    const id = `sw_${++_idCounter}`;
    const startMs = Date.now();

    function tick() {
      const elapsed = Math.round((Date.now() - startMs) / 1000);
      if (typeof onTick === 'function') onTick({ elapsed });
    }

    tick();
    _handles[id] = setInterval(tick, 1000);
    return id;
  }

  if (typeof window !== 'undefined') {
    window.formatDuration = formatDuration;
  }

  return {
    createCountdown,
    createStopwatch,
    stop,
    stopAll,
    formatMMSS,
    formatDuration,
    formatHuman,
    secondsLeft,
  };
})();
