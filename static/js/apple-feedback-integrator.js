/**
 * Integrates the AppleCollectionFeedback system with the existing apple collection logic
 */

import AppleCollectionFeedback from './AppleCollectionFeedback.js';

(function() {
    let feedbackSystem = null;
    
    // Initialize feedback system when scene and camera are available
    function initFeedbackSystem() {
        if (!window.scene || !window.camera) {
            // Wait and try again
            setTimeout(initFeedbackSystem, 1000);
            return;
        }
        
        // Create the feedback system
        feedbackSystem = new AppleCollectionFeedback(window.scene, window.camera);
        console.log("🍎 Apple Collection Feedback system initialized");
        
        // Add to animation loop if not already there
        if (window.addUpdateFunction && typeof window.addUpdateFunction === 'function') {
            window.addUpdateFunction(feedbackSystem.update);
        } else {
            // Fallback: Hook into requestAnimationFrame
            function animate() {
                feedbackSystem.update();
                requestAnimationFrame(animate);
            }
            animate();
        }
        
        // Patch the AppleSystem to show feedback
        patchAppleSystem();
    }
    
    // Patch the apple collection function to show feedback
    function patchAppleSystem() {
        // Track which systems we've patched
        const patchedSystems = new Set();
        
        // Find and patch all potential apple systems
        function findAndPatchSystems() {
            // Get all possible apple systems
            const systems = [
                window.appleSystem,
                window.game?.appleSystem,
                window.player?.appleSystem
            ];
            
            let patched = 0;
            
            for (const system of systems) {
                if (system && typeof system._collectApple === 'function' && !patchedSystems.has(system)) {
                    // Patch _collectApple method
                    const originalCollect = system._collectApple.bind(system);
                    system._collectApple = function(type, effectMultiplier, position) {
                        // Call original function first
                        originalCollect(type, effectMultiplier, position);
                        
                        // Then show feedback animation
                        if (feedbackSystem) {
                            // Determine count from effectMultiplier or type
                            let count = 1;
                            if (type === 'yellow') count = 2;
                            else if (type === 'green') count = 3;
                            
                            feedbackSystem.showCollection(type, count);
                        }
                    };
                    
                    patchedSystems.add(system);
                    patched++;
                }
            }
            
            if (patched > 0) {
                console.log(`🍎 Patched ${patched} apple systems to show collection feedback`);
            }
            
            return patched;
        }
        
        // Try patching systems now
        let patched = findAndPatchSystems();
        
        // If no systems patched, try again later
        if (patched === 0) {
            setTimeout(findAndPatchSystems, 2000);
        }
    }
    
    // Hook instant apple collection too (from instant-apples.js)
    function patchInstantApples() {
        if (window.checkAppleCollection) {
            const originalCheck = window.checkAppleCollection;
            window.checkAppleCollection = function() {
                // Track which apples were collected before calling original function
                const originalLength = window.instantApples ? window.instantApples.length : 0;
                
                // Call original function
                originalCheck();
                
                // Count how many were collected
                const newLength = window.instantApples ? window.instantApples.length : 0;
                const collected = originalLength - newLength;
                
                // Show feedback if apples were collected
                if (collected > 0 && feedbackSystem) {
                    feedbackSystem.showCollection('red', collected);
                }
            };
            
            console.log("🍎 Patched instant apple collection to show feedback");
        }
    }
    
    // Initialize feedback system
    setTimeout(initFeedbackSystem, 2000);
    
    // Patch instant apples system after a delay
    setTimeout(patchInstantApples, 3000);
    
    // Export the API for manual use
    window.appleCollectionFeedback = {
        showCollection: (type, count) => {
            if (feedbackSystem) {
                feedbackSystem.showCollection(type, count);
            } else {
                console.warn("Apple Collection Feedback system not initialized yet");
            }
        }
    };
})();
