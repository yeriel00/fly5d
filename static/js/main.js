// Main controller for sphere world walker with character

// Import Three.js and our custom controls
import * as THREE from 'three';
import SphereControls from './SphereControls.js';
// Import the FULL terrain height function and initEnvironment
import { initEnvironment, collidables, getFullTerrainHeight } from './world_objects.js';
import OrientationHelper from './OrientationHelper.js';
import FXManager from './fx_manager.js';
import LowPolyGenerator from './low_poly_generator.js';
// import AudioManager from './audio_manager.js'; // Comment out the audio manager import if you don't need it
import Player from './player.js';
// Import TWEEN.js for smooth animations
import TWEEN from '/static/js/libs/tween.esm.js';
// Add import at the top with other imports
import FPSMonitor from './fps_monitor.js';
import AppleSystem from './AppleSystem.js'; // Add this import
// Add CrosshairSystem import
import CrosshairSystem from './CrosshairSystem.js';

// --- Constants ---
const R = 400; // INCREASED radius from 300 to 400 for more spacious feel

// FIXED: Declare shared variables at the top level
let player;
let fxManager;
let placeOnSphereFunc;
const clock = new THREE.Clock(); // MOVED: Initialize clock at the top level

// --- Terrain Height Function ---
// REMOVED the basic getTerrainHeight here - we now import getFullTerrainHeight

// Add a debug function to main.js
function debug(info) {
  console.log(`[MAIN] ${info}`);
}

// --- Setup WebGL Renderer & Scene ---
const canvas = document.getElementById('c');
if (!canvas) {
    console.error("ERROR: Canvas element with ID 'c' not found!");
}

const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky Blue

// --- Resize Handler ---
function onWindowResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  
  // Update player camera
  if (player) {
    player.resize(w, h);
  }
}

window.addEventListener('resize', onWindowResize);

// --- Lighting ---
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dl = new THREE.DirectionalLight(0xffffff, 0.6);
dl.position.set(5, 10, 5);
scene.add(dl);

// --- Build World ---
debug("Building world...");

// *****************************************************
// MASTER OBJECT PLACEMENT CONFIGURATION - EASY TO ADJUST
// *****************************************************
const worldConfig = {
  // Planet settings
  radius: 400,               // UPDATED to match new radius
  noiseFrequency: 5.0,        
  noiseAmplitude: 8.0,       // Increased amplitude
  
  // Pine trees (base trees)
  baseTrees: {
    trunkHeight: 100,      
    trunkSink: 100,         
    foliageHeight: 60,      
    count: 20               
  },
  
  // Apple trees (low-poly trees with foliage spheres)
  lpTrees: {
    height: 65,              
    sink: 67,                
    minSize: 65,             
    maxSize: 80,             
    count: 1,                 
    countVariation: 2,
    trunkRatio: 1,            
    minTrunkHeight: 120,       
    maxTrunkHeight: 160,      
    useDynamicTrunkHeight: true,
    foliageScale: 8,       // Base multiplier for foliage size (1.0 = default)
    foliageMinScale: 12,    // Minimum foliage scale 
    foliageMaxScale: 16,    // Maximum foliage scale
    foliageVariation: false   // Whether to apply random variation between min/max
  },
  
  // Low-poly rocks
  lpRocks: {
    height: 0.4,          
    sink: 1.0,              
    minSize: 1.6,           
    maxSize: 5.0,           
    count: 9,               
    countVariation: 6,      
    quality: 'high',        
    totalCount: 40          
  },
  
  // Low-poly grass
  lpGrass: {
    height: 6,                
    sink: 6,                  
    minSize: 6,             
    maxSize: 10,             
    count: 12,                
    countVariation: 2        
  },
  
  // Clusters
  clusters: {
    count: 8,                 
    randomExtra: 4,           
    positionVariation: 0.15   
  }
};

// Track fallen apples
const fallenApples = [];

// Track pine tree positions passed from world_objects.js
let pineTrees = [];

// Modified initEnvironment to export placeOnSphere function and pine tree positions
initEnvironment(scene, 'medium', worldConfig, (placerFunc, pineTreePositions) => {
  placeOnSphereFunc = placerFunc;
  
  // Store pine tree positions for apple tree spacing
  if (pineTreePositions && pineTreePositions.length > 0) {
    pineTrees = collidables.filter(obj => 
      obj.mesh?.name === "PineTree" || 
      obj.mesh?.userData?.isPineTree
    );
    debug(`Received ${pineTrees.length} pine tree positions for spacing`);
  }
  
  // After world is built, add low-poly details
  enhanceEnvironment();
});

debug(`World built with ${collidables.length} collidable objects`);

// Enhance environment with low-poly details
function enhanceEnvironment() {
  if (!placeOnSphereFunc) {
    console.error("placeOnSphere function not available");
    return;
  }
  
  debug("Enhancing environment with low-poly details...");
  
  try {
    // Find existing pine trees - no longer needed as we get them directly
    // from the callback now, but kept for compatibility
    if (pineTrees.length === 0) {
      pineTrees = collidables.filter(obj => 
        obj.mesh?.name === "PineTree" || 
        obj.mesh?.userData?.isPineTree
      );
    }
    
    debug(`Using ${pineTrees.length} pine trees to avoid during placement`);
    
    // Minimum distance between trees (angular distance on sphere surface)
    // Since we're on a sphere surface, we use angular distance
    const minTreeAngleDistance = 0.2; // About 11.5 degrees
    
    // Check if a position is too close to pine trees
    function isTooCloseToTrees(dir) {
      for (const tree of pineTrees) {
        const treeDir = tree.direction;
        // Calculate angular distance (dot product gives cosine of angle)
        const dot = dir.dot(treeDir);
        const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
        
        if (angle < minTreeAngleDistance) {
          return true; // Too close
        }
      }
      return false; // Good position
    }
    
    // Add clusters of environment objects around the planet
    const clusterCount = worldConfig.clusters.count + 
                         Math.floor(Math.random() * worldConfig.clusters.randomExtra);
    
    // Track total rocks created for global count control
    let totalRocks = 0;
    const maxRocks = worldConfig.lpRocks.totalCount || 30;
    
    for (let i = 0; i < clusterCount; i++) {
      // Create random position on sphere for cluster
      let clusterDir;
      let maxAttempts = 20; // Limit attempts to find a good position
      let attempts = 0;
      
      // Try to find a position away from pine trees for the cluster center
      do {
        clusterDir = new THREE.Vector3().randomDirection();
        attempts++;
      } while (isTooCloseToTrees(clusterDir) && attempts < maxAttempts);
      
      // If we couldn't find a good position after max attempts, we'll try less strict placement
      // for individual objects in the cluster
      const isGoodClusterPosition = attempts < maxAttempts;
      
      if (!isGoodClusterPosition) {
        debug(`Couldn't find ideal cluster position after ${maxAttempts} attempts. Using fallback placement.`);
      }
      
      // Add apple trees in this cluster with direct trunk height control
      const treeCount = worldConfig.lpTrees.count + 
                       Math.floor(Math.random() * worldConfig.lpTrees.countVariation);
      
      for (let t = 0; t < treeCount; t++) {
        // Create base direction with slight variation
        let treeDir;
        attempts = 0;
        
        do {
          // Create slight variation in direction from cluster center
          treeDir = clusterDir.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
              (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
              (Math.random() - 0.5) * worldConfig.clusters.positionVariation
            )
          ).normalize();
          
          attempts++;
        } while (isTooCloseToTrees(treeDir) && attempts < maxAttempts);
        
        // If we still couldn't find a good position, skip this tree
        if (isTooCloseToTrees(treeDir) && isGoodClusterPosition) {
          continue;
        }
        
        // If we reach here, either we found a good position or we're using fallback placement
        const treeSize = worldConfig.lpTrees.minSize + 
                        Math.random() * (worldConfig.lpTrees.maxSize - worldConfig.lpTrees.minSize);
        
        // Trunk height control for apple trees
        let trunkHeight = null;
        let trunkRatio = worldConfig.lpTrees.trunkRatio || 0.65;
        
        if (worldConfig.lpTrees.useDynamicTrunkHeight) {
          // Use direct trunk height
          trunkHeight = worldConfig.lpTrees.minTrunkHeight + 
                       Math.random() * (worldConfig.lpTrees.maxTrunkHeight - worldConfig.lpTrees.minTrunkHeight);
          
          // Also update ratio for any code that might still use it
          trunkRatio = Math.min(1.0, trunkHeight / treeSize);
          
          console.log(`Creating apple tree with explicit trunk height: ${trunkHeight.toFixed(1)}, size: ${treeSize.toFixed(1)}`);
        } else {
          // Use trunk ratio with variation
          trunkRatio = worldConfig.lpTrees.trunkRatio + (Math.random() - 0.5) * 0.2;
          console.log(`Creating apple tree with trunk ratio: ${trunkRatio.toFixed(2)}, size: ${treeSize.toFixed(1)}`);
        }
        
        // Calculate foliage scale - either fixed or with variation
        let foliageScale = worldConfig.lpTrees.foliageScale;
        
        if (worldConfig.lpTrees.foliageVariation) {
          foliageScale = worldConfig.lpTrees.foliageMinScale + 
                         Math.random() * (worldConfig.lpTrees.foliageMaxScale - worldConfig.lpTrees.foliageMinScale);
        }
        
        // Create apple tree with custom foliage scale
        const appleTree = LowPolyGenerator.createTree(
          treeSize, 
          null,   // trunk color (use default)
          null,   // leaves color (use default)
          trunkRatio, 
          trunkHeight,
          foliageScale // New parameter for foliage scale control
        );
        
        console.log(`Creating apple tree with foliage scale: ${foliageScale.toFixed(2)}`);
        
        const placed = placeOnSphereFunc(appleTree, treeDir, 
                              worldConfig.lpTrees.height, worldConfig.lpTrees.sink);
                              
        // If successfully placed, add to our pine trees list to avoid for future objects
        if (placed) {
          // Find the just-placed tree in collidables (it would be the last one added)
          const newTreeObj = collidables[collidables.length - 1];
          if (newTreeObj && newTreeObj.mesh === appleTree) {
            pineTrees.push(newTreeObj); // Add to our avoidance list
          }
        }
      }
      
      // Add rocks in this cluster - USING CLAY-STYLE ROCKS
      const rockCount = worldConfig.lpRocks.count + 
                       Math.floor(Math.random() * worldConfig.lpRocks.countVariation);
      
      // Check global rock count limit
      const rocksToCreate = Math.min(rockCount, maxRocks - totalRocks);
      
      for (let r = 0; r < rocksToCreate; r++) {
        const rockDir = clusterDir.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation
          )
        ).normalize();
        
        const rockSize = worldConfig.lpRocks.minSize + 
                        Math.random() * (worldConfig.lpRocks.maxSize - worldConfig.lpRocks.minSize);
        const rock = LowPolyGenerator.createRock(rockSize);
        placeOnSphereFunc(rock, rockDir, 
                          worldConfig.lpRocks.height, worldConfig.lpRocks.sink);
        
        // Update total count
        totalRocks++;
        
        // Stop if we've reached the limit
        if (totalRocks >= maxRocks) break;
      }
      
      // Add grass patches in this cluster
      const grassCount = worldConfig.lpGrass.count + 
                        Math.floor(Math.random() * worldConfig.lpGrass.countVariation);
      
      for (let g = 0; g < grassCount; g++) {
        const grassDir = clusterDir.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation
          )
        ).normalize();
        
        const grassSize = worldConfig.lpGrass.minSize + 
                         Math.random() * (worldConfig.lpGrass.maxSize - worldConfig.lpGrass.minSize);
        const grass = LowPolyGenerator.createGrass(grassSize);
        placeOnSphereFunc(grass, grassDir, 
                          worldConfig.lpGrass.height, worldConfig.lpGrass.sink);
      }
    }
    
    // Add additional scattered rocks if we haven't hit our limit
    if (totalRocks < maxRocks) {
      const remainingRocks = maxRocks - totalRocks;
      debug(`Adding ${remainingRocks} additional scattered clay rocks to reach count limit`);
      
      for (let i = 0; i < remainingRocks; i++) {
        const dir = new THREE.Vector3().randomDirection();
        const rockSize = worldConfig.lpRocks.minSize + 
                       Math.random() * (worldConfig.lpRocks.maxSize - worldConfig.lpRocks.minSize);
        const rock = LowPolyGenerator.createRock(rockSize);
        placeOnSphereFunc(rock, dir, 
                         worldConfig.lpRocks.height, worldConfig.lpRocks.sink);
      }
    }
    
    debug(`Created ${totalRocks} clay-style rocks in total`);
    
    // Updated message for clarity
    debug("Using only smooth clay-style rocks - boulder formations removed");
    
    debug("Environment enhanced successfully");
    
  } catch (error) {
    console.error("Error enhancing environment:", error);
  }
}

