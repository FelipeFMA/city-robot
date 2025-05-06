// City grid configuration
const GRID_SIZE = 12;
const CELL_TYPES = {
    STREET: 'street',
    BUILDING: 'building',
    HOSPITAL: 'hospital',
    FUEL_STATION: 'fuel-station',
    CHARGING_STATION: 'charging-station',
    DANGER_ZONE: 'danger-zone',
    SUPPLY_PICKUP: 'supply-pickup',
    SCHOOL: 'school'
};

// Robot configuration
const ROBOT = {
    position: { x: 0, y: 0 },
    energy: 100,
    maxEnergy: 100,
    fuel: 50,
    maxFuel: 50,
    cargo: 0,
    maxCargo: 2,
    isMoving: false,
    hasSupplies: false,
    deliveredSupplies: false,
    returnedToStart: false,
    recentPositions: [], // Track recent positions to avoid loops
    maxRecentPositions: 10 // Number of recent positions to remember
};

// Movement costs
const COSTS = {
    MOVE: { energy: 1, fuel: 0.5 },
    OBSTACLE_AVOID: { energy: 1, fuel: 0 }
};

// City map and obstacles
let cityMap = [];
let mobileObstacles = [];
let simulationInterval;
let simulationSpeed = 1000; // milliseconds
let isAutoMode = true;

// DOM elements
const cityGrid = document.getElementById('city-grid');
const energyBar = document.getElementById('energy-bar');
const energyValue = document.getElementById('energy-value');
const fuelBar = document.getElementById('fuel-bar');
const fuelValue = document.getElementById('fuel-value');
const cargoValue = document.getElementById('cargo-value');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');
const speedSlider = document.getElementById('speed');
const autoModeRadio = document.getElementById('auto-mode');
const manualModeRadio = document.getElementById('manual-mode');
const statusMessage = document.getElementById('status-message');
const decisionLog = document.getElementById('decision-log');
const themeToggle = document.getElementById('theme-toggle');

// Initialize the simulation
function initSimulation() {
    createCityMap();
    renderCityGrid();
    placeMobileObstacles();
    placeRobot();
    updateResourceDisplay();
    initThemeToggle();

    // Event listeners
    startBtn.addEventListener('click', startSimulation);
    stopBtn.addEventListener('click', stopSimulation);
    resetBtn.addEventListener('click', resetSimulation);
    speedSlider.addEventListener('input', updateSimulationSpeed);
    autoModeRadio.addEventListener('change', setAutoMode);
    manualModeRadio.addEventListener('change', setManualMode);
    themeToggle.addEventListener('click', toggleTheme);

    // Add keyboard controls for manual mode
    document.addEventListener('keydown', handleKeyboardInput);
}

// Initialize theme based on user preference
function initThemeToggle() {
    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggle.textContent = '🌙';
    }
}

// Toggle between light and dark mode
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');

    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        themeToggle.textContent = '🌙';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggle.textContent = '☀️';
    }
}

// Create the city map with different cell types
function createCityMap() {
    cityMap = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(CELL_TYPES.STREET));

    // Place buildings (fixed obstacles)
    placeFixedElements(CELL_TYPES.BUILDING, 20);

    // Place hospitals
    placeFixedElements(CELL_TYPES.HOSPITAL, 2);

    // Place fuel stations
    placeFixedElements(CELL_TYPES.FUEL_STATION, 3);

    // Place charging stations
    placeFixedElements(CELL_TYPES.CHARGING_STATION, 3);

    // Place danger zones
    placeFixedElements(CELL_TYPES.DANGER_ZONE, 5);

    // Place schools
    placeFixedElements(CELL_TYPES.SCHOOL, 2);

    // Place supply pickup (always at a fixed location for the mission)
    // Make sure it's not at the starting position
    let supplyX, supplyY;
    do {
        supplyX = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1; // Avoid edge positions
        supplyY = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
    } while (cityMap[supplyY][supplyX] !== CELL_TYPES.STREET);

    cityMap[supplyY][supplyX] = CELL_TYPES.SUPPLY_PICKUP;
}

// Place fixed elements on the map
function placeFixedElements(type, count) {
    for (let i = 0; i < count; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * GRID_SIZE);
            y = Math.floor(Math.random() * GRID_SIZE);
        } while (cityMap[y][x] !== CELL_TYPES.STREET);

        cityMap[y][x] = type;
    }
}

