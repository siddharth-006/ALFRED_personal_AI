import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../config/constants";
import { providerConfigService } from "../../agent/providers/config/provider-config.service";
import { providerRegistry } from "../../agent/providers/provider-registry";
import { AIProviderId } from "../../agent/providers/types";
import { logger } from "../../utils/logger";

/**
 * AI Provider IPC Handlers (Phase 3.3 - Step 4.2 & Step 4.4)
 *
 * Exposes safe provider configuration and status querying methods to renderer process via IPC.
 *
 * SECURE:
 * - NEVER exposes child_process, spawn, exec, shell APIs, or raw filesystem access.
 * - NEVER exposes API keys or cloud credentials.
 * - Only transmits provider ID strings and status metadata objects.
 */
export function registerAIProviderIpcHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.AI_PROVIDER.GET_STATUSES, () => {
        logger.info("IPC ai-provider:get-statuses received");
        return providerConfigService.listAllProviderStatuses();
    });

    ipcMain.handle(IPC_CHANNELS.AI_PROVIDER.GET_ACTIVE, () => {
        logger.info("IPC ai-provider:get-active received");
        return providerConfigService.getActiveProviderId();
    });

    ipcMain.handle(IPC_CHANNELS.AI_PROVIDER.SET_ACTIVE, (_event, providerId: string) => {
        logger.info(`IPC ai-provider:set-active received for: ${providerId}`);
        try {
            providerConfigService.setActiveProviderId(providerId as AIProviderId);
            const effectiveId = providerConfigService.resolveEffectiveProviderId();
            return {
                requestedId: providerId,
                effectiveId,
                status: providerConfigService.getProviderStatus(effectiveId),
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Invalid provider ID";
            logger.error(`IPC ai-provider:set-active error -> ${message}`);
            return {
                error: message,
                effectiveId: providerConfigService.resolveEffectiveProviderId(),
            };
        }
    });

    ipcMain.handle(IPC_CHANNELS.AI_PROVIDER.GET_CONFIG_STATUS, (_event, providerId: string) => {
        logger.info(`IPC ai-provider:get-config-status received for: ${providerId}`);
        return providerConfigService.getProviderStatus(providerId as AIProviderId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_PROVIDER.CHECK_AVAILABILITY, async (_event, providerId: string) => {
        logger.info(`IPC ai-provider:check-availability received for: ${providerId}`);
        const provider = providerRegistry.getProvider(providerId);
        if (!provider) {
            return { available: false, error: `Provider '${providerId}' not found.` };
        }
        try {
            const available = await provider.isAvailable();
            return { available };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Availability check failed";
            return { available: false, error: message };
        }
    });
}
