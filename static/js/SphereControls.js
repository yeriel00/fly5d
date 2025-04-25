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
    
    // Double jump support
    this.maxJumps = options.maxJumps || 2;
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
    
    // Extreme position safety
    this.maxHeightAboveGround = 45;
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
      
      // Simple jump condition - either on ground OR have air jumps remaining AND cooldown is done
      if (this.jumpEnabled && this.jumpsRemaining > 0 && this.jumpCooldown <= 0) {
        console.log("JUMP STARTING");
        
        // Get local up direction
        const upDir = this.yawObject.position.clone().normalize();
        
        // Apply jump impulse along up vector (radial direction)
        const jumpForce = this.jumpStrength * 5.5;
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
        
        // Update state
        if (this.onGround) {
          // First jump - just reset counter minus this jump
          this.jumpsRemaining = this.maxJumps - 1;
        } else {
          // Air jump - decrement
          this.jumpsRemaining--;
        }
        
        // Update jump state
        this.isJumping = true;
        this.onGround = false;
        this.jumpCooldown = 0.15;
        
        // Reset air time for gravity calculation
        this.airTime = 0;
        
        console.log(`Jump completed with force: ${jumpForce.toFixed(1)}, velocity: ${this.velocity.length().toFixed(1)}, jumps remaining: ${this.jumpsRemaining}`);
      } else {
        console.log("Jump prevented - remaining jumps:", this.jumpsRemaining, "cooldown:", this.jumpCooldown.toFixed(3));
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
    
    // *** SAFETY CHECK: Prevent extreme heights ***
    const distanceToGround = pos.length() - terrainRadius;
    if (distanceToGround > this.maxHeightAboveGround) {
      console.warn(`Height safety: ${distanceToGround.toFixed(1)} exceeds limit of ${this.maxHeightAboveGround}. Teleporting to safety.`);
      // Teleport to safe position
      const safeHeight = terrainRadius + this.playerHeightOffset + 2;
      this.yawObject.position.copy(dir.multiplyScalar(safeHeight));
      // Reset velocity and state
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.isJumping = false;
      this.jumpsRemaining = this.maxJumps;
      this.airTime = 0;
      console.log("Player teleported to safety");
      return; // Skip rest of update
    }

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
    if (worldMoveDir) {
      if (this.onGround) {
        // Direct control on ground
        const groundControl = worldMoveDir.clone().multiplyScalar(this.moveSpeed * 2.0);
        
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
        if (horizontalVel.length() > this.maxAirSpeed) {
          horizontalVel.normalize().multiplyScalar(this.maxAirSpeed);
        }
        
        // Recombine without affecting vertical velocity
        this.velocity.copy(horizontalVel).add(verticalComponent);
      }
    } else if (this.onGround) {
      // Apply ground friction when not actively moving
      this.velocity.multiplyScalar(this.groundFriction);
    } else {
      // Apply lighter air friction
      this.velocity.multiplyScalar(this.airFriction);
    }
    
    // Apply velocity to position
    const velocityDelta = this.velocity.clone().multiplyScalar(dt);
    
    // Safety limit for velocity - prevent extremely large position deltas
    const maxDelta = 3.0;
    if (velocityDelta.length() > maxDelta) {
      console.warn(`Velocity delta too large (${velocityDelta.length().toFixed(1)}), capping to ${maxDelta}`);
      velocityDelta.normalize().multiplyScalar(maxDelta);
    }
    
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
        console.log("Ground contact detected - landing");
        
        // Update state
        this.onGround = true;
        this.isJumping = false;
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
}