// Place mobile obstacles
function placeMobileObstacles() {
    mobileObstacles = [];
    for (let i = 0; i < 5; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * GRID_SIZE);
            y = Math.floor(Math.random() * GRID_SIZE);
        } while (
            cityMap[y][x] !== CELL_TYPES.STREET ||
            (x === ROBOT.position.x && y === ROBOT.position.y) ||
            mobileObstacles.some(obs => obs.x === x && obs.y === y)
        );

        mobileObstacles.push({ x, y });
    }
    renderMobileObstacles();
}

// Move mobile obstacles randomly
function moveMobileObstacles() {
    mobileObstacles.forEach(obstacle => {
        // Remove current obstacle
        const obstacleElement = document.querySelector(`.obstacle[data-x="${obstacle.x}"][data-y="${obstacle.y}"]`);
        if (obstacleElement) {
            obstacleElement.remove();
        }

        // Try to move in a random direction
        const directions = [
            { dx: 0, dy: -1 }, // up
            { dx: 1, dy: 0 },  // right
            { dx: 0, dy: 1 },  // down
            { dx: -1, dy: 0 }  // left
        ];

        const shuffledDirections = directions.sort(() => Math.random() - 0.5);

        for (const dir of shuffledDirections) {
            const newX = obstacle.x + dir.dx;
            const newY = obstacle.y + dir.dy;

            if (
                newX >= 0 && newX < GRID_SIZE &&
                newY >= 0 && newY < GRID_SIZE &&
                cityMap[newY][newX] === CELL_TYPES.STREET &&
                !(newX === ROBOT.position.x && newY === ROBOT.position.y) &&
                !mobileObstacles.some(obs => obs !== obstacle && obs.x === newX && obs.y === newY)
            ) {
                obstacle.x = newX;
                obstacle.y = newY;
                break;
            }
        }
    });

    renderMobileObstacles();
}

// Render mobile obstacles
function renderMobileObstacles() {
    // Remove all existing obstacles
    document.querySelectorAll('.obstacle').forEach(el => el.remove());

    // Add new obstacles
    mobileObstacles.forEach(obstacle => {
        const cell = document.querySelector(`.cell[data-x="${obstacle.x}"][data-y="${obstacle.y}"]`);
        if (cell) {
            const obstacleElement = document.createElement('div');
            obstacleElement.className = 'obstacle';
            obstacleElement.dataset.x = obstacle.x;
            obstacleElement.dataset.y = obstacle.y;
            cell.appendChild(obstacleElement);
        }
    });
}

// Place the robot on the grid
function placeRobot() {
    ROBOT.position = { x: 0, y: 0 };
    renderRobot();
}

// Render the robot
function renderRobot() {
    // Remove existing robot
    document.querySelectorAll('.robot').forEach(el => el.remove());

    // Add robot at new position
    const cell = document.querySelector(`.cell[data-x="${ROBOT.position.x}"][data-y="${ROBOT.position.y}"]`);
    if (cell) {
        const robotElement = document.createElement('div');
        robotElement.className = 'robot';
        robotElement.textContent = '🤖'; // Use robot emoji
        cell.appendChild(robotElement);
    }
}

// Render the city grid
function renderCityGrid() {
    cityGrid.innerHTML = '';

    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.createElement('div');
            cell.className = `cell ${cityMap[y][x]}`;
            cell.dataset.x = x;
            cell.dataset.y = y;

            // Add labels for special locations
            if (cityMap[y][x] === CELL_TYPES.HOSPITAL) {
                cell.textContent = 'H';
            } else if (cityMap[y][x] === CELL_TYPES.FUEL_STATION) {
                cell.textContent = 'F';
            } else if (cityMap[y][x] === CELL_TYPES.CHARGING_STATION) {
                cell.textContent = 'C';
            } else if (cityMap[y][x] === CELL_TYPES.SUPPLY_PICKUP) {
                cell.textContent = 'S';
            } else if (cityMap[y][x] === CELL_TYPES.SCHOOL) {
                cell.textContent = 'E';
            }

            cityGrid.appendChild(cell);
        }
    }
}

// Update resource display
function updateResourceDisplay() {
    energyBar.style.width = `${(ROBOT.energy / ROBOT.maxEnergy) * 100}%`;
    energyValue.textContent = `${ROBOT.energy}/${ROBOT.maxEnergy}`;

    fuelBar.style.width = `${(ROBOT.fuel / ROBOT.maxFuel) * 100}%`;
    fuelValue.textContent = `${ROBOT.fuel.toFixed(1)}/${ROBOT.maxFuel}`;

    cargoValue.textContent = `${ROBOT.cargo}/${ROBOT.maxCargo}`;
}

