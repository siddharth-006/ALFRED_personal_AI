export const IPC_CHANNELS = {
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
    AI_PROVIDER: {
        GET_STATUSES: "ai-provider:get-statuses",
        GET_ACTIVE: "ai-provider:get-active",
        SET_ACTIVE: "ai-provider:set-active",
        GET_CONFIG_STATUS: "ai-provider:get-config-status",
        CHECK_AVAILABILITY: "ai-provider:check-availability",
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

export interface SystemPingResult {
    status: "ok";
    timestamp: number;
}
