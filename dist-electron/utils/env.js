"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPackaged = exports.isDev = void 0;
exports.getPreloadPath = getPreloadPath;
exports.getProductionHtmlPath = getProductionHtmlPath;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
exports.isDev = typeof electron_1.app !== "undefined" && electron_1.app ? !electron_1.app.isPackaged : process.env.NODE_ENV !== "production";
exports.isPackaged = typeof electron_1.app !== "undefined" && electron_1.app ? Boolean(electron_1.app.isPackaged) : false;
/**
 * Resolves path to compiled preload script
 */
function getPreloadPath() {
    return path_1.default.join(__dirname, "../preload/index.js");
}
/**
 * Resolves path to static HTML export (out/index.html) in production
 */
function getProductionHtmlPath() {
    return path_1.default.join(electron_1.app.getAppPath(), "out", "index.html");
}
