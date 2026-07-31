"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_CONFIG = void 0;
exports.APP_CONFIG = {
    title: "ALFRED",
    window: {
        width: 1600,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
    },
    devServerUrl: process.env.DEV_SERVER_URL || "http://localhost:3000",
};
