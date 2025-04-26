/**
 * DIRECT APPLE FIX
 * Diagnoses and fixes apple visibility issues by directly working with
 * the existing apple system and LP trees
 */

(function() {
  console.log("🔍 Diagnosing apple system...");
  
  // Track if we've already applied the fix
  let fixApplied = false;
  
  /**
   * Run diagnostics on the apple system
   * @returns {Object} Diagnostic results
   */
  function diagnoseAppleSystem() {
    const results = {
      appleSystemFound: false,
      appleTreesFound: false,
      growthPointsFound: false,
      lpTreesFound: false,
      lpTreeCount: 0,
      appleCount: 0,
      growingApples: 0,
      ripeApples: 0,
      groundApples: 0,
      issues: []
    };
    
    // Check if apple system exists
    if (!window.appleSystem) {
      results.issues.push("Apple system not found in global scope");
      return results;
    }
    
    results.appleSystemFound = true;
    const appleSystem = window.appleSystem;
    
    // Check for trees in apple system
    if (!appleSystem.trees || appleSystem.trees.length === 0) {
      results.issues.push("No trees found in apple system");
    } else {
      results.appleTreesFound = true;
      results.appleTreeCount = appleSystem.trees.length;
    }
    
    // Check for growth points
    if (!appleSystem.growthPoints) {
      results.issues.push("No growth points found in apple system");
    } else {
      results.growthPointsFound = true;
      
      // Count total growth points
      let growthPointCount = 0;
      Object.values(appleSystem.growthPoints).forEach(points => {
        growthPointCount += points.length;
      });
      results.growthPointCount = growthPointCount;
      
      // Count apples in different states
      Object.values(appleSystem.growthPoints).forEach(points => {
        points.forEach(point => {
          if (point.hasApple) {
            results.growingApples++;
            if (point.growthProgress >= 1.0) {
              results.ripeApples++;
            }
          }
        });
      });
    }
    
    // Check for ground apples
    if (appleSystem.groundApples) {
      results.groundApples = appleSystem.groundApples.length;
    }
    
    // Count total apples
    results.appleCount = results.growingApples + results.groundApples;
    
    // Check for LP trees specifically
    if (window.collidables) {
      const lpTrees = window.collidables.filter(obj => 
        obj.mesh?.userData?.isTree === true && 
        obj.mesh?.userData?.isPineTree !== true
      );
      
      results.lpTreesFound = lpTrees.length > 0;
      results.lpTreeCount = lpTrees.length;
      
      if (lpTrees.length === 0) {
        results.issues.push("No LP trees found in collidables");
      }
    }
    
    // Check apple system options for potential issues
    if (appleSystem.options) {
      // Check if growth is too slow or impossible
      if (appleSystem.options.growthProbability < 0.001) {
        results.issues.push(`Growth probability too low: ${appleSystem.options.growthProbability}`);
      }
      
      // Check if max apples per tree is set to 0
      if (appleSystem.options.maxApplesPerTree < 1) {
        results.issues.push(`Maximum apples per tree is ${appleSystem.options.maxApplesPerTree} (should be >= 1)`);
      }
      
      // Check if apples take too long to grow
      if (appleSystem.options.growthTime > 300) {
        results.issues.push(`Growth time is extremely long: ${appleSystem.options.growthTime} seconds`);
      }
    }
    
    return results;
  }
  
  /**
   * Apply direct fixes to the apple system
   * @returns {Object} Results of the fix
   */
  function applyDirectFix() {
    if (fixApplied) {
      console.log("Apple fix already applied - skipping.");
      return { alreadyApplied: true };
    }
    
    console.log("🛠 Applying direct apple fix...");
    
    const fixes = {
      appleSystemFixed: false,
      growthPointsFixed: false,
      treesConnected: false,
      applesCreated: 0,
      applesRipened: 0
    };
    
    if (!window.appleSystem) {
      console.error("Cannot apply fix - apple system not found");
      return fixes;
    }
    
    const appleSystem = window.appleSystem;
    
    // Fix 1: Connect LP trees to apple system if needed
    if ((!appleSystem.trees || appleSystem.trees.length === 0) && window.collidables) {
      const lpTrees = window.collidables.filter(obj => 
        obj.mesh?.userData?.isTree === true && 
        obj.mesh?.userData?.isPineTree !== true
      );
      
      if (lpTrees.length > 0) {
        // Set trees directly
        appleSystem.trees = lpTrees;
        console.log(`✅ Connected ${lpTrees.length} LP trees to apple system`);
        fixes.treesConnected = true;
      }
    }
    
    // Fix 2: Fix growth points if none exist
    if (!appleSystem.growthPoints || Object.keys(appleSystem.growthPoints).length === 0) {
      // Recreate growth points if the function exists
      if (typeof appleSystem._generateGrowthPoints === 'function') {
        appleSystem._generateGrowthPoints();
        console.log("✅ Regenerated growth points");
        fixes.growthPointsFixed = true;
      } else {
        console.log("⚠️ Cannot regenerate growth points - function not found");
        
        // Create empty growth points object at minimum
        appleSystem.growthPoints = {};
      }
    }
    
    // Fix 3: Optimize apple system settings for visibility
    if (appleSystem.options) {
      // Speed up growth dramatically
      if (appleSystem.options.growthTime > 10) {
        appleSystem.options.growthTime = 10; // 10 seconds to grow
      }
      
      // Increase growth probability
      if (appleSystem.options.growthProbability < 0.05) {
        appleSystem.options.growthProbability = 0.05; // 5% chance per second
      }
      
      // Ensure at least 2 apples per tree
      if (appleSystem.options.maxApplesPerTree < 2) {
        appleSystem.options.maxApplesPerTree = 2;
      }
      
      console.log("✅ Optimized apple system settings for visibility");
    }
    
    // Fix 4: Create apples immediately
    if (typeof appleSystem.forceGrowAllApples === 'function') {
      const count = appleSystem.forceGrowAllApples();
      fixes.applesCreated = count;
      console.log(`✅ Force grew ${count} apples`);
    } else {
      console.log("⚠️ Cannot force grow apples - function not found");
    }
    
    // Fix 5: Make all apples ripe immediately
    if (appleSystem.growthPoints) {
      let ripened = 0;
      
      Object.values(appleSystem.growthPoints).forEach(points => {
        points.forEach(point => {
          if (point.hasApple && point.growthProgress < 1.0) {
            point.growthProgress = 1.0;
            ripened++;
          }
        });
      });
      
      if (ripened > 0) {
        fixes.applesRipened = ripened;
        console.log(`✅ Ripened ${ripened} apples`);
      }
    }
    
    // Fix 6: Ensure player has apples regardless
    if (window.player && window.player.addAmmo) {
      window.player.addAmmo('apple', 30);
      console.log("✅ Gave player 30 apples directly");
    }
    
    fixApplied = true;
    return fixes;
  }
  
  /**
   * Create a complete set of apples on all LP trees directly
   * @returns {number} Number of apples created
   */
  function createVisibleApplesDirectly() {
    if (!window.collidables || !window.scene) {
      console.error("Cannot create visible apples - scene or collidables missing");
      return 0;
    }
    
    // Find all LP trees
    const lpTrees = window.collidables.filter(obj => 
      obj.mesh?.userData?.isTree === true && 
      obj.mesh?.userData?.isPineTree !== true
    );
    
    if (lpTrees.length === 0) {
      console.error("No LP trees found to add apples to");
      return 0;
    }
    
    console.log(`Creating visible apples on ${lpTrees.length} LP trees...`);
    
    // Create apple material
    const appleMaterial = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x661100,
      emissiveIntensity: 0.3
    });
    
    // Create stem material
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x553311,
      roughness: 0.9,
      metalness: 0.1
    });
    
    // Track created apples
    let created = 0;
    
    // Function to create apple mesh
    function createAppleMesh() {
      // Create apple geometry
      const appleGroup = new THREE.Group();
      
      // Main apple sphere
      const appleGeo = new THREE.SphereGeometry(3, 12, 10);
      const appleMesh = new THREE.Mesh(appleGeo, appleMaterial);
      appleMesh.scale.y = 0.9; // Slight squash for apple shape
      appleGroup.add(appleMesh);
      
      // Add stem
      const stemGeo = new THREE.CylinderGeometry(0.3, 0.5, 1.5, 8);
      const stem = new THREE.Mesh(stemGeo, stemMaterial);
      stem.position.y = 2.4;
      stem.rotation.x = (Math.random() - 0.5) * 0.3;
      stem.rotation.z = (Math.random() - 0.5) * 0.3;
      appleGroup.add(stem);
      
      return appleGroup;
    }
    
    // Add apples to each tree
    lpTrees.forEach(tree => {
      // Get tree properties
      const treePos = tree.position.clone();
      const treeDir = tree.position.clone().normalize();
      const radius = tree.radius || 10;
      const height = tree.trunkHeight || 40;
      
      // Create 2-3 apples per tree
      const appleCount = 2 + Math.floor(Math.random() * 2);
      
      for (let i = 0; i < appleCount; i++) {
        // Calculate position in the foliage
        const foliageCenter = treePos.clone().add(
          treeDir.clone().multiplyScalar(height * 0.8)
        );
        
        // Random direction biased toward upper hemisphere
        const phi = Math.random() * Math.PI * 0.4; // Only in upper part
        const theta = Math.random() * Math.PI * 2; // Around full circle
        
        const dir = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi), // Mostly upward
          Math.sin(phi) * Math.sin(theta)
        ).normalize();
        
        // Final position on foliage surface
        const applePos = foliageCenter.clone().add(
          dir.multiplyScalar(radius * 0.9)
        );
        
        // Create apple mesh
        const apple = createAppleMesh();
        apple.position.copy(applePos);
        
        // Orient apple to face outward from tree
        const appleDir = applePos.clone().sub(treePos).normalize();
        apple.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          appleDir
        );
        
        // Add to scene
        window.scene.add(apple);
        created++;
        
        // Add slight bobbing animation
        const originalY = apple.position.y;
        const frequency = 0.5 + Math.random() * 0.5;
        const amplitude = 0.1 + Math.random() * 0.1;
        const phase = Math.random() * Math.PI * 2;
        
        // Add to animation loop
        if (!window.customAnimations) window.customAnimations = [];
        
        const updateFunc = (time) => {
          apple.position.y = originalY + Math.sin(time * frequency + phase) * amplitude;
          return apple.parent !== null; // Keep updating while apple exists
        };
        
        window.customAnimations.push(updateFunc);
      }
    });
    
    // Set up animation loop if not already running
    if (!window.animationLoopAdded && window.customAnimations?.length > 0) {
      const animate = () => {
        const time = Date.now() / 1000;
        
        // Update all apple animations and remove ones that return false
        if (window.customAnimations) {
          window.customAnimations = window.customAnimations.filter(func => func(time));
        }
        
        // Continue loop
        requestAnimationFrame(animate);
      };
      
      requestAnimationFrame(animate);
      window.animationLoopAdded = true;
    }
    
    console.log(`✅ Created ${created} visible apples directly on trees`);
    return created;
  }
  
  // Add global debug command
  window.debugApples = function() {
    const results = diagnoseAppleSystem();
    
    console.log("==== APPLE SYSTEM DIAGNOSIS ====");
    console.log(`Apple System Found: ${results.appleSystemFound}`);
    console.log(`LP Trees Found: ${results.lpTreesFound ? `Yes (${results.lpTreeCount})` : 'No'}`);
    console.log(`Trees in Apple System: ${results.appleTreesFound ? `Yes (${results.appleTreeCount})` : 'No'}`);
    console.log(`Growth Points: ${results.growthPointsFound ? `Yes (${results.growthPointCount})` : 'No'}`);
    console.log(`Growing Apples: ${results.growingApples} (${results.ripeApples} ripe)`);
    console.log(`Ground Apples: ${results.groundApples}`);
    console.log(`Total Apples: ${results.appleCount}`);
    
    if (results.issues.length > 0) {
      console.log("\nIssues Found:");
      results.issues.forEach((issue, i) => {
        console.log(`${i+1}. ${issue}`);
      });
    }
    
    return results;
  };
  
  // Add global fix command
  window.fixApples = function() {
    const diagnosis = diagnoseAppleSystem();
    
    if (diagnosis.issues.length === 0 && diagnosis.appleCount > 5) {
      console.log("Apple system appears to be working correctly with sufficient apples.");
      
      // Always refresh some apples
      if (window.appleSystem && typeof window.appleSystem.forceGrowAllApples === 'function') {
        window.appleSystem.forceGrowAllApples();
      }
      
      return "No fix needed";
    }
    
    // Apply direct fix
    const fixes = applyDirectFix();
    
    // If we still don't have apples, create them directly
    if (fixes.applesCreated === 0) {
      const created = createVisibleApplesDirectly();
      fixes.directlyCreated = created;
    }
    
    return fixes;
  };
  
  // Add global create command
  window.createVisibleApples = function(count) {
    // If system is working, try using it first
    if (window.appleSystem && typeof window.appleSystem.forceGrowAllApples === 'function') {
      const systemCount = window.appleSystem.forceGrowAllApples();
      
      if (systemCount > 0) {
        console.log(`Created ${systemCount} apples through apple system`);
        return systemCount;
      }
    }
    
    // Fall back to direct creation
    return createVisibleApplesDirectly();
  };
  
  // Give player apples directly
  window.giveApples = function(count = 30) {
    if (window.player && window.player.addAmmo) {
      window.player.addAmmo('apple', count);
      return `Gave player ${count} apples`;
    }
    return "Player not available";
  };
  
  // Run diagnostic immediately
  const initialDiagnosis = diagnoseAppleSystem();
  
  console.log("==== INITIAL APPLE SYSTEM DIAGNOSIS ====");
  console.log(`Apple System Found: ${initialDiagnosis.appleSystemFound}`);
  console.log(`LP Trees Found: ${initialDiagnosis.lpTreesFound ? `Yes (${initialDiagnosis.lpTreeCount})` : 'No'}`);
  console.log(`Growth Points: ${initialDiagnosis.growthPointsFound ? `Yes (${initialDiagnosis.growthPointCount})` : 'No'}`);
  console.log(`Growing Apples: ${initialDiagnosis.growingApples} (${initialDiagnosis.ripeApples} ripe)`);
  
  if (initialDiagnosis.issues.length > 0) {
    console.log("Issues Found:");
    initialDiagnosis.issues.forEach(issue => console.log(`- ${issue}`));
    
    // Apply fix with slight delay to ensure system is fully loaded
    setTimeout(() => {
      applyDirectFix();
      
      // Create visible apples if fix didn't create any
      setTimeout(() => {
        const postFixDiagnosis = diagnoseAppleSystem();
        if (postFixDiagnosis.appleCount < 10) {
          console.log("Still not enough apples after fix, creating directly...");
          createVisibleApplesDirectly();
        }
      }, 1000);
    }, 2000);
  }
  
  console.log(`
  // *****************************************
  // ***** APPLE DIRECT FIX COMMANDS *****
  // *****************************************
  debugApples()           // Check apple system status
  fixApples()             // Fix apple system issues
  createVisibleApples()   // Create visible apples directly on trees
  giveApples(30)          // Give yourself 30 apples
  `);
})();
