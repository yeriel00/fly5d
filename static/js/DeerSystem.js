import * as THREE from 'three';

// Deer system configuration
export const DEER_CONFIG = {
  count: 8,                    // Number of deer in the scene
  minScale: 0.9,               // Minimum deer size
  maxScale: 1.3,               // Maximum deer size
  moveSpeed: 1.5,              // Increased movement speed (from 0.5)
  turnSpeed: 0.03,             // How fast deer can change direction
  colors: [                    // Deer color variants
    { body: 0x8B4513, leg: 0x654321, antler: 0x5A4D41 },  // Brown deer
    { body: 0x9E7E67, leg: 0x7D5D4A, antler: 0x6B513F },  // Tan deer
    { body: 0x5D4037, leg: 0x4E342E, antler: 0x3E2723 },  // Dark brown deer
    { body: 0xA1887F, leg: 0x8D6E63, antler: 0x795548 },  // Light brown deer
  ],
  damage: {
    red: { body: 7, head: 2 },    // 7 shots to body or 2 to head
    yellow: { body: 5, head: 1 }, // 5 shots to body or 1 to head 
    green: { body: 2, head: 1 },  // 2 shots to body or 1 to head
  },
  respawnTime: 15000,          // Time until a deer respawns after death
  appleDetectionRadius: 30,    // How far deer can detect apples
  appleEatTime: 3000,          // Time it takes to eat an apple
  groundOffset: 6,             // Increased from 2 to 6 to keep deer above terrain
  wanderRadius: 50,            // Maximum wander distance from spawn point
  directionChangeTime: 5000,   // Time between random direction changes
  antlerChance: 0.7,           // Chance that a deer has antlers (male)
};

// Low-poly deer class
export class Deer {
  constructor(scene, terrain, config, position = null) {
    this.scene = scene;
    this.terrain = terrain;
    this.config = config;
    this.alive = true;
    this.hits = {
      body: { red: 0, yellow: 0, green: 0 },
      head: { red: 0, yellow: 0, green: 0 }
    };
    this.isEating = false;
    this.targetApple = null;
    this.lastDirectionChange = 0;
    
    // FIXED: Initialize direction BEFORE potentially using it in randomizePosition
    // Set initial movement direction (random)
    this.direction = new THREE.Vector3(
      Math.random() - 0.5,
      0,
      Math.random() - 0.5
    ).normalize();
    
    this.moveSpeed = config.moveSpeed * (0.8 + Math.random() * 0.4);
    this.currentState = 'wander'; // initial state is wandering
    
    // Select a random color scheme
    const colorScheme = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
    
    // Group to hold all parts of the deer
    this.group = new THREE.Group();
    
    // Create deer body
    const bodyGeo = new THREE.CapsuleGeometry(4, 8, 4, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: colorScheme.body, flatShading: true });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.rotation.x = Math.PI / 2;
    this.body.position.y = 6;
    this.body.name = "DeerBody";
    this.group.add(this.body);
    
    // Create deer head - FIXED: Ensure head is properly positioned
    const headGeo = new THREE.ConeGeometry(2.5, 7, 5);
    const headMat = new THREE.MeshLambertMaterial({ color: colorScheme.body, flatShading: true });
    this.head = new THREE.Mesh(headGeo, headMat);
    // FIXED: Adjusted head orientation
    this.head.rotation.x = -Math.PI / 3; 
    this.head.position.set(0, 8, 6); // Ensure head position is correct
    this.head.name = "DeerHead";
    this.group.add(this.head);
    
    // Create deer legs (4 legs)
    this.createLegs(colorScheme.leg);
    
    // Create antlers (only on some deer)
    if (Math.random() < config.antlerChance) {
      this.createAntlers(colorScheme.antler);
    }
    
    // Create ears
    this.createEars(colorScheme.body);
    
    // Small tail
    const tailGeo = new THREE.SphereGeometry(1, 4, 4);
    const tailMat = new THREE.MeshLambertMaterial({ color: colorScheme.body, flatShading: true });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(0, 6, -8);
    this.group.add(tail);
    
    // Apply random scaling
    const scale = config.minScale + Math.random() * (config.maxScale - config.minScale);
    this.group.scale.set(scale, scale, scale);
    
    // Set initial position
    if (position) {
      this.spawnPosition = position.clone();
      this.group.position.copy(position);
    } else {
      // Random position on terrain
      this.randomizePosition();
    }
    
    // ADDED: Force proper orientation after initial positioning
    this.alignToSurface();
    
    // Add to scene
    scene.add(this.group);
    
    // DEBUG: Ensure this deer is created
    console.log(`Deer created at position: ${this.group.position.toArray()}`);

    this.hitTracker = {
      body: { red: 0, yellow: 0, green: 0 },
      head: { red: 0, yellow: 0, green: 0 }
    };

