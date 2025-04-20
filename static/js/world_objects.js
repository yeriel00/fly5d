// Environment generator for a cute 5D world explorer on a SPHERE.
// Exports initEnvironment(scene, quality) and an array "collidables".

export const collidables = [];
const sphereRadius = 25; // Radius of the world sphere

// Helper function to place objects on the sphere surface
function placeOnSphere(object, latitude, longitude) {
    const phi = THREE.MathUtils.degToRad(90 - latitude); // Convert latitude to polar angle
    const theta = THREE.MathUtils.degToRad(longitude);   // Convert longitude to azimuthal angle

    // Calculate position
    object.position.setFromSphericalCoords(sphereRadius, phi, theta);

    // Orient object to face outwards from the sphere center
    const surfaceNormal = object.position.clone().normalize();
    object.lookAt(object.position.clone().add(surfaceNormal)); // Point object's local Z axis outwards
    // Optional: Adjust rotation if needed based on object's default orientation
    // object.rotateX(Math.PI / 2); // Example if object's 'up' is along its Y axis
}


export function initEnvironment(scene, quality) {
    collidables.length = 0; // Clear previous collidables
    const treeSegments = quality === 'high' ? 12 : quality === 'medium' ? 6 : 3;
    const cabinSegments = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;

    // --- Sphere World ---
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 16); // Adjust segments for quality
    const sphereMat = new THREE.MeshLambertMaterial({ color: 0x228B22, wireframe: quality === 'low' });
    const worldSphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(worldSphere);
    // The sphere itself can be a collidable, though movement logic should prevent going through it
    // collidables.push(worldSphere);

    // --- Create Trees on Sphere ---
    for (let i = 0; i < 20; i++) {
        const lat = Math.random() * 180 - 90; // Random latitude
        const lon = Math.random() * 360 - 180; // Random longitude

        const treeGroup = new THREE.Group(); // Group trunk and foliage

        // Trunk
        const trunkHeight = 2;
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, treeSegments);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkHeight / 2; // Position base at origin of group
        treeGroup.add(trunk);

        // Foliage
        const foliageHeight = 2.5;
        const foliageGeo = new THREE.ConeGeometry(1.2, foliageHeight, treeSegments);
        const foliageMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = trunkHeight + foliageHeight / 2; // Position above trunk
        treeGroup.add(foliage);

        // Place the entire tree group on the sphere
        placeOnSphere(treeGroup, lat, lon);
        scene.add(treeGroup);
        collidables.push(treeGroup); // Add the group for collision
    }

    // --- Log Cabin on Sphere ---
    const cabinLat = 20;
    const cabinLon = 45;
    const cabinGroup = new THREE.Group();
    const wallHeight = 3;
    const roofHeight = 2;

    // Walls
    const wallGeo = new THREE.BoxGeometry(4, wallHeight, 4, cabinSegments, cabinSegments, cabinSegments);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xCD853F });
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = wallHeight / 2; // Base at group origin
    cabinGroup.add(walls);

    // Roof
    const roofGeo = new THREE.ConeGeometry(3.5, roofHeight, cabinSegments);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = wallHeight + roofHeight / 2; // Above walls
    cabinGroup.add(roof);

    placeOnSphere(cabinGroup, cabinLat, cabinLon);
    scene.add(cabinGroup);
    collidables.push(cabinGroup);

    // --- Add other objects (fence posts, bridge, rocks) similarly using placeOnSphere ---
    // Example: Place a rock
    const rockLat = -10;
    const rockLon = -30;
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    placeOnSphere(rock, rockLat, rockLon);
    scene.add(rock);
    collidables.push(rock);
}
