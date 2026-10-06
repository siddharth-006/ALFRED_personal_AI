import { AgentContextSnapshot } from "../agent-context/agent-context.types";
import {
    RecommendationItem,
    RecommendationResult,
    RecommendationSignal,
} from "./recommendation.types";
import { logger } from "../../utils/logger";

/**
 * Recommendation Agent Service (Phase 5.5B)
 *
 * Reasons over the factual AgentContextSnapshot to provide 1–3 grounded,
 * explainable recommendations without mutating any state or executing tools.
 */
export class RecommendationAgentService {
    /**
     * Determines whether a natural language prompt is a recommendation inquiry.
     */
    public isRecommendationQuery(prompt: string): boolean {
        if (!prompt || typeof prompt !== "string") return false;
        const lower = prompt.toLowerCase().trim();

        const patterns = [
            "what should i work on",
            "what should i do next",
            "what should i focus on",
            "what to work on",
            "what to do next",
            "what are my priorities",
            "what is my priority",
            "give me something productive",
            "what can i work on",
            "i have some free time",
            "recommend something",
            "any recommendations",
            "where should i start",
            "what's next for me",
            "what is next for me",
        ];

        return patterns.some((p) => lower.includes(p));
    }

    /**
     * Generates a bounded list (1-3) of factual recommendations based on the snapshot.
     */
    public generateRecommendations(snapshot: AgentContextSnapshot): RecommendationResult {
        logger.info("RecommendationAgentService: Evaluating factual state snapshot for recommendations...");

        const candidates: RecommendationItem[] = [];

        // 1. SIGNAL: Active Focus Session (Respect in-flight deep work above everything else)
        if (snapshot.focus && (snapshot.focus.state === "running" || snapshot.focus.state === "paused")) {
            const isPaused = snapshot.focus.state === "paused";
            const remainingMin = Math.ceil(snapshot.focus.remainingSeconds / 60);
            const wsInfo = snapshot.focus.activeWorkspace ? ` for "${snapshot.focus.activeWorkspace}"` : "";
            candidates.push({
                id: `rec_focus_${Date.now()}`,
                title: isPaused ? "Resume your active Focus session" : "Continue your current Focus session",
                description: isPaused
                    ? `Your focus timer is currently paused with ${remainingMin} minute(s) remaining${wsInfo}.`
                    : `You have an active focus block with ${remainingMin} minute(s) remaining${wsInfo}.`,
                rationale: isPaused
                    ? `You paused an active focus session with ${remainingMin} minute(s) remaining${wsInfo}.`
                    : `You are currently in a running focus session with ${remainingMin} minute(s) remaining${wsInfo}.`,
                category: "focus_session",
                relatedEntityType: "focus",
                suggestedAction: isPaused ? "resume focus" : "continue focus",
                signals: [
                    {
                        field: "focus.state",
                        value: snapshot.focus.state,
                        explanation: `Focus timer state is currently ${snapshot.focus.state}`,
                    },
                    {
                        field: "focus.remainingSeconds",
                        value: snapshot.focus.remainingSeconds,
                        explanation: `${remainingMin} minute(s) remaining in this session`,
                    },
                ],
            });
        }

        // 2. SIGNAL: Overdue Tasks
        if (snapshot.tasks?.recentPending) {
            const overdue = snapshot.tasks.recentPending.filter((t) => t.isOverdue);
            for (const task of overdue) {
                candidates.push({
                    id: `rec_task_overdue_${task.id}`,
                    title: `Review overdue task: "${task.text}"`,
                    description: `This task was due on ${task.dueDate} and remains pending under category ${task.category}.`,
                    rationale: `It is marked with a past due date (${task.dueDate}) and is still pending and overdue.`,
                    category: "overdue_task",
                    relatedEntityId: task.id,
                    relatedEntityType: "task",
                    suggestedAction: `complete task ${task.id}`,
                    signals: [
                        {
                            field: "task.dueDate",
                            value: task.dueDate || "",
                            explanation: `Due date was ${task.dueDate} which has passed (overdue)`,
                        },
                        {
                            field: "task.completed",
                            value: false,
                            explanation: "Task is pending",
                        },
                    ],
                });
            }
        }

        // 3. SIGNAL: Due Today Tasks
        if (snapshot.tasks?.todayPending && snapshot.tasks.todayPending.length > 0) {
            for (const task of snapshot.tasks.todayPending) {
                // Avoid duplicating if already counted in overdue
                if (!candidates.some((c) => c.relatedEntityId === task.id)) {
                    candidates.push({
                        id: `rec_task_today_${task.id}`,
                        title: `Work on today's task: "${task.text}"`,
                        description: `Scheduled for completion today under ${task.category}.`,
                        rationale: "It is due today and is still pending completion.",
                        category: "due_today_task",
                        relatedEntityId: task.id,
                        relatedEntityType: "task",
                        suggestedAction: `complete task ${task.id}`,
                        signals: [
                            {
                                field: "task.dueDate",
                                value: task.dueDate || snapshot.system.currentDate,
                                explanation: "Task is scheduled for completion today",
                            },
                        ],
                    });
                }
            }
        }

        // 4. SIGNAL: High Priority Pending Tasks
        if (snapshot.tasks?.recentPending) {
            const highPriority = snapshot.tasks.recentPending.filter(
                (t) => t.priority === "high" && !candidates.some((c) => c.relatedEntityId === t.id)
            );
            for (const task of highPriority) {
                candidates.push({
                    id: `rec_task_high_${task.id}`,
                    title: `Prioritize high-priority task: "${task.text}"`,
                    description: `Marked as high priority in category ${task.category}.`,
                    rationale: "It is marked high priority and is still pending.",
                    category: "high_priority_task",
                    relatedEntityId: task.id,
                    relatedEntityType: "task",
                    suggestedAction: `complete task ${task.id}`,
                    signals: [
                        {
                            field: "task.priority",
                            value: "high",
                            explanation: "Task priority is explicitly marked high",
                        },
                    ],
                });
            }
        }

        // 5. SIGNAL: Active Projects with Incomplete Progress
        if (snapshot.projects?.activeProjects && snapshot.projects.activeProjects.length > 0) {
            for (const proj of snapshot.projects.activeProjects) {
                if (proj.status === "In Progress" || proj.status === "active" || proj.progress > 0) {
                    candidates.push({
                        id: `rec_proj_${proj.id}`,
                        title: `Continue project: "${proj.name}"`,
                        description: `Currently ${proj.progress}% complete with status "${proj.status}".`,
                        rationale: `You have an active project ("${proj.name}") with unfinished progress (${proj.progress}%).`,
                        category: "active_project",
                        relatedEntityId: proj.id,
                        relatedEntityType: "project",
                        signals: [
                            {
                                field: "project.status",
                                value: proj.status,
                                explanation: `Project status is ${proj.status}`,
                            },
                            {
                                field: "project.progress",
                                value: proj.progress,
                                explanation: `Progress is currently at ${proj.progress}%`,
                            },
                        ],
                    });
                }
            }
        }

        // 6. SIGNAL: Active Goals needing progress
        if (snapshot.goals?.activeGoals && snapshot.goals.activeGoals.length > 0) {
            for (const goal of snapshot.goals.activeGoals) {
                if (!goal.completed && goal.current < goal.target) {
                    const goalTypeStr = goal.type ? String(goal.type).toLowerCase() : "active";
                    candidates.push({
                        id: `rec_goal_${goal.id}`,
                        title: `Advance goal: "${goal.title}"`,
                        description: `${goal.type || "Goal"} target: ${goal.current}/${goal.target} (${goal.progressPercentage}%).`,
                        rationale: `This ${goalTypeStr} goal is at ${goal.progressPercentage}% (${goal.current}/${goal.target}).`,
                        category: "active_goal",
                        relatedEntityId: goal.id,
                        relatedEntityType: "goal",
                        signals: [
                            {
                                field: "goal.current",
                                value: goal.current,
                                explanation: `Current count is ${goal.current} of ${goal.target}`,
                            },
                        ],
                    });
                }
            }
        }

        // 6.5 SIGNAL: Saved User Preference / Memory Integration (Phase 5.7, Section 21)
        // If the user has saved a relevant preference (e.g. workspace or workflow preference), surface it as an advisory option
        if (snapshot.memory?.relevant && snapshot.memory.relevant.length > 0) {
            const pref = snapshot.memory.relevant.find((m) =>
                m.category === "WORKSPACE_PREFERENCE" || m.category === "WORKFLOW_PREFERENCE"
            );
            if (pref) {
                candidates.unshift({
                    id: `rec_pref_${pref.id}`,
                    title: `Work in preferred setup: "${pref.content.replace(/\.$/, "")}"`,
                    description: `Based on your saved preference: ${pref.content}`,
                    rationale: `You saved this preference: "${pref.content}".`,
                    category: "workspace",
                    relatedEntityType: "workspace",
                    suggestedAction: `prepare coding setup`,
                    signals: [
                        {
                            field: "memory.content",
                            value: pref.content,
                            explanation: `Saved user preference in category ${pref.category}`,
                        },
                    ],
                });
            }
        }

        // 7. SIGNAL: General Pending Tasks if no overdue/due-today/high-priority items found
        if (candidates.length === 0 && snapshot.tasks?.recentPending && snapshot.tasks.recentPending.length > 0) {
            for (const task of snapshot.tasks.recentPending) {
                candidates.push({
                    id: `rec_task_general_${task.id}`,
                    title: `Work on task: "${task.text}"`,
                    description: `Category: ${task.category}.`,
                    rationale: `It is currently pending in your ${task.category} list.`,
                    category: "task",
                    relatedEntityId: task.id,
                    relatedEntityType: "task",
                    suggestedAction: `complete task ${task.id}`,
                    signals: [
                        {
                            field: "task.completed",
                            value: false,
                            explanation: "Task is pending",
                        },
                    ],
                });
            }
        }

        // If no candidate signals exist, provide an honest, non-fabricated empty state recommendation
        let hasPendingPriorities = true;
        if (candidates.length === 0) {
            hasPendingPriorities = false;
            candidates.push({
                id: "rec_empty_state",
                title: "All caught up",
                description: "No pending tasks, active goals, or focus deadlines.",
                rationale: "You have no pending tasks or urgent deadlines right now. Everything is clear and caught up.",
                category: "empty_state",
                signals: [],
            });
        }

        // Bounded list: At most 3 factual recommendations
        const boundedRecommendations = candidates.slice(0, 3);
        const hasRecommendations = boundedRecommendations.length > 0;

        let summary = "No urgent or active items found in your current ALFRED state. You are caught up on pending tasks.";
        if (hasRecommendations && hasPendingPriorities) {
            const formattedItems = boundedRecommendations.map((r, i) => `${i + 1}. ${r.title} — ${r.rationale}`);
            summary = `Based on your current state:\n${formattedItems.join("\n")}`;
        } else if (hasRecommendations) {
            summary = boundedRecommendations[0].rationale;
        }

        return {
            generatedAt: snapshot.generatedAt,
            recommendations: boundedRecommendations,
            summary,
            hasRecommendations,
            hasPendingPriorities,
        };
    }

