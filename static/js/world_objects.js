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
  const treeCount = config.baseTrees?.count || 20;

  // Place pine trees around the planet, avoiding the lake
  for (let i = 0; i < treeCount; i++) {
    const dir = new THREE.Vector3().randomDirection();
    // skip lake region
    const dotToLake = dir.dot(lakeCenter);
    const angleToLake = Math.acos(Math.max(-1, Math.min(1, dotToLake)));
    if (angleToLake < lakeRadius * 1.2) continue;

    // RESTORED: Use LowPolyGenerator to create clunky pine trees
    const totalTreeHeight = trunkHeight + foliageHeight;
    const trunkRatio = trunkHeight / totalTreeHeight; // Calculate trunk ratio
    
    // Create the pine tree with proper parameters
    const tree = LowPolyGenerator.createPineTree(
      totalTreeHeight,    // Total tree height
      4,                  // Number of foliage levels
      trunkRatio          // Trunk to total height ratio
    );
    
    // Place the tree directly with appropriate values
    placeOnSphere(tree, dir, totalTreeHeight / 2, trunkSink);
  }

  // --- Cabin ---
  // RESTORED: Clunky, blocky cabin with original size and style
  const cabin = new THREE.Group();
  cabin.name = "ClunkyLogCabin";
  
  // Main cabin body - bigger and blockier
  const wallGeo = new THREE.BoxGeometry(8, 5, 8);
  const wallMat = new THREE.MeshLambertMaterial({color: 0x8B4513}); // More saturated brown
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.y = 2.5; // Half height
  cabin.add(wall);
  
  // Larger, chunkier roof
  const roofGeo = new THREE.ConeGeometry(7, 4, 4); // Fewer segments for blockier look
  const roofMat = new THREE.MeshLambertMaterial({color: 0xA52A2A}); // Brighter red
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 7; // Position above walls
  roof.rotation.y = Math.PI / 4; // 45 degree rotation for diamond shape
  cabin.add(roof);
  
  // Simple door
  const doorGeo = new THREE.BoxGeometry(2, 3, 0.5);
  const doorMat = new THREE.MeshLambertMaterial({color: 0x4B3621}); // Dark brown
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.5, 4.01); // Position on front face
  cabin.add(door);
  
  // Scale entire cabin to clunky proportions
  cabin.scale.set(5, 5, 5); // Much larger size!
  
  // Position cabin at a good spot away from lake
  const cabinDir = new THREE.Vector3(0.8, 0.2, 0.6).normalize();
  
  // Use larger height offset and less sink to make it stand out more
  placeOnSphere(cabin, cabinDir, 8, 2);

  // Export the placeOnSphere function via callback if provided
  if (callback && typeof callback === 'function') {
    callback(placeOnSphere);
  }
}
