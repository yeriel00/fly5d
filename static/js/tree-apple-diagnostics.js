/**
 * Helper utilities to diagnose and fix apple tree issues
 * Helps with situations where apples stop growing/falling after extended gameplay
 */

// Make functions accessible globally
window.treeAppleDiagnostics = {
  /**
   * Show detailed statistics about the current apple system state
   */
  showStats() {
    if (!window.game?.appleSystem) {
      console.error("No apple system found!");
      return;
    }

    const appleSystem = window.game.appleSystem;
    const stats = {
      trees: appleSystem.appleTrees.length,
      emptyGrowthPoints: 0,
      occupiedGrowthPoints: 0,
      ripeApples: 0,
      growingApples: 0,
      groundApples: appleSystem.groundApples.length,
      groundedApples: appleSystem.groundApples.filter(a => a.isGrounded).length,
      fallingApples: appleSystem.groundApples.filter(a => !a.isGrounded).length
    };

    let totalGrowthPoints = 0;
    
    // Check each tree
    Object.values(appleSystem.growthPoints).forEach(points => {
      totalGrowthPoints += points.length;
      
      points.forEach(point => {
        if (point.hasApple) {
          stats.occupiedGrowthPoints++;
          if (point.growthProgress >= 1.0) {
            stats.ripeApples++;
          } else {
            stats.growingApples++;
          }
        } else {
          stats.emptyGrowthPoints++;
        }
      });
    });
    
    stats.totalGrowthPoints = totalGrowthPoints;
    stats.growthPointUtilization = totalGrowthPoints > 0 
        ? (stats.occupiedGrowthPoints / totalGrowthPoints * 100).toFixed(1) + '%'
        : 'N/A';
    
    console.table(stats);
    return stats;
  },

  /**
   * Force all trees to immediately grow a full set of ripe apples
   */
  forceGrowAllApples() {
    if (!window.game?.appleSystem) {
      console.error("No apple system found!");
      return;
    }

    const appleSystem = window.game.appleSystem;
    
    // Force grow apples on all points
    Object.values(appleSystem.growthPoints).forEach(points => {
      points.forEach(point => {
        if (!point.hasApple) {
          appleSystem._startNewApple(point);
        }
        // Set to full growth
        point.growthProgress = 1.0;
        
        // Make sure they're using the right material
        if (point.apple && point.growthProgress >= 1.0) {
          const type = point.appleType;
          const material = appleSystem.appleMaterials[type];
          point.apple.material = material;
          
          // Scale to full size
          point.apple.scale.set(1, 1, 1);
        }
      });
    });
    
    console.log("✅ Force-grown all apples to ripe state");
    return this.showStats();
  },
  
  /**
   * Reset and refresh the entire apple system
   */
  resetAppleSystem() {
    if (!window.game?.appleSystem) {
      console.error("No apple system found!");
      return;
    }

    // Store original system
    const originalSystem = window.game.appleSystem;
    
    // Clear all existing apples
    originalSystem.cleanup();
    
    // Refresh tree list
    originalSystem.findAppleTrees();
    
    // Re-grow apples
    this.forceGrowAllApples();
    
    // Force some to drop right away
    this.forceDropSomeApples(5);
    
    console.log("✅ Apple system has been fully reset");
    return this.showStats();
  },
  
  /**
   * Force some ripe apples to drop immediately
   * @param {number} count - How many apples to drop
   */
  forceDropSomeApples(count = 3) {
    if (!window.game?.appleSystem) {
      console.error("No apple system found!");
      return;
    }

    const appleSystem = window.game.appleSystem;
    const ripeApples = [];
    
    // Find all ripe apples
    Object.values(appleSystem.growthPoints).forEach(points => {
      points.forEach(point => {
        if (point.hasApple && point.growthProgress >= 1.0) {
          ripeApples.push(point);
        }
      });
    });
    
    if (ripeApples.length === 0) {
      console.log("No ripe apples to drop!");
      return 0;
    }
    
    // Shuffle array randomly
    ripeApples.sort(() => Math.random() - 0.5);
    
    // Drop the requested number
    const toDrop = Math.min(count, ripeApples.length);
    for (let i = 0; i < toDrop; i++) {
      appleSystem._detachApple(ripeApples[i]);
    }
    
    console.log(`✅ Force-dropped ${toDrop} apples`);
    return toDrop;
  }
};

// Create a global shortcut function
window.fixAppleTrees = function() {
  console.log("🍎 Running apple tree diagnostics and repair...");
  
  const before = window.treeAppleDiagnostics.showStats();
  
  if (before.trees === 0 || before.totalGrowthPoints === 0) {
    console.log("Critical issue detected: No trees or growth points! Attempting deep repair...");
    window.treeAppleDiagnostics.resetAppleSystem();
  }
  else if (before.ripeApples === 0 && before.growingApples === 0) {
    console.log("No apples found on trees. Growing new apples...");
    window.treeAppleDiagnostics.forceGrowAllApples();
  }
  else if (before.ripeApples > 0) {
    console.log("Found ripe apples - forcing some to drop...");
    window.treeAppleDiagnostics.forceDropSomeApples(Math.ceil(before.ripeApples * 0.3));
  }
  
  const after = window.treeAppleDiagnostics.showStats();
  console.log("🍎 Apple repair complete. Before/After comparison:", 
    `Trees: ${before.trees}→${after.trees}, ` +
    `Ripe: ${before.ripeApples}→${after.ripeApples}, ` + 
    `Ground: ${before.groundApples}→${after.groundApples}`);
  
  return {before, after};
};

// Set up automatic repair every 2 minutes
let fixAppleTimerId = setInterval(() => {
  console.log("Performing automatic apple tree maintenance check...");
  const stats = window.treeAppleDiagnostics?.showStats();
  
  // Only run repair if needed (no ripe apples, or extremely low utilization)
  if (stats && (stats.ripeApples === 0 || stats.growthPointUtilization < '20%')) {
    console.log("Apple issue detected - running auto-repair");
    window.fixAppleTrees();
  }
}, 120000); // Check every 2 minutes

// Clean up when game ends
window.addEventListener('beforeunload', () => {
  clearInterval(fixAppleTimerId);
});

console.log("🍎 Tree and apple diagnostics loaded. Type 'fixAppleTrees()' in console to fix apple issues.");
