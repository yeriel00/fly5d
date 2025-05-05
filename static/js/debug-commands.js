/**
 * Debug commands for the game that can be run from the console
 * This includes lighting, fog controls, and other debug tools
 */

import * as THREE from 'three';
import {
  showDebugOverlay,
  debugSlingshot,
  forceSlingshotCharge,
  debugProjectiles,
  toggleLightingDebugPanel
} from './debug-utils.js';

/**
 * Register all debug commands with the game
 * @param {Object} game - The game instance
 * @param {Object} player - The player instance
 */
export function registerDebugCommands(game, player) {
  const commands = {};
  
  // Create commands object with format:
  // 'command': { handler: function, description: string, args: string }
  
  // Player debug commands
  commands['debug:slingshot'] = {
    handler: () => debugSlingshot(player),
    description: 'Debug slingshot status and settings',
    category: 'gameplay'
  };
  
  commands['debug:reset-slingshot'] = {
    handler: () => forceSlingshotCharge(player),
    description: 'Force reset slingshot to resolve issues',
    category: 'gameplay'
  };
  
  commands['debug:projectiles'] = {
    handler: () => debugProjectiles(player),
    description: 'Debug projectiles and firing',
    category: 'gameplay'
  };
  
  // Lighting and FX commands
  commands['debug:toggle-lighting'] = {
    handler: () => {
      if (!player || !player.fxManager) {
        return showDebugOverlay("FX Manager not available", {
          background: 'rgba(255,0,0,0.7)',
          duration: 3000
        });
      }
      return toggleLightingDebugPanel(player.fxManager, player.worldConfig);
    },
    description: 'Toggle lighting debug panel',
    category: 'visuals'
  };
  
  commands['debug:fog'] = {
    handler: (density = null) => {
      if (!player || !player.fxManager) {
        return showDebugOverlay("FX Manager not available", {
          background: 'rgba(255,0,0,0.7)',
          duration: 3000
        });
      }
      
      if (density === null) {
        // No argument, toggle fog on/off
        const isFogEnabled = !!player.fxManager.scene.fog;
        player.fxManager.toggleFog(!isFogEnabled);
        return showDebugOverlay(`Fog ${!isFogEnabled ? 'enabled' : 'disabled'}`, {
          duration: 2000
        });
      } else {
        // Set fog density
        const newDensity = parseFloat(density);
        if (isNaN(newDensity)) {
          return showDebugOverlay("Invalid fog density value", {
            background: 'rgba(255,0,0,0.7)',
            duration: 3000
          });
        }
        
        player.fxManager.setFogDensity(newDensity);
        return showDebugOverlay(`Fog density set to ${newDensity}`, {
          duration: 2000
        });
      }
    },
    description: 'Toggle fog or set fog density',
    args: '[density]',
    category: 'visuals'
  };
  
  commands['debug:vol-fog'] = {
    handler: (enabled = null) => {
      if (!player || !player.fxManager || !player.fxManager.volumetricFog) {
        return showDebugOverlay("Volumetric fog not available", {
          background: 'rgba(255,0,0,0.7)',
          duration: 3000
        });
      }
      
      if (enabled === null) {
        // No argument, toggle volumetric fog on/off
        const isEnabled = player.fxManager.volumetricFog.enabled;
        player.fxManager.toggleVolumeFog(!isEnabled);
        return showDebugOverlay(`Volumetric fog ${!isEnabled ? 'enabled' : 'disabled'}`, {
          duration: 2000
        });
      } else {
        // Enable/disable based on argument
        const shouldEnable = enabled === 'true' || enabled === '1' || enabled === 'on';
        player.fxManager.toggleVolumeFog(shouldEnable);
        return showDebugOverlay(`Volumetric fog ${shouldEnable ? 'enabled' : 'disabled'}`, {
          duration: 2000
        });
      }
    },
    description: 'Toggle volumetric fog on/off',
    args: '[on/off]',
    category: 'visuals'
  };
  
  commands['debug:add-light'] = {
    handler: (type = 'point') => {
      if (!player || !player.fxManager) {
        return showDebugOverlay("FX Manager not available", {
          background: 'rgba(255,0,0,0.7)',
          duration: 3000
        });
      }
      
      // Validate light type
      const validTypes = ['point', 'spot', 'directional'];
      const lightType = type.toLowerCase();
      
      if (!validTypes.includes(lightType)) {
        return showDebugOverlay(`Invalid light type: ${type}. Valid options: ${validTypes.join(', ')}`, {
          background: 'rgba(255,0,0,0.7)',
          duration: 3000
        });
      }
      
      // Get sphere radius 
      const sphereRadius = player.fxManager.sphereRadius || player.worldConfig?.radius || 400;
      
      // Calculate position based on camera
      const camera = player.getCamera();
      const cameraPos = new THREE.Vector3();
      const cameraDir = new THREE.Vector3();
      
      camera.getWorldPosition(cameraPos);
      camera.getWorldDirection(cameraDir);
      
      // Position light in front of camera
      const lightPos = cameraPos.clone().add(cameraDir.clone().multiplyScalar(sphereRadius * 0.25));
      
      // Add the light
      const result = player.fxManager.addLight(lightType, {
        position: lightPos,
        color: 0xffffaa,
        intensity: 1.0,
        castShadow: true,
        radius: sphereRadius * 0.5
      });
      
      if (result) {
        return showDebugOverlay(`Added ${lightType} light at camera position`, {
          duration: 3000
        });
      } else {
        return showDebugOverlay(`Failed to add ${lightType} light`, {
          background: 'rgba(255,0,0,0.7)',
          duration: 3000
        });
      }
    },
    description: 'Add a new light at camera position',
    args: '[point|spot|directional]',
    category: 'visuals'
  };
  
  commands['debug:reset-lights'] = {
    handler: () => {
      if (!player || !player.fxManager) {
        return showDebugOverlay("FX Manager not available", {
          background: 'rgba(255,0,0,0.7)',
          duration: 3000
        });
      }
      
      const success = player.fxManager.resetLighting();
      
      if (success) {
        return showDebugOverlay("Lighting reset to default settings", {
          duration: 3000
        });
      } else {
        return showDebugOverlay("Failed to reset lighting", {
          background: 'rgba(255,0,0,0.7)',
          duration: 3000
        });
      }
    },
    description: 'Reset all lighting to default settings',
    category: 'visuals'
  };
  
  // Register commands with the game
  if (game && game.commandSystem) {
    Object.entries(commands).forEach(([name, command]) => {
      game.commandSystem.registerCommand(name, command.handler, command.description, command.args, command.category);
    });
    
    console.log(`[Debug] Registered ${Object.keys(commands).length} debug commands`);
  } else {
    console.warn("[Debug] Could not register debug commands - command system not available");
  }
  
  // Also expose commands to window for console access
  if (typeof window !== 'undefined') {
    window.debugCommands = commands;
    
    // Add convenience functions for easier console access
    window.toggleLighting = () => commands['debug:toggle-lighting'].handler();
    window.toggleFog = () => commands['debug:fog'].handler();
    window.toggleVolFog = () => commands['debug:vol-fog'].handler();
    window.addLight = (type) => commands['debug:add-light'].handler(type);
    window.resetLights = () => commands['debug:reset-lights'].handler();
  }
  
  return commands;
}