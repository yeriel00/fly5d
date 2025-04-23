import * as THREE from 'three';

/**
 * Debug overlay for visualizing projectile collisions
 */
export default class ProjectileDebugger {
  /**
   * Create a new projectile debugger
   * @param {THREE.Scene} scene - The scene to add visuals to
   */
  constructor(scene) {
    this.scene = scene;
    this.visuals = [];
    this.enabled = false;
    this.maxVisuals = 100; // Maximum number of visualizations to keep
  }
  
  /**
   * Enable or disable debugging
   * @param {boolean} enabled - Whether to enable debugging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    // Clear all visuals when disabling
    if (!enabled) {
      this.clearVisuals();
    }
  }
  
  /**
   * Visualize a collision check
   * @param {THREE.Vector3} start - Start position
   * @param {THREE.Vector3} end - End position
   * @param {number} distance - Distance between objects
   * @param {number} threshold - Collision threshold
   * @param {boolean} collided - Whether collision occurred
   * @param {number} duration - How long to show the visual (ms)
   */
  visualizeCollisionCheck(start, end, distance, threshold, collided, duration = 500) {
    if (!this.enabled) return;
    
    // Create line between points
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      start.clone(),
      end.clone()
    ]);
    
    const lineMat = new THREE.LineBasicMaterial({
      color: collided ? 0xff0000 : 0x00ff00,
      transparent: true,
      opacity: collided ? 0.8 : 0.4
    });
    
    const line = new THREE.Line(lineGeo, lineMat);
    this.scene.add(line);
    
    // Create dot at collision point
    if (collided) {
      const dotSize = 0.1;
      const dotGeo = new THREE.SphereGeometry(dotSize, 8, 6);
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.9
      });
      
      const dot = new THREE.Mesh(dotGeo, dotMat);
      
      // Position dot at middle point
      dot.position.copy(start.clone().add(end).multiplyScalar(0.5));
      
      this.scene.add(dot);
      
      // Store both objects
      this.visuals.push({ 
        objects: [line, dot], 
        expires: Date.now() + duration 
      });
    } else {
      // Just store the line
      this.visuals.push({ 
        objects: [line], 
        expires: Date.now() + duration 
      });
    }
    
    // Limit total visuals
    if (this.visuals.length > this.maxVisuals) {
      const oldestVisual = this.visuals.shift();
      this._removeVisual(oldestVisual);
    }
  }
  
  /**
   * Update debug visuals (call each frame)
   */
  update() {
    if (!this.enabled) return;
    
    const now = Date.now();
    const expired = [];
    
    // Find expired visuals
    for (let i = 0; i < this.visuals.length; i++) {
      if (now > this.visuals[i].expires) {
        expired.push(i);
      }
    }
    
    // Remove expired visuals (in reverse order to not mess up indices)
    for (let i = expired.length - 1; i >= 0; i--) {
      const idx = expired[i];
      const visual = this.visuals[idx];
      
      // Remove from scene
      this._removeVisual(visual);
      
      // Remove from array
      this.visuals.splice(idx, 1);
    }
  }
  
  /**
   * Remove a visual from the scene
   * @param {Object} visual - The visual to remove
   */
  _removeVisual(visual) {
    if (!visual || !visual.objects) return;
    
    visual.objects.forEach(obj => {
      if (obj && obj.parent) {
        this.scene.remove(obj);
      }
    });
  }
  
  /**
   * Clear all debug visuals
   */
  clearVisuals() {
    this.visuals.forEach(visual => this._removeVisual(visual));
    this.visuals = [];
  }
}
