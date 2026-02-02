#!/bin/bash
# Fix corrupted files by removing duplicate content starting with "} * " pattern

files=(
  "lib/browser-automation.ts"
  "lib/cache/cache-manager.ts"
  "lib/cache/index.ts"
  "lib/cache/performance-optimizer.ts"
  "lib/chrome-api-wrappers.ts"
  "lib/client-api.ts"
  "lib/commands/parser.ts"
  "lib/commands/types.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Find line number of corruption pattern
    corrupt_line=$(grep -n "^} \* " "$file" | head -1 | cut -d: -f1)
    
    if [ -n "$corrupt_line" ]; then
      # Keep only content before corruption (minus 1 for the closing brace)
        head -$((corrupt_line - 1)) "$file" > "$file.fixed"
        mv "$file.fixed" "$file"
      echo "Fixed: $file (removed lines from $corrupt_line)"
    else
      echo "No corruption pattern found in: $file"
    fi
  fi
done
