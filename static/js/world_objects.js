// --- Import Three.js Module ---
import * as THREE from 'three';
import LowPolyGenerator from './low_poly_generator.js';

export const collidables = [];

// --- CONFIGURABLE PARAMETERS --- (Moved to top for clarity)
let R = 400; // Default Radius
// Remove lake depth parameter
let noiseFreq = 5.0;
let noiseAmp = 2.5; // Base noise amplitude

// Define terrain features globally within this module
const terrainFeatures = [
  // Remove lake features
  // Ridge line
  { type: 'ridge', start: new THREE.Vector3(0.1, 0.8, 0.2).normalize(), end: new THREE.Vector3(0.7, 0.5, -0.3).normalize(), width: 0.08, height: 12.0 },
  // Valley
  { type: 'valley', center: new THREE.Vector3(-0.3, -0.5, -0.7).normalize(), radius: 0.13, depth: 0.6, rimWidth: 0.12 }
];

// --- HELPER: Apply Terrain Features ---
// This function calculates the *modification* based on features
function applyTerrainFeatures(dir) {
  let modification = 0;

  for (const feature of terrainFeatures) {
    if (feature.type === 'valley') {
      const dotToFeature = dir.dot(feature.center);
      const angleToFeature = Math.acos(Math.min(Math.max(dotToFeature, -1), 1));
      const featureDepth = feature.depth * 16.0; // Use fixed depth multiplier

      if (angleToFeature < feature.radius) {
        modification -= featureDepth;
      } else if (angleToFeature < feature.radius + feature.rimWidth) {
        const rimT = (angleToFeature - feature.radius) / feature.rimWidth;
        const smoothStep = 3 * Math.pow(rimT, 2) - 2 * Math.pow(rimT, 3);
        modification -= featureDepth * (1.0 - smoothStep);
      }
    } else if (feature.type === 'ridge') {
      // Ridge calculation (same as before)
      const lineDir = feature.end.clone().sub(feature.start).normalize();
      const toVertex = dir.clone().sub(feature.start);
      const projection = feature.start.clone().add(
        lineDir.clone().multiplyScalar(toVertex.dot(lineDir))
      );
      const distToLine = Math.acos(Math.min(Math.max(dir.dot(projection.normalize()), -1), 1)); // Ensure projection is normalized

      if (distToLine < feature.width) {
        const factor = 1.0 - (distToLine / feature.width);
        const smooth = Math.sin(factor * Math.PI);
        modification += smooth * feature.height;
      }
    }
  }
  return modification;
}

// --- EXPORTED: Get Full Terrain Height ---
// This function combines base noise and feature modifications
export function getFullTerrainHeight(normPos) {
  // 1. Base Noise Calculation
  const pos = normPos.clone().multiplyScalar(R);
  const baseNoise = Math.sin(pos.x * noiseFreq / R) *
                    Math.sin(pos.y * noiseFreq / R) *
                    Math.cos(pos.z * noiseFreq / R);
  const baseHeight = baseNoise * noiseAmp;

  // 2. Feature Modification Calculation
  const featureModification = applyTerrainFeatures(normPos);

  // 3. Combine Base Height and Modifications
  return baseHeight + featureModification;
}


