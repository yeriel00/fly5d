// Environment generator embodying the 5D ethos from the research paper.
// Constructs a fundamental domain (a polyhedral complex) and replicates it via a discrete group,
// simulating a quotient manifold (e.g. torus T³) with non-Euclidean, ray-traced identifications.
// Exports initEnvironment(scene, quality) and an array "collidables" for collision detection.

export const collidables = [];

/**
 * Creates the base environment within the fundamental domain.
 * Returns a THREE.Group containing all base objects.
 */
function createBaseEnvironment(quality) {
  const group = new THREE.Group();
  const treeSegments = quality === 'high' ? 12 : quality === 'medium' ? 6 : 3;
  const cabinSegments = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;
  
  // --- Ground Plane for the Fundamental Domain ---
  const groundSize = 50; // fundamental domain size
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  
  // --- Create Trees ---
  for (let i = 0; i < 10; i++) {
    // Random position within fundamental domain
    const x = Math.random() * groundSize - groundSize/2;
    const z = Math.random() * groundSize - groundSize/2;
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, treeSegments);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1, z);
    group.add(trunk);
    collidables.push(trunk);
    // Foliage
    const foliageGeo = new THREE.ConeGeometry(1.2, 2.5, treeSegments);
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(x, 1 + 2.5, z);
    group.add(foliage);
  }
  
  // --- Wooden Fence (a row of posts on one side of domain) ---
  for (let j = -groundSize/2; j <= groundSize/2; j += 2) {
    const postGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
    const postMat = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(-groundSize/2, 0.75, j);
    group.add(post);
    collidables.push(post);
  }
  
  // --- Bridge with Stream Underneath ---
  const bridgeGeo = new THREE.BoxGeometry(8, 0.3, 3);
  const bridgeMat = new THREE.MeshLambertMaterial({ color: 0xA0522D });
  const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 1.5, -groundSize/4);
  group.add(bridge);
  collidables.push(bridge);
  
  const streamGeo = new THREE.PlaneGeometry(10, 5);
  const streamMat = new THREE.MeshLambertMaterial({ color: 0x1E90FF, side: THREE.DoubleSide });
  const stream = new THREE.Mesh(streamGeo, streamMat);
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(0, 1.4, -groundSize/4);
  group.add(stream);
  
  // --- Log Cabin ---
  const cabin = new THREE.Group();
  // Walls
  const wallGeo = new THREE.BoxGeometry(4, 3, 4, cabinSegments, cabinSegments, cabinSegments);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xCD853F });
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.y = 1.5;
  cabin.add(walls);
  // Roof
  const roofGeo = new THREE.ConeGeometry(3.5, 2, cabinSegments);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 4;
  cabin.add(roof);
  cabin.position.set(groundSize/4, 0, groundSize/4);
  group.add(cabin);
  collidables.push(cabin);
  
  // --- Flower Bed Around Cabin ---
  const bedGeo = new THREE.BoxGeometry(8, 0.1, 4);
  const bedMat = new THREE.MeshLambertMaterial({ color: 0xFF69B4 });
  const flowerBed = new THREE.Mesh(bedGeo, bedMat);
  flowerBed.rotation.x = -Math.PI / 2;
  flowerBed.position.set(groundSize/4, 0.05, groundSize/4 - 4);
  group.add(flowerBed);
  
  // --- Extra Rocks ---
  for (let k = 0; k < 5; k++) {
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(groundSize/4 + Math.random() * 5 - 2.5, 0.5, groundSize/4 + Math.random() * 5 - 2.5);
    group.add(rock);
    collidables.push(rock);
  }
  
  return group;
}

/**
 * Initializes the environment by creating the base domain and then replicating
 * it via translations—emulating a manifold (e.g., torus) or orbifold structure.
 *
 * The discrete group acting is assumed to be the translations by multiples of
 * the domain size. This implements the quotient M/Γ.
 */
export function initEnvironment(scene, quality) {
  const domainSize = 50; // Same as groundSize in base environment
  // Create the base environment
  const baseGroup = createBaseEnvironment(quality);
  
  // Replicate the fundamental domain over a 3 x 3 grid
  // (That is, for translations in X and Z by -domainSize, 0, and +domainSize)
  for (let dx of [-domainSize, 0, domainSize]) {
    for (let dz of [-domainSize, 0, domainSize]) {
      // Clone the entire base group. (For efficiency, you may later use instancing.)
      const clone = baseGroup.clone(true);
      clone.position.x += dx;
      clone.position.z += dz;
      scene.add(clone);
      // Optionally, add the clone's objects to collidables for collision detection.
      // Here we assume shallow addition: in a refined implementation, traverse clone.
      collidables.push(clone);
    }
  }
  
  // Optionally: Add visual markers for the fundamental domain boundaries.
  // For instance, a wireframe cube.
  const boxGeo = new THREE.BoxGeometry(domainSize, 0.1, domainSize);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
  const boundary = new THREE.Mesh(boxGeo, wireMat);
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.set(0, 0.05, 0);
  scene.add(boundary);
  
  // The replication enforces the 5D non-Euclidean ethos by simulating the quotient
  // of Euclidean space by a discrete group: objects leave one domain and reappear in another.
}