// Start the simulation
function startSimulation() {
    if (!ROBOT.isMoving) {
        ROBOT.isMoving = true;
        updateStatus('Robot is moving...');
        simulationInterval = setInterval(() => {
            if (isAutoMode) {
                robotAI();
            }
            moveMobileObstacles();
        }, simulationSpeed);
    }
}

// Stop the simulation
function stopSimulation() {
    ROBOT.isMoving = false;
    clearInterval(simulationInterval);
    updateStatus('Robot has stopped.');
}

// Reset the simulation
function resetSimulation() {
    stopSimulation();
    ROBOT.energy = 100;
    ROBOT.fuel = 50;
    ROBOT.cargo = 0;
    ROBOT.hasSupplies = false;
    ROBOT.deliveredSupplies = false;
    ROBOT.returnedToStart = false;
    ROBOT.recentPositions = []; // Clear recent positions
    createCityMap();
    renderCityGrid();
    placeMobileObstacles();
    placeRobot();
    updateResourceDisplay();
    clearDecisionLog();
    updateStatus('Robot is ready to start.');
}

// Update simulation speed
function updateSimulationSpeed() {
    simulationSpeed = 2000 - (speedSlider.value * 180); // 200ms to 1800ms
    if (ROBOT.isMoving) {
        stopSimulation();
        startSimulation();
    }
}

// Set auto mode
function setAutoMode() {
    isAutoMode = true;
    updateStatus('Auto mode activated.');
}

// Set manual mode
function setManualMode() {
    isAutoMode = false;
    updateStatus('Manual mode activated. Use arrow keys to move.');
}

// Handle keyboard input for manual mode
function handleKeyboardInput(event) {
    if (!isAutoMode && ROBOT.isMoving) {
        switch (event.key) {
            case 'ArrowUp':
                moveRobot(0, -1);
                break;
            case 'ArrowRight':
                moveRobot(1, 0);
                break;
            case 'ArrowDown':
                moveRobot(0, 1);
                break;
            case 'ArrowLeft':
                moveRobot(-1, 0);
                break;
        }
    }
}

