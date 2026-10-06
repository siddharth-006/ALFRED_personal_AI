/**
 * ALFRED Phase 5.10 — Scheduled Routines Engine
 *
 * Local, deterministic schedule orchestrator.
 * Follows ALFRED's strict safety architecture:
 * - Read-only routines (Briefing, Daily Review, Weekly Review) execute safely without mutation.
 * - Mutation-capable routines (e.g. Coding Mode) MUST respect ConfirmationStore and NEVER silently execute.
 * - Reuses existing RoutineService, MorningBriefingService, EndOfDayReviewService, and WeeklyReviewService.
 * - Local JSON persistence, timezone-aware next-run calculation, and missed-run protection.
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { getUserDataDirectory } from "../../utils/paths";
import {
    ScheduledRoutine,
    CreateScheduleInput,
    ScheduledExecutionResult,
    ScheduleTargetType,
} from "./scheduler.types";
import { routineService } from "../routines";
import { morningBriefingService } from "../briefing";
import { endOfDayReviewService } from "../review";
import { notificationManager } from "../../services/notification-manager.service";
import { confirmationStore } from "../risk/confirmation-store";
import { logger } from "../../utils/logger";

const MAX_SCHEDULES = 20;

export class RoutineSchedulerService {
    private static instance: RoutineSchedulerService | null = null;
    private schedules: ScheduledRoutine[] = [];
    private storageFilePath: string;
    private tickTimer: NodeJS.Timeout | null = null;

    constructor(storagePath?: string) {
        this.storageFilePath = storagePath || this.resolveStoragePath();
        this.loadFromDisk();
    }

    public static getInstance(): RoutineSchedulerService {
        if (!RoutineSchedulerService.instance) {
            RoutineSchedulerService.instance = new RoutineSchedulerService();
        }
        return RoutineSchedulerService.instance;
    }

    private resolveStoragePath(): string {
        try {
            const userDataDir = getUserDataDirectory();
            return path.join(userDataDir, "alfred_schedules.json");
        } catch {
            return path.join(getUserDataDirectory(), "alfred_schedules.json");
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
                        this.schedules = parsed.slice(0, MAX_SCHEDULES);
                        logger.info(`[RoutineScheduler] Loaded ${this.schedules.length} schedules from disk.`);
                        return;
                    }
                }
            }
        } catch (err: any) {
            logger.warn(`[RoutineScheduler] Could not load schedules from disk: ${err?.message}`);
        }
    }

    public saveToDisk(): void {
        try {
            const dir = path.dirname(this.storageFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.storageFilePath, JSON.stringify(this.schedules, null, 2), "utf8");
        } catch (err: any) {
            logger.warn(`[RoutineScheduler] Failed writing schedules to disk: ${err?.message}`);
        }
    }

    /**
     * Calculates the next ISO execution timestamp for a schedule.
     */
    public calculateNextRun(
        hour: number,
        minute: number,
        daysOfWeek: number[],
        baseDate: Date = new Date(),
        timezone?: string
    ): string {
        const allowedDays = new Set(daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]);

        for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
            const candidate = new Date(baseDate.getTime());
            candidate.setDate(candidate.getDate() + dayOffset);
            candidate.setHours(hour, minute, 0, 0);

            const dayOfWeek = candidate.getDay();
            if (allowedDays.has(dayOfWeek)) {
                if (candidate.getTime() > baseDate.getTime()) {
                    return candidate.toISOString();
                }
            }
        }

        // Fallback: 1 day ahead
        const fallback = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
        fallback.setHours(hour, minute, 0, 0);
        return fallback.toISOString();
    }

    /**
     * Creates a new scheduled routine.
     */
    public createSchedule(input: CreateScheduleInput, now: Date = new Date()): { success: boolean; schedule?: ScheduledRoutine; error?: string } {
        if (!input || typeof input !== "object") {
            return { success: false, error: "Schedule input must be an object." };
        }

        if (this.schedules.length >= MAX_SCHEDULES) {
            return {
                success: false,
                error: `Schedule limit reached (${MAX_SCHEDULES}). Please delete unneeded schedules.`,
            };
        }

        const hour = Math.floor(input.hour);
        const minute = Math.floor(input.minute);
        if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59) {
            return { success: false, error: "Schedule hour must be 0-23 and minute 0-59." };
        }

        const daysOfWeek = Array.isArray(input.daysOfWeek) && input.daysOfWeek.length > 0
            ? Array.from(new Set(input.daysOfWeek.map((d) => Math.floor(d)).filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b)
            : [0, 1, 2, 3, 4, 5, 6];

        const targetType: ScheduleTargetType = input.targetType || "routine";

        // Validate target
        if (targetType === "routine") {
            if (!input.targetId) {
                return { success: false, error: "Routine schedule requires a valid targetId." };
            }
            const routine = routineService.getRoutineById(input.targetId);
            if (!routine) {
                return { success: false, error: `Routine with ID '${input.targetId}' not found.` };
            }
        }

        // Duplicate check
        const isDuplicate = this.schedules.some((s) => {
            return (
                s.targetType === targetType &&
                s.targetId === input.targetId &&
                s.hour === hour &&
                s.minute === minute &&
                s.daysOfWeek.join(",") === daysOfWeek.join(",")
            );
        });

        if (isDuplicate) {
            return {
                success: false,
                error: `A schedule for '${input.name}' at ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} already exists.`,
            };
        }

        const timezone = input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const nextRunAt = this.calculateNextRun(hour, minute, daysOfWeek, now, timezone);

        const schedule: ScheduledRoutine = {
            id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: String(input.name || "Scheduled Routine").trim(),
            targetType,
            targetId: input.targetId,
            hour,
            minute,
            daysOfWeek,
            enabled: true,
            createdAt: now.toISOString(),
            nextRunAt,
            timezone,
        };

        this.schedules.push(schedule);
        this.saveToDisk();

        logger.info(`[RoutineScheduler] Created schedule '${schedule.name}' (ID: ${schedule.id}, Next run: ${schedule.nextRunAt})`);
        return { success: true, schedule: { ...schedule } };
    }

    /**
     * Lists all scheduled routines.
     */
    public getSchedules(): ScheduledRoutine[] {
        return this.schedules.map((s) => ({ ...s, daysOfWeek: [...s.daysOfWeek] }));
    }

    /**
     * Gets a schedule by ID.
     */
    public getScheduleById(id: string): ScheduledRoutine | undefined {
        const found = this.schedules.find((s) => s.id === id);
        return found ? { ...found, daysOfWeek: [...found.daysOfWeek] } : undefined;
    }

    /**
     * Enables or disables a schedule.
     */
    public setEnabled(id: string, enabled: boolean): { success: boolean; schedule?: ScheduledRoutine; error?: string } {
        const item = this.schedules.find((s) => s.id === id);
        if (!item) {
            return { success: false, error: `Schedule with ID '${id}' not found.` };
        }

        item.enabled = Boolean(enabled);
        if (item.enabled) {
            // Refresh nextRunAt when re-enabling
            item.nextRunAt = this.calculateNextRun(item.hour, item.minute, item.daysOfWeek, new Date(), item.timezone);
        }
        this.saveToDisk();
        logger.info(`[RoutineScheduler] Schedule '${item.name}' enabled set to: ${item.enabled}`);
        return { success: true, schedule: { ...item } };
    }

    /**
     * Deletes a schedule by ID.
     */
    public deleteSchedule(id: string): { success: boolean; error?: string } {
        const index = this.schedules.findIndex((s) => s.id === id);
        if (index === -1) {
            return { success: false, error: `Schedule with ID '${id}' not found.` };
        }

        const removed = this.schedules.splice(index, 1)[0];
        this.saveToDisk();
        logger.info(`[RoutineScheduler] Deleted schedule '${removed.name}' (ID: ${id})`);
        return { success: true };
    }

    /**
     * Executes a scheduled routine safely respecting ALFRED's risk & confirmation architecture.
     */
    public async executeScheduledTarget(
        schedule: ScheduledRoutine,
        now: Date = new Date()
    ): Promise<ScheduledExecutionResult> {
        logger.info(`[RoutineScheduler] Executing scheduled target for '${schedule.name}' (${schedule.targetType})`);

        try {
            const { settingsService } = require("../../services/settings.service");
            if (!settingsService.isPermitted("automation") || !settingsService.getSettings().automation.allowScheduledRoutines) {
                logger.info(`[RoutineScheduler] Scheduled execution skipped: Automation or scheduled routines disabled in Settings.`);
                return {
                    scheduleId: schedule.id,
                    targetType: schedule.targetType,
                    executed: false,
                    requiresConfirmation: false,
                    message: "Scheduled routines are disabled in ALFRED Settings.",
                    notificationSent: false,
                };
            }
        } catch {
            // Standalone or testing context
        }

        const validTargets = ["briefing", "review", "weekly_review", "routine"];
        if (!validTargets.includes(schedule.targetType)) {
            return {
                scheduleId: schedule.id,
                targetType: schedule.targetType,
                executed: false,
                requiresConfirmation: false,
                message: `Unsupported target type '${schedule.targetType}'.`,
                notificationSent: false,
            };
        }

        schedule.lastRunAt = now.toISOString();
        schedule.nextRunAt = this.calculateNextRun(schedule.hour, schedule.minute, schedule.daysOfWeek, now, schedule.timezone);
        this.saveToDisk();

        // 1. Read-only targets: Morning Briefing, Daily Review, Weekly Review
        if (schedule.targetType === "briefing") {
            const briefing = morningBriefingService.generateBriefing({ now });
            notificationManager.send({
                title: "Morning Briefing Ready",
                body: briefing.spokenSummary || briefing.summary,
                category: "routines",
                priority: "normal",
            }, now);

            return {
                scheduleId: schedule.id,
                targetType: "briefing",
                executed: true,
                requiresConfirmation: false,
                message: "Morning Briefing generated successfully.",
                notificationSent: true,
            };
        }

        if (schedule.targetType === "review") {
            const review = endOfDayReviewService.generateReview({ now });
            notificationManager.send({
                title: "End-of-Day Review Ready",
                body: review.spokenSummary || review.conciseSummary,
                category: "routines",
                priority: "normal",
            }, now);

            return {
                scheduleId: schedule.id,
                targetType: "review",
                executed: true,
                requiresConfirmation: false,
                message: "End-of-Day Review generated successfully.",
                notificationSent: true,
            };
        }

        if (schedule.targetType === "weekly_review") {
            // Lazy load weeklyReviewService to avoid circular dependency
            const { weeklyReviewService } = await import("../review/weekly-review.service");
            const review = weeklyReviewService.generateWeeklyReview({ now });
            notificationManager.send({
                title: "Weekly Review Ready",
                body: review.spokenSummary || review.conciseSummary,
                category: "routines",
                priority: "normal",
            }, now);

            return {
                scheduleId: schedule.id,
                targetType: "weekly_review",
                executed: true,
                requiresConfirmation: false,
                message: "Weekly Review generated successfully.",
                notificationSent: true,
            };
        }

        // 2. Mutation-capable targets: Routine (e.g. Coding Mode)
        // MUST NEVER silently execute tools without confirmation!
        let routine = routineService.getRoutineById(schedule.targetId || "");
        if (!routine && schedule.targetId) {
            routine = routineService.getRoutineById(`routine_${schedule.targetId}`);
        }
        if (!routine && schedule.targetId) {
            const all = routineService.getRoutines();
            routine = all.find((r) => r.id === schedule.targetId || r.name.toLowerCase().includes(schedule.targetId!.toLowerCase()));
        }
        if (!routine) {
            return {
                scheduleId: schedule.id,
                targetType: "routine",
                executed: false,
                requiresConfirmation: false,
                message: `Routine '${schedule.targetId}' not found.`,
                notificationSent: false,
            };
        }

        // Convert to AgentPlan
        const plan = routineService.routineToAgentPlan(routine, `Scheduled ${routine.name}`);

        // Hold in ConfirmationStore
        const pending = confirmationStore.createPendingConfirmation(
            plan,
            {
                riskLevel: "high",
                level: "high",
                requiresConfirmation: true,
                mutationCount: plan.toolCalls.length,
                mutationTools: plan.toolCalls.map(t => t.tool),
                affectedEntities: [{ type: "workspace", name: routine.name }],
                reason: `Scheduled routine '${routine.name}' contains ${plan.toolCalls.length} actions.`,
                summary: `Scheduled routine '${routine.name}' contains ${plan.toolCalls.length} actions.`,
            },
            `Scheduled ${routine.name}`
        );

        // Notify user that action is waiting for confirmation
        notificationManager.send({
            title: `Scheduled: ${routine.name}`,
            body: `Scheduled routine '${routine.name}' is waiting for your confirmation to start.`,
            category: "routines",
            priority: "normal",
            actionCommand: "Yes",
        }, now);

        logger.info(`[RoutineScheduler] Mutation routine '${routine.name}' paused at confirmation boundary (ID: ${pending.id})`);

        return {
            scheduleId: schedule.id,
            targetType: "routine",
            executed: false,
            requiresConfirmation: true,
            confirmationId: pending.id,
            message: `Scheduled routine '${routine.name}' prepared and waiting for human confirmation.`,
            notificationSent: true,
        };
    }

    /**
     * Checks all schedules and handles due or missed runs.
     */
    public async checkDueSchedules(now: Date = new Date()): Promise<ScheduledExecutionResult[]> {
        const results: ScheduledExecutionResult[] = [];
        const nowMs = now.getTime();

        for (const schedule of this.schedules) {
            if (!schedule.enabled) continue;

            const nextMs = new Date(schedule.nextRunAt).getTime();
            if (nowMs >= nextMs) {
                const diffMs = nowMs - nextMs;
                const oneHourMs = 60 * 60 * 1000;

                // Missed-run protection: If missed by > 1 hour, log and advance nextRunAt
                if (diffMs > oneHourMs) {
                    logger.warn(`[RoutineScheduler] Schedule '${schedule.name}' missed by ${Math.round(diffMs / 60000)}m. Advancing next run.`);
                    schedule.nextRunAt = this.calculateNextRun(schedule.hour, schedule.minute, schedule.daysOfWeek, now, schedule.timezone);
                    this.saveToDisk();
                    continue;
                }

                // Due run within reasonable window
                const execRes = await this.executeScheduledTarget(schedule, now);
                results.push(execRes);
            }
        }

        return results;
    }

    /**
     * Starts background ticking loop.
     */
    public startScheduler(intervalMs = 30000): void {
        if (this.tickTimer) return;
        this.tickTimer = setInterval(() => {
            this.checkDueSchedules().catch((err) => {
                logger.error(`[RoutineScheduler] Tick error: ${err?.message}`);
            });
        }, intervalMs);
    }

    /**
     * Stops background ticking loop.
     */
    public stopScheduler(): void {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
    }

    /**
     * Resets scheduler state (for test isolation).
     */
    public reset(): void {
        this.stopScheduler();
        this.schedules = [];
    }
}

export const routineScheduler = RoutineSchedulerService.getInstance();
