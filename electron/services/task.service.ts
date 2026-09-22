import { getMainWindow } from "../windows/main-window";
import { logger } from "../utils/logger";

export interface Task {
    id: string;
    text: string;
    completed: boolean;
    category: string;
}

const DEFAULT_INITIAL_TASKS: Task[] = [
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
export class TaskService {
    private tasks: Task[] = [];
    private idCounter = 100;

    constructor(initialTasks?: Task[]) {
        this.tasks = initialTasks ? [...initialTasks] : [...DEFAULT_INITIAL_TASKS];
    }

    /**
     * Returns all current tasks (read-only copy).
     */
    public getTasks(): Task[] {
        return this.tasks.map((t) => ({ ...t }));
    }

    /**
     * Replaces current task state (e.g. synced from renderer storage on boot).
     */
    public syncTasks(tasks: Task[]): void {
        if (Array.isArray(tasks)) {
            this.tasks = tasks.map((t) => ({
                id: String(t.id),
                text: String(t.text || "").trim(),
                completed: Boolean(t.completed),
                category: String(t.category || "Personal").trim(),
            }));
            logger.info(`TaskService: Synced ${this.tasks.length} task(s) from renderer.`);
        }
    }

    /**
     * Creates a new task and broadcasts changes to renderer window.
     */
    public createTask(text: string, category?: string): Task {
        const trimmedText = text.trim();
        const newTask: Task = {
            id: String(Date.now() + ++this.idCounter),
            text: trimmedText,
            completed: false,
            category: (category && category.trim()) || "Personal",
        };

        this.tasks = [newTask, ...this.tasks];
        logger.info(`TaskService: Created task '${newTask.text}' (ID: ${newTask.id})`);

        this.broadcastChanges();
        return { ...newTask };
    }

    /**
     * Marks an existing task as completed.
     */
    public completeTask(taskId: string): { success: boolean; task?: Task; error?: string } {
        const idStr = String(taskId).trim();
        const index = this.tasks.findIndex((t) => t.id === idStr);

        if (index === -1) {
            logger.warn(`TaskService: Task with ID '${idStr}' not found.`);
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

        logger.info(`TaskService: Completed task '${updatedTask.text}' (ID: ${updatedTask.id})`);
        this.broadcastChanges();

        return {
            success: true,
            task: { ...updatedTask },
        };
    }

    /**
     * Resets tasks to default state (useful for tests).
     */
    public reset(tasks?: Task[]): void {
        this.tasks = tasks ? [...tasks] : [...DEFAULT_INITIAL_TASKS];
    }

    /**
     * Broadcasts task list update to the active BrowserWindow if available.
     */
    private broadcastChanges(): void {
        try {
            const win = getMainWindow();
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send("tasks:changed", this.getTasks());
            }
        } catch {
            // Window might not exist in standalone unit test environments
        }
    }
}

export const taskService = new TaskService();
