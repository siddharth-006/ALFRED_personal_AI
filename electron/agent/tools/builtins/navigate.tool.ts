import { ToolDefinition, ToolResult } from "../types";
import { logger } from "../../../utils/logger";

export interface NavigateInput {
    route: string;
}

export interface NavigateOutput {
    route: string;
    targetPath: string;
}

/** Whitelist of valid ALFRED internal routes */
const VALID_ROUTE_MAP: Record<string, string> = {
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
export const navigateTool: ToolDefinition<NavigateInput, NavigateOutput> = {
    name: "navigate",
    description: "Navigate to predefined ALFRED internal routes (missions, goals, projects, workspaces, dashboard)",
    category: "navigation",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with a 'route' string property." };
        }
        const obj = input as Record<string, unknown>;
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
    execute: (input: NavigateInput): ToolResult<NavigateOutput> => {
        const rawRoute = String(input.route || (input as any).target || (input as any).view || "");
        const normalized = rawRoute.trim().toLowerCase();
        const targetPath = VALID_ROUTE_MAP[normalized];

        logger.info(`navigate tool: Resolving target '${rawRoute}' -> '${targetPath}'`);

        return {
            success: true,
            data: {
                route: normalized,
                targetPath,
            },
        };
    },
};
