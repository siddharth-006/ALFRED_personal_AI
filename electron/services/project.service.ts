import { getMainWindow } from "../windows/main-window";
import { logger } from "../utils/logger";
import { eventBus } from "../events/event-bus";

export type ProjectCategory = "DSA" | "Data Science" | "College" | "Hackathon" | "Personal";
export type ProjectStatus = "Not Started" | "In Progress" | "Completed";

export interface Project {
    id: string;
    name: string;
    description: string;
    category: ProjectCategory;
    status: ProjectStatus;
    progress: number;
    createdDate: string;
}

const DEFAULT_INITIAL_PROJECTS: Project[] = [
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
export class ProjectService {
    private projects: Project[] = [];

    constructor(initialProjects?: Project[]) {
        this.projects = initialProjects ? [...initialProjects] : [...DEFAULT_INITIAL_PROJECTS];
    }

    /**
     * Returns all current projects (read-only copy).
     */
    public getProjects(): Project[] {
        return this.projects.map((p) => ({ ...p }));
    }

    /**
     * Replaces current project state (synced from renderer storage).
     */
    public syncProjects(projects: Project[]): void {
        if (Array.isArray(projects)) {
            this.projects = projects.map((p) => ({
                id: String(p.id),
                name: String(p.name || "").trim(),
                description: String(p.description || "").trim(),
                category: (p.category || "Personal") as ProjectCategory,
                status: (p.status || "Not Started") as ProjectStatus,
                progress: typeof p.progress === "number" && !isNaN(p.progress)
                    ? Math.min(100, Math.max(0, p.progress))
                    : 0,
                createdDate: String(p.createdDate || new Date().toISOString().split("T")[0]),
            }));
            logger.info(`ProjectService: Synced ${this.projects.length} project(s) from renderer.`);
        }
    }

    /**
     * Updates an existing project.
     */
    public updateProject(
        projectId: string,
        updates: {
            progress?: number;
            status?: ProjectStatus;
            name?: string;
            description?: string;
            category?: ProjectCategory;
        }
    ): { success: boolean; project?: Project; error?: string } {
        const idStr = String(projectId).trim();
        const index = this.projects.findIndex((p) => p.id === idStr);

        if (index === -1) {
            logger.warn(`ProjectService: Project with ID '${idStr}' not found.`);
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

        const updatedProject: Project = {
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

        logger.info(`ProjectService: Updated project '${updatedProject.name}' (ID: ${updatedProject.id}, progress: ${updatedProject.progress}%, status: ${updatedProject.status})`);

        eventBus.publish("project_activity", {
            projectId: updatedProject.id,
            name: updatedProject.name,
            category: updatedProject.category,
            progress: updatedProject.progress,
            status: updatedProject.status,
        });

        this.broadcastChanges();

        return {
            success: true,
            project: { ...updatedProject },
        };
    }

    /**
     * Resets projects to default state (useful for tests).
     */
    public reset(projects?: Project[]): void {
        this.projects = projects ? [...projects] : [...DEFAULT_INITIAL_PROJECTS];
    }

    /**
     * Broadcasts project list update to the active BrowserWindow if available.
     */
    private broadcastChanges(): void {
        try {
            const win = getMainWindow();
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send("projects:changed", this.getProjects());
            }
        } catch {
            // Window might not exist in standalone unit test environments
        }
    }
}

export const projectService = new ProjectService();
