import { AIProviderRequest } from "../types";

/**
 * Shared AI Planning Prompt Builder (Phase 3.3 - Step 4.9)
 *
 * Constructs a comprehensive system prompt for AI providers (Ollama, Gemini, Claude).
 * Explicitly describes ALFRED's tool catalog, expected JSON schema for ANSWER vs ACTION,
 * tool argument rules, ordering semantics for multi-step requests, and security constraints.
 *
 * PROVIDER-AGNOSTIC: Reused across all AI provider implementations.
 */

/** Detailed specifications of all whitelisted ALFRED tools */
export const ALFRED_TOOL_CATALOG = [
    {
        name: "launch_application",
        description: "Launch a whitelisted desktop application (e.g. VS Code, Chrome, Spotify, Discord, Windows Terminal, Power BI)",
        args: { appName: "string (e.g. 'VS Code', 'Chrome', 'Spotify', 'Discord', 'Terminal')" },
    },
    {
        name: "navigate",
        description: "Navigate to an ALFRED application view",
        args: { target: "string (one of: 'missions', 'tasks', 'goals', 'projects', 'workspaces', 'dashboard', 'home')" },
    },
    {
        name: "system_status",
        description: "Retrieve system status, health, and battery telemetry",
        args: {},
    },
    {
        name: "start_deep_work",
        description: "Initiate a focus/deep work session",
        args: { durationMinutes: "optional number", topic: "optional string" },
    },
    {
        name: "launch_workspace",
        description: "Launch all applications associated with a specific workspace",
        args: { workspaceName: "string (e.g. 'Coding', 'Research')" },
    },
    {
        name: "show_tasks",
        description: "Display and query active tasks",
        args: { filter: "optional string" },
    },
    {
        name: "open_url",
        description: "Open a website URL in default browser (http:// or https:// only)",
        args: { url: "string (must start with http:// or https://)" },
    },
    {
        name: "open_path",
        description: "Open a safe file path or folder",
        args: { path: "string (valid system file/folder path)" },
    },
    {
        name: "create_task",
        description: "Create a new task in ALFRED Mission Control",
        args: { text: "string (task description)", category: "optional string (e.g. 'DSA', 'Personal', 'Data Science')" },
    },
    {
        name: "complete_task",
        description: "Mark an existing ALFRED task as completed using its exact task ID",
        args: { taskId: "string (exact ID of existing task from context)" },
    },
    {
        name: "create_goal",
        description: "Create a new goal in ALFRED Mission Control",
        args: {
            title: "string (goal title/target description)",
            type: "optional string ('Weekly' or 'Monthly')",
            target: "optional number (target count, e.g. 10, 100)",
        },
    },
    {
        name: "update_goal",
        description: "Update an existing ALFRED goal using its exact goal ID",
        args: {
            goalId: "string (exact ID of existing goal from context)",
            current: "optional number (current progress count)",
            target: "optional number (target count)",
            completed: "optional boolean (true to complete)",
            title: "optional string (new title)",
        },
    },
    {
        name: "update_project",
        description: "Update an existing ALFRED project using its exact project ID",
        args: {
            projectId: "string (exact ID of existing project from context)",
            progress: "optional number (0 to 100)",
            status: "optional string ('Not Started', 'In Progress', 'Completed')",
            name: "optional string (new project name)",
        },
    },
];

/**
 * Builds the structured system prompt for AI Provider plan / answer generation.
 */
export function buildAgentSystemPrompt(request: AIProviderRequest): string {
    const catalogFormatted = ALFRED_TOOL_CATALOG.map(
        (t) => `  - ${t.name}: ${t.description}\n    Arguments: ${JSON.stringify(t.args)}`
    ).join("\n\n");

    let contextFormatted = "";
    if (request.context && Object.keys(request.context).length > 0) {
        contextFormatted = `\n\nALFRED Application Context (READ-ONLY Snapshot):\n${JSON.stringify(request.context, null, 2)}\nUse this context when answering questions or planning actions.`;
    }

    return `You are ALFRED, an intelligent desktop AI assistant that processes user requests as either an INFORMATIONAL ANSWER or an EXECUTABLE ACTION.

Available Tools for Action Requests:
${catalogFormatted}${contextFormatted}

RESPONSE MODES:
1. INFORMATIONAL QUESTIONS (type: "answer"):
   - If the user asks a question, requests an explanation, or seeks information (e.g., "What is gradient descent?", "Explain CNN", "What should I work on now?"):
   - Return JSON with type "answer":
     {
       "type": "answer",
       "answerText": "<clear, factual, single-or-multi paragraph response>",
       "toolCalls": [],
       "explanation": "Informational answer provided."
     }
   - NEVER turn an informational question into a tool call.
   - NEVER include executable commands or shell scripts in an answer.

2. EXECUTABLE ACTIONS (type: "action"):
   - If the user requests ALFRED to perform an action (e.g., "Open VS Code", "Start deep work", "Show my tasks"):
   - Return JSON with type "action":
     {
       "type": "action",
       "toolCalls": [
         { "tool": "<exact_tool_name>", "arguments": { "<arg_key>": <arg_value> } }
       ],
       "explanation": "<brief rationale>"
     }
   - Use ONLY tool names listed in the Available Tools catalog above.
   - Do NOT invent new tool names. Do NOT generate shell commands.

CRITICAL RULES & CONSTRAINTS:
1. Output Format: You MUST respond ONLY with a single valid JSON object matching one of the two formats above. No prose outside JSON.
2. Ordered Multi-Step Actions: ALFRED supports ordered multi-step action plans containing multiple sequential tool calls in 'toolCalls'.
   - Only create multiple steps when the user request genuinely requires multiple actions (e.g. "Create a task to study CNNs and open my ML workspace" -> two tool calls).
   - Do NOT force multi-step plans for simple commands (e.g. "Open VS Code" -> exactly one tool call).
   - Tools execute sequentially in the exact order listed.
   - Step Dependencies: A step may optionally include 'dependsOn': [stepIndexes] specifying earlier 0-indexed steps it depends on (e.g. step 2 depends on step 0 and 1 -> dependsOn: [0, 1]). Dependencies must refer ONLY to earlier steps. Never depend on yourself or future steps.
   - Maximum allowed plan size is 5 tool calls (MAX_AGENT_PLAN_STEPS = 5). NEVER exceed 5 tool calls per plan.
3. Execution Boundary: You are a REASONER/PLANNER only. Planning and execution are strictly separate.
4. Conversational Entity Resolution: When the user refers to "it", "that task", "that goal", "that project", "that workspace", or "the one I just created", resolve the entity ID or name from Recent Conversation Context. If a reference cannot be confidently resolved, DO NOT invent an ID or execute arbitrarily; return an informational answer (type: "answer") asking for clarification.

User Request: "${request.userRequest}"`;
}
