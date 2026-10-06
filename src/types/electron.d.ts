import type { SystemInfo } from "../../electron/services/system.service";
import type {
    WorkspaceStatus,
    WorkspaceLaunchResult,
    WorkspaceLaunchPayload,
} from "../../electron/services/workspace.service";
import type { ExecutionResult } from "../../electron/tools/exec.tool";
import type { CommandExecutionResult } from "../../electron/agent/types";
import type { AIProviderId } from "../../electron/agent/providers/types";
import type { ProviderConfigStatus } from "../../electron/agent/providers/config/types";

export interface ElectronAPI {
    system: {
        ping: () => Promise<{ status: "ok"; timestamp: number }>;
        getInfo: () => Promise<SystemInfo>;
        openUrl: (url: string) => Promise<boolean>;
        openPath: (path: string) => Promise<string>;
        showNotification: (title: string, body: string) => Promise<boolean>;
        executeCommand: (command: string, cwd?: string) => Promise<ExecutionResult>;
        isBootCompleted?: () => Promise<boolean>;
        markBootCompleted?: () => Promise<boolean>;
        resetBootState?: () => Promise<boolean>;
    };
    workspace: {
        getStatus: () => Promise<WorkspaceStatus>;
        getAll?: () => Promise<any[]>;
        sync?: (workspaces: any[]) => Promise<{ success: boolean }>;
        launch: (payload: string | WorkspaceLaunchPayload) => Promise<WorkspaceLaunchResult>;
    };
    apps?: {
        discover: () => Promise<import("../../electron/services/app-discovery.service").DiscoveredApplication[]>;
        getDiscovered: () => Promise<import("../../electron/services/app-discovery.service").DiscoveredApplication[]>;
        getApproved: () => Promise<import("../../electron/services/approved-apps.service").ApprovedApplication[]>;
        approve: (app: any, aliases?: string[]) => Promise<{ success: boolean; app?: any; error?: string }>;
        revoke: (id: string) => Promise<{ success: boolean; error?: string }>;
        updateAliases: (id: string, aliases: string[]) => Promise<{ success: boolean; app?: any; error?: string }>;
    };
    commandAgent: {
        execute: (prompt: string, options?: any) => Promise<CommandExecutionResult>;
        confirm: (confirmationId: string) => Promise<CommandExecutionResult>;
        confirmAction?: (confirmationId: string) => Promise<CommandExecutionResult>;
        cancel: (confirmationId: string) => Promise<CommandExecutionResult>;
        cancelAction?: (confirmationId: string) => Promise<CommandExecutionResult>;
    };
    tasks?: {
        getTasks: () => Promise<any[]>;
        syncTasks: (tasks: any[]) => Promise<any>;
        onTasksChanged: (callback: (tasks: any[]) => void) => () => void;
    };
    goals?: {
        getGoals: () => Promise<any[]>;
        syncGoals: (goals: any[]) => Promise<any>;
        onGoalsChanged: (callback: (goals: any[]) => void) => () => void;
    };
    projects?: {
        getProjects: () => Promise<any[]>;
        syncProjects: (projects: any[]) => Promise<any>;
        onProjectsChanged: (callback: (projects: any[]) => void) => () => void;
    };
    aiProvider: {
        getStatuses: () => Promise<ProviderConfigStatus[]>;
        getActive: () => Promise<AIProviderId>;
        setActive: (providerId: string) => Promise<{ requestedId: string; effectiveId: AIProviderId; status?: ProviderConfigStatus; error?: string }>;
        getConfigStatus: (providerId: string) => Promise<ProviderConfigStatus>;
        checkAvailability: (providerId: string) => Promise<{ available: boolean; error?: string }>;
    };
    voice?: {
        getStatus: () => Promise<VoiceEngineStatus>;
        transcribe: (audioBuffer: Uint8Array | ArrayBuffer) => Promise<VoiceTranscribeResult>;
    };
    wakeWord?: {
        getStatus: () => Promise<WakeWordEngineStatus>;
        predict: (audio: string, threshold?: number) => Promise<WakePredictResult>;
        setPhrase: (phrase: string) => Promise<{ success: boolean; phrase?: string; error?: string }>;
    };
    tts?: {
        getStatus: () => Promise<TtsEngineStatus>;
        speak: (text: string, options?: TtsSpeakOptions) => Promise<TtsSpeakResult>;
        stop: () => Promise<{ success: boolean }>;
        setOptions: (options: TtsSpeakOptions) => Promise<{ success: boolean }>;
        onEvent: (callback: (event: TtsEvent) => void) => () => void;
    };
    proactive?: {
        getSuggestions: (options?: { force?: boolean }) => Promise<import("../../electron/agent/proactive/proactive.types").ProactiveEvaluationResult>;
        dismiss: (keyOrId: string) => Promise<boolean>;
        reset: () => Promise<boolean>;
    };
    memory?: {
        getAll: (options?: { enabledOnly?: boolean; category?: any }) => Promise<any[]>;
        getById: (id: string) => Promise<any>;
        save: (item: any) => Promise<{ success: boolean; memory?: any; error?: string }>;
        update: (id: string, updates: any) => Promise<{ success: boolean; memory?: any; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        clear: () => Promise<{ success: boolean }>;
    };
    routines?: {
        getRoutines: () => Promise<import("../../electron/agent/routines/routine.types").Routine[]>;
    };
    briefing?: {
        get: (options?: any) => Promise<import("../../electron/agent/briefing/briefing.types").MorningBriefing>;
    };
    review?: {
        get: (options?: any) => Promise<import("../../electron/agent/review/review.types").EndOfDayReview>;
    };
    weeklyReview?: {
        get: (options?: any) => Promise<import("../../electron/agent/review/weekly-review.types").WeeklyReview>;
    };
    weeklyPlan?: {
        get: (options?: any) => Promise<import("../../electron/agent/review/weekly-review.types").WeeklyPlanProposal>;
    };
    schedules?: {
        getSchedules: () => Promise<import("../../electron/agent/scheduler/scheduler.types").ScheduledRoutine[]>;
        create: (input: import("../../electron/agent/scheduler/scheduler.types").CreateScheduleInput) => Promise<{ success: boolean; schedule?: import("../../electron/agent/scheduler/scheduler.types").ScheduledRoutine; error?: string }>;
        setEnabled: (id: string, enabled: boolean) => Promise<{ success: boolean; schedule?: import("../../electron/agent/scheduler/scheduler.types").ScheduledRoutine; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    };
    automations?: {
        getRules: () => Promise<import("../../electron/agent/automation/automation.types").AutomationRule[]>;
        create: (input: import("../../electron/agent/automation/automation.types").CreateAutomationInput) => Promise<{ success: boolean; rule?: import("../../electron/agent/automation/automation.types").AutomationRule; error?: string }>;
        setEnabled: (id: string, enabled: boolean) => Promise<{ success: boolean; rule?: import("../../electron/agent/automation/automation.types").AutomationRule; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    };
    events?: {
        getRecent: (limit?: number) => Promise<import("../../electron/events/event.types").AppEvent[]>;
    };
    focus?: {
        getStatus: () => Promise<import("../../electron/services/focus.service").FocusSummary>;
        start: (options?: any) => Promise<{ success: boolean; session?: import("../../electron/services/focus.service").FocusSessionMetadata; error?: string }>;
        pause: () => Promise<{ success: boolean; session?: import("../../electron/services/focus.service").FocusSessionMetadata; error?: string }>;
        resume: () => Promise<{ success: boolean; session?: import("../../electron/services/focus.service").FocusSessionMetadata; error?: string }>;
        stop: () => Promise<{ success: boolean; session?: import("../../electron/services/focus.service").FocusSessionMetadata; error?: string }>;
        addMinutes: () => Promise<{ success: boolean; session?: import("../../electron/services/focus.service").FocusSessionMetadata; remainingSeconds?: number; error?: string }>;
    };
    desktop?: {
        getState: () => Promise<import("../../electron/services/background-lifecycle.service").LifecycleState>;
        show: () => Promise<boolean>;
        hide: () => Promise<boolean>;
    };
    notifications?: {
        send: (options: { title: string; body: string; category?: string; priority?: string; silent?: boolean }) => Promise<boolean>;
        getPreferences: () => Promise<import("../../electron/services/notification-manager.types").NotificationPreferences>;
        updatePreferences: (updates: Partial<import("../../electron/services/notification-manager.types").NotificationPreferences>) => Promise<import("../../electron/services/notification-manager.types").NotificationPreferences>;
        getHistory: (options?: { activeOnly?: boolean; limit?: number }) => Promise<import("../../electron/services/notification-manager.types").NotificationRecord[]>;
        dismiss: (id: string) => Promise<boolean>;
        clearHistory: () => Promise<boolean>;
    };
    knowledge?: {
        search: (options: import("../../electron/knowledge/knowledge.types").KnowledgeSearchOptions) => Promise<import("../../electron/knowledge/knowledge.types").KnowledgeSearchResult[]>;
        import: (input: import("../../electron/knowledge/knowledge.types").KnowledgeImportInput) => Promise<import("../../electron/knowledge/knowledge.types").KnowledgeImportResult>;
        getDocuments: (filter?: { projectId?: string; workspaceId?: string }) => Promise<import("../../electron/knowledge/knowledge.types").KnowledgeDocument[]>;
        getSummary: () => Promise<import("../../electron/knowledge/knowledge.types").KnowledgeSummary>;
        delete: (id: string) => Promise<boolean>;
        clear: () => Promise<boolean>;
    };
    desktopContext?: {
        get: () => Promise<import("../../electron/services/desktop-context.types").SafeDesktopContext>;
    };
    settings?: {
        get: () => Promise<import("../../electron/services/settings.types").AlfredSettings>;
        update: (partial: Partial<import("../../electron/services/settings.types").AlfredSettings>) => Promise<import("../../electron/services/settings.types").AlfredSettings>;
        reset: () => Promise<import("../../electron/services/settings.types").AlfredSettings>;
    };
    hotkey?: {
        getStatus: () => Promise<{ registered: boolean; shortcut: string }>;
        register: (shortcut: string) => Promise<boolean>;
        onSummon: (callback: () => void) => () => void;
    };
}

export interface WakeWordEngineStatus {
    available: boolean;
    engine: "openwakeword" | "local-vad-keyword" | "mock" | "none";
    status: "READY" | "NOT INSTALLED" | "MODEL NOT FOUND" | "ERROR" | "LISTENING";
    phrase: string;
    model?: string;
    detail: string;
}

export interface WakePredictResult {
    detected: boolean;
    score?: number;
    phrase?: string;
    model?: string;
    error?: string;
}

export interface VoiceEngineStatus {
    available: boolean;
    engine: "faster-whisper" | "whisper.cpp" | "local-native" | "local-browser" | "none";
    status: "READY" | "NOT INSTALLED" | "MODEL NOT FOUND" | "ERROR";
    model?: string;
    device?: string;
    detail: string;
}

export interface VoiceTranscribeResult {
    success: boolean;
    transcript: string;
    error?: string;
    duration?: number;
}

export interface TtsEngineStatus {
    available: boolean;
    engine: "windows-sapi" | "mock" | "none";
    status: "INITIALIZING" | "READY" | "SPEAKING" | "DISABLED" | "ERROR";
    voice?: string;
    voices?: string[];
    detail?: string;
}

export interface TtsSpeakOptions {
    rate?: number;
    volume?: number;
    voice?: string;
}

export interface TtsSpeakResult {
    success: boolean;
    id: string;
    error?: string;
}

export interface TtsEvent {
    type: "ready" | "started" | "completed" | "stopped" | "error";
    id?: string;
    text?: string;
    error?: string;
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}
