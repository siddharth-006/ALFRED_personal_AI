"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = void 0;
exports.IPC_CHANNELS = {
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
};
