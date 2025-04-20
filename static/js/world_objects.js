export const collidables = [];

export function initEnvironment(scene, quality) {
  const R = 50; // Planet radius
  const seg = quality==='high'?32:quality==='medium'?16:8;

  // --- Planet Sphere ---
  const sphereGeo = new THREE.SphereGeometry(R, seg, seg);
  const sphereMat = new THREE.MeshLambertMaterial({ color: 0x224422 });
  const planet = new THREE.Mesh(sphereGeo, sphereMat);
  planet.receiveShadow = true;
  scene.add(planet);
  collidables.push(planet);

  // Helper: place object at dir * (R + offset), aligned to dir
  function placeOnSphere(mesh, dir, offset=0) {
    mesh.position.copy(dir.clone().multiplyScalar(R + offset));
    // Align up vector
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
    scene.add(mesh);
    collidables.push(mesh);
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
