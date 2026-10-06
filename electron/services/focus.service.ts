/**
 * ALFRED Phase 5.8C — Focus & Coding Session Service
 *
 * Canonical source of truth for Focus and Coding Session state in the Electron main process.
 * Provides drift-free timestamp calculation, session lifecycle (start, pause, resume, stop, add 5m),
 * session metadata (workspace, application, planned duration, session name), and stats tracking.
 *
 * SECURITY & ARCHITECTURAL GUARANTEES:
 * 1. Single source of truth: No duplicate timers or split state.
 * 2. Whitelisted presets and bounded duration (1-180 minutes).
 * 3. Never executes external binaries or process launchers directly.
 * 4. Active session protection prevents duplicate independent timers.
 */

import { logger } from "../utils/logger";
import { eventBus } from "../events/event-bus";

export type FocusTimerState = "idle" | "running" | "paused" | "completed";

export interface FocusSessionMetadata {
    id: string;
    sessionName: string;
    workspace?: string;
    application?: string;
    plannedDurationMinutes: number;
    startedAt: string;
    startTimestamp: number;
    targetEndTimestamp: number | null;
    pausedRemainingSeconds: number;
    state: FocusTimerState;
    completedAt?: string;
}

export interface FocusStatsRecord {
    todayFocusMinutes: number;
    totalFocusMinutes: number;
    completedSessionsCount: number;
    lastCompletedDate: string | null;
}

export interface FocusSummary {
    state: FocusTimerState;
    isActive: boolean;
    sessionDurationMinutes: number;
    remainingSeconds: number;
    elapsedSeconds: number;
    todayFocusMinutes: number;
    totalFocusMinutes: number;
    completedSessionsCount: number;
    activeWorkspace?: string;
    activeApplication?: string;
    sessionName?: string;
    sessionType?: string;
}

export const ALLOWED_PRESETS = [15, 25, 30, 45, 60] as const;
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 180;
export const DEFAULT_CODING_DURATION_MINUTES = 45;

export class FocusService {
    private currentSession: FocusSessionMetadata | null = null;
    private stats: FocusStatsRecord = {
        todayFocusMinutes: 0,
        totalFocusMinutes: 0,
        completedSessionsCount: 0,
        lastCompletedDate: null,
    };

    constructor() {
        this.resetStatsIfNewDay();
    }

    private getTodayString(): string {
        return new Date().toISOString().split("T")[0];
    }

    private resetStatsIfNewDay(): void {
        const today = this.getTodayString();
        if (this.stats.lastCompletedDate && this.stats.lastCompletedDate !== today) {
            this.stats.todayFocusMinutes = 0;
        }
    }

