# Copilot Instructions for CPS Robot Path Planner

## Project overview
This repository implements a small cyber-physical system simulator for a robot on a 10x10 grid.
The app is a Flask web application that manages tasks, obstacles, battery state, and dynamic replanning.
Path planning is driven by a simplified D* Lite–style reverse search algorithm.

## Key locations
- `app.py` — core system state, Flask API, task queue, battery logic, and background hardware loop.
- `dynamic_path.py` — path planner implementation for dynamic grid replanning.
- `templates/index.html` — browser UI entry point.
- `static/script.js` / `static/style.css` — front-end behavior and styling.
- `algo.md` — algorithm notes and design rationale for D* Lite.

## How to run
1. Activate or create a Python environment in this repo.
2. Install Flask manually, since there is no `requirements.txt` in the repo.
   - `pip install flask`
3. Start the server:
   - `python app.py`
4. Open:
   - `http://127.0.0.1:5000/`

## Runtime behavior
- The app exposes `/` for the UI.
- The UI polls `/api/state` and sends POSTs to `/api/command`.
- Commands are handled by `CPSSystem.process_command()`.
- The robot state is updated continuously in a daemon background thread.
- The charging station is fixed at `(0, 0)` and the grid is `10x10`.

## API / commands
The front-end sends JSON commands with an `action` field such as:
- `add_task`
- `toggle_wall`
- `toggle_power`
- `force_rtb`
- `reset`
- `update_battery`
- `set_execution_mode`
- `push_task` / `ignore_task`

Command payloads may include `x`, `y`, `mode`, `max_battery`, `safety_reserve`, `drain_move`, or `drain_replan`.

## What Copilot should focus on
- Fixing bugs in task handling, replanning, and obstacle updates.
- Improving the planner and making dynamic replanning more robust.
- Enhancing UI behavior and state synchronization between front-end and server.
- Adding tests, dependency management, and project documentation.

## Important conventions
- Use Python 3 and keep dependencies minimal.
- Preserve the separation between the Flask API (`app.py`) and planner logic (`dynamic_path.py`).
- The repo currently has no automated tests or CI configuration.

## Notes for contributors
- Refer to `README.md` for usage guidance.
- Refer to `algo.md` for planner design and D* Lite context.
- If adding new features, keep the UI and API contract stable for `static/script.js`.
