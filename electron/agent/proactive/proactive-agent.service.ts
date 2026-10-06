/**
 * ALFRED Phase 5.5C — Proactive Intelligence Service
 *
 * Evaluates current factual AgentContextSnapshot to detect actionable situations
 * and generate lightweight, explainable, user-controlled suggestions.
 *
 * ARCHITECTURAL SAFETY GUARANTEES:
 * 1. Read-Only: Only observes AgentContextSnapshot. Has ZERO access to child_process,
 *    spawn, exec, shell APIs, filesystem mutations, or productivity mutation methods.
 * 2. Non-Autonomous: Does not execute tools or launch apps autonomously.
 * 3. Anti-Spam: Lightweight in-memory cooldown & deduplication cache prevents repeated surfacing.
 * 4. Grounded: Factual signals only. No artificial scores or fake urgency numbers.
 */

import { AgentContextSnapshot } from "../agent-context/agent-context.types";
import {
    ProactiveSuggestion,
    ProactiveSuggestionType,
    ProactiveEvaluationResult,
    ProactiveCooldownState,
} from "./proactive.types";
import { logger } from "../../utils/logger";

export const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
export const DISMISSED_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

export class ProactiveAgentService {
    private cooldowns: Map<string, ProactiveCooldownState> = new Map();
    private cooldownDurationMs: number = DEFAULT_COOLDOWN_MS;
    private dismissedDurationMs: number = DISMISSED_COOLDOWN_MS;

    constructor(cooldownMs?: number, dismissedMs?: number) {
        if (cooldownMs) this.cooldownDurationMs = cooldownMs;
        if (dismissedMs) this.dismissedDurationMs = dismissedMs;
    }

    /**
     * Checks if a candidate is eligible to surface considering force and cooldowns.
     */
    private isCandidateEligible(
        key: string,
        type: ProactiveSuggestionType,
        force: boolean,
        currentTime: number
    ): boolean {
        if (force) return true;
        if (this.isCoolingDown(key, currentTime)) return false;
        if (this.isCoolingDown(`type:${type}`, currentTime)) return false;
        return true;
    }

