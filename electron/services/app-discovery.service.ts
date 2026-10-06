import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { shell } from "electron";
import { logger } from "../utils/logger";

export interface DiscoveredApplication {
    id: string;
    name: string;
    executablePath: string;
    arguments?: string[];
    workingDirectory?: string;
    isPWA?: boolean;
    publisher?: string;
    version?: string;
    source: "start_menu" | "windows_apps" | "system" | "known" | "registry" | "program_files";
    aliases: string[];
    icon?: string;
}

/** Dangerous command interpreters and shell utilities that must NEVER be discovered or approved */
export const DANGEROUS_EXECUTABLE_NAMES = new Set([
    "cmd.exe",
    "powershell.exe",
    "pwsh.exe",
    "wscript.exe",
    "cscript.exe",
    "mshta.exe",
    "rundll32.exe",
    "regsvr32.exe",
    "reg.exe",
    "vssadmin.exe",
    "certutil.exe",
    "bitsadmin.exe",
    "bash.exe",
    "sh.exe",
    "zsh.exe",
    "conhost.exe",
    "curl.exe",
    "wget.exe",
    "format.com",
    "diskpart.exe",
]);

/** Shell metacharacters regex for path validation — allows parentheses for 'Program Files (x86)' while strictly blocking command injection symbols */
export const SHELL_METACHARACTERS_REGEX = /[;&|`$<>{}\n\r]/;

/**
 * Validates whether a file path qualifies as a safe Windows application executable.
 */
export function validateApplicationPath(
    executablePath: string,
    options: { checkFileExists?: boolean } = { checkFileExists: true }
): { valid: boolean; error?: string } {
    if (!executablePath || typeof executablePath !== "string") {
        return { valid: false, error: "Executable path cannot be empty." };
    }

    const trimmed = executablePath.trim();

    // Check for shell metacharacters
    if (SHELL_METACHARACTERS_REGEX.test(trimmed)) {
        return { valid: false, error: "Executable path contains unsafe shell metacharacters." };
    }

    // Check for path traversal attempts
    if (trimmed.includes("..")) {
        return { valid: false, error: "Executable path contains invalid relative path traversal." };
    }

    // Must end with .exe (case-insensitive)
    if (!trimmed.toLowerCase().endsWith(".exe")) {
        return { valid: false, error: "Target file is not a Windows executable (.exe)." };
    }

    // Check blacklist of dangerous interpreters
    const baseName = path.basename(trimmed).toLowerCase();
    if (DANGEROUS_EXECUTABLE_NAMES.has(baseName)) {
        return { valid: false, error: `Execution of interpreter or system tool '${baseName}' is strictly forbidden.` };
    }

    // Reject uninstallers or update helpers
    if (/unins\w*\.exe$|uninstall\.exe$|setup\.exe$/i.test(baseName)) {
        return { valid: false, error: "Uninstallers and setup utilities cannot be approved as applications." };
    }

    // Check if file exists on disk if requested
    if (options.checkFileExists !== false) {
        try {
            if (!fs.existsSync(trimmed)) {
                // For Windows Store App Execution Aliases, lstatSync may succeed when existsSync fails
                const stat = fs.lstatSync(trimmed);
                if (!stat) {
                    return { valid: false, error: `Executable file does not exist at '${trimmed}'.` };
                }
            }
            const stat = fs.statSync(trimmed);
            if (stat.isDirectory()) {
                return { valid: false, error: "Specified path is a directory, not an executable file." };
            }
        } catch (err: any) {
            // If neither existsSync nor lstatSync worked
            return { valid: false, error: `Cannot access target executable: ${err?.message || "File not found"}` };
        }
    }

    return { valid: true };
}

/**
 * Windows Native Application Discovery Service
 *
 * Scans standard Windows user and system shortcut directories safely without invoking shells or full-disk traversal.
 */
export class AppDiscoveryService {
    private cachedDiscovered: DiscoveredApplication[] = [];
    private lastScanTime: number = 0;

    /**
     * Discovers installed Windows applications from legitimate Start Menu and registered app paths.
     */
    public async discoverApplications(forceRefresh = false): Promise<DiscoveredApplication[]> {
        // Cache scan results for 60 seconds unless explicit refresh is requested
        if (!forceRefresh && this.cachedDiscovered.length > 0 && Date.now() - this.lastScanTime < 60000) {
            return this.cachedDiscovered;
        }

        logger.info("[AppDiscovery] Starting safe Windows installed application discovery...");
        const discoveredMap = new Map<string, DiscoveredApplication>();

        // 1. Scan User Start Menu Programs
        const userStartMenu = path.join(
            process.env.APPDATA || "",
            "Microsoft",
            "Windows",
            "Start Menu",
            "Programs"
        );
        this.scanShortcutDirectory(userStartMenu, "start_menu", discoveredMap);

        // 2. Scan Common / All Users Start Menu Programs
        const allUsersStartMenu = path.join(
            process.env.ProgramData || process.env.ALLUSERSPROFILE || "C:\\ProgramData",
            "Microsoft",
            "Windows",
            "Start Menu",
            "Programs"
        );
        this.scanShortcutDirectory(allUsersStartMenu, "start_menu", discoveredMap);

        // 3. Scan Windows Store Apps in %LOCALAPPDATA%\Microsoft\WindowsApps
        const windowsAppsDir = path.join(
            process.env.LOCALAPPDATA || "",
            "Microsoft",
            "WindowsApps"
        );
        this.scanExecutableDirectory(windowsAppsDir, "windows_apps", discoveredMap);

        // 4. Scan %LOCALAPPDATA%\Programs (Standard user-installed software like VS Code, Discord, etc.)
        const localProgramsDir = path.join(
            process.env.LOCALAPPDATA || "",
            "Programs"
        );
        this.scanProgramSubdirectories(localProgramsDir, "start_menu", discoveredMap);

        // 5. Scan Standard Program Files and Program Files (x86) top directories
        this.scanProgramFilesRoots(discoveredMap);

        // 6. Scan Windows Uninstall Registry Keys (HKLM, WOW6432Node, HKCU)
        this.scanWindowsRegistry(discoveredMap);

        // 7. Add Standard Known Built-ins & System Tools
        this.addKnownSystemTools(discoveredMap);

        const results = Array.from(discoveredMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );

        this.cachedDiscovered = results;
        this.lastScanTime = Date.now();
        logger.info(`[AppDiscovery] Discovered ${results.length} valid Windows applications.`);
        return results;
    }

    public getCachedDiscovered(): DiscoveredApplication[] {
        return this.cachedDiscovered;
    }

    /**
     * Recursively traverses Start Menu shortcut directories up to 3 levels deep.
     */
    private scanShortcutDirectory(
        dirPath: string,
        source: DiscoveredApplication["source"],
        map: Map<string, DiscoveredApplication>,
        depth = 0
    ): void {
        if (depth > 3 || !fs.existsSync(dirPath)) return;

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Skip administrative, uninstaller, or accessory setup folders
                    if (/uninstall|tools|administrative/i.test(entry.name)) continue;
                    this.scanShortcutDirectory(fullPath, source, map, depth + 1);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".lnk")) {
                    this.processShortcut(fullPath, source, map);
                }
            }
        } catch (err: any) {
            logger.debug(`[AppDiscovery] Directory scan notice at '${dirPath}': ${err?.message}`);
        }
    }

    /**
     * Resolves a Windows shortcut (.lnk) safely via Electron shell API without shell execution.
     */
    private processShortcut(
        lnkPath: string,
        source: DiscoveredApplication["source"],
        map: Map<string, DiscoveredApplication>
    ): void {
        try {
            // Electron native API parses shortcut without execution
            let shortcut: Electron.ShortcutDetails | null = null;
            if (typeof shell !== "undefined" && typeof shell.readShortcutLink === "function") {
                try {
                    shortcut = shell.readShortcutLink(lnkPath);
                } catch {}
            }

            // Fallback for non-Electron test contexts or unparsed links: extract strings safely from shortcut binary
            if (!shortcut || !shortcut.target) {
                shortcut = this.parseShortcutBinaryFallback(lnkPath);
            }

            if (!shortcut || !shortcut.target) return;

            const targetPath = shortcut.target.trim();
            const validation = validateApplicationPath(targetPath);
            if (!validation.valid) return;

            const rawName = path.basename(lnkPath, ".lnk")
                .replace(/\s*-\s*Shortcut$/i, "")
                .trim();

            if (!rawName) return;

            // Extract and safely tokenize shortcut arguments
            const parsedArgs = this.parseShortcutArguments(shortcut.args || "");
            const isPWA = /chrome_proxy\.exe|msedge_proxy\.exe/i.test(path.basename(targetPath)) ||
                Boolean(parsedArgs && parsedArgs.some((arg) => arg.includes("--app-id=") || arg.includes("--app=")));

            const id = this.generateAppId(rawName, targetPath, parsedArgs);
            if (map.has(id)) return;

            const aliases = this.generateDefaultAliases(rawName, targetPath);

            let workingDirectory: string | undefined = undefined;
            if (shortcut.cwd && typeof shortcut.cwd === "string" && shortcut.cwd.trim()) {
                const trimmedCwd = shortcut.cwd.trim();
                if (!SHELL_METACHARACTERS_REGEX.test(trimmedCwd) && !trimmedCwd.includes("..") && fs.existsSync(trimmedCwd)) {
                    workingDirectory = trimmedCwd;
                }
            }

            map.set(id, {
                id,
                name: rawName,
                executablePath: targetPath,
                arguments: parsedArgs.length > 0 ? parsedArgs : undefined,
                workingDirectory,
                isPWA: isPWA ? true : undefined,
                source,
                aliases,
            });
        } catch {
            // Ignore unreadable or corrupt shortcuts
        }
    }

    /**
     * Safely splits and validates command line arguments from a Windows shortcut.
     * Rejects any argument containing shell redirection, subshells, or command chaining delimiters.
     */
    public parseShortcutArguments(argsStr: string): string[] {
        if (!argsStr || typeof argsStr !== "string") return [];
        const trimmed = argsStr.trim();
        if (!trimmed) return [];

        // Reject explicit shell chaining or command separator characters in shortcut arguments
        if (/[;&|`$<>\n\r]/.test(trimmed)) {
            logger.warn(`[AppDiscovery] Unsafe characters detected in shortcut arguments: ${trimmed}`);
            return [];
        }

        const args: string[] = [];
        // Character-by-character parser that correctly handles --key="value with spaces" as well as "whole quoted arg"
        let current = "";
        let inQuotes = false;
        let quoteChar = "";

        for (let i = 0; i < trimmed.length; i++) {
            const char = trimmed[i];

            if ((char === '"' || char === "'") && (!inQuotes || char === quoteChar)) {
                inQuotes = !inQuotes;
                quoteChar = inQuotes ? char : "";
            } else if (/\s/.test(char) && !inQuotes) {
                if (current.length > 0) {
                    args.push(current);
                    current = "";
                }
            } else {
                current += char;
            }
        }

        if (current.length > 0) {
            args.push(current);
        }

        // Secondary security check: filter out arguments attempting interpreter launching
        const forbiddenPointers = ["cmd.exe", "powershell.exe", "pwsh.exe", "wscript.exe", "cscript.exe", "bash.exe"];
        for (const arg of args) {
            const lower = arg.toLowerCase();
            if (forbiddenPointers.some((p) => lower.includes(p))) {
                logger.warn(`[AppDiscovery] Dangerous interpreter argument rejected: ${arg}`);
                return [];
            }
        }

        return args;
    }

    /**
     * Safe fallback shortcut inspector that extracts ASCII strings from .lnk file when Electron shell API is unavailable.
     * Never executes shell commands or external scripts.
     */
    private parseShortcutBinaryFallback(lnkPath: string): { target: string; args?: string; cwd?: string } | null {
        try {
            if (!fs.existsSync(lnkPath)) return null;
            const buffer = fs.readFileSync(lnkPath);
            if (buffer.length < 76) return null; // Windows Shell Link Header is minimum 76 bytes

            // Convert buffer to both ASCII/Latin1 and UCS-2 strings for pattern matching
            const asciiStr = buffer.toString("latin1");
            const ucs2Str = buffer.toString("utf16le");

            // Look for standard Windows executable path (e.g. C:\...\*.exe)
            const exeRegex = /[A-Za-z]:\\[a-zA-Z0-9_\- .\\()]+\.exe/gi;
            const asciiMatches = asciiStr.match(exeRegex) || [];
            const ucs2Matches = ucs2Str.match(exeRegex) || [];
            const allCandidates = [...asciiMatches, ...ucs2Matches];

            let target = "";
            for (const cand of allCandidates) {
                const clean = cand.trim();
                if (validateApplicationPath(clean, { checkFileExists: true }).valid) {
                    target = clean;
                    break;
                }
            }

            if (!target) return null;

            // Look for arguments (e.g. --profile-directory="Profile 10" --app-id=...)
            let args: string | undefined = undefined;
            const argsRegex = /--[a-zA-Z0-9_\-=" ']+/gi;
            const asciiArgs = asciiStr.match(argsRegex);
            const ucs2Args = ucs2Str.match(argsRegex);
            const rawArgs = asciiArgs || ucs2Args;
            if (rawArgs && rawArgs.length > 0) {
                args = rawArgs.join(" ").trim();
            }

            // Look for working directory
            let cwd: string | undefined = undefined;
            const targetDir = path.dirname(target);
            if (fs.existsSync(targetDir)) {
                cwd = targetDir;
            }

            return { target, args, cwd };
        } catch {
            return null;
        }
    }

    /**
     * Scans flat directory of executables (e.g. %LOCALAPPDATA%\Microsoft\WindowsApps)
     */
    private scanExecutableDirectory(
        dirPath: string,
        source: DiscoveredApplication["source"],
        map: Map<string, DiscoveredApplication>
    ): void {
        if (!fs.existsSync(dirPath)) return;

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".exe")) continue;

                const fullPath = path.join(dirPath, entry.name);
                const validation = validateApplicationPath(fullPath);
                if (!validation.valid) continue;

                const rawName = path.basename(entry.name, ".exe");
                const id = this.generateAppId(rawName, fullPath);
                if (map.has(id)) continue;

                map.set(id, {
                    id,
                    name: this.formatApplicationName(rawName),
                    executablePath: fullPath,
                    source,
                    aliases: this.generateDefaultAliases(rawName, fullPath),
                });
            }
        } catch {}
    }

    /**
     * Scans top-level subdirectories in %LOCALAPPDATA%\Programs (e.g. Programs\Microsoft VS Code\Code.exe)
     */
    private scanProgramSubdirectories(
        dirPath: string,
        source: DiscoveredApplication["source"],
        map: Map<string, DiscoveredApplication>
    ): void {
        if (!fs.existsSync(dirPath)) return;

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const subDir = path.join(dirPath, entry.name);

                try {
                    const subFiles = fs.readdirSync(subDir, { withFileTypes: true });
                    for (const f of subFiles) {
                        if (f.isFile() && f.name.toLowerCase().endsWith(".exe")) {
                            const fullPath = path.join(subDir, f.name);
                            const validation = validateApplicationPath(fullPath);
                            if (validation.valid) {
                                const rawName = entry.name;
                                const id = this.generateAppId(rawName, fullPath);
                                if (!map.has(id)) {
                                    map.set(id, {
                                        id,
                                        name: rawName,
                                        executablePath: fullPath,
                                        source,
                                        aliases: this.generateDefaultAliases(rawName, fullPath),
                                    });
                                }
                            }
                        }
                    }
                } catch {}
            }
        } catch {}
    }

    /**
     * Scans top-level application folders in Program Files and Program Files (x86).
     * Looks for primary executable within 1 level (e.g. Program Files (x86)\Steam\Steam.exe).
     */
    private scanProgramFilesRoots(map: Map<string, DiscoveredApplication>): void {
        const roots = [
            process.env.PROGRAMFILES || "C:\\Program Files",
            process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
        ];

        for (const root of roots) {
            if (!fs.existsSync(root)) continue;

            try {
                const entries = fs.readdirSync(root, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    // Skip standard Windows internal or common directories
                    if (/^(common files|internet explorer|windows defender|windows mail|windows media player|windows multimedia platform|windows photo viewer|windows portable devices|windows security|windows nt|windows powershell|microsoft\.net|uninstall|installshield installation information)$/i.test(entry.name)) {
                        continue;
                    }

                    const appDir = path.join(root, entry.name);
                    try {
                        const files = fs.readdirSync(appDir, { withFileTypes: true });
                        for (const f of files) {
                            if (f.isFile() && f.name.toLowerCase().endsWith(".exe")) {
                                const fullPath = path.join(appDir, f.name);
                                const validation = validateApplicationPath(fullPath);
                                if (!validation.valid) continue;

                                const exeBase = path.basename(f.name, ".exe");
                                const dirBase = entry.name;
                                // Prioritize executable matching folder name, or common main executable patterns
                                const isDirectMatch = exeBase.toLowerCase() === dirBase.toLowerCase() ||
                                    exeBase.toLowerCase() === "code" ||
                                    exeBase.toLowerCase() === "chrome" ||
                                    exeBase.toLowerCase() === "steam";

                                const rawName = isDirectMatch ? dirBase : `${dirBase} (${exeBase})`;
                                const id = this.generateAppId(rawName, fullPath);
                                if (!map.has(id)) {
                                    map.set(id, {
                                        id,
                                        name: rawName,
                                        executablePath: fullPath,
                                        workingDirectory: appDir,
                                        source: "program_files",
                                        aliases: this.generateDefaultAliases(rawName, fullPath),
                                    });
                                }
                            }
                        }
                    } catch {}
                }
            } catch {}
        }
    }

    /**
     * Discovers registered applications via Windows Uninstall Registry keys (HKLM and HKCU).
     * Uses native Windows 'reg query' to safely query registered application metadata.
     */
    private scanWindowsRegistry(map: Map<string, DiscoveredApplication>): void {
        const registryPaths = [
            "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
            "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        ];

        for (const regPath of registryPaths) {
            try {
                const rawOutput = execSync(`reg query "${regPath}"`, {
                    encoding: "utf8",
                    timeout: 4000,
                    stdio: ["ignore", "pipe", "ignore"],
                });

                const subkeys = rawOutput
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter((line) => line.startsWith(regPath) && line.length > regPath.length);

                for (const subkey of subkeys) {
                    try {
                        const keyDetails = execSync(`reg query "${subkey}"`, {
                            encoding: "utf8",
                            timeout: 2000,
                            stdio: ["ignore", "pipe", "ignore"],
                        });

                        const lines = keyDetails.split(/\r?\n/);
                        let displayName = "";
                        let installLocation = "";
                        let displayIcon = "";
                        let publisher = "";
                        let displayVersion = "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed.startsWith("DisplayName")) {
                                const parts = trimmed.split(/\s{2,}/);
                                if (parts.length >= 3) displayName = parts.slice(2).join(" ").trim();
                            } else if (trimmed.startsWith("InstallLocation")) {
                                const parts = trimmed.split(/\s{2,}/);
                                if (parts.length >= 3) installLocation = parts.slice(2).join(" ").trim();
                            } else if (trimmed.startsWith("DisplayIcon")) {
                                const parts = trimmed.split(/\s{2,}/);
                                if (parts.length >= 3) displayIcon = parts.slice(2).join(" ").trim();
                            } else if (trimmed.startsWith("Publisher")) {
                                const parts = trimmed.split(/\s{2,}/);
                                if (parts.length >= 3) publisher = parts.slice(2).join(" ").trim();
                            } else if (trimmed.startsWith("DisplayVersion")) {
                                const parts = trimmed.split(/\s{2,}/);
                                if (parts.length >= 3) displayVersion = parts.slice(2).join(" ").trim();
                            }
                        }

                        if (!displayName) continue;
                        if (/update|security update|hotfix|redistributable|prerequisite|driver/i.test(displayName)) continue;

                        let resolvedExePath = "";
                        let workingDir = "";

                        // Check 1: DisplayIcon might point directly to the main exe
                        if (displayIcon) {
                            const cleanIcon = displayIcon.split(",")[0].replace(/^"|"$/g, "").trim();
                            if (cleanIcon.toLowerCase().endsWith(".exe") && !/unins\w*\.exe$|uninstall\.exe$|setup\.exe$/i.test(cleanIcon)) {
                                if (validateApplicationPath(cleanIcon, { checkFileExists: true }).valid) {
                                    resolvedExePath = cleanIcon;
                                    workingDir = path.dirname(cleanIcon);
                                }
                            }
                        }

                        // Check 2: InstallLocation directory inspection
                        if (!resolvedExePath && installLocation && fs.existsSync(installLocation)) {
                            try {
                                const files = fs.readdirSync(installLocation, { withFileTypes: true });
                                for (const f of files) {
                                    if (f.isFile() && f.name.toLowerCase().endsWith(".exe")) {
                                        const candidate = path.join(installLocation, f.name);
                                        const v = validateApplicationPath(candidate, { checkFileExists: true });
                                        if (v.valid) {
                                            const base = path.basename(f.name, ".exe").toLowerCase();
                                            const disp = displayName.toLowerCase();
                                            if (disp.includes(base) || base.includes("steam") || base.includes("app")) {
                                                resolvedExePath = candidate;
                                                workingDir = installLocation;
                                                break;
                                            }
                                        }
                                    }
                                }
                            } catch {}
                        }

                        if (resolvedExePath) {
                            const id = this.generateAppId(displayName, resolvedExePath);
                            if (!map.has(id)) {
                                map.set(id, {
                                    id,
                                    name: displayName,
                                    executablePath: resolvedExePath,
                                    workingDirectory: workingDir || undefined,
                                    publisher: publisher || undefined,
                                    version: displayVersion || undefined,
                                    source: "registry",
                                    aliases: this.generateDefaultAliases(displayName, resolvedExePath),
                                });
                            }
                        }
                    } catch {}
                }
            } catch {}
        }
    }

    /**
     * Adds known built-ins and standard Windows accessories if present on disk.
     */
    private addKnownSystemTools(map: Map<string, DiscoveredApplication>): void {
        const system32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");

        const standardTools: Array<{ name: string; exeName: string; aliases: string[] }> = [
            { name: "Notepad", exeName: "notepad.exe", aliases: ["note", "notes", "text editor"] },
            { name: "Calculator", exeName: "calc.exe", aliases: ["calc", "math"] },
            { name: "Paint", exeName: "mspaint.exe", aliases: ["paint", "draw"] },
            { name: "Snipping Tool", exeName: "SnippingTool.exe", aliases: ["screenshot", "snip"] },
        ];

        for (const tool of standardTools) {
            const toolExec = path.join(system32, tool.exeName);
            if (fs.existsSync(toolExec)) {
                const id = `app_${tool.name.toLowerCase().replace(/\s+/g, "_")}`;
                if (!map.has(id)) {
                    map.set(id, {
                        id,
                        name: tool.name,
                        executablePath: toolExec,
                        source: "system",
                        aliases: tool.aliases,
                    });
                }
            }
        }
    }

    private generateAppId(name: string, exePath: string, args?: string[]): string {
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
        const baseName = path.basename(exePath, ".exe").toLowerCase();
        
        // If this is a proxy launcher (e.g. chrome_proxy.exe) or has an explicit app-id, incorporate it into the ID
        if (args && args.length > 0) {
            const appIdArg = args.find((a) => a.startsWith("--app-id="));
            if (appIdArg) {
                const appIdVal = appIdArg.replace("--app-id=", "").trim().toLowerCase();
                return `app_${cleanName || "pwa"}_${appIdVal.slice(0, 12)}`;
            }
        }

        return `app_${cleanName || baseName}`;
    }

    private generateDefaultAliases(name: string, exePath: string): string[] {
        const set = new Set<string>();
        const lowerName = name.toLowerCase().trim();
        const baseExe = path.basename(exePath, ".exe").toLowerCase().trim();

        set.add(lowerName);
        if (baseExe && baseExe !== lowerName) set.add(baseExe);

        // e.g. "Visual Studio Code" -> "vs code", "vscode", "code"
        if (lowerName === "visual studio code") {
            set.add("vs code");
            set.add("vscode");
            set.add("code");
        } else if (lowerName === "google chrome") {
            set.add("chrome");
        } else if (lowerName === "windows terminal") {
            set.add("terminal");
            set.add("wt");
        }

        return Array.from(set);
    }

    private formatApplicationName(raw: string): string {
        if (raw.toLowerCase() === "wt") return "Windows Terminal";
        if (raw.toLowerCase() === "chrome") return "Google Chrome";
        if (raw.toLowerCase() === "code") return "Visual Studio Code";
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
}

export const appDiscoveryService = new AppDiscoveryService();
