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
  const R = 50; // Planet radius
  const seg = quality === 'high' ? 64 : quality === 'medium' ? 32 : 16; // Increased segments for smoother terrain

  // --- Planet Sphere ---
  const sphereGeo = new THREE.SphereGeometry(R, seg, seg);

  // --- Add Terrain Variation ---
  const positionAttribute = sphereGeo.getAttribute('position');
  const vertex = new THREE.Vector3();
  const noiseFrequency = 5.0; // How many bumps
  const noiseAmplitude = 1.5; // How high the bumps are

  for (let i = 0; i < positionAttribute.count; i++) {
      vertex.fromBufferAttribute(positionAttribute, i); // Get vertex position

      // Simple noise based on vertex position (using sine waves)
      let noise = Math.sin(vertex.x * noiseFrequency / R) *
                  Math.sin(vertex.y * noiseFrequency / R) *
                  Math.cos(vertex.z * noiseFrequency / R);

      // Calculate displacement vector (normalized vertex direction)
      const displacement = vertex.clone().normalize().multiplyScalar(noise * noiseAmplitude);

      // Apply displacement
      vertex.add(displacement);

      // Update buffer attribute
      positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  sphereGeo.computeVertexNormals(); // Recalculate normals after displacement
  // --- End Terrain Variation ---

  const sphereMat = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Forest Green
  const planet = new THREE.Mesh(sphereGeo, sphereMat);
  planet.receiveShadow = true;
  scene.add(planet);
  collidables.push(planet); // Add planet for potential collision later

  // Improved Helper: place object correctly on terrain
  function placeOnSphere(mesh, dir, heightOffset=0) {
    // Calculate actual terrain height at this point
    const terrainHeight = getTerrainHeight(dir, R);
    
    // Position mesh at correct height (radius + terrain + object offset)
    const totalHeight = R + terrainHeight + heightOffset;
    mesh.position.copy(dir.clone().multiplyScalar(totalHeight));
    
    // Align up vector to be perpendicular to sphere at this point
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
    
    // Add to scene
    scene.add(mesh);
    
    // Safely determine collision radius based on object type
    let radius = 1.0; // Default fallback radius
    
    if (mesh instanceof THREE.Mesh && mesh.geometry && mesh.geometry.boundingSphere) {
      // For simple meshes with a geometry
      radius = mesh.geometry.boundingSphere.radius;
    } else if (mesh instanceof THREE.Group) {
      // For groups, use a reasonable approximation based on the object's purpose
      if (mesh.children.length > 0) {
        // Use the largest dimension based on the object's scale
        radius = Math.max(
          Math.abs(mesh.scale.x || 1), 
          Math.abs(mesh.scale.y || 1), 
          Math.abs(mesh.scale.z || 1)
        ) * 2; // Scale up to be safe
      }
      
      // Special case for known objects
      if (heightOffset > 3) {
        // This is likely a tree
        radius = 2; // Trees have a radius of about 2 units
      } else if (heightOffset === 0 && mesh.children.length > 1) {
        // This is likely the cabin
        radius = 4; // Cabin has a radius of about 4 units
      }
    }
    
    // Add to collidables with corrected radius
    collidables.push({
      mesh: mesh,
      position: mesh.position.clone(),
      radius: radius,
      direction: dir.clone(),
      heightOffset: heightOffset,
      baseRadius: totalHeight
    });
  }

  // --- Trees ---
  const treeSeg = quality==='high'?12:quality==='medium'?6:3;
  for (let i=0; i<20; i++) {
    const dir = new THREE.Vector3().randomDirection();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5,0.5,3,treeSeg),
      new THREE.MeshLambertMaterial({color:0x8B4513})
    );
    placeOnSphere(trunk, dir, 1.5);
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(2,4,treeSeg),
      new THREE.MeshLambertMaterial({color:0x228B22})
    );
    placeOnSphere(foliage, dir, 4.5);
  }

  // --- Fence (band around equator) ---
  const postGeo = new THREE.BoxGeometry(0.3,2,0.3);
  const postMat = new THREE.MeshLambertMaterial({color:0xDEB887});
  for (let a=0; a<36; a++) {
    const theta = a/36 * Math.PI*2;
    const dir = new THREE.Vector3(Math.cos(theta),0,Math.sin(theta));
    const post = new THREE.Mesh(postGeo, postMat);
    placeOnSphere(post, dir, 1);
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
    placeOnSphere(plank, dir, 1.5);
  }

  // --- Stream below bridge (a curved band) ---
  const streamMat = new THREE.MeshLambertMaterial({color:0x1E90FF});
  for (let j=-1; j<=1; j++) {
    const angle = j*0.2;
    const dir = new THREE.Vector3(Math.sin(angle),-0.1,Math.cos(angle)).normalize();
    const segMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4,1),
      streamMat
    );
    segMesh.rotation.x = Math.PI/2;
    placeOnSphere(segMesh, dir, 0.5);
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
  placeOnSphere(cabin, dirCab, 0);
}