    /**
     * Evaluates the current AgentContextSnapshot and returns active proactive suggestions.
     * Bounded to a maximum of 3 suggestions, with 1 prioritized as the active alert.
     */
    public evaluate(
        snapshot: AgentContextSnapshot,
        options: { force?: boolean; now?: Date } = {}
    ): ProactiveEvaluationResult {
        const currentTime = options.now ? options.now.getTime() : Date.now();
        const evaluatedAt = (options.now || new Date()).toISOString();
        const force = options.force || false;
        const candidates: ProactiveSuggestion[] = [];

        // 1. SIGNAL A: OVERDUE WORK
        if (snapshot.tasks?.recentPending) {
            const overdueTasks = snapshot.tasks.recentPending.filter((t) => t.isOverdue);
            if (overdueTasks.length > 0) {
                const topOverdue = overdueTasks[0];
                const key = `overdue:${topOverdue.id}`;
                if (this.isCandidateEligible(key, "overdue_work", force, currentTime)) {
                    candidates.push({
                        id: `sug_overdue_${topOverdue.id}`,
                        type: "overdue_work",
                        title: "Overdue task detected",
                        message: `"${topOverdue.text}" was due on ${topOverdue.dueDate} and remains pending.`,
                        rationale: "The task is past its due date and remains incomplete.",
                        suggestedAction: {
                            label: "Review Overdue Tasks",
                            command: "show tasks",
                            type: "command",
                        },
                        relatedEntityId: topOverdue.id,
                        relatedEntityType: "task",
                        priority: "high",
                        createdAt: evaluatedAt,
                        cooldownKey: key,
                    });
                }
            }
        }

        // 2. SIGNAL B: DUE-TODAY WORK
        if (snapshot.tasks?.todayPending && snapshot.tasks.todayPending.length > 0) {
            const dueTodayTasks = snapshot.tasks.todayPending;
            const key = `due_today:${snapshot.system.currentDate}`;
            if (this.isCandidateEligible(key, "due_today_work", force, currentTime)) {
                candidates.push({
                    id: `sug_today_${snapshot.system.currentDate}`,
                    type: "due_today_work",
                    title: "Work due today",
                    message: `You have ${dueTodayTasks.length} pending task(s) scheduled for today.`,
                    rationale: "One or more pending tasks are scheduled for today.",
                    suggestedAction: {
                        label: "Review Today's Tasks",
                        command: "show tasks",
                        type: "command",
                    },
                    priority: "medium",
                    createdAt: evaluatedAt,
                    cooldownKey: key,
                });
            }
        }

        // 3. SIGNAL C: ACTIVE FOCUS SESSION
        if (snapshot.focus && snapshot.focus.state === "running") {
            const key = "focus:running";
            if (this.isCandidateEligible(key, "active_focus", force, currentTime)) {
                const remainingMin = Math.ceil(snapshot.focus.remainingSeconds / 60);
                const wsLabel = snapshot.focus.activeWorkspace ? ` in "${snapshot.focus.activeWorkspace}"` : "";
                candidates.push({
                    id: `sug_focus_running_${currentTime}`,
                    type: "active_focus",
                    title: "Focus session active",
                    message: `Your focus block is currently in progress (${remainingMin}m remaining${wsLabel}).`,
                    rationale: "You currently have an active focus block.",
                    suggestedAction: {
                        label: "View Focus",
                        command: "start deep work",
                        type: "command",
                    },
                    relatedEntityType: "focus",
                    priority: "medium",
                    createdAt: evaluatedAt,
                    cooldownKey: key,
                });
            }
        }

        // 4. SIGNAL D: PAUSED FOCUS SESSION
        if (snapshot.focus && snapshot.focus.state === "paused") {
            const key = "focus:paused";
            if (this.isCandidateEligible(key, "paused_focus", force, currentTime)) {
                const remainingMin = Math.ceil(snapshot.focus.remainingSeconds / 60);
                candidates.push({
                    id: `sug_focus_paused_${currentTime}`,
                    type: "paused_focus",
                    title: "Focus session paused",
                    message: `Your focus timer is paused with ${remainingMin}m remaining.`,
                    rationale: "You have an unfinished focus session.",
                    suggestedAction: {
                        label: "Resume Focus",
                        command: "resume focus",
                        type: "command",
                    },
                    relatedEntityType: "focus",
                    priority: "medium",
                    createdAt: evaluatedAt,
                    cooldownKey: key,
                });
            }
        }

        // 5. SIGNAL H: RECENTLY COMPLETED WORK (checked before stale project to acknowledge accomplishment)
        if (snapshot.tasks?.recentlyCompleted && snapshot.tasks.recentlyCompleted.length > 0) {
            const recent = snapshot.tasks.recentlyCompleted[0];
            const key = `completed:${recent.id}`;
            if (this.isCandidateEligible(key, "completed_work_next_step", force, currentTime)) {
                candidates.push({
                    id: `sug_completed_${recent.id}`,
                    type: "completed_work_next_step",
                    title: "Task completed",
                    message: `Completed "${recent.text}". Excellent momentum.`,
                    rationale: "A mission directive was recently marked complete.",
                    suggestedAction: {
                        label: "What Should I Do Next?",
                        command: "what should I work on now?",
                        type: "command",
                    },
                    relatedEntityId: recent.id,
                    relatedEntityType: "task",
                    priority: "low",
                    createdAt: evaluatedAt,
                    cooldownKey: key,
                });
            }
        }

        // 6. SIGNAL E: ACTIVE PROJECT WITHOUT RECENT ACTIVITY
        // (Only surface if factual data establishes real absence of activity; never guess semantic links)
        if (snapshot.projects?.activeProjects && snapshot.projects.activeProjects.length > 0) {
            for (const proj of snapshot.projects.activeProjects) {
                if (proj.status === "In Progress" || proj.progress > 0) {
                    const key = `project_stale:${proj.id}`;
                    // Verify if any observable activity explicitly references this project
                    const hasRecentActivity = snapshot.activity?.some(
                        (a) =>
                            (a.label && a.label.toLowerCase().includes(proj.name.toLowerCase())) ||
                            (a.detail && a.detail.toLowerCase().includes(proj.name.toLowerCase()))
                    );

                    if (!hasRecentActivity && this.isCandidateEligible(key, "active_project_stale", force, currentTime)) {
                        candidates.push({
                            id: `sug_proj_stale_${proj.id}`,
                            type: "active_project_stale",
                            title: `Continue project "${proj.name}"`,
                            message: `Project is at ${proj.progress}% with no recent session directives recorded.`,
                            rationale: "You have an active project with unfinished progress.",
                            suggestedAction: {
                                label: "Review Projects",
                                command: "open projects",
                                type: "command",
                            },
                            relatedEntityId: proj.id,
                            relatedEntityType: "project",
                            priority: "low",
                            createdAt: evaluatedAt,
                            cooldownKey: key,
                        });
                        break; // Bounded to 1 stale project at a time
                    }
                }
            }
        }

        // 7. SIGNAL F: ACTIVE GOAL WITH RELEVANT PENDING WORK
        // (Only if direct metadata correlation is observable: category match or title keyword in pending tasks)
        if (snapshot.goals?.activeGoals && snapshot.goals.activeGoals.length > 0 && snapshot.tasks?.recentPending) {
            for (const goal of snapshot.goals.activeGoals) {
                if (!goal.completed && goal.current < goal.target) {
                    const key = `goal_pending:${goal.id}`;
                    const relatedTask = snapshot.tasks.recentPending.find(
                        (t) =>
                            (t.category && goal.title.toLowerCase().includes(t.category.toLowerCase())) ||
                            (t.text && goal.title.toLowerCase().includes(t.text.toLowerCase().slice(0, 10)))
                    );

                    if (relatedTask && this.isCandidateEligible(key, "active_goal_pending", force, currentTime)) {
                        candidates.push({
                            id: `sug_goal_pending_${goal.id}`,
                            type: "active_goal_pending",
                            title: `Progress goal "${goal.title}"`,
                            message: `Pending task "${relatedTask.text}" directly aligns with this goal (${goal.current}/${goal.target}).`,
                            rationale: "Observable pending work is aligned with this active goal.",
                            suggestedAction: {
                                label: "Show Tasks",
                                command: "show tasks",
                                type: "command",
                            },
                            relatedEntityId: goal.id,
                            relatedEntityType: "goal",
                            priority: "low",
                            createdAt: evaluatedAt,
                            cooldownKey: key,
                        });
                        break;
                    }
                }
            }
        }

        // 8. SIGNAL G: STALE ALFRED ACTIVITY (Non-manipulative, factual only)
        if (
            candidates.length === 0 &&
            snapshot.activity &&
            snapshot.activity.length > 0 &&
            snapshot.tasks.summary.pending > 0
        ) {
            const mostRecentActivity = snapshot.activity[0];
            const hoursSinceActivity = (currentTime - mostRecentActivity.timestamp) / (1000 * 60 * 60);
            const key = "activity:stale";

            if (hoursSinceActivity >= 24 && this.isCandidateEligible(key, "stale_activity", force, currentTime)) {
                candidates.push({
                    id: `sug_stale_activity_${currentTime}`,
                    type: "stale_activity",
                    title: "Workstation session idle",
                    message: "You haven't recorded activity in ALFRED recently.",
                    rationale: "No workstation actions have been logged in the past 24 hours.",
                    suggestedAction: {
                        label: "Review Priorities",
                        command: "what should I work on now?",
                        type: "command",
                    },
                    priority: "low",
                    createdAt: evaluatedAt,
                    cooldownKey: key,
                });
            }
        }

        // Bounded list: At most 3 suggestions
        const bounded = candidates.slice(0, 3);
        const activeSuggestion = bounded.length > 0 ? bounded[0] : null;

        // If an active suggestion was surfaced, update its cooldown records
        if (activeSuggestion) {
            this.recordSurfaced(activeSuggestion.cooldownKey, currentTime);
            this.recordSurfaced(`type:${activeSuggestion.type}`, currentTime);
        }

        logger.info(
            `ProactiveAgentService: Evaluated ${bounded.length} suggestion(s). Active: ${
                activeSuggestion ? activeSuggestion.type : "none"
            }`
        );

        return {
            suggestions: bounded,
            activeSuggestion,
            evaluatedAt,
        };
    }

