import * as THREE from 'three';
import SphereControls from './SphereControls.js';
import OrientationHelper from './OrientationHelper.js';
import WeaponSystem from './WeaponSystem.js';

/**
 * Player class that manages the first-person character
 */
export default class Player {
  /**
   * Create a new player
   * @param {Object} options - Player configuration
   */
  constructor(scene, canvas, options = {}) {
    this.scene = scene;
    this.canvas = canvas;
    this.options = Object.assign({
      // Default options
      startPosition: new THREE.Vector3(0, 1, 0).normalize(),
      startElevation: 30,
      // DOUBLE the eye height AGAIN
      eyeHeight: 6.6, // (3.3 * 2)
      moveSpeed: 32.0,
      lookSpeed: 0.002,
      jumpStrength: 20.0,
      gravity: 0.015,
      maxJumps: 2,
      playerRadius: 2.0,
      playerColor: 0x0000FF, // Blue
      debugMode: false,
      terrainConformFactor: 0.9, // How strongly camera conforms to terrain (0-1)
    }, options);

    // Initialize components
    this._initCamera();
    this._initControls();

    // Add player object to scene
    scene.add(this.playerObject);
    
    // Debug body (visible representation of player if debugMode is enabled)
    if (this.options.debugMode) {
      this._createDebugBody();
    }

    // Initialize weapon system
    this.weaponSystem = new WeaponSystem(scene, this.camera, {
      sphereRadius: this.options.sphereRadius,
      gravity: this.options.gravity * 0.75, // Use slightly less gravity for projectiles
      projectileSpeed: 40,
      projectileRadius: 0.8,
      getTerrainHeight: this.options.getTerrainHeight,
      collidables: this.options.collidables
    });
    
    // Set up weapon models
    // FIXED: Remove the call to setupModel which doesn't exist
    // this.weaponSystem.setupModel(this.camera);
    
    // Weapon input state
    this.weaponInput = {
      firing: false,
      weaponSwitchTimer: 0
    };
  }

