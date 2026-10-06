import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { logger } from "../utils/logger";
import { getVoiceAssetPath } from "../utils/paths";

export interface VoiceEngineStatus {
    available: boolean;
    engine: "faster-whisper" | "whisper.cpp" | "none";
    status: "READY" | "NOT INSTALLED" | "MODEL NOT FOUND" | "ERROR";
    model?: string;
    device?: string;
    detail: string;
}

export interface TranscribeResult {
    success: boolean;
    transcript: string;
    duration?: number;
    error?: string;
}

interface PendingRequest {
    resolve: (res: TranscribeResult) => void;
    reject: (err: any) => void;
    timeoutTimer: NodeJS.Timeout;
    tempFilePath?: string;
}

export class WhisperService {
    private static instance: WhisperService | null = null;
    private workerProcess: ChildProcess | null = null;
    private engineStatus: VoiceEngineStatus = {
        available: false,
        engine: "none",
        status: "NOT INSTALLED",
        detail: "Initializing voice engine...",
    };
    private isInitializing: boolean = false;
    private initPromise: Promise<VoiceEngineStatus> | null = null;
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private bufferStdout: string = "";

    private constructor() {}

    public static getInstance(): WhisperService {
        if (!WhisperService.instance) {
            WhisperService.instance = new WhisperService();
        }
        return WhisperService.instance;
    }

    /**
     * Resolve the Python executable on Windows.
     */
    private findPythonExecutable(): string {
        const commonPaths = [
            path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "python.exe"),
            path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python312", "python.exe"),
            path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python310", "python.exe"),
            "C:\\Python311\\python.exe",
            "C:\\Python312\\python.exe",
        ];

        for (const p of commonPaths) {
            if (p && fs.existsSync(p)) {
                return p;
            }
        }

