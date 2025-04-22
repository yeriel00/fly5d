import * as THREE from 'three';

export default class SphereControls {
  constructor(camera, domElement, options = {}) {
    this.camera = camera;
    this.domElement = domElement || document;

    // sphere params
    this.radius = options.sphereRadius || 50;
    this.getTerrainHeight = options.getTerrainHeight || (() => 0);
    this.moveSpeed = options.moveSpeed || 0.5;
    this.lookSpeed = options.lookSpeed || 0.002;
    this.pitchLimit = Math.PI / 2 - 0.1;
    this.collidables = options.collidables || [];
    this.playerRadius = options.playerRadius || 1.0;

    // build yaw->pitch->camera hierarchy
    this.yawObject = new THREE.Object3D();
    this.pitchObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);
    this.pitchObject.add(camera);
    camera.position.set(0, options.eyeHeight||1.6, 0);

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
    
    // Physics settings
    this.slideAngleThreshold = 0.6; // cos of max angle (~53 degrees)
    this.slideAcceleration = 0.05;  // Sliding force
    this.slideFriction = 0.98;      // Slide friction (reduces speed)

    // Physics parameters
    this.jumpStrength = options.jumpStrength || 0.5;
    this.gravity = options.gravity || -0.03;
    this.jumpEnabled = true;
    this.isJumping = false;
    this.onGround = true;
    
    // Add jump counts for double jump support
    this.maxJumps = options.maxJumps || 2; // Default to double jump
    this.jumpsRemaining = this.maxJumps;
    this.jumpCooldown = 0; // Cooldown timer between jumps
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
    this.keys[e.key.toLowerCase()] = true; 
    
