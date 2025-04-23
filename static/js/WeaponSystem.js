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
      // IMPROVED: Much higher projectile speed for bow/slingshot feel
      projectileSpeed: 80, // Doubled from 40 to 80 for a much faster initial velocity
      projectileRadius: 1.0,
      collidables: []
    }, options);
    
    // Create projectile system with enhanced physics
    this.projectileSystem = new ProjectileSystem(scene, {
      sphereRadius: this.options.sphereRadius,
      // IMPROVED: Higher gravity for more dramatic arcs
      gravity: this.options.gravity * 2.5, // 2.5x higher gravity for faster drops
      projectileRadius: this.options.projectileRadius,
      projectileSpeed: this.options.projectileSpeed,
      // IMPROVED: Shorter lifetime for projectiles that go too far
      projectileLifetime: 8000, // 8 seconds max lifetime
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
    if (this.cooldown > 0 || this.isCharging) return false;
    
    // Check ammo
    if (this.ammo.apple <= 0) return false;
    
    // Get camera direction
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    
    // Start charging
    this.isCharging = true;
    this.slingshotModel.visible = true;
    
    // Scale the band to show tension
    this._updateSlingshotTension(0);
    
    // Start projectile system charging
    this.projectileSystem.startCharging(direction);
    
    return true;
  }
  
  /**
   * Update charging state
   * @param {number} deltaTime - Time since last frame
   */
  updateCharge(deltaTime) {
    if (!this.isCharging) return;
    
    // Get camera direction
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    
    // Update projectile system charge
    const chargeState = this.projectileSystem.updateCharge(deltaTime, direction);
    
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
    
    // Pull band back based on power
    const pullDistance = power * 0.1; // Max 10cm pull
    
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
    // Update projectiles
    this.projectileSystem.update(deltaTime);
    
    // Update charging
    if (this.isCharging) {
      this.updateCharge(deltaTime);
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
}
