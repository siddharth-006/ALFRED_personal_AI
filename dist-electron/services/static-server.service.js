"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStaticServer = startStaticServer;
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const logger_1 = require("../utils/logger");
const MIME_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
};
function startStaticServer() {
    return new Promise((resolve, reject) => {
        const outDir = path_1.default.join(electron_1.app.getAppPath(), "out");
        logger_1.logger.info(`Starting Production Static Server for: ${outDir}`);
        const server = http_1.default.createServer((req, res) => {
            let reqUrl = req.url || "/";
            if (reqUrl.includes("?")) {
                reqUrl = reqUrl.split("?")[0];
            }
            let filePath = path_1.default.join(outDir, reqUrl);
            // Handle trailing slash or directory
            if (fs_1.default.existsSync(filePath) && fs_1.default.statSync(filePath).isDirectory()) {
                filePath = path_1.default.join(filePath, "index.html");
            }
            // Fallback for Next static export routes
            if (!fs_1.default.existsSync(filePath)) {
                if (fs_1.default.existsSync(filePath + ".html")) {
                    filePath = filePath + ".html";
                }
                else {
                    filePath = path_1.default.join(outDir, "index.html");
                }
            }
            const ext = path_1.default.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";
            fs_1.default.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("404 Not Found");
                }
                else {
                    res.writeHead(200, { "Content-Type": contentType });
                    res.end(data);
                }
            });
        });
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (typeof address === "object" && address !== null) {
                const serverUrl = `http://127.0.0.1:${address.port}`;
                logger_1.logger.info(`Static Server listening on ${serverUrl}`);
                resolve(serverUrl);
            }
            else {
                reject(new Error("Failed to retrieve server port"));
            }
        });
        server.on("error", (err) => {
            logger_1.logger.error(`Static Server failed to start: ${err.message}`);
            reject(err);
        });
    });
}
