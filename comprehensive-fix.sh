#!/bin/bash

# Function to add missing closing brace
add_closing_brace() {
  local file=$1
  echo "}" >> "$file"
  echo "✓ Added closing brace to: $file"
}

# Function to fix file ending with export corruption
fix_export_end() {
  local file=$1
  local line=$2
  # Keep everything up to and including the export line, but remove " *" suffix
  head -$line "$file" | sed 's/ \*[^/]*$//' > "$file.fixed"
  mv "$file.fixed" "$file"
  echo "✓ Fixed export at line $line in: $file"
}

# Files that need closing braces
add_closing_brace "lib/background/task-processor.ts"
add_closing_brace "lib/cache/index.ts"
add_closing_brace "lib/cache/performance-optimizer.ts"
add_closing_brace "lib/commands/parser.ts"
add_closing_brace "lib/commands/types.ts"
add_closing_brace "lib/commands/validator.ts"

# Files with export corruption at specific lines
fix_export_end "lib/chrome-api-wrappers.ts" 309

echo "Closing braces added"