// Move the robot
function moveRobot(dx, dy) {
    const newX = ROBOT.position.x + dx;
    const newY = ROBOT.position.y + dy;

    // Check if the move is valid
    if (
        newX >= 0 && newX < GRID_SIZE &&
        newY >= 0 && newY < GRID_SIZE &&
        cityMap[newY][newX] !== CELL_TYPES.BUILDING &&
        cityMap[newY][newX] !== CELL_TYPES.DANGER_ZONE // Never enter danger zones
    ) {
        // Check for mobile obstacles
        const hasObstacle = mobileObstacles.some(obs => obs.x === newX && obs.y === newY);

        if (hasObstacle) {
            // Avoid obstacle by finding an alternative path
            ROBOT.energy -= COSTS.OBSTACLE_AVOID.energy;
            logDecision(`Obstacle detected at (${newX}, ${newY}). Finding alternative path.`);

            // Try to find an alternative direction that's not blocked
            const directions = [
                { dx: 0, dy: -1 }, // up
                { dx: 1, dy: 0 },  // right
                { dx: 0, dy: 1 },  // down
                { dx: -1, dy: 0 }  // left
            ];

            // Filter out the direction we just tried
            const alternativeDirections = directions.filter(dir =>
                !(dir.dx === dx && dir.dy === dy)
            );

            // Sort by how much they reduce the Manhattan distance to our goal
            // This requires knowing our current goal, which we'll infer from the robot's state
            let targetX, targetY;

            if (!ROBOT.hasSupplies && !ROBOT.deliveredSupplies) {
                const supplyPickup = findNearestCellOfType(CELL_TYPES.SUPPLY_PICKUP);
                if (supplyPickup) {
                    targetX = supplyPickup.x;
                    targetY = supplyPickup.y;
                }
            } else if (ROBOT.hasSupplies && !ROBOT.deliveredSupplies) {
                const hospital = findNearestCellOfType(CELL_TYPES.HOSPITAL);
                if (hospital) {
                    targetX = hospital.x;
                    targetY = hospital.y;
                }
            } else if (ROBOT.deliveredSupplies && !ROBOT.returnedToStart) {
                targetX = 0;
                targetY = 0;
            }

            if (targetX !== undefined && targetY !== undefined) {
                alternativeDirections.sort((a, b) => {
                    const distA = calculateDistance(
                        ROBOT.position.x + a.dx, ROBOT.position.y + a.dy,
                        targetX, targetY
                    );
                    const distB = calculateDistance(
                        ROBOT.position.x + b.dx, ROBOT.position.y + b.dy,
                        targetX, targetY
                    );
                    return distA - distB;
                });
            }

            // Try each alternative direction
            for (const dir of alternativeDirections) {
                const altX = ROBOT.position.x + dir.dx;
                const altY = ROBOT.position.y + dir.dy;

                if (
                    altX >= 0 && altX < GRID_SIZE &&
                    altY >= 0 && altY < GRID_SIZE &&
                    cityMap[altY][altX] !== CELL_TYPES.BUILDING &&
                    cityMap[altY][altX] !== CELL_TYPES.DANGER_ZONE &&
                    !mobileObstacles.some(obs => obs.x === altX && obs.y === altY)
                ) {
                    // Found a valid alternative direction
                    logDecision(`Found alternative path. Moving to (${altX}, ${altY}).`);
                    moveRobot(dir.dx, dir.dy);
                    return;
                }
            }

            // If no alternative direction is found, stay in place
            logDecision(`No alternative path found. Waiting for obstacle to move.`);
        } else {
            // Track the current position before moving
            const oldPosition = { x: ROBOT.position.x, y: ROBOT.position.y };

            // Add current position to recent positions list
            ROBOT.recentPositions.push(oldPosition);

            // Keep only the most recent positions
            if (ROBOT.recentPositions.length > ROBOT.maxRecentPositions) {
                ROBOT.recentPositions.shift();
            }

            // Move to new position
            ROBOT.position.x = newX;
            ROBOT.position.y = newY;
            ROBOT.energy -= COSTS.MOVE.energy;
            ROBOT.fuel -= COSTS.MOVE.fuel;
            logDecision(`Moved to (${newX}, ${newY}). Energy: -${COSTS.MOVE.energy}, Fuel: -${COSTS.MOVE.fuel}`);

            // Check current cell type for special actions
            checkCellActions();
        }

        renderRobot();
        updateResourceDisplay();
        checkResourceLevels();
    } else {
        logDecision(`Cannot move to (${newX}, ${newY}). Path is blocked, in danger zone, or out of bounds.`);
    }
}

// Check for special actions based on the current cell
function checkCellActions() {
    const currentCell = cityMap[ROBOT.position.y][ROBOT.position.x];

    switch (currentCell) {
        case CELL_TYPES.HOSPITAL:
            if (ROBOT.hasSupplies && !ROBOT.deliveredSupplies) {
                ROBOT.hasSupplies = false;
                ROBOT.deliveredSupplies = true;
                ROBOT.cargo--;
                logDecision('Delivered supplies to the hospital!');
                updateStatus('Supplies delivered! Return to starting point.');
            }
            break;

        case CELL_TYPES.FUEL_STATION:
            const oldFuel = ROBOT.fuel;
            ROBOT.fuel = ROBOT.maxFuel;
            logDecision(`Refueled at fuel station. Fuel: ${oldFuel.toFixed(1)} → ${ROBOT.fuel}`);
            break;

        case CELL_TYPES.CHARGING_STATION:
            const oldEnergy = ROBOT.energy;
            ROBOT.energy = ROBOT.maxEnergy;
            logDecision(`Recharged at charging station. Energy: ${oldEnergy} → ${ROBOT.energy}`);
            break;

        // We should never enter a danger zone due to our improved pathfinding
        // But just in case, handle it with severe penalties
        case CELL_TYPES.DANGER_ZONE:
            ROBOT.energy -= 10;
            ROBOT.fuel -= 5;
            logDecision('CRITICAL ERROR: Entered danger zone! Energy: -10, Fuel: -5');

            // Immediately try to escape the danger zone
            const directions = [
                { dx: 0, dy: -1 }, // up
                { dx: 1, dy: 0 },  // right
                { dx: 0, dy: 1 },  // down
                { dx: -1, dy: 0 }  // left
            ];

            // Shuffle directions randomly to avoid getting stuck
            const shuffledDirections = directions.sort(() => Math.random() - 0.5);

            // Try to escape in any valid direction
            for (const dir of shuffledDirections) {
                const escapeX = ROBOT.position.x + dir.dx;
                const escapeY = ROBOT.position.y + dir.dy;

                if (
                    escapeX >= 0 && escapeX < GRID_SIZE &&
                    escapeY >= 0 && escapeY < GRID_SIZE &&
                    cityMap[escapeY][escapeX] !== CELL_TYPES.BUILDING &&
                    cityMap[escapeY][escapeX] !== CELL_TYPES.DANGER_ZONE &&
                    !mobileObstacles.some(obs => obs.x === escapeX && obs.y === escapeY)
                ) {
                    logDecision(`Emergency escape from danger zone to (${escapeX}, ${escapeY}).`);
                    ROBOT.position.x = escapeX;
                    ROBOT.position.y = escapeY;
                    renderRobot();
                    break;
                }
            }
            break;

        case CELL_TYPES.SUPPLY_PICKUP:
            if (!ROBOT.hasSupplies && !ROBOT.deliveredSupplies && ROBOT.cargo < ROBOT.maxCargo) {
                ROBOT.hasSupplies = true;
                ROBOT.cargo++;
                logDecision('Picked up supplies for the hospital.');
                updateStatus('Supplies acquired. Heading to hospital.');
            }
            break;

        case CELL_TYPES.SCHOOL:
            logDecision('Visiting school. Educational mission in progress.');
            break;
    }

    // Check if returned to start
    if (ROBOT.position.x === 0 && ROBOT.position.y === 0 && ROBOT.deliveredSupplies) {
        ROBOT.returnedToStart = true;
        logDecision('Returned to starting point! Mission complete.');
        updateStatus('Mission complete! All objectives fulfilled.');
        stopSimulation();
    }
}

