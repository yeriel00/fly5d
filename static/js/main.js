// Main controller for sphere world walker

// WebGL setup
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
const scene = new THREE.Scene();

// Movement on sphere
const R = 50, eyeH = 1.6;
// Start on the “equator” instead of north‐pole:
let camNorm = new THREE.Vector3(0, 0, 1);               // Unit surface normal
let camPos  = camNorm.clone().multiplyScalar(R + eyeH);
let yaw=0, pitch=0;
const keys = {};

// Perspective camera
const camera = new THREE.PerspectiveCamera(60,1,0.1,2000);
window.addEventListener('resize',() => {
  const w=window.innerWidth, h=window.innerHeight;
  renderer.setSize(w,h);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
});
window.dispatchEvent(new Event('resize'));

// Lights
scene.add(new THREE.AmbientLight(0xffffff,0.6));
const dl = new THREE.DirectionalLight(0xffffff,0.6);
dl.position.set(5,10,5);
scene.add(dl);

// Build world
import { initEnvironment, collidables } from './world_objects.js';
initEnvironment(scene, 'medium');  // creates sphere + trees + fence + cabin, etc.

// Input
window.addEventListener('keydown', e=> keys[e.key.toLowerCase()]=true);
window.addEventListener('keyup',   e=> keys[e.key.toLowerCase()]=false);

// Reset on Space
window.addEventListener('keydown', e=>{
  if(e.key===' ') {
    camNorm.set(0,1,0);
    camPos = camNorm.clone().multiplyScalar(R + eyeH);
    yaw = pitch = 0;
  }
});

// Animation
function animate() {
  requestAnimationFrame(animate);

  // Look control
  if(keys['arrowleft'])  yaw   -= 0.02;
  if(keys['arrowright']) yaw   += 0.02;
  if(keys['arrowup'])    pitch = Math.min(pitch+0.02, Math.PI/2-0.01);
  if(keys['arrowdown'])  pitch = Math.max(pitch-0.02,-Math.PI/2+0.01);

  // Basis
  const forward = new THREE.Vector3(
    Math.sin(yaw)*Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw)*Math.cos(pitch)
  ).normalize();
  const right = new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();

  // Move
  if(keys['w']) camNorm.addScaledVector(forward,0.005);
  if(keys['s']) camNorm.addScaledVector(forward,-0.005);
  if(keys['a']) camNorm.addScaledVector(right,-0.005);
  if(keys['d']) camNorm.addScaledVector(right,0.005);
  camNorm.normalize();
  camPos = camNorm.clone().multiplyScalar(R + eyeH);

  // Update camera position & orientation:
  camera.position.copy(camPos);
  camera.up.copy(camNorm);
  // Look out along the forward vector, not back at the center:
  camera.lookAt(camPos.clone().add(forward));

  renderer.render(scene, camera);
}
animate();
