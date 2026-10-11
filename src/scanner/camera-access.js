const preferenceKey = 'morphiq-camera';

// Preferences remember the UX choice, never a substitute for browser permission.
export function createCameraAccess(onChange) {
  let preferences = { automatic: true, used: false, blocked: false };
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    for (const key of Object.keys(preferences)) {
      if (typeof saved?.[key] === 'boolean') preferences[key] = saved[key];
    }
  } catch {
    // The reader also works when storage is unavailable or contains invalid JSON.
  }
  let permission = null,
    pending = null,
    state = 'unknown';
  const save = (change) => {
    Object.assign(preferences, change);
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    } catch {
      // Keep the preference for this session when persistent storage is blocked.
    }
  };
  function changed() {
    state = permission.state;
    if (state === 'denied') save({ blocked: true });
    if (state === 'granted' || state === 'prompt') save({ blocked: false });
    onChange(state);
  }
  async function refresh() {
    if (!pending) {
      pending = (async () => {
        try {
          const next = await navigator.permissions.query({ name: 'camera' });
          if (next !== permission) {
            permission?.removeEventListener?.('change', changed);
            permission = next;
            permission.addEventListener?.('change', changed);
          }
          state = permission.state;
          if (state === 'denied') save({ blocked: true });
          if (state === 'granted' || state === 'prompt') save({ blocked: false });
        } catch {
          // Some browsers do not support querying the camera permission.
          state = 'unknown';
        }
        return state;
      })().finally(() => {
        pending = null;
      });
    }
    let timeout;
    try {
      // PermissionStatus is advisory. Some mobile shells leave query() unresolved;
      // it must never prevent getUserMedia() or an explicit user-activated retry.
      return await Promise.race([
        pending,
        new Promise((resolve) => {
          timeout = setTimeout(() => resolve(state), 400);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    get state() {
      return state;
    },
    get automatic() {
      return preferences.automatic;
    },
    get used() {
      return preferences.used;
    },
    get blocked() {
      return preferences.blocked;
    },
    setAutomatic: (automatic) => save({ automatic }),
    recordSuccess: () => save({ used: true, blocked: false }),
    recordDenial: () => save({ blocked: true }),
    refresh,
  };
}
