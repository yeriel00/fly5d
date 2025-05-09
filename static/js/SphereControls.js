import * as THREE from 'three';

export default class SphereControls {
  constructor(camera, domElement, options = {}) {
    this.camera = camera;
    this.domElement = domElement || document;

    // sphere params
    this.radius = options.sphereRadius || 50;
    this.getTerrainHeight = options.getTerrainHeight || (() => 0);
    this.moveSpeed = options.moveSpeed || 32.0;
    this.lookSpeed = options.lookSpeed || 0.002;
    this.pitchLimit = Math.PI / 2 - 0.1;
    this.collidables = options.collidables || [];
    this.playerRadius = options.playerRadius || 1.0;
    
    // Add new fixed offset above terrain (player "foot" level)
    this.playerHeightOffset = options.playerHeightOffset || 0.35;
    this.cameraHeight = options.eyeHeight || 6.6;

    // Define default options
    const defaultOptions = {
      canWavedash: true,
      wavedashBoostFactor: 45.0,
      wavedashFastFallSpeed: 100.0,
      crouchHeight: 0.5,
      crouchSpeedMultiplier: 0.7,
      crouchTransitionTime: 0.2,
      getSpeedMultiplier: () => 1.0,
      // Include other options that might be managed via this.options if any
      // For now, these match the keys from the original Object.assign structure
    };

    // Initialize this.options by merging defaults with provided options
    // Options passed to the constructor will override defaults.
    this.options = { ...defaultOptions, ...options };

    // Validate and sanitize critical numeric options in this.options
    // Wavedash options
    if (typeof this.options.wavedashFastFallSpeed !== 'number' || isNaN(this.options.wavedashFastFallSpeed) || this.options.wavedashFastFallSpeed <= 0) {
      // console.warn(`SphereControls: Correcting invalid wavedashFastFallSpeed. Was: ${this.options.wavedashFastFallSpeed}, Defaulting to: ${defaultOptions.wavedashFastFallSpeed}`);
      this.options.wavedashFastFallSpeed = defaultOptions.wavedashFastFallSpeed;
    }
    if (typeof this.options.wavedashBoostFactor !== 'number' || isNaN(this.options.wavedashBoostFactor) || this.options.wavedashBoostFactor <= 0) {
      // console.warn(`SphereControls: Correcting invalid wavedashBoostFactor. Was: ${this.options.wavedashBoostFactor}, Defaulting to: ${defaultOptions.wavedashBoostFactor}`);
      this.options.wavedashBoostFactor = defaultOptions.wavedashBoostFactor;
    }
    // Crouch options
    if (typeof this.options.crouchHeight !== 'number' || isNaN(this.options.crouchHeight) || this.options.crouchHeight <= 0 || this.options.crouchHeight >= 1) {
      // console.warn(`SphereControls: Correcting invalid crouchHeight. Was: ${this.options.crouchHeight}, Defaulting to: ${defaultOptions.crouchHeight}`);
      this.options.crouchHeight = defaultOptions.crouchHeight;
    }
    if (typeof this.options.crouchSpeedMultiplier !== 'number' || isNaN(this.options.crouchSpeedMultiplier) || this.options.crouchSpeedMultiplier <= 0 || this.options.crouchSpeedMultiplier > 1) {
      // console.warn(`SphereControls: Correcting invalid crouchSpeedMultiplier. Was: ${this.options.crouchSpeedMultiplier}, Defaulting to: ${defaultOptions.crouchSpeedMultiplier}`);
      this.options.crouchSpeedMultiplier = defaultOptions.crouchSpeedMultiplier;
    }
    if (typeof this.options.crouchTransitionTime !== 'number' || isNaN(this.options.crouchTransitionTime) || this.options.crouchTransitionTime < 0) {
      // console.warn(`SphereControls: Correcting invalid crouchTransitionTime. Was: ${this.options.crouchTransitionTime}, Defaulting to: ${defaultOptions.crouchTransitionTime}`);
      this.options.crouchTransitionTime = defaultOptions.crouchTransitionTime;
    }
    // Boolean option
    if (typeof this.options.canWavedash !== 'boolean') {
        // console.warn(`SphereControls: Correcting invalid canWavedash. Was: ${this.options.canWavedash}, Defaulting to: ${defaultOptions.canWavedash}`);
        this.options.canWavedash = defaultOptions.canWavedash;
    }
    // Ensure getSpeedMultiplier is a function
    if (typeof this.options.getSpeedMultiplier !== 'function') {
        // console.warn(`SphereControls: Correcting invalid getSpeedMultiplier. Defaulting.`);
        this.options.getSpeedMultiplier = defaultOptions.getSpeedMultiplier;
    }

    // build yaw->pitch->camera hierarchy
    this.yawObject = new THREE.Object3D();
    this.pitchObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);
    this.pitchObject.add(camera);
    camera.position.set(0, options.eyeHeight || 6.6, 0);

