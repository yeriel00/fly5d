import * as THREE from 'three';
import { mergeVertices } from './utils/BufferGeometryUtils.js';  // relative import

/**
 * Utility class to create low-poly models for the world
 */
export default class LowPolyGenerator {
  /**
   * Create a low-poly tree with randomized features
   */
  static createTree(height = 10, trunkColor = null, leavesColor = null) {
    const group = new THREE.Group();
    group.userData = { noCollision: false };  // trees should collide
    
    // Random colors with constrained ranges for natural look
    const trunkCol = trunkColor || new THREE.Color(
      0.3 + Math.random() * 0.1,  // red
      0.15 + Math.random() * 0.1,  // green
      0.05 + Math.random() * 0.05  // blue
    );
    
    const leavesCol = leavesColor || new THREE.Color(
      0.1 + Math.random() * 0.1,  // red
      0.4 + Math.random() * 0.3,  // green
      0.05 + Math.random() * 0.1   // blue
    );
    
    // Calculate sizes based on height
    const trunkHeight = height * 0.4;
    const trunkRadius = height * 0.05;
    const leavesHeight = height * 0.7;
    const leavesRadius = height * 0.3;
    
    // Create trunk with low segment count for low-poly look
    const trunkGeo = new THREE.CylinderGeometry(
      trunkRadius * 0.7,  // top radius
      trunkRadius,        // bottom radius
      trunkHeight,
      5,                 // radial segments (was 5)
      3,                 // height segments (was 2 - increased to avoid gaps)
      false              // no open-ended cylinders to avoid gaps
    );
    
    // Apply random vertex displacement for more natural look
    this.applyRandomVertexDisplacement(trunkGeo, trunkRadius * 0.15);
    
    const trunkMat = new THREE.MeshLambertMaterial({
      color: trunkCol,
      flatShading: true
    });
    
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.position.y = trunkHeight / 2;
    group.add(trunk);
    
    // Create foliage - several intersecting cones
    const foliageCount = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < foliageCount; i++) {
      const heightRatio = 0.7 + (i * 0.2);
      const radiusRatio = 1.0 - (i * 0.15);
      
      const foliageGeo = new THREE.ConeGeometry(
        leavesRadius * radiusRatio,
        leavesHeight * heightRatio,
        8,  // increased from 6 to avoid gaps
        3,  // increased from 2 to avoid gaps
        false
      );
      
      // Apply random vertex displacement
      this.applyRandomVertexDisplacement(foliageGeo, leavesRadius * 0.2);
      
      const foliageMat = new THREE.MeshLambertMaterial({
        color: leavesCol,
        flatShading: true
      });
      
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      foliage.position.y = trunkHeight + (leavesHeight * heightRatio * 0.3);
      
      // Add slight random rotation
      foliage.rotation.y = Math.random() * Math.PI;
      group.add(foliage);
    }
    
    // Ensure all geometry has proper vertex normals
    group.traverse(child => {
      if (child.geometry) {
        child.geometry.computeVertexNormals();
      }
    });
    
    return group;
  }
  
  /**
   * Create a low-poly rock with randomized shape
   */
  static createRock(size = 1) {
    // Use an icosahedron with a slight subdivision
    const rockGeo = new THREE.IcosahedronGeometry(size, 1);
    mergeVertices(rockGeo);                    // weld vertices
    // Apply displacement
    this.applyRandomVertexDisplacement(rockGeo, size * 0.3);
    rockGeo.computeVertexNormals();            // smooth shading

    // Smooth-shaded material for a single‐solid look
    const rockMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0.5,0.5,0.5),
      flatShading: false
    });

    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.userData = { noCollision: false };    // rocks should collide
    return rock;
  }
  
  /**
   * Create a low-poly grass patch
   */
  static createGrass(size = 1) {
    const group = new THREE.Group();
    group.name = "GrassPatch"; // Add explicit name
    
    // Mark BOTH the group and its userData
    group.userData = { 
      isGrass: true,
      noCollision: true  // Add redundant flag
    };
    
    const bladeCount = 5 + Math.floor(Math.random() * 5);
    
    // Create individual grass blades
    for (let i = 0; i < bladeCount; i++) {
      const height = size * (0.5 + Math.random() * 0.5);
      const width = size * 0.1;
      
      // Create a proper triangle mesh
      const bladeGeo = new THREE.PlaneGeometry(width, height, 1, 1);
      // Transform it into a blade shape
      const posAttr = bladeGeo.getAttribute('position');
      const vertex = new THREE.Vector3();
      for (let v = 0; v < posAttr.count; v++) {
        vertex.fromBufferAttribute(posAttr, v);
        if (vertex.y > 0) {
          vertex.x = 0; // Middle top
        }
        posAttr.setXYZ(v, vertex.x, vertex.y, vertex.z);
      }
      
      bladeGeo.computeVertexNormals();
      
      // Randomize grass color
      const greenValue = 0.5 + Math.random() * 0.3;
      const bladeMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(0.15, greenValue, 0.1),
        flatShading: true,
        side: THREE.DoubleSide
      });
      
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      
      // Position randomly within the patch
      blade.position.x = (Math.random() - 0.5) * size;
      blade.position.z = (Math.random() - 0.5) * size;
      
      // Rotate randomly
      blade.rotation.y = Math.random() * Math.PI * 2;
      // Add a slight random lean
      blade.rotation.x = (Math.random() - 0.5) * 0.2;
      blade.rotation.z = (Math.random() - 0.5) * 0.2;
      
      blade.userData = { isGrass: true, noCollision: true };
      blade.name = "GrassBlade";
      group.add(blade);
    }
    
    return group;
  }
  
  /**
   * Apply random displacement to vertices for more natural shapes
   */
  static applyRandomVertexDisplacement(geometry, amount) {
    const posAttr = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();
    
    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      
      // Don't displace bottom vertices (for stable placement)
      if (vertex.y > 0.1) {
        vertex.x += (Math.random() - 0.5) * amount;
        vertex.y += (Math.random() - 0.5) * amount;
        vertex.z += (Math.random() - 0.5) * amount;
      }
      
      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  
  /**
   * Create an entire cluster of environmental objects
   */
  static createEnvironmentCluster() {
    const group = new THREE.Group();
    const size = 5 + Math.random() * 10;
    
    // Add 1-3 trees
    const treeCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < treeCount; i++) {
      const treeSize = 8 + Math.random() * 6;
      const tree = this.createTree(treeSize);
      tree.position.set(
        (Math.random() - 0.5) * size,
        0,
        (Math.random() - 0.5) * size
      );
      group.add(tree);
    }
    
    // Add 2-5 rocks
    const rockCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rockCount; i++) {
      const rockSize = 0.5 + Math.random() * 1.5;
      const rock = this.createRock(rockSize);
      rock.position.set(
        (Math.random() - 0.5) * size,
        0,
        (Math.random() - 0.5) * size
      );
      group.add(rock);
    }
    
    // Add 3-8 grass patches
    const grassCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < grassCount; i++) {
      const grassSize = 0.8 + Math.random() * 1.2;
      const grass = this.createGrass(grassSize);
      grass.position.set(
        (Math.random() - 0.5) * size,
        0,
        (Math.random() - 0.5) * size
      );
      group.add(grass);
    }
    
    return group;
  }
}
