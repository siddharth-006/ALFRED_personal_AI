import { toolRegistry } from "./tool-registry";
import { launchApplicationTool } from "./builtins/launch-application.tool";
import { navigateTool } from "./builtins/navigate.tool";
import { systemStatusTool } from "./builtins/system-status.tool";
import { startDeepWorkTool } from "./builtins/start-deep-work.tool";
import { launchWorkspaceTool } from "./builtins/launch-workspace.tool";
import { showTasksTool } from "./builtins/show-tasks.tool";
import { openUrlTool } from "./builtins/open-url.tool";
import { openPathTool } from "./builtins/open-path.tool";
import { createTaskTool } from "./builtins/create-task.tool";
import { completeTaskTool } from "./builtins/complete-task.tool";
import { createGoalTool } from "./builtins/create-goal.tool";
import { updateGoalTool } from "./builtins/update-goal.tool";
import { updateProjectTool } from "./builtins/update-project.tool";

export * from "./types";
export * from "./tool-registry";
export * from "./builtins/launch-application.tool";
export * from "./builtins/navigate.tool";
export * from "./builtins/system-status.tool";
export * from "./builtins/start-deep-work.tool";
export * from "./builtins/launch-workspace.tool";
export * from "./builtins/show-tasks.tool";
export * from "./builtins/open-url.tool";
export * from "./builtins/open-path.tool";
export * from "./builtins/create-task.tool";
export * from "./builtins/complete-task.tool";
export * from "./builtins/create-goal.tool";
export * from "./builtins/update-goal.tool";
export * from "./builtins/update-project.tool";

/**
 * Registers all standard ALFRED default tools into the Tool Registry.
 */
export function registerDefaultTools(): void {
    const defaultTools = [
        launchApplicationTool,
        navigateTool,
        systemStatusTool,
        startDeepWorkTool,
        launchWorkspaceTool,
        showTasksTool,
        openUrlTool,
        openPathTool,
        createTaskTool,
        completeTaskTool,
        createGoalTool,
        updateGoalTool,
        updateProjectTool,
    ];

    for (const tool of defaultTools) {
        if (!toolRegistry.has(tool.name)) {
            toolRegistry.register(tool);
        }
    }
}

// Auto-register built-in tools on module load
registerDefaultTools();
