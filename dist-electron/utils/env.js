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
exports.isDev = !electron_1.app.isPackaged;
exports.isPackaged = electron_1.app.isPackaged;
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
