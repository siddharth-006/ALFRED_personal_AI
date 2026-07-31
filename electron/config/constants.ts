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
} as const;

export interface SystemPingResult {
    status: "ok";
    timestamp: number;
}
