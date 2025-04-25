import * as THREE from 'three';
import SphereControls from './SphereControls.js';
import OrientationHelper from './OrientationHelper.js';
import WeaponSystem from './WeaponSystem.js';
import TreeJumpEnhancer from './TreeJumpEnhancer.js';  // Add import for TreeJumpEnhancer

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
      terrainConformFactor: 0.9, // How strongly camera conforms to terrain (0-1),
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

    // Use this new method instead of inline code
    this._initWeaponSystem();
    
    // Initialize tree jump enhancer
    this.treeJumpEnhancer = new TreeJumpEnhancer({
      maxBoostTime: 0.3,
      boostMultiplier: 1.6,  
      treeCollisionRadius: 5.0,
      debugMode: this.options.debugMode,
    });
    
    // Tree jump state
    this.treeJumpState = {
      boostedJump: false,
      nearTree: false,
      boostAvailable: false
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
   * Initialize the weapon system
   * @private
   */
  _initWeaponSystem() {
    this.weaponSystem = new WeaponSystem(this.scene, this.camera, {
      sphereRadius: this.options.sphereRadius,
      gravity: this.options.gravity * 0.75, // Use slightly less gravity for projectiles
      projectileSpeed: 160, // INCREASED: Quadrupled from 40 to 160 for much faster projectiles
      projectileRadius: 0.8,
      getTerrainHeight: this.options.getTerrainHeight,
      collidables: this.options.collidables
    });
    
    // Add this line to set up the weapon model
    this.weaponSystem.setupModel(this.camera);
    
    // Weapon input state
    this.weaponInput = {
      firing: false,
      weaponSwitchTimer: 0
    };
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
    
    // Update tree jump enhancer
    const currentTime = Date.now() / 1000;
    const trees = this.options.collidables?.filter(obj => 
      obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree
    );
    
    this.treeJumpEnhancer.update(
      delta,
      currentTime,
      this.playerObject.position,
      this.controls.isJumping,
      this.controls.onGround,
      trees,
      this.options.debugMode ? this.scene : null
    );
    
    // Update tree jump state
    this.treeJumpState.nearTree = this.treeJumpEnhancer.isNearTree(this.playerObject.position);
    this.treeJumpState.boostAvailable = this.treeJumpEnhancer.canBoost();
    
    // Update weapon switch timer
    if (this.weaponInput.weaponSwitchTimer > 0) {
      this.weaponInput.weaponSwitchTimer -= delta;
    }
    
    // Update UI indicators if near tree or boost available
    this._updateTreeJumpIndicators();
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
    // Check if we can perform a tree boost jump
    if (this.controls && this.controls.jumpsRemaining < this.controls.maxJumps) {
      const facingDirection = new THREE.Vector3();
      this.camera.getWorldDirection(facingDirection);
      
      // Try to perform a boosted jump off a tree
      const boosted = this.treeJumpEnhancer.tryBoost(facingDirection, (direction, multiplier) => {
        // Get current jump strength
        const jumpStrength = this.controls.jumpStrength * multiplier;
        
        // Apply directional boost
        direction.normalize().multiplyScalar(jumpStrength);
        this.controls.velocity.add(direction);
        
        // Set jumping state
        this.controls.isJumping = true;
        this.controls.onGround = false;
        
        // Extra feedback
        this.treeJumpState.boostedJump = true;
        setTimeout(() => {
          this.treeJumpState.boostedJump = false;
        }, 500);
        
        // Play special jump sfx
        this._playBoostSound();
      });
      
      if (boosted) {
        console.log("Performed tree boost jump!");
        return true;
      }
    }
    
    // Fall back to regular jump if boost wasn't performed
    // apply upward + forward impulse for directional jump
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.normalize();
    forward.multiplyScalar(this.options.jumpStrength);
    forward.y = this.options.jumpStrength; // ensure strong upward component

    this.controls.velocity.add(forward);
    this.controls.isJumping = true;
    this.controls.onGround = false;
    
    return true;
  }

  /**
   * Update visual indicators for tree jumps
   * @private
   */
  _updateTreeJumpIndicators() {
    // This could be extended to add HUD indicators
    if (this.treeJumpState.boostAvailable) {
      if (window.game && window.game.ui) {
        window.game.ui.showBoostIndicator(true);
      }
    } else if (this.treeJumpState.nearTree) {
      if (window.game && window.game.ui) {
        window.game.ui.showTreeProximityIndicator(true);
      }
    } else {
      if (window.game && window.game.ui) {
        window.game.ui.showBoostIndicator(false);
        window.game.ui.showTreeProximityIndicator(false);
      }
    }
  }

  /**
   * Play sound effect for boost jumping
   * @private
   */
  _playBoostSound() {
    // This would connect to an audio system
    if (window.game && window.game.audio) {
      window.game.audio.playSound('jumpBoost', 0.7);
    }
  }

  /**
   * Get information about tree jump state
   * @returns {Object} Tree jump state
   */
  getTreeJumpState() {
    return { ...this.treeJumpState };
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
    
    // FIXED: Changed releaseShot to fireProjectile to match WeaponSystem implementation
    const result = this.weaponSystem.fireProjectile();
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
    // If the weaponSystem doesn't exist or isn't initialized yet
    if (!this.weaponSystem) {
        return {
            currentWeapon: 'none',
            isCharging: false,
            chargeState: null,
            ammo: { apple: 0, goldenApple: 0 }
        };
    }
    
    // FIXED: Use the proper method name (getWeaponState instead of getState)
    // Check if the method exists first for better error handling
    if (typeof this.weaponSystem.getWeaponState === 'function') {
        return this.weaponSystem.getWeaponState();
    } else {
        console.warn("WeaponSystem missing getWeaponState method");
        
        // Fallback: create a basic state object with what we can access directly
        return {
            currentWeapon: this.weaponSystem.currentWeapon || 'slingshot',
            isCharging: this.weaponSystem.isCharging || false,
            chargeState: this.weaponSystem.chargeState || null,
            ammo: this.weaponSystem.ammo || { apple: 0, goldenApple: 0 }
        };
    }
  }

  /**
   * Add ammo to the weapon
   */
  addAmmo(type, amount) {
    return this.weaponSystem.addAmmo(type, amount);
  }
}