    /**
     * Validates whether a proposed duration in minutes is valid and safe.
     */
    public validateDuration(minutes: number): { valid: boolean; durationMinutes?: number; error?: string } {
        if (typeof minutes !== "number" || isNaN(minutes) || !Number.isFinite(minutes)) {
            return { valid: false, error: "Duration must be a valid finite number." };
        }
        if (!Number.isInteger(minutes)) {
            // Round cleanly if fractional
            minutes = Math.round(minutes);
        }
        if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) {
            return {
                valid: false,
                error: `Duration must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes.`,
            };
        }
        return { valid: true, durationMinutes: minutes };
    }

    /**
     * Checks if there is an active running or paused session.
     */
    public isSessionActive(): boolean {
        if (!this.currentSession) return false;
        // Check for elapsed completion if running
        this.syncSessionCountdown();
        return this.currentSession.state === "running" || this.currentSession.state === "paused";
    }

    /**
     * Gets the currently active or most recent session metadata.
     */
    public getActiveSession(): FocusSessionMetadata | null {
        this.syncSessionCountdown();
        return this.currentSession ? { ...this.currentSession } : null;
    }

    /**
     * Calculates remaining seconds using drift-free timestamps.
     */
    private syncSessionCountdown(): void {
        if (!this.currentSession) return;

        if (this.currentSession.state === "running" && this.currentSession.targetEndTimestamp) {
            const now = Date.now();
            const remainingMs = this.currentSession.targetEndTimestamp - now;
            if (remainingMs <= 0) {
                this.completeSession();
            } else {
                this.currentSession.pausedRemainingSeconds = Math.ceil(remainingMs / 1000);
            }
        }
    }

    /**
     * Initiates a new Focus / Coding Session.
     */
    public startSession(options: {
        sessionName?: string;
        durationMinutes?: number;
        workspace?: string;
        application?: string;
    }): { success: boolean; session?: FocusSessionMetadata; error?: string } {
        this.syncSessionCountdown();

        // Active session protection
        if (this.isSessionActive()) {
            const remainingMin = Math.ceil((this.currentSession?.pausedRemainingSeconds || 0) / 60);
            const name = this.currentSession?.sessionName || "Coding Session";
            return {
                success: false,
                error: `You already have an active coding session ('${name}', ${remainingMin} minute(s) remaining).`,
                session: this.currentSession ? { ...this.currentSession } : undefined,
            };
        }

        const durationValidation = this.validateDuration(
            options.durationMinutes ?? DEFAULT_CODING_DURATION_MINUTES
        );
        if (!durationValidation.valid || !durationValidation.durationMinutes) {
            return { success: false, error: durationValidation.error };
        }

        const plannedDurationMinutes = durationValidation.durationMinutes;
        const durationSeconds = plannedDurationMinutes * 60;
        const nowMs = Date.now();
        const targetEndTimestamp = nowMs + durationSeconds * 1000;

        const session: FocusSessionMetadata = {
            id: `focus_${nowMs}_${Math.random().toString(36).substring(2, 7)}`,
            sessionName: options.sessionName || "Coding Session",
            workspace: options.workspace,
            application: options.application,
            plannedDurationMinutes,
            startedAt: new Date(nowMs).toISOString(),
            startTimestamp: nowMs,
            targetEndTimestamp,
            pausedRemainingSeconds: durationSeconds,
            state: "running",
        };

        this.currentSession = session;
        logger.info(
            `FocusService: Started focus session '${session.sessionName}' for ${plannedDurationMinutes}m (Workspace: ${options.workspace || "None"}, App: ${options.application || "None"}).`
        );

        eventBus.publish("focus_started", {
            sessionId: session.id,
            sessionName: session.sessionName,
            durationMinutes: plannedDurationMinutes,
            workspace: session.workspace,
            application: session.application,
            remainingSeconds: durationSeconds,
        });

        return { success: true, session: { ...session } };
    }

    /**
     * Pauses an active running session.
     */
    public pauseSession(): { success: boolean; session?: FocusSessionMetadata; error?: string } {
        this.syncSessionCountdown();

        if (!this.currentSession) {
            return { success: false, error: "No focus session exists to pause." };
        }
        if (this.currentSession.state !== "running") {
            return { success: false, error: `Session is not running (current state: ${this.currentSession.state}).` };
        }

        const remainingMs = Math.max(0, (this.currentSession.targetEndTimestamp || Date.now()) - Date.now());
        this.currentSession.pausedRemainingSeconds = Math.ceil(remainingMs / 1000);
        this.currentSession.targetEndTimestamp = null;
        this.currentSession.state = "paused";

        logger.info(
            `FocusService: Paused session '${this.currentSession.sessionName}' (${this.currentSession.pausedRemainingSeconds}s remaining).`
        );

        eventBus.publish("focus_paused", {
            sessionId: this.currentSession.id,
            sessionName: this.currentSession.sessionName,
            durationMinutes: this.currentSession.plannedDurationMinutes,
            workspace: this.currentSession.workspace,
            application: this.currentSession.application,
            remainingSeconds: this.currentSession.pausedRemainingSeconds,
        });

        return { success: true, session: { ...this.currentSession } };
    }

    /**
     * Resumes a paused session.
     */
    public resumeSession(): { success: boolean; session?: FocusSessionMetadata; error?: string } {
        if (!this.currentSession) {
            return { success: false, error: "No focus session exists to resume." };
        }
        if (this.currentSession.state !== "paused") {
            return { success: false, error: `Session is not paused (current state: ${this.currentSession.state}).` };
        }

        const remainingSecs = Math.max(1, this.currentSession.pausedRemainingSeconds);
        const nowMs = Date.now();
        this.currentSession.targetEndTimestamp = nowMs + remainingSecs * 1000;
        this.currentSession.state = "running";

        logger.info(
            `FocusService: Resumed session '${this.currentSession.sessionName}' (${remainingSecs}s remaining).`
        );

        eventBus.publish("focus_resumed", {
            sessionId: this.currentSession.id,
            sessionName: this.currentSession.sessionName,
            durationMinutes: this.currentSession.plannedDurationMinutes,
            workspace: this.currentSession.workspace,
            application: this.currentSession.application,
            remainingSeconds: remainingSecs,
        });

        return { success: true, session: { ...this.currentSession } };
    }

    /**
     * Stops/cancels the active focus session.
     */
    public stopSession(): { success: boolean; session?: FocusSessionMetadata; error?: string } {
        this.syncSessionCountdown();

        if (!this.currentSession || (this.currentSession.state !== "running" && this.currentSession.state !== "paused")) {
            return { success: false, error: "No active focus session to stop." };
        }

        this.currentSession.state = "idle";
        this.currentSession.targetEndTimestamp = null;
        this.currentSession.pausedRemainingSeconds = 0;

        logger.info(`FocusService: Stopped focus session '${this.currentSession.sessionName}'.`);
        const stopped = { ...this.currentSession };
        this.currentSession = null;

        eventBus.publish("focus_stopped", {
            sessionId: stopped.id,
            sessionName: stopped.sessionName,
            durationMinutes: stopped.plannedDurationMinutes,
            workspace: stopped.workspace,
            application: stopped.application,
        });

        return { success: true, session: stopped };
    }

    /**
     * Adds 5 minutes (300 seconds) to the active session (running or paused).
     */
    public addFiveMinutes(): { success: boolean; session?: FocusSessionMetadata; remainingSeconds?: number; error?: string } {
        this.syncSessionCountdown();

        if (!this.currentSession || (this.currentSession.state !== "running" && this.currentSession.state !== "paused")) {
            return { success: false, error: "No active focus session to add time to." };
        }

        const bonusSecs = 5 * 60;
        const newTotalSecs = this.currentSession.pausedRemainingSeconds + bonusSecs;
        const maxSecs = MAX_DURATION_MINUTES * 60;
        const clampedSecs = Math.min(newTotalSecs, maxSecs);

        this.currentSession.pausedRemainingSeconds = clampedSecs;
        if (this.currentSession.state === "running") {
            this.currentSession.targetEndTimestamp = Date.now() + clampedSecs * 1000;
        }

        logger.info(
            `FocusService: Added 5 minutes to '${this.currentSession.sessionName}'. New remaining: ${clampedSecs}s.`
        );
        return {
            success: true,
            session: { ...this.currentSession },
            remainingSeconds: clampedSecs,
        };
    }

    /**
     * Marks session as completed and updates focus statistics.
     * Does NOT launch another routine or mutate tasks/goals autonomously.
     */
    public completeSession(): FocusSessionMetadata | null {
        if (!this.currentSession) return null;

        const session = this.currentSession;
        session.state = "completed";
        session.targetEndTimestamp = null;
        session.pausedRemainingSeconds = 0;
        session.completedAt = new Date().toISOString();

        this.resetStatsIfNewDay();
        const today = this.getTodayString();
        const durationMin = session.plannedDurationMinutes;

        this.stats.todayFocusMinutes += durationMin;
        this.stats.totalFocusMinutes += durationMin;
        this.stats.completedSessionsCount += 1;
        this.stats.lastCompletedDate = today;

        logger.info(
            `FocusService: Session '${session.sessionName}' completed (+${durationMin}m). Total today: ${this.stats.todayFocusMinutes}m.`
        );

        eventBus.publish("focus_completed", {
            sessionId: session.id,
            sessionName: session.sessionName,
            durationMinutes: session.plannedDurationMinutes,
            workspace: session.workspace,
            application: session.application,
            elapsedSeconds: session.plannedDurationMinutes * 60,
        });

        return { ...session };
    }

    /**
     * Returns canonical summary for AgentContext and Morning Briefing.
     */
    public getFocusSummary(): FocusSummary {
        this.syncSessionCountdown();
        this.resetStatsIfNewDay();

        if (!this.currentSession) {
            return {
                state: "idle",
                isActive: false,
                sessionDurationMinutes: DEFAULT_CODING_DURATION_MINUTES,
                remainingSeconds: DEFAULT_CODING_DURATION_MINUTES * 60,
                elapsedSeconds: 0,
                todayFocusMinutes: this.stats.todayFocusMinutes,
                totalFocusMinutes: this.stats.totalFocusMinutes,
                completedSessionsCount: this.stats.completedSessionsCount,
            };
        }

        const state = this.currentSession.state;
        const isActive = state === "running" || state === "paused";
        const sessionDurationMinutes = this.currentSession.plannedDurationMinutes;
        const remainingSeconds = this.currentSession.pausedRemainingSeconds;
        const totalSecs = sessionDurationMinutes * 60;
        const elapsedSeconds = Math.max(0, totalSecs - remainingSeconds);

        return {
            state,
            isActive,
            sessionDurationMinutes,
            remainingSeconds,
            elapsedSeconds,
            todayFocusMinutes: this.stats.todayFocusMinutes,
            totalFocusMinutes: this.stats.totalFocusMinutes,
            completedSessionsCount: this.stats.completedSessionsCount,
            activeWorkspace: this.currentSession.workspace,
            activeApplication: this.currentSession.application,
            sessionName: this.currentSession.sessionName,
            sessionType: this.currentSession.workspace || "Coding",
        };
    }

    /**
     * Resets the focus service to initial state (for testing).
     */
    public reset(): void {
        this.currentSession = null;
        this.stats = {
            todayFocusMinutes: 0,
            totalFocusMinutes: 0,
            completedSessionsCount: 0,
            lastCompletedDate: null,
        };
    }
}

export const focusService = new FocusService();