// --- Initialize Environment ---
export function initEnvironment(scene, quality, config = {}, callback) {
  // Update module-level parameters from config
  R = config.radius || R;
  // Remove lake depth parameter
  noiseFreq = config.noiseFrequency || noiseFreq;
  noiseAmp = config.noiseAmplitude || noiseAmp; // Use configured base noise amplitude
  const seg = quality === 'high' ? 64 : quality === 'medium' ? 32 : 16;

  // --- Create the planet geometry using the full height function ---
  const sphereGeo = new THREE.SphereGeometry(R, seg, seg);
  const posAttr = sphereGeo.getAttribute('position');
  const vertex = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);
    const dir = vertex.clone().normalize();

    // Calculate height using the combined function
    const height = getFullTerrainHeight(dir);

    // Apply displacement along normal vector
    vertex.copy(dir.multiplyScalar(R + height));
    posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  sphereGeo.computeVertexNormals();

  // Create terrain mesh
  const terrainMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  const planet = new THREE.Mesh(sphereGeo, terrainMat);
  planet.receiveShadow = true;
  scene.add(planet);

  // Add the planet itself as the primary collidable (index 0)
  collidables.push({
      mesh: planet,
      position: new THREE.Vector3(0,0,0),
      radius: R,
      direction: new THREE.Vector3(0,0,0), // Special case for planet
      isPlanet: true
  });

  // --- Place objects helper function ---
  // Uses getFullTerrainHeight for accurate placement
  function placeOnSphere(mesh, dir, heightOffset = 0, sinkDepth = 0) {
    // Remove lake check

    // Compute terrain height using the full function
    const terrainHeight = getFullTerrainHeight(dir);
    const baseRadius = R + terrainHeight + heightOffset - sinkDepth;

    // position and orient
    mesh.position.copy(dir.clone().multiplyScalar(baseRadius));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    scene.add(mesh);

    // ... (rest of placeOnSphere: compute normals, calculate collision radius, add to collidables) ...
    // Ensure normals are computed
    if (mesh.geometry) mesh.geometry.computeVertexNormals();
    else if (mesh instanceof THREE.Group) mesh.traverse(child => { if (child.geometry) child.geometry.computeVertexNormals(); });

    // Collision radius calculation (remains the same)
    let radius = 1.0;
    let collisionHeight = 0;
    const isTree = mesh.name?.includes('Tree') || mesh.userData?.isTree || mesh.userData?.isPineTree;
    const isRock = mesh.name?.includes('Rock') || mesh.userData?.isRock;
    const isCabin = mesh.name?.includes('Cabin');

    if (isTree) {
        const totalHeight = mesh.userData?.totalHeight || mesh.userData?.height || heightOffset * 2;
        radius = totalHeight * 0.25;
        collisionHeight = totalHeight * 0.9;
    } else if (isRock) {
        if (mesh instanceof THREE.Mesh && mesh.geometry.boundingSphere) radius = mesh.geometry.boundingSphere.radius * 1.2;
        else radius = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) * 2;
    } else if (isCabin) {
        radius = 10;
    } else {
        if (mesh instanceof THREE.Mesh && mesh.geometry.boundingSphere) radius = mesh.geometry.boundingSphere.radius;
        else if (mesh instanceof THREE.Group) radius = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) * 2;
    }

    const collidable = { mesh, position: mesh.position.clone(), radius, direction: dir.clone(), heightOffset, baseRadius, collisionHeight };
    Object.assign(collidable, mesh.userData); // Copy userData
    if (mesh.userData?.isGrass || mesh.name?.toLowerCase().includes('grass')) collidable.noCollision = true;

    collidables.push(collidable);
    return true;
  }
  
  // --- Place Pine Trees (using the updated placeOnSphere) ---
  const treeCount = config.baseTrees?.count || 20;
  const trunkHeight = config.baseTrees?.trunkHeight || 10;
  const trunkSink = config.baseTrees?.trunkSink || 5;
  const foliageHeight = config.baseTrees?.foliageHeight || 10;
  for (let i = 0; i < treeCount; i++) {
      const dir = new THREE.Vector3().randomDirection();
      const totalTreeHeight = trunkHeight + foliageHeight;
      const trunkRatio = trunkHeight / totalTreeHeight;
      const pineTree = LowPolyGenerator.createPineTree(totalTreeHeight, 4, trunkRatio);
      placeOnSphere(pineTree, dir, totalTreeHeight / 2, trunkSink);
  }

  // Export the placeOnSphere function via callback if provided
  if (callback && typeof callback === 'function') {
    callback(placeOnSphere);
  }
}
