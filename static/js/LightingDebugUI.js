import * as THREE from 'three';

/**
 * Debug UI for lighting and fog controls
 */
export default class LightingDebugUI {
  /**
   * @param {FXManager} fxManager - The FX manager instance
   * @param {Object} config - Configuration options
   */
  constructor(fxManager, config = {}) {
    this.fxManager = fxManager;
    this.scene = fxManager.scene;
    this.camera = fxManager.camera;
    this.renderer = fxManager.renderer;
    
    // Get the sphere radius from the fxManager
    this.sphereRadius = fxManager.sphereRadius || 400;
    
    this.config = Object.assign({
      position: { x: 10, y: 10 },
      width: 300,
      visible: false,
      title: "Lighting & Fog Controls",
      opacity: 0.85,
    }, config);
    
    this.panels = {};
    this.controls = {};
    
    // Initialize UI
    this._init();
    
    // Store default values for reset functionality
    this._storeDefaultValues();
  }
  
  /**
   * Store the initial values of lighting and fog for reset functionality
   * @private
   */
  _storeDefaultValues() {
    this.defaultValues = {
      ambientLight: this.fxManager.lights.ambientLight ? {
        color: this.fxManager.lights.ambientLight.color.clone(),
        intensity: this.fxManager.lights.ambientLight.intensity
      } : null,
      
      mainLight: this.fxManager.lights.moonLight ? {
        color: this.fxManager.lights.moonLight.color.clone(),
        intensity: this.fxManager.lights.moonLight.intensity,
        position: this.fxManager.lights.moonLight.position.clone()
      } : null,
      
      fog: this.scene.fog ? {
        color: this.scene.fog.color.clone(),
        density: this.scene.fog.density,
        near: this.scene.fog.near,
        far: this.scene.fog.far
      } : null,
      
      volumetricFog: this.fxManager.volumetricFog ? {
        enabled: this.fxManager.volumetricFog.enabled,
        options: { ...this.fxManager.volumetricFog.options }
      } : null
    };
  }
  
  /**
   * Initialize the debug UI
   * @private
   */
  _init() {
    // Create main container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = `${this.config.position.x}px`;
    container.style.top = `${this.config.position.y}px`;
    container.style.width = `${this.config.width}px`;
    container.style.backgroundColor = `rgba(0, 0, 0, ${this.config.opacity})`;
    container.style.color = 'white';
    container.style.fontFamily = 'monospace';
    container.style.padding = '10px';
    container.style.borderRadius = '5px';
    container.style.zIndex = '1000';
    container.style.display = this.config.visible ? 'block' : 'none';
    container.style.maxHeight = '80vh';
    container.style.overflowY = 'auto';
    
    // Title bar
    const titleBar = document.createElement('div');
    titleBar.innerHTML = this.config.title;
    titleBar.style.fontWeight = 'bold';
    titleBar.style.marginBottom = '10px';
    titleBar.style.borderBottom = '1px solid #555';
    titleBar.style.paddingBottom = '5px';
    container.appendChild(titleBar);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.right = '10px';
    closeBtn.style.top = '10px';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'white';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => this.toggle(false);
    container.appendChild(closeBtn);
    
    // Main UI sections
    this._createAmbientLightControls(container);
    this._createMainLightControls(container);
    this._createFogControls(container);
    this._createVolumetricFogControls(container);
    this._createPresetButtons(container);
    
    // Add to document
    document.body.appendChild(container);
    this.container = container;
    
    console.log('[LightingDebugUI] Debug controls initialized');
  }
  
  /**
   * Create controls for ambient light
   * @param {HTMLElement} parent - Container element
   * @private
   */
  _createAmbientLightControls(parent) {
    const panel = this._createPanel(parent, 'Ambient Light');
    
    const ambientLight = this.fxManager.lights.ambientLight;
    if (ambientLight) {
      // Intensity slider
      this._createSlider(panel, 'Intensity', 0, 3, 0.01, ambientLight.intensity, (value) => {
        ambientLight.intensity = value;
      });
      
      // Color picker
      this._createColorPicker(panel, 'Color', ambientLight.color.getHexString(), (value) => {
        ambientLight.color.set(value);
      });
    } else {
      panel.innerHTML += '<p>Ambient light not available</p>';
    }
    
    this.panels.ambientLight = panel;
  }
  