        return "python";
    }

    /**
     * Resolve the path to the whisper_server.py script.
     */
    private resolveScriptPath(): string | null {
        try {
            const assetPath = getVoiceAssetPath("whisper_server.py");
            if (fs.existsSync(assetPath)) {
                return assetPath;
            }
        } catch (err) {
            logger.warn("getVoiceAssetPath error in whisper-service:", err);
        }

        const candidates = [
            path.join(process.resourcesPath || "", "voice", "whisper_server.py"),
            path.join(process.resourcesPath || "", "app.asar.unpacked", "dist-electron", "voice", "whisper_server.py"),
            path.join(process.cwd(), "dist-electron", "voice", "whisper_server.py"),
            path.join(process.cwd(), "electron", "voice", "whisper_server.py"),
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate) && !candidate.includes("app.asar\\") && !candidate.includes("app.asar/")) {
                return candidate;
            }
        }

        logger.error("whisper_server.py script not found in unpacked candidates:", candidates);
        return null;
    }

    /**
     * Initialize the local faster-whisper Python worker.
     */
    public async initialize(): Promise<VoiceEngineStatus> {
        if (this.workerProcess && this.engineStatus.status === "READY") {
            return this.engineStatus;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.performInit();
        try {
            return await this.initPromise;
        } finally {
            this.initPromise = null;
        }
    }

    private async performInit(): Promise<VoiceEngineStatus> {
        const scriptPath = this.resolveScriptPath();
        if (!scriptPath) {
            this.engineStatus = {
                available: false,
                engine: "none",
                status: "NOT INSTALLED",
                detail: "whisper_server.py script missing from application bundle.",
            };
            return this.engineStatus;
        }

        const pythonExe = this.findPythonExecutable();
        logger.info(`Starting Voice STT worker using '${pythonExe}' with script '${scriptPath}'`);

        return new Promise<VoiceEngineStatus>((resolve) => {
            const initTimeout = setTimeout(() => {
                this.engineStatus = {
                    available: false,
                    engine: "none",
                    status: "ERROR",
                    detail: "Voice engine initialization timed out (20s).",
                };
                resolve(this.engineStatus);
            }, 20000);

            try {
                this.workerProcess = spawn(pythonExe, [scriptPath], {
                    stdio: ["pipe", "pipe", "pipe"],
                    windowsHide: true,
                    env: {
                        ...process.env,
                        PYTHONIOENCODING: "utf-8",
                        PYTHONUNBUFFERED: "1",
                    },
                });

                this.workerProcess.stdout?.setEncoding("utf-8");
                this.workerProcess.stderr?.setEncoding("utf-8");

                // Single stdout listener per process instance
                this.workerProcess.stdout?.on("data", (data: string) => {
                    this.handleStdoutData(data, (readyStatus) => {
                        clearTimeout(initTimeout);
                        resolve(readyStatus);
                    });
                });

                this.workerProcess.stderr?.on("data", (errData: string) => {
                    logger.debug(`[WhisperWorker:stderr] ${errData.trim()}`);
                });

                this.workerProcess.on("error", (err: any) => {
                    clearTimeout(initTimeout);
                    logger.error("Whisper worker process spawn error:", err);
                    this.engineStatus = {
                        available: false,
                        engine: "none",
                        status: "NOT INSTALLED",
                        detail: `Python runtime unavailable: ${err?.message || "Execution error"}`,
                    };
                    resolve(this.engineStatus);
                });

                this.workerProcess.on("close", (code: number | null) => {
                    logger.info(`Whisper worker process closed with code ${code}`);
                    this.workerProcess = null;
                    clearTimeout(initTimeout);

                    // Reject any in-flight transcription requests
                    for (const [id, req] of this.pendingRequests.entries()) {
                        clearTimeout(req.timeoutTimer);
                        if (req.tempFilePath) {
                            this.cleanupTempFile(req.tempFilePath);
                        }
                        req.resolve({
                            success: false,
                            transcript: "",
                            error: `Voice STT worker process terminated unexpectedly (code ${code}).`,
                        });
                    }
                    this.pendingRequests.clear();

                    this.engineStatus = {
                        available: false,
                        engine: "none",
                        status: "ERROR",
                        detail: `Voice engine worker closed (code ${code}).`,
                    };
                });

            } catch (spawnErr: any) {
                clearTimeout(initTimeout);
                this.engineStatus = {
                    available: false,
                    engine: "none",
                    status: "NOT INSTALLED",
                    detail: `Failed to spawn Python: ${spawnErr?.message || "Unknown error"}`,
                };
                resolve(this.engineStatus);
            }
        });
    }

    /**
     * Process line-delimited JSON chunks from stdout.
     */
    private handleStdoutData(chunk: string, onReadyCallback?: (status: VoiceEngineStatus) => void): void {
        this.bufferStdout += chunk;
        const lines = this.bufferStdout.split("\n");
        this.bufferStdout = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
                const msg = JSON.parse(trimmed);

                if (msg.type === "ready") {
                    if (msg.status === "READY") {
                        this.engineStatus = {
                            available: true,
                            engine: "faster-whisper",
                            status: "READY",
                            model: msg.model || "base.en",
                            device: msg.device || "cpu",
                            detail: `Local faster-whisper (${msg.model || "base.en"} on ${msg.device || "cpu"}) active.`,
                        };
                        logger.info(`Voice STT Engine Ready: ${this.engineStatus.detail}`);
                    } else {
                        this.engineStatus = {
                            available: false,
                            engine: "none",
                            status: "ERROR",
                            detail: msg.error || "Speech model failed to initialize.",
                        };
                        logger.error(`Voice STT Engine Error: ${this.engineStatus.detail}`);
                    }
                    if (onReadyCallback) {
                        onReadyCallback(this.engineStatus);
                    }
                } else if (msg.type === "status") {
                    this.engineStatus = {
                        available: msg.status === "READY",
                        engine: "faster-whisper",
                        status: msg.status,
                        model: msg.model,
                        device: msg.device,
                        detail: `Local faster-whisper active (${msg.model}).`,
                    };
                } else if (msg.type === "transcribe_result") {
                    const reqId = msg.id;
                    const pending = this.pendingRequests.get(reqId);
                    if (pending) {
                        clearTimeout(pending.timeoutTimer);
                        this.pendingRequests.delete(reqId);

                        logger.info(`[WhisperService] Transcript result for ${reqId}: success=${msg.success}, len=${msg.transcript?.length || 0}`);
                        pending.resolve({
                            success: Boolean(msg.success),
                            transcript: msg.transcript || "",
                            duration: msg.duration,
                            error: msg.error,
                        });
                    }
                }
            } catch {
                logger.debug(`[WhisperWorker:non-json] ${trimmed}`);
            }
        }
    }

    /**
     * Get current status of the local speech-to-text engine.
     */
    public async getStatus(): Promise<VoiceEngineStatus> {
        if (!this.workerProcess || this.engineStatus.status !== "READY") {
            return await this.initialize();
        }
        return this.engineStatus;
    }

    /**
     * Transcribe captured audio buffer using local Whisper engine.
     * Enforces strict timeout and deletes temporary files in all execution paths.
     */
    public async transcribeAudio(audioBuffer: Buffer): Promise<TranscribeResult> {
        if (this.engineStatus.status !== "READY" || !this.workerProcess) {
            await this.initialize();
            if (this.engineStatus.status !== "READY" || !this.workerProcess) {
                return {
                    success: false,
                    transcript: "",
                    error: `VOICE ENGINE OFFLINE: ${this.engineStatus.detail}`,
                };
            }
        }

        const reqId = `stt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const tempFilePath = path.join(os.tmpdir(), `alfred_voice_${reqId}.webm`);

        return new Promise<TranscribeResult>((resolve, reject) => {
            // Write audio buffer to temporary file for PyAV decoding
            try {
                fs.writeFileSync(tempFilePath, audioBuffer);
                logger.info(`[WhisperService] Audio buffered: ${tempFilePath} (${audioBuffer.length} bytes)`);
            } catch (err: any) {
                return resolve({
                    success: false,
                    transcript: "",
                    error: `Failed to buffer audio for transcription: ${err?.message}`,
                });
            }

            // Strict timeout guard (12s)
            const timeoutTimer = setTimeout(() => {
                this.pendingRequests.delete(reqId);
                this.cleanupTempFile(tempFilePath);
                logger.warn(`[WhisperService] Transcription timed out for request ${reqId}`);
                resolve({
                    success: false,
                    transcript: "",
                    error: "Transcription timed out after 12 seconds.",
                });
            }, 12000);

            this.pendingRequests.set(reqId, {
                resolve: (res) => {
                    this.cleanupTempFile(tempFilePath);
                    resolve(res);
                },
                reject: (err) => {
                    this.cleanupTempFile(tempFilePath);
                    reject(err);
                },
                timeoutTimer,
                tempFilePath,
            });

            // Send command over stdin
            const payload = JSON.stringify({
                type: "transcribe",
                id: reqId,
                filePath: tempFilePath,
            }) + "\n";

            try {
                this.workerProcess?.stdin?.write(payload);
            } catch (writeErr: any) {
                clearTimeout(timeoutTimer);
                this.pendingRequests.delete(reqId);
                this.cleanupTempFile(tempFilePath);
                resolve({
                    success: false,
                    transcript: "",
                    error: `Failed to communicate with voice worker: ${writeErr?.message}`,
                });
            }
        });
    }

    /**
     * Ensure temporary audio files are strictly erased after processing.
     */
    private cleanupTempFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err: any) {
            logger.warn(`Failed to unlink temporary audio recording: ${filePath}`, err);
        }
    }

    /**
     * Terminate the background Python worker cleanly.
     */
    public dispose(): void {
        if (this.workerProcess) {
            try {
                this.workerProcess.stdin?.write(JSON.stringify({ type: "exit" }) + "\n");
                setTimeout(() => {
                    if (this.workerProcess) {
                        this.workerProcess.kill();
                        this.workerProcess = null;
                    }
                }, 500);
            } catch {
                this.workerProcess.kill();
                this.workerProcess = null;
            }
        }

        // Clean up any pending requests
        for (const [id, req] of this.pendingRequests.entries()) {
            clearTimeout(req.timeoutTimer);
            if (req.tempFilePath) {
                this.cleanupTempFile(req.tempFilePath);
            }
            req.resolve({
                success: false,
                transcript: "",
                error: "Voice engine disposed.",
            });
        }
        this.pendingRequests.clear();
        this.engineStatus = {
            available: false,
            engine: "none",
            status: "NOT INSTALLED",
            detail: "Voice engine disposed.",
        };
    }
}
