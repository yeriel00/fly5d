import * as THREE from 'three';
import { mergeVertices } from './utils/BufferGeometryUtils.js';

export default class LowPolyCabin {
  // tiny random offsets for that hand‑built feel
  static _jitter(geo, amp = 0.05) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + (Math.random() - 0.5) * amp,
        pos.getY(i) + (Math.random() - 0.5) * amp,
        pos.getZ(i) + (Math.random() - 0.5) * amp
      );
    }
    pos.needsUpdate = true;
  }

  /**
   * @param {object} opts
   * @param {number} opts.width – cabin footprint in X
   * @param {number} opts.depth – cabin footprint in Z
   * @param {number} opts.wallHeight – wall height in Y
   * @param {number} opts.roofHeight – height of roof peak above walls
   * @param {THREE.Color} opts.stoneColor
   * @param {THREE.Color} opts.woodColor
   * @param {THREE.Color} opts.roofColor
   */
  static createCabin({
    width = 10,
    depth = 8,
    wallHeight = 6,
    roofHeight = 3,
    stoneColor = null,
    woodColor = null,
    roofColor = null,
  } = {}) {
    const cabin = new THREE.Group();

    // ─── Stone Walls ─────────────────────────────────────
    const stoneMat = new THREE.MeshStandardMaterial({
      color: stoneColor || new THREE.Color(0.5, 0.5, 0.52),
      flatShading: true,
    });
    const blockSize = 1;
    const cols = Math.floor(width / blockSize);
    const rows = Math.floor(depth / blockSize);

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const geo = new THREE.BoxGeometry(blockSize, wallHeight, blockSize);
        this._jitter(geo, 0.02);
        mergeVertices(geo, 0.01);
        const block = new THREE.Mesh(geo, stoneMat);
        block.position.set(
          -width / 2 + blockSize / 2 + i * blockSize,
          wallHeight / 2,
          -depth / 2 + blockSize / 2 + j * blockSize
        );
        cabin.add(block);
      }
    }

    // ─── Roof (triangular prism) ─────────────────────────
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor || new THREE.Color(0.2, 0.3, 0.45),
      flatShading: true,
    });
    const roofGeo = new THREE.BufferGeometry();
    const hw = width / 2,
      hh = wallHeight / 2,
      hd = depth / 2;
    roofGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          // front edge
          -hw, hh, -hd,
          hw, hh, -hd,
          0, hh + roofHeight, -hd,
          // back edge
          hw, hh, hd,
          -hw, hh, hd,
          0, hh + roofHeight, hd,
        ]),
        3
      )
    );
    roofGeo.setIndex([
      0, 1, 2, // front face
      3, 4, 5, // back face
      0, 2, 4,
      4, 2, 5, // left end
      1, 3, 2,
      3, 5, 2, // right end
      0, 4, 1,
      1, 4, 3, // bottom fill
    ]);
    roofGeo.computeVertexNormals();
    this._jitter(roofGeo, 0.03);
    mergeVertices(roofGeo, 0.01);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    cabin.add(roof);

    // ─── Chimney ──────────────────────────────────────────
    const chimneyMat = new THREE.MeshStandardMaterial({
      color: stoneColor || new THREE.Color(0.45, 0.45, 0.48),
      flatShading: true,
    });
    const chimneyGeo = new THREE.BoxGeometry(1.2, roofHeight * 0.6, 1.2);
    this._jitter(chimneyGeo, 0.02);
    mergeVertices(chimneyGeo, 0.01);
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(width / 4, wallHeight + (roofHeight * 0.6) / 2, depth / 4);
    cabin.add(chimney);

    // ─── Door ──────────────────────────────────────────────
    const woodMat = new THREE.MeshStandardMaterial({
      color: woodColor || new THREE.Color(0.4, 0.2, 0.1),
      flatShading: true,
    });
    const doorGeo = new THREE.BoxGeometry(1.2, 2.8, 0.2);
    this._jitter(doorGeo, 0.02);
    mergeVertices(doorGeo, 0.01);
    const door = new THREE.Mesh(doorGeo, woodMat);
    door.position.set(0, 1.4, -depth / 2 - 0.1);
    cabin.add(door);

    // ─── Front Steps ──────────────────────────────────────
    const stepMat = stoneMat;
    for (let k = 0; k < 3; k++) {
      const stepGeo = new THREE.BoxGeometry(2 + k * 0.4, 0.4, 1);
      this._jitter(stepGeo, 0.01);
      mergeVertices(stepGeo, 0.005);
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(
        0,
        0.2 + 0.4 * k,
        -depth / 2 - 0.5 - 0.5 * k
      );
      cabin.add(step);
    }

    // Add cabin userData
    cabin.userData = {
      isCabin: true,
      noCollision: false
    };

    return cabin;
  }
}