// Check resource levels
function checkResourceLevels() {
    if (ROBOT.energy <= 0 || ROBOT.fuel <= 0) {
        ROBOT.energy = Math.max(0, ROBOT.energy);
        ROBOT.fuel = Math.max(0, ROBOT.fuel);
        updateStatus('Robot has run out of resources! Mission failed.');
        logDecision('Critical resource depletion. Robot shutdown.');
        stopSimulation();
    }
}

// Robot AI for autonomous movement
function robotAI() {
    // Check if the robot is stuck and needs to get unstuck
    if (isRobotStuck()) {
        attemptToGetUnstuck();
        return;
    }

    // Check if we need to handle resource management first
    if (handleResourceManagement()) {
        return; // Resource management took priority
    }

    // Main mission objectives
    if (!ROBOT.hasSupplies && !ROBOT.deliveredSupplies) {
        // First objective: Get supplies from the supply pickup location
        const supplyPickup = findNearestCellOfType(CELL_TYPES.SUPPLY_PICKUP);
        if (supplyPickup) {
            logDecision('Moving towards supply pickup location.');
            moveTowardsTarget(supplyPickup.x, supplyPickup.y);
        }
    } else if (ROBOT.hasSupplies && !ROBOT.deliveredSupplies) {
        // Second objective: Deliver to hospital
        const hospital = findNearestCellOfType(CELL_TYPES.HOSPITAL);
        if (hospital) {
            logDecision('Moving towards hospital to deliver supplies.');
            moveTowardsTarget(hospital.x, hospital.y);
        }
    } else if (ROBOT.deliveredSupplies && !ROBOT.returnedToStart) {
        // Third objective: Return to start
        logDecision('Mission accomplished. Returning to starting point.');
        moveTowardsTarget(0, 0);
    }
}

// Check if the robot is stuck in a loop
function isRobotStuck() {
    // If we have at least 6 recent positions
    if (ROBOT.recentPositions.length >= 6) {
        // Check if we've been oscillating between the same positions
        const lastPos = ROBOT.recentPositions[ROBOT.recentPositions.length - 1];
        const secondLastPos = ROBOT.recentPositions[ROBOT.recentPositions.length - 2];
        const thirdLastPos = ROBOT.recentPositions[ROBOT.recentPositions.length - 3];

        // Check for oscillation pattern (A -> B -> A -> B -> A -> B)
        if (
            (ROBOT.position.x === secondLastPos.x && ROBOT.position.y === secondLastPos.y) &&
            (lastPos.x === thirdLastPos.x && lastPos.y === thirdLastPos.y)
        ) {
            return true;
        }

        // Check if we've visited the same position multiple times
        let positionCounts = {};
        for (const pos of ROBOT.recentPositions) {
            const key = `${pos.x},${pos.y}`;
            positionCounts[key] = (positionCounts[key] || 0) + 1;

            // If we've visited any position 3 or more times, we're probably stuck
            if (positionCounts[key] >= 3) {
                return true;
            }
        }
    }

    return false;
}

