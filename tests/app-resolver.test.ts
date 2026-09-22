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

    // 6. Different capitalization works
    test("6. Different capitalization works ('vs code', 'VS CODE', 'cHrOmE')", () => {
        const res1 = appResolverTool.resolveApplication("vs code");
        assert.strictEqual(res1.success, true);
        if (res1.success) assert.strictEqual(res1.executable, "code");

        const res2 = appResolverTool.resolveApplication("VS CODE");
        assert.strictEqual(res2.success, true);
        if (res2.success) assert.strictEqual(res2.executable, "code");

        const res3 = appResolverTool.resolveApplication("cHrOmE");
        assert.strictEqual(res3.success, true);
        if (res3.success) assert.strictEqual(res3.executable, "chrome");
    });

    // 7. Unknown application is rejected
    test("7. Unknown application is rejected", () => {
        const result = appResolverTool.resolveApplication("Unknown App 99");
        assert.strictEqual(result.success, false);
        if (!result.success) {
            assert.strictEqual(result.executable, null);
            assert.strictEqual(result.error, "Unsupported application.");
        }
    });

    // 8. Malicious command string is rejected
    test("8. Malicious command string is rejected ('VS Code; rm -rf /')", () => {
        const result = appResolverTool.resolveApplication("VS Code; rm -rf /");
        assert.strictEqual(result.success, false);
        if (!result.success) {
            assert.strictEqual(result.executable, null);
            assert.strictEqual(result.error, "Application name contains invalid or unsafe characters.");
        }
    });

    // 9. Shell metacharacters are never accepted as an executable
    test("9. Shell metacharacters are rejected ('`calc`', '$(whoami)', 'code && notepad')", () => {
        const inputs = ["`calc`", "$(whoami)", "code && notepad", "chrome | dir", "spotify > out.txt"];
        for (const input of inputs) {
            const result = appResolverTool.resolveApplication(input);
            assert.strictEqual(result.success, false, `Failed to reject: ${input}`);
            if (!result.success) {
                assert.strictEqual(result.executable, null);
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
