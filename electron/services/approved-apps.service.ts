import fs from "fs";
import path from "path";
import { getUserDataDirectory } from "../utils/paths";
import { logger } from "../utils/logger";
import { validateApplicationPath, DiscoveredApplication } from "./app-discovery.service";

export interface ApprovedApplication {
    id: string;
    name: string;
    executablePath: string;
    arguments?: string[];
    workingDirectory?: string;
    isPWA?: boolean;
    publisher?: string;
    version?: string;
    source: string;
    approvedAt: string;
    aliases: string[];
    isBuiltIn?: boolean;
}

/** Pre-approved built-in applications matching ALFRED's existing architecture */
export const DEFAULT_BUILTIN_APPLICATIONS: ApprovedApplication[] = [
    {
        id: "app_vscode",
        name: "Visual Studio Code",
        executablePath: "code",
        publisher: "Microsoft Corporation",
        source: "known",
        approvedAt: "2026-01-01T00:00:00.000Z",
        aliases: ["vs code", "vscode", "code", "visual studio code"],
        isBuiltIn: true,
    },
    {
        id: "app_chrome",
        name: "Google Chrome",
        executablePath: "chrome",
        publisher: "Google LLC",
        source: "known",
        approvedAt: "2026-01-01T00:00:00.000Z",
        aliases: ["chrome", "google chrome", "googlechrome"],
        isBuiltIn: true,
    },
    {
        id: "app_spotify",
        name: "Spotify",
        executablePath: "spotify",
        publisher: "Spotify AB",
        source: "known",
        approvedAt: "2026-01-01T00:00:00.000Z",
        aliases: ["spotify", "music"],
        isBuiltIn: true,
    },
    {
        id: "app_discord",
        name: "Discord",
        executablePath: "discord",
        publisher: "Discord Inc.",
        source: "known",
        approvedAt: "2026-01-01T00:00:00.000Z",
        aliases: ["discord", "chat"],
        isBuiltIn: true,
    },
    {
        id: "app_windows_terminal",
        name: "Windows Terminal",
        executablePath: "wt",
        publisher: "Microsoft Corporation",
        source: "known",
        approvedAt: "2026-01-01T00:00:00.000Z",
        aliases: ["terminal", "wt", "windows terminal"],
        isBuiltIn: true,
    },
    {
        id: "app_power_bi",
        name: "Power BI Desktop",
        executablePath: "PBIDesktop",
        publisher: "Microsoft Corporation",
        source: "known",
        approvedAt: "2026-01-01T00:00:00.000Z",
        aliases: ["power bi", "powerbi", "power bi desktop", "pbidesktop"],
        isBuiltIn: true,
    },
];

export class ApprovedAppsService {
    private approvedApps: Map<string, ApprovedApplication> = new Map();
    private storagePath: string;
    private checkFileExists: boolean;

    constructor(customStoragePath?: string, options: { checkFileExists?: boolean } = { checkFileExists: true }) {
        this.storagePath = customStoragePath || path.join(getUserDataDirectory(), "approved_applications.json");
        this.checkFileExists = options.checkFileExists !== false;
        this.load();
    }

