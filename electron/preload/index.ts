import { contextBridge, ipcRenderer } from "electron";

// Inlined IPC channel constants to ensure sandboxed preload executes without relative module resolution failures
const CHANNELS = {
    SYSTEM: {
        PING: "system:ping",
        GET_INFO: "system:get-info",
        OPEN_URL: "system:open-url",
        OPEN_PATH: "system:open-path",
        SHOW_NOTIFICATION: "system:show-notification",
        EXECUTE_COMMAND: "system:execute-command",
        IS_BOOT_COMPLETED: "system:is-boot-completed",
        MARK_BOOT_COMPLETED: "system:mark-boot-completed",
        RESET_BOOT_STATE: "system:reset-boot-state",
    },
    APPS: {
        DISCOVER: "apps:discover",
        GET_DISCOVERED: "apps:get-discovered",
        GET_APPROVED: "apps:get-approved",
        APPROVE: "apps:approve",
        REVOKE: "apps:revoke",
        UPDATE_ALIASES: "apps:update-aliases",
    },
    WORKSPACE: {
        GET_STATUS: "workspace:get-status",
        GET_ALL: "workspace:get-all",
        SYNC: "workspace:sync",
        LAUNCH: "workspace:launch",
    },
    COMMAND_AGENT: {
        EXECUTE: "command-agent:execute",
        CONFIRM: "command-agent:confirm",
        CANCEL: "command-agent:cancel",
    },
    TASKS: {
        GET: "tasks:get",
        SYNC: "tasks:sync",
        CHANGED: "tasks:changed",
    },
    GOALS: {
        GET: "goals:get",
        SYNC: "goals:sync",
        CHANGED: "goals:changed",
    },
    PROJECTS: {
        GET: "projects:get",
        SYNC: "projects:sync",
        CHANGED: "projects:changed",
    },
    AI_PROVIDER: {
        GET_STATUSES: "ai-provider:get-statuses",
        GET_ACTIVE: "ai-provider:get-active",
        SET_ACTIVE: "ai-provider:set-active",
        GET_CONFIG_STATUS: "ai-provider:get-config-status",
        CHECK_AVAILABILITY: "ai-provider:check-availability",
    },
    VOICE: {
        GET_STATUS: "voice:get-status",
        TRANSCRIBE: "voice:transcribe",
    },
    WAKE_WORD: {
        GET_STATUS: "wake-word:get-status",
        START: "wake-word:start",
        STOP: "wake-word:stop",
        PREDICT: "wake-word:predict",
        SET_PHRASE: "wake-word:set-phrase",
        WAKE_DETECTED: "wake-word:detected",
    },
    TTS: {
        GET_STATUS: "tts:get-status",
        SPEAK: "tts:speak",
        STOP: "tts:stop",
        SET_OPTIONS: "tts:set-options",
        EVENT: "tts:event",
    },
    PROACTIVE: {
        GET_SUGGESTIONS: "proactive:get-suggestions",
        DISMISS: "proactive:dismiss",
        RESET: "proactive:reset",
    },
    MEMORY: {
        GET_ALL: "memory:get-all",
        GET_BY_ID: "memory:get-by-id",
        SAVE: "memory:save",
        UPDATE: "memory:update",
        DELETE: "memory:delete",
        CLEAR: "memory:clear",
    },
    ROUTINES: {
        GET_ALL: "routines:get-all",
    },
    BRIEFING: {
        GET: "briefing:get",
    },
    REVIEW: {
        GET: "review:get",
    },
    WEEKLY_REVIEW: {
        GET: "weekly-review:get",
    },
    WEEKLY_PLAN: {
        GET: "weekly-plan:get",
    },
    SCHEDULES: {
        GET_ALL: "schedules:get-all",
        CREATE: "schedules:create",
        SET_ENABLED: "schedules:set-enabled",
        DELETE: "schedules:delete",
        EXECUTE_NOW: "schedules:execute-now",
    },
    AUTOMATIONS: {
        GET_ALL: "automations:get-all",
        CREATE: "automations:create",
        SET_ENABLED: "automations:set-enabled",
        DELETE: "automations:delete",
    },
    EVENTS: {
        GET_RECENT: "events:get-recent",
        PUBLISH: "events:publish",
    },
    FOCUS: {
        GET_STATUS: "focus:get-status",
        START: "focus:start",
        PAUSE: "focus:pause",
        RESUME: "focus:resume",
        STOP: "focus:stop",
        ADD_MINUTES: "focus:add-minutes",
    },
    DESKTOP: {
        GET_STATE: "desktop:get-state",
        SHOW: "desktop:show",
        HIDE: "desktop:hide",
    },
    NOTIFICATIONS: {
        SEND: "notifications:send",
        GET_PREFERENCES: "notifications:get-preferences",
        UPDATE_PREFERENCES: "notifications:update-preferences",
        GET_HISTORY: "notifications:get-history",
        DISMISS: "notifications:dismiss",
        CLEAR_HISTORY: "notifications:clear-history",
    },
    KNOWLEDGE: {
        SEARCH: "knowledge:search",
        IMPORT: "knowledge:import",
        GET_DOCUMENTS: "knowledge:get-documents",
        GET_SUMMARY: "knowledge:get-summary",
        DELETE: "knowledge:delete",
        CLEAR: "knowledge:clear",
    },
    DESKTOP_CONTEXT: {
        GET: "desktop-context:get",
    },
    SETTINGS: {
        GET: "settings:get",
        UPDATE: "settings:update",
        RESET: "settings:reset",
    },
    HOTKEY: {
        GET_STATUS: "hotkey:get-status",
        REGISTER: "hotkey:register",
    },
} as const;

