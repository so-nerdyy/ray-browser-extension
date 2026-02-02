#!/bin/bash
# Fix all corrupted files by finding patterns and removing duplicates

# Function to fix a file at a specific line
fix_file_at_line() {
  local file=$1
  local line=$2
  
  if [ -f "$file" ]; then
        # Keep content up to and including the line before corruption
        head -$((line - 1)) "$file" > "$file.fixed"
        mv "$file.fixed" "$file"
    echo "✓ Fixed: $file (truncated at line $line)"
  else
    echo "✗ File not found: $file"
  fi
}

# Fix files with known corruption points
fix_file_at_line "lib/cache/cache-manager.ts" 537
fix_file_at_line "lib/cache/cache-manager.ts" 1497
fix_file_at_line "lib/cache/cache-manager.ts" 1607
fix_file_at_line "lib/cache/cache-manager.ts" 2142
fix_file_at_line "lib/cache/cache-manager.ts" 2567
fix_file_at_line "lib/cache/index.ts" 21
fix_file_at_line "lib/commands/validator.ts" 477

# Fix test files
fix_file_at_line "test/mocks/chrome-api-mocks.ts" 284
fix_file_at_line "test/setup/test-config.ts" 69
fix_file_at_line "test/utils/test-helpers.ts" 221

echo "Done fixing corrupted files"
