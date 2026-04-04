# CPS Robot Path Planning

This project is a simple cyber-physical system simulator built with Flask and a grid-based planner.
It simulates a robot operating on a 10x10 grid, managing tasks, obstacles, battery state, and dynamic replanning.

## What it does

- Runs a Flask web app with a live grid view
- Lets the robot accept tasks and navigate on a 10x10 map
- Supports dynamic obstacle handling and replanning
- Manages battery drain, return-to-base logic, and charging
- Uses a planner inspired by D* Lite pathfinding

## Key components

- `app.py` - core system logic, Flask API, task management, state updates
- `dynamic_path.py` - path planner implementation with reverse search from target
- `templates/index.html` - web UI page
- `static/` - UI JS/CSS assets


## Install and run

1. Open a terminal in `Project\CPS`
2. Create or activate your Python environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install flask
```

3. Run the app

```powershell
python app.py
```

4. Open the browser at:

```
http://127.0.0.1:5000/
```

## Recommended dependencies

Create a `requirements.txt` with:

```text
Flask
```

Then install with:

```powershell
pip install -r requirements.txt
```

## How to use

- Add tasks to grid coordinates using the UI
- Toggle walls/obstacles on the map
- Pause or resume the system
- Force return-to-base when the robot needs charging
- Reset the grid to start over

## Notes

- The planner recomputes paths when obstacles are detected
- The web UI polls `/api/state` and sends commands to `/api/command`


