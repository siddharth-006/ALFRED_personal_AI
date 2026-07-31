"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execTool = exports.ExecTool = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ExecTool {
    async runCommand(command, cwd) {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd });
            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0,
            };
        }
        catch (error) {
            const err = error;
            return {
                stdout: err.stdout?.trim() || "",
                stderr: err.stderr?.trim() || err.message || "Execution error",
                exitCode: err.code ?? 1,
            };
        }
    }
}
exports.ExecTool = ExecTool;
exports.execTool = new ExecTool();
