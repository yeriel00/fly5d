import * as THREE from 'three';
import TWEEN from './libs/tween.esm.js';

/**
 * System to manage projectile physics and collisions
 */
export default class ProjectileSystem {
  /**
   * Create a new projectile system
   * @param {THREE.Scene} scene - The scene
   * @param {Object} options - Configuration options
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    
    // Debug flag to enable visual debugging
    this.debug = false;
    
    // Configure with defaults
    this.options = Object.assign({
      projectileSpeed: 40,
      gravity: 0.15,
      sphereRadius: 400,
      getTerrainHeight: null,
      projectileRadius: 3.0,
      maxProjectiles: 20,
      lifetime: 10, // Seconds until projectiles despawn
      bounceFactor: 0.6, // Energy loss on bounce
      minBounceSpeed: 5.0, // Minimum speed needed to bounce
      collidables: null, // Array of object collision data
      showCollisions: false, // Display collision effects
      splashParticleCount: 5, // Number of particles in collision splash
      debugCollisions: false, // New option to log collision details
      // ADDED: Configure apple sizes by type
      projectileRadiusByType: {
        red: 3.0,     // Standard size
        yellow: 2.5,  // Slightly smaller
        green: 2.0    // Smallest
      },
      // UPDATED: Better collision detection for fast projectiles
      CHECK_POINTS: 8,  // Increased from 3 to handle faster speeds
    }, options);
    
    // Add enableCollisionLogging flag that can be set externally
    this.enableCollisionLogging = false;
    
    // List of active projectiles
    this.projectiles = [];
    
    // Cache materials
    this.materials = {
      apple: new THREE.MeshLambertMaterial({ 
        color: 0xff2200, 
        emissive: 0x441100
      }),
      goldenApple: new THREE.MeshLambertMaterial({ 
        color: 0xffdd00, 
        emissive: 0x443300
      })
    };
    
    // Reusable vectors for physics calculations
    this._vec3 = new THREE.Vector3();
    this._vec3b = new THREE.Vector3();
    
    console.log("Projectile system created with collisions enabled");

    // Debug log to verify collidables are being passed
    if (this.options.collidables && this.options.collidables.length > 0) {
      console.log(`ProjectileSystem initialized with ${this.options.collidables.length} collidables`);
      
      // Count trees and rocks
      const trees = this.options.collidables.filter(obj => 
        obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree
      ).length;
      
      const rocks = this.options.collidables.filter(obj => 
        obj.mesh?.userData?.isRock
      ).length;
      
      console.log(`Collision objects: ${trees} trees, ${rocks} rocks`);
    } else {
      console.warn("ProjectileSystem initialized with NO collidables");
    }
  }
  
  /**
   * Create and fire a new projectile
   * @param {THREE.Vector3} position - Starting position
   * @param {THREE.Vector3} velocity - Initial velocity
   * @param {string} type - Type of projectile (e.g., 'red', 'yellow', 'green')
   * @returns {Object} The created projectile
   */
  createProjectile(position, velocity, type = 'red') {
    // Get the type-specific color
    const color = this._getProjectileColor(type);
    
    // MODIFIED: Get size based on projectile type
    const projectileRadius = this.options.projectileRadiusByType[type] || this.options.projectileRadius;
    
    // Create geometry and material based on type
    const geometry = new THREE.SphereGeometry(projectileRadius, 12, 8);
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      // Add emissive for all types - apply to red as well for consistency
      emissive: new THREE.Color(color).multiplyScalar(0.3)
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(position);
    
    // MODIFIED: Scale stem based on projectile size
    const stemGeometry = new THREE.CylinderGeometry(
      projectileRadius * 0.1, 
      projectileRadius * 0.1,
      projectileRadius * 0.5, 
      4
    );
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    
    // Position stem at top of apple
    stem.position.y = projectileRadius;
    mesh.add(stem);
    
    // Add subtle glow for ALL types, including red
    // MODIFIED: Scale glow based on projectile size
    const glowSize = projectileRadius * 1.3;
    const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 12);
    
    // Choose appropriate glow color based on type
    let glowColor;
    switch (type) {
      case 'yellow':
        glowColor = 0xffff00;
        break;
      case 'green':
        glowColor = 0x88ff88;
        break;
      case 'red':
      default:
        glowColor = 0xff4400; // Reddish glow for red apples
        break;
    }
    
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    mesh.add(glow);
    
    this.scene.add(mesh);
    
