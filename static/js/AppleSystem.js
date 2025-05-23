import * as THREE from 'three';
import TWEEN from './libs/tween.esm.js';

/**
 * System to manage growing apples on trees and collecting them
 */
export default class AppleSystem {
  /**
   * Create a new apple system
   * @param {THREE.Scene} scene - The 3D scene
   * @param {Object} options - Configuration options
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = Object.assign({
      maxApplesPerTree: 6, // Increased slightly
      growthTime: 10,      // Grow in 10 seconds (was 45)
      growthProbability: 0.25, // 25% chance per second to start growing (was 0.04)
      fallProbability: 0.15,  // 15% chance per second for ripe apple to fall (was 0.008)
      appleMass: 1.0,
      gravity: 0.15,
      appleRadius: 2.5, // Slightly smaller apples
      appleSegments: 6, // Further reduced segments
      // --- Apple Type Config ---
      appleTypes: {
        red:    { value: 1, probability: 0.75, effectMultiplier: 1.0, color: 0xff2200, unripeColor: 0xaa4433 },
        yellow: { value: 2, probability: 0.20, effectMultiplier: 1.5, color: 0xffdd00, unripeColor: 0xcccc44 },
        green:  { value: 3, probability: 0.05, effectMultiplier: 2.0, color: 0x33ff33, unripeColor: 0x44aa44 }
      },
      // --- End Apple Type Config ---
      groundLifetime: 30000, // 30 seconds on ground (was 6000)
      sphereRadius: 800,
      getTerrainHeight: null,
      onAppleCollected: null, // Callback signature: (type, value, effectMultiplier, position)
      performanceMode: false      // Start with performance mode OFF for debugging
    }, options);

    // Collection of all apple trees in the scene
    this.appleTrees = [];
    
    // Collection of all ground apples
    this.groundApples = [];
    
    // Collection of tree branches where apples can grow
    this.growthPoints = {};
    
    // Apple materials
    this.appleMaterials = {}; // Store materials by type
    this.unripeAppleMaterials = {}; // Store unripe materials by type

    this._initMaterials(); // Initialize materials based on appleTypes
    
    // Count collections by the player
    this.stats = {
      applesCollected: 0,
      goldenApplesCollected: 0,
      totalCollected: 0
    };
    
    // Performance optimization
    this.lastTweenUpdate = 0;
    this.updateCounter = 0; // For throttling updates
    
    // Create reusable objects to avoid GC
    this._vec3 = new THREE.Vector3();
    this._vec3b = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    
    // Delayed initialization to improve startup performance
    setTimeout(() => {
      this.findAppleTrees();
    }, 1000); // Delay apple system initialization by 1 second

    this.lowPerformanceMode = this.options.performanceMode; // Sync with option

    // REMOVE immediate call - will be called externally after trees exist
    // this.findAppleTrees();
  }
  
  /**
   * Initialize apple materials with reduced quality for performance
   * @private
   */
  _initMaterials() {
    for (const type in this.options.appleTypes) {
      const config = this.options.appleTypes[type];
      this.appleMaterials[type] = new THREE.MeshLambertMaterial({
        color: config.color,
        emissive: new THREE.Color(config.color).multiplyScalar(0.2) // Dim emissive
      });
      this.unripeAppleMaterials[type] = new THREE.MeshLambertMaterial({
        color: config.unripeColor
      });
    }
    // Fallback (shouldn't be needed)
    this.appleMaterial = this.appleMaterials.red;
    this.unripeAppleMaterial = this.unripeAppleMaterials.red;
  }
  
  /**
   * Find all apple trees in the scene
   */
  findAppleTrees() {
    // console.log("[AppleSystem] Starting findAppleTrees...");
    this.appleTrees = [];
    this.growthPoints = {};

    let traversedCount = 0;
    let meshCount = 0;
    let groupCount = 0;
    let potentialTreeCount = 0;

    this.scene.traverse(object => {
      traversedCount++;

      // Check if the object is a Group named "AppleTree"
      if (object.isGroup && object.name === "AppleTree") {
        groupCount++;
        // console.log(`[AppleSystem] Traversing Group: ID=${object.id}, Name=${object.name}, userData=`, object.userData);

        // Check the Group's userData directly
        const isTree = object.userData?.isTree;
        // Pine trees are also groups, so check their specific flag
        const isPine = object.userData?.isPineTree;

        // console.log(`  -> Group Check: isTree: ${isTree}, isPine: ${isPine}`);

        if (isTree && !isPine) {
          potentialTreeCount++;
        //   console.log(`  -> MATCHED Group as potential apple tree!`);

          // Use the group itself as the tree object
          const treeObject = object;

          // Try to find corresponding data in collidables (where .mesh is the Group)
          const collidableData = window.collidables?.find(c => c.mesh === treeObject);

          let treeData;
          if (collidableData) {
            // console.log(`[AppleSystem] Found collidable data for Group ${treeObject.id}`);
            treeData = collidableData;
          } else {
            // Fallback: Estimate data if not found in collidables (less reliable)
            // console.warn(`[AppleSystem] Tree Group ${treeObject.id} (${treeObject.name}) not found in collidables. Estimating data.`);
            const box = new THREE.Box3().setFromObject(treeObject);
            const size = new THREE.Vector3();
            box.getSize(size);
            treeData = {
              position: treeObject.position.clone(),
              direction: treeObject.position.clone().normalize(), // Assumes group is placed correctly
              radius: Math.max(size.x, size.z) / 2 || 15,
              collisionHeight: size.y || 40,
              mesh: treeObject // Ensure mesh property points to the group
            };
          }

          // Check if this group has already been added
          const alreadyAdded = this.appleTrees.some(t => t.id === treeObject.id);
        //   console.log(`  -> Already added: ${alreadyAdded}`);

          if (!alreadyAdded) {
            // console.log(`[AppleSystem] ADDING Apple Tree Group: ID=${treeObject.id}, Name=${treeObject.name}`);
            // Ensure collidableData is stored on the group's userData for _generateGrowthPoints
            treeObject.userData.collidableData = treeData;
            this.appleTrees.push(treeObject);
            this._generateGrowthPoints(treeObject); // Pass the group
          }
        }
      } else if (object.isMesh) {
        meshCount++;
        // Optional: Log meshes if needed for debugging other issues
        // console.log(`[AppleSystem] Traversing Mesh: ID=${object.id}, Name=${object.name}`);
      }
    });

    // console.log(`[AppleSystem] findAppleTrees finished. Traversed: ${traversedCount}, Groups: ${groupCount}, Meshes: ${meshCount}, Potential Trees: ${potentialTreeCount}, Found: ${this.appleTrees.length}`);
    let totalPoints = 0;
    Object.values(this.growthPoints).forEach(points => totalPoints += points.length);
    // console.log(`[AppleSystem] Generated ${totalPoints} total growth points.`);
  }
  