// Attempt to get the robot unstuck
function attemptToGetUnstuck() {
    logDecision('Robot appears to be stuck. Attempting to break free from loop.');

    // Clear the recent positions memory
    ROBOT.recentPositions = [];

    // Try to move in a random direction
    const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 1, dy: 0 },  // right
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }  // left
    ];

    // Shuffle the directions randomly
    const shuffledDirections = directions.sort(() => Math.random() - 0.5);

    // Try each direction until we find one that's not blocked
    for (const dir of shuffledDirections) {
        const newX = ROBOT.position.x + dir.dx;
        const newY = ROBOT.position.y + dir.dy;

        if (!isPathBlocked(newX, newY)) {
            logDecision(`Breaking free by moving ${dir.dx === 0 ? (dir.dy === 1 ? 'down' : 'up') : (dir.dx === 1 ? 'right' : 'left')}.`);
            moveRobot(dir.dx, dir.dy);
            return;
        }
    }

    logDecision('Unable to break free. All paths are blocked.');
}

// Handle resource management - returns true if resource management took priority
function handleResourceManagement() {
    // Calculate distances to nearest resource stations
    const nearestChargingStation = findNearestCellOfType(CELL_TYPES.CHARGING_STATION);
    const nearestFuelStation = findNearestCellOfType(CELL_TYPES.FUEL_STATION);

    let chargingDistance = Infinity;
    let fuelDistance = Infinity;

    if (nearestChargingStation) {
        chargingDistance = calculateDistance(
            ROBOT.position.x, ROBOT.position.y,
            nearestChargingStation.x, nearestChargingStation.y
        );
    }

    if (nearestFuelStation) {
        fuelDistance = calculateDistance(
            ROBOT.position.x, ROBOT.position.y,
            nearestFuelStation.x, nearestFuelStation.y
        );
    }

    // Critical energy level - prioritize charging
    if (ROBOT.energy < 15) {
        if (nearestChargingStation) {
            logDecision('CRITICAL ENERGY LEVEL! Diverting to nearest charging station.');
            moveTowardsTarget(nearestChargingStation.x, nearestChargingStation.y);
            return true;
        }
    }

    // Critical fuel level - prioritize refueling
    if (ROBOT.fuel < 7) {
        if (nearestFuelStation) {
            logDecision('CRITICAL FUEL LEVEL! Diverting to nearest fuel station.');
            moveTowardsTarget(nearestFuelStation.x, nearestFuelStation.y);
            return true;
        }
    }

    // Low energy level - consider charging if station is nearby
    if (ROBOT.energy < 30 && chargingDistance < 5) {
        logDecision('Low energy detected. Charging station nearby. Diverting to recharge.');
        moveTowardsTarget(nearestChargingStation.x, nearestChargingStation.y);
        return true;
    }

    // Low fuel level - consider refueling if station is nearby
    if (ROBOT.fuel < 15 && fuelDistance < 5) {
        logDecision('Low fuel detected. Fuel station nearby. Diverting to refuel.');
        moveTowardsTarget(nearestFuelStation.x, nearestFuelStation.y);
        return true;
    }

    // Proactively scan for and avoid danger zones
    const currentPosition = { x: ROBOT.position.x, y: ROBOT.position.y };

    // Check if we're adjacent to any danger zones and find a safer path
    const dangerZones = [];

    // Scan the surrounding area for danger zones (up to 3 cells away)
    for (let y = Math.max(0, currentPosition.y - 3); y <= Math.min(GRID_SIZE - 1, currentPosition.y + 3); y++) {
        for (let x = Math.max(0, currentPosition.x - 3); x <= Math.min(GRID_SIZE - 1, currentPosition.x + 3); x++) {
            if (cityMap[y][x] === CELL_TYPES.DANGER_ZONE) {
                dangerZones.push({ x, y });
            }
        }
    }

    // If danger zones are detected nearby, plan a path away from them
    if (dangerZones.length > 0) {
        logDecision(`Detected ${dangerZones.length} danger zones nearby. Planning safe route.`);

        // Find the current mission target
        let missionTarget = null;

        if (!ROBOT.hasSupplies && !ROBOT.deliveredSupplies) {
            missionTarget = findNearestCellOfType(CELL_TYPES.SUPPLY_PICKUP);
        } else if (ROBOT.hasSupplies && !ROBOT.deliveredSupplies) {
            missionTarget = findNearestCellOfType(CELL_TYPES.HOSPITAL);
        } else if (ROBOT.deliveredSupplies && !ROBOT.returnedToStart) {
            missionTarget = { x: 0, y: 0 };
        }

        if (missionTarget) {
            // Use A* pathfinding to find a safe path to the target
            // (A* already avoids danger zones completely)
            const path = findPath(
                currentPosition.x,
                currentPosition.y,
                missionTarget.x,
                missionTarget.y
            );

            if (path && path.length > 0) {
                const nextStep = path[0];
                const dx = nextStep.x - currentPosition.x;
                const dy = nextStep.y - currentPosition.y;

                logDecision(`Taking safe path away from danger zones.`);
                moveRobot(dx, dy);
                return true;
            }
        }
    }

    return false; // No resource management needed
}