    // Create projectile object
    // ADDED: Store the actual radius used with this projectile
    const projectile = {
      position: position.clone(),
      lastPosition: position.clone(), // FIXED: Initialize lastPosition property
      velocity: velocity.clone(),
      mesh: mesh,
      mass: 1.0,
      lifetime: 0,
      type: type, // Store the projectile type
      bounceCount: 0,
      bounces: 0, // FIXED: Add missing bounces property
      maxBounces: 3, // FIXED: Initialize with default max bounces
      createdAt: Date.now(), // FIXED: Initialize createdAt timestamp for lifetime checks
      radius: projectileRadius // Store the actual radius used
    };
    
    // Add to active projectiles
    this.projectiles.push(projectile);
    
    // Log projectile creation with type and size
    console.log(`[ProjectileSystem] Created ${type} projectile (radius: ${projectileRadius}) at ${position.toArray()}. Color: ${color.toString(16)}`);
    
    return projectile;
  }

  /**
   * Get color for a projectile type
   * @param {string} type - The projectile type
   * @returns {number} - The color as a hex value
   * @private
   */
  _getProjectileColor(type) {
    switch (type) {
      case 'yellow':
        return 0xffdd00; // Yellow
      case 'green':
        return 0x33ff33; // Green
      case 'red':
      default:
        return 0xff2200; // Red (default)
    }
  }
  
  /**
   * Update all projectiles
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Count object types in collidables if debug is enabled
    if ((this.enableCollisionLogging || this.options.debugCollisions) && 
        this.projectiles.length > 0 && 
        this._lastDebugTime === undefined) {
      this._lastDebugTime = Date.now();
      
      // Log collision info
      const collidables = this.options.collidables || [];
      const treeCount = collidables.filter(obj => 
        obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree
      ).length;
      
      console.log(`Projectile system has ${this.projectiles.length} projectiles, ${collidables.length} collidables (${treeCount} trees)`);
    }
    
    // Process all active projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      
      // Check lifetime
      const age = (Date.now() - projectile.createdAt) / 1000;
      if (age > this.options.lifetime) {
        this._removeProjectile(i);
        continue;
      }
      
      // Store last position for collision line detection
      // SAFETY CHECK: Ensure lastPosition exists before copying
      if (!projectile.lastPosition) {
        projectile.lastPosition = projectile.position.clone();
      } else {
        projectile.lastPosition.copy(projectile.position);
      }
      
      // Apply physics
      this._updateProjectilePhysics(projectile, deltaTime);
      
      // Check for collisions with objects (trees, rocks, etc.)
      if (this._checkObjectCollisions(projectile)) {
        // Projectile hit something, remove it and continue
        this._removeProjectile(i);
        continue;
      }
      
      // Update mesh position
      if (projectile.mesh) {
        projectile.mesh.position.copy(projectile.position);
        
        // Add slight rotation for visual interest
        projectile.mesh.rotation.x += deltaTime * 2;
        projectile.mesh.rotation.z += deltaTime * 3;
      }
    }
  }
  
  /**
   * Check for collisions with scene objects
   * @param {Object} projectile - The projectile to check
   * @returns {boolean} Whether a collision occurred
   * @private
   */
  _checkObjectCollisions(projectile) {
    // Skip if no collidables
    if (!this.options.collidables || this.options.collidables.length === 0) {
      // Debug this more aggressively to catch if collidables is empty
      if (Math.random() < 0.01) { // Log only occasionally to avoid spam
        console.warn("ProjectileSystem: No collidables available for collision detection");
      }
      return false;
    }

    // Get projectile info
    const fromPos = projectile.lastPosition;
    const toPos = projectile.position;
    const projRadius = projectile.radius || this.options.projectileRadius; // Use stored radius
    
    // Calculate movement vector and distance
    const moveVector = toPos.clone().sub(fromPos);
    const moveDistance = moveVector.length();
    
    // If we barely moved, not worth checking detailed collisions
    if (moveDistance < 0.01) return false;

    // Enhanced tree collision detection
    for (let i = 0; i < this.options.collidables.length; i++) {
      const obj = this.options.collidables[i];
      
      // Skip invalid objects or planet
      if (!obj.mesh || obj.isPlanet || obj.noCollision) continue;
      
      // Get object position
      const objPos = obj.position || obj.mesh.position;
      if (!objPos) continue;

      // Special handling for trees
      if (obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree) {
        // For trees, we need to check the trunk as a cylinder
        const trunkRadius = obj.trunkRadius || Math.max(0.7, obj.radius * 0.2);
        const trunkHeight = obj.collisionHeight || obj.radius * 2;
        const trunkDirection = obj.direction.clone();
        
        // Trunk base is at obj.position
        const trunkBase = objPos.clone();
        // Trunk top is position + direction * height
        const trunkTop = objPos.clone().add(trunkDirection.clone().multiplyScalar(trunkHeight));
        
        // Check if projectile path intersects the trunk cylinder
        if (this._checkLineCylinderIntersection(
          fromPos, toPos,
          trunkBase, trunkTop, 
          trunkRadius + projRadius
        )) {
          if (this.debug) {
            console.log(`Tree trunk collision detected with ${obj.mesh?.name || "Unknown tree"}!`);
          }
          
          // Calculate approximate collision point (midway through intersection)
          const collisionPoint = fromPos.clone().add(toPos).multiplyScalar(0.5);
          
          // Calculate collision normal (from trunk center to collision point)
          // Project collision point onto trunk axis
          const trunkVector = trunkTop.clone().sub(trunkBase);
          const trunkLength = trunkVector.length();
          const trunkDir = trunkVector.clone().normalize();
          
          // Calculate dot product to find projection along trunk
          const pointToBase = collisionPoint.clone().sub(trunkBase);
          const dotProduct = pointToBase.dot(trunkDir);
          
          // Clamp to trunk endpoints
          const projection = Math.max(0, Math.min(trunkLength, dotProduct));
          
          // Get nearest point on trunk axis
          const nearestPoint = trunkBase.clone().add(trunkDir.multiplyScalar(projection));
          
          // Normal is direction from nearest point on trunk to collision point
          const normal = collisionPoint.clone().sub(nearestPoint).normalize();
          
          // Handle the collision
          this._handleObjectCollision(projectile, obj, collisionPoint, normal);
          return true;
        }
        
        // Continue to next object if no intersection
        continue;
      }
      
      // For non-tree objects, use sphere collision as before
      const objRadius = obj.radius || 2.0;
      
      // Skip if object is too far away (fast rejection test)
      if (objPos.distanceTo(fromPos) > objRadius + projRadius + moveDistance) {
        continue;
      }
      
      // Check for collision with sphere along movement path
      const CHECK_POINTS = this.options.CHECK_POINTS || 8; // Use more check points for faster projectiles
      
      for (let t = 0; t <= CHECK_POINTS; t++) {
        // Calculate position at this point along path (0.0 to 1.0)
        const checkPos = fromPos.clone().lerp(toPos, t / CHECK_POINTS);
        
        // Check distance to object
        const distToObj = checkPos.distanceTo(objPos);
        
        // If distance is less than combined radii, we have a collision
        if (distToObj <= (objRadius + projRadius)) {
          if (this.debug) {
            console.log(`Sphere collision detected with ${
              obj.mesh?.name || "Unknown object"
            }`);
          }
          
          // Calculate collision normal (from object center to collision point)
          const normal = checkPos.clone().sub(objPos).normalize();
          
          // Handle the collision
          this._handleObjectCollision(projectile, obj, checkPos, normal);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a line segment intersects a cylinder
   * @param {THREE.Vector3} lineStart - Start of line segment
   * @param {THREE.Vector3} lineEnd - End of line segment
   * @param {THREE.Vector3} cylinderStart - Base center of cylinder
   * @param {THREE.Vector3} cylinderEnd - Top center of cylinder
   * @param {number} cylinderRadius - Radius of cylinder
   * @returns {boolean} Whether line intersects cylinder
   * @private
   */
  _checkLineCylinderIntersection(lineStart, lineEnd, cylinderStart, cylinderEnd, cylinderRadius) {
    // Calculate cylinder axis
    const cylinderAxis = cylinderEnd.clone().sub(cylinderStart).normalize();
    
    // Calculate line vector
    const lineVector = lineEnd.clone().sub(lineStart);
    const lineLength = lineVector.length();
    const lineDir = lineVector.clone().normalize();
    
    // Points to check for closest approach
    const numPoints = 5; // Check multiple points for better detection
    
    for (let i = 0; i <= numPoints; i++) {
      // Get position along line
      const t = i / numPoints;
      const pointOnLine = lineStart.clone().add(lineDir.clone().multiplyScalar(t * lineLength));
      
      // Calculate vector from cylinder start to point
      const pointToStart = pointOnLine.clone().sub(cylinderStart);
      
      // Project this vector onto cylinder axis to find distance along axis
      const projectionAlongAxis = pointToStart.dot(cylinderAxis);
      
      // Clamp to cylinder length
      const cylinderLength = cylinderEnd.distanceTo(cylinderStart);
      const clampedProjection = Math.max(0, Math.min(cylinderLength, projectionAlongAxis));
      
      // Find nearest point on cylinder axis
      const nearestAxisPoint = cylinderStart.clone().add(
        cylinderAxis.clone().multiplyScalar(clampedProjection)
      );
      
      // Calculate distance from point to axis
      const distanceToAxis = pointOnLine.distanceTo(nearestAxisPoint);
      
      // Check if point is within cylinder radius
      if (distanceToAxis <= cylinderRadius) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Calculate closest point on a line segment to a point
   * @param {THREE.Vector3} lineStart - Start of line 
   * @param {THREE.Vector3} lineEnd - End of line
   * @param {THREE.Vector3} point - Point to check distance from
   * @returns {THREE.Vector3} Closest point on line segment
   */
  _closestPointOnLine(lineStart, lineEnd, point) {
    const line = lineEnd.clone().sub(lineStart);
    const lineLength = line.length();
    
    // Handle zero-length line
    if (lineLength === 0) return lineStart.clone();
    
    const lineDirection = line.normalize();
    const pointToLineStart = point.clone().sub(lineStart);
    
    // Calculate projection of point onto line
    const projection = pointToLineStart.dot(lineDirection);
    
    // Clamp to line segment
    const clampedProjection = Math.max(0, Math.min(lineLength, projection));
    
    // Calculate closest point
    return lineStart.clone().add(lineDirection.multiplyScalar(clampedProjection));
  }
  
  /**
   * Handle collision with an object - ENHANCED VERSION
   * @param {Object} projectile - The projectile
   * @param {Object} obj - The object hit
   * @param {THREE.Vector3} collisionPoint - Point of collision
   * @param {THREE.Vector3} normal - Surface normal at collision point
   * @private
   */
  _handleObjectCollision(projectile, obj, collisionPoint, normal) {
    // Always create visual effect for collision to help verify it's working
    this._createCollisionEffect(collisionPoint, projectile.type);
    
    // Get projectile speed for bounce calculation
    const speed = projectile.velocity.length();
    
    // Add helpful debug info
    console.log(`Collision with speed: ${speed.toFixed(2)}, max bounces: ${projectile.maxBounces}, current bounces: ${projectile.bounces}`);
    
    // Check if we should bounce
    if (speed > this.options.minBounceSpeed && projectile.bounces < projectile.maxBounces) {
      // Show bounce debug
      console.log(`Bouncing projectile with factor: ${this.options.bounceFactor}`);
      
      // Apply bounce using the collision normal
      projectile.velocity.reflect(normal);
      
      // Apply energy loss
      projectile.velocity.multiplyScalar(this.options.bounceFactor);
      
      // Position slightly away from collision point to avoid re-collision
      projectile.position.copy(collisionPoint.clone().addScaledVector(
        normal, this.options.projectileRadius * 1.5
      ));
      
      // Count bounce
      projectile.bounces++;
      
      // Play bounce sound
      if (window.game?.audio) {
        // Select appropriate sound based on object
        let sound = 'bounce';
        
        if (obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree) {
          sound = 'woodBounce';
        } else if (obj.mesh?.userData?.isRock) {
          sound = 'rockBounce';
        }
        
        window.game.audio.playSound(sound, 0.3);
      }
      
      // Return false to keep the projectile active
      return false;
    }
    
    // No bounce, handle full collision
    
    // Play impact sound if available
    if (window.game?.audio) {
      const sound = obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree ? 
        'woodImpact' : obj.mesh?.userData?.isRock ? 'rockImpact' : 'impact';
      
      window.game.audio.playSound(sound, 0.5);
    }
    
    // Handle special collision effects
    if (obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree) {
      // For trees, maybe make apples fall
      if (window.game?.appleSystem && Math.random() < 0.3) {
        window.game.appleSystem.forceDropRandomApple();
      }
    } else if (obj.mesh?.userData?.isRock) {
      // For rocks, create a spark effect
      // UPDATED: Pass projectile type to createSparkEffect
      this._createSparkEffect(collisionPoint, projectile.type);
    }
    
    // Return true to have the projectile removed
    return true;
  }
  
  /**
   * Create spark effect for rock impacts
   * @param {THREE.Vector3} position - Impact position
   * @param {string} type - Projectile type [ADDED]
   * @private
   */
  _createSparkEffect(position, type = 'red') { // Added type parameter with default
    // Only create if showCollisions is true
    if (!this.options.showCollisions) return;
    
    // Create some tiny bright particles
    const particleCount = 3;
    
    // UPDATED: Determine base color based on projectile type
    let baseColor;
    switch (type) {
      case 'yellow':
        baseColor = 0xffffbb; // Yellowish-white
        break;
      case 'green':
        baseColor = 0xccffcc; // Greenish-white
        break;
      case 'red':
      default:
        baseColor = 0xffffbb; // Default bright yellow-white
        break;
    }
    
    for (let i = 0; i < particleCount; i++) {
      // Create tiny bright particle
      const size = 0.2 + Math.random() * 0.2;
      const geometry = new THREE.SphereGeometry(size, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color: baseColor, // Use the color based on type
        transparent: true,
        opacity: 0.9
      });
      
      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(position);
      
      // Add random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(2 + Math.random() * 3);
      
      // Add to scene
      this.scene.add(particle);
      
      // Faster animation
      const duration = 150 + Math.random() * 100;
      
      new TWEEN.Tween(material)
        .to({ opacity: 0 }, duration)
        .onComplete(() => {
          this.scene.remove(particle);
        })
        .start();
        
      // Move particle
      new TWEEN.Tween(particle.position)
        .to({
          x: particle.position.x + velocity.x,
          y: particle.position.y + velocity.y,
          z: particle.position.z + velocity.z
        }, duration)
        .start();
    }
  }
  
  /**
   * Update projectile physics
   * @param {Object} projectile - The projectile to update
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  _updateProjectilePhysics(projectile, deltaTime) {
    // Get normalized direction for gravity (from sphere center to projectile)
    this._vec3.copy(projectile.position).normalize();
    
    // Apply gravity in the direction toward sphere center
    projectile.velocity.addScaledVector(
      this._vec3.negate(), 
      this.options.gravity * deltaTime * 60
    );
    
    // ADDED: Cap max delta for physics at 1/30 to prevent tunneling with very fast projectiles
    const effectiveDelta = Math.min(deltaTime, 1/30); 
    
    // Apply velocity (with capped delta)
    this._vec3.copy(projectile.velocity).multiplyScalar(effectiveDelta);
    this._vec3b.copy(projectile.position).add(this._vec3);
    
    // Check for terrain collision
    const terrainHeight = this.options.getTerrainHeight ? 
                        this.options.getTerrainHeight(this._vec3b.clone().normalize()) : 
                        0;
                        
    const groundRadius = this.options.sphereRadius + terrainHeight;
    
    // Check if new position is below ground level
    if (this._vec3b.length() < groundRadius + this.options.projectileRadius) {
      // Collision detected
      this._handleCollision(projectile, groundRadius);
    } else {
      // No collision, update position
      projectile.position.copy(this._vec3b);
    }
  }
  
  /**
   * Handle projectile collision with terrain
   * @param {Object} projectile - The projectile
   * @param {number} groundRadius - The ground radius at collision point
   * @private
   */
  _handleCollision(projectile, groundRadius) {
    // Bounce if we haven't exceeded max bounces
    if (projectile.bounces < projectile.maxBounces) {
      // Calculate reflection
      const normal = projectile.position.clone().normalize();
      const speed = projectile.velocity.length();
      
      // Only bounce if speed is high enough
      if (speed > this.options.minBounceSpeed) {
        // Apply bounce
        projectile.velocity.reflect(normal);
        
        // Apply energy loss
        projectile.velocity.multiplyScalar(this.options.bounceFactor);
        
        // Position slightly above ground
        projectile.position.copy(
          normal.multiplyScalar(groundRadius + this.options.projectileRadius * 1.1)
        );
        
        // Count bounce
        projectile.bounces++;
        
        // Create bounce effect if enabled
        if (this.options.showCollisions) {
          this._createCollisionEffect(projectile.position, projectile.type);
        }
        
        // Play bounce sound
        if (window.game?.audio) {
          window.game.audio.playSound('bounce', 0.3);
        }
      } else {
        // Rest on ground
        projectile.velocity.set(0, 0, 0);
        
        // Position at ground level
        const normal = projectile.position.clone().normalize();
        projectile.position.copy(
          normal.multiplyScalar(groundRadius + this.options.projectileRadius * 0.7)
        );
        
        // Align projectile to surface
        if (projectile.mesh) {
          const upVector = normal.clone();
          const rotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            upVector
          );
          projectile.mesh.quaternion.copy(rotation);
        }
      }
    } else {
      // Remove projectile after maximum bounces
      const index = this.projectiles.indexOf(projectile);
      if (index !== -1) {
        this._removeProjectile(index);
      }
    }
  }
  
  /**
   * Remove a projectile by index
   * @param {number} index - Index in the projectiles array
   * @private
   */
  _removeProjectile(index) {
    if (index < 0 || index >= this.projectiles.length) return;
    
    const projectile = this.projectiles[index];
    
    // Remove from scene
    if (projectile.mesh) {
      this.scene.remove(projectile.mesh);
    }
    
    // Remove from array
    this.projectiles.splice(index, 1);
  }
  
  /**
   * Clear all projectiles
   */
  clear() {
    // Remove all projectiles from scene and tracking
    this.projectiles.forEach(projectile => {
      if (projectile.mesh) {
        this.scene.remove(projectile.mesh);
      }
    });
    
    this.projectiles = [];
  }
  
  /**
   * Set collision display mode
   * @param {boolean} show - Whether to show collision effects
   */
  setCollisionDisplay(show) {
    this.options.showCollisions = show;
    return this.options.showCollisions;
  }

  /**
   * Helper method to estimate distance from point to line segment
   * @param {THREE.Vector3} point - Point to check distance from
   * @param {THREE.Vector3} lineStart - Start of line
   * @param {THREE.Vector3} lineEnd - End of line
   * @returns {number} Approximate distance from point to line segment
   * @private
   */
  _getApproxDistanceToSegment(point, lineStart, lineEnd) {
    // This is an approximation that is fast but may overestimate
    const lineDir = lineEnd.clone().sub(lineStart).normalize();
    const pointToStart = point.clone().sub(lineStart);
    
    // Project pointToStart onto lineDir
    const projLength = pointToStart.dot(lineDir);
    
    // Clamp to segment
    const clampedProj = Math.max(0, Math.min(projLength, lineEnd.distanceTo(lineStart)));
    
    // Find closest point on line
    const closest = lineStart.clone().addScaledVector(lineDir, clampedProj);
    
    // Return distance to closest point
    return point.distanceTo(closest);
  }

  /**
   * Create visual effect for collision
   * @param {THREE.Vector3} position - Collision position
   * @param {string} type - Projectile type
   * @private
   */
  _createCollisionEffect(position, type) {
    // Use minimal particles for performance
    const particleCount = this.options.splashParticleCount;
    
    // UPDATED: Get appropriate color based on projectile type
    let color;
    switch (type) {
      case 'yellow':
        color = 0xffdd00; // Yellow
        break;
      case 'green':
        color = 0x33ff33; // Green
        break;
      case 'red':
      default:
        color = 0xff2200; // Red (default)
        break;
    }
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
      // Create particle
      const size = 0.4 + Math.random() * 0.4;
      const geometry = new THREE.SphereGeometry(size, 6, 6);
      const material = new THREE.MeshBasicMaterial({
        color: color, // Use the color we determined from the type
        transparent: true,
        opacity: 0.8
      });
      
      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(position);
      
      // Add random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2, // Mostly upward
        (Math.random() - 0.5) * 2
      ).multiplyScalar(2 + Math.random() * 3);
      
      // Add to scene
      this.scene.add(particle);
      
      // Animate particles
      const duration = 300 + Math.random() * 200;
      
      new TWEEN.Tween(material)
        .to({ opacity: 0 }, duration)
        .onComplete(() => {
          this.scene.remove(particle);
          geometry.dispose();
          material.dispose();
        })
        .start();
        
      // Move particle
      new TWEEN.Tween(particle.position)
        .to({
          x: particle.position.x + velocity.x,
          y: particle.position.y + velocity.y,
          z: particle.position.z + velocity.z
        }, duration)
        .start();
    }
  }
  
  /**
   * Enable debug logging
   * @param {boolean} enabled - Whether to enable debugging
   */
  enableDebug(enabled = true) {
    this.debug = enabled;
    console.log(`Projectile collision debug ${enabled ? 'enabled' : 'disabled'}`);
  }
}
