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
      projectileSpeed: 520, // INCREASED: 4x from 130 to 520 for much faster apples
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

    // Create weapon models
    this.weaponModels = {};
    this._createWeaponModels();
    this._setupCurrentWeapon();
  }

  /**
   * Create weapon models for the different types of weapons
   * @private
   */
  _createWeaponModels() {
    // Create the slingshot model
    this.weaponModels.slingshot = this._createSlingshotModel();
    
    // Create the golden slingshot (same model but with golden materials)
    this.weaponModels.goldenSlingshot = this._createSlingshotModel(true);
  }

  /**
   * Creates a slingshot model using Three.js geometries
   * @param {boolean} isGolden - Whether to use gold materials
   * @returns {THREE.Group} The slingshot model
   * @private
   */
  _createSlingshotModel(isGolden = false) {
    const slingshotGroup = new THREE.Group();
    
    // Materials
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: isGolden ? 0xC9B037 : 0x8B4513, // Gold or Dark Brown
      roughness: isGolden ? 0.4 : 0.8,
      metalness: isGolden ? 0.8 : 0.1,
      map: null, // You could add a wood texture here
    });
    
    const rubberMaterial = new THREE.MeshStandardMaterial({
      color: isGolden ? 0xFFD700 : 0x333333, // Gold or Dark Gray
      roughness: 0.9,
      metalness: 0.0,
      emissive: isGolden ? 0x553300 : 0x000000,
      emissiveIntensity: isGolden ? 0.2 : 0,
    });

    // Handle (main body of the slingshot)
    const handleGeometry = new THREE.CylinderGeometry(0.02, 0.025, 0.15, 8);
    const handle = new THREE.Mesh(handleGeometry, woodMaterial);
    handle.position.set(0, -0.07, 0);
    slingshotGroup.add(handle);

    // Y-shape top of the slingshot
    const forkGroup = new THREE.Group();
    forkGroup.position.set(0, 0.01, 0);
    
    // Left fork
    const leftForkGeometry = new THREE.CylinderGeometry(0.015, 0.02, 0.12, 8);
    const leftFork = new THREE.Mesh(leftForkGeometry, woodMaterial);
    leftFork.position.set(-0.05, 0.05, 0);
    leftFork.rotation.z = Math.PI / 8; // Tilt outward
    forkGroup.add(leftFork);
    
    // Right fork
    const rightForkGeometry = new THREE.CylinderGeometry(0.015, 0.02, 0.12, 8);
    const rightFork = new THREE.Mesh(rightForkGeometry, woodMaterial);
    rightFork.position.set(0.05, 0.05, 0);
    rightFork.rotation.z = -Math.PI / 8; // Tilt outward
    forkGroup.add(rightFork);

    // Add some knots and imperfections for a handmade look
    const addKnot = (x, y, z, size) => {
      const knotGeometry = new THREE.SphereGeometry(size, 8, 6);
      const knot = new THREE.Mesh(knotGeometry, woodMaterial);
      knot.position.set(x, y, z);
      forkGroup.add(knot);
    };
    
    // Add some knots to make it look handmade
    if (!isGolden) {
      addKnot(-0.055, 0.03, 0.015, 0.018);
      addKnot(0.06, 0.07, -0.01, 0.016);
      addKnot(0, -0.05, 0.02, 0.02);
    }
    
    slingshotGroup.add(forkGroup);

    // Rubber sling (elastic band)
    const rubberPoints = [];
    // Create a curved shape for the rubber band
    const rubberCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.07, 0.09, 0),      // Left attachment point
      new THREE.Vector3(-0.04, 0.05, -0.04),  // Control point
      new THREE.Vector3(0.04, 0.05, -0.04),   // Control point
      new THREE.Vector3(0.07, 0.09, 0)        // Right attachment point
    );

    // Get points along the curve
    const rubberPoints1 = rubberCurve.getPoints(20);
    
    // Create another curve for the pulled-back state
    const rubberCurve2 = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.07, 0.09, 0),      // Left attachment point
      new THREE.Vector3(-0.03, 0.02, -0.08),  // Control point (pulled back)
      new THREE.Vector3(0.03, 0.02, -0.08),   // Control point (pulled back)
      new THREE.Vector3(0.07, 0.09, 0)        // Right attachment point
    );
    
    // Create a tube geometry along the curve
    const rubberGeometry = new THREE.TubeGeometry(
      rubberCurve, 
      20,    // tubular segments
      0.005, // radius
      8,     // radial segments
      false  // closed
    );
    const rubber = new THREE.Mesh(rubberGeometry, rubberMaterial);
    slingshotGroup.add(rubber);

    // Add a pouch in the middle of the rubber band
    const pouchGeometry = new THREE.BoxGeometry(0.03, 0.01, 0.02);
    const pouch = new THREE.Mesh(pouchGeometry, rubberMaterial);
    // Position at the middle/bottom of the rubber curve
    pouch.position.copy(rubberCurve.getPointAt(0.5));
    pouch.position.z -= 0.01; // Offset slightly forward
    slingshotGroup.add(pouch);

    // Save the rubber band and pouch references for animation
    slingshotGroup.userData = {
      rubber: rubber,
      pouch: pouch,
      rubberCurve: rubberCurve,    // Resting state
      rubberCurve2: rubberCurve2,  // Pulled state (for animation)
      // Store original positions for animation
      leftFork: leftFork,
      rightFork: rightFork
    };
    
    // Scale and position the whole slingshot
    slingshotGroup.scale.set(2.5, 2.5, 2.5); // Make it larger
    slingshotGroup.rotation.set(0, Math.PI, 0); // Rotate to face forward
    slingshotGroup.position.set(0.3, -0.25, -0.5); // Position in view
    
    return slingshotGroup;
  }

  /**
   * Setup the current weapon in view
   * @private
   */
  _setupCurrentWeapon() {
    // Clear any existing weapon from camera
    if (this.currentWeaponModel) {
      this.camera.remove(this.currentWeaponModel);
      this.currentWeaponModel = null;
    }
    
    // Get the model for current weapon
    const model = this.weaponModels[this.currentWeapon];
    if (model) {
      this.currentWeaponModel = model.clone();
      this.camera.add(this.currentWeaponModel);
      
      // Add custom user data for animation
      if (model.userData) {
        this.currentWeaponModel.userData = { 
          ...model.userData,
          // Clone necessary objects for animation
          rubber: this.currentWeaponModel.children.find(c => c.geometry instanceof THREE.TubeGeometry),
          pouch: this.currentWeaponModel.children.find(c => c.geometry instanceof THREE.BoxGeometry)
        };
      }
    }
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
    
    // Update weapon animations
    this._updateWeaponAnimation(deltaTime);
  }

  /**
   * Update the weapon animation based on state
   * @param {number} deltaTime - Time since last update
   */
  _updateWeaponAnimation(deltaTime) {
    if (!this.currentWeaponModel) return;
    
    // Slingshot animation (pull back rubber band when charging)
    if (this.isCharging && this.chargeState) {
      const power = this.chargeState.power || 0;
      this._animateSlingshotPull(power);
    } else if (this.currentWeaponModel.userData.isPulled) {
      // Reset slingshot to unpulled state
      this._animateSlingshotPull(0);
      this.currentWeaponModel.userData.isPulled = false;
    }
    
    // Add some idle animation (slight bobbing/swaying)
    this._animateWeaponIdle(deltaTime);
  }

  /**
   * Animate the slingshot pull based on charge power
   * @param {number} power - The charge power between 0-1
   * @private
   */
  _animateSlingshotPull(power) {
    const model = this.currentWeaponModel;
    if (!model || !model.userData.rubber || !model.userData.pouch) return;
    
    const rubber = model.userData.rubber;
    const pouch = model.userData.pouch;
    
    if (power > 0) {
      // Remember we've pulled the slingshot
      model.userData.isPulled = true;
      
      // Create a new curve that's interpolated between resting and fully pulled
      const restCurve = model.userData.rubberCurve;
      const pullCurve = model.userData.rubberCurve2;
      
      // Create a new curve based on power for smooth animation
      const interpPoints = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const pt1 = restCurve.getPointAt(t);
        const pt2 = pullCurve.getPointAt(t);
        
        // Interpolate between rest and pulled based on power
        const x = pt1.x * (1 - power) + pt2.x * power;
        const y = pt1.y * (1 - power) + pt2.y * power;
        const z = pt1.z * (1 - power) + pt2.z * power - (power * 0.1); // Extra pull back
        
        interpPoints.push(new THREE.Vector3(x, y, z));
      }
      
      // Create new geometry and update the mesh
      const newCurve = new THREE.CatmullRomCurve3(interpPoints);
      const newGeometry = new THREE.TubeGeometry(
        newCurve, 
        20,    // tubular segments
        0.005, // radius
        8,     // radial segments
        false  // closed
      );
      
      rubber.geometry.dispose();
      rubber.geometry = newGeometry;
      
      // Update pouch position to follow the rubber band
      pouch.position.copy(newCurve.getPointAt(0.5));
      pouch.position.z -= 0.01 + (power * 0.05); // Move back with power
      
      // Add slight rotation/tilt based on power for visual interest
      model.rotation.x = power * 0.05;
      model.rotation.z = power * 0.025;
    } else {
      // Reset to original state
      const restCurve = model.userData.rubberCurve;
      const newGeometry = new THREE.TubeGeometry(
        restCurve, 
        20,    // tubular segments
        0.005, // radius
        8,     // radial segments
        false  // closed
      );
      
      rubber.geometry.dispose();
      rubber.geometry = newGeometry;
      
      // Reset pouch position
      pouch.position.copy(restCurve.getPointAt(0.5));
      pouch.position.z -= 0.01;
      
      // Reset rotation
      model.rotation.x = 0;
      model.rotation.z = 0;
    }
  }

  /**
   * Add idle animation to make weapon feel more alive
   * @param {number} deltaTime - Time since last update
   * @private
   */
  _animateWeaponIdle(deltaTime) {
    if (!this.currentWeaponModel) return;
    
    // Add subtle swaying motion
    const time = Date.now() * 0.001;
    const swayX = Math.sin(time * 0.5) * 0.01;
    const swayY = Math.sin(time * 0.7) * 0.005;
    
    // Apply sway to the model's position, preserving its base position
    const basePos = this.currentWeaponModel.userData.basePosition || this.currentWeaponModel.position.clone();
    
    // Store base position if not already stored
    if (!this.currentWeaponModel.userData.basePosition) {
      this.currentWeaponModel.userData.basePosition = basePos.clone();
    }
    
    this.currentWeaponModel.position.x = basePos.x + swayX;
    this.currentWeaponModel.position.y = basePos.y + swayY;
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

    // Release the projectile - use 25% more speed for dramatic effect
    const result = this.projectileSystem.release(launchPos, {
      direction: cameraDir,
      type: projectileType,
      speedMultiplier: 1.25 // Extra speed boost
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
    
    // Update the model after switching weapons
    this._setupCurrentWeapon();
    
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
