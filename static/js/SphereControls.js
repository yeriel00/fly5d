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

    // Physics state
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.onGround = false;
    this.sliding = false;
    this.currentSurface = null;
    
    // Physics settings
    this.slideAngleThreshold = 0.6; // cos of max angle (~53 degrees)
    this.slideAcceleration = 0.05;  // Sliding force
    this.slideFriction = 0.98;      // Slide friction (reduces speed)
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

  update(delta) {
    // Cache old position for collision response
    const oldPos = this.yawObject.position.clone();
    
    // Apply gravity/jumping
    // ...existing gravity code if any...
    
    // Reset surface state
    this.onGround = false;
    this.sliding = false;
    this.currentSurface = null;
    
    // Process keyboard movement
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

    // After movement, check for surface interaction
    this.checkSurfaceInteraction(upDir);
    
    // Process sliding physics on steep surfaces
    if (this.sliding && this.currentSurface) {
      const surfaceNormal = this.currentSurface.direction;
      
      // Calculate slide vector (downhill direction)
      const slideVector = new THREE.Vector3();
      slideVector.crossVectors(
        upDir.clone().cross(surfaceNormal).normalize(),
        surfaceNormal
      ).normalize();
      
      // Apply slide force
      const slideForce = this.slideAcceleration * delta * 60;
      this.velocity.add(slideVector.multiplyScalar(slideForce));
      
      // Apply friction based on surface
      const friction = this.currentSurface.friction || 0.98;
      this.velocity.multiplyScalar(friction);
      
      // Apply velocity
      this.yawObject.position.add(this.velocity);
      
      // Update orientation to match new position
      const newUpDir = this.yawObject.position.clone().normalize();
      this.yawObject.up.copy(newUpDir);
    } else {
      // Gradually reduce velocity when not sliding
      this.velocity.multiplyScalar(0.9);
    }
    
    return true;
  }

  checkSurfaceInteraction(upDir) {
    const pos = this.yawObject.position.clone();
    const rayOrigin = pos.clone();
    const rayDir = pos.clone().negate().normalize();
    
    // Cast ray downward
    const raycaster = new THREE.Raycaster(rayOrigin, rayDir);
    raycaster.far = this.playerRadius + 0.1; // Short distance
    
    // Filter collidables to check only solid objects
    const validCollidables = this.collidables.filter(obj => {
      if (!obj.mesh || !obj.direction) return false;
      if (obj.noCollision) return false;
      return true;
    });
    
    // Cast ray to check for ground
    const intersects = [];
    validCollidables.forEach(obj => {
      if (obj.mesh instanceof THREE.Mesh && obj.mesh.geometry) {
        const localRay = raycaster.ray.clone();
        const inverseMatrix = new THREE.Matrix4().copy(obj.mesh.matrixWorld).invert();
        localRay.applyMatrix4(inverseMatrix);
        
        const intersect = localRay.intersectTriangle(
          new THREE.Vector3(-1, 0, -1),
          new THREE.Vector3(-1, 0, 1),
          new THREE.Vector3(1, 0, 1),
          false,
          new THREE.Vector3()
        );
        
        if (intersect) {
          intersects.push({
            object: obj,
            point: intersect
          });
        }
      }
    });
    
    // Process the closest intersection
    if (intersects.length > 0) {
      // Sort by distance
      intersects.sort((a, b) => {
        return a.distance - b.distance;
      });
      
      const closest = intersects[0];
      const surfaceObj = closest.object;
      
      // Calculate angle between surface normal and up vector
      const surfaceNormal = surfaceObj.direction;
      const surfaceDot = upDir.dot(surfaceNormal);
      
      this.onGround = true;
      this.currentSurface = surfaceObj;
      
      // Check if surface is steep enough to slide
      if (surfaceDot < this.slideAngleThreshold && surfaceObj.mesh.userData.isRock) {
        this.sliding = true;
      }
    }
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
