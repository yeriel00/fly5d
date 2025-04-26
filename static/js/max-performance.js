/**
 * Maximum performance optimizer for 5D Sphere Explorer
 * - Disables non-essential effects
 * - Reduces polygon counts
 * - Prevents expensive calculations
 * - Ensures high FPS
 */

console.log("🚀 LOADING MAXIMUM PERFORMANCE MODE");

// Run performance optimizations immediately
setTimeout(applyPerformanceOptimizations, 500);

/**
 * Apply aggressive performance optimizations
 */
function applyPerformanceOptimizations() {
  console.log("🚀 APPLYING MAX PERFORMANCE OPTIMIZATIONS");
  
  // If WebGL renderer not available yet, try again soon
  if (!window.renderer) {
    setTimeout(applyPerformanceOptimizations, 500);
    return;
  }
  
  console.log("🔄 Optimizing WebGL renderer");
  
  // Reduce WebGL quality settings
  window.renderer.setPixelRatio(1.0); // Force standard pixel ratio
  window.renderer.shadowMap.enabled = false; // Disable shadows
  window.renderer.shadowMap.autoUpdate = false;
  window.renderer.shadowMap.needsUpdate = false;
  
  // Reduce memory usage
  window.renderer.dispose();
  
  // Optimize rendering quality
  if (window.renderer.capabilities) {
    // Lower precision if possible
    window.renderer.capabilities.precision = "lowp";
  }
  
  // Replace post-processing effects with simple version if available
  if (window.composer) {
    if (window.composer.passes) {
      // Keep only essential passes
      const essentialPasses = window.composer.passes.filter(pass => 
        pass.isRenderPass || pass.isEssential);
      
      if (essentialPasses.length < window.composer.passes.length) {
        console.log(`🔄 Removed ${window.composer.passes.length - essentialPasses.length} post-processing passes`);
        window.composer.passes = essentialPasses;
      }
    }
  }
  
  // Reduce textures quality
  if (window.THREE) {
    window.THREE.TextureLoader.prototype.load = (function() {
      const originalLoad = window.THREE.TextureLoader.prototype.load;
      return function(url, onLoad, onProgress, onError) {
        const texture = originalLoad.call(this, url, onLoad, onProgress, onError);
        texture.minFilter = window.THREE.LinearFilter;
        texture.magFilter = window.THREE.LinearFilter;
        texture.generateMipmaps = false;
        return texture;
      };
    })();
    
    console.log("🔄 Optimized texture loading");
  }
  
  // Disable apple system if it exists
  if (window.appleSystem) {
    console.log("🔄 Disabling built-in apple system");
    
    // Save original methods for reference
    window.appleSystem._originalUpdate = window.appleSystem.update;
    
    // Replace with no-op functions
    window.appleSystem.update = () => {};
    
    // Prevent apple spawning
    if (window.appleSystem.options) {
      window.appleSystem.options.growthProbability = 0;
      window.appleSystem.options.fallProbability = 0;
    }
  }
  
  // Fix and optimize trees
  setTimeout(() => {
    if (window.collidables) {
      // Find trees that need adjustment
      const trees = window.collidables.filter(obj => 
        obj.mesh?.userData?.isTree === true && 
        !obj.mesh?.userData?.optimized
      );
      
      console.log(`🔄 Optimizing ${trees.length} trees`);
      
      trees.forEach(tree => {
        if (!tree.mesh) return;
        
        // Mark as optimized
        tree.mesh.userData.optimized = true;
        
        // Keep just the geometry, disable unnecessary features
        if (tree.mesh.geometry) {
          tree.mesh.geometry.attributes.normal = null;
          tree.mesh.geometry.attributes.uv = null;
        }
        
        // Disable shadows
        tree.mesh.castShadow = false;
        tree.mesh.receiveShadow = false;
        
        // Traverse all children
        tree.mesh.traverse(child => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
            
            // Simplify material
            if (child.material) {
              child.material.flatShading = false;
              child.material.wireframe = false;
              child.material.needsUpdate = true;
            }
          }
        });
      });
    }
  }, 2000);
  
  // Apply fixed frame rate for consistency
  setupFixedFrameRate(30);
  
  console.log("✅ MAX PERFORMANCE OPTIMIZATIONS APPLIED");
}

/**
 * Setup fixed frame rate for better performance
 * @param {number} fps - Target FPS (e.g., 30)
 */