  /**
   * Generate growth points on a tree where apples can grow
   * @param {THREE.Object3D} tree - The tree object
   * @private
   */
  _generateGrowthPoints(treeGroup) { // treeGroup is the THREE.Group
    const treeId = treeGroup.id;
    if (this.growthPoints[treeId]) return;

    const points = [];
    const worldPos = new THREE.Vector3();
    const foliageMeshes = [];

    // Find foliage meshes within the group
    treeGroup.traverse(child => {
      // Identify foliage by geometry type (SphereGeometry used in LowPolyGenerator)
      if (child.isMesh && child.geometry instanceof THREE.SphereGeometry) {
        foliageMeshes.push(child);
      }
    });

    if (foliageMeshes.length === 0) {
      console.warn(`[AppleSystem] No foliage meshes found in Tree Group ${treeId}. Cannot generate growth points.`);
      this.growthPoints[treeId] = []; // Ensure entry exists even if empty
      return;
    }

    // console.log(`[AppleSystem] Found ${foliageMeshes.length} foliage meshes for tree ${treeId}.`);

    const pointsPerFoliage = Math.max(1, Math.floor(this.options.maxApplesPerTree / foliageMeshes.length));
    const totalPointsToGenerate = this.options.maxApplesPerTree;
    let generatedPoints = 0;

    // Distribute points across foliage meshes
    for (const foliageMesh of foliageMeshes) {
        // Get world transform of the foliage mesh
        foliageMesh.getWorldPosition(worldPos); // Center of the foliage sphere in world space
        const foliageWorldRadius = foliageMesh.geometry.parameters.radius * foliageMesh.getWorldScale(new THREE.Vector3()).x; // Approx world radius

        const countForThisFoliage = Math.min(pointsPerFoliage, totalPointsToGenerate - generatedPoints);

        for (let i = 0; i < countForThisFoliage; i++) {
            // Generate a random direction vector
            const randomDir = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize();

            // Calculate the point on the surface of this foliage sphere in world space
            const pointPos = worldPos.clone().addScaledVector(randomDir, foliageWorldRadius);

            // Normal points outwards from the foliage center (same as randomDir)
            const normal = randomDir.clone();

            points.push({
                position: pointPos, // World space position
                normal: normal,     // World space normal
                treeGroup: treeGroup, // Reference back to the parent tree group
                hasApple: false,
                apple: null,
                growthProgress: 0,
                appleType: 'red', // Default, will be set in _startNewApple
                effectMultiplier: 1.0, // Default
                growthRate: 0.8 + Math.random() * 0.4
            });
            generatedPoints++;
        }
        if (generatedPoints >= totalPointsToGenerate) break;
    }

     // If we didn't generate enough points (e.g., few foliage meshes), add remaining to the first one
     if (generatedPoints < totalPointsToGenerate && foliageMeshes.length > 0) {
        const firstFoliage = foliageMeshes[0];
        firstFoliage.getWorldPosition(worldPos);
        const foliageWorldRadius = firstFoliage.geometry.parameters.radius * firstFoliage.getWorldScale(new THREE.Vector3()).x;
        for (let i = generatedPoints; i < totalPointsToGenerate; i++) {
             const randomDir = new THREE.Vector3( /* ... */ ).normalize();
             const pointPos = worldPos.clone().addScaledVector(randomDir, foliageWorldRadius);
             const normal = randomDir.clone();
             points.push({ /* ... point data ... */ });
             generatedPoints++;
        }
     }


    this.growthPoints[treeId] = points;
    // console.log(`[AppleSystem] Generated ${points.length} growth points for tree group ${treeId}`);
  }
  
  /**
   * Update the apple system
   * @param {number} deltaTime - Time since last update in seconds
   * @param {THREE.Vector3} playerPosition - Current player position
   */
  update(deltaTime, playerPosition) {
    this.updateCounter++;

    // --- Temporarily Reduced Throttling for Debugging ---
    const effectiveDeltaTime = deltaTime; // Use actual delta time
    const runGrowthUpdate = true; // Always run growth
    const runNewAppleCheck = (this.updateCounter % 5 === 0); // Check every 5 frames
    const runDropCheck = (this.updateCounter % 10 === 0); // Check every 10 frames
    // --- End Reduced Throttling ---

    /* // Original Performance Throttling (Restore later)
    if (this.options.performanceMode) {
      if (this.updateCounter % 4 !== 0) {
        if (playerPosition && this.updateCounter % 2 === 0) {
          this._checkAppleCollection(playerPosition);
        }
        return;
      }
      deltaTime *= 4;
    }
    const effectiveDeltaTime = deltaTime;
    const runGrowthUpdate = (this.updateCounter % 2 === 0);
    const runNewAppleCheck = (this.updateCounter % 20 === 0);
    const runDropCheck = (this.updateCounter % 30 === 0);
    */

    // Limit TWEEN updates (keep this)
    const now = Date.now();
    if (now - this.lastTweenUpdate > (this.lowPerformanceMode ? 100 : 50)) {
      if (TWEEN) TWEEN.update();
      this.lastTweenUpdate = now;
    }

    // Process updates based on (reduced) throttling
    if (runGrowthUpdate) {
      this._updateGrowingApples(effectiveDeltaTime);
    }
    this._updateFallingApples(effectiveDeltaTime); // Update falling always

    if (runNewAppleCheck) {
      this._tryStartNewApples(effectiveDeltaTime * (this.updateCounter % 5 === 0 ? 5 : 1)); // Adjust delta multiplier
    }
    if (runDropCheck) {
      this._tryDropApples(effectiveDeltaTime * (this.updateCounter % 10 === 0 ? 10 : 1)); // Adjust delta multiplier
    }

    if (playerPosition) {
      this._checkAppleCollection(playerPosition);
    }

    // CRITICAL: FIX THE DOUBLE-COLLECTION ISSUE!
    // Only one collection method should be called, not both
    // Remove this second call which is causing double-counting
    // if (playerPosition) {
    //   this.checkPlayerCollision(playerPosition);
    // }
  }

