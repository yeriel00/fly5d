// Main controller for 5D Hyperspace Fly-Through

// WebGL setup and rendering
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
const scene = new THREE.Scene();

// Movement state
const R = 50, eyeH = 1.6;
let camNorm = new THREE.Vector3(0,1,0);               // Unit surface normal
let camPos  = camNorm.clone().multiplyScalar(R + eyeH); // Camera world position
let yaw=0, pitch=0;
const keys={};

// Perspective camera
const camera = new THREE.PerspectiveCamera(60,1,0.1,2000);
function resize() {
  const w=window.innerWidth, h=window.innerHeight;
  renderer.setSize(w,h);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
resize();

// Performance monitoring
let lastFrameTime = 0;
let frameCount = 0;
let fpsDisplay = document.getElementById('fps-counter');
let lastFpsUpdate = 0;

// Configuration
const config = {
    // Shader parameters
    maxSteps: 100,
    maxDist: 100.0,
    surfDist: 0.001,
    glowFactor: 2.0,
    glowIntensity: 0.8,
    fov: 45.0,
    
    // Movement
    moveSpeed: 0.1,
    lookSpeed: 0.02,
    dimChangeSpeed: 0.02,
    useTPU: false,
    
    // TPU batch parameters
    tpuEnabled: false,
    batchSize: 64,
    batchInterval: 200,  // ms between batches
    world_quality: 'medium'  // default value; will be updated from server config
};

// Try to load server config
fetch('/config')
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Update config with server values
            Object.assign(config, data.config);
            config.tpuEnabled = data.config.use_tpu && data.config.tpu_available;
            // Update quality setting if provided
            config.world_quality = data.config.world_quality || config.world_quality;
            
            console.log('Loaded config from server:', config);
            
            // Update shader uniforms
            uniforms.u_maxSteps.value = config.maxSteps;
            uniforms.u_maxDist.value = config.maxDist;
            uniforms.u_surfDist.value = config.surfDist;
            uniforms.u_glowFactor.value = config.glowFactor;
            uniforms.u_glowIntensity.value = config.glowIntensity;
            uniforms.u_fov.value = config.fov;
        }
    })
    .catch(err => console.error('Failed to load config:', err));

// Shared uniforms for the shader
const uniforms = {
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_time:       { value: 0.0 },
    u_dim:        { value: new THREE.Vector2(4.0, 4.0) },
    u_cameraPos:    { value: new THREE.Vector3(0,0,5) },
    u_cameraForward:{ value: new THREE.Vector3(0,0,-1) },
    u_cameraRight:  { value: new THREE.Vector3(1,0,0) },
    u_cameraUp:     { value: new THREE.Vector3(0,1,0) },
    u_fov:          { value: config.fov },
    u_maxSteps:     { value: config.maxSteps },
    u_maxDist:      { value: config.maxDist },
    u_surfDist:     { value: config.surfDist },
    u_glowFactor:   { value: config.glowFactor },
    u_glowIntensity:{ value: config.glowIntensity }
};

// Add ambient and directional lights with increased intensity
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // boost ambient light
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); // boost directional light
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

// Handle window resize – update renderer and perspective camera
function handleResize() {
    const width  = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);

    // For PerspectiveCamera, just update aspect & projection
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

window.addEventListener('resize', handleResize);
handleResize();

// Key event handlers
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    
    // Special case for space - reset position
    if (e.key === ' ') {
        camPos.set(0, 0, 5);
        yaw = 0;
        pitch = 0;
        uniforms.u_dim.value.set(4.0, 4.0);
        updateUIValues();
    }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// TPU integration for SDF computation
function useTpuForComputation() {
    if (!config.tpuEnabled) return;
    
    // Create a grid of positions to evaluate
    const positions = [];
    const fwd = new THREE.Vector3(
        Math.sin(yaw), Math.sin(pitch), -Math.cos(yaw)
    ).normalize();
    
    // Generate points in view frustum
    for (let i = 0; i < config.batchSize; i++) {
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        const pos = camPos.clone().add(fwd.clone().multiplyScalar(3 + Math.random() * 5))
                         .add(offset);
        positions.push([pos.x, pos.y, pos.z]);
    }
    
    // Send to server for TPU processing
    fetch('/tpu-compute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            positions: positions,
            dims: [uniforms.u_dim.value.x, uniforms.u_dim.value.y]
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            console.log('TPU computation successful');
            // Could use these results for additional effects or optimizations
        }
    })
    .catch(err => console.error('TPU computation error:', err));
}

// Set up periodic TPU computation
if (config.tpuEnabled) {
    setInterval(useTpuForComputation, config.batchInterval);
}

// Update UI with current values
function updateUIValues() {
    document.getElementById('w-dim').textContent = uniforms.u_dim.value.x.toFixed(2);
    document.getElementById('v-dim').textContent = uniforms.u_dim.value.y.toFixed(2);
    document.getElementById('x-pos').textContent = camPos.x.toFixed(2);
    document.getElementById('y-pos').textContent = camPos.y.toFixed(2);
    document.getElementById('z-pos').textContent = camPos.z.toFixed(2);
}

