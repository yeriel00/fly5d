/**
 * Ultra-simplified apple solution that:
 * 1. Immediately places visible apples on the OUTSIDE of LP trees
 * 2. Uses zero animations to maximize performance
 * 3. Makes collection work without any complex system
 */
import * as THREE from 'three';

(function() {
  console.log("🍎 INSTANT APPLE SYSTEM LOADING");
  
  // Run when scene is ready
  setTimeout(initApples, 2000);
  
  function initApples() {
    console.log("🍎 INITIALIZING INSTANT APPLES");
    
    if (!window.scene || !window.collidables) {
      console.log("Scene not ready yet, waiting...");
      setTimeout(initApples, 1000);
      return;
    }
    
    // First disable any existing apple systems
    disableExistingAppleSystems();
    
    // Then create our ultra simple apples
    createUltraSimpleApples();
    
    // Give player inventory apples
    givePlayerApples();
  }
  
  /**
   * Disable any existing apple systems to prevent performance impact
   */
  function disableExistingAppleSystems() {
    // Approach 1: Nullify the update function
    if (window.appleSystem) {
      console.log("Disabling existing apple system");
      window.appleSystem.update = () => {}; // Do nothing
      window.appleSystem._updateApples = () => {}; // Do nothing
      
      // Clear any existing apples
      if (window.appleSystem.groundApples) {
        window.appleSystem.groundApples.forEach(apple => {
          if (apple.mesh && window.scene.contains(apple.mesh)) {
            window.scene.remove(apple.mesh);
          }
        });
        window.appleSystem.groundApples = [];
      }
      
      // Prevent growth
      if (window.appleSystem.options) {
        window.appleSystem.options.growthProbability = 0;
      }
    }
    
    // Approach 2: Kill animation frames for other apple systems
    if (window.appleEnhancer) {
      if (window.appleEnhancer.growthAnimationId) {
        cancelAnimationFrame(window.appleEnhancer.growthAnimationId);
      }
      if (window.appleEnhancer.bobbingAnimationId) {
        cancelAnimationFrame(window.appleEnhancer.bobbingAnimationId);
      }
    }
    
    console.log("✓ Existing apple systems disabled");
  }
  
  /**
   * Create ultra-simple visible apples on LP trees
   */
  function createUltraSimpleApples() {
    // Find all LP trees (non-pine trees)
    const lpTrees = window.collidables.filter(obj => 
      obj.mesh?.userData?.isTree === true && 
      obj.mesh?.userData?.isPineTree !== true
    );
    
    if (lpTrees.length === 0) {
      console.log("❌ No LP trees found!");
      return;
    }
    
    console.log(`Found ${lpTrees.length} LP trees for apple placement`);
    
    // Reference to created apples for collection
    const createdApples = [];
    window.instantApples = createdApples;
    
    // Create a material for each apple type
    const materials = {
      red: new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0x330000,
        emissiveIntensity: 0.3,
        roughness: 0.7,
        metalness: 0.1
      }),
      yellow: new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0x332200,
        emissiveIntensity: 0.3,
        roughness: 0.7,
        metalness: 0.1
      }),
      green: new THREE.MeshStandardMaterial({
        color: 0x33cc33,
        emissive: 0x003300,
        emissiveIntensity: 0.5,
        roughness: 0.7,
        metalness: 0.1
      })
    };
    
    // Configure type distribution and properties
    const appleTypes = {
      red: { 
        probability: 0.87,
        damage: 1,
        ammo: 3
      },
      yellow: { 
        probability: 0.12,
        damage: 3,
        ammo: 2
      },
      green: { 
        probability: 0.01,
        damage: 20,
        ammo: 1
      }
    };
    
    // Helper to get random apple type based on rarity
    function getRandomAppleType() {
      const rand = Math.random();
      if (rand < appleTypes.green.probability) return "green";
      if (rand < appleTypes.green.probability + appleTypes.yellow.probability) return "yellow";
      return "red";
    }
    
    // Helper to create apple directly on tree
    function createAppleOnTree(tree) {
      // Get tree position and direction
      const treePos = tree.position.clone();
      const treeDir = treePos.clone().normalize();
      
      // Calculate tree dimensions
      const treeHeight = tree.collisionHeight || 40;
      const treeRadius = tree.radius || 10;
      
      // Calculate apple position on OUTSIDE of foliage
      // Generate random point above trunk
      const angle1 = Math.random() * Math.PI * 2; // Around tree
      const angle2 = Math.random() * Math.PI * 0.5; // Upper hemisphere
      
      // Create direction vector in tree's space
      const offsetDir = new THREE.Vector3(
        Math.sin(angle2) * Math.cos(angle1),
        Math.cos(angle2), // Bias upward
        Math.sin(angle2) * Math.sin(angle1)
      ).normalize();
      
      // Position based on tree height and radius
      const heightOffset = treeHeight * 0.4 + Math.random() * (treeHeight * 0.3);
      const radiusOffset = treeRadius * 0.8; // Always on OUTSIDE of foliage
      
      // Calculate final position
      const applePos = treePos.clone()
        .add(treeDir.clone().multiplyScalar(heightOffset)) // Up tree trunk
        .add(offsetDir.clone().multiplyScalar(radiusOffset)); // Out to surface
      
      // Determine apple type based on rarity
      const type = getRandomAppleType();
      
      // Create visible apple
      const geometry = new THREE.SphereGeometry(7, 12, 10); // Larger and lower poly for performance
      const appleMesh = new THREE.Mesh(geometry, materials[type]);
      
      // Position at calculated spot
      appleMesh.position.copy(applePos);
      
      // Store metadata
      appleMesh.userData = {
        isApple: true,
        type: type,
        damage: appleTypes[type].damage,
        ammoValue: appleTypes[type].ammo
      };
      
      // Add to scene
      window.scene.add(appleMesh);
      
      // Add to tracking array
      createdApples.push({
        mesh: appleMesh,
        position: applePos.clone(),
        type: type
      });
      
      return appleMesh;
    }
    
    // Create apples on trees - limit total for performance
    const applesPerTree = 2; // Average apples per tree
    const maxTotalApples = 20; // Hard limit
    
    let totalCreated = 0;
    
    // Create apples on LP trees
    lpTrees.forEach(tree => {
      if (totalCreated >= maxTotalApples) return;
      
      // Randomize count per tree (0-3)
      const applesForThisTree = Math.floor(Math.random() * (applesPerTree + 1));
      
      for (let i = 0; i < applesForThisTree; i++) {
        if (totalCreated >= maxTotalApples) return;
        
        createAppleOnTree(tree);
        totalCreated++;
      }
    });
    
    console.log(`✅ Created ${totalCreated} visible apples on tree exteriors`);
    
    // Add ground apples
    const groundAppleCount = Math.min(5, maxTotalApples - totalCreated);
    createGroundApples(groundAppleCount);
    
    // Setup collection checking
    setupAppleCollection();
  }
  
  /**
   * Create apples directly on ground
   */
  function createGroundApples(count) {
    if (!window.scene) return 0;
    
    // Get reference to instant apples array
    const createdApples = window.instantApples || [];
    
    // Materials already defined in createUltraSimpleApples
    const materials = {
      red: new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0x330000,
        emissiveIntensity: 0.3
      }),
      yellow: new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0x332200, 
        emissiveIntensity: 0.3
      }),
      green: new THREE.MeshStandardMaterial({
        color: 0x33cc33,
        emissive: 0x003300,
        emissiveIntensity: 0.5
      })
    };
    
    let created = 0;
    for (let i = 0; i < count; i++) {
      // Random position on sphere
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1, 
        Math.random() * 2 - 1
      ).normalize();
      
      // Position on ground
      const planetRadius = 400;
      const pos = dir.clone().multiplyScalar(planetRadius + 5); // 5 units above ground
      
      // Random type (mostly red)
      const type = Math.random() < 0.95 ? "red" : (Math.random() < 0.9 ? "yellow" : "green");
      
      // Create mesh
      const geometry = new THREE.SphereGeometry(7, 12, 10);
      const appleMesh = new THREE.Mesh(geometry, materials[type]);
      
      // Position
      appleMesh.position.copy(pos);
      
      // Store metadata
      appleMesh.userData = {
        isApple: true,
        type: type,
        damage: type === "green" ? 20 : (type === "yellow" ? 3 : 1),
        ammoValue: type === "green" ? 1 : (type === "yellow" ? 2 : 3)
      };
      
      // Add to scene
      window.scene.add(appleMesh);
      
      // Add to tracking array
      createdApples.push({
        mesh: appleMesh,
        position: pos.clone(),
        type: type
      });
      
      created++;
    }
    
    console.log(`✅ Created ${created} apples on ground`);
    return created;
  }
  
  /**
   * Setup apple collection functionality
   */
  function setupAppleCollection() {
    if (!window.instantApples) return;
    
    // Set up the collection check loop
    let lastCheckTime = Date.now();
    const checkInterval = 500; // Check every 500ms for performance
    
    function checkAppleCollection() {
      if (!window.player || !window.player.playerObject) return;
      
      const now = Date.now();
      
      // Only check at interval - this helps performance
      if (now - lastCheckTime < checkInterval) {
        requestAnimationFrame(checkAppleCollection);
        return;
      }
      
      lastCheckTime = now;
      
      // Get player position
      const playerPos = window.player.playerObject.position;
      const collectionRadius = 5; // Units
      
      // Check each apple
      const apples = window.instantApples;
      for (let i = apples.length - 1; i >= 0; i--) {
        const apple = apples[i];
        if (!apple.mesh || !apple.position) continue;
        
        const distanceToPlayer = playerPos.distanceTo(apple.position);
        
        // If player is close enough, collect the apple
        if (distanceToPlayer <= collectionRadius) {
          // Add to player's ammo
          if (window.player.addAmmo) {
            const ammoValue = apple.mesh.userData.ammoValue || 3;
            window.player.addAmmo('apple', ammoValue);
            console.log(`Collected ${apple.type} apple: +${ammoValue} apple ammo`);
          }
          
          // Remove from scene and list
          if (window.scene.contains(apple.mesh)) {
            window.scene.remove(apple.mesh);
            
            // Dispose geometry
            if (apple.mesh.geometry) {
              apple.mesh.geometry.dispose();
            }
          }
          
          // Remove from array
          apples.splice(i, 1);
        }
      }
      
      // Continue collection check loop
      requestAnimationFrame(checkAppleCollection);
    }
    
    // Start collection check loop
    requestAnimationFrame(checkAppleCollection);
    
    console.log("✅ Apple collection system enabled");
  }
  
  /**
   * Give player starting apples
   */
  function givePlayerApples() {
    if (window.player && window.player.addAmmo) {
      window.player.addAmmo('apple', 30);
      console.log("✅ Gave player 30 apple ammo");
    }
  }
  
  /**
   * Interface for manual apple creation
   */
  window.addMoreApples = function(count = 5) {
    const treeCount = Math.ceil(count * 0.7);
    const groundCount = count - treeCount;
    
    // Need to reimplement the apple creation logic here
    // since it's inside an IIFE
    if (!window.scene || !window.collidables) {
      return "Scene not ready";
    }
    
    // Find LP trees again
    const lpTrees = window.collidables.filter(obj => 
      obj.mesh?.userData?.isTree === true && 
      obj.mesh?.userData?.isPineTree !== true
    );
    
    if (lpTrees.length === 0) {
      return "No LP trees found";
    }
    
    // Materials
    const materials = {
      red: new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0x330000,
        emissiveIntensity: 0.3
      }),
      yellow: new THREE.MeshStandardMaterial({
        color: 0xffcc00, 
        emissive: 0x332200,
        emissiveIntensity: 0.3
      }),
      green: new THREE.MeshStandardMaterial({
        color: 0x33cc33,
        emissive: 0x003300, 
        emissiveIntensity: 0.5
      })
    };
    
    // Create tree apples
    let created = 0;
    for (let i = 0; i < treeCount; i++) {
      // Pick random tree
      const tree = lpTrees[Math.floor(Math.random() * lpTrees.length)];
      
      // Position calculation
      const treePos = tree.position.clone();
      const treeDir = treePos.clone().normalize();
      const treeHeight = tree.collisionHeight || 40;
      const treeRadius = tree.radius || 10;
      
      // Random direction bias toward up
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.7,
        Math.random() - 0.5
      ).normalize();
      
      // Calculate position
      const applePos = treePos.clone()
        .add(treeDir.clone().multiplyScalar(treeHeight * 0.6))
        .add(dir.clone().multiplyScalar(treeRadius * 0.9));
      
      // Random type (mostly red)
      const type = Math.random() < 0.9 ? "red" : (Math.random() < 0.9 ? "yellow" : "green");
      
      // Create mesh
      const geometry = new THREE.SphereGeometry(7, 12, 10);
      const appleMesh = new THREE.Mesh(geometry, materials[type]);
      
      // Position
      appleMesh.position.copy(applePos);
      
      // Add to scene
      window.scene.add(appleMesh);
      
      // Add to tracking array
      if (!window.instantApples) window.instantApples = [];
      window.instantApples.push({
        mesh: appleMesh,
        position: applePos.clone(),
        type: type
      });
      
      created++;
    }
    
    // Create ground apples
    if (groundCount > 0) {
      const groundCreated = createGroundApples(groundCount);
      created += groundCreated;
    }
    
    return `Created ${created} new apples`;
  };
  
  /**
   * Create apple above player
   */
  window.appleAbovePlayer = function() {
    if (!window.player || !window.player.playerObject) {
      return "Player not available";
    }
    
    // Get player position
    const playerPos = window.player.playerObject.position.clone();
    const dir = playerPos.clone().normalize();
    
    // Calculate position above player
    const applePos = playerPos.clone().add(dir.clone().multiplyScalar(30));
    
    // Create bright red apple
    const geometry = new THREE.SphereGeometry(10, 16, 12); // Extra large
    const material = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0x550000,
      emissiveIntensity: 0.5
    });
    
    const appleMesh = new THREE.Mesh(geometry, material);
    appleMesh.position.copy(applePos);
    
    // Add to scene
    window.scene.add(appleMesh);
    
    // Add to tracking array
    if (!window.instantApples) window.instantApples = [];
    window.instantApples.push({
      mesh: appleMesh,
      position: applePos.clone(),
      type: "red"
    });
    
    return "Created large apple above player";
  };
  
  // Alert user about available commands
  console.log(`
  // *****************************************
  // ***** ULTRA SIMPLE APPLE COMMANDS *****
  // *****************************************
  addMoreApples(5)       // Create 5 new apples
  appleAbovePlayer()     // Create large apple above player
  `);
})();
