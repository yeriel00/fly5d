// Environment generator for a cute 5D world explorer.
// Creates a single instance of the low-poly environment.
// Exports initEnvironment(scene, quality) and an array "collidables" for collision detection.

export const collidables = [];

export function initEnvironment(scene, quality) {
  // Determine poly counts based on quality
  const treeSegments = quality === 'high' ? 12 : quality === 'medium' ? 6 : 3;
  const cabinSegments = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;
  const groundSize = 50; // Size of the central ground area

  // --- Ground Plane ---
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // --- Create Trees ---
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * groundSize - groundSize / 2;
    const z = Math.random() * groundSize - groundSize / 2;
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, treeSegments);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1, z);
    scene.add(trunk);
    collidables.push(trunk);
    // Foliage
    const foliageGeo = new THREE.ConeGeometry(1.2, 2.5, treeSegments);
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(x, 1 + 2.5, z);
    scene.add(foliage);
  }

  // --- Wooden Fence (Row of Posts) ---
  const fenceStartX = -groundSize / 2;
  for (let j = -groundSize / 2; j <= groundSize / 2; j += 2) {
    const postGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
    const postMat = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(fenceStartX, 0.75, j);
    scene.add(post);
    collidables.push(post);
  }

  // --- Bridge with Stream Underneath ---
  const bridgeX = 0;
  const bridgeZ = -groundSize / 4;
  const bridgeGeo = new THREE.BoxGeometry(8, 0.3, 3);
  const bridgeMat = new THREE.MeshLambertMaterial({ color: 0xA0522D });
  const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(bridgeX, 1.5, bridgeZ);
  scene.add(bridge);
  collidables.push(bridge);

  const streamGeo = new THREE.PlaneGeometry(10, 5);
  const streamMat = new THREE.MeshLambertMaterial({ color: 0x1E90FF, side: THREE.DoubleSide });
  const stream = new THREE.Mesh(streamGeo, streamMat);
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(bridgeX, 1.4, bridgeZ); // slightly below the bridge
  scene.add(stream);

  // --- Log Cabin ---
  const cabinX = groundSize / 4;
  const cabinZ = groundSize / 4;
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
  roof.position.y = 4; // 1.5 (wall base) + 1.5 (wall height) + 1 (half roof height)
  cabin.add(roof);
  cabin.position.set(cabinX, 0, cabinZ);
  scene.add(cabin);
  collidables.push(cabin);

  // --- Flower Bed Around Cabin ---
  const bedGeo = new THREE.BoxGeometry(8, 0.1, 4);
  const bedMat = new THREE.MeshLambertMaterial({ color: 0xFF69B4 });
  const flowerBed = new THREE.Mesh(bedGeo, bedMat);
  flowerBed.rotation.x = -Math.PI / 2;
  flowerBed.position.set(cabinX, 0.05, cabinZ - 4); // Position near cabin
  scene.add(flowerBed);

  // --- Extra Rocks ---
  for (let k = 0; k < 5; k++) {
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(cabinX + Math.random() * 5 - 2.5, 0.25, cabinZ + Math.random() * 5 - 2.5);
    scene.add(rock);
    collidables.push(rock);
  }

  // Remove the boundary wireframe if it exists
  // const boundary = scene.getObjectByName("boundaryWireframe"); // Assuming you named it
  // if (boundary) scene.remove(boundary);
}
