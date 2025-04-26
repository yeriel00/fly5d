/**
 * APPLE ACCELERATOR
 * 
 * A simple script that:
 * 1. Works with the existing apple system
 * 2. Speeds up apple growth so they're visible faster
 * 3. Makes apples more visible and prevents clearing
 */

(function() {
  console.log("🍎 Apple Accelerator - Loading...");
  
  // Track our initialization state
  let initialized = false;
  let appleSystem = null;
  
  // Configuration
  const config = {
    growthSpeedMultiplier: 10,  // Make apples grow 10x faster
    checkInterval: 3000,        // How often to check for apples (ms)
    minApples: 10               // Minimum apples to maintain
  };
  
  /**
   * Initialize the accelerator
   */
  function initialize() {
    if (initialized) return;
    
    console.log("🍎 Initializing Apple Accelerator...");
    
    // Find the apple system
    if (window.appleSystem) {
      appleSystem = window.appleSystem;
      console.log("✅ Found apple system");
    } else {
      console.log("⚠️ Apple system not found yet, will check later");
    }
    
    // Block apple clearing function
    if (typeof window.clearAllApplesToImprovePerformance === 'function') {
      const originalClear = window.clearAllApplesToImprovePerformance;
      
      window.clearAllApplesToImprovePerformance = function() {
        console.log("🛡️ Blocked attempt to clear apples");
        
        // Give player apples as compensation
        if (window.player && window.player.addAmmo) {
          window.player.addAmmo('apple', 20);
          console.log("📦 Gave player 20 apples instead of clearing visuals");
        }
        
        // Force apple growth after a short delay
        setTimeout(forceGrowApples, 500);
        
        return "Apple clearing prevented";
      };
      
      console.log("✅ Protected apples from performance clearing");
    }
    
    // Apply optimizations
    applyOptimizations();
    
    // Start monitoring
    startMonitoring();
    
    initialized = true;
    console.log("🍎 Apple Accelerator initialized");
  }
  
  /**
   * Apply optimizations to the apple system
   */
  function applyOptimizations() {
    // Only proceed if we have the apple system
    if (!appleSystem) {
      if (window.appleSystem) {
        appleSystem = window.appleSystem;
      } else {
        console.log("⚠️ Can't apply optimizations - apple system not found");
        return false;
      }
    }
    
    console.log("🔧 Applying apple growth optimizations...");
    
    // 1. Speed up growth time
    if (appleSystem.options && appleSystem.options.growthTime) {
      // Save original growth time
      const originalGrowthTime = appleSystem.options.growthTime;
      
      // Set faster growth time
      appleSystem.options.growthTime = originalGrowthTime / config.growthSpeedMultiplier;
      console.log(`✅ Accelerated apple growth: ${originalGrowthTime}s → ${appleSystem.options.growthTime}s`);
    }
    
    // 2. Increase growth probability
    if (appleSystem.options && appleSystem.options.growthProbability !== undefined) {
      // Save original probability
      const originalProbability = appleSystem.options.growthProbability;
      
      // Set higher probability
      appleSystem.options.growthProbability = originalProbability * config.growthSpeedMultiplier;
      console.log(`✅ Increased growth probability: ${originalProbability} → ${appleSystem.options.growthProbability}`);
    }
    
    // 3. Ensure maximum apples per tree is reasonable
    if (appleSystem.options && appleSystem.options.maxApplesPerTree !== undefined) {
      if (appleSystem.options.maxApplesPerTree < 2) {
        appleSystem.options.maxApplesPerTree = 2;
        console.log("✅ Ensured at least 2 apples can grow per tree");
      }
    }
    
    // 4. Force grow existing apples
    if (typeof appleSystem.growAllApples === 'function') {
      appleSystem.growAllApples();
      console.log("✅ Forced all existing apples to grow");
    }
    
    return true;
  }
  
  /**
   * Force-grow new apples
   */
  function forceGrowApples() {
    // Only proceed if we have the apple system
    if (!appleSystem) {
      if (window.appleSystem) {
        appleSystem = window.appleSystem;
      } else {
        console.log("⚠️ Can't force grow apples - apple system not found");
        return 0;
      }
    }
    
    let count = 0;
    
    // Method 1: Use forceGrowAllApples
    if (typeof appleSystem.forceGrowAllApples === 'function') {
      count = appleSystem.forceGrowAllApples();
    }
    // Method 2: Use forceGrowNewApples
    else if (typeof appleSystem.forceGrowNewApples === 'function') {
      const result = appleSystem.forceGrowNewApples(20);
      count = result.grown || 0;
    } 
    // Method 3: Get rough count from growth points
    else if (appleSystem.growthPoints) {
      // Count total points
      let totalPoints = 0;
      let growingPoints = 0;
      
      Object.values(appleSystem.growthPoints).forEach(points => {
        totalPoints += points.length;
        points.forEach(point => {
          if (point.hasApple) {
            growingPoints++;
          }
        });
      });
      
      // If not enough apples are growing, try to start more
      if (growingPoints < config.minApples) {
        // Try to start new apples
        if (typeof appleSystem._tryStartNewApples === 'function') {
          // Force many new apples to start growing by simulating a lot of time
          appleSystem._tryStartNewApples(100);
          count = config.minApples;
        }
      } else {
        count = growingPoints;
      }
      
      // Make sure all apples are fully grown
      if (typeof appleSystem.growAllApples === 'function') {
        appleSystem.growAllApples();
      }
    }
    
    // Give player apples directly too
    if (window.player && window.player.addAmmo) {
      window.player.addAmmo('apple', 10);
    }
    
    console.log(`🌱 Force-grew ${count} apples`);
    return count;
  }
  
  /**
   * Check if we have enough apples
   */
  function checkAppleCount() {
    // Only proceed if we have the apple system
    if (!appleSystem) {
      if (window.appleSystem) {
        appleSystem = window.appleSystem;
      } else {
        return 0;
      }
    }
    
    let count = 0;
    
    // Count apples from growth points
    if (appleSystem.growthPoints) {
      Object.values(appleSystem.growthPoints).forEach(points => {
        points.forEach(point => {
          if (point.hasApple) {
            count++;
          }
        });
      });
    }
    
    // Add ground apples
    if (appleSystem.groundApples) {
      count += appleSystem.groundApples.length;
    }
    
    return count;
  }
  
  /**
   * Start monitoring the apple system
   */
  function startMonitoring() {
    // Set up periodic check for apples
    setInterval(() => {
      const appleCount = checkAppleCount();
      console.log(`🍎 Apple count: ${appleCount}`);
      
      // If we don't have enough apples, force grow more
      if (appleCount < config.minApples) {
        console.log(`⚠️ Not enough apples (${appleCount}/${config.minApples}), forcing growth...`);
        forceGrowApples();
      }
    }, config.checkInterval);
    
    console.log("👀 Started apple monitoring");
  }
  
  // Add global functions
  window.accelerateApples = () => {
    // Make sure we're initialized
    if (!initialized) {
      initialize();
    }
    
    // Re-apply optimizations
    applyOptimizations();
    
    // Force grow apples
    forceGrowApples();
    
    return "Apple growth accelerated";
  };
  
  window.giveApples = (count = 20) => {
    if (window.player && window.player.addAmmo) {
      window.player.addAmmo('apple', count);
      return `Gave player ${count} apples`;
    }
    return "Player not available";
  };
  
  // Auto-initialize after delay
  setTimeout(initialize, 2000);
  
  // Attempt to grow apples after a delay
  setTimeout(() => {
    forceGrowApples();
    
    // Give player some apples directly
    if (window.player && window.player.addAmmo) {
      window.player.addAmmo('apple', 30);
      console.log("📦 Gave player 30 apples at startup");
    }
  }, 3000);
  
  // Log available commands
  console.log(`
  // *****************************************
  // ***** APPLE ACCELERATOR COMMANDS *****
  // *****************************************
  accelerateApples()      // Speed up apple growth and create more
  giveApples(20)          // Give yourself 20 apples directly
  `);
})();
