// Main controller for sphere world walker with character

// Import Three.js and our custom controls
import * as THREE from 'three';
import SphereControls from './SphereControls.js';
import { initEnvironment, collidables } from './world_objects.js';
import OrientationHelper from './OrientationHelper.js';
import FXManager from './fx_manager.js';
import LowPolyGenerator from './low_poly_generator.js';
// import AudioManager from './audio_manager.js'; // Comment out the audio manager import if you don't need it

// --- Constants ---
const R = 100; // Update sphere radius from 50 to 100 to match world_objects.js

// --- Terrain Height Function ---
const TERRAIN_FREQ = 5.0;
const TERRAIN_AMP = 2.5; // Update amplitude to match world_objects.js

// Reference to helper function from world_objects.js
let placeOnSphereFunc; // Declare variable before use

function getTerrainHeight(normPos) {
  const pos = normPos.clone().multiplyScalar(R);
  const noise = Math.sin(pos.x * TERRAIN_FREQ / R) * 
                Math.sin(pos.y * TERRAIN_FREQ / R) * 
                Math.cos(pos.z * TERRAIN_FREQ / R);
                
  return noise * TERRAIN_AMP;
}

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
  
  // Update camera aspect if controls are initialized
  if (controls && controls.camera) {
    controls.camera.aspect = w / h;
    controls.camera.updateProjectionMatrix();
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
  radius: 100,                // Planet radius
  noiseFrequency: 5.0,        // Terrain noise frequency
  noiseAmplitude: 2.5,        // Terrain noise amplitude
  
  // Lake settings
  lakeDepth: 5.0,             // How deep to recess the lake
  waterOffset: 0.5,           // How far below terrain rim to place water
  
  // Base trees 
  baseTrees: {
    trunkHeight: 10,          // Height of trunk (half added above terrain)
    trunkSink: 5,             // How deep trunk is embedded in ground (was 0)
    foliageHeight: 10,        // Height of the foliage cone
    foliageSink: 0,           // How deep foliage sits (was 8 - adjust to 0)
    count: 20                 // Number of trees
  },
  
  // Low-poly trees (apple trees, interactive)
  lpTrees: {
    height: 2,                // Height offset above terrain
    sink: 4,                  // How deep trunks sink into terrain
    minSize: 8,               // Minimum tree size
    maxSize: 18,              // Maximum tree size
    count: 1,                 // Trees per cluster (min)
    countVariation: 2         // Additional random trees per cluster
  },
  
  // Low-poly rocks
  lpRocks: {
    height: 0,                // Height offset above terrain
    sink: 0,                  // How deep rocks sink into terrain
    minSize: 0.5,             // Minimum rock size
    maxSize: 2.0,             // Maximum rock size
    count: 2,                 // Rocks per cluster (min)
    countVariation: 3         // Additional random rocks per cluster
  },
  
  // Scattered rocks
  scatteredRocks: {
    height: 0,                // Height offset above terrain
    sink: 0,                // How deep scattered rocks sink
    minSize: 0.8,             // Minimum rock size
    maxSize: 2.0,             // Maximum rock size
    count: 15                 // Total scattered rocks
  },
  
  // Low-poly grass
  lpGrass: {
    height: 0,                // Height offset above terrain
    sink: 0,                  // How deep grass sinks into terrain
    minSize: 0.8,             // Minimum grass patch size
    maxSize: 1.6,             // Maximum grass patch size
    count: 2,                 // Grass patches per cluster (min)
    countVariation: 2         // Additional random patches per cluster
  },
  
  // Fence posts
  fence: {
    height: -1,               // Height offset for fence posts
    sink: 0,                  // How deep posts sink
    count: 36                 // Number of fence posts around equator
  },
  
  // Bridge planks
  bridge: {
    height: 1,                // Height offset for planks
    sink: 0,                  // How deep planks sink
    count: 3                  // Number of bridge planks
  },
  
  // Cabin
  cabin: {
    height: -6,               // Height offset for cabin
    sink: 3                   // How deep cabin sinks
  },
  
  // Clusters
  clusters: {
    count: 8,                 // Base number of environmental clusters
    randomExtra: 4,           // Additional random clusters (0-4)
    positionVariation: 0.15   // Random direction variation (0-1)
  },
  
  // Boulder settings
  boulders: {
    height: 0,             // Height offset above terrain  
    sink: 0.5,             // How deep they sink into terrain
    minSize: 2.5,          // Minimum boulder size
    maxSize: 4.0,          // Maximum boulder size
    count: 5               // Number of boulders to place
  },

  // Apple tree settings
  appleTrees: {
    height: 0,                // Height offset above terrain
    sink: 2,                  // How deep trunks sink into terrain
    minSize: 6,               // Minimum tree size (smaller than regular trees)
    maxSize: 12,              // Maximum tree size
    count: 1,                 // Trees per cluster (min)
    countVariation: 2         // Additional random trees per cluster
  }
};

