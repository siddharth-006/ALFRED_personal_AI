"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.navigateTool = void 0;
const logger_1 = require("../../../utils/logger");
/** Whitelist of valid ALFRED internal routes */
const VALID_ROUTE_MAP = {
    "missions": "/tasks",
    "tasks": "/tasks",
    "goals": "/goals",
    "projects": "/projects",
    "workspaces": "/workspaces",
    "dashboard": "/",
    "home": "/",
};
/**
 * navigate tool adapter (Phase 3.3 - Step 1)
 *
 * Validates navigation target against strict whitelist of valid ALFRED routes.
 * Prevents navigation to arbitrary routes, external URLs, or unvetted views.
 */
exports.navigateTool = {
    name: "navigate",
    description: "Navigate to predefined ALFRED internal routes (missions, goals, projects, workspaces, dashboard)",
    category: "navigation",
    validateInput: (input) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with a 'route' string property." };
        }
        const obj = input;
        const routeVal = obj.route || obj.target || obj.view;
        if (typeof routeVal !== "string" || !routeVal.trim()) {
            return { valid: false, error: "Route ('route' or 'target') must be a non-empty string." };
        }
        const normalized = routeVal.trim().toLowerCase();
        if (!VALID_ROUTE_MAP[normalized]) {
            return {
                valid: false,
                error: `Invalid navigation target '${routeVal}'. Allowed targets: ${Object.keys(VALID_ROUTE_MAP).join(", ")}.`,
            };
        }
        return { valid: true };
    },
    execute: (input) => {
        const rawRoute = String(input.route || input.target || input.view || "");
        const normalized = rawRoute.trim().toLowerCase();
        const targetPath = VALID_ROUTE_MAP[normalized];
        logger_1.logger.info(`navigate tool: Resolving target '${rawRoute}' -> '${targetPath}'`);
        return {
            success: true,
            data: {
                route: normalized,
                targetPath,
            },
        };
    },
};
