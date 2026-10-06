import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { logger } from "./logger";

/**
 * Returns a stable, guaranteed-writable user data directory across development
 * and installed packaged builds.
 *
 * Windows: %APPDATA%\ALFRED (e.g. C:\Users\<user>\AppData\Roaming\ALFRED)
 * macOS: ~/Library/Application Support/ALFRED
 * Linux: ~/.config/ALFRED
 */
export function getUserDataDirectory(): string {
    // 1. Try canonical Electron app.getPath("userData")
    try {
        if (typeof app !== "undefined" && app && typeof app.getPath === "function") {
            const electronUserData = app.getPath("userData");
            if (electronUserData) {
                if (!fs.existsSync(electronUserData)) {
                    fs.mkdirSync(electronUserData, { recursive: true });
                }
                return electronUserData;
            }
        }
    } catch {}

    // 2. Safe OS-level standard directories (works even before app.whenReady())
    let baseDir = "";
    if (process.platform === "win32") {
        baseDir = process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming");
    } else if (process.platform === "darwin") {
        baseDir = path.join(process.env.HOME || "", "Library", "Application Support");
    } else {
        baseDir = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || "", ".config");
    }

    if (baseDir) {
        const alfredDir = path.join(baseDir, "ALFRED");
        if (!fs.existsSync(alfredDir)) {
            try {
                fs.mkdirSync(alfredDir, { recursive: true });
            } catch {}
        }
        return alfredDir;
    }

    // 3. User home .alfred directory fallback (guaranteed user-writable)
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const dotAlfred = path.join(home, ".alfred");
    if (!fs.existsSync(dotAlfred)) {
        try {
            fs.mkdirSync(dotAlfred, { recursive: true });
        } catch {}
    }
    return dotAlfred;
}

/**
 * Resolves a real, unpacked filesystem path for native voice workers, scripts,
 * and models that external processes (python.exe, powershell.exe) need to access.
 *
 * External processes CANNOT read inside app.asar.
 * In packaged builds, extraResources are in process.resourcesPath/voice/
 * or app.asar.unpacked/dist-electron/voice/
 */
export function getVoiceAssetPath(filename: string): string {
    // 1. Packaged extraResources: resources/voice/<filename>
    if (process.resourcesPath) {
        const p = path.join(process.resourcesPath, "voice", filename);
        if (fs.existsSync(p)) {
            return p;
        }

        // 2. app.asar.unpacked directory
        const unpacked = path.join(process.resourcesPath, "app.asar.unpacked", "dist-electron", "voice", filename);
        if (fs.existsSync(unpacked)) {
            return unpacked;
        }
    }

    // 3. If running from app.asar, check corresponding app.asar.unpacked
    if (__dirname.includes("app.asar")) {
        const unpackedFromDir = path.join(__dirname.replace("app.asar", "app.asar.unpacked"), filename);
        if (fs.existsSync(unpackedFromDir)) {
            return unpackedFromDir;
        }
    }

    // 4. Development paths (outside asar)
    const devCandidates = [
        path.join(process.cwd(), "dist-electron", "voice", filename),
        path.join(process.cwd(), "electron", "voice", filename),
        path.join(__dirname, filename),
        path.join(__dirname, "..", "voice", filename),
        path.join(__dirname, "..", "..", "electron", "voice", filename),
    ];

    for (const cand of devCandidates) {
        if (fs.existsSync(cand) && !cand.includes("app.asar")) {
            return cand;
        }
    }

    logger.warn(`getVoiceAssetPath: Asset '${filename}' not found in candidates:`, devCandidates);
    return path.join(process.cwd(), "electron", "voice", filename);
}
