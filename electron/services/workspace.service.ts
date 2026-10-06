import { appResolverTool } from "../tools/app-resolver.tool";
import { appExecutorTool, AppExecutionOptions, AppExecutionResult } from "../tools/app-executor.tool";
import { systemService } from "./system.service";
import { logger } from "../utils/logger";
import { eventBus } from "../events/event-bus";

export interface WorkspaceStatus {
    active: boolean;
    workspaceName: string;
}

export type WorkspaceType = "dsa" | "datascience" | "hackathon" | "machinelearning" | "college" | "personal" | "custom";

export interface Workspace {
    id: string;
    name: string;
    description: string;
    type: WorkspaceType | string;
    applications: string[];
    websites: string[];
    localFolders: string[];
    createdDate?: string;
    launchCount?: number;
    lastLaunched?: string | null;
}

export interface WorkspaceLaunchPayload {
    id: string;
    name?: string;
    applications?: string[];
    websites?: string[];
    localFolders?: string[];
}

export interface WorkspaceItemLaunchResult {
    success: boolean;
    type: "application" | "folder" | "url";
    target: string;
    executable?: string;
    error?: string;
}

export interface WorkspaceLaunchResult {
    success: boolean;
    workspaceId: string;
    workspaceName?: string;
    summary?: string;
    results: WorkspaceItemLaunchResult[];
    error?: string;
}

export interface WorkspaceResolutionResult {
    found: boolean;
    workspace?: Workspace;
    ambiguous?: boolean;
    candidates?: Workspace[];
    error?: string;
}

