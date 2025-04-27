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
    this.player = options.player || null; // Store player reference if provided
    // *** Store reference to player's ammo object ***
    this.ammo = options.ammoSource || { red: 0, yellow: 0, green: 0 }; // Use source or default

    // Configure with defaults
    this.options = Object.assign({
      // projectileSpeed: 40, // Base speed now comes from Player options
      gravity: 0.15,
      sphereRadius: 400,
      getTerrainHeight: null,
      projectileRadius: 0.8, // Use radius from Player options
      launchOffset: 1.5, // Reduced offset
      chargeTime: 1.5, // Time in seconds to fully charge
      collidables: null
    }, options);

    // Create projectile system with collidables
    this.projectileSystem = new ProjectileSystem(scene, {
      // projectileSpeed: this.options.projectileSpeed, // Speed determined on fire
      gravity: this.options.gravity,
      sphereRadius: this.options.sphereRadius,
      getTerrainHeight: this.options.getTerrainHeight,
      projectileRadius: this.options.projectileRadius,
      collidables: this.options.collidables,
      showCollisions: true
    });

    // *** Setup multi-ammo state ***
    this.availableAmmoTypes = ['red', 'yellow', 'green'];
    this.currentAmmoType = 'red'; // Default ammo type
    // *** End multi-ammo state ***

    // Charging state
    this.isCharging = false;
    this.chargeStartTime = 0;
    this.chargeState = null; // Store power, elapsed, and ammoType

    // Setup weapon model
    this.setupModel(camera);

    // Create charge UI
    this._setupChargeUI();

    // Setup direct right-click handler
    this._setupRightClickHandler();

    console.log("Weapon system created with multi-ammo support");
  }

  /**
   * Set up charge UI element
   * @private
   */
  _setupChargeUI() {
    // Create power bar container
    const powerBarContainer = document.createElement('div');
    powerBarContainer.id = 'power-bar-container';
    powerBarContainer.style.position = 'absolute';
    powerBarContainer.style.bottom = '30px';
    powerBarContainer.style.left = '50%';
    powerBarContainer.style.transform = 'translateX(-50%)';
    powerBarContainer.style.width = '200px';
    powerBarContainer.style.height = '10px';
    powerBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    powerBarContainer.style.borderRadius = '5px';
    powerBarContainer.style.display = 'none'; // Hide initially
    document.body.appendChild(powerBarContainer);
    
    // Create power bar fill
    const powerBarFill = document.createElement('div');
    powerBarFill.id = 'power-bar-fill';
    powerBarFill.style.width = '0%';
    powerBarFill.style.height = '100%';
    powerBarFill.style.borderRadius = '5px';
    powerBarFill.style.backgroundColor = '#ff3333'; // Default red
    powerBarContainer.appendChild(powerBarFill);
    
    // Store references
    this.chargeUI = {
      container: powerBarContainer,
      fill: powerBarFill
    };
    
    // Create ammo indicator
    const ammoIndicator = document.createElement('div');
    ammoIndicator.id = 'ammo-indicator';
    ammoIndicator.style.position = 'absolute';
    ammoIndicator.style.bottom = '20px';
    ammoIndicator.style.right = '20px';
    ammoIndicator.style.padding = '5px 10px';
    ammoIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    ammoIndicator.style.color = 'white';
    ammoIndicator.style.fontFamily = 'Arial, sans-serif';
    ammoIndicator.style.fontSize = '16px';
    ammoIndicator.style.borderRadius = '5px';
    document.body.appendChild(ammoIndicator);
    
    // Store reference
    this.ammoUI = ammoIndicator;
    
    // Update ammo display initially
    this._updateAmmoDisplay();
  }

  /**
   * Setup right-click handler for ammo switching
   * @private
   */
  _setupRightClickHandler() {
    // This function gets called for ANY right-click, regardless of pointer lock
    const handleRightClick = (event) => {
      if (event.button === 2) { // Right mouse button
        event.preventDefault();
        event.stopPropagation();
        
        console.log("[WeaponSystem] Right-click detected, cycling ammo");
        this.cycleAmmoType();
        return false;
      }
    };

    // Also handle the 'c' key as a keyboard alternative
    const handleKeyDown = (event) => {
      if (event.key === 'c' || event.key === 'C') {
        console.log("[WeaponSystem] C key pressed, cycling ammo");
        this.cycleAmmoType();
      }
    };

    // Add the event listeners directly without pointer lock check
    document.addEventListener('mousedown', handleRightClick, true);
    document.addEventListener('keydown', handleKeyDown, false);
    
    // Prevent default context menu always
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    }, false);
  }

  /**
   * Start charging the current weapon
   * @returns {boolean} Success
   */
  startCharging() {
    // *** Check ammo for the CURRENTLY SELECTED type ***
    if (!this.ammo || this.ammo[this.currentAmmoType] <= 0) {
      console.log(`[WeaponSystem] No ammo available for ${this.currentAmmoType}`);
      this._playSound('empty', 0.6); // Play empty sound
      this.isCharging = false; // Ensure charging stops if no ammo
      this.chargeState = null;
      this._updateModelAnimation('idle'); // Ensure model is idle
      return false; // <<< IMPORTANT: Return false if no ammo
    }
    // *** End ammo check ***

    // Only start if not already charging
    if (this.isCharging) return false;

    this.isCharging = true;
    this.chargeStartTime = Date.now();
    // *** Initialize chargeState with current ammo type ***
    this.chargeState = {
        power: 0,
        elapsed: 0,
        ammoType: this.currentAmmoType // Store the type being charged
    };
    // *** End initialize chargeState ***

    console.log(`[WeaponSystem] Charging ${this.currentAmmoType} weapon`);
    this._updateModelAnimation('charge'); // Trigger charge animation

    // Show charge UI if successful
    if (this.isCharging) {
      this._updateChargeUI(0); // Start at 0% charge
      this.chargeUI.container.style.display = 'block'; // Show the UI
      this.chargeUI.fill.style.backgroundColor = this._getAmmoColor(this.chargeState.ammoType);
    }

    return true;
  }

  /**
   * Get color for ammo type
   * @param {string} ammoType - The ammo type
   * @returns {string} - CSS color string
   * @private
   */
  _getAmmoColor(ammoType) {
    const colors = {
      red: '#ff3333',
      yellow: '#ffff33',
      green: '#33ff33'
    };
    return colors[ammoType] || colors.red;
  }

  /**
   * Cancel weapon charging (e.g. when mouse leaves window)
   */
  cancelCharge() {
    if (this.isCharging) {
      this.isCharging = false;
      this.chargeState = null; // Clear charge state
      this._updateModelAnimation('idle'); // Reset animation
      
      // Hide charge UI
      this.chargeUI.container.style.display = 'none';
      
      console.log("Weapon charge canceled");
    }
  }

  /**
   * Update the charge UI
   * @param {number} power - Charge power (0-1)
   * @private
   */
  _updateChargeUI(power) {
    if (!this.chargeUI) return;
    
    // Update the fill width
    const percent = Math.min(100, Math.max(0, power * 100));
    this.chargeUI.fill.style.width = `${percent}%`;
  }

  /**
   * Update ammo display
   * @private
   */
  _updateAmmoDisplay() {
    if (!this.ammoUI) return;
    
    // Format ammo counts with current type highlighted
    const red = this.ammo.red || 0;
    const yellow = this.ammo.yellow || 0;
    const green = this.ammo.green || 0;
    
    // Highlight current type
    const current = this.currentAmmoType;
    
    let html = '';
    html += `<span style="${current === 'red' ? 'color: #ff3333; font-weight: bold;' : ''}">Red: ${red}</span> | `;
    html += `<span style="${current === 'yellow' ? 'color: #ffff33; font-weight: bold;' : ''}">Yellow: ${yellow}</span> | `;
    html += `<span style="${current === 'green' ? 'color: #33ff33; font-weight: bold;' : ''}">Green: ${green}</span>`;
    
    this.ammoUI.innerHTML = html;
  }

  /**
   * Get current charge state
   * @returns {Object} Charge information
   */
  getChargeState() {
    if (!this.isCharging || !this.chargeState) return null;

    const elapsed = (Date.now() - this.chargeStartTime) / 1000;
    const power = Math.min(elapsed / this.options.chargeTime, 1.0);

    // Update the existing chargeState object
    this.chargeState.power = power;
    this.chargeState.elapsed = elapsed;
    // ammoType remains as it was when charging started

    // Update charge UI with current power
    this._updateChargeUI(power);

    return this.chargeState;
  }

  /**
   * Release the weapon (called by Player)
   * @returns {Object|null} Info about the charge state or null if failed
   */
  release() {
    // Calculate charge state *before* checking
    if (this.isCharging) {
        this.getChargeState(); // Update this.chargeState
    }

    console.log("[WeaponSystem] release() called", {
        isCharging: this.isCharging,
        chargeStateExists: !!this.chargeState,
        chargeStateValue: this.chargeState,
        currentSelectedAmmo: this.currentAmmoType, // Log selected type
        playerAmmo: this.ammo // Log player's ammo object reference
    });

    if (!this.isCharging || !this.chargeState) {
      console.log("[WeaponSystem] release() failed: Not charging or chargeState missing.");
      // Ensure state is reset even if release is called unexpectedly
      this.isCharging = false;
      this.chargeState = null;
      this._updateModelAnimation('idle');
      return null; // Not charging or no charge state
    }

    // Get data from the charge state established at startCharging
    const power = this.chargeState.power;
    const ammoType = this.chargeState.ammoType; // Type determined when charging started
    const canFire = this.ammo && this.ammo[ammoType] > 0; // Check ammo *now*

    console.log("[WeaponSystem] release() state:", {
        power: power,
        ammoType: ammoType, // The type that was charged
        ammoAvailable: this.ammo ? this.ammo[ammoType] : 'N/A',
        canFire: canFire
    });

    // Reset charging state regardless of whether we can fire
    this.isCharging = false;
    this.chargeState = null; // Clear state after use
    this._updateModelAnimation('idle');

    // Hide charge UI
    this.chargeUI.container.style.display = 'none';

    if (canFire) {
      this._playSound('fire', 0.8 + power * 0.2);
      console.log(`[WeaponSystem] release() successful: Charged ${ammoType} with power ${power}.`);
      // Return firing info (projectile creation happens in Player class)
      return {
        canFire: true,
        power: power,
        ammoType: ammoType // Return the type that was charged
      };
    } else {
      this._playSound('empty', 0.6);
      console.log(`[WeaponSystem] release() failed: No ammo for charged type ${ammoType} at time of release.`);
      return {
        canFire: false,
        power: power, // Still return power/type even if no ammo
        ammoType: ammoType
      };
    }
  }

  /**
   * Switch to the next available ammo type
   * @returns {string} The new ammo type selected
   */
  cycleAmmoType() {
    if (!this.availableAmmoTypes || this.availableAmmoTypes.length === 0) return this.currentAmmoType;

    // Adding logging to track ammo switching
    console.log(`[WeaponSystem] cycleAmmoType - current type: ${this.currentAmmoType}`);

    const currentIndex = this.availableAmmoTypes.indexOf(this.currentAmmoType);
    if (currentIndex === -1) { // Should not happen if initialized correctly
        this.currentAmmoType = this.availableAmmoTypes[0];
    } else {
        const nextIndex = (currentIndex + 1) % this.availableAmmoTypes.length;
        this.currentAmmoType = this.availableAmmoTypes[nextIndex];
    }

    console.log(`[WeaponSystem] Switched ammo type to: ${this.currentAmmoType}`);
    
    // Update the ammo display
    this._updateAmmoDisplay();
    
    // If charging, cancel it when switching ammo
    if (this.isCharging) {
        this.cancelCharge();
    }
    
    // Update the visual model immediately, even when not charging
    this.updateModel();
    
    // No longer showing central notification - removed _showAmmoSwitchNotification call
    
    return this.currentAmmoType;
  }

  /**
   * Show visual notification when ammo type changes
   * @param {string} type - The ammo type switched to
   * @private - This method is no longer used
   */
  _showAmmoSwitchNotification(type) {
    // Method body intentionally empty - we're no longer using central notifications
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

    // Update charge state if charging
    if (this.isCharging) {
      this.getChargeState();
    }

    // Update weapon model (handles charge animation)
    this.updateModel(deltaTime);

    // Update TWEEN for animations if used
    if (TWEEN) TWEEN.update();
  }

  /**
   * Get the weapon's current state
   * @returns {Object} Current state of the weapon including ammo, charge, etc.
   */
  getWeaponState() {
    // Update charge state if we're charging
    const chargeState = this.isCharging ? this.getChargeState() : null;

    return {
      // *** Return currentAmmoType instead of currentWeapon ***
      currentAmmoType: this.currentAmmoType,
      // *** End Return ***
      isCharging: this.isCharging,
      chargeState: chargeState, // Contains power, elapsed, and ammoType
      // *** Return the reference to player's ammo ***
      ammo: this.ammo
      // *** End Return ***
    };
  }

  /**
   * Set up the visual weapon model that appears in the player's view
   * @param {THREE.Camera} camera - The camera to attach the model to
   */
  setupModel(camera) {
    if (!camera) return;

    if (this.weaponModel) camera.remove(this.weaponModel);

    this.weaponModel = new THREE.Group();
    // ... (slingshot handle/fork geometry - unchanged) ...
    const handleGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.6, 6);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, -0.3, 0);
    this.weaponModel.add(handle);
    const forkGeometry = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6);
    const forkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const leftFork = new THREE.Mesh(forkGeometry, forkMaterial);
    leftFork.position.set(-0.12, 0, 0);
    leftFork.rotation.z = Math.PI / 7;
    this.weaponModel.add(leftFork);
    const rightFork = new THREE.Mesh(forkGeometry, forkMaterial);
    rightFork.position.set(0.12, 0, 0);
    rightFork.rotation.z = -Math.PI / 7;
    this.weaponModel.add(rightFork);
    // ... (band setup - unchanged) ...
    const tubeDiameter = 0.01;
    const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
    this.leftTubeBand = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1)), 5, tubeDiameter, 6, false), tubeMaterial);
    this.weaponModel.add(this.leftTubeBand);
    this.rightTubeBand = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1)), 5, tubeDiameter, 6, false), tubeMaterial);
    this.weaponModel.add(this.rightTubeBand);
    this.leftForkTip = new THREE.Vector3(-0.12, 0.175, -0.05);
    this.rightForkTip = new THREE.Vector3(0.12, 0.175, -0.05);
    this.pocketPosition = new THREE.Vector3(0, 0, 0.15);
    this._updateBands(this.pocketPosition);


    // *** Create and store models for each ammo type ***
    this.projectileModels = {
      red: this._createRedAppleModel(),
      yellow: this._createYellowAppleModel(),
      green: this._createGreenAppleModel()
    };
    // *** End create models ***

    // Projectile is hidden initially
    this.activeProjectileModel = null;

    // ... (positioning and adding model to camera - unchanged) ...
    this.weaponModel.position.set(0.25, -0.3, -0.7);
    this.weaponModel.rotation.set(0, Math.PI * 0.05, -Math.PI * 0.08);
    camera.add(this.weaponModel);
    this.initialWeaponPosition = this.weaponModel.position.clone();
    this.initialWeaponRotation = this.weaponModel.rotation.clone();

    console.log("Slingshot model created with multi-ammo projectile placeholders.");
  }

  /** Create a model for a regular red apple */
  _createRedAppleModel() {
    const appleGroup = new THREE.Group();
    const appleGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const appleMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xff2200,
      emissive: new THREE.Color(0xff2200).multiplyScalar(0.3) // Add emissive to match other apples
    });
    const apple = new THREE.Mesh(appleGeometry, appleMaterial);
    appleGroup.add(apple);
    const stemGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 4);
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0, 0.08, 0);
    appleGroup.add(stem);
    
    // ADDED: Create glow effect for red apple (same as yellow and green apples)
    const glowGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff4400, // Reddish glow
      transparent: true, 
      opacity: 0.2, 
      side: THREE.BackSide 
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    appleGroup.add(glow);
    
    appleGroup.visible = false; // Start hidden
    return appleGroup;
  }

  /** Create a model for a yellow apple */
  _createYellowAppleModel() {
    const appleGroup = new THREE.Group();
    const appleGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const appleMaterial = new THREE.MeshLambertMaterial({ color: 0xffdd00, emissive: 0x443300 });
    const apple = new THREE.Mesh(appleGeometry, appleMaterial);
    appleGroup.add(apple);
    const stemGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 4);
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0, 0.08, 0);
    appleGroup.add(stem);
    // Add subtle glow
    const glowGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.15, side: THREE.BackSide });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    appleGroup.add(glow);
    appleGroup.visible = false; // Start hidden
    return appleGroup;
  }

  /** Create a model for a green apple */
  _createGreenAppleModel() {
    const appleGroup = new THREE.Group();
    const appleGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const appleMaterial = new THREE.MeshLambertMaterial({ color: 0x33ff33, emissive: 0x114411 });
    const apple = new THREE.Mesh(appleGeometry, appleMaterial);
    appleGroup.add(apple);
    const stemGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 4);
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0, 0.08, 0);
    appleGroup.add(stem);
     // Add subtle glow
    const glowGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x88ff88, transparent: true, opacity: 0.2, side: THREE.BackSide });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    appleGroup.add(glow);
    appleGroup.visible = false; // Start hidden
    return appleGroup;
  }

  /** Update elastic bands */
  _updateBands(pocketPos) {
    // ... (band update logic - unchanged) ...
    if (this.leftTubeBand.geometry) this.leftTubeBand.geometry.dispose();
    const leftCurve = new THREE.LineCurve3(this.leftForkTip.clone(), pocketPos.clone());
    this.leftTubeBand.geometry = new THREE.TubeGeometry(leftCurve, 5, 0.01, 6, false);
    if (this.rightTubeBand.geometry) this.rightTubeBand.geometry.dispose();
    const rightCurve = new THREE.LineCurve3(this.rightForkTip.clone(), pocketPos.clone());
    this.rightTubeBand.geometry = new THREE.TubeGeometry(rightCurve, 5, 0.01, 6, false);
  }

  /** Remove the slingshot model */
  removeModel() {
    if (this.weaponModel && this.camera) {
      this.camera.remove(this.weaponModel);
      this.weaponModel = null;
    }
  }

  /** Update the weapon model based on current state */
  updateModel(deltaTime) {
    if (!this.weaponModel) return;

    // Handle charging animation
    if (this.isCharging && this.chargeState) {
      const charge = this.chargeState.power;
      const pullBackDistance = 0.3 * charge;
      const pocketPosition = new THREE.Vector3(0, 0, 0.15 + pullBackDistance);
      this._updateBands(pocketPosition);

      // *** Show the correct projectile model based on chargeState ***
      const ammoType = this.chargeState.ammoType;
      const modelToShow = this.projectileModels[ammoType];

      // Switch model if necessary or if none is active
      if (modelToShow && this.activeProjectileModel !== modelToShow) {
          // Hide previous model if there was one
          if (this.activeProjectileModel) {
              this.activeProjectileModel.visible = false;
              this.weaponModel.remove(this.activeProjectileModel); // Remove from group
          }
          // Add and show the new model
          this.activeProjectileModel = modelToShow;
          this.weaponModel.add(this.activeProjectileModel); // Add to group
          this.activeProjectileModel.visible = true;
      }

      // Move the active projectile model with the pocket
      if (this.activeProjectileModel) {
        this.activeProjectileModel.position.copy(pocketPosition);
      }
      // *** End show correct model ***

    } else {
      // Not charging: Return bands to original position
      const restingPocketPos = new THREE.Vector3(0, 0, 0.15);
      this._updateBands(restingPocketPos);

      // Show the current ammo type model at rest position when not charging
      // This ensures the correct model is shown even when just switching types
      const modelToShow = this.projectileModels[this.currentAmmoType];
      
      // FIXED: Only show model if we have ammo of this type available
      if (modelToShow && this.ammo && this.ammo[this.currentAmmoType] > 0) {
        // Switch model if necessary or if none is active
        if (this.activeProjectileModel !== modelToShow) {
          // Hide previous model if there was one
          if (this.activeProjectileModel) {
            this.activeProjectileModel.visible = false;
            this.weaponModel.remove(this.activeProjectileModel); // Remove from group
          }
          // Add and show the new model
          this.activeProjectileModel = modelToShow;
          this.weaponModel.add(this.activeProjectileModel); // Add to group
          this.activeProjectileModel.visible = true;
          
          // Position at pocket
          this.activeProjectileModel.position.copy(restingPocketPos);
        }
      } else {
        // Hide the active projectile model if it's visible or if we're out of ammo
        if (this.activeProjectileModel) {
          this.activeProjectileModel.visible = false;
          // Don't remove from group here, just hide. It will be removed/swapped if charging starts again.
        }
      }
    }

    // ... idle animation ... 
    const time = Date.now() / 1000;
    const idleAmount = Math.sin(time * 2) * 0.01;
    this.weaponModel.position.y = this.initialWeaponPosition.y + idleAmount;
    this.weaponModel.rotation.x = this.initialWeaponRotation.x + idleAmount * 0.1;
  }

  /** Provide a method for the Player class to provide itself as a reference */
  setPlayer(player) {
    this.player = player;
    // *** Update ammo reference if player is set later ***
    if (player && player.ammo) {
        this.ammo = player.ammo;
    }
    // *** End update ammo reference ***
  }

  // --- Placeholder methods for sounds/animations ---
  _updateModelAnimation(state) { /* Placeholder */ }
  _playSound(soundName, volume = 1.0) {
    if (window.game && window.game.audio) {
        window.game.audio.playSound(soundName, volume);
    }
  }
  // --- End Placeholders ---
}
