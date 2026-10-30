import test from "node:test";
import assert from "node:assert/strict";
import { extensionToken } from "../src/existing-browser.mjs";

test("explicit process token takes precedence over a saved Windows token", () => {
  assert.equal(
    extensionToken({
      env: { PLAYWRIGHT_MCP_EXTENSION_TOKEN: " process-fixture " },
      platform: "win32",
      query() {
        throw new Error("must not read registry");
      },
    }),
    "process-fixture",
  );
});

test("an existing Windows host can read only the named User environment token", () => {
  let called = false;
  assert.equal(
    extensionToken({
      env: {},
      platform: "win32",
      query(executable, args, options) {
        called = true;
        assert.equal(executable, "reg.exe");
        assert.deepEqual(args, [
          "query",
          "HKCU\\Environment",
          "/v",
          "PLAYWRIGHT_MCP_EXTENSION_TOKEN",
        ]);
        assert.equal(options.windowsHide, true);
        return "HKEY_CURRENT_USER\\Environment\r\n    PLAYWRIGHT_MCP_EXTENSION_TOKEN    REG_SZ    saved-fixture\r\n";
      },
    }),
    "saved-fixture",
  );
  assert.equal(called, true);
});

test("missing, failed and unrelated registry values do not supply a token", () => {
  for (const query of [
    () => "",
    () => "OTHER_TOKEN REG_SZ other",
    () => {
      throw new Error("missing");
    },
  ])
    assert.equal(
      extensionToken({ env: {}, platform: "win32", query }),
      undefined,
    );
  assert.equal(
    extensionToken({
      env: {},
      platform: "linux",
      query() {
        throw new Error("must not query");
      },
    }),
    undefined,
  );
});
