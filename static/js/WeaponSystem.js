import * as THREE from 'three';
import ProjectileSystem from './ProjectileSystem.js';

/**
 * Manages weapons and firing for the player
 */
export default class WeaponSystem {
  /**
   * Create a new weapon system
   * @param {THREE.Scene} scene - The 3D scene
   * @param {THREE.Camera} camera - The player camera
   * @param {Object} options - Configuration options
   */
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.options = Object.assign({
      projectileSpeed: 130,
      maxAmmo: {
        apple: 50,
        goldenApple: 10
      },
      cooldownTime: 0.2, // seconds
      sphereRadius: 400,
      gravity: 0.15,
      collidables: []
    }, options);

    // Initialize ammo counts
    this.ammo = {
      apple: 10,
      goldenApple: 3
    };

    // Current weapon state
    this.currentWeapon = 'slingshot'; // Start with regular slingshot
    this.isCharging = false;
    this.chargeState = null;
    this.cooldown = 0;

    // ADDED: Debug flag for logging
    this.debug = false;

    // Initialize projectile system
    this.projectileSystem = new ProjectileSystem(scene, {
      sphereRadius: this.options.sphereRadius,
      gravity: this.options.gravity,
      projectileSpeed: this.options.projectileSpeed,
      collidables: this.options.collidables
    });
  }

  /**
   * Update weapon system state
   * @param {number} deltaTime - Time since last frame in seconds
   * @param {THREE.Vector3} playerPosition - Current player position
   */
  update(deltaTime, playerPosition) {
    // Update cooldown timer
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }

    // Update charge state if charging
    if (this.isCharging) {
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      this.chargeState = this.projectileSystem.updateCharge(deltaTime, cameraDirection);
    }

    // Update projectile system with safety check
    if (this.projectileSystem) {
      try {
        this.projectileSystem.update(deltaTime);
      } catch (err) {
        console.error("Error updating projectile system:", err);
      }
    }
  }

  /**
   * Start charging a shot
   * @returns {Object} Charge state information
   */
  startCharging() {
    // Debug output
    if (this.debug) console.log("Starting charge...");

    // Check cooldown
    if (this.cooldown > 0) {
      if (this.debug) console.log("Weapon on cooldown, can't charge");
      return null;
    }

    // Check if we have ammo for the current weapon
    const ammoType = this.currentWeapon === 'goldenSlingshot' ? 'goldenApple' : 'apple';
    if (this.ammo[ammoType] <= 0) {
      if (this.debug) console.log(`No ${ammoType} ammo remaining`);
      return null;
    }

    // Not already charging
    if (!this.isCharging) {
      // Get current aim direction from camera
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      
      // Start charging
      this.isCharging = true;
      this.chargeState = this.projectileSystem.startCharging(direction);
      
      return this.chargeState;
    }
    
    return this.chargeState;
  }

  /**
   * Release the charged shot
   * @param {THREE.Vector3} playerPosition - Current player position
   * @returns {Object} Information about the fired projectile
   */
  releaseShot(playerPosition) {
    // Not charging or on cooldown
    if (!this.isCharging || this.cooldown > 0) return null;
    
    // Debug log
    if (this.debug) console.log("Releasing shot...");
    
    // Get current camera position and direction
    const cameraPos = new THREE.Vector3();
    const cameraDir = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPos);
    this.camera.getWorldDirection(cameraDir);
    
    // Log these for debugging
    console.log("Camera position:", cameraPos);
    console.log("Camera direction:", cameraDir);
    
    // Calculate launch position (in front of camera)
    const launchPos = cameraPos.clone().add(cameraDir.clone().multiplyScalar(2));
    console.log("Launch position:", launchPos);

    // Determine projectile type based on weapon
    const projectileType = this.currentWeapon === 'goldenSlingshot' ? 'goldenApple' : 'apple';

    // Release the projectile
    const result = this.projectileSystem.release(launchPos, {
      direction: cameraDir,
      type: projectileType
    });
    
    // If we successfully fired a projectile
    if (result && result.projectile) {
      // Reduce ammo
      this.ammo[projectileType]--;
      
      // Set cooldown
      this.cooldown = this.options.cooldownTime;
      
      // Reset charging state
      this.isCharging = false;
      this.chargeState = null;
      
      return {
        projectile: result.projectile,
        power: result.power,
        type: projectileType
      };
    } else {
      // Failed to release projectile
      this.isCharging = false;
      this.chargeState = null;
      return null;
    }
  }

  /**
   * Switch between available weapons
   * @returns {boolean} Whether the switch was successful
   */
  switchWeapon() {
    // Can't switch weapons while charging
    if (this.isCharging) return false;
    
    // Toggle between weapons
    this.currentWeapon = this.currentWeapon === 'slingshot' ? 'goldenSlingshot' : 'slingshot';
    
    // Debug log
    if (this.debug) console.log(`Switched to ${this.currentWeapon}`);
    
    return true;
  }

  /**
   * Add ammo of a specific type
   * @param {string} type - Ammo type ('apple', 'goldenApple')
   * @param {number} amount - Amount to add
   * @returns {number} New ammo count
   */
  addAmmo(type, amount = 1) {
    if (!this.ammo[type]) return 0;
    
    this.ammo[type] = Math.min(this.ammo[type] + amount, this.options.maxAmmo[type]);
    
    // Debug output
    if (this.debug) console.log(`Added ${amount} ${type}. New total: ${this.ammo[type]}`);
    
    return this.ammo[type];
  }

  /**
   * Cancel the current charge
   */
  cancelCharge() {
    if (!this.isCharging) return;
    
    this.projectileSystem.cancelCharge();
    this.isCharging = false;
    this.chargeState = null;
    
    // FIXED: Add debug output
    console.log("Charge canceled");
  }

  /**
   * Get the current weapon state
   * @returns {Object} Weapon state information
   */
  getState() {
    return {
      currentWeapon: this.currentWeapon,
      isCharging: this.isCharging,
      chargeState: this.chargeState,
      cooldown: this.cooldown,
      ammo: { ...this.ammo },
      projectileCount: this.projectileSystem?.projectiles?.length || 0,
      poolSize: this.projectileSystem?.projectilePool?.length || 0
    };
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enable - Whether to enable debugging
   */
  setDebug(enable = true) {
    this.debug = enable;
    if (this.projectileSystem) {
      this.projectileSystem.debug = enable;
    }
    console.log(`Weapon system debug mode ${enable ? 'enabled' : 'disabled'}`);
  }
}

// Just confirming that these are the correct method names
// startCharging() - Called by Player.fireWeapon()
// releaseShot() - Called by Player.releaseWeapon()
// cancelCharge() - Called by Player.cancelWeapon()

// No changes needed in this file, as the player.js file has been updated to match 
// the method names defined here.
