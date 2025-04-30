import * as THREE from 'three';

// Bird system configuration with enhanced visuals and more birds
export const BIRD_CONFIG = {
  count: 12,                   // Increased number of birds (from 5 to 12)
  minHeight: 60,               // Minimum height above terrain
  maxHeight: 120,              // Increased max height for more variety 
  minSpeed: 0.08,              // Slightly slower minimum for more natural movement
  maxSpeed: 0.35,              // Slightly higher max speed for variety
  minScale: 0.8,               // Allow for smaller birds
  maxScale: 1.2,               // Allow for larger birds
  colors: [                    // More varied color options for birds
    { body: 0x505050, wing: 0x606060, head: 0x303030 },  // Gray bird
    { body: 0x703030, wing: 0x854242, head: 0x5a2424 },  // Reddish bird 
    { body: 0x304050, wing: 0x405570, head: 0x203040 },  // Bluish bird
    { body: 0x304030, wing: 0x4a5a4a, head: 0x203020 },  // Greenish bird
  ],
  damage: {
    red: { body: 7, head: 3 },    // Damage thresholds for red apples
    yellow: { body: 5, head: 2 }, // Damage thresholds for yellow apples
    green: { body: 2, head: 1 }   // Damage thresholds for green apples
  },
  respawnTime: 12000,          // Slightly faster respawn time (from 15000ms)
  flockingFactor: 0.2,         // How much birds influence each other's movement
  flockDistance: 50,           // Distance at which birds can see each other
  flightPatterns: [            // Different flight patterns for variety
    { type: 'circle', height: 0, radius: 1.0 },      // Standard circular orbit
    { type: 'figure8', height: 20, radius: 1.0 },    // Figure 8 pattern
    { type: 'wavy', height: 10, amplitude: 20 },     // Wavy up/down pattern
    { type: 'random', changeTime: 3000 }             // Random direction changes
  ]
};

// Enhanced low-poly Bird class that fits the game's visual style
export class Bird {
  constructor(scene, config, patternIndex = null) {
    this.scene = scene;
    this.config = config;
    this.alive = true;
    this.hits = {
      body: { red: 0, yellow: 0, green: 0 },
      head: { red: 0, yellow: 0, green: 0 }
    };
    
    // Select a random color scheme
    const colorScheme = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
    
    // Group to hold all parts of the bird
    this.group = new THREE.Group();
    
    // Create low-poly bird body
    const bodyGeo = new THREE.IcosahedronGeometry(3, 0); // Low-poly sphere
    const bodyMat = new THREE.MeshLambertMaterial({ color: colorScheme.body, flatShading: true });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.name = "BirdBody";
    // Slightly elongate the body
    this.body.scale.set(1.2, 1.0, 1.4);
    this.group.add(this.body);
    
    // Create low-poly bird head
    const headGeo = new THREE.TetrahedronGeometry(2, 0); // Very low-poly for head
    const headMat = new THREE.MeshLambertMaterial({ color: colorScheme.head, flatShading: true });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.set(0, 0, 3); // Head extends forward
    this.head.rotation.set(0, 0, Math.PI/5); // Tilt head slightly
    this.head.name = "BirdHead";
    this.group.add(this.head);
    
    // Create beak
    const beakGeo = new THREE.ConeGeometry(0.8, 2, 4); // Low-poly cone
    const beakMat = new THREE.MeshLambertMaterial({ color: 0xd89c36, flatShading: true });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(0, -0.5, 5);
    beak.rotation.set(Math.PI/2, 0, 0);
    this.group.add(beak);
    
    // Add simple wings with more geometry
    this.createWings(colorScheme.wing);
    
    // Create tail feathers
    this.createTail(colorScheme.body);
    
    // Apply random scaling
    const scale = config.minScale + Math.random() * (config.maxScale - config.minScale);
    this.group.scale.set(scale, scale, scale);
    
    // Set orbit parameters
    this.orbitRadius = config.radius + config.minHeight + 
                       Math.random() * (config.maxHeight - config.minHeight);
    this.orbitSpeed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitHeight = Math.random() * 50 - 25; // Random height variation
    
    // Select flight pattern
    this.flightPattern = config.flightPatterns[
      patternIndex !== null ? patternIndex % config.flightPatterns.length : 
      Math.floor(Math.random() * config.flightPatterns.length)
    ];
    
    this.directionChangeTime = Date.now() + (Math.random() * 5000);
    this.randomFactor = Math.random() * Math.PI;
    
    // Add to scene
    scene.add(this.group);
  }
  