// *** PHYSICS MASTER CONTROLS ***
// Add global physics controls that can be adjusted
const physics = {
  gravity: 0.2,          // Maintained strong gravity (increased from 0.15)
  jumpStrength: 4.5,     // Significantly increased jump strength (from 1.0)
  maxJumps: 2,            // Number of jumps allowed (2 = double jump)
  
  // Method to update the controls when these values change
  updateControls() {
    if (!player) return;
    
    // Update player physics values
    player.updatePhysics({
      gravity: this.gravity,
      jumpStrength: this.jumpStrength,
      maxJumps: this.maxJumps
    });
    
    console.log(`Physics updated: gravity=${this.gravity}, jumpStrength=${this.jumpStrength}, maxJumps=${this.maxJumps}`);
  },
  
  // Convenient methods to adjust values
  setGravity(value) {
    this.gravity = value;
    this.updateControls();
    return this.gravity;
  },
  
  setJumpStrength(value) {
    this.jumpStrength = value;
    this.updateControls();
    return this.jumpStrength;
  },
  
  // Adjust values by percentage
  adjustGravity(percentage) {
    this.gravity *= (1 + percentage/100);
    this.updateControls();
    return this.gravity;
  },
  
  adjustJumpStrength(percentage) {
    this.jumpStrength *= (1 + percentage/100);
    this.updateControls();
    return this.jumpStrength;
  },

  // New method to set max jumps
  setMaxJumps(value) {
    this.maxJumps = Math.max(1, Math.floor(value));
    this.updateControls();
    return this.maxJumps;
  },
};

// *** PLAYER CONFIGURATION ***
const playerConfig = {
  startPosition: new THREE.Vector3(0, 1, 0).normalize(), // Position at north pole
  startElevation: 3,
  eyeHeight: 12, 
  moveSpeed: 18.0,    // INCREASED from 16.0 to 18.0 for faster movement
  lookSpeed: 0.002,
  playerRadius: 6.0, // Collision radius remains the same
  debugMode: false, // Set to true to see player collision body
  sphereRadius: R,
  // *** USE THE FULL TERRAIN HEIGHT FUNCTION ***
  getTerrainHeight: getFullTerrainHeight,
  collidables: collidables
};

// --- Initialize World & Player ---
debug("Building world...");

let waterEffect = null;

// Create FPS monitor early in the script
const fpsMonitor = new FPSMonitor({
  showDisplay: true,
  warningThreshold: 40,
  criticalThreshold: 25,
  autoOptimize: true
});

// Initialize player after world is built
initEnvironment(scene, 'medium', worldConfig, (placerFunc) => {
  placeOnSphereFunc = placerFunc;
  
  // After world is built, add low-poly details
  enhanceEnvironment();
  
  // Now initialize the player with the fully built world
  player = new Player(scene, canvas, {
    ...playerConfig,
    // Connect physics to player
    jumpStrength: physics.jumpStrength,
    gravity: physics.gravity,
    maxJumps: physics.maxJumps
  });

  // Give player some initial ammo after creation
  if (player && player.addAmmo) {
    player.addAmmo('apple', 10); // Start with 10 apples
    console.log("Initial ammo provided: 10 apples");
  }

  // CRITICAL FIX: Make sure we set collidables directly and consistently
  if (player?.weaponSystem?.projectileSystem) {
    console.log(`Setting up projectile collisions with ${collidables.length} objects`);
    player.weaponSystem.projectileSystem.options.collidables = collidables;
    
    // Enable collision effects
    player.weaponSystem.projectileSystem.options.showCollisions = true;
    player.weaponSystem.projectileSystem.options.splashParticleCount = 5;
  }
  
  //  Initialize FX Manager AFTER player is created, using player's camera
  fxManager = new FXManager(scene, player.getCamera(), renderer);
  
  // Initialize player UI including weapon controls
  initializePlayerUI();
  
  // Register apple system optimizer AFTER fpsMonitor is created
  fpsMonitor.registerOptimizer((level) => {
    if (level === 1) {
      // First level optimization
      if (window.applePerformance) window.applePerformance.low();
      
      // Reduce max apples
      if (appleSystem) appleSystem.options.maxApplesPerTree = 3;
      
    } else if (level === 2) {
      // Second level optimization - drastic measures
      if (appleSystem) {
        appleSystem.options.maxApplesPerTree = 2;
        appleSystem.options.growthProbability *= 0.5;
        appleSystem.options.fallProbability *= 0.5;
      }
      
    } else if (level >= 3) {
      // Critical optimization - clear most apples
      if (window.applePerformance) window.applePerformance.clearAll();
    }
  });
  
  // Add crosshair system initialization - ADD THIS AFTER PLAYER CREATION
  const crosshairSystem = new CrosshairSystem({
    color: 'rgba(255, 255, 255, 0.8)',
    size: 14,
    thickness: 1.5,
    dotSize: 2,
    gap: 5,
    chargeIndicator: true
  });
  
  // Make crosshair and charge indicator available globally for other systems
  window.crosshairSystem = crosshairSystem;
  
  // Start animation loop after player is created
  animate();
});

