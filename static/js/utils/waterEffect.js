import * as THREE from 'three';

/**
 * Simple water animation effect for the lake
 */
export class WaterEffect {
  constructor(waterMesh) {
    this.waterMesh = waterMesh;
    this.time = 0;
    this.amplitude = 0.03; // Wave height
    this.frequency = 0.5; // Wave frequency
    
    // Store original vertex positions
    if (this.waterMesh.geometry.attributes.position) {
      const positions = this.waterMesh.geometry.attributes.position.array;
      this.originalPositions = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i++) {
        this.originalPositions[i] = positions[i];
      }
    }
  }
  
  /**
   * Update the water animation effect
   * @param {number} delta - Time since last update
   */
  update(delta) {
    if (!this.waterMesh || !this.waterMesh.geometry) return;
    
    this.time += delta;
    
    const positions = this.waterMesh.geometry.attributes.position.array;
    const originalPositions = this.originalPositions;
    
    // Apply a simple sine wave animation to vertex z positions
    for (let i = 0; i < positions.length; i += 3) {
      const distance = Math.sqrt(
        originalPositions[i] * originalPositions[i] + 
        originalPositions[i+1] * originalPositions[i+1]
      );
      
      // Skip center vertex
      if (distance > 0.5) {
        // Create a wave effect
        const angle = distance * this.frequency + this.time;
        positions[i+2] = originalPositions[i+2] + 
                         Math.sin(angle) * this.amplitude * distance;
      }
    }
    
    this.waterMesh.geometry.attributes.position.needsUpdate = true;
  }
}
