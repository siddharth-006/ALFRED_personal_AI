import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../utils/logger";
import { getVoiceAssetPath } from "../utils/paths";

export type WakeWordEngineType = "openwakeword" | "local-vad-keyword" | "mock" | "none";

export interface WakeWordStatus {
    available: boolean;
    engine: WakeWordEngineType;
    status: "READY" | "NOT INSTALLED" | "MODEL NOT FOUND" | "ERROR" | "LISTENING";
    phrase: string;
    model?: string;
    detail: string;
}

export interface WakePredictResult {
    detected: boolean;
    score?: number;
    phrase?: string;
    model?: string;
    error?: string;
}

interface PendingRequest {
    resolve: (res: any) => void;
    reject: (err: any) => void;
    timeoutTimer: NodeJS.Timeout;
}

export class WakeWordService {
    private static instance: WakeWordService | null = null;
    private workerProcess: ChildProcess | null = null;
    private status: WakeWordStatus = {
        available: false,
        engine: "none",
        status: "NOT INSTALLED",
        phrase: "Hey Alfred",
        detail: "Initializing wake word engine...",
    };
    private isInitializing: boolean = false;
    private initPromise: Promise<WakeWordStatus> | null = null;
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private bufferStdout: string = "";
    private currentPhrase: string = "Hey Alfred";

    private constructor() {}

    public static getInstance(): WakeWordService {
        if (!WakeWordService.instance) {
            WakeWordService.instance = new WakeWordService();
        }
        return WakeWordService.instance;
    }

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

