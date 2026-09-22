export const IPC_CHANNELS = {
    SYSTEM: {
        PING: "system:ping",
        GET_INFO: "system:get-info",
        OPEN_URL: "system:open-url",
        OPEN_PATH: "system:open-path",
        SHOW_NOTIFICATION: "system:show-notification",
        EXECUTE_COMMAND: "system:execute-command",
    },
    WORKSPACE: {
        GET_STATUS: "workspace:get-status",
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
} as const;

export interface SystemPingResult {
    status: "ok";
    timestamp: number;
}
