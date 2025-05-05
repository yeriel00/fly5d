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

/**
 * Debug projectiles and make them more visible
 * @param {Object} player - The player object
 */
export function debugProjectiles(player) {
  if (!player?.weaponSystem?.projectileSystem) {
    return showDebugOverlay("Weapon system not available", { 
      background: 'rgba(255,0,0,0.7)',
      duration: 5000
    });
  }
  
  const projSystem = player.weaponSystem.projectileSystem;
  
  // Enable debugging features
  const activeCount = projSystem.enableDebugging();
  
  // Show where the projectiles are
  if (activeCount === 0) {
    // Fire a test projectile if none exist
    const camera = player.getCamera();
    const cameraPos = new THREE.Vector3();
    const cameraDir = new THREE.Vector3();
    
    camera.getWorldPosition(cameraPos);
    camera.getWorldDirection(cameraDir);
    
    // Create a test projectile
    const testPos = cameraPos.clone().add(cameraDir.clone().multiplyScalar(5));
    const testVel = cameraDir.clone().multiplyScalar(40);
    
    const testProjectile = projSystem.createProjectile(testPos, testVel, 'apple');
    console.log("Created test projectile:", testProjectile);
    
    // Add visual marker
    const markerGeo = new THREE.SphereGeometry(2, 16, 12);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.copy(testPos);
    player.scene.add(marker);
    
    // Remove marker after 5 seconds
    setTimeout(() => {
      player.scene.remove(marker);
    }, 5000);
    
    return showDebugOverlay("Test projectile created. Red sphere marks starting position.", {
      duration: 5000,
      position: 'center',
      background: 'rgba(0,100,0,0.8)'
    });
  } else {
    return showDebugOverlay(`Enhanced visibility for ${activeCount} existing projectiles.`, {
      duration: 3000,
      position: 'center',
      background: 'rgba(0,100,0,0.8)'
    });
  }
}

/**
 * Create and show a debug panel for controlling lighting and fog settings
 * @param {Object} fxManager - The FXManager instance
 * @param {Object} config - Planet configuration with radius 
 * @returns {HTMLElement} The created debug panel
 */