    // Initialize body and head positions
    this.bodyPosition = new THREE.Vector3();
    this.headPosition = new THREE.Vector3();
  }

  registerHit(hitbox, type) {
    if (!['body', 'head'].includes(hitbox) || !['red', 'yellow', 'green'].includes(type)) {
      console.warn('Invalid hitbox or apple type');
      return;
    }

    this.hitTracker[hitbox][type]++;

    // Check if the deer is killed
    if (
      (this.hitTracker.body.red >= 7) ||
      (this.hitTracker.body.red >= 5 && this.hitTracker.head.red >= 2) ||
      (this.hitTracker.body.yellow >= 5) ||
      (this.hitTracker.body.yellow >= 3 && this.hitTracker.head.yellow >= 1) ||
      (this.hitTracker.body.green >= 2) ||
      (this.hitTracker.head.green >= 1)
    ) {
      this.alive = false;
      console.log('Deer killed by apple hits');
    }
  }
  
  createLegs(color) {
    const legMat = new THREE.MeshLambertMaterial({ color: color, flatShading: true });
    const legPositions = [
      { x: -3, z: 3 },   // front left
      { x: 3, z: 3 },    // front right
      { x: -3, z: -3 },  // back left
      { x: 3, z: -3 }    // back right
    ];
    
    this.legs = [];
    
    legPositions.forEach(pos => {
      const leg = new THREE.Group();
      
      // Upper leg
      const upperLegGeo = new THREE.CylinderGeometry(0.8, 0.6, 5, 5);
      const upperLeg = new THREE.Mesh(upperLegGeo, legMat);
      upperLeg.position.y = -2.5;
      leg.add(upperLeg);
      
      // Lower leg
      const lowerLegGeo = new THREE.CylinderGeometry(0.6, 0.4, 5, 5);
      const lowerLeg = new THREE.Mesh(lowerLegGeo, legMat);
      lowerLeg.position.y = -7.5;
      leg.add(lowerLeg);
      
      // Add to group with position
      leg.position.set(pos.x, 3, pos.z);
      this.group.add(leg);
      this.legs.push(leg);
    });
  }
  
  createEars(color) {
    const earMat = new THREE.MeshLambertMaterial({ color: color, flatShading: true });
    
    // Left ear
    const earGeo = new THREE.ConeGeometry(1, 2, 3);
    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-1.5, 9, 4);
    leftEar.rotation.x = -Math.PI / 4;
    leftEar.rotation.z = -Math.PI / 4;
    this.group.add(leftEar);
    
    // Right ear
    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.position.set(1.5, 9, 4);
    rightEar.rotation.x = -Math.PI / 4;
    rightEar.rotation.z = Math.PI / 4;
    this.group.add(rightEar);
  }
  
  createAntlers(color) {
    const antlerMat = new THREE.MeshLambertMaterial({ color: color, flatShading: true });
    
    // Create antler function
    const createAntler = (isLeft) => {
      const antlerGroup = new THREE.Group();
      const direction = isLeft ? -1 : 1;
      
      // Main antler stem
      const stemGeo = new THREE.CylinderGeometry(0.4, 0.3, 4, 4);
      const stem = new THREE.Mesh(stemGeo, antlerMat);
      stem.rotation.z = direction * Math.PI / 4;
      antlerGroup.add(stem);
      
      // Add 2-3 branches
      const branchCount = 2 + Math.floor(Math.random() * 2);
      
      for (let i = 0; i < branchCount; i++) {
        const branchGeo = new THREE.CylinderGeometry(0.2, 0.1, 2 + Math.random(), 4);
        const branch = new THREE.Mesh(branchGeo, antlerMat);
        
        // Position along stem
        const yPos = (i + 1) * 1.2;
        branch.position.y = yPos;
        
        // Rotate outward and up
        branch.rotation.z = direction * (Math.PI / 3 + Math.random() * 0.3);
        branch.rotation.x = Math.random() * 0.5;
        
        antlerGroup.add(branch);
      }
      
      // Position the antler
      antlerGroup.position.set(direction * 1.5, 10, 4);
      
      return antlerGroup;
    };
    
    // Add left and right antlers
    this.group.add(createAntler(true));
    this.group.add(createAntler(false));
  }
  
  randomizePosition() {
    // Find a random position on the terrain surface
    const sphereRadius = 400; // Using planet radius, consistent with R variable in main.js
    
    // Generate random position on the unit sphere
    // FIXED: Spread deer out more evenly across the planet
    const phi = Math.random() * Math.PI * 2; // Random angle around equator
    const theta = Math.acos(2 * Math.random() - 1); // Random angle from pole
    
    const randomDirection = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi), 
      Math.cos(theta)
    ).normalize();
    
    // Get terrain height at this direction
    let terrainHeight = 0;
    if (this.config.getTerrainHeight) {
      terrainHeight = this.config.getTerrainHeight(randomDirection);
    }
    
    // Calculate the position on the terrain surface
    const surfaceDistance = sphereRadius + terrainHeight + this.config.groundOffset;
    const position = randomDirection.multiplyScalar(surfaceDistance);
    
    this.spawnPosition = position.clone();
    this.group.position.copy(position);
    
    // ADDED: Debug log position
    console.log("Deer spawned at:", position.toArray(), "Height above terrain:", this.config.groundOffset);
    
    // Make sure deer is oriented correctly to the surface
    this.alignToSurface();
  }
  
  stayOnGround() {
    // Get the current direction from center of planet to deer
    const pos = this.group.position.clone();
    const surfaceDirection = pos.clone().normalize();
    
    // Get terrain height at this direction
    let terrainHeight = 0;
    if (this.config.getTerrainHeight) {
      terrainHeight = this.config.getTerrainHeight(surfaceDirection);
    }
    
    // Calculate the correct position on the terrain surface
    const sphereRadius = 400; // Base planet radius
    const surfaceDistance = sphereRadius + terrainHeight + this.config.groundOffset;
    const targetPosition = surfaceDirection.multiplyScalar(surfaceDistance);
    
    // FIXED: Less aggressive height correction to allow more horizontal movement
    // Lower interpolation factor to prevent constantly snapping deer to ground
    this.group.position.lerp(targetPosition, 0.3);
    
    // Orient deer to the surface
    this.alignToSurface();
  }
  
  alignToSurface() {
    const up = this.group.position.clone().normalize();

    // ensure we have a valid forward direction
    if (!this.direction || this.direction.lengthSq() < 0.01) {
      this.direction = new THREE.Vector3(Math.random()-0.5,0,Math.random()-0.5).normalize();
    }

    // set the group's up vector to the surface normal
    this.group.up.copy(up);

    // compute a point to look at in the tangent plane
    const target = this.group.position.clone().add(
      this.direction.clone().sub(up.clone().multiplyScalar(up.dot(this.direction)))
    );

    // orient the deer so its nose points toward that target
    this.group.lookAt(target);
  }
  
  update(deltaTime, apples = []) {
    if (!this.alive) return;
    
    // Check if we need to change direction randomly
    const now = Date.now();
    if (now - this.lastDirectionChange > this.config.directionChangeTime) {
      this.pickNewDirection();
      this.lastDirectionChange = now;
    }
    
    // State machine for deer behavior
    switch (this.currentState) {
      case 'wander':
        this.wander(deltaTime);
        // Check if there are any apples nearby to eat
        this.lookForApples(apples);
        break;
        
      case 'moveToApple':
        this.moveToApple(deltaTime);
        break;
        
      case 'eatApple':
        this.eatApple(deltaTime);
        break;
    }
    
    // Animate walking
    this.animateWalking(deltaTime);
    
    // Keep deer on the ground
    this.stayOnGround();

    // Update body and head positions
    this.updatePositions();
  }
  
  wander(deltaTime) {
    // Get the current up vector (perpendicular to ground)
    const upVector = this.group.position.clone().normalize();
    
    // Project direction onto tangent plane of the sphere to keep deer on the ground
    const projectedDirection = this.direction.clone();
    projectedDirection.sub(upVector.clone().multiplyScalar(projectedDirection.dot(upVector))).normalize();
    
    // Calculate movement along the tangent plane
    const moveAmount = this.moveSpeed * deltaTime;
    const movement = projectedDirection.clone().multiplyScalar(moveAmount);
    
    // FIXED: Apply movement to position and ensure it's a significant amount
    // Using a higher multiplier for more noticeable movement
    const scaledMovement = movement.clone().multiplyScalar(5.0);
    
    // NEW: Check for collisions before applying movement
    const newPosition = this.group.position.clone().add(scaledMovement);
    if (!this._checkCollisions(newPosition)) {
      this.group.position.copy(newPosition);
    } else {
      // If collision detected, try to move around the obstacle
      this._avoidObstacle();
    }
    
    // Keep deer on ground after movement
    this.stayOnGround();
    
    // Face in the direction of movement
    if (movement.lengthSq() > 0.001) {
      this.direction = projectedDirection.clone();
    }
    
    // Check if deer has wandered too far from spawn point
    if (this.spawnPosition && this.group.position.distanceTo(this.spawnPosition) > this.config.wanderRadius) {
      // Calculate direction back toward spawn point along the surface
      const dirToSpawn = this.spawnPosition.clone().sub(this.group.position).normalize();
      
      // Project it onto the tangent plane to keep movement along the surface
      dirToSpawn.sub(upVector.clone().multiplyScalar(dirToSpawn.dot(upVector))).normalize();
      
      // Set as new direction with some randomness for natural movement
      this.direction = dirToSpawn.clone();
      this.direction.x += (Math.random() - 0.5) * 0.2;
      this.direction.z += (Math.random() - 0.5) * 0.2;
      this.direction.normalize();
      
      // Project again to ensure we stay on the surface
      this.direction.sub(upVector.clone().multiplyScalar(this.direction.dot(upVector))).normalize();
    }
  }
  
  lookForApples(apples) {
    if (!apples || apples.length === 0) return;
    
    // Find the closest apple
    let closestApple = null;
    let closestDistance = Infinity;
    
    apples.forEach(apple => {
      if (apple.mesh && !apple.isEaten) {
        const distance = this.group.position.distanceTo(apple.mesh.position);
        
        if (distance < this.config.appleDetectionRadius && distance < closestDistance) {
          closestApple = apple;
          closestDistance = distance;
        }
      }
    });
    
    // If we found a close apple, go eat it
    if (closestApple) {
      this.targetApple = closestApple;
      this.currentState = 'moveToApple';
      console.log("Deer spotted an apple!");
    }
  }
  
  moveToApple(deltaTime) {
    if (!this.targetApple || !this.targetApple.mesh) {
      // Apple is gone, go back to wandering
      this.currentState = 'wander';
      this.targetApple = null;
      return;
    }
    
    // Get the current up vector (perpendicular to ground)
    const upVector = this.group.position.clone().normalize();
    
    // Calculate direction to apple
    this.direction = new THREE.Vector3().subVectors(
      this.targetApple.mesh.position,
      this.group.position
    ).normalize();
    
    // Project direction onto the tangent plane to keep movement along the ground
    this.direction.sub(upVector.clone().multiplyScalar(this.direction.dot(upVector))).normalize();
    
    // Move toward apple
    const moveAmount = this.moveSpeed * deltaTime;
    const movement = this.direction.clone().multiplyScalar(moveAmount);
    
    // FIXED: Apply a higher movement multiplier for apple seeking to make it more urgent
    const scaledMovement = movement.clone().multiplyScalar(6.0);
    
    // NEW: Check for collisions before applying movement
    const newPosition = this.group.position.clone().add(scaledMovement);
    if (!this._checkCollisions(newPosition)) {
      this.group.position.copy(newPosition);
    } else {
      // If blocked, try to navigate around obstacles
      this._navigateAroundObstacle(this.targetApple.mesh.position);
    }
    
    // Keep deer on ground
    this.stayOnGround();
    
    // Check if we've reached the apple
    const distance = this.group.position.distanceTo(this.targetApple.mesh.position);
    if (distance < 5) {
      // Start eating the apple
      this.currentState = 'eatApple';
      this.eatStartTime = Date.now();
      console.log("Deer started eating apple");
    }
  }
  
  eatApple() {
    if (!this.targetApple || !this.targetApple.mesh) {
      // Apple is gone, go back to wandering
      this.currentState = 'wander';
      this.targetApple = null;
      return;
    }
    
    // Check if we've been eating long enough
    const eatingTime = Date.now() - this.eatStartTime;
    if (eatingTime >= this.config.appleEatTime) {
      // Apple has been eaten
      if (this.targetApple.remove) {
        // Mark apple as eaten
        this.targetApple.isEaten = true;
        
        // Visual feedback - hide the apple
        this.targetApple.mesh.visible = false;
        
        // If there's a remove function, call it
        this.targetApple.remove();
      }
      
      console.log("Deer ate an apple!");
      this.currentState = 'wander';
      this.targetApple = null;
    }
  }
  
  animateWalking(deltaTime) {
    // Only animate if the deer is moving
    if (this.currentState === 'eatApple') {
      // Eating animation - head bobs up and down slightly
      const bobAmount = Math.sin(Date.now() * 0.005) * 0.3;
      this.head.rotation.x = -Math.PI / 3 + bobAmount;
      
      // Reset leg positions
      this.legs.forEach(leg => {
        leg.rotation.x = 0;
      });
      
      return;
    }
    
    // Walking animation - legs move back and forth
    const speed = this.moveSpeed * 5;
    const time = Date.now() * 0.003;
    
    // Animate the legs in a walking pattern
    this.legs[0].rotation.x = Math.sin(time * speed) * 0.4;          // Front left
    this.legs[1].rotation.x = Math.sin(time * speed + Math.PI) * 0.4; // Front right
    this.legs[2].rotation.x = Math.sin(time * speed + Math.PI) * 0.4; // Back left
    this.legs[3].rotation.x = Math.sin(time * speed) * 0.4;          // Back right
    
    // Head bobs slightly while walking
    this.head.rotation.x = -Math.PI / 3 + Math.sin(time * speed * 2) * 0.05;
  }
  
  pickNewDirection() {
    // Get the current up vector (perpendicular to ground)
    const upVector = this.group.position.clone().normalize();
    
    // Add randomness to current direction
    this.direction.x += (Math.random() - 0.5) * 1.0;
    this.direction.z += (Math.random() - 0.5) * 1.0;
    this.direction.normalize();
    
    // Project direction onto the tangent plane of the sphere
    // to keep deer moving along the surface
    this.direction.sub(upVector.clone().multiplyScalar(this.direction.dot(upVector))).normalize();
    
    // If we're far from spawn point, bias direction toward it (along the surface)
    if (this.spawnPosition && this.group.position.distanceTo(this.spawnPosition) > this.config.wanderRadius * 0.7) {
      // Calculate direction to spawn, projected to tangent plane
      const dirToSpawn = this.spawnPosition.clone().sub(this.group.position);
      dirToSpawn.sub(upVector.clone().multiplyScalar(dirToSpawn.dot(upVector))).normalize();
      
      // Mix with current direction
      this.direction.add(dirToSpawn);
      this.direction.normalize();
      
      // Project again to ensure we stay on the surface
      this.direction.sub(upVector.clone().multiplyScalar(this.direction.dot(upVector))).normalize();
    }
  }
  
  // ADDED: Make hit detection much more reliable
  hit(appleType, hitArea = 'body') {
    if (!this.alive) return false;
    
    // Increment hit counter for the specific apple type and area
    this.hits[hitArea][appleType]++;
    
    // Get damage threshold
    const requiredHits = this.config.damage[appleType][hitArea];
    const currentHits = this.hits[hitArea][appleType];
    
    // Create hit effect
    this.createHitEffect(hitArea);
    
    // ADDED: Always show hit feedback
    console.log(`Deer hit on ${hitArea} with ${appleType} apple: ${currentHits}/${requiredHits}`);
    
    // Check if deer should die
    if (currentHits >= requiredHits) {
      this.die();
      return true; // Deer died from this hit
    }
    
    return false; // Deer survived this hit
  }
  
  createHitEffect(hitArea = 'body') {
    // Flash the body part
    const mesh = hitArea === 'head' ? this.head : this.body;
    const originalColor = mesh.material.color.clone();
    
    // Flash to white
    mesh.material.color.set(0xffffff);
    
    // Create impact particles from the hit area
    this.createImpactParticles(
      hitArea === 'head' ? this.head.position.clone() : this.body.position.clone()
    );
    
    // Create hit marker
    this.createHitMarker(
      hitArea === 'head' ? this.head.position.clone() : this.body.position.clone()
    );
    
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
    
    // Create small particles that fly out from impact
    for (let i = 0; i < particleCount; i++) {
      const particleGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const particleMat = new THREE.MeshBasicMaterial({ color: 0xBB4444 });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      
      // Position at impact point
      particle.position.copy(position);
      
      // Random velocity outward
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2, // More upward bias
        (Math.random() - 0.5) * 2
      );
      particle.userData.velocity = velocity;
      
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
          
          // Add gravity
          particle.userData.velocity.y -= 0.01;
          
          // Fade out
          particle.material.opacity = 1.0 - progress;
          particle.material.transparent = true;
        });
        
        requestAnimationFrame(animateParticles);
      } else {
        // Remove particles when done
        this.scene.remove(particles);
      }
    };
    
    requestAnimationFrame(animateParticles);
  }
  
  createHitMarker(position) {
    // Create a hit marker to show where the hit occurred
    const markerSize = 1.2;
    const markerGroup = new THREE.Group();
    
    // Create a "X" shape for the hit marker
    const createLine = (start, end, color) => {
      const points = [start, end];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: color,
        linewidth: 3,
        transparent: true,
        opacity: 1.0
      });
      return new THREE.Line(geometry, material);
    };
    
    // Create an X shape
    const line1 = createLine(
      new THREE.Vector3(-markerSize, -markerSize, 0),
      new THREE.Vector3(markerSize, markerSize, 0),
      0xff0000
    );
    
    const line2 = createLine(
      new THREE.Vector3(-markerSize, markerSize, 0),
      new THREE.Vector3(markerSize, -markerSize, 0),
      0xff0000
    );
    
    // Add to marker group
    markerGroup.add(line1);
    markerGroup.add(line2);
    
    // Position at the deer's body center, but slightly above
    const worldPos = this.body.getWorldPosition(new THREE.Vector3());
    worldPos.y += 5; // Raise marker above deer
    
    markerGroup.position.copy(worldPos);
    
    // Make marker always face camera if there is one
    if (this.scene.camera) {
      markerGroup.lookAt(this.scene.camera.position);
    }
    
    // Add to scene
    this.scene.add(markerGroup);
    
    // Animate marker
    const startTime = Date.now();
    const duration = 1000; // 1 second
    
    const animateMarker = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1.0) {
        // Scale up marker
        const scale = 1.0 + progress * 0.5;
        markerGroup.scale.set(scale, scale, scale);
        
        // Fade out marker
        markerGroup.children.forEach(child => {
          child.material.opacity = 1.0 - progress;
        });
        
        requestAnimationFrame(animateMarker);
      } else {
        // Remove marker when animation is complete
        this.scene.remove(markerGroup);
      }
    };
    
    requestAnimationFrame(animateMarker);
  }
  
  die() {
    this.alive = false;
    console.log("Deer killed!");
    
    // Play death effect
    this.createDeathEffect();
    
    // Schedule respawn if desired
    if (this.config.respawnTime) {
      setTimeout(() => this.respawn(), this.config.respawnTime);
    }
  }
  
  createDeathEffect() {
    // Change color to indicate death
    this.body.material.color.set(0x5D0000);
    this.head.material.color.set(0x5D0000);
    
    // Create blood particles
    this.createBloodSplatter();
    
    // Animate falling over
    this.animateDeath();
  }
  
  createBloodSplatter() {
    const particleCount = 15;
    const particles = new THREE.Group();
    
    // Get world position
    const worldPos = this.body.getWorldPosition(new THREE.Vector3());
    
    for (let i = 0; i < particleCount; i++) {
      const size = 0.2 + Math.random() * 0.4;
      const particleGeo = new THREE.BoxGeometry(size, size, size);
      const particleMat = new THREE.MeshBasicMaterial({ 
        color: 0xAA0000,
        transparent: true,
        opacity: 0.8
      });
      
      const particle = new THREE.Mesh(particleGeo, particleMat);
      particle.position.copy(worldPos);
      
      // Random velocity, mostly sideways and a bit upward
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.5,
        (Math.random() - 0.5) * 2
      );
      
      particles.add(particle);
    }
    
    this.scene.add(particles);
    
    // Animate particles
    const startTime = Date.now();
    const duration = 1500;
    
    const animateParticles = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1.0) {
        particles.children.forEach(particle => {
          // Move based on velocity
          particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.15));
          
          // Apply gravity
          particle.userData.velocity.y -= 0.02;
          
          // Fade out near end
          if (progress > 0.7) {
            particle.material.opacity = 0.8 * (1 - (progress - 0.7) / 0.3);
          }
        });
        
        requestAnimationFrame(animateParticles);
      } else {
        this.scene.remove(particles);
      }
    };
    
    requestAnimationFrame(animateParticles);
  }
  
  animateDeath() {
    // Fall over sideways
    const fallDuration = 1000;
    const startRotation = this.group.rotation.z;
    const startPosition = this.group.position.y;
    const fallDirection = Math.random() > 0.5 ? 1 : -1; // Fall left or right
    const startTime = Date.now();
    
    const animateFall = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / fallDuration, 1.0);
      
      // Rotate to fall over
      this.group.rotation.z = startRotation + fallDirection * (Math.PI/2) * progress;
      
      // Lower slightly into ground
      this.group.position.y = startPosition - progress * 1.0;
      
      if (progress < 1.0) {
        requestAnimationFrame(animateFall);
      } else {
        // Fully fallen
        setTimeout(() => {
          // Hide deer after a delay
          this.group.visible = false;
        }, 5000);
      }
    };
    
    requestAnimationFrame(animateFall);
  }
  
  respawn() {
    // Reset state
    this.alive = true;
    // FIX: Reset both head and body hit counters
    this.hits = {
      body: { red: 0, yellow: 0, green: 0 },
      head: { red: 0, yellow: 0, green: 0 }
    };
    this.currentState = 'wander';
    this.targetApple = null;
    
    // Reset appearance
    const colorScheme = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
    this.body.material.color.set(colorScheme.body);
    this.head.material.color.set(colorScheme.body);
    
    // Reset position - either at original spawn or a new position
    if (Math.random() < 0.5 && this.spawnPosition) {
      this.group.position.copy(this.spawnPosition);
    } else {
      this.randomizePosition();
    }
    
    // Reset rotation
    this.group.rotation.set(0, 0, 0);
    
    // Show deer again
    this.group.visible = true;
    
    console.log("Deer respawned");
  }
  
  getPosition() {
    return this.group.position.clone();
  }
  
  getCollisionRadius() {
    return 5.0 * Math.max(this.group.scale.x, this.group.scale.y, this.group.scale.z);
  }
  
  getBodyPosition() {
    return this.body.getWorldPosition(new THREE.Vector3());
  }
  
  getHeadPosition() {
    return this.head.getWorldPosition(new THREE.Vector3());
  }
  
  getBodyRadius() {
    return 5.0 * Math.max(this.group.scale.x, this.group.scale.y, this.group.scale.z);
  }
  
  getHeadRadius() {
    return 3.0 * Math.max(this.group.scale.x, this.group.scale.y, this.group.scale.z);
  }
  
  cleanup() {
    if (this.scene && this.group) {
      this.scene.remove(this.group);
    }
  }
  
  // NEW: Check if the deer would collide with any world objects at the given position
  _checkCollisions(position) {
    // Skip if we don't have collidables
    if (!this.config.collidables || this.config.collidables.length < 1) return false;
    
    const deerDir = position.clone().normalize();
    const deerRadius = this.getCollisionRadius() * 0.8; // Slightly smaller radius for smoother movement
    
    // Check against all collidable objects (trees, rocks, etc.)
    for (let i = 1; i < this.config.collidables.length; i++) {
      const obj = this.config.collidables[i];
      
      // Skip invalid objects or planet itself
      if (!obj.direction || !obj.position) continue;
      
      // Skip if the object has the noCollision flag
      if (obj.noCollision) continue;
      
      // Calculate angular distance (great-circle distance on sphere)
      const objDir = obj.direction;
      const dot = deerDir.dot(objDir);
      const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
      
      // Convert to surface distance
      const sphereRadius = 400; // Base planet radius
      const surfaceDist = angle * sphereRadius;
      
      // Get combined collision radius
      let collisionRadius = deerRadius + (obj.radius || 1.0);
      
      // Special handling for trees
      if (obj.mesh?.userData?.isTree || obj.mesh?.userData?.isPineTree) {
        // Use a smaller collision radius for trees to allow walking between them
        collisionRadius = deerRadius + Math.min(2.0, obj.radius * 0.4);
        
        // Skip collision if height difference is too great (to allow walking under foliage)
        const deerHeight = position.length() - sphereRadius;
        const objHeight = obj.position.length() - sphereRadius;
        const heightDiff = Math.abs(deerHeight - objHeight);
        
        if (heightDiff > 5) { // If deer and tree trunk base are at different heights
          continue; // Skip collision
        }
      }
      
      // Check if collision occurs
      if (surfaceDist < collisionRadius) {
        return true; // Collision detected
      }
    }
    
    return false; // No collision
  }
  
  // NEW: Change direction to avoid obstacles
  _avoidObstacle() {
    // Get the current up vector (perpendicular to ground)
    const upVector = this.group.position.clone().normalize();
    
    // Generate a new random direction
    const newDir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    
    // Project onto the tangent plane to keep moving along the surface
    newDir.sub(upVector.clone().multiplyScalar(newDir.dot(upVector))).normalize();
    
    // Set as the new direction with a randomized angle
    this.direction = newDir;
    this.lastDirectionChange = Date.now();
  }
  
  // NEW: More intelligent navigation around obstacles when seeking apples
  _navigateAroundObstacle(targetPosition) {
    // Get the current up vector
    const upVector = this.group.position.clone().normalize();
    
    // Calculate direction to target
    const dirToTarget = targetPosition.clone().sub(this.group.position).normalize();
    
    // Generate a perpendicular direction to try to go around the obstacle
    // Use cross product with up vector to get a direction perpendicular to both up and target direction
    const perpDir = new THREE.Vector3().crossVectors(upVector, dirToTarget).normalize();
    
    // Randomly choose left or right to go around obstacle
    if (Math.random() > 0.5) {
      perpDir.negate();
    }
    
    // Mix perpendicular direction with some of the original target direction
    this.direction.copy(perpDir).multiplyScalar(0.8);
    this.direction.add(dirToTarget.multiplyScalar(0.2));
    this.direction.normalize();
    
    // Project onto tangent plane
    this.direction.sub(upVector.clone().multiplyScalar(this.direction.dot(upVector))).normalize();
    
    // Apply a small impulse in the new direction to get unstuck
    const moveImpulse = this.direction.clone().multiplyScalar(2.0);
    this.group.position.add(moveImpulse);
    
    // Reset direction change timer
    this.lastDirectionChange = Date.now();
  }

  updatePositions() {
    // Update body and head positions based on their world positions
    this.body.getWorldPosition(this.bodyPosition);
    this.head.getWorldPosition(this.headPosition);
  }

  checkCollision(apple) {
    if (!this.alive) return false;

    // Calculate distance to the apple
    const applePosition = apple.mesh.position;
    const bodyDistance = this.bodyPosition.distanceTo(applePosition);
    const headDistance = this.headPosition.distanceTo(applePosition);

    // Get the current radius values using the methods
    const bodyRadius = this.getBodyRadius();
    const headRadius = this.getHeadRadius();

    // Check collision with body
    if (bodyDistance <= bodyRadius) {
      const killed = this.hit(apple.type, 'body');
      return true;
    }

    // Check collision with head
    if (headDistance <= headRadius) {
      const killed = this.hit(apple.type, 'head');
      return true;
    }

    return false;
  }

  checkPlayerCollision(player) {
    if (!this.alive) return false;

    // Get player's position and collision radius
    const playerPosition = player.getPosition();
    const playerRadius = player.getCollisionRadius();

    // Get the current radius values using the methods
    const bodyRadius = this.getBodyRadius();
    const headRadius = this.getHeadRadius();

    // Calculate distances to the deer's body and head
    const bodyDistance = this.bodyPosition.distanceTo(playerPosition);
    const headDistance = this.headPosition.distanceTo(playerPosition);

    // Check collision with body
    if (bodyDistance <= bodyRadius + playerRadius) {
        // Prevent player from walking through the deer
        const collisionNormal = playerPosition.clone().sub(this.bodyPosition).normalize();
        const penetrationDepth = bodyRadius + playerRadius - bodyDistance;
        player.position.add(collisionNormal.multiplyScalar(penetrationDepth));
        return true;
    }

    // Check collision with head
    if (headDistance <= headRadius + playerRadius) {
        // Prevent player from walking through the deer
        const collisionNormal = playerPosition.clone().sub(this.headPosition).normalize();
        const penetrationDepth = headRadius + playerRadius - headDistance;
        player.position.add(collisionNormal.multiplyScalar(penetrationDepth));
        return true;
    }

    return false;
  }
}