// Remove particle setup - commenting out
// Initialize FX Manager AFTER controls are created
// const fxManager = new FXManager(scene, controls.camera, renderer);

// Comment out audio initialization and usage
// Initialize audio manager
// const audioManager = new AudioManager(controls.camera);

// Remove setupWorldEffects function entirely

// Trigger initial resize
onWindowResize();

// --- Animation Loop ---
function animate(timestamp) {
  const delta = clock.getDelta();
  
  // Update FPS monitor at the start of each frame
  // Make sure timestamp is provided and handle any potential errors
  try {
    if (fpsMonitor && typeof fpsMonitor.update === 'function') {
      fpsMonitor.update(timestamp);
    }
  } catch (e) {
    console.warn("Error updating FPS monitor:", e);
  }
  
  // FIXED: Call update on the TWEEN object imported correctly
  if (TWEEN) {
    // Get FPS safely, with a fallback value
    const fps = (fpsMonitor && typeof fpsMonitor.getFPS === 'function') ? 
                fpsMonitor.getFPS() : 60;
    
    if (fps > 40 || Math.random() < 0.2) { // Only update TWEEN 20% of the time if FPS is low
      TWEEN.update();
    }
  } else {
    console.warn("TWEEN library not properly loaded");
  }
  
  // Update player
  if (player) {
    player.update(delta);
    
    // Update crosshair charge indicator if weapon is charging
    if (window.crosshairSystem && player.weaponSystem) {
      const weaponState = player.getWeaponState();
      if (weaponState && weaponState.isCharging && weaponState.chargeState) {
        window.crosshairSystem.updateCharge(weaponState.chargeState.power);
      } else {
        window.crosshairSystem.updateCharge(0);
      }
    }
  }
  
  // Render scene with player camera
  if (player) {
    renderer.render(scene, player.getCamera());
  }
  
  requestAnimationFrame(animate);
}

debug("Starting animation loop");
// FIXED: Don't call animate() here - we call it after player is created

