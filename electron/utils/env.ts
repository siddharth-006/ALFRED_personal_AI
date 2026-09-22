import { app } from "electron";
import path from "path";

export const isDev = typeof app !== "undefined" && app ? !app.isPackaged : process.env.NODE_ENV !== "production";
export const isPackaged = typeof app !== "undefined" && app ? Boolean(app.isPackaged) : false;

/**
 * Resolves path to compiled preload script
 */
export function getPreloadPath(): string {
    return path.join(__dirname, "../preload/index.js");
}

/**
 * Resolves path to static HTML export (out/index.html) in production
 */
export function getProductionHtmlPath(): string {
    return path.join(app.getAppPath(), "out", "index.html");
}
