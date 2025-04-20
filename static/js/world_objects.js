// Environment generator for cute 5D world with trees, fences, bridges, stream, and a log cabin.
// This file exports initEnvironment(scene, quality) and collidables for collision detection.

export const collidables = [];

export function initEnvironment(scene, quality) {
	// Use quality setting to determine poly counts
	let treeSegments = (quality === 'high' ? 12 : quality === 'medium' ? 6 : 3);
	let cabinSegments = (quality === 'high' ? 8 : quality === 'medium' ? 4 : 2);
  
	// --- Create a few trees ---
	for (let i = 0; i < 10; i++) {
		// trunk: cylinder
		let trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 2, treeSegments);
		let trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
		let trunk = new THREE.Mesh(trunkGeo, trunkMat);
		trunk.position.set(Math.random()*20-10, 1, Math.random()*20-10);
		scene.add(trunk);
		collidables.push(trunk); // simple collision
		// foliage: cone
		let foliageGeo = new THREE.ConeGeometry(1, 2, treeSegments);
		let foliageMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
		let foliage = new THREE.Mesh(foliageGeo, foliageMat);
		foliage.position.set(trunk.position.x, trunk.position.y+2, trunk.position.z);
		scene.add(foliage);
		// Optional: combine trunk & foliage into one Object3D for collision if desired
	}
  
	// --- Wooden Fence ---
	let fenceGeo = new THREE.BoxGeometry(0.1, 1, 5);
	let fenceMat = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
	let fence = new THREE.Mesh(fenceGeo, fenceMat);
	fence.position.set(-5, 0.5, 0);
	scene.add(fence);
	collidables.push(fence);
  
	// --- Bridge ---
	let bridgeGeo = new THREE.BoxGeometry(4, 0.2, 2);
	let bridgeMat = new THREE.MeshLambertMaterial({ color: 0xA0522D });
	let bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
	bridge.position.set(0, 0.8, -5);
	scene.add(bridge);
	collidables.push(bridge);
  
	// --- Stream (using a plane with blue color) ---
	let streamGeo = new THREE.PlaneGeometry(6, 4);
	let streamMat = new THREE.MeshLambertMaterial({ color: 0x1E90FF, side: THREE.DoubleSide });
	let stream = new THREE.Mesh(streamGeo, streamMat);
	stream.rotation.x = -Math.PI/2;
	stream.position.set(0, 0.01, -5);
	scene.add(stream);
	// Optionally add stream bounds to collidables for collision avoidance
  
	// --- Log Cabin ---
	let cabin = new THREE.Group();
	// Cabin walls: box
	let wallGeo = new THREE.BoxGeometry(3, 2, 3, cabinSegments, cabinSegments, cabinSegments);
	let wallMat = new THREE.MeshLambertMaterial({ color: 0xCD853F });
	let walls = new THREE.Mesh(wallGeo, wallMat);
	walls.position.y = 1;
	cabin.add(walls);
	// Roof: cone
	let roofGeo = new THREE.ConeGeometry(2.5, 1.5, cabinSegments);
	let roofMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
	let roof = new THREE.Mesh(roofGeo, roofMat);
	roof.position.y = 2.75;
	cabin.add(roof);
	cabin.position.set(5, 0, 5);
	scene.add(cabin);
	collidables.push(cabin);
  
	// ... additional cute objects can be added here ...
}