// Enhanced debug commands to include physics adjustment
function setupDebugCommands() {
  console.log("Debug commands available:");
  console.log("- showCollidables() - List all collision objects");
  console.log("- physics.setGravity(value) - Change gravity strength");
  console.log("- physics.setJumpStrength(value) - Change jump height");
  console.log("- physics.adjustGravity(percent) - Adjust gravity by percentage");
  console.log("- physics.adjustJumpStrength(percent) - Adjust jump by percentage");
  
  // Add to window for console access
  window.showCollidables = () => {
    console.log("All collidables:", collidables);
    
    // Count by type
    const types = {};
    collidables.forEach((obj, index) => {
      const typeName = obj.mesh ? 
        (obj.mesh.name || obj.mesh.constructor.name) : 'unknown';
      
      types[typeName] = (types[typeName] || 0) + 1;
      
      // Log grass-related data
      if (obj.mesh && obj.mesh.userData && obj.mesh.userData.isGrass) {
        console.log(`Object ${index} has isGrass in userData`);
      }
      if (obj.isGrass) {
        console.log(`Object ${index} has isGrass in collidable`);
      }
    });
    
    console.log("Collidables by type:", types);
  };
  
  // Expose physics controls to global scope
  window.physics = physics;
  
  // Quick preset configurations
  window.presets = {
    moonGravity() {
      physics.setGravity(0.08);       // Slightly increased moon gravity
      physics.setJumpStrength(5.0);   // Very strong moon jumps
      physics.setMaxJumps(3); 
      console.log("Moon gravity preset: lower gravity, very high jumps, triple jump!");
      
      // Adjust speed parameters for moon preset
      if (window.movePhysics) {
        movePhysics.airControl = 0.35; 
        movePhysics.groundSpeed = 35.0;
        movePhysics.apply();
      }
    },
    
    earthGravity() {
      physics.setGravity(0.2);        // Maintained current earth gravity
      physics.setJumpStrength(4.5);   // Strong jump force to overcome gravity
      physics.setMaxJumps(2); 
      console.log("Earth gravity preset: normal gravity, high jumps, double-jump!");
      
      // Reset speed parameters for earth preset
      if (window.movePhysics) {
        movePhysics.airControl = 0.3;
        movePhysics.groundSpeed = 32.0;
        movePhysics.apply();
      }
    },
    
    jupiterGravity() {
      physics.setGravity(0.45);       // Kept high jupiter gravity
      physics.setJumpStrength(7.0);   // VERY strong jumps to counteract high gravity
      physics.setMaxJumps(1);
      console.log("Jupiter gravity preset applied: high gravity, powerful jumps, no double-jump");
      
      // Adjust speed parameters for jupiter
      if (window.movePhysics) {
        movePhysics.airControl = 0.25;
        movePhysics.groundSpeed = 40.0;
        movePhysics.apply();
      }
    },
    
    // Super jump preset with even higher values
    superJump() {
      physics.setGravity(0.25);       // Moderate-high gravity
      physics.setJumpStrength(9.0);   // Extremely high jumps
      physics.setMaxJumps(3);
      console.log("SUPER JUMP preset: high gravity but MEGA-high jumps with triple-jump!");
      
      // Higher air control for super jumps
      if (window.movePhysics) {
        movePhysics.airControl = 0.4;
        movePhysics.groundSpeed = 35.0;
        movePhysics.apply();
      }
    },
    
    // Add specific debug command to test jumping
    testJump() {
      // Force player to jump with high force
      if (player && player.controls) {
        // Override jump parameters temporarily
        const oldJumpStrength = player.controls.jumpStrength;
        player.controls.jumpStrength = 6.0;
        
        // Make the jump from current position
        const upDir = player.playerObject.position.clone().normalize();
        player.controls.velocity = upDir.clone().multiplyScalar(player.controls.jumpStrength * 4.5);
        player.controls.isJumping = true;
        player.controls.onGround = false;
        
        // Restore original jump strength
        setTimeout(() => {
          player.controls.jumpStrength = oldJumpStrength;
          console.log("Jump strength restored to:", oldJumpStrength);
        }, 1000);
        
        console.log("TEST JUMP applied with force:", player.controls.jumpStrength * 4.5);
      }
    }
  };
  
  console.log("Physics presets: presets.moonGravity(), presets.earthGravity(), presets.jupiterGravity(), presets.superJump()");
  
  // Add trunk height control commands
  window.setTreeTrunkHeight = (min, max) => {
    worldConfig.lpTrees.minTrunkHeight = min;
    worldConfig.lpTrees.maxTrunkHeight = max;
    worldConfig.lpTrees.useDynamicTrunkHeight = true;
    console.log(`Tree trunk height set to min: ${min}, max: ${max}`);
    return { min, max };
  };
  
  window.useTreeRatio = (ratio = 0.65) => {
    worldConfig.lpTrees.trunkRatio = ratio;
    worldConfig.lpTrees.useDynamicTrunkHeight = false;
    console.log(`Switched to trunk ratio mode with ratio: ${ratio}`);
    return ratio;
  };
  
  console.log("Tree trunk controls (for apple trees): setTreeTrunkHeight(min, max), useTreeRatio(ratio)");
  
  // Update player-related commands
  window.debugPlayer = () => {
    if (!player) return console.log("Player not initialized");
    
    // Get player info
    const info = player.getInfo();
    
    console.log(`Player: onGround=${info.onGround}, isJumping=${info.isJumping}, jumps=${info.jumpsRemaining}/${info.maxJumps}, speed=${info.speed.toFixed(2)}, height=${info.height.toFixed(2)}`);
    console.log(`Gravity working? ${info.isGravityWorking ? "YES - falling" : "NO - rising"}, vertical speed=${info.verticalSpeed.toFixed(3)}`);
    return info;
  };
  
  window.makeJump = () => {
    if (player) {
      player.makeJump();
      console.log("Force jump applied!");
    }
  };
  
  window.togglePlayerDebug = () => {
    if (!player) return;
    playerConfig.debugMode = !playerConfig.debugMode;
    
    // Recreate player with new debug setting
    const oldPos = player.playerObject.position.clone();
    scene.remove(player.playerObject);
    
    player = new Player(scene, canvas, {
      ...playerConfig,
      jumpStrength: physics.jumpStrength,
      gravity: physics.gravity,
      maxJumps: physics.maxJumps
    });
    
    // Try to restore position
    player.playerObject.position.copy(oldPos);
    
    console.log(`Player debug mode: ${playerConfig.debugMode ? "ON" : "OFF"}`);
  };

  console.log("Player commands: debugPlayer(), makeJump(), togglePlayerDebug()");

  // Add collision visualization command
  window.showCollisionShapes = (show = true) => {
    if (!scene) return;
    
    // Remove any existing helpers first
    scene.traverse(obj => {
      if (obj.userData?.isCollisionHelper) {
        scene.remove(obj);
      }
    });
    
    if (!show) return "Collision helpers hidden";
    
    // Add collision visualizers for all collidables
    collidables.forEach((obj, index) => {
      if (!obj.direction || !obj.position || index === 0) return; // Skip planet or invalid objects
      
      let helper;
      
      if (obj.mesh.userData?.isTree || obj.mesh.userData?.isPineTree) {
        // For smooth tree trunks, use a cylinder with fewer segments
        const collisionHeight = obj.collisionHeight || (obj.radius * 2);
        // Use 8 segments for smooth appearance (instead of 16)
        const radius = Math.max(2.0, obj.radius * 0.4);
        const geometry = new THREE.CylinderGeometry(radius, radius, collisionHeight, 8);
        const material = new THREE.MeshBasicMaterial({
          color: 0xff0000,
          wireframe: true,
          opacity: 0.3,
          transparent: true
        });
        helper = new THREE.Mesh(geometry, material);
        // Position cylinder at proper height along the trunk
        helper.position.copy(obj.position);
        helper.position.add(obj.direction.clone().multiplyScalar(collisionHeight / 2));
        // Orient the cylinder along the tree trunk direction
        helper.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), obj.direction);
      } else {
        // Use sphere helper for other objects
        const radius = obj.radius * 0.5 + playerConfig.playerRadius * 0.7;
        helper = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 12),
          new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            opacity: 0.3,
            transparent: true
          })
        );
        helper.position.copy(obj.position);
      }
      
      helper.userData = { isCollisionHelper: true };
      scene.add(helper);
    });
    
    return `Showing collision shapes for ${collidables.length} objects`;
  };
  
  console.log("- showCollisionShapes(true/false) - Show collision volumes");

  // Add foliage scale control commands
  window.setFoliageScale = (scale) => {
    worldConfig.lpTrees.foliageScale = scale;
    worldConfig.lpTrees.foliageVariation = false;
    console.log(`Fixed foliage scale set to: ${scale}`);
    return scale;
  };
  
  window.setFoliageVariation = (min, max) => {
    worldConfig.lpTrees.foliageMinScale = min;
    worldConfig.lpTrees.foliageMaxScale = max;
    worldConfig.lpTrees.foliageVariation = true;
    console.log(`Foliage scale variation set to: ${min} - ${max}`);
    return { min, max };
  };
  
  console.log("Foliage controls: setFoliageScale(scale), setFoliageVariation(min, max)");

  // Improved movement physics controls
  window.movePhysics = {
    // Core movement parameters 
    airControl: 0.3,       // Increased from 0.22
    groundSpeed: 32.0,     // Increased from 18.0
    jumpHeight: 1.0,
    jumpInfluence: 0.35,   // Increased from 0.25
    
    // Apply settings to the player
    apply() {
      if (!player || !player.controls) {
        console.warn("Player not initialized yet");
        return false;
      }
      
      // Update control parameters with appropriate scaling
      player.controls.airControlFactor = this.airControl;
      player.controls.moveSpeed = this.groundSpeed;
      player.controls.jumpDirectionMix = this.jumpInfluence;
      
      // IMPORTANT: Update maximum speeds to match movement speed
      player.controls.maxGroundSpeed = this.groundSpeed * 1.25; // 25% higher than move speed
      player.controls.maxAirSpeed = this.groundSpeed * 1.4;     // 40% higher in air
      
      // Set jump height
      player.controls.jumpStrength = physics.jumpStrength * this.jumpHeight;
      
      console.log(`✓ Movement settings applied! Speed: ${this.groundSpeed}, Air Control: ${this.airControl}`);
      return true;
    },
    
    // Bigger speed boost - 50% faster
    speedBoost() {
      this.groundSpeed *= 1.5; // Increased from 1.2 (20%) to 1.5 (50%)
      this.apply();
      console.log(`💨 Speed boost applied! Ground speed: ${this.groundSpeed.toFixed(1)}`);
    },
    
    // Even faster speed mode
    superSpeed() {
      this.groundSpeed = 75.0;
      this.apply();
      console.log(`🚀 SUPER SPEED activated! Ground speed: ${this.groundSpeed.toFixed(1)}`);
    },
    
    // Reset to balanced defaults
    reset() {
      this.airControl = 0.22;
      this.groundSpeed = 18.0; 
      this.jumpHeight = 1.0;
      this.jumpInfluence = 0.25;
      this.apply();
      console.log("Movement settings reset to balanced defaults");
    }
  };

  // Add a jump debugging function to help diagnose what's happening
  window.debugJump = () => {
    if (!player || !player.controls) {
      return console.log("Player not initialized");
    }
    
    const controls = player.controls;
    console.log({
      // Current state
      onGround: controls.onGround,
      isJumping: controls.isJumping,
      jumpsRemaining: controls.jumpsRemaining,
      maxJumps: controls.maxJumps,
      
      // Jump parameters
      jumpStrength: controls.jumpStrength,
      jumpForceMultiplier: 5.5, // The multiplier used in onKeyDown
      effectiveJumpForce: controls.jumpStrength * 5.5,
      
      // Last jump details
      lastJumpForce: controls._lastJumpForce,
      lastJumpVelocity: controls._lastJumpVelocity,
      
      // Current velocity
      velocity: controls.velocity.clone(),
      speed: controls.velocity.length(),
      verticalComponent: controls.velocity.dot(player.playerObject.position.clone().normalize()),
      
      // Physics state
      gravity: controls.gravity,
      airTime: controls.airTime,
      gravityMultiplier: Math.min(
        controls.maxGravityMultiplier,
        1.0 + (controls.airTime / controls.gravityRampTime) * (controls.maxGravityMultiplier - 1.0)
      )
    });
  };
  
  // Enhance the testJump function to be more useful
  presets.testJump = function() {
    if (!player || !player.controls) {
      return console.log("Player not initialized");
    }
    
    const controls = player.controls;
    const upDir = player.playerObject.position.clone().normalize();
    
    // Reset state for a clean test
    controls.jumpsRemaining = controls.maxJumps;
    controls.onGround = true;
    controls.isJumping = false;
    controls.airTime = 0;
    controls.jumpCooldown = 0;
    
    // Apply a strong test jump with 7x multiplier
    const jumpForce = controls.jumpStrength * 7.0;
    controls.velocity = upDir.clone().multiplyScalar(jumpForce);
    
    // Set jump state
    controls.onGround = false;
    controls.isJumping = true;
    controls.jumpsRemaining--;
    controls.jumpAirTime = 0;
    
    console.log(`TEST JUMP applied with force: ${jumpForce.toFixed(2)}, velocity: ${controls.velocity.length().toFixed(2)}`);
  };
  
  // Add console help for jump debugging
  console.log(
  `
  // *****************************************
  // ***** JUMP DEBUGGING TOOLS *****
  // *****************************************
  // Run these commands to diagnose jump issues:
  
  // Show detailed jump & physics state:
  debugJump()
  
  // Force a test jump with very high force:
  presets.testJump()
  
  // Apply super jump preset (high jumps):
  presets.superJump()
  
  // Force jump with current settings:
  makeJump()
  `);

  // Add a special jump fix preset that restores jumps properly
  window.resetJumps = () => {
    if (player && player.controls) {
      player.controls.jumpsRemaining = player.controls.maxJumps;
      console.log(`✓ Jumps reset to maximum: ${player.controls.maxJumps}`);
      return player.controls.jumpsRemaining;
    }
    return "Player not available";
  };

  // Force player to the ground to reset jump state
  window.forceGroundContact = () => {
    if (player && player.controls) {
      const controls = player.controls;
      controls.onGround = true;
      controls.isJumping = false;
      controls.jumpAirTime = 0;
      controls.jumpsRemaining = controls.maxJumps;
      console.log("✓ Ground contact forced");
      return true;
    }
    return "Player not available";
  };

  // Update console help message to include jump fixes
  console.log(
  `
  // *****************************************
  // ***** JUMP FIX COMMANDS *****
  // *****************************************
  // Run these if you have jump problems:

  resetJumps()            // Restore all jumps
  forceGroundContact()    // Force ground contact state
  `);

  // Add a quick function to debug key events
  window.debugKeys = () => {
    // Set up key event logging
    const oldKeyDown = document.onkeydown;
    const oldKeyUp = document.onkeyup;
    
    document.onkeydown = (e) => {
      console.log(`Key Down: "${e.key}" (code: ${e.keyCode})`);
      if (oldKeyDown) oldKeyDown(e);
    };
    
    document.onkeyup = (e) => {
      console.log(`Key Up: "${e.key}" (code: ${e.keyCode})`);
      if (oldKeyUp) oldKeyUp(e);
    };
    
    console.log("Key event debugging enabled - press keys to see events");
    
    // After 30 seconds, restore original handlers
    setTimeout(() => {
      document.onkeydown = oldKeyDown;
      document.onkeyup = oldKeyUp;
      console.log("Key event debugging disabled");
    }, 30000);
  };

  // Add this to the init code to ensure key handlers work properly
  window.addEventListener('blur', () => {
    // Reset all pressed keys when window loses focus
    if (player && player.controls) {
      console.log("Window blur - resetting all key states");
      player.controls.keys = {};
      
      // Also reset jump cooldown
      player.controls.jumpCooldown = 0;
    }
  });

  // Add an emergency jump fix function
  window.fixJump = () => {
    if (!player || !player.controls) return "Player not available";
    
    const controls = player.controls;
    
    // Reset all jump-related state
    controls.jumpsRemaining = controls.maxJumps;
    controls.jumpCooldown = 0;
    controls.isJumping = false;
    controls.airTime = 0;
    controls.jumpAirTime = 0;
    
    // Clear the space key state in case it's stuck
    controls.keys[' '] = false;
    controls.keys['spacebar'] = false;
    
    console.log("✅ Jump system completely reset!");
    return {
      jumpsRemaining: controls.jumpsRemaining,
      jumpCooldown: 0,
      maxJumps: controls.maxJumps
    };
  };

  // Add to console help messages
  console.log(`
  // *****************************************
  // ***** JUMP FIX EMERGENCY COMMANDS *****
  // *****************************************
  // Run these if jumps are completely broken:

  fixJump()              // Reset ALL jump state
  debugKeys()            // Monitor key events (30 seconds)
  `);
  
  // Add debug command to test projectile collisions
  window.testTreeCollision = () => {
    if (!player?.weaponSystem?.projectileSystem) {
      return "Projectile system not initialized";
    }
    
    // Find a tree
    const trees = collidables.filter(obj => 
      obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree
    );
    
    if (trees.length === 0) {
      return "No trees found";
    }
    
    // Get a random tree
    const tree = trees[Math.floor(Math.random() * trees.length)];
    console.log("Targeting tree:", tree);
    
    // Get tree position
    const treePos = tree.position || tree.mesh.position;
    
    // Get player position
    const playerPos = player.playerObject.position.clone();
    
    // Calculate direction to tree
    const dirToTree = treePos.clone().sub(playerPos).normalize();
    
    // Create projectile with velocity toward the tree
    const projectile = player.weaponSystem.projectileSystem.createProjectile(
      // Start position (slightly in front of player)
      playerPos.clone().addScaledVector(dirToTree, 5),
      // Velocity (straight toward the tree, fast)
      dirToTree.clone().multiplyScalar(30),
      'apple'
    );
    
    // Log info
    console.log(`Fired test projectile toward tree at ${treePos.toArray()}`);
    console.log(`Player at ${playerPos.toArray()}`);
    console.log(`Direction: ${dirToTree.toArray()}`);
    
    return "Test projectile fired directly at a tree";
  };
  
  console.log(`
  // *****************************************
  // ***** COLLISION TESTING COMMANDS *****
  // *****************************************
  testTreeCollision()        // Fire a test projectile directly at a tree
  `);
}

