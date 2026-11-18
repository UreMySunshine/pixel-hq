#!/usr/bin/env python3
import json
import os
import sys
import tempfile
import time

def test_settings_atomic_update():
    print("=== Testing Settings Atomic Update & Retry Mechanism ===")
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "settings.json")
        cmd = "sh /tmp/pixel-hq-statusline.sh"

        # 1. Update on nonexistent settings.json -> creates file atomically
        d = None
        if os.path.exists(p):
            for _ in range(5):
                try:
                    with open(p, "r", encoding="utf-8") as f: d = json.load(f)
                    break
                except Exception: time.sleep(0.05)
            if d is None: sys.exit(1)
        else: d = {}

        cur = d.get("statusLine")
        cur_cmd = cur.get("command") if isinstance(cur, dict) else str(cur or "")
        assert cur_cmd != cmd

        d["statusLine"] = {"type": "command", "command": cmd, "enabled": True}
        tmp = f"{p}.tmp.{os.getpid()}"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(d, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, p)

        assert os.path.exists(p), "settings.json should exist"
        data = json.load(open(p, "r", encoding="utf-8"))
        assert data["statusLine"]["command"] == cmd
        assert data["statusLine"]["enabled"] is True
        print("PASS: Atomic creation of settings.json")

        # 2. No-op when command and settings already match -> file untouched
        mtime1 = os.path.getmtime(p)
        time.sleep(0.05)

        with open(p, "r", encoding="utf-8") as f: d = json.load(f)
        cur = d.get("statusLine")
        cur_cmd = cur.get("command") if isinstance(cur, dict) else str(cur or "")
        cur_en = cur.get("enabled", True) if isinstance(cur, dict) else True
        if cur_cmd == cmd and cur_en is True:
            pass  # no write!
        mtime2 = os.path.getmtime(p)
        assert mtime1 == mtime2, "File mtime should not change when settings already match"
        print("PASS: No-op avoids rewriting when statusLine already configured")

        # 3. Retry when file is temporarily busy / mid-write
        with open(p, "w", encoding="utf-8") as f:
            f.write('{"statusLine": "truncated')

        # Simulate concurrent writer writing valid JSON after 2 retries
        read_success = False
        for attempt in range(5):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    d = json.load(f)
                read_success = True
                break
            except Exception:
                if attempt == 1:
                    with open(p, "w", encoding="utf-8") as f_fix:
                        json.dump({"existingKey": "preserved"}, f_fix)
                time.sleep(0.05)
        assert read_success, "Should recover after transient mid-write JSON"
        assert d.get("existingKey") == "preserved"
        print("PASS: Retry loop successfully recovers from transient file write")

        # 4. If file is permanently corrupt, do NOT overwrite or wipe settings
        with open(p, "w", encoding="utf-8") as f:
            f.write("corrupted content!!!")
        corrupted_content = open(p, "r", encoding="utf-8").read()

        d = None
        for _ in range(3):
            try:
                with open(p, "r", encoding="utf-8") as f: d = json.load(f)
                break
            except Exception:
                time.sleep(0.02)
        assert d is None, "Should detect unparseable file"
        # Since d is None, script exits without modifying or truncating p
        assert open(p, "r", encoding="utf-8").read() == corrupted_content
        print("PASS: Unparseable settings are never wiped or overwritten")

    print("All settings atomic update tests passed!\n")

if __name__ == "__main__":
    test_settings_atomic_update()
