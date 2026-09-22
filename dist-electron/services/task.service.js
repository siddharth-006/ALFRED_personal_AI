"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskService = exports.TaskService = void 0;
const main_window_1 = require("../windows/main-window");
const logger_1 = require("../utils/logger");
const DEFAULT_INITIAL_TASKS = [
    { id: "1", text: "Solve 2 LeetCode Problems", completed: false, category: "DSA" },
    { id: "2", text: "SQL Revision", completed: false, category: "Data Science" },
    { id: "3", text: "Work on Power BI Project", completed: false, category: "Data Science" },
    { id: "4", text: "Apply for Internship", completed: false, category: "Personal" },
    { id: "5", text: "Read Tech News", completed: false, category: "Personal" },
];
/**
 * Task Service (Phase 4.11)
 *
 * Manages task state in the Electron process and communicates mutations
 * to the renderer via IPC for real-time UI synchronization.
 */
class TaskService {
    tasks = [];
    idCounter = 100;
    constructor(initialTasks) {
        this.tasks = initialTasks ? [...initialTasks] : [...DEFAULT_INITIAL_TASKS];
    }
    /**
     * Returns all current tasks (read-only copy).
     */
    getTasks() {
        return this.tasks.map((t) => ({ ...t }));
    }
    /**
     * Replaces current task state (e.g. synced from renderer storage on boot).
     */
    syncTasks(tasks) {
        if (Array.isArray(tasks)) {
            this.tasks = tasks.map((t) => ({
                id: String(t.id),
                text: String(t.text || "").trim(),
                completed: Boolean(t.completed),
                category: String(t.category || "Personal").trim(),
            }));
            logger_1.logger.info(`TaskService: Synced ${this.tasks.length} task(s) from renderer.`);
        }
    }
    /**
     * Creates a new task and broadcasts changes to renderer window.
     */
    createTask(text, category) {
        const trimmedText = text.trim();
        const newTask = {
            id: String(Date.now() + ++this.idCounter),
            text: trimmedText,
            completed: false,
            category: (category && category.trim()) || "Personal",
        };
        this.tasks = [newTask, ...this.tasks];
        logger_1.logger.info(`TaskService: Created task '${newTask.text}' (ID: ${newTask.id})`);
        this.broadcastChanges();
        return { ...newTask };
    }
    /**
     * Marks an existing task as completed.
     */
    completeTask(taskId) {
        const idStr = String(taskId).trim();
        const index = this.tasks.findIndex((t) => t.id === idStr);
        if (index === -1) {
            logger_1.logger.warn(`TaskService: Task with ID '${idStr}' not found.`);
            return {
                success: false,
                error: `Task with ID '${idStr}' not found.`,
            };
        }
        const updatedTask = { ...this.tasks[index], completed: true };
        this.tasks = [
            ...this.tasks.slice(0, index),
            updatedTask,
            ...this.tasks.slice(index + 1),
        ];
        logger_1.logger.info(`TaskService: Completed task '${updatedTask.text}' (ID: ${updatedTask.id})`);
        this.broadcastChanges();
        return {
            success: true,
            task: { ...updatedTask },
        };
    }
    /**
     * Resets tasks to default state (useful for tests).
     */
    reset(tasks) {
        this.tasks = tasks ? [...tasks] : [...DEFAULT_INITIAL_TASKS];
    }
    /**
     * Broadcasts task list update to the active BrowserWindow if available.
     */
    broadcastChanges() {
        try {
            const win = (0, main_window_1.getMainWindow)();
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send("tasks:changed", this.getTasks());
            }
        }
        catch {
            // Window might not exist in standalone unit test environments
        }
    }
}
exports.TaskService = TaskService;
exports.taskService = new TaskService();
