// Main controller for sphere world walker with character

// Import Three.js and our custom controls
import * as THREE from 'three';
import SphereControls from './SphereControls.js';
import { initEnvironment, collidables } from './world_objects.js';
import OrientationHelper from './OrientationHelper.js';
import FXManager from './fx_manager.js';
import LowPolyGenerator from './low_poly_generator.js';
import AudioManager from './audio_manager.js';

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
  
  // Base trees from world_objects.js
  baseTrees: {
    trunkHeight: 10,          // Trunk height
    trunkSink: 0,            // How deep trunk sinks
    foliageHeight: 10,        // Foliage height
    foliageSink: 8,           // How deep foliage sinks
  },
  
  // Low-poly trees
  lpTrees: {
    height: 0,                // Height offset above terrain
    sink: 2,                  // How deep trunks sink into terrain
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
  }
};

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
    
    debug("Environment enhanced successfully");
    
  } catch (error) {
    console.error("Error enhancing environment:", error);
  }
}

// --- Initialize Controls ---
debug("Initializing controls...");
const controls = new SphereControls(
  new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000),
  canvas,
  {
    sphereRadius: R,
    getTerrainHeight: getTerrainHeight,
    moveSpeed: 1.0, // Increase speed for larger planet
    lookSpeed: 0.002,
    jumpStrength: 0.5, // Scaled up jump height
    gravity: -0.03,
    eyeHeight: 1.8,
    createPlayerBody: true,
    playerRadius: 1.0, // Increased from 0.6
    collidables: collidables,
    // Start player at a specific point above terrain
    startPosition: new THREE.Vector3(0, 0, 1).normalize()
  }
);

// Add controls object to scene
scene.add(controls.getObject());

// Add orientation helper
const orientHelper = new OrientationHelper(controls.getObject());

// Initialize FX Manager AFTER controls are created
const fxManager = new FXManager(scene, controls.camera, renderer);

// Initialize audio manager
const audioManager = new AudioManager(controls.camera);

// Setup effects AFTER fxManager and controls are initialized
function setupWorldEffects() {
  // Create a waterfall near the lake
  const waterfall1 = fxManager.createWaterfall(
    new THREE.Vector3(70, -20, 70), // position
    new THREE.Vector3(0, 1, 0),    // direction
    3, // width
    10, // height
    300 // particle count
  );
  
  // Create fireflies near the cabin
  const cabinDir = new THREE.Vector3(1, 0, 1).normalize();
  const cabinPos = cabinDir.clone().multiplyScalar(R);
  fxManager.createFireflies(cabinPos, 10, 50);
  
  // More fireflies in tree-dense areas
  for (let i = 0; i < 3; i++) {
    const randomDir = new THREE.Vector3().randomDirection();
    const pos = randomDir.clone().multiplyScalar(R);
    fxManager.createFireflies(pos, 8 + Math.random() * 5, 30 + Math.random() * 20);
  }
  
  // Add waterfall sound
  const waterfallPos = new THREE.Vector3(70, -20, 70);
  const waterfallSound = audioManager.createWaterfallSound(waterfallPos);
  scene.add(waterfallSound);
  
  // Add campfire sound near cabin
  const fireSound = audioManager.createFireSound(cabinPos);
  scene.add(fireSound);
}

// Call setupWorldEffects after ALL initialization
setupWorldEffects();

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
  
  // Update visual effects
  fxManager.update();
  
  // Update audio (pass player velocity for dynamic sound changes)
  const playerVelocity = controls.getVelocity ? controls.getVelocity() : new THREE.Vector3();
  audioManager.updateDayNightCycle(fxManager.timeOfDay);
  audioManager.update(delta, playerVelocity);
  
  // Render scene
  renderer.render(scene, controls.camera);
  
  requestAnimationFrame(animate);
}

debug("Starting animation loop");
animate();

function setupDebugCommands() {
  console.log("Debug commands available:");
  console.log("- showCollidables() - List all collision objects");
  
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
}

// Call at startup
setupDebugCommands();
