import { EventEmitter } from "events";
import { logger } from "../utils/logger";

export type LifecycleState = "active" | "background" | "shutting_down" | "stopped";

export class BackgroundLifecycleService {
    private static instance: BackgroundLifecycleService | null = null;
    private state: LifecycleState = "active";
    private emitter = new EventEmitter();

    private constructor() {
        this.emitter.setMaxListeners(20);
    }

    public static getInstance(): BackgroundLifecycleService {
        if (!BackgroundLifecycleService.instance) {
            BackgroundLifecycleService.instance = new BackgroundLifecycleService();
        }
        return BackgroundLifecycleService.instance;
    }

    public getState(): LifecycleState {
        return this.state;
    }

    public isActive(): boolean {
        return this.state === "active";
    }

    public isBackground(): boolean {
        return this.state === "background";
    }

    public isShuttingDown(): boolean {
        return this.state === "shutting_down";
    }

    public isStopped(): boolean {
        return this.state === "stopped";
    }

    public setWindowVisible(visible: boolean): void {
        if (this.state === "shutting_down" || this.state === "stopped") {
            return;
        }

        const newState: LifecycleState = visible ? "active" : "background";
        this.transitionTo(newState);
    }

    public setShuttingDown(): void {
        this.transitionTo("shutting_down");
    }

    public setStopped(): void {
        this.transitionTo("stopped");
    }

    public onStateChange(listener: (state: LifecycleState) => void): () => void {
        this.emitter.on("stateChange", listener);
        return () => {
            this.emitter.removeListener("stateChange", listener);
        };
    }

    public resetForTesting(): void {
        this.state = "active";
        this.emitter.removeAllListeners();
    }

    private transitionTo(newState: LifecycleState): void {
        if (this.state === newState) {
            return;
        }

        const previousState = this.state;
        this.state = newState;
        logger.info(`[BackgroundLifecycle] State transition: ${previousState} -> ${newState}`);
        this.emitter.emit("stateChange", newState);
    }
}

export const backgroundLifecycleService = BackgroundLifecycleService.getInstance();