  /**
   * Set performance mode
   * @param {boolean} lowMode - Whether to use low performance mode
   */
  setLowPerformanceMode(lowMode) {
    return this.setPerformanceMode(lowMode);
  }
  
  /**
   * Remove all special effects to improve performance
   * @private
   */
  _removeAllSpecialEffects() {
    // Remove effects from tree apples
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple && point.apple) {
          // Remove any shine
          const shine = point.apple.children.find(c => 
            c.material?.blending === THREE.AdditiveBlending);
          if (shine) point.apple.remove(shine);
          
          // Remove any glow
          const glow = point.apple.children.find(c => 
            c.material?.side === THREE.BackSide);
          if (glow) point.apple.remove(glow);
          
          // Remove highlight flags
          point.apple.userData.hasShine = false;
          point.apple.userData.highlight = null;
        }
      });
    });
    
    // Remove effects from ground apples
    this.groundApples.forEach(apple => {
      if (apple.mesh) {
        // Remove all children except the stem
        for (let i = apple.mesh.children.length - 1; i >= 0; i--) {
          const child = apple.mesh.children[i];
          // Only keep the stem (typically the first child)
          if (i > 0) {
            apple.mesh.remove(child);
          }
        }
      }
    });
  }
  
  /**
   * Update growing apples
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  _updateGrowingApples(deltaTime) {
    let updatedCount = 0;
    
    // ADDED: Track if system might be stalled (no growing apples)
    this._lastGrowingUpdateTime = Date.now();
    
    // Store total number of apples in different states for diagnostics
    let growing = 0;
    let ripe = 0;
    
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (!point.hasApple || point.growthProgress >= 1.0) {
          if (point.hasApple && point.growthProgress >= 1.0) {
            ripe++; // Count ripe apples
          }
          return;
        }
  
        growing++; // Count growing apples
        point.growthProgress += (deltaTime / this.options.growthTime) * point.growthRate;
        point.growthProgress = Math.min(1.0, point.growthProgress);
        updatedCount++;
  
        if (point.apple) {
          const growthCurve = this._easeOutCubic(point.growthProgress);
          const scale = 0.3 + growthCurve * 0.7;
          point.apple.scale.set(scale, scale, scale);
  
          // Change material when ripe
          if (point.growthProgress >= 1.0) {
             const type = point.appleType;
             const newMaterial = this.appleMaterials[type];
             if (point.apple.material !== newMaterial) {
                 point.apple.material = newMaterial;
                 // *** ADDED LOG ***
                //  console.log(`[AppleSystem] Apple ${point.apple.id} ripened! Type: ${type}`);
                 // *** END ADDED LOG ***
                 this._ripenApple(point.apple, type); // Pass type
             }
          } else {
             // Ensure it stays unripe material while growing
             const type = point.appleType;
             const unripeMaterial = this.unripeAppleMaterials[type];
             if (point.apple.material !== unripeMaterial) {
                 point.apple.material = unripeMaterial;
             }
          }
          // ... (wobble logic remains the same) ...
        }
      });
    });
    
    // ADDED: Store statistics for diagnostics
    if (this.updateCounter % 60 === 0) {
      this._appleStats = {
        growing,
        ripe,
        updated: updatedCount,
        time: Date.now()
      };
    }
    
    // ADDED: Detect and fix stalled system
    // If we have no growing apples but have empty growth points, try to start some new ones
    if (growing === 0 && this.updateCounter % 300 === 0) { // Check every ~5 seconds
      let emptyPoints = 0;
      Object.values(this.growthPoints).forEach(points => {
        points.forEach(point => {
          if (!point.hasApple) {
            emptyPoints++;
          }
        });
      });
      
      // If we have empty growth points but nothing growing, 
      // force some growth to keep the system running
      if (emptyPoints > 0) {
        console.log(`[AppleSystem] Auto-recovery: Found ${emptyPoints} empty points but no growing apples. Starting new growth.`);
        this.forceGrowNewApples(Math.min(emptyPoints, 5)); // Start up to 5 new apples
      }
    }
  }

  /**
   * Add a simple shine without animation - much cheaper
   * @private
   */
  _addSimpleShine(apple, isGolden) {
    if (this.lowPerformanceMode) return;
    
    const shineSize = this.options.appleRadius * 0.4;
    const shineGeometry = new THREE.SphereGeometry(shineSize, 6, 4); // Reduced segments
    const shineMaterial = new THREE.MeshBasicMaterial({
      color: isGolden ? 0xffffcc : 0xffffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    
    const shine = new THREE.Mesh(shineGeometry, shineMaterial);
    shine.position.set(
      this.options.appleRadius * 0.5, 
      this.options.appleRadius * 0.5, 
      -this.options.appleRadius * 0.2
    );
    apple.add(shine);
    
    // NO animation for better performance
  }
  
  /**
   * Start growing a new apple at the specified growth point
   * @param {Object} growthPoint - The growth point
   * @private
   */
  _startNewApple(growthPoint) {
    if (growthPoint.hasApple) return; // Don't overwrite existing apple

    // --- Determine Apple Type ---
    let chosenType = 'red'; // Default
    let effectMultiplier = this.options.appleTypes.red.effectMultiplier;
    const rand = Math.random();
    let cumulativeProb = 0;
    for (const type in this.options.appleTypes) {
        cumulativeProb += this.options.appleTypes[type].probability;
        if (rand < cumulativeProb) {
            chosenType = type;
            effectMultiplier = this.options.appleTypes[type].effectMultiplier;
            break;
        }
    }
    growthPoint.appleType = chosenType;
    growthPoint.effectMultiplier = effectMultiplier;
    // --- End Determine Apple Type ---

    const segments = this.options.appleSegments;
    const geometry = new THREE.SphereGeometry(this.options.appleRadius, segments, Math.max(4, segments - 2)); // Further reduce segments

    // Start with unripe material of the chosen type
    const material = this.unripeAppleMaterials[chosenType].clone();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; // Apples should cast shadows

    // Add stem (keep simple)
    const stemGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 4, 1);
    stemGeometry.translate(0, this.options.appleRadius, 0); // Position stem top at apple surface
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    mesh.add(stem);

    // Position the apple mesh AT the growth point
    mesh.position.copy(growthPoint.position);

    // Orient the apple - Use lookAt towards the foliage center (inverse of normal)
    const lookAtPos = growthPoint.position.clone().add(growthPoint.normal.clone().negate());
    mesh.lookAt(lookAtPos); // Stem should point roughly towards tree center

    // Start small
    const initialScale = 0.3; // Start at 30% scale
    mesh.scale.set(initialScale, initialScale, initialScale);

    growthPoint.hasApple = true;
    growthPoint.apple = mesh;
    growthPoint.growthProgress = 0; // Reset progress

    this.scene.add(mesh);
    // console.log(`[AppleSystem] Started new ${chosenType.toUpperCase()} apple (${mesh.id}) at [${growthPoint.position.x.toFixed(1)}, ${growthPoint.position.y.toFixed(1)}, ${growthPoint.position.z.toFixed(1)}]`);

    // Add simple glow for golden apples (optional)
    if (!this.lowPerformanceMode && (chosenType === 'yellow' || chosenType === 'green')) {
      // ... (add glow logic if needed) ...
    }
  }

  /**
   * Easing function for smoother growth curve
   * @param {number} t - Input between 0-1
   * @returns {number} Eased output between 0-1
   * @private
   */
  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Update falling apples - with collision detection between apples
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  _updateFallingApples(deltaTime) {
    // Skip if we have no falling apples
    if (this.groundApples.length <= 1) return; // Fast return if only one or none
    
    const gravity = this.options.gravity;
    const sphereRadius = this.options.sphereRadius;
    const getTerrainHeight = this.options.getTerrainHeight;
    
    // ADDED: Keep track of newly grounded apples for proper positioning
    const newlyGroundedApples = [];
    
    // Process each falling apple
    for (let i = this.groundApples.length - 1; i >= 0; i--) {
      const apple = this.groundApples[i];
      
      // Skip apples already on the ground
      if (apple.isGrounded) {
        // Check lifetime - IMPROVED: Only check if we're past 5 seconds to prevent early cleanup
        if (apple.groundTime > 5) {  // Add 5 second grace period
          apple.groundTime += deltaTime;
          if (apple.groundTime > this.options.groundLifetime) {
            // Only remove if it's really old
            this._removeGroundApple(i);
          }
        } else {
          // Just increment groundTime but don't check for removal yet
          apple.groundTime += deltaTime;
        }
        continue;
      }
      
      // Get normalized direction for gravity using reusable vector
      this._vec3.copy(apple.position).normalize();
      
      // Apply gravity (reuse vector)
      apple.velocity.addScaledVector(this._vec3.negate(), gravity * deltaTime * 60);
      
      // Check collisions with other falling apples before updating position
      this._checkAppleCollisions(apple, i);
      
      // Apply velocity (reuse vector)
      this._vec3b.copy(apple.velocity).multiplyScalar(deltaTime);
      this._vec3.copy(apple.position).add(this._vec3b);
      
      // Check for ground collision
      const terrainHeight = getTerrainHeight ? 
                          getTerrainHeight(this._vec3.clone().normalize()) : 0;
      const groundRadius = sphereRadius + terrainHeight;
      
      if (this._vec3.length() < groundRadius + this.options.appleRadius) {
        // Apple hit the ground
        apple.isGrounded = true;
        apple.groundTime = 0;
        
        // IMPROVED: Add slight random offset when placing on ground
        // First, get the basic ground position
        const groundPos = this._vec3.normalize().multiplyScalar(groundRadius + this.options.appleRadius * 0.7);
        
        // Create two tangent vectors perpendicular to the surface normal
        const normal = groundPos.clone().normalize();
        const tangent1 = new THREE.Vector3(1, 0, 0).cross(normal);
        if (tangent1.lengthSq() < 0.01) {
          tangent1.set(0, 1, 0).cross(normal);
        }
        tangent1.normalize();
        const tangent2 = normal.clone().cross(tangent1).normalize();
        
        // Add random offset along the surface using the tangent vectors
        const offsetDistance = this.options.appleRadius * 1.5; // Offset by 1.5x apple radius
        groundPos.addScaledVector(tangent1, (Math.random() - 0.5) * offsetDistance);
        groundPos.addScaledVector(tangent2, (Math.random() - 0.5) * offsetDistance);
        
        // Use this position instead
        apple.position.copy(groundPos);
        
        // Add slight random rotation
        apple.mesh.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        
        // Track newly grounded apples for post-processing
        newlyGroundedApples.push(apple);
        
        // Skip bounce animation in performance mode
        if (!this.options.performanceMode && Math.random() < 0.3) {
          const bounceHeight = 2.0;
          const bounceTime = 600;
          
          new TWEEN.Tween(apple.mesh.position)
            .to({ y: bounceHeight }, bounceTime / 2)
            .easing(TWEEN.Easing.Quadratic.Out)
            .chain(
              new TWEEN.Tween(apple.mesh.position)
                .to({ y: 0 }, bounceTime / 2)
                .easing(TWEEN.Easing.Quadratic.In)
            )
            .start();
        }
      } else {
        // Continue falling
        apple.position.copy(this._vec3);
      }
      
      // Update mesh position
      apple.mesh.position.copy(apple.position);
    }
    
    // ADDED: Resolve collisions between ALL grounded apples
    this._resolveGroundedAppleCollisions();
    
    // ADDED: Specifically check newly grounded apples against all others
    // This ensures they don't overlap with existing apples
    if (newlyGroundedApples.length > 0) {
      this._resolveGroundedAppleCollisions(newlyGroundedApples);
    }
  }

  /**
   * NEW: Resolve collisions between apples on the ground
   * @param {Array} applesToCheck - Optional array of specific apples to check (otherwise check all)
   * @private
   */
  _resolveGroundedAppleCollisions(applesToCheck = null) {
    // Get all grounded apples
    const groundedApples = applesToCheck || this.groundApples.filter(apple => apple.isGrounded);
    if (groundedApples.length <= 1) return;
    
    // Define spacing parameters
    const minDistance = this.options.appleRadius * 2.2; // Slightly bigger distance to prevent clipping
    const pushFactor = 0.4; // Stronger push (was 0.3)
    
    // Check each apple against all other grounded apples
    for (let i = 0; i < groundedApples.length; i++) {
      const apple = groundedApples[i];
      if (!apple.isGrounded) continue;
      
      // Calculate ground normal at this apple's position
      const normal = apple.position.clone().normalize();
      
      // Create tangent plane vectors (these define the 2D surface to push along)
      const tangent1 = new THREE.Vector3(1, 0, 0).cross(normal);
      if (tangent1.lengthSq() < 0.01) {
        tangent1.set(0, 1, 0).cross(normal);
      }
      tangent1.normalize();
      const tangent2 = normal.clone().cross(tangent1).normalize();
      
      // Track total displacement for this apple
      const displacement = new THREE.Vector3();
      
      // Check against all other apples (we use all grounded apples, not just the checking group)
      for (let j = 0; j < this.groundApples.length; j++) {
        const otherApple = this.groundApples[j];
        // Skip if not grounded or same as current apple
        if (!otherApple.isGrounded || otherApple === apple) continue;
        
        // Get distance between apples
        const distance = apple.position.distanceTo(otherApple.position);
        
        // If apples are too close
        if (distance < minDistance && distance > 0.01) { // Avoid division by zero
          // Direction from other apple to this apple
          const direction = apple.position.clone().sub(otherApple.position).normalize();
          
          // Calculate overlap
          const overlap = minDistance - distance;
          
          // Calculate displacement along the terrain surface
          // Project the separation direction onto the tangent plane
          const dot1 = direction.dot(tangent1);
          const dot2 = direction.dot(tangent2);
          const surfaceDirection = new THREE.Vector3()
            .addScaledVector(tangent1, dot1)
            .addScaledVector(tangent2, dot2)
            .normalize();
          
          // Add this displacement
          displacement.addScaledVector(surfaceDirection, overlap * pushFactor);
        }
      }
      
      // Apply cumulative displacement to move the apple along the ground surface
      if (displacement.length() > 0.01) {
        // Move the apple
        apple.position.add(displacement);
        
        // Project apple back onto the terrain surface to ensure it stays on the ground
        const terrainHeight = this.options.getTerrainHeight ? 
                            this.options.getTerrainHeight(apple.position.clone().normalize()) : 0;
        const groundRadius = this.options.sphereRadius + terrainHeight;
        
        // Calculate the correct surface position
        const surfacePosition = apple.position.clone().normalize()
            .multiplyScalar(groundRadius + this.options.appleRadius * 0.7);
        
        // Update apple position and mesh
        apple.position.copy(surfacePosition);
        apple.mesh.position.copy(apple.position);
        
        // IMPORTANT: Reset groundTime to prevent early removal after collision
        // This ensures apples that just collided won't immediately disappear
        apple.groundTime = Math.min(apple.groundTime, 1); // Cap at 1 second
      }
    }
  }
  
  /**
   * NEW: Check and handle collisions between apples
   * @param {Object} apple - The apple to check
   * @param {number} index - Index of this apple in the array
   * @private
   */
  _checkAppleCollisions(apple, index) {
    // Skip if apple is already on ground
    if (apple.isGrounded) return;
    
    const appleRadius = this.options.appleRadius;
    const minDistance = appleRadius * 2; // Minimum distance between apple centers
    
    // Check against all other apples
    for (let j = 0; j < this.groundApples.length; j++) {
      // Skip self or apples on the ground
      if (j === index || this.groundApples[j].isGrounded) continue;
      
      const otherApple = this.groundApples[j];
      const distance = apple.position.distanceTo(otherApple.position);
      
      // If apples are too close
      if (distance < minDistance) {
        // Calculate separation vector (direction from other to this apple)
        const separationVector = apple.position.clone().sub(otherApple.position).normalize();
        
        // Push apart with a force proportional to how much they're overlapping
        const overlap = minDistance - distance;
        const forceMagnitude = Math.min(overlap * 0.3, 3.0); // Limit max force
        
        // Apply forces to both apples in opposite directions
        apple.velocity.addScaledVector(separationVector, forceMagnitude);
        otherApple.velocity.addScaledVector(separationVector, -forceMagnitude);
        
        // Add slight random variation to prevent apples from getting stuck together
        const randomFactor = 0.2;
        apple.velocity.x += (Math.random() - 0.5) * randomFactor;
        apple.velocity.z += (Math.random() - 0.5) * randomFactor;
        otherApple.velocity.x += (Math.random() - 0.5) * randomFactor;
        otherApple.velocity.z += (Math.random() - 0.5) * randomFactor;
      }
    }
  }
  
  /**
   * Try to drop apples from trees
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  _tryDropApples(deltaTime) {
    // Calculate chance of ripe apple falling
    const chancePerApple = this.options.fallProbability * deltaTime;
    let checkedRipeApples = 0; // Count how many ripe apples we check
    let droppedApples = 0; // ADDED: Track dropped apples
  
    // ADDED: Random multiplier for more unpredictable drop patterns
    const randomMultiplier = Math.random() * 0.5 + 0.75; // Range: 0.75-1.25
  
    // ADDED: Detect and fix stalled system
    const now = Date.now();
    if (this._lastAppleDropTime && now - this._lastAppleDropTime > 60000) {
      // If no apples dropped in the last minute, increase chance temporarily
      console.log("[AppleSystem] No apples dropped for 60 seconds, increasing drop probability.");
      chancePerApple *= 10; // Much higher chance for at least one drop
    }
  
    // Check each tree and its growth points
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        // Skip points without ripe apples
        if (!point.hasApple || point.growthProgress < 1.0) return;
  
        checkedRipeApples++; // Increment count of ripe apples checked
  
        // Apply the adjusted probability
        if (Math.random() < chancePerApple * randomMultiplier) {
          this._detachApple(point);
          droppedApples++;
          this._lastAppleDropTime = now; // Update the last drop time
        }
      });
    });
  
    // ADDED: If we have ripe apples but none are dropping, force at least one
    if (checkedRipeApples > 0 && droppedApples === 0 && this.updateCounter % 600 === 0) { // Every ~10 seconds
      if (Math.random() < 0.3) { // 30% chance to force drop
        console.log(`[AppleSystem] No apples dropping naturally. Force dropping 1 of ${checkedRipeApples} ripe apples.`);
        this.forceDropRandomApple();
        this._lastAppleDropTime = now; // Update the last drop time
      }
    }
  }
  
  /**
   * Detach an apple from its growth point and make it fall
   * @param {Object} growthPoint - The growth point
   * @private
   */
  _detachApple(growthPoint) {
    if (!growthPoint.hasApple || !growthPoint.apple) return; // Check if apple exists

    // console.log(`[AppleSystem] Detaching ${growthPoint.appleType} apple ${growthPoint.apple.id}`);
    // Create falling apple object
    const apple = {
      position: growthPoint.position.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      mesh: growthPoint.apple,
      isGrounded: false,
      groundTime: 0,
      appleType: growthPoint.appleType, // Store type
      effectMultiplier: growthPoint.effectMultiplier // Store multiplier
    };
    
    // Add some initial velocity (slight outward push + randomness)
    const pushStrength = 0.5;
    apple.velocity.add(
      growthPoint.normal.clone().multiplyScalar(pushStrength)
    );
    
    // Add some random velocity
    apple.velocity.add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5
    ));
    
    // Add to ground apples list
    this.groundApples.push(apple);
    
    // Reset growth point
    growthPoint.hasApple = false;
    growthPoint.apple = null;
    growthPoint.growthProgress = 0;
  }
  
  /**
   * Check for new apple growth opportunities
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  _tryStartNewApples(deltaTime) {
    const chancePerPoint = this.options.growthProbability * deltaTime;
    let potentialStarts = 0;
    let actualStarts = 0;

    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (!point.hasApple) {
          potentialStarts++;
          if (Math.random() < chancePerPoint) {
            this._startNewApple(point);
            actualStarts++;
          }
        }
      });
    });
     if (actualStarts > 0) { // Log only if apples actually started
    //    console.log(`[AppleSystem] Started ${actualStarts} new apples.`);
     }
  }
  
  /**
   * Remove a ground apple by index
   * @param {number} index - Index in groundApples array
   * @private
   */
  _removeGroundApple(index) {
    const apple = this.groundApples[index];
    if (!apple) return;
    
    // Remove from scene
    if (apple.mesh && apple.mesh.parent) {
      this.scene.remove(apple.mesh);
    }
    
    // Remove from array
    this.groundApples.splice(index, 1);
  }
  
  /**
   * Check if player can collect any apples - enhanced to collect all apple types
   * @param {THREE.Vector3} playerPosition - Player position
   * @private
   */
  _checkAppleCollection(playerPosition) {
    // INCREASED: Use larger collection radius for easier grabbing
    const collectionRadius = 15.0; // Increased from 10.0
    
    // First check ground apples - they're more important
    for (let i = this.groundApples.length - 1; i >= 0; i--) {
      const apple = this.groundApples[i];
      
      // MODIFIED: Remove the check that skips falling apples so we can collect them mid-air
      // if (!apple.isGrounded) continue; <-- REMOVED THIS LINE to allow collecting falling apples
      
      // Check distance to player
      const distance = playerPosition.distanceTo(apple.position);
      
      if (distance < collectionRadius) {
        // ADDED: Show feedback about apple type based on whether it was falling
        const appleStatus = apple.isGrounded ? "ground" : "falling";
        console.log(`Collected ${apple.appleType} apple (${appleStatus})!`);
        
        // Collect this apple
        this._collectApple(apple.appleType, apple.effectMultiplier, apple.position);
        
        // Remove from scene and list
        this._removeGroundApple(i);
      }
    }
    
    // Then check tree apples - IMPROVED to make it easier to get tree apples
    let checkedCount = 0;
    const maxChecksPerFrame = 20; // INCREASED from 10 to check more trees per frame
    
    for (const treeId in this.growthPoints) {
      const points = this.growthPoints[treeId];
      
      // Check every tree every frame for more consistent collection
      // REMOVED the frame-skipping check to check all trees every frame
      
      for (const point of points) {
        // Limit checks per frame
        if (checkedCount >= maxChecksPerFrame) break;
        
        // MODIFIED: Also allow collecting unripe apples that are at least 50% grown
        if (!point.hasApple || point.growthProgress < 0.5) continue; // Was 0.8, now 0.5
        
        checkedCount++;
        
        // Check distance to player
        const distance = playerPosition.distanceTo(point.position);
        
        // INCREASED collection radius for tree apples to make them easier to grab
        if (distance < collectionRadius * 1.2) { // 20% larger radius for tree apples
          // Collect this apple
          const type = point.appleType;
          const multiplier = point.effectMultiplier;
          const position = point.position.clone();
          
          // Add visual/audio feedback for tree apple collection
          console.log(`Collected ${type} apple directly from tree!`);
          
          // Remove apple from tree
          this.scene.remove(point.apple);
          
          // Reset growth point
          point.hasApple = false;
          point.apple = null;
          point.growthProgress = 0;
          
          // Register collection
          this._collectApple(type, multiplier, position);
        }
      }
    }
  }
  
  /**
   * Register collection of an apple - simplified for performance
   * @param {string} type - Type of apple ('apple' or 'goldenApple')
   * @param {THREE.Vector3} position - Position where apple was collected
   * @private
   */
  _collectApple(type, effectMultiplier, position) {
    const value = this.options.appleTypes[type]?.value || 1; // Get value from config
  
    // Update stats based on type
    if (type === 'red') this.stats.applesCollected++;
    else if (type === 'yellow') this.stats.goldenApplesCollected++; // Using golden for yellow for now
    else if (type === 'green') this.stats.goldenApplesCollected++; // Using golden for green for now
    // TODO: Add specific stats counters if needed later
  
    this.stats.totalCollected += value;
    // console.log(`[AppleSystem] Collected ${type} apple! Value: ${value}, Multiplier: ${effectMultiplier}`);
  
    // Call collection callback with type, value, and multiplier
    if (this.options.onAppleCollected) {
      this.options.onAppleCollected(
        type,
        value,
        effectMultiplier, // Pass the multiplier
        position
      );
    }
  
    // ADDED: Show apple pickup notification if UI is available
    if (window.game && window.game.ui && typeof window.game.ui.showNotification === 'function') {
      window.game.ui.showNotification(`Picked up ${type} apple (+${value})`, 1000, type);
    }
  
    // Skip effect in performance mode
    if (!this.options.performanceMode && 
       (type === 'goldenApple' || Math.random() < 0.3)) {
      this._playCollectionEffect(position, type === 'goldenApple');
    }
  }
  
  /**
   * Play visual effect when collecting an apple - extremely simplified
   * @param {THREE.Vector3} position - Position of the effect
   * @param {boolean} isGolden - Whether it's a golden apple
   * @private
   */
  _playCollectionEffect(position, type) {
    if (!this.options.collectionEffect || this.options.performanceMode) return;

    const effectConfig = this.options.collectionEffect;
    const particleCount = Math.round(effectConfig.particleCount * effectMultiplier);
    const baseColor = effectConfig.colors[type] || effectConfig.colors.default;

    // Create particle effect
    const particles = [];
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size: effectConfig.particleSize,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false, // Prevent particles from obscuring other objects incorrectly
      blending: THREE.AdditiveBlending // Brighter effect
    });

    const positions = [];
    const colors = [];
    const velocities = [];
    const life = [];

    const color = new THREE.Color(baseColor);

    for (let i = 0; i < particleCount; i++) {
      positions.push(position.x, position.y, position.z);
      colors.push(color.r, color.g, color.b);

      // Random velocity outwards
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
      ).normalize().multiplyScalar(effectConfig.speed * (0.5 + Math.random() * 0.5));
      velocities.push(velocity);

      // Random lifetime
      life.push(effectConfig.lifetime * (0.7 + Math.random() * 0.6));
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const points = new THREE.Points(geometry, material);
    points.userData = {
      isEffect: true,
      velocities: velocities,
      life: life,
      startTime: performance.now()
    };

    this.scene.add(points);
    this.activeEffects.push(points);

    // Auto-remove after max lifetime
    setTimeout(() => {
      this._removeEffect(points);
    }, effectConfig.lifetime * 1.3 * 1000); // Remove slightly after max lifetime
  }

  /**
   * Set performance mode on/off
   * @param {boolean} enabled - Whether to enable performance mode
   */
  setPerformanceMode(enabled) {
    this.options.performanceMode = enabled;
    
    // IMPORTANT: Add these lines to match the behavior from setLowPerformanceMode
    this.lowPerformanceMode = enabled;
    
    // Adjust settings based on performance mode
    if (enabled) {
      this.particlesEnabled = false;
      this.tweenUpdateInterval = 100;
      
      // Remove all glows and effects from existing apples
      this._removeAllSpecialEffects();
    } else {
      this.particlesEnabled = true;
      this.tweenUpdateInterval = 50;
    }
    
    // console.log(`Apple system performance mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return this.options.performanceMode;
  }

  /**
   * Clean up all resources and remove from scene
   * Call this when done using the system
   */
  cleanup() {
    // Remove all apples from the scene
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple && point.apple) {
          this.scene.remove(point.apple);
        }
      });
    });
    
    // Remove all ground apples
    this.groundApples.forEach(apple => {
      if (apple.mesh && apple.mesh.parent) {
        this.scene.remove(apple.mesh);
      }
    });
    
    // Clear arrays and objects
    this.growthPoints = {};
    this.groundApples = [];
    this.appleTrees = [];
    
    // console.log("Apple system cleaned up");
  }

  /**
   * Show floating text when collecting an apple from a tree
   * @param {THREE.Vector3} position - Position to show text
   * @param {boolean} isGolden - Whether this is a golden apple
   */
  _showCollectionText(position, isGolden) {
    // Create a text sprite
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    // Clear canvas
    context.fillStyle = 'rgba(0,0,0,0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    context.font = 'Bold 60px Arial';
    context.textAlign = 'center';
    context.fillStyle = isGolden ? '#ffdd00' : '#ff4400';
    context.strokeStyle = 'black';
    context.lineWidth = 4;
    const text = isGolden ? '+3' : '+1';
    
    // Stroke first for outline
    context.strokeText(text, canvas.width/2, canvas.height/2);
    // Then fill
    context.fillText(text, canvas.width/2, canvas.height/2);
    
    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(5, 2.5, 1); // Make it visible from a distance
    sprite.position.copy(position);
    
    // Add to scene
    this.scene.add(sprite);
    
    // Animate upwards and fade out
    new TWEEN.Tween(sprite.position)
      .to({ y: sprite.position.y + 5 }, 1500)
      .start();
      
    new TWEEN.Tween(sprite.material)
      .to({ opacity: 0 }, 1500)
      .onComplete(() => {
        this.scene.remove(sprite);
      })
      .start();
  }

  /**
   * Get statistics about collected apples
   * @returns {Object} Collection statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Force an apple to drop from a random tree
   * @returns {boolean} Whether an apple was dropped
   */
  forceDropRandomApple() {
    // Find all ripe apples
    const ripeApples = [];
    
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        // Only consider fully grown apples
        if (point.hasApple && point.growthProgress >= 1.0) {
          ripeApples.push(point);
        }
      });
    });
    
    if (ripeApples.length > 0) {
      // Choose random apple
      const randomIndex = Math.floor(Math.random() * ripeApples.length);
      this._detachApple(ripeApples[randomIndex]);
      return true;
    }
    
    return false;
  }
  
  /**
   * Manually grow all apples to full size
   */
  growAllApples() {
    let ripenedCount = 0;
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple && point.growthProgress < 1.0) {
          point.growthProgress = 1.0;
          if (point.apple) {
            point.apple.scale.set(1, 1, 1); // Ensure full scale
            const newMaterial = point.isGolden ? this.goldenAppleMaterial : this.appleMaterial;
            if (point.apple.material !== newMaterial) {
                 point.apple.material = newMaterial;
                 this._ripenApple(point.apple); // Call ripen hook
                 ripenedCount++;
            }
          }
        }
      });
    });
    // console.log(`[AppleSystem] Forced ${ripenedCount} apples to ripen.`);
  }
  
  /**
   * Force grow new apples on trees that have empty growth points
   * @param {number} count - How many apples to try to grow
   * @returns {Object} Statistics about how many apples were grown
   */
  forceGrowNewApples(count = 5) {
    let grown = 0;
    let trees = 0;
    const treesWithNewApples = new Set();
    
    // Gather all empty growth points
    const emptyPoints = [];
    Object.entries(this.growthPoints).forEach(([treeId, points]) => {
      points.forEach(point => {
        if (!point.hasApple) {
          emptyPoints.push({ treeId, point });
        }
      });
    });
    
    // Shuffle array for randomness
    for (let i = emptyPoints.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptyPoints[i], emptyPoints[j]] = [emptyPoints[j], emptyPoints[i]];
    }
    
    // Try to grow specified number of apples
    for (let i = 0; i < Math.min(count, emptyPoints.length); i++) {
      const { treeId, point } = emptyPoints[i];
      this._startNewApple(point);
      treesWithNewApples.add(treeId);
      grown++;
    }
    
    return {
      grown,
      trees: treesWithNewApples.size,
      emptyPointsLeft: emptyPoints.length - grown
    };
  }

  /**
   * Add highlighting effect to all apples to make them more visible
   * @param {boolean} enable - Whether to enable or disable highlighting
   */
  highlightApples(enable = true) {
    // Count of affected apples
    let count = 0;
    
    // Process apples on trees
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple && point.apple) {
          if (enable) {
            // Add glow effect if not already present
            if (!point.apple.userData.highlight) {
              const glowSize = this.options.appleRadius * 1.3;
              const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 12);
              const glowMaterial = new THREE.MeshBasicMaterial({
                color: point.isGolden ? 0xffdd44 : 0xff5522,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide
              });
              const glow = new THREE.Mesh(glowGeometry, glowMaterial);
              point.apple.add(glow);
              point.apple.userData.highlight = glow;
              
              // Add pulsing animation
              new TWEEN.Tween(glowMaterial)
                .to({ opacity: 0.1 }, 1000)
                .yoyo(true)
                .repeat(Infinity)
                .easing(TWEEN.Easing.Sinusoidal.InOut)
                .start();
            }
          } else {
            // Remove highlight if present
            if (point.apple.userData.highlight) {
              point.apple.remove(point.apple.userData.highlight);
              point.apple.userData.highlight = null;
            }
          }
          count++;
        }
      });
    });
    
    // Process fallen apples
    this.groundApples.forEach(apple => {
      if (apple.mesh) {
        if (enable) {
          // Add highlight to ground apples
          if (!apple.mesh.userData.highlight) {
            const glowSize = this.options.appleRadius * 1.3;
            const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 12);
            const glowMaterial = new THREE.MeshBasicMaterial({
              color: apple.isGolden ? 0xffdd44 : 0xff5522,
              transparent: true,
              opacity: 0.3,
              side: THREE.BackSide
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            apple.mesh.add(glow);
            apple.mesh.userData.highlight = glow;
            
            // Add pointer direction for easier finding
            const arrowHeight = 3.0;
            const arrowGeometry = new THREE.ConeGeometry(0.7, arrowHeight, 8);
            const arrowMaterial = new THREE.MeshBasicMaterial({
              color: apple.isGolden ? 0xffdd00 : 0xff5500,
              transparent: true,
              opacity: 0.7,
            });
            const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
            arrow.position.y = arrowHeight;
            // Orient arrow to point upward from planet surface
            const upDir = apple.position.clone().normalize();
            arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upDir);
            apple.mesh.add(arrow);
            apple.mesh.userData.arrow = arrow;
            
            // Create bobbing animation for arrow
            new TWEEN.Tween(arrow.position)
              .to({ y: arrowHeight + 1.0 }, 1000)
              .yoyo(true)
              .repeat(Infinity)
              .easing(TWEEN.Easing.Sinusoidal.InOut)
              .start();
          }
        } else {
          // Remove highlight if present
          if (apple.mesh.userData.highlight) {
            apple.mesh.remove(apple.mesh.userData.highlight);
            apple.mesh.userData.highlight = null;
          }
          // Remove arrow if present
          if (apple.mesh.userData.arrow) {
            apple.mesh.remove(apple.mesh.userData.arrow);
            apple.mesh.userData.arrow = null;
          }
        }
        count++;
      }
    });
    
    return count;
  }

  _updateApples(deltaTime) {
    // ...existing code...
    this.apples.forEach(apple => {
      if (!apple.fallen) {
        if (apple.growthProgress < 1.0) {
          apple.growthProgress += deltaTime / this.config.growthTime;
        //   console.log(`🌱 [AppleSystem] growthProgress=${apple.growthProgress.toFixed(2)} at ${apple.position.toArray()}`);
          if (apple.growthProgress >= 1.0) {
            apple.growthProgress = 1.0;
            this._ripenApple(apple);
          }
        } else if (apple.ripe) {
          // ...existing code...
        }
      }
    });
    // ...existing code...
  }

  _ripenApple(appleMesh, type) { // Accept type
    // console.log(`🍏 [AppleSystem] ripened ${type} apple at ${appleMesh.position.toArray()}`);
    // Maybe add a subtle effect on ripen
  }

  // --- NEW Method ---
  /**
   * Get the current count of apples on trees and on the ground.
   * @returns {{treeApples: number, groundApples: number}}
   */
  getAppleCount() {
    let treeAppleCount = 0;
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple) {
          treeAppleCount++;
        }
      });
    });
    return {
      treeApples: treeAppleCount,
      groundApples: this.groundApples.length
    };
  }

  /**
   * @deprecated Use _checkAppleCollection instead
   * This method is redundant and causes double-collection
   */
  checkPlayerCollision(playerPosition) {
    // This method is deprecated and should not be used
    // It causes double-collection of apples when both this and
    // _checkAppleCollection are called in the same frame
    console.warn("[AppleSystem] checkPlayerCollision is deprecated - use _checkAppleCollection instead");
  }

  /**
   * Force apples to be more grabbable by making them slower and larger
   */
  improveAppleGrabbability() {
    // Slow down falling apples to make them easier to catch
    this.options.gravity *= 0.6; // 40% slower falling
    
    // Make tree apples more visible
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple && point.apple) {
          // Increase the size of the apple by 25%
          point.apple.scale.multiplyScalar(1.25);
        }
      });
    });
    
    // Make falling apples larger and slower
    this.groundApples.forEach(apple => {
      if (!apple.isGrounded && apple.mesh) {
        // Increase the size of the apple by 25%
        apple.mesh.scale.multiplyScalar(1.25);
        
        // Reduce velocity to make them fall slower
        if (apple.velocity) {
          apple.velocity.multiplyScalar(0.7);
        }
      }
    });
    
    console.log("🍎 Apples now fall slower and are larger for easier grabbing!");
    return true;
  }
}