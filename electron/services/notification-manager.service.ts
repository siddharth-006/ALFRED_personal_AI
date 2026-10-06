/**
 * ALFRED Notification Manager Service
 *
 * Orchestration layer above the low-level NotificationService.
 * Handles priority levels, deduplication, cooldown, quiet hours, category preferences,
 * bounded history, dismissal, and safe action routing.
 *
 * ARCHITECTURAL GUARANTEES:
 * 1. Low-level adapter isolation: Delegates native OS display exclusively to NotificationService.
 * 2. Grounded, Factual Notifications: No artificial urgency or psychological productivity judgments.
 * 3. Safe Action Routing: Any notification action routes strictly through CommandAgent/ToolRegistry.
 * 4. Local Persistence: Lightweight JSON storage without external database dependencies.
 * 5. Bounded Resources: History capped at 50 records.
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { getUserDataDirectory } from "../utils/paths";
import {
    NotificationCategory,
    NotificationPriority,
    NotificationRequest,
    NotificationRecord,
    NotificationPreferences,
    DEFAULT_NOTIFICATION_PREFERENCES,
} from "./notification-manager.types";
import { notificationService } from "./notification.service";
import { logger } from "../utils/logger";

const MAX_HISTORY_ITEMS = 50;

/** Judgmental or manipulative phrases that must be filtered or softened */
const UNGROUNDED_PHRASES = [
    /you are falling behind/i,
    /you failed to/i,
    /slacking off/i,
    /wasting time/i,
    /unproductive/i,
    /disappointing/i,
];

export class NotificationManager {
    private static instance: NotificationManager | null = null;
    private preferences: NotificationPreferences;
    private history: NotificationRecord[] = [];
    private cooldownMap: Map<string, number> = new Map();
    private storageFilePath: string;

    constructor(storagePath?: string) {
        this.preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
        this.storageFilePath = storagePath || this.resolveStoragePath();
        this.loadFromDisk();
    }

    public static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    private resolveStoragePath(): string {
        try {
            const userDataDir = getUserDataDirectory();
            return path.join(userDataDir, "alfred_notifications.json");
        } catch {
            return path.join(getUserDataDirectory(), "alfred_notifications.json");
        }
    }

    public setStoragePath(customPath: string): void {
        this.storageFilePath = customPath;
        this.loadFromDisk();
    }

    public loadFromDisk(): void {
        try {
            if (fs.existsSync(this.storageFilePath)) {
                const data = fs.readFileSync(this.storageFilePath, "utf8");
                if (data.trim()) {
                    const parsed = JSON.parse(data);
                    if (parsed.preferences) {
                        this.preferences = {
                            ...DEFAULT_NOTIFICATION_PREFERENCES,
                            ...parsed.preferences,
                            categories: {
                                ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
                                ...(parsed.preferences.categories || {}),
                            },
                            quietHours: {
                                ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
                                ...(parsed.preferences.quietHours || {}),
                            },
                        };
                    }
                    if (Array.isArray(parsed.history)) {
                        this.history = parsed.history.slice(-MAX_HISTORY_ITEMS);
                    }
                    logger.info(`[NotificationManager] Loaded preferences and ${this.history.length} notifications from disk.`);
                    return;
                }
            }
        } catch (err: any) {
            logger.warn(`[NotificationManager] Could not load notifications from disk: ${err?.message}`);
        }
    }

