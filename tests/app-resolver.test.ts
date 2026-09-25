import assert from "assert";
import { appResolverTool } from "../electron/tools/app-resolver.tool";

function runTests() {
    console.log("==========================================");
    console.log("   RUNNING SECURE APP RESOLVER TESTS      ");
    console.log("==========================================");

    let passed = 0;
    let failed = 0;

    function test(description: string, fn: () => void) {
        try {
            fn();
            console.log(`✓ PASS: ${description}`);
            passed++;
        } catch (err: unknown) {
            console.error(`✗ FAIL: ${description}`);
            console.error(err);
            failed++;
        }
    }

    // 1. VS Code resolves correctly
    test("1. VS Code resolves to 'code'", () => {
        const result = appResolverTool.resolveApplication("VS Code");
        assert.strictEqual(result.success, true);
        if (result.success) {
            assert.strictEqual(result.executable, "code");
        }
    });

    // 2. Chrome resolves correctly
    test("2. Chrome resolves to 'chrome'", () => {
        const result = appResolverTool.resolveApplication("Chrome");
        assert.strictEqual(result.success, true);
        if (result.success) {
            assert.strictEqual(result.executable, "chrome");
        }
    });

    // 3. Spotify resolves correctly
    test("3. Spotify resolves to 'spotify'", () => {
        const result = appResolverTool.resolveApplication("Spotify");
        assert.strictEqual(result.success, true);
        if (result.success) {
            assert.strictEqual(result.executable, "spotify");
        }
    });

    // 4. Windows Terminal resolves correctly
    test("4. Windows Terminal resolves to 'wt'", () => {
        const result = appResolverTool.resolveApplication("Windows Terminal");
        assert.strictEqual(result.success, true);
        if (result.success) {
            assert.strictEqual(result.executable, "wt");
        }
    });

    // 5. Power BI resolves correctly
    test("5. Power BI resolves to 'PBIDesktop'", () => {
        const result = appResolverTool.resolveApplication("Power BI");
        assert.strictEqual(result.success, true);
        if (result.success) {
            assert.strictEqual(result.executable, "PBIDesktop");
        }
    });

    // 6. Discord resolves correctly (Phase 5.1)
    test("6. Discord resolves to 'discord'", () => {
        const result = appResolverTool.resolveApplication("Discord");
        assert.strictEqual(result.success, true);
        if (result.success) {
            assert.strictEqual(result.executable, "discord");
        }
    });

    // 7. Aliases for supported applications resolve correctly
    test("7. Aliases resolve correctly across all supported applications", () => {
        // VS Code aliases
        for (const alias of ["vs code", "vscode", "visual studio code", "vs_code", "vs-code", "code"]) {
            const res = appResolverTool.resolveApplication(alias);
            assert.strictEqual(res.success, true, `Failed on alias: ${alias}`);
            if (res.success) assert.strictEqual(res.executable, "code");
        }

        // Chrome aliases
        for (const alias of ["chrome", "google chrome", "googlechrome", "google-chrome", "google_chrome"]) {
            const res = appResolverTool.resolveApplication(alias);
            assert.strictEqual(res.success, true, `Failed on alias: ${alias}`);
            if (res.success) assert.strictEqual(res.executable, "chrome");
        }

        // Windows Terminal aliases
        for (const alias of ["windows terminal", "terminal", "wt", "windowsterminal", "windows-terminal", "windows_terminal"]) {
            const res = appResolverTool.resolveApplication(alias);
            assert.strictEqual(res.success, true, `Failed on alias: ${alias}`);
            if (res.success) assert.strictEqual(res.executable, "wt");
        }

        // Spotify alias
        const spotRes = appResolverTool.resolveApplication("spotify");
        assert.strictEqual(spotRes.success, true);
        if (spotRes.success) assert.strictEqual(spotRes.executable, "spotify");

        // Discord alias
        const discRes = appResolverTool.resolveApplication("discord");
        assert.strictEqual(discRes.success, true);
        if (discRes.success) assert.strictEqual(discRes.executable, "discord");
    });

    // 8. Different capitalization works
    test("8. Different capitalization works ('vs code', 'VS CODE', 'cHrOmE', 'dIsCoRd')", () => {
        const res1 = appResolverTool.resolveApplication("vs code");
        assert.strictEqual(res1.success, true);
        if (res1.success) assert.strictEqual(res1.executable, "code");

        const res2 = appResolverTool.resolveApplication("VS CODE");
        assert.strictEqual(res2.success, true);
        if (res2.success) assert.strictEqual(res2.executable, "code");

        const res3 = appResolverTool.resolveApplication("cHrOmE");
        assert.strictEqual(res3.success, true);
        if (res3.success) assert.strictEqual(res3.executable, "chrome");

        const res4 = appResolverTool.resolveApplication("dIsCoRd");
        assert.strictEqual(res4.success, true);
        if (res4.success) assert.strictEqual(res4.executable, "discord");
    });

    // 9. Unknown application is rejected
    test("9. Unknown application is rejected", () => {
        const result = appResolverTool.resolveApplication("Unknown App 99");
        assert.strictEqual(result.success, false);
        if (!result.success) {
            assert.strictEqual(result.executable, null);
            assert.strictEqual(result.error, "Unsupported application.");
        }
    });

    // 10. Malicious command string is rejected
    test("10. Malicious command string is rejected ('VS Code; rm -rf /')", () => {
        const result = appResolverTool.resolveApplication("VS Code; rm -rf /");
        assert.strictEqual(result.success, false);
        if (!result.success) {
            assert.strictEqual(result.executable, null);
            assert.strictEqual(result.error, "Application name contains invalid or unsafe characters.");
        }
    });

    // 11. Shell metacharacters and control sequences are rejected
    test("11. Shell metacharacters are rejected ('`calc`', '$(whoami)', 'code && notepad')", () => {
        const inputs = [
            "`calc`",
            "$(whoami)",
            "code && notepad",
            "chrome | dir",
            "spotify > out.txt",
            "discord < input.txt",
            "wt & notepad",
            "code\nrm -rf /",
            "chrome\r\ncalc",
        ];
        for (const input of inputs) {
            const result = appResolverTool.resolveApplication(input);
            assert.strictEqual(result.success, false, `Failed to reject: ${input}`);
            if (!result.success) {
                assert.strictEqual(result.executable, null);
            }
        }
    });

    // 12. Path traversal and arbitrary executable paths are rejected
    test("12. Path traversal and filesystem paths are rejected", () => {
        const pathInputs = [
            "../../Windows/calc.exe",
            "..\\Windows\\System32\\calc.exe",
            "C:\\Windows\\notepad.exe",
            "C:/Windows/notepad.exe",
            "/usr/bin/code",
            "./code.exe",
            ".\\code.exe",
            "/bin/sh",
        ];
        for (const input of pathInputs) {
            const result = appResolverTool.resolveApplication(input);
            assert.strictEqual(result.success, false, `Path traversal input not rejected: ${input}`);
        }
    });

    // 13. PowerShell syntax and variables are rejected
    test("13. PowerShell syntax and variables are rejected", () => {
        const psInputs = [
            "powershell -Command calc",
            "powershell -c Start-Process calc",
            "$env:LOCALAPPDATA",
            "${env:TEMP}",
            "$(Get-Process)",
            "& 'calc.exe'",
        ];
        for (const input of psInputs) {
            const result = appResolverTool.resolveApplication(input);
            assert.strictEqual(result.success, false, `PowerShell syntax not rejected: ${input}`);
        }
    });

    // 14. Arbitrary .exe names not in whitelist are rejected
    test("14. Arbitrary .exe names are rejected", () => {
        const exeInputs = [
            "calc.exe",
            "cmd.exe",
            "powershell.exe",
            "notepad.exe",
            "regedit.exe",
            "format.exe",
        ];
        for (const input of exeInputs) {
            const result = appResolverTool.resolveApplication(input);
            assert.strictEqual(result.success, false, `Arbitrary exe not rejected: ${input}`);
            if (!result.success) {
                assert.strictEqual(result.error, "Unsupported application.");
            }
        }
    });

    console.log("==========================================");
    console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
    console.log("==========================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
