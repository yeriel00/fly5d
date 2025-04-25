/**
 * Performance manager to optimize game performance
 */
export default class PerformanceManager {
  /**
   * Create a new performance manager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      renderer: null,           // THREE.WebGLRenderer
      scene: null,              // THREE.Scene
      systems: {},              // Game systems (like appleSystem, etc.)
      initialMode: 'auto',      // 'high', 'medium', 'low', or 'auto'
      fpsTarget: 45,            // Target FPS
      fpsMonitorElement: null,  // Element to display FPS
      autoAdjust: true          // Whether to automatically adjust settings
    }, options);

    // Performance metrics
    this.metrics = {
      fps: 0,
      framesThisSecond: 0,
      lastFpsUpdate: performance.now(),
      frameTimeHistory: [],
      adjustmentCooldown: 0
    };

    // Apply initial mode
    if (this.options.initialMode === 'auto') {
      this._detectOptimalSettings();
    } else {
      this.setQualityMode(this.options.initialMode);
    }

    // Setup FPS monitoring
    this._setupFpsMonitoring();
  }

  /**
   * Set up FPS monitoring
   * @private
   */
  _setupFpsMonitoring() {
    // Create or use existing FPS display
    if (this.options.fpsMonitorElement) {
      this.fpsDisplay = this.options.fpsMonitorElement;
    } else {
      this.fpsDisplay = document.createElement('div');
      this.fpsDisplay.id = 'performance-fps';
      this.fpsDisplay.style.position = 'absolute';
      this.fpsDisplay.style.top = '5px';
      this.fpsDisplay.style.left = '5px';
      this.fpsDisplay.style.backgroundColor = 'rgba(0,0,0,0.5)';
      this.fpsDisplay.style.color = 'white';
      this.fpsDisplay.style.padding = '4px 8px';
      this.fpsDisplay.style.fontFamily = 'monospace';
      this.fpsDisplay.style.fontSize = '12px';
      this.fpsDisplay.style.borderRadius = '3px';
      this.fpsDisplay.style.zIndex = '1000';
      this.fpsDisplay.style.display = 'none';
      document.body.appendChild(this.fpsDisplay);
    }
  }

  /**
   * Detect optimal performance settings based on device
   * @private
   */
  _detectOptimalSettings() {
    // Try to detect device performance
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const gpu = this._detectGPU();
    
    // Choose mode based on device
    if (isMobile || gpu === 'low') {
      this.setQualityMode('low');
    } else if (gpu === 'medium') {
      this.setQualityMode('medium');
    } else {
      this.setQualityMode('high');
    }
    
    console.log(`Auto-detected performance mode: ${this.currentMode}`);
  }
  
