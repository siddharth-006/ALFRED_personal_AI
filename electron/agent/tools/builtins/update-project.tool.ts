import { ToolDefinition, ToolResult } from "../types";
import { projectService, Project, ProjectStatus, ProjectCategory } from "../../../services/project.service";
import { logger } from "../../../utils/logger";

export interface UpdateProjectInput {
    projectId: string;
    id?: string;
    progress?: number;
    status?: ProjectStatus;
    name?: string;
    description?: string;
    category?: ProjectCategory;
}

export interface UpdateProjectOutput {
    project: Project;
}

const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\n\r]/;
const VALID_STATUSES = new Set(["Not Started", "In Progress", "Completed"]);
const VALID_CATEGORIES = new Set(["DSA", "Data Science", "College", "Hackathon", "Personal"]);

/**
 * update_project tool adapter (Phase 4.12)
 *
 * Safely updates an existing ALFRED project using its project ID.
 */
export const updateProjectTool: ToolDefinition<UpdateProjectInput, UpdateProjectOutput> = {
    name: "update_project",
    description: "Update an existing ALFRED project using its project ID",
    category: "projects",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return { valid: false, error: "Input must be an object containing a 'projectId' property." };
        }

        const obj = input as Record<string, unknown>;

        // Only allowed fields in the current Project model
        const allowedFields = new Set(["projectId", "id", "progress", "status", "name", "description", "category"]);
        for (const key of Object.keys(obj)) {
            if (!allowedFields.has(key)) {
                return { valid: false, error: `Disallowed or unsupported field '${key}' in update_project input.` };
            }
        }

        const rawId = obj.projectId ?? obj.id;
        if (typeof rawId !== "string" && typeof rawId !== "number") {
            return { valid: false, error: "Project 'projectId' property is required." };
        }

        const idStr = String(rawId).trim();
        if (!idStr) {
            return { valid: false, error: "Project 'projectId' cannot be empty." };
        }

        if (DANGEROUS_SHELL_REGEX.test(idStr)) {
            return { valid: false, error: "Project ID contains disallowed special characters." };
        }

        if (obj.progress !== undefined) {
            if (typeof obj.progress !== "number" || isNaN(obj.progress) || !isFinite(obj.progress)) {
                return { valid: false, error: "Project 'progress' must be a valid finite number." };
            }
            if (obj.progress < 0 || obj.progress > 100) {
                return { valid: false, error: `Project 'progress' must be between 0 and 100, received ${obj.progress}.` };
            }
        }

        if (obj.status !== undefined) {
            if (typeof obj.status !== "string" || !VALID_STATUSES.has(obj.status)) {
                return { valid: false, error: "Project 'status' must be one of: 'Not Started', 'In Progress', 'Completed'." };
            }
        }

        if (obj.name !== undefined) {
            if (typeof obj.name !== "string" || !obj.name.trim()) {
                return { valid: false, error: "Project 'name' must be a non-empty string." };
            }
            if (DANGEROUS_SHELL_REGEX.test(obj.name)) {
                return { valid: false, error: "Project name contains disallowed special characters." };
            }
        }

        if (obj.description !== undefined) {
            if (typeof obj.description !== "string") {
                return { valid: false, error: "Project 'description' must be a string." };
            }
            if (DANGEROUS_SHELL_REGEX.test(obj.description)) {
                return { valid: false, error: "Project description contains disallowed special characters." };
            }
        }

        if (obj.category !== undefined) {
            if (typeof obj.category !== "string" || !VALID_CATEGORIES.has(obj.category)) {
                return { valid: false, error: "Project 'category' must be one of: 'DSA', 'Data Science', 'College', 'Hackathon', 'Personal'." };
            }
        }

        return { valid: true };
    },
    execute: (input: UpdateProjectInput): ToolResult<UpdateProjectOutput> => {
        const projectId = String(input.projectId || input.id || "").trim();
        logger.info(`update_project tool: Updating project ID "${projectId}"...`);

        const updates: {
            progress?: number;
            status?: ProjectStatus;
            name?: string;
            description?: string;
            category?: ProjectCategory;
        } = {};

        if (input.progress !== undefined) updates.progress = input.progress;
        if (input.status !== undefined) updates.status = input.status;
        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined) updates.description = input.description;
        if (input.category !== undefined) updates.category = input.category;

        const result = projectService.updateProject(projectId, updates);

        if (!result.success || !result.project) {
            return {
                success: false,
                error: result.error || `Project with ID '${projectId}' not found.`,
            };
        }

        return {
            success: true,
            data: { project: result.project },
        };
    },
};
