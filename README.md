# 🤖 Robot City Simulation

![image](https://github.com/user-attachments/assets/b1db1d8e-8ee9-4af0-9334-bb4451db9df6)
![image](https://github.com/user-attachments/assets/860240bb-48e9-4eae-9820-986e95468ac6)


![Robot City Simulation](https://img.shields.io/badge/Robot-City_Simulation-blue)
![HTML](https://img.shields.io/badge/HTML-5-orange)
![CSS](https://img.shields.io/badge/CSS-3-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)

A sophisticated web-based simulation of an autonomous robot navigating through a 12x12 city grid, making intelligent decisions, managing resources, and completing delivery missions.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Robot AI Logic](#robot-ai-logic)
- [City Environment](#city-environment)
- [Resource Management](#resource-management)
- [Pathfinding Algorithm](#pathfinding-algorithm)
- [User Interface](#user-interface)
- [Controls](#controls)
- [Installation](#installation)
- [Usage](#usage)

## 🌟 Overview

This project simulates an autonomous robot navigating through a complex city environment. The robot must efficiently deliver supplies to hospitals while managing its energy and fuel resources, avoiding obstacles and danger zones, and making intelligent decisions about its path.

## ✨ Features

- **Interactive 12x12 City Grid**: Visualize the robot's movement in real-time
- **Autonomous Navigation**: Advanced AI for optimal pathfinding
- **Resource Management**: Monitor and manage energy and fuel levels
- **Supply Delivery System**: Pick up and deliver supplies to hospitals
- **Obstacle Avoidance**: Navigate around both static and mobile obstacles
- **Dark/Light Mode Toggle**: Customize your viewing experience
- **Simulation Controls**: Start, stop, reset, and adjust simulation speed
- **Manual Override**: Take control of the robot with keyboard inputs
- **Decision Log**: Track the robot's decision-making process
- **Status Updates**: Real-time feedback on the robot's current state

## 🧠 Robot AI Logic

The robot's decision-making process is governed by a sophisticated AI system that prioritizes tasks and makes optimal decisions at each step:

### Mission Objectives

1. **Supply Delivery Cycle**:
   - Navigate to the supply pickup location
   - Collect one supply (cargo capacity: 1)
   - Deliver the supply to the nearest hospital
   - Return to the supply pickup for the next delivery
   - Complete a total of 2 deliveries

2. **Return Home**:
   - After completing all deliveries, return to the starting position (0,0)

### Decision Hierarchy

The robot follows a strict decision hierarchy at each step:

1. **Unstuck Protocol**: If the robot detects it's stuck in a loop, it will execute an unstuck protocol to find a new path
   ```javascript
   if (isRobotStuck()) {
       attemptToGetUnstuck();
       return;
   }
   ```

2. **Resource Management**: Check if resources are critically low and prioritize recharging/refueling
   ```javascript
   if (handleResourceManagement()) {
       return; // Resource management took priority
   }
   ```

3. **Mission Objectives**: Based on current state, determine the next objective
   ```javascript
   if (ROBOT.deliveredSupplies && !ROBOT.returnedToStart) {
       // Return to start after completing all deliveries
       moveTowardsTarget(0, 0);
   } else if (ROBOT.hasSupplies) {
       // Deliver supplies to hospital
       const hospital = findNearestCellOfType(CELL_TYPES.HOSPITAL);
       moveTowardsTarget(hospital.x, hospital.y);
   } else {
       // Get supplies from pickup location
       const supplyPickup = findNearestCellOfType(CELL_TYPES.SUPPLY_PICKUP);
       moveTowardsTarget(supplyPickup.x, supplyPickup.y);
   }
   ```

### Pathfinding Strategy

The robot uses a combination of A* pathfinding and heuristic-based movement decisions:

1. **A* Pathfinding**: For complex routes, especially around danger zones
2. **Heuristic Movement**: For immediate decisions when full pathfinding isn't necessary
   ```javascript
   // Sort moves by how much they reduce distance to target
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
   ```

3. **Danger Avoidance**: Special logic to detect and avoid danger zones
   ```javascript
   if (dangerZones.length > 0) {
       // Use A* pathfinding to find a safe path around danger zones
       const path = findPath(
           currentPosition.x, currentPosition.y,
           missionTarget.x, missionTarget.y
       );
   }
   ```

4. **Anti-Loop Protection**: Tracks recent positions to avoid getting stuck in movement loops
   ```javascript
   // Add current position to recent positions list
   ROBOT.recentPositions.push({x: ROBOT.position.x, y: ROBOT.position.y});
   if (ROBOT.recentPositions.length > ROBOT.maxRecentPositions) {
       ROBOT.recentPositions.shift(); // Remove oldest position
   }
   ```

## 🏙️ City Environment

The city is represented as a 12x12 grid with various cell types:

- **Streets**: Normal pathways for the robot
- **Buildings**: Permanent obstacles that block movement
- **Hospitals**: Delivery destinations for supplies
- **Fuel Stations**: Locations to refill the robot's fuel
- **Charging Stations**: Locations to recharge the robot's energy
- **Danger Zones**: Areas that drain resources rapidly
- **Supply Pickup**: Location to collect supplies for delivery
- **Schools**: Special areas to navigate around
- **Mobile Obstacles**: Dynamic obstacles that move around the city

## 🔋 Resource Management

The robot must carefully manage two critical resources:

### Energy
- Starting value: 100 units
- Depleted by movement (1 unit per move)
- Recharged at charging stations
- If energy reaches 0, the mission fails

### Fuel
- Starting value: 50 units
- Depleted by movement (0.5 units per move)
- Refilled at fuel stations
- If fuel reaches 0, the mission fails

The robot intelligently prioritizes resource replenishment when levels get low:
```javascript
// Check if energy is critically low
if (ROBOT.energy < 30) {
    const chargingStation = findNearestCellOfType(CELL_TYPES.CHARGING_STATION);
    if (chargingStation) {
        logDecision(`Energy critically low (${ROBOT.energy}). Moving to charging station.`);
        moveTowardsTarget(chargingStation.x, chargingStation.y);
        return true;
    }
}

// Check if fuel is critically low
if (ROBOT.fuel < 15) {
    const fuelStation = findNearestCellOfType(CELL_TYPES.FUEL_STATION);
    if (fuelStation) {
        logDecision(`Fuel critically low (${ROBOT.fuel}). Moving to fuel station.`);
        moveTowardsTarget(fuelStation.x, fuelStation.y);
        return true;
    }
}
```

## 🧭 Pathfinding Algorithm

The robot uses a sophisticated A* pathfinding algorithm to find optimal paths through the city:

1. **Initialization**: Create open and closed sets, with the start node in the open set
2. **Evaluation**: Calculate F, G, and H scores for each node
   - G = cost from start to current node
   - H = estimated cost from current to goal (Manhattan distance)
   - F = G + H (total estimated cost)
3. **Exploration**: Explore neighbors of the current node with lowest F score
4. **Path Construction**: Once the goal is reached, reconstruct the path
5. **Obstacle Avoidance**: Automatically avoid buildings, danger zones, and mobile obstacles

The algorithm includes special handling for:
- Danger zone avoidance
- Resource-efficient routing
- Dynamic obstacle prediction

## 🎮 Controls

- **Start Button**: Begin the simulation
- **Stop Button**: Pause the simulation
- **Reset Button**: Reset the robot and city to initial state
- **Speed Slider**: Adjust the simulation speed
- **Mode Selection**:
  - **Auto Mode**: Robot moves autonomously using AI
  - **Manual Mode**: Control the robot with arrow keys
- **Theme Toggle**: Switch between light and dark mode

## 💻 Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/robot-city-simulation.git
   ```

2. Navigate to the project directory:
   ```
   cd robot-city-simulation
   ```

3. Open `index.html` in your web browser.

## 🚀 Usage

1. Click the **Start** button to begin the simulation
2. Watch as the robot navigates through the city
3. Monitor the robot's resources and decision log
4. Use the **Stop** button to pause at any time
5. Use the **Reset** button to start over
6. Toggle between auto and manual modes as desired
7. Adjust the simulation speed using the slider
8. Switch between light and dark themes using the toggle in the top right

---

made with ❤️ pra ganhar nota do renatinho.
