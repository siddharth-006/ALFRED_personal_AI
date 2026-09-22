"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectService = exports.ProjectService = void 0;
const main_window_1 = require("../windows/main-window");
const logger_1 = require("../utils/logger");
const DEFAULT_INITIAL_PROJECTS = [
    {
        id: "1",
        name: "ALFRED OS",
        description: "Personal productivity dashboard with task and goal tracking",
        category: "Personal",
        status: "In Progress",
        progress: 40,
        createdDate: new Date().toISOString().split("T")[0],
    },
    {
        id: "2",
        name: "Power BI Dashboard",
        description: "Interactive analytics dashboard for data visualization",
        category: "Data Science",
        status: "In Progress",
        progress: 75,
        createdDate: new Date().toISOString().split("T")[0],
    },
    {
        id: "3",
        name: "Hackathon Project",
        description: "Full-stack web application for hackathon submission",
        category: "Hackathon",
        status: "Not Started",
        progress: 15,
        createdDate: new Date().toISOString().split("T")[0],
    },
];
/**
 * Project Service (Phase 4.12)
 *
 * Manages project state in the Electron process and communicates mutations
 * to the renderer via IPC for real-time UI synchronization.
 */
class ProjectService {
    projects = [];
    constructor(initialProjects) {
        this.projects = initialProjects ? [...initialProjects] : [...DEFAULT_INITIAL_PROJECTS];
    }
    /**
     * Returns all current projects (read-only copy).
     */
    getProjects() {
        return this.projects.map((p) => ({ ...p }));
    }
    /**
     * Replaces current project state (synced from renderer storage).
     */
    syncProjects(projects) {
        if (Array.isArray(projects)) {
            this.projects = projects.map((p) => ({
                id: String(p.id),
                name: String(p.name || "").trim(),
                description: String(p.description || "").trim(),
                category: (p.category || "Personal"),
                status: (p.status || "Not Started"),
                progress: typeof p.progress === "number" && !isNaN(p.progress)
                    ? Math.min(100, Math.max(0, p.progress))
                    : 0,
                createdDate: String(p.createdDate || new Date().toISOString().split("T")[0]),
            }));
            logger_1.logger.info(`ProjectService: Synced ${this.projects.length} project(s) from renderer.`);
        }
    }
    /**
     * Updates an existing project.
     */
    updateProject(projectId, updates) {
        const idStr = String(projectId).trim();
        const index = this.projects.findIndex((p) => p.id === idStr);
        if (index === -1) {
            logger_1.logger.warn(`ProjectService: Project with ID '${idStr}' not found.`);
            return {
                success: false,
                error: `Project with ID '${idStr}' not found.`,
            };
        }
        const currentProject = this.projects[index];
        let newProgress = currentProject.progress;
        if (updates.progress !== undefined) {
            if (typeof updates.progress !== "number" || isNaN(updates.progress) || !isFinite(updates.progress)) {
                return {
                    success: false,
                    error: "Project progress must be a valid finite number.",
                };
            }
            if (updates.progress < 0 || updates.progress > 100) {
                return {
                    success: false,
                    error: `Project progress must be between 0 and 100, received ${updates.progress}.`,
                };
            }
            newProgress = Math.round(updates.progress);
        }
        let newStatus = updates.status !== undefined ? updates.status : currentProject.status;
        if (newProgress >= 100) {
            newStatus = "Completed";
        }
        const newName = updates.name !== undefined ? updates.name.trim() : currentProject.name;
        const newDescription = updates.description !== undefined ? updates.description.trim() : currentProject.description;
        const newCategory = updates.category !== undefined ? updates.category : currentProject.category;
        const updatedProject = {
            ...currentProject,
            name: newName,
            description: newDescription,
            category: newCategory,
            status: newStatus,
            progress: newProgress,
        };
        this.projects = [
            ...this.projects.slice(0, index),
            updatedProject,
            ...this.projects.slice(index + 1),
        ];
        logger_1.logger.info(`ProjectService: Updated project '${updatedProject.name}' (ID: ${updatedProject.id}, progress: ${updatedProject.progress}%, status: ${updatedProject.status})`);
        this.broadcastChanges();
        return {
            success: true,
            project: { ...updatedProject },
        };
    }
    /**
     * Resets projects to default state (useful for tests).
     */
    reset(projects) {
        this.projects = projects ? [...projects] : [...DEFAULT_INITIAL_PROJECTS];
    }
    /**
     * Broadcasts project list update to the active BrowserWindow if available.
     */
    broadcastChanges() {
        try {
            const win = (0, main_window_1.getMainWindow)();
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send("projects:changed", this.getProjects());
            }
        }
        catch {
            // Window might not exist in standalone unit test environments
        }
    }
}
exports.ProjectService = ProjectService;
exports.projectService = new ProjectService();
