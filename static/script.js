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

let curr_State = null;
let lastActionCount = 0; 
let visualRobotX = null;
let visualRobotY = null;

// Graph
let telemetryChart;
const maxDataPoints = 50;

function initChart() {
    const ctxChart = document.getElementById('telemetryChart').getContext('2d');
    telemetryChart = new Chart(ctxChart, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Battery Level (%)',
                data: [],
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointBackgroundColor: [],
                pointBorderColor: [],
                pointRadius: 3,
                
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Distance (Units)' } },
                y: { min: 0, max: 100, title: { display: true, text: 'Battery %' } }
            },
            animation: false
        }
    });
}

initChart();

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
        curr_State = await response.json();
        updateUI();
        
        if (visualRobotX === null && curr_State) {
            visualRobotX = curr_State.robot_pos[0] * CELL_SIZE + CELL_SIZE / 2;
            visualRobotY = curr_State.robot_pos[1] * CELL_SIZE + CELL_SIZE / 2;
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
    await apiCommand({ action: 'reset' });
    visualRobotX = CELL_SIZE / 2;
    visualRobotY = CELL_SIZE / 2;
    
    // Clear graph data and colors on reset
    if (telemetryChart) {
        telemetryChart.data.labels = [];
        telemetryChart.data.datasets[0].data = [];
        telemetryChart.data.datasets[0].pointBackgroundColor = [];
        telemetryChart.update();
    }
    lastActionCount = 0;
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

// Interaction Listener using the Contextual Toolbar
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
    if (!curr_State) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < curr_State.grid.length; y++) {
        for (let x = 0; x < curr_State.grid[0].length; x++) {
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
            
            if (curr_State.grid[y][x] === 1) {
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

    if (curr_State.path && curr_State.path.length > 0) {
        ctx.beginPath();
        ctx.moveTo(curr_State.robot_pos[0] * CELL_SIZE + CELL_SIZE / 2, curr_State.robot_pos[1] * CELL_SIZE + CELL_SIZE / 2);
        curr_State.path.forEach(node => ctx.lineTo(node[0] * CELL_SIZE + CELL_SIZE / 2, node[1] * CELL_SIZE + CELL_SIZE / 2));
        ctx.strokeStyle = (curr_State.active_task && curr_State.active_task.id === 'RTB') ? theme.taskError : theme.path; 
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    if (curr_State.queue) curr_State.queue.forEach(t => drawTaskNode(t.pos[0], t.pos[1], theme.taskQueue, t.id));
    if (curr_State.unreachable) curr_State.unreachable.forEach(t => drawTaskNode(t.pos[0], t.pos[1], theme.taskError, t.id));
    if (curr_State.action_required) curr_State.action_required.forEach(t => drawTaskNode(t.pos[0], t.pos[1], "#0dcaf0", t.id));
    if (curr_State.active_task && curr_State.active_task.id !== 'RTB') drawTaskNode(curr_State.active_task.pos[0], curr_State.active_task.pos[1], theme.taskActive, curr_State.active_task.id);

    const targetX = curr_State.robot_pos[0] * CELL_SIZE + CELL_SIZE / 2;
    const targetY = curr_State.robot_pos[1] * CELL_SIZE + CELL_SIZE / 2;
    
    visualRobotX += (targetX - visualRobotX) * 0.25; 
    visualRobotY += (targetY - visualRobotY) * 0.25;

    ctx.beginPath();
    ctx.arc(visualRobotX, visualRobotY, 16, 0, Math.PI * 2);
    
    const currB = curr_State.battery !== undefined ? curr_State.battery : 100;
    const dynamicThresh = curr_State.dynamic_rtb || 0;
    
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
    DOM.statusText.innerText = curr_State.status;
    DOM.distText.innerText = curr_State.distance.toFixed(2);
    DOM.queueText.innerText = curr_State.queue.length;
    DOM.unreachText.innerText = curr_State.unreachable.length;
    
    const maxVal = curr_State.max_battery || 100;
    const currVal = curr_State.battery !== undefined ? curr_State.battery : 100;
    const dynamicThresh = curr_State.dynamic_rtb || 0;
    
    const pct = (currVal / maxVal) * 100;
    DOM.batteryText.innerText = Math.floor(pct) + '%';
    
    if (currVal > (dynamicThresh * 2)) DOM.batteryText.style.color = theme.taskActive;
    else if (currVal > dynamicThresh) DOM.batteryText.style.color = theme.taskQueue;
    else DOM.batteryText.style.color = theme.taskError;

    if (curr_State.execution_mode) {
        document.querySelector(`input[name="dispatchMode"][value="${curr_State.execution_mode}"]`).checked = true;
    }
    
    const curr_ActionCount = curr_State.action_required ? curr_State.action_required.length : 0;
    
    if (curr_ActionCount > 0) {
        if (curr_ActionCount > lastActionCount && !curr_State.is_paused) togglePower(); 

        DOM.actionPanel.style.display = "block";
        const newHTML = curr_State.action_required.map(task => `
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
    lastActionCount = curr_ActionCount;

    if (curr_State.is_paused) {
        DOM.btnPower.innerText = "START SIMULATION";
        DOM.btnPower.className = "";
        DOM.statusText.style.color = currVal <= 0 ? theme.taskError : "var(--text-data)";
    } else {
        DOM.btnPower.innerText = "PAUSE SIMULATION";
        DOM.btnPower.className = "paused";
        if (curr_State.active_task?.id === 'RTB') {
             DOM.statusText.style.color = theme.taskError;
        } else {
             DOM.statusText.style.color = curr_State.status.includes("OBSTACLE") ? theme.taskQueue : theme.taskActive;
        }
    }

    //  Telemetry Chart
    const distance = parseFloat(curr_State.distance.toFixed(2));
    const battery = Math.floor((curr_State.battery / curr_State.max_battery) * 100);

    const labels = telemetryChart.data.labels;
    const dataPoints = telemetryChart.data.datasets[0].data;
    const pointColors = telemetryChart.data.datasets[0].pointBackgroundColor;
    const pointBorderColor = telemetryChart.data.datasets[0].pointBorderColor;

    const lastLabel = labels.length > 0 ? labels[labels.length - 1] : -1;
    const lastBattery = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : -1;

    if (lastLabel !== distance) {
        labels.push(distance);
        dataPoints.push(battery);
        pointColors.push(theme.robot || '#0d6efd');
        pointBorderColor.push(theme.robot || '#0d6efd');

        if (labels.length > maxDataPoints) {
            labels.shift();
            dataPoints.shift();
            pointColors.shift();
            pointBorderColor.shift();
        }
        telemetryChart.update();
    } else if (lastLabel === distance && battery < lastBattery) {
        dataPoints[dataPoints.length - 1] = battery;
        pointColors[pointColors.length - 1] = '#ff0606';
        pointBorderColor[pointBorderColor.length - 1] = '#ff0606';
        telemetryChart.update();
    }
}

fetchState();
setInterval(fetchState, 200);
requestAnimationFrame(renderLoop);