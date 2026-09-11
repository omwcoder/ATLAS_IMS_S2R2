// lib/useInactivityTimeout.ts
// Logs the user out after TIMEOUT_MS of inactivity (no mouse, keyboard,
// touch, or scroll events). Applies to ALL roles — ADMIN, EDITOR, VIEWER.
//
// Activity events that reset the timer:
//   mousemove, mousedown, keydown, touchstart, touchmove, scroll, wheel, click
//
// On timeout:
//   1. Clears all auth tokens from localStorage.
//   2. Redirects to /login?reason=inactivity so the login page can show
//      a "You were logged out due to inactivity" message.
"use client";

import { useEffect, useRef } from "react";
import { logout } from "@/lib/api";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "touchmove",
  "scroll",
  "wheel",
  "click",
] as const;

export function useInactivityTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logout();
        window.location.href = "/login?reason=inactivity";
      }, TIMEOUT_MS);
    }

    // Start the timer immediately on mount
    resetTimer();

    // Reset on any user activity
    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetTimer, { passive: true })
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, resetTimer)
      );
    };
  }, []);
}
