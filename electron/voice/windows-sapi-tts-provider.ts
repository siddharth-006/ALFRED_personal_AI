import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger";
import { getVoiceAssetPath } from "../utils/paths";
import {
    ITtsProvider,
    TtsStatus,
    TtsSpeakOptions,
    TtsEvent,
} from "./tts-provider.interface";

/**
 * Windows SAPI Text-to-Speech Provider (Phase 5.4C)
 * Integrates local Windows System.Speech.Synthesis without cloud APIs or network requests.
 * Uses a persistent in-memory worker process communicating via Base64 stdin/stdout.
 */
export class WindowsSapiTtsProvider implements ITtsProvider {
    private worker: ChildProcess | null = null;
    private status: TtsStatus = {
        available: false,
        engine: "windows-sapi",
        status: "INITIALIZING",
        detail: "Initializing Windows SAPI TTS...",
    };
    private activeSpeaking: boolean = false;
    private currentSpeechId: string | null = null;
    private listeners: Set<(event: TtsEvent) => void> = new Set();
    private initPromise: Promise<TtsStatus> | null = null;

    public async initialize(): Promise<TtsStatus> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise<TtsStatus>((resolve) => {
            if (process.platform !== "win32") {
                this.status = {
                    available: false,
                    engine: "windows-sapi",
                    status: "DISABLED",
                    detail: "Windows SAPI TTS is only supported on Windows.",
                };
                return resolve(this.status);
            }

            const scriptPath = this.resolveScriptPath();
            if (!scriptPath) {
                this.status = {
                    available: false,
                    engine: "windows-sapi",
                    status: "ERROR",
                    detail: "tts_worker.ps1 script not found.",
                };
                return resolve(this.status);
            }

            try {
                logger.info(`[ALFRED:TTS] Spawning Windows SAPI worker from: ${scriptPath}`);
                this.worker = spawn(
                    "powershell.exe",
                    [
                        "-NoProfile",
                        "-NonInteractive",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-File",
                        scriptPath,
                    ],
                    {
                        windowsHide: true,
                        stdio: ["pipe", "pipe", "pipe"],
                    }
                );

                let initialized = false;
                const initTimeout = setTimeout(() => {
                    if (!initialized) {
                        initialized = true;
                        logger.warn("[ALFRED:TTS] Worker init timed out (8s).");
                        this.status = {
                            available: false,
                            engine: "windows-sapi",
                            status: "ERROR",
                            detail: "Windows SAPI worker startup timed out.",
                        };
                        resolve(this.status);
                    }
                }, 8000);

                let stdoutBuffer = "";
                this.worker.stdout?.on("data", (data: Buffer) => {
                    stdoutBuffer += data.toString("utf-8");
                    const lines = stdoutBuffer.split(/\r?\n/);
                    stdoutBuffer = lines.pop() || "";

                    for (const rawLine of lines) {
                        const line = rawLine.trim();
                        if (!line || !line.startsWith("{")) continue;

                        try {
                            const msg = JSON.parse(line);
                            this.handleWorkerMessage(msg, (status) => {
                                if (!initialized) {
                                    initialized = true;
                                    clearTimeout(initTimeout);
                                    resolve(status);
                                }
                            });
                        } catch {
                            // Non-json stdout log
                        }
                    }
                });

                this.worker.stderr?.on("data", (data: Buffer) => {
                    logger.debug(`[ALFRED:TTS:stderr] ${data.toString("utf-8").trim()}`);
                });

                this.worker.on("close", (code) => {
                    logger.info(`[ALFRED:TTS] Worker process closed (code: ${code})`);
                    this.activeSpeaking = false;
                    this.currentSpeechId = null;
                    if (!initialized) {
                        initialized = true;
                        clearTimeout(initTimeout);
                        this.status = {
                            available: false,
                            engine: "windows-sapi",
                            status: "ERROR",
                            detail: `Worker exited prematurely with code ${code}.`,
                        };
                        resolve(this.status);
                    } else {
                        this.status.status = "ERROR";
                        this.status.detail = "TTS worker process terminated.";
                        this.emitEvent({ type: "error", error: "Worker process terminated" });
                    }
                });

                this.worker.on("error", (err) => {
                    logger.error("[ALFRED:TTS] Failed to spawn PowerShell worker:", err);
                    this.status = {
                        available: false,
                        engine: "windows-sapi",
                        status: "ERROR",
                        detail: err?.message || "Failed to spawn PowerShell process",
                    };
                    if (!initialized) {
                        initialized = true;
                        clearTimeout(initTimeout);
                        resolve(this.status);
                    }
                });

            } catch (err: any) {
                logger.error("[ALFRED:TTS] Exception during TTS initialization:", err);
                this.status = {
                    available: false,
                    engine: "windows-sapi",
                    status: "ERROR",
                    detail: err?.message || "Exception during TTS worker start",
                };
                resolve(this.status);
            }
        });