// Track fallen apples
const fallenApples = [];

// Modified initEnvironment to export placeOnSphere function
initEnvironment(scene, 'medium', worldConfig, (placerFunc) => {
  placeOnSphereFunc = placerFunc;
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
    // Add clusters of environment objects around the planet
    const clusterCount = worldConfig.clusters.count + 
                         Math.floor(Math.random() * worldConfig.clusters.randomExtra);
    
    for (let i = 0; i < clusterCount; i++) {
      // Create random position on sphere
      const dir = new THREE.Vector3().randomDirection();
      
      // Add trees in this cluster
      const treeCount = worldConfig.lpTrees.count + 
                       Math.floor(Math.random() * worldConfig.lpTrees.countVariation);
      
      for (let t = 0; t < treeCount; t++) {
        // Create slight variation in direction
        const treeDir = dir.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation
          )
        ).normalize();
        
        const treeSize = worldConfig.lpTrees.minSize + 
                        Math.random() * (worldConfig.lpTrees.maxSize - worldConfig.lpTrees.minSize);
        const tree = LowPolyGenerator.createTree(treeSize);
        placeOnSphereFunc(tree, treeDir, 
                          worldConfig.lpTrees.height, worldConfig.lpTrees.sink);
      }
      
      // Add rocks in this cluster
      const rockCount = worldConfig.lpRocks.count + 
                       Math.floor(Math.random() * worldConfig.lpRocks.countVariation);
      
      for (let r = 0; r < rockCount; r++) {
        const rockDir = dir.clone().add(
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
      }
      
      // Add grass patches in this cluster (similar pattern to above)
      const grassCount = worldConfig.lpGrass.count + 
                        Math.floor(Math.random() * worldConfig.lpGrass.countVariation);
      
      for (let g = 0; g < grassCount; g++) {
        const grassDir = dir.clone().add(
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

      // Add apple trees in this cluster (separate from regular trees)
      const appleTreeCount = worldConfig.appleTrees.count + 
                     Math.floor(Math.random() * worldConfig.appleTrees.countVariation);
      
      for (let t = 0; t < appleTreeCount; t++) {
        // Create slight variation in direction
        const treeDir = dir.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation,
            (Math.random() - 0.5) * worldConfig.clusters.positionVariation
          )
        ).normalize();
        
        const treeSize = worldConfig.appleTrees.minSize + 
                        Math.random() * (worldConfig.appleTrees.maxSize - worldConfig.appleTrees.minSize);
        const tree = LowPolyGenerator.createTree(treeSize);
        placeOnSphereFunc(tree, treeDir, 
                          worldConfig.appleTrees.height, worldConfig.appleTrees.sink);
      }
    }
    
    // Add additional scattered rocks
    for (let i = 0; i < worldConfig.scatteredRocks.count; i++) {
      const dir = new THREE.Vector3().randomDirection();
      const rockSize = worldConfig.scatteredRocks.minSize + 
                      Math.random() * (worldConfig.scatteredRocks.maxSize - worldConfig.scatteredRocks.minSize);
      const rock = LowPolyGenerator.createRock(rockSize);
      placeOnSphereFunc(rock, dir, 
                        worldConfig.scatteredRocks.height, worldConfig.scatteredRocks.sink);
    }
    
    // Add special large boulders for climbing
    for (let i = 0; i < worldConfig.boulders.count; i++) {
      const dir = new THREE.Vector3().randomDirection();
      const size = worldConfig.boulders.minSize + 
                  Math.random() * (worldConfig.boulders.maxSize - worldConfig.boulders.minSize);
                  
      const boulder = LowPolyGenerator.createBoulder(size);
      placeOnSphereFunc(boulder, dir, 
                      worldConfig.boulders.height, worldConfig.boulders.sink);
                      
      debug(`Placed boulder ${i+1} of ${worldConfig.boulders.count}`);
    }
    
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
    if (!controls) return;
    
    // Update control values
    controls.gravity = this.gravity;
    controls.jumpStrength = this.jumpStrength;
    controls.maxJumps = this.maxJumps;
    controls.jumpsRemaining = Math.min(controls.jumpsRemaining, this.maxJumps);
    
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

// --- Initialize Controls ---
debug("Initializing controls...");
const controls = new SphereControls(
  new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000),
  canvas,
  {
    sphereRadius: R,
    getTerrainHeight: getTerrainHeight,
    moveSpeed: 1.0, 
    lookSpeed: 0.002,
    jumpStrength: physics.jumpStrength, // Use from physics object
    gravity: physics.gravity,           // Use from physics object
    maxJumps: physics.maxJumps,  // Pass max jumps parameter
    eyeHeight: 1.9,    
    createPlayerBody: true,
    playerRadius: 1.0,
    collidables: collidables,
    startPosition: new THREE.Vector3(0, 0, 1).normalize()
  }
);

