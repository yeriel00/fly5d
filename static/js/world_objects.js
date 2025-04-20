// --- Import Three.js Module ---
import * as THREE from 'three';
// --- End Import ---

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

export function initEnvironment(scene, quality) {
  const R = 100;
  const seg = quality === 'high' ? 64 : quality === 'medium' ? 32 : 16;

  // Define lake parameters globally for consistency
  const lakeCenter = new THREE.Vector3(0.7, -0.2, 0.7).normalize();
  const lakeRadius = 0.15;      // Angular radius on the unit sphere
  const lakeDepth = 5.0;        // How deep to recess the lake
  const lakeRimWidth = 0.05;    // Smooth transition at lake edges
  const waterOffset = 0.5;      // How far below terrain rim to place water

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
    if (angleToLake < lakeRadius * 1.2) return;
    
    // compute terrain + base radius, then sink
    const terrainHeight = getTerrainHeight(dir, R);
    const baseRadius = R + terrainHeight + heightOffset - sinkDepth;

    // position and orient
    mesh.position.copy(dir.clone().multiplyScalar(baseRadius));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);

    // ground mesh bottom
    let minY;
    if (mesh.geometry) {
      mesh.geometry.computeBoundingBox();
      minY = mesh.geometry.boundingBox.min.y;
    } else {
      const box = new THREE.Box3().setFromObject(mesh);
      minY = box.min.y;
    }
    mesh.position.add(dir.clone().multiplyScalar(-minY));

    scene.add(mesh);

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

    collidables.push({
      mesh,
      position: mesh.position.clone(),
      radius,
      direction: dir.clone(),
      heightOffset,
      baseRadius
    });
  }

  // --- Trees (taller, but lowered into ground) ---
  const treeSeg = quality==='high'?12:quality==='medium'?6:3;
  // define offsets and sink depths
  const trunkHeight = 10;   // half the cylinder height
  const trunkSink  = 12;    // push trunk 2 units into ground
  const foliageHeight = 10; // half the cone height
  const foliageSink  = 8;// push foliage 1.5 units into ground

  for (let i = 0; i < 20; i++) {
    const dir = new THREE.Vector3().randomDirection();
    // skip lake region
    const dotToLake = dir.dot(lakeCenter);
    const angleToLake = Math.acos(Math.max(-1, Math.min(1, dotToLake)));
    if (angleToLake < lakeRadius * 1.2) continue;

    // trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.8, trunkHeight * 2, treeSeg),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 })
    );
    placeOnSphere(trunk, dir, trunkHeight, trunkSink);

    // foliage
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(3, foliageHeight * 2, treeSeg),
      new THREE.MeshLambertMaterial({ color: 0x228B22 })
    );
    placeOnSphere(foliage, dir, trunkHeight + foliageHeight, foliageSink);
  }

  // --- Fence (band around equator) ---
  const postGeo = new THREE.BoxGeometry(0.3,2,0.3);
  const postMat = new THREE.MeshLambertMaterial({color:0xDEB887});
  for (let a=0; a<36; a++) {
    const theta = a/36 * Math.PI*2;
    const dir = new THREE.Vector3(Math.cos(theta),0,Math.sin(theta));
    const post = new THREE.Mesh(postGeo, postMat);
    placeOnSphere(post, dir, -1);
  }

  // --- Bridge (small arc) ---
  // Place 3 planks along a small great‐circle arc:
  for (let j=-1; j<=1; j++) {
    const angle = j*0.2; // radians offset
    const dir = new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)).normalize();
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(4,0.3,2),
      new THREE.MeshLambertMaterial({color:0xA0522D})
    );
    placeOnSphere(plank, dir, 1);
  }

  // --- Cabin ---
  const cabin = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(5,3,5),
    new THREE.MeshLambertMaterial({color:0xCD853F})
  );
  wall.position.y = 1.5;
  cabin.add(wall);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4,2,8),
    new THREE.MeshLambertMaterial({color:0x8B0000})
  );
  roof.position.y = 4;
  cabin.add(roof);
  const dirCab = new THREE.Vector3(1,0,1).normalize();
  placeOnSphere(cabin, dirCab, -6);
}
