export type AlfredActivityType =
  | "command_started"
  | "command_completed"
  | "command_failed"
  | "ai_thinking"
  | "tool_executing"
  | "task_created"
  | "task_completed"
  | "workspace_launched"
  | "confirmation_requested"
  | "state_changed";

export type AlfredCoreVisualState =
  | "idle"
  | "listening"
  | "thinking"
  | "executing"
  | "success"
  | "error"
  | "waiting_for_confirmation";

export interface AlfredActivityEventDetail {
  type: AlfredActivityType;
  state?: AlfredCoreVisualState;
  label?: string;
  detail?: string;
  source?: string;
  timestamp?: number;
}

const ALFRED_ACTIVITY_EVENT = "alfred:activity";
const ALFRED_STATE_CHANGE_EVENT = "alfred:state-change";
const ACTIVITY_STORAGE_KEY = "alfred_activity_history_v1";
const MAX_PERSISTED_ACTIVITIES = 100;

/**
 * Retrieve persisted activity history from localStorage.
 * Returns an empty array if no historical activity has been recorded yet.
 */
export function getRecordedActivities(): AlfredActivityEventDetail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist an activity record to localStorage.
 */
export function recordActivity(activity: AlfredActivityEventDetail): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecordedActivities();
    // Prepend new activity and preserve bounded history
    const updated = [activity, ...current.filter((a) => a.timestamp !== activity.timestamp)].slice(
      0,
      MAX_PERSISTED_ACTIVITIES
    );
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Dispatch an ALFRED visual activity event across the application shell and persist to activity log.
 */
export function dispatchAlfredActivity(payload: AlfredActivityEventDetail): void {
  if (typeof window === "undefined") return;
  const detail: AlfredActivityEventDetail = {
    ...payload,
    timestamp: payload.timestamp ?? Date.now(),
  };

  recordActivity(detail);

  const event = new CustomEvent<AlfredActivityEventDetail>(ALFRED_ACTIVITY_EVENT, {
    detail,
  });
  window.dispatchEvent(event);

  if (payload.state) {
    onAlfredStateChange(payload.state, payload.detail);
  }
}

/**
 * Structured state change callback ready for Phase 5.3F audio hook integration
 */
export function onAlfredStateChange(state: AlfredCoreVisualState, detail?: string): void {
  if (typeof window === "undefined") return;
  const event = new CustomEvent<{ state: AlfredCoreVisualState; detail?: string }>(
    ALFRED_STATE_CHANGE_EVENT,
    { detail: { state, detail } }
  );
  window.dispatchEvent(event);
}

/**
 * React hook or helper listener for ALFRED activity events
 */
export function subscribeToAlfredActivity(
  callback: (event: AlfredActivityEventDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<AlfredActivityEventDetail>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(ALFRED_ACTIVITY_EVENT, handler);
  return () => {
    window.removeEventListener(ALFRED_ACTIVITY_EVENT, handler);
  };
}

/**
 * React hook or helper listener for ALFRED state changes
 */
export function subscribeToAlfredState(
  callback: (state: AlfredCoreVisualState, detail?: string) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ state: AlfredCoreVisualState; detail?: string }>;
    if (custom.detail) {
      callback(custom.detail.state, custom.detail.detail);
    }
  };

  window.addEventListener(ALFRED_STATE_CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener(ALFRED_STATE_CHANGE_EVENT, handler);
  };
}
