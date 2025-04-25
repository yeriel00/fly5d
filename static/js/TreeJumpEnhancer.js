import * as THREE from 'three';

/**
 * TreeJumpEnhancer class that provides enhanced jumping off trees
 */
export default class TreeJumpEnhancer {
  /**
   * Create a new tree jump enhancer
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      maxBoostTime: 0.3,         // Maximum time boost can be active (seconds)
      boostMultiplier: 1.6,      // Jump strength multiplier when boosting
      cooldown: 1.0,             // Cooldown between boosts (seconds)
      treeCollisionRadius: 5.0,  // How close to a tree to enable boost
      debugMode: false           // Whether to show debug visuals
    }, options);
    
    this.state = {
      nearTree: false,            // Whether player is near a tree
      lastBoostTime: 0,           // When the last boost was used
      boostAvailable: false,      // Whether boost is available
      activeTrees: []             // Trees that are close enough for boosting
    };
    
    // Create reusable vector object
    this._tempVec = new THREE.Vector3();
  }
  
  /**
   * Update the tree jump enhancer
   * @param {number} deltaTime - Time since last update
   * @param {number} currentTime - Current game time
   * @param {THREE.Vector3} playerPosition - Current player position
   * @param {boolean} isJumping - Whether player is currently jumping
   * @param {boolean} onGround - Whether player is on the ground
   * @param {Array} trees - List of trees to check
   * @param {THREE.Scene} debugScene - Scene to add debug visuals to
   */
  update(deltaTime, currentTime, playerPosition, isJumping, onGround, trees, debugScene = null) {
    // Clean up any previous debug visuals
    if (this.options.debugMode && debugScene) {
      this._cleanupDebugVisuals(debugScene);
    }
    
    // Reset active trees
    this.state.activeTrees = [];
    this.state.nearTree = false;

    // Check if player is near any trees
    if (trees && trees.length > 0) {
      trees.forEach(tree => {
        if (this._isNearTree(playerPosition, tree)) {
          this.state.nearTree = true;
          this.state.activeTrees.push(tree);
          
          // Add debug visual if enabled
          if (this.options.debugMode && debugScene) {
            this._createTreeDebug(tree, debugScene);
          }
        }
      });
    }
    
    // Check if boost is available
    const timeSinceLastBoost = currentTime - this.state.lastBoostTime;
    this.state.boostAvailable = this.state.nearTree && 
                               timeSinceLastBoost > this.options.cooldown &&
                               !onGround;
                               
    // Update debug text
    if (this.options.debugMode) {
      console.log(`TreeJump: near=${this.state.nearTree}, available=${this.state.boostAvailable}, trees=${this.state.activeTrees.length}`);
    }
  }
  
  /**
   * Check if player is near a tree
   * @param {THREE.Vector3} playerPosition - Current player position
   * @param {Object} tree - Tree object from collidables
   * @returns {boolean} Whether player is near the tree
   * @private
   */
  _isNearTree(playerPosition, tree) {
    if (!tree.position || !tree.direction) {
      return false;
    }
    
    // Get tree position
    const treePos = tree.position;
    
    // Calculate distance to tree
    const distToTree = playerPosition.distanceTo(treePos);
    
    // Check if player is within boost range of the tree
    return distToTree < this.options.treeCollisionRadius;
  }
  
  /**
   * Get whether player is near a tree
   * @param {THREE.Vector3} playerPosition - Current player position
   * @returns {boolean} Whether player is near any tree
   */
  isNearTree(playerPosition) {
    return this.state.nearTree;
  }
  
  /**
   * Get whether boost is available
   * @returns {boolean} Whether boost is available
   */
  canBoost() {
    return this.state.boostAvailable;
  }
  
  /**
   * Try to perform a boosted jump
   * @param {THREE.Vector3} direction - Direction player is facing
   * @param {Function} callback - Function to call if boost is successful
   * @returns {boolean} Whether boost was performed
   */
  tryBoost(direction, callback) {
    if (!this.state.boostAvailable) {
      return false;
    }
    
    // Get current time
    const currentTime = Date.now() / 1000;
    
    // Set boost as used
    this.state.lastBoostTime = currentTime;
    
    // Choose a tree to use for jump direction
    if (this.state.activeTrees.length > 0) {
      const tree = this.state.activeTrees[0];
      
      // Get tree direction (up from ground)
      const treeDir = tree.direction.clone();
      
      // Blend tree direction with player facing direction
      const jumpDir = direction.clone().add(
        treeDir.multiplyScalar(0.5)
      ).normalize();
      
      // Call callback with boost parameters
      callback(jumpDir, this.options.boostMultiplier);
      
      return true;
    }
    
    // No valid trees found
    return false;
  }
  
  /**
   * Create debug visuals for a tree
   * @param {Object} tree - Tree object
   * @param {THREE.Scene} scene - Scene to add visual to
   * @private
   */
  _createTreeDebug(tree, scene) {
    // Create sphere to show tree boost radius
    const geometry = new THREE.SphereGeometry(this.options.treeCollisionRadius, 16, 12);
    const material = new THREE.MeshBasicMaterial({
      color: this.state.boostAvailable ? 0x00ff00 : 0xffff00,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(tree.position);
    sphere.userData = { isTreeJumpHelper: true };
    scene.add(sphere);
  }
  
  /**
   * Clean up any debug visuals
   * @param {THREE.Scene} scene - Scene to remove visuals from
   * @private 
   */
  _cleanupDebugVisuals(scene) {
    scene.traverse(obj => {
      if (obj.userData?.isTreeJumpHelper) {
        scene.remove(obj);
      }
    });
  }
}
