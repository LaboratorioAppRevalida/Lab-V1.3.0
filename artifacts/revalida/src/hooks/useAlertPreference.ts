import { useState } from "react";

const PREF_KEY = "revalida.alerts.enabled";

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * Persists the user's preference for final-minutes alerts in localStorage.
 *
 * Controls:
 *   - warning60 sound (last 60 s)
 *   - "Último minuto" visual badge
 *   - pulse animation at critical (≤15 s)
 *
 * Start sound, time-up sound, and manual-end sound are always played
 * regardless of this setting.
 */
export function useAlertPreference() {
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(readPref);

  const toggleAlerts = () => {
    setAlertsEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(PREF_KEY, String(next)); } catch {}
      return next;
    });
  };

  return { alertsEnabled, toggleAlerts };
}