/** Initial Canonical Workspaces matching ALFRED UI / WorkspaceContext */
const DEFAULT_INITIAL_WORKSPACES: Workspace[] = [
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
const CANONICAL_WORKSPACE_ALIASES: Record<string, string> = {
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
const SHELL_METACHARACTERS_REGEX = /[;&|`$<>{}\n\r]/;

import fs from "fs";
import path from "path";
import { getUserDataDirectory } from "../utils/paths";
import { approvedAppsService } from "./approved-apps.service";

export class WorkspaceService {
    private workspaces: Workspace[] = [];
    private storagePath: string;

    constructor(initialWorkspaces?: Workspace[], customStoragePath?: string) {
        this.storagePath = customStoragePath || path.join(getUserDataDirectory(), "alfred_workspaces.json");
        if (initialWorkspaces) {
            this.workspaces = initialWorkspaces.map((w) => ({ ...w }));
        } else {
            this.loadWorkspaces();
        }
    }

    private loadWorkspaces(): void {
        try {
            if (fs.existsSync(this.storagePath)) {
                const data = fs.readFileSync(this.storagePath, "utf8");
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.workspaces = parsed.map((w) => ({
                        id: String(w.id || ""),
                        name: String(w.name || "").trim(),
                        description: String(w.description || "").trim(),
                        type: (w.type as WorkspaceType) || "custom",
                        applications: Array.isArray(w.applications) ? w.applications.map(String) : [],
                        websites: Array.isArray(w.websites) ? w.websites.map(String) : [],
                        localFolders: Array.isArray(w.localFolders) ? w.localFolders.map(String) : [],
                        createdDate: w.createdDate,
                        launchCount: typeof w.launchCount === "number" ? w.launchCount : 0,
                        lastLaunched: w.lastLaunched || null,
                    }));
                    logger.info(`WorkspaceService: Loaded ${this.workspaces.length} workspace(s) from disk.`);
                    return;
                }
            }
        } catch (err: any) {
            logger.warn(`WorkspaceService: Error loading stored workspaces: ${err?.message}. Using defaults.`);
        }

        this.workspaces = DEFAULT_INITIAL_WORKSPACES.map((w) => ({ ...w }));
        this.saveWorkspaces();
    }

    private saveWorkspaces(): void {
        try {
            const dir = path.dirname(this.storagePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.storagePath, JSON.stringify(this.workspaces, null, 2), "utf8");
        } catch (err: any) {
            logger.error(`WorkspaceService: Failed to save workspaces: ${err?.message}`);
        }
    }

    /**
     * Returns read-only copy of all known workspaces.
     */
    public getWorkspaces(): Workspace[] {
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
    public syncWorkspaces(workspaces: Workspace[]): void {
        if (Array.isArray(workspaces)) {
            this.workspaces = workspaces.map((w) => ({
                id: String(w.id || ""),
                name: String(w.name || "").trim(),
                description: String(w.description || "").trim(),
                type: (w.type as WorkspaceType) || "custom",
                applications: Array.isArray(w.applications) ? w.applications.map(String) : [],
                websites: Array.isArray(w.websites) ? w.websites.map(String) : [],
                localFolders: Array.isArray(w.localFolders) ? w.localFolders.map(String) : [],
                createdDate: w.createdDate,
                launchCount: typeof w.launchCount === "number" ? w.launchCount : 0,
                lastLaunched: w.lastLaunched || null,
            }));
            this.saveWorkspaces();
            logger.info(`WorkspaceService: Synced and saved ${this.workspaces.length} workspace(s).`);
        }
    }

    /**
     * Resets workspaces to initial defaults (useful for testing).
     */
    public reset(workspaces?: Workspace[]): void {
        this.workspaces = workspaces
            ? workspaces.map((w) => ({ ...w }))
            : DEFAULT_INITIAL_WORKSPACES.map((w) => ({ ...w }));
    }

    public getWorkspaceStatus(): WorkspaceStatus {
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
    public resolveWorkspace(query: string): WorkspaceResolutionResult {
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
        const exactNameMatches = this.workspaces.filter(
            (w) => w.name.toLowerCase() === lowerCleaned
        );
        if (exactNameMatches.length === 1) {
            return { found: true, workspace: exactNameMatches[0] };
        }

        // 3. Direct Type match
        const exactTypeMatches = this.workspaces.filter(
            (w) => String(w.type).toLowerCase() === lowerCleaned
        );
        if (exactTypeMatches.length === 1) {
            return { found: true, workspace: exactTypeMatches[0] };
        }

        // 4. Known Alias match
        const canonicalTargetName = CANONICAL_WORKSPACE_ALIASES[lowerCleaned];
        if (canonicalTargetName) {
            const aliasMatches = this.workspaces.filter(
                (w) =>
                    w.name.toLowerCase() === canonicalTargetName.toLowerCase() ||
                    w.type.toLowerCase() === canonicalTargetName.toLowerCase()
            );
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
            return (
                wName.includes(lowerCleaned) ||
                lowerCleaned.includes(wName) ||
                wType.includes(lowerCleaned)
            );
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
    public async launchWorkspace(
        payload: string | WorkspaceLaunchPayload,
        options: AppExecutionOptions = {}
    ): Promise<WorkspaceLaunchResult> {
        let targetWorkspace: Workspace | WorkspaceLaunchPayload | undefined;
        let workspaceName: string = "Unknown Workspace";
        let workspaceId: string = "unknown";

        if (typeof payload === "string") {
            const resolution = this.resolveWorkspace(payload);
            if (!resolution.found || !resolution.workspace) {
                logger.warn(`WorkspaceService: Launch rejected -> ${resolution.error}`);
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
        } else {
            workspaceId = payload.id || "unknown";
            workspaceName = payload.name || payload.id || "Custom Workspace";
            targetWorkspace = payload;
        }

        logger.info(`WorkspaceService: Launching workspace '${workspaceName}' (ID: ${workspaceId})`);

        const results: WorkspaceItemLaunchResult[] = [];

        // 1. Applications: Secure resolution -> AppExecutorTool (shell: false, Phase 5.1 native)
        if (Array.isArray(targetWorkspace.applications)) {
            for (const appName of targetWorkspace.applications) {
                const resolution = appResolverTool.resolveApplication(appName);

                if (!resolution.success) {
                    logger.warn(
                        `WorkspaceService: Application resolution rejected for '${appName}': ${resolution.error}`
                    );
                    results.push({
                        success: false,
                        type: "application",
                        target: appName,
                        error: resolution.error || "Unsupported application.",
                    });
                    continue;
                }

                const approvedExecutable = resolution.executable;
                logger.info(
                    `WorkspaceService: Executing whitelisted application '${approvedExecutable}' for '${appName}'`
                );

                try {
                    const execOptions: AppExecutionOptions = {
                        ...options,
                        appId: resolution.appId,
                        arguments: resolution.arguments,
                        workingDirectory: resolution.workingDirectory,
                    };
                    const execResult = await Promise.race([
                        appExecutorTool.execute(approvedExecutable, execOptions),
                        new Promise<AppExecutionResult>((_, reject) =>
                            setTimeout(() => reject(new Error("Application launch timed out")), 5000)
                        ),
                    ]);
                    if (execResult.success) {
                        results.push({
                            success: true,
                            type: "application",
                            target: appName,
                            executable: approvedExecutable,
                        });
                    } else {
                        logger.error(
                            `WorkspaceService: Failed executing app '${appName}' (${approvedExecutable}): ${execResult.error}`
                        );
                        results.push({
                            success: false,
                            type: "application",
                            target: appName,
                            executable: approvedExecutable,
                            error: execResult.error || "Failed to execute application command.",
                        });
                    }
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : "Execution error";
                    logger.error(`WorkspaceService: Exception executing app '${appName}': ${errorMessage}`);
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
                logger.info(`WorkspaceService: Opening local folder: ${folderPath}`);

                // Security check: Reject shell metacharacters in configured paths
                if (SHELL_METACHARACTERS_REGEX.test(folderPath)) {
                    logger.warn(`WorkspaceService: Folder path contains dangerous characters: ${folderPath}`);
                    results.push({
                        success: false,
                        type: "folder",
                        target: folderPath,
                        error: "Folder path contains invalid or unsafe characters.",
                    });
                    continue;
                }

                try {
                    const openErr = await Promise.race([
                        systemService.openPath(folderPath),
                        new Promise<string>((_, reject) =>
                            setTimeout(() => reject(new Error("Folder open timed out")), 5000)
                        ),
                    ]);
                    if (openErr) {
                        logger.error(`WorkspaceService: Error opening path '${folderPath}': ${openErr}`);
                        results.push({
                            success: false,
                            type: "folder",
                            target: folderPath,
                            error: "Unable to open folder path.",
                        });
                    } else {
                        results.push({
                            success: true,
                            type: "folder",
                            target: folderPath,
                        });
                    }
                } catch (err: unknown) {
                    logger.error(`WorkspaceService: Exception opening folder '${folderPath}'`);
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
                logger.info(`WorkspaceService: Opening website URL: ${url}`);
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
                    await Promise.race([
                        systemService.openExternalUrl(url),
                        new Promise<boolean>((_, reject) =>
                            setTimeout(() => reject(new Error("URL open timed out")), 5000)
                        ),
                    ]);
                    results.push({
                        success: true,
                        type: "url",
                        target: url,
                    });
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : "URL open error";
                    logger.error(`WorkspaceService: Exception opening URL '${url}': ${errorMessage}`);
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

        if (overallSuccess) {
            eventBus.publish("workspace_launched", {
                workspaceId,
                name: workspaceName,
                type: (targetWorkspace as any)?.type,
            });
        }

        // Build concise execution summary
        const summaryLines: string[] = [`Starting your ${workspaceName} workspace.`];
        for (const item of results) {
            if (item.success) {
                summaryLines.push(`✓ ${item.target}`);
            } else {
                summaryLines.push(`✗ ${item.target} (${item.error || "failed"})`);
            }
        }
        if (overallSuccess) {
            summaryLines.push(`${workspaceName} workspace is ready.`);
        } else {
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

export const workspaceService = new WorkspaceService();