  /**
   * Create controls for main directional light
   * @param {HTMLElement} parent - Container element
   * @private
   */
  _createMainLightControls(parent) {
    const panel = this._createPanel(parent, 'Main Light');
    
    const mainLight = this.fxManager.lights.moonLight;
    if (mainLight) {
      // Intensity slider
      this._createSlider(panel, 'Intensity', 0, 3, 0.01, mainLight.intensity, (value) => {
        mainLight.intensity = value;
      });
      
      // Color picker
      this._createColorPicker(panel, 'Color', mainLight.color.getHexString(), (value) => {
        mainLight.color.set(value);
      });
      
      // Shadow toggle
      this._createCheckbox(panel, 'Cast Shadows', mainLight.castShadow, (value) => {
        mainLight.castShadow = value;
      });
      
      // Position controls
      this._createVector3Control(panel, 'Position', mainLight.position, (value) => {
        mainLight.position.copy(value);
      });
    } else {
      panel.innerHTML += '<p>Main light not available</p>';
    }
    
    this.panels.mainLight = panel;
  }
  
  /**
   * Create controls for atmospheric fog
   * @param {HTMLElement} parent - Container element
   * @private
   */
  _createFogControls(parent) {
    const panel = this._createPanel(parent, 'Atmospheric Fog');
    
    // Fog toggle
    this._createCheckbox(panel, 'Enabled', this.scene.fog !== null, (value) => {
      this.fxManager.toggleFog(value);
    });
    
    if (this.scene.fog || this.fxManager.fog) {
      const fog = this.scene.fog || this.fxManager.fog;
      
      // Color picker
      this._createColorPicker(panel, 'Color', fog.color.getHexString(), (value) => {
        this.fxManager.setFogColor(value);
      });
      
      // Density slider (if FogExp2)
      if (fog.density !== undefined) {
        this._createSlider(panel, 'Density', 0, 0.01, 0.0001, fog.density, (value) => {
          this.fxManager.setFogDensity(value);
        });
      }
      
      // Near/far sliders (if Fog)
      if (fog.near !== undefined) {
        this._createSlider(panel, 'Near', 1, 1000, 1, fog.near, (value) => {
          fog.near = value;
        });
      }
      
      if (fog.far !== undefined) {
        this._createSlider(panel, 'Far', 1, 5000, 1, fog.far, (value) => {
          fog.far = value;
        });
      }
    }
    
    this.panels.fog = panel;
  }
  
