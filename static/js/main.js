// Main controller for sphere world walker with character

// Import Three.js and our custom controls
import * as THREE from 'three';
import SphereControls from './SphereControls.js';
import { initEnvironment, collidables } from './world_objects.js';
import OrientationHelper from './OrientationHelper.js';

// --- Constants ---
const R = 100; // Update sphere radius from 50 to 100 to match world_objects.js

// --- Terrain Height Function ---
const TERRAIN_FREQ = 5.0;
const TERRAIN_AMP = 2.5; // Update amplitude to match world_objects.js

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
initEnvironment(scene, 'medium');
debug(`World built with ${collidables.length} collidable objects`);

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

// Trigger initial resize
onWindowResize();

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  // Update controls with delta time
  controls.update(clock.getDelta());
  
  // Re-orthonormalize player axes each frame
  orientHelper.update();
  
  // Render scene
  renderer.render(scene, controls.camera);
}

debug("Starting animation loop");
animate();
