#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Running Syntax Validation on All Project Files ==="

FAILURES=0

# 1. Check all JavaScript files
while IFS= read -r f; do
  if ! node -c "$f" 2>&1; then
    echo "FAIL: JavaScript syntax error in $f"
    FAILURES=$((FAILURES + 1))
  fi
done < <(find "$REPO_DIR/mods" "$REPO_DIR/tests" -name "*.js" -o -name "*.mjs")

# 2. Check all JSON files
while IFS= read -r f; do
  if [ -f "$f" ]; then
    if ! python3 -c "import json; json.load(open('$f'))" 2>&1; then
      echo "FAIL: JSON syntax error in $f"
      FAILURES=$((FAILURES + 1))
    fi
  fi
done < <(find "$REPO_DIR/mods" "$REPO_DIR/layouts" "$REPO_DIR/themes" -name "*.json")

# 3. Check all Python files
while IFS= read -r f; do
  if [ -f "$f" ]; then
    if ! python3 -m py_compile "$f" 2>&1; then
      echo "FAIL: Python syntax error in $f"
      FAILURES=$((FAILURES + 1))
    fi
  fi
done < <(find "$REPO_DIR/mods" "$REPO_DIR/tests" -name "*.py")

# 4. Check all Bash scripts
while IFS= read -r f; do
  if [ -f "$f" ]; then
    if ! bash -n "$f" 2>&1; then
      echo "FAIL: Shell script syntax error in $f"
      FAILURES=$((FAILURES + 1))
    fi
  fi
done < <(find "$REPO_DIR/mods" "$REPO_DIR/tests" -name "*.sh")

if [ "$FAILURES" -eq 0 ]; then
  echo "All JavaScript, JSON, Python, and Shell files have 100% valid syntax!"
  exit 0
else
  echo "$FAILURES file(s) failed syntax validation."
  exit 1
fi