// Main deer system class to manage all deer
export class DeerSystem {
  constructor(scene, terrain, config) {
    this.scene = scene;
    this.terrain = terrain;
    this.config = { ...DEER_CONFIG, ...config };
    this.deer = [];
    this.apples = [];
  }
  
  init() {
    // Clear any existing deer
    this.cleanup();
    
    // Create new deer
    for (let i = 0; i < this.config.count; i++) {
      this.deer.push(new Deer(this.scene, this.terrain, this.config));
    }
    
    console.log(`Spawned ${this.deer.length} deer`);
    return this.deer;
  }
  
  update(deltaTime) {
    // Update all deer
    this.deer.forEach(deer => {
      deer.update(deltaTime, this.apples);
      deer.updatePositions(); // Ensure positions are updated
    });

    // Remove eaten apples from the list
    this.apples = this.apples.filter(apple => !apple.isEaten);
  }
  
  trackApple(apple) {
    // Add apple to the list of tracked apples
    if (apple && apple.mesh) {
      this.apples.push(apple);
    }
  }
  
  checkCollision(projectile) {
    if (!projectile || !projectile.mesh || !projectile.velocity) return false;
    
    // FIXED: Enhanced collision detection
    // Get projectile position and previous position
    const projectilePos = projectile.mesh.position.clone();
    
    // Calculate previous position based on velocity - use a longer trail for faster projectiles
    const velocityLength = projectile.velocity.length();
    const trailFactor = Math.max(2.0, Math.min(10.0, velocityLength * 15));
    const velocityNormalized = projectile.velocity.clone().normalize();
    const projectilePrevPos = projectilePos.clone().sub(
      velocityNormalized.multiplyScalar(trailFactor)
    );
    
    // FIXED: Use a larger collision radius for better hit detection
    const projectileRadius = (projectile.radius || 1.0) * 2.5;
    const projectileType = projectile.type || 'red';
    
    // Check collision with each deer
    for (const deer of this.deer) {
      if (!deer.alive) continue;
      
      // Check head collision first (higher priority)
      const headPos = deer.getHeadPosition();
      const headRadius = deer.getHeadRadius() * 1.5;
      
      if (this.lineSegmentSphereIntersection(
          projectilePrevPos, projectilePos, headPos, headRadius + projectileRadius)) {
        // Head hit!
        const killed = deer.hit(projectileType, 'head');
        
        return {
          hit: true,
          killed: killed,
          position: headPos,
          deer: deer,
          hitArea: 'head',
          hitTerrain: false
        };
      }
      
      // Then check body collision
      const bodyPos = deer.getBodyPosition();
      const bodyRadius = deer.getBodyRadius() * 1.5;
      
      if (this.lineSegmentSphereIntersection(
          projectilePrevPos, projectilePos, bodyPos, bodyRadius + projectileRadius)) {
        // Body hit!
        const killed = deer.hit(projectileType, 'body');
        
        return {
          hit: true,
          killed: killed,
          position: bodyPos,
          deer: deer,
          hitArea: 'body',
          hitTerrain: false
        };
      }
    }
    
    return false;
  }
  