// Add controls object to scene
scene.add(controls.getObject());

// Add orientation helper
const orientHelper = new OrientationHelper(controls.getObject());

// Remove particle setup - commenting out
// Initialize FX Manager AFTER controls are created
const fxManager = new FXManager(scene, controls.camera, renderer);

// Comment out audio initialization and usage
// Initialize audio manager
// const audioManager = new AudioManager(controls.camera);

// Remove setupWorldEffects function entirely

// Trigger initial resize
onWindowResize();

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  
  // Update controls with delta time
  controls.update(delta);
  
  // Re-orthonormalize player axes each frame
  orientHelper.update();
  
  // Handle apple physics and collisions
  updateApplePhysics(delta);
  
  // REMOVED: Audio manager updates
  // audioManager.updateDayNightCycle(fxManager.timeOfDay);
  // audioManager.update(delta, playerVelocity);
  
  // Render scene
  renderer.render(scene, controls.camera);
  
  requestAnimationFrame(animate);
}

debug("Starting animation loop");
animate();

// Physics for detached apples
function updateApplePhysics(delta) {
  // Apply gravity and collision for fallen apples
  for (let i = fallenApples.length - 1; i >= 0; i--) {
    const apple = fallenApples[i];
    if (!apple || !apple.userData) continue;
    
    // Apply gravity toward planet center
    const gravityDir = apple.position.clone().normalize().negate();
    apple.userData.velocity.addScaledVector(gravityDir, 0.05 * delta);
    
    // Apply velocity to position
    apple.position.addScaledVector(apple.userData.velocity, delta);
    
    // Apply rotation
    apple.rotation.x += apple.userData.angularVelocity.x * delta;
    apple.rotation.y += apple.userData.angularVelocity.y * delta;
    apple.rotation.z += apple.userData.angularVelocity.z * delta;
    
    // Check for terrain collision
    const appleDir = apple.position.clone().normalize();
    const terrainHeight = getTerrainHeight(appleDir);
    const terrainRadius = R + terrainHeight;
    
    // If apple hits terrain, stop it
    if (apple.position.length() < terrainRadius + 0.15) {
      // Position at surface
      apple.position.copy(appleDir.multiplyScalar(terrainRadius + 0.15));
      
      // Bounce with damping
      const normalVel = apple.userData.velocity.dot(appleDir);
      if (normalVel < 0) {
        // Reflect velocity vector with damping
        const restitution = 0.3; // Bounciness
        apple.userData.velocity.addScaledVector(appleDir, -normalVel * (1 + restitution));
        
        // Apply friction to tangent component
        apple.userData.velocity.multiplyScalar(0.95);
      }
      
      // If almost stopped, remove from physics simulation
      if (apple.userData.velocity.lengthSq() < 0.01) {
        apple.userData.velocity.set(0, 0, 0);
        apple.userData.isResting = true;
        
        // Orient apple to terrain
        const upVector = apple.position.clone().normalize();
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.lookAt(
          new THREE.Vector3(0, 0, 0),
          apple.position,
          new THREE.Vector3(0, 1, 0)
        );
        apple.quaternion.setFromRotationMatrix(tempMatrix);
        
        // Remove from physics list after a while
        setTimeout(() => {
          const idx = fallenApples.indexOf(apple);
          if (idx !== -1) fallenApples.splice(idx, 1);
        }, 10000); // Remove after 10 seconds
      }
    }
  }
  
  // Check for nearby apples to detach from trees
  if (Math.random() < 0.01) { // 1% chance per frame to check
    try {
      checkForAppleDetachment();
    } catch (e) {
      console.error("Error in apple detachment:", e);
    }
  }
}

