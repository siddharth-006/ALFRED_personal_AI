export const APP_CONFIG = {
    title: "ALFRED",
    window: {
        width: 1600,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
    },
    devServerUrl: process.env.DEV_SERVER_URL || "http://localhost:3000",
} as const;