  // Helper method to detect intersection between a line segment and a sphere
  lineSegmentSphereIntersection(lineStart, lineEnd, sphereCenter, sphereRadius) {
    // FIXED: Made collision detection more generous
    
    // Simple distance check first for optimization
    if (sphereCenter.distanceTo(lineStart) <= sphereRadius || 
        sphereCenter.distanceTo(lineEnd) <= sphereRadius) {
      return true;
    }
    
    // Vector from start point to sphere center
    const lineToSphere = new THREE.Vector3().subVectors(sphereCenter, lineStart);
    
    // Direction of line segment
    const lineDirection = new THREE.Vector3().subVectors(lineEnd, lineStart);
    const lineLength = lineDirection.length();
    
    // Avoid division by zero for very short line segments
    if (lineLength < 0.0001) {
      return lineStart.distanceTo(sphereCenter) <= sphereRadius;
    }
    
    lineDirection.normalize();
    const projection = lineToSphere.dot(lineDirection);
    
    // Find closest point on line segment to sphere center
    let closestPoint;
    
    // If projection is negative, closest point is line start
    if (projection < 0) {
      closestPoint = lineStart;
    } 
    // If projection is greater than line length, closest point is line end
    else if (projection > lineLength) {
      closestPoint = lineEnd;
    } 
    // Otherwise, closest point is along the line
    else {
      closestPoint = lineStart.clone().add(lineDirection.clone().multiplyScalar(projection));
    }
    
    // Distance from closest point to sphere center
    const distance = closestPoint.distanceTo(sphereCenter);
    
    // If distance is less than sphere radius, there's a collision
    return distance <= sphereRadius;
  }
  
