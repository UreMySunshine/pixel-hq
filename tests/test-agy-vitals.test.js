const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../mods/company-agents/main.js"), "utf8");
const collector = source.slice(source.indexOf("const AGY_VITALS_PY"), source.indexOf("export default class Agents"));
const scan = source.slice(source.indexOf("  async scanCodex("), source.indexOf("  async agyQuota("));

const runWithOpenFiles = (command, args, home, files) => spawnSync(command, ["-I", "-c", `
import json, subprocess, sys
from unittest.mock import patch
script, argument, files = sys.argv[1:]
sys.argv = ["-c", argument]
with patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.loads(files), "")):
    exec(script)
`, args[1], args[2], JSON.stringify(files.map((file) => `n${file}\n`).join(""))], {
  env: { ...process.env, AGY_HOME: home }, encoding: "utf8",
});

test("同目录的 agy 终端按前台进程读取各自的会话", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pixel-hq-agy-"));
  try {
    const cwd = path.join(home, "workspace");
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const locks = ids.map((id) => path.join(home, "presence", `${id}.lock`));
    fs.mkdirSync(path.join(home, "presence"));
    ids.forEach((conversationId, i) => {
      fs.writeFileSync(locks[i], "");
      const logs = path.join(home, "brain", conversationId, ".system_generated", "logs");
      fs.mkdirSync(logs, { recursive: true });
      fs.writeFileSync(path.join(logs, "transcript.jsonl"), JSON.stringify({
        input_tokens: 1000, cache_read_tokens: [179000, 505000][i], model: `gemini-${i}`,
      }) + "\n");
    });
    fs.writeFileSync(path.join(home, "history.jsonl"), ids.map((conversationId) => JSON.stringify({ workspace: cwd, conversationId })).join("\n") + "\n");

    const agents = ["t1", "lab/t2", "t3", "t4", "t5"].map((address) => ({ address, pane: address, program: { key: "agy" } }));
    const pids = new Map(agents.map(({ address }, i) => [address, 100 + i]));
    const files = new Map([
      ["100", [locks[0], path.join(home, "brain", ids[1])]],
      ["101", [locks[1], locks[1]]],
      ["102", locks],
    ]);
    const published = new Map();
    const view = vm.runInNewContext(`${collector}\nnew class {${scan}}()`, {
      agents: () => agents,
      panes: () => agents.map(({ pane }) => ({ pane, cwd })),
      spaces: () => [],
      terminals: () => [
        { address: "t3", labels: { "agy.context": "51", "agent.context": "51" } },
        { address: "t5", labels: { "agy.status.context": "27", "agy.status.model": "gemini-status" } },
      ],
      progOf: (agent) => agent.program?.key ?? "",
      window: () => ({ platform: process.platform }),
      hc: async ([op, address, ...args]) => {
        if (op === "get") return { code: 0, stdout: JSON.stringify({ foreground: { pid: pids.get(address) } }) };
        published.set(address, Object.fromEntries(args.map((arg) => arg.split("="))));
        return { code: 0 };
      },
      exec: async (command, args) => {
        const result = runWithOpenFiles(command, args, home, files.get(args[2]) ?? []);
        if (result.error) throw result.error;
        return { code: result.status, stdout: result.stdout };
      },
    });
    view.ctxRead = new Map();
    view.agyQuota = async () => null;
    await view.scanCodex({ notify() {} });

    assert.deepEqual(agents.map(({ address }) => view.ctxRead.get(address)?.pct ?? null), [18, 51, null, null, null]);
    assert.deepEqual(agents.map(({ address }) => published.get(address)?.["agy.context"]), ["18", "51", "", "", "27"]);
    assert.equal(published.get("t5")["agy.model"], "gemini-status");
    assert.equal(published.has("t2"), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