// Find the nearest cell of a specific type
function findNearestCellOfType(type) {
    let nearest = null;
    let minDistance = Infinity;

    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (cityMap[y][x] === type) {
                const distance = calculateDistance(ROBOT.position.x, ROBOT.position.y, x, y);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = { x, y };
                }
            }
        }
    }

    return nearest;
}

// Calculate Manhattan distance between two points
function calculateDistance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// A* Pathfinding algorithm to find the shortest path
function findPath(startX, startY, targetX, targetY) {
    // Priority queue for open nodes
    const openSet = [];
    // Set of visited nodes
    const closedSet = new Set();
    // Map to store the best previous node for each node
    const cameFrom = new Map();
    // Cost from start to each node
    const gScore = new Map();
    // Estimated total cost from start to goal through each node
    const fScore = new Map();

    // Initialize start node
    const startKey = `${startX},${startY}`;
    openSet.push({ x: startX, y: startY, key: startKey });
    gScore.set(startKey, 0);
    fScore.set(startKey, calculateDistance(startX, startY, targetX, targetY));

    while (openSet.length > 0) {
        // Sort open set by fScore (lowest first)
        openSet.sort((a, b) => {
            return (fScore.get(a.key) || Infinity) - (fScore.get(b.key) || Infinity);
        });

        // Get the node with lowest fScore
        const current = openSet.shift();

        // If we reached the target
        if (current.x === targetX && current.y === targetY) {
            // Reconstruct the path
            return reconstructPath(cameFrom, current);
        }

        // Add current to closed set
        closedSet.add(current.key);

        // Check all neighbors
        const neighbors = [
            { dx: 0, dy: -1 }, // up
            { dx: 1, dy: 0 },  // right
            { dx: 0, dy: 1 },  // down
            { dx: -1, dy: 0 }  // left
        ];

        for (const neighbor of neighbors) {
            const nx = current.x + neighbor.dx;
            const ny = current.y + neighbor.dy;
            const neighborKey = `${nx},${ny}`;

            // Skip if out of bounds or blocked
            if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
            if (cityMap[ny][nx] === CELL_TYPES.BUILDING) continue;

            // Skip if it's a danger zone - we want to completely avoid these
            if (cityMap[ny][nx] === CELL_TYPES.DANGER_ZONE) continue;

            // Skip if there's a mobile obstacle
            if (mobileObstacles.some(obs => obs.x === nx && obs.y === ny)) continue;

            // Skip if already in closed set
            if (closedSet.has(neighborKey)) continue;

            // Calculate tentative gScore
            const tentativeGScore = (gScore.get(current.key) || 0) + 1;

            // Check if this neighbor is not in open set or has a better score
            const neighborInOpenSet = openSet.find(node => node.key === neighborKey);
            if (!neighborInOpenSet || tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                // Update path and scores
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + calculateDistance(nx, ny, targetX, targetY));

                // Add to open set if not already there
                if (!neighborInOpenSet) {
                    openSet.push({ x: nx, y: ny, key: neighborKey });
                }
            }
        }
    }

    // No path found
    return null;
}

// Reconstruct path from A* result
function reconstructPath(cameFrom, current) {
    const path = [current];
    let currentKey = current.key;

    while (cameFrom.has(currentKey)) {
        current = cameFrom.get(currentKey);
        currentKey = current.key;
        path.unshift(current);
    }

    // Return the path (excluding the starting position)
    return path.slice(1);
}

