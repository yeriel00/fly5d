import * as THREE from 'three';
import SphereControls from './SphereControls.js';
import OrientationHelper from './OrientationHelper.js';
import WeaponSystem from './WeaponSystem.js';
import TreeJumpEnhancer from './TreeJumpEnhancer.js';

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
      // ADJUST APPLE SPEEDS: Modify these values to change projectile speeds by type
      projectileSpeeds: { 
        red: 40.0,     // Red apple speed (default/balanced)
        yellow: 60.0,  // Yellow apple speed (faster)
        green: 80.0    // Green apple speed (fastest)
      },
    }, options);

    // *** Initialize multi-ammo storage ***
    this.ammo = {
        red: 0,
        yellow: 0,
        green: 0
    };
    // *** End multi-ammo storage ***

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
        startElevation: this.options.startElevation,
        crouchHeight: 0.5, // 50% of normal height when crouched
        crouchSpeedMultiplier: 0.7, // 70% movement speed when crouched
        crouchTransitionTime: 0.2 // Smooth transition time in seconds
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
      projectileRadius: 0.8,
      getTerrainHeight: this.options.getTerrainHeight,
      collidables: this.options.collidables,
      player: this, // Pass the player reference
      // *** Pass the player's ammo object ***
      ammoSource: this.ammo
      // *** End pass ammo object ***
    });
    
    // Alternatively, set player directly after creation
    if (this.weaponSystem && typeof this.weaponSystem.setPlayer === 'function') {
      this.weaponSystem.setPlayer(this);
    }
    
    // Add this line to set up the weapon model
    this.weaponSystem.setupModel(this.camera);
    
    // Weapon input state
    this.weaponInput = {
      firing: false,
      weaponSwitchTimer: 0 // Cooldown for ammo switching
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
    this.weaponSystem.update(delta);
    
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

    // Update debug body height if it exists and we're crouching
    if (this.debugBody && this.controls.crouchAmount > 0) {
      // Scale the debug cylinder to match crouch height
      const fullHeight = this.options.playerRadius * 2;
      const crouchHeight = fullHeight * (1 - (this.controls.crouchAmount * 0.5)); // Reduce by up to 50%
      const scale = crouchHeight / fullHeight;
      
      this.debugBody.scale.y = scale;
      
      // Adjust position to keep feet at the same place
      const heightDiff = fullHeight - crouchHeight;
      this.debugBody.position.y = -(crouchHeight / 2) + (heightDiff / 2);
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
      verticalSpeed: gravComponent,
      isCrouching: this.controls.isCrouching,
      crouchAmount: this.controls.crouchAmount, // Add crouch amount for smoothness info
      crouchToggled: this.controls.crouchToggled // Add toggle state info
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
    console.log("Player#fireWeapon called");
    
    // CRITICAL NEW SAFETY: Inform controls about weapon firing state
    if (this.controls && typeof this.controls.setWeaponFiring === 'function') {
        this.controls.setWeaponFiring(true);
    }
    
    // Existing weapon firing code...
    if (this.weaponSystem) {
        // startCharging now returns false if no ammo, preventing incorrect animation
        return this.weaponSystem.startCharging();
    }
    return false;
  }

  /**
   * Release the weapon
   */
  releaseWeapon() {
    console.log("Player#releaseWeapon called");
    
    // CRITICAL NEW SAFETY: Reset weapon firing state
    if (this.controls && typeof this.controls.setWeaponFiring === 'function') {
      this.controls.setWeaponFiring(false);
    }
    
    if (!this.weaponSystem) return { fired: false };

    console.log("Player#releaseWeapon -> Calling weaponSystem.release()");
    const result = this.weaponSystem.release(); // Get charge info { canFire, power, ammoType }
    console.log("Player#releaseWeapon -> weaponSystem.release() result:", result);

    if (result && result.canFire && result.ammoType) {
      const ammoTypeToConsume = result.ammoType;

      // Check ammo again just before firing (safety)
      if (!this.ammo || this.ammo[ammoTypeToConsume] <= 0) {
          console.warn(`Player#releaseWeapon -> Ammo check failed just before firing ${ammoTypeToConsume}. Aborting.`);
          
          // Force update UI and model even when failing due to no ammo
          if (this.weaponSystem) {
            if (typeof this.weaponSystem._updateAmmoDisplay === 'function') {
              this.weaponSystem._updateAmmoDisplay();
            }
            if (typeof this.weaponSystem.updateModel === 'function') {
              this.weaponSystem.updateModel();
            }
          }
          
          return { fired: false };
      }

      const cameraPos = new THREE.Vector3();
      const cameraDir = new THREE.Vector3();
      this.camera.getWorldPosition(cameraPos);
      this.camera.getWorldDirection(cameraDir);

      // *** Calculate Speed Based on Ammo Type from Player options ***
      const baseSpeed = this.options.projectileSpeeds[ammoTypeToConsume] || this.options.projectileSpeeds.red; // Default to red speed
      const finalSpeed = baseSpeed * (0.5 + result.power * 0.5); // Scale speed by charge power (min 50%)
      // *** End Calculate Speed ***

      const initialVelocity = cameraDir.clone().multiplyScalar(finalSpeed);
      const startPosition = cameraPos.clone().addScaledVector(cameraDir, this.options.playerRadius * 1.2);

      console.log(`Player#releaseWeapon -> Firing ${ammoTypeToConsume}. Ammo before: ${this.ammo[ammoTypeToConsume]}`);

      // Create the projectile
      const projectile = this.weaponSystem.projectileSystem.createProjectile(
        startPosition,
        initialVelocity,
        ammoTypeToConsume // Pass the correct ammo type
      );

      // Consume ammo
      this.ammo[ammoTypeToConsume]--;
      console.log(`Player#releaseWeapon -> Ammo after: ${this.ammo[ammoTypeToConsume]}`);
      
      // MOST IMPORTANT: Always force UI and model updates after shooting
      if (this.weaponSystem) {
        if (typeof this.weaponSystem._updateAmmoDisplay === 'function') {
          this.weaponSystem._updateAmmoDisplay();
        }
        if (typeof this.weaponSystem.updateModel === 'function') {
          this.weaponSystem.updateModel();
        }
      }

      // Return info
      return {
        fired: true,
        power: result.power,
        projectile: {
          type: ammoTypeToConsume,
          speed: finalSpeed
        }
      };
    } else if (result && !result.canFire) {
      const failedAmmoType = result.ammoType || 'unknown';
      console.log(`Player#releaseWeapon -> Cannot fire, weaponSystem reported !canFire. Ammo type: ${failedAmmoType}, Ammo count: ${this.ammo[failedAmmoType] ?? 'N/A'}`);
    } else if (!result) {
       console.log("Player#releaseWeapon -> weaponSystem.release() returned null/falsy.");
    }
    
    // CRITICAL: Always force UI and model updates even when release fails
    if (this.weaponSystem) {
      if (typeof this.weaponSystem._updateAmmoDisplay === 'function') {
        this.weaponSystem._updateAmmoDisplay();
      }
      if (typeof this.weaponSystem.updateModel === 'function') {
        this.weaponSystem.updateModel();
      }
    }
    
    return { fired: false }; // Indicate failure
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

  /** Cycle through available ammo types */
  cycleWeapon() {
    // Prevent rapid switching
    if (this.weaponInput.weaponSwitchTimer > 0) return false;
    if (!this.weaponSystem) return false;

    const newType = this.weaponSystem.cycleAmmoType();
    if (newType) {
      this.weaponInput.weaponSwitchTimer = 0.3; // 300ms cooldown
      console.log(`Player cycled weapon to: ${newType}`);
      // Optionally trigger UI update here if needed immediately
      return true;
    }
    return false;
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
    // *** Handle red, yellow, green types ***
    if (this.ammo.hasOwnProperty(type)) {
      this.ammo[type] = Math.max(0, this.ammo[type] + amount);
      console.log(`Player Ammo: Added ${amount} ${type}. Total ${type}: ${this.ammo[type]}`);
      
      // ADDED: Update the UI display whenever ammo is added
      if (this.weaponSystem && typeof this.weaponSystem._updateAmmoDisplay === 'function') {
        // Update the ammo display UI
        this.weaponSystem._updateAmmoDisplay();
        
        // Also check if we need to update the model 
        // (e.g. if player had 0 of this type before but now has some)
        if (amount > 0 && this.weaponSystem.currentAmmoType === type) {
          if (typeof this.weaponSystem.updateModel === 'function') {
            this.weaponSystem.updateModel();
          }
        }
      }
      
      return this.ammo[type];
    } else {
      console.warn(`Player: Unknown ammo type "${type}"`);
      return 0;
    }
    // *** End handle types ***
  }

  /**
   * Add a method to check if the player is crouching
   */
  isCrouching() {
    return this.controls?.isCrouching || false;
  }

  /**
   * Add a method to toggle crouch state
   */
  toggleCrouch() {
    if (this.controls) {
      this.controls.toggleCrouch();
      return this.controls.isCrouching;
    }
    return false;
  }
}