    // Allow for custom start position direction
    const startDir = options.startPosition || new THREE.Vector3(0, 1, 0).normalize();
    
    // Calculate terrain height at start position
    const startTerrainHeight = this.getTerrainHeight(startDir);
    
    // FIXED: Use much higher elevation to ensure we start outside the planet
    const startElevation = options.startElevation || 20;
    
    // FIXED: Ensure we use the correct radius (this.radius) and add sufficient elevation
    const startPos = startDir.clone().multiplyScalar(
      this.radius + startTerrainHeight + startElevation
    );
    
    console.log(`Starting at position: ${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)}`);
    console.log(`Height above terrain: ${startElevation}`);
    
    // Initialize position and orientation
    this.yawObject.position.copy(startPos);
    this.yawObject.up.copy(startPos.clone().normalize());
    
    // Aim along tangent
    const forward0 = new THREE.Vector3(0,0,-1)
      .projectOnPlane(startPos.clone().normalize())
      .normalize();
    this.yawObject.lookAt(startPos.clone().add(forward0));

    // input state
    this.keys = {}; // Initialize as an empty object for general key states
    this.pitch = 0;
    this.shiftProcessedKeyDown = false; // For Shift key single press vs. hold logic

    // bind
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLock = this.onPointerLock.bind(this);

    // listeners
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    this.domElement.addEventListener('click', ()=> this.domElement.requestPointerLock());

    // Physics state
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.onGround = false;
    this.sliding = false;
    this.currentSurface = null;
    
    // Physics settings
    this.slideAngleThreshold = 0.7071;
    this.slideAcceleration = 0.08;
    this.slideFriction = 0.96;

    // Physics parameters
    this.jumpStrength = options.jumpStrength || 4.5;
    this.gravity = Math.abs(options.gravity || 0.2);
    this.jumpEnabled = true;
    this.isJumping = false;
    this.onGround = true;
    
    // MODIFIED: Set maxJumps to 2 for double jump mechanic
    this.maxJumps = options.maxJumps || 2; // Initial jump + one mid-air jump
    this.jumpsRemaining = this.maxJumps;
    this.jumpCooldown = 0;

    // Movement physics parameters
    this.airControlFactor = options.airControlFactor || 0.3;
    this.maxGroundSpeed = options.maxGroundSpeed || 40.0;
    this.maxAirSpeed = options.maxAirSpeed || 45.0;
    this.groundFriction = options.groundFriction || 0.92;
    this.airFriction = options.airFriction || 0.998;

    // Progressive gravity parameters
    this.maxGravityMultiplier = 2.0;
    this.gravityRampTime = 0.8;
    this.airTime = 0;
    
    // REMOVED: Height safety limits
    // this.maxHeightAboveGround = 45;

    // Wavedash state
    this.isWavedashing = false;

    // Add crouch state properties
    this.isCrouching = false;
    this.crouchToggled = false; // For toggle vs hold mode
    this.crouchAmount = 0; // 0 = standing, 1 = fully crouched (for smooth transitions)
    this.crouchTransition = null; // Store transition animation
    this.lastCrouchTime = 0; // For double-tap detection

