"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDefaultTools = registerDefaultTools;
const tool_registry_1 = require("./tool-registry");
const launch_application_tool_1 = require("./builtins/launch-application.tool");
const navigate_tool_1 = require("./builtins/navigate.tool");
const system_status_tool_1 = require("./builtins/system-status.tool");
const start_deep_work_tool_1 = require("./builtins/start-deep-work.tool");
const launch_workspace_tool_1 = require("./builtins/launch-workspace.tool");
const show_tasks_tool_1 = require("./builtins/show-tasks.tool");
const open_url_tool_1 = require("./builtins/open-url.tool");
const open_path_tool_1 = require("./builtins/open-path.tool");
const create_task_tool_1 = require("./builtins/create-task.tool");
const complete_task_tool_1 = require("./builtins/complete-task.tool");
const create_goal_tool_1 = require("./builtins/create-goal.tool");
const update_goal_tool_1 = require("./builtins/update-goal.tool");
const update_project_tool_1 = require("./builtins/update-project.tool");
__exportStar(require("./types"), exports);
__exportStar(require("./tool-registry"), exports);
__exportStar(require("./builtins/launch-application.tool"), exports);
__exportStar(require("./builtins/navigate.tool"), exports);
__exportStar(require("./builtins/system-status.tool"), exports);
__exportStar(require("./builtins/start-deep-work.tool"), exports);
__exportStar(require("./builtins/launch-workspace.tool"), exports);
__exportStar(require("./builtins/show-tasks.tool"), exports);
__exportStar(require("./builtins/open-url.tool"), exports);
__exportStar(require("./builtins/open-path.tool"), exports);
__exportStar(require("./builtins/create-task.tool"), exports);
__exportStar(require("./builtins/complete-task.tool"), exports);
__exportStar(require("./builtins/create-goal.tool"), exports);
__exportStar(require("./builtins/update-goal.tool"), exports);
__exportStar(require("./builtins/update-project.tool"), exports);
/**
 * Registers all standard ALFRED default tools into the Tool Registry.
 */
function registerDefaultTools() {
    const defaultTools = [
        launch_application_tool_1.launchApplicationTool,
        navigate_tool_1.navigateTool,
        system_status_tool_1.systemStatusTool,
        start_deep_work_tool_1.startDeepWorkTool,
        launch_workspace_tool_1.launchWorkspaceTool,
        show_tasks_tool_1.showTasksTool,
        open_url_tool_1.openUrlTool,
        open_path_tool_1.openPathTool,
        create_task_tool_1.createTaskTool,
        complete_task_tool_1.completeTaskTool,
        create_goal_tool_1.createGoalTool,
        update_goal_tool_1.updateGoalTool,
        update_project_tool_1.updateProjectTool,
    ];
    for (const tool of defaultTools) {
        if (!tool_registry_1.toolRegistry.has(tool.name)) {
            tool_registry_1.toolRegistry.register(tool);
        }
    }
}
// Auto-register built-in tools on module load
registerDefaultTools();
