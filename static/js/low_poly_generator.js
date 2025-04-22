import * as THREE from 'three';
import { mergeVertices } from './utils/BufferGeometryUtils.js';  // relative import

/**
 * Utility class to create low-poly models for the world
 */
export default class LowPolyGenerator {
  /**
   * Create a clay-style apple tree with spherical foliage
   * @param {number} height - Total height of the tree
   * @param {THREE.Color|null} trunkColor - Optional custom trunk color
   * @param {THREE.Color|null} leavesColor - Optional custom leaves color
   * @param {number} trunkRatio - Ratio of trunk height to total height (0.0-1.0)
   * @param {number|null} explicitTrunkHeight - Direct trunk height value (overrides ratio if provided)
   * @param {number} foliageScale - Multiplier for foliage size (1.0 = default size)
   */
  static createTree(height = 10, trunkColor = null, leavesColor = null, trunkRatio = 0.65, 
                   explicitTrunkHeight = null, foliageScale = 1.0) {
    const group = new THREE.Group();
    group.name = "AppleTree"; // Updated name from ClayTree to AppleTree
    
    group.userData = { 
      noCollision: false,
      isTree: true,
    };
    
    // Use explicit trunk height if provided, otherwise calculate from ratio
    const trunkHeight = explicitTrunkHeight !== null ? 
      explicitTrunkHeight : 
      height * trunkRatio;
    
    // Calculate effective trunk ratio for parameter scaling
    const effectiveRatio = trunkHeight / height;
    
    // Scale trunk radius based on effective ratio
    const baseRadius = height * 0.03;
    const trunkRadius = baseRadius * (1.0 + effectiveRatio * 0.7);
    
    // Calculate base foliage size inversely to effective ratio
    const trunkScaleEffect = 1.0 - (effectiveRatio - 0.65) * 0.6;
    
    // Apply custom foliage scale on top of the base calculation
    // This allows direct control of foliage size independent of trunk
    const finalFoliageScale = trunkScaleEffect * foliageScale;
    const foliageRadius = height * 0.25 * Math.max(0.6, finalFoliageScale);
    
    // Create trunk with base at y=0
    const trunkGeo = new THREE.CylinderGeometry(
      trunkRadius * 0.8, // Top
      trunkRadius * 1.4, // INCREASED: Make base wider for visual stability
      trunkHeight,
      8,
      5,
      false
    );
    
    // Apply stronger trunk deformation for more character when trunk is prominent
    this.applyClayDeformation(trunkGeo, trunkRadius * (0.08 + trunkRatio * 0.05));
    
    const trunkMat = new THREE.MeshStandardMaterial({
      color: trunkColor || new THREE.Color(0.42, 0.28, 0.18),
      roughness: 0.8,
      metalness: 0.0,
      flatShading: false
    });
    
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    
    // Position trunk with its base at y=0
    trunk.position.y = trunkHeight / 2;
    group.add(trunk);
    
    // Create foliage spheres with scaled sizes
    const foliagePositions = [
      // Main top foliage - positioned higher on taller trunk
      { 
        radius: foliageRadius * 1.1,  
        offset: new THREE.Vector3(0, trunkHeight + foliageRadius * 0.3, 0)
      },
      // Left-side foliage - moved higher on trunk
      {
        radius: foliageRadius * 0.8,
        offset: new THREE.Vector3(-foliageRadius * 0.7, trunkHeight * 0.85, foliageRadius * 0.2)
      },
      // Right-side foliage - moved higher on trunk
      {
        radius: foliageRadius * 0.75,
        offset: new THREE.Vector3(foliageRadius * 0.65, trunkHeight * 0.8, -foliageRadius * 0.3)
      }
    ];
    
    // Create each foliage sphere with specific placement
    foliagePositions.forEach(foliage => {
      const foliageGeo = new THREE.SphereGeometry(
        foliage.radius,
        10, 8
      );
      
      this.applyClayDeformation(foliageGeo, foliage.radius * 0.12);
      
      const foliageMat = new THREE.MeshStandardMaterial({
        color: leavesColor || new THREE.Color(0.26, 0.48, 0.18),
        roughness: 0.75,
        metalness: 0.0,
        flatShading: false
      });
      
      const foliageMesh = new THREE.Mesh(foliageGeo, foliageMat);
      foliageMesh.castShadow = true;
      foliageMesh.receiveShadow = true;
      
      foliageMesh.position.copy(foliage.offset);
      group.add(foliageMesh);
    });
    
    // Store foliage scale in userData for reference
    group.userData.totalHeight = trunkHeight + foliageRadius * 2;
    group.userData.foliageScale = foliageScale;
    
    return group;
  }
  
