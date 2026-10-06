/**
 * ALFRED Phase 5.5C — Proactive Intelligence IPC Handler
 *
 * Exposes read-only proactive suggestions and explicit dismissal to the renderer process.
 */

import { ipcMain } from "electron";
import { proactiveAgentService } from "../../agent/proactive/proactive-agent.service";
import { agentContextService } from "../../agent/agent-context/agent-context.service";
import { logger } from "../../utils/logger";

export const PROACTIVE_CHANNELS = {
    GET_SUGGESTIONS: "proactive:get-suggestions",
    DISMISS: "proactive:dismiss",
    RESET: "proactive:reset",
} as const;

export function registerProactiveIpcHandlers(): void {
    logger.info("Registering Proactive Intelligence IPC Handlers...");

    ipcMain.handle(PROACTIVE_CHANNELS.GET_SUGGESTIONS, async (_event, options?: { force?: boolean }) => {
        try {
            const snapshot = agentContextService.getContextSnapshot();
            return proactiveAgentService.evaluate(snapshot, options);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to evaluate proactive suggestions";
            logger.error(`ProactiveIPC: Evaluation failed -> ${message}`);
            return {
                suggestions: [],
                activeSuggestion: null,
                evaluatedAt: new Date().toISOString(),
            };
        }
    });

    ipcMain.handle(PROACTIVE_CHANNELS.DISMISS, async (_event, keyOrId: string) => {
        try {
            proactiveAgentService.dismiss(keyOrId);
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to dismiss proactive suggestion";
            logger.error(`ProactiveIPC: Dismiss failed -> ${message}`);
            return false;
        }
    });

    ipcMain.handle(PROACTIVE_CHANNELS.RESET, async () => {
        try {
            proactiveAgentService.resetCooldowns();
            return true;
        } catch {
            return false;
        }
    });
}
