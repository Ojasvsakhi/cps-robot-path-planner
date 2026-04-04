const canvas = document.getElementById('warehouseCanvas');
const ctx = canvas.getContext('2d');
const CELL_SIZE = 55;

const DOM = {
    statusText: document.getElementById('status-text'),
    distText: document.getElementById('dist-text'),
    queueText: document.getElementById('queue-text'),
    unreachText: document.getElementById('unreachable-text'),
    batteryText: document.getElementById('battery-text'),
    actionPanel: document.getElementById('action-panel'),
    actionList: document.getElementById('action-list'),
    btnPower: document.getElementById('btn-power'),
    errorLog: document.getElementById('error-log'),
    toolWall: document.getElementById('tool-wall'),
    toolTask: document.getElementById('tool-task')
};

const rootStyles = getComputedStyle(document.body);
const theme = {
    gridLine: rootStyles.getPropertyValue('--grid-line').trim(),
    wall: rootStyles.getPropertyValue('--wall').trim(),
    path: rootStyles.getPropertyValue('--path').trim(),
    robot: rootStyles.getPropertyValue('--robot').trim(),
    taskQueue: rootStyles.getPropertyValue('--task-queue').trim(),
    taskActive: rootStyles.getPropertyValue('--task-active').trim(),
    taskError: rootStyles.getPropertyValue('--task-error').trim()
};

let currentState = null;
let lastActionCount = 0; 
let visualRobotX = null;
let visualRobotY = null;

// Workspace Tool Manager
let currentCursorMode = 'wall';

function setCursorTool(mode) {
    currentCursorMode = mode;
    if (mode === 'wall') {
        DOM.toolWall.classList.add('active');
        DOM.toolTask.classList.remove('active');
    } else {
        DOM.toolTask.classList.add('active');
        DOM.toolWall.classList.remove('active');
    }
}

// API Helpers
async function apiCommand(payload) {
    const response = await fetch('/api/command', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    fetchState();
    return result;
}

async function fetchState() {
    try {
        const response = await fetch('/api/state');
        currentState = await response.json();
        updateUI();
        
        if (visualRobotX === null && currentState) {
            visualRobotX = currentState.robot_pos[0] * CELL_SIZE + CELL_SIZE / 2;
            visualRobotY = currentState.robot_pos[1] * CELL_SIZE + CELL_SIZE / 2;
        }
    } catch (e) {
        DOM.statusText.innerText = "SYS_ERR: DISCONNECTED";
        DOM.statusText.style.color = theme.taskError;
    }
}

async function togglePower() {
    await apiCommand({ action: 'toggle_power' });
}

async function resetSystem() {
    // if(!confirm("WARNING: Proceed with full environment wipe?")) return;
    await apiCommand({ action: 'reset' });
    visualRobotX = CELL_SIZE / 2;
    visualRobotY = CELL_SIZE / 2;
}

async function setExecutionMode(mode) {
    await apiCommand({ action: 'set_execution_mode', mode: mode });
}

async function updateEnergyConfig() {
    const payload = {
        action: 'update_battery',
        max_battery: parseFloat(document.getElementById('cfg-max').value),
        safety_reserve: parseFloat(document.getElementById('cfg-reserve').value),
        drain_move: parseFloat(document.getElementById('cfg-move').value),
        drain_replan: parseFloat(document.getElementById('cfg-replan').value)
    };
    
    const res = await apiCommand(payload);
    if(res.success) {
        DOM.errorLog.style.color = theme.taskActive;
        DOM.errorLog.innerText = "PREDICTIVE PARAMETERS APPLIED.";
        setTimeout(() => DOM.errorLog.innerText = "", 3000); 
    }
}

async function handleTaskAction(id, actionType) {
    await apiCommand({ action: actionType, id: id });
}

// Interaction Listener using the new Contextual Toolbar
canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
    
    const action = currentCursorMode === 'wall' ? 'toggle_wall' : 'add_task';

    const result = await apiCommand({ action: action, x: x, y: y });
    
    if (!result.success) {
        DOM.errorLog.style.color = theme.taskError;
        DOM.errorLog.innerText = result.error;
        setTimeout(() => DOM.errorLog.innerText = "", 3000); 
    }
});

// Rendering Logic
function drawTaskNode(x, y, color, number) {
    const cx = x * CELL_SIZE + CELL_SIZE / 2;
    const cy = y * CELL_SIZE + CELL_SIZE / 2;

    ctx.fillStyle = color;
    ctx.fillRect(x * CELL_SIZE + 5, y * CELL_SIZE + 5, CELL_SIZE - 10, CELL_SIZE - 10);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x * CELL_SIZE + 5, y * CELL_SIZE + 5, CELL_SIZE - 10, CELL_SIZE - 10);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px 'Consolas', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(number, cx, cy);
}