  createWings(color) {
    // Create more detailed wings with multiple segments
    const wingMat = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide, flatShading: true });
    
    // Left wing - multi-segment for better animation
    this.leftWing = new THREE.Group();
    const leftWingGeo = new THREE.BufferGeometry();
    
    // Create a triangle wing shape with multiple segments
    const leftWingShape = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-4, 0, -1),
      new THREE.Vector3(-7, 0, 0),
      new THREE.Vector3(-9, 0, 2),
      new THREE.Vector3(-6, 0, 3),
      new THREE.Vector3(-3, 0, 1),
    ];
    
    // Create triangles from vertices
    const leftWingVertices = [];
    const center = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < leftWingShape.length - 1; i++) {
      leftWingVertices.push(center.x, center.y, center.z);
      leftWingVertices.push(leftWingShape[i].x, leftWingShape[i].y, leftWingShape[i].z);
      leftWingVertices.push(leftWingShape[i+1].x, leftWingShape[i+1].y, leftWingShape[i+1].z);
    }
    
    leftWingGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftWingVertices, 3));
    leftWingGeo.computeVertexNormals();
    
    const leftWingMesh = new THREE.Mesh(leftWingGeo, wingMat);
    this.leftWing.add(leftWingMesh);
    this.leftWing.position.set(-0.5, 0, 0);
    this.group.add(this.leftWing);
    
    // Right wing (mirror of left)
    this.rightWing = new THREE.Group();
    const rightWingGeo = new THREE.BufferGeometry();
    
    // Create a mirrored triangle wing shape
    const rightWingVertices = [];
    for (let i = 0; i < leftWingShape.length - 1; i++) {
      rightWingVertices.push(center.x, center.y, center.z);
      rightWingVertices.push(-leftWingShape[i].x, leftWingShape[i].y, leftWingShape[i].z);
      rightWingVertices.push(-leftWingShape[i+1].x, leftWingShape[i+1].y, leftWingShape[i+1].z);
    }
    
    rightWingGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightWingVertices, 3));
    rightWingGeo.computeVertexNormals();
    
    const rightWingMesh = new THREE.Mesh(rightWingGeo, wingMat);
    this.rightWing.add(rightWingMesh);
    this.rightWing.position.set(0.5, 0, 0);
    this.group.add(this.rightWing);
  }
  
  createTail(color) {
    // Create a simple tail with a few feathers
    const tailMat = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide, flatShading: true });
    
    const tailGeo = new THREE.BufferGeometry();
    const tailVertices = [
      // Center feather
      0, 0, -3,  0, 0, -7,  0, 1, -8,
      // Left feather
      0, 0, -3,  -1.5, 0.5, -6,  -1, 1.5, -7,
      // Right feather
      0, 0, -3,  1.5, 0.5, -6,  1, 1.5, -7
    ];
    
    tailGeo.setAttribute('position', new THREE.Float32BufferAttribute(tailVertices, 3));
    tailGeo.computeVertexNormals();
    
    const tail = new THREE.Mesh(tailGeo, tailMat);
    this.group.add(tail);
  }
  
  update(deltaTime, allBirds) {
    if (!this.alive) return;
    
    // Update wing flapping animation - more natural sinusoidal movement
    this.animateWings(deltaTime);
    
    // Update orbit position based on selected flight pattern
    this.updatePosition(deltaTime, allBirds);
    
    // Make bird face the direction of travel
    this.orientBird();
  }
  
  animateWings(deltaTime) {
    // More realistic wing flapping with different phases
    const wingFlapSpeed = 10; // Speed of wing flapping
    const wingFlapAmount = 0.6; // Amount of wing rotation
    const flapPhase = Date.now() * 0.01;
    
    // Asymmetric flap pattern for more natural movement
    const leftWingFlap = Math.sin(flapPhase * wingFlapSpeed) * wingFlapAmount;
    const rightWingFlap = Math.sin(flapPhase * wingFlapSpeed + 0.2) * wingFlapAmount; // Slight phase difference
    
    this.leftWing.rotation.x = leftWingFlap;
    this.rightWing.rotation.x = rightWingFlap;
    
    // Add subtle body movements to match wing flaps
    this.body.rotation.z = Math.sin(flapPhase * wingFlapSpeed * 0.5) * 0.05;
    this.head.rotation.z = Math.sin(flapPhase * wingFlapSpeed * 0.3) * 0.03;
  }
  
  updatePosition(deltaTime, allBirds) {
    // Update orbit angle
    this.orbitAngle += this.orbitSpeed * deltaTime;
    
    let x, y, z;
    
    // Apply selected flight pattern
    switch (this.flightPattern.type) {
      case 'circle':
        x = this.orbitRadius * Math.cos(this.orbitAngle);
        z = this.orbitRadius * Math.sin(this.orbitAngle);
        y = this.orbitHeight + this.flightPattern.height;
        break;
        
      case 'figure8':
        // Figure 8 pattern
        x = this.orbitRadius * Math.cos(this.orbitAngle);
        z = this.orbitRadius * Math.sin(this.orbitAngle * 2) * 0.5;
        y = this.orbitHeight + this.flightPattern.height + Math.sin(this.orbitAngle) * 15;
        break;
        
      case 'wavy':
        // Wavy up and down pattern
        x = this.orbitRadius * Math.cos(this.orbitAngle);
        z = this.orbitRadius * Math.sin(this.orbitAngle);
        y = this.orbitHeight + this.flightPattern.height + 
            Math.sin(this.orbitAngle * 3) * this.flightPattern.amplitude;
        break;
        
      case 'random':
        // Random direction changes
        if (Date.now() > this.directionChangeTime) {
          this.randomFactor = Math.random() * Math.PI * 2;
          this.directionChangeTime = Date.now() + this.flightPattern.changeTime;
        }
        
        x = this.orbitRadius * Math.cos(this.orbitAngle + this.randomFactor);
        z = this.orbitRadius * Math.sin(this.orbitAngle + this.randomFactor);
        y = this.orbitHeight + Math.sin(this.orbitAngle * 0.5) * 15;
        break;
        
      default:
        // Default circular pattern
        x = this.orbitRadius * Math.cos(this.orbitAngle);
        z = this.orbitRadius * Math.sin(this.orbitAngle);
        y = this.orbitHeight;
    }
    
    // Apply flocking behavior if configured
    if (this.config.flockingFactor > 0 && allBirds && allBirds.length > 1) {
      const flockInfluence = this.calculateFlockInfluence(allBirds);
      x += flockInfluence.x * this.config.flockingFactor * deltaTime * 10;
      y += flockInfluence.y * this.config.flockingFactor * deltaTime * 10;
      z += flockInfluence.z * this.config.flockingFactor * deltaTime * 10;
    }
    
    // Update position
    this.group.position.set(x, y, z);
  }
  
  calculateFlockInfluence(allBirds) {
    const influence = new THREE.Vector3();
    let neighborCount = 0;
    
    allBirds.forEach(otherBird => {
      if (otherBird !== this && otherBird.alive) {
        const distance = this.group.position.distanceTo(otherBird.group.position);
        
        if (distance < this.config.flockDistance) {
          // Add attraction to other birds
          const direction = otherBird.group.position.clone().sub(this.group.position);
          influence.add(direction.normalize());
          neighborCount++;
        }
      }
    });
    
    // Average the influence
    if (neighborCount > 0) {
      influence.divideScalar(neighborCount);
    }
    
    return influence;
  }
  
  orientBird() {
    // Calculate velocity vector for orientation
    const currentPos = this.group.position.clone();
    
    // Calculate velocity vector by predicting next position
    const nextAngle = this.orbitAngle + this.orbitSpeed * 0.1;
    let nextX, nextZ;
    
    // Use same pattern logic to predict next position
    if (this.flightPattern.type === 'figure8') {
      nextX = this.orbitRadius * Math.cos(nextAngle);
      nextZ = this.orbitRadius * Math.sin(nextAngle * 2) * 0.5;
    } else {
      nextX = this.orbitRadius * Math.cos(nextAngle);
      nextZ = this.orbitRadius * Math.sin(nextAngle);
    }
    
    const nextPos = new THREE.Vector3(nextX, currentPos.y, nextZ);
    const velocity = nextPos.sub(currentPos);
    
    // Only update rotation if there's meaningful movement
    if (velocity.lengthSq() > 0.0001) {
      const lookTarget = currentPos.clone().add(velocity);
      this.group.lookAt(lookTarget);
      
      // Add banking on turns - more pronounced when turning
      const turnRate = Math.sin(this.orbitAngle * 2) * 0.1;
      this.group.rotation.z = turnRate;
    }
  }
  
  hit(appleType, hitArea) {
    if (!this.alive) return false;
    
    // Increment hit counter for the specific apple type and area
    this.hits[hitArea][appleType]++;
    
    // Get damage thresholds
    const requiredHits = this.config.damage[appleType][hitArea];
    const currentHits = this.hits[hitArea][appleType];
    
    // Create hit effect
    this.createHitEffect(hitArea);
    
    console.log(`Bird hit on ${hitArea} with ${appleType} apple: ${currentHits}/${requiredHits}`);
    
    // Check if bird should die
    if (currentHits >= requiredHits) {
      this.die();
      return true; // Bird died from this hit
    }
    
    return false; // Bird survived this hit
  }
  
  createHitEffect(hitArea) {
    // Flash the affected part
    const mesh = hitArea === 'head' ? this.head : this.body;
    const originalColor = mesh.material.color.clone();
    
    // Flash to white
    mesh.material.color.set(0xffffff);
    
    // Create impact particles
    this.createImpactParticles(hitArea === 'head' ? this.head.position : this.body.position);
    
    // Flash back to original after 100ms
    setTimeout(() => {
      if (this.alive) {
        mesh.material.color.copy(originalColor);
      }
    }, 100);
  }
  
  createImpactParticles(position) {
    const particleCount = 8;
    const particles = new THREE.Group();
    
    // Convert local position to world position
    const worldPos = new THREE.Vector3();
    if (position) {
      worldPos.copy(position).applyMatrix4(this.group.matrixWorld);
    } else {
      worldPos.copy(this.group.position);
    }
    
    // Create small particles that fly out from impact
    for (let i = 0; i < particleCount; i++) {
      const particleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const particleMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      
      // Position at impact point
      particle.position.copy(worldPos);
      
      // Random velocity outward
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      particle.userData.velocity = velocity;
      particle.userData.lifetime = 1.0; // 1 second lifetime
      
      particles.add(particle);
    }
    
    // Add to scene
    this.scene.add(particles);
    
    // Animate particles
    const startTime = Date.now();
    const duration = 1000; // 1 second
    
    const animateParticles = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1.0) {
        particles.children.forEach(particle => {
          // Move particle based on velocity
          particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.1));
          
          // Slow down velocity
          particle.userData.velocity.multiplyScalar(0.95);
          
          // Fade out
          particle.material.opacity = 1.0 - progress;
          particle.material.transparent = true;
          
          // Shrink
          const scale = 1.0 - progress;
          particle.scale.set(scale, scale, scale);
        });
        
        requestAnimationFrame(animateParticles);
      } else {
        // Remove particles when done
        this.scene.remove(particles);
      }
    };
    
    requestAnimationFrame(animateParticles);
  }
  
  die() {
    this.alive = false;
    console.log("Bird killed!");
    
    // Play death effect
    this.createDeathEffect();
    
    // Hide bird after death effect
    setTimeout(() => {
      this.group.visible = false;
    }, 1000);
    
    // Schedule respawn if desired
    if (this.config.respawnTime) {
      setTimeout(() => this.respawn(), this.config.respawnTime);
    }
  }
  
  createDeathEffect() {
    // Enhanced death effect - fade to red and fall with feathers
    this.body.material.color.set(0xff0000);
    this.head.material.color.set(0xff0000);
    
    // Make bird fall with rotation
    const startPos = this.group.position.clone();
    const fallDir = startPos.clone().normalize().negate(); // Fall toward planet
    
    // Create feather particles
    this.createFeatherParticles(15); // 15 feathers
    
    // Animate fall and spin
    const startTime = Date.now();
    const fallDuration = 1000; // 1 second fall
    
    const fallInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / fallDuration, 1.0);
      
      // Fall toward planet with acceleration
      const newPos = startPos.clone().add(
        fallDir.clone().multiplyScalar(progress * progress * 40) // Accelerating fall
      );
      this.group.position.copy(newPos);
      
      // Spin randomly with increasing speed
      this.group.rotation.x += 0.1 * progress;
      this.group.rotation.z += 0.15 * progress;
      
      // Stop when complete
      if (progress >= 1.0) {
        clearInterval(fallInterval);
      }
    }, 16);
  }
  
  createFeatherParticles(count) {
    const feathers = new THREE.Group();
    
    for (let i = 0; i < count; i++) {
      // Create a simple feather shape
      const featherGeo = new THREE.BufferGeometry();
      const featherVerts = [
        0, 0, 0,
        0.5, 0, 0.5,
        1, 0, 0,
        0.5, 0, -0.5
      ];
      
      featherGeo.setAttribute('position', new THREE.Float32BufferAttribute(featherVerts, 3));
      featherGeo.setIndex([0, 1, 2, 0, 2, 3]); // Create triangles
      featherGeo.computeVertexNormals();
      
      const featherMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      
      const feather = new THREE.Mesh(featherGeo, featherMat);
      feather.scale.set(0.5, 0.5, 0.5);
      feather.position.copy(this.group.position);
      
      // Add random velocity
      feather.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5),
        (Math.random() - 0.5) * 2
      );
      
      // Random rotation
      feather.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      feather.userData.rotationSpeed = new THREE.Vector3(
        Math.random() * 0.1,
        Math.random() * 0.1,
        Math.random() * 0.1
      );
      
      feathers.add(feather);
    }
    
    this.scene.add(feathers);
    
    // Animate falling feathers
    const startTime = Date.now();
    const duration = 3000; // 3 seconds
    
    const animateFeathers = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1.0) {
        feathers.children.forEach(feather => {
          // Move feather based on velocity
          feather.position.add(feather.userData.velocity.clone().multiplyScalar(0.2));
          
          // Add gravity and drag
          feather.userData.velocity.y -= 0.01;
          feather.userData.velocity.multiplyScalar(0.99);
          
          // Rotate feather for fluttering effect
          feather.rotation.x += feather.userData.rotationSpeed.x;
          feather.rotation.y += feather.userData.rotationSpeed.y;
          feather.rotation.z += feather.userData.rotationSpeed.z;
          
          // Fade out near end
          if (progress > 0.7) {
            feather.material.opacity = 0.7 * (1 - (progress - 0.7) / 0.3);
          }
        });
        
        requestAnimationFrame(animateFeathers);
      } else {
        // Remove feathers when done
        this.scene.remove(feathers);
      }
    };
    
    requestAnimationFrame(animateFeathers);
  }
  
  respawn() {
    if (this.scene) {
      // Reset state
      this.alive = true;
      this.hits = {
        body: { red: 0, yellow: 0, green: 0 },
        head: { red: 0, yellow: 0, green: 0 }
      };
      
      // Reset appearance - select a new color scheme for variety
      const colorScheme = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
      this.body.material.color.set(colorScheme.body);
      this.head.material.color.set(colorScheme.head);
      
      // Reset position and randomize parameters
      this.orbitAngle = Math.random() * Math.PI * 2;
      this.orbitRadius = this.config.radius + this.config.minHeight + 
                         Math.random() * (this.config.maxHeight - this.config.minHeight);
      this.orbitSpeed = this.config.minSpeed + Math.random() * (this.config.maxSpeed - this.config.minSpeed);
      this.orbitHeight = Math.random() * 50 - 25;
      
      // Choose a new flight pattern
      this.flightPattern = this.config.flightPatterns[
        Math.floor(Math.random() * this.config.flightPatterns.length)
      ];
      
      // Show bird again
      this.group.visible = true;
      
      console.log("Bird respawned");
    }
  }
  
  // For collision detection
  getBodyPosition() {
    return this.body.getWorldPosition(new THREE.Vector3());
  }
  
  getHeadPosition() {
    return this.head.getWorldPosition(new THREE.Vector3());
  }
  
  // For radius-based collision detection
  getBodyRadius() {
    return 3.5 * Math.max(this.group.scale.x, this.group.scale.y, this.group.scale.z);
  }
  
  getHeadRadius() {
    return 2.0 * Math.max(this.group.scale.x, this.group.scale.y, this.group.scale.z);
  }
  
  cleanup() {
    if (this.scene && this.group) {
      this.scene.remove(this.group);
    }
  }
}