    private load(): void {
        this.approvedApps.clear();

        // 1. Seed defaults first
        for (const builtin of DEFAULT_BUILTIN_APPLICATIONS) {
            this.approvedApps.set(builtin.id, { ...builtin });
        }

        // 2. Load persisted records if file exists
        if (fs.existsSync(this.storagePath)) {
            try {
                const data = fs.readFileSync(this.storagePath, "utf8");
                const parsed = JSON.parse(data);

                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        if (item && item.id && item.name && item.executablePath) {
                            // Check security: built-in commands or validated file paths
                            if (item.isBuiltIn) {
                                this.approvedApps.set(item.id, item);
                            } else {
                                const validation = validateApplicationPath(item.executablePath, { checkFileExists: this.checkFileExists });
                                if (validation.valid) {
                                    const parsedArgs = Array.isArray(item.arguments) ? item.arguments.map(String) : undefined;
                                    const parsedCwd = item.workingDirectory ? String(item.workingDirectory).trim() : undefined;
                                    
                                    // Check if duplicate already exists (e.g. legacy id without args vs newer id with args)
                                    const existingDuplicate = Array.from(this.approvedApps.values()).find(
                                        (a) => a.name.toLowerCase() === String(item.name).trim().toLowerCase() &&
                                               a.executablePath.toLowerCase() === String(item.executablePath).trim().toLowerCase()
                                    );

                                    if (existingDuplicate) {
                                        // If incoming has arguments and existing does not, replace existing
                                        if (parsedArgs && parsedArgs.length > 0 && (!existingDuplicate.arguments || existingDuplicate.arguments.length === 0)) {
                                            this.approvedApps.delete(existingDuplicate.id);
                                        } else if (existingDuplicate.arguments && existingDuplicate.arguments.length > 0 && (!parsedArgs || parsedArgs.length === 0)) {
                                            // Existing has arguments and incoming does not, keep existing
                                            continue;
                                        }
                                    }

                                    this.approvedApps.set(item.id, {
                                        id: String(item.id),
                                        name: String(item.name).trim(),
                                        executablePath: String(item.executablePath).trim(),
                                        arguments: parsedArgs,
                                        workingDirectory: parsedCwd,
                                        isPWA: item.isPWA ? true : undefined,
                                        publisher: item.publisher ? String(item.publisher) : undefined,
                                        version: item.version ? String(item.version) : undefined,
                                        source: item.source || "user_approved",
                                        approvedAt: item.approvedAt || new Date().toISOString(),
                                        aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
                                        isBuiltIn: false,
                                    });
                                } else {
                                    logger.warn(`[ApprovedApps] Stored app '${item.name}' failed security re-validation: ${validation.error}`);
                                }
                            }
                        }
                    }
                    logger.info(`[ApprovedApps] Loaded ${this.approvedApps.size} approved application(s).`);
                    return;
                }
            } catch (err: any) {
                logger.warn(`[ApprovedApps] Corrupt approved_applications.json: ${err?.message}. Recovering with defaults.`);
            }
        }

        // Save defaults if file was missing or corrupt
        this.save();
    }

    private save(): void {
        try {
            const dir = path.dirname(this.storagePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const list = Array.from(this.approvedApps.values());
            fs.writeFileSync(this.storagePath, JSON.stringify(list, null, 2), "utf8");
        } catch (err: any) {
            logger.error(`[ApprovedApps] Failed to save approved applications: ${err?.message}`);
        }
    }

    public getApprovedApplications(): ApprovedApplication[] {
        return Array.from(this.approvedApps.values());
    }

    public getApprovedAppById(id: string): ApprovedApplication | null {
        return this.approvedApps.get(id) || null;
    }

    /**
     * Resolves an approved application by name, ID, or alias (case-insensitive).
     * Prioritizes records with arguments and working directories over bare executable references.
     */
    public findApprovedApp(query: string): ApprovedApplication | null {
        if (!query || typeof query !== "string") return null;
        const normalized = query.trim().toLowerCase();

        // 1. Direct ID match
        const byId = this.approvedApps.get(normalized) || this.approvedApps.get(`app_${normalized}`);
        if (byId) return byId;

        // 2. Direct Name match (gather all matches and prioritize one with arguments)
        const nameMatches: ApprovedApplication[] = [];
        for (const app of this.approvedApps.values()) {
            if (app.name.toLowerCase() === normalized) {
                nameMatches.push(app);
            }
        }
        if (nameMatches.length > 0) {
            // Pick candidate with arguments if available
            const withArgs = nameMatches.find((a) => a.arguments && a.arguments.length > 0);
            return withArgs || nameMatches[0];
        }

        // 3. Executable path match (gather all and prioritize with arguments)
        const exeMatches: ApprovedApplication[] = [];
        for (const app of this.approvedApps.values()) {
            if (app.executablePath.toLowerCase() === normalized) {
                exeMatches.push(app);
            }
        }
        if (exeMatches.length > 0) {
            const withArgs = exeMatches.find((a) => a.arguments && a.arguments.length > 0);
            return withArgs || exeMatches[0];
        }

        // 4. Alias match
        const aliasMatches: ApprovedApplication[] = [];
        for (const app of this.approvedApps.values()) {
            if (app.aliases && app.aliases.some((a) => a.toLowerCase() === normalized)) {
                aliasMatches.push(app);
            }
        }
        if (aliasMatches.length > 0) {
            const withArgs = aliasMatches.find((a) => a.arguments && a.arguments.length > 0);
            return withArgs || aliasMatches[0];
        }

        return null;
    }

    public isApplicationApproved(query: string): boolean {
        return this.findApprovedApp(query) !== null;
    }

    /**
     * User-explicit approval action.
     * AI is forbidden from invoking this method.
     */
    public approveApplication(
        app: DiscoveredApplication | Omit<ApprovedApplication, "approvedAt">,
        customAliases?: string[],
        options: { checkFileExists?: boolean } = { checkFileExists: true }
    ): { success: boolean; app?: ApprovedApplication; error?: string } {
        if (!app || !app.id || !app.name || !app.executablePath) {
            return { success: false, error: "Invalid application payload." };
        }

        // Security path validation
        const validation = validateApplicationPath(app.executablePath, options);
        if (!validation.valid) {
            return { success: false, error: validation.error || "Application executable path is invalid or prohibited." };
        }

        // Clean up any existing duplicate with same name and executablePath but old id
        const existingByName = Array.from(this.approvedApps.values()).find(
            (a) => a.name.toLowerCase() === app.name.toLowerCase().trim() &&
                   a.executablePath.toLowerCase() === app.executablePath.toLowerCase().trim() &&
                   a.id !== app.id
        );
        if (existingByName) {
            this.approvedApps.delete(existingByName.id);
        }

        const existing = this.approvedApps.get(app.id) || existingByName;
        const aliases = Array.from(
            new Set([
                ...(app.aliases || []),
                ...(customAliases || []),
                app.name.toLowerCase().trim(),
                path.basename(app.executablePath, ".exe").toLowerCase().trim(),
            ])
        ).filter(Boolean);

        const approvedRecord: ApprovedApplication = {
            id: app.id,
            name: app.name.trim(),
            executablePath: app.executablePath.trim(),
            arguments: Array.isArray((app as any).arguments) ? (app as any).arguments.map(String) : undefined,
            workingDirectory: (app as any).workingDirectory ? String((app as any).workingDirectory).trim() : undefined,
            isPWA: (app as any).isPWA ? true : undefined,
            publisher: app.publisher,
            version: app.version,
            source: app.source || "discovered",
            approvedAt: existing ? existing.approvedAt : new Date().toISOString(),
            aliases,
            isBuiltIn: false,
        };

        this.approvedApps.set(approvedRecord.id, approvedRecord);
        this.save();
        logger.info(`[ApprovedApps] Application '${approvedRecord.name}' approved by user.`);
        return { success: true, app: approvedRecord };
    }

    /**
     * Revokes ALFRED's authorization for an application.
     * Does NOT uninstall or modify the Windows binary.
     */
    public revokeApplication(id: string): { success: boolean; error?: string } {
        if (!id) return { success: false, error: "Application ID cannot be empty." };

        const target = this.approvedApps.get(id);
        if (!target) {
            return { success: false, error: `Application '${id}' is not in the approved registry.` };
        }

        // Do not allow revoking primary built-ins if critical, or allow re-seed
        if (target.isBuiltIn) {
            return { success: false, error: `Core built-in application '${target.name}' cannot be removed.` };
        }

        this.approvedApps.delete(id);
        this.save();
        logger.info(`[ApprovedApps] Revoked approval for application '${target.name}' (${id}).`);
        return { success: true };
    }

    public updateAliases(id: string, aliases: string[]): { success: boolean; app?: ApprovedApplication; error?: string } {
        const app = this.approvedApps.get(id);
        if (!app) return { success: false, error: "Application not found." };

        const cleaned = Array.from(new Set(aliases.map((a) => a.trim().toLowerCase()))).filter(Boolean);
        app.aliases = cleaned;
        this.save();
        return { success: true, app };
    }

    public resetToDefaults(): void {
        this.approvedApps.clear();
        for (const builtin of DEFAULT_BUILTIN_APPLICATIONS) {
            this.approvedApps.set(builtin.id, { ...builtin });
        }
        this.save();
    }
}

export const approvedAppsService = new ApprovedAppsService();
