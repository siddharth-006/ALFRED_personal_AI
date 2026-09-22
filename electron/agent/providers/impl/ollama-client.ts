/**
 * Ollama Provider HTTP Client (Phase 3.3 - Step 4.3)
 *
 * Low-level HTTP adapter for communicating with a local Ollama REST endpoint.
 * Isolated in this file — never exposed to the renderer or ToolRegistry.
 *
 * SECURITY:
 * - ONLY communicates with localhost / configurable endpoint.
 * - Makes NO filesystem or shell calls.
 * - Does NOT import child_process, spawn, exec, or any OS primitives.
 * - Raw response MUST pass through OllamaResponseParser before use.
 */

export interface OllamaClientConfig {
    /** Base endpoint URL, e.g. "http://localhost:11434" */
    endpointUrl: string;
    /** Model identifier, e.g. "qwen3:latest" */
    modelName: string;
    /** Request timeout in milliseconds (default: 60_000) */
    timeoutMs?: number;
}

export interface OllamaGeneratePayload {
    model: string;
    prompt: string;
    stream: false;
    options?: {
        temperature?: number;
        num_predict?: number;
    };
}

export interface OllamaGenerateRawResponse {
    model: string;
    response: string;
    done: boolean;
    total_duration?: number;
}

export interface OllamaClientResult {
    success: boolean;
    rawText: string;
    error?: string;
    /** true when Ollama endpoint was reachable but returned an error body */
    isEndpointError?: boolean;
}

/**
 * Sends a single generation request to the Ollama /api/generate endpoint.
 * Returns the raw text response string for downstream parsing.
 *
 * @param config  OllamaClientConfig — endpoint, model, timeout
 * @param prompt  Fully-formed prompt string
 * @param temperature  Optional sampling temperature
 * @param maxTokens   Optional max tokens
 */
export async function ollamaGenerate(
    config: OllamaClientConfig,
    prompt: string,
    temperature?: number,
    maxTokens?: number
): Promise<OllamaClientResult> {
    const url = `${config.endpointUrl.replace(/\/$/, "")}/api/generate`;
    const timeoutMs = config.timeoutMs ?? 60_000;

    const payload: OllamaGeneratePayload = {
        model: config.modelName,
        prompt,
        stream: false,
        options: {},
    };

    if (temperature !== undefined) {
        payload.options!.temperature = temperature;
    }
    if (maxTokens !== undefined) {
        payload.options!.num_predict = maxTokens;
    }

    // Use AbortController for timeout
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
                error: `Ollama endpoint returned HTTP ${res.status}: ${errBody}`,
                isEndpointError: true,
            };
        }

        const json: OllamaGenerateRawResponse = await res.json();

        if (!json.response || typeof json.response !== "string") {
            return {
                success: false,
                rawText: "",
                error: "Ollama response is missing or has an invalid 'response' field.",
                isEndpointError: true,
            };
        }

        return { success: true, rawText: json.response };
    } catch (err: unknown) {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : String(err);

        if (message.includes("abort") || message.includes("signal")) {
            return {
                success: false,
                rawText: "",
                error: `Ollama request timed out after ${timeoutMs}ms.`,
            };
        }

        return {
            success: false,
            rawText: "",
            error: `Ollama connection failed: ${message}`,
        };
    }
}

/**
 * Pings the Ollama /api/tags endpoint to check server availability.
 * Returns true if reachable, false otherwise.
 */
export async function ollamaPing(endpointUrl: string, timeoutMs = 3_000): Promise<boolean> {
    const url = `${endpointUrl.replace(/\/$/, "")}/api/tags`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, { method: "GET", signal: controller.signal });
        clearTimeout(timer);
        return res.ok;
    } catch {
        clearTimeout(timer);
        return false;
    }
}
