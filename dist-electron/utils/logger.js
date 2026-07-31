"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [ALFRED:${level.toUpperCase()}] ${message}`;
    }
    info(message, ...args) {
        console.log(this.formatMessage("info", message), ...args);
    }
    warn(message, ...args) {
        console.warn(this.formatMessage("warn", message), ...args);
    }
    error(message, ...args) {
        console.error(this.formatMessage("error", message), ...args);
    }
    debug(message, ...args) {
        console.debug(this.formatMessage("debug", message), ...args);
    }
}
exports.logger = new Logger();