function renderLoop() {
    requestAnimationFrame(renderLoop); 
    if (!currentState) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < currentState.grid.length; y++) {
        for (let x = 0; x < currentState.grid[0].length; x++) {
            ctx.strokeStyle = theme.gridLine; 
            ctx.lineWidth = 1;
            ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            
            if (x === 0 && y === 0) {
                ctx.fillStyle = "rgba(13, 110, 253, 0.15)";
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                ctx.strokeStyle = theme.robot;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(x * CELL_SIZE + 4, y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
                ctx.setLineDash([]);
            }
            
            if (currentState.grid[y][x] === 1) {
                ctx.fillStyle = theme.wall; 
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                ctx.beginPath();
                ctx.strokeStyle = "#343a40";
                ctx.moveTo(x * CELL_SIZE, y * CELL_SIZE);
                ctx.lineTo((x+1) * CELL_SIZE, (y+1) * CELL_SIZE);
                ctx.moveTo((x+1) * CELL_SIZE, y * CELL_SIZE);
                ctx.lineTo(x * CELL_SIZE, (y+1) * CELL_SIZE);
                ctx.stroke();
            }
        }
    }

    if (currentState.path && currentState.path.length > 0) {
        ctx.beginPath();
        ctx.moveTo(currentState.robot_pos[0] * CELL_SIZE + CELL_SIZE / 2, currentState.robot_pos[1] * CELL_SIZE + CELL_SIZE / 2);
        currentState.path.forEach(node => ctx.lineTo(node[0] * CELL_SIZE + CELL_SIZE / 2, node[1] * CELL_SIZE + CELL_SIZE / 2));
        ctx.strokeStyle = (currentState.active_task && currentState.active_task.id === 'RTB') ? theme.taskError : theme.path; 
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    if (currentState.queue) currentState.queue.forEach(t => drawTaskNode(t.pos[0], t.pos[1], theme.taskQueue, t.id));
    if (currentState.unreachable) currentState.unreachable.forEach(t => drawTaskNode(t.pos[0], t.pos[1], theme.taskError, t.id));
    if (currentState.action_required) currentState.action_required.forEach(t => drawTaskNode(t.pos[0], t.pos[1], "#0dcaf0", t.id));
    if (currentState.active_task && currentState.active_task.id !== 'RTB') drawTaskNode(currentState.active_task.pos[0], currentState.active_task.pos[1], theme.taskActive, currentState.active_task.id);

    const targetX = currentState.robot_pos[0] * CELL_SIZE + CELL_SIZE / 2;
    const targetY = currentState.robot_pos[1] * CELL_SIZE + CELL_SIZE / 2;
    
    visualRobotX += (targetX - visualRobotX) * 0.25; 
    visualRobotY += (targetY - visualRobotY) * 0.25;

    ctx.beginPath();
    ctx.arc(visualRobotX, visualRobotY, 16, 0, Math.PI * 2);
    
    const currB = currentState.battery !== undefined ? currentState.battery : 100;
    const dynamicThresh = currentState.dynamic_rtb || 0;
    
    ctx.fillStyle = (currB <= dynamicThresh) ? theme.taskError : theme.robot; 
    if (currB <= 0) ctx.fillStyle = "#343a40"; 

    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(visualRobotX - 2, visualRobotY - 2, 4, 4);
}

function updateUI() {
    DOM.statusText.innerText = currentState.status;
    DOM.distText.innerText = currentState.distance.toFixed(2);
    DOM.queueText.innerText = currentState.queue.length;
    DOM.unreachText.innerText = currentState.unreachable.length;
    
    const maxVal = currentState.max_battery || 100;
    const currVal = currentState.battery !== undefined ? currentState.battery : 100;
    const dynamicThresh = currentState.dynamic_rtb || 0;
    
    const pct = (currVal / maxVal) * 100;
    DOM.batteryText.innerText = Math.floor(pct) + '%';
    
    if (currVal > (dynamicThresh * 2)) DOM.batteryText.style.color = theme.taskActive;
    else if (currVal > dynamicThresh) DOM.batteryText.style.color = theme.taskQueue;
    else DOM.batteryText.style.color = theme.taskError;

    if (currentState.execution_mode) {
        document.querySelector(`input[name="dispatchMode"][value="${currentState.execution_mode}"]`).checked = true;
    }
    
    const currentActionCount = currentState.action_required ? currentState.action_required.length : 0;
    
    if (currentActionCount > 0) {
        if (currentActionCount > lastActionCount && !currentState.is_paused) togglePower(); 

        DOM.actionPanel.style.display = "block";
        const newHTML = currentState.action_required.map(task => `
            <div class="action-card">
                <span class="action-info">TARGET NODE #${task.id}</span>
                <div class="action-btns">
                    <button class="btn-push" onclick="handleTaskAction(${task.id}, 'push_task')">APPEND</button>
                    <button class="btn-ignore" onclick="handleTaskAction(${task.id}, 'ignore_task')">DISMISS</button>
                </div>
            </div>
        `).join('');

        if (DOM.actionList.innerHTML !== newHTML) DOM.actionList.innerHTML = newHTML;
    } else {
        DOM.actionPanel.style.display = "none";
        if (DOM.actionList.innerHTML !== "") DOM.actionList.innerHTML = "";
    }
    lastActionCount = currentActionCount;

    if (currentState.is_paused) {
        DOM.btnPower.innerText = "START SIMULATION";
        DOM.btnPower.className = "";
        DOM.statusText.style.color = currVal <= 0 ? theme.taskError : "var(--text-data)";
    } else {
        DOM.btnPower.innerText = "PAUSE SIMULATION";
        DOM.btnPower.className = "paused";
        if (currentState.active_task && currentState.active_task.id === 'RTB') {
             DOM.statusText.style.color = theme.taskError;
        } else {
             DOM.statusText.style.color = currentState.status.includes("OBSTACLE") ? theme.taskQueue : theme.taskActive;
        }
    }
}

setInterval(fetchState, 200);
requestAnimationFrame(renderLoop);