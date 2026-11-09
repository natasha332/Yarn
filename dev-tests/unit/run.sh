#!/usr/bin/env bash
# Runs the small, fast tests of Yarn's own logic (no servers needed).
# First it makes copies of src/lib with the "@/lib/..." imports rewritten so Node can run them directly.
set -u
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$root/dev-tests/.tmp/lib"
rm -rf "$out" && mkdir -p "$out"
for f in "$root"/src/lib/*.ts; do
  sed -E 's#from "@/lib/([^"]+)"#from "./\1.ts"#; s#from "\./([A-Za-z0-9_-]+)"#from "./\1.ts"#' "$f" > "$out/$(basename "$f")"
done
fail=0
for t in "$root"/dev-tests/unit/*.test.mts; do
  log="$(node --experimental-strip-types "$t" 2>&1)"; code=$?
  last="$(printf '%s\n' "$log" | grep -v -E 'Warning|Reparsing|trace-warnings|module"|performance overhead' | tail -1)"
  if [ $code -eq 0 ] && ! printf '%s\n' "$log" | grep -q 'FAIL'; then echo "PASS  $(basename "$t")  ($last)"; else echo "FAIL  $(basename "$t")"; printf '%s\n' "$log" | tail -8; fail=1; fi
done
exit $fail
