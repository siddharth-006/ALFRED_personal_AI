"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceService = exports.WorkspaceService = void 0;
const app_resolver_tool_1 = require("../tools/app-resolver.tool");
const app_executor_tool_1 = require("../tools/app-executor.tool");
const system_service_1 = require("./system.service");
const logger_1 = require("../utils/logger");
/** Initial Canonical Workspaces matching ALFRED UI / WorkspaceContext */
const DEFAULT_INITIAL_WORKSPACES = [
    {
        id: "ws_dsa",
        name: "DSA",
        description: "Daily DSA and problem-solving setup.",
        type: "dsa",
        applications: ["VS Code"],
        websites: [
            "https://leetcode.com",
            "https://www.geeksforgeeks.org",
            "https://chatgpt.com",
            "https://grindgram.in/career-tracks/curious-coding-sheet",
            "https://codolio.com/question-tracker/sheet/strivers-a2z-dsa-sheet?category=popular",
        ],
        localFolders: [],
        createdDate: new Date().toISOString().split("T")[0],
        launchCount: 0,
        lastLaunched: null,
    },
    {
        id: "ws_datascience",
        name: "Data Science",
        description: "Analytics and dashboard building environment.",
        type: "datascience",
        applications: ["VS Code", "Power BI"],
        websites: ["https://www.kaggle.com", "https://chatgpt.com"],
        localFolders: [],
        createdDate: new Date().toISOString().split("T")[0],
        launchCount: 0,
        lastLaunched: null,
    },
    {
        id: "ws_hackathon",
        name: "Hackathon",
        description: "Hackathon development environment.",
        type: "hackathon",
        applications: ["VS Code"],
        websites: ["https://github.com", "https://chatgpt.com", "https://www.figma.com"],
        localFolders: [],
        createdDate: new Date().toISOString().split("T")[0],
        launchCount: 0,
        lastLaunched: null,
    },
    {
        id: "ws_ml",
        name: "Machine Learning",
        description: "Machine Learning Specialization and course study environment.",
        type: "machinelearning",
        applications: ["VS Code"],
        websites: ["https://www.coursera.org"],
        localFolders: ["D:\\Studies\\Machine Learning\\Coursera - Machine Learning Specialization"],
        createdDate: new Date().toISOString().split("T")[0],
        launchCount: 0,
        lastLaunched: null,
    },
];
/**
 * Known natural aliases for canonical workspace concepts.
 * Canonical aliases map to exact workspace names or types.
 */
