/**
 * TreeFixerPro 
 * - Debugging and fixing tree-related issues
 */

(function() {
  // Create global namespace for tree-fixing utilities
  window.treeFixer = {};
  
  /**
   * Make apples easier to collect in-air and from trees
   */
  window.treeFixer.makeApplesMoreGrabbable = function() {
    // Get all possible apple systems
    const systems = [
      window.appleSystem,
      window.game?.appleSystem, 
      window.player?.appleSystem
    ];
    
    let modified = 0;
    
    // Apply to all available apple systems
    for (const system of systems) {
      if (system && typeof system._checkAppleCollection === 'function') {
        // Patch the collection function to be more lenient
        const originalCheck = system._checkAppleCollection;
        system._checkAppleCollection = function(playerPosition) {
          // Store original collection radius
          const originalRadius = system.options.collectionRadius || 10;
          
          // Temporarily increase collection radius
          system.options.collectionRadius = originalRadius * 1.5;
          
          // Call original function
          originalCheck.call(system, playerPosition);
          
          // Restore original radius
          system.options.collectionRadius = originalRadius;
        };
        
        // Also try to call improveAppleGrabbability if it exists or was added
        if (typeof system.improveAppleGrabbability === 'function') {
          system.improveAppleGrabbability();
        }
        
        modified++;
      }
    }
    
    console.log(`🍎 Made apples more grabbable for ${modified} systems`);
    
    // Also trigger this again after a delay in case system is initialized later
    setTimeout(() => {
      window.treeFixer.makeApplesMoreGrabbable();
    }, 5000);
    
    return `🍎 Made apples more grabbable! Applied to ${modified} systems.`;
  };
  
  // Access the instant-apples system too
  window.treeFixer.improveInstantAppleCollection = function() {
    // Check if we have instant apples
    if (window.instantApples && Array.isArray(window.instantApples)) {
      // Increase the size of all instant apples
      for (const apple of window.instantApples) {
        if (apple.mesh) {
          apple.mesh.scale.multiplyScalar(1.3); // Make 30% larger
        }
      }
      
      // Look for the collection check loop
      if (window.checkAppleCollection) {
        // Substitute with a version that uses larger radius
        const originalCheck = window.checkAppleCollection;
        window.checkAppleCollection = function() {
          // Increase the collection radius
          window.appleCollectionRadius = 8; // Default is usually around 5
          originalCheck();
        };
      }
      
      return `Improved ${window.instantApples.length} instant apples for easier collection`;
    }
    return "No instant apples found";
  };
  
  // Add to fixGame function
  const originalFixGame = window.fixGame || function() {};
  window.fixGame = function() {
    // Call original fixGame if it exists
    originalFixGame();
    
    // Add our apple grabbing improvements
    window.treeFixer.makeApplesMoreGrabbable();
    window.treeFixer.improveInstantAppleCollection();
    
    return "Game fixed with improved apple collection";
  };
  
  // Run the fix function on a delay to ensure everything is loaded
  setTimeout(window.fixGame, 2000);
  
  // Export as global command
  window.makeApplesEasierToGrab = window.treeFixer.makeApplesMoreGrabbable;
  
  // Log available commands
  console.log(`
  // *****************************************
  // ***** TREE FIXER PRO COMMANDS *****
  // *****************************************
  makeApplesEasierToGrab()  // Make apples easier to collect
  `);
})();
