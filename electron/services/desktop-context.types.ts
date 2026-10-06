/**
 * ALFRED Desktop Context — Types & Contracts
 *
 * Safe, privacy-preserving desktop context telemetry.
 * Captures internal ALFRED state ONLY.
 * Zero screenshots, zero keystroke logs, zero browser inspection.
 */

export interface SafeDesktopContext {
    timestamp: number;
    isForeground: boolean;
    activeWorkspace?: {
        id: string;
        name: string;
        type?: string;
        lastLaunched?: string | null;
    };
    focusSession?: {
        isActive: boolean;
        state: "idle" | "running" | "paused" | "completed";
        sessionName: string;
        durationMinutes: number;
        elapsedSeconds: number;
        remainingSeconds: number;
        workspace?: string;
    };
    activeProject?: {
        id: string;
        name: string;
        progress: number;
        category: string;
    };
    pendingTasksSummary: {
        overdueCount: number;
        urgentCount: number;
        topTaskText?: string;
    };
    activeGoalsSummary: {
        activeCount: number;
        topGoalTitle?: string;
    };
    activeRoutine?: {
        id: string;
        name: string;
        state: string;
    };
    privacyGuarantee: {
        screenCaptureEnabled: false;
        keystrokeLoggingEnabled: false;
        browserHistoryScrapingEnabled: false;
        arbitraryProcessInspectionEnabled: false;
    };
}