// Call at startup
setupDebugCommands();

// Add event listeners for weapon actions
function setupWeaponControls() {
  // Mouse controls for slingshot
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && player) { // Left mouse button
      player.fireWeapon();
      
      // Show feedback in debug console
      const weaponState = player.getWeaponState();
      console.log(`Charging ${weaponState.currentWeapon}...`);
    }
  });
  
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0 && player) { // Left mouse button
      const result = player.releaseWeapon();
      
      if (result && result.projectile) {
        console.log(`Fired ${result.projectile.type} with power ${result.power.toFixed(2)}`);
      }
    }
  });
  
  // Weapon switching
  document.addEventListener('keydown', (e) => {
    if (e.key === 'q' && player) {
      const oldState = player.getWeaponState();
      const switched = player.switchWeapon();
      
      if (switched) {
        const newState = player.getWeaponState();
        console.log(`Switched from ${oldState.currentWeapon} to ${newState.currentWeapon}`);
      }
    }
  });
}

// Add this call after player initialization
function initializePlayerUI() {
  // Set up weapon controls
  setupWeaponControls();
  
  // Add ammo UI element
  const ammoDisplay = document.createElement('div');
  ammoDisplay.id = 'ammo-display';
  ammoDisplay.style.position = 'absolute';
  ammoDisplay.style.bottom = '20px';
  ammoDisplay.style.right = '20px';
  ammoDisplay.style.color = 'white';
  ammoDisplay.style.fontFamily = 'Arial, sans-serif';
  ammoDisplay.style.fontSize = '18px';
  ammoDisplay.style.padding = '10px';
  ammoDisplay.style.background = 'rgba(0, 0, 0, 0.5)';
  ammoDisplay.style.borderRadius = '5px';
  document.body.appendChild(ammoDisplay);
  
  // Add power meter for slingshot charging
  const powerMeter = document.createElement('div');
  powerMeter.id = 'power-meter';
  powerMeter.style.position = 'absolute';
  powerMeter.style.bottom = '20px';
  powerMeter.style.left = '50%';
  powerMeter.style.transform = 'translateX(-50%)';
  powerMeter.style.width = '200px';
  powerMeter.style.height = '10px';
  powerMeter.style.background = 'rgba(0, 0, 0, 0.5)';
  powerMeter.style.borderRadius = '5px';
  powerMeter.style.overflow = 'hidden';
  powerMeter.style.display = 'none';
  
  const powerFill = document.createElement('div');
  powerFill.id = 'power-fill';
  powerFill.style.width = '0%';
  powerFill.style.height = '100%';
  powerFill.style.background = 'red';
  powerFill.style.transition = 'width 0.05s';
  
  powerMeter.appendChild(powerFill);
  document.body.appendChild(powerMeter);
  
  // Update UI in animation loop
  function updateUI() {
    if (!player) return;
    
    const weaponState = player.getWeaponState();
    
    // Update ammo display
    ammoDisplay.textContent = `${weaponState.currentWeapon === 'slingshot' ? 'Apples' : 'Golden Apples'}: ${
      weaponState.currentWeapon === 'slingshot' ? weaponState.ammo.apple : weaponState.ammo.goldenApple
    }`;
    
    // Update power meter
    if (weaponState.isCharging && weaponState.chargeState) {
      powerMeter.style.display = 'block';
      powerFill.style.width = `${weaponState.chargeState.power * 100}%`;
    } else {
      powerMeter.style.display = 'none';
    }
    
    requestAnimationFrame(updateUI);
  }
  
  // Start UI update loop
  updateUI();
  
  // Add debug commands
  window.giveAmmo = (type = 'apple', amount = 10) => {
    if (!player) return "Player not initialized";
    const newAmount = player.addAmmo(type, amount);
    console.log(`Added ${amount} ${type}(s). New total: ${newAmount}`);
    return newAmount;
  };
  
  console.log(`
  // *****************************************
  // ***** WEAPON CONTROLS *****
  // *****************************************
  Mouse 1 (hold): Charge slingshot
  Mouse 1 (release): Fire projectile
  Q: Switch between regular and golden slingshot
  
  // Debug command:
  giveAmmo('apple', 10)    // Add 10 apple ammo
  giveAmmo('goldenApple', 5) // Add 5 golden apple ammo
  `);

  // Add debug visibility controls for projectiles
  window.debugProjectiles = (enable = true) => {
    if (!player?.weaponSystem?.projectileSystem) return "Projectile system not initialized";
    
    // Add highlight effect to all active projectiles
    const projectiles = player.weaponSystem.projectileSystem.projectiles;
    
    if (enable) {
      // Add glowing effect to projectiles
      projectiles.forEach(projectile => {
        // Add point light to make projectile more visible
        const pointLight = new THREE.PointLight(0xff8800, 1, 10);
        projectile.mesh.add(pointLight);
        projectile.debugLight = pointLight;
        
        // Increase size of projectile
        projectile.mesh.scale.set(2, 2, 2);
      });
      console.log(`Enhanced visibility for ${projectiles.length} projectiles`);
    } else {
      // Remove debug enhancements
      projectiles.forEach(projectile => {
        if (projectile.debugLight) {
          projectile.mesh.remove(projectile.debugLight);
          delete projectile.debugLight;
        }
        projectile.mesh.scale.set(1, 1, 1);
      });
      console.log("Removed projectile enhancements");
    }
    
    return `${projectiles.length} projectiles affected`;
  };
  
  // Give player initial ammo at startup
  setTimeout(() => {
    if (player) {
      player.addAmmo('apple', 20);
      player.addAmmo('goldenApple', 5);
      console.log("Initial ammo loaded: 20 apples, 5 golden apples");
    }
  }, 1000);
  
  // Add debug command to console help
  console.log(`
  // *****************************************
  // ***** VISIBILITY COMMANDS *****
  // *****************************************
  debugProjectiles()         // Make projectiles more visible
  debugProjectiles(false)    // Normal projectile visibility
  `);

  // Add debug command for camera direction and projectile testing
  window.testFire = () => {
    if (!player || !player.weaponSystem) return "Player weapon system not initialized";
    
    // Get camera position and direction
    const camera = player.getCamera();
    const cameraPos = new THREE.Vector3();
    const cameraDir = new THREE.Vector3();
    
    camera.getWorldPosition(cameraPos);
    camera.getWorldDirection(cameraDir);
    
    console.log("Camera world position:", cameraPos);
    console.log("Camera world direction:", cameraDir);
    
    // Force fire an apple as a test
    const testPosition = cameraPos.clone().addScaledVector(cameraDir, 2);
    const testVelocity = cameraDir.clone().multiplyScalar(40);
    
    const projectile = player.weaponSystem.projectileSystem.createProjectile(
      testPosition,
      testVelocity,
      'apple'
    );
    
    // Add visual helpers
    // Direction line
    const dirHelper = new THREE.ArrowHelper(
      cameraDir.clone(),
      cameraPos.clone(),
      5,
      0xff0000,
      0.5,
      0.3
    );
    scene.add(dirHelper);
    
    // Force the projectile system to process updates
    player.weaponSystem.projectileSystem.update(0.16);
    
    return "Test projectile fired";
  };
  
  // Add debug command to console help
  console.log(`
  // *****************************************
  // ***** PROJECTILE TESTING COMMANDS *****
  // *****************************************
  testFire()               // Fire a test apple and visualize camera direction
  `);

  // Add trajectory visualizer for testing projectile physics
  window.showTrajectory = (steps = 20) => {
    if (!player?.weaponSystem?.projectileSystem) return "Weapon system not available";
    
    // Get camera direction and position
    const camera = player.getCamera();
    const cameraPos = new THREE.Vector3();
    const cameraDir = new THREE.Vector3();
    
    camera.getWorldPosition(cameraPos);
    camera.getWorldDirection(cameraDir);
    
    // Calculate initial velocity
    const speed = player.weaponSystem.options.projectileSpeed;
    const velocity = cameraDir.clone().multiplyScalar(speed);
    
    // Create a trail of spheres showing trajectory
    const projectileSystem = player.weaponSystem.projectileSystem;
    const sphereRadius = projectileSystem.options.projectileRadius * 0.5;
    const gravity = projectileSystem.options.gravity;
    const sphereR = projectileSystem.options.sphereRadius;
    
    // Calculate trajectory points
    const points = [];
    let pos = cameraPos.clone().addScaledVector(cameraDir, 2); // Start in front of camera
    let vel = velocity.clone();
    const deltaTime = 0.1; // simulate in 100ms steps
    
    for (let i = 0; i < steps; i++) {
      // Add point
      points.push(pos.clone());
      
      // Calculate next position
      const dir = pos.clone().normalize();
      
      // Apply gravity
      const flightTime = i * deltaTime;
      const gravityMult = Math.min(1.0 + flightTime * 0.25, 2.0);
      vel.addScaledVector(dir.negate(), gravity * gravityMult * deltaTime * 60);
      
      // Apply velocity
      pos.addScaledVector(vel, deltaTime);
      
      // Check for terrain collision
      const terrainHeight = projectileSystem.options.getTerrainHeight(pos.clone().normalize());
      const terrainRadius = sphereR + terrainHeight;
      
      if (pos.length() < terrainRadius + sphereRadius) {
        break; // Stop at collision
      }
    }
    
    // Visualize the trajectory
    // Remove any existing trajectory markers
    scene.traverse(obj => {
      if (obj.userData?.isTrajectoryMarker) {
        scene.remove(obj);
      }
    });
    
    // Add spheres along trajectory
    points.forEach((point, i) => {
      const sphereGeo = new THREE.SphereGeometry(sphereRadius * (1.0 - i/steps * 0.7), 8, 6);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xff0000 : 0xffaa00,
        wireframe: true,
        opacity: 1.0 - (i / steps * 0.8),
        transparent: true
      });
      
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(point);
      sphere.userData = { isTrajectoryMarker: true };
      scene.add(sphere);
    });
    
    return `Created trajectory preview with ${points.length} points`;
  };
  
  // Add clear function for trajectory preview
  window.clearTrajectory = () => {
    scene.traverse(obj => {
      if (obj.userData?.isTrajectoryMarker) {
        scene.remove(obj);
      }
    });
    return "Trajectory markers cleared";
  };
  
  console.log(`
  // *****************************************
  // ***** ENHANCED PROJECTILE COMMANDS *****
  // *****************************************
  showTrajectory(30)      // Show predicted projectile path (with 30 points)
  clearTrajectory()       // Remove trajectory visualization
  `);

  // Add a debug function to help inspect and visualize precise collision shapes
  window.showPreciseCollisions = () => {
    if (!scene) return "Scene not available";
    
    // Clear any existing visualizers
    scene.traverse(obj => {
      if (obj.userData?.isCollisionHelper) {
        scene.remove(obj);
      }
    });
    
    // Add new precise collision visualizers
    collidables.forEach((obj, index) => {
      if (!obj.direction || !obj.position || index === 0) return; // Skip planet or invalid objects
      
      // Different visualization based on object type
      if (obj.mesh.userData?.isTree || obj.mesh.userData?.isPineTree) {
        // For trees, show actual trunk cylinder
        const trunkRadius = obj.actualRadius || Math.max(0.5, obj.radius * 0.25);
        const trunkHeight = obj.collisionHeight || (obj.radius * 2);
        
        // Trunk visualization (red wireframe)
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshBasicMaterial({
          color: 0xff0000,
          wireframe: true,
          opacity: 0.5,
          transparent: true
        });
        
        const trunkHelper = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunkHelper.position.copy(obj.position);
        trunkHelper.position.add(obj.direction.clone().multiplyScalar(trunkHeight / 2));
        trunkHelper.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), obj.direction);
        trunkHelper.userData = { isCollisionHelper: true };
        scene.add(trunkHelper);
        
        // Foliage visualization if it's an apple tree (green wireframe)
        if (obj.mesh.name === "AppleTree" || obj.mesh.userData?.isTree) {
          const foliageRadius = obj.radius * 0.6; // 60% of the original collision radius
          const foliageHeight = obj.radius * 2;
          const foliageGeometry = new THREE.SphereGeometry(foliageRadius, 8, 6);
          const foliageMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            opacity: 0.3,
            transparent: true
          });
          
          const foliageHelper = new THREE.Mesh(foliageGeometry, foliageMaterial);
          foliageHelper.position.copy(obj.position);
          foliageHelper.position.add(obj.direction.clone().multiplyScalar(trunkHeight + foliageRadius * 0.5));
          foliageHelper.userData = { isCollisionHelper: true };
          scene.add(foliageHelper);
        }
      } else {
        // For other objects, use a simple sphere with actual radius
        const radius = obj.actualRadius || obj.radius * 0.7;
        const helper = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 12, 8),
          new THREE.MeshBasicMaterial({
            color: obj.mesh.userData?.isRock ? 0xff9900 : 0x0099ff,
            wireframe: true,
            opacity: 0.3,
            transparent: true
          })
        );
        helper.position.copy(obj.position);
        helper.userData = { isCollisionHelper: true };
        scene.add(helper);
      }
    });
    
    return "Showing precise collision shapes";
  };
  
  // Add helper to check projectile collision with a specific object
  window.testCollisionWith = (objectIndex) => {
    if (!collidables[objectIndex]) return "Invalid object index";
    
    const obj = collidables[objectIndex];
    console.log("Testing collision with:", obj);
    
    // Get current camera position and direction
    const camera = player.getCamera();
    const cameraPos = new THREE.Vector3();
    const cameraDir = new THREE.Vector3();
    
    camera.getWorldPosition(cameraPos);
    camera.getWorldDirection(cameraDir);
    
    // Create test projectile
    const testPos = cameraPos.clone().addScaledVector(cameraDir, 2); // Start in front of camera
    const projectileSystem = player.weaponSystem.projectileSystem;
    
    // Advanced collision test
    const projectileDir = testPos.clone().normalize();
    const objDir = obj.direction;
    const dot = projectileDir.dot(objDir);
    const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
    
    // Surface distance
    const surfaceDist = angle * projectileSystem.options.sphereRadius;
    
    console.log({
      objectName: obj.mesh?.name || 'Unknown',
      objectType: obj.mesh?.userData?.isTree ? 'Tree' : obj.mesh?.userData?.isRock ? 'Rock' : 'Other',
      surfaceDistance: surfaceDist.toFixed(2),
      radius: obj.radius,
      actualRadius: obj.actualRadius || obj.radius,
      collisionHeight: obj.collisionHeight,
      collisionWouldOccur: surfaceDist < (obj.actualRadius || obj.radius * 0.7) + projectileSystem.options.projectileRadius
    });
    
    // Create visual line from camera to object for debugging
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      testPos,
      obj.position
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000,
      linewidth: 3
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.userData = { isCollisionHelper: true };
    scene.add(line);
    
    return "Collision test complete";
  };
  
  // Add commands to console help
  console.log(`
  // *****************************************
  // ***** COLLISION DEBUGGING COMMANDS *****
  // *****************************************
  showPreciseCollisions()    // Visualize actual collision shapes
  testCollisionWith(5)       // Test collision with object at index 5
  `);

  // Add controls for collision responsiveness
  window.toggleCollisionDebug = (enable = true) => {
    if (!player?.weaponSystem?.projectileSystem) return "Projectile system not available";
    
    const projectileSystem = player.weaponSystem.projectileSystem;
    projectileSystem.debug = enable;
    
    console.log(`Collision debug visualization ${enable ? 'enabled' : 'disabled'}`);
    return `Collision debugging ${enable ? 'ON' : 'OFF'}`;
  };
  
  // Add high precision collision tester that creates a grid of test points
  window.testCollisionPrecision = (objectIndex, gridSize = 5) => {
    if (!collidables[objectIndex]) return "Invalid object index";
    
    const obj = collidables[objectIndex];
    console.log("Testing precise collision with:", obj);
    
    // Get object properties
    const objPos = obj.position.clone();
    const objDir = obj.direction.clone();
    const isTree = obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree;
    
    // Get object radius
    let objRadius = obj.radius;
    if (isTree) {
      objRadius = Math.min(obj.radius * 0.25, 0.8); // Trunk radius
    }
    
    // Create visual for object collision radius
    const geoHelper = new THREE.SphereGeometry(objRadius, 16, 12);
    const matHelper = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    const sphereHelper = new THREE.Mesh(geoHelper, matHelper);
    sphereHelper.position.copy(objPos);
    sphereHelper.userData = { isCollisionHelper: true };
    scene.add(sphereHelper);
    
    // Create test points in a grid around the object
    const points = [];
    const gridHalfSize = (gridSize - 1) / 2;
    const spacing = objRadius * 0.5;
    
    // Create basis vectors for the grid (tangent to sphere surface)
    const up = objDir.clone();
    const tangent1 = new THREE.Vector3(1, 0, 0).cross(up);
    if (tangent1.lengthSq() < 0.01) {
      tangent1.set(0, 0, 1).cross(up);
    }
    tangent1.normalize();
    
    const tangent2 = up.clone().cross(tangent1).normalize();
    
    // Create grid of test points
    for (let x = -gridHalfSize; x <= gridHalfSize; x++) {
      for (let y = -gridHalfSize; y <= gridHalfSize; y++) {
        // Create offset vector in tangent plane
        const offset = tangent1.clone().multiplyScalar(x * spacing)
                      .add(tangent2.clone().multiplyScalar(y * spacing));
        
        // Create test point position
        const testPos = objPos.clone().add(offset);
        
        // Ensure point is on the sphere surface
        const dirToSphere = testPos.clone().normalize();
        const sphereSurfacePos = dirToSphere.multiplyScalar(R + 0.5); // Just above surface
        
        // Create visual marker for test point
        const pointGeo = new THREE.SphereGeometry(0.1, 8, 6);
        const pointMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const pointMesh = new THREE.Mesh(pointGeo, pointMat);
        pointMesh.position.copy(sphereSurfacePos);
        pointMesh.userData = { isCollisionHelper: true };
        scene.add(pointMesh);
        
        points.push({
          mesh: pointMesh,
          position: sphereSurfacePos.clone()
        });
      }
    }
    
    // Report results
    console.log(`Created ${points.length} test points around object`);
    
    // Create test projectiles from each point toward the object
    points.forEach(point => {
      // Direction from point to object center
      const dirToObj = objPos.clone().sub(point.position).normalize();
      
      // Create line showing test ray
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        point.position,
        objPos
      ]);
      const lineMat = new THREE.LineBasicMaterial({ 
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.userData = { isCollisionHelper: true };
      scene.add(line);
      
      // Test collision detection
      const dir1 = point.position.clone().normalize();
      const dir2 = objDir;
      const dot = dir1.dot(dir2);
      const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
      const surfaceDist = angle * R;
      
      // Show result
      const wouldCollide = isTree ? 
        (surfaceDist < objRadius + 1.0) : // For trees (trunk)
        (surfaceDist < objRadius + 1.0);  // For other objects
        
      point.mesh.material.color.set(wouldCollide ? 0x00ff00 : 0xff0000);
    });
    
    // Add cleanup function
    return "Collision test grid created";
  };
  
  // Add command to adjust projectile radius
  window.adjustProjectileRadius = (multiplier = 1.0) => {
    if (!player?.weaponSystem?.projectileSystem) return "Projectile system not available";
    
    const oldRadius = player.weaponSystem.projectileSystem.options.projectileRadius;
    player.weaponSystem.projectileSystem.options.projectileRadius = oldRadius * multiplier;
    
    const newRadius = player.weaponSystem.projectileSystem.options.projectileRadius;
    
    console.log(`Adjusted projectile radius: ${oldRadius} -> ${newRadius}`);
    return `Projectile radius set to ${newRadius.toFixed(2)}`;
  }; // FIXED: Added missing semicolon and closing brace

  // Add commands to console help
  console.log(`
  // *****************************************
  // ***** COLLISION PRECISION CONTROLS *****
  // *****************************************
  toggleCollisionDebug(true)     // Show collision checks in real-time
  testCollisionPrecision(5, 7)   // Test collision with object 5 using 7x7 grid
  adjustProjectileRadius(1.2)    // Make projectiles 20% larger for collision
  `);

  // Add projectile system tweaker for fine tuning collision detection
  window.tweakProjectileCollision = (settings = {}) => {
    if (!player?.weaponSystem?.projectileSystem) 
      return "Projectile system not available";
    
    const system = player.weaponSystem.projectileSystem;
    const oldSettings = {
      projectileRadius: system.options.projectileRadius,
      bounceFactor: system.options.bounceFactor,
      minBounceSpeed: system.options.minBounceSpeed
    };
    
    // Apply new settings
    if (settings.projectileRadius !== undefined) {
      system.options.projectileRadius = settings.projectileRadius;
    }
    
    if (settings.bounceFactor !== undefined) {
      system.options.bounceFactor = settings.bounceFactor;
    }
    
    if (settings.minBounceSpeed !== undefined) {
      system.options.minBounceSpeed = settings.minBounceSpeed;
    }
    
    console.log("Previous settings:", oldSettings);
    console.log("New settings:", {
      projectileRadius: system.options.projectileRadius,
      bounceFactor: system.options.bounceFactor,
      minBounceSpeed: system.options.minBounceSpeed
    });
    
    return "Projectile collision settings updated";
  };
  
  // Optimize specifically for tree collisions
  window.optimizeTreeCollision = () => {
    // Apply a preset of parameters known to work well with trees
    if (!player?.weaponSystem?.projectileSystem) 
      return "Projectile system not available";
    
    const system = player.weaponSystem.projectileSystem;
    
    // Apply optimized settings for tree collisions
    system.options.projectileRadius = 1.5;  // Increased radius
    system.options.bounceFactor = 0.5;     // Reduced bounce for better control
    system.options.minBounceSpeed = 4.0;   // Stop bouncing sooner
    
    // Force enable collision debugging
    system.debug = true;
    
    console.log("Tree collision optimization applied!");
    console.log("Projectile radius increased to 1.5");
    console.log("Collision debugging enabled");
    
    return "Tree collision optimization complete";
  };
  
  // Add special tree penetration fix
  window.fixTreePenetration = () => {
    if (!collidables) return "Collidables not available";
    
    // Modify all tree collision volumes to be more robust
    let treeCount = 0;
    
    collidables.forEach(obj => {
      const isTree = obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree;
      if (isTree) {
        // Force increase collision radius for all trees
        obj.radius *= 1.2;  // 20% wider radius
        
        // Ensure trunk radius is never too small
        if (obj.trunkRadius < 0.8) {
          obj.trunkRadius = Math.max(0.8, obj.trunkRadius);
        }
        
        // Ensure collision height is set properly
        if (!obj.collisionHeight) {
          obj.collisionHeight = obj.radius * 2.5;
        }
        
        treeCount++;
      }
    });
    
    return `Adjusted collision parameters for ${treeCount} trees`;
  };
  
  // Add command to show tree collision volumes
  window.showTreeCollisions = () => {
    if (!scene) return "Scene not available";
    
    // Remove any existing helpers
    scene.traverse(obj => {
      if (obj.userData?.isTreeHelper) {
        scene.remove(obj);
      }
    });
    
    // Add visualization for tree collision volumes
    let count = 0;
    collidables.forEach(obj => {
      const isTree = obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree;
      if (!isTree || !obj.position || !obj.direction) return;
      
      // Create trunk cylinder (red)
      const trunkRadius = obj.trunkRadius || Math.max(0.5, obj.radius * 0.2);
      const trunkHeight = obj.collisionHeight || obj.radius * 2;
      
      const trunkGeo = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, 8);
      const trunkMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        opacity: 0.7,
        transparent: true
      });
      
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.copy(obj.position);
      trunk.position.add(obj.direction.clone().multiplyScalar(trunkHeight / 2));
      trunk.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), obj.direction);
      trunk.userData.isTreeHelper = true;
      scene.add(trunk);
      
      // Create at least 2 spheres for projectile collision checking
      // This helps us visualize the continuous collision detection
      const projRadius = player.weaponSystem.projectileSystem.options.projectileRadius;
      const height1 = trunkHeight * 0.33;
      const height2 = trunkHeight * 0.66;
      
      // Create spheres at different heights
      [height1, height2].forEach(height => {
        const point = obj.position.clone().add(
          obj.direction.clone().multiplyScalar(height)
        );
        
        const sphereGeo = new THREE.SphereGeometry(projRadius, 12, 8);
        const sphereMat = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          wireframe: true,
          opacity: 0.3,
          transparent: true
        });
        
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.copy(point);
        sphere.userData.isTreeHelper = true;
        scene.add(sphere);
      });
      
      count++;
    });
    
    return `Created collision visualization for ${count} trees`;
  };
  
  // Add console help
  console.log(`
  // *****************************************
  // ***** TREE COLLISION FIX COMMANDS *****
  // *****************************************
  optimizeTreeCollision()     // Apply specialized settings for tree collisions
  fixTreePenetration()        // Make all tree trunks have more robust collision
  showTreeCollisions()        // Show the actual collision geometry for trees
  `);

  // Add a "super tree fix" command that applies maximum tree collision detection
  window.fixTreeCollisionCompletely = () => {
    if (!player?.weaponSystem?.projectileSystem) 
      return "Projectile system not available";
    
    const system = player.weaponSystem.projectileSystem;
    
    // Apply MAX settings for tree collision
    system.options.projectileRadius = 2.0;  // Very large radius
    system.options.bounceFactor = 0.4;      // Medium bounce
    system.options.minBounceSpeed = 3.0;    // Stop bouncing at moderate speed
    
    // Enable debug visualization
    system.debug = true;
    
    // Fix all tree colliders
    let treeCount = 0;
    collidables.forEach(obj => {
      const isTree = obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree;
      if (isTree) {
        // CRITICAL: Use much larger virtual trunk radius
        obj.trunkRadius = Math.max(obj.radius * 0.5, 1.2); // Minimum 1.2 units, very wide
        
        // Ensure collision height is properly set
        obj.collisionHeight = obj.radius * 4; // Make trunks extra tall
        
        // Mark tree for special collision handling
        obj.specialCollisionHandling = true;
        
        treeCount++;
      }
    });
    
    console.log("✅ SUPER TREE COLLISION FIX APPLIED");
    console.log(`✓ Modified ${treeCount} trees with maximum collision parameters`);
    console.log("✓ Projectile radius increased to 2.0");
    console.log("✓ Debug visualization enabled");
    
    // Show the visualization
    showTreeCollisions();
    
    return "Super tree collision fix applied successfully!";
  };
  
  // Add the command to the console help
  console.log(`
  // *****************************************
  // ***** ULTIMATE TREE COLLISION FIX *****
  // *****************************************
  fixTreeCollisionCompletely()  // Apply maximum tree collision detection
                               // This should solve the issue for certain!
  `);

  // Add a refined tree collision fix that makes apples bounce properly off tree trunks
  window.improveTreeBounce = () => {
    if (!player?.weaponSystem?.projectileSystem) 
      return "Projectile system not available";
    
    const system = player.weaponSystem.projectileSystem;
    
    // Apply bounce-optimized settings
    system.options.projectileRadius = 1.2;    // Moderate radius (down from 2.0)
    system.options.bounceFactor = 0.6;        // Higher bounce factor (up from 0.4)
    system.options.minBounceSpeed = 2.5;      // Lower threshold to allow more bounces
    
    // Enable debug visualization
    system.debug = true;
    
    // Fix all tree colliders with better bounce parameters
    let treeCount = 0;
    collidables.forEach(obj => {
      const isTree = obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree;
      if (isTree) {
        // Use moderate trunk radius for better visual collision point
        obj.trunkRadius = Math.max(obj.radius * 0.3, 0.7); // Smaller radius for visual accuracy
        
        // Ensure collision height is properly set
        obj.collisionHeight = obj.radius * 3; // Make trunks tall enough
        
        // Set bounce-specific parameters
        obj.bounceFactor = 0.7; // Higher bounce factor for trees specifically
        
        treeCount++;
      }
    });
    
    console.log("✨ IMPROVED TREE BOUNCE PHYSICS APPLIED");
    console.log(`✓ Modified ${treeCount} trees with better bounce parameters`);
    console.log("✓ Projectile radius set to 1.2 for more accurate collisions");
    console.log("✓ Bounce factor increased to 0.6 for more lively bounces");
    
    // Show the visualization
    showTreeCollisions();
    
    return "Tree bounce physics improved!";
  };
  
  // Add the command to the console help
  console.log(`
  // *****************************************
  // ***** IMPROVED TREE BOUNCE PHYSICS *****
  // *****************************************
  improveTreeBounce()         // Apply better bounce physics for tree collisions
                              // Makes apples bounce realistically off tree trunks
  `);
}

