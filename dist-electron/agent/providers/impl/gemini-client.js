"use strict";
/**
 * Google Gemini Provider HTTP Client (Phase 3.3 - Step 4.5)
 *
 * Low-level HTTP adapter for communicating with the Google Gemini REST API endpoints.
 * Isolated in this file — never exposed to renderer or ToolRegistry.
 *
 * SECURITY:
 * - ONLY communicates with Google Gemini API endpoints (https://generativelanguage.googleapis.com).
 * - Makes NO filesystem or shell calls.
 * - Does NOT import child_process, spawn, exec, or any OS primitives.
 * - Raw response MUST pass through GeminiResponseParser before use.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiGenerate = geminiGenerate;
exports.geminiPing = geminiPing;
/**
 * Sends a generation request to the Gemini API generateContent REST endpoint.
 *
 * @param config  GeminiClientConfig — apiKey, model, timeout
 * @param prompt  Fully-formed prompt string
 * @param temperature  Optional sampling temperature
 * @param maxTokens   Optional max tokens
 */
async function geminiGenerate(config, prompt, temperature, maxTokens) {
    const apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
    if (!apiKey || !apiKey.trim()) {
        return {
            success: false,
            rawText: "",
            error: "Google Gemini API key is missing. Set GEMINI_API_KEY environment variable or provide apiKey in configuration.",
            isEndpointError: false,
        };
    }
    const model = config.modelName || "gemini-1.5-pro";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    const timeoutMs = config.timeoutMs ?? 15_000;
    const payload = {
        contents: [
            {
                parts: [{ text: prompt }],
            },
        ],
        generationConfig: {
            temperature: temperature ?? 0.7,
            maxOutputTokens: maxTokens ?? 2048,
        },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            return {
                success: false,
                rawText: "",
                error: `Gemini API returned HTTP ${res.status}: ${errBody}`,
                isEndpointError: true,
            };
        }
        const json = await res.json();
        if (json.error) {
            return {
                success: false,
                rawText: "",
                error: `Gemini API error ${json.error.code}: ${json.error.message}`,
                isEndpointError: true,
            };
        }
        const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText || typeof candidateText !== "string") {
            return {
                success: false,
                rawText: "",
                error: "Gemini API response is missing text in candidates array.",
                isEndpointError: true,
            };
        }
        return { success: true, rawText: candidateText };
    }
    catch (err) {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("abort") || message.includes("signal")) {
            return {
                success: false,
                rawText: "",
                error: `Gemini API request timed out after ${timeoutMs}ms.`,
            };
        }
        return {
            success: false,
            rawText: "",
            error: `Gemini API connection failed: ${message}`,
        };
    }
}
/**
 * Pings the Gemini API to check key and endpoint validity.
 * Returns true if reachable and key is valid, false otherwise.
 */
async function geminiPing(apiKey, timeoutMs = 3_000) {
    const key = apiKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
    if (!key || !key.trim())
        return false;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key.trim())}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { method: "GET", signal: controller.signal });
        clearTimeout(timer);
        return res.ok;
    }
    catch {
        clearTimeout(timer);
        return false;
    }
}
