import * as THREE from 'three';
 
/**
 * Manages visual effects for the spherical world
 */
export default class FXManager {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // Initialize effects containers
    this.particles = {};
    this.lights = {}; // Keep lights object, but setupSky will be removed
    this.timeOfDay = 0; // 0-1 represents time of day cycle

    // Clock for time-based effects
    this.clock = new THREE.Clock();

    // Setup renderer for better visual quality
    this.setupRenderer();

    // REMOVED: Setup sky and lighting call
    // this.setupSky();

    // Add atmospheric fog
    this.setupAtmosphericFog();

    // ADDED: Basic lighting setup here since setupSky is removed
    this._setupBasicLighting();
  }

  setupRenderer() {
    // Enable shadow casting
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // FIXED: Replace deprecated properties with current ones
    // this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Updated property
    
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    // FIXED: Replace physicallyCorrectLights with useLegacyLights (inverse logic)
    // this.renderer.physicallyCorrectLights = true;
    this.renderer.useLegacyLights = false; // false = physically correct
  }

  // REMOVED: setupSky() method entirely
  /*
  setupSky() {
    // ... removed hemisphere light, directional light, and createStars call ...
  }
  */

  // ADDED: Basic lighting setup (can be expanded later)
  _setupBasicLighting() {
    // MOON THEME: Cooler and dimmer ambient light
    const ambientLight = new THREE.AmbientLight(0x404060, 0.2); // Cool blue-grey, low intensity
    this.scene.add(ambientLight);
    this.lights.ambientLight = ambientLight;

    // MOON THEME: Directional light as moonlight
    const moonLight = new THREE.DirectionalLight(0xadc1de, 0.6); // Pale blue, moderate intensity
    moonLight.position.set(-500, 500, -500); // Position simulating moonlight angle
    moonLight.castShadow = true;
    // Adjust shadow parameters for softer moonlight shadows
    moonLight.shadow.camera.top = 150; // Increase area slightly
    moonLight.shadow.camera.bottom = -150;
    moonLight.shadow.camera.left = -150;
    moonLight.shadow.camera.right = 150;
    moonLight.shadow.mapSize.width = 1024; // Lower resolution for softer shadows
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.bias = -0.001; // Adjust bias if needed

    this.scene.add(moonLight);
    this.lights.moonLight = moonLight; // Renamed from dirLight
    console.log('[FXManager] Moonlit lighting setup complete.');
  }

  /**
   * Setup atmospheric fog for the scene
   * @private
   */
  setupAtmosphericFog() {
    // MOON THEME: Darker, cooler fog
    const fogColor = new THREE.Color(0x1a2a4a); // Dark blue-grey
    const fogDensity = 0.00012; // Slightly lower density for clearer night view

    // Use exponential fog for more realistic atmosphere effect
    this.fog = new THREE.FogExp2(fogColor, fogDensity);
    this.scene.fog = this.fog;

    // REMOVED: initialFogParams storage - no longer needed for day/night cycle

    console.log('Atmospheric fog initialized for moonlit theme.');
  }

  /**
   * Update fog parameters based on time of day - REMOVED
   * @param {number} sunIntensity - Intensity of sunlight (0-1)
   * @private
   */
  // updateFogParams(sunIntensity) { ... } // REMOVED

  // REMOVED: createStars() method entirely
  /*
  createStars() {
    // ... removed star creation code ...
  }
  */

  createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
      32, 32, 0, 32, 32, 32
    );
    
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(200,200,255,0.8)');
    gradient.addColorStop(0.7, 'rgba(120,120,255,0.4)');
    gradient.addColorStop(1, 'rgba(0,0,64,0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
  
  createWaterfall(position, normal, width=2, height=8, count=500) {
    // Create particle system for waterfall
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    const lifetimes = [];
    
    // Set up initial particle distribution
    for (let i = 0; i < count; i++) {
      // Random position across width of waterfall at top
      const x = (Math.random() - 0.5) * width;
      const y = Math.random() * 0.5; // Small random height offset at top
      const z = (Math.random() - 0.5) * (width / 2);
      
      positions.push(x, y, z);
      
      // Initial velocity
      const vx = (Math.random() - 0.5) * 0.05;
      const vy = -Math.random() * 0.2 - 0.1; // Down
      const vz = (Math.random() - 0.5) * 0.05;
      
      velocities.push(vx, vy, vz);
      
      // Random lifetimes so particles don't all reset at once
      lifetimes.push(Math.random());
    }
    
    // Create attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));
    geometry.setAttribute('lifetime', new THREE.Float32BufferAttribute(lifetimes, 1));
    
    // Create particle material
    const material = new THREE.PointsMaterial({
      color: 0x3399ff,
      size: 0.2,
      transparent: true,
      opacity: 0.8,
      map: this.createParticleTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    // Create points system
    const points = new THREE.Points(geometry, material);
    
    // Create a container to position and orient the waterfall
    const container = new THREE.Object3D();
    container.add(points);
    
    // Position and orient
    container.position.copy(position);
    container.lookAt(position.clone().add(normal));
    
    // Add to scene
    this.scene.add(container);
    
    // Store for updates
    const id = `waterfall_${Date.now()}`;
    this.particles[id] = {
      type: 'waterfall',
      object: container,
      points: points,
      origin: position.clone(),
      normal: normal.clone(),
      width: width,
      height: height,
      maxLifetime: height / 0.15 // Approx time to fall complete height
    };
    
    return id;
  }
  
  createFireflies(position, radius=10, count=50) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const height = Math.random() * radius * 0.5;
      
      const x = Math.cos(angle) * r;
      const y = height;
      const z = Math.sin(angle) * r;
      
      positions.push(x, y, z);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xffff80,
      size: 0.5,
      transparent: true,
      blending: THREE.AdditiveBlending,
      map: this.createParticleTexture(),
      depthWrite: false
    });
    
    const points = new THREE.Points(geometry, material);
    points.position.copy(position);
    
    this.scene.add(points);
    
    const id = `fireflies_${Date.now()}`;
    this.particles[id] = {
      type: 'fireflies',
      object: points,
      origin: position.clone(),
      radius: radius,
      count: count,
      time: 0
    };
    
    return id;
  }
  
  // REMOVED: updateDayNightCycle(delta) method entirely
  /*
  updateDayNightCycle(delta) {
    // ... removed day/night logic ...
  }
  */

  updateWaterfall(id, delta) {
    const waterfall = this.particles[id];
    if (!waterfall || waterfall.type !== 'waterfall') return;
    
    const points = waterfall.points;
    const positions = points.geometry.attributes.position.array;
    const velocities = points.geometry.attributes.velocity.array;
    const lifetimes = points.geometry.attributes.lifetime.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      // Update position based on velocity
      positions[i] += velocities[i] * delta * 60;
      positions[i+1] += velocities[i+1] * delta * 60;
      positions[i+2] += velocities[i+2] * delta * 60;
      
      // Update lifetime
      const idx = i/3;
      lifetimes[idx] += delta / waterfall.maxLifetime;
      
      // Reset particle if it exceeds lifetime or falls too far
      if (lifetimes[idx] >= 1 || positions[i+1] < -waterfall.height) {
        // Reset position to top
        positions[i] = (Math.random() - 0.5) * waterfall.width;
        positions[i+1] = Math.random() * 0.5; // Small random height at top
        positions[i+2] = (Math.random() - 0.5) * (waterfall.width / 2);
        
        // Reset velocity
        velocities[i] = (Math.random() - 0.5) * 0.05;
        velocities[i+1] = -Math.random() * 0.2 - 0.1;
        velocities[i+2] = (Math.random() - 0.5) * 0.05;
        
        // Reset lifetime
        lifetimes[idx] = 0;
      } else {
        // Add some gravity
        velocities[i+1] -= 0.01 * delta;
      }
    }
    
    // Update THREE.js buffers
    points.geometry.attributes.position.needsUpdate = true;
  }
  
  updateFireflies(id, delta) {
    const fireflies = this.particles[id];
    if (!fireflies || fireflies.type !== 'fireflies') return;
    
    fireflies.time += delta;
    
    const positions = fireflies.object.geometry.attributes.position.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      // Calculate unique animated movement for each firefly
      const idx = i/3;
      const offsetX = Math.sin(fireflies.time + idx * 0.5) * 0.3;
      const offsetY = Math.cos(fireflies.time * 0.7 + idx * 0.3) * 0.2;
      const offsetZ = Math.sin(fireflies.time * 0.5 + idx * 0.2) * 0.3;
      
      // Update positions with gentle bobbing motion
      const originalX = Math.cos(idx * 7.1) * fireflies.radius * (0.2 + Math.random() * 0.8);
      const originalY = (Math.random() * 0.5 + 0.2) * fireflies.radius * 0.5;
      const originalZ = Math.sin(idx * 7.1) * fireflies.radius * (0.2 + Math.random() * 0.8);
      
      positions[i] = originalX + offsetX;
      positions[i+1] = originalY + offsetY;
      positions[i+2] = originalZ + offsetZ;
    }
    
    // Pulse the glow
    const s = (Math.sin(fireflies.time * 2) * 0.1 + 0.9);
    fireflies.object.material.size = 0.5 * s;
    
    // Update the buffer
    fireflies.object.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Set fog density
   * @param {number} density - New fog density (0-0.001 is a good range)
   */
  setFogDensity(density) {
    if (!this.fog) return;
    this.fog.density = density;
    console.log(`Atmospheric fog density updated to: ${density}`);
  }

  /**
   * Set fog color
   * @param {THREE.Color|number} color - New fog color
   */
  setFogColor(color) {
    if (!this.fog) return;
    const newColor = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.fog.color.copy(newColor);
    console.log(`Atmospheric fog color updated to:`, newColor);
  }

  /**
   * Toggle atmospheric fog on/off
   * @param {boolean} enabled - Whether fog should be enabled
   */
  toggleFog(enabled) {
    if (enabled) {
      // Re-enable fog if it was disabled
      this.scene.fog = this.fog;
      console.log('Atmospheric fog enabled');
    } else {
      // Disable fog by removing it from the scene
      this.scene.fog = null;
      console.log('Atmospheric fog disabled');
    }
  }
  
  update() {
    const delta = this.clock.getDelta();

    // REMOVED: Update day/night cycle call - THIS FIXES THE ERROR
    // this.updateDayNightCycle(delta);

    // Update particle systems
    Object.entries(this.particles).forEach(([id, system]) => {
      if (system.type === 'waterfall') {
        this.updateWaterfall(id, delta);
      } else if (system.type === 'fireflies') {
        this.updateFireflies(id, delta);
      }
    });
  }
}
