import { getMainWindow } from "../windows/main-window";
import { logger } from "../utils/logger";
import { eventBus } from "../events/event-bus";

export type GoalType = "Weekly" | "Monthly";

export interface Goal {
    id: string;
    title: string;
    type: GoalType;
    target: number;
    current: number;
    completed: boolean;
}

const DEFAULT_INITIAL_GOALS: Goal[] = [
    { id: "1", title: "Solve LeetCode Problems", type: "Weekly", target: 20, current: 8, completed: false },
    { id: "2", title: "Study System Design", type: "Monthly", target: 30, current: 12, completed: false },
];

/**
 * Goal Service (Phase 4.12)
 *
 * Manages goal state in the Electron process and communicates mutations
 * to the renderer via IPC for real-time UI synchronization.
 */
export class GoalService {
    private goals: Goal[] = [];
    private idCounter = 100;

    constructor(initialGoals?: Goal[]) {
        this.goals = initialGoals ? [...initialGoals] : [...DEFAULT_INITIAL_GOALS];
    }

    /**
     * Returns all current goals (read-only copy).
     */
    public getGoals(): Goal[] {
        return this.goals.map((g) => ({ ...g }));
    }

    /**
     * Replaces current goal state (synced from renderer storage).
     */
    public syncGoals(goals: Goal[]): void {
        if (Array.isArray(goals)) {
            this.goals = goals.map((g) => ({
                id: String(g.id),
                title: String(g.title || "").trim(),
                type: (g.type === "Monthly" ? "Monthly" : "Weekly") as GoalType,
                target: typeof g.target === "number" && !isNaN(g.target) ? Math.max(1, g.target) : 10,
                current: typeof g.current === "number" && !isNaN(g.current) ? Math.max(0, g.current) : 0,
                completed: Boolean(g.completed),
            }));
            logger.info(`GoalService: Synced ${this.goals.length} goal(s) from renderer.`);
        }
    }

    /**
     * Creates a new goal and broadcasts changes to renderer window.
     */
    public createGoal(params: { title: string; type?: GoalType; target?: number }): Goal {
        const trimmedTitle = params.title.trim();
        const goalType: GoalType = params.type === "Monthly" ? "Monthly" : "Weekly";
        const target = typeof params.target === "number" && !isNaN(params.target) && params.target > 0
            ? Math.floor(params.target)
            : 10;

        const newGoal: Goal = {
            id: String(Date.now() + ++this.idCounter),
            title: trimmedTitle,
            type: goalType,
            target,
            current: 0,
            completed: false,
        };

        this.goals = [newGoal, ...this.goals];
        logger.info(`GoalService: Created goal '${newGoal.title}' (ID: ${newGoal.id}, target: ${newGoal.target})`);

        this.broadcastChanges();
        return { ...newGoal };
    }

    /**
     * Updates an existing goal.
     */
    public updateGoal(
        goalId: string,
        updates: { title?: string; target?: number; current?: number; completed?: boolean }
    ): { success: boolean; goal?: Goal; error?: string } {
        const idStr = String(goalId).trim();
        const index = this.goals.findIndex((g) => g.id === idStr);

        if (index === -1) {
            logger.warn(`GoalService: Goal with ID '${idStr}' not found.`);
            return {
                success: false,
                error: `Goal with ID '${idStr}' not found.`,
            };
        }

        const currentGoal = this.goals[index];
        const newTitle = updates.title !== undefined ? updates.title.trim() : currentGoal.title;
        const newTarget = typeof updates.target === "number" && !isNaN(updates.target) && updates.target > 0
            ? Math.floor(updates.target)
            : currentGoal.target;
        const newCurrent = typeof updates.current === "number" && !isNaN(updates.current)
            ? Math.max(0, updates.current)
            : currentGoal.current;

        // Auto-complete if newCurrent >= newTarget, or explicitly marked completed
        const isCompleted = updates.completed !== undefined
            ? Boolean(updates.completed)
            : newCurrent >= newTarget;

        const updatedGoal: Goal = {
            ...currentGoal,
            title: newTitle,
            target: newTarget,
            current: newCurrent,
            completed: isCompleted,
        };

        this.goals = [
            ...this.goals.slice(0, index),
            updatedGoal,
            ...this.goals.slice(index + 1),
        ];

        logger.info(`GoalService: Updated goal '${updatedGoal.title}' (ID: ${updatedGoal.id})`);

        eventBus.publish("goal_progress_changed", {
            goalId: updatedGoal.id,
            title: updatedGoal.title,
            type: updatedGoal.type,
            current: updatedGoal.current,
            target: updatedGoal.target,
            completed: updatedGoal.completed,
        });

        this.broadcastChanges();

        return {
            success: true,
            goal: { ...updatedGoal },
        };
    }

    /**
     * Resets goals to default state (useful for tests).
     */
    public reset(goals?: Goal[]): void {
        this.goals = goals ? [...goals] : [...DEFAULT_INITIAL_GOALS];
    }

    /**
     * Broadcasts goal list update to the active BrowserWindow if available.
     */
    private broadcastChanges(): void {
        try {
            const win = getMainWindow();
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send("goals:changed", this.getGoals());
            }
        } catch {
            // Window might not exist in standalone unit test environments
        }
    }
}

export const goalService = new GoalService();
