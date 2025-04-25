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
      maxApplesPerTree: 4,        // REDUCED from 8 to 4 for performance
      growthTime: 60,             // Slower growth for better performance
      growthProbability: 0.03,    // REDUCED growth probability for fewer apples
      fallProbability: 0.005,     // REDUCED fall probability
      appleMass: 1.0,             
      gravity: 0.15,              
      appleRadius: 3.0,           // Keep size matching projectiles
      appleSegments: 8,           // REDUCED geometry complexity from 12 to 8
      appleValue: 1,             
      goldenAppleProbability: 0.1,
      goldenAppleValue: 3,        
      groundLifetime: 60,         
      sphereRadius: 400,         
      getTerrainHeight: null,     
      onAppleCollected: null,
      performanceMode: true       // NEW: Enable performance optimizations
    }, options);

    // Collection of all apple trees in the scene
    this.appleTrees = [];
    
    // Collection of all ground apples
    this.groundApples = [];
    
    // Collection of tree branches where apples can grow
    this.growthPoints = {};
    
    // Apple materials
    this._initMaterials();
    
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
  }
  
  /**
   * Initialize apple materials with reduced quality for performance
   * @private
   */
  _initMaterials() {
    // Regular apple material - simplified for performance
    this.appleMaterial = new THREE.MeshLambertMaterial({
      color: 0xff2200,
      emissive: 0x440000
    });
    
    // Golden apple material - simplified for performance
    this.goldenAppleMaterial = new THREE.MeshLambertMaterial({
      color: 0xffdd00,
      emissive: 0x443300
    });
    
    // Unripe apple material - simplified for performance
    this.unripeAppleMaterial = new THREE.MeshLambertMaterial({
      color: 0x44cc22
    });
  }
  
  /**
   * Find all apple trees in the scene
   */
  findAppleTrees() {
    // Clear current list
    this.appleTrees = [];
    
    // Find all apple trees in scene
    this.scene.traverse(object => {
      // Check if this is an apple tree (not pine tree)
      if (object.userData && object.userData.isTree && !object.userData.isPineTree) {
        this.appleTrees.push(object);
        
        // Generate growth points on this tree
        this._generateGrowthPoints(object);
      }
    });
    
    console.log(`Found ${this.appleTrees.length} apple trees for growing apples`);
  }
  
  /**
   * Generate growth points on a tree where apples can grow
   * @param {THREE.Object3D} tree - The tree object
   * @private
   */
  _generateGrowthPoints(tree) {
    // Create unique ID for this tree
    const treeId = tree.id || Math.random().toString(36).substr(2, 9);
    
    // Get tree trunk and find branches - assuming a specific structure
    // where the tree has a trunk and foliage/branches as children
    const trunkPosition = tree.position.clone();
    
    // Find the "up" direction for this tree (from center of planet)
    const upDirection = trunkPosition.clone().normalize();
    
    // Find foliage positions - usually these are spheres at the top of the trunk
    const foliage = [];
    tree.traverse(child => {
      // Check for foliage parts
      if (child.isMesh && child !== tree) {
        // Check if this is a leaf/foliage part (usually these are spheres)
        if (child.geometry instanceof THREE.SphereGeometry || 
            child.geometry instanceof THREE.IcosahedronGeometry ||
            (child.name && child.name.toLowerCase().includes('leaf'))) {
          foliage.push(child);
        }
      }
    });
    
    // If we can't find foliage, use the tree itself
    if (foliage.length === 0) {
      // For low-poly trees with single mesh, create points around the top
      const treeHeight = tree.geometry ? tree.geometry.boundingSphere.radius * 2 : 10;
      const foliageCenter = trunkPosition.clone().add(upDirection.clone().multiplyScalar(treeHeight * 0.8));
      
      // Create points in a spherical pattern around the top
      const points = [];
      const radius = treeHeight * 0.4; // Size of the foliage sphere
      const count = this.options.maxApplesPerTree;
      
      for (let i = 0; i < count; i++) {
        // Create point on sphere surface with random distribution
        const point = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(radius).add(foliageCenter);
        
        points.push({
          position: point,
          normal: point.clone().sub(trunkPosition).normalize(),
          hasApple: false,
          apple: null,
          growthProgress: 0,
          growthDirection: upDirection.clone(),
          growthRate: 0.5 + Math.random() * 0.5 // Random growth rate variation
        });
      }
      
      this.growthPoints[treeId] = points;
    } else {
      // For trees with separate foliage meshes, use those positions
      const points = [];
      
      foliage.forEach(leaf => {
        // Get world position of the leaf
        const leafPosition = new THREE.Vector3();
        leaf.getWorldPosition(leafPosition);
        
        // Create multiple points per foliage element
        const count = Math.max(1, Math.floor(this.options.maxApplesPerTree / foliage.length));
        
        for (let i = 0; i < count; i++) {
          // Create point just outside the foliage radius
          const direction = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
          ).normalize();
          
          // Get foliage radius (approximately)
          const radius = leaf.geometry ? 
                         leaf.geometry.boundingSphere?.radius || 5 : 5;
          
          const point = leafPosition.clone().add(
            direction.multiplyScalar(radius * 0.9)
          );
          
          // Get normal direction (pointing away from tree center)
          const normal = point.clone().sub(trunkPosition).normalize();
          
          points.push({
            position: point,
            normal: normal,
            hasApple: false,
            apple: null,
            growthProgress: 0,
            growthDirection: normal.clone(),
            growthRate: 0.5 + Math.random() * 0.5 // Random growth rate variation
          });
        }
      });
      
      this.growthPoints[treeId] = points;
    }
    
    console.log(`Generated ${this.growthPoints[treeId].length} growth points for tree ${treeId}`);
  }
  
  /**
   * Update the apple system
   * @param {number} deltaTime - Time since last update in seconds
   * @param {THREE.Vector3} playerPosition - Current player position
   */
  update(deltaTime, playerPosition) {
    // Increment update counter for throttling
    this.updateCounter++;
    
    // Limit TWEEN updates to once every 100ms (10fps) to improve performance
    const now = Date.now();
    if (now - this.lastTweenUpdate > 100) {
      // Update TWEEN but with a heavy rate limit
      if (TWEEN) {
        TWEEN.update();
      }
      this.lastTweenUpdate = now;
    }
    
    // EXTREME PERFORMANCE MODE: Skip most updates most of the time
    if (this.options.performanceMode) {
      // Only process apples every 4th frame
      if (this.updateCounter % 4 !== 0) {
        // On other frames, only check for collection if player is near
        if (playerPosition && this.updateCounter % 2 === 0) {
          this._checkAppleCollection(playerPosition);
        }
        return; // Skip rest of update
      }
      
      // When we do update, use larger delta to compensate for skipped frames
      deltaTime *= 4;
    }
    
    // Process apple growth - but only occasionally
    if (this.updateCounter % 2 === 0) {
      this._updateGrowingApples(deltaTime);
    }
    
    // Process apple falling
    this._updateFallingApples(deltaTime);
    
    // Check for new apple growth - heavily throttled
    if (this.updateCounter % 20 === 0) { // Only every 20th frame
      this._tryStartNewApples(deltaTime * 10); // Compensate for reduced frequency
    }
    
    // Check for apples that should fall - heavily throttled
    if (this.updateCounter % 30 === 0) { // Only every 30th frame
      this._tryDropApples(deltaTime * 10); // Compensate for reduced frequency
    }
    
    // Check for apple collection
    if (playerPosition) {
      this._checkAppleCollection(playerPosition);
    }
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
    // Update all growth points
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        // Skip points without growing apples
        if (!point.hasApple || point.growthProgress >= 1.0) return;
        
        // Update growth progress
        point.growthProgress += (deltaTime / this.options.growthTime) * point.growthRate;
        
        // Clamp progress
        point.growthProgress = Math.min(1.0, point.growthProgress);
        
        // Update apple appearance based on growth
        if (point.apple) {
          // Scale up as it grows 
          const growthCurve = this._easeOutCubic(point.growthProgress);
          const scale = 0.2 + growthCurve * 0.8;
          point.apple.scale.set(scale, scale, scale);
          
          // Skip wobble animation in performance mode
          if (!this.options.performanceMode && point.growthProgress < 0.95 && this.updateCounter % 6 === 0) {
            const wobble = Math.sin(Date.now() / 200) * 0.03 * (1 - point.growthProgress);
            point.apple.rotation.x = wobble;
            point.apple.rotation.z = wobble * 0.7;
          }
          
          // Change color based on ripeness - only if changed since last update
          const newMaterial = point.growthProgress < 0.6 ? this.unripeAppleMaterial :
                             (point.isGolden ? this.goldenAppleMaterial : this.appleMaterial);
          
          if (point.apple.material !== newMaterial) {
            point.apple.material = newMaterial;
          }
          
          // Skip shine effects in performance mode
          if (!this.options.performanceMode && 
              point.growthProgress > 0.8 && 
              !point.apple.userData.hasShine && 
              point.isGolden) {
            this._addAppleShine(point.apple, point.isGolden);
            point.apple.userData.hasShine = true;
          }
        }
      });
    });
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
    // Use fewer segments for performance
    const segments = this.options.appleSegments;
    const geometry = new THREE.SphereGeometry(this.options.appleRadius, segments, Math.max(6, segments - 2));
    
    // Determine if this will be a golden apple
    const isGolden = Math.random() < this.options.goldenAppleProbability;
    growthPoint.isGolden = isGolden;
    
    // Choose material based on initial growth state (always starts as unripe)
    const material = this.unripeAppleMaterial;
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add minimal stem for visual detail - simpler geometry
    const stemGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 4, 1); // Reduced segments
    stemGeometry.translate(0, this.options.appleRadius, 0);
    const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    mesh.add(stem);
    
    // Skip leaf in performance mode
    if (!this.options.performanceMode) {
      // Add leaf to stem for better visibility
      const leafGeometry = new THREE.PlaneGeometry(1.2, 2.0);
      const leafMaterial = new THREE.MeshLambertMaterial({
        color: 0x44aa22,
        side: THREE.DoubleSide
      });
      const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
      leaf.position.set(0.5, 1.2, 0);
      leaf.rotation.set(0, 0, Math.PI/4);
      stem.add(leaf);
    }
    
    // Position the apple
    mesh.position.copy(growthPoint.position);
    
    // Orient the apple with stem pointing against normal
    const normalMatrix = new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      growthPoint.normal,
      new THREE.Vector3(0, 1, 0)
    );
    mesh.setRotationFromMatrix(normalMatrix);
    
    // Start small and grow over time
    const initialScale = 0.2;
    mesh.scale.set(initialScale, initialScale, initialScale);
    
    // Track the apple in growth point
    growthPoint.hasApple = true;
    growthPoint.apple = mesh;
    growthPoint.growthProgress = 0;
    
    // Add to scene
    this.scene.add(mesh);
    
    // Skip glow effects in performance mode
    if (!this.options.performanceMode && isGolden) {
      // Add glow only for golden apples
      const glowSize = this.options.appleRadius * 1.1;
      const glowGeometry = new THREE.SphereGeometry(glowSize, 8, 6); // Reduced segments
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glow);
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
   * Update falling apples - simplified for performance
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  _updateFallingApples(deltaTime) {
    // Skip if we have no falling apples
    if (this.groundApples.length === 0) return;
    
    const gravity = this.options.gravity;
    const sphereRadius = this.options.sphereRadius;
    const getTerrainHeight = this.options.getTerrainHeight;
    
    // Process each falling apple
    for (let i = this.groundApples.length - 1; i >= 0; i--) {
      const apple = this.groundApples[i];
      
      // Skip apples already on the ground
      if (apple.isGrounded) {
        // Check lifetime
        apple.groundTime += deltaTime;
        if (apple.groundTime > this.options.groundLifetime) {
          // Apple has rotted away - remove it
          this._removeGroundApple(i);
        }
        continue;
      }
      
      // Get normalized direction for gravity using reusable vector
      this._vec3.copy(apple.position).normalize();
      
      // Apply gravity (reuse vector)
      apple.velocity.addScaledVector(this._vec3.negate(), gravity * deltaTime * 60);
      
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
        
        // Position at ground level
        apple.position.copy(
          this._vec3.normalize().multiplyScalar(groundRadius + this.options.appleRadius * 0.7)
        );
        
        // Add slight random rotation
        apple.mesh.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        
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
  }
  
  /**
   * Try to drop apples from trees
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  _tryDropApples(deltaTime) {
    // Calculate chance of ripe apple falling
    const chancePerApple = this.options.fallProbability * deltaTime;
    
    // Check each tree and its growth points
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        // Skip points without ripe apples
        if (!point.hasApple || point.growthProgress < 1.0) return;
        
        // Random chance for the apple to fall
        if (Math.random() < chancePerApple) {
          this._detachApple(point);
        }
      });
    });
  }
  
  /**
   * Detach an apple from its growth point and make it fall
   * @param {Object} growthPoint - The growth point
   * @private
   */
  _detachApple(growthPoint) {
    // Create falling apple object
    const apple = {
      position: growthPoint.position.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      mesh: growthPoint.apple,
      isGrounded: false,
      groundTime: 0,
      isGolden: growthPoint.isGolden
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
    // Calculate chance of new apple starting to grow
    const chancePerPoint = this.options.growthProbability * deltaTime;
    
    // Check each tree and its growth points
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        // Skip points that already have apples
        if (point.hasApple) return;
        
        // Random chance to start a new apple
        if (Math.random() < chancePerPoint) {
          this._startNewApple(point);
        }
      });
    });
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
   * Check if player can collect any apples - simplified for performance
   * @param {THREE.Vector3} playerPosition - Player position
   * @private
   */
  _checkAppleCollection(playerPosition) {
    // Use single collection radius for simplicity
    const collectionRadius = 10.0;
    
    // First check ground apples - they're more important
    for (let i = this.groundApples.length - 1; i >= 0; i--) {
      const apple = this.groundApples[i];
      
      // Skip apples still falling
      if (!apple.isGrounded) continue;
      
      // Check distance to player
      const distance = playerPosition.distanceTo(apple.position);
      
      if (distance < collectionRadius) {
        // Collect this apple
        this._collectApple(apple.isGolden ? 'goldenApple' : 'apple', apple.position);
        
        // Remove from scene and list
        this._removeGroundApple(i);
      }
    }
    
    // Then check tree apples - but only check a few per frame to distribute work
    // Divide checks across multiple frames
    let checkedCount = 0;
    const maxChecksPerFrame = 10; // Limit how many we check per frame
    
    for (const treeId in this.growthPoints) {
      const points = this.growthPoints[treeId];
      
      // Only process tree apples every Nth frame, where N is number of trees
      // This distributes the processing across frames
      if (this.updateCounter % Object.keys(this.growthPoints).length !== 
          Object.keys(this.growthPoints).indexOf(treeId)) {
        continue;
      }
      
      for (const point of points) {
        // Limit checks per frame
        if (checkedCount >= maxChecksPerFrame) break;
        
        // Skip points without ripe apples
        if (!point.hasApple || point.growthProgress < 0.8) continue;
        
        checkedCount++;
        
        // Check distance to player
        const distance = playerPosition.distanceTo(point.position);
        
        if (distance < collectionRadius * 0.7) {
          // Collect this apple
          const type = point.isGolden ? 'goldenApple' : 'apple';
          const position = point.position.clone();
          
          // Remove apple from tree
          this.scene.remove(point.apple);
          
          // Reset growth point
          point.hasApple = false;
          point.apple = null;
          point.growthProgress = 0;
          
          // Register collection
          this._collectApple(type, position);
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
  _collectApple(type, position) {
    // Update stats
    if (type === 'apple') {
      this.stats.applesCollected++;
      this.stats.totalCollected += this.options.appleValue;
    } else {
      this.stats.goldenApplesCollected++;
      this.stats.totalCollected += this.options.goldenAppleValue;
    }
    
    // Call collection callback
    if (this.options.onAppleCollected) {
      this.options.onAppleCollected(
        type, 
        type === 'apple' ? this.options.appleValue : this.options.goldenAppleValue,
        position
      );
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
  _playCollectionEffect(position, isGolden) {
    // Create very simple particle effect with minimal particles
    const particleCount = isGolden ? 5 : 3; // Drastically reduced
    const color = isGolden ? 0xffdd00 : 0xff2200;
    
    for (let i = 0; i < particleCount; i++) {
      // Create particle with minimal geometry
      const size = (isGolden ? 0.4 : 0.3) * (0.5 + Math.random() * 0.5);
      const geometry = new THREE.SphereGeometry(size, 4, 3); // Minimal segments
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
      });
      const particle = new THREE.Mesh(geometry, material);
      
      // Position at collection point
      particle.position.copy(position);
      
      // Random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(2 + Math.random() * 3);
      
      // Add to scene
      this.scene.add(particle);
      
      // Simplified animation - just fade out
      const duration = 300 + Math.random() * 200; // Shorter duration
      
      new TWEEN.Tween(material)
        .to({ opacity: 0 }, duration)
        .onComplete(() => {
          this.scene.remove(particle);
        })
        .start();
        
      // Move particle without TWEEN
      const finalPos = {
        x: particle.position.x + velocity.x,
        y: particle.position.y + velocity.y,
        z: particle.position.z + velocity.z
      };
      
      new TWEEN.Tween(particle.position)
        .to(finalPos, duration)
        .start();
    }
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
    
    console.log(`Apple system performance mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
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
    
    console.log("Apple system cleaned up");
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
    Object.values(this.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple) {
          point.growthProgress = 1.0;
          
          // Update appearance
          if (point.apple) {
            point.apple.scale.set(1, 1, 1);
            point.apple.material = point.isGolden ? 
                                this.goldenAppleMaterial : 
                                this.appleMaterial;
          }
        }
      });
    });
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
}