export function createLightingDebugPanel(fxManager, config = {}) {
  if (!fxManager) {
    return showDebugOverlay("FX Manager not available", { 
      background: 'rgba(255,0,0,0.7)',
      duration: 5000
    });
  }
  
  // Create panel container
  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.right = '10px';
  panel.style.top = '10px';
  panel.style.padding = '10px';
  panel.style.background = 'rgba(0,0,0,0.7)';
  panel.style.color = 'white';
  panel.style.fontFamily = 'monospace';
  panel.style.fontSize = '12px';
  panel.style.borderRadius = '5px';
  panel.style.zIndex = '1000';
  panel.style.maxHeight = '80vh';
  panel.style.overflowY = 'auto';
  panel.style.width = '300px';
  panel.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
  
  // Header
  const header = document.createElement('div');
  header.style.borderBottom = '1px solid #555';
  header.style.paddingBottom = '5px';
  header.style.marginBottom = '10px';
  header.style.fontWeight = 'bold';
  header.style.fontSize = '14px';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.innerHTML = '<span>🔆 Lighting & Fog Controls</span>';
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'X';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = 'white';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '14px';
  closeBtn.onclick = () => {
    document.body.removeChild(panel);
  };
  header.appendChild(closeBtn);
  
  panel.appendChild(header);
  
  // Collapsible sections
  function createSection(title, content) {
    const section = document.createElement('div');
    section.style.marginBottom = '15px';
    
    const titleBar = document.createElement('div');
    titleBar.style.fontWeight = 'bold';
    titleBar.style.padding = '5px';
    titleBar.style.background = 'rgba(50,50,80,0.6)';
    titleBar.style.cursor = 'pointer';
    titleBar.style.display = 'flex';
    titleBar.style.justifyContent = 'space-between';
    titleBar.innerHTML = `<span>${title}</span><span class="toggle">▼</span>`;
    
    const contentDiv = document.createElement('div');
    contentDiv.style.padding = '8px 5px';
    contentDiv.style.borderLeft = '2px solid #555';
    contentDiv.style.marginLeft = '5px';
    contentDiv.appendChild(content);
    
    titleBar.onclick = () => {
      contentDiv.style.display = contentDiv.style.display === 'none' ? 'block' : 'none';
      titleBar.querySelector('.toggle').textContent = contentDiv.style.display === 'none' ? '▶' : '▼';
    };
    
    section.appendChild(titleBar);
    section.appendChild(contentDiv);
    return section;
  }
  
  // Create slider control
  function createSlider(label, min, max, value, step, onChange) {
    const container = document.createElement('div');
    container.style.margin = '5px 0';
    
    const labelDiv = document.createElement('div');
    labelDiv.style.display = 'flex';
    labelDiv.style.justifyContent = 'space-between';
    
    const labelText = document.createElement('span');
    labelText.textContent = label;
    
    const valueText = document.createElement('span');
    valueText.textContent = value;
    valueText.style.opacity = '0.8';
    
    labelDiv.appendChild(labelText);
    labelDiv.appendChild(valueText);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.width = '100%';
    slider.style.margin = '5px 0';
    
    slider.oninput = () => {
      valueText.textContent = slider.value;
      if (onChange) onChange(Number(slider.value));
    };
    
    container.appendChild(labelDiv);
    container.appendChild(slider);
    return container;
  }
  
  // Create a color picker
  function createColorPicker(label, hexColor, onChange) {
    const container = document.createElement('div');
    container.style.margin = '5px 0';
    container.style.display = 'flex';
    container.style.justifyContent = 'space-between';
    container.style.alignItems = 'center';
    
    const labelElem = document.createElement('span');
    labelElem.textContent = label;
    
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = hexColor;
    colorPicker.style.width = '30px';
    colorPicker.style.height = '30px';
    colorPicker.style.border = 'none';
    colorPicker.style.padding = '0';
    colorPicker.style.background = 'none';
    
    colorPicker.oninput = () => {
      if (onChange) onChange(colorPicker.value);
    };
    
    container.appendChild(labelElem);
    container.appendChild(colorPicker);
    return container;
  }
  
  // Create a checkbox toggle
  function createToggle(label, checked, onChange) {
    const container = document.createElement('div');
    container.style.margin = '5px 0';
    container.style.display = 'flex';
    container.style.justifyContent = 'space-between';
    container.style.alignItems = 'center';
    
    const labelElem = document.createElement('span');
    labelElem.textContent = label;
    
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = checked;
    
    toggle.onchange = () => {
      if (onChange) onChange(toggle.checked);
    };
    
    container.appendChild(labelElem);
    container.appendChild(toggle);
    return container;
  }
  
  // Create a button
  function createButton(label, onClick) {
    const button = document.createElement('button');
    button.textContent = label;
    button.style.padding = '5px 10px';
    button.style.margin = '5px 0';
    button.style.background = '#2a3b66';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    button.style.width = '100%';
    
    button.onclick = onClick;
    return button;
  }
  
  // Create world scale controls
  const worldScaleContent = document.createElement('div');
  
  // Get the current sphere radius
  const sphereRadius = fxManager.sphereRadius || config.radius || 400;
  
  worldScaleContent.appendChild(
    createSlider('World Radius', 100, 1000, sphereRadius, 10, (value) => {
      fxManager.updateWorldScale(value);
      if (window.player && window.player.worldConfig) {
        window.player.worldConfig.radius = value;
      }
    })
  );
  
  // Create ambient light controls
  const ambientLightContent = document.createElement('div');
  
  if (fxManager.lights.ambientLight) {
    const ambientLight = fxManager.lights.ambientLight;
    const color = '#' + ambientLight.color.getHexString();
    
    ambientLightContent.appendChild(
      createColorPicker('Color', color, (value) => {
        ambientLight.color.set(value);
      })
    );
    
    ambientLightContent.appendChild(
      createSlider('Intensity', 0, 1, ambientLight.intensity, 0.01, (value) => {
        ambientLight.intensity = value;
      })
    );
  } else {
    ambientLightContent.textContent = 'Ambient light not available';
  }
  
  // Create directional (moon) light controls
  const moonLightContent = document.createElement('div');
  
  if (fxManager.lights.moonLight) {
    const moonLight = fxManager.lights.moonLight;
    const color = '#' + moonLight.color.getHexString();
    
    moonLightContent.appendChild(
      createColorPicker('Color', color, (value) => {
        moonLight.color.set(value);
      })
    );
    
    moonLightContent.appendChild(
      createSlider('Intensity', 0, 2, moonLight.intensity, 0.05, (value) => {
        moonLight.intensity = value;
      })
    );
    
    moonLightContent.appendChild(
      createSlider('Position X', -sphereRadius * 3, sphereRadius * 3, moonLight.position.x, 10, (value) => {
        moonLight.position.x = value;
      })
    );
    
    moonLightContent.appendChild(
      createSlider('Position Y', -sphereRadius * 3, sphereRadius * 3, moonLight.position.y, 10, (value) => {
        moonLight.position.y = value;
      })
    );
    
    moonLightContent.appendChild(
      createSlider('Position Z', -sphereRadius * 3, sphereRadius * 3, moonLight.position.z, 10, (value) => {
        moonLight.position.z = value;
      })
    );
    
    moonLightContent.appendChild(
      createToggle('Cast Shadows', moonLight.castShadow, (value) => {
        moonLight.castShadow = value;
      })
    );
  } else {
    moonLightContent.textContent = 'Moon light not available';
  }
  
  // Create add light section
  const addLightContent = document.createElement('div');
  
  // Light type selector
  const lightTypeSelect = document.createElement('select');
  lightTypeSelect.style.width = '100%';
  lightTypeSelect.style.padding = '5px';
  lightTypeSelect.style.margin = '5px 0';
  lightTypeSelect.style.background = '#333';
  lightTypeSelect.style.color = 'white';
  lightTypeSelect.style.border = '1px solid #555';
  
  ['Point Light', 'Spot Light', 'Directional Light'].forEach(type => {
    const option = document.createElement('option');
    option.value = type.toLowerCase().split(' ')[0];
    option.textContent = type;
    lightTypeSelect.appendChild(option);
  });
  
  addLightContent.appendChild(lightTypeSelect);
  
  // Add light button
  addLightContent.appendChild(
    createButton('Add New Light', () => {
      const lightType = lightTypeSelect.value;
      const position = new THREE.Vector3(
        Math.random() * sphereRadius - sphereRadius/2,
        sphereRadius * 0.5,
        Math.random() * sphereRadius - sphereRadius/2
      );
      
      const result = fxManager.addLight(lightType, {
        position,
        color: 0xffffaa,
        intensity: 1.0,
        castShadow: true,
        radius: sphereRadius * 0.6
      });
      
      if (result) {
        showDebugOverlay(`Added new ${lightType}`, {
          duration: 2000,
          position: 'bottom-center'
        });
        
        // Refresh the panel to show the new light
        document.body.removeChild(panel);
        createLightingDebugPanel(fxManager, config);
      }
    })
  );
  
  // Create additional lights controls (dynamic)
  const additionalLightsContent = document.createElement('div');
  
  // Get all lights except ambient and moon
  const additionalLights = Object.entries(fxManager.lights).filter(
    ([id, _]) => id !== 'ambientLight' && id !== 'moonLight'
  );
  
  if (additionalLights.length === 0) {
    additionalLightsContent.textContent = 'No additional lights';
  } else {
    additionalLights.forEach(([id, light]) => {
      const lightControl = document.createElement('div');
      lightControl.style.borderBottom = '1px solid #444';
      lightControl.style.paddingBottom = '10px';
      lightControl.style.marginBottom = '10px';
      
      const lightTypeLabel = document.createElement('div');
      lightTypeLabel.style.fontWeight = 'bold';
      lightTypeLabel.style.marginBottom = '5px';
      
      // Determine light type
      let lightType = 'Unknown';
      if (light instanceof THREE.PointLight) lightType = 'Point Light';
      else if (light instanceof THREE.SpotLight) lightType = 'Spot Light';
      else if (light instanceof THREE.DirectionalLight) lightType = 'Directional Light';
      
      lightTypeLabel.textContent = `${lightType} [${id}]`;
      lightControl.appendChild(lightTypeLabel);
      
      // Common controls
      const color = '#' + light.color.getHexString();
      
      lightControl.appendChild(
        createColorPicker('Color', color, (value) => {
          fxManager.adjustLight(id, { color: value });
        })
      );
      
      lightControl.appendChild(
        createSlider('Intensity', 0, 2, light.intensity, 0.05, (value) => {
          fxManager.adjustLight(id, { intensity: value });
        })
      );
      
      // Position controls
      lightControl.appendChild(
        createSlider('Position X', -sphereRadius * 2, sphereRadius * 2, light.position.x, 10, (value) => {
          fxManager.adjustLight(id, { position: [value, light.position.y, light.position.z] });
        })
      );
      
      lightControl.appendChild(
        createSlider('Position Y', -sphereRadius * 2, sphereRadius * 2, light.position.y, 10, (value) => {
          fxManager.adjustLight(id, { position: [light.position.x, value, light.position.z] });
        })
      );
      
      lightControl.appendChild(
        createSlider('Position Z', -sphereRadius * 2, sphereRadius * 2, light.position.z, 10, (value) => {
          fxManager.adjustLight(id, { position: [light.position.x, light.position.y, value] });
        })
      );
      
      // Type specific controls
      if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        lightControl.appendChild(
          createSlider('Distance', 0, sphereRadius * 3, light.distance, 10, (value) => {
            fxManager.adjustLight(id, { distance: value });
          })
        );
        
        lightControl.appendChild(
          createSlider('Decay', 0, 2, light.decay, 0.1, (value) => {
            fxManager.adjustLight(id, { decay: value });
          })
        );
      }
      
      if (light instanceof THREE.SpotLight) {
        const angleInDegrees = THREE.MathUtils.radToDeg(light.angle);
        
        lightControl.appendChild(
          createSlider('Angle', 5, 90, angleInDegrees, 1, (value) => {
            const angleInRadians = THREE.MathUtils.degToRad(value);
            fxManager.adjustLight(id, { angle: angleInRadians });
          })
        );
        
        lightControl.appendChild(
          createSlider('Penumbra', 0, 1, light.penumbra, 0.01, (value) => {
            fxManager.adjustLight(id, { penumbra: value });
          })
        );
      }
      
      // Shadow toggle
      lightControl.appendChild(
        createToggle('Cast Shadows', light.castShadow, (value) => {
          fxManager.adjustLight(id, { castShadow: value });
        })
      );
      
      // Remove button
      lightControl.appendChild(
        createButton('Remove Light', () => {
          if (fxManager.removeLight(id)) {
            showDebugOverlay('Light removed', {
              duration: 2000,
              position: 'bottom-center'
            });
            
            // Refresh the panel
            document.body.removeChild(panel);
            createLightingDebugPanel(fxManager, config);
          }
        })
      );
      
      additionalLightsContent.appendChild(lightControl);
    });
  }
  
  // Create fog controls
  const fogControlsContent = document.createElement('div');
  
  if (fxManager.fog) {
    const fog = fxManager.fog;
    const color = '#' + fog.color.getHexString();
    
    fogControlsContent.appendChild(
      createToggle('Enable Fog', !!fxManager.scene.fog, (value) => {
        fxManager.toggleFog(value);
      })
    );
    
    fogControlsContent.appendChild(
      createColorPicker('Fog Color', color, (value) => {
        fxManager.setFogColor(value);
      })
    );
    
    fogControlsContent.appendChild(
      createSlider('Fog Density', 0, 0.02, fog.density, 0.0005, (value) => {
        fxManager.setFogDensity(value);
      })
    );
  } else {
    fogControlsContent.textContent = 'Fog not available';
  }
  
  // Create volumetric fog controls
  const volFogContent = document.createElement('div');
  
  if (fxManager.volumetricFog) {
    volFogContent.appendChild(
      createToggle('Enable Volumetric Fog', fxManager.volumetricFog.enabled, (value) => {
        fxManager.toggleVolumeFog(value);
      })
    );
    
    // Create main fog settings
    volFogContent.appendChild(
      createSlider('Fog Density', 0, 0.001, 0.00015, 0.00001, (value) => {
        fxManager.adjustFogSettings({ fogDensity: value });
      })
    );
    
    volFogContent.appendChild(
      createSlider('Fog Intensity', 0, 50, 25, 1, (value) => {
        fxManager.adjustFogSettings({ fogIntensity: value });
      })
    );
    
    // Create ground fog settings
    volFogContent.appendChild(
      createSlider('Ground Fog Density', 0, 5, 2, 0.1, (value) => {
        fxManager.adjustFogSettings({ groundFogDensity: value });
      })
    );
    
    volFogContent.appendChild(
      createSlider('Ground Fog Height', 0, 30, 15, 1, (value) => {
        fxManager.adjustFogSettings({ groundFogHeight: value });
      })
    );
    
    // Create noise settings
    volFogContent.appendChild(
      createSlider('Noise Scale', 0.001, 0.02, 0.007, 0.001, (value) => {
        fxManager.adjustFogSettings({ noiseScale: value });
      })
    );
    
    volFogContent.appendChild(
      createSlider('Noise Intensity', 0, 1, 0.3, 0.05, (value) => {
        fxManager.adjustFogSettings({ noiseIntensity: value });
      })
    );
    
    volFogContent.appendChild(
      createSlider('Noise Speed', 0, 0.1, 0.03, 0.01, (value) => {
        fxManager.adjustFogSettings({ noiseSpeed: value });
      })
    );
  } else {
    volFogContent.textContent = 'Volumetric fog not available';
  }
  
  // Add reset buttons
  const resetContent = document.createElement('div');
  
  resetContent.appendChild(
    createButton('Reset All Lighting to Default', () => {
      fxManager.resetLighting();
      showDebugOverlay('Lighting reset to default settings', {
        duration: 2000,
        position: 'bottom-center'
      });
      
      // Refresh the panel
      document.body.removeChild(panel);
      createLightingDebugPanel(fxManager, config);
    })
  );
  
  // Add all sections to panel
  panel.appendChild(createSection('🌐 World Scale', worldScaleContent));
  panel.appendChild(createSection('💡 Ambient Light', ambientLightContent));
  panel.appendChild(createSection('🌙 Moon Light', moonLightContent));
  panel.appendChild(createSection('➕ Add Light', addLightContent));
  panel.appendChild(createSection('🔦 Additional Lights', additionalLightsContent));
  panel.appendChild(createSection('🌫️ Fog Settings', fogControlsContent));
  panel.appendChild(createSection('🌫️ Volumetric Fog', volFogContent));
  panel.appendChild(createSection('↩️ Reset', resetContent));
  
  document.body.appendChild(panel);
  return panel;
}

/**
 * Toggle debug lighting panel visibility
 * @param {Object} fxManager - The FXManager instance
 * @param {Object} config - Optional planet configuration object
 */
export function toggleLightingDebugPanel(fxManager, config = {}) {
  // Check if panel already exists
  const existingPanel = document.querySelector('#lighting-debug-panel');
  
  if (existingPanel) {
    // Remove existing panel
    existingPanel.remove();
    return showDebugOverlay("Lighting panel closed", {
      duration: 1000,
      position: 'bottom-center'
    });
  } else {
    // Create new panel
    const panel = createLightingDebugPanel(fxManager, config);
    panel.id = 'lighting-debug-panel';
    return panel;
  }
}

// Export debug utilities to window for console access
if (typeof window !== 'undefined') {
  window.debugUtils = {
    showDebugOverlay,
    debugSlingshot,
    forceSlingshotCharge,
    debugProjectiles,
    createLightingDebugPanel,
    toggleLightingDebugPanel
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
  
  // Add direct shortcut for convenience
  window.debugApples = function() {
    if (typeof player !== 'undefined') {
      return debugProjectiles(player);
    } else {
      console.error("Player not available in global scope");
      return false;
    }
  };
}
