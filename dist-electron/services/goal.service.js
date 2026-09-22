"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalService = exports.GoalService = void 0;
const main_window_1 = require("../windows/main-window");
const logger_1 = require("../utils/logger");
const DEFAULT_INITIAL_GOALS = [
    { id: "1", title: "Solve LeetCode Problems", type: "Weekly", target: 20, current: 8, completed: false },
    { id: "2", title: "Study System Design", type: "Monthly", target: 30, current: 12, completed: false },
];
/**
 * Goal Service (Phase 4.12)
 *
 * Manages goal state in the Electron process and communicates mutations
 * to the renderer via IPC for real-time UI synchronization.
 */
class GoalService {
    goals = [];
    idCounter = 100;
    constructor(initialGoals) {
        this.goals = initialGoals ? [...initialGoals] : [...DEFAULT_INITIAL_GOALS];
    }
    /**
     * Returns all current goals (read-only copy).
     */
    getGoals() {
        return this.goals.map((g) => ({ ...g }));
    }
    /**
     * Replaces current goal state (synced from renderer storage).
     */
    syncGoals(goals) {
        if (Array.isArray(goals)) {
            this.goals = goals.map((g) => ({
                id: String(g.id),
                title: String(g.title || "").trim(),
                type: (g.type === "Monthly" ? "Monthly" : "Weekly"),
                target: typeof g.target === "number" && !isNaN(g.target) ? Math.max(1, g.target) : 10,
                current: typeof g.current === "number" && !isNaN(g.current) ? Math.max(0, g.current) : 0,
                completed: Boolean(g.completed),
            }));
            logger_1.logger.info(`GoalService: Synced ${this.goals.length} goal(s) from renderer.`);
        }
    }
    /**
     * Creates a new goal and broadcasts changes to renderer window.
     */
    createGoal(params) {
        const trimmedTitle = params.title.trim();
        const goalType = params.type === "Monthly" ? "Monthly" : "Weekly";
        const target = typeof params.target === "number" && !isNaN(params.target) && params.target > 0
            ? Math.floor(params.target)
            : 10;
        const newGoal = {
            id: String(Date.now() + ++this.idCounter),
            title: trimmedTitle,
            type: goalType,
            target,
            current: 0,
            completed: false,
        };
        this.goals = [newGoal, ...this.goals];
        logger_1.logger.info(`GoalService: Created goal '${newGoal.title}' (ID: ${newGoal.id}, target: ${newGoal.target})`);
        this.broadcastChanges();
        return { ...newGoal };
    }
    /**
     * Updates an existing goal.
     */
    updateGoal(goalId, updates) {
        const idStr = String(goalId).trim();
        const index = this.goals.findIndex((g) => g.id === idStr);
        if (index === -1) {
            logger_1.logger.warn(`GoalService: Goal with ID '${idStr}' not found.`);
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
        const updatedGoal = {
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
        logger_1.logger.info(`GoalService: Updated goal '${updatedGoal.title}' (ID: ${updatedGoal.id})`);
        this.broadcastChanges();
        return {
            success: true,
            goal: { ...updatedGoal },
        };
    }
    /**
     * Resets goals to default state (useful for tests).
     */
    reset(goals) {
        this.goals = goals ? [...goals] : [...DEFAULT_INITIAL_GOALS];
    }
    /**
     * Broadcasts goal list update to the active BrowserWindow if available.
     */
    broadcastChanges() {
        try {
            const win = (0, main_window_1.getMainWindow)();
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send("goals:changed", this.getGoals());
            }
        }
        catch {
            // Window might not exist in standalone unit test environments
        }
    }
}
exports.GoalService = GoalService;
exports.goalService = new GoalService();
