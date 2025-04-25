import * as THREE from 'three';
import TWEEN from './libs/tween.esm.js';
import ProjectileSystem from './ProjectileSystem.js';

/**
 * Weapon system for shooting projectiles
 */
export default class WeaponSystem {
  /**
   * Create a new weapon system
   * @param {THREE.Scene} scene - The scene
   * @param {THREE.Camera} camera - The camera/player view
   * @param {Object} options - Configuration options
   */
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;
    
    // Configure with defaults
    this.options = Object.assign({
      projectileSpeed: 40,
      gravity: 0.15,
      sphereRadius: 400,
      getTerrainHeight: null,
      projectileRadius: 3.0,
      launchOffset: 3.0,
      chargeTime: 1.5, // Time in seconds to fully charge
      collidables: null // Add collidables option to pass to ProjectileSystem
    }, options);
    
    // Create projectile system with collidables
    this.projectileSystem = new ProjectileSystem(scene, {
      projectileSpeed: this.options.projectileSpeed,
      gravity: this.options.gravity,
      sphereRadius: this.options.sphereRadius,
      getTerrainHeight: this.options.getTerrainHeight,
      projectileRadius: this.options.projectileRadius,
      collidables: this.options.collidables, // Pass collidables for collision detection
      showCollisions: true // Enable visual collision effects
    });
    
    // Setup initial state
    this.ammo = {
      apple: 0,
      goldenApple: 0
    };
    
    this.currentWeapon = 'slingshot'; // Default weapon
    this.availableWeapons = ['slingshot', 'goldenSlingshot'];
    
    // Charging state
    this.isCharging = false;
    this.chargeStartTime = 0;
    this.currentCharge = 0;
    
    // Setup weapon model
    this.setupModel(camera);
    