// Import environment objects from new file
import { initEnvironment, collidables } from './world_objects.js';

// After scene is created, initialize the environment:
initEnvironment(scene, config.world_quality);

// Main animation loop
function animate(now) {
    now *= 0.001;
    const deltaTime = now - lastFrameTime;
    lastFrameTime = now;

    // Update FPS counter
    frameCount++;
    if (now - lastFpsUpdate > 1.0) { // Update every second
        fpsDisplay.textContent = Math.round(frameCount / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;
    }

    // Update time uniform (if needed)
    // uniforms.u_time.value = now;

    // Handle dimension changes (updates u_dim for the shader)
    if (keys['q']) uniforms.u_dim.value.x += config.dimChangeSpeed;
    if (keys['e']) uniforms.u_dim.value.x -= config.dimChangeSpeed;
    if (keys['r']) uniforms.u_dim.value.y += config.dimChangeSpeed;
    if (keys['f']) uniforms.u_dim.value.y -= config.dimChangeSpeed;
    // Clamp u_dim values if needed, e.g., uniforms.u_dim.value.x = Math.max(0.1, uniforms.u_dim.value.x);

    // Camera orientation: arrows
    if (keys['arrowleft']) yaw -= config.lookSpeed;
    if (keys['arrowright']) yaw += config.lookSpeed;
    if (keys['arrowup']) pitch = Math.min(pitch + config.lookSpeed, Math.PI / 2 - 0.01);
    if (keys['arrowdown']) pitch = Math.max(pitch - config.lookSpeed, -Math.PI / 2 + 0.01);

    // Calculate camera vectors
    const forward = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    // const up = new THREE.Vector3().crossVectors(right, forward).normalize(); // Ortho camera manages its own up

    // Store previous position for collision
    const previousPos = camPos.clone();

    // Movement: WASD
    if (keys['w']) camPos.addScaledVector(forward, config.moveSpeed);
    if (keys['s']) camPos.addScaledVector(forward, -config.moveSpeed);
    if (keys['a']) camPos.addScaledVector(right, -config.moveSpeed);
    if (keys['d']) camPos.addScaledVector(right, config.moveSpeed);
    // Optional: Add vertical movement (e.g., space/shift) if desired
    // if (keys[' ']) camPos.y += config.moveSpeed;
    // if (keys['shift']) camPos.y -= config.moveSpeed;

    // --- Implement Torus-like Wrapping for Camera ---
    // Define the boundaries of the fundamental domain
    const domainSize = 50; // Should match the size used in world_objects.js
    const halfDomain = domainSize / 2;
    // Wrap X coordinate
    if (camPos.x > halfDomain) camPos.x -= domainSize;
    else if (camPos.x < -halfDomain) camPos.x += domainSize;
    // Wrap Z coordinate
    if (camPos.z > halfDomain) camPos.z -= domainSize;
    else if (camPos.z < -halfDomain) camPos.z += domainSize;
    // Note: We wrap the camera position *before* collision detection
    // This makes the world appear infinite/repeating.

    // Collision detection
    const cameraBox = new THREE.Box3().setFromCenterAndSize(camPos, new THREE.Vector3(0.5, 1.6, 0.5)); // Adjust size
    for (let i = 0; i < collidables.length; i++) {
        // Ensure collidable is a Mesh or Group, not just a geometry/material
        if (collidables[i].geometry || collidables[i].isGroup) {
             let objBox = new THREE.Box3().setFromObject(collidables[i]);
             if (cameraBox.intersectsBox(objBox)) {
                 camPos.copy(previousPos);
                 break;
             }
        } else {
            console.warn("Collidable item is not a valid Object3D:", collidables[i]);
        }
    }

    // Ensure camera doesn't go below ground
    camPos.y = Math.max(camPos.y, 0.5); // Adjust minimum height if needed

    // Update UI display
    updateUIValues();

    // Update the orthographic camera's position and orientation
    camera.position.copy(camPos);
    camera.lookAt(camPos.clone().add(forward)); // Make sure 'forward' is calculated correctly

    // Render the scene using the standard renderer
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Start animation loop
requestAnimationFrame(animate);

// Corrected Touch Controls:
let touchActive = false;
let touchStartX = 0, touchStartY = 0;

canvas.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchActive = true;
    e.preventDefault();
});

canvas.addEventListener('touchmove', e => {
    if (!touchActive) return;
    const touchMoveX = e.touches[0].clientX - touchStartX;
    const touchMoveY = e.touches[0].clientY - touchStartY;
  
    // Apply movements to modify yaw and pitch
    yaw += touchMoveX * 0.01;
    pitch = Math.max(Math.min(pitch - touchMoveY * 0.01, Math.PI/2 - 0.01), -Math.PI/2 + 0.01);
  
    // Update starting touch positions
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    e.preventDefault();
});

canvas.addEventListener('touchend', e => {
    touchActive = false;
    e.preventDefault();
});