    public saveToDisk(): void {
        try {
            const dir = path.dirname(this.storageFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const payload = {
                preferences: this.preferences,
                history: this.history,
            };
            fs.writeFileSync(this.storageFilePath, JSON.stringify(payload, null, 2), "utf8");
        } catch (err: any) {
            logger.warn(`[NotificationManager] Failed writing notifications to disk: ${err?.message}`);
        }
    }

    /**
     * Checks if current time falls within user-configured quiet hours.
     */
    public isQuietHoursActive(now: Date = new Date()): boolean {
        if (!this.preferences.quietHours.enabled) return false;

        const currentHour = now.getHours();
        const start = this.preferences.quietHours.startHour;
        const end = this.preferences.quietHours.endHour;

        if (start < end) {
            // E.g. 1 PM to 5 PM (13 to 17)
            return currentHour >= start && currentHour < end;
        } else {
            // E.g. 10 PM to 7 AM (22 to 7)
            return currentHour >= start || currentHour < end;
        }
    }

    /**
     * Sanitizes and grounds notification text to prevent ungrounded psychological judgments.
     */
    public sanitizeGroundedText(text: string): string {
        let clean = text;
        for (const pattern of UNGROUNDED_PHRASES) {
            clean = clean.replace(pattern, "Pending item requires attention");
        }
        return notificationService.sanitizeText(clean, 500);
    }

    /**
     * Sends a notification through priority, category, quiet-hours, dedup, and cooldown policies.
     */
    public send(request: NotificationRequest, now: Date = new Date()): { success: boolean; reason?: string; id?: string; nativeDispatched?: boolean } {
        if (!request || typeof request !== "object") {
            return { success: false, reason: "Invalid notification request." };
        }

        // 0. Permission check: notification
        try {
            const { settingsService } = require("./settings.service");
            if (!settingsService.isPermitted("notification")) {
                logger.debug("[NotificationManager] Notification suppressed: Notification permission disabled in Settings.");
                return { success: false, reason: "Notification permission disabled in Settings." };
            }
        } catch {
            // Standalone or testing context
        }

        // 1. Global master enable check
        if (!this.preferences.enabled) {
            logger.debug("[NotificationManager] Notification suppressed: Master notifications switch disabled.");
            return { success: false, reason: "Notifications disabled globally." };
        }

        const category: NotificationCategory = request.category || "system";

        // 2. Category preference check
        if (this.preferences.categories[category] === false) {
            logger.debug(`[NotificationManager] Notification suppressed: Category '${category}' disabled.`);
            return { success: false, reason: `Category '${category}' disabled.` };
        }

        const priority: NotificationPriority = request.priority || "normal";

        // 3. Quiet hours policy
        if (this.isQuietHoursActive(now)) {
            if (priority !== "high") {
                logger.info(`[NotificationManager] Notification suppressed during quiet hours (priority: ${priority}).`);
                return { success: false, reason: "Suppressed by quiet hours." };
            }
            if (!this.preferences.quietHours.allowHighPriorityOnly) {
                logger.info("[NotificationManager] High priority notification suppressed during strict quiet hours.");
                return { success: false, reason: "Suppressed by strict quiet hours." };
            }
        }

        // 4. Ground and sanitize text
        const safeTitle = this.sanitizeGroundedText(request.title);
        const safeBody = this.sanitizeGroundedText(request.body);

        if (!safeTitle) {
            return { success: false, reason: "Title is empty after sanitization." };
        }

        // 5. Deduplication and Cooldown
        const dedupKey = request.dedupKey || `${category}:${safeTitle.toLowerCase()}`;
        const cooldownMs = request.cooldownMs ?? this.preferences.cooldownMs;
        const lastSent = this.cooldownMap.get(dedupKey) || 0;
        const nowMs = now.getTime();

        if (nowMs - lastSent < cooldownMs) {
            logger.info(`[NotificationManager] Notification suppressed by cooldown (${cooldownMs}ms) for key '${dedupKey}'.`);
            return { success: false, reason: "Cooldown active." };
        }

        // Update cooldown timestamp
        this.cooldownMap.set(dedupKey, nowMs);

        // 6. Dispatch via native NotificationService
        let nativeCategory: "info" | "focus" | "briefing" | "suggestion" | "system" = "info";
        if (category === "focus") nativeCategory = "focus";
        else if (category === "routines") nativeCategory = "briefing";
        else if (category === "proactive") nativeCategory = "suggestion";
        else if (category === "system") nativeCategory = "system";

        const nativeSuccess = notificationService.send({
            title: safeTitle,
            body: safeBody,
            category: nativeCategory,
            silent: Boolean(request.silent),
        });

        const id = `notif_${nowMs}_${Math.random().toString(36).substring(2, 7)}`;
        const record: NotificationRecord = {
            id,
            title: safeTitle,
            body: safeBody,
            category,
            priority,
            timestamp: nowMs,
            dismissed: false,
            actionCommand: request.actionCommand,
        };

        // 7. Store in bounded history
        this.history.push(record);
        if (this.history.length > MAX_HISTORY_ITEMS) {
            this.history.shift();
        }
        this.saveToDisk();

        return { success: true, id, nativeDispatched: nativeSuccess };
    }

    /**
     * Dismisses a notification in history.
     */
    public dismiss(id: string): boolean {
        const item = this.history.find((n) => n.id === id);
        if (item) {
            item.dismissed = true;
            this.saveToDisk();
            return true;
        }
        return false;
    }

    /**
     * Clears all notification history.
     */
    public clearHistory(): void {
        this.history = [];
        this.saveToDisk();
    }

    /**
     * Gets read-only copy of recent notification history.
     */
    public getHistory(options: { activeOnly?: boolean; limit?: number } = {}): NotificationRecord[] {
        let items = this.history;
        if (options.activeOnly) {
            items = items.filter((n) => !n.dismissed);
        }
        const limit = options.limit || MAX_HISTORY_ITEMS;
        return items.slice(-limit).map((n) => ({ ...n }));
    }

    /**
     * Returns current preferences.
     */
    public getPreferences(): NotificationPreferences {
        return JSON.parse(JSON.stringify(this.preferences));
    }

    /**
     * Updates preferences.
     */
    public updatePreferences(updates: Partial<NotificationPreferences>): NotificationPreferences {
        if (typeof updates.enabled === "boolean") {
            this.preferences.enabled = updates.enabled;
        }
        if (typeof updates.cooldownMs === "number" && updates.cooldownMs >= 0) {
            this.preferences.cooldownMs = updates.cooldownMs;
        }
        if (updates.quietHours) {
            this.preferences.quietHours = {
                ...this.preferences.quietHours,
                ...updates.quietHours,
            };
        }
        if (updates.categories) {
            this.preferences.categories = {
                ...this.preferences.categories,
                ...updates.categories,
            };
        }
        this.saveToDisk();
        return this.getPreferences();
    }

    /**
     * Resets preferences and cooldowns (for test isolation).
     */
    public reset(): void {
        this.preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
        this.history = [];
        this.cooldownMap.clear();
    }
}

export const notificationManager = NotificationManager.getInstance();
