
/**
 * Camera effects for enhanced visual feedback
 */
export default class CameraEffects {
  /**
   * Apply effects to the camera
   * @param {THREE.Camera} camera - The camera to apply effects to
   */
  constructor(camera) {
    this.camera = camera;
    this.initialPosition = camera.position.clone();
    this.initialQuaternion = camera.quaternion.clone();
    this.shakeAmount = 0;
    this.shakeDuration = 0;
    this.shakeStartTime = 0;
    this.shakeOffset = new THREE.Vector3();
  }
  
  /**
   * Apply a camera shake effect
   * @param {number} amount - Strength of the shake
   * @param {number} duration - Duration in seconds
   */
  shake(amount = 0.5, duration = 0.5) {
    this.shakeAmount = amount;
    this.shakeDuration = duration;
    this.shakeStartTime = Date.now();
  }
  
  /**
   * Update effects each frame
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Handle camera shake
    if (this.shakeAmount > 0) {
      const elapsed = (Date.now() - this.shakeStartTime) / 1000;
      
      if (elapsed < this.shakeDuration) {
        // Calculate shake intensity (decreases over time)
        const intensity = this.shakeAmount * (1 - elapsed / this.shakeDuration);
        
        // Apply random offset to camera
        this.shakeOffset.set(
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity
        );
        
        this.camera.position.add(this.shakeOffset);
        
        // Store the applied offset for next frame
        this.lastOffset = this.shakeOffset.clone();
      } else {
        // Shake finished
        this.shakeAmount = 0;
        this.lastOffset = null;
      }
    }
  }
  
  /**
   * Clean up effects
   */
  dispose() {
    // Reset camera to initial state if needed
    if (this.camera) {
      this.camera.position.copy(this.initialPosition);
      this.camera.quaternion.copy(this.initialQuaternion);
    }
  }
}