  /**
   * Create a clay-style pine tree with cone-shaped foliage
   * @param {number} height - Total height of the tree
   * @param {number} levels - Number of foliage levels
   * @param {number} trunkRatio - Ratio of trunk height to total height (0.0-1.0)
   */
  static createPineTree(height = 15, levels = 4, trunkRatio = 0.7) {
    const group = new THREE.Group();
    group.name = "PineTree"; // Added explicit name
    
    // Clay-like colors for pine trees
    const trunkCol = new THREE.Color(0.35, 0.22, 0.15); // Darker trunk
    const foliageCol = new THREE.Color(0.15, 0.35, 0.15); // Darker green
    
    // Set proportions based on ratio parameter
    const trunkHeight = height * trunkRatio; // Use provided trunk ratio
    const trunkRadius = height * 0.035; // Thin trunk
    const baseWidth = height * 0.35; // Width at base of foliage
    
    // Create trunk with clay deformation
    const trunkGeo = new THREE.CylinderGeometry(
      trunkRadius * 0.7, // Thinner at top
      trunkRadius * 1.1, // Wider at base
      trunkHeight,
      8,
      6,
      false
    );
    
    // Apply clay deformation to trunk
    this.applyClayDeformation(trunkGeo, trunkRadius * 0.1);
    
    const trunkMat = new THREE.MeshStandardMaterial({
      color: trunkCol,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false
    });
    
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    
    // FIXED: Position trunk exactly half its height above ground level
    // This ensures it's properly grounded when placed
    trunk.position.y = trunkHeight / 2;
    group.add(trunk);
    
    // Create pine tree foliage as stacked cones
    const foliageHeight = height * (1 - trunkRatio) * 1.5; // Adjusted for overlap
    const levelHeight = foliageHeight / levels;
    
    for (let i = 0; i < levels; i++) {
      // Each level gets smaller as we go up
      const levelFactor = 1 - (i / levels) * 0.7;
      const coneRadius = baseWidth * levelFactor;
      const coneHeight = levelHeight * 1.5; // Overlap levels
      
      const coneGeo = new THREE.ConeGeometry(
        coneRadius,
        coneHeight,
        9, // More segments for rounder base
        2,
        false
      );
      
      // Apply clay deformation for organic shape
      this.applyClayDeformation(coneGeo, coneRadius * 0.15);
      
      // Slightly different color for each level
      const levelColor = foliageCol.clone();
      levelColor.r += (Math.random() - 0.5) * 0.05;
      levelColor.g += (Math.random() - 0.5) * 0.05;
      
      const coneMat = new THREE.MeshStandardMaterial({
        color: levelColor,
        roughness: 0.8,
        metalness: 0.0,
        flatShading: false
      });
      
      const cone = new THREE.Mesh(coneGeo, coneMat);
      
      // Position cone with overlapping layers - start at top of trunk
      const posY = trunkHeight - (coneHeight * 0.3) + (i * levelHeight);
      cone.position.y = posY;
      
      // Add slight rotation to each level for more natural look
      cone.rotation.y = Math.random() * Math.PI;
      
      cone.castShadow = true;
      cone.receiveShadow = true;
      
      group.add(cone);
    }
    
    // IMPORTANT: Set origin of the entire tree at the bottom of the trunk
    // This helps with proper placement on the sphere
    group.userData = {
      noCollision: false,
      isPineTree: true,
      height: trunkHeight + foliageHeight  // Store full height for reference
    };
    
    // Return the group with the origin at the base of the trunk
    return group;
  }

