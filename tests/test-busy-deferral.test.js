const assert = require("node:assert");

function runTests() {
  console.log("=== Running Multi-Agent Busy Deferral & Idle Trigger Tests ===");

  // Simulated agent store
  let mockAgents = [];

  function isBusy(pattern) {
    try {
      if (!Array.isArray(mockAgents)) return false;
      return mockAgents.some((a) => {
        const name = String(a.program?.key ?? a.report?.app ?? a.status?.app ?? a.app ?? a.name ?? "").toLowerCase();
        return pattern.test(name) && (a.status === "working" || a.status === "typing");
      });
    } catch {
      return false;
    }
  }

  // Test 1: Verify isBusy detects all 4 agents when working or typing
  mockAgents = [
    { program: { key: "claude" }, status: "working" },
    { program: { key: "opencode" }, status: "typing" },
    { program: { key: "agy" }, status: "working" },
    { program: { key: "codex" }, status: "typing" },
  ];

  assert.strictEqual(isBusy(/claude/), true, "Claude should be busy");
  assert.strictEqual(isBusy(/opencode/), true, "OpenCode should be busy");
  assert.strictEqual(isBusy(/antigravity|agy/), true, "Antigravity/agy should be busy");
  assert.strictEqual(isBusy(/codex/), true, "Codex should be busy");
  console.log("PASS: isBusy accurately detects working & typing for all 4 agents (OpenCode, Claude, Antigravity, Codex)");

  // Test 2: Verify isBusy returns false when agents are idle, done, or blocked
  mockAgents = [
    { program: { key: "claude" }, status: "idle" },
    { program: { key: "opencode" }, status: "done" },
    { program: { key: "antigravity" }, status: "blocked" },
    { program: { key: "codex" }, status: "idle" },
  ];

  assert.strictEqual(isBusy(/claude/), false, "Claude idle should not be busy");
  assert.strictEqual(isBusy(/opencode/), false, "OpenCode done should not be busy");
  assert.strictEqual(isBusy(/antigravity|agy/), false, "Antigravity blocked should not be busy");
  assert.strictEqual(isBusy(/codex/), false, "Codex idle should not be busy");
  console.log("PASS: isBusy returns false when agents are idle, done, or blocked (safe window for setup)");

  // Test 3: Simulated deferred setup manager
  class SetupManager {
    constructor() {
      this.pendingSetupClaude = false;
      this.pendingSetupAntigravity = false;
      this.pendingSetupOpenCode = false;
      this.pendingSetupCodex = false;
      this.lastSetupClaudeAttempt = 0;
      this.lastSetupAntigravityAttempt = 0;
      this.lastSetupOpenCodeAttempt = 0;
      this.lastSetupCodexAttempt = 0;
      this.executed = { claude: 0, antigravity: 0, opencode: 0, codex: 0 };
    }

    setupClaude() {
      this.lastSetupClaudeAttempt = Date.now();
      if (isBusy(/claude/)) {
        this.pendingSetupClaude = true;
        return;
      }
      this.executed.claude++;
      this.pendingSetupClaude = false;
    }

    setupAntigravity() {
      this.lastSetupAntigravityAttempt = Date.now();
      if (isBusy(/antigravity|agy/)) {
        this.pendingSetupAntigravity = true;
        return;
      }
      this.executed.antigravity++;
      this.pendingSetupAntigravity = false;
    }

    setupOpenCode() {
      this.lastSetupOpenCodeAttempt = Date.now();
      if (isBusy(/opencode/)) {
        this.pendingSetupOpenCode = true;
        return;
      }
      this.executed.opencode++;
      this.pendingSetupOpenCode = false;
    }

    setupCodex() {
      this.lastSetupCodexAttempt = Date.now();
      if (isBusy(/codex/)) {
        this.pendingSetupCodex = true;
        return;
      }
      this.executed.codex++;
      this.pendingSetupCodex = false;
    }

    tick(now) {
      if (this.pendingSetupClaude && now - this.lastSetupClaudeAttempt > 4000 && !isBusy(/claude/)) {
        this.setupClaude();
      }
      if (this.pendingSetupAntigravity && now - this.lastSetupAntigravityAttempt > 4000 && !isBusy(/antigravity|agy/)) {
        this.setupAntigravity();
      }
      if (this.pendingSetupOpenCode && now - this.lastSetupOpenCodeAttempt > 4000 && !isBusy(/opencode/)) {
        this.setupOpenCode();
      }
      if (this.pendingSetupCodex && now - this.lastSetupCodexAttempt > 4000 && !isBusy(/codex/)) {
        this.setupCodex();
      }
    }
  }

  const mgr = new SetupManager();

  // All 4 agents are initially busy
  mockAgents = [
    { program: { key: "claude" }, status: "working" },
    { program: { key: "opencode" }, status: "working" },
    { program: { key: "antigravity" }, status: "working" },
    { program: { key: "codex" }, status: "working" },
  ];

  mgr.setupClaude();
  mgr.setupAntigravity();
  mgr.setupOpenCode();
  mgr.setupCodex();

  // Assert nothing was executed because all 4 are busy!
  assert.strictEqual(mgr.executed.claude, 0);
  assert.strictEqual(mgr.executed.antigravity, 0);
  assert.strictEqual(mgr.executed.opencode, 0);
  assert.strictEqual(mgr.executed.codex, 0);
  assert.strictEqual(mgr.pendingSetupClaude, true);
  assert.strictEqual(mgr.pendingSetupAntigravity, true);
  assert.strictEqual(mgr.pendingSetupOpenCode, true);
  assert.strictEqual(mgr.pendingSetupCodex, true);
  console.log("PASS: While agents are busy, all setups are deferred safely without modifying files");

  // Tick before 4 seconds -> throttle prevents premature retry
  mgr.tick(Date.now() + 1000);
  assert.strictEqual(mgr.executed.claude, 0);

  // Now all agents finish their turns and become idle
  mockAgents = [
    { program: { key: "claude" }, status: "idle" },
    { program: { key: "opencode" }, status: "idle" },
    { program: { key: "antigravity" }, status: "idle" },
    { program: { key: "codex" }, status: "idle" },
  ];

  // Tick after 4.5 seconds -> all 4 pending setups execute safely!
  mgr.tick(Date.now() + 5000);

  assert.strictEqual(mgr.executed.claude, 1);
  assert.strictEqual(mgr.executed.antigravity, 1);
  assert.strictEqual(mgr.executed.opencode, 1);
  assert.strictEqual(mgr.executed.codex, 1);
  assert.strictEqual(mgr.pendingSetupClaude, false);
  assert.strictEqual(mgr.pendingSetupAntigravity, false);
  assert.strictEqual(mgr.pendingSetupOpenCode, false);
  assert.strictEqual(mgr.pendingSetupCodex, false);
  console.log("PASS: Once agents become idle, pending setups execute cleanly for all 4 agents");

  console.log("All Multi-Agent Busy Deferral & Idle Trigger tests passed!\n");
}

runTests();