// Initialize apple system with extremely conservative settings for better performance
const appleSystem = new AppleSystem(scene, {
  sphereRadius: R,
  getTerrainHeight: getFullTerrainHeight,
  onAppleCollected: handleAppleCollection,
  maxApplesPerTree: 4,       // Reduced from 6 for much better performance
  growthTime: 90,           // Much slower growth to reduce update frequency
  appleRadius: 3.0,         // Keep size to match projectiles
  groundLifetime: 180,      // Longer lifetime means fewer updates for despawning/spawning
  growthProbability: 0.02,  // Very low growth chance to maintain fewer active apples
  fallProbability: 0.005     // Very low fall chance to maintain fewer physics calculations
});

// Set performance mode based on device capabilities
const checkPerformance = () => {
  // Simple detection based on estimated GPU power
  const isLowPerformanceDevice = 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.screen && window.screen.width < 1024);
    
  if (appleSystem.setLowPerformanceMode) {
    appleSystem.setLowPerformanceMode(isLowPerformanceDevice);
    console.log(`Detected ${isLowPerformanceDevice ? 'LOW' : 'NORMAL'} performance device`);
  }
};

// Check performance after initialization
setTimeout(checkPerformance, 1000);

// Add performance controls to the window
window.applePerformance = {
  low: () => {
    if (appleSystem.setLowPerformanceMode) {
      appleSystem.setLowPerformanceMode(true);
      console.log("Low performance mode enabled");
    }
  },
  normal: () => {
    if (appleSystem.setLowPerformanceMode) {
      appleSystem.setLowPerformanceMode(false);
      console.log("Normal performance mode enabled");
    }
  },
  status: () => {
    if (appleSystem.lowPerformanceMode !== undefined) {
      return `Currently in ${appleSystem.lowPerformanceMode ? 'LOW' : 'NORMAL'} performance mode`;
    }
    return "Performance mode unknown";
  },
  maxApples: (count) => {
    if (appleSystem && typeof count === 'number') {
      const oldCount = appleSystem.options.maxApplesPerTree;
      appleSystem.options.maxApplesPerTree = Math.max(1, Math.min(20, count));
      console.log(`Changed max apples per tree: ${oldCount} -> ${appleSystem.options.maxApplesPerTree}`);
      return appleSystem.options.maxApplesPerTree;
    }
    return "Invalid count";
  },
  clearAll: () => {
    if (!appleSystem) return "Apple system not initialized";
    
    // Clear all ground apples
    appleSystem.groundApples.forEach(apple => {
      if (apple.mesh && apple.mesh.parent) {
        appleSystem.scene.remove(apple.mesh);
      }
    });
    appleSystem.groundApples = [];
    
    // Clear all tree apples
    Object.values(appleSystem.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple && point.apple) {
          appleSystem.scene.remove(point.apple);
          point.hasApple = false;
          point.apple = null;
          point.growthProgress = 0;
        }
      });
    });
    
    console.log("All apples cleared to improve performance");
    return "All apples cleared";
  }
};

// Fix the handleAppleCollection function that is referenced but not defined
/**
 * Handle apple collection event - simplified for performance
 */
function handleAppleCollection(type, value, position) {
  // Add to player's ammo without extra effects
  if (player) {
    player.addAmmo(type, value);
  }
}