const electronAPI = {
    system: {
        ping: () => ipcRenderer.invoke(CHANNELS.SYSTEM.PING),
        getInfo: () => ipcRenderer.invoke(CHANNELS.SYSTEM.GET_INFO),
        openUrl: (url: string) => ipcRenderer.invoke(CHANNELS.SYSTEM.OPEN_URL, url),
        openPath: (path: string) => ipcRenderer.invoke(CHANNELS.SYSTEM.OPEN_PATH, path),
        showNotification: (title: string, body: string) =>
            ipcRenderer.invoke(CHANNELS.SYSTEM.SHOW_NOTIFICATION, { title, body }),
        executeCommand: (command: string, cwd?: string) =>
            ipcRenderer.invoke(CHANNELS.SYSTEM.EXECUTE_COMMAND, { command, cwd }),
        isBootCompleted: () => ipcRenderer.invoke(CHANNELS.SYSTEM.IS_BOOT_COMPLETED),
        markBootCompleted: () => ipcRenderer.invoke(CHANNELS.SYSTEM.MARK_BOOT_COMPLETED),
        resetBootState: () => ipcRenderer.invoke(CHANNELS.SYSTEM.RESET_BOOT_STATE),
    },
    workspace: {
        getStatus: () => ipcRenderer.invoke(CHANNELS.WORKSPACE.GET_STATUS),
        getAll: () => ipcRenderer.invoke(CHANNELS.WORKSPACE.GET_ALL),
        sync: (workspaces: any[]) => ipcRenderer.invoke(CHANNELS.WORKSPACE.SYNC, workspaces),
        launch: (payload: any) => ipcRenderer.invoke(CHANNELS.WORKSPACE.LAUNCH, payload),
    },
    apps: {
        discover: () => ipcRenderer.invoke(CHANNELS.APPS.DISCOVER),
        getDiscovered: () => ipcRenderer.invoke(CHANNELS.APPS.GET_DISCOVERED),
        getApproved: () => ipcRenderer.invoke(CHANNELS.APPS.GET_APPROVED),
        approve: (app: any, aliases?: string[]) =>
            ipcRenderer.invoke(CHANNELS.APPS.APPROVE, { app, aliases }),
        revoke: (id: string) => ipcRenderer.invoke(CHANNELS.APPS.REVOKE, id),
        updateAliases: (id: string, aliases: string[]) =>
            ipcRenderer.invoke(CHANNELS.APPS.UPDATE_ALIASES, { id, aliases }),
    },
    commandAgent: {
        execute: (prompt: string, options?: any) =>
            ipcRenderer.invoke(CHANNELS.COMMAND_AGENT.EXECUTE, prompt, options),
        confirm: (confirmationId: string) =>
            ipcRenderer.invoke(CHANNELS.COMMAND_AGENT.CONFIRM, confirmationId),
        confirmAction: (confirmationId: string) =>
            ipcRenderer.invoke(CHANNELS.COMMAND_AGENT.CONFIRM, confirmationId),
        cancel: (confirmationId: string) =>
            ipcRenderer.invoke(CHANNELS.COMMAND_AGENT.CANCEL, confirmationId),
        cancelAction: (confirmationId: string) =>
            ipcRenderer.invoke(CHANNELS.COMMAND_AGENT.CANCEL, confirmationId),
    },
    tasks: {
        getTasks: () => ipcRenderer.invoke(CHANNELS.TASKS.GET),
        syncTasks: (tasks: any[]) => ipcRenderer.invoke(CHANNELS.TASKS.SYNC, tasks),
        onTasksChanged: (callback: (tasks: any[]) => void) => {
            const listener = (_event: any, tasks: any[]) => callback(tasks);
            ipcRenderer.on(CHANNELS.TASKS.CHANGED, listener);
            return () => {
                ipcRenderer.removeListener(CHANNELS.TASKS.CHANGED, listener);
            };
        },
    },
    goals: {
        getGoals: () => ipcRenderer.invoke(CHANNELS.GOALS.GET),
        syncGoals: (goals: any[]) => ipcRenderer.invoke(CHANNELS.GOALS.SYNC, goals),
        onGoalsChanged: (callback: (goals: any[]) => void) => {
            const listener = (_event: any, goals: any[]) => callback(goals);
            ipcRenderer.on(CHANNELS.GOALS.CHANGED, listener);
            return () => {
                ipcRenderer.removeListener(CHANNELS.GOALS.CHANGED, listener);
            };
        },
    },
    projects: {
        getProjects: () => ipcRenderer.invoke(CHANNELS.PROJECTS.GET),
        syncProjects: (projects: any[]) => ipcRenderer.invoke(CHANNELS.PROJECTS.SYNC, projects),
        onProjectsChanged: (callback: (projects: any[]) => void) => {
            const listener = (_event: any, projects: any[]) => callback(projects);
            ipcRenderer.on(CHANNELS.PROJECTS.CHANGED, listener);
            return () => {
                ipcRenderer.removeListener(CHANNELS.PROJECTS.CHANGED, listener);
            };
        },
    },
    aiProvider: {
        getStatuses: () => ipcRenderer.invoke(CHANNELS.AI_PROVIDER.GET_STATUSES),
        getActive: () => ipcRenderer.invoke(CHANNELS.AI_PROVIDER.GET_ACTIVE),
        setActive: (providerId: string) =>
            ipcRenderer.invoke(CHANNELS.AI_PROVIDER.SET_ACTIVE, providerId),
        getConfigStatus: (providerId: string) =>
            ipcRenderer.invoke(CHANNELS.AI_PROVIDER.GET_CONFIG_STATUS, providerId),
        checkAvailability: (providerId: string) =>
            ipcRenderer.invoke(CHANNELS.AI_PROVIDER.CHECK_AVAILABILITY, providerId),
    },
    voice: {
        getStatus: () => ipcRenderer.invoke(CHANNELS.VOICE.GET_STATUS),
        transcribe: (audioBuffer: Uint8Array | ArrayBuffer) =>
            ipcRenderer.invoke(CHANNELS.VOICE.TRANSCRIBE, audioBuffer),
    },
    wakeWord: {
        getStatus: () => ipcRenderer.invoke(CHANNELS.WAKE_WORD.GET_STATUS),
        predict: (audio: string, threshold?: number) =>
            ipcRenderer.invoke(CHANNELS.WAKE_WORD.PREDICT, { audio, threshold }),
        setPhrase: (phrase: string) =>
            ipcRenderer.invoke(CHANNELS.WAKE_WORD.SET_PHRASE, phrase),
    },
    tts: {
        getStatus: () => ipcRenderer.invoke(CHANNELS.TTS.GET_STATUS),
        speak: (text: string, options?: any) =>
            ipcRenderer.invoke(CHANNELS.TTS.SPEAK, text, options),
        stop: () => ipcRenderer.invoke(CHANNELS.TTS.STOP),
        setOptions: (options: any) =>
            ipcRenderer.invoke(CHANNELS.TTS.SET_OPTIONS, options),
        onEvent: (callback: (event: any) => void) => {
            const listener = (_event: any, data: any) => callback(data);
            ipcRenderer.on(CHANNELS.TTS.EVENT, listener);
            return () => {
                ipcRenderer.removeListener(CHANNELS.TTS.EVENT, listener);
            };
        },
    },
    proactive: {
        getSuggestions: (options?: { force?: boolean }) =>
            ipcRenderer.invoke(CHANNELS.PROACTIVE.GET_SUGGESTIONS, options),
        dismiss: (keyOrId: string) =>
            ipcRenderer.invoke(CHANNELS.PROACTIVE.DISMISS, keyOrId),
        reset: () =>
            ipcRenderer.invoke(CHANNELS.PROACTIVE.RESET),
    },
    memory: {
        getAll: (options?: any) =>
            ipcRenderer.invoke(CHANNELS.MEMORY.GET_ALL, options),
        getById: (id: string) =>
            ipcRenderer.invoke(CHANNELS.MEMORY.GET_BY_ID, id),
        save: (item: any) =>
            ipcRenderer.invoke(CHANNELS.MEMORY.SAVE, item),
        update: (id: string, updates: any) =>
            ipcRenderer.invoke(CHANNELS.MEMORY.UPDATE, id, updates),
        delete: (id: string) =>
            ipcRenderer.invoke(CHANNELS.MEMORY.DELETE, id),
        clear: () =>
            ipcRenderer.invoke(CHANNELS.MEMORY.CLEAR),
    },
    routines: {
        getRoutines: () => ipcRenderer.invoke(CHANNELS.ROUTINES.GET_ALL),
    },
    briefing: {
        get: (options?: any) => ipcRenderer.invoke(CHANNELS.BRIEFING.GET, options),
    },
    review: {
        get: (options?: any) => ipcRenderer.invoke(CHANNELS.REVIEW.GET, options),
    },
    weeklyReview: {
        get: (options?: any) => ipcRenderer.invoke(CHANNELS.WEEKLY_REVIEW.GET, options),
        generateReview: (options?: any) => ipcRenderer.invoke(CHANNELS.WEEKLY_REVIEW.GET, options),
        generatePlanProposal: (options?: any) => ipcRenderer.invoke(CHANNELS.WEEKLY_PLAN.GET, options),
    },
    weeklyPlan: {
        get: (options?: any) => ipcRenderer.invoke(CHANNELS.WEEKLY_PLAN.GET, options),
    },
    schedules: {
        getSchedules: () => ipcRenderer.invoke(CHANNELS.SCHEDULES.GET_ALL),
        list: () => ipcRenderer.invoke(CHANNELS.SCHEDULES.GET_ALL),
        create: (input: any) => ipcRenderer.invoke(CHANNELS.SCHEDULES.CREATE, input),
        setEnabled: (id: string, enabled: boolean) =>
            ipcRenderer.invoke(CHANNELS.SCHEDULES.SET_ENABLED, { id, enabled }),
        delete: (id: string) => ipcRenderer.invoke(CHANNELS.SCHEDULES.DELETE, id),
        executeNow: (schedule: any) => ipcRenderer.invoke(CHANNELS.SCHEDULES.EXECUTE_NOW, schedule),
    },
    scheduler: {
        list: () => ipcRenderer.invoke(CHANNELS.SCHEDULES.GET_ALL),
        create: (input: any) => ipcRenderer.invoke(CHANNELS.SCHEDULES.CREATE, input),
        setEnabled: (id: string, enabled: boolean) =>
            ipcRenderer.invoke(CHANNELS.SCHEDULES.SET_ENABLED, { id, enabled }),
        delete: (id: string) => ipcRenderer.invoke(CHANNELS.SCHEDULES.DELETE, id),
        executeNow: (schedule: any) => ipcRenderer.invoke(CHANNELS.SCHEDULES.EXECUTE_NOW, schedule),
    },
    automations: {
        getRules: () => ipcRenderer.invoke(CHANNELS.AUTOMATIONS.GET_ALL),
        list: () => ipcRenderer.invoke(CHANNELS.AUTOMATIONS.GET_ALL),
        create: (input: any) => ipcRenderer.invoke(CHANNELS.AUTOMATIONS.CREATE, input),
        setEnabled: (id: string, enabled: boolean) =>
            ipcRenderer.invoke(CHANNELS.AUTOMATIONS.SET_ENABLED, { id, enabled }),
        delete: (id: string) => ipcRenderer.invoke(CHANNELS.AUTOMATIONS.DELETE, id),
    },
    events: {
        getRecent: (limit?: number) => ipcRenderer.invoke(CHANNELS.EVENTS.GET_RECENT, limit),
        publish: (type: string, payload: any) => ipcRenderer.invoke(CHANNELS.EVENTS.PUBLISH, { type, payload }),
        on: (_eventType: string, _callback: any) => {
            // renderer subscription placeholder
            return () => {};
        },
    },
    focus: {
        getStatus: () => ipcRenderer.invoke(CHANNELS.FOCUS.GET_STATUS),
        start: (options?: any) => ipcRenderer.invoke(CHANNELS.FOCUS.START, options),
        pause: () => ipcRenderer.invoke(CHANNELS.FOCUS.PAUSE),
        resume: () => ipcRenderer.invoke(CHANNELS.FOCUS.RESUME),
        stop: () => ipcRenderer.invoke(CHANNELS.FOCUS.STOP),
        addMinutes: () => ipcRenderer.invoke(CHANNELS.FOCUS.ADD_MINUTES),
    },
    desktop: {
        getState: () => ipcRenderer.invoke(CHANNELS.DESKTOP.GET_STATE),
        show: () => ipcRenderer.invoke(CHANNELS.DESKTOP.SHOW),
        hide: () => ipcRenderer.invoke(CHANNELS.DESKTOP.HIDE),
    },
    notifications: {
        send: (options: { title: string; body: string; category?: string; priority?: string; silent?: boolean }) =>
            ipcRenderer.invoke(CHANNELS.NOTIFICATIONS.SEND, options),
        getPreferences: () => ipcRenderer.invoke(CHANNELS.NOTIFICATIONS.GET_PREFERENCES),
        updatePreferences: (updates: any) =>
            ipcRenderer.invoke(CHANNELS.NOTIFICATIONS.UPDATE_PREFERENCES, updates),
        getHistory: (options?: any) => ipcRenderer.invoke(CHANNELS.NOTIFICATIONS.GET_HISTORY, options),
        dismiss: (id: string) => ipcRenderer.invoke(CHANNELS.NOTIFICATIONS.DISMISS, id),
        clearHistory: () => ipcRenderer.invoke(CHANNELS.NOTIFICATIONS.CLEAR_HISTORY),
    },
    knowledge: {
        search: (options: any) => ipcRenderer.invoke(CHANNELS.KNOWLEDGE.SEARCH, options),
        import: (input: any) => ipcRenderer.invoke(CHANNELS.KNOWLEDGE.IMPORT, input),
        getDocuments: (filter?: any) => ipcRenderer.invoke(CHANNELS.KNOWLEDGE.GET_DOCUMENTS, filter),
        getSummary: () => ipcRenderer.invoke(CHANNELS.KNOWLEDGE.GET_SUMMARY),
        delete: (id: string) => ipcRenderer.invoke(CHANNELS.KNOWLEDGE.DELETE, id),
        clear: () => ipcRenderer.invoke(CHANNELS.KNOWLEDGE.CLEAR),
    },
    desktopContext: {
        get: () => ipcRenderer.invoke(CHANNELS.DESKTOP_CONTEXT.GET),
    },
    settings: {
        get: () => ipcRenderer.invoke(CHANNELS.SETTINGS.GET),
        update: (partial: any) => ipcRenderer.invoke(CHANNELS.SETTINGS.UPDATE, partial),
        reset: () => ipcRenderer.invoke(CHANNELS.SETTINGS.RESET),
    },
    hotkey: {
        getStatus: () => ipcRenderer.invoke(CHANNELS.HOTKEY.GET_STATUS),
        register: (shortcut: string) => ipcRenderer.invoke(CHANNELS.HOTKEY.REGISTER, shortcut),
        onSummon: (callback: () => void) => {
            const listener = () => callback();
            ipcRenderer.on("hotkey:summon-alfred", listener);
            return () => {
                ipcRenderer.removeListener("hotkey:summon-alfred", listener);
            };
        },
    },
};

contextBridge.exposeInMainWorld("electron", electronAPI);
