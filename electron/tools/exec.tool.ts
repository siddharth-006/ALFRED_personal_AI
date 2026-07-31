import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export class ExecTool {
    public async runCommand(command: string, cwd?: string): Promise<ExecutionResult> {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd });
            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0,
            };
        } catch (error: unknown) {
            const err = error as { stdout?: string; stderr?: string; code?: number; message?: string };
            return {
                stdout: err.stdout?.trim() || "",
                stderr: err.stderr?.trim() || err.message || "Execution error",
                exitCode: err.code ?? 1,
            };
        }
    }
}

export const execTool = new ExecTool();
