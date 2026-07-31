import http from "http";
import fs from "fs";
import path from "path";
import { app } from "electron";
import { logger } from "../utils/logger";

const MIME_TYPES: Record<string, string> = {
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

export function startStaticServer(): Promise<string> {
    return new Promise((resolve, reject) => {
        const outDir = path.join(app.getAppPath(), "out");
        logger.info(`Starting Production Static Server for: ${outDir}`);

        const server = http.createServer((req, res) => {
            let reqUrl = req.url || "/";
            if (reqUrl.includes("?")) {
                reqUrl = reqUrl.split("?")[0];
            }

            let filePath = path.join(outDir, reqUrl);

            // Handle trailing slash or directory
            if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
                filePath = path.join(filePath, "index.html");
            }

            // Fallback for Next static export routes
            if (!fs.existsSync(filePath)) {
                if (fs.existsSync(filePath + ".html")) {
                    filePath = filePath + ".html";
                } else {
                    filePath = path.join(outDir, "index.html");
                }
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("404 Not Found");
                } else {
                    res.writeHead(200, { "Content-Type": contentType });
                    res.end(data);
                }
            });
        });

        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (typeof address === "object" && address !== null) {
                const serverUrl = `http://127.0.0.1:${address.port}`;
                logger.info(`Static Server listening on ${serverUrl}`);
                resolve(serverUrl);
            } else {
                reject(new Error("Failed to retrieve server port"));
            }
        });

        server.on("error", (err) => {
            logger.error(`Static Server failed to start: ${err.message}`);
            reject(err);
        });
    });
}
