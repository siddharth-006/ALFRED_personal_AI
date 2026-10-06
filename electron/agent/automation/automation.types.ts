/**
 * ALFRED Conditional Automation — Types & Contracts
 */

import { AppEventType } from "../../events/event.types";
import { NotificationCategory } from "../../services/notification-manager.types";

export type AutomationActionType =
    | "notification"
    | "recommendation"
    | "briefing"
    | "review"
    | "weekly_review"
    | "propose_routine";

export interface AutomationCondition {
    field?: string; // e.g. "category" or "workspace" or "sessionName"
    operator?: "equals" | "contains" | "not_equals" | "gte" | "lte" | "gt" | "lt";
    value?: string | number | boolean;
    timeConstraint?: {
        afterHour?: number;   // 0-23
        beforeHour?: number;  // 0-23
        daysOfWeek?: number[]; // 0-6
    };
}

export interface AutomationAction {
    type: AutomationActionType;
    params?: {
        title?: string;
        message?: string;
        body?: string;
        category?: NotificationCategory;
        routineId?: string;
        notificationTitle?: string;
        notificationBody?: string;
    };
}

export interface AutomationRule {
    id: string;
    name: string;
    enabled: boolean;
    eventType: AppEventType;
    conditions?: AutomationCondition;
    action: AutomationAction;
    cooldownSeconds: number;
    lastTriggeredAt?: number;
    triggerCount: number;
    createdAt: string;
}

export interface CreateAutomationInput {
    name: string;
    eventType: AppEventType;
    conditions?: AutomationCondition;
    action: AutomationAction;
    cooldownSeconds?: number;
}

export interface AutomationTriggerResult {
    ruleId: string;
    ruleName: string;
    matched: boolean;
    actionExecuted: boolean;
    reason?: string;
    confirmationRequired?: boolean;
    confirmationId?: string;
}