        return this.initPromise;
    }

    private handleWorkerMessage(msg: any, onReadyCallback?: (status: TtsStatus) => void): void {
        switch (msg.event) {
            case "ready": {
                this.status = {
                    available: true,
                    engine: "windows-sapi",
                    status: "READY",
                    voice: msg.voice || undefined,
                    voices: Array.isArray(msg.voices) ? msg.voices : undefined,
                    detail: `Local Windows SAPI active (${msg.voice || "Default Voice"})`,
                };
                logger.info(`[ALFRED:TTS] Ready with voice: "${msg.voice}" (${msg.voices?.length || 0} voices available)`);
                this.emitEvent({ type: "ready" });
                if (onReadyCallback) onReadyCallback(this.status);
                break;
            }
            case "started": {
                this.activeSpeaking = true;
                this.currentSpeechId = msg.id || null;
                this.emitEvent({ type: "started", id: msg.id });
                break;
            }
            case "completed": {
                if (this.currentSpeechId === msg.id || !msg.id) {
                    this.activeSpeaking = false;
                    this.currentSpeechId = null;
                }
                this.emitEvent({ type: "completed", id: msg.id });
                break;
            }
            case "stopped": {
                this.activeSpeaking = false;
                this.currentSpeechId = null;
                this.emitEvent({ type: "stopped" });
                break;
            }
            case "error": {
                logger.warn(`[ALFRED:TTS] Worker reported error: ${msg.error}`);
                this.emitEvent({ type: "error", error: msg.error });
                break;
            }
        }
    }

    public async speak(id: string, text: string, options?: TtsSpeakOptions): Promise<boolean> {
        if (!this.worker || !this.worker.stdin || this.status.status === "ERROR") {
            return false;
        }

        // Clean and validate text
        const clean = text.trim();
        if (!clean) return false;

        try {
            // Apply runtime options if provided
            if (options?.voice) {
                this.worker.stdin.write(`SET_VOICE ${options.voice}\n`);
            }
            if (options?.rate !== undefined) {
                this.worker.stdin.write(`SET_RATE ${options.rate}\n`);
            }
            if (options?.volume !== undefined) {
                this.worker.stdin.write(`SET_VOLUME ${options.volume}\n`);
            }

            // Encode speech string into Base64 to strictly guarantee zero shell/newline issues
            const b64 = Buffer.from(clean, "utf-8").toString("base64");
            this.worker.stdin.write(`SPEAK ${id} ${b64}\n`);
            return true;
        } catch (err: any) {
            logger.error("[ALFRED:TTS] Failed to send speak command to worker:", err);
            return false;
        }
    }

    public async stop(): Promise<void> {
        if (!this.worker || !this.worker.stdin) return;
        try {
            this.worker.stdin.write("STOP\n");
            this.activeSpeaking = false;
            this.currentSpeechId = null;
        } catch {}
    }

    public isSpeaking(): boolean {
        return this.activeSpeaking;
    }

    public async getStatus(): Promise<TtsStatus> {
        return this.status;
    }

    public async setOptions(options: TtsSpeakOptions): Promise<void> {
        if (!this.worker || !this.worker.stdin) return;
        try {
            if (options.voice) {
                this.worker.stdin.write(`SET_VOICE ${options.voice}\n`);
                this.status.voice = options.voice;
            }
            if (options.rate !== undefined) {
                this.worker.stdin.write(`SET_RATE ${options.rate}\n`);
            }
            if (options.volume !== undefined) {
                this.worker.stdin.write(`SET_VOLUME ${options.volume}\n`);
            }
        } catch {}
    }

    public onEvent(listener: (event: TtsEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emitEvent(event: TtsEvent): void {
        this.listeners.forEach((fn) => {
            try {
                fn(event);
            } catch {}
        });
    }

    public async dispose(): Promise<void> {
        if (!this.worker) return;
        try {
            if (this.worker.stdin) {
                this.worker.stdin.write("EXIT\n");
            }
            const current = this.worker;
            this.worker = null;
            setTimeout(() => {
                try {
                    current.kill();
                } catch {}
            }, 300);
        } catch {}
    }

    private resolveScriptPath(): string | null {
        try {
            const assetPath = getVoiceAssetPath("tts_worker.ps1");
            if (fs.existsSync(assetPath)) {
                return assetPath;
            }
        } catch (err) {
            logger.warn("getVoiceAssetPath error in windows-sapi-tts-provider:", err);
        }

        const candidatePaths = [
            path.join(process.resourcesPath || "", "voice", "tts_worker.ps1"),
            path.join(process.resourcesPath || "", "app.asar.unpacked", "dist-electron", "voice", "tts_worker.ps1"),
            path.join(process.cwd(), "electron", "voice", "tts_worker.ps1"),
            path.join(process.cwd(), "dist-electron", "voice", "tts_worker.ps1"),
        ];

        for (const p of candidatePaths) {
            if (fs.existsSync(p) && !p.includes("app.asar\\") && !p.includes("app.asar/")) {
                return p;
            }
        }
        return null;
    }
}
