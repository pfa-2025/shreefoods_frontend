"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREF_KEY = "shree-sound-v1";
const SRC = "/sounds/hooter.wav";

/**
 * Browser rules: audio can only start after a user gesture, and a closed tab or sleeping
 * computer can't play anything. So: staff opt in with a click, the preference is remembered,
 * and after a reload we ask for one click again instead of silently failing.
 */
export function useSoundAlerts() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false); // staff preference
  const [unlocked, setUnlocked] = useState(false); // browser allowed audio in this page session
  const [blocked, setBlocked] = useState(false); // the last attempt to play was refused

  const element = useCallback(() => {
    audio.current ??= new Audio(SRC);
    return audio.current;
  }, []);

  const tryPlay = useCallback(async (): Promise<boolean> => {
    try {
      const a = element();
      a.currentTime = 0;
      await a.play();
      setBlocked(false);
      setUnlocked(true);
      return true;
    } catch {
      setBlocked(true);
      return false;
    }
  }, [element]);

  // Restore the saved preference; unlock on the first click/key anywhere on the page.
  useEffect(() => {
    let pref = false;
    try {
      pref = window.localStorage.getItem(PREF_KEY) === "on";
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a persisted preference once on mount
    setEnabled(pref);
    if (!pref) return;
    const unlock = () => {
      const a = element();
      a.muted = true; // silent: only proves the browser now allows audio
      a.play().then(
        () => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
          setUnlocked(true);
          setBlocked(false);
        },
        () => {
          a.muted = false;
        },
      );
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [element]);

  const persist = (on: boolean) => {
    try {
      window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
    } catch {
      /* ignore */
    }
  };

  /** Must be called from a click handler: the click is what lets the browser unlock audio. */
  const enable = useCallback(async () => {
    setEnabled(true);
    persist(true);
    await tryPlay(); // also serves as the confirmation beep
  }, [tryPlay]);

  const mute = useCallback(() => {
    setEnabled(false);
    persist(false);
    audio.current?.pause();
  }, []);

  /** Sound the hooter for new orders. Returns false only if it was wanted but the browser blocked it. */
  const alert = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true; // deliberately muted: nothing to retry
    return tryPlay();
  }, [enabled, tryPlay]);

  return { enabled, unlocked, blocked, enable, mute, alert, test: tryPlay };
}