  /**
   * Initialize the player camera
   */
  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      2000
    );
  }

  /**
   * Initialize player controls
   */
  _initControls() {
    const startTerrainHeight = this.options.getTerrainHeight(this.options.startPosition);
    
    this.controls = new SphereControls(
      this.camera,
      this.canvas,
      {
        sphereRadius: this.options.sphereRadius,
        getTerrainHeight: this.options.getTerrainHeight,
        moveSpeed: this.options.moveSpeed,
        lookSpeed: this.options.lookSpeed,
        jumpStrength: this.options.jumpStrength,
        gravity: this.options.gravity,
        maxJumps: this.options.maxJumps,
        eyeHeight: this.options.eyeHeight,
        createPlayerBody: true,
        playerRadius: this.options.playerRadius,
        collidables: this.options.collidables,
        startPosition: this.options.startPosition,
        startElevation: this.options.startElevation
      }
    );
    
    this.playerObject = this.controls.getObject();
    
    // Add orientation helper
    this.orientHelper = new OrientationHelper(this.playerObject);
  }

  /**
   * Create a visible representation of the player (for debug mode)
   */
  _createDebugBody() {
    const height = this.options.playerRadius * 2;
    const geometry = new THREE.CylinderGeometry(
      this.options.playerRadius, 
      this.options.playerRadius, 
      height, 
      16, // radial segments for smoothness
      1,  // height segments
      false
    );
    const material = new THREE.MeshBasicMaterial({
      color: this.options.playerColor,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    
    this.debugBody = new THREE.Mesh(geometry, material);
    // Offset the cylinder so its base is at y=0 instead of centered
    this.debugBody.position.set(0, -height / 2, 0);
    this.playerObject.add(this.debugBody);
  }

  /**
   * Update player (call this every frame)
   * @param {number} delta - Time since last update
   */
  update(delta) {
    // Update player controls first
    this.controls.update(delta);
    
    // --- SIMPLIFIED CAMERA ORIENTATION ---
    // Directly use the player object's 'up' vector (calculated in SphereControls based on terrain)
    // This ensures the camera aligns with the ground the player is standing on.
    this.camera.up.copy(this.playerObject.up);
    
    // We still need to make the camera look where the player is looking (handled by SphereControls pitch/yaw)
    // but the 'up' direction is now directly tied to the terrain normal under the player.
    
    // Remove the call to the complex _updateTerrainTilt method
    // if (this.controls.onGround && !this._wasJustJumping) {
    //   this._updateTerrainTilt(delta); // COMMENTED OUT
    // }
    
    // Landing state tracking is no longer needed for camera tilt
    // if (this.controls.isJumping) { ... } // COMMENTED OUT
    
    // Re-orthonormalize player axes - STILL IMPORTANT
    this.orientHelper.update();

    // Update the weapon system - pass player position
    this.weaponSystem.update(delta, this.playerObject.position);
    
    // Update weapon switch timer
    if (this.weaponInput.weaponSwitchTimer > 0) {
      this.weaponInput.weaponSwitchTimer -= delta;
    }
  }

  /**
   * Get player camera for rendering
   * @returns {THREE.Camera} - The player camera
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Update player physics parameters
   * @param {Object} params - Physics parameters to update
   */
  updatePhysics(params = {}) {
    if (params.gravity !== undefined) {
      this.controls.gravity = params.gravity;
    }
    
    if (params.jumpStrength !== undefined) {
      this.controls.jumpStrength = params.jumpStrength;
    }
    
    if (params.maxJumps !== undefined) {
      this.controls.maxJumps = params.maxJumps;
      this.controls.jumpsRemaining = Math.min(
        this.controls.jumpsRemaining, 
        params.maxJumps
      );
    }
  }

  /**
   * Force player to jump
   */
  makeJump() {
    // apply upward + forward impulse for directional jump
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.normalize();
    forward.multiplyScalar(this.options.jumpStrength);
    forward.y = this.options.jumpStrength; // ensure strong upward component

    this.controls.velocity.add(forward);
    this.controls.isJumping = true;
    this.controls.onGround = false;
  }

  /**
   * Get player state information for debugging
   * @returns {Object} - Current player state
   */
  getInfo() {
    const pos = this.playerObject.position;
    const velocity = this.controls.getVelocity();
    const gravDir = pos.clone().normalize().negate();
    const gravComponent = velocity.dot(gravDir);
    
    return {
      position: pos.clone(),
      velocity: velocity.clone(),
      speed: velocity.length(),
      height: pos.length() - this.options.sphereRadius,
      onGround: this.controls.onGround,
      isJumping: this.controls.isJumping,
      jumpsRemaining: this.controls.jumpsRemaining,
      maxJumps: this.controls.maxJumps,
      isGravityWorking: gravComponent > 0, // falling = true, rising = false
      verticalSpeed: gravComponent
    };
  }

  /**
   * Reset player to starting position
   */
  reset() {
    this.controls.reset();
  }

  /**
   * Handle window resize events
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Fire the weapon
   */
  fireWeapon() {
    if (!this.weaponSystem) return false;
    
    console.log("Player#fireWeapon called"); // Debug logging
    
    // FIXED: Changed startCharge to startCharging to match WeaponSystem
    const started = this.weaponSystem.startCharging();
    return started;
  }

  /**
   * Release the weapon
   */
  releaseWeapon() {
    if (!this.weaponSystem) return null;
    
    console.log("Player#releaseWeapon called"); // Debug logging
    
    // FIXED: Changed releaseCharge to releaseShot to match WeaponSystem
    const result = this.weaponSystem.releaseShot(this.playerObject.position);
    return result;
  }

  /**
   * Cancel weapon charging (mouse leaves window)
   */
  cancelWeapon() {
    if (!this.weaponSystem) return;
    
    console.log("Player#cancelWeapon called"); // Debug logging
    
    // Cancel charging - this method name is correct
    this.weaponSystem.cancelCharge();
  }

  /**
   * Switch the weapon
   */
  switchWeapon() {
    // Prevent rapid switching
    if (this.weaponInput.weaponSwitchTimer > 0) return false;
    
    const state = this.weaponSystem.getState();
    const newWeapon = state.currentWeapon === 'slingshot' ? 'goldenSlingshot' : 'slingshot';
    
    const result = this.weaponSystem.switchWeapon(newWeapon);
    if (result) {
      this.weaponInput.weaponSwitchTimer = 0.5; // 500ms cooldown
    }
    
    return result;
  }

  /**
   * Get the weapon state
   */
  getWeaponState() {
    return this.weaponSystem.getState();
  }

  /**
   * Add ammo to the weapon
   */
  addAmmo(type, amount) {
    return this.weaponSystem.addAmmo(type, amount);
  }
}