  /**
   * Create controls for volumetric ground fog
   * @param {HTMLElement} parent - Container element
   * @private
   */
  _createVolumetricFogControls(parent) {
    const panel = this._createPanel(parent, 'Volumetric Ground Fog');
    
    if (this.fxManager.volumetricFog) {
      const volFog = this.fxManager.volumetricFog;
      
      // Enabled toggle
      this._createCheckbox(panel, 'Enabled', volFog.enabled, (value) => {
        this.fxManager.toggleVolumeFog(value);
      });
      
      // Advanced settings (collapsible)
      const advancedBtn = document.createElement('button');
      advancedBtn.textContent = '+ Show Advanced Settings';
      advancedBtn.style.marginTop = '10px';
      advancedBtn.style.width = '100%';
      advancedBtn.style.padding = '5px';
      panel.appendChild(advancedBtn);
      
      const advancedPanel = document.createElement('div');
      advancedPanel.style.display = 'none';
      advancedPanel.style.marginTop = '10px';
      advancedPanel.style.borderTop = '1px dashed #555';
      advancedPanel.style.paddingTop = '10px';
      panel.appendChild(advancedPanel);
      
      advancedBtn.onclick = () => {
        const isVisible = advancedPanel.style.display === 'block';
        advancedPanel.style.display = isVisible ? 'none' : 'block';
        advancedBtn.textContent = isVisible ? '+ Show Advanced Settings' : '- Hide Advanced Settings';
      };

      // Main visible controls
      this._createSlider(panel, 'Height', 1, 100, 1, volFog.options.groundFogHeight, (value) => {
        this.fxManager.adjustFogSettings({ groundFogHeight: value });
      });
      
      this._createSlider(panel, 'Density', 0, 5, 0.1, volFog.options.groundFogDensity, (value) => {
        this.fxManager.adjustFogSettings({ groundFogDensity: value });
      });
      
      this._createSlider(panel, 'Intensity', 1, 100, 1, volFog.options.fogIntensity, (value) => {
        this.fxManager.adjustFogSettings({ fogIntensity: value });
      });
      
      // Top fog color
      this._createColorPicker(panel, 'Top Color', new THREE.Color(volFog.options.fogColor).getHexString(), (value) => {
        this.fxManager.adjustFogSettings({ fogColor: new THREE.Color(value) });
      });
      
      // Bottom fog color
      this._createColorPicker(panel, 'Bottom Color', new THREE.Color(volFog.options.fogColorBottom).getHexString(), (value) => {
        this.fxManager.adjustFogSettings({ fogColorBottom: new THREE.Color(value) });
      });
      
      // Advanced controls (in collapsible panel)
      this._createSlider(advancedPanel, 'Noise Scale', 0.001, 0.05, 0.001, volFog.options.fogNoiseScale, (value) => {
        this.fxManager.adjustFogSettings({ fogNoiseScale: value });
      });
      
      this._createSlider(advancedPanel, 'Noise Speed', 0, 0.2, 0.01, volFog.options.fogNoiseSpeed, (value) => {
        this.fxManager.adjustFogSettings({ fogNoiseSpeed: value });
      });
      
      this._createSlider(advancedPanel, 'Global Fog Density', 0.00001, 0.001, 0.00001, volFog.options.fogDensity, (value) => {
        this.fxManager.adjustFogSettings({ fogDensity: value });
      });
    } else {
      panel.innerHTML += '<p>Volumetric fog not available</p>';
    }
    
    this.panels.volumetricFog = panel;
  }
  
  /**
   * Create preset buttons for different lighting scenarios
   * @param {HTMLElement} parent - Container element 
   * @private
   */
  _createPresetButtons(parent) {
    const panel = this._createPanel(parent, 'Lighting Presets');
    
    const createPresetButton = (name, action) => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.style.marginRight = '5px';
      btn.style.marginBottom = '5px';
      btn.style.padding = '5px 10px';
      btn.onclick = action;
      return btn;
    };
    
    // Reset to defaults button
    panel.appendChild(createPresetButton('Reset Defaults', () => {
      this.fxManager.resetLighting();
      
      // Reset fog to defaults
      if (this.fxManager.fog && this.fxManager.fogSettings) {
        this.fxManager.setFogColor(this.fxManager.fogSettings.originalColor);
        this.fxManager.setFogDensity(this.fxManager.fogSettings.originalDensity);
      }
      
      // Reset volumetric fog
      if (this.fxManager.volumetricFog && this.fxManager.volumetricFogDefaults) {
        this.fxManager.adjustFogSettings(this.fxManager.volumetricFogDefaults);
      }
      
      // Update UI values
      this.refresh();
    }));
    
    // Night preset
    panel.appendChild(createPresetButton('Night', () => {
      // Dim ambient light
      if (this.fxManager.lights.ambientLight) {
        this.fxManager.lights.ambientLight.color.set(0x101025);
        this.fxManager.lights.ambientLight.intensity = 0.1;
      }
      
      // Blue-ish moonlight
      if (this.fxManager.lights.moonLight) {
        this.fxManager.lights.moonLight.color.set(0x8080ff);
        this.fxManager.lights.moonLight.intensity = 0.3;
      }
      
      // Dark blue fog
      if (this.scene.fog) {
        this.fxManager.setFogColor(0x050530);
        this.fxManager.setFogDensity(0.002);
      }
      
      // Update volumetric fog
      if (this.fxManager.volumetricFog) {
        this.fxManager.adjustFogSettings({
          fogColor: new THREE.Color(0x101060),
          fogColorBottom: new THREE.Color(0x000015),
          fogIntensity: 15,
          groundFogHeight: 25
        });
      }
      
      // Update UI values
      this.refresh();
    }));
    
