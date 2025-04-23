import * as THREE from 'three';

export default class SphereControls {
  constructor(camera, domElement, options = {}) {
    this.camera = camera;
    this.domElement = domElement || document;

    // sphere params
    this.radius = options.sphereRadius || 50;
    this.getTerrainHeight = options.getTerrainHeight || (() => 0);
    this.moveSpeed = options.moveSpeed || 32.0; // INCREASED from 10.0 to 32.0 for much faster movement
    this.lookSpeed = options.lookSpeed || 0.002;
    this.pitchLimit = Math.PI / 2 - 0.1;
    this.collidables = options.collidables || [];
    this.playerRadius = options.playerRadius || 1.0;
    
    // Add new fixed offset above terrain (player "foot" level)
    // INCREASED default offset from 0.2 to 0.35
    this.playerHeightOffset = options.playerHeightOffset || 0.35; // Increased foot clearance
    // DOUBLE the standard eye height default
    this.cameraHeight = options.eyeHeight || 6.6; // (3.3 * 2) Camera height relative to player base

    // build yaw->pitch->camera hierarchy
    this.yawObject = new THREE.Object3D();
    this.pitchObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);
    this.pitchObject.add(camera);
    // Use the DOUBLED eye height default for initial camera position
    camera.position.set(0, options.eyeHeight || 6.6, 0);

    // Allow for custom start position direction
    const startDir = options.startPosition || new THREE.Vector3(0, 1, 0).normalize(); // Default to top of planet
    
    // Calculate terrain height at start position
    const startTerrainHeight = this.getTerrainHeight(startDir);
    
    // FIXED: Use much higher elevation to ensure we start outside the planet
    const startElevation = options.startElevation || 20; // Increased default from 5 to 20
    
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
    this.keys = {};
    this.pitch = 0;

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
    
    // Physics settings - updated for smoother slope traversal
    this.slideAngleThreshold = 0.7071; // Cosine of 45 degrees - slide only on steeper slopes
    this.slideAcceleration = 0.08;  // Increased sliding force for better momentum
    this.slideFriction = 0.96;      // Lower friction while sliding (was 0.98)

    // Physics parameters - IMPROVED BALANCE
    this.jumpStrength = options.jumpStrength || 4.5;  // Increased from 3.0 to 4.5 for higher jumps
    this.gravity = Math.abs(options.gravity || 0.2);  // Maintained strong gravity at 0.2
    this.jumpEnabled = true;
    this.isJumping = false;
    this.onGround = true;
    
    // Add jump counts for double jump support
    this.maxJumps = options.maxJumps || 2; // Default to double jump
    this.jumpsRemaining = this.maxJumps;
    this.jumpCooldown = 0; // Cooldown timer between jumps

    // Terrain interaction parameters
    this.terrainSamplingRadius = 0.1; // Radius for terrain sampling
    this.terrainSamples = 9; // Number of samples to take around player
    this.maxTerrainAngle = Math.PI / 4; // Maximum angle (45 degrees) to walk up before sliding

    // Add new movement physics parameters
    this.airControlFactor = options.airControlFactor || 0.3; // Increased from 0.2 to 0.3
    this.maxGroundSpeed = options.maxGroundSpeed || 40.0; // INCREASED - must be higher than moveSpeed
    this.maxAirSpeed = options.maxAirSpeed || 45.0; // INCREASED - slightly higher than ground speed
    this.jumpSpeed = options.jumpSpeed || 10.0; 
    this.doubleJumpScale = options.doubleJumpScale || 2;
    this.jumpDirectionMix = options.jumpDirectionMix || 0.35; // Increased directional control
    this.groundFriction = options.groundFriction || 0.92; // Slightly lower for faster acceleration
    this.airFriction = options.airFriction || 0.998; // Almost no air friction for better air movement

    // Add parameters for progressive gravity
    this.maxGravityMultiplier = options.maxGravityMultiplier || 2.5; // How much stronger gravity gets
    this.gravityRampTime = options.gravityRampTime || 0.8; // Time to reach max gravity (seconds)
    this.airTime = 0; // Time spent in air for gravity calculations
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

