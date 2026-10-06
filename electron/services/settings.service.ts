/**
 * ALFRED Settings & Permissions — Service
 *
 * Persists application settings and enforces the permissions execution model.
 * Safe, local-first, zero secrets in renderer.
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import {
    AlfredSettings,
    DEFAULT_ALFRED_SETTINGS,
    PermissionCategory,
} from "./settings.types";
import { logger } from "../utils/logger";
import { hotkeyService } from "./hotkey.service";
import { getUserDataDirectory } from "../utils/paths";

export class SettingsService {
    private static instance: SettingsService | null = null;
    private persistencePath: string = "";
    private settings: AlfredSettings = { ...DEFAULT_ALFRED_SETTINGS };

    public constructor(customPath?: string) {
        if (customPath) {
            this.persistencePath = customPath;
        } else {
            this.initStoragePath();
        }
        this.loadFromDisk();
    }

    public static getInstance(): SettingsService {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }

    private initStoragePath(): void {
        try {
            const userData = getUserDataDirectory();
            this.persistencePath = path.join(userData, "settings.json");
        } catch {
            this.persistencePath = path.join(getUserDataDirectory(), "settings.json");
        }
    }

    /**
     * Loads settings from disk with corruption resilience.
     */
    public loadFromDisk(): AlfredSettings {
        try {
            if (!fs.existsSync(this.persistencePath)) {
                this.settings = { ...DEFAULT_ALFRED_SETTINGS };
                this.saveToDisk();
                return this.settings;
            }

            const raw = fs.readFileSync(this.persistencePath, "utf-8");
            if (!raw.trim()) {
                this.settings = { ...DEFAULT_ALFRED_SETTINGS };
                return this.settings;
            }

            const parsed = JSON.parse(raw);
            this.settings = {
                ...DEFAULT_ALFRED_SETTINGS,
                ...parsed,
                aiProvider: {
                    ...DEFAULT_ALFRED_SETTINGS.aiProvider,
                    ...(parsed.aiProvider || {}),
                },
                voice: {
                    ...DEFAULT_ALFRED_SETTINGS.voice,
                    ...(parsed.voice || {}),
                },
                wakeWord: {
                    ...DEFAULT_ALFRED_SETTINGS.wakeWord,
                    ...(parsed.wakeWord || {}),
                },
                tts: {
                    ...DEFAULT_ALFRED_SETTINGS.tts,
                    ...(parsed.tts || {}),
                },
                notifications: {
                    ...DEFAULT_ALFRED_SETTINGS.notifications,
                    ...(parsed.notifications || {}),
                },
                background: {
                    ...DEFAULT_ALFRED_SETTINGS.background,
                    ...(parsed.background || {}),
                },
                permissions: {
                    ...DEFAULT_ALFRED_SETTINGS.permissions,
                    ...(parsed.permissions || {}),
                },
                hotkey: {
                    ...DEFAULT_ALFRED_SETTINGS.hotkey,
                    ...(parsed.hotkey || {}),
                },
                automation: {
                    ...DEFAULT_ALFRED_SETTINGS.automation,
                    ...(parsed.automation || {}),
                },
                knowledge: {
                    ...DEFAULT_ALFRED_SETTINGS.knowledge,
                    ...(parsed.knowledge || {}),
                },
                onboarding: {
                    ...DEFAULT_ALFRED_SETTINGS.onboarding,
                    ...(parsed.onboarding || {}),
                },
            };
            try {
                const { providerRegistry } = require("../agent/providers/provider-registry");
                const { providerConfigService } = require("../agent/providers/config/provider-config.service");
                providerRegistry.setActiveProviderId(this.settings.aiProvider.activeProvider);
                providerConfigService.setActiveProviderId(this.settings.aiProvider.activeProvider);
            } catch {}
            logger.info("[SettingsService] Settings loaded from disk.");
            return this.settings;
        } catch (err: any) {
            logger.warn(`[SettingsService] Corrupted settings file detected: ${err?.message}. Recovering with defaults...`);
            try {
                const backup = `${this.persistencePath}.corrupt.${Date.now()}`;
                if (fs.existsSync(this.persistencePath)) {
                    fs.renameSync(this.persistencePath, backup);
                }
            } catch {}
            this.settings = { ...DEFAULT_ALFRED_SETTINGS };
            this.saveToDisk();
            return this.settings;
        }
    }

    /**
     * Saves settings to local persistence safely.
     */
    public saveToDisk(): void {
        try {
            this.settings.updatedAt = new Date().toISOString();
            fs.writeFileSync(this.persistencePath, JSON.stringify(this.settings, null, 2), "utf-8");
        } catch (err: any) {
            logger.error(`[SettingsService] Failed to save settings to disk: ${err?.message}`);
        }
    }

    public getSettings(): AlfredSettings {
        return { ...this.settings };
    }

    /**
     * Updates settings safely.
     */
    public updateSettings(partial: Partial<AlfredSettings>): AlfredSettings {
        if (!partial || typeof partial !== "object") {
            return this.getSettings();
        }

        const prevShortcut = this.settings.hotkey.shortcut;

        this.settings = {
            ...this.settings,
            ...partial,
            aiProvider: {
                ...this.settings.aiProvider,
                ...(partial.aiProvider || {}),
            },
            voice: {
                ...this.settings.voice,
                ...(partial.voice || {}),
            },
            wakeWord: {
                ...this.settings.wakeWord,
                ...(partial.wakeWord || {}),
            },
            tts: {
                ...this.settings.tts,
                ...(partial.tts || {}),
            },
            notifications: {
                ...this.settings.notifications,
                ...(partial.notifications || {}),
            },
            background: {
                ...this.settings.background,
                ...(partial.background || {}),
            },
            permissions: {
                ...this.settings.permissions,
                ...(partial.permissions || {}),
            },
            hotkey: {
                ...this.settings.hotkey,
                ...(partial.hotkey || {}),
            },
            automation: {
                ...this.settings.automation,
                ...(partial.automation || {}),
            },
            knowledge: {
                ...this.settings.knowledge,
                ...(partial.knowledge || {}),
            },
            onboarding: {
                ...this.settings.onboarding,
                ...(partial.onboarding || {}),
            },
        };

        // If hotkey shortcut changed, re-register
        if (this.settings.hotkey.shortcut !== prevShortcut && this.settings.hotkey.enabled) {
            hotkeyService.register(this.settings.hotkey.shortcut);
        } else if (!this.settings.hotkey.enabled) {
            hotkeyService.unregister();
        }

        // Sync active AI provider with ProviderRegistry and ProviderConfigService
        if (partial.aiProvider?.activeProvider) {
            try {
                const { providerRegistry } = require("../agent/providers/provider-registry");
                const { providerConfigService } = require("../agent/providers/config/provider-config.service");
                providerRegistry.setActiveProviderId(this.settings.aiProvider.activeProvider);
                providerConfigService.setActiveProviderId(this.settings.aiProvider.activeProvider);
            } catch (err: any) {
                logger.debug(`[SettingsService] ProviderRegistry sync notice: ${err?.message}`);
            }
        }

        // Sync notification preferences with NotificationManager
        if (partial.notifications) {
            try {
                const { notificationManager } = require("./notification-manager.service");
                notificationManager.updatePreferences({
                    enabled: this.settings.notifications.enabled,
                    cooldownMs: this.settings.notifications.cooldownMs,
                    quietHours: {
                        enabled: this.settings.notifications.quietHoursEnabled,
                        startHour: this.settings.notifications.quietHoursStart,
                        endHour: this.settings.notifications.quietHoursEnd,
                        allowHighPriorityOnly: true,
                    },
                });
            } catch (err: any) {
                logger.debug(`[SettingsService] NotificationManager sync notice: ${err?.message}`);
            }
        }

        this.saveToDisk();
        logger.info("[SettingsService] Updated settings saved and synced to runtime.");
        return this.getSettings();
    }

    /**
     * Verifies if an action category is permitted by the user.
     */
    public isPermitted(category: PermissionCategory): boolean {
        return Boolean(this.settings.permissions[category] ?? true);
    }

    /**
     * Verifies if mutations strictly require human confirmation.
     */
    public requiresConfirmationForMutations(): boolean {
        return Boolean(this.settings.permissions.requireConfirmationForMutations ?? true);
    }

    /**
     * Resets settings back to defaults.
     */
    public resetToDefaults(): AlfredSettings {
        this.settings = { ...DEFAULT_ALFRED_SETTINGS };
        this.saveToDisk();
        logger.info("[SettingsService] Reset settings to default values.");
        return this.getSettings();
    }
}

export const settingsService = SettingsService.getInstance();
