/**
 * Anthropic Claude Provider HTTP Client (Phase 3.3 - Step 4.6)
 *
 * Low-level HTTP adapter for communicating with the Anthropic Claude REST API endpoints.
 * Isolated in this file — never exposed to renderer or ToolRegistry.
 *
 * SECURITY:
 * - ONLY communicates with Anthropic API endpoints (https://api.anthropic.com).
 * - Makes NO filesystem or shell calls.
 * - Does NOT import child_process, spawn, exec, or any OS primitives.
 * - Raw response MUST pass through ClaudeResponseParser before use.
 */

export interface ClaudeClientConfig {
    /** Target API Key */
    apiKey?: string;
    /** Model identifier, e.g. "claude-3-5-sonnet-20241022" or "claude-3-haiku-20240307" */
    modelName: string;
    /** Request timeout in milliseconds (default: 15_000) */
    timeoutMs?: number;
}

export interface ClaudeGenerateRawResponse {
    id?: string;
    type?: string;
    role?: string;
    content?: Array<{
        type?: string;
        text?: string;
    }>;
    model?: string;
    stop_reason?: string;
    error?: {
        type: string;
        message: string;
    };
}

export interface ClaudeClientResult {
    success: boolean;
    rawText: string;
    error?: string;
    isEndpointError?: boolean;
}

/**
 * Sends a generation request to the Anthropic Claude API messages endpoint.
 *
 * @param config  ClaudeClientConfig — apiKey, model, timeout
 * @param prompt  Fully-formed prompt string
 * @param temperature  Optional sampling temperature
 * @param maxTokens   Optional max tokens
 */
export async function claudeGenerate(
    config: ClaudeClientConfig,
    prompt: string,
    temperature?: number,
    maxTokens?: number
): Promise<ClaudeClientResult> {
    const apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.ANTHROPIC_API_KEY : undefined);

    if (!apiKey || !apiKey.trim()) {
        return {
            success: false,
            rawText: "",
            error: "Anthropic Claude API key is missing. Set ANTHROPIC_API_KEY environment variable or provide apiKey in configuration.",
            isEndpointError: false,
        };
    }

    const model = config.modelName || "claude-3-5-sonnet-20241022";
    const url = "https://api.anthropic.com/v1/messages";
    const timeoutMs = config.timeoutMs ?? 15_000;

    const payload = {
        model,
        max_tokens: maxTokens ?? 2048,
        temperature: temperature ?? 0.7,
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey.trim(),
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            return {
                success: false,
                rawText: "",
                error: `Claude API returned HTTP ${res.status}: ${errBody}`,
                isEndpointError: true,
            };
        }

        const json: ClaudeGenerateRawResponse = await res.json();

        if (json.error) {
            return {
                success: false,
                rawText: "",
                error: `Claude API error [${json.error.type}]: ${json.error.message}`,
                isEndpointError: true,
            };
        }

        const firstContent = json.content?.[0];
        const text = firstContent?.text;
        if (!text || typeof text !== "string") {
            return {
                success: false,
                rawText: "",
                error: "Claude API response is missing text in content array.",
                isEndpointError: true,
            };
        }

        return { success: true, rawText: text };
    } catch (err: unknown) {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : String(err);

        if (message.includes("abort") || message.includes("signal")) {
            return {
                success: false,
                rawText: "",
                error: `Claude API request timed out after ${timeoutMs}ms.`,
            };
        }

        return {
            success: false,
            rawText: "",
            error: `Claude API connection failed: ${message}`,
        };
    }
}

/**
 * Pings the Anthropic API to check key and endpoint validity.
 * Returns true if reachable and key is valid, false otherwise.
 */
export async function claudePing(apiKey?: string, timeoutMs = 3_000): Promise<boolean> {
    const key = apiKey || (typeof process !== "undefined" ? process.env?.ANTHROPIC_API_KEY : undefined);
    if (!key || !key.trim()) return false;

    const url = "https://api.anthropic.com/v1/messages";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": key.trim(),
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1,
                messages: [{ role: "user", content: "ping" }],
            }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        return res.ok;
    } catch {
        clearTimeout(timer);
        return false;
    }
}
