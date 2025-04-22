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
  gravity: 0.15,         // Default gravity value (higher = stronger pull)
  jumpStrength: 1,     // Default jump strength
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
  moveSpeed: 2.0,
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
  
  //  Initialize FX Manager AFTER player is created, using player's camera
  fxManager = new FXManager(scene, player.getCamera(), renderer);
  
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
function animate() {
  const delta = clock.getDelta();
  
  // Update player
  if (player) {
    player.update(delta);
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
      physics.setGravity(0.04);
      physics.setJumpStrength(1.0);
      physics.setMaxJumps(3); // More jumps on the moon!
      console.log("Moon gravity preset applied: low gravity, high jumps, triple jump!");
    },
    
    earthGravity() {
      physics.setGravity(0.15);
      physics.setJumpStrength(0.5);
      physics.setMaxJumps(2); // Standard double-jump
      console.log("Earth gravity preset applied: default settings with double-jump");
    },
    
    jupiterGravity() {
      physics.setGravity(0.4);
      physics.setJumpStrength(0.25);
      physics.setMaxJumps(1); // Only one jump on Jupiter - it's too heavy!
      console.log("Jupiter gravity preset applied: high gravity, small jumps, no double-jump");
    }
  };
  
  console.log("Physics presets: presets.moonGravity(), presets.earthGravity(), presets.jupiterGravity()");
  
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
}

// Call at startup
setupDebugCommands();
