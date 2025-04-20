import * as THREE from 'three';
import { mergeVertices } from './utils/BufferGeometryUtils.js';  // relative import

/**
 * Utility class to create low-poly models for the world
 */
export default class LowPolyGenerator {
  /**
   * Create a low-poly apple tree with fruit
   * This tree will be smaller with brighter foliage and red apples
   */
  static createTree(height = 10, trunkColor = null, leavesColor = null) {
    const group = new THREE.Group();
    group.userData = { 
      noCollision: false,
      isAppleTree: true
    };
    
    // Colors for apple trees - brighter green foliage
    const trunkCol = trunkColor || new THREE.Color(0.35, 0.20, 0.1);
    const leavesCol = leavesColor || new THREE.Color(0.2, 0.5, 0.1); // Brighter green
    
    // Calculate sizes based on height - apple trees are more compact
    const trunkHeight = height * 0.5; // Shorter trunk ratio 
    const trunkRadius = height * 0.04;
    const leavesHeight = height * 0.8; // Fuller foliage
    const leavesRadius = height * 0.4; // Wider foliage
    
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
    
    // Create foliage - rounder shape for apple trees
    const foliageCount = 3 + Math.floor(Math.random() * 2); // More foliage clusters
    
    for (let i = 0; i < foliageCount; i++) {
      // Use more spherical shapes for apple tree foliage
      const foliageGeo = new THREE.SphereGeometry(
        leavesRadius * (1.0 - i * 0.1),
        8, 6
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
      foliage.position.y = trunkHeight + (leavesHeight * (1.0 - i * 0.1) * 0.3);
      
      // Add slight random rotation
      foliage.rotation.y = Math.random() * Math.PI;
      group.add(foliage);
    }
    
    // Add apples to the tree
    const appleCount = Math.floor(Math.random() * 8) + 4; // 4-12 apples
    this.addApplesToTree(group, leavesRadius, trunkHeight, appleCount);
    
    // Ensure all geometry has proper vertex normals
    group.traverse(child => {
      if (child.geometry) {
        child.geometry.computeVertexNormals();
      }
    });
    
    return group;
  }
  
  /**
   * Add apples to an apple tree
   */
  static addApplesToTree(treeGroup, radius, trunkHeight, count) {
    // Create an apple template
    const appleGeometry = new THREE.SphereGeometry(0.15, 8, 6); // Small apple
    const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 4, 1);
    
    // Apply slight displacement to apple for organic shape
    this.applyRandomVertexDisplacement(appleGeometry, 0.03);
    
    // Create materials
    const appleMaterial = new THREE.MeshLambertMaterial({ 
      color: new THREE.Color(0.8, 0.15, 0.15) // Red apple
    });
    const stemMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0.3, 0.2, 0.1) // Brown stem
    });
    
    // Place apples around the foliage
    for (let i = 0; i < count; i++) {
      // Create apple group (sphere + stem)
      const appleGroup = new THREE.Group();
      
      // Create apple mesh
      const apple = new THREE.Mesh(appleGeometry, appleMaterial);
      apple.castShadow = true;
      appleGroup.add(apple);
      
      // Create stem mesh
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.position.y = 0.15; // Position on top of apple
      appleGroup.add(stem);
      
      // Position the apple randomly in the foliage
      const angle = Math.random() * Math.PI * 2;
      const height = trunkHeight + Math.random() * radius * 0.8;
      const distFromTrunk = (0.5 + Math.random() * 0.5) * radius;
      
      appleGroup.position.set(
        Math.cos(angle) * distFromTrunk,
        height,
        Math.sin(angle) * distFromTrunk
      );
      
      // Random rotation
      appleGroup.rotation.set(
        Math.random() * 0.2,
        Math.random() * Math.PI * 2,
        Math.random() * 0.2
      );
      
      // Add metadata for detachment
      appleGroup.userData = {
        isApple: true,
        detachable: true,
        noCollision: false,
        isFruit: true,
        mass: 1.0
      };
      
      // Name for identification
      appleGroup.name = "Apple";
      
      // Add apple to tree
      treeGroup.add(appleGroup);
    }
  }
  
  /**
   * Create a detached apple with physics properties
   */
  static createDetachedApple(position) {
    // Create a physics-enabled apple
    const appleGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    this.applyRandomVertexDisplacement(appleGeometry, 0.03);
    
    const appleMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0.8, 0.15, 0.15)
    });
    
    const apple = new THREE.Mesh(appleGeometry, appleMaterial);
    apple.position.copy(position);
    apple.castShadow = true;
    
    // Add physics properties
    apple.userData = {
      isApple: true,
      isDetached: true,
      noCollision: false,
      isFruit: true,
      mass: 1.0,
      velocity: new THREE.Vector3(0, 0, 0),
      angularVelocity: new THREE.Vector3(
        Math.random() * 0.05,
        Math.random() * 0.05,
        Math.random() * 0.05
      )
    };
    
    apple.name = "DetachedApple";
    
    return apple;
  }
  
  /**
   * Create a low-poly rock with randomized shape
   */
  static createRock(size = 1) {
    // Use a higher detail level for rocks
    const rockGeo = new THREE.IcosahedronGeometry(size, 2); // Higher subdivision (was 1)
    
    // Ensure vertices are properly welded
    mergeVertices(rockGeo);
    
    // More gentle displacement for a more unified appearance
    this.applyRandomVertexDisplacement(rockGeo, size * 0.15); // Less displacement (was 0.3)
    
    // Ensure normals are correct
    rockGeo.computeVertexNormals();
    
    // Use a smoother material to give solid appearance
    const rockMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0.5, 0.5, 0.5),
      flatShading: false, // Smooth shading
      roughness: 0.8,     // Make it rough-looking
      metalness: 0.1      // Slightly metallic (like minerals)
    });
    
    const rock = new THREE.Mesh(rockGeo, rockMat);
    
    // Slightly squash the rock to make it more stable-looking
    rock.scale.y = 0.7 + Math.random() * 0.3; // More consistent Y scale
    
    // Mark as collidable
    rock.userData = { 
      noCollision: false,
      isRock: true,       // Identify as rock
      isSolid: true,      // Mark as solid for physics
      friction: 0.8       // High friction coefficient
    };
    
    return rock;
  }

  // Create a special boulder that's larger and more climbable
  static createBoulder(size = 3) {
    // Similar to createRock but with different parameters
    const boulderGeo = new THREE.IcosahedronGeometry(size, 2);
    mergeVertices(boulderGeo);
    
    // Apply displacement targeted to create climbing surfaces
    this.applyRockDisplacement(boulderGeo, size * 0.2);
    
    const rockMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.6, 0.6, 0.6),
      flatShading: false,
      roughness: 0.9,
      metalness: 0.05
    });
    
    const boulder = new THREE.Mesh(boulderGeo, rockMat);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    
    boulder.userData = { 
      noCollision: false, 
      isRock: true,
      isBoulder: true,
      friction: 0.7
    };
    
    return boulder;
  }

  // Special displacement function for rock formations
  static applyRockDisplacement(geometry, amount) {
    const posAttr = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();
    const normal = new THREE.Vector3();
    
    // Calculate or get normals if they exist
    const normalAttr = geometry.getAttribute('normal');
    
    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      
      // Get the normal direction
      if (normalAttr) {
        normal.fromBufferAttribute(normalAttr, i);
      } else {
        normal.set(
          vertex.x / vertex.length(),
          vertex.y / vertex.length(), 
          vertex.z / vertex.length()
        );
      }
      
      // Displace mostly along normal with varying amounts
      const dispAmount = Math.random() * amount;
      vertex.add(normal.multiplyScalar(dispAmount));
      
      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
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
