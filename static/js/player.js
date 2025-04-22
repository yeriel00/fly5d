import * as THREE from 'three';
import SphereControls from './SphereControls.js';
import OrientationHelper from './OrientationHelper.js';

/**
 * Player class that manages the first-person character
 */
export default class Player {
  /**
   * Create a new player
   * @param {Object} options - Player configuration
   */
  constructor(scene, canvas, options = {}) {
    this.scene = scene;
    this.canvas = canvas;
    this.options = Object.assign({
      // Default options
      startPosition: new THREE.Vector3(0, 1, 0).normalize(),
      startElevation: 30,
      eyeHeight: 3.8,
      moveSpeed: 2.0,
      lookSpeed: 0.002,
      jumpStrength: 5.0,
      gravity: 0.015,
      maxJumps: 2,
      playerRadius: 2.0,
      playerColor: 0x0000FF, // Blue
      debugMode: false,
    }, options);

    // Initialize components
    this._initCamera();
    this._initControls();

    // Add player object to scene
    scene.add(this.playerObject);
    
    // Debug body (visible representation of player if debugMode is enabled)
    if (this.options.debugMode) {
      this._createDebugBody();
    }
  }

  /**
   * Initialize the player camera
   */
  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      2000
    );
  }

  /**
   * Initialize player controls
   */
  _initControls() {
    const startTerrainHeight = this.options.getTerrainHeight(this.options.startPosition);
    
    this.controls = new SphereControls(
      this.camera,
      this.canvas,
      {
        sphereRadius: this.options.sphereRadius,
        getTerrainHeight: this.options.getTerrainHeight,
        moveSpeed: this.options.moveSpeed,
        lookSpeed: this.options.lookSpeed,
        jumpStrength: this.options.jumpStrength,
        gravity: this.options.gravity,
        maxJumps: this.options.maxJumps,
        eyeHeight: this.options.eyeHeight,
        createPlayerBody: true,
        playerRadius: this.options.playerRadius,
        collidables: this.options.collidables,
        startPosition: this.options.startPosition,
        startElevation: this.options.startElevation
      }
    );
    
    this.playerObject = this.controls.getObject();
    
    // Add orientation helper
    this.orientHelper = new OrientationHelper(this.playerObject);
  }

  /**
   * Create a visible representation of the player (for debug mode)
   */
  _createDebugBody() {
    const height = this.options.playerRadius * 2;
    const geometry = new THREE.CylinderGeometry(
      this.options.playerRadius, 
      this.options.playerRadius, 
      height, 
      16, // radial segments for smoothness
      1,  // height segments
      false
    );
    const material = new THREE.MeshBasicMaterial({
      color: this.options.playerColor,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    
    this.debugBody = new THREE.Mesh(geometry, material);
    // Offset the cylinder so its base is at y=0 instead of centered
    this.debugBody.position.set(0, -height / 2, 0);
    this.playerObject.add(this.debugBody);
  }

  /**
   * Update player (call this every frame)
   * @param {number} delta - Time since last update
   */
  update(delta) {
    // Update player controls
    this.controls.update(delta);
    
    // Re-orthonormalize player axes
    this.orientHelper.update();
  }

  /**
   * Get player camera for rendering
   * @returns {THREE.Camera} - The player camera
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Update player physics parameters
   * @param {Object} params - Physics parameters to update
   */
  updatePhysics(params = {}) {
    if (params.gravity !== undefined) {
      this.controls.gravity = params.gravity;
    }
    
    if (params.jumpStrength !== undefined) {
      this.controls.jumpStrength = params.jumpStrength;
    }
    
    if (params.maxJumps !== undefined) {
      this.controls.maxJumps = params.maxJumps;
      this.controls.jumpsRemaining = Math.min(
        this.controls.jumpsRemaining, 
        params.maxJumps
      );
    }
  }

  /**
   * Force player to jump
   */
  makeJump() {
    this.controls.velocity.addScaledVector(
      this.playerObject.position.clone().normalize(),
      this.options.jumpStrength
    );
    this.controls.isJumping = true;
    this.controls.onGround = false;
  }

  /**
   * Get player state information for debugging
   * @returns {Object} - Current player state
   */
  getInfo() {
    const pos = this.playerObject.position;
    const velocity = this.controls.getVelocity();
    const gravDir = pos.clone().normalize().negate();
    const gravComponent = velocity.dot(gravDir);
    
    return {
      position: pos.clone(),
      velocity: velocity.clone(),
      speed: velocity.length(),
      height: pos.length() - this.options.sphereRadius,
      onGround: this.controls.onGround,
      isJumping: this.controls.isJumping,
      jumpsRemaining: this.controls.jumpsRemaining,
      maxJumps: this.controls.maxJumps,
      isGravityWorking: gravComponent > 0, // falling = true, rising = false
      verticalSpeed: gravComponent
    };
  }

  /**
   * Reset player to starting position
   */
  reset() {
    this.controls.reset();
  }

  /**
   * Handle window resize events
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }
}
