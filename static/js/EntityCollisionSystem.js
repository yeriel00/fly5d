import * as THREE from 'three';

/**
 * EntityCollisionSystem provides a generic collision detection and response system
 * for all types of entities in the game: deer, birds, players, and any future entities.
 */
export class EntityCollisionSystem {
  constructor() {
    this.entities = [];
    this.projectiles = [];
  }

  /**
   * Register an entity with the collision system
   * @param {Object} entity - The entity to register
   */
  registerEntity(entity) {
    if (!this.entities.includes(entity)) {
      this.entities.push(entity);
    }
  }

  /**
   * Unregister an entity from the collision system
   * @param {Object} entity - The entity to unregister
   */
  unregisterEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
    }
  }

  /**
   * Register a projectile with the collision system
   * @param {Object} projectile - The projectile to register
   */
  registerProjectile(projectile) {
    if (!this.projectiles.includes(projectile)) {
      this.projectiles.push(projectile);
    }
  }

  /**
   * Unregister a projectile from the collision system
   * @param {Object} projectile - The projectile to unregister
   */
  unregisterProjectile(projectile) {
    const index = this.projectiles.indexOf(projectile);
    if (index !== -1) {
      this.projectiles.splice(index, 1);
    }
  }

  /**
   * Check collisions between a specific entity and other entities
   * @param {Object} entity - The entity to check collisions for
   * @returns {Array} - Array of collision results
   */
  checkEntityEntityCollisions(entity) {
    if (!entity || !entity.alive) return [];

    const collisions = [];
    
    // Skip self
    for (const otherEntity of this.entities) {
      if (otherEntity === entity || !otherEntity.alive) continue;
      
      // Use entity's collision method if available
      if (typeof entity.checkEntityCollision === 'function') {
        const collisionResult = entity.checkEntityCollision(otherEntity);
        if (collisionResult) {
          collisions.push({
            type: 'entity',
            entity: otherEntity,
            result: collisionResult
          });
        }
      } else {
        // Fallback to basic collision detection
        const collision = this.detectBasicCollision(entity, otherEntity);
        if (collision) {
          collisions.push({
            type: 'entity',
            entity: otherEntity,
            result: collision
          });
        }
      }
    }
    
    return collisions;
  }

  /**
   * Check collisions between a specific entity and all projectiles
   * @param {Object} entity - The entity to check collisions for
   * @returns {Array} - Array of collision results
   */
  checkEntityProjectileCollisions(entity) {
    if (!entity || !entity.alive) return [];

    const collisions = [];
    const projectilesToRemove = [];
    
    for (const projectile of this.projectiles) {
      if (!projectile || !projectile.mesh || projectile.removed) continue;
      
      // Use entity's collision method if available
      if (typeof entity.checkProjectileCollision === 'function') {
        const collisionResult = entity.checkProjectileCollision(projectile);
        if (collisionResult) {
          collisions.push({
            type: 'projectile',
            projectile: projectile,
            result: collisionResult
          });
          projectilesToRemove.push(projectile);
        }
      } else if (typeof entity.checkCollision === 'function') {
        // Backward compatibility with existing checkCollision method
        const collisionResult = entity.checkCollision(projectile);
        if (collisionResult) {
          collisions.push({
            type: 'projectile',
            projectile: projectile,
            result: collisionResult
          });
          projectilesToRemove.push(projectile);
        }
      } else {
        // Fallback to basic projectile collision detection
        const collision = this.detectProjectileCollision(entity, projectile);
        if (collision) {
          collisions.push({
            type: 'projectile',
            projectile: projectile,
            result: collision
          });
          projectilesToRemove.push(projectile);
        }
      }
    }
    
    // Mark projectiles for removal
    for (const projectile of projectilesToRemove) {
      projectile.removed = true;
    }
    
    return collisions;
  }

  /**
   * Update all entity collisions
   * @returns {Object} - Collision results
   */
  update() {
    const results = {
      entityCollisions: [],
      projectileCollisions: []
    };
    
    // Check entity-entity collisions
    for (const entity of this.entities) {
      if (!entity.alive) continue;
      
      // Entity-Entity collisions
      const entityCollisions = this.checkEntityEntityCollisions(entity);
      if (entityCollisions.length > 0) {
        results.entityCollisions.push({
          entity: entity,
          collisions: entityCollisions
        });
      }
      
      // Entity-Projectile collisions
      const projectileCollisions = this.checkEntityProjectileCollisions(entity);
      if (projectileCollisions.length > 0) {
        results.projectileCollisions.push({
          entity: entity,
          collisions: projectileCollisions
        });
      }
    }
    
    // Clean up removed projectiles
    this.projectiles = this.projectiles.filter(p => !p.removed);
    
    return results;
  }

  /**
   * Detect basic collision between two entities
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @returns {Object|null} - Collision result or null if no collision
   */
  detectBasicCollision(entity1, entity2) {
    // Get positions
    const pos1 = entity1.getPosition ? entity1.getPosition() : entity1.group.position;
    const pos2 = entity2.getPosition ? entity2.getPosition() : entity2.group.position;
    
    // Get collision radii
    const radius1 = entity1.getCollisionRadius ? entity1.getCollisionRadius() : 5;
    const radius2 = entity2.getCollisionRadius ? entity2.getCollisionRadius() : 5;
    
    // Calculate distance
    const distance = pos1.distanceTo(pos2);
    
    // Check if collision occurred
    if (distance <= radius1 + radius2) {
      // Calculate collision normal and penetration depth
      const collisionNormal = new THREE.Vector3().subVectors(pos2, pos1).normalize();
      const penetrationDepth = radius1 + radius2 - distance;
      
      return {
        collisionNormal,
        penetrationDepth,
        position: new THREE.Vector3().addVectors(
          pos1,
          collisionNormal.clone().multiplyScalar(radius1)
        )
      };
    }
    
    return null;
  }

  /**
   * Helper method to detect line-segment to sphere intersection for projectiles
   * @param {THREE.Vector3} lineStart - Start of the line segment
   * @param {THREE.Vector3} lineEnd - End of the line segment
   * @param {THREE.Vector3} sphereCenter - Center of the sphere
   * @param {Number} sphereRadius - Radius of the sphere
   * @returns {Boolean} - True if the line segment intersects the sphere
   */
  lineSegmentSphereIntersection(lineStart, lineEnd, sphereCenter, sphereRadius) {
    // Simple distance check first for optimization
    if (sphereCenter.distanceTo(lineStart) <= sphereRadius || 
        sphereCenter.distanceTo(lineEnd) <= sphereRadius) {
      return true;
    }
    
    // Vector from start point to sphere center
    const lineToSphere = new THREE.Vector3().subVectors(sphereCenter, lineStart);
    
    // Direction of line segment
    const lineDirection = new THREE.Vector3().subVectors(lineEnd, lineStart);
    const lineLength = lineDirection.length();
    
    // Avoid division by zero for very short line segments
    if (lineLength < 0.0001) {
      return lineStart.distanceTo(sphereCenter) <= sphereRadius;
    }
    
    lineDirection.normalize();
    const projection = lineToSphere.dot(lineDirection);
    
    // Find closest point on line segment to sphere center
    let closestPoint;
    
    // If projection is negative, closest point is line start
    if (projection < 0) {
      closestPoint = lineStart;
    } 
    // If projection is greater than line length, closest point is line end
    else if (projection > lineLength) {
      closestPoint = lineEnd;
    } 
    // Otherwise, closest point is along the line
    else {
      closestPoint = lineStart.clone().add(lineDirection.clone().multiplyScalar(projection));
    }
    
    // Distance from closest point to sphere center
    const distance = closestPoint.distanceTo(sphereCenter);
    
    // If distance is less than sphere radius, there's a collision
    return distance <= sphereRadius;
  }

  /**
   * Detect collision between an entity and a projectile
   * @param {Object} entity - The entity
   * @param {Object} projectile - The projectile
   * @returns {Object|null} - Collision result or null if no collision
   */
  detectProjectileCollision(entity, projectile) {
    if (!entity || !entity.alive || !projectile || !projectile.mesh) {
      return null;
    }
    
    // Get projectile positions
    const projectilePos = projectile.mesh.position.clone();
    
    // Calculate previous position for line-segment collision
    const velocityLength = projectile.velocity ? projectile.velocity.length() : 0;
    const trailFactor = Math.max(2.0, Math.min(10.0, velocityLength * 15));
    const velocityNormalized = projectile.velocity ? projectile.velocity.clone().normalize() : new THREE.Vector3(0, -1, 0);
    const projectilePrevPos = projectilePos.clone().sub(
      velocityNormalized.multiplyScalar(trailFactor)
    );
    
    // Get projectile radius
    const projectileRadius = (projectile.radius || 1.0) * 2.5;
    const projectileType = projectile.type || 'red';
    
    // Check body parts if entity has them
    if (entity.bodyPosition && entity.headPosition) {
      // Get body and head positions
      const bodyPos = entity.bodyPosition;
      const headPos = entity.headPosition;
      
      // Get collision radii
      const bodyRadius = entity.getBodyRadius ? entity.getBodyRadius() : 5;
      const headRadius = entity.getHeadRadius ? entity.getHeadRadius() : 3;
      
      // Check head collision first (higher priority)
      if (this.lineSegmentSphereIntersection(
        projectilePrevPos, projectilePos, headPos, headRadius + projectileRadius
      )) {
        return {
          hitArea: 'head',
          position: headPos,
          type: projectileType
        };
      }
      
      // Then check body collision
      if (this.lineSegmentSphereIntersection(
        projectilePrevPos, projectilePos, bodyPos, bodyRadius + projectileRadius
      )) {
        return {
          hitArea: 'body',
          position: bodyPos,
          type: projectileType
        };
      }
    } else {
      // Simple entity with single collision radius
      const entityPos = entity.getPosition ? entity.getPosition() : entity.group.position;
      const entityRadius = entity.getCollisionRadius ? entity.getCollisionRadius() : 5;
      
      if (this.lineSegmentSphereIntersection(
        projectilePrevPos, projectilePos, entityPos, entityRadius + projectileRadius
      )) {
        return {
          hitArea: 'body', // Default to body for simple entities
          position: entityPos,
          type: projectileType
        };
      }
    }
    
    return null;
  }
  
  /**
   * Clean up the collision system
   */
  cleanup() {
    this.entities = [];
    this.projectiles = [];
  }
}

// Create a singleton instance for global use
const entityCollisionSystem = new EntityCollisionSystem();
export default entityCollisionSystem;