    // Sunset preset
    panel.appendChild(createPresetButton('Sunset', () => {
      // Warm ambient
      if (this.fxManager.lights.ambientLight) {
        this.fxManager.lights.ambientLight.color.set(0x553322);
        this.fxManager.lights.ambientLight.intensity = 0.4;
      }
      
      // Orange-red sun
      if (this.fxManager.lights.moonLight) {
        this.fxManager.lights.moonLight.color.set(0xff7733);
        this.fxManager.lights.moonLight.intensity = 0.8;
      }
      
      // Orange-ish fog
      if (this.scene.fog) {
        this.fxManager.setFogColor(0xFF5500);
        this.fxManager.setFogDensity(0.0015);
      }
      
      // Update volumetric fog
      if (this.fxManager.volumetricFog) {
        this.fxManager.adjustFogSettings({
          fogColor: new THREE.Color(0xff9955),
          fogColorBottom: new THREE.Color(0xbb4400),
          fogIntensity: 40,
          groundFogHeight: 20
        });
      }
      
      // Update UI values
      this.refresh();
    }));
    
    // Foggy preset
    panel.appendChild(createPresetButton('Dense Fog', () => {
      // Dim ambient for fog
      if (this.fxManager.lights.ambientLight) {
        this.fxManager.lights.ambientLight.color.set(0xaaaaaa);
        this.fxManager.lights.ambientLight.intensity = 0.6;
      }
      
      // Dim directional light
      if (this.fxManager.lights.moonLight) {
        this.fxManager.lights.moonLight.color.set(0xffffff);
        this.fxManager.lights.moonLight.intensity = 0.3;
      }
      
      // Dense white fog
      if (this.scene.fog) {
        this.fxManager.setFogColor(0xcccccc);
        this.fxManager.setFogDensity(0.005);
      }
      
      // Update volumetric fog
      if (this.fxManager.volumetricFog) {
        this.fxManager.adjustFogSettings({
          fogColor: new THREE.Color(0xcccccc),
          fogColorBottom: new THREE.Color(0xeeeeee),
          fogIntensity: 80,
          groundFogHeight: 60,
          groundFogDensity: 4,
          fogNoiseScale: 0.003
        });
        this.fxManager.toggleVolumeFog(true);
      }
      
      // Update UI values
      this.refresh();
    }));
    
    // No fog preset
    panel.appendChild(createPresetButton('No Fog', () => {
      // Disable atmospheric fog
      this.fxManager.toggleFog(false);
      
      // Disable volumetric fog
      if (this.fxManager.volumetricFog) {
        this.fxManager.toggleVolumeFog(false);
      }
      
      // Bright lighting
      if (this.fxManager.lights.ambientLight) {
        this.fxManager.lights.ambientLight.intensity = 0.5;
      }
      
      // Update UI values
      this.refresh();
    }));
    
