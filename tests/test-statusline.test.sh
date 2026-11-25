#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATUSLINE="$REPO_DIR/mods/company-agents/claude-statusline.sh"

echo "=== Running statusline tests on $STATUSLINE ==="

# Mock hc binary to capture label calls
MOCK_BIN="$SCRIPT_DIR/mock_bin"
mkdir -p "$MOCK_BIN"
MOCK_LOG="$SCRIPT_DIR/mock_hc.log"
rm -f "$MOCK_LOG"

cat << 'EOF' > "$MOCK_BIN/hc"
#!/bin/sh
if [ "$1" = "label" ]; then
  shift
  term="$1"
  shift
  for arg in "$@"; do
    case "$arg" in
      *=*) ;;
      *)
        echo "error: invalid value '$arg' for '<K=V>...': expected key=value, got \"$arg\"" >&2
        exit 2
        ;;
    esac
  done
  echo "hc label $term $@" >> "$MOCK_HC_LOG"
fi
exit 0
EOF
chmod +x "$MOCK_BIN/hc"

export PATH="$MOCK_BIN:$PATH"
export HC_TERMINAL_ID="test_t99"
export MOCK_HC_LOG="$MOCK_LOG"

FAILURES=0

test_case() {
  local name="$1"
  local input="$2"
  local expected_out_regex="$3"
  local expected_label_regex="$4"

  rm -f "$MOCK_LOG"
  output=$(printf '%s' "$input" | "$STATUSLINE")

  if ! echo "$output" | grep -qE "$expected_out_regex"; then
    echo "FAIL: $name - Output mismatch"
    echo "  Expected regex: $expected_out_regex"
    echo "  Actual output:  $output"
    FAILURES=$((FAILURES + 1))
    return
  fi

  # The script reports its labels from a background process, so it returns before the mock hc has written the log.
  # Wait for the log rather than a fixed delay: on a busy machine the report can take over a second.
  # A case that expects no report waits the same limit, so a late one is still caught.
  local waited=0
  while [ ! -s "$MOCK_LOG" ] && [ "$waited" -lt 100 ]; do
    sleep 0.05
    waited=$((waited + 1))
  done

  local labels=""
  [ -f "$MOCK_LOG" ] && labels=$(cat "$MOCK_LOG")

  # NONE: the script must not report for this payload.
  if [ "$expected_label_regex" = "NONE" ]; then
    if [ -n "$labels" ]; then
      echo "FAIL: $name - Unexpected labels"
      echo "  Expected no labels, got: $labels"
      FAILURES=$((FAILURES + 1))
      return
    fi
    echo "PASS: $name"
    return
  fi

  if [ -n "$expected_label_regex" ] && ! echo "$labels" | grep -qE "$expected_label_regex"; then
    echo "FAIL: $name - Label mismatch"
    echo "  Expected label regex: $expected_label_regex"
    echo "  Actual labels:        $labels"
    FAILURES=$((FAILURES + 1))
    return
  fi

  echo "PASS: $name"
}

# Test 1: Claude Code format
CLAUDE_JSON='{"model":{"id":"claude-3-7-sonnet","display_name":"Claude 3.7 Sonnet"},"context_window":{"used_percentage":42.4},"rate_limits":{"five_hour":{"used_percentage":25}},"effort":{"level":"high"}}'
test_case "Claude Code JSON" "$CLAUDE_JSON" \
  "Claude 3.7 Sonnet · 42% context · 75% 5h left" \
  "agent\.context=42.*agent\.model=Claude 3\.7 Sonnet.*agent\.quota=75"

# Test 2: Antigravity format (Gemini quota)
AGY_JSON='{"model":{"id":"Gemini 3.8 Flash (High)","display_name":"Gemini 3.8 Flash (High)"},"context_window":{"used_percentage":7.045},"quota":{"gemini-5h":{"remaining_fraction":0.959}}}'
test_case "Antigravity JSON (gemini-5h)" "$AGY_JSON" \
  "Gemini 3.8 Flash \(High\) · 7% context · 96% 5h left" \
  "agent\.context=7.*agent\.model=Gemini 3\.8 Flash \(High\).*agent\.quota=96"

