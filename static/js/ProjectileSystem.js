import * as THREE from 'three';
import { getFullTerrainHeight } from './world_objects.js';
// Add TWEEN import
import TWEEN from './libs/tween.esm.js';

/**
 * Manages projectiles and slingshot mechanics for the FPS game
 */
export default class ProjectileSystem {
  /**
   * Create a new projectile system
   * @param {THREE.Scene} scene - The 3D scene
   * @param {Object} options - Configuration options
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = Object.assign({
      sphereRadius: 400,
      gravity: 0.15,
      projectileRadius: 1.0,
      // SPEED BOOST: Much faster projectile speed
      projectileSpeed: 65, // Increased from 40 for more snappy feel
      maxProjectiles: 50,
      projectileLifetime: 6000, // milliseconds
      // BOUNCE BOOST: More bouncy collisions
      bounceFactor: 0.75, // Increased from 0.6 for more energetic bounces
      minBounceSpeed: 5.0,
      getTerrainHeight: getFullTerrainHeight,
      collidables: []
    }, options);

    // Projectile collections
    this.projectiles = [];
    this.projectilePool = [];

    // Slingshot state
    this.slingshotState = {
      charging: false,
      power: 0,
      minPower: 0.2,
      maxPower: 1.0,
      chargeSpeed: 0.8, // Power increase per second
      direction: new THREE.Vector3()
    };
    
    // Initialize projectile materials
    this.initMaterials();
  }

  /**
   * Initialize materials for different projectile types
   */
  initMaterials() {
    // Create more visible apple material with better lighting properties
    this.appleMaterial = new THREE.MeshStandardMaterial({
      color: 0xff2200,  // Brighter red
      roughness: 0.6,
      metalness: 0.1,
      emissive: 0x330000, // Slight emissive glow
    });

    // Make golden apples more visible too
    this.goldenAppleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdd00,  // Brighter gold
      roughness: 0.4,
      metalness: 0.8,
      emissive: 0x332200, // Golden glow
    });
  }

  /**
   * Start charging the slingshot
   * @param {THREE.Vector3} direction - Initial aim direction
   */
  startCharging(direction) {
    console.log("🔋 ProjectileSystem.startCharging called");
    
    // ULTRA ROBUST: Create a completely fresh state object with maximum charge speed
    this.slingshotState = {
      charging: true,
      power: 0.01,         // Start at 1%
      minPower: 0.01,      // Minimum power 1%
      maxPower: 1.0,       // Maximum power 100%
      chargeSpeed: 3.0,    // EXTREME: Make charging super fast (was 0.8)
      direction: direction ? direction.clone() : new THREE.Vector3(0, 0, -1)
    };
    
    console.log("🔋 Slingshot charging initialized with fast charge:", 
      JSON.stringify({
        power: this.slingshotState.power,
        chargeSpeed: this.slingshotState.chargeSpeed
      })
    );
    
    // Return visual feedback
    return {
      charging: true,
      power: this.slingshotState.power
    };
  }

  /**
   * Update charge level while holding
   * @param {number} deltaTime - Time since last update
   * @param {THREE.Vector3} direction - Current aim direction
   */
  updateCharge(deltaTime, direction) {
    // ULTRA ROBUST: Check if slingshotState exists, if not, recreate it
    if (!this.slingshotState) {
      console.error("⚠️ slingshotState was undefined! Recreating it");
      this.slingshotState = {
        charging: true,
        power: 0.01,
        minPower: 0.01,
        maxPower: 1.0,
        chargeSpeed: 3.0,
        direction: direction ? direction.clone() : new THREE.Vector3(0, 0, -1)
      };
    }
    
    if (!this.slingshotState.charging) {
      console.warn("⚠️ updateCharge called but not in charging state");
      // CRITICAL FIX: Force charging to be true if we're in this method
      this.slingshotState.charging = true;
      console.log("🛠️ Forced charging state to true");
    }

    // Update direction if provided
    if (direction) {
      this.slingshotState.direction.copy(direction);
    }
    
    // ULTRA ROBUST: Force deltaTime to be reasonable if it's NaN or too large
    if (isNaN(deltaTime) || deltaTime > 0.1) {
      deltaTime = 0.016; // 60fps fallback
      console.warn(`⚠️ Invalid deltaTime (${deltaTime}), using fallback value: 0.016`);
    }
    
    // CRITICAL FIX: Log every update call to see if we're updating
    console.log(`⚡ Updating charge: power=${this.slingshotState.power.toFixed(2)}, deltaTime=${deltaTime.toFixed(4)}, speed=${this.slingshotState.chargeSpeed.toFixed(1)}`);
    
    // ULTRA ROBUST: Store old power for debug output
    const oldPower = this.slingshotState.power;
    
    // ULTRA ROBUST: Ensure charge always increases by using a faster charge speed
    this.slingshotState.power = Math.min(
      this.slingshotState.maxPower,
      oldPower + (this.slingshotState.chargeSpeed * deltaTime)
    );
    
    // Calculate the actual power increase
    const powerIncrease = this.slingshotState.power - oldPower;
    console.log(`Power increase: +${powerIncrease.toFixed(4)}`);
    
    // Debug when we cross percentage thresholds
    const oldPercent = Math.floor(oldPower * 100);
    const newPercent = Math.floor(this.slingshotState.power * 100);
    
    if (oldPercent !== newPercent) {
      console.log(`🔋 Charge: ${newPercent}% (power=${this.slingshotState.power.toFixed(2)}, speed=${this.slingshotState.chargeSpeed.toFixed(1)})`);
    }
    
    // Return state for UI updates
    return {
      charging: true,
      power: this.slingshotState.power,
      direction: this.slingshotState.direction.clone()
    };
  }

  /**
   * Release the slingshot to fire a projectile
   * @param {THREE.Vector3} position - Launch position
   * @param {Object} options - Optional parameters like projectile type
   * @returns {Object} The fired projectile or null
   */
  release(position, options = {}) {
    if (!this.slingshotState.charging) {
      console.log("Tried to release but slingshot is not charging");
      return null;
    }

    // FIXED: Get direction from options if provided, otherwise use stored direction
    const direction = options.direction || this.slingshotState.direction;
    
    // Debug the release
    console.log(`Releasing slingshot with power: ${this.slingshotState.power.toFixed(2)}`);
    
    // FIXED: Apply a MUCH stronger velocity multiplier based on power
    // Make fully charged shots much faster to fix weak shot issue
    const powerMultiplier = 1.0 + (this.slingshotState.power * 2.0); // Full charge = 3x speed
    
    // Calculate velocity based on power and direction with the boost
    const velocity = direction.clone()
      .normalize()
      .multiplyScalar(
        this.options.projectileSpeed * this.slingshotState.power * powerMultiplier
      );

    console.log(`Projectile speed: ${velocity.length().toFixed(2)}`);

    // Create the projectile
    const projectile = this.createProjectile(
      position.clone(), 
      velocity,
      options.type || 'apple'
    );
    
    // Reset slingshot state
    const finalPower = this.slingshotState.power;
    this.slingshotState.charging = false;
    this.slingshotState.power = 0;
    
    return {
      projectile,
      power: finalPower
    };
  }

  /**
   * Cancel the current charge without firing
   */
  cancelCharge() {
    this.slingshotState.charging = false;
    this.slingshotState.power = 0;
  }

  /**
   * Create a new projectile
   * @param {THREE.Vector3} position - Starting position
   * @param {THREE.Vector3} velocity - Initial velocity
   * @param {string} type - Projectile type ('apple', 'goldenApple')
   * @returns {Object} The projectile object
   */
  createProjectile(position, velocity, type = 'apple') {
    // Try to reuse a projectile from pool
    let projectile = this.projectilePool.pop();
    
    if (!projectile) {
      // IMPROVED: Create larger apple geometry with more segments for better appearance
      // Increase radius by 3x from the default and use more segments for smoother look
      const geometry = new THREE.SphereGeometry(this.options.projectileRadius * 3, 12, 10);
      
      // Create mesh with appropriate material based on type
      const material = type === 'goldenApple' ? this.goldenAppleMaterial : this.appleMaterial;
      const mesh = new THREE.Mesh(geometry, material);
      
      // Enable shadows for better visibility
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // IMPORTANT: Add a stem to make it clearly look like an apple
      const stemGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 4);
      stemGeometry.translate(0, this.options.projectileRadius * 3, 0); // Position at top of apple
      
      const stemMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x553311, 
        roughness: 0.9 
      });
      
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      mesh.add(stem); // Add stem as child of apple
      
      // Create projectile object
      projectile = {
        mesh,
        velocity: new THREE.Vector3(),
        type,
        active: true,
        created: Date.now(),
        hasCollided: false,
        onCollideCallback: null
      };
    }
    
    // Set up the projectile
    projectile.mesh.position.copy(position);
    projectile.velocity.copy(velocity);
    
    // IMPROVED: Add more dramatic spin to the projectile for more dynamic flight
    projectile.spin = {
      axis: new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5, 
        Math.random() - 0.5
      ).normalize(),
      // BOOST: Faster spin speed for more visual flair
      speed: Math.random() * 4 + 6 // Much faster spin (was 2+3)
    };
    
    projectile.active = true;
    projectile.created = Date.now();
    projectile.hasCollided = false;
    
    // FIXED: Create proper orientation for the apple
    // Ensure the apple's stem always points "up" relative to the planet surface
    const dirToCenter = position.clone().negate().normalize();
    const directionOfTravel = velocity.clone().normalize();
    
    // Set quaternion to orient the apple with stem away from planet center
    projectile.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirToCenter);
    
    // Add to scene and active projectiles list
    this.scene.add(projectile.mesh);
    this.projectiles.push(projectile);
    
    // Log creation for debugging
    console.log(`Created ${type} projectile at position:`, position);
    console.log(`Velocity:`, velocity);
    
    // Limit total projectiles by removing oldest if needed
    if (this.projectiles.length > this.options.maxProjectiles) {
      this.removeProjectile(this.projectiles[0]);
    }
    
    return projectile;
  }

  /**
   * Remove a projectile and return it to the pool
   * @param {Object} projectile - The projectile to remove
   */
  removeProjectile(projectile) {
    const index = this.projectiles.indexOf(projectile);
    if (index !== -1) {
      this.projectiles.splice(index, 1);
      this.scene.remove(projectile.mesh);
      
      // Reset and pool
      projectile.active = false;
      projectile.hasCollided = false;
      this.projectilePool.push(projectile);
    }
  }

  /**
   * Update all projectiles
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Update any active TWEEN animations if available
    if (typeof TWEEN !== 'undefined') {
      TWEEN.update();
    }

    const now = Date.now();
    const gravity = this.options.gravity;
    const sphereRadius = this.options.sphereRadius;
    const expiredProjectiles = [];
    
    // Update each active projectile
    for (const projectile of this.projectiles) {
      // Check lifetime
      if (now - projectile.created > this.options.projectileLifetime) {
        expiredProjectiles.push(projectile);
        continue;
      }
      
      // Check delayed removal time (for better bounce visualization)
      if (projectile.removeTime && now > projectile.removeTime) {
        expiredProjectiles.push(projectile);
        continue;
      }
      
      // Get current position and normalized direction (for gravity)
      const pos = projectile.mesh.position;
      const dir = pos.clone().normalize();
      
      // IMPROVED: Apply increasing gravity based on flight time for more dramatic arcs
      const flightTime = (now - projectile.created) / 1000; // seconds in flight
      // FIXED: Apply stronger gravity multiplier for better physics
      let gravityMultiplier = Math.min(1.0 + flightTime * 0.4, 2.5); // Up to 2.5x gravity over time
      
      // FIXED: Apply extra gravity after tree bounces
      if (projectile.userData?.bounceGravityMult) {
        gravityMultiplier *= projectile.userData.bounceGravityMult;
      }
      
      const gravityVec = dir.clone().negate().multiplyScalar(gravity * gravityMultiplier * deltaTime * 60);
      projectile.velocity.add(gravityVec);
      
      // NEW APPROACH: Continuous collision detection
      // Store original position before applying velocity
      const originalPos = pos.clone();
      
      // Calculate the intended position after velocity is applied
      const intendedPos = originalPos.clone().add(
        projectile.velocity.clone().multiplyScalar(deltaTime)
      );
      
      // Create a ray from original position to intended position
      const moveDir = intendedPos.clone().sub(originalPos).normalize();
      const moveDistance = originalPos.distanceTo(intendedPos);
      
      // Track if we had a collision
      let hadCollision = false;
      
      // First check if the movement ray intersects any objects
      // Use a slightly larger collision radius for this check to be more conservative
      const collisionPadding = 1.5; // Extra safety factor
      
      // Check objects first (more important visually than terrain)
      const objectCollision = this._checkContinuousObjectCollisions(
        projectile,
        originalPos,
        moveDir,
        moveDistance,
        collisionPadding
      );
      
      if (objectCollision) {
        // We hit an object - apply the collision response
        hadCollision = true;
        
        // Object collisions are already handled by _checkContinuousObjectCollisions
        
        // Log collision information
        if (Math.random() < 0.05) { // Only log occasionally
          console.log("Object collision at distance:", objectCollision.distance);
        }
      } else {
        // If no object collisions, check terrain collision
        const terrainCollision = this._checkContinuousTerrainCollision(
          projectile,
          originalPos,
          moveDir, 
          moveDistance,
          sphereRadius
        );
        
        if (terrainCollision) {
          hadCollision = true;
          
          // Terrain collisions are handled by _checkContinuousTerrainCollision
        } else {
          // No collision occurred, move normally
          pos.copy(intendedPos);
        }
      }
      
      // IMPROVED: Apply spin for visual effect (outside collision handling)
      if (projectile.spin) {
        projectile.mesh.rotateOnAxis(projectile.spin.axis, projectile.spin.speed * deltaTime);
      }
      
      // Update projectile orientation to follow trajectory
      if (!hadCollision && projectile.velocity.lengthSq() > 0.1) {
        // Update orientation based on current velocity and direction
        const forward = projectile.velocity.clone().normalize();
        const up = dir.clone(); // Always point stem away from planet center
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();
        
        // Recalculate up to ensure orthogonality
        const correctedUp = new THREE.Vector3().crossVectors(right, forward).normalize();
        
        // Create rotation matrix and apply
        const rotMatrix = new THREE.Matrix4().makeBasis(right, correctedUp, forward.negate());
        projectile.mesh.quaternion.setFromRotationMatrix(rotMatrix);
      }
    }
    
    // Clean up expired projectiles
    for (const projectile of expiredProjectiles) {
      this.removeProjectile(projectile);
    }

    // Update bounce effect particles
    if (this.bounceParticles && this.bounceParticles.length > 0) {
      const expiredParticles = [];
      
      for (const particle of this.bounceParticles) {
        // Check if particle should be removed
        const age = now - particle.userData.birthTime;
        if (age > particle.userData.lifetime) {
          expiredParticles.push(particle);
          continue;
        }
        
        // Update position based on velocity
        particle.position.add(
          particle.userData.velocity.clone().multiplyScalar(deltaTime)
        );
        
        // Apply gravity
        const dir = particle.position.clone().normalize();
        particle.userData.velocity.addScaledVector(
          dir.clone().negate(), 
          this.options.gravity * 0.5 * deltaTime * 60
        );
        
        // Fade out
        const progress = age / particle.userData.lifetime;
        particle.material.opacity = 0.8 * (1 - progress);
        
        // Scale down
        const scale = 1 - progress * 0.6;
        particle.scale.set(scale, scale, scale);
      }
      
      // Remove expired particles
      for (const particle of expiredParticles) {
        const index = this.bounceParticles.indexOf(particle);
        if (index !== -1) {
          this.bounceParticles.splice(index, 1);
          this.scene.remove(particle);
        }
      }
    }
  }

  /**
   * Extract terrain collision into a separate method for cleaner code
   */
  _checkTerrainCollision(projectile, sphereRadius) {
    const pos = projectile.mesh.position;
    const dir = pos.clone().normalize();
    
    // Check terrain collision
    const terrainHeight = this.options.getTerrainHeight(dir);
    const terrainRadius = sphereRadius + terrainHeight;
    
    // If collided with terrain
    if (pos.length() < terrainRadius + this.options.projectileRadius) {
      if (!projectile.hasCollided) {
        projectile.hasCollided = true;
        
        // Handle collision - bounce with energy loss
        const upDir = dir.clone();
        const verticalVel = projectile.velocity.dot(upDir);
        
        if (verticalVel < 0) {
          // Remove downward component
          projectile.velocity.addScaledVector(upDir, -verticalVel * 1.6);
          
          // IMPROVED: Use configured bounce factor
          projectile.velocity.multiplyScalar(this.options.bounceFactor);
          
          // IMPROVED: Add slight randomization to bounces for natural feel
          const randomDir = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
          );
          projectile.velocity.add(randomDir);
          
          // IMPROVED: Use configured minimum bounce speed
          if (projectile.velocity.length() < this.options.minBounceSpeed) {
            return true; // Mark for expiration
          }
          
          // Move above ground to prevent sticking
          pos.copy(dir.multiplyScalar(terrainRadius + this.options.projectileRadius * 1.2));
        }
        return true; // Collision occurred
      }
    } else {
      // Reset collision flag when not colliding
      projectile.hasCollided = false;
    }
    
    return false; // No collision
  }

  /**
   * Renamed method for clarity and improved collision detection
   */
  _checkObjectCollisions(projectile) {
    if (!this.options.collidables || this.options.collidables.length < 2) return false;
    
    const pos = projectile.mesh.position;
    const dir = pos.clone().normalize();
    
    // IMPROVED: Store projectile properties for more efficient access
    const projectileRadius = this.options.projectileRadius;
    const projectileHeight = pos.length() - this.options.sphereRadius;
    
    // Skip the first collidable (planet itself)
    for (let i = 1; i < this.options.collidables.length; i++) {
      const obj = this.options.collidables[i];
      
      // Skip non-collidable objects
      if (!obj.position || !obj.direction || obj.noCollision) continue;
      
      // IMPROVED: Use more precise collision detection based on object type
      const isTree = obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree;
      const isRock = obj.mesh?.userData?.isRock || obj.mesh?.name?.includes('Rock');
      
      // IMPROVED: Early rejection test - check basic distance first for performance
      const objPos = obj.position;
      const basicDist = pos.distanceTo(objPos);
      const maxPossibleRadius = Math.max(20, obj.radius * 2); // Safety margin
      
      // Skip detailed tests if clearly too far away
      if (basicDist > maxPossibleRadius + projectileRadius) continue;
      
      // Get angular distance between projectile and object (great-circle distance on sphere)
      const objDir = obj.direction;
      const dot = dir.dot(objDir);
      const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
      
      // Convert to surface distance
      const surfaceDist = angle * this.options.sphereRadius;
      
      // IMPROVED: Calculate object-specific collision parameters with better precision
      let collisionRadius = projectileRadius;
      let heightMatch = true;
      
      if (isTree) {
        // For trees, use trunk radius for horizontal collision - even more accurate
        // Use a very tight collision radius instead of the loose one
        collisionRadius += Math.min(obj.radius * 0.2, 0.6); // Even tighter radius (was 0.25, 0.8)
        
        // Check height to see if we're hitting the trunk or foliage
        const objHeight = obj.position.length() - this.options.sphereRadius;
        const heightDiff = projectileHeight - objHeight;
        
        // Get trunk height (estimate if not specified)
        const trunkHeight = obj.collisionHeight || obj.radius * 2;
        
        // IMPROVED: More precise height check for tree parts
        if (heightDiff <= 0) {
          // Below ground level
          heightMatch = false;
        } else if (heightDiff <= trunkHeight) {
          // We're at trunk height - use narrow trunk radius
          collisionRadius = projectileRadius + Math.min(obj.radius * 0.2, 0.6);
        } else if (heightDiff < trunkHeight + (obj.radius * 2.2)) {
          // We're at foliage height - use wider foliage radius
          collisionRadius = projectileRadius + obj.radius * 0.7; // Was 0.6, increased for better response
        } else {
          // Above tree height
          heightMatch = false;
        }
      } else if (isRock) {
        // IMPROVED: Reduce rock collision radius less for more accurate hits
        collisionRadius += obj.radius * 0.8; // Was 0.7, increased for better responsiveness
      } else {
        // Default collision radius
        collisionRadius += obj.radius || 1.0;
      }
      
      // IMPROVED: Add debug visualization for collisions in flight
      if (heightMatch && Math.random() < 0.01) { // Only show occasionally
        this._visualizeCollisionCheck(pos, obj.position, surfaceDist, collisionRadius, 
                                     surfaceDist < collisionRadius);
      }
      
      // Check if collision occurs with the refined parameters
      if (heightMatch && surfaceDist < collisionRadius) {
        // IMPROVED: Add debugging for collisions
        console.log(`Projectile collision with ${obj.mesh?.name || 'object'}, distance: ${surfaceDist.toFixed(2)}, radius: ${collisionRadius.toFixed(2)}`);
        
        // Calculate response direction (away from object along surface)
        const responseDir = dir.clone().sub(
          objDir.clone().multiplyScalar(dot)
        ).normalize();
        
        // Get current speed
        const speed = projectile.velocity.length() * 0.3; // Reduce speed on collision
        
        // Set new velocity direction
        projectile.velocity = responseDir.multiplyScalar(speed);
        
        // Move projectile outside collision radius
        const correction = responseDir.clone().multiplyScalar(collisionRadius - surfaceDist + 0.05);
        projectile.mesh.position.add(correction);
        
        // Invoke collision callback if set
        if (projectile.onCollideCallback) {
          projectile.onCollideCallback(obj);
        }
        
        return true; // Collision handled
      }
    }
    
    return false; // No collision occurred
  }

  /**
   * Helper method to visualize collision checks for debugging
   */
  _visualizeCollisionCheck(projectilePos, objectPos, distance, threshold, collided) {
    // Only implement if THREE is available and we're in debug mode
    if (typeof THREE === 'undefined' || !this.debug) return;
    
    const color = collided ? 0xff0000 : 0x00ff00;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      projectilePos.clone(),
      objectPos.clone()
    ]);
    
    const lineMat = new THREE.LineBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.6
    });
    
    const line = new THREE.Line(lineGeo, lineMat);
    
    // Add to scene with auto-removal after 500ms
    this.scene.add(line);
    setTimeout(() => {
      this.scene.remove(line);
    }, 500);
  }

  /**
   * Get the current slingshot state
   */
  getSlingshotState() {
    return { ...this.slingshotState };
  }
  
  /**
   * Set a callback to be called when a particular projectile hits something
   * @param {Object} projectile - The projectile
   * @param {Function} callback - Function to call on collision
   */
  onCollide(projectile, callback) {
    if (projectile && typeof callback === 'function') {
      projectile.onCollideCallback = callback;
    }
  }
  
  /**
   * Clean up all projectiles
   */
  clear() {
    // Remove all projectiles
    while (this.projectiles.length > 0) {
      this.removeProjectile(this.projectiles[0]);
    }
  }

  /**
   * Check for continuous collision with terrain
   * @param {Object} projectile - The projectile to check
   * @param {THREE.Vector3} startPos - Start position
   * @param {THREE.Vector3} moveDir - Movement direction
   * @param {number} moveDistance - Distance of movement
   * @param {number} sphereRadius - Planet radius
   * @returns {boolean} - Whether collision occurred
   */
  _checkContinuousTerrainCollision(projectile, startPos, moveDir, moveDistance, sphereRadius) {
    // Check collision with terrain along the movement path
    // Use multiple samples along the path for better detection
    const samples = 5;
    const stepSize = moveDistance / samples;
    
    for (let i = 1; i <= samples; i++) {
      // Check at this sample point
      const sampleDist = stepSize * i;
      const samplePos = startPos.clone().add(moveDir.clone().multiplyScalar(sampleDist));
      const sampleDir = samplePos.clone().normalize();
      
      // Get terrain height at this point
      const terrainHeight = this.options.getTerrainHeight(sampleDir);
      const terrainRadius = sphereRadius + terrainHeight;
      
      // Check if we're below terrain surface
      if (samplePos.length() < terrainRadius + this.options.projectileRadius * 1.2) {
        // Collision detected - handle it
        projectile.hasCollided = true;
        
        // Handle bounce behavior
        const upDir = sampleDir.clone();
        const verticalVel = projectile.velocity.dot(upDir);
        
        // Only bounce if moving downward
        if (verticalVel < 0) {
          // Remove downward component
          projectile.velocity.addScaledVector(upDir, -verticalVel * 1.6);
          
          // Apply bounce physics
          projectile.velocity.multiplyScalar(this.options.bounceFactor);
          
          // Add slight randomization to bounces for natural feel
          const randomDir = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
          );
          projectile.velocity.add(randomDir);
          
          // Check if projectile is too slow after bounce
          if (projectile.velocity.length() < this.options.minBounceSpeed) {
            // Mark for removal on next update
            projectile.shouldRemove = true;
          }
          
          // Move above ground to prevent sticking
          // Position at surface + safe distance
          projectile.mesh.position.copy(
            sampleDir.multiplyScalar(terrainRadius + this.options.projectileRadius * 1.5)
          );
        }
        
        return true; // Collision occurred
      }
    }
    
    // Reset collision state if we're above terrain
    projectile.hasCollided = false;
    return false; // No collision
  }

  /**
   * Perform continuous collision detection with objects
   * @param {Object} projectile - The projectile to check
   * @param {THREE.Vector3} startPos - Start position
   * @param {THREE.Vector3} moveDir - Movement direction
   * @param {number} moveDistance - Distance of movement
   * @param {number} paddingFactor - Extra collision padding factor
   * @returns {Object|null} - Collision information or null if no collision
   */
  _checkContinuousObjectCollisions(projectile, startPos, moveDir, moveDistance, paddingFactor = 1.0) {
    if (!this.options.collidables || this.options.collidables.length < 2) return null;
    
    // CRITICAL FIX: Increase default padding factor for all collision checks
    paddingFactor = paddingFactor * 1.5; // Apply a global 50% padding increase
    
    const projectileRadius = this.options.projectileRadius;
    
    // Calculate the projectile's height above surface at start position
    const projectileHeight = startPos.length() - this.options.sphereRadius;
    
    // Tracking for closest collision
    let closestCollision = null;
    let closestDistance = Infinity;
    
    // Check collision with all objects except the planet
    for (let i = 1; i < this.options.collidables.length; i++) {
      const obj = this.options.collidables[i];
      
      // Skip non-collidable objects
      if (!obj.position || !obj.direction || obj.noCollision) continue;
      
      // Get object properties
      const objPos = obj.position;
      const objDir = obj.direction;
      
      // CRITICAL FIX: Special handling for trees - they need extra attention
      const isTree = obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree;
      const isRock = obj.mesh?.userData?.isRock || obj.mesh?.name?.includes('Rock');
      
      // Skip objects that are clearly far away - use a loose check
      const roughDistance = startPos.distanceTo(objPos);
      const maxCheck = isTree ? 50.0 : 30.0; // Give trees a wider collision check range
      if (roughDistance > maxCheck + moveDistance) continue;
      
      // For trees, use a completely different collision model
      if (isTree) {
        // NEW APPROACH: Model tree trunk as a cylinder instead of checking heights
        const trunkRadius = obj.trunkRadius || Math.min(obj.radius * 0.2, 0.6);
        const trunkHeight = obj.collisionHeight || obj.radius * 3;
        
        // Get object height from planet surface
        const objHeight = objPos.length() - this.options.sphereRadius;
        
        // Get vector from object base to projectile (in world space)
        const objToProjectile = startPos.clone().sub(objPos);
        
        // Project this vector onto trunk direction (up) to get height above trunk base
        const heightAlongTrunk = objToProjectile.dot(objDir);
        
        // Skip if projectile is clearly outside trunk height range
        if (heightAlongTrunk < 0 || heightAlongTrunk > trunkHeight + projectileRadius) {
          continue;
        }
        
        // Get closest distance to trunk center line
        // First get the point on the trunk center line at the same height as projectile
        const pointOnTrunkAxis = objPos.clone().add(
          objDir.clone().multiplyScalar(heightAlongTrunk)
        );
        
        // Calculate distance from projectile to this point (perpendicular to trunk)
        const distToTrunkAxis = startPos.distanceTo(pointOnTrunkAxis);
        
        // CRITICAL FIX: Apply a much more generous trunk collision model
        const effectiveRadius = trunkRadius * 1.8; // Reduced from 2.5 to make collision closer to trunk surface
        
        // Check if we're within collision distance of the trunk
        if (distToTrunkAxis < effectiveRadius + projectileRadius) {
          // This is a hit! Calculate collision details
          
          // Project movement vector onto plane perpendicular to trunk axis
          const moveInTrunkSpace = moveDir.clone().sub(
            objDir.clone().multiplyScalar(moveDir.dot(objDir))
          ).normalize();
          
          // Calculate where along the ray the collision might occur
          const distToCollision = Math.max(0, (effectiveRadius + projectileRadius - distToTrunkAxis));
          const collisionDistance = distToCollision / Math.abs(moveInTrunkSpace.dot(
            startPos.clone().sub(pointOnTrunkAxis).normalize()
          ));
          
          // Only count collisions along our movement path and find the closest one
          if (collisionDistance <= moveDistance && collisionDistance < closestDistance) {
            closestDistance = collisionDistance;
            closestCollision = {
              object: obj,
              distance: collisionDistance,
              collisionRadius: effectiveRadius,
              hitPoint: startPos.clone().add(moveDir.clone().multiplyScalar(collisionDistance)),
              isTree: true,
              isTrunk: true
            };
          }
        }
      } else {
        // Non-tree object collision (simpler model)
        let collisionRadius = projectileRadius;
        
        if (isRock) {
          // Precise rock collision
          collisionRadius += obj.radius * 0.8;
        } else {
          // General object collision
          collisionRadius += obj.radius || 1.0;
        }
        
        // Calculate ray-sphere intersection
        const objToStart = objPos.clone().sub(startPos);
        const projection = moveDir.clone().multiplyScalar(objToStart.dot(moveDir));
        const closestPoint = startPos.clone().add(projection);
        
        // Calculate closest approach distance
        const closestApproach = closestPoint.distanceTo(objPos);
        
        // Apply collision padding
        const paddedRadius = collisionRadius * paddingFactor;
        
        // Check if we're within collision distance
        if (closestApproach < paddedRadius) {
          // Calculate how far along the ray the collision might occur
          const distanceToClosestPoint = startPos.distanceTo(closestPoint);
          
          // Only use collisions along our actual path (not behind us)
          if (distanceToClosestPoint <= moveDistance && 
              distanceToClosestPoint < closestDistance) {
            closestDistance = distanceToClosestPoint;
            closestCollision = {
              object: obj,
              distance: distanceToClosestPoint,
              collisionRadius: collisionRadius,
              hitPoint: closestPoint,
              isRock: isRock
            };
          }
        }
      }
    }
    
    // If we found a collision, handle it with enhanced bounce physics
    if (closestCollision) {
      // Move to collision point minus a small safety margin
      const collisionPos = startPos.clone().add(
        moveDir.multiplyScalar(closestCollision.distance * 0.95)
      );
      projectile.mesh.position.copy(collisionPos);
      
      // FIXED: TURBO-CHARGED BOUNCE: Much better bounce physics with "juice" factor
      let responseDir;
      if (closestCollision.isTrunk) {
        // BUGFIX: Use closestCollision.object instead of undefined collisionObj
        const obj = closestCollision.object;
        const objDir = obj.direction;
        
        // Get vector from trunk axis to collision point (perpendicular to trunk)
        const pointOnTrunkAxis = obj.position.clone().add(
          objDir.clone().multiplyScalar(
            (collisionPos.clone().sub(obj.position)).dot(objDir)
          )
        );
        
        // This is the actual normal vector for the collision
        const trunkNormal = collisionPos.clone().sub(pointOnTrunkAxis).normalize();
        
        // Calculate reflection direction based on incoming vector and normal
        const incomingDir = moveDir.clone().negate();
        responseDir = incomingDir.clone().sub(
          trunkNormal.clone().multiplyScalar(2 * incomingDir.dot(trunkNormal))
        ).normalize();
        
        // FIXED: Add more vertical component to prevent apples from floating after tree collision
        responseDir.addScaledVector(objDir, 0.2); // Reduced from 0.3 to prevent floating
        responseDir.normalize();
        
        // SNAPPY: Give the response direction a bit of "snap" with impulse
        const snapFactor = 1.15; // FIXED: Reduced from 1.25 to prevent excessive bounce
        responseDir.multiplyScalar(snapFactor);
      } else {
        // Standard bounce direction for other objects, but with "snap"
        // BUGFIX: closestCollision.object has the direction and position we need
        const obj = closestCollision.object;
        const dir = collisionPos.clone().normalize();
        const objDir = obj.direction;
        const dot = dir.dot(objDir);
        
        responseDir = dir.clone().sub(
          objDir.clone().multiplyScalar(dot)
        ).normalize().multiplyScalar(1.1); // FIXED: Reduced from 1.2 to 1.1 for better control
      }
      
      // FIXED: Apply a bit more gravity influence after tree collisions
      if (closestCollision.isTrunk) {
        // Slightly increase gravity's effect on tree-bounced apples
        projectile.userData = projectile.userData || {};
        projectile.userData.bounceGravityMult = 1.4; // 40% more gravity after tree bounce
      }
      
      // TURBO: Get current speed and apply bouncier physics
      const currentSpeed = projectile.velocity.length();
      
      // FIXED: Reduce energy conservation for better physics
      // Lowered from 55% to 45% to prevent perpetual bouncing
      const speed = currentSpeed * (closestCollision.isTrunk ? 0.45 : 0.35);
      
      // Apply the new velocity with proper direction and speed
      projectile.velocity = responseDir.multiplyScalar(speed);
      
      // DYNAMIC: Scale random bounce variation based on impact speed
      // Faster impacts get more variation for dynamic feel
      const randomFactor = Math.min(0.2, 0.1 + (currentSpeed / 200)); // Cap at 0.2
      
      // Add slight random bounce variation (proportional to impact speed)
      const randomBounce = new THREE.Vector3(
        (Math.random() - 0.5) * randomFactor,
        (Math.random() - 0.5) * randomFactor,
        (Math.random() - 0.5) * randomFactor
      ).multiplyScalar(closestCollision.isTrunk ? 0.25 : 0.15);
      
      projectile.velocity.add(randomBounce);
      
      // Only remove slowest projectiles
      if (projectile.velocity.length() < this.options.minBounceSpeed * 0.2) {
        // Mark for removal but with a delay to show the bounce first
        if (!projectile.removeTime) {
          projectile.removeTime = Date.now() + 500; // Remove after 500ms (down from 800ms)
        }
      }
      
      // VISUAL FEEDBACK: Add "impact squash" for a frame to enhance bounce feel
      // Temporarily scale the projectile on impact for visual feedback
      const originalScale = projectile.mesh.scale.clone();
      // Impact direction determines the squash axis
      const impactAxis = projectile.velocity.clone().normalize();
      // Squash along impact direction, stretch perpendicular
      const squashAmount = Math.min(0.7, 0.4 + (currentSpeed / 120)); // More squash for faster impacts
      projectile.mesh.scale.set(1 + squashAmount, 1 - squashAmount, 1 + squashAmount);
      
      // Restore original scale after a short delay
      setTimeout(() => {
        if (projectile.mesh && projectile.mesh.parent) {
          // FIXED: Check if TWEEN is defined before using it
          try {
            // Try to use TWEEN if available
            if (typeof TWEEN !== 'undefined') {
              new TWEEN.Tween(projectile.mesh.scale)
                .to({x: originalScale.x, y: originalScale.y, z: originalScale.z}, 150)
                .easing(TWEEN.Easing.Elastic.Out)
                .start();
            } else {
              // Fallback to direct scale restoration if TWEEN is not available
              projectile.mesh.scale.copy(originalScale);
            }
          } catch (error) {
            // Safely handle any errors and ensure scale is restored
            console.warn("Error animating scale:", error);
            projectile.mesh.scale.copy(originalScale);
          }
        }
      }, 50);
      
      // Invoke callback if set
      if (projectile.onCollideCallback) {
        // BUGFIX: Use the correct object from closestCollision
        projectile.onCollideCallback(closestCollision.object);
      }
      
      // Visually confirm collision with a debug marker if debugging is enabled
      if (this.debug && typeof THREE !== 'undefined') {
        const markerSize = 0.3;
        const markerGeo = new THREE.SphereGeometry(markerSize, 8, 6);
        const markerMat = new THREE.MeshBasicMaterial({ 
          color: closestCollision.isTrunk ? 0xff0000 : 0xff8800,
          transparent: true,
          opacity: 0.8
        });
        
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(collisionPos);
        
        this.scene.add(marker);
        
        // Remove after 2 seconds
        setTimeout(() => {
          this.scene.remove(marker);
        }, 2000);
      }

      // BOUNCE BOOST: Create a visual bounce effect
      this._createBounceEffect(collisionPos, speed);
      
      return closestCollision;
    }
    
    return null; // No collision
  }

  /**
   * Add new method to create a visual bounce effect
   */
  _createBounceEffect(position, speed) {
    if (!this.debug) return;
    
    // Create a burst of particles at collision point
    const particleCount = Math.min(Math.floor(speed * 0.5), 8);
    
    for (let i = 0; i < particleCount; i++) {
      // Create small sphere for particle
      const size = 0.1 + Math.random() * 0.15;
      const geometry = new THREE.SphereGeometry(size, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.8
      });
      
      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(position);
      
      // Add random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(speed * 0.3);
      
      // Store velocity with the particle
      particle.userData.velocity = velocity;
      particle.userData.birthTime = Date.now();
      particle.userData.lifetime = 300 + Math.random() * 300; // 300-600ms
      
      // Add to scene
      this.scene.add(particle);
      
      // Track the particle for animation
      if (!this.bounceParticles) this.bounceParticles = [];
      this.bounceParticles.push(particle);
    }
  }
}
