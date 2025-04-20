import * as THREE from 'three';

export default class OrientationHelper {
  constructor(character) {
    this.character = character;       // THREE.Object3D (your player)
    this.tmpMatrix = new THREE.Matrix4();
  }
  
  update() {
    // 1. Surface normal (up)
    const up = this.character.position.clone().normalize();
    // 2. Forward from current quat, flattened
    const forward = new THREE.Vector3(0,0,-1)
      .applyQuaternion(this.character.quaternion)
      .projectOnPlane(up)
      .normalize();
    // 3. Right = forward × up
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    // 4. Build basis matrix: [ right (X), up (Y), -forward (Z) ]
    this.tmpMatrix.makeBasis(right, up, forward.clone().negate());
    // 5. Apply to character
    this.character.quaternion.setFromRotationMatrix(this.tmpMatrix);
    this.character.up.copy(up);
  }
}
