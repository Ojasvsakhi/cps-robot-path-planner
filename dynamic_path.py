import heapq

class DStarLitePlanner:
    def __init__(self, grid_map, target_pos):
        self.grid = [row[:] for row in grid_map]
        self.target = target_pos
        self.rows = len(self.grid)
        self.cols = len(self.grid[0])
        self.start_pos = None

    def manhattan_distance(self, a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def set_start_and_plan(self, start_pos):
        self.start_pos = start_pos
        return self._compute_reverse_path(self.start_pos)

    def update_obstacle(self, x, y, is_obstacle, current_robot_pos):
        if 0 <= x < self.cols and 0 <= y < self.rows:
            self.grid[y][x] = 1 if is_obstacle else 0
            
        return self._compute_reverse_path(current_robot_pos)

    def _compute_reverse_path(self, current_robot_pos):

        if self.target == current_robot_pos:
            return []

        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)] # up, down, left, right
        
        counter = 0
        pq = []
        
        heapq.heappush(pq, (0, counter, self.target))

        came_from = {}
        g_score = {self.target: 0}
        f_score = {self.target: self.manhattan_distance(self.target, current_robot_pos)}

        while pq:
            current_f, _, current = heapq.heappop(pq)

            if current == current_robot_pos:
                path = []
                curr = current_robot_pos

                while curr in came_from:
                    curr = came_from[curr]
                    path.append(curr)
                return path

            for dx, dy in directions:
                nx, ny = current[0] + dx, current[1] + dy
                neighbor = (nx, ny)

                if 0 <= nx < self.cols and 0 <= ny < self.rows:
                    if self.grid[ny][nx] != 1: 
                        tentative_g = g_score[current] + 1
                        
                        if neighbor not in g_score or tentative_g < g_score[neighbor]:
                            came_from[neighbor] = current
                            g_score[neighbor] = tentative_g
                            f_score[neighbor] = tentative_g + self.manhattan_distance(neighbor, current_robot_pos)
                            
                            counter += 1
                            heapq.heappush(pq, (f_score[neighbor], counter, neighbor))

        return []