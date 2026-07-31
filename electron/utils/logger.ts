type LogLevel = "info" | "warn" | "error" | "debug";

class Logger {
    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [ALFRED:${level.toUpperCase()}] ${message}`;
    }

    info(message: string, ...args: unknown[]): void {
        console.log(this.formatMessage("info", message), ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(this.formatMessage("warn", message), ...args);
    }

    error(message: string, ...args: unknown[]): void {
        console.error(this.formatMessage("error", message), ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        console.debug(this.formatMessage("debug", message), ...args);
    }
}

export const logger = new Logger();