    /**
     * Formats recommendations into conversational text suitable for answering questions and TTS.
     */
    public formatConversationalExplanation(result: RecommendationResult): string {
        if (!result.hasRecommendations || result.recommendations.length === 0) {
            return "You have no pending tasks, active focus sessions, or urgent deadlines right now. All caught up!";
        }

        if (result.recommendations[0].category === "empty_state") {
            return result.recommendations[0].rationale;
        }

        if (result.recommendations.length === 1) {
            const item = result.recommendations[0];
            return `You could work on ${item.title} because ${item.rationale.charAt(0).toLowerCase() + item.rationale.slice(1)}`;
        }

        const lines = result.recommendations.map(
            (r, i) => `${i + 1}. ${r.title} (Reason: ${r.rationale})`
        );
        return `Here are a few items you could work on:\n${lines.join("\n")}`;
    }

    /**
     * Formats recommendations into natural, concise spoken text for local TTS.
     */
    public formatSpokenRecommendation(result: RecommendationResult): string {
        if (!result.hasRecommendations || result.recommendations.length === 0) {
            return "You are all caught up. No pending tasks or deadlines right now.";
        }

        const top = result.recommendations[0];
        if (top.category === "empty_state") {
            return "You are all caught up. No pending tasks or deadlines right now.";
        }

        if (result.recommendations.length === 1) {
            return `You could ${top.title}. ${top.rationale}`;
        }

        const second = result.recommendations[1];
        return `You could ${top.title} because ${top.rationale.charAt(0).toLowerCase() + top.rationale.slice(1)} Alternatively, consider ${second.title}.`;
    }
}

export const recommendationAgentService = new RecommendationAgentService();
