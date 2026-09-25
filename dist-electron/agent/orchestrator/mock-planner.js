"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockAgentPlanner = exports.MockAgentPlanner = void 0;
const logger_1 = require("../../utils/logger");
/**
 * Deterministic Mock Agent Planner (Phase 3.3 - Step 2)
 *
 * Implements IAgentPlanner for testing tool calling and orchestration.
 * Translates natural language requests into structured tool call sequences.
 *
 * DOES NOT connect to any external LLM or API.
 * DOES NOT directly execute OS commands.
 */
class MockAgentPlanner {
    plan(userRequest, context) {
        if (typeof userRequest !== "string" || !userRequest.trim()) {
            return {
                userRequest: String(userRequest || ""),
                toolCalls: [],
                explanation: "Empty request provided.",
            };
        }
        const prompt = userRequest.trim();
        const lower = prompt.toLowerCase();
        const cleanLower = lower.replace(/[.!?]+$/, "").trim();
        logger_1.logger.info(`MockAgentPlanner: Generating deterministic plan for -> "${prompt}"`);
        const history = (context?.recentConversation || context?.conversationHistory) || [];
        // Phase 4.13: Conversational Informational Follow-up Questions
        if (lower.includes("what did you just create") ||
            lower.includes("what did i just create") ||
            lower.includes("what was just created") ||
            lower.includes("what did we just create")) {
            const lastCreated = [...history].reverse().find((t) => t.intent?.startsWith("create_") || (t.targetEntity?.id && (t.targetEntity.type === "task" || t.targetEntity.type === "goal")));
            if (lastCreated && lastCreated.targetEntity) {
                return {
                    userRequest: prompt,
                    explanation: "Conversational response based on recent interaction context.",
                    type: "answer",
                    answerText: `I just created a ${lastCreated.targetEntity.type} called "${lastCreated.targetEntity.name}".`,
                    toolCalls: [],
                };
            }
            return {
                userRequest: prompt,
                explanation: "Conversational response when no entities were recently created.",
                type: "answer",
                answerText: "No task, goal, or project was created recently in this session.",
                toolCalls: [],
            };
        }
        if (lower.includes("what is the progress of that project") ||
            lower.includes("what did you just update") ||
            lower.includes("what was just updated")) {
            const lastUpdated = [...history].reverse().find((t) => t.intent?.startsWith("update_") || t.intent === "complete_task" || (t.targetEntity?.id && (t.targetEntity.type === "project" || t.targetEntity.type === "goal")));
            if (lastUpdated && lastUpdated.targetEntity) {
                return {
                    userRequest: prompt,
                    explanation: "Conversational response based on recent update context.",
                    type: "answer",
                    answerText: `The ${lastUpdated.targetEntity.type} "${lastUpdated.targetEntity.name}" was recently updated.`,
                    toolCalls: [],
                };
            }
            return {
                userRequest: prompt,
                explanation: "Conversational response when no entities were recently updated.",
                type: "answer",
                answerText: "No project or goal was updated recently in this session.",
                toolCalls: [],
            };
        }
        // Phase 4.13: Follow-up Deep Work ("Now start deep work")
        if (lower === "now start deep work" || lower === "start deep work now") {
            let sessionName = "dsa";
            const lastWs = [...history].reverse().find((t) => t.targetEntity?.type === "workspace" || t.targetEntity?.type === "project");
            if (lastWs?.targetEntity?.name) {
                sessionName = lastWs.targetEntity.name.toLowerCase().replace(/\s+/g, "-");
            }
            return {
                userRequest: prompt,
                explanation: `Starting deep work session for ${sessionName} following recent context.`,
                type: "action",
                toolCalls: [
                    { tool: "start_deep_work", arguments: { sessionName } }
                ],
            };
        }
        // 0. INFORMATIONAL QUESTION / ANSWER MODE SCENARIOS WITH CONTEXT
        if (lower.includes("which workspaces do i have") ||
            lower.includes("what workspaces do i have") ||
            lower.includes("list my workspaces") ||
            lower.includes("show my workspaces") ||
            lower.includes("what are my workspaces")) {
            let wsSummary = "You have 4 workspaces configured: DSA, Data Science, Hackathon, and Machine Learning.";
            if (context && Array.isArray(context.workspaces) && context.workspaces.length > 0) {
                const names = context.workspaces.map((w) => w.name || w.id);
                wsSummary = `You have ${names.length} workspace(s) configured: ${names.join(", ")}.`;
            }
            return {
                userRequest: prompt,
                explanation: "Listing configured workspaces from application context.",
                type: "answer",
                answerText: wsSummary,
                toolCalls: [],
            };
        }
        if (lower.includes("what should i work on") || lower.includes("pending tasks") || lower.includes("what tasks are pending")) {
            let taskSummary = "No pending tasks found.";
            if (context && Array.isArray(context.tasks)) {
                const pending = context.tasks.filter((t) => !t.completed);
                if (pending.length > 0) {
                    taskSummary = `You have ${pending.length} pending task(s): ${pending.map((t) => `"${t.text}"`).join(", ")}.`;
                }
            }
            return {
                userRequest: prompt,
                explanation: "Informational answer using application context.",
                type: "answer",
                answerText: `Based on your ALFRED context: ${taskSummary}`,
                toolCalls: [],
            };
        }
        // Phase 4.16: High-Risk Multi-Mutation Planning Scenarios (Requires Confirmation)
        if (lower.includes("__test_high_risk_multi_mutation__")) {
            return {
                userRequest: prompt,
                explanation: "High risk plan with 2 productivity mutations.",
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "Audit Security Policy" } },
                    { tool: "create_goal", arguments: { title: "Complete Q3 Compliance", target: 5 } },
                ],
            };
        }
        if (lower.includes("__test_high_risk_three_mutations__")) {
            return {
                userRequest: prompt,
                explanation: "High risk plan with 3 productivity mutations.",
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "Refactor Auth" } },
                    { tool: "create_goal", arguments: { title: "Zero Vulnerabilities", target: 10 } },
                    { tool: "update_project", arguments: { projectId: "project-1", progress: 90, status: "In Progress" } },
                ],
            };
        }
        if ((lower.includes("create a task") || lower.includes("add a task")) &&
            (lower.includes("create a goal") || lower.includes("add a goal"))) {
            let taskText = "Finish ML project";
            let goalTitle = "Master Machine Learning";
            const taskMatch = prompt.match(/(?:task)\s+(?:called|named|to|for)?\s*([^\s,;]+(?:\s+[^\s,;]+)*?)(?=\s+and\s+(?:create|add)|\s*$)/i) ||
                prompt.match(/(?:task)\s+(?:called|named|to|for)?\s*([^\s,;]+(?:\s+[^\s,;]+)*?)$/i);
            if (taskMatch && taskMatch[1].trim()) {
                taskText = taskMatch[1].trim().replace(/^["']|["']$/g, "");
            }
            const goalMatch = prompt.match(/(?:goal)\s+(?:called|named|to|for)?\s*([^\s,;]+(?:\s+[^\s,;]+)*?)(?=\s+and\s+(?:create|add)|\s*$)/i) ||
                prompt.match(/(?:goal)\s+(?:called|named|to|for)?\s*([^\s,;]+(?:\s+[^\s,;]+)*?)$/i);
            if (goalMatch && goalMatch[1].trim()) {
                goalTitle = goalMatch[1].trim().replace(/^["']|["']$/g, "");
            }
            return {
                userRequest: prompt,
                explanation: `Creating task "${taskText}" and creating goal "${goalTitle}" in a multi-mutation action plan.`,
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: taskText } },
                    { tool: "create_goal", arguments: { title: goalTitle, target: 10 } },
                ],
            };
        }
        // Phase 4.14: Multi-Step Agent Planning Scenarios
        if ((lower.includes("create a task to study cnns") || lower.includes("task to study cnns") || lower.includes("study cnns")) &&
            (lower.includes("machine learning workspace") || lower.includes("ml workspace"))) {
            return {
                userRequest: prompt,
                explanation: "Creating task to study CNNs and opening Machine Learning workspace.",
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "Study CNNs" } },
                    { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" } },
                ],
            };
        }
        // Phase 4.15: Dependency-Aware Multi-Step Agent Planning Scenarios
        if ((lower.includes("machine learning") || lower.includes("ml workspace")) &&
            (lower.includes("start deep work") || lower.includes("deep work")) &&
            (lower.includes("cnn") || lower.includes("task"))) {
            return {
                userRequest: prompt,
                explanation: "Opening Machine Learning workspace and starting deep work on CNN task.",
                type: "action",
                toolCalls: [
                    { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" } },
                    { tool: "start_deep_work", arguments: { sessionName: "CNN task" }, dependsOn: [0] },
                ],
            };
        }
        if (lower.includes("__test_dependency_3_step_chain__")) {
            return {
                userRequest: prompt,
                explanation: "Three-step dependency chain.",
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "CNN Task" } },
                    { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" }, dependsOn: [0] },
                    { tool: "start_deep_work", arguments: { sessionName: "CNN Task" }, dependsOn: [1] },
                ],
            };
        }
        if (lower.includes("__test_dependency_mid_failure__")) {
            return {
                userRequest: prompt,
                explanation: "Three-step plan where step 2 fails and step 3 depends on step 2.",
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "Task 1" } },
                    { tool: "launch_application", arguments: { appName: "nonexistent_app_fail" }, dependsOn: [0] },
                    { tool: "start_deep_work", arguments: { sessionName: "Focus" }, dependsOn: [1] },
                ],
            };
        }
        if (lower.includes("__test_dependency_unrelated_after_failure__")) {
            return {
                userRequest: prompt,
                explanation: "Three-step plan where step 1 fails, step 2 is unrelated, step 3 depends on step 1.",
                type: "action",
                toolCalls: [
                    { tool: "launch_application", arguments: { appName: "nonexistent_app_fail" } },
                    { tool: "navigate", arguments: { target: "dashboard" } },
                    { tool: "start_deep_work", arguments: { sessionName: "Focus" }, dependsOn: [0] },
                ],
            };
        }
        if (lower.includes("__test_multi_step_3_mid_fail__")) {
            return {
                userRequest: prompt,
                explanation: "Three step plan with second step failing.",
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "Step 1 Task" } },
                    { tool: "launch_application", arguments: { appName: "unsupported_random_app" } },
                    { tool: "navigate", arguments: { target: "dashboard" } },
                ],
            };
        }
        if (lower.includes("__test_multi_step_5__")) {
            return {
                userRequest: prompt,
                explanation: "Five step plan.",
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "Step 1" } },
                    { tool: "launch_workspace", arguments: { workspaceName: "Coding" } },
                    { tool: "navigate", arguments: { target: "dashboard" } },
                    { tool: "system_status", arguments: {} },
                    { tool: "show_tasks", arguments: {} },
                ],
            };
        }
        if (lower.includes("__test_multi_step_6__")) {
            return {
                userRequest: prompt,
                explanation: "Six step plan exceeding limit.",
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "Step 1" } },
                    { tool: "create_task", arguments: { text: "Step 2" } },
                    { tool: "create_task", arguments: { text: "Step 3" } },
                    { tool: "create_task", arguments: { text: "Step 4" } },
                    { tool: "create_task", arguments: { text: "Step 5" } },
                    { tool: "create_task", arguments: { text: "Step 6" } },
                ],
            };
        }
        // 1. CONTROLLED PRODUCTIVITY ACTIONS: CREATE_TASK & COMPLETE_TASK
        if (lower.startsWith("create a task") || lower.startsWith("add a task") || lower.startsWith("create task") || lower.startsWith("add task")) {
            let taskText = prompt
                .replace(/^create\s+a?\s*task\s*(to|called|named|for|:)?\s*/i, "")
                .replace(/^add\s+a?\s*task\s*(to|called|named|for|:)?\s*/i, "")
                .trim();
            if (!taskText) {
                taskText = "New Task";
            }
            // Strip trailing period if present
            if (taskText.endsWith(".")) {
                taskText = taskText.slice(0, -1).trim();
            }
            let category = "Personal";
            if (lower.includes("ml") || lower.includes("machine learning") || lower.includes("data")) {
                category = "Data Science";
            }
            else if (lower.includes("leetcode") || lower.includes("dsa") || lower.includes("algorithm")) {
                category = "DSA";
            }
            else if (lower.includes("interview") || lower.includes("job") || lower.includes("internship")) {
                category = "Career";
            }
            return {
                userRequest: prompt,
                explanation: `Creating new task "${taskText}" under category "${category}".`,
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: taskText, category } }
                ],
            };
        }
        if (lower.includes("mark it as completed") ||
            lower.includes("mark it completed") ||
            lower === "complete it" ||
            lower === "complete it." ||
            lower === "mark it done" ||
            lower.includes("complete that task") ||
            lower.includes("mark that task as completed") ||
            lower.includes("mark that task completed") ||
            lower.includes("complete that goal") ||
            lower.includes("mark that goal as completed") ||
            lower.includes("mark that goal completed") ||
            (lower.includes("mark") && lower.includes("complet")) ||
            lower.startsWith("complete task")) {
            const lastGoalEntity = [...history].reverse().find((t) => t.targetEntity?.type === "goal")?.targetEntity;
            const lastTaskEntity = [...history].reverse().find((t) => t.targetEntity?.type === "task")?.targetEntity;
            const lastEntity = [...history].reverse().find((t) => t.targetEntity?.id)?.targetEntity;
            const isGoalIntent = lower.includes("goal") || (!lower.includes("task") && lastGoalEntity && !lastTaskEntity);
            if (isGoalIntent) {
                if (lastGoalEntity?.id) {
                    return {
                        userRequest: prompt,
                        explanation: `Marking goal ID "${lastGoalEntity.id}" as completed based on conversational context.`,
                        type: "action",
                        toolCalls: [
                            { tool: "update_goal", arguments: { goalId: String(lastGoalEntity.id), completed: true } }
                        ],
                    };
                }
                return {
                    userRequest: prompt,
                    explanation: "Clarification requested for unresolved goal reference.",
                    type: "answer",
                    answerText: "Which goal do you mean? Please specify the goal title or ID.",
                    toolCalls: [],
                };
            }
            // Task resolution
            const isPronounRef = lower.includes("it") || lower.includes("that task") || lower.includes("this task") || lower.includes("the one i just created");
            let targetTaskId = "";
            if (isPronounRef && lastTaskEntity?.id) {
                targetTaskId = String(lastTaskEntity.id);
            }
            if (!targetTaskId) {
                const idMatch = prompt.match(/task\s+([a-zA-Z0-9_-]+)/i);
                if (idMatch && idMatch[1] && !["my", "the", "a", "as", "that", "this"].includes(idMatch[1].toLowerCase())) {
                    targetTaskId = idMatch[1];
                }
            }
            if (!targetTaskId && context && Array.isArray(context.tasks)) {
                const matchKeyword = lower.includes("ml") ? "ml" : lower.includes("leetcode") ? "leetcode" : "";
                if (matchKeyword) {
                    const found = context.tasks.find((t) => t.text?.toLowerCase().includes(matchKeyword));
                    if (found)
                        targetTaskId = String(found.id);
                }
                else if (!isPronounRef && context.tasks.length > 0) {
                    const firstPending = context.tasks.find((t) => !t.completed);
                    if (firstPending)
                        targetTaskId = String(firstPending.id);
                }
            }
            if (!targetTaskId && isPronounRef) {
                return {
                    userRequest: prompt,
                    explanation: "Clarification requested for unresolved task reference.",
                    type: "answer",
                    answerText: "Which task do you mean? Please specify the task name or ID.",
                    toolCalls: [],
                };
            }
            if (!targetTaskId) {
                targetTaskId = "1";
            }
            return {
                userRequest: prompt,
                explanation: `Marking task ID "${targetTaskId}" as completed.`,
                type: "action",
                toolCalls: [
                    { tool: "complete_task", arguments: { taskId: targetTaskId } }
                ],
            };
        }
        // Phase 4.12: Goal & Project Actions
        if (lower.includes("goal") && (lower.startsWith("create") || lower.startsWith("add") || lower.includes("new goal"))) {
            let title = "New Goal";
            let target = 10;
            const targetMatch = prompt.match(/(\d+)/);
            if (targetMatch) {
                target = parseInt(targetMatch[1], 10);
            }
            const goalToMatch = prompt.match(/(?:goal to|goal called|goal:)\s+(.+)/i);
            if (goalToMatch && goalToMatch[1]) {
                title = goalToMatch[1].replace(/[.!]+$/, "").trim();
            }
            else {
                title = prompt.replace(/^(?:create|add)(?:\s+a)?(?:\s+new)?\s+goal(?:\s+to)?/i, "").replace(/[.!]+$/, "").trim() || "New Goal";
            }
            return {
                userRequest: prompt,
                explanation: `Creating new goal "${title}" with target ${target}.`,
                type: "action",
                toolCalls: [
                    { tool: "create_goal", arguments: { title, target, type: "Weekly" } }
                ],
            };
        }
        if (lower.includes("goal") && (lower.includes("complet") || lower.includes("update") || lower.includes("progress"))) {
            let targetGoalId = "1";
            const idMatch = prompt.match(/goal\s+(?:id\s+|#)?([a-zA-Z0-9_-]+)/i);
            const nonIdWords = ["my", "the", "a", "as", "progress", "status", "target", "to", "called", "named", "for"];
            if (idMatch && idMatch[1] && !nonIdWords.includes(idMatch[1].toLowerCase())) {
                targetGoalId = idMatch[1];
            }
            else if (context && Array.isArray(context.goals) && context.goals.length > 0) {
                const searchKeywords = lower.includes("interview")
                    ? ["interview"]
                    : lower.includes("leetcode")
                        ? ["leetcode"]
                        : lower.includes("design")
                            ? ["design", "system design"]
                            : [];
                if (searchKeywords.length > 0) {
                    const found = context.goals.find((g) => {
                        const str = `${g.title || ""} ${g.type || ""}`.toLowerCase();
                        return searchKeywords.some((kw) => str.includes(kw));
                    });
                    if (found) {
                        targetGoalId = String(found.id);
                    }
                    else {
                        targetGoalId = String(context.goals[0].id);
                    }
                }
                else {
                    targetGoalId = String(context.goals[0].id);
                }
            }
            const isCompletion = lower.includes("complet");
            const progressMatch = prompt.match(/(\d+)/);
            const current = !isCompletion && progressMatch ? parseInt(progressMatch[1], 10) : undefined;
            const updateArgs = { goalId: targetGoalId };
            if (isCompletion) {
                updateArgs.completed = true;
            }
            if (current !== undefined) {
                updateArgs.current = current;
            }
            return {
                userRequest: prompt,
                explanation: `Updating goal ID "${targetGoalId}".`,
                type: "action",
                toolCalls: [
                    { tool: "update_goal", arguments: updateArgs }
                ],
            };
        }
        if (lower.includes("project") && (lower.includes("update") || lower.includes("progress") || lower.includes("status"))) {
            let targetProjectId = "1";
            const idMatch = prompt.match(/project\s+(?:id\s+|#)?([a-zA-Z0-9_-]+)/i);
            const nonIdWords = ["my", "the", "a", "as", "progress", "status", "to", "called", "named", "for"];
            if (idMatch && idMatch[1] && !nonIdWords.includes(idMatch[1].toLowerCase())) {
                targetProjectId = idMatch[1];
            }
            else if (context && Array.isArray(context.projects) && context.projects.length > 0) {
                const searchKeywords = lower.includes("ml")
                    ? ["ml", "machine learning"]
                    : lower.includes("power bi")
                        ? ["power bi"]
                        : lower.includes("alfred")
                            ? ["alfred"]
                            : lower.includes("hackathon")
                                ? ["hackathon"]
                                : [];
                if (searchKeywords.length > 0) {
                    const found = context.projects.find((p) => {
                        const str = `${p.name || ""} ${p.description || ""} ${p.category || ""}`.toLowerCase();
                        return searchKeywords.some((kw) => str.includes(kw));
                    });
                    if (found) {
                        targetProjectId = String(found.id);
                    }
                    else {
                        targetProjectId = String(context.projects[0].id);
                    }
                }
                else {
                    targetProjectId = String(context.projects[0].id);
                }
            }
            const progressMatch = prompt.match(/(\d+)\s*%/);
            const progress = progressMatch ? parseInt(progressMatch[1], 10) : undefined;
            const updateArgs = { projectId: targetProjectId };
            if (progress !== undefined) {
                updateArgs.progress = progress;
            }
            if (lower.includes("completed")) {
                updateArgs.status = "Completed";
            }
            return {
                userRequest: prompt,
                explanation: `Updating project ID "${targetProjectId}".`,
                type: "action",
                toolCalls: [
                    { tool: "update_project", arguments: updateArgs }
                ],
            };
        }
        // Multi-step workspace requests (e.g. "Start my DSA workspace and then open Chrome")
        if ((lower.includes("start") || lower.includes("launch") || lower.includes("prepare") || lower.includes("open")) &&
            (lower.includes("workspace") || lower.includes("mode") || lower.includes("environment")) &&
            lower.includes("and") &&
            (lower.includes("open chrome") || lower.includes("launch chrome") || lower.includes("open vs code") || lower.includes("launch vs code"))) {
            let wsTarget = "DSA";
            if (lower.includes("dsa") || lower.includes("coding"))
                wsTarget = "DSA";
            else if (lower.includes("data science") || lower.includes("datascience"))
                wsTarget = "Data Science";
            else if (lower.includes("hackathon"))
                wsTarget = "Hackathon";
            else if (lower.includes("machine learning") || lower.includes("ml"))
                wsTarget = "Machine Learning";
            const nextApp = (lower.includes("chrome")) ? "Chrome" : "VS Code";
            return {
                userRequest: prompt,
                explanation: `Launching ${wsTarget} workspace and opening ${nextApp}.`,
                type: "action",
                toolCalls: [
                    { tool: "launch_workspace", arguments: { workspaceName: wsTarget } },
                    { tool: "launch_application", arguments: { appName: nextApp } },
                ],
            };
        }
        // Conversational workspace follow-up: "Start the Machine Learning one" / "Start the DSA one" / "Launch the ML one"
        if ((cleanLower.match(/^(?:start|launch|open|prepare)\s+(?:the\s+)?(.+?)\s+(?:one|workspace)$/i) ||
            cleanLower.match(/^(?:start|launch|open|prepare)\s+(?:my\s+)?(.+?)\s+(?:workspace|mode|environment)$/i)) &&
            cleanLower !== "prepare my coding workspace") {
            const match = cleanLower.match(/^(?:start|launch|open|prepare)\s+(?:the\s+|my\s+)?(.+?)(?:\s+(?:one|workspace|mode|environment))?$/i);
            const candidate = match && match[1] ? match[1].trim().toLowerCase() : "";
            let targetWs = null;
            if (candidate === "dsa" || candidate === "coding" || candidate === "code") {
                targetWs = "DSA";
            }
            else if (candidate === "data science" || candidate === "datascience" || candidate === "data science mode" || candidate === "analytics") {
                targetWs = "Data Science";
            }
            else if (candidate === "hackathon" || candidate === "hack") {
                targetWs = "Hackathon";
            }
            else if (candidate === "machine learning" || candidate === "ml" || candidate === "machinelearning") {
                targetWs = "Machine Learning";
            }
            if (targetWs) {
                return {
                    userRequest: prompt,
                    explanation: `Launching ${targetWs} workspace based on request reference.`,
                    type: "action",
                    toolCalls: [
                        { tool: "launch_workspace", arguments: { workspaceName: targetWs } }
                    ],
                };
            }
        }
        if (cleanLower.includes("workspace for my ml project") ||
            cleanLower.includes("ml project workspace") ||
            cleanLower.includes("machine learning workspace") ||
            cleanLower === "start my machine learning workspace" ||
            cleanLower === "prepare my machine learning workspace" ||
            cleanLower === "launch my ml workspace" ||
            cleanLower === "start ml workspace") {
            let targetWorkspace = "Machine Learning";
            if (context && Array.isArray(context.workspaces)) {
                const mlWs = context.workspaces.find((w) => w.name?.toLowerCase().includes("machine learning") || w.type === "machinelearning");
                if (mlWs)
                    targetWorkspace = mlWs.name;
            }
            return {
                userRequest: prompt,
                explanation: `Launching workspace "${targetWorkspace}" based on context rationale.`,
                type: "action",
                toolCalls: [
                    { tool: "launch_workspace", arguments: { workspaceName: targetWorkspace } }
                ],
            };
        }
        if ((cleanLower.includes("dsa workspace") ||
            cleanLower.includes("coding workspace") ||
            cleanLower === "start my dsa workspace" ||
            cleanLower === "launch my dsa workspace" ||
            cleanLower === "open my dsa workspace") &&
            cleanLower !== "prepare my coding workspace") {
            return {
                userRequest: prompt,
                explanation: "Launching DSA workspace session.",
                type: "action",
                toolCalls: [
                    { tool: "launch_workspace", arguments: { workspaceName: "DSA" } }
                ],
            };
        }
        if (lower.includes("data science workspace") ||
            lower.includes("data science mode") ||
            lower === "start data science mode" ||
            lower === "launch data science workspace") {
            return {
                userRequest: prompt,
                explanation: "Launching Data Science workspace session.",
                type: "action",
                toolCalls: [
                    { tool: "launch_workspace", arguments: { workspaceName: "Data Science" } }
                ],
            };
        }
        if (lower.includes("gradient descent")) {
            return {
                userRequest: prompt,
                explanation: "Informational answer regarding gradient descent.",
                type: "answer",
                answerText: "Gradient descent is a first-order iterative optimization algorithm used to find a local minimum of a differentiable function.",
                toolCalls: [],
            };
        }
        if (lower.includes("cnn") || lower.includes("convolutional")) {
            return {
                userRequest: prompt,
                explanation: "Informational answer regarding CNN architecture.",
                type: "answer",
                answerText: "A Convolutional Neural Network (CNN) is a deep learning architecture specialized for processing structured grid data such as images.",
                toolCalls: [],
            };
        }
        if (lower.startsWith("what is") ||
            lower.startsWith("explain") ||
            lower.startsWith("how does") ||
            lower.startsWith("tell me about") ||
            lower.endsWith("?")) {
            return {
                userRequest: prompt,
                explanation: `Informational response provided for "${prompt}".`,
                type: "answer",
                answerText: `Mock AI Answer: Informational explanation regarding "${prompt}".`,
                toolCalls: [],
            };
        }
        // 1. MULTI-TOOL PLAN SCENARIOS
        if (lower.includes("prepare my coding workspace") || lower.includes("setup coding environment")) {
            return {
                userRequest: prompt,
                explanation: "Opening VS Code editor and Google Chrome for coding workflow.",
                toolCalls: [
                    { tool: "launch_application", arguments: { appName: "VS Code" } },
                    { tool: "launch_application", arguments: { appName: "Chrome" } },
                ],
            };
        }
        if (lower.includes("launch dev environment") || lower.includes("start dev stack")) {
            return {
                userRequest: prompt,
                explanation: "Opening VS Code and Windows Terminal.",
                toolCalls: [
                    { tool: "launch_application", arguments: { appName: "VS Code" } },
                    { tool: "launch_application", arguments: { appName: "Windows Terminal" } },
                ],
            };
        }
        if (lower.includes("check system health and show tasks") || lower.includes("status and missions")) {
            return {
                userRequest: prompt,
                explanation: "Checking system stats and listing active mission tasks.",
                toolCalls: [
                    { tool: "system_status", arguments: {} },
                    { tool: "show_tasks", arguments: { filter: "today" } },
                ],
            };
        }
        if (lower.includes("start coding session and focus")) {
            return {
                userRequest: prompt,
                explanation: "Launching VS Code and initiating Deep Work sequence.",
                toolCalls: [
                    { tool: "launch_application", arguments: { appName: "VS Code" } },
                    { tool: "start_deep_work", arguments: { sessionName: "dsa" } },
                ],
            };
        }
        // 2. SPECIAL TEST PLAN SCENARIOS (Security & Failure Testing)
        if (lower.includes("test unknown tool")) {
            return {
                userRequest: prompt,
                explanation: "Planning call to an unregistered tool.",
                toolCalls: [{ tool: "non_existent_tool", arguments: { foo: "bar" } }],
            };
        }
        if (lower.includes("test invalid args") || lower.includes("test calc")) {
            return {
                userRequest: prompt,
                explanation: "Planning call with unwhitelisted application argument.",
                toolCalls: [{ tool: "launch_application", arguments: { appName: "calc.exe" } }],
            };
        }
        if (lower.includes("test injection payload")) {
            return {
                userRequest: prompt,
                explanation: "Planning call with shell injection payload.",
                toolCalls: [
                    {
                        tool: "launch_application",
                        arguments: { appName: "VS Code; powershell -Command Start-Process calc" },
                    },
                ],
            };
        }
        if (lower.includes("test multi-tool partial failure")) {
            return {
                userRequest: prompt,
                explanation: "Planning plan containing one valid tool call and one invalid tool call.",
                toolCalls: [
                    { tool: "launch_application", arguments: { appName: "VS Code" } },
                    { tool: "launch_application", arguments: { appName: "unsupported_random_app" } },
                ],
            };
        }
        // 3. SINGLE-TOOL PLAN SCENARIOS
        if (lower.startsWith("open vs code") || lower.startsWith("launch vs code") || lower === "vscode") {
            return {
                userRequest: prompt,
                explanation: "Launching Visual Studio Code.",
                toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
            };
        }
        if (lower.startsWith("open chrome") || lower.startsWith("launch chrome")) {
            return {
                userRequest: prompt,
                explanation: "Launching Google Chrome browser.",
                toolCalls: [{ tool: "launch_application", arguments: { appName: "Chrome" } }],
            };
        }
        if (lower.startsWith("open spotify") || lower.startsWith("launch spotify")) {
            return {
                userRequest: prompt,
                explanation: "Launching Spotify player.",
                toolCalls: [{ tool: "launch_application", arguments: { appName: "Spotify" } }],
            };
        }
        if (lower.includes("open missions") || lower.includes("go to tasks")) {
            return {
                userRequest: prompt,
                explanation: "Navigating to Mission Control view.",
                toolCalls: [{ tool: "navigate", arguments: { route: "missions" } }],
            };
        }
        if (lower.includes("show my goals") || lower.includes("go to goals")) {
            return {
                userRequest: prompt,
                explanation: "Navigating to Tactical Goals view.",
                toolCalls: [{ tool: "navigate", arguments: { route: "goals" } }],
            };
        }
        if (lower.includes("go to projects") || lower.includes("open projects")) {
            return {
                userRequest: prompt,
                explanation: "Navigating to Projects view.",
                toolCalls: [{ tool: "navigate", arguments: { route: "projects" } }],
            };
        }
        if (lower.includes("system status") || lower.includes("system vitals")) {
            return {
                userRequest: prompt,
                explanation: "Querying system vitals.",
                toolCalls: [{ tool: "system_status", arguments: {} }],
            };
        }
        if (lower.includes("start deep work") || lower.includes("start focus mode")) {
            let sessionName = "dsa";
            if (context && Array.isArray(context.recentConversation) && context.recentConversation.length > 0) {
                const lastWorkspaceTurn = [...context.recentConversation].reverse().find(t => t.targetEntity?.type === "workspace");
                if (lastWorkspaceTurn?.targetEntity?.name) {
                    sessionName = lastWorkspaceTurn.targetEntity.name.toLowerCase().replace(/\s+/g, "-");
                }
            }
            return {
                userRequest: prompt,
                explanation: `Initiating Deep Work focus session (${sessionName}).`,
                toolCalls: [{ tool: "start_deep_work", arguments: { sessionName } }],
            };
        }
        if (lower.includes("hackathon workspace")) {
            return {
                userRequest: prompt,
                explanation: "Launching Hackathon workspace session.",
                toolCalls: [{ tool: "launch_workspace", arguments: { workspace: "Hackathon" } }],
            };
        }
        if (lower.includes("show today's tasks") || lower.includes("list my tasks")) {
            return {
                userRequest: prompt,
                explanation: "Listing today's pending mission tasks.",
                toolCalls: [{ tool: "show_tasks", arguments: { filter: "today" } }],
            };
        }
        if (lower.startsWith("open url ") || lower.startsWith("open website ")) {
            const rawUrl = prompt.replace(/^open (url|website)\s+/i, "").trim();
            return {
                userRequest: prompt,
                explanation: `Opening URL ${rawUrl}`,
                toolCalls: [{ tool: "open_url", arguments: { url: rawUrl } }],
            };
        }
        if (lower.startsWith("open path ") || lower.startsWith("open folder ")) {
            const rawPath = prompt.replace(/^open (path|folder)\s+/i, "").trim();
            return {
                userRequest: prompt,
                explanation: `Opening path ${rawPath}`,
                toolCalls: [{ tool: "open_path", arguments: { path: rawPath } }],
            };
        }
        // UNKNOWN / UNRECOGNIZED REQUEST
        return {
            userRequest: prompt,
            explanation: "No matching tool execution plan could be determined for request.",
            toolCalls: [],
        };
    }
}
exports.MockAgentPlanner = MockAgentPlanner;
exports.mockAgentPlanner = new MockAgentPlanner();
