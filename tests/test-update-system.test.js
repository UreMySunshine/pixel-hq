const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

async function runTests() {
  console.log("=== Running Update System Background & Pristine Brand Tests ===");

  const brandPath = path.resolve(__dirname, "../mods/company-brand/main.js");
  const brandSrc = fs.readFileSync(brandPath, "utf8");
  const brandUpdaterPath = path.resolve(__dirname, "../mods/company-brand/updater.js");
  const brandSparklesPath = path.resolve(__dirname, "../mods/company-brand/sparkles.svg");

  const agentsUpdaterPath = path.resolve(__dirname, "../mods/company-agents/updater.js");
  const agentsUpdaterSrc = fs.readFileSync(agentsUpdaterPath, "utf8");

  const statusPath = path.resolve(__dirname, "../mods/company-status/main.js");
  const statusSrc = fs.readFileSync(statusPath, "utf8");

  const agentsPath = path.resolve(__dirname, "../mods/company-agents/main.js");
  const agentsSrc = fs.readFileSync(agentsPath, "utf8");

  // 1. Verify company-brand is 100% restored to pristine original state without updater logic
  assert.ok(!fs.existsSync(brandUpdaterPath), "company-brand/updater.js must NOT exist");
  assert.ok(!fs.existsSync(brandSparklesPath), "company-brand/sparkles.svg must NOT exist");
  assert.ok(!brandSrc.includes("updater"), "company-brand/main.js must not import updater");
  assert.ok(!brandSrc.includes("sparkles"), "company-brand/main.js must not reference sparkles");
  assert.ok(!brandSrc.includes("checkPixelHqUpdate"), "company-brand/main.js must not check updates");
  console.log("PASS: company-brand is 100% pristine and free of updater logic");

  // 2. Verify company-agents/updater.js exports check and direct execute functions without modal
  assert.ok(agentsUpdaterSrc.includes("export async function checkPixelHqUpdate"), "updater.js must export checkPixelHqUpdate");
  assert.ok(agentsUpdaterSrc.includes("export async function executePixelHqUpdate"), "updater.js must export executePixelHqUpdate");
  assert.ok(agentsUpdaterSrc.includes("export function isUrgentUpdate"), "updater.js must export isUrgentUpdate helper");
  assert.ok(agentsUpdaterSrc.includes("notify({"), "updater.js must trigger native toast notification");
  assert.ok(agentsUpdaterSrc.includes("timeout: 10000"), "normal toast notification must have 10-second timeout");
  assert.ok(agentsUpdaterSrc.includes("timeout: 30000"), "urgent toast notification must have 30-second timeout");
  assert.ok(agentsUpdaterSrc.includes('level: "warning"'), "urgent toast notification must use warning level");
  assert.ok(agentsUpdaterSrc.includes('level: "info"'), "normal toast notification must use info level");
  assert.ok(agentsUpdaterSrc.includes("Pixel-HQ-Updater"), "GitHub API fetch must include User-Agent header");
  assert.ok(agentsUpdaterSrc.includes("Updating Pixel HQ..."), "updater must notify updating in background");
  assert.ok(agentsUpdaterSrc.includes("Pixel HQ updated!"), "updater must notify updated on completion");
  console.log("PASS: company-agents/updater.js exports background check & execute without modal or progress window");

  // 3. Verify isUrgentUpdate classification
  function testIsUrgent(type) {
    const t = String(type ?? "").toLowerCase().trim();
    return t === "critical" || t === "urgent" || t === "important" || t === "hotfix" || t === "1" || t === "major";
  }
  assert.strictEqual(testIsUrgent("urgent"), true, "urgent must be true");
  assert.strictEqual(testIsUrgent("critical"), true, "critical must be true");
  assert.strictEqual(testIsUrgent("important"), true, "important must be true");
  assert.strictEqual(testIsUrgent("hotfix"), true, "hotfix must be true");
  assert.strictEqual(testIsUrgent("1"), true, "type 1 string must be true");
  assert.strictEqual(testIsUrgent(1), true, "type 1 number must be true");
  assert.strictEqual(testIsUrgent("normal"), false, "normal must be false");
  assert.strictEqual(testIsUrgent("routine"), false, "routine must be false");
  assert.strictEqual(testIsUrgent("2"), false, "type 2 string must be false");
  assert.strictEqual(testIsUrgent(undefined), false, "default undefined must be false");
  console.log("PASS: isUrgentUpdate correctly distinguishes Type 1 from Type 2");

  // 4. Verify company-status status bar pill triggers company-agents.update and shows transition
  assert.ok(statusSrc.includes('id("update-status-pill")'), "company-status must include update-status-pill");
  assert.ok(statusSrc.includes("URGENT UPDATE"), "company-status must show the urgent update label");
  assert.ok(statusSrc.includes(": \"UPDATE\"") && statusSrc.includes("${verText}"), "company-status must show the update label and version for normal type");
  assert.ok(statusSrc.includes('run("company-agents.update")'), "update-status-pill must trigger company-agents.update on click");
  assert.ok(agentsUpdaterSrc.includes("v${curVer} → v${newVer}"), "updater must calculate version transition string (v<old> → v<new>)");
  console.log("PASS: company-status displays update pill and invokes company-agents.update");

  // 5. Verify company-agents integration and direct update execution
  assert.ok(agentsSrc.includes('if (c === "update") this.runUpdate()'), "company-agents must listen to nextCommand for update");
  assert.ok(agentsSrc.includes("executePixelHqUpdate"), "company-agents must import and execute update directly");
  assert.ok(agentsSrc.includes("checkPixelHqUpdate(true)"), "company-agents must check for updates on startup");
  assert.ok(!agentsSrc.includes('Pixel HQ ${this.update.version} is out'), "company-agents office floor must not render intrusive banner");
  console.log("PASS: company-agents executes update directly without modal");

  console.log("All Update System Background & Pristine Brand tests passed!");
}

runTests().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
