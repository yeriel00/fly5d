import * as THREE from 'three';

export default class SphereControls {
  constructor(camera, domElement, options = {}) {
    this.camera = camera;
    this.domElement = domElement || document;

    // sphere params
    this.radius = options.sphereRadius || 50;
    this.getTerrainHeight = options.getTerrainHeight || (() => 0);
    this.moveSpeed = options.moveSpeed || 0.5;
    this.lookSpeed = options.lookSpeed || 0.002;
    this.pitchLimit = Math.PI / 2 - 0.1;
    this.collidables = options.collidables || [];
    this.playerRadius = options.playerRadius || 1.0;

    // build yaw->pitch->camera hierarchy
    this.yawObject = new THREE.Object3D();
    this.pitchObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);
    this.pitchObject.add(camera);
    camera.position.set(0, options.eyeHeight||1.6, 0);

    // Allow for custom start position direction
    const startDir = options.startPosition || new THREE.Vector3(0, 0, 1).normalize();
    
    // Calculate terrain height at start position
    const startTerrainHeight = this.getTerrainHeight(startDir);
    
    // Calculate start position with proper height above terrain
    const startPos = startDir.clone().multiplyScalar(this.radius + startTerrainHeight + 5); // +5 units above terrain
    
    // Initialize position and orientation
    this.yawObject.position.copy(startPos);
    this.yawObject.up.copy(startPos.clone().normalize());
    
    // Aim along tangent
    const forward0 = new THREE.Vector3(0,0,-1)
      .projectOnPlane(startPos.clone().normalize())
      .normalize();
    this.yawObject.lookAt(startPos.clone().add(forward0));

    // input state
    this.keys = {};
    this.pitch = 0;

    // bind
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLock = this.onPointerLock.bind(this);

    // listeners
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    this.domElement.addEventListener('click', ()=> this.domElement.requestPointerLock());
  }

  getObject() {
    return this.yawObject;
  }

  onPointerLock() {
    if (document.pointerLockElement === this.domElement) {
      document.addEventListener('mousemove', this.onMouseMove);
    } else {
      document.removeEventListener('mousemove', this.onMouseMove);
    }
  }

  onMouseMove(e) {
    const up = this.yawObject.position.clone().normalize();
    // yaw
    const yawQ = new THREE.Quaternion()
      .setFromAxisAngle(up, -e.movementX * this.lookSpeed);
    this.yawObject.quaternion.premultiply(yawQ);

    // pitch
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - e.movementY * this.lookSpeed,
      -this.pitchLimit, this.pitchLimit
    );
    this.pitchObject.rotation.x = this.pitch;
  }

  onKeyDown(e) { this.keys[e.key.toLowerCase()] = true; }
  onKeyUp(e)   { this.keys[e.key.toLowerCase()] = false; }

  update() {
    // gravity/jump omitted for brevity—keep previous code if needed

    // movement
    const pos = this.yawObject.position;
    const upDir = pos.clone().normalize();

    // get camera forward
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);              // direction camera faces
    forward.projectOnPlane(upDir).normalize();           // flatten to tangent

    // compute right = forward × up
    const right = new THREE.Vector3().crossVectors(forward, upDir).normalize();

    // accumulate input
    const mv = new THREE.Vector3();
    if ( this.keys['w'] ) mv.add(forward);
    if ( this.keys['s'] ) mv.add(forward.clone().negate());
    if ( this.keys['a'] ) mv.add(right.clone().negate());
    if ( this.keys['d'] ) mv.add(right);

    if ( mv.lengthSq() > 0 ) {
      mv.normalize().multiplyScalar(this.moveSpeed);

      // new world position
      const np = pos.clone().add(mv);
      const nDir = np.clone().normalize();
      const h = this.getTerrainHeight(nDir);
      const finalPos = nDir.multiplyScalar(this.radius + h);

      // Only skip items explicitly flagged noCollision (grass)
      const validCollidables = this.collidables.filter((obj, index) => {
        if (index === 0) return false;         // planet
        if (obj.isWater) return false;         // water
        if (obj.noCollision) return false;     // grass or other no‐collision
        // must have direction
        return !!obj.direction;
      });

      console.log(`Checking ${validCollidables.length} objects for collision`);

      // Check with a smaller threshold radius to allow easier movement
      let collide = false;
      for (const obj of validCollidables) {
        const objDir = obj.direction;
        const posDir = finalPos.clone().normalize();
        
        // Calculate distance
        const dot = posDir.dot(objDir);
        const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
        const surfaceDist = angle * this.radius;
        
        // Use a MUCH smaller collision threshold - make large objects navigable
        const objectRadius = obj.radius || 1.0;
        const threshold = objectRadius * 0.5 + this.playerRadius * 0.25;
        
        if (surfaceDist < threshold) {
          collide = true;
          console.log(`Collision with ${obj.mesh.constructor.name}: dist=${surfaceDist.toFixed(2)}, threshold=${threshold.toFixed(2)}`);
          break;
        }
      }
      
      // Only move if there's no collision
      if (!collide) {
        this.yawObject.position.copy(finalPos);
        this.yawObject.up.copy(finalPos.clone().normalize());
      } else {
        console.log("Movement blocked by collision");
      }
    }

    return true;
  }

  reset() {
    // Reset to a safe height above origin point
    const originDir = new THREE.Vector3(0, 0, 1).normalize();
    const terrainHeight = this.getTerrainHeight(originDir);
    const safePos = originDir.multiplyScalar(this.radius + terrainHeight + 5);
    
    this.yawObject.position.copy(safePos);
    this.yawObject.up.copy(safePos.clone().normalize());
    this.pitch = 0;
    this.pitchObject.rotation.x = 0;
    
    // Look along tangent
    const resetForward = new THREE.Vector3(0,0,-1)
      .projectOnPlane(this.yawObject.up)
      .normalize();
    const resetTarget = this.yawObject.position.clone().add(resetForward);
    this.yawObject.lookAt(resetTarget);
  }

  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    document.removeEventListener('mousemove', this.onMouseMove);
  }
}