    /**
     * Explicitly dismisses a suggestion and enters extended cooldown.
     */
    public dismiss(cooldownKeyOrId: string, now: Date = new Date()): void {
        const currentTime = now.getTime();
        const existing = this.cooldowns.get(cooldownKeyOrId) || { lastSurfacedAt: currentTime };
        this.cooldowns.set(cooldownKeyOrId, {
            ...existing,
            dismissedAt: currentTime,
        });
        logger.info(`ProactiveAgentService: Dismissed proactive suggestion key: ${cooldownKeyOrId}`);
    }

    /**
     * Checks if a cooldownKey is currently in cooldown or suppressed by dismissal.
     */
    public isCoolingDown(key: string, now: number = Date.now()): boolean {
        const state = this.cooldowns.get(key);
        if (!state) return false;

        if (state.dismissedAt) {
            const elapsedSinceDismiss = now - state.dismissedAt;
            if (elapsedSinceDismiss < this.dismissedDurationMs) {
                return true;
            }
        }

        const elapsedSinceSurfaced = now - state.lastSurfacedAt;
        return elapsedSinceSurfaced < this.cooldownDurationMs;
    }

    /**
     * Records that a suggestion key was surfaced at the given timestamp.
     */
    public recordSurfaced(key: string, timestamp: number = Date.now()): void {
        const existing = this.cooldowns.get(key);
        this.cooldowns.set(key, {
            lastSurfacedAt: timestamp,
            dismissedAt: existing?.dismissedAt,
        });
    }

    /**
     * Resets all in-memory cooldowns and dismissal state (useful for tests and fresh boots).
     */
    public resetCooldowns(): void {
        this.cooldowns.clear();
    }
}

export const proactiveAgentService = new ProactiveAgentService();
