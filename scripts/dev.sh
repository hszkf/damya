#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
bun install 2>/dev/null || npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend"
npm install

# Install root dependencies
echo "Installing root dependencies..."
cd "$PROJECT_DIR"
npm install

# Copy Bun binary if not present
if [ ! -f "$PROJECT_DIR/resources/bun-darwin-aarch64" ]; then
  echo "Copying Bun binary..."
  bash "$PROJECT_DIR/scripts/copy-bun.sh"
fi

# Start in dev mode
echo "Starting development mode..."
cd "$PROJECT_DIR"
npx electron-vite dev