// Move towards a target using A* pathfinding
function moveTowardsTarget(targetX, targetY) {
    // Check if we've reached the target
    if (ROBOT.position.x === targetX && ROBOT.position.y === targetY) {
        logDecision(`Reached target location (${targetX}, ${targetY}).`);
        return;
    }

    // Find the optimal path using A*
    const path = findPath(ROBOT.position.x, ROBOT.position.y, targetX, targetY);

    if (path && path.length > 0) {
        // Get the next step in the path
        const nextStep = path[0];

        // Calculate the direction to move
        const dx = nextStep.x - ROBOT.position.x;
        const dy = nextStep.y - ROBOT.position.y;

        // Check if the next step is blocked by a mobile obstacle that wasn't there during pathfinding
        if (mobileObstacles.some(obs => obs.x === nextStep.x && obs.y === nextStep.y)) {
            logDecision(`Path blocked by a mobile obstacle. Recalculating route.`);
            // Try to find an alternative direction
            tryAlternativeDirection(targetX, targetY);
            return;
        }

        // Move in the calculated direction
        moveRobot(dx, dy);

        // Log the path decision
        logDecision(`Moving along optimal path to (${targetX}, ${targetY}). Next step: (${nextStep.x}, ${nextStep.y})`);
    } else {
        // If no path is found, try alternative approach
        logDecision(`No clear path to target (${targetX}, ${targetY}). Trying alternative approach.`);
        tryAlternativeDirection(targetX, targetY);
    }
}

// Check if a path is blocked by buildings or out of bounds
function isPathBlocked(x, y) {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
        return true;
    }

    if (cityMap[y][x] === CELL_TYPES.BUILDING) {
        return true;
    }

    // Check for mobile obstacles
    return mobileObstacles.some(obs => obs.x === x && obs.y === y);
}

// Try alternative directions when the preferred path is blocked
function tryAlternativeDirection(targetX, targetY) {
    const possibleMoves = [
        { dx: 0, dy: -1 }, // up
        { dx: 1, dy: 0 },  // right
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }  // left
    ];

    // Filter out moves that would lead to recently visited positions
    const filteredMoves = possibleMoves.filter(move => {
        const newX = ROBOT.position.x + move.dx;
        const newY = ROBOT.position.y + move.dy;

        // Check if this position was recently visited
        const wasRecentlyVisited = ROBOT.recentPositions.some(pos =>
            pos.x === newX && pos.y === newY
        );

        // Only include moves that don't lead to recently visited positions
        return !wasRecentlyVisited && !isPathBlocked(newX, newY);
    });

    // If we have valid moves after filtering
    if (filteredMoves.length > 0) {
        // Sort remaining moves by how much they reduce the distance to the target
        filteredMoves.sort((a, b) => {
            const distA = calculateDistance(
                ROBOT.position.x + a.dx, ROBOT.position.y + a.dy,
                targetX, targetY
            );
            const distB = calculateDistance(
                ROBOT.position.x + b.dx, ROBOT.position.y + b.dy,
                targetX, targetY
            );
            return distA - distB;
        });

        // Take the best move
        const bestMove = filteredMoves[0];
        moveRobot(bestMove.dx, bestMove.dy);
        return;
    }

    // If all filtered moves are exhausted, try any non-blocked move
    for (const move of possibleMoves) {
        const newX = ROBOT.position.x + move.dx;
        const newY = ROBOT.position.y + move.dy;

        if (!isPathBlocked(newX, newY)) {
            logDecision('No optimal path found. Taking any available path.');
            moveRobot(move.dx, move.dy);
            return;
        }
    }

    // If all directions are blocked, try to clear recent positions and wait
    if (ROBOT.recentPositions.length > 0) {
        logDecision('Stuck in a loop. Clearing movement memory and waiting.');
        ROBOT.recentPositions = [];
    } else {
        logDecision('All paths blocked. Waiting for a clear path.');
    }
}

// Update status message
function updateStatus(message) {
    statusMessage.textContent = message;
}

// Log a decision
function logDecision(decision) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${decision}`;
    decisionLog.appendChild(logEntry);
    decisionLog.scrollTop = decisionLog.scrollHeight;
}

// Clear decision log
function clearDecisionLog() {
    decisionLog.innerHTML = '';
}

// Initialize the simulation when the page loads
window.addEventListener('load', initSimulation);
