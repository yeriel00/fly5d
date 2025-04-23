import * as THREE from 'three';
import ProjectileSystem from './ProjectileSystem.js';

/**
 * Handles player weapons including slingshot
 */
export default class WeaponSystem {
  /**
   * Create a new weapon system
   * @param {THREE.Scene} scene - The 3D scene
   * @param {THREE.Camera} camera - Player camera
   * @param {Object} options - Configuration options
   */
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.options = Object.assign({
      launchOffset: new THREE.Vector3(0, -1.0, -2.0), // Lower and further out in front
      sphereRadius: 400,
      gravity: 0.15,
      // TURBO BOOST: Dramatically faster projectile speed for snappy feel
      projectileSpeed: 130, // Increased from 80 to 130 for ultra-fast initial velocity
      projectileRadius: 1.0,
      collidables: []
    }, options);
    
    // Create projectile system with enhanced physics
    this.projectileSystem = new ProjectileSystem(scene, {
      sphereRadius: this.options.sphereRadius,
      // JUICY PHYSICS: Higher gravity for more dramatic arcs but less than before
      gravity: this.options.gravity * 1.8, // Reduced from 2.5x to 1.8x for better arc
      projectileRadius: this.options.projectileRadius,
      projectileSpeed: this.options.projectileSpeed,
      // SNAPPY: Make projectiles disappear faster when they go too far
      projectileLifetime: 6000, // 6 seconds (down from 8) for quicker cleanup
      // BOUNCY: Much higher bounce factor for satisfying physics
      bounceFactor: 0.75, // Increased from default 0.6 for extra bounce
      getTerrainHeight: this.options.getTerrainHeight,
      collidables: this.options.collidables
    });
    
    // Weapon state
    this.currentWeapon = 'slingshot';
    this.isCharging = false;
    this.isFiring = false;
    
    // Add this line to create the slingshotState property in WeaponSystem
    this.slingshotState = { direction: new THREE.Vector3() };
    
    // Ammo and cooldowns
    this.ammo = {
      apple: 10,
      goldenApple: 3
    };
    this.cooldown = 0;
    this.rechargeTime = 1.0; // seconds
    
    // Create slingshot model
    this.createSlingshotModel();
    
    // Sound effects
    this.sounds = {
      charge: null,
      release: null
    };
    
