"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAIProviderIpcHandlers = registerAIProviderIpcHandlers;
const electron_1 = require("electron");
const constants_1 = require("../../config/constants");
const provider_config_service_1 = require("../../agent/providers/config/provider-config.service");
const provider_registry_1 = require("../../agent/providers/provider-registry");
const logger_1 = require("../../utils/logger");
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
function registerAIProviderIpcHandlers() {
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_PROVIDER.GET_STATUSES, () => {
        logger_1.logger.info("IPC ai-provider:get-statuses received");
        return provider_config_service_1.providerConfigService.listAllProviderStatuses();
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_PROVIDER.GET_ACTIVE, () => {
        logger_1.logger.info("IPC ai-provider:get-active received");
        return provider_config_service_1.providerConfigService.getActiveProviderId();
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_PROVIDER.SET_ACTIVE, (_event, providerId) => {
        logger_1.logger.info(`IPC ai-provider:set-active received for: ${providerId}`);
        try {
            provider_config_service_1.providerConfigService.setActiveProviderId(providerId);
            const effectiveId = provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
            return {
                requestedId: providerId,
                effectiveId,
                status: provider_config_service_1.providerConfigService.getProviderStatus(effectiveId),
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Invalid provider ID";
            logger_1.logger.error(`IPC ai-provider:set-active error -> ${message}`);
            return {
                error: message,
                effectiveId: provider_config_service_1.providerConfigService.resolveEffectiveProviderId(),
            };
        }
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_PROVIDER.GET_CONFIG_STATUS, (_event, providerId) => {
        logger_1.logger.info(`IPC ai-provider:get-config-status received for: ${providerId}`);
        return provider_config_service_1.providerConfigService.getProviderStatus(providerId);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_PROVIDER.CHECK_AVAILABILITY, async (_event, providerId) => {
        logger_1.logger.info(`IPC ai-provider:check-availability received for: ${providerId}`);
        const provider = provider_registry_1.providerRegistry.getProvider(providerId);
        if (!provider) {
            return { available: false, error: `Provider '${providerId}' not found.` };
        }
        try {
            const available = await provider.isAvailable();
            return { available };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Availability check failed";
            return { available: false, error: message };
        }
    });
}
