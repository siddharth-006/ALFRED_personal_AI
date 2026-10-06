/**
 * ALFRED Notification Manager Types
 *
 * Strongly typed notification configuration, priorities, categories, and preferences.
 */

export type NotificationPriority = "low" | "normal" | "high";

export type NotificationCategory =
    | "focus"
    | "tasks"
    | "goals"
    | "projects"
    | "routines"
    | "proactive"
    | "system";

export interface NotificationRequest {
    title: string;
    body: string;
    category: NotificationCategory;
    priority?: NotificationPriority;
    dedupKey?: string;
    cooldownMs?: number;
    silent?: boolean;
    actionCommand?: string;
}

export interface NotificationRecord {
    id: string;
    title: string;
    body: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    timestamp: number;
    dismissed: boolean;
    actionCommand?: string;
}

export interface QuietHoursConfig {
    enabled: boolean;
    startHour: number; // 0-23 (e.g. 22 for 10 PM)
    endHour: number;   // 0-23 (e.g. 7 for 7 AM)
    allowHighPriorityOnly: boolean;
}

export interface NotificationPreferences {
    enabled: boolean;
    quietHours: QuietHoursConfig;
    categories: Record<NotificationCategory, boolean>;
    cooldownMs: number;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    enabled: true,
    quietHours: {
        enabled: false,
        startHour: 22,
        endHour: 7,
        allowHighPriorityOnly: true,
    },
    categories: {
        focus: true,
        tasks: true,
        goals: true,
        projects: true,
        routines: true,
        proactive: true,
        system: true,
    },
    cooldownMs: 30000, // 30 seconds
};
