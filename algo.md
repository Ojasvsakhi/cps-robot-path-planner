# D* Lite Algorithm Overview

## What D* Lite is

D* Lite is a dynamic pathfinding algorithm designed for environments where the map can change while the robot is moving.
It is often used in robotics because it can reuse previous search work, update only affected nodes, and replan quickly when obstacles appear.

## Core idea

- Plan a path from the goal to the robot’s current position (reverse search)
- Maintain a cost estimate for each node based on distance and predicted future changes
- When the map changes, update only the nodes affected by the change
- Recompute the path efficiently without planning from scratch every time

## Key concepts

- `g(s)` value: current best-known cost from state `s` to the goal
- `rhs(s)` value: one-step lookahead cost for state `s`
- `priority queue`: nodes are expanded in order of their estimated usefulness for replanning
- heuristic: typically the Manhattan distance on a grid

## Why reverse search

D* Lite works from the goal toward the start because when the robot moves, the goal stays fixed.
This means replanning after a local obstacle change can be done using the existing path information centered on the goal.

## How it works step by step

1. Initialize the planner with the current map and goal location.
2. Compute an initial path from the goal to the robot’s current position.
3. Follow the path until the robot detects a change (new obstacle or freed cell).
4. Update the cost of the affected cell(s).
5. Recompute the shortest path using only changed nodes and their neighbors.
6. Continue execution with the updated path.

## Grid-based path planning

In this project, the planner works on a 2D grid.
Each cell can be:

- free space (`0`)
- obstacle (`1`)

The robot can move in 4 directions: up, down, left, right.

## Heuristic used

The planner uses Manhattan distance as the heuristic:

```python
abs(x1 - x2) + abs(y1 - y2)
```

This is admissible for 4-directional movement and gives a good estimate of remaining cost.

## Dynamic replanning behavior

When the robot encounters an obstacle on its current path:

- the planner marks the obstacle on the grid
- it recomputes a new path from the robot’s position to the goal
- if no path exists, the task becomes unreachable

This is the same reactive behavior that D* Lite enables in true dynamic environments.

## Simplified implementation notes

The current `DStarLitePlanner` is a simplified version of the idea:

- it stores a copy of the grid
- it plans from the goal to the robot start
- it uses a priority queue to expand nodes by estimated cost
- it updates the path when obstacles appear

The implementation does not include the full `g`/`rhs` consistency bookkeeping of classical D* Lite,
but it captures the essential behavior of dynamic replanning and reverse search.

## Why D* Lite is useful here

- Robot tasks can change or become blocked by new walls
- The grid environment is dynamic
- The controller must react quickly without restarting planning from scratch

## Summary

D* Lite is an algorithm for incremental replanning in changing maps.
This project uses a reverse-grid planner and obstacle-aware replanning to mimic that behavior.
The result is a robot that can detect blocked paths, replan around obstacles, and continue moving toward its goal.