// Main bird system class to manage all birds
export class BirdSystem {
  constructor(scene, config) {
    this.scene = scene;
    this.config = { ...BIRD_CONFIG, ...config };
    this.birds = [];
    this.config.radius = this.config.radius || 400; // Default radius
  }
  
  init() {
    // Clear any existing birds
    this.cleanup();
    
    // Create new birds
    for (let i = 0; i < this.config.count; i++) {
      // Distribute birds evenly across flight patterns for variety
      const patternIndex = i % this.config.flightPatterns.length;
      this.birds.push(new Bird(this.scene, this.config, patternIndex));
    }
    
    console.log(`Spawned ${this.birds.length} birds`);
    return this.birds;
  }
  
  update(deltaTime) {
    // Update all birds, passing the full flock for flocking behavior
    this.birds.forEach(bird => bird.update(deltaTime, this.birds));
  }
  
  cleanup() {
    this.birds.forEach(bird => bird.cleanup());
    this.birds = [];
  }
  
  checkCollision(projectile) {
    if (!projectile || !projectile.mesh || !projectile.velocity) return false;
    
    // Get projectile position
    const projectilePos = projectile.mesh.position.clone();
    const projectileRadius = projectile.radius || 1.0;
    const projectileType = projectile.type || 'red';
    
    // Check collision with each bird
    for (const bird of this.birds) {
      if (!bird.alive) continue;
      
      // Check head collision (higher priority)
      const headPos = bird.getHeadPosition();
      const headRadius = bird.getHeadRadius();
      const headDist = headPos.distanceTo(projectilePos);
      
      if (headDist < headRadius + projectileRadius) {
        // Head hit!
        const killed = bird.hit(projectileType, 'head');
        return {
          hit: true,
          killed: killed,
          position: headPos,
          hitArea: 'head',
          bird: bird
        };
      }
      
      // Check body collision
      const bodyPos = bird.getBodyPosition();
      const bodyRadius = bird.getBodyRadius();
      const bodyDist = bodyPos.distanceTo(projectilePos);
      
      if (bodyDist < bodyRadius + projectileRadius) {
        // Body hit!
        const killed = bird.hit(projectileType, 'body');
        return {
          hit: true,
          killed: killed,
          position: bodyPos,
          hitArea: 'body', 
          bird: bird
        };
      }
    }
    
    return false;
  }
  
  respawnAll() {
    this.birds.forEach(bird => {
      bird.alive = false; // Mark as dead first
      bird.respawn(); // Then respawn
    });
    return this.birds.length;
  }
  
  // Get a bird by index
  getBird(index) {
    if (index >= 0 && index < this.birds.length) {
      return this.birds[index];
    }
    return null;
  }
  
  // Get count of currently alive birds
  getAliveBirdCount() {
    return this.birds.filter(bird => bird.alive).length;
  }
}

// Helper functions for external use
export function createBirdSystem(scene, config) {
  const birdSystem = new BirdSystem(scene, config);
  birdSystem.init();
  return birdSystem;
}

// Override for direct bird hit testing from console
export function hitBird(birdSystem, index, appleType, hitArea = 'body') {
  const bird = birdSystem.getBird(index);
  if (bird) {
    const killed = bird.hit(appleType, hitArea);
    return {
      bird: index,
      killed: killed,
      hitArea: hitArea,
      appleType: appleType
    };
  } else {
    console.warn(`Bird with index ${index} not found`);
    return false;
  }
}