  // Fix the key handling to ensure space bar is properly detected
  onKeyDown(e) { 
    // Store the key in lowercase for consistent checking
    const key = e.key.toLowerCase();
    this.keys[key] = true; 
    
    // Log key presses to debug spacebar detection
    if (key === ' ' || key === 'spacebar') {
      console.log("SPACEBAR PRESSED - jumpEnabled:", this.jumpEnabled, 
                  "jumpsRemaining:", this.jumpsRemaining, 
                  "jumpCooldown:", this.jumpCooldown.toFixed(3),
                  "onGround:", this.onGround);
      
      // Handle both ' ' and 'spacebar' for cross-browser compatibility
      if (this.jumpEnabled && this.jumpsRemaining > 0 && this.jumpCooldown <= 0) {
        // Rest of jump handler code as before...
        console.log("MAIN JUMP HANDLER EXECUTED"); // Add debug log to verify this runs
        
        // CRITICAL FIX: Always use the player's normalized position as the true "up" direction
        const upDir = this.yawObject.position.clone().normalize();
        
        // Get camera forward direction for directional influence
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.yawObject.quaternion);
        forward.projectOnPlane(upDir).normalize();
        
        // Strong consistent jump force
        const isFirstJump = this.onGround;
        const jumpForce = this.jumpStrength * 5.5;
        
        // Reset jumps remaining counter if this is a ground jump
        if (isFirstJump) {
          this.jumpsRemaining = this.maxJumps - 1; // Reset minus this jump
        } else {
          this.jumpsRemaining--; // Just decrement for double jumps
        }
        
        // Calculate pure vertical jump velocity
        const jumpVelocity = upDir.clone().multiplyScalar(jumpForce);
        
        // FIXED: Properly save horizontal velocity in tangent plane to sphere
        const horizontalVel = this.velocity.clone().projectOnPlane(upDir);
        const currentHorizontalSpeed = horizontalVel.length();
        
        // CRITICAL FIX: Reset velocity completely before adding jump impulse
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        // Add pure jump impulse along local up vector
        this.velocity.add(jumpVelocity);
        
        // Add back controlled horizontal velocity for direction preservation
        if (currentHorizontalSpeed > 0.01) {
          const maxHorizontalSpeed = this.maxGroundSpeed * 0.8;
          const targetSpeed = Math.min(currentHorizontalSpeed, maxHorizontalSpeed);
          this.velocity.add(horizontalVel.normalize().multiplyScalar(targetSpeed));
        }
        
        // DEBUG: Record jump details for debugging
        this._lastJumpForce = jumpForce;
        this._lastJumpVelocity = this.velocity.length();
        
        console.log(`Jump force: ${jumpForce.toFixed(2)}, resulting velocity: ${this.velocity.length().toFixed(2)}, jumps remaining: ${this.jumpsRemaining}`);
        
        // Mark as jumping and setup state
        this.isJumping = true;
        this.onGround = false;
        this.jumpAirTime = 0;
        this.jumpCooldown = 0.15;
        this.jumpStartTime = performance.now(); // For tracking jump duration
        
        // Reset air time properly for gravity calculation
        if (isFirstJump) {
          this.airTime = 0;
        } else {
          this.airTime = this.gravityRampTime * 0.2;
        }
      } else {
        console.log("Jump prevented - remaining jumps:", this.jumpsRemaining, "cooldown:", this.jumpCooldown.toFixed(3));
      }
    }
  }
  onKeyUp(e) { 
    // Reset the key state when released
    const key = e.key.toLowerCase();
    this.keys[key] = false;
    
    // On spacebar release, reset cooldown if it's high
    if ((key === ' ' || key === 'spacebar') && this.jumpCooldown > 0.1) {
      // Reset cooldown to low value to allow next jump sooner
      this.jumpCooldown = 0.01;
      console.log("Jump cooldown reset on key release");
    }
  }

  // Fix the jumping logic to prevent immediate ground detection after jump
  update(deltaTime) {
    const playerObj = this.yawObject;

    // --- KEY CHANGE: Store the player's up direction for consistent reference ---
    // This is the normal to the sphere at the player's position
    const playerUp = playerObj.position.clone().normalize();
    
    // --- CRITICAL FIX #1: Add absolute minimum distance check ---
    // This should run at the start of each update to catch any potential issues
    const pos = this.yawObject.position;
    const dir = pos.clone().normalize();
    const absoluteMinimumHeight = this.radius * 0.95; // Never go below 95% of planet radius
    
    if (pos.length() < absoluteMinimumHeight) {
      console.warn("EMERGENCY POSITION CORRECTION - player below minimum height!");
      
      // Get terrain height at current direction
      const terrainHeight = this.getTerrainHeight(dir);
      
      // Place player safely above terrain
      const safeHeight = this.radius + terrainHeight + this.playerHeightOffset;
      this.yawObject.position.copy(dir.multiplyScalar(safeHeight));
      
      // Reset velocity to prevent further sinking
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.isJumping = false;
      this.jumpsRemaining = this.maxJumps;
    }
    
    // Apply progressive gravity when not on ground
    if (!this.onGround) {
      // Update air time counter
      this.airTime += deltaTime;
      
      // Calculate gravity multiplier based on time in air
      // Starts at 1.0 and increases to maxGravityMultiplier over gravityRampTime
      const gravityMultiplier = Math.min(
        this.maxGravityMultiplier, 
        1.0 + (this.airTime / this.gravityRampTime) * (this.maxGravityMultiplier - 1.0)
      );
      
      // Create gravity vector pointing to planet center
      const gravityVector = playerUp.clone().negate();
      
      // Apply gravity force with progressive multiplier
      const finalGravity = this.gravity * gravityMultiplier;
      this.velocity.addScaledVector(gravityVector, finalGravity * deltaTime * 60);
      
      // Log gravity progression occasionally for debugging
      if (Math.random() < 0.01) {
        console.log(`Air time: ${this.airTime.toFixed(2)}s, Gravity mult: ${gravityMultiplier.toFixed(2)}, Final gravity: ${finalGravity.toFixed(3)}`);
      }
    } else {
      // Reset air time when on ground
      this.airTime = 0;
    }

    // --- Process keyboard input ---
    const moveDir = new THREE.Vector3(0, 0, 0);
    
    if (this.keys['w']) moveDir.z -= 1;
    if (this.keys['s']) moveDir.z += 1;
    if (this.keys['d']) moveDir.x += 1;
    if (this.keys['a']) moveDir.x -= 1;
    
    if (moveDir.length() > 0) {
      moveDir.normalize();
    }
    
    // --- Create movement direction and basis vectors for reuse ---
    // Only compute these shared variables if there's any movement input
    let worldMoveDir = null;
    let forward = null;
    let right = null;
    
    if (moveDir.length() > 0) {
      // Create a proper player basis with y always along the up direction
      forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(this.yawObject.quaternion);
      // Project forward onto the tangent plane
      const playerUp = this.yawObject.position.clone().normalize();
      forward.sub(playerUp.clone().multiplyScalar(forward.dot(playerUp)));
      forward.normalize();
      
      // Create right vector from up and forward
      right = new THREE.Vector3().crossVectors(forward, playerUp).normalize();
      
      // World space movement direction
      worldMoveDir = new THREE.Vector3(0, 0, 0);
      if (moveDir.x !== 0) worldMoveDir.addScaledVector(right, moveDir.x);
      if (moveDir.z !== 0) worldMoveDir.addScaledVector(forward, -moveDir.z);
    }
    
    // --- Basic movement physics with non-configurable parameters ---
    if (worldMoveDir) {
      // ... existing movement code using worldMoveDir ...
    } else if (this.onGround) {
      // ... existing friction code ...
    }

    // --- Movement handling using configurable parameters ---
    if (worldMoveDir) {
      if (this.onGround) {
        // Direct control on ground - stronger, more responsive
        const groundControl = worldMoveDir.clone().multiplyScalar(this.moveSpeed * 2.0);
        
        // Blend between current horizontal velocity and desired velocity
        const upDir = playerUp.clone();
        const horizontalVel = this.velocity.clone().projectOnPlane(upDir);
        const verticalVel = upDir.multiplyScalar(this.velocity.dot(upDir));
        
        // Calculate new horizontal velocity with configurable blending
        const newHorizontal = groundControl.multiplyScalar(0.9).add(horizontalVel.multiplyScalar(0.1));
        
        // Recombine with vertical component
        this.velocity.copy(newHorizontal).add(verticalVel);
      } else {
        // IMPROVED AIR CONTROL: Very limited steering that doesn't add extra height
        
        // Get player's up direction
        const upDir = playerUp.clone();
        
        // Extract vertical component of velocity (radial)
        const verticalComponent = upDir.clone().multiplyScalar(this.velocity.dot(upDir));
        const verticalSpeed = verticalComponent.length() * Math.sign(verticalComponent.dot(upDir));
        
        // Extract horizontal component of velocity (tangential to sphere)
        const horizontalVel = this.velocity.clone().projectOnPlane(upDir);
        const currentSpeed = horizontalVel.length();
        
        // Calculate maximum allowed steering force (very small)
        const maxSteeringForce = this.moveSpeed * this.airControlFactor * deltaTime * 15; // Reduced multiplier
        
        // Calculate steering direction (difference between current and desired direction)
        let steeringForce = new THREE.Vector3();
        
        if (currentSpeed > 0.01) {
          // Calculate steering force based on current direction vs desired direction
          const currentDir = horizontalVel.clone().normalize();
          const desiredDir = worldMoveDir.clone().normalize();
          
          steeringForce = desiredDir.clone()
            .sub(currentDir.clone().multiplyScalar(currentDir.dot(desiredDir)))
            .normalize()
            .multiplyScalar(Math.min(maxSteeringForce, currentSpeed * 0.1)); // Very small adjustment
        }
        
        // Apply the steering force to horizontal velocity only
        horizontalVel.add(steeringForce);
        
        // Limit horizontal speed
        const newHSpeed = horizontalVel.length();
        if (newHSpeed > this.maxAirSpeed) {
          horizontalVel.multiplyScalar(this.maxAirSpeed / newHSpeed);
        }
        
        // IMPORTANT: Recombine with the ORIGINAL vertical component
        // This prevents steering from adding any vertical velocity
        this.velocity.copy(horizontalVel).add(verticalComponent);
        
        // Log diagnostic data occasionally
        if (Math.random() < 0.002) {
          console.log(`Air control: steer=${steeringForce.length().toFixed(3)}, vSpeed=${verticalSpeed.toFixed(2)}, hSpeed=${horizontalVel.length().toFixed(2)}`);
        }
      }
      
      // ... rest of movement code ...
    } else if (this.onGround) {
      // Apply configurable ground friction
      this.velocity.multiplyScalar(this.groundFriction);
    } else {
      // Apply configurable air friction
      this.velocity.multiplyScalar(this.airFriction);
    }
    
    // Apply velocity to position
    const velocityDelta = this.velocity.clone().multiplyScalar(deltaTime);
    playerObj.position.add(velocityDelta);
    
    // Skip ground checks completely for a brief time after jumping
    // This ensures we actually leave the ground and don't land immediately
    const MIN_GUARANTEED_AIR_TIME = 0.15; // 150ms of mandatory air time
    if (this.isJumping && this.jumpAirTime < MIN_GUARANTEED_AIR_TIME) {
      // Skip ground check entirely during guaranteed air time
      // Only align up direction but don't check for ground contact
      this._alignUpToPlanet();
    } else {
      // After guaranteed air time, perform regular ground checks
      this._checkGroundContact(deltaTime);
      
      // Only align to terrain when on ground
      if (this.onGround) {
        this._alignToTerrain();
      } else {
        this._alignUpToPlanet();
      }
    }
    
    // --- Collision Detection and Response ---
    this._checkCollisions();
    
    // Update camera position to match player
    this._updateCamera();

    // CRITICAL FIX: Update jump cooldown properly
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= deltaTime;
      // Add debug logging every few frames to track cooldown
      if (Math.random() < 0.05) {
        console.log(`Jump cooldown: ${this.jumpCooldown.toFixed(3)}`);
      }
    }
    
    // Update "guaranteed air time" counter
    if (this.isJumping) {
      this.jumpAirTime += deltaTime;
    }
  }

  // Align just the up direction to the planet, preserving look direction
  _alignUpToPlanet() {
    // Get current player orientation
    const currentQuat = this.yawObject.quaternion.clone();
    
    // Get player position (normalized) as up vector
    const up = this.yawObject.position.clone().normalize();
    
    // Keep the 'forward' direction but make it perpendicular to up
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(currentQuat);
    // Remove any component along up direction
    forward.sub(up.clone().multiplyScalar(forward.dot(up)));
    forward.normalize();
    
    // If forward vector became too small, use a default direction
    if (forward.lengthSq() < 0.1) {
      forward.set(1, 0, 0).sub(up.clone().multiplyScalar(up.x)).normalize();
    }
    
    // Calculate right from forward and up
    const right = new THREE.Vector3().crossVectors(forward, up);
    
    // Create a rotation matrix from this orthogonal basis
    const m = new THREE.Matrix4().makeBasis(right, up, forward.clone().negate());
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    
    // Apply the new orientation
    this.yawObject.quaternion.copy(q);
  }

  _alignToTerrain() {
    const pos = this.yawObject.position;
    const upDir = pos.clone().normalize();
    
    // IMPROVED: Use higher precision sampling for terrain alignment
    const sampleDist = 0.15; // Smaller sampling distance for precision
    
    // Use camera alignment for better direction context
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.yawObject.quaternion);
    forward.projectOnPlane(upDir).normalize();
    
    const right = new THREE.Vector3().crossVectors(upDir, forward).normalize();
    
    // Sample terrain heights at multiple points in a ring around the player
    const samplePoints = [];
    const angleStep = Math.PI / 4;
    
    // Get terrain height at center point
    const h0 = this.getTerrainHeight(upDir);
    
    // Get heights at 8 points around player in a circle
    for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
      const sampleDir = new THREE.Vector3()
        .addScaledVector(right, Math.cos(angle) * sampleDist)
        .addScaledVector(forward, Math.sin(angle) * sampleDist)
        .add(upDir)
        .normalize();
      
      const height = this.getTerrainHeight(sampleDir);
      samplePoints.push({
        dir: sampleDir,
        height: height
      });
    }
    
    // Calculate normal from all sample points for stability
    const p0 = upDir.clone().multiplyScalar(this.radius + h0);
    const normals = [];
    
    for (let i = 0; i < samplePoints.length; i++) {
      const p1 = samplePoints[i].dir.clone().multiplyScalar(this.radius + samplePoints[i].height);
      const p2 = samplePoints[(i + 1) % samplePoints.length].dir.clone()
        .multiplyScalar(this.radius + samplePoints[(i + 1) % samplePoints.length].height);
      
      const v1 = p1.clone().sub(p0);
      const v2 = p2.clone().sub(p0);
      
      const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
      if (normal.dot(upDir) < 0) normal.negate(); // Ensure outward-facing
      normals.push(normal);
    }
    
    // Average all normals for a stable result
    const normal = new THREE.Vector3();
    for (const n of normals) {
      normal.add(n);
    }
    normal.normalize();
    
    // Update player orientation
    this.yawObject.up.copy(normal);
    
    // CRITICAL FIX: Ensure EXACT height alignment to terrain
    const targetHeight = this.radius + h0 + this.playerHeightOffset;
    
    // Always snap exactly to terrain height, no tolerance
    pos.normalize().multiplyScalar(targetHeight);
  }

  // Fix the ground detection to prevent false landing detection
  _checkGroundContact(deltaTime) {
    const pos = this.yawObject.position;
    const dir = pos.clone().normalize();
    
    // IMPROVED: Use multi-point sampling for better terrain detection
    // This helps find the true height even on complex terrain features
    const samplePoints = [
      { dir: dir, weight: 0.7 },  // Current position (highest weight)
      { dir: dir.clone().add(new THREE.Vector3(0.05, 0, 0)).normalize(), weight: 0.075 },
      { dir: dir.clone().add(new THREE.Vector3(-0.05, 0, 0)).normalize(), weight: 0.075 },
      { dir: dir.clone().add(new THREE.Vector3(0, 0, 0.05)).normalize(), weight: 0.075 },
      { dir: dir.clone().add(new THREE.Vector3(0, 0, -0.05)).normalize(), weight: 0.075 }
    ];
    
    // Calculate weighted average terrain height
    let terrainHeight = 0;
    let totalWeight = 0;
    
    for (const point of samplePoints) {
      terrainHeight += this.getTerrainHeight(point.dir) * point.weight;
      totalWeight += point.weight;
    }
    
    terrainHeight /= totalWeight;
    const terrainRadius = this.radius + terrainHeight;
    
    // IMPROVED: Calculate true distance to terrain using sampled height
    // This ensures we're measuring distance to the actual terrain surface
    const distanceToTerrain = pos.length() - terrainRadius;
    
    // Debug this value occasionally
    if (Math.random() < 0.01) {
      console.log(`Distance to terrain: ${distanceToTerrain.toFixed(2)}, terrain height: ${terrainHeight.toFixed(2)}, onGround: ${this.onGround}`);
    }
    
    // CRITICAL: Use a very tight ground threshold to prevent floating
    const groundThreshold = this.playerHeightOffset + 0.02; // Extremely tight threshold
    
    if (distanceToTerrain <= groundThreshold) {
      // We're at or near ground level
      if (!this.onGround) {
        console.log("Ground contact detected - landing");
        
        // FIXED: Make sure we always reset jumps to max value when landing
        this.onGround = true;
        this.isJumping = false;
        this.jumpAirTime = 0;
        this.jumpsRemaining = this.maxJumps; // CRITICAL: Always restore to full maxJumps value
        this.jumpCooldown = 0; // CRITICAL: Reset cooldown to 0 when landing!
        this.airTime = 0;
        
        // CRITICAL FIX: Always snap precisely to ground level on landing
        pos.normalize().multiplyScalar(terrainRadius + this.playerHeightOffset);
        
        // Handle velocity changes for landing
        const upDir = pos.clone().normalize();
        const verticalVel = this.velocity.dot(upDir);
        
        if (verticalVel < 0) {
          // Remove downward component
          this.velocity.addScaledVector(upDir, -verticalVel);
          
          // Add slight bounce for better feel on hard landings
          if (verticalVel < -0.1) {
            this.velocity.addScaledVector(upDir, Math.min(-verticalVel * 0.2, 0.05));
          }
        }
      } else {
        // CRITICAL FIX: Continuous ground snapping to prevent hovering
        // We're already on ground, but need to maintain exact distance from terrain
        
        // IMPORTANT: Always snap exactly to the terrain
        const targetHeight = terrainRadius + this.playerHeightOffset;
        pos.normalize().multiplyScalar(targetHeight);
        
        // Cancel any downward velocity component as we're on ground
        const upDir = pos.clone().normalize();
        const verticalVel = this.velocity.dot(upDir);
        if (verticalVel < 0) {
          this.velocity.addScaledVector(upDir, -verticalVel);
        }
      }
    } else {
      // We're above ground level - detect falling
      if (this.onGround) {
        // Detect walking off edges faster to prevent floating
        if (distanceToTerrain > 0.3) { // Even more sensitive to losing ground
          console.log("Lost ground contact - falling");
          this.onGround = false;
        }
      }
    }
  }

  reset() {
    // Reset to a safe height above origin point
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

  // Add a helper method to get the current velocity
  getVelocity() {
    return this.velocity.clone();
  }

  _checkCollisions() {
    // Skip collision check if we have no collidables
    if (!this.collidables || this.collidables.length < 1) return;

    const pos = this.yawObject.position;
    const dir = pos.clone().normalize();

    // Check collisions with objects (trees, rocks, etc.) - skip planet
    for (let i = 1; i < this.collidables.length; i++) {
      const obj = this.collidables[i];
      
      // Skip if object has no position, direction, or is explicitly marked as non-collidable
      if (!obj.position || !obj.direction || obj.noCollision) continue;
      
      // Get angular distance between player and object (great-circle distance on sphere)
      const objDir = obj.direction;
      const dot = dir.dot(objDir);
      const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
      
      // Convert to surface distance
      const surfaceDist = angle * this.radius;
      
      // Get combined collision radius
      let collisionRadius = this.playerRadius + (obj.radius || 1.0);
      
      // Special case for trees - use a cylindrical collision model
      if (obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree) {
        // For trees, only collide if we're at similar height
        const objPos = obj.position.clone();
        const playerHeight = pos.length() - this.radius;
        const objHeight = objPos.length() - this.radius;
        const heightDiff = Math.abs(playerHeight - objHeight);
        
        // Use collision height from object if available, otherwise estimate
        const collisionHeight = obj.collisionHeight || obj.radius * 2;
        
        // Only collide if within the trunk's height range
        if (heightDiff > collisionHeight) {
          continue;
        }
        
        // Use a smaller collision radius for tree trunks
        collisionRadius = this.playerRadius + Math.min(2.0, obj.radius * 0.5);
      }
      
      // Check if collision occurs
      if (surfaceDist < collisionRadius) {
        // Get collision response direction (away from object)
        const responseDir = dir.clone().sub(
          objDir.clone().multiplyScalar(dot)
        ).normalize();
        
        // Apply a small impulse in the collision response direction
        const impulse = responseDir.clone().multiplyScalar(0.03);
        this.velocity.add(impulse);
        
        // Move player out of collision
        const correction = responseDir.clone().multiplyScalar(collisionRadius - surfaceDist + 0.05);
        this.yawObject.position.add(correction);
        
        // Reduce horizontal velocity on collision for better feel
        const upDir = this.yawObject.position.clone().normalize();
        const horizontalVel = this.velocity.clone().projectOnPlane(upDir);
        horizontalVel.multiplyScalar(0.5); // Significant reduction on collision
        
        // Recombine vertical and reduced horizontal components
        const verticalVel = upDir.clone().multiplyScalar(this.velocity.dot(upDir));
        this.velocity.copy(verticalVel).add(horizontalVel);
      }
    }
    
    // Also check for ground collision
    const terrainHeight = this.getTerrainHeight(dir);
    const terrainRadius = this.radius + terrainHeight;
    
    if (pos.length() < terrainRadius + this.playerHeightOffset * 0.5) {
      // We're too close to or below the terrain - correct position
      const correctedPos = dir.clone().multiplyScalar(terrainRadius + this.playerHeightOffset);
      this.yawObject.position.copy(correctedPos);
      
      // Cancel any downward velocity
      const upDir = dir.clone();
      const verticalVel = this.velocity.dot(upDir);
      if (verticalVel < 0) {
        this.velocity.addScaledVector(upDir, -verticalVel);
      }
      
      // Mark as on ground
      this.onGround = true;
    }
  }

  _updateCamera() {
    // Make sure camera is positioned correctly on the pitch object
    this.camera.position.set(0, this.cameraHeight, 0);
    
    // Make sure camera's up vector aligns with player's up vector
    this.camera.up.copy(this.yawObject.up);
    
    // Debug
    if (Math.random() < 0.005) {
      console.log(`Camera position: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
      console.log(`Camera up: (${this.camera.up.x.toFixed(2)}, ${this.camera.up.y.toFixed(2)}, ${this.camera.up.z.toFixed(2)})`);
    }
  }

  // Add a debug method to help diagnose jump issues
  _debugJumpState() {
    console.log({
      onGround: this.onGround,
      isJumping: this.isJumping, 
      jumpsRemaining: this.jumpsRemaining,
      maxJumps: this.maxJumps,
      jumpCooldown: this.jumpCooldown,
      jumpAirTime: this.jumpAirTime,
      lastVelocity: this.velocity.length()
    });
  }
}
