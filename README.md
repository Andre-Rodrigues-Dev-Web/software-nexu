# Velance System Care

Defensive desktop maintenance application for Windows built with Electron, Node.js, Express, SQLite, HTML, SCSS, and Vanilla JavaScript.

## Core Principles

- Defensive and administrative only
- Transparent actions and local audit logging
- Explicit user confirmation for cleanup execution
- No hidden persistence or security bypass behavior
- Official Windows tooling paths only for diagnostics orchestration

## Architecture

- `main/` Electron main process and secure BrowserWindow boot
- `preload/` context-isolated API bridge
- `renderer/` pages, SCSS, and Vanilla JS UI logic
- `server/` local Express internal API endpoints
- `services/` business logic and OS integration adapters
- `database/` SQLite schema, setup, and repositories
- `tests/` unit tests, mocks, and route tests
- `assets/` branding placeholders

## Modules Included

- Dashboard summary cards and usage chart
- Performance analyzer with findings and recommendations
- Cleanup center with candidate preview and explicit confirmation
- Security center using defensive status checks
- Driver diagnostics and restore point warning guidance
- Software update assistance using official-source guidance
- Maintenance history filters and CSV/PDF export
- Settings persistence with configurable preferences
- About screen with compliance and integration TODOs

## Database Tables

- `settings`
- `action_logs`
- `system_snapshots`
- `cleanup_reports`
- `security_scans`
- `detected_items`
- `driver_reports`
- `software_update_reports`
- `notifications`

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The start scripts rebuild native modules for Electron automatically before opening the app.

## Build SCSS

```bash
npm run build:css
```

## Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

The test suite mocks or isolates side effects where practical and focuses on service logic, validations, normalization, repository behavior, and Express controller behavior.

If you need to run tests after Electron rebuilds native modules, rebuild for Node runtime manually:

```bash
npm run rebuild:node
```

## Native Module Troubleshooting (better-sqlite3 ABI mismatch)

If you see `NODE_MODULE_VERSION` mismatch errors between Node and Electron:

```bash
Get-Process node,electron -ErrorAction SilentlyContinue | Stop-Process -Force
npm run rebuild:electron
```

This rebuilds `better-sqlite3` for the Electron runtime used by this project.

## Windows Commands and Fallback Handling

- Security and diagnostics modules use documented Windows commands through PowerShell.
- If a command is unavailable or blocked, services return safe fallback responses without forcing actions.
- No destructive behavior runs without explicit user action and confirmation.

## Important TODO Markers

- TODO: Integrate vendor-trusted antivirus CLI adapters when installed.
- TODO: Expand software version intelligence through official vendor feeds.
- TODO: Add optional restore point automation via official Windows mechanisms after explicit consent.