    this.panels.presets = panel;
  }
  
  /**
   * Create a section panel with title
   * @param {HTMLElement} parent - Parent container
   * @param {string} title - Panel title
   * @returns {HTMLElement} Created panel element
   * @private
   */
  _createPanel(parent, title) {
    const panel = document.createElement('div');
    panel.style.marginBottom = '15px';
    
    const titleElem = document.createElement('div');
    titleElem.innerHTML = title;
    titleElem.style.fontWeight = 'bold';
    titleElem.style.marginBottom = '5px';
    panel.appendChild(titleElem);
    
    parent.appendChild(panel);
    return panel;
  }
  
  /**
   * Create a slider control
   * @param {HTMLElement} parent - Parent element
   * @param {string} label - Control label
   * @param {number} min - Min value
   * @param {number} max - Max value
   * @param {number} step - Step increment
   * @param {number} value - Initial value
   * @param {Function} onChange - Value change callback
   * @private
   */
  _createSlider(parent, label, min, max, step, value, onChange) {
    const container = document.createElement('div');
    container.style.marginBottom = '8px';
    
    const labelElem = document.createElement('label');
    labelElem.textContent = label;
    labelElem.style.display = 'block';
    labelElem.style.marginBottom = '3px';
    container.appendChild(labelElem);
    
    const controlRow = document.createElement('div');
    controlRow.style.display = 'flex';
    controlRow.style.alignItems = 'center';
    container.appendChild(controlRow);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.flex = '1';
    controlRow.appendChild(slider);
    
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = value.toFixed(4);
    valueDisplay.style.marginLeft = '10px';
    valueDisplay.style.minWidth = '60px';
    controlRow.appendChild(valueDisplay);
    
    slider.oninput = () => {
      const numValue = parseFloat(slider.value);
      valueDisplay.textContent = numValue.toFixed(4);
      onChange(numValue);
    };
    
    parent.appendChild(container);
    
    // Store reference
    this.controls[`${label.toLowerCase().replace(/\s/g, '_')}_slider`] = {
      control: slider,
      display: valueDisplay,
      setValue: (val) => {
        slider.value = val;
        valueDisplay.textContent = val.toFixed(4);
      },
      getValue: () => parseFloat(slider.value)
    };
    
    return container;
  }
  
  /**
   * Create a color picker control
   * @param {HTMLElement} parent - Parent element
   * @param {string} label - Control label
   * @param {string} value - Initial color value in hex string (without #)
   * @param {Function} onChange - Color change callback
   * @private
   */
  _createColorPicker(parent, label, value, onChange) {
    const container = document.createElement('div');
    container.style.marginBottom = '8px';
    
    const labelElem = document.createElement('label');
    labelElem.textContent = label;
    labelElem.style.display = 'block';
    labelElem.style.marginBottom = '3px';
    container.appendChild(labelElem);
    
    const controlRow = document.createElement('div');
    controlRow.style.display = 'flex';
    controlRow.style.alignItems = 'center';
    container.appendChild(controlRow);
    
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = `#${value}`;
    controlRow.appendChild(colorPicker);
    
    const valueDisplay = document.createElement('input');
    valueDisplay.type = 'text';
    valueDisplay.value = `#${value}`;
    valueDisplay.style.marginLeft = '10px';
    valueDisplay.style.width = '80px';
    controlRow.appendChild(valueDisplay);
    
    colorPicker.oninput = () => {
      valueDisplay.value = colorPicker.value;
      onChange(colorPicker.value);
    };
    
    valueDisplay.onchange = () => {
      // Validate as hex color
      if (/^#[0-9A-Fa-f]{6}$/.test(valueDisplay.value)) {
        colorPicker.value = valueDisplay.value;
        onChange(valueDisplay.value);
      } else {
        // Reset to picker value if invalid
        valueDisplay.value = colorPicker.value;
      }
    };
    
    parent.appendChild(container);
    
    // Store reference
    this.controls[`${label.toLowerCase().replace(/\s/g, '_')}_color`] = {
      control: colorPicker,
      display: valueDisplay,
      setValue: (val) => {
        if (!val.startsWith('#')) val = `#${val}`;
        colorPicker.value = val;
        valueDisplay.value = val;
      },
      getValue: () => colorPicker.value
    };
    
    return container;
  }
  
  /**
   * Create a checkbox control
   * @param {HTMLElement} parent - Parent element
   * @param {string} label - Control label
   * @param {boolean} checked - Initial checked state
   * @param {Function} onChange - Change callback
   * @private
   */
  _createCheckbox(parent, label, checked, onChange) {
    const container = document.createElement('div');
    container.style.marginBottom = '8px';
    
    const controlRow = document.createElement('div');
    controlRow.style.display = 'flex';
    controlRow.style.alignItems = 'center';
    container.appendChild(controlRow);
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.id = `checkbox_${label.toLowerCase().replace(/\s/g, '_')}`;
    controlRow.appendChild(checkbox);
    
    const labelElem = document.createElement('label');
    labelElem.textContent = label;
    labelElem.htmlFor = checkbox.id;
    labelElem.style.marginLeft = '5px';
    controlRow.appendChild(labelElem);
    
    checkbox.onchange = () => {
      onChange(checkbox.checked);
    };
    
    parent.appendChild(container);
    
    // Store reference
    this.controls[`${label.toLowerCase().replace(/\s/g, '_')}_checkbox`] = {
      control: checkbox,
      setValue: (val) => { checkbox.checked = val; },
      getValue: () => checkbox.checked
    };
    
    return container;
  }
  
  /**
   * Create a vector3 control with X, Y, Z sliders
   * @param {HTMLElement} parent - Parent element
   * @param {string} label - Control label
   * @param {THREE.Vector3} vector - Vector to control
   * @param {Function} onChange - Change callback
   * @private
   */
  _createVector3Control(parent, label, vector, onChange) {
    const container = document.createElement('div');
    container.style.marginBottom = '8px';
    
    const labelElem = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${label} (${vector.x.toFixed(1)}, ${vector.y.toFixed(1)}, ${vector.z.toFixed(1)})`;
    summary.style.cursor = 'pointer';
    labelElem.appendChild(summary);
    container.appendChild(labelElem);
    
    const controlsPanel = document.createElement('div');
    controlsPanel.style.paddingLeft = '10px';
    controlsPanel.style.marginTop = '5px';
    labelElem.appendChild(controlsPanel);
    
    // Create sliders for X, Y, Z
    ['x', 'y', 'z'].forEach(axis => {
      const axisContainer = document.createElement('div');
      axisContainer.style.marginBottom = '5px';
      axisContainer.style.display = 'flex';
      axisContainer.style.alignItems = 'center';
      
      const axisLabel = document.createElement('span');
      axisLabel.textContent = axis.toUpperCase();
      axisLabel.style.width = '15px';
      axisContainer.appendChild(axisLabel);
      
      const axisSlider = document.createElement('input');
      axisSlider.type = 'range';
      axisSlider.min = -1000; 
      axisSlider.max = 1000;
      axisSlider.step = 1;
      axisSlider.value = vector[axis];
      axisSlider.style.flex = '1';
      axisContainer.appendChild(axisSlider);
      
      const axisValue = document.createElement('input');
      axisValue.type = 'number';
      axisValue.value = vector[axis];
      axisValue.style.width = '60px';
      axisValue.style.marginLeft = '5px';
      axisContainer.appendChild(axisValue);
      
      axisSlider.oninput = () => {
        const value = parseFloat(axisSlider.value);
        vector[axis] = value;
        axisValue.value = value;
        summary.textContent = `${label} (${vector.x.toFixed(1)}, ${vector.y.toFixed(1)}, ${vector.z.toFixed(1)})`;
        onChange(vector);
      };
      
      axisValue.onchange = () => {
        const value = parseFloat(axisValue.value);
        vector[axis] = value;
        axisSlider.value = value;
        summary.textContent = `${label} (${vector.x.toFixed(1)}, ${vector.y.toFixed(1)}, ${vector.z.toFixed(1)})`;
        onChange(vector);
      };
      
      controlsPanel.appendChild(axisContainer);
      
      // Store reference
      this.controls[`${label.toLowerCase().replace(/\s/g, '_')}_${axis}`] = {
        slider: axisSlider,
        input: axisValue,
        setValue: (val) => { 
          axisSlider.value = val; 
          axisValue.value = val;
          vector[axis] = val;
        },
        getValue: () => parseFloat(axisSlider.value)
      };
    });
    
    parent.appendChild(container);
    return container;
  }
  
  /**
   * Toggle UI visibility
   * @param {boolean} [visible] - If provided, set to this value, otherwise toggle
   */
  toggle(visible) {
    if (visible === undefined) {
      visible = this.container.style.display === 'none';
    }
    
    this.container.style.display = visible ? 'block' : 'none';
    this.config.visible = visible;
  }
  
  /**
   * Refresh UI controls to match current values
   */
  refresh() {
    // Update ambient light controls
    const ambientLight = this.fxManager.lights.ambientLight;
    if (ambientLight) {
      const intensityControl = this.controls.intensity_slider;
      if (intensityControl) {
        intensityControl.setValue(ambientLight.intensity);
      }
      
      const colorControl = this.controls.color_color;
      if (colorControl) {
        colorControl.setValue(`#${ambientLight.color.getHexString()}`);
      }
    }
    
    // Update main light controls
    const mainLight = this.fxManager.lights.moonLight;
    if (mainLight) {
      if (this.controls.intensity_slider) {
        this.controls.intensity_slider.setValue(mainLight.intensity);
      }
      
      if (this.controls.color_color) {
        this.controls.color_color.setValue(`#${mainLight.color.getHexString()}`);
      }
      
      if (this.controls.cast_shadows_checkbox) {
        this.controls.cast_shadows_checkbox.setValue(mainLight.castShadow);
      }
    }
    
    // Update fog controls
    const fog = this.scene.fog || this.fxManager.fog;
    if (fog) {
      if (this.controls.enabled_checkbox) {
        this.controls.enabled_checkbox.setValue(this.scene.fog !== null);
      }
      
      if (this.controls.color_color) {
        this.controls.color_color.setValue(`#${fog.color.getHexString()}`);
      }
      
      if (fog.density !== undefined && this.controls.density_slider) {
        this.controls.density_slider.setValue(fog.density);
      }
    }
    
    // Update volumetric fog controls
    const volFog = this.fxManager.volumetricFog;
    if (volFog) {
      if (this.controls.enabled_checkbox) {
        this.controls.enabled_checkbox.setValue(volFog.enabled);
      }
      
      if (this.controls.height_slider) {
        this.controls.height_slider.setValue(volFog.options.groundFogHeight);
      }
      
      if (this.controls.density_slider) {
        this.controls.density_slider.setValue(volFog.options.groundFogDensity);
      }
      
      if (this.controls.intensity_slider) {
        this.controls.intensity_slider.setValue(volFog.options.fogIntensity);
      }
      
      if (this.controls.top_color_color) {
        this.controls.top_color_color.setValue(`#${new THREE.Color(volFog.options.fogColor).getHexString()}`);
      }
      
      if (this.controls.bottom_color_color) {
        this.controls.bottom_color_color.setValue(`#${new THREE.Color(volFog.options.fogColorBottom).getHexString()}`);
      }
    }
  }
}

