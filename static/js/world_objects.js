// Environment generator for a cute 5D world explorer.
// Exports initEnvironment(scene, quality) and an array "collidables" for collision detection.

export const collidables = [];

export function initEnvironment(scene, quality) {
	// Determine poly counts based on quality
	const treeSegments = quality === 'high' ? 12 : quality === 'medium' ? 6 : 3;
	const cabinSegments = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;
  
	// --- Create trees ---
	for (let i = 0; i < 10; i++) {
		// Create trunk
		const trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 2, treeSegments);
		const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
		const trunk = new THREE.Mesh(trunkGeo, trunkMat);
		trunk.position.set(Math.random() * 20 - 10, 1, Math.random() * 20 - 10);
		scene.add(trunk);
		collidables.push(trunk);
    
		// Create foliage
		const foliageGeo = new THREE.ConeGeometry(1, 2, treeSegments);
		const foliageMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
		const foliage = new THREE.Mesh(foliageGeo, foliageMat);
		foliage.position.set(trunk.position.x, trunk.position.y + 2, trunk.position.z);
		scene.add(foliage);
	}
  
	// --- Wooden Fence ---
	const fenceGeo = new THREE.BoxGeometry(0.1, 1, 5);
	const fenceMat = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
	const fence = new THREE.Mesh(fenceGeo, fenceMat);
	fence.position.set(-5, 0.5, 0);
	scene.add(fence);
	collidables.push(fence);
  
	// --- Bridge with stream underneath ---
	const bridgeGeo = new THREE.BoxGeometry(4, 0.2, 2);
	const bridgeMat = new THREE.MeshLambertMaterial({ color: 0xA0522D });
	const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
	bridge.position.set(0, 0.8, -5);
	scene.add(bridge);
	collidables.push(bridge);
  
	const streamGeo = new THREE.PlaneGeometry(6, 4);
	const streamMat = new THREE.MeshLambertMaterial({ color: 0x1E90FF, side: THREE.DoubleSide });
	const stream = new THREE.Mesh(streamGeo, streamMat);
	stream.rotation.x = -Math.PI / 2;
	stream.position.set(0, 0.01, -5);
	scene.add(stream);
  
	// --- Log Cabin ---
	const cabin = new THREE.Group();
	// Cabin walls
	const wallGeo = new THREE.BoxGeometry(3, 2, 3, cabinSegments, cabinSegments, cabinSegments);
	const wallMat = new THREE.MeshLambertMaterial({ color: 0xCD853F });
	const walls = new THREE.Mesh(wallGeo, wallMat);
	walls.position.y = 1;
	cabin.add(walls);
	// Roof
	const roofGeo = new THREE.ConeGeometry(2.5, 1.5, cabinSegments);
	const roofMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
	const roof = new THREE.Mesh(roofGeo, roofMat);
	roof.position.y = 2.75;
	cabin.add(roof);
	cabin.position.set(5, 0, 5);
	scene.add(cabin);
	collidables.push(cabin);
  
	// ...add any additional cute objects here...
}