// Check if any apples should detach when player is nearby
function checkForAppleDetachment() {
  // Get player position
  const playerPos = controls.getObject().position;
  
  // Find all apple trees in range - using a safer traversal method
  const appleTrees = [];
  scene.traverse(object => {
    if (object.userData && object.userData.isAppleTree) {
      appleTrees.push(object);
    }
  });
  
  // Process each tree separately
  appleTrees.forEach(tree => {
    // Check if tree is close to player
    const treePos = tree.position;
    const distSq = playerPos.distanceToSquared(treePos);
    
    // Only process trees within reasonable range
    if (distSq > 400) return; // 20 units squared
    
    // Find apples on this tree
    const apples = [];
    tree.traverse(child => {
      if (child.userData && child.userData.isApple && child.userData.detachable) {
        apples.push(child);
      }
    });
    
    // Process apples - separate from traversal to avoid modification issues
    apples.forEach(apple => {
      // Small random chance for this apple to detach
      if (Math.random() < 0.1) { // 10% chance when checking
        try {
          // Get world position before removing
          const worldPos = apple.getWorldPosition(new THREE.Vector3());
          
          // Remove from parent
          apple.parent.remove(apple);
          
          // Create and add detached apple
          const detachedApple = LowPolyGenerator.createDetachedApple(worldPos);
          scene.add(detachedApple);
          fallenApples.push(detachedApple);
          
          console.log("Apple detached from tree!");
        } catch (e) {
          console.error("Error detaching apple:", e);
        }
      }
    });
  });
}

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
}

// Add debug display for player state
function showPlayerInfo() {
  // Get player info from controls
  const onGround = controls.onGround;
  const isJumping = controls.isJumping;
  const jumpsRemaining = controls.jumpsRemaining;
  const velocity = controls.getVelocity();
  const speed = velocity.length().toFixed(2);
  const pos = controls.getObject().position;
  const height = pos.length() - R;
  
  // Add gravity analysis
  const gravDir = pos.clone().normalize().negate();
  const gravComponent = velocity.dot(gravDir);
  const isGravityWorking = gravComponent > 0 ? "YES - falling" : "NO - rising";
  
  console.log(`Player: onGround=${onGround}, isJumping=${isJumping}, jumps=${jumpsRemaining}/${controls.maxJumps}, speed=${speed}, height=${height.toFixed(2)}`);
  console.log(`Gravity working? ${isGravityWorking}, vertical speed=${gravComponent.toFixed(3)}`);
}

// Add to global for console access
window.debugPlayer = showPlayerInfo;
window.makeJump = () => {
  controls.velocity.addScaledVector(
    controls.getObject().position.clone().normalize(),
    1.0
  );
  controls.isJumping = true;
  controls.onGround = false;
  console.log("Force jump applied!");
};

console.log("Debug commands: debugPlayer(), makeJump()");

// Call at startup
setupDebugCommands();
