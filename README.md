# Event Countdown Timer

A professional event countdown timer application for conferences, meetings, and live events — similar to stagetimer.io.

## Features

- **Multiple Sessions** — Add, edit, remove, and reorder sessions
- **Full-Screen Display** — A separate display window for projecting to screens
- **Colour Phases** — Automatically changes: 🟢 Green → 🟡 Amber → 🔴 Red
- **Live Time Adjustment** — Add or remove minutes while the timer is running
- **Count-Up Mode** — Optionally count upward (overtime) after reaching zero
- **On-Screen Messages** — Show custom messages on the display
- **Progress Bar** — Depletes as the timer counts down
- **Fully Customisable** — Fonts, colours, size, thresholds

## Keyboard Shortcuts (Control Panel)

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `R` | Reset timer |
| `Shift + ←` | -1 minute |
| `Shift + →` | +1 minute |

## Requirements

- **Node.js** v18 or newer — download from [nodejs.org](https://nodejs.org/)

## Installation

### Quick Start (run from source)
1. Install Node.js from https://nodejs.org/
2. Double-click `setup.bat` to install dependencies
3. Run `npm start` to launch the application

### Build Windows Installer
1. Complete the Quick Start steps above
2. Run: `npm run build`
3. Find the installer in the `dist/` folder
4. Run the installer to install the app

## Usage

When you launch the app, two windows appear:

1. **Display Window** (full screen) — Project this to your audience screen
2. **Control Panel** — Use this to control everything

### Control Panel Sections

**Sessions Panel** (left)
- Click a session to load it
- Click ✏ to edit, ✕ to delete
- Click "+ Add Session" to create new sessions

**Timer Controls** (centre)
- ⏮ / ⏭ — Previous / Next session
- ▶ / ⏸ — Play / Pause
- ⏹ — Reset
- -5m / -1m / +1m / +5m / +10m — Adjust time while running

**Message** — Type a message and click SHOW to display it on screen

**Settings** (right)
- **Colors** — Customise colours for each phase
- **Font** — Choose font family and sizes
- **Timing** — Set when amber/red warnings trigger
- **Display** — Toggle count-up and progress bar

## Colour Phase Defaults

| Phase | Triggers at |
|-------|-------------|
| 🟢 Green | Start of session |
| 🟡 Amber | 5 minutes remaining |
| 🔴 Red | 1 minute remaining |

These can be changed in Settings → Timing.