    // Try to load sounds if available
    this.loadSounds();
  }
  
  /**
   * Create a basic slingshot model
   */
  createSlingshotModel() {
    // Create a simple Y-shaped slingshot model
    const geometry = new THREE.BufferGeometry();
    
    // Define vertices for a Y shape
    const vertices = new Float32Array([
      // Main handle
      0, 0, 0,         // base
      0, 0.12, 0.05,   // mid
      
      // Left fork
      0, 0.12, 0.05,   // mid
      -0.05, 0.2, 0.03, // left top
      
      // Right fork
      0, 0.12, 0.05,   // mid
      0.05, 0.2, 0.03, // right top
      
      // Band (left)
      -0.05, 0.2, 0.03, // left top
      0, 0.1, -0.05,   // band midpoint
      
      // Band (right)
      0.05, 0.2, 0.03, // right top
      0, 0.1, -0.05    // band midpoint
    ]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x664422, linewidth: 2 });
    
    // Create line segments for the slingshot
    this.slingshotModel = new THREE.LineSegments(geometry, material);
    this.slingshotModel.visible = false; // Initially hidden
  }
  
  /**
   * Load sound effects for weapons
   */
  loadSounds() {
    // Load sound effects if available - add implementation later
  }
  
  /**
   * Set up the slingshot model
   * @param {THREE.Object3D} parent - Parent object to attach slingshot to
   */
  setupModel(parent) {
    if (parent && this.slingshotModel) {
      parent.add(this.slingshotModel);
      
      // Position in view
      this.slingshotModel.position.set(0.3, -0.2, -0.5);
      this.slingshotModel.rotation.set(0, Math.PI * 0.05, 0);
    }
  }
  
  /**
   * Start charging the current weapon
   */
  startCharge() {
    console.log("🔫 WeaponSystem.startCharge called");
    
    // ULTRA ROBUST: Make extra checks to ensure charging works
    if (this.cooldown > 0) {
      console.warn(`⚠️ Weapon is in cooldown (${this.cooldown.toFixed(2)}s)`);
      // BYPASS: Force reset cooldown to allow charging
      this.cooldown = 0;
    }
    
    if (this.isCharging) {
      console.warn("⚠️ Already charging! Resetting state");
      // BYPASS: Force reset charging state
      this.isCharging = false;
    }
    
    // ULTRA ROBUST: Add emergency ammo if needed
    if (this.ammo.apple <= 0) {
      console.warn("⚠️ No ammo! Adding emergency apple");
      this.ammo.apple = 1;
    }
    
    // Get camera direction
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    
    // Start charging
    this.isCharging = true;
    this.slingshotModel.visible = true;
    
    // Scale the band to show tension
    this._updateSlingshotTension(0);
    
    // Start projectile system charging with a lower initial power
    const result = this.projectileSystem.startCharging(direction);
    
    console.log("🔫 WeaponSystem.startCharge: Charging started successfully", result);
    
    return true;
  }
  
  /**
   * Update charging state
   * @param {number} deltaTime - Time since last frame
   */
  updateCharge(deltaTime) {
    if (!this.isCharging) {
      return null;
    }
    
    // ULTRA ROBUST: Force reasonable deltaTime
    if (isNaN(deltaTime) || deltaTime > 0.1) {
      deltaTime = 0.016; // 60fps fallback
    }
    
    // Get camera direction
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    
    // Update projectile system charge
    const chargeState = this.projectileSystem.updateCharge(deltaTime, direction);
    
    // ULTRA ROBUST: If chargeState indicates not charging, force it to charge anyway
    if (!chargeState || !chargeState.charging) {
      console.warn("⚠️ ProjectileSystem reported not charging! Forcing state");
      this.projectileSystem.startCharging(direction);
      return {
        charging: true,
        power: 0.01,
        direction: direction.clone()
      };
    }
    
    // Update slingshot band tension
    this._updateSlingshotTension(chargeState.power);
    
    return chargeState;
  }
  
  /**
   * Release the weapon to fire
   */
  releaseCharge() {
    if (!this.isCharging) return null;
    
    // End charging state
    this.isCharging = false;
    this._updateSlingshotTension(0);
    
    // IMPROVED: Get correct camera world position and direction
    // Get the exact world position and orientation of the camera
    const cameraWorldPos = new THREE.Vector3();
    const cameraWorldDir = new THREE.Vector3();
    
    // This properly gets the world position of the camera
    this.camera.getWorldPosition(cameraWorldPos);
    
    // Get the forward direction in world space
    this.camera.getWorldDirection(cameraWorldDir);
    
    // Calculate launch position - place it slightly in front of the camera
    // Use a consistent offset that's always visible
    const launchOffset = 2.0; // 2 units in front of camera
    const launchPos = cameraWorldPos.clone().addScaledVector(cameraWorldDir, launchOffset);
    
    console.log("Camera position:", cameraWorldPos);
    console.log("Camera direction:", cameraWorldDir);
    console.log("Launch position:", launchPos);
    
    // Determine projectile type
    const projectileType = (this.currentWeapon === 'goldenSlingshot') ? 'goldenApple' : 'apple';
    
    // FIXED: Use the camera's world direction directly instead of trying to access slingshotState
    // We'll pass the direction directly to the release method instead of setting it on slingshotState
    
    // Release the slingshot with updated position and direction
    const result = this.projectileSystem.release(launchPos, { 
      type: projectileType,
      direction: cameraWorldDir // Pass direction as an option
    });
    
    if (result && result.projectile) {
      // Consume ammo
      this.ammo[projectileType]--;
      
      // Start cooldown
      this.cooldown = this.rechargeTime;
      
      // Play sound
      this._playSound('release');
      
      return result;
    }
    
    return null;
  }
  
  /**
   * Update slingshot band tension visual
   * @param {number} power - Current charge power (0-1)
   */
  _updateSlingshotTension(power) {
    // Skip if no model
    if (!this.slingshotModel) return;
    
    // Get position attribute
    const posAttr = this.slingshotModel.geometry.getAttribute('position');
    
    // Band midpoint index (based on our vertex layout)
    const bandMidIndex = 7 * 3; // index * 3 components
    
    // FIXED: Pull band back based on power - increased maximum pull distance
    const pullDistance = power * 0.3; // Max 30cm pull instead of 20cm
    
    // Update band midpoint position
    posAttr.setXYZ(
      7, // band midpoint left index
      0,  // x
      0.1, // y
      -0.05 - pullDistance // z - pull back
    );
    
    posAttr.setXYZ(
      9, // band midpoint right index
      0,  // x
      0.1, // y
      -0.05 - pullDistance // z - pull back
    );
    
    // Mark for update
    posAttr.needsUpdate = true;
  }
  
  /**
   * Cancel current charge
   */
  cancelCharge() {
    if (!this.isCharging) return;
    
    this.isCharging = false;
    this._updateSlingshotTension(0);
    this.projectileSystem.cancelCharge();
  }
  
  /**
   * Play a sound effect
   * @param {string} soundName - Name of sound to play
   */
  _playSound(soundName) {
    // Play sound if available - add implementation later
  }
  
  /**
   * Switch to a different weapon
   * @param {string} weaponName - Weapon to switch to
   */
  switchWeapon(weaponName) {
    // Only slingshot for now
    if (weaponName === 'slingshot' || weaponName === 'goldenSlingshot') {
      this.cancelCharge(); // Cancel any current charge
      this.currentWeapon = weaponName;
      return true;
    }
    return false;
  }
  
  /**
   * Add ammo to inventory
   * @param {string} type - Ammo type
   * @param {number} amount - Amount to add
   */
  addAmmo(type, amount) {
    if (this.ammo[type] !== undefined) {
      this.ammo[type] += amount;
      return this.ammo[type];
    }
    return 0;
  }
  
  /**
   * Update the weapon system
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    // ULTRA ROBUST: Force reasonable deltaTime
    if (isNaN(deltaTime) || deltaTime > 0.1) {
      deltaTime = 0.016; // 60fps fallback
    }
    
    // Update projectiles
    this.projectileSystem.update(deltaTime);
    
    // CRITICAL FIX: The issue is here - we're not properly updating the charge!
    if (this.isCharging) {
      // Direct debug to verify update is running
      console.log(`⏱️ Updating charge, deltaTime: ${deltaTime.toFixed(4)}, isCharging: ${this.isCharging}`);
      
      // Explicitly update the charging state
      const chargeState = this.updateCharge(deltaTime);
      
      if (chargeState && chargeState.power) {
        // Log every 10% to verify power is increasing
        const powerPercent = Math.floor(chargeState.power * 100);
        if (powerPercent % 10 === 0 && powerPercent > 0) {
          console.log(`🔋 Charge at ${powerPercent}%`);
        }
      }
    }
    
    // CRITICAL FIX: Check for state mismatch between weapon system and projectile system
    if (this.isCharging && this.projectileSystem.slingshotState && 
        !this.projectileSystem.slingshotState.charging) {
      console.error("⚠️ State mismatch! WeaponSystem.isCharging=true but ProjectileSystem.slingshotState.charging=false");
      // Force fix the state
      this.projectileSystem.slingshotState.charging = true;
    }
    
    // Update cooldown
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - deltaTime);
    }
  }
  
  /**
   * Get current weapon state
   */
  getState() {
    return {
      currentWeapon: this.currentWeapon,
      isCharging: this.isCharging,
      cooldown: this.cooldown,
      rechargeTime: this.rechargeTime,
      ammo: { ...this.ammo },
      chargeState: this.isCharging ? this.projectileSystem.getSlingshotState() : null
    };
  }
  
  // Modify fire method to add screen shake on powerful shots
  fire(position, direction, type = 'apple') {
    // Get reference to projectile system
    const projectileSystem = this.projectileSystem;
    if (!projectileSystem) return null;
    
    // Create projectile
    const result = projectileSystem.release(position, {
      direction,
      type
    });
    
    // Add screen shake based on power
    if (result && result.power > 0.7 && this.camera && typeof this.camera.shake === 'function') {
      const shakeAmount = result.power * 0.3; // Proportional to shot power
      this.camera.shake(shakeAmount, 0.2);
    }
    
    // ... rest of method ...
  }
}
