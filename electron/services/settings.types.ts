/**
 * ALFRED Settings & Permissions — Types & Contracts
 */

export type PermissionCategory =
    | "read_only"
    | "productivity_mutation"
    | "desktop_control"
    | "automation"
    | "knowledge_access"
    | "notification";

export interface PermissionSettings {
    read_only: boolean;
    productivity_mutation: boolean;
    desktop_control: boolean;
    automation: boolean;
    knowledge_access: boolean;
    notification: boolean;
    requireConfirmationForMutations: boolean;
    strictDataOnlyMode: boolean;
}

export interface AlfredSettings {
    version: number;
    updatedAt: string;
    aiProvider: {
        activeProvider: "mock" | "ollama" | "gemini" | "claude";
        temperature: number;
        hasConfiguredApiKey: boolean; // Safe boolean flag, never exposes secret keys
    };
    voice: {
        enabled: boolean;
        language: string;
    };
    wakeWord: {
        enabled: boolean;
        phrase: string;
        threshold: number;
    };
    tts: {
        enabled: boolean;
        voice?: string;
        rate: number;
    };
    notifications: {
        enabled: boolean;
        cooldownMs: number;
        quietHoursEnabled: boolean;
        quietHoursStart: number;
        quietHoursEnd: number;
    };
    hotkey: {
        enabled: boolean;
        shortcut: string;
    };
    background: {
        closeToTray: boolean;
        startMinimized: boolean;
    };
    automation: {
        allowScheduledRoutines: boolean;
        allowConditionalAutomations: boolean;
    };
    knowledge: {
        maxDocuments: number;
        minSearchScore: number;
    };
    permissions: PermissionSettings;
    onboarding: {
        completed: boolean;
        completedAt?: string;
    };
}

export const DEFAULT_ALFRED_SETTINGS: AlfredSettings = {
    version: 1,
    updatedAt: new Date().toISOString(),
    aiProvider: {
        activeProvider: "mock",
        temperature: 0.7,
        hasConfiguredApiKey: false,
    },
    voice: {
        enabled: true,
        language: "en",
    },
    wakeWord: {
        enabled: true,
        phrase: "Hey Alfred",
        threshold: 0.5,
    },
    tts: {
        enabled: true,
        rate: 1.0,
    },
    notifications: {
        enabled: true,
        cooldownMs: 30000,
        quietHoursEnabled: false,
        quietHoursStart: 22,
        quietHoursEnd: 7,
    },
    hotkey: {
        enabled: true,
        shortcut: "CommandOrControl+Shift+Space",
    },
    background: {
        closeToTray: true,
        startMinimized: false,
    },
    automation: {
        allowScheduledRoutines: true,
        allowConditionalAutomations: true,
    },
    knowledge: {
        maxDocuments: 100,
        minSearchScore: 0.05,
    },
    permissions: {
        read_only: true,
        productivity_mutation: true,
        desktop_control: true,
        automation: true,
        knowledge_access: true,
        notification: true,
        requireConfirmationForMutations: true,
        strictDataOnlyMode: true,
    },
    onboarding: {
        completed: false,
    },
};