const CANONICAL_WORKSPACE_ALIASES = {
    "coding": "DSA",
    "dsa": "DSA",
    "code": "DSA",
    "problem solving": "DSA",
    "data science": "Data Science",
    "datascience": "Data Science",
    "data-science": "Data Science",
    "ds": "Data Science",
    "analytics": "Data Science",
    "data science mode": "Data Science",
    "hackathon": "Hackathon",
    "hack": "Hackathon",
    "machine learning": "Machine Learning",
    "machinelearning": "Machine Learning",
    "machine-learning": "Machine Learning",
    "ml": "Machine Learning",
};
/** Shell metacharacters regex for path validation */
const SHELL_METACHARACTERS_REGEX = /[;&|`$()<>{}\n\r]/;
class WorkspaceService {
    workspaces = [];
    constructor(initialWorkspaces) {
        this.workspaces = initialWorkspaces
            ? initialWorkspaces.map((w) => ({ ...w }))
            : DEFAULT_INITIAL_WORKSPACES.map((w) => ({ ...w }));
    }
    /**
     * Returns read-only copy of all known workspaces.
     */
    getWorkspaces() {
        return this.workspaces.map((w) => ({
            ...w,
            applications: [...(w.applications || [])],
            websites: [...(w.websites || [])],
            localFolders: [...(w.localFolders || [])],
        }));
    }
    /**
     * Synchronizes workspaces from renderer storage or settings.
     */
    syncWorkspaces(workspaces) {
        if (Array.isArray(workspaces)) {
            this.workspaces = workspaces.map((w) => ({
                id: String(w.id || ""),
                name: String(w.name || "").trim(),
                description: String(w.description || "").trim(),
                type: w.type || "custom",
                applications: Array.isArray(w.applications) ? w.applications.map(String) : [],
                websites: Array.isArray(w.websites) ? w.websites.map(String) : [],
                localFolders: Array.isArray(w.localFolders) ? w.localFolders.map(String) : [],
                createdDate: w.createdDate,
                launchCount: typeof w.launchCount === "number" ? w.launchCount : 0,
                lastLaunched: w.lastLaunched || null,
            }));
            logger_1.logger.info(`WorkspaceService: Synced ${this.workspaces.length} workspace(s).`);
        }
    }
    /**
     * Resets workspaces to initial defaults (useful for testing).
     */
    reset(workspaces) {
        this.workspaces = workspaces
            ? workspaces.map((w) => ({ ...w }))
            : DEFAULT_INITIAL_WORKSPACES.map((w) => ({ ...w }));
    }
    getWorkspaceStatus() {
        return {
            active: true,
            workspaceName: "ALFRED Primary Workspace",
        };
    }
    /**
     * Resolves a workspace by query string (name, ID, or alias).
     * Distinguishes exact matches, alias matches, ambiguous matches, and unknown queries.
     * Prevents arbitrary fuzzy matching that could execute the wrong workspace.
     */
    resolveWorkspace(query) {
        if (typeof query !== "string" || !query.trim()) {
            return {
                found: false,
                error: "Workspace query cannot be empty.",
            };
        }
        // Clean user input
        let cleaned = query.trim().replace(/^["']|["']$/g, "").trim();
        // Remove trailing workspace/mode/environment keywords for natural matching
        cleaned = cleaned
            .replace(/^(?:start|prepare|launch|open|switch to)\s+(?:my\s+|the\s+)?/i, "")
            .replace(/\s+(?:workspace|mode|environment|setup|session)$/i, "")
            .trim();
        if (!cleaned) {
            cleaned = query.trim();
        }
        const lowerCleaned = cleaned.toLowerCase();
        // 1. Direct ID match
        const exactIdMatch = this.workspaces.find((w) => w.id.toLowerCase() === lowerCleaned);
        if (exactIdMatch) {
            return { found: true, workspace: exactIdMatch };
        }
        // 2. Direct exact Name match (case-insensitive)
        const exactNameMatches = this.workspaces.filter((w) => w.name.toLowerCase() === lowerCleaned);
        if (exactNameMatches.length === 1) {
            return { found: true, workspace: exactNameMatches[0] };
        }
        // 3. Direct Type match
        const exactTypeMatches = this.workspaces.filter((w) => String(w.type).toLowerCase() === lowerCleaned);
        if (exactTypeMatches.length === 1) {
            return { found: true, workspace: exactTypeMatches[0] };
        }
        // 4. Known Alias match
        const canonicalTargetName = CANONICAL_WORKSPACE_ALIASES[lowerCleaned];
        if (canonicalTargetName) {
            const aliasMatches = this.workspaces.filter((w) => w.name.toLowerCase() === canonicalTargetName.toLowerCase() ||
                w.type.toLowerCase() === canonicalTargetName.toLowerCase());
            if (aliasMatches.length === 1) {
                return { found: true, workspace: aliasMatches[0] };
            }
            if (aliasMatches.length > 1) {
                return {
                    found: false,
                    ambiguous: true,
                    candidates: aliasMatches,
                    error: `I found multiple matching workspaces for '${query}'. Which one would you like me to launch?`,
                };
            }
        }
        // 5. Strict Substring / Word Match (only if distinct, else ambiguous)
        const substringMatches = this.workspaces.filter((w) => {
            const wName = w.name.toLowerCase();
            const wType = String(w.type).toLowerCase();
            return (wName.includes(lowerCleaned) ||
                lowerCleaned.includes(wName) ||
                wType.includes(lowerCleaned));
        });
        if (substringMatches.length === 1) {
            return { found: true, workspace: substringMatches[0] };
        }
        if (substringMatches.length > 1) {
            return {
                found: false,
                ambiguous: true,
                candidates: substringMatches,
                error: `I found multiple matching workspaces (${substringMatches.map((w) => w.name).join(", ")}). Which one would you like me to launch?`,
            };
        }
        // 6. Not found
        return {
            found: false,
            error: `Workspace '${query}' was not found.`,
        };
    }
    /**
     * Launches a workspace's configured resources:
     * - Applications: via Phase 5.1 appResolverTool + appExecutorTool.execute (NO shell fallback)
     * - Websites: via systemService.openExternalUrl (http/https validated)
     * - Local Folders: via systemService.openPath (shell metacharacters blocked)
     */
    async launchWorkspace(payload, options = {}) {
        let targetWorkspace;
        let workspaceName = "Unknown Workspace";
        let workspaceId = "unknown";
        if (typeof payload === "string") {
            const resolution = this.resolveWorkspace(payload);
            if (!resolution.found || !resolution.workspace) {
                logger_1.logger.warn(`WorkspaceService: Launch rejected -> ${resolution.error}`);
                return {
                    success: false,
                    workspaceId: payload,
                    results: [],
                    error: resolution.error || `Workspace '${payload}' not found.`,
                };
            }
            targetWorkspace = resolution.workspace;
            workspaceId = targetWorkspace.id;
            workspaceName = targetWorkspace.name || targetWorkspace.id;
        }
        else {
            workspaceId = payload.id || "unknown";
            workspaceName = payload.name || payload.id || "Custom Workspace";
            targetWorkspace = payload;
        }
        logger_1.logger.info(`WorkspaceService: Launching workspace '${workspaceName}' (ID: ${workspaceId})`);
        const results = [];
        // 1. Applications: Secure resolution -> AppExecutorTool (shell: false, Phase 5.1 native)
        if (Array.isArray(targetWorkspace.applications)) {
            for (const appName of targetWorkspace.applications) {
                const resolution = app_resolver_tool_1.appResolverTool.resolveApplication(appName);
                if (!resolution.success) {
                    logger_1.logger.warn(`WorkspaceService: Application resolution rejected for '${appName}': ${resolution.error}`);
                    results.push({
                        success: false,
                        type: "application",
                        target: appName,
                        error: resolution.error || "Unsupported application.",
                    });
                    continue;
                }
                const approvedExecutable = resolution.executable;
                logger_1.logger.info(`WorkspaceService: Executing whitelisted application '${approvedExecutable}' for '${appName}'`);
                try {
                    const execResult = await app_executor_tool_1.appExecutorTool.execute(approvedExecutable, options);
                    if (execResult.success) {
                        results.push({
                            success: true,
                            type: "application",
                            target: appName,
                            executable: approvedExecutable,
                        });
                    }
                    else {
                        logger_1.logger.error(`WorkspaceService: Failed executing app '${appName}' (${approvedExecutable}): ${execResult.error}`);
                        results.push({
                            success: false,
                            type: "application",
                            target: appName,
                            executable: approvedExecutable,
                            error: execResult.error || "Failed to execute application command.",
                        });
                    }
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Execution error";
                    logger_1.logger.error(`WorkspaceService: Exception executing app '${appName}': ${errorMessage}`);
                    results.push({
                        success: false,
                        type: "application",
                        target: appName,
                        executable: approvedExecutable,
                        error: errorMessage,
                    });
                }
            }
        }
        // 2. Local Folders: systemService.openPath (with security validation)
        if (Array.isArray(targetWorkspace.localFolders)) {
            for (const folderPath of targetWorkspace.localFolders) {
                logger_1.logger.info(`WorkspaceService: Opening local folder: ${folderPath}`);
                // Security check: Reject shell metacharacters in configured paths
                if (SHELL_METACHARACTERS_REGEX.test(folderPath)) {
                    logger_1.logger.warn(`WorkspaceService: Folder path contains dangerous characters: ${folderPath}`);
                    results.push({
                        success: false,
                        type: "folder",
                        target: folderPath,
                        error: "Folder path contains invalid or unsafe characters.",
                    });
                    continue;
                }
                try {
                    const openErr = await system_service_1.systemService.openPath(folderPath);
                    if (openErr) {
                        logger_1.logger.error(`WorkspaceService: Error opening path '${folderPath}': ${openErr}`);
                        results.push({
                            success: false,
                            type: "folder",
                            target: folderPath,
                            error: "Unable to open folder path.",
                        });
                    }
                    else {
                        results.push({
                            success: true,
                            type: "folder",
                            target: folderPath,
                        });
                    }
                }
                catch (err) {
                    logger_1.logger.error(`WorkspaceService: Exception opening folder '${folderPath}'`);
                    results.push({
                        success: false,
                        type: "folder",
                        target: folderPath,
                        error: "Unable to open folder path.",
                    });
                }
            }
        }
        // 3. Websites: systemService.openExternalUrl (http/https validation)
        if (Array.isArray(targetWorkspace.websites)) {
            for (const url of targetWorkspace.websites) {
                logger_1.logger.info(`WorkspaceService: Opening website URL: ${url}`);
                const lowerUrl = url.trim().toLowerCase();
                if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
                    results.push({
                        success: false,
                        type: "url",
                        target: url,
                        error: "Invalid URL protocol. Only http:// and https:// URLs are supported.",
                    });
                    continue;
                }
                try {
                    await system_service_1.systemService.openExternalUrl(url);
                    results.push({
                        success: true,
                        type: "url",
                        target: url,
                    });
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "URL open error";
                    logger_1.logger.error(`WorkspaceService: Exception opening URL '${url}': ${errorMessage}`);
                    results.push({
                        success: false,
                        type: "url",
                        target: url,
                        error: errorMessage,
                    });
                }
            }
        }
        // Update launch statistics if managed workspace
        const managedIndex = this.workspaces.findIndex((w) => w.id === workspaceId);
        if (managedIndex !== -1) {
            this.workspaces[managedIndex].launchCount =
                (this.workspaces[managedIndex].launchCount || 0) + 1;
            this.workspaces[managedIndex].lastLaunched = new Date().toISOString();
        }
        const overallSuccess = results.length === 0 || results.every((r) => r.success);
        // Build concise execution summary
        const summaryLines = [`Starting your ${workspaceName} workspace.`];
        for (const item of results) {
            if (item.success) {
                summaryLines.push(`✓ ${item.target}`);
            }
            else {
                summaryLines.push(`✗ ${item.target} (${item.error || "failed"})`);
            }
        }
        if (overallSuccess) {
            summaryLines.push(`${workspaceName} workspace is ready.`);
        }
        else {
            summaryLines.push(`${workspaceName} workspace ready with warnings.`);
        }
        const summary = summaryLines.join("\n");
        return {
            success: overallSuccess,
            workspaceId,
            workspaceName,
            summary,
            results,
            error: overallSuccess ? undefined : "One or more workspace items failed to launch.",
        };
    }
}
exports.WorkspaceService = WorkspaceService;
exports.workspaceService = new WorkspaceService();
