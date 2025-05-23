import * as THREE from 'three';

/**
 * Utility class for creating debug visualizations
 */
export default class DebugUtils {
  /**
   * Create a new DebugUtils instance
   * @param {THREE.Scene} scene - The scene to add debug elements to
   */
  constructor(scene) {
    this.scene = scene;
    this.debugObjects = [];
  }
  
  /**
   * Create a debug sphere at a position
   * @param {THREE.Vector3} position - Position to place the sphere
   * @param {number} radius - Radius of the sphere
   * @param {number} color - Color of the sphere
   * @param {number} lifetime - How long to display in ms (0 = forever)
   * @returns {THREE.Mesh} The created sphere
   */
  createSphere(position, radius = 1, color = 0xff0000, lifetime = 0) {
    const geometry = new THREE.SphereGeometry(radius, 16, 8);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    this.scene.add(sphere);
    
    if (lifetime > 0) {
      setTimeout(() => {
        this.scene.remove(sphere);
        geometry.dispose();
        material.dispose();
      }, lifetime);
    } else {
      this.debugObjects.push({
        object: sphere,
        geometry: geometry,
        material: material
      });
    }
    
    return sphere;
  }
  
  /**
   * Create a debug line between two points
   * @param {THREE.Vector3} start - Start position
   * @param {THREE.Vector3} end - End position
   * @param {number} color - Color of the line
   * @param {number} lifetime - How long to display in ms (0 = forever)
   * @returns {THREE.Line} The created line
   */
  createLine(start, end, color = 0x00ff00, lifetime = 0) {
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7
    });
    
    const points = [start.clone(), end.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    
    if (lifetime > 0) {
      setTimeout(() => {
        this.scene.remove(line);
        geometry.dispose();
        material.dispose();
      }, lifetime);
    } else {
      this.debugObjects.push({
        object: line,
        geometry: geometry,
        material: material
      });
    }
    
    return line;
  }
  
  /**
   * Create a ray to visualize a direction from a point
   * @param {THREE.Vector3} origin - Origin position
   * @param {THREE.Vector3} direction - Direction vector
   * @param {number} length - Length of the ray
   * @param {number} color - Color of the ray
   * @param {number} lifetime - How long to display in ms (0 = forever)
   * @returns {THREE.Line} The created ray
   */
  createRay(origin, direction, length = 10, color = 0x0000ff, lifetime = 0) {
    const normalizedDir = direction.clone().normalize();
    const endpoint = origin.clone().add(normalizedDir.multiplyScalar(length));
    return this.createLine(origin, endpoint, color, lifetime);
  }
  
  /**
   * Create a box helper for an object
   * @param {THREE.Object3D} object - Object to create box helper for
   * @param {number} color - Color of the box
   * @param {number} lifetime - How long to display in ms (0 = forever)
   * @returns {THREE.BoxHelper} The created box helper
   */
  createBoxHelper(object, color = 0xffff00, lifetime = 0) {
    const boxHelper = new THREE.BoxHelper(object, color);
    this.scene.add(boxHelper);
    
    if (lifetime > 0) {
      setTimeout(() => {
        this.scene.remove(boxHelper);
      }, lifetime);
    } else {
      this.debugObjects.push({
        object: boxHelper,
        dispose: () => {} // BoxHelper doesn't need explicit disposal
      });
    }
    
    return boxHelper;
  }
  
  /**
   * Create a collision visualization between a projectile and object
   * @param {THREE.Vector3} position - Collision position
   * @param {THREE.Vector3} normal - Collision normal
   * @param {number} lifetime - How long to display in ms
   */
  visualizeCollision(position, normal, lifetime = 2000) {
    // Collision point
    this.createSphere(position, 0.5, 0xff0000, lifetime);
    
    // Normal direction
    this.createRay(position, normal, 3, 0xff00ff, lifetime);
  }
  
  /**
   * Visualize the approximate bounds of the ground fog.
   * Creates a wireframe sphere representing the effective height around the world origin.
   * @param {FXManager} fxManager - The FXManager instance containing fog settings.
   * @param {number} worldRadius - The radius of the spherical world. Defaults to 400.
   * @param {number} color - Color of the wireframe sphere.
   * @returns {THREE.Mesh} The created sphere mesh.
   */
  visualizeFogBounds(fxManager, worldRadius = 400, color = 0xffff00) { // Added worldRadius parameter
    if (!fxManager || !fxManager.volumetricFog || !fxManager.volumetricFog.enabled) {
      console.warn('[DebugUtils] Volumetric fog is not available or not enabled in fxManager.');
      return null;
    }

    const fogHeight = fxManager.volumetricFog.options.groundFogHeight;
    if (fogHeight === undefined) {
      console.warn('[DebugUtils] Could not retrieve groundFogHeight from fxManager.');
      return null;
    }

    // Calculate the radius of the fog sphere
    const fogSphereRadius = worldRadius + fogHeight;

    // Create a sphere geometry instead of a box
    const geometry = new THREE.SphereGeometry(fogSphereRadius, 32, 16); // Use SphereGeometry
    const material = new THREE.MeshBasicMaterial({
      color: color,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
      depthWrite: false // Make sure it doesn't obscure things behind it
    });

    const sphere = new THREE.Mesh(geometry, material); // Changed variable name from box to sphere
    // Position the sphere at the world origin (0, 0, 0)
    sphere.position.set(0, 0, 0); // Center the sphere

    this.scene.add(sphere);

    // Add to debug objects for cleanup
    this.debugObjects.push({
      object: sphere,
      geometry: geometry,
      material: material
    });

    console.log(`[DebugUtils] Visualizing fog bounds with sphere radius: ${fogSphereRadius} (World Radius: ${worldRadius}, Fog Height: ${fogHeight})`); // Updated log
    return sphere; // Return the sphere mesh
  }

  /**
   * Clear all debug objects
   */
  clear() {
    this.debugObjects.forEach(obj => {
      this.scene.remove(obj.object);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this.debugObjects = [];
  }
}