  /**
   * Very basic GPU capability detection
   * @private
   * @returns {string} 'high', 'medium', or 'low'
   */
  _detectGPU() {
    // Try to get GPU renderer info
    let gl;
    let renderer = '';
    
    try {
      const canvas = document.createElement('canvas');
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        // Try to use standard RENDERER first (to avoid deprecation warning)
        renderer = gl.getParameter(gl.RENDERER);
        
        // If that doesn't work, try the extension
        if (!renderer) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
        }
      }
    } catch (e) {
      console.log('Error detecting GPU:', e);
    }
    
    // Check for known GPU strings
    renderer = (renderer || '').toLowerCase();
    
    // High-end GPUs
    if (renderer.includes('rtx') || 
        renderer.includes('geforce') || 
        renderer.includes('radeon') ||
        renderer.includes('apple m1') ||
        renderer.includes('apple m2')) {
      return 'high';
    }
    
    // Low-end devices
    if (renderer.includes('intel') || 
        renderer.includes('mali') || 
        renderer.includes('adreno')) {
      return 'low';
    }
    
    // Default to medium
    return 'medium';
  }

  /**
   * Set quality mode
   * @param {string} mode - 'high', 'medium', or 'low'
   */
  setQualityMode(mode) {
    const validModes = ['high', 'medium', 'low', 'ultra-low'];
    if (!validModes.includes(mode)) {
      console.error(`Invalid quality mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
      return false;
    }
    
    this.currentMode = mode;
    
    // Apply settings based on mode
    switch(mode) {
      case 'high':
        this._applyHighQuality();
        break;
      case 'medium':
        this._applyMediumQuality();
        break;
      case 'low':
        this._applyLowQuality();
        break;
      case 'ultra-low':
        this._applyUltraLowQuality();
        break;
    }
    
    // Display current mode
    if (this.fpsDisplay) {
      this.fpsDisplay.innerHTML = `${this.currentMode.toUpperCase()} (${this.metrics.fps} FPS)`;
    }
    
    return true;
  }
  
  /**
   * Apply high quality settings
   * @private
   */
  _applyHighQuality() {
    // Renderer settings
    if (this.options.renderer) {
      this.options.renderer.setPixelRatio(window.devicePixelRatio);
      this.options.renderer.shadowMap.enabled = true;
    }
    
    // Apple system - FIX: Use the method it actually has
    if (this.options.systems.appleSystem) {
      const apples = this.options.systems.appleSystem;
      // FIXED: Use setPerformanceMode(false) instead of assuming setPerformanceMode 
      if (typeof apples.setPerformanceMode === 'function') {
        apples.setPerformanceMode(false);
      }
      apples.options.appleSegments = 12;
      apples.options.maxApplesPerTree = 6;
      apples.options.growthProbability = 0.05;
    }
    
    console.log('Applied HIGH quality settings');
  }
  
  /**
   * Apply medium quality settings
   * @private
   */
  _applyMediumQuality() {
    // Renderer settings
    if (this.options.renderer) {
      this.options.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
      this.options.renderer.shadowMap.enabled = true;
    }
    
    // Apple system
    if (this.options.systems.appleSystem) {
      const apples = this.options.systems.appleSystem;
      // FIXED: Use setPerformanceMode
      if (typeof apples.setPerformanceMode === 'function') {
        apples.setPerformanceMode(true);
      }
      apples.options.appleSegments = 8;
      apples.options.maxApplesPerTree = 4;
      apples.options.growthProbability = 0.03;
    }
    
    console.log('Applied MEDIUM quality settings');
  }
  
  /**
   * Apply low quality settings
   * @private
   */
  _applyLowQuality() {
    // Renderer settings
    if (this.options.renderer) {
      this.options.renderer.setPixelRatio(0.7);
      this.options.renderer.shadowMap.enabled = false;
    }
    
    // Apple system
    if (this.options.systems.appleSystem) {
      const apples = this.options.systems.appleSystem;
      // FIXED: Use setPerformanceMode
      if (typeof apples.setPerformanceMode === 'function') {
        apples.setPerformanceMode(true);
      }
      apples.options.appleSegments = 6;
      apples.options.maxApplesPerTree = 2;
      apples.options.growthProbability = 0.02;
    }
    
    console.log('Applied LOW quality settings');
  }
  
  /**
   * Apply ultra low quality settings
   * @private
   */
  _applyUltraLowQuality() {
    // Renderer settings
    if (this.options.renderer) {
      this.options.renderer.setPixelRatio(0.5);
      this.options.renderer.shadowMap.enabled = false;
    }
    
    // Apple system
    if (this.options.systems.appleSystem) {
      const apples = this.options.systems.appleSystem;
      // FIXED: Use setPerformanceMode
      if (typeof apples.setPerformanceMode === 'function') {
        apples.setPerformanceMode(true);
      }
      apples.options.appleSegments = 4;
      apples.options.maxApplesPerTree = 1;
      apples.options.growthProbability = 0.01;
    }
    
    console.log('Applied ULTRA-LOW quality settings');
  }

  /**
   * Update performance monitoring
   * @param {number} timestamp - Current time from requestAnimationFrame
   */
  update(timestamp) {
    // Update FPS counter
    this.metrics.framesThisSecond++;
    
    if (timestamp - this.metrics.lastFpsUpdate >= 1000) {
      // Update FPS
      this.metrics.fps = this.metrics.framesThisSecond;
      this.metrics.framesThisSecond = 0;
      this.metrics.lastFpsUpdate = timestamp;
      
      // Update FPS display
      if (this.fpsDisplay && this.fpsDisplay.style.display !== 'none') {
        let color = 'lime';
        if (this.metrics.fps < 30) color = 'red';
        else if (this.metrics.fps < this.options.fpsTarget) color = 'yellow';
        
        this.fpsDisplay.innerHTML = `${this.currentMode.toUpperCase()} <span style="color: ${color}">${this.metrics.fps} FPS</span>`;
      }
      
      // Auto-adjust quality if needed
      if (this.options.autoAdjust && this.metrics.adjustmentCooldown <= 0) {
        this._autoAdjustQuality();
      } else if (this.metrics.adjustmentCooldown > 0) {
        this.metrics.adjustmentCooldown--;
      }
    }
  }
  
  /**
   * Auto-adjust quality based on current FPS
   * @private
   */
  _autoAdjustQuality() {
    const fps = this.metrics.fps;
    const target = this.options.fpsTarget;
    const currentMode = this.currentMode;
    
    // Only adjust if FPS is significantly different from target
    if (fps < target * 0.7) {
      // FPS is much too low, reduce quality
      if (currentMode === 'high') {
        this.setQualityMode('medium');
      } else if (currentMode === 'medium') {
        this.setQualityMode('low');
      } else if (currentMode === 'low' && fps < 20) {
        this.setQualityMode('ultra-low');
      }
      // Set cooldown to prevent rapid changes
      this.metrics.adjustmentCooldown = 10; // Wait 10 seconds before next adjustment
    } else if (fps > target * 1.5 && currentMode !== 'high') {
      // FPS is much higher than needed, we can increase quality
      if (currentMode === 'ultra-low') {
        this.setQualityMode('low');
      } else if (currentMode === 'low') {
        this.setQualityMode('medium');
      } else if (currentMode === 'medium') {
        this.setQualityMode('high');
      }
      // Set cooldown to prevent rapid changes
      this.metrics.adjustmentCooldown = 10; // Wait 10 seconds before next adjustment
    }
  }

  /**
   * Show or hide FPS display
   * @param {boolean} show - Whether to show FPS
   */
  showFPS(show = true) {
    if (this.fpsDisplay) {
      this.fpsDisplay.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getStats() {
    return {
      mode: this.currentMode,
      fps: this.metrics.fps,
      target: this.options.fpsTarget,
      autoAdjust: this.options.autoAdjust
    };
  }

  /**
   * Set whether to auto-adjust quality
   * @param {boolean} enabled - Whether to enable auto-adjustment
   */
  setAutoAdjust(enabled) {
    this.options.autoAdjust = enabled;
    return this.options.autoAdjust;
  }
}
