import * as THREE from 'three';

/**
 * Debug utilities for the game
 */

/**
 * Show a debug overlay on the screen
 * @param {string} text - Text to display
 * @param {Object} options - Options for the overlay
 */
export function showDebugOverlay(text, options = {}) {
  const opts = {
    duration: 3000, // ms
    position: 'top-right',
    color: 'white',
    background: 'rgba(0,0,0,0.7)',
    ...options
  };
  
  // Create overlay element
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.padding = '10px';
  overlay.style.fontFamily = 'monospace';
  overlay.style.fontSize = '14px';
  overlay.style.color = opts.color;
  overlay.style.background = opts.background;
  overlay.style.zIndex = '1000';
  overlay.style.pointerEvents = 'none';
  overlay.style.transition = 'opacity 0.5s';
  overlay.style.borderRadius = '5px';
  overlay.style.maxWidth = '400px';
  overlay.style.wordBreak = 'break-word';
  
  // Position based on option
  switch (opts.position) {
    case 'top-left':
      overlay.style.top = '10px';
      overlay.style.left = '10px';
      break;
    case 'top-right':
      overlay.style.top = '10px';
      overlay.style.right = '10px';
      break;
    case 'bottom-left':
      overlay.style.bottom = '10px';
      overlay.style.left = '10px';
      break;
    case 'bottom-right':
      overlay.style.bottom = '10px';
      overlay.style.right = '10px';
      break;
    case 'center':
      overlay.style.top = '50%';
      overlay.style.left = '50%';
      overlay.style.transform = 'translate(-50%, -50%)';
      break;
    default:
      overlay.style.top = '10px';
      overlay.style.right = '10px';
  }
  
  // Set content
  overlay.textContent = text;
  
  // Add to DOM
  document.body.appendChild(overlay);
  
  // Remove after duration
  if (opts.duration > 0) {
    // Start fade out
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, opts.duration - 500);
    
    // Remove from DOM
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, opts.duration);
  }
  
  return overlay;
}

/**
 * Debug the slingshot and charging system
 * @param {Object} player - The player object
 */
export function debugSlingshot(player) {
  if (!player?.weaponSystem?.projectileSystem) {
    return showDebugOverlay("Weapon system not available", { 
      background: 'rgba(255,0,0,0.7)',
      duration: 5000
    });
  }
  
  const wpnSystem = player.weaponSystem;
  const projSystem = player.weaponSystem.projectileSystem;
  const slingshotState = projSystem.slingshotState;
  
  // Check for basic initialization issues
  if (!wpnSystem.isCharging && !slingshotState) {
    return showDebugOverlay("Critical error: Slingshot state is missing!", { 
      background: 'rgba(255,0,0,0.7)',
      duration: 5000
    });
  }
  
  // Log detailed state
  console.log("=== SLINGSHOT DEBUG ===");
  console.log("WeaponSystem.isCharging:", wpnSystem.isCharging);
  console.log("Slingshot state:", slingshotState);
  console.log("ProjectileSystem:", {
    projectiles: projSystem.projectiles.length,
    projectilePool: projSystem.projectilePool.length
  });
  
  // Create a full debug overlay with all state
  const stateInfo = [
    "=== SLINGSHOT STATE ===",
    `Charging: ${wpnSystem.isCharging}`,
    `Power: ${slingshotState ? (slingshotState.power * 100).toFixed(1) + '%' : 'N/A'}`,
    `Charge speed: ${slingshotState ? slingshotState.chargeSpeed : 'N/A'}`,
    `Cooldown: ${wpnSystem.cooldown.toFixed(2)}s`,
    `Ammo: ${wpnSystem.ammo.apple} apples, ${wpnSystem.ammo.goldenApple} golden`,
    "---",
    "CLICK AND HOLD LEFT MOUSE BUTTON TO CHARGE"
  ].join('\n');
  
  return showDebugOverlay(stateInfo, {
    position: 'top-left',
    background: 'rgba(0,0,100,0.8)',
    duration: 8000
  });
}

/**
 * Ultra-aggressive slingshot reset and force charge function
 * @param {Object} player - The player object
 */
export function forceSlingshotCharge(player) {
  if (!player?.weaponSystem?.projectileSystem) {
    return showDebugOverlay("Weapon system not available!", { 
      background: 'rgba(255,0,0,0.7)',
      duration: 5000
    });
  }
  
  const wpnSystem = player.weaponSystem;
  const projSystem = player.weaponSystem.projectileSystem;
  
  // Reset all charging state
  wpnSystem.isCharging = false;
  wpnSystem.cooldown = 0;
  
  // Ensure ammo
  wpnSystem.ammo.apple = Math.max(wpnSystem.ammo.apple, 10);
  
  // Force reset slingshot state
  projSystem.slingshotState = {
    charging: false,
    power: 0,
    minPower: 0.01,
    maxPower: 1.0,
    chargeSpeed: 3.0,
    direction: new THREE.Vector3(0, 0, -1)
  };
  
  // Get camera direction
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(player.getCamera().quaternion);
  
  // Now forcibly start charging
  wpnSystem.isCharging = true;
  projSystem.slingshotState.charging = true;
  
  // Add helpful overlay
  showDebugOverlay("🔄 Slingshot completely reset!\nTry charging now", {
    duration: 3000,
    position: 'center',
    background: 'rgba(0,100,0,0.8)'
  });
  
  console.log("🔧 Slingshot completely reset - try charging now!");
  
  return true;
}

// Export debug utilities to window for console access
if (typeof window !== 'undefined') {
  window.debugUtils = {
    showDebugOverlay,
    debugSlingshot,
    forceSlingshotCharge
  };
}

// Also add a globally accessible emergency reset function
if (typeof window !== 'undefined') {
  window.emergencySlingshotReset = function() {
    if (typeof player !== 'undefined') {
      return forceSlingshotCharge(player);
    } else {
      console.error("Player not available in global scope");
      return false;
    }
  };
}
