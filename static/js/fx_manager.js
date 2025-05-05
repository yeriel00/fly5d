import * as THREE from 'three';
import { VolumetricFog } from './shaders/VolumetricFogShader.js';

/**
 * FX Manager class to manage visual effects in the scene
 */
export default class FXManager {
  /**
   * Create a new FX Manager
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {THREE.Camera} camera - The camera
   * @param {THREE.WebGLRenderer} renderer - The renderer
   */
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    
    // Store sphere radius with default of 400
    this.sphereRadius = 400;
    
    // Track all lights
    this.lights = {
      ambientLight: null,
      moonLight: null,
      pointLights: [],
      spotLights: []
    };
    
    // Find existing scene lights
    this._findExistingLights();
    
    // Initialize particle systems
    this.particleSystems = [];
    
    // Initialize other effects
    this.volumetricFog = null;
    this.fog = null;
    this.fogSettings = {
      originalColor: new THREE.Color(0x87CEEB),
      originalDensity: 0.00025
    };
    
    // Debug mode
    this.debug = false;
    
    // Log initialization
    console.log('[FXManager] Initialized');
  }
  
  /**
   * Find existing lights in the scene
   * @private
   */
  _findExistingLights() {
    this.scene.traverse(object => {
      if (object.isLight) {
        if (object.isAmbientLight) {
          this.lights.ambientLight = object;
        } else if (object.isDirectionalLight) {
          // Assume the first directional light is the moon light
          if (!this.lights.moonLight) {
            this.lights.moonLight = object;
          }
        } else if (object.isPointLight) {
          this.lights.pointLights.push(object);
        } else if (object.isSpotLight) {
          this.lights.spotLights.push(object);
        }
      }
    });
    
    // Log found lights
    console.log(`[FXManager] Found ${this.lights.pointLights.length} point lights and ${this.lights.spotLights.length} spot lights`);
    console.log('[FXManager] Moon light:', this.lights.moonLight ? 'found' : 'not found');
    console.log('[FXManager] Ambient light:', this.lights.ambientLight ? 'found' : 'not found');
  }

  /**
   * Add a new light to the scene
   * @param {string} type - Light type: 'ambient', 'directional', 'point', 'spot' 
   * @param {Object} options - Light options
   * @returns {Object} Created light with ID
   */
  addLight(type, options = {}) {
    let light;
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    switch (type) {
      case 'ambient':
        light = new THREE.AmbientLight(
          options.color || 0xffffff,
          options.intensity || 0.5
        );
        this.lights.ambientLight = light;
        break;
      
      case 'directional':
        light = new THREE.DirectionalLight(
          options.color || 0xffffff,
          options.intensity || 1.0
        );
        if (options.position) light.position.copy(options.position);
        if (options.castShadow !== undefined) light.castShadow = options.castShadow;
        
        // If replacing moon light
        if (options.isMoonLight) {
          this.lights.moonLight = light;
        }
        break;
      
      case 'point':
        light = new THREE.PointLight(
          options.color || 0xffffff,
          options.intensity || 1.0,
          options.distance || 0,
          options.decay || 1
        );
        if (options.position) light.position.copy(options.position);
        if (options.castShadow !== undefined) light.castShadow = options.castShadow;
        this.lights.pointLights.push(light);
        break;
      
      case 'spot':
        light = new THREE.SpotLight(
          options.color || 0xffffff,
          options.intensity || 1.0,
          options.distance || 0,
          options.angle || Math.PI/3,
          options.penumbra || 0,
          options.decay || 1
        );
        if (options.position) light.position.copy(options.position);
        if (options.castShadow !== undefined) light.castShadow = options.castShadow;
        this.lights.spotLights.push(light);
        break;
        
      default:
        console.warn(`[FXManager] Unknown light type: ${type}`);
        return null;
    }
    
    // Store ID in user data
    light.userData = {
      ...light.userData,
      fxManagerId: id
    };
    
    this.scene.add(light);
    return { light, id };
  }
  
  /**
   * Remove a light by ID
   * @param {string} id - Light ID
   * @returns {boolean} Whether the light was found and removed
   */
  removeLight(id) {
    let found = false;
    
    // Check all light arrays
    ['pointLights', 'spotLights'].forEach(arrayName => {
      const array = this.lights[arrayName];
      const index = array.findIndex(light => 
        light.userData && light.userData.fxManagerId === id);
      
      if (index !== -1) {
        const light = array[index];
        this.scene.remove(light);
        array.splice(index, 1);
        found = true;
      }
    });
    
    // Check special lights
    ['ambientLight', 'moonLight'].forEach(lightName => {
      const light = this.lights[lightName];
      if (light && light.userData && light.userData.fxManagerId === id) {
        this.scene.remove(light);
        this.lights[lightName] = null;
        found = true;
      }
    });
    
    return found;
  }
  
  /**
   * Create an explosion effect at a position
   * @param {THREE.Vector3} position - Position of explosion
   * @param {number} [size=1.0] - Size of explosion
   * @param {number} [color=0xff5500] - Color of explosion
   * @param {number} [particleCount=20] - Number of particles
   */
  createExplosion(position, size = 1.0, color = 0xff5500, particleCount = 20) {
    // Create particle geometry
    const particles = new THREE.Object3D();
    
    // Create particle material
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0
    });
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(
        size * (0.1 + Math.random() * 0.3), // Radius
        4, // Width segments
        4  // Height segments
      );
      
      const mesh = new THREE.Mesh(geometry, material);
      
      // Random direction
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();
      
      // Random speed
      const speed = 0.1 + Math.random() * 0.2;
      
      // Set initial position
      mesh.position.copy(position);
      
      // Store velocity information
      mesh.userData = {
        velocity: direction.multiplyScalar(speed),
        lifespan: 0.5 + Math.random() * 0.5, // 0.5 to 1.0 seconds
        age: 0
      };
      
      particles.add(mesh);
    }
    
    // Add to scene
    this.scene.add(particles);
    
    // Add to particle systems
    this.particleSystems.push({
      particles,
      update: (delta) => this._updateExplosion(particles, delta)
    });
    
    // Create point light for the explosion
    const light = new THREE.PointLight(color, 1.0, size * 10);
    light.position.copy(position);
    this.scene.add(light);
    
    // Fade out and remove the light
    setTimeout(() => {
      this.scene.remove(light);
    }, 100);
  }
  
  /**
   * Update explosion particles
   * @param {THREE.Object3D} particles - Particle container
   * @param {number} delta - Time delta
   * @private
   */
  _updateExplosion(particles, delta) {
    let alive = false;
    
    // Update each particle
    particles.children.forEach(particle => {
      particle.userData.age += delta;
      
      // Check if particle is still alive
      if (particle.userData.age < particle.userData.lifespan) {
        // Update position
        particle.position.add(
          particle.userData.velocity.clone().multiplyScalar(delta * 60)
        );
        
        // Fade out
        const lifeRatio = particle.userData.age / particle.userData.lifespan;
        particle.material.opacity = 1.0 - lifeRatio;
        
        // Shrink
        const scale = 1.0 - lifeRatio * 0.5;
        particle.scale.set(scale, scale, scale);
        
        alive = true;
      } else {
        // Remove dead particles
        particle.visible = false;
      }
    });
    
    return alive;
  }
  
  /**
   * Setup atmospheric fog
   * @param {number} [sphereRadius=400] - Planet sphere radius 
   */
  setupAtmosphericFog(sphereRadius = 400) {
    // Store the sphere radius
    this.sphereRadius = sphereRadius;
    
    // Calculate fog density based on sphere size
    const scaledDensity = 0.00025 * (400 / sphereRadius);
    
    // Create exponential fog
    this.fog = new THREE.FogExp2(0x87CEEB, scaledDensity);
    
    // Store original values for reset
    this.fogSettings = {
      originalColor: this.fog.color.clone(),
      originalDensity: this.fog.density
    };
    
    // Add to scene
    this.scene.fog = this.fog;
    
    console.log(`[FXManager] Atmospheric fog setup complete (density: ${scaledDensity})`);
  }
  
  /**
   * Setup ground fog effect
   * @param {number} [sphereRadius=400] - Planet sphere radius
   */
  setupGroundFog(sphereRadius = 400) {
    // Store the sphere radius
    this.sphereRadius = sphereRadius;
    
    console.log(`[XManager] Moonlit lighting setup complete (scaled to sphere radius: ${sphereRadius})`);
    
    // Initialize volumetric fog if not already created
    if (!this.volumetricFog) {
      try {
        // Store default settings for reset
        this.volumetricFogDefaults = {
          fogColor: new THREE.Color(0x88aaff),
          fogColorBottom: new THREE.Color(0xffffff),
          fogDensity: 0.00002,
          groundFogHeight: 20,
          groundFogDensity: 3,
          fogNoiseScale: 0.002,
          fogNoiseSpeed: 0.04,
          fogIntensity: 30
        };
        
        // Create volumetric fog with properly sized parameters
        this.volumetricFog = new VolumetricFog(
          this.scene, 
          this.camera, 
          this.renderer, 
          {
            ...this.volumetricFogDefaults,
            sphereRadius: sphereRadius
          }
        );
        
        console.log('[FXManager] Volumetric fog initialized');
      } catch (error) {
        console.error('[FXManager] Error initializing volumetric fog:', error);
      }
    }
  }
  
  /**
   * Toggle volumetric fog on/off
   * @param {boolean} enabled - Whether to enable fog
   */
  toggleVolumeFog(enabled) {
    if (this.volumetricFog) {
      this.volumetricFog.enabled = enabled;
      console.log(`[FXManager] Volumetric fog ${enabled ? 'enabled' : 'disabled'}`);
    } else {
      console.warn('[FXManager] Volumetric fog not initialized');
    }
  }
  
  /**
   * Adjust volumetric fog settings
   * @param {Object} settings - Fog settings to change
   */
  adjustFogSettings(settings) {
    if (this.volumetricFog) {
      // Apply new settings
      Object.assign(this.volumetricFog.options, settings);
      console.log('[FXManager] Volumetric fog settings updated');
    } else {
      console.warn('[FXManager] Volumetric fog not initialized');
    }
  }
  
  /**
   * Toggle atmospheric fog on/off
   * @param {boolean} enabled - Whether to enable fog
   */
  toggleFog(enabled) {
    if (enabled) {
      if (!this.fog) {
        this.setupAtmosphericFog(this.sphereRadius);
      }
      this.scene.fog = this.fog;
    } else {
      this.scene.fog = null;
    }
    
    console.log(`[FXManager] Atmospheric fog ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Set fog color
   * @param {THREE.Color|number|string} color - New fog color
   */
  setFogColor(color) {
    if (this.scene.fog) {
      this.scene.fog.color.set(color);
    } else if (this.fog) {
      this.fog.color.set(color);
    }
  }
  
  /**
   * Set fog density
   * @param {number} density - New fog density
   */
  setFogDensity(density) {
    if (this.scene.fog && this.scene.fog.density !== undefined) {
      this.scene.fog.density = density;
    } else if (this.fog && this.fog.density !== undefined) {
      this.fog.density = density;
    }
  }
  
  /**
   * Reset lighting to defaults
   */
  resetLighting() {
    // Reset ambient light
    if (this.lights.ambientLight) {
      this.lights.ambientLight.color.set(0xffffff);
      this.lights.ambientLight.intensity = 0.5;
    }
    
    // Reset directional (moon) light
    if (this.lights.moonLight) {
      this.lights.moonLight.color.set(0xffffff);
      this.lights.moonLight.intensity = 0.7;
    }
    
    console.log('[FXManager] Lighting reset to defaults');
  }
  
  /**
   * Update fog based on player height
   * @param {THREE.Vector3} playerPosition - Player position
   */
  updateFogBasedOnHeight(playerPosition) {
    if (!this.volumetricFog) return;
    
    // Get height above terrain (use radius as approximation)
    const height = playerPosition.length() - this.sphereRadius;
    
    // Adjust fog settings based on height
    const fogHeight = Math.max(1, this.volumetricFog.options.groundFogHeight);
    const heightRatio = Math.min(1, height / fogHeight);
    
    // Reduce fog density when player is inside it
    if (heightRatio < 0.5) {
      // Make fog density dependent on height when inside the fog
      const insideFactor = heightRatio * 2; // 0 at ground, 1 at mid-height
      const adjustedDensity = this.volumetricFogDefaults.groundFogDensity * (0.3 + insideFactor * 0.7);
      
      this.volumetricFog.options.groundFogDensity = adjustedDensity;
    } else {
      // Reset to normal density when outside the fog
      this.volumetricFog.options.groundFogDensity = this.volumetricFogDefaults.groundFogDensity;
    }
  }
  
  /**
   * Update all effects
   * @param {number} delta - Time delta
   */
  update(delta) {
    // Update particle systems
    for (let i = this.particleSystems.length - 1; i >= 0; i--) {
      const system = this.particleSystems[i];
      const alive = system.update(delta);
      
      if (!alive) {
        // Remove dead system
        this.scene.remove(system.particles);
        this.particleSystems.splice(i, 1);
      }
    }
    
    // Update volumetric fog
    if (this.volumetricFog) {
      this.volumetricFog.update(delta);
    }
  }
  
  /**
   * Render the scene with effects
   */
  render() {
    // Render with volumetric fog if available
    if (this.volumetricFog && this.volumetricFog.enabled) {
      this.volumetricFog.render();
    } else {
      // Standard rendering
      this.renderer.render(this.scene, this.camera);
    }
  }
}