    console.log("Weapon system created");
  }
  
  /**
   * Start charging the current weapon
   * @returns {boolean} Success
   */
  startCharging() {
    // Check if we have ammo
    const ammoType = this.currentWeapon === 'slingshot' ? 'apple' : 'goldenApple';
    if (this.ammo[ammoType] <= 0) {
      console.log("No ammo available for " + ammoType);
      return false;
    }
    
    this.isCharging = true;
    this.chargeStartTime = Date.now();
    this.currentCharge = 0;
    
    // Log charging started
    console.log(`Charging ${ammoType} weapon`);
    
    return true;
  }
  
  /**
   * Cancel weapon charging (e.g. when mouse leaves window)
   */
  cancelCharge() {
    if (this.isCharging) {
      this.isCharging = false;
      console.log("Weapon charge canceled");
    }
  }
  
  /**
   * Get current charge state
   * @returns {Object} Charge information
   */
  getChargeState() {
    if (!this.isCharging) return null;
    
    const elapsed = (Date.now() - this.chargeStartTime) / 1000;
    this.currentCharge = Math.min(elapsed / this.options.chargeTime, 1.0);
    
    // Store charge state so it can be accessed by getWeaponState
    this.chargeState = {
      power: this.currentCharge,
      elapsed
    };
    
    return this.chargeState;
  }
  
  /**
   * Fire a projectile with the current charge
   * @returns {Object|null} Result containing projectile info and power
   */
  fireProjectile() {
    if (!this.isCharging) return null;
    
    const chargeState = this.getChargeState();
    this.isCharging = false;
    
    // Make sure we have ammo
    const ammoType = this.currentWeapon === 'slingshot' ? 'apple' : 'goldenApple';
    if (this.ammo[ammoType] <= 0) {
      console.log("No ammo available");
      return null;
    }
    
    // Deduct ammo
    this.ammo[ammoType]--;
    
    // Calculate power based on charge
    const power = 0.3 + (chargeState.power * 0.7); // 30% minimum, 100% maximum
    
    // Get camera direction
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    
    // Get launch position (slightly in front of camera)
    const position = new THREE.Vector3();
    this.camera.getWorldPosition(position);
    position.add(direction.clone().multiplyScalar(this.options.launchOffset));
    
    // Create velocity vector
    const speed = this.options.projectileSpeed * power;
    const velocity = direction.clone().multiplyScalar(speed);
    
    // Create projectile
    const projectile = this.projectileSystem.createProjectile(
      position,
      velocity,
      ammoType
    );
    
    return {
      projectile,
      power,
      type: ammoType
    };
  }
  
  /**
   * Switch to the next available weapon
   * @returns {boolean} Whether weapon was switched
   */
  switchWeapon() {
    const currentIndex = this.availableWeapons.indexOf(this.currentWeapon);
    if (currentIndex === -1) return false;
    
    // Switch to next weapon with wrap-around
    const nextIndex = (currentIndex + 1) % this.availableWeapons.length;
    this.currentWeapon = this.availableWeapons[nextIndex];
    
    return true;
  }
  
  /**
   * Get current ammo amounts
   * @returns {Object} Ammo by type
   */
  getAmmo() {
    return { ...this.ammo };
  }
  
  /**
   * Set ammo amount for a specific type
   * @param {string} type - Ammo type
   * @param {number} amount - Amount to set
   * @returns {number} New amount
   */
  setAmmo(type, amount) {
    if (this.ammo[type] !== undefined) {
      this.ammo[type] = Math.max(0, amount);
      return this.ammo[type];
    }
    return 0;
  }
  
  /**
   * Add ammo to existing amount
   * @param {string} type - Ammo type
   * @param {number} amount - Amount to add
   * @returns {number} New amount
   */
  addAmmo(type, amount) {
    if (this.ammo[type] !== undefined) {
      this.ammo[type] += Math.max(0, amount);
      return this.ammo[type];
    }
    return 0;
  }
  
  /**
   * Update the weapon system
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Update projectile system
    if (this.projectileSystem) {
      this.projectileSystem.update(deltaTime);
    }
    
    // Update weapon model
    this.updateModel(deltaTime);
  }

  /**
   * Get the weapon's current state
   * @returns {Object} Current state of the weapon including ammo, charge, etc.
   */
  getWeaponState() {
    // Update charge state if we're charging
    const chargeState = this.isCharging ? this.getChargeState() : null;
    
    return {
      currentWeapon: this.currentWeapon,
      isCharging: this.isCharging,
      chargeState: chargeState,
      ammo: {
        apple: this.ammo.apple || 0,
        goldenApple: this.ammo.goldenApple || 0
      }
    };
  }

  /**
   * Set up the visual weapon model that appears in the player's view
   * @param {THREE.Camera} camera - The camera to attach the model to
   */
  setupModel(camera) {
    if (!camera) return;
    
    // Check for existing weapon model and remove it to prevent duplicates
    if (this.weaponModel) {
      camera.remove(this.weaponModel);
    }
    
    // Create slingshot model
    this.weaponModel = new THREE.Group();
    
    // Create basic slingshot shape - SLIMMER DIMENSIONS
    const handleGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.6, 6); // Slimmer radius
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, -0.3, 0);
    this.weaponModel.add(handle);
    
    // Add fork part - SLIMMER DIMENSIONS
    const forkGeometry = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6); // Slimmer radius, shorter length
    const forkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    
    const leftFork = new THREE.Mesh(forkGeometry, forkMaterial);
    leftFork.position.set(-0.12, 0, 0); // Closer to center
    leftFork.rotation.z = Math.PI / 7; // Slightly less angle
    this.weaponModel.add(leftFork);
    
    const rightFork = new THREE.Mesh(forkGeometry, forkMaterial);
    rightFork.position.set(0.12, 0, 0); // Closer to center
    rightFork.rotation.z = -Math.PI / 7; // Slightly less angle
    this.weaponModel.add(rightFork);
    
    // IMPROVED: Create separate elastic bands for left, right, and back
    // These will be manipulated independently for proper stretching

    // Left elastic band with THICKER line
    const leftBandMaterial = new THREE.LineBasicMaterial({ 
      color: 0x222222,
      linewidth: 3
    });
    this.leftBand = new THREE.Line(new THREE.BufferGeometry(), leftBandMaterial);
    
    // Right elastic band with THICKER line
    const rightBandMaterial = new THREE.LineBasicMaterial({ 
      color: 0x222222,
      linewidth: 3
    });
    this.rightBand = new THREE.Line(new THREE.BufferGeometry(), rightBandMaterial);

    // Add bands to weapon model
    this.weaponModel.add(this.leftBand);
    this.weaponModel.add(this.rightBand);
    
    // ALTERNATIVE: Create tubular mesh bands that are visually thicker
    const tubeDiameter = 0.01; // Diameter of the tube for bands
    
    // Left tubular band
    const leftTubeMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
    this.leftTubeBand = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)),
        5, // Path segments
        tubeDiameter, // Tube radius
        6, // Tube segments
        false // Closed
      ),
      leftTubeMaterial
    );
    this.weaponModel.add(this.leftTubeBand);
    
    // Right tubular band
    const rightTubeMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
    this.rightTubeBand = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)),
        5, // Path segments
        tubeDiameter, // Tube radius
        6, // Tube segments
        false // Closed
      ),
      rightTubeMaterial
    );
    this.weaponModel.add(this.rightTubeBand);
    
    // FIXED: Store fork tip positions - ADJUSTED to make the bands appear visually correct
    // Now the fork tips are at the front (negative Z)
    this.leftForkTip = new THREE.Vector3(-0.12, 0.175, -0.05);  // Front of forks
    this.rightForkTip = new THREE.Vector3(0.12, 0.175, -0.05);  // Front of forks
    this.pocketPosition = new THREE.Vector3(0, 0, 0.15);        // Behind the slingshot
    
    // Update band positions initially
    this._updateBands(this.pocketPosition);
    
    // Create and store the apple model that will appear when charging
    this.projectileModels = {
      apple: this._createAppleModel(),
      goldenApple: this._createGoldenAppleModel()
    };
    
    // Projectile is hidden initially
    this.activeProjectileModel = null;
    
    // Position slingshot in camera view - ADJUSTED positioning and rotation
    this.weaponModel.position.set(0.25, -0.3, -0.7);
    
    // ADJUSTED: Changed rotation to point more at 12 o'clock instead of 11 o'clock
    // Original: this.weaponModel.rotation.set(0, Math.PI * 0.2, -Math.PI * 0.08);
    this.weaponModel.rotation.set(0, Math.PI * 0.05, -Math.PI * 0.08); // Reduced Y rotation from 0.2π to 0.05π
    
    // Add to camera so it moves with view
    camera.add(this.weaponModel);
    
    // Store initial position/rotation for animations
    this.initialWeaponPosition = this.weaponModel.position.clone();
    this.initialWeaponRotation = this.weaponModel.rotation.clone();
    
    console.log("Improved slingshot model created and attached to camera");
  }

  /**
   * Create a model for a regular apple
   * @returns {THREE.Group} The apple model
   * @private
   */
  _createAppleModel() {
    const appleGroup = new THREE.Group();
    
    // Apple body
    const appleGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const appleMaterial = new THREE.MeshLambertMaterial({ color: 0xff2200 });
    const apple = new THREE.Mesh(appleGeometry, appleMaterial);
    appleGroup.add(apple);
    
    // Stem
    const stemGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 4);
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0, 0.08, 0);
    appleGroup.add(stem);
    
    appleGroup.visible = false;
    
    return appleGroup;
  }

  /**
   * Create a model for a golden apple
   * @returns {THREE.Group} The golden apple model
   * @private
   */
  _createGoldenAppleModel() {
    const appleGroup = new THREE.Group();
    
    // Apple body
    const appleGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const appleMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xffdd00,
      emissive: 0x443300
    });
    const apple = new THREE.Mesh(appleGeometry, appleMaterial);
    appleGroup.add(apple);
    
    // Stem
    const stemGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 4);
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0, 0.08, 0);
    appleGroup.add(stem);
    
    // Add glow for golden apple
    const glowGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    appleGroup.add(glow);
    
    appleGroup.visible = false;
    
    return appleGroup;
  }

  /**
   * Update elastic bands to connect to the pocket position
   * @param {THREE.Vector3} pocketPos - Position of the elastic pocket
   * @private
   */
  _updateBands(pocketPos) {
    // Update line-based bands (fallback for older browsers)
    // Update left band vertices
    const leftBandPoints = [
      this.leftForkTip.clone(),
      pocketPos.clone()
    ];
    this.leftBand.geometry.dispose();
    this.leftBand.geometry = new THREE.BufferGeometry().setFromPoints(leftBandPoints);
    
    // Update right band vertices
    const rightBandPoints = [
      this.rightForkTip.clone(),
      pocketPos.clone()
    ];
    this.rightBand.geometry.dispose();
    this.rightBand.geometry = new THREE.BufferGeometry().setFromPoints(rightBandPoints);
    
    // Update tubular mesh bands (visually thicker)
    // Create new tube geometry for left band
    if (this.leftTubeBand.geometry) this.leftTubeBand.geometry.dispose();
    const leftCurve = new THREE.LineCurve3(this.leftForkTip.clone(), pocketPos.clone());
    this.leftTubeBand.geometry = new THREE.TubeGeometry(
      leftCurve,
      5, // Path segments
      0.01, // Tube radius
      6, // Tube segments
      false // Closed
    );
    
    // Create new tube geometry for right band
    if (this.rightTubeBand.geometry) this.rightTubeBand.geometry.dispose();
    const rightCurve = new THREE.LineCurve3(this.rightForkTip.clone(), pocketPos.clone());
    this.rightTubeBand.geometry = new THREE.TubeGeometry(
      rightCurve,
      5, // Path segments
      0.01, // Tube radius
      6, // Tube segments
      false // Closed
    );
  }

  /**
   * Remove the slingshot model from camera
   * (Helpful for cleanup and preventing duplicates)
   */
  removeModel() {
    if (this.weaponModel && this.camera) {
      this.camera.remove(this.weaponModel);
      this.weaponModel = null;
    }
  }

  /**
   * Update the weapon model based on current state
   * @param {number} deltaTime - Time since last update
   */
  updateModel(deltaTime) {
    if (!this.weaponModel) return;
    
    // Handle charging animation
    if (this.isCharging) {
      // Get charge amount (0 to 1)
      const charge = this.getChargeState()?.power || 0;
      
      // FIXED: Pull back the pocket position correctly (positive Z is away from player)
      const pullBackDistance = 0.3 * charge;
      const pocketPosition = new THREE.Vector3(0, 0, 0.15 + pullBackDistance); // Further behind
      
      // Update band vertices to connect to the pulled-back pocket
      this._updateBands(pocketPosition);
      
      // Show the appropriate projectile
      const ammoType = this.currentWeapon === 'slingshot' ? 'apple' : 'goldenApple';
      
      // Show the projectile if we haven't already
      if (!this.activeProjectileModel) {
        this.activeProjectileModel = this.projectileModels[ammoType];
        this.weaponModel.add(this.activeProjectileModel);
        this.activeProjectileModel.visible = true;
      }
      
      // Move projectile with the pocket (at the band intersection)
      this.activeProjectileModel.position.copy(pocketPosition);
    } else {
      // Return bands to original position
      const restingPocketPos = new THREE.Vector3(0, 0, 0.15); // Default behind position
      this._updateBands(restingPocketPos);
      
      // Hide the projectile if it's visible
      if (this.activeProjectileModel) {
        this.activeProjectileModel.visible = false;
        this.activeProjectileModel = null;
      }
    }
    
    // Add subtle idle animation
    const time = Date.now() / 1000;
    const idleAmount = Math.sin(time * 2) * 0.01;
    this.weaponModel.position.y = this.initialWeaponPosition.y + idleAmount;
    this.weaponModel.rotation.x = this.initialWeaponRotation.x + idleAmount * 0.1;
  }
}
