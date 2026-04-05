from flask import Flask, render_template, jsonify, request
from dynamic_path import DStarLitePlanner
import threading
import time
import heapq

class CPSSystem:
    def __init__(self):
        self.GRID_WIDTH = 10
        self.GRID_HEIGHT = 10
        self.CHARGING_STATION = (0, 0)
        
        self.max_battery = 100.0
        self.safety_reserve = 5.0  
        self.drain_move = 1.5
        self.drain_idle = 0.2
        self.drain_replan = 5.0
        
        self.state_lock = threading.Lock()
        
        self.reset()
        threading.Thread(target=self._hardware_loop, daemon=True).start()

    def reset(self):
        with self.state_lock:
            self.grid_map = [[0 for _ in range(self.GRID_WIDTH)] for _ in range(self.GRID_HEIGHT)]
            self.robot_pos = self.CHARGING_STATION
            self.task_counter = 1
            self.task_queue = [] 
            self.unreachable_tasks = []
            self.action_required_tasks = []
            self.active_task = None 
            self.current_path = []
            self.distance_traveled = 0.0
            self.planner = None
            self.system_paused = True 
            self.status = "SYSTEM HALTED. ENVIRONMENT RESET."
            self.battery_level = self.max_battery
            self.charging_mode = False
            self.battery_required = 0.0
            self.execution_mode = 'sequential' 

    def _calculate_priority(self, task):
        if self.execution_mode == 'optimal':
            return abs(self.robot_pos[0] - task['pos'][0]) + abs(self.robot_pos[1] - task['pos'][1])
        else:
            return task['id'] 

    def _update_queue_priorities(self):
        new_queue = []
        for _, _, task in self.task_queue:
            priority = self._calculate_priority(task)
            new_queue.append((priority, task['id'], task))
        heapq.heapify(new_queue)
        self.task_queue = new_queue

    def _hardware_loop(self):
        while True:
            if not self.system_paused:
                
                dist_to_base = self.robot_pos[0] + self.robot_pos[1]
                self.battery_required = (dist_to_base * self.drain_move) + 4
                
                if self.battery_level <= 0.0 and self.robot_pos != self.CHARGING_STATION:
                    self.status = "SYS_FAILURE: BATTERY DEPLETED."
                    self.system_paused = True
                    time.sleep(1)
                    continue

                if self.charging_mode and self.robot_pos == self.CHARGING_STATION:
                    if self.battery_level < self.max_battery:
                        charge_rate = self.max_battery * 0.15 
                        self.battery_level = min(self.max_battery, self.battery_level + charge_rate)
                        self.status = f"SYS_CHARGING: {int((self.battery_level/self.max_battery)*100)}%..."
                        time.sleep(0.5)
                        continue
                    else:
                        self.charging_mode = False
                        self.status = "CHARGE COMPLETE. RESUMING QUEUE."
                        time.sleep(1)
                        self._next_task()
                        continue

                if self.battery_level <= self.battery_required and not self.charging_mode and self.robot_pos != self.CHARGING_STATION:
                    if self.active_task and self.active_task['pos'] != self.CHARGING_STATION:
                        with self.state_lock:
                            priority = self._calculate_priority(self.active_task)
                            heapq.heappush(self.task_queue, (priority, self.active_task['id'], self.active_task))
                    
                    self.planner = DStarLitePlanner(self.grid_map, self.CHARGING_STATION)
                    self.current_path = self.planner.set_start_and_plan(self.robot_pos) or []
                    self.active_task = {'id': 'RTB', 'pos': self.CHARGING_STATION}
                    
                    if self.current_path:
                        self.charging_mode = True
                        self.status = f"RTB TRIPPED: Est. Cost {self.battery_required:.1f}%"
                    else:
                        self.unreachable_tasks.append(self.active_task)
                        self.active_task = None
                        self.status = "CRITICAL FAULT: NO PATH TO BASE. STRANDED."
                        self.system_paused = True
                    time.sleep(1)
                    continue

                if self.planner and self.current_path:
                    
                    if self.current_path[0] != self.robot_pos:
                        self.current_path.insert(0, self.robot_pos)
                        
                    if len(self.current_path) > 1:
                        next_pos = self.current_path[1]
                        
                        if self.grid_map[next_pos[1]][next_pos[0]] == 1:
                            self.status = "OBSTACLE DETECTED. REPLANNING..."
                            self.battery_level = max(0.0, self.battery_level - self.drain_replan) 
                            self.current_path = self.planner.update_obstacle(next_pos[0], next_pos[1], 1, self.robot_pos) or []
                            
                            if not self.current_path:
                                self.status = f"PATH BLOCKED. ABORTING TASK #{self.active_task['id']}"
                                if self.active_task['id'] != 'RTB':
                                    with self.state_lock:
                                        self.unreachable_tasks.append(self.active_task)
                                time.sleep(1.5)
                                self._next_task()
                            else:
                                time.sleep(1) 
                            continue

                        self.robot_pos = next_pos
                        self.current_path.pop(0)
                        self.distance_traveled += 1
                        self.battery_level = max(0.0, self.battery_level - self.drain_move) 
                        self.status = f"EXECUTING TASK #{self.active_task['id']}..."
                    else:
                        if self.active_task and self.active_task['id'] != 'RTB':
                            self.status = f"TASK #{self.active_task['id']} COMPLETED."
                        self.robot_pos = self.current_path[0]
                        self.current_path = []
                        self.planner = None
                        time.sleep(1) 
                else:
                    if self.task_queue and not self.charging_mode:
                        self._next_task()
                    else:
                        self.battery_level = max(0.0, self.battery_level - self.drain_idle)
                    
            elif self.system_paused and self.battery_level > 0:
                if "CRITICAL FAULT" not in self.status:
                    self.status = "SYSTEM HALTED."
            time.sleep(0.4) 

    def _next_task(self):
        if self.charging_mode: 
            return 
            
        with self.state_lock:
            if self.execution_mode == 'optimal':
                self._update_queue_priorities()

        found_path = False
        
        while True:
            with self.state_lock:
                if not self.task_queue:
                    break
                _, _, task = heapq.heappop(self.task_queue)
            
            self.planner = DStarLitePlanner(self.grid_map, task['pos'])
            self.current_path = self.planner.set_start_and_plan(self.robot_pos) or []
            
            if self.current_path or task['pos']==self.robot_pos:
                if not self.current_path:
                    self.current_path=[self.robot_pos]
                found_path = True
                self.active_task = task
                break
            else:
                with self.state_lock:
                    self.unreachable_tasks.append(task)
                self.status = f"TASK #{task['id']} UNREACHABLE. LOGGING EXCEPTION."
                time.sleep(0.5) 

        if not found_path:
            self.planner = None
            self.current_path = []
            self.active_task = None
            if self.unreachable_tasks:
                self.status = "IDLE. EXCEPTIONS IN QUEUE."    
            else:
                self.active_task=self.CHARGING_STATION
                "IDLE. AWAITING INSTRUCTIONS."

    def _reevaluate_unreachable_tasks(self):
        newly_reachable = []
        with self.state_lock:
            for task in self.unreachable_tasks[:]: 
                temp_planner = DStarLitePlanner(self.grid_map, task['pos'])
                if temp_planner.set_start_and_plan(self.robot_pos):
                    self.unreachable_tasks.remove(task)
                    
                    if task['id'] == 'RTB':
                        self.status = "CRITICAL FAULT CLEARED: RESUMING RTB."
                        if self.battery_level > 0:
                            self.system_paused = False
                    else:
                        newly_reachable.append(task)
            
            if newly_reachable:
                self.action_required_tasks.extend(newly_reachable)

    def process_command(self, data):
        cmd = data.get('action')
        
        if cmd == 'update_battery':
            self.max_battery = float(data.get('max_battery', 100.0))
            self.safety_reserve = float(data.get('safety_reserve', 5.0))
            self.drain_move = float(data.get('drain_move', 1.5))
            self.drain_replan = float(data.get('drain_replan', 5.0))
            self.battery_level = min(self.battery_level, self.max_battery)
            return {"success": True}
            
        elif cmd == 'set_execution_mode':
            with self.state_lock:
                self.execution_mode = data.get('mode', 'sequential')
                self._update_queue_priorities()
            return {"success": True}
            
        elif cmd == 'force_rtb':
            with self.state_lock:
                if self.robot_pos != self.CHARGING_STATION and not self.charging_mode:
                    if self.active_task and self.active_task['id'] != 'RTB':
                        priority = self._calculate_priority(self.active_task)
                        heapq.heappush(self.task_queue, (priority, self.active_task['id'], self.active_task))
                    
                    self.charging_mode = True
                    self.planner = DStarLitePlanner(self.grid_map, self.CHARGING_STATION)
                    self.current_path = self.planner.set_start_and_plan(self.robot_pos) or []
                    self.active_task = {'id': 'RTB', 'pos': self.CHARGING_STATION}
                    self.status = "MANUAL OVERRIDE: RTB INITIATED."
                    if self.battery_level > 0:
                        self.system_paused = False
            return {"success": True}
        
        elif cmd == 'add_task':
            x, y = data['x'], data['y']
            if self.grid_map[y][x] == 1:
                return {"success": False, "error": "ERR: TARGET COORDINATES INSIDE OBSTACLE."}
            if (x, y) == self.CHARGING_STATION:
                return {"success": False, "error": "ERR: CANNOT ASSIGN TASK TO CHARGING BASE."}
                
            with self.state_lock:
                task = {'id': self.task_counter, 'pos': (x, y)}
                self.task_counter += 1
                priority = self._calculate_priority(task)
                heapq.heappush(self.task_queue, (priority, task['id'], task))
            
        elif cmd == 'toggle_wall':
            x, y = data['x'], data['y']
            if (x, y) == self.robot_pos:
                return {"success": False, "error": "ERR: COLLISION WITH AGENT."}
            if (x, y) == self.CHARGING_STATION:
                return {"success": False, "error": "ERR: CANNOT BLOCK CHARGING BASE."}
            
            with self.state_lock:
                if any(t['pos'] == (x, y) for _, _, t in self.task_queue):
                    return {"success": False, "error": "ERR: TARGET COORDINATES OVERLAP."}
            if self.active_task and (x, y) == self.active_task['pos']:
                return {"success": False, "error": "ERR: ACTIVE TARGET BLOCKAGE."}
                
            self.grid_map[y][x] = 1 if self.grid_map[y][x] == 0 else 0
            self._reevaluate_unreachable_tasks()

        elif cmd == 'toggle_power':
            if self.battery_level <= 0:
                return {"success": False, "error": "ERR: DEAD BATTERY. MUST RESET."}
            self.system_paused = not self.system_paused
                
        elif cmd == 'reset':
            self.reset()

        elif cmd in ['push_task', 'ignore_task']:
            with self.state_lock:
                task = next((t for t in self.action_required_tasks if t['id'] == data.get('id')), None)
                if task:
                    self.action_required_tasks.remove(task)
                    if cmd == 'push_task':
                        priority = -1 if self.execution_mode == 'sequential' else self._calculate_priority(task)
                        heapq.heappush(self.task_queue, (priority, task['id'], task))
                        self.system_paused=False
                        
        return {"success": True}

    def get_state(self):
        with self.state_lock:
            flat_queue = [item[2] for item in sorted(self.task_queue)]
            
        return {
            "grid": self.grid_map, "robot_pos": self.robot_pos, "path": self.current_path,
            "queue": flat_queue, "unreachable": self.unreachable_tasks,
            "action_required": self.action_required_tasks, "active_task": self.active_task,
            "status": self.status, "distance": self.distance_traveled,
            "battery": self.battery_level, "max_battery": self.max_battery,
            "dynamic_rtb": self.battery_required, "is_paused": self.system_paused,
            "execution_mode": self.execution_mode
        }

app = Flask(__name__)
cps = CPSSystem()

@app.route('/')
def index(): return render_template('index.html')
@app.route('/api/state')
def get_state(): return jsonify(cps.get_state())
@app.route('/api/command', methods=['POST'])
def command(): return jsonify(cps.process_command(request.json))

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)