  cleanup() {
    this.deer.forEach(deer => deer.cleanup());
    this.deer = [];
    this.apples = [];
  }
  
  // Get a deer by index
  getDeer(index) {
    if (index >= 0 && index < this.deer.length) {
      return this.deer[index];
    }
    return null;
  }
  
  // Get count of currently alive deer
  getAliveDeerCount() {
    return this.deer.filter(deer => deer.alive).length;
  }
  
  // ADDED: Debug method to show deer positions
  showDeerInfo() {
    return this.deer.map((deer, index) => ({
      index,
      position: deer.group.position.toArray(),
      alive: deer.alive,
      onGround: deer.group.position.length() > 400 // Check if above planet surface
    }));
  }
}

// Helper functions for external use
export function createDeerSystem(scene, terrain, config) {
  // Create deer system with collidables for collision detection
  const deerSystem = new DeerSystem(scene, terrain, {
    ...config,
    // Ensure we have collidables for collision detection
    collidables: window.collidables || config?.collidables || []
  });
  
  deerSystem.init();
  
  // ADDED: Force deer to move significantly from their starting positions
  // This gives them an initial push to spread out
  deerSystem.deer.forEach(deer => {
    // Generate a random direction for initial movement
    const randomDir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1, 
      Math.random() * 2 - 1
    ).normalize();
    
    // Project onto tangent plane
    const up = deer.group.position.clone().normalize();
    randomDir.sub(up.clone().multiplyScalar(randomDir.dot(up))).normalize();
    
    // Set as deer's direction and force a significant movement
    deer.direction = randomDir;
    const initialMove = randomDir.clone().multiplyScalar(10.0); // Large initial movement
    deer.group.position.add(initialMove);
    deer.stayOnGround(); // Ensure they're on the terrain
  });
  
  return deerSystem;
}