function setupFixedFrameRate(fps = 30) {
  // Only do this if requestAnimationFrame is available
  if (!window.requestAnimationFrame) return;
  
  console.log(`🔄 Setting up fixed ${fps}fps frame rate`);
  
  const frameInterval = 1000 / fps;
  let lastTime = 0;
  
  // Store the original requestAnimationFrame
  const originalRAF = window.requestAnimationFrame;
  
  // Replace with our version that limits frame rate
  window.requestAnimationFrame = function(callback) {
    return originalRAF(time => {
      const now = performance.now();
      const elapsed = now - lastTime;
      
      if (elapsed > frameInterval) {
        lastTime = now - (elapsed % frameInterval);
        callback(time);
      } else {
        // Skip this frame
        window.requestAnimationFrame(callback);
      }
    });
  };
}

// Create global optimizations object
window.performanceFix = {
  // Add some apples but with minimal impact
  addVisibleApples: function(count = 5) {
    // Make sure instant apples system is loaded
    if (typeof window.addMoreApples !== 'function') {
      console.log("Instant apples system not loaded");
      return false;
    }
    
    return window.addMoreApples(count);
  },
  
  // Add player ammo directly
  givePlayerApples: function(count = 30) {
    if (window.player && window.player.addAmmo) {
      window.player.addAmmo('apple', count);
      return `Gave player ${count} apple ammo`;
    }
    return "Player not available";
  },
  
  // Fix trees directly
  fixLPTrees: function() {
    if (!window.collidables) {
      return "Collidables not available";
    }
    
    // Find all LP trees
    const lpTrees = window.collidables.filter(obj => 
      obj.mesh?.userData?.isTree === true && 
      !obj.mesh?.userData?.isPineTree
    );
    
    console.log(`Found ${lpTrees.length} LP trees to fix`);
    
    // Fix each tree
    let fixed = 0;
    lpTrees.forEach(tree => {
      if (!tree.position || !tree.direction) return;
      
      // Calculate proper ground height
      const planetRadius = 400; // Default planet radius
      const dir = tree.position.clone().normalize();
      
      // Set position close to ground
      const groundHeight = 5; // 5 units above ground
      const newPos = dir.multiplyScalar(planetRadius + groundHeight);
      
      // Update positions
      if (tree.mesh) {
        tree.mesh.position.copy(newPos);
        
        // Update orientation
        tree.mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir
        );
      }
      
      tree.position.copy(newPos);
      fixed++;
    });
    
    return `Fixed ${fixed} LP trees`;
  },
  
  // Emergency FPS boost
  emergencyFPSBoost: function() {
    // Disable everything except bare minimum
    
    // 1. Kill all apple systems
    if (window.appleSystem) {
      window.appleSystem.update = () => {};
      window.appleSystem._updateApples = () => {};
    }
    
    // 2. Cancel all animations
    Object.keys(window).forEach(key => {
      if (typeof window[key] === 'number' && key.includes('Animation')) {
        cancelAnimationFrame(window[key]);
      }
    });
    
    // 3. Lower renderer quality to absolute minimum
    if (window.renderer) {
      window.renderer.setPixelRatio(0.75); // Even lower than 1.0
      window.renderer.setSize(
        window.innerWidth * 0.75, 
        window.innerHeight * 0.75, 
        false
      );
    }
    
    // 4. Give player lots of apples directly
    if (window.player && window.player.addAmmo) {
      window.player.addAmmo('apple', 100);
    }
    
    return "EMERGENCY FPS BOOST APPLIED - Game quality reduced";
  }
};

// Make a user-friendly command
window.fixGame = function() {
  console.log("🚀 RUNNING COMPLETE GAME FIX");
  
  // Step 1: Apply max performance
  applyPerformanceOptimizations();
  
  // Step 2: Fix trees
  setTimeout(() => {
    window.performanceFix.fixLPTrees();
    
    // Step 3: Add minimal visible apples
    setTimeout(() => {
      window.performanceFix.addVisibleApples(6);
      window.performanceFix.givePlayerApples(30);
    }, 500);
  }, 1000);
  
  return "COMPLETE GAME FIX STARTED - Wait a few seconds for results";
};

// Auto-run fix after a short delay
setTimeout(() => {
  window.fixGame();
}, 2000);

// Add manual emergency boost command
console.log(`
// *****************************************
// ***** EMERGENCY PERFORMANCE COMMANDS *****
// *****************************************
fixGame()               // Fix everything: trees, apples, performance
performanceFix.emergencyFPSBoost()  // EMERGENCY: Max performance mode
performanceFix.givePlayerApples(30) // Get 30 apple ammo directly
`);
