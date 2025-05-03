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
    this.lights = {};
    this.timeOfDay = 0; // 0-1 represents time of day cycle
    
    // Clock for time-based effects
    this.clock = new THREE.Clock();
    
    // Setup renderer for better visual quality
    this.setupRenderer();
    
    // Setup sky and lighting
    this.setupSky();

    // Add atmospheric fog
    this.setupAtmosphericFog();
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
  
  setupSky() {
    // Create a hemisphere light for ambient lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 1, 0);
    this.scene.add(hemiLight);
    this.lights.hemiLight = hemiLight;
    
    // Main directional light (sun)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(500, 500, 500);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);
    this.lights.dirLight = dirLight;
    
    // Create stars for night sky
    this.createStars();
  }

  /**
   * Setup atmospheric fog for the scene
   * @private
   */
  setupAtmosphericFog() {
    // Enhanced atmospheric fog with a light blue tint
    const fogColor = new THREE.Color(0xb8d0ff);
    const fogDensity = 0.00018; // Slightly increased for more visible atmosphere
    
    // Use exponential fog for more realistic atmosphere effect
    this.fog = new THREE.FogExp2(fogColor, fogDensity);
    this.scene.fog = this.fog;
    
    // Store initial values for day/night cycle adjustments
    this.initialFogParams = {
      color: fogColor.clone(),
      density: fogDensity
    };
    
    // Add a slight blue tint to the scene background to match fog
    // This creates a more cohesive atmospheric look
    const backgroundTint = fogColor.clone().lerp(new THREE.Color(0x87CEEB), 0.5);
    this.scene.background = backgroundTint;
    
    console.log('Atmospheric fog initialized with enhanced settings');
  }
  
  /**
   * Update fog parameters based on time of day
   * @param {number} sunIntensity - Intensity of sunlight (0-1)
   * @private
   */
  updateFogParams(sunIntensity) {
    if (!this.fog) return;
    
    // Adjust fog color based on time of day
    // Daytime: light blue, nighttime: darker blue with a hint of purple
    const dayFogColor = this.initialFogParams.color.clone();
    const nightFogColor = new THREE.Color(0x202040); // Dark blue-purple for night
    
    // Interpolate between day and night colors
    this.fog.color.copy(dayFogColor).lerp(nightFogColor, 1 - sunIntensity);
    
    // Increase fog density at night for a more mystical atmosphere
    const baseDensity = this.initialFogParams.density;
    this.fog.density = baseDensity * (1 + (1 - sunIntensity) * 0.5);
    
    // Also update scene background color to match the atmospheric mood
    if (this.scene.background) {
      const dayBackground = new THREE.Color(0x87CEEB); // Sky blue for day
      const nightBackground = new THREE.Color(0x101025); // Dark blue for night
      
      this.scene.background.copy(dayBackground).lerp(nightBackground, 1 - sunIntensity);
    }
  }
  
  createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1000;
    const starPositions = [];
    
    for (let i = 0; i < starCount; i++) {
      const x = THREE.MathUtils.randFloatSpread(2000);
      const y = THREE.MathUtils.randFloatSpread(2000);
      const z = THREE.MathUtils.randFloatSpread(2000);
      starPositions.push(x, y, z);
    }
    
    starGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(starPositions, 3)
    );
    
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      transparent: true,
      opacity: 0,
      sizeAttenuation: false
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);
    this.stars = stars;
  }
  
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
  
  updateDayNightCycle(delta) {
    // Advance time of day (complete cycle in 5 minutes)
    this.timeOfDay = (this.timeOfDay + delta / 300) % 1;
    
    // Calculate sun angle based on time of day (0 = noon, 0.5 = midnight)
    const sunAngle = Math.PI * (this.timeOfDay * 2 - 0.5);
    
    // Position sun/moon
    const distance = 1000;
    const x = Math.cos(sunAngle) * distance;
    const y = Math.sin(sunAngle) * distance;
    
    this.lights.dirLight.position.set(x, y, 0);
    
    // Adjust light intensity based on time of day
    let sunIntensity = Math.sin(Math.PI * (1 - this.timeOfDay * 2)) * 0.9 + 0.1;
    sunIntensity = Math.max(0.05, sunIntensity);
    this.lights.dirLight.intensity = sunIntensity;
    
    // Hemisphere light changes color based on time of day
    const skyColor = new THREE.Color(
      0.5 + 0.5 * sunIntensity,
      0.5 + 0.5 * sunIntensity,
      0.8 + 0.2 * sunIntensity
    );
    const groundColor = new THREE.Color(0.3, 0.2, 0.1);
    this.lights.hemiLight.color.copy(skyColor);
    this.lights.hemiLight.groundColor.copy(groundColor);
    this.lights.hemiLight.intensity = 0.3 + 0.4 * sunIntensity;
    
    // Update fog parameters
    this.updateFogParams(sunIntensity);
    
    // Show/hide stars based on time of day
    if (this.stars) {
      const isNight = this.timeOfDay > 0.25 && this.timeOfDay < 0.75;
      this.stars.material.opacity = isNight ? 0.8 : 0;
    }
  }
  
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
    
    // Store as initial parameter for day/night cycle
    this.initialFogParams.density = density;
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
    this.initialFogParams.color.copy(newColor);
    
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
    
    // Update day/night cycle
    this.updateDayNightCycle(delta);
    
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
