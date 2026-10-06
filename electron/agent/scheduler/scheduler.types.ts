/**
 * ALFRED Scheduled Routines — Types & Contracts
 */

export type ScheduleTargetType = "routine" | "briefing" | "review" | "weekly_review";

export interface ScheduledRoutine {
    id: string;
    name: string;
    targetType: ScheduleTargetType;
    targetId?: string;       // e.g. "coding-mode"
    hour: number;           // 0-23
    minute: number;         // 0-59
    daysOfWeek: number[];   // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    enabled: boolean;
    createdAt: string;
    lastRunAt?: string;
    nextRunAt: string;
    timezone: string;
}

export interface CreateScheduleInput {
    name: string;
    targetType: ScheduleTargetType;
    targetId?: string;
    hour: number;
    minute: number;
    daysOfWeek?: number[]; // defaults to all days (0-6) if empty
    timezone?: string;
}

export interface ScheduledExecutionResult {
    scheduleId: string;
    targetType: ScheduleTargetType;
    executed: boolean;
    requiresConfirmation: boolean;
    confirmationId?: string;
    message: string;
    notificationSent: boolean;
}
