#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BUN_PATH="$(which bun 2>/dev/null || echo "")"

if [ -z "$BUN_PATH" ]; then
  echo "Error: bun not found in PATH"
  exit 1
fi

echo "Found Bun at: $BUN_PATH"
cp "$BUN_PATH" "$PROJECT_DIR/resources/bun-darwin-aarch64"
chmod +x "$PROJECT_DIR/resources/bun-darwin-aarch64"
echo "Copied Bun binary to resources/bun-darwin-aarch64"