    // Store initial camera positions for correct crouching
    this.originalCameraY = options.eyeHeight || 6.6;
    this.cameraHeight = this.originalCameraY;
  }

  startWavedash() {
    if (this.options.canWavedash && !this.onGround && !this.isWavedashing) {
      this.isWavedashing = true;
      // console.log("SphereControls: Wavedash started");
    }
  }

  cancelWavedash() {
    if (this.isWavedashing) {
      this.isWavedashing = false;
      // console.log("SphereControls: Wavedash cancelled");
    }
  }

  getObject() {
    return this.yawObject;
  }

  onPointerLock() {
    if (document.pointerLockElement === this.domElement) {
      document.addEventListener('mousemove', this.onMouseMove);
    } else {
      document.removeEventListener('mousemove', this.onMouseMove);
    }
  }

  onMouseMove(e) {
    const up = this.yawObject.position.clone().normalize();
    // yaw
    const yawQ = new THREE.Quaternion()
      .setFromAxisAngle(up, -e.movementX * this.lookSpeed);
    this.yawObject.quaternion.premultiply(yawQ);

    // pitch
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - e.movementY * this.lookSpeed,
      -this.pitchLimit, this.pitchLimit
    );
    this.pitchObject.rotation.x = this.pitch;
  }

  onKeyDown(e) { 
    const key = e.key.toLowerCase();
    this.keys[key] = true; 
    
    if (key === ' ' || key === 'spacebar') {
      console.log("SPACEBAR PRESSED - jumpEnabled:", this.jumpEnabled, 
                "jumpsRemaining:", this.jumpsRemaining, 
                "jumpCooldown:", this.jumpCooldown.toFixed(3),
                "onGround:", this.onGround);
      
      // MODIFIED: Check jumpsRemaining to allow double jump but not unlimited jumps
      if (this.jumpEnabled && this.jumpsRemaining > 0 && this.jumpCooldown <= 0) {
        console.log("JUMP STARTING");
        
        // If currently wavedashing, cancel it by jumping
        if (this.isWavedashing) {
          this.cancelWavedash();
        }

        // Get local up direction
        const upDir = this.yawObject.position.clone().normalize();
        
        // Apply jump impulse along up vector (radial direction)
        const jumpForce = this.jumpStrength * 7.5;
        const jumpVelocity = upDir.clone().multiplyScalar(jumpForce);
        
        // Save horizontal velocity before jump
        const horizontalVel = this.velocity.clone().projectOnPlane(upDir);
        const horizontalSpeed = horizontalVel.length();
        
        // Simple velocity handling - reset vertical component
        // Remove only vertical component, keep horizontal movement
        const verticalComponent = upDir.clone().multiplyScalar(this.velocity.dot(upDir));
        this.velocity.sub(verticalComponent);
        
        // Add jump force
        this.velocity.add(jumpVelocity);
        
        // MODIFIED: Actually decrement jumpsRemaining for proper double jump tracking
        this.jumpsRemaining--;
        
        // Update jump state
        this.isJumping = true;
        this.onGround = false;
        
        // Very small cooldown to prevent accidental double-trigger
        this.jumpCooldown = 0.08;
        
        // Reset air time for gravity calculation
        this.airTime = 0;
        
        // Add visual feedback based on whether this is a double jump
        const isDoubleJump = !this.onGround && this.jumpsRemaining === 0;
        
        console.log(`Jump completed with force: ${jumpForce.toFixed(1)}, 
                    velocity: ${this.velocity.length().toFixed(1)}, 
                    jumps remaining: ${this.jumpsRemaining}, 
                    double jump: ${isDoubleJump}`);
      } else {
        console.log("Jump prevented - remaining jumps:", this.jumpsRemaining, "cooldown:", this.jumpCooldown.toFixed(3));
      }
    }

    // Crouch and Wavedash initiation (Shift or S)
    if (key === 'shift' && (e.code === 'ShiftLeft' || e.keyCode === 16)) {
      if (!this.shiftProcessedKeyDown) {
        this.shiftProcessedKeyDown = true;
        const now = Date.now();
        if (now - this.lastCrouchTime < 300) { // Double-tap Shift
          this.toggleCrouch();
        } else { // Single-tap Shift
          if (!this.crouchToggled) { // If in hold-to-crouch mode
            this.startCrouch();
          }
        }
        this.lastCrouchTime = now; // Record time of this shift press for next double-tap check
      }
    } else if (key === 's') {
      if (!this.onGround && this.options.canWavedash && !this.isWavedashing) {
        this.startWavedash(this.options.wavedashFastFallSpeed);
      }
    }
  }
  
  onKeyUp(e) { 
    const key = e.key.toLowerCase();
    this.keys[key] = false;
    
    // On spacebar release, reset cooldown completely
    if ((key === ' ' || key === 'spacebar') && this.jumpCooldown > 0) {
      this.jumpCooldown = 0;
      console.log("Jump cooldown reset on key release");
    }

    // Crouch and Wavedash cancellation (Shift or S)
    if (key === 'shift' && (e.code === 'ShiftLeft' || e.keyCode === 16)) {
      this.shiftProcessedKeyDown = false; // Reset for the next press
      if (!this.crouchToggled) { // If in hold-to-crouch mode
        this.stopCrouch();
      }
    } else if (key === 's') {
      if (this.isWavedashing) {
        this.cancelWavedash();
      }
    }
  }

  update(deltaTime) {
    // Safety check - limit maximum delta time to prevent large jumps
    const dt = Math.min(deltaTime, 0.1);
    
    const playerObj = this.yawObject;
    const playerUp = playerObj.position.clone().normalize();
    
    // *** SAFETY CHECK: Prevent falling below terrain ***
    const pos = this.yawObject.position;
    const dir = pos.clone().normalize();
    const terrainHeight = this.getTerrainHeight(dir);
    const terrainRadius = this.radius + terrainHeight;
    
    if (pos.length() < terrainRadius + this.playerHeightOffset * 0.5) {
      // We're below terrain - correct position
      const safeHeight = terrainRadius + this.playerHeightOffset;
      this.yawObject.position.copy(dir.multiplyScalar(safeHeight));
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.isJumping = false;
      this.jumpsRemaining = this.maxJumps;
    }
    
    // REMOVED: Height safety check and teleporting function
    // No longer limiting maximum height above ground

    // Progressive gravity when not on ground
    if (!this.onGround) {
      this.airTime += dt;
      
      // Calculate gravity multiplier based on time in air
      const gravityMultiplier = Math.min(
        this.maxGravityMultiplier, 
        1.0 + (this.airTime / this.gravityRampTime) * (this.maxGravityMultiplier - 1.0)
      );
      
      // Create gravity vector pointing to planet center
      const gravityVector = playerUp.clone().negate();
      
      // Apply gravity force with progressive multiplier
      this.velocity.addScaledVector(gravityVector, this.gravity * gravityMultiplier * dt * 60);
    } else {
      this.airTime = 0;
    }

    // Process keyboard input
    const moveDir = new THREE.Vector3(0, 0, 0);
    
    if (this.keys['w']) moveDir.z -= 1;
    if (this.keys['s']) moveDir.z += 1;
    if (this.keys['d']) moveDir.x += 1;
    if (this.keys['a']) moveDir.x -= 1;
    
    if (moveDir.length() > 0) {
      moveDir.normalize();
    }
    
    // Create movement direction and basis vectors
    let worldMoveDir = null;
    
    if (moveDir.length() > 0) {
      // Create player basis with y along the up direction
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(this.yawObject.quaternion);
      forward.sub(playerUp.clone().multiplyScalar(forward.dot(playerUp)));
      forward.normalize();
      
      // Create right vector from up and forward
      const right = new THREE.Vector3().crossVectors(forward, playerUp).normalize();
      
      // World space movement direction
      worldMoveDir = new THREE.Vector3(0, 0, 0);
      if (moveDir.x !== 0) worldMoveDir.addScaledVector(right, moveDir.x);
      if (moveDir.z !== 0) worldMoveDir.addScaledVector(forward, -moveDir.z);
    }
    
    // Apply movement forces
    const speedMultiplier = this.options.getSpeedMultiplier();
    const effectiveMoveSpeed = this.options.moveSpeed * speedMultiplier;
    const effectiveMaxGroundSpeed = this.options.maxGroundSpeed * speedMultiplier;
    const effectiveMaxAirSpeed = this.options.maxAirSpeed * speedMultiplier;

    if (worldMoveDir) {
      if (this.onGround) {
        // Direct control on ground
        const groundControl = worldMoveDir.clone().multiplyScalar(effectiveMoveSpeed * 2.0);
        
        // Split velocity into horizontal and vertical components
        const upDir = playerUp.clone();
        const horizontalVel = this.velocity.clone().projectOnPlane(upDir);
        const verticalVel = upDir.multiplyScalar(this.velocity.dot(upDir));
        
        // Apply ground movement
        const newHorizontal = groundControl.multiplyScalar(0.9).add(horizontalVel.multiplyScalar(0.1));
        this.velocity.copy(newHorizontal).add(verticalVel);
      } else {
        // Limited air control that doesn't add extra height
        const upDir = playerUp.clone();
        const verticalComponent = upDir.clone().multiplyScalar(this.velocity.dot(upDir));
        const horizontalVel = this.velocity.clone().projectOnPlane(upDir);
        
        // Apply gentle steering force in air
        const steeringForce = worldMoveDir.clone().normalize().multiplyScalar(this.airControlFactor * dt * 15);
        horizontalVel.add(steeringForce);
        
        // Limit horizontal speed
        if (horizontalVel.length() > effectiveMaxAirSpeed) {
          horizontalVel.normalize().multiplyScalar(effectiveMaxAirSpeed);
        }
        
        // Recombine without affecting vertical velocity
        this.velocity.copy(horizontalVel).add(verticalComponent);
      }
    } else if (this.onGround) {
      // Apply ground friction when not actively moving
      this.velocity.multiplyScalar(this.groundFriction);
    } else {
      // Apply lighter air friction unless wavedashing (wavedash handles its own velocity)
      if (!this.isWavedashing) {
        this.velocity.multiplyScalar(this.airFriction);
      }
    }

    // Wavedash fast fall logic
    if (this.isWavedashing && !this.onGround) {
      const playerUp = this.yawObject.position.clone().normalize();
      const horizontalVel = this.velocity.clone().projectOnPlane(playerUp);
      const fastFallVerticalVelocity = playerUp.clone().negate().multiplyScalar(this.options.wavedashFastFallSpeed);
      
      this.velocity.copy(horizontalVel).add(fastFallVerticalVelocity);
  
      // Optional: Cap wavedash speed to prevent extreme velocities if needed
      // const maxWavedashSpeed = 100; 
      // if (this.velocity.lengthSq() > maxWavedashSpeed * maxWavedashSpeed) {
      //   this.velocity.normalize().multiplyScalar(maxWavedashSpeed);
      // }
    }
    
    // Apply velocity to position
    const velocityDelta = this.velocity.clone().multiplyScalar(dt);
    
    // REMOVED: Velocity capping
    // No longer limiting maximum velocity
    
    playerObj.position.add(velocityDelta);
    
    // Skip ground check briefly after jumping to ensure player leaves ground
    const MIN_GUARANTEED_AIR_TIME = 0.12; // Slightly shorter guaranteed air time
    if (this.isJumping && this.airTime < MIN_GUARANTEED_AIR_TIME) {
      // Only align up direction
      this._alignUpToPlanet();
    } else {
      // Perform ground contact detection
      this._checkGroundContact(dt);
      
      // Align to terrain or planet
      if (this.onGround) {
        this._alignToTerrain();
      } else {
        this._alignUpToPlanet();
      }
    }
    
    // Check collisions with objects
    this._checkCollisions();
    
    // Update jump cooldown
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= dt;
      if (this.jumpCooldown < 0.01) {
        this.jumpCooldown = 0;
      }
    }

    // Add this near the end of the update method
    // Update camera based on crouch state
    this._applyCrouchState();
  }

  // Align up direction to planet center
  _alignUpToPlanet() {
    const up = this.yawObject.position.clone().normalize();
    
    // Keep the current forward direction but make it perpendicular to up
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.yawObject.quaternion);
    forward.sub(up.clone().multiplyScalar(forward.dot(up)));
    forward.normalize();
    
    // If forward vector became too small, use a default
    if (forward.lengthSq() < 0.1) {
      forward.set(1, 0, 0).sub(up.clone().multiplyScalar(up.x)).normalize();
    }
    
    // Calculate right from forward and up
    const right = new THREE.Vector3().crossVectors(forward, up);
    
    // Create rotation matrix from orthogonal basis
    const m = new THREE.Matrix4().makeBasis(right, up, forward.clone().negate());
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    
    // Apply orientation
    this.yawObject.quaternion.copy(q);
  }

  // Simple terrain alignment
  _alignToTerrain() {
    const pos = this.yawObject.position;
    const upDir = pos.clone().normalize();
    
    // Get terrain height at current position
    const h0 = this.getTerrainHeight(upDir);
    
    // Update player up direction to match terrain normal
    // In this simplified version, we'll just use the radial direction
    this.yawObject.up.copy(upDir);
    
    // Ensure precise height alignment to terrain
    const targetHeight = this.radius + h0 + this.playerHeightOffset;
    pos.normalize().multiplyScalar(targetHeight);
  }

  // Simplified ground contact detection
  _checkGroundContact(deltaTime) {
    const pos = this.yawObject.position;
    const dir = pos.clone().normalize();
    
    // Get terrain height and calculate distance
    const terrainHeight = this.getTerrainHeight(dir);
    const terrainRadius = this.radius + terrainHeight;
    const distanceToTerrain = pos.length() - terrainRadius;
    
    // Use a small ground threshold
    const groundThreshold = this.playerHeightOffset + 0.05;
    
    if (distanceToTerrain <= groundThreshold) {
      // We're at ground level
      if (!this.onGround) {
        console.log("Ground contact detected - landing, resetting double jump");
        
        // Update state
        this.onGround = true;
        this.isJumping = false;
        
        // IMPORTANT: Reset jumpsRemaining when landing
        this.jumpsRemaining = this.maxJumps;
        
        this.jumpCooldown = 0;
        this.airTime = 0;
        
        // Snap precisely to ground level
        pos.normalize().multiplyScalar(terrainRadius + this.playerHeightOffset);
        
        // Handle velocity for landing
        const upDir = pos.clone().normalize();
        const verticalVel = this.velocity.dot(upDir);
        
        if (verticalVel < 0) {
          // Remove downward component
          this.velocity.addScaledVector(upDir, -verticalVel);
        }

        // Wavedash landing logic
        if (this.isWavedashing && this.options.canWavedash) {
          const playerUp = this.yawObject.position.clone().normalize();
          const moveInput = new THREE.Vector3(0,0,0);

          if (this.keys['w']) moveInput.z -= 1;
          if (this.keys['d']) moveInput.x += 1;
          if (this.keys['a']) moveInput.x -= 1;
          // 's' is checked separately if no other directional keys are pressed

          let boostDir = null;

          if (moveInput.lengthSq() > 0.001) { // W, A, or D are pressed
              moveInput.normalize();
              const forwardVec = new THREE.Vector3(0, 0, -1);
              forwardVec.applyQuaternion(this.yawObject.quaternion);
              forwardVec.sub(playerUp.clone().multiplyScalar(forwardVec.dot(playerUp))).normalize();
              const rightVec = new THREE.Vector3().crossVectors(forwardVec, playerUp).normalize();
              
              boostDir = new THREE.Vector3(0,0,0);
              if (moveInput.x !== 0) boostDir.addScaledVector(rightVec, moveInput.x);
              if (moveInput.z !== 0) boostDir.addScaledVector(forwardVec, -moveInput.z);
              if (boostDir.lengthSq() > 0.001) boostDir.normalize(); else boostDir = null;
          } else if (this.keys['s']) { // Only 'S' (trigger key) is held
              const backwardVec = new THREE.Vector3(0, 0, 1); // Player local +Z
              backwardVec.applyQuaternion(this.yawObject.quaternion);
              backwardVec.sub(playerUp.clone().multiplyScalar(backwardVec.dot(playerUp))).normalize();
              boostDir = backwardVec;
          } else { // Default: No W,A,D,S pressed, boost forward
              const forwardVec = new THREE.Vector3(0, 0, -1);
              forwardVec.applyQuaternion(this.yawObject.quaternion);
              forwardVec.sub(playerUp.clone().multiplyScalar(forwardVec.dot(playerUp))).normalize();
              boostDir = forwardVec;
          }

          if (boostDir && boostDir.lengthSq() > 0.001) {
              const currentVerticalVelocityComponent = playerUp.clone().multiplyScalar(this.velocity.dot(playerUp));
              this.velocity.copy(boostDir).multiplyScalar(this.options.wavedashBoostFactor);
              this.velocity.add(currentVerticalVelocityComponent);
              console.log("Wavedash executed! Boost speed:", this.options.wavedashBoostFactor);
          }
          this.isWavedashing = false;
        } else {
           // Ensure flag is reset if we land normally while it was somehow true
           if(this.isWavedashing) this.isWavedashing = false;
        }

      } else {
        // Already on ground, just maintain exact distance
        pos.normalize().multiplyScalar(terrainRadius + this.playerHeightOffset);
        
        // Cancel any downward velocity
        const upDir = pos.clone().normalize();
        const verticalVel = this.velocity.dot(upDir);
        if (verticalVel < 0) {
          this.velocity.addScaledVector(upDir, -verticalVel);
        }
      }
    } else {
      // We're above ground level
      if (this.onGround) {
        // Detect walking off edges
        if (distanceToTerrain > 0.3) {
          console.log("Lost ground contact - falling");
          this.onGround = false;
        }
      }
    }
  }

  // Simplified collision handling
  _checkCollisions() {
    // Skip if no collidables
    if (!this.collidables || this.collidables.length < 1) return;

    const pos = this.yawObject.position;
    const dir = pos.clone().normalize();

    // Check collisions with objects (trees, rocks, etc.)
    for (let i = 1; i < this.collidables.length; i++) {
      const obj = this.collidables[i];
      
      // Skip invalid objects
      if (!obj.position || !obj.direction || obj.noCollision) continue;
      
      // Get angular distance (great-circle distance on sphere)
      const objDir = obj.direction;
      const dot = dir.dot(objDir);
      const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
      
      // Convert to surface distance
      const surfaceDist = angle * this.radius;
      
      // Get collision radius
      let collisionRadius = this.playerRadius + (obj.radius || 1.0);
      
      // Special case for trees
      if (obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree) {
        // Only collide if at similar height
        const objPos = obj.position.clone();
        const playerHeight = pos.length() - this.radius;
        const objHeight = objPos.length() - this.radius;
        const heightDiff = Math.abs(playerHeight - objHeight);
        
        // Get collision height
        const collisionHeight = obj.collisionHeight || obj.radius * 2;
        
        // Skip if not within height range
        if (heightDiff > collisionHeight) {
          continue;
        }
        
        // Use smaller collision radius for tree trunks
        collisionRadius = this.playerRadius + Math.min(2.0, obj.radius * 0.5);
      }
      
      // Check if collision occurs
      if (surfaceDist < collisionRadius) {
        // Get collision response direction (away from object)
        const responseDir = dir.clone().sub(
          objDir.clone().multiplyScalar(dot)
        ).normalize();
        
        // Apply small impulse away from collision
        const impulse = responseDir.clone().multiplyScalar(0.03);
        this.velocity.add(impulse);
        
        // Move player out of collision
        const correction = responseDir.clone().multiplyScalar(collisionRadius - surfaceDist + 0.05);
        this.yawObject.position.add(correction);
        
        // ADDED: Wall jump mechanic - hitting a collision can reset jump ability
        // Check if this is a significant collision (not just grazing)
        if (collisionRadius - surfaceDist > 0.2) {
          // Reset double jump on significant wall collision for wall-jumping
          if (!this.onGround && this.jumpsRemaining === 0) { 
            this.jumpsRemaining = 1; // Allow one more jump after wall collision
            console.log("Wall contact - granting wall jump ability");
          }
        }
        
        // Reduce horizontal velocity on collision
        const upDir = this.yawObject.position.clone().normalize();
        const horizontalVel = this.velocity.clone().projectOnPlane(upDir);
        horizontalVel.multiplyScalar(0.5);
        
        // Recombine velocity components
        const verticalVel = upDir.clone().multiplyScalar(this.velocity.dot(upDir));
        this.velocity.copy(verticalVel).add(horizontalVel);
      }
    }
  }

  reset() {
    // Reset to safe height above origin
    const originDir = new THREE.Vector3(0, 0, 1).normalize();
    const terrainHeight = this.getTerrainHeight(originDir);
    const safePos = originDir.multiplyScalar(this.radius + terrainHeight + 5);
    
    this.yawObject.position.copy(safePos);
    this.yawObject.up.copy(safePos.clone().normalize());
    this.pitch = 0;
    this.pitchObject.rotation.x = 0;
    
    // Look along tangent
    const resetForward = new THREE.Vector3(0,0,-1)
      .projectOnPlane(this.yawObject.up)
      .normalize();
    const resetTarget = this.yawObject.position.clone().add(resetForward);
    this.yawObject.lookAt(resetTarget);
  }

  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  getVelocity() {
    return this.velocity.clone();
  }

  // Add helper method to apply crouch state
  _applyCrouchState() {
    let fullHeight = this.originalCameraY;
    // Ensure fullHeight is a valid positive number
    if (typeof fullHeight !== 'number' || isNaN(fullHeight) || fullHeight <= 0) {
      // console.warn(`SphereControls: Invalid originalCameraY (${this.originalCameraY}), defaulting to 6.6.`);
      fullHeight = 6.6; 
    }
    
    let crouchHeightFactor = this.options.crouchHeight;
    // Ensure crouchHeightFactor is a valid number (e.g., between 0 and 1), defaulting to 0.5
    if (typeof crouchHeightFactor !== 'number' || isNaN(crouchHeightFactor) || crouchHeightFactor < 0 || crouchHeightFactor > 1) {
      // console.warn(`SphereControls: Invalid crouchHeightFactor (${this.options.crouchHeight}), defaulting to 0.5.`);
      crouchHeightFactor = 0.5;
    }

    const targetCrouchCamY = fullHeight * crouchHeightFactor;
    // Lerp between fullHeight and targetCrouchCamY using this.crouchAmount
    const currentHeight = fullHeight * (1 - this.crouchAmount) + targetCrouchCamY * this.crouchAmount;

    // Final safety check for NaN before assignment
    if (isNaN(currentHeight)) {
      // console.error('SphereControls: currentHeight became NaN during crouch. Fallback to fullHeight.', {
      //   originalFullHeight: this.originalCameraY,
      //   calculatedFullHeight: fullHeight,
      //   originalCrouchFactor: this.options.crouchHeight,
      //   calculatedCrouchFactor: crouchHeightFactor,
      //   crouchAmount: this.crouchAmount
      // });
      this.camera.position.y = fullHeight; // Fallback to standing height
    } else {
      this.camera.position.y = currentHeight;
    }
    
    // Store the actually set height for other systems to reference
    this.cameraHeight = this.camera.position.y;
  }

  // Add crouch control methods
  startCrouch(isToggle = false) {
    this.isCrouching = true;
    
    // Cancel any existing transition
    if (this.crouchTransition) {
      cancelAnimationFrame(this.crouchTransition);
      this.crouchTransition = null;
    }
    
    // Use faster transitions in air for better feel
    const inAir = !this.onGround;
    const transitionTime = inAir ? 
      this.options.crouchTransitionTime * 0.7 : // 30% faster in air
      this.options.crouchTransitionTime;
    
    // Smoothly transition to crouched state
    const startAmount = this.crouchAmount;
    const startTime = performance.now();
    const duration = transitionTime * 1000;
    
    // Create transition function
    const animateCrouch = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      
      // Use ease-out function for smooth transition
      const easeOut = 1 - Math.pow(1 - progress, 2);
      this.crouchAmount = startAmount + (1 - startAmount) * easeOut;
      
      // Apply the updated crouch amount immediately
      this._applyCrouchState();
      
      if (progress < 1.0) {
        this.crouchTransition = requestAnimationFrame(animateCrouch);
      } else {
        this.crouchAmount = 1.0; // Ensure we reach exactly 1
        this._applyCrouchState(); // Apply final state
        this.crouchTransition = null;
      }
    };
    
    // Start transition animation
    this.crouchTransition = requestAnimationFrame(animateCrouch);
  }

  stopCrouch() {
    // Only process if we're actually crouching
    if (!this.isCrouching) return;
    
    this.isCrouching = false;
    this.crouchToggled = false;
    
    // Cancel any existing transition
    if (this.crouchTransition) {
      cancelAnimationFrame(this.crouchTransition);
      this.crouchTransition = null;
    }
    
    // Use faster transitions in air for better feel
    const inAir = !this.onGround;
    const transitionTime = inAir ? 
      this.options.crouchTransitionTime * 0.7 : // 30% faster in air
      this.options.crouchTransitionTime;
    
    // Smoothly transition back to standing
    const startAmount = this.crouchAmount;
    const startTime = performance.now();
    const duration = transitionTime * 1000;
    
    // Create transition function
    const animateStand = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      
      // Use ease-out function for smooth transition
      const easeOut = 1 - Math.pow(1 - progress, 2);
      this.crouchAmount = startAmount - startAmount * easeOut;
      
      // Apply the updated crouch amount immediately
      this._applyCrouchState();
      
      if (progress < 1.0) {
        this.crouchTransition = requestAnimationFrame(animateStand);
      } else {
        this.crouchAmount = 0.0; // Ensure we reach exactly 0
        this._applyCrouchState(); // Apply final state
        this.crouchTransition = null;
      }
    };
    
    // Start transition animation
    this.crouchTransition = requestAnimationFrame(animateStand);
  }

  // Add Wavedash control methods
  startWavedash(downwardSpeed) {
    if (!this.options.canWavedash || this.onGround || this.isWavedashing) return;
    this.isWavedashing = true;
    
    // Ensure downwardSpeed is valid (use this.options.wavedashFastFallSpeed as fallback)
    const actualSpeed = (typeof downwardSpeed === 'number' && !isNaN(downwardSpeed) && downwardSpeed > 0)
      ? downwardSpeed 
      : this.options.wavedashFastFallSpeed;
    
    const playerUp = this.yawObject.position.clone().normalize();
    // Preserve horizontal velocity, set vertical velocity to downwardSpeed
    const horizontalVelocity = this.velocity.clone().projectOnPlane(playerUp);
    const downwardVelocity = playerUp.clone().negate().multiplyScalar(actualSpeed);
    
    this.velocity.copy(horizontalVelocity).add(downwardVelocity);
    console.log("Wavedash: Fast fall initiated with speed", actualSpeed);
  }

  cancelWavedash() {
    if (this.isWavedashing) {
      this.isWavedashing = false;
      console.log("Wavedash: Fast fall cancelled");
    }
  }

  // Toggle crouching state
  toggleCrouch() {
    if (this.isCrouching && this.crouchToggled) {
      this.crouchToggled = false;
      this.stopCrouch();
    } else {
      this.crouchToggled = true;
      this.startCrouch(true);
    }
  }
}
