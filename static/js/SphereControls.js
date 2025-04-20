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

    // build yaw->pitch->camera hierarchy
    this.yawObject = new THREE.Object3D();
    this.pitchObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);
    this.pitchObject.add(camera);
    camera.position.set(0, options.eyeHeight||1.6, 0);

    // start on equator facing global -Z
    const startPos = new THREE.Vector3(0, 0, this.radius);
    this.yawObject.position.copy(startPos);
    this.yawObject.up.copy(startPos.clone().normalize());
    // aim yawObject so its local forward is tangent(-Z)
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
      this.yawObject.position.copy(nDir.multiplyScalar(this.radius + h));
      
      // keep upright
      this.yawObject.up.copy(nDir);
    }

    return true;
  }

  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    document.removeEventListener('mousemove', this.onMouseMove);
  }
}
