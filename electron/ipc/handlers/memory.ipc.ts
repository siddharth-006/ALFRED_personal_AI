/**
 * ALFRED Phase 5.7: Memory & Personalization IPC Handlers
 *
 * Exposes controlled memory inspection, updating, and removal to the renderer process.
 */

import { ipcMain } from "electron";
import { memoryService } from "../../agent/memory/memory.service";
import { MemoryCategory, MemoryItem } from "../../agent/memory/memory.types";
import { logger } from "../../utils/logger";

export const MEMORY_CHANNELS = {
    GET_ALL: "memory:get-all",
    GET_BY_ID: "memory:get-by-id",
    SAVE: "memory:save",
    UPDATE: "memory:update",
    DELETE: "memory:delete",
    CLEAR: "memory:clear",
} as const;

export function registerMemoryIpcHandlers(): void {
    logger.info("Registering Memory IPC Handlers...");

    ipcMain.handle(MEMORY_CHANNELS.GET_ALL, async (_event, options?: { enabledOnly?: boolean; category?: MemoryCategory }) => {
        try {
            return memoryService.getAll(options);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to retrieve memories";
            logger.error(`MemoryIPC: getAll failed -> ${message}`);
            return [];
        }
    });

    ipcMain.handle(MEMORY_CHANNELS.GET_BY_ID, async (_event, id: string) => {
        try {
            return memoryService.getById(id) || null;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to get memory";
            logger.error(`MemoryIPC: getById failed -> ${message}`);
            return null;
        }
    });

    ipcMain.handle(MEMORY_CHANNELS.SAVE, async (_event, item: { category: MemoryCategory; content: string; metadata?: Record<string, string> }) => {
        try {
            return memoryService.save(item);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save memory";
            logger.error(`MemoryIPC: save failed -> ${message}`);
            return { success: false, error: message };
        }
    });

    ipcMain.handle(MEMORY_CHANNELS.UPDATE, async (_event, id: string, updates: Partial<MemoryItem>) => {
        try {
            return memoryService.update(id, updates);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update memory";
            logger.error(`MemoryIPC: update failed -> ${message}`);
            return { success: false, error: message };
        }
    });

    ipcMain.handle(MEMORY_CHANNELS.DELETE, async (_event, id: string) => {
        try {
            return memoryService.delete(id);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete memory";
            logger.error(`MemoryIPC: delete failed -> ${message}`);
            return { success: false, error: message };
        }
    });

    ipcMain.handle(MEMORY_CHANNELS.CLEAR, async () => {
        try {
            memoryService.clear();
            return { success: true };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to clear memories";
            logger.error(`MemoryIPC: clear failed -> ${message}`);
            return { success: false, error: message };
        }
    });
}