/**
 * Register lighting debug commands
 * @param {Object} debugCommands - Debug commands registry
 * @param {Object} fxManager - FX Manager instance
 * @param {Object} debugUtils - Debug utilities
 */
export function registerLightingDebugCommands(debugCommands, fxManager, debugUtils) {
  // Create the lighting debug UI
  const lightingDebugUI = new LightingDebugUI(fxManager, debugUtils);
  
  // Register commands
  debugCommands.register({
    name: 'lighting',
    description: 'Toggle lighting debug panel',
    handler: () => {
      return lightingDebugUI.toggle();
    }
  });
  
  debugCommands.register({
    name: 'fog',
    description: 'Toggle fog debug panel',
    handler: () => {
      lightingDebugUI.show();
      // Switch to fog tab
      const fogTab = document.getElementById('fog-tab');
      if (fogTab) {
        fogTab.click();
      }
      return true;
    }
  });
  
  debugCommands.register({
    name: 'light_point',
    description: 'Add a point light at current position',
    handler: (args, player) => {
      if (!player || !player.position) {
        console.warn('Cannot add light: player position not available');
        return false;
      }
      
      const position = player.position.clone().add(new THREE.Vector3(0, 5, 0));
      const { id } = fxManager.addLight('point', {
        color: 0xffffff,
        intensity: 1.0,
        position,
        castShadow: true,
        radius: fxManager.sphereRadius * 0.2
      });
      
      console.log(`Added point light with ID: ${id}`);
      return true;
    }
  });
  
  debugCommands.register({
    name: 'light_reset',
    description: 'Reset all lighting to defaults',
    handler: () => {
      fxManager.resetLighting();
      lightingDebugUI.updateUI();
      return true;
    }
  });
  
  return lightingDebugUI;
}