  /**
   * Apply clay-like deformation to any geometry
   * More gentle and organic than random displacement
   */
  static applyClayDeformation(geometry, amount) {
    const posAttr = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();
    
    // Create 5-8 gentle deformation points
    const deformers = [];
    const deformerCount = 5 + Math.floor(Math.random() * 4);
    
    for (let i = 0; i < deformerCount; i++) {
      deformers.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(0.8 + Math.random() * 0.4),
        strength: Math.random() * 0.6 + 0.4,
        falloff: Math.random() * 0.5 + 0.8
      });
    }
    
    // Apply smooth organic deformations to each vertex
    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const normal = vertex.clone().normalize();
      
      // Calculate influence from all deformers
      let totalDisplacement = 0;
      for (const def of deformers) {
        const dist = vertex.distanceTo(def.position);
        const falloff = Math.max(0, 1.0 - Math.pow(dist / 2, def.falloff));
        
        if (falloff > 0) {
          // Clay-like swelling or denting
          totalDisplacement += falloff * def.strength * amount * 
                              (def.position.dot(normal) > 0 ? 1 : -1);
        }
      }
      
      // Apply the combined displacement
      vertex.addScaledVector(normal, totalDisplacement);
      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  
  /**
   * Create clay-style grass with more rounded, sculpted blades
   */
  static createGrass(size = 1) {
    const group = new THREE.Group();
    group.name = "ClayGrassPatch";
    
    group.userData = { 
      isGrass: true,
      noCollision: true
    };
    
    // Create fewer, more distinct clay blades
    const bladeCount = 3 + Math.floor(Math.random() * 4);
    
    // Clay grass colors - slightly desaturated for clay look
    const baseColor = new THREE.Color(0.2, 0.45, 0.15);
    
    for (let i = 0; i < bladeCount; i++) {
      // Create a blade with more geometry
      const height = size * (0.6 + Math.random() * 0.4);
      const width = size * 0.15;
      
      // Use a proper 3D geometry for clay blades instead of planes
      const bladeGeo = new THREE.CylinderGeometry(
        0.01,           // Top radius (almost pointed)
        width * 0.5,    // Bottom radius 
        height,         // Height
        6,              // Radial segments
        3,              // Height segments
        false           // Capped
      );
      
      // Bend the blade gently
      const bend = Math.random() * 0.2 + 0.1;
      const posAttr = bladeGeo.getAttribute('position');
      const vertex = new THREE.Vector3();
      
      for (let v = 0; v < posAttr.count; v++) {
        vertex.fromBufferAttribute(posAttr, v);
        
        // Curve the blade - more pronounced near top
        const bendFactor = (vertex.y / height);
        vertex.x += bendFactor * bendFactor * bend * height;
        
        posAttr.setXYZ(v, vertex.x, vertex.y, vertex.z);
      }
      
      // Subtle color variation between blades
      const colorVar = Math.random() * 0.15 - 0.075;
      const bladeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(
          baseColor.r + colorVar,
          baseColor.g + colorVar,
          baseColor.b + colorVar * 0.5
        ),
        roughness: 0.8,
        metalness: 0.0,
        flatShading: false
      });
      
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      
      // Position within patch
      blade.position.x = (Math.random() - 0.5) * size;
      blade.position.z = (Math.random() - 0.5) * size;
      
      // Rotate with clay-style slight tilt
      blade.rotation.x = Math.random() * 0.2 - 0.1;  // Slight forward/backward tilt
      blade.rotation.y = Math.random() * Math.PI;    // Random direction
      blade.rotation.z = Math.random() * 0.2 - 0.1;  // Slight side tilt
      
      blade.userData = { isGrass: true, noCollision: true };
      blade.name = "ClayGrassBlade";
      group.add(blade);
    }
    
    return group;
  }
  
  /**
   * Create a clay-like smooth rock with organic shape
   */
  static createRock(size = 1) {
    // Use higher subdivision level for smoother look
    const rockGeo = new THREE.SphereGeometry(size, 12, 10); // Much higher poly count (was IcosahedronGeometry)
    
    // Apply gentle organic deformation instead of sharp cuts
    this.applySmoothDeformation(rockGeo, size * 0.25);
    
    // Add subtle surface details
    this.applyClayTexture(rockGeo, size * 0.05);
    
    // Ensure normals are correct for proper lighting
    rockGeo.computeVertexNormals();
    
    // Create clay-like material
    const rockMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.54, 0.41, 0.25), // Warmer clay-like color
      roughness: 0.75,      // Matte finish
      metalness: 0.0,       // No metallic quality
      flatShading: false,   // Smooth shading for clay look
    });
    
    // Add subtle color variation
    const colorVariation = Math.random() * 0.1 - 0.05;
    rockMat.color.r += colorVariation;
    rockMat.color.g += colorVariation;
    rockMat.color.b += colorVariation * 0.5;
    
    const rock = new THREE.Mesh(rockGeo, rockMat);
    
    // Slightly flatten bottom for better ground contact
    rock.scale.y = 0.85 + Math.random() * 0.15;
    
    // Add slight random rotation
    rock.rotation.y = Math.random() * Math.PI * 2;
    rock.rotation.z = Math.random() * 0.2;
    
    // Mark as collidable
    rock.userData = { 
      noCollision: false,
      isRock: true,
      isSolid: true,
      friction: 0.8  // Normal friction for clay-like surface
    };
    
    return rock;
  }

  /**
   * Apply smooth organic deformation for clay-like rocks
   */
  static applySmoothDeformation(geometry, amount) {
    const posAttr = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();
    
    // Create several gentle influence points
    const deformers = [];
    for (let i = 0; i < 8; i++) { // Use 8 deformation points
      deformers.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(Math.random() * 0.9 + 0.1), // Keep deformers closer to surface
        strength: Math.random() * 0.5 + 0.5, // Vary strength
        falloff: Math.random() * 0.5 + 0.5   // Vary falloff
      });
    }
    
    // Apply deformation
    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const normal = vertex.clone().normalize();
      
      // Calculate combined influence of all deformers
      let totalDisplacement = 0;
      for (const def of deformers) {
        // Calculate distance from vertex to deformer
        const dist = vertex.distanceTo(def.position);
        
        // Compute smooth falloff
        const falloff = 1.0 - Math.min(1.0, Math.pow(dist / 2, def.falloff));
        
        // Add displacement
        if (falloff > 0) {
          // Push or pull along normal direction
          totalDisplacement += falloff * def.strength * amount * (Math.random() > 0.7 ? 1 : -1);
        }
      }
      
      // Apply final displacement along normal
      vertex.addScaledVector(normal, totalDisplacement);
      
      // Store modified position
      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    posAttr.needsUpdate = true;
  }

  /**
   * Apply subtle clay-like texture to rock surface
   */
  static applyClayTexture(geometry, amount) {
    const posAttr = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();
    const normal = new THREE.Vector3();
    
    // Get or compute normals
    const normalAttr = geometry.getAttribute('normal');
    
    // Create 3D noise function (simplified Perlin-like)
    const noise3D = (x, y, z) => {
      return Math.sin(x * 10) * Math.sin(y * 12) * Math.cos(z * 9) * 0.5 +
             Math.sin(x * 21) * Math.sin(y * 18) * Math.cos(z * 20) * 0.25 +
             Math.sin(x * 35) * Math.sin(y * 35) * Math.cos(z * 35) * 0.25;
    };
    
    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      
      if (normalAttr) {
        normal.fromBufferAttribute(normalAttr, i);
      } else {
        normal.copy(vertex).normalize();
      }
      
      // Apply subtle 3D noise
      const noiseValue = noise3D(
        vertex.x + 123.4, 
        vertex.y - 567.8, 
        vertex.z + 891.2
      );
      
      // Apply very subtle displacement along normal
      vertex.addScaledVector(normal, noiseValue * amount * 0.5);
      
      // Store modified position
      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    posAttr.needsUpdate = true;
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
    
    // Add 2-5 rocks (using clay-style rocks, not boulders)
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
