import * as THREE from 'three';
import { VolumetricFog } from './shaders/VolumetricFogShader.js';
 
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
    
    // ADDED: Initialize the volumetric ground fog effect
    this.setupGroundFog();
    
    // ADDED: Ensure fog is applied to all materials including MeshBasicMaterial
    this.enableFogForAllMaterials();
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
   * @param {number} sphereRadius - Radius of the sphere world (affects fog density)
   * @private
   */
  setupAtmosphericFog(sphereRadius = 400) {
    // Get sphere radius from parameter or use default
    const radius = sphereRadius || 400;
    
    // ADJUSTED: Simplified density calculation for more predictable results
    const baseDensity = 0.0015; // Slightly increased base density
    const fogDensity = baseDensity; // Use base density directly for now
    
    // ENHANCED: More noticeable fog color with slight blue tint
    const fogColor = new THREE.Color(0x667788); // Adjusted color slightly
    
    // Use exponential fog with adjusted density for more noticeable effect
    this.fog = new THREE.FogExp2(fogColor, fogDensity);
    this.scene.fog = this.fog;
    
    // Store the original density for toggling/adjusting later
    this.fogSettings = {
      originalDensity: fogDensity,
      radius: radius,
      grassLevel: 6 // Match grass height from worldConfig
    };
    
    console.log(`Atmospheric fog initialized with density (${fogDensity})`); // Updated log
    return this.fog;
  }

  /**
   * Initialize the volumetric ground fog effect
   * This creates realistic fog that emanates from the ground surface
   * @param {Object} options - Customization options for the fog
   */
  setupGroundFog(options = {}) {
    const fogOptions = {
      // Visual style
      fogColor: new THREE.Color(0x8bb0ff), // Main fog color 
      fogColorBottom: new THREE.Color(0xefd1b5), // Ground level fog color
      
      // Fog density settings
      fogDensity: 0.00015, // Slightly reduced base density
      fogIntensity: 25.0, // Slightly reduced intensity (was 28.0)
      groundFogDensity: 2.0, // Slightly reduced ground density (was 2.2)
      groundFogHeight: 15.0, // Increased height slightly
      
      // Fog movement and noise
      noiseScale: 0.007, // Adjusted noise scale
      noiseIntensity: 0.30, // Adjusted noise intensity
      noiseSpeed: 0.03, // Speed of fog movement
      
      // Performance settings
      resolution: 1.0, // INCREASED: Render fog at full resolution for max quality
      ...options
    };
    
    try {
      console.log('[FXManager] Setting up volumetric ground fog effect...');
      
      // Initialize the volumetric fog post-processing effect
      this.volumetricFog = new VolumetricFog(
        this.renderer, 
        this.scene,
        this.camera, 
        fogOptions
      );
      
      // Enable the fog effect
      this.volumetricFog.setEnabled(true);
      
      console.log('[FXManager] Volumetric ground fog initialized successfully');
    } catch (error) {
      console.error('[FXManager] Failed to initialize volumetric fog:', error);
      this.volumetricFog = null;
    }
    
    return this.volumetricFog;
  }

  /**
   * Update fog based on player position/height
   * This creates a more atmospheric effect where fog is more
   * visible near grass level
   * @param {THREE.Vector3} playerPosition - Current player position
   */
  updateFogBasedOnHeight(playerPosition) {
    // DISABLED this dynamic adjustment for now to simplify fog behavior
    /*
    if (!this.fog || !this.fogSettings) return;
    
    // Calculate height relative to sphere surface
    const distanceFromCenter = playerPosition.length();
    const heightAboveSurface = Math.max(0, distanceFromCenter - this.fogSettings.radius);
    
    // IMPROVED: Use adjusted base density
    const baseFogDensity = this.fogSettings.originalDensity; // Use the original density set in setup
    
    // Calculate a multiplier that makes fog more visible closer to the camera
    // ADJUSTED: Kept reduced multiplier effect
    const heightMultiplier = 1.0; // Set to 1.0 to disable dynamic changes
    
    // Apply the adjusted density - higher overall than previous version
    this.fog.density = baseFogDensity * heightMultiplier;
    
    // Enhance the color adjustment to be more visible
    const baseColor = new THREE.Color(0x667788); // Use the base fog color set in setup
    const groundFogColor = new THREE.Color(0x708090); // Slightly adjusted ground fog target color
    const blendFactor = Math.max(0, Math.min(1, 1 - heightAboveSurface / 25));
    
    // Apply stronger color transition
    this.fog.color.copy(baseColor).lerp(groundFogColor, blendFactor * 0.4); // Reduced lerp factor
    */
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
   * Ensures fog is enabled for all materials in the scene
   * This is needed because some materials like MeshBasicMaterial don't have fog enabled by default
   */
  enableFogForAllMaterials() {
    this.scene.traverse(object => {
      if (object.isMesh && object.material) {
        // Handle both individual materials and material arrays
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            material.fog = true;
          });
        } else {
          object.material.fog = true;
        }
      }
    });

    // Add a hook to make sure all future materials will also have fog enabled
    const originalAdd = this.scene.add;
    this.scene.add = function(...objects) {
      objects.forEach(object => {
        if (object) {
          // Apply fog to the object and all of its descendants
          object.traverse(child => {
            if (child.isMesh && child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => {
                  material.fog = true;
                });
              } else {
                child.material.fog = true;
              }
            }
          });
        }
      });
      return originalAdd.call(this, ...objects);
    };
    
    console.log("[FXManager] Fog enabled for all materials in scene");
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
  
  /**
   * Adjust volumetric fog settings
   * @param {Object} options - New fog parameters to apply
   */
  adjustFogSettings(options = {}) {
    if (!this.volumetricFog) return;
    
    // Handle color changes
    if (options.fogColor || options.fogColorBottom) {
      this.volumetricFog.setColors(
        options.fogColor || undefined,
        options.fogColorBottom || undefined
      );
    }
    
    // Handle density changes
    if (options.fogDensity !== undefined) {
      this.volumetricFog.setDensity(options.fogDensity);
    }
    
    // Handle intensity changes
    if (options.fogIntensity !== undefined) {
      this.volumetricFog.setIntensity(options.fogIntensity);
    }
    
    // Handle noise property changes
    if (options.noiseScale !== undefined || 
        options.noiseIntensity !== undefined ||
        options.noiseSpeed !== undefined ||
        options.noiseOctaves !== undefined ||
        options.noisePersistence !== undefined ||
        options.noiseLacunarity !== undefined) {
      
      this.volumetricFog.setNoiseProperties(
        options.noiseScale,
        options.noiseIntensity,
        options.noiseSpeed,
        options.noiseOctaves,
        options.noisePersistence,
        options.noiseLacunarity
      );
    }
    
    // Handle ground fog specific properties
    if (options.groundFogDensity !== undefined || 
        options.groundFogHeight !== undefined) {
      
      this.volumetricFog.setGroundFogProperties(
        options.groundFogDensity,
        options.groundFogHeight
      );
    }
    
    console.log('[FXManager] Volumetric fog settings adjusted');
  }
  
  /**
   * Toggle volumetric ground fog on/off
   * @param {boolean} enabled - Whether volumetric fog should be enabled
   */
  toggleVolumeFog(enabled) {
    if (!this.volumetricFog) return;
    
    const isEnabled = this.volumetricFog.setEnabled(enabled);
    console.log(`[FXManager] Volumetric fog ${isEnabled ? 'enabled' : 'disabled'}`);
    return isEnabled;
  }

  /**
   * Handle window resize for fog effect
   */
  onWindowResize() {
    if (this.volumetricFog) {
      this.volumetricFog.resize();
    }
  }

  update() {
    const delta = this.clock.getDelta();

    // ADDED: Call updateFogBasedOnHeight if player exists
    // RE-ENABLED this call, but the function body is commented out for now
    // if (this.camera && this.camera.parent && this.camera.parent.position) {
    //   this.updateFogBasedOnHeight(this.camera.parent.position);
    // }

    // Update volumetric fog if it exists
    if (this.volumetricFog) {
      try {
        this.volumetricFog.update(delta);
      } catch (error) {
        console.error('[FXManager] Error updating volumetric fog:', error);
        // Disable volumetric fog if there's an error
        if (this.volumetricFog) {
          this.volumetricFog.setEnabled(false);
          this.volumetricFog = null;
        }
      }
    }

    // Update particle systems
    Object.entries(this.particles).forEach(([id, system]) => {
      if (system.type === 'waterfall') {
        this.updateWaterfall(id, delta);
      } else if (system.type === 'fireflies') {
        this.updateFireflies(id, delta);
      }
    });
  }

  /**
   * Render all effects, including volumetric fog
   */
  render() {
    // Render volumetric fog effect if enabled
    if (this.volumetricFog && this.volumetricFog.enabled) {
      try {
        this.volumetricFog.render();
      } catch (error) {
        console.error('[FXManager] Error rendering volumetric fog:', error);
        // Fall back to regular rendering
        this.renderer.render(this.scene, this.camera);
        // Disable volumetric fog if there's an error
        this.volumetricFog.setEnabled(false);
        this.volumetricFog = null;
      }
    } else {
      // Otherwise do a regular render
      this.renderer.render(this.scene, this.camera);
    }
  }
}