    private resolveScriptPath(): string | null {
        try {
            const assetPath = getVoiceAssetPath("wake_word_server.py");
            if (fs.existsSync(assetPath)) {
                return assetPath;
            }
        } catch (err) {
            logger.warn("getVoiceAssetPath error in wake-word-service:", err);
        }

        const candidates = [
            path.join(process.resourcesPath || "", "voice", "wake_word_server.py"),
            path.join(process.resourcesPath || "", "app.asar.unpacked", "dist-electron", "voice", "wake_word_server.py"),
            path.join(process.cwd(), "dist-electron", "voice", "wake_word_server.py"),
            path.join(process.cwd(), "electron", "voice", "wake_word_server.py"),
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate) && !candidate.includes("app.asar\\") && !candidate.includes("app.asar/")) {
                return candidate;
            }
        }

        logger.error("wake_word_server.py script not found in candidates:", candidates);
        return null;
    }

    public async initialize(): Promise<WakeWordStatus> {
        if (this.workerProcess && this.status.status === "READY") {
            return this.status;
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

    private async performInit(): Promise<WakeWordStatus> {
        const scriptPath = this.resolveScriptPath();
        if (!scriptPath) {
            this.status = {
                available: false,
                engine: "none",
                status: "NOT INSTALLED",
                phrase: this.currentPhrase,
                detail: "wake_word_server.py script missing from application bundle.",
            };
            return this.status;
        }

        const pythonExe = this.findPythonExecutable();
        logger.info(`[ALFRED:WakeWord] Starting wake word worker using '${pythonExe}' with '${scriptPath}'`);

        return new Promise<WakeWordStatus>((resolve) => {
            const initTimeout = setTimeout(() => {
                logger.warn("[ALFRED:WakeWord] Worker initialization timed out (30s). Cleaning up.");
                this.status = {
                    available: false,
                    engine: "none",
                    status: "ERROR",
                    phrase: this.currentPhrase,
                    detail: "Wake word engine initialization timed out (30s).",
                };
                this.cleanupWorker();
                resolve(this.status);
            }, 30000);

            try {
                this.workerProcess = spawn(pythonExe, ["-u", scriptPath], {
                    stdio: ["pipe", "pipe", "pipe"],
                    env: {
                        ...process.env,
                        PYTHONUNBUFFERED: "1",
                        TF_ENABLE_ONEDNN_OPTS: "0",
                    },
                    windowsHide: true,
                });

                this.workerProcess.stderr?.on("data", (data: Buffer) => {
                    const text = data.toString("utf8");
                    logger.debug(`[ALFRED:WakeWord:Python:stderr] ${text.trim()}`);
                });

                this.workerProcess.stdout?.on("data", (chunk: Buffer) => {
                    this.handleStdout(chunk, () => {
                        clearTimeout(initTimeout);
                        resolve(this.status);
                    });
                });

                this.workerProcess.on("error", (err) => {
                    logger.error("[ALFRED:WakeWord] Worker process spawn error:", err);
                    clearTimeout(initTimeout);
                    this.status = {
                        available: false,
                        engine: "none",
                        status: "ERROR",
                        phrase: this.currentPhrase,
                        detail: `Spawn failure: ${err.message}`,
                    };
                    this.cleanupWorker();
                    resolve(this.status);
                });

                this.workerProcess.on("exit", (code, signal) => {
                    logger.warn(`[ALFRED:WakeWord] Worker exited with code ${code}, signal ${signal}`);
                    clearTimeout(initTimeout);
                    this.cleanupWorker();
                });
            } catch (err: any) {
                logger.error("[ALFRED:WakeWord] Exception during worker startup:", err);
                clearTimeout(initTimeout);
                this.status = {
                    available: false,
                    engine: "none",
                    status: "ERROR",
                    phrase: this.currentPhrase,
                    detail: err?.message || "Worker startup failed",
                };
                resolve(this.status);
            }
        });
    }

    private handleStdout(chunk: Buffer, onReady?: () => void) {
        this.bufferStdout += chunk.toString("utf8");
        const lines = this.bufferStdout.split("\n");
        this.bufferStdout = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
                const msg = JSON.parse(trimmed);
                this.processMessage(msg, onReady);
            } catch (err) {
                logger.debug(`[ALFRED:WakeWord:RawOutput] ${trimmed}`);
            }
        }
    }

    private processMessage(msg: any, onReady?: () => void) {
        if (msg.type === "ready") {
            if (msg.status === "READY") {
                this.status = {
                    available: true,
                    engine: msg.engine || "openwakeword",
                    status: "READY",
                    phrase: msg.phrase || this.currentPhrase,
                    model: msg.model,
                    detail: `Wake word detector active [Model: ${msg.model || "hey_alfred"}]`,
                };
                logger.info(`[ALFRED:WakeWord] Engine ready: ${this.status.phrase} (${this.status.model})`);
            } else {
                this.status = {
                    available: false,
                    engine: "none",
                    status: "ERROR",
                    phrase: this.currentPhrase,
                    detail: msg.error || "Initialization failed in Python",
                };
                logger.error("[ALFRED:WakeWord] Python initialization failure:", msg.error);
            }
            if (onReady) onReady();
            return;
        }

        const reqId = msg.id;
        if (reqId && this.pendingRequests.has(reqId)) {
            const req = this.pendingRequests.get(reqId)!;
            this.pendingRequests.delete(reqId);
            clearTimeout(req.timeoutTimer);

            if (msg.type === "predict_result") {
                req.resolve({
                    detected: Boolean(msg.detected),
                    score: msg.score,
                    phrase: msg.phrase || this.currentPhrase,
                    model: msg.model,
                });
            } else if (msg.type === "status") {
                req.resolve({
                    status: msg.status,
                    phrase: msg.phrase,
                });
            } else if (msg.type === "set_phrase_result") {
                req.resolve(msg);
            } else {
                req.resolve(msg);
            }
        }
    }

    public async getStatus(): Promise<WakeWordStatus> {
        if (!this.workerProcess || this.status.status !== "READY") {
            return await this.initialize();
        }
        return this.status;
    }

    public async setPhrase(phrase: string): Promise<boolean> {
        this.currentPhrase = phrase;
        if (!this.workerProcess || this.status.status !== "READY") {
            return true;
        }

        try {
            const reqId = `set_phrase_${Date.now()}`;
            const res = await this.sendRequest({
                type: "set_phrase",
                id: reqId,
                phrase: phrase,
            });
            return Boolean(res?.success);
        } catch {
            return false;
        }
    }

    public async predictFrame(audioBase64: string, threshold = 0.5): Promise<WakePredictResult> {
        if (!this.workerProcess || this.status.status !== "READY") {
            const status = await this.initialize();
            if (!status.available) {
                return { detected: false, error: status.detail };
            }
        }

        const reqId = `pred_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        try {
            return await this.sendRequest<WakePredictResult>({
                type: "predict",
                id: reqId,
                audio: audioBase64,
                threshold: threshold,
            }, 3000);
        } catch (err: any) {
            return {
                detected: false,
                error: err?.message || "Prediction timeout or worker error",
            };
        }
    }

    private sendRequest<T = any>(payload: any, timeoutMs = 5000): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!this.workerProcess || !this.workerProcess.stdin) {
                return reject(new Error("Worker process not running"));
            }

            const reqId = payload.id;
            const timeoutTimer = setTimeout(() => {
                if (this.pendingRequests.has(reqId)) {
                    this.pendingRequests.delete(reqId);
                    reject(new Error(`Wake word worker request timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);

            this.pendingRequests.set(reqId, {
                resolve,
                reject,
                timeoutTimer,
            });

            try {
                this.workerProcess.stdin.write(JSON.stringify(payload) + "\n");
            } catch (err) {
                clearTimeout(timeoutTimer);
                this.pendingRequests.delete(reqId);
                reject(err);
            }
        });
    }

    private cleanupWorker() {
        if (this.workerProcess) {
            try {
                this.workerProcess.kill();
            } catch {}
            this.workerProcess = null;
        }
        for (const [_id, req] of this.pendingRequests.entries()) {
            clearTimeout(req.timeoutTimer);
            req.reject(new Error("Worker process terminated."));
        }
        this.pendingRequests.clear();
        this.bufferStdout = "";
        this.status = {
            available: false,
            engine: "none",
            status: "NOT INSTALLED",
            phrase: this.currentPhrase,
            detail: "Wake word worker stopped.",
        };
    }

    public dispose() {
        logger.info("[ALFRED:WakeWord] Disposing WakeWordService...");
        if (this.workerProcess && this.workerProcess.stdin) {
            try {
                this.workerProcess.stdin.write(JSON.stringify({ type: "exit" }) + "\n");
            } catch {}
        }
        setTimeout(() => this.cleanupWorker(), 500);
    }
}
