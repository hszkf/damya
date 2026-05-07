# Damya Data Analytics Platform

Desktop application for Redshift querying, dashboards, S3 file management, and AWS Glue deployments.

## Installation (macOS)

1. Download `Damya-1.0.0-macOS-arm64.dmg` from the latest release
2. Open the DMG and drag **Damya** to your **Applications** folder
3. Open **Terminal** and run:
   ```bash
   sudo xattr -cr /Applications/Damya.app
   ```
   Enter your Mac password when prompted (characters won't show as you type — that's normal)
4. Launch **Damya** from Applications or Spotlight

> The `xattr` command removes macOS Gatekeeper restrictions for unsigned apps. This is required because the app is not distributed through the Mac App Store.

## Features

- **Redshift Query** — Write and execute SQL queries against Amazon Redshift Serverless
- **Dashboard** — Build charts and visualizations from query results
- **Storage** — Browse, upload, and manage files in S3
- **Deployments** — Create and manage AWS Glue jobs with scheduled triggers and email reports
- **Backend Logs** — Real-time log viewer showing connection status, errors, and application activity

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/) runtime
- macOS (Apple Silicon)

### Setup

```bash
# Install dependencies
npm install
cd backend && bun install && cd ..
cd frontend && npm install && cd ..

# Copy Bun binary for packaging
./scripts/copy-bun.sh

# Start development server
./scripts/dev.sh
```

### Build

```bash
# Build and package DMG
npm run package
```

The DMG will be generated in `dist/Damya-1.0.0-macOS-arm64.dmg`.

## Tech Stack

- **Desktop**: Electron 33 + electron-vite
- **Frontend**: React 19, TanStack Router, Tailwind CSS
- **Backend**: Bun, Hono
- **Infrastructure**: AWS Redshift Serverless, S3, Glue
