#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATUSLINE="$REPO_DIR/mods/company-agents/claude-statusline.sh"
CODEX_PY="$REPO_DIR/mods/company-agents/codex-vitals.py"

echo "========================================================="
echo "    Running Real Live E2E Verification Against hc daemon "
echo "========================================================="

if ! command -v hc >/dev/null 2>&1; then
  echo "ERROR: 'hc' command not found in PATH. Cannot run live daemon verification."
  exit 1
fi

# 1. Start a real background terminal via hc to verify live labelling
TEST_NAME="pixel-hq-e2e-val-$$"
echo "Creating real test terminal '$TEST_NAME' via hc..."
LAUNCH_OUT=$(hc run --bg --name "$TEST_NAME" "cat" 2>&1)
TEST_ADDR=$(echo "$LAUNCH_OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("address",""))' 2>/dev/null || echo "$LAUNCH_OUT" | awk '{print $1}')

if [ -z "$TEST_ADDR" ]; then
  echo "ERROR: Failed to launch test terminal via hc: $LAUNCH_OUT"
  exit 1
fi
echo "Live test terminal created at address: $TEST_ADDR"

cleanup() {
  echo "Cleaning up test terminal $TEST_ADDR..."
  hc kill "$TEST_ADDR" >/dev/null 2>&1 || true
  hc rm "$TEST_ADDR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 2. Test Live Claude Code Statusline (Model with spaces, null used_percentage)
echo ""
echo "--- 1. Testing Live Claude Code Statusline ($TEST_ADDR) ---"
CLAUDE_LIVE_JSON='{"session_id":"5a472f2a","cwd":"/home/nhat/uctalent","effort":{"level":"high"},"model":{"id":"claude-opus-5-5","display_name":"Opus 5.5"},"context_window":{"total_input_tokens":0,"total_output_tokens":0,"context_window_size":1000000,"current_usage":null,"used_percentage":null,"remaining_percentage":null},"rate_limits":{"five_hour":{"used_percentage":0,"resets_at":1794909600}}}'

ST_OUT=$(printf '%s' "$CLAUDE_LIVE_JSON" | HC_TERMINAL_ID="$TEST_ADDR" "$STATUSLINE")
echo "Statusline stdout: $ST_OUT"
if [ "$ST_OUT" != "Opus 5.5 · 0% context · 100% 5h left" ]; then
  echo "FAIL: Expected 'Opus 5.5 · 0% context · 100% 5h left', got '$ST_OUT'"
  exit 1
fi

sleep 0.2
HC_JSON=$(hc get "$TEST_ADDR" --json)
echo "Real hc terminal labels: $(echo "$HC_JSON" | python3 -c 'import json, sys; print(json.load(sys.stdin).get("labels", {}))')"

python3 -c "
import json, sys
data = json.loads('''$HC_JSON''')
labels = data.get('labels', {})
assert labels.get('agent.model') == 'Opus 5.5', f'agent.model expected Opus 5.5, got {labels.get(\"agent.model\")}'
assert labels.get('claude.model') == 'Opus 5.5', f'claude.model expected Opus 5.5, got {labels.get(\"claude.model\")}'
assert labels.get('agent.context') == '0', f'agent.context expected 0, got {labels.get(\"agent.context\")}'
assert labels.get('agent.quota') == '100', f'agent.quota expected 100, got {labels.get(\"agent.quota\")}'
assert labels.get('agent.effort') == 'high', f'agent.effort expected high, got {labels.get(\"agent.effort\")}'
print('VERIFIED: Real hc daemon registered all Claude labels including model name with spaces!')
"

# 3. Test Live Antigravity Statusline (Model with spaces and parentheses)
echo ""
echo "--- 2. Testing Live Antigravity Statusline ($TEST_ADDR) ---"
AGY_LIVE_JSON='{"cwd":"/home/nhat/per","conversation_id":"8542ac38","model":{"id":"Gemini 3.8 Flash (High)","display_name":"Gemini 3.8 Flash (High)","effort":"high"},"context_window":{"total_input_tokens":44922,"total_output_tokens":335298,"context_window_size":1048576,"used_percentage":4.284095764160156},"quota":{"gemini-5h":{"remaining_fraction":0.70575684}}}'

ST_OUT_AGY=$(printf '%s' "$AGY_LIVE_JSON" | HC_TERMINAL_ID="$TEST_ADDR" "$STATUSLINE")
echo "Statusline stdout: $ST_OUT_AGY"
if [ "$ST_OUT_AGY" != "Gemini 3.8 Flash (High) · 4% context · 71% 5h left" ]; then
  echo "FAIL: Expected 'Gemini 3.8 Flash (High) · 4% context · 71% 5h left', got '$ST_OUT_AGY'"
  exit 1
fi

sleep 0.2
HC_JSON_AGY=$(hc get "$TEST_ADDR" --json)
python3 -c "
import json
data = json.loads('''$HC_JSON_AGY''')
labels = data.get('labels', {})
assert labels.get('agent.model') == 'Gemini 3.8 Flash (High)', f'agent.model expected Gemini 3.8 Flash (High), got {labels.get(\"agent.model\")}'
assert labels.get('agy.model') == 'Gemini 3.8 Flash (High)', f'agy.model expected Gemini 3.8 Flash (High), got {labels.get(\"agy.model\")}'
assert labels.get('agent.context') == '4', f'agent.context expected 4, got {labels.get(\"agent.context\")}'
assert labels.get('agent.quota') == '71', f'agent.quota expected 71, got {labels.get(\"agent.quota\")}'
assert labels.get('agent.effort') == 'high', f'agent.effort expected high, got {labels.get(\"agent.effort\")}'
print('VERIFIED: Real hc daemon registered all Antigravity labels!')
"

# 4. Test Live Codex Vitals Extraction against actual disk files
echo ""
echo "--- 3. Testing Live Codex Vitals on Actual /home/nhat/uctalent Session ---"
CODEX_RES=$(python3 "$CODEX_PY" "" "/home/nhat/uctalent")
echo "Codex vitals output: $CODEX_RES"

python3 -c "
import json
v = json.loads('''$CODEX_RES''')
assert v.get('model') in ['gpt-6-luna', 'gpt-5.4'], f'Unexpected model: {v.get(\"model\")}'
assert isinstance(v.get('pct'), int), f'pct must be int, got {v.get(\"pct\")}'
assert isinstance(v.get('quota'), int), f'quota must be int, got {v.get(\"quota\")}'
print(f'VERIFIED: Codex real vitals -> model={v.get(\"model\")}, pct={v.get(\"pct\")}%, quota={v.get(\"quota\")}%')
"

# Apply Codex labels to test terminal using cleanAddr logic
pct=$(echo "$CODEX_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("pct") or "")')
model=$(echo "$CODEX_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("model") or "")')
quota=$(echo "$CODEX_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("quota") or "")')

hc label "$TEST_ADDR" \
  "agent.context=$pct" "codex.context=$pct" \
  "agent.model=$model" "codex.model=$model" \
  "agent.quota=$quota" "codex.quota=$quota"

sleep 0.2
HC_JSON_CODEX=$(hc get "$TEST_ADDR" --json)
python3 -c "
import json
data = json.loads('''$HC_JSON_CODEX''')
labels = data.get('labels', {})
assert labels.get('codex.model') == '$model', f'codex.model mismatch'
assert labels.get('agent.model') == '$model', f'agent.model mismatch'
assert labels.get('codex.context') == '$pct', f'codex.context mismatch'
assert labels.get('codex.quota') == '$quota', f'codex.quota mismatch'
print('VERIFIED: Codex real labels successfully applied to live terminal!')
"

echo ""
echo "========================================================="
echo "    ALL REAL LIVE E2E VERIFICATIONS PASSED 100%!         "
echo "========================================================="
