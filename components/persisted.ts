"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

const PREFIX = "hsm:";

/**
 * useState that survives reloads via localStorage, per viewer and browser.
 * The server render and first client render use `initial` (so hydration
 * matches); the saved value is applied right after mount. Storage can be
 * unavailable (private mode, blocked site data), so every access is guarded
 * and the chart simply falls back to its defaults.
 */
export function usePersisted<T>(
  key: string | undefined,
  initial: T,
  codec: { encode: (v: T) => unknown; decode: (raw: unknown) => T | undefined } = {
    encode: (v) => v,
    decode: (raw) => raw as T,
  },
) {
  const [value, setValue] = useState<T>(initial);
  // Only save what the viewer actually changed, so changing a default in the
  // code still reaches people who never touched that control.
  const dirty = useRef(false);
  const codecRef = useRef(codec);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw != null) {
        const v = codecRef.current.decode(JSON.parse(raw));
        if (v !== undefined) setValue(v);
      }
    } catch {
      // Ignore unreadable or corrupt entries.
    }
  }, [key]);

  useEffect(() => {
    if (!key || !dirty.current) return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(codecRef.current.encode(value)));
    } catch {
      // Storage full or disabled: settings just won't persist.
    }
  }, [key, value]);

  const update = useCallback((next: SetStateAction<T>) => {
    dirty.current = true;
    setValue(next);
  }, []);

  return [value, update] as const;
}

/** Forget every saved chart setting on this device. */
export function resetPersisted() {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Nothing to clear.
  }
}

/** A value restricted to a known set of options. */
export function usePersistedChoice<T extends string>(key: string | undefined, initial: T, options: readonly T[]) {
  return usePersisted<T>(key, initial, {
    encode: (v) => v,
    decode: (raw) => (options.includes(raw as T) ? (raw as T) : undefined),
  });
}

/** A Set of strings, e.g. hidden series. */
export function usePersistedSet<T extends string = string>(key: string | undefined) {
  return usePersisted<Set<T>>(key, new Set<T>(), {
    encode: (v) => [...v],
    decode: (raw) => (Array.isArray(raw) ? new Set(raw.filter((x): x is T => typeof x === "string")) : undefined),
  });
}
