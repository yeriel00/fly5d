// --- Import Three.js Module ---
import * as THREE from 'three';
import LowPolyGenerator from './low_poly_generator.js';

export const collidables = [];

// Helper function to get terrain height at a specific point on the sphere
function getTerrainHeight(pos, R) {
  const normPos = pos.clone().normalize();
  const noiseFrequency = 5.0;
  const noiseAmplitude = 1.5;
  
  // Same noise function used for terrain generation
  const noise = Math.sin(normPos.x * noiseFrequency) * 
                Math.sin(normPos.y * noiseFrequency) * 
                Math.cos(normPos.z * noiseFrequency);
  
  return noise * noiseAmplitude;
}

export function initEnvironment(scene, quality, config = {}, callback) {
  // Use provided config or defaults
  const R = config.radius || 100;
  const lakeDepth = config.lakeDepth || 5.0;
  const waterOffset = config.waterOffset || 0.5;
  const seg = quality === 'high' ? 64 : quality === 'medium' ? 32 : 16;

  // Define lake parameters globally for consistency
  const lakeCenter = new THREE.Vector3(0.7, -0.2, 0.7).normalize();
  const lakeRadius = 0.15;      // Angular radius on the unit sphere
  const lakeRimWidth = 0.05;    // Smooth transition at lake edges

  // --- Create the planet with lake depression ---
  const sphereGeo = new THREE.SphereGeometry(R, seg, seg);
  const posAttr = sphereGeo.getAttribute('position');
  const vertex = new THREE.Vector3();
  
  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);
    const dir = vertex.clone().normalize();
    
    // Standard terrain noise
    const noiseFreq = 5.0, noiseAmp = 2.5;
    let noise = Math.sin(dir.x * noiseFreq) * 
                Math.sin(dir.y * noiseFreq) * 
                Math.cos(dir.z * noiseFreq);
    
    // Calculate distance to lake center (angular)
    const dotToLake = dir.dot(lakeCenter);
    const angleToLake = Math.acos(Math.min(Math.max(dotToLake, -1), 1));
    
    // Create the lake depression
    if (angleToLake < lakeRadius) {
      // Inside lake - full depression
      noise -= lakeDepth;
    } 
    else if (angleToLake < lakeRadius + lakeRimWidth) {
      // Lake rim - smooth transition from depression to normal terrain
      const rimT = (angleToLake - lakeRadius) / lakeRimWidth;
      const smoothStep = 3*Math.pow(rimT, 2) - 2*Math.pow(rimT, 3); // Smooth interpolation
      noise -= lakeDepth * (1.0 - smoothStep);
    }
    
    // Apply displacement along normal vector
    vertex.copy(dir.multiplyScalar(R + noise * noiseAmp));
    posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  sphereGeo.computeVertexNormals();
  
  // Create terrain mesh
  const terrainMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  const planet = new THREE.Mesh(sphereGeo, terrainMat);
  planet.receiveShadow = true;
  scene.add(planet);
  
  // --- Create water lake disk flush in depression ---
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x1E90FF,
    transparent: true,
    opacity: 0.75
  });

  // Compute center terrain height and depression
  const centerTerrain = getTerrainHeight(lakeCenter, R);
  const depression = centerTerrain - lakeDepth;
  const lakeRadiusWorld = (R + depression) * Math.sin(lakeRadius);

  // Build disk geometry
  const waterDiskGeo = new THREE.CircleGeometry(lakeRadiusWorld, 64);
  const waterDisk = new THREE.Mesh(waterDiskGeo, waterMat);

  // Position disk at exact depressed surface
  waterDisk.position.copy(
    lakeCenter.clone().multiplyScalar(R + depression)
  );

  // Orient to face outward
  waterDisk.lookAt(0,0,0);
  waterDisk.rotateY(Math.PI);

  scene.add(waterDisk);
  collidables.push({
    mesh: waterDisk,
    position: waterDisk.position.clone(),
    radius: lakeRadiusWorld,
    direction: lakeCenter.clone(),
    isWater: true
  });
  
  // --- Place objects helper function ---
  function placeOnSphere(mesh, dir, heightOffset = 0, sinkDepth = 0) {
    // Avoid placing objects in the lake
    const dotToLake = dir.dot(lakeCenter);
    const angleToLake = Math.acos(Math.min(Math.max(dotToLake, -1), 1));
    
    // Skip if trying to place in the lake
    if (angleToLake < lakeRadius * 1.2) return false;
    
    // compute terrain + base radius, then sink
    const terrainHeight = getTerrainHeight(dir, R);
    const baseRadius = R + terrainHeight + heightOffset - sinkDepth;

    // position and orient
    mesh.position.copy(dir.clone().multiplyScalar(baseRadius));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);

    scene.add(mesh);

    // Ensure all geometries have proper normals
    if (mesh.geometry) {
      mesh.geometry.computeVertexNormals();
    } else if (mesh instanceof THREE.Group) {
      mesh.traverse(child => {
        if (child.geometry) {
          child.geometry.computeVertexNormals();
        }
      });
    }

    // collision radius
    let radius = 1.0;
    if (mesh instanceof THREE.Mesh && mesh.geometry.boundingSphere) {
      radius = mesh.geometry.boundingSphere.radius;
    } else if (mesh instanceof THREE.Group) {
      radius = Math.max(
        mesh.scale.x, mesh.scale.y, mesh.scale.z
      ) * 2;
      // special tree/cabin cases
      if (heightOffset > 3) radius = 2;
      else if (heightOffset === 0 && mesh.children.length > 1) radius = 4;
    }

    // Add to collidables array with proper properties
    const collidable = {
      mesh,
      position: mesh.position.clone(),
      radius,
      direction: dir.clone(),
      heightOffset,
      baseRadius
    };
    
    // Copy userData flags if they exist
    if (mesh.userData) {
      if (mesh.userData.isGrass) collidable.isGrass = true;
      // Copy any other userData properties that affect collision
    }
    
    
    // Check for grass or no-collision flags in userData
    // Copy multiple properties for redundant detection
    if (mesh.userData) {
      // Direct copy of all userData properties
      Object.assign(collidable, mesh.userData);
      
      // Special case for grass
      if (mesh.userData.isGrass) {
        collidable.isGrass = true;
        collidable.noCollision = true;
      }
    }
    
    // Check name-based identification too
    if (mesh.name && mesh.name.toLowerCase().includes('grass')) {
      collidable.isGrass = true;
      collidable.noCollision = true;
    }
    
    collidables.push(collidable);
    
    return true;
  }

  // --- Trees - Fix the base trees to be properly grounded with foliage at the top
  const treeSeg = quality === 'high' ? 8 : quality === 'medium' ? 6 : 4; // Lower polygon count

  // Extract tree parameters from config
  const trunkHeight = config.baseTrees?.trunkHeight || 10;
  const trunkSink = config.baseTrees?.trunkSink || 5;
  const foliageHeight = config.baseTrees?.foliageHeight || 10;
  const foliageSink = config.baseTrees?.foliageSink || 0;
  const treeCount = config.baseTrees?.count || 20;

  for (let i = 0; i < treeCount; i++) {
    const dir = new THREE.Vector3().randomDirection();
    // skip lake region
    const dotToLake = dir.dot(lakeCenter);
    const angleToLake = Math.acos(Math.max(-1, Math.min(1, dotToLake)));
    if (angleToLake < lakeRadius * 1.2) continue;

    // Create a large low-poly trunk with parameters from config
    const trunkGeo = new THREE.CylinderGeometry(1.0, 1.5, trunkHeight * 2, treeSeg, 2);
    
    // Apply displacement for natural look
    LowPolyGenerator.applyRandomVertexDisplacement(trunkGeo, 0.2);
    
    const trunk = new THREE.Mesh(
      trunkGeo,
      new THREE.MeshLambertMaterial({ 
        color: 0x8B4513, 
        flatShading: true 
      })
    );
    
    // Place the trunk with appropriate sinking to ground it
    const trunkPlaced = placeOnSphere(trunk, dir, trunkHeight, trunkSink);
    
    if (trunkPlaced) {
      // Create a large low-poly foliage cone
      const foliageGeo = new THREE.ConeGeometry(6, foliageHeight * 2, treeSeg, 2);
      
      // Apply displacement for natural look
      LowPolyGenerator.applyRandomVertexDisplacement(foliageGeo, 0.8);
      
      const foliage = new THREE.Mesh(
        foliageGeo,
        new THREE.MeshLambertMaterial({ 
          color: 0x006400, // Darker green for base trees
          flatShading: true 
        })
      );
      
      // Place foliage directly above the trunk's position
      // Using the same direction but with higher offset to position at top of trunk
      placeOnSphere(foliage, dir, trunkHeight * 2, foliageSink);
    }
  }

  // --- Fence (band around equator) ---
  const postCount = config.fence?.count || 36;
  const fenceHeight = config.fence?.height || -1;
  const fenceSink = config.fence?.sink || 0;
  
  for (let a = 0; a < postCount; a++) {
    const theta = a / postCount * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2, 0.3),
      new THREE.MeshLambertMaterial({color: 0xDEB887})
    );
    placeOnSphere(post, dir, fenceHeight, fenceSink);
  }

  // --- Bridge (small arc) ---
  const bridgeCount = config.bridge?.count || 3;
  const halfBridge = Math.floor(bridgeCount / 2);
  
  for (let j = -halfBridge; j <= halfBridge; j++) {
    const angle = j * 0.2; // radians offset
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.3, 2),
      new THREE.MeshLambertMaterial({color: 0xA0522D})
    );
    placeOnSphere(plank, dir, 1);
  }

  // --- Cabin ---
  const cabin = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(5, 3, 5),
    new THREE.MeshLambertMaterial({color: 0xCD853F})
  );
  wall.position.y = 1.5;
  cabin.add(wall);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4, 2, 8),
    new THREE.MeshLambertMaterial({color: 0x8B0000})
  );
  roof.position.y = 4;
  cabin.add(roof);
  const dirCab = new THREE.Vector3(1, 0, 1).normalize();
  placeOnSphere(cabin, dirCab, config.cabin?.height || -6, config.cabin?.sink || 0);

  // Export the placeOnSphere function via callback if provided
  if (callback && typeof callback === 'function') {
    callback(placeOnSphere);
  }
}
