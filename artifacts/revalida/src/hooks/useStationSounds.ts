import { useCallback, useEffect, useRef } from "react";

export type SoundEvent = "start" | "warning60" | "timeup" | "end";

type Note = { freq: number; start: number; duration: number };

type Notes = Note[];

// Musical note frequencies (Hz)
const SOUNDS: Record<SoundEvent, Notes> = {
  // Ascending C5-E5-G5 chord: pleasant "estação iniciada"
  start: [
    { freq: 523.25, start: 0.00, duration: 0.45 },
    { freq: 659.25, start: 0.06, duration: 0.40 },
    { freq: 783.99, start: 0.12, duration: 0.35 },
  ],
  // Single soft A5: gentle "último minuto" attention signal
  warning60: [
    { freq: 880.00, start: 0.00, duration: 0.22 },
  ],
  // Descending G5-E5-C5: "concluído"
  timeup: [
    { freq: 783.99, start: 0.00, duration: 0.20 },
    { freq: 659.25, start: 0.24, duration: 0.20 },
    { freq: 523.25, start: 0.48, duration: 0.30 },
  ],
  // Single soft E5: acknowledges manual encerramento
  end: [
    { freq: 659.25, start: 0.00, duration: 0.20 },
  ],
};

/**
 * Plays a sequence of sine-wave tones via Web Audio API.
 * Returns the scheduled close-timer ID so callers can cancel it on unmount.
 * Fails silently on autoplay restrictions or missing AudioContext.
 */
function playNotes(notes: Notes, volume = 0.10): number | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    const maxEnd = Math.max(...notes.map((n) => n.start + n.duration));

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.025);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + start + duration,
      );
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    });

    const timerId = window.setTimeout(() => {
      try { void ctx.close(); } catch {}
    }, (maxEnd + 0.3) * 1000);

    return timerId;
  } catch {
    return null;
  }
}

/**
 * Hook for discrete, non-intrusive station sound effects.
 *
 * - `start`, `timeup`, `end` — always play regardless of alertsEnabled.
 * - `warning60` — only plays when alertsEnabled is true.
 *
 * All scheduled AudioContext close-timers are cancelled on unmount to avoid
 * extra work after navigation.
 */
export function useStationSounds(alertsEnabled: boolean) {
  const pendingTimersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      for (const id of pendingTimersRef.current) {
        window.clearTimeout(id);
      }
      pendingTimersRef.current.clear();
    };
  }, []);

  const play = useCallback(
    (event: SoundEvent) => {
      if (event === "warning60" && !alertsEnabled) return;
      const timerId = playNotes(SOUNDS[event]);
      if (timerId !== null) {
        pendingTimersRef.current.add(timerId);
        // Self-clean from the set once the timer fires naturally
        window.setTimeout(() => {
          pendingTimersRef.current.delete(timerId);
        }, (Math.max(...SOUNDS[event].map((n) => n.start + n.duration)) + 0.3) * 1000 + 50);
      }
    },
    [alertsEnabled],
  );

  return { play };
}
