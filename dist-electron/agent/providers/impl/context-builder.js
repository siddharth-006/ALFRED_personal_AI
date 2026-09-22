"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAlfredContext = buildAlfredContext;
/**
 * Builds a sanitized, read-only AI Context snapshot from raw ALFRED application state.
 *
 * @param state Raw application state container
 * @param options Sanitization and size limit options
 */
function buildAlfredContext(state, options = {}) {
    if (!state) {
        return {};
    }
    const maxTasks = options.maxTasksPerCategory || 10;
    const maxProjects = options.maxProjects || 10;
    const maxGoals = options.maxGoals || 10;
    const maxWorkspaces = options.maxWorkspaces || 10;
    const maxTurns = options.maxConversationTurns || 5;
    const snapshot = {};
    // 1. Tasks Context
    if (Array.isArray(state.tasks)) {
        snapshot.tasks = state.tasks.slice(0, maxTasks).map((t) => ({
            id: String(t.id || ""),
            text: String(t.text || "").trim(),
            completed: Boolean(t.completed),
            category: String(t.category || "General").trim(),
        }));
    }
    // 2. Projects Context
    if (Array.isArray(state.projects)) {
        snapshot.projects = state.projects.slice(0, maxProjects).map((p) => ({
            id: String(p.id || ""),
            name: String(p.name || "").trim(),
            description: String(p.description || "").trim(),
            category: String(p.category || "General").trim(),
            status: String(p.status || "Not Started").trim(),
            progress: typeof p.progress === "number" ? p.progress : 0,
        }));
    }
    // 3. Goals Context
    if (Array.isArray(state.goals)) {
        snapshot.goals = state.goals.slice(0, maxGoals).map((g) => ({
            id: String(g.id || ""),
            title: String(g.title || "").trim(),
            type: String(g.type || "Weekly").trim(),
            target: typeof g.target === "number" ? g.target : 0,
            current: typeof g.current === "number" ? g.current : 0,
            completed: Boolean(g.completed),
        }));
    }
    // 4. Workspaces Context
    if (Array.isArray(state.workspaces)) {
        snapshot.workspaces = state.workspaces.slice(0, maxWorkspaces).map((w) => ({
            id: String(w.id || ""),
            name: String(w.name || "").trim(),
            description: String(w.description || "").trim(),
            type: String(w.type || "custom").trim(),
            applications: Array.isArray(w.applications) ? w.applications.map(String) : [],
            websites: Array.isArray(w.websites) ? w.websites.map(String) : [],
        }));
    }
    // 5. Focus State
    if (state.currentFocus !== undefined) {
        snapshot.currentFocus = state.currentFocus ? String(state.currentFocus) : null;
    }
    // 6. Recent Conversation Context (Phase 4.13)
    if (Array.isArray(state.recentConversation)) {
        snapshot.recentConversation = state.recentConversation.slice(-maxTurns).map((turn) => ({
            userRequest: String(turn.userRequest || "").trim(),
            intent: String(turn.intent || ""),
            responseType: turn.responseType || "action",
            answerText: turn.answerText ? String(turn.answerText).trim() : undefined,
            toolsExecuted: Array.isArray(turn.toolsExecuted) ? turn.toolsExecuted.map(String) : [],
            targetEntity: turn.targetEntity
                ? {
                    type: String(turn.targetEntity.type || ""),
                    id: turn.targetEntity.id ? String(turn.targetEntity.id) : undefined,
                    name: turn.targetEntity.name ? String(turn.targetEntity.name) : undefined,
                }
                : undefined,
            summary: String(turn.summary || "").trim(),
        }));
    }
    return snapshot;
}