# Test 3: Antigravity format (3p quota fallback)
AGY_3P_JSON='{"model":{"id":"Gemini 3.8 Pro","display_name":"Gemini 3.8 Pro"},"context_window":{"used_percentage":15.0},"quota":{"3p-5h":{"remaining_fraction":0.80}}}'
test_case "Antigravity JSON (3p-5h)" "$AGY_3P_JSON" \
  "Gemini 3.8 Pro · 15% context · 80% 5h left" \
  "agent\.context=15.*agent\.model=Gemini 3\.8 Pro.*agent\.quota=80"

# Test 4: Empty / malformed JSON
test_case "Empty JSON" "{}" \
  "^$" \
  ""

# Test 5: Claude Code with string model and effort level
CLAUDE_STR_MODEL='{"model":"opus","context_window":{"used_percentage":25},"rate_limits":{"five_hour":{"used_percentage":10}},"effort":{"level":"high"}}'
test_case "Claude Code String Model" "$CLAUDE_STR_MODEL" \
  "opus · 25% context · 90% 5h left" \
  "agent\.context=25.*agent\.model=opus.*agent\.effort=high"

# Test 6: Claude Code's all-zero placeholder (no tokens at all). Claude Code sends one after every real payload; reporting
# it would rewrite agent.context to 0 and drop the desk's vitals, so the status line still shows it but no label is written.
CLAUDE_ZERO_JSON='{"session_id":"5a472f2a","cwd":"/home/nhat/uctalent","effort":{"level":"high"},"model":{"id":"claude-opus-5-5","display_name":"Opus 5.5"},"context_window":{"total_input_tokens":0,"total_output_tokens":0,"context_window_size":1000000,"current_usage":null,"used_percentage":null,"remaining_percentage":null},"rate_limits":{"five_hour":{"used_percentage":0,"resets_at":1794909600}}}'
test_case "Claude Code all-zero placeholder (no report)" "$CLAUDE_ZERO_JSON" \
  "Opus 5\.5 · 0% context · 100% 5h left" \
  "NONE"

# Test 6b: A real Claude Code payload with the same shape: used_percentage is null and the context comes from the token counts,
# and the model name has a space in it.
CLAUDE_LIVE_JSON='{"session_id":"5a472f2a","cwd":"/home/nhat/uctalent","effort":{"level":"high"},"model":{"id":"claude-opus-5-5","display_name":"Opus 5.5"},"context_window":{"total_input_tokens":234000,"total_output_tokens":6000,"context_window_size":1000000,"current_usage":null,"used_percentage":null,"remaining_percentage":null},"rate_limits":{"five_hour":{"used_percentage":25,"resets_at":1794909600}}}'
test_case "Claude Code Live Payload (null used_percentage, space in model name)" "$CLAUDE_LIVE_JSON" \
  "Opus 5\.5 · 24% context · 75% 5h left" \
  "agent\.context=24.*claude\.context=24.*agent\.model=Opus 5\.5.*claude\.model=Opus 5\.5.*agent\.quota=75.*agent\.effort=high"

# Test 7: Live Antigravity payload (Gemini 3.8 Flash (High) with parenthesized effort)
AGY_LIVE_JSON='{"cwd":"/home/nhat/per","conversation_id":"8542ac38","model":{"id":"Gemini 3.8 Flash (High)","display_name":"Gemini 3.8 Flash (High)","effort":"high"},"context_window":{"total_input_tokens":44922,"total_output_tokens":335298,"context_window_size":1048576,"used_percentage":4.284095764160156},"quota":{"gemini-5h":{"remaining_fraction":0.70575684}}}'
test_case "Antigravity Live Payload (Gemini 3.8 Flash (High))" "$AGY_LIVE_JSON" \
  "Gemini 3\.8 Flash \(High\) · 4% context · 71% 5h left" \
  "agent\.context=4.*agy\.context=4.*agent\.model=Gemini 3\.8 Flash \(High\).*agy\.model=Gemini 3\.8 Flash \(High\).*agent\.quota=71.*agent\.effort=high"

# Clean up
rm -rf "$MOCK_BIN" "$MOCK_LOG"

if [ "$FAILURES" -eq 0 ]; then
  echo "All statusline tests passed!"
  exit 0
else
  echo "$FAILURES statusline test(s) failed."
  exit 1
fi
