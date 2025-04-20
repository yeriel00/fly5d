import * as THREE from 'three';
import LowPolyGenerator from './low_poly_generator.js';

/**
 * Handles physics and interactions for fruits (apples)
 */
export default class FruitPhysics {
  constructor(scene, planetRadius, getTerrainHeightFunc) {
    this.scene = scene;
    this.planetRadius = planetRadius;
    this.getTerrainHeight = getTerrainHeightFunc;
    this.fallenFruits = [];
    
    // Configuration
    this.fruitLifetime = 20000; // 20 seconds before removing from scene
    this.detachmentProbability = 0.01; // 1% chance per frame to check
    this.detachmentDistance = 400; // 20 units squared
    this.detachmentChance = 0.1; // 10% chance when within range
  }
  
  /**
   * Update physics for all tracked fruits
   */
  update(delta, playerPosition) {
    // Update physics for fallen fruits
    this.updateFallenFruits(delta);
    
    // Check for fruit detachment
    if (Math.random() < this.detachmentProbability) {
      try {
        this.checkForFruitDetachment(playerPosition);
      } catch (e) {
        console.error("Error in fruit detachment:", e);
      }
    }
  }
  
  /**
   * Update physics for fallen fruits
   */
  updateFallenFruits(delta) {
    // Apply gravity and collision for fallen fruits
    for (let i = this.fallenFruits.length - 1; i >= 0; i--) {
      const fruit = this.fallenFruits[i];
      if (!fruit || !fruit.userData) continue;
      
      // Apply gravity toward planet center with MUCH reduced strength for more stable physics
      const gravityDir = fruit.position.clone().normalize().negate();
      const gravityStrength = 0.02; // reduced from 0.03 for more stability
      fruit.userData.velocity.addScaledVector(gravityDir, gravityStrength * delta);
      
      // Apply velocity to position with MANY MORE small steps to prevent tunneling
      const steps = 10; // Much more substeps (was 3)
      const subDelta = delta / steps;
      
      // Store initial position for recovery if needed
      const initialPos = fruit.position.clone();
      const initialDir = initialPos.normalize();
      const initialTerrainHeight = this.getTerrainHeight(initialDir);
      const initialTerrainRadius = this.planetRadius + initialTerrainHeight;
      
      for (let step = 0; step < steps; step++) {
        // Apply velocity
        fruit.position.addScaledVector(fruit.userData.velocity, subDelta);
        
        // Check for terrain collision
        const fruitDir = fruit.position.clone().normalize();
        const terrainHeight = this.getTerrainHeight(fruitDir);
        const terrainRadius = this.planetRadius + terrainHeight;
        
        // If fruit hits terrain, adjust position and bounce
        if (fruit.position.length() < terrainRadius + 0.3) { // INCREASED collision buffer (was 0.15)
          // Move back to surface with extra buffer for safety
          fruit.position.copy(fruitDir.multiplyScalar(terrainRadius + 0.3));
          
          // Bounce with high damping (less bouncy)
          const normalVel = fruit.userData.velocity.dot(fruitDir);
          if (normalVel < 0) {
            // Reflect velocity vector with significant damping
            const restitution = 0.1; // Even less bouncy (was 0.2)
            fruit.userData.velocity.addScaledVector(fruitDir, -normalVel * (1 + restitution));
            
            // Apply extra high friction to tangent component for slower rolling
            fruit.userData.velocity.multiplyScalar(0.7); // Even higher friction (was 0.8)
          }
          
          // ADDED: If velocity is very small, just stop completely
          if (fruit.userData.velocity.lengthSq() < 0.01) {
            fruit.userData.velocity.set(0, 0, 0);
          }
        }
        
        // ADDED: Safety check - if somehow fruit got below terrain, pull it back up
        if (fruit.position.length() < terrainRadius) {
          console.warn("Apple below terrain - rescuing!");
          fruit.position.copy(fruitDir.multiplyScalar(terrainRadius + 0.3));
          
          // Kill velocity
          fruit.userData.velocity.multiplyScalar(0.1);
        }
      }
      
      // ADDED: Ultimate safety check - if fruit is too deep inside planet, reset it
      if (fruit.position.length() < this.planetRadius * 0.95) {
        console.error("Apple deep inside planet - emergency reset!");
        fruit.position.copy(initialDir.multiplyScalar(initialTerrainRadius + 1.0));
        fruit.userData.velocity.set(0, 0, 0);
      }
      
      // If almost stopped, mark as resting
      if (fruit.userData.velocity.lengthSq() < 0.003) { // Lower threshold (was 0.005)
        fruit.userData.velocity.set(0, 0, 0);
        fruit.userData.isResting = true;
        
        // Orient fruit flat against terrain
        const upVector = fruit.position.clone().normalize();
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.lookAt(
          new THREE.Vector3(0, 0, 0),
          fruit.position,
          new THREE.Vector3(0, 1, 0)
        );
        fruit.quaternion.setFromRotationMatrix(tempMatrix);
        
        // Remove from physics list after a while
        setTimeout(() => {
          const idx = this.fallenFruits.indexOf(fruit);
          if (idx !== -1) this.fallenFruits.splice(idx, 1);
          this.scene.remove(fruit);
        }, this.fruitLifetime);
      }
      
      // Slower rotation for more natural look
      const rotationDamping = 0.5;
      fruit.rotation.x += fruit.userData.angularVelocity.x * delta * rotationDamping;
      fruit.rotation.y += fruit.userData.angularVelocity.y * delta * rotationDamping;
      fruit.rotation.z += fruit.userData.angularVelocity.z * delta * rotationDamping;
    }
  }
  
  /**
   * Check if any fruits should detach when player is nearby
   */
  checkForFruitDetachment(playerPosition) {
    // Find all trees with fruit in range
    const fruitTrees = [];
    this.scene.traverse(object => {
      if (object.userData && object.userData.isAppleTree) {
        fruitTrees.push(object);
      }
    });
    
    // Process each tree separately
    fruitTrees.forEach(tree => {
      // Check if tree is close to player
      const treePos = tree.position;
      const distSq = playerPosition.distanceToSquared(treePos);
      
      // Only process trees within reasonable range
      if (distSq > this.detachmentDistance) return;
      
      // Find fruits on this tree
      const fruits = [];
      tree.traverse(child => {
        if (child.userData && child.userData.isApple && child.userData.detachable) {
          fruits.push(child);
        }
      });
      
      // Process fruits - separate from traversal to avoid modification issues
      fruits.forEach(fruit => {
        // Small random chance for this fruit to detach
        if (Math.random() < this.detachmentChance) {
          try {
            // Get world position before removing
            const worldPos = fruit.getWorldPosition(new THREE.Vector3());
            
            // Remove from parent
            fruit.parent.remove(fruit);
            
            // Create and add detached fruit
            const detachedFruit = LowPolyGenerator.createDetachedApple(worldPos);
            this.scene.add(detachedFruit);
            this.fallenFruits.push(detachedFruit);
            
            console.log("Fruit detached from tree!");
          } catch (e) {
            console.error("Error detaching fruit:", e);
          }
        }
      });
    });
  }
  
  /**
   * Add a fruit to the physics system
   */
  addFruit(fruit) {
    if (fruit) {
      this.fallenFruits.push(fruit);
    }
  }
}