    // Enhanced jump handler with double jump and mid-run jump
    if (e.key === ' ' && this.jumpEnabled && this.jumpsRemaining > 0 && this.jumpCooldown <= 0) {
      // Calculate jump direction (away from planet center)
      const jumpDir = this.yawObject.position.clone().normalize();
      
      // Calculate jump force - we'll use the same strength for all jumps
      const jumpForce = this.jumpStrength;
      
      // For first jump, set velocity directly
      if (this.onGround) {
        this.velocity = jumpDir.multiplyScalar(jumpForce);
      } else {
        // For mid-air jumps, preserve some horizontal momentum but reset vertical
        const upDir = this.yawObject.position.clone().normalize();
        const verticalComponent = upDir.clone().multiplyScalar(this.velocity.dot(upDir));
        
        // Remove downward momentum for cleaner double jump
        if (verticalComponent.dot(upDir) < 0) {
          this.velocity.sub(verticalComponent);
        }
        
        // Add new jump impulse
        this.velocity.add(jumpDir.clone().multiplyScalar(jumpForce));
      }
      
      // Mark as jumping and decrement jumps
      this.isJumping = true;
      this.onGround = false;
      this.jumpsRemaining--;
      
      // Set small cooldown to prevent accidental double-taps
      this.jumpCooldown = 0.2;
      
      console.log(`Jump ${this.maxJumps - this.jumpsRemaining} of ${this.maxJumps} with force: ${jumpForce.toFixed(2)}`);
    }
  }
  onKeyUp(e)   { this.keys[e.key.toLowerCase()] = false; }

  update(delta) {
    // Cache old position for collision response
    const oldPos = this.yawObject.position.clone();
    
    // ********************************************
    // UNIFIED GRAVITY AND SLIDING FIX
    // ********************************************
    const pos = this.yawObject.position;
    
    // This is our planet-relative up vector - ALWAYS pointing away from center
    const upDir = pos.clone().normalize();
    
    // Always apply gravity when not on ground or when sliding
    if (!this.onGround || this.sliding) {
      // Direction toward planet center (gravity direction)
      const gravityDir = upDir.clone().negate();
      
      // Apply scaled gravity force toward planet center
      const gravityForce = this.gravity * delta * 60;
      this.velocity.addScaledVector(gravityDir, gravityForce);
      
      // Debug only when actually falling
      if (!this.onGround) {
        console.log(`Applying gravity (strength=${gravityForce.toFixed(3)}) toward center`);
      }
    }
    
    // If we have any velocity, apply it
    if (this.velocity.lengthSq() > 0.000001) {
      // Apply velocity to position
      const newPos = pos.clone().add(this.velocity);
      
      // Check ground collision with terrain
      const newDir = newPos.clone().normalize();
      const terrainHeight = this.getTerrainHeight(newDir);
      const terrainRadius = this.radius + terrainHeight;
      
      // If we'd be below terrain, place on surface
      if (newPos.length() < terrainRadius + 0.2) {
        // Position at surface with small offset
        this.yawObject.position.copy(newDir.multiplyScalar(terrainRadius + 0.2));
        
        // Calculate up vector at new position
        const surfaceNormal = this.yawObject.position.clone().normalize();
        
        // Calculate how steep this surface is - using slight ray offset to check area
        const checkDist = 0.5; // Check a bit ahead for slopes
        const checkDir1 = newDir.clone().add(new THREE.Vector3(0.1, 0, 0).normalize()).normalize();
        const checkDir2 = newDir.clone().add(new THREE.Vector3(0, 0, 0.1).normalize()).normalize();
        
        const h1 = this.getTerrainHeight(checkDir1);
        const h2 = this.getTerrainHeight(checkDir2);
        
        // If slope is too steep, slide instead of stopping
        const heightDiff = Math.max(Math.abs(h1 - terrainHeight), Math.abs(h2 - terrainHeight));
        const isSlope = heightDiff > 0.2;
        
        // Project velocity onto surface plane - only cancel downward velocity
        const verticalSpeed = this.velocity.dot(surfaceNormal);
        if (verticalSpeed < 0) { // Only cancel downward velocity
          const verticalVelocity = surfaceNormal.clone().multiplyScalar(verticalSpeed);
          this.velocity.sub(verticalVelocity);
          
          // Apply landing friction - less on slopes
          this.velocity.multiplyScalar(isSlope ? 0.95 : 0.6);
          
          // Keep sliding state on slopes
          this.sliding = isSlope;
          this.isJumping = false;
          this.onGround = true;
          
          if (!isSlope) {
            console.log("Landed on flat ground!");
          } else {
            console.log("Landed on slope - sliding");
          }
        }
      } else {
        // Continue moving in air
        this.yawObject.position.copy(newPos);
        this.onGround = false;
      }
      
      // If on ground but still moving, apply appropriate friction
      if (this.onGround) {
        // Set friction nearly equal to 1 for almost no friction during collisions
        // (For sliding, we still apply a tiny damping factor)
        const frictionFactor = this.sliding ? 0.99 : 1.0;
        this.velocity.multiplyScalar(frictionFactor);
        
        // Optionally, you can disable low-velocity cutoff:
        // if (!this.sliding && this.velocity.lengthSq() < 0.01) {
        //   this.velocity.set(0, 0, 0);
        // }
      }
      
      // Update up vector to match position on the sphere
      this.yawObject.up.copy(this.yawObject.position.clone().normalize());
      
      // Log velocity for debugging
      if (this.isJumping) {
        const verticalComp = this.velocity.dot(this.yawObject.up);
        const horizontalComp = Math.sqrt(this.velocity.lengthSq() - verticalComp * verticalComp);
        console.log(`Jumping velocity: ${this.velocity.length().toFixed(2)}, ` +
                    `vert: ${verticalComp.toFixed(2)}, horiz: ${horizontalComp.toFixed(2)}`);
      }
    }
    
    // Calculate current height above terrain for use in movement
    const currentDir = this.yawObject.position.clone().normalize();
    const currentTerrainHeight = this.getTerrainHeight(currentDir);
    const currentTerrainRadius = this.radius + currentTerrainHeight;
    const heightAboveTerrain = this.yawObject.position.length() - currentTerrainRadius;
    
    // get camera forward
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.projectOnPlane(upDir).normalize();
    
    // compute right = forward × up
    const right = new THREE.Vector3().crossVectors(forward, upDir).normalize();
    
    // accumulate input
    const mv = new THREE.Vector3();
    if ( this.keys['w'] ) mv.add(forward);
    if ( this.keys['s'] ) mv.add(forward.clone().negate());
    if ( this.keys['a'] ) mv.add(right.clone().negate());
    if ( this.keys['d'] ) mv.add(right);

    if ( mv.lengthSq() > 0 ) {
      // Apply movement speed - reduce when in air or sliding
      const speedMultiplier = (this.onGround && !this.sliding) ? 1.0 : 0.8;
      mv.normalize().multiplyScalar(this.moveSpeed * speedMultiplier);

      // Calculate new direction on sphere
      const np = pos.clone().add(mv);
      const nDir = np.clone().normalize();
      
      // Get terrain height at new position
      const h = this.getTerrainHeight(nDir);
      
      // FIXED: Preserve height above terrain when moving
      // Instead of placing directly on terrain surface, add the current height above terrain
      const terrainPoint = nDir.clone().multiplyScalar(this.radius + h);
      const finalPos = terrainPoint.clone().add(
        nDir.clone().multiplyScalar(Math.max(0, heightAboveTerrain))
      );

      // Only skip items explicitly flagged noCollision (grass)
      const validCollidables = this.collidables.filter((obj, index) => {
        if (index === 0) return false;         // planet
        if (obj.isWater) return false;         // water
        if (obj.noCollision) return false;     // grass or other no‐collision
        // must have direction
        return !!obj.direction;
      });

      console.log(`Checking ${validCollidables.length} objects for collision`);

      // Example collision loop for trees with adjusted threshold:
      let collide = false;
      let collisionNormal = new THREE.Vector3();
      for (const obj of validCollidables) {
        const objDir = obj.direction;
        const posDir = finalPos.clone().normalize();
        const dot = posDir.dot(objDir);
        const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
        const surfaceDist = angle * this.radius;
        
        const objectRadius = obj.radius || 1.0;
        let threshold;
        if (obj.mesh.userData?.isTree || obj.mesh.userData?.isPineTree) {
          // Lower threshold from 2.0 to 1.6 so trees don't block too far out:
          threshold = Math.max(1.6, objectRadius * 0.4);
        } else {
          threshold = objectRadius * 0.5 + this.playerRadius * 0.7;
        }
        if (surfaceDist < threshold) {
          collide = true;
          collisionNormal.copy(objDir);
          break;
        }
      }

      if (!collide) {
        // no collision: move as normal
        this.yawObject.position.copy(finalPos);
        this.yawObject.up.copy(finalPos.clone().normalize());
      } else {
        // SIDE‑SWIPE: project mv onto the tangent plane of collisionNormal
        const mvDir = mv.clone().normalize();
        const projected = mvDir.projectOnPlane(collisionNormal).normalize();
        const slideDir = projected.length() > 0.001 ? projected : mvDir;
        // Use a reduced speed factor (e.g., 0.8) for sliding motion
        const speedMultiplier = (this.onGround && !this.sliding) ? 1.0 : 0.8;
        const step = slideDir.multiplyScalar(this.moveSpeed * speedMultiplier);
        
        // Candidate new position
        const candPos = this.yawObject.position.clone().add(step);
        const candDir = candPos.clone().normalize();
        const h = this.getTerrainHeight(candDir);
        const candFinal = candDir.multiplyScalar(this.radius + h + heightAboveTerrain);
        
        // Re-test candidate against each collidable
        let slideBlocked = false;
        for (const obj2 of validCollidables) {
          const dDot = Math.min(Math.max(candFinal.clone().normalize().dot(obj2.direction), -1), 1);
          const dAng = Math.acos(dDot);
          const dDist = dAng * this.radius;
          let dThresh = obj2.mesh.userData?.isTree
                          ? Math.max(1.6, obj2.radius * 0.4)
                          : obj2.radius * 0.5 + this.playerRadius * 0.7;
          if (dDist < dThresh) { slideBlocked = true; break; }
        }
        
        if (!slideBlocked) {
          this.yawObject.position.copy(candFinal);
          this.yawObject.up.copy(candFinal.clone().normalize());
          console.log("Sliding across tree trunk");
        } else {
          console.log("Side‑swipe blocked by collision");
        }
      }
    }

    // After movement, check for surface interaction
    this.checkSurfaceInteraction(upDir);
    
    // Process sliding physics on steep surfaces
    if (this.sliding && this.currentSurface) {
      const surfaceNormal = this.currentSurface.direction;
      
      // Calculate slide vector (downhill direction)
      const slideVector = new THREE.Vector3();
      slideVector.crossVectors(
        upDir.clone().cross(surfaceNormal).normalize(),
        surfaceNormal
      ).normalize();
      
      // Apply slide force
      const slideForce = this.slideAcceleration * delta * 60;
      this.velocity.add(slideVector.multiplyScalar(slideForce));
      
      // Apply friction based on surface
      const friction = this.currentSurface.friction || 0.98;
      this.velocity.multiplyScalar(friction);
      
      // Apply velocity
      this.yawObject.position.add(this.velocity);
      
      // Update orientation to match new position
      const newUpDir = this.yawObject.position.clone().normalize();
      this.yawObject.up.copy(newUpDir);
    } else {
      // Gradually reduce velocity when not sliding
      this.velocity.multiplyScalar(0.9);
    }
    
    // Update jump cooldown
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= delta;
    }
    
    // When landing, reset jump counter
    if (this.onGround && this.jumpsRemaining < this.maxJumps) {
      this.jumpsRemaining = this.maxJumps;
      console.log("Jump counter reset - ready to jump again");
    }
    
    return true;
  }

  checkSurfaceInteraction(upDir) {
    const pos = this.yawObject.position.clone();
    const rayOrigin = pos.clone();
    const rayDir = pos.clone().negate().normalize();
    
    // Cast ray downward
    const raycaster = new THREE.Raycaster(rayOrigin, rayDir);
    raycaster.far = this.playerRadius + 0.1; // Short distance
    
    // Filter collidables to check only solid objects
    const validCollidables = this.collidables.filter(obj => {
      if (!obj.mesh || !obj.direction) return false;
      if (obj.noCollision) return false;
      return true;
    });
    
    // Cast ray to check for ground
    const intersects = [];
    validCollidables.forEach(obj => {
      if (obj.mesh instanceof THREE.Mesh && obj.mesh.geometry) {
        const localRay = raycaster.ray.clone();
        const inverseMatrix = new THREE.Matrix4().copy(obj.mesh.matrixWorld).invert();
        localRay.applyMatrix4(inverseMatrix);
        
        const intersect = localRay.intersectTriangle(
          new THREE.Vector3(-1, 0, -1),
          new THREE.Vector3(-1, 0, 1),
          new THREE.Vector3(1, 0, 1),
          false,
          new THREE.Vector3()
        );
        
        if (intersect) {
          intersects.push({
            object: obj,
            point: intersect
          });
        }
      }
    });
    
    // Process the closest intersection
    if (intersects.length > 0) {
      // Sort by distance
      intersects.sort((a, b) => {
        return a.distance - b.distance;
      });
      
      const closest = intersects[0];
      const surfaceObj = closest.object;
      
      // Calculate angle between surface normal and up vector
      const surfaceNormal = surfaceObj.direction;
      const surfaceDot = upDir.dot(surfaceNormal);
      
      this.onGround = true;
      this.currentSurface = surfaceObj;
      
      // Check if surface is steep enough to slide
      if (surfaceDot < this.slideAngleThreshold && surfaceObj.mesh.userData.isRock) {
        this.sliding = true;
      }
      
      // IMPORTANT: Set on ground state here clearly
      this.onGround = true;
      console.log("Ground detected in surface check");
      
    } else {
      // Add else clause to make sure we know when we're not on ground
      // Only set false if we're close to the ground and should be checking
      const pos = this.yawObject.position;
      const dir = pos.clone().normalize();
      const terrainHeight = this.getTerrainHeight(dir);
      const terrainRadius = this.radius + terrainHeight;
      
      // If we're close to the ground but not touching any collidable, we should still be on regular ground
      const distanceToTerrain = pos.length() - terrainRadius;
      if (distanceToTerrain < 0.2) {
        this.onGround = true;
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
}
