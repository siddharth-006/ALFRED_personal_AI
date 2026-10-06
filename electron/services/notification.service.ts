import { Notification } from "electron";
import { logger } from "../utils/logger";

export type NotificationCategory = "info" | "focus" | "briefing" | "suggestion" | "system";

export interface NativeNotificationOptions {
    title: string;
    body: string;
    category?: NotificationCategory;
    silent?: boolean;
}

export interface INativeNotificationService {
    send(options: NativeNotificationOptions): boolean;
    isSupported(): boolean;
}

export class NotificationService implements INativeNotificationService {
    private static instance: NotificationService | null = null;
    private maxTitleLength = 100;
    private maxBodyLength = 500;

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    public isSupported(): boolean {
        try {
            return Boolean(Notification && typeof Notification.isSupported === "function" && Notification.isSupported());
        } catch {
            return false;
        }
    }

    public sanitizeText(text: string, maxLength: number): string {
        if (!text || typeof text !== "string") {
            return "";
        }

        // 1. Strip HTML tags
        let clean = text.replace(/<[^>]*>/g, "");

        // 2. Strip non-printable / control characters except standard space and newline
        clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

        // 3. Trim outer whitespace
        clean = clean.trim();

        // 4. Bound length
        if (clean.length > maxLength) {
            clean = clean.slice(0, maxLength);
        }

        return clean;
    }

    public send(options: NativeNotificationOptions): boolean {
        if (!options || typeof options !== "object") {
            logger.warn("[NotificationService] Invalid notification options provided.");
            return false;
        }

        const sanitizedTitle = this.sanitizeText(options.title, this.maxTitleLength);
        const sanitizedBody = this.sanitizeText(options.body, this.maxBodyLength);

        if (!sanitizedTitle) {
            logger.warn("[NotificationService] Notification rejected: Title is empty after sanitization.");
            return false;
        }

        logger.info(`[NotificationService] Dispatching notification: "${sanitizedTitle}" (Category: ${options.category || "info"})`);

        if (!this.isSupported()) {
            logger.debug("[NotificationService] Native notifications not supported in this runtime environment.");
            return false;
        }

        try {
            const notif = new Notification({
                title: sanitizedTitle,
                body: sanitizedBody,
                silent: Boolean(options.silent),
            });
            notif.show();
            return true;
        } catch (err: any) {
            logger.error(`[NotificationService] Failed to display notification: ${err?.message}`);
            return false;
        }
    }
}

export const notificationService = NotificationService.getInstance();
