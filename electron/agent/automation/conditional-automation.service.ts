/**
 * ALFRED Conditional Automation Service
 *
 * Listens to application events on EventBus and triggers safe, bounded actions.
 *
 * ARCHITECTURAL GUARANTEES:
 * 1. Loop & Recursion Prevention: Enforces max depth (0) and causal chain tracking.
 * 2. Safe Actions Only: Native notifications, read-only intelligence, or gated confirmation proposals.
 * 3. Never bypasses ToolRegistry or ConfirmationStore.
 * 4. Local JSON persistence without external database.
 * 5. Bounded capacity: Max 20 active automation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { getUserDataDirectory } from "../../utils/paths";
import {
    AutomationRule,
    CreateAutomationInput,
    AutomationTriggerResult,
    AutomationCondition,
} from "./automation.types";
import { AppEvent } from "../../events/event.types";
import { eventBus } from "../../events/event-bus";
import { notificationManager } from "../../services/notification-manager.service";
import { recommendationAgentService } from "../recommendation/recommendation-agent.service";
import { morningBriefingService } from "../briefing";
import { endOfDayReviewService } from "../review";
import { routineService } from "../routines";
import { confirmationStore } from "../risk/confirmation-store";
import { agentContextService } from "../agent-context/agent-context.service";
import { logger } from "../../utils/logger";

const MAX_AUTOMATIONS = 20;

export class ConditionalAutomationService {
    private static instance: ConditionalAutomationService | null = null;
    private rules: AutomationRule[] = [];
    private storageFilePath: string;
    private unsubscribeBus: (() => void) | null = null;
    private executingRules: Set<string> = new Set();

    constructor(storagePath?: string) {
        this.storageFilePath = storagePath || this.resolveStoragePath();
        this.loadFromDisk();
        this.listenToEventBus();
    }

    public static getInstance(): ConditionalAutomationService {
        if (!ConditionalAutomationService.instance) {
            ConditionalAutomationService.instance = new ConditionalAutomationService();
        }
        return ConditionalAutomationService.instance;
    }

    private resolveStoragePath(): string {
        try {
            const userDataDir = getUserDataDirectory();
            return path.join(userDataDir, "alfred_automations.json");
        } catch {
            return path.join(getUserDataDirectory(), "alfred_automations.json");
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
                    if (Array.isArray(parsed)) {
                        this.rules = parsed.slice(0, MAX_AUTOMATIONS);
                        logger.info(`[ConditionalAutomation] Loaded ${this.rules.length} automation rules from disk.`);
                        return;
                    }
                }
            }
        } catch (err: any) {
            logger.warn(`[ConditionalAutomation] Could not load automations from disk: ${err?.message}`);
        }
    }

    public saveToDisk(): void {
        try {
            const dir = path.dirname(this.storageFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.storageFilePath, JSON.stringify(this.rules, null, 2), "utf8");
        } catch (err: any) {
            logger.warn(`[ConditionalAutomation] Failed writing automations to disk: ${err?.message}`);
        }
    }

    private listenToEventBus(): void {
        if (this.unsubscribeBus) {
            this.unsubscribeBus();
        }
        this.unsubscribeBus = eventBus.subscribe("*", (event) => {
            this.evaluateEvent(event).catch((err) => {
                logger.error(`[ConditionalAutomation] Event evaluation error: ${err?.message}`);
            });
        });
    }

    /**
     * Creates a new conditional automation rule.
     */
    public createRule(input: CreateAutomationInput): { success: boolean; rule?: AutomationRule; error?: string } {
        if (!input || typeof input !== "object") {
            return { success: false, error: "Rule input must be an object." };
        }

        if (this.rules.length >= MAX_AUTOMATIONS) {
            return {
                success: false,
                error: `Automation limit reached (${MAX_AUTOMATIONS}). Please delete unneeded rules.`,
            };
        }

        if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
            return { success: false, error: "Rule name is required." };
        }

        if (!input.eventType || typeof input.eventType !== "string") {
            return { success: false, error: "Rule eventType is required." };
        }

        if (!input.action || typeof input.action !== "object" || !input.action.type) {
            return { success: false, error: "Rule action is required." };
        }

        const validActionTypes = ["notification", "recommendation", "briefing", "review", "weekly_review", "propose_routine"];
        if (!validActionTypes.includes(input.action.type)) {
            return { success: false, error: `Invalid action type '${input.action.type}'.` };
        }

        const cooldownSeconds = typeof input.cooldownSeconds === "number" && input.cooldownSeconds >= 0
            ? Math.floor(input.cooldownSeconds)
            : 60;

        const rule: AutomationRule = {
            id: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: input.name.trim(),
            enabled: true,
            eventType: input.eventType,
            conditions: input.conditions,
            action: {
                type: input.action.type,
                params: input.action.params ? { ...input.action.params } : undefined,
            },
            cooldownSeconds,
            triggerCount: 0,
            createdAt: new Date().toISOString(),
        };

        this.rules.push(rule);
        this.saveToDisk();

        logger.info(`[ConditionalAutomation] Created rule '${rule.name}' for event '${rule.eventType}' (ID: ${rule.id})`);
        return { success: true, rule: { ...rule } };
    }

    /**
     * Returns all configured rules.
     */
    public getRules(): AutomationRule[] {
        return this.rules.map((r) => ({
            ...r,
            conditions: r.conditions ? { ...r.conditions } : undefined,
            action: { ...r.action, params: r.action.params ? { ...r.action.params } : undefined },
        }));
    }

    /**
     * Gets a rule by ID.
     */
    public getRuleById(id: string): AutomationRule | undefined {
        const found = this.rules.find((r) => r.id === id);
        return found ? { ...found } : undefined;
    }

    /**
     * Sets enabled status for a rule.
     */
    public setEnabled(id: string, enabled: boolean): { success: boolean; rule?: AutomationRule; error?: string } {
        const rule = this.rules.find((r) => r.id === id);
        if (!rule) {
            return { success: false, error: `Rule with ID '${id}' not found.` };
        }
        rule.enabled = Boolean(enabled);
        this.saveToDisk();
        logger.info(`[ConditionalAutomation] Rule '${rule.name}' enabled set to: ${rule.enabled}`);
        return { success: true, rule: { ...rule } };
    }

    /**
     * Deletes a rule by ID.
     */
    public deleteRule(id: string): { success: boolean; error?: string } {
        const index = this.rules.findIndex((r) => r.id === id);
        if (index === -1) {
            return { success: false, error: `Rule with ID '${id}' not found.` };
        }
        const removed = this.rules.splice(index, 1)[0];
        this.saveToDisk();
        logger.info(`[ConditionalAutomation] Deleted rule '${removed.name}' (ID: ${id})`);
        return { success: true };
    }

    /**
     * Matches condition filter against event payload and time constraints.
     */
    public matchesCondition(condition: AutomationCondition | undefined, payload: any, now: Date): boolean {
        if (!condition) return true;

        // 1. Time constraints
        if (condition.timeConstraint) {
            const { afterHour, beforeHour, daysOfWeek } = condition.timeConstraint;
            const hour = now.getHours();
            const day = now.getDay();

            if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
                if (!daysOfWeek.includes(day)) return false;
            }

            if (typeof afterHour === "number" && hour < afterHour) {
                return false;
            }

            if (typeof beforeHour === "number" && hour >= beforeHour) {
                return false;
            }
        }

        // 2. Field filter
        if (condition.field) {
            const fieldVal = payload ? payload[condition.field] : undefined;
            if (fieldVal === undefined) return false;

            const targetVal = condition.value;
            const operator = condition.operator || "equals";

            if (operator === "equals") {
                return String(fieldVal).toLowerCase() === String(targetVal).toLowerCase();
            } else if (operator === "not_equals") {
                return String(fieldVal).toLowerCase() !== String(targetVal).toLowerCase();
            } else if (operator === "contains") {
                return String(fieldVal).toLowerCase().includes(String(targetVal).toLowerCase());
            } else if (operator === "gte") {
                return Number(fieldVal) >= Number(targetVal);
            } else if (operator === "lte") {
                return Number(fieldVal) <= Number(targetVal);
            } else if (operator === "gt") {
                return Number(fieldVal) > Number(targetVal);
            } else if (operator === "lt") {
                return Number(fieldVal) < Number(targetVal);
            }
        }

        return true;
    }

    /**
     * Evaluates an application event against all active rules.
     */
    public async evaluateEvent(event: AppEvent, now: Date = new Date()): Promise<AutomationTriggerResult[]> {
        const results: AutomationTriggerResult[] = [];
        const nowMs = now.getTime();

        try {
            const { settingsService } = require("../../services/settings.service");
            if (!settingsService.isPermitted("automation") || !settingsService.getSettings().automation.allowConditionalAutomations) {
                logger.debug(`[ConditionalAutomation] Skipping event '${event.type}': Automation or conditional automations disabled in Settings.`);
                return results;
            }
        } catch {
            // Standalone or testing context
        }

        // Recursion limit: events originating with depth > 0 cannot trigger automations
        if (typeof event.depth === "number" && event.depth > 0) {
            logger.debug(`[ConditionalAutomation] Skipping event '${event.type}' due to depth ${event.depth}`);
            return results;
        }

        for (const rule of this.rules) {
            if (!rule.enabled) continue;
            if (rule.eventType !== event.type) continue;

            // Loop prevention: check causal ID matches rule ID
            if (event.causalId === rule.id) {
                logger.warn(`[ConditionalAutomation] Loop detected! Event causalId '${event.causalId}' matches rule '${rule.id}'. Suppressing.`);
                continue;
            }

            // Active execution guard: rule cannot re-trigger while currently executing
            if (this.executingRules.has(rule.id)) {
                logger.warn(`[ConditionalAutomation] Rule '${rule.name}' is already executing. Suppressing re-entrant trigger.`);
                continue;
            }

            // Cooldown check
            const cooldownMs = rule.cooldownSeconds * 1000;
            if (rule.lastTriggeredAt && nowMs - rule.lastTriggeredAt < cooldownMs) {
                logger.info(`[ConditionalAutomation] Rule '${rule.name}' suppressed by cooldown (${rule.cooldownSeconds}s).`);
                continue;
            }

            // Condition matching
            const matched = this.matchesCondition(rule.conditions, event.payload, now);
            if (!matched) continue;

            // Mark executing
            this.executingRules.add(rule.id);
            try {
                const triggerResult = await this.executeRuleAction(rule, event, now);
                rule.lastTriggeredAt = nowMs;
                rule.triggerCount++;
                this.saveToDisk();
                results.push(triggerResult);
            } finally {
                this.executingRules.delete(rule.id);
            }
        }

        return results;
    }

    private async executeRuleAction(rule: AutomationRule, event: AppEvent, now: Date): Promise<AutomationTriggerResult> {
        logger.info(`[ConditionalAutomation] Firing action '${rule.action.type}' for rule '${rule.name}'`);

        const action = rule.action;

        if (action.type === "notification") {
            const title = action.params?.title || `Automation: ${rule.name}`;
            const body = action.params?.message || `Event '${event.type}' occurred.`;
            const category = action.params?.category || "focus";

            notificationManager.send({
                title,
                body,
                category,
                priority: "normal",
            }, now);

            return {
                ruleId: rule.id,
                ruleName: rule.name,
                matched: true,
                actionExecuted: true,
                reason: "Notification dispatched.",
            };
        }

        if (action.type === "recommendation") {
            const snapshot = agentContextService.getContextSnapshot({ now });
            const recRes = recommendationAgentService.generateRecommendations(snapshot);
            const topRec = recRes.recommendations[0];
            const title = topRec ? `Next Task: ${topRec.title}` : `Recommendation: ${rule.name}`;
            const body = topRec ? topRec.rationale : "No urgent recommendations at this time.";

            notificationManager.send({
                title,
                body,
                category: "proactive",
                priority: "normal",
            }, now);

            return {
                ruleId: rule.id,
                ruleName: rule.name,
                matched: true,
                actionExecuted: true,
                reason: "Tactical recommendation notification dispatched.",
            };
        }

        if (action.type === "briefing") {
            const briefing = morningBriefingService.generateBriefing({ now });
            notificationManager.send({
                title: "Morning Briefing",
                body: briefing.spokenSummary || briefing.summary,
                category: "routines",
                priority: "normal",
            }, now);

            return {
                ruleId: rule.id,
                ruleName: rule.name,
                matched: true,
                actionExecuted: true,
                reason: "Morning briefing notification dispatched.",
            };
        }

        if (action.type === "review") {
            const review = endOfDayReviewService.generateReview({ now });
            notificationManager.send({
                title: "End-of-Day Review",
                body: review.spokenSummary || review.conciseSummary,
                category: "routines",
                priority: "normal",
            }, now);

            return {
                ruleId: rule.id,
                ruleName: rule.name,
                matched: true,
                actionExecuted: true,
                reason: "End-of-day review notification dispatched.",
            };
        }

        if (action.type === "weekly_review") {
            const { weeklyReviewService } = await import("../review/weekly-review.service");
            const review = weeklyReviewService.generateWeeklyReview({ now });
            notificationManager.send({
                title: "Weekly Review",
                body: review.spokenSummary || review.conciseSummary,
                category: "routines",
                priority: "normal",
            }, now);

            return {
                ruleId: rule.id,
                ruleName: rule.name,
                matched: true,
                actionExecuted: true,
                reason: "Weekly review notification dispatched.",
            };
        }

        if (action.type === "propose_routine") {
            // Must NOT silently execute! Creates a proposal requiring confirmation.
            const routineId = action.params?.routineId || "coding-mode";
            const routine = routineService.getRoutineById(routineId);
            if (!routine) {
                return {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    matched: true,
                    actionExecuted: false,
                    reason: `Routine '${routineId}' not found.`,
                };
            }

            const plan = routineService.routineToAgentPlan(routine, `Automation triggered ${routine.name}`);
            const pending = confirmationStore.createPendingConfirmation(
                plan,
                {
                    riskLevel: "high",
                    level: "high",
                    requiresConfirmation: true,
                    mutationCount: plan.toolCalls.length,
                    mutationTools: plan.toolCalls.map(t => t.tool),
                    affectedEntities: [{ type: "workspace", name: routine.name }],
                    reason: `Automation '${rule.name}' proposes starting '${routine.name}'.`,
                    summary: `Automation '${rule.name}' proposes starting '${routine.name}'.`,
                },
                `Automation ${routine.name}`
            );

            notificationManager.send({
                title: `Ready: ${routine.name}`,
                body: `Automation '${rule.name}' is waiting for confirmation to start ${routine.name}.`,
                category: "routines",
                priority: "normal",
                actionCommand: "Yes",
            }, now);

            return {
                ruleId: rule.id,
                ruleName: rule.name,
                matched: true,
                actionExecuted: false,
                confirmationRequired: true,
                confirmationId: pending.id,
                reason: "Routine proposed and paused at confirmation boundary.",
            };
        }

        return {
            ruleId: rule.id,
            ruleName: rule.name,
            matched: true,
            actionExecuted: false,
            reason: `Unsupported action type '${action.type}'.`,
        };
    }

    /**
     * Resets rules and executing state (for test isolation).
     */
    public reset(): void {
        this.rules = [];
        this.executingRules.clear();
        this.saveToDisk();
    }
}

export const conditionalAutomationService = ConditionalAutomationService.getInstance();
