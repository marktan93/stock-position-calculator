# Futures Position Calculator

## Architecture

Single-page React application (Vite) for calculating futures contract position sizes based on budget, risk tolerance, and stop-loss distance.

### Tech Stack

- **Framework**: React 19 + Vite
- **Language**: JavaScript (JSX)
- **Styling**: Vanilla CSS (dark theme, CSS custom properties)
- **State persistence**: localStorage

### Project Structure

```
src/
├── main.jsx            # Entry point, renders <App />
├── App.jsx             # Main calculator component (all UI + logic)
├── App.css             # Component styles
├── index.css           # Global styles, CSS variables, reset
├── data/
│   └── contracts.js    # Futures contract specifications (tick size, tick value, margin, etc.)
└── assets/             # Static assets
```

### Key Concepts

- **Contract specs** (`src/data/contracts.js`): Each futures contract defines `tickSize`, `tickValue`, `pointValue`, and `margin`. Adding a new contract only requires adding an entry to this array.
- **Two calculation modes**:
  - *Risk-Based*: Given a budget, risk %, and stop-loss in ticks/points → max contracts
  - *Margin-Based*: Given a budget and margin per contract → max contracts
- **Unit toggles**: Stop-loss accepts ticks or points; risk accepts % or USD. Conversions use the selected contract's tick size.
- **localStorage**: All input values are saved to `futures-calc-state` and restored on reload.
- **Comparison table**: Shows position sizing across all contracts for the same stop-loss, so the user can compare E-mini vs Micro at a glance.

### Build & Run

```sh
npm install
npm run dev     # Dev server at http://localhost:5173
npm run build   # Production build to dist/
```

## Conventions

- All component logic lives in `App.jsx` — no routing, no component library.
- Contract data is separated from UI in `src/data/`.
- CSS uses custom properties defined in `index.css` (:root).
- No external UI libraries; keep dependencies minimal.

## Workflow

- After completing work, always commit and push to remote.
