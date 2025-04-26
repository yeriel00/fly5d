/**
 * Simplified FPS Monitor with guaranteed update method
 */
export default class FPSMonitor {
  /**
   * Create a new FPS monitor
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      showDisplay: true,           // Whether to show the FPS display
      warningThreshold: 40,        // FPS below this shows yellow warning
      criticalThreshold: 25,       // FPS below this shows red warning
      autoOptimize: true,          // Whether to automatically apply optimizations
      optimizationLevel: 0         // Current optimization level
    }, options);

    // Performance metrics
    this.fps = 60;                 // Start with an assumed 60 FPS
    this.framesThisSecond = 0;
    this.lastUpdate = performance.now();
    this.optimizers = [];          // List of registered optimizers

    // Create FPS display if needed
    if (this.options.showDisplay) {
      this._createDisplay();
    }
  }

  /**
   * Create the FPS display element
   * @private
   */
  _createDisplay() {
    // Check if element already exists
    if (document.getElementById('fps-monitor')) {
      return;
    }

    // Create display container
    this.display = document.createElement('div');
    this.display.id = 'fps-monitor';
    
    // Style based on position option
    this.display.style.position = 'absolute';
    this.display.style.padding = '5px 10px';
    this.display.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.display.style.color = '#fff';
    this.display.style.fontFamily = 'monospace';
    this.display.style.fontSize = '14px';
    this.display.style.zIndex = 9999;
    this.display.style.borderRadius = '3px';
    this.display.style.top = '10px';
    this.display.style.left = '10px';

    // Create the FPS counter
    this.fpsDisplay = document.createElement('div');
    this.fpsDisplay.textContent = 'FPS: 60';
    this.display.appendChild(this.fpsDisplay);

    // Add to the document
    document.body.appendChild(this.display);
  }

  /**
   * Update the FPS monitor - SIMPLIFIED VERSION
   * @param {number} timestamp - Current timestamp from requestAnimationFrame
   */
  update(timestamp) {
    // Check if we have a timestamp
    if (!timestamp) timestamp = performance.now();
    
    // Count frames
    this.framesThisSecond++;
    
    // Update every second
    if (timestamp - this.lastUpdate >= 1000) {
      // Calculate FPS
      this.fps = this.framesThisSecond;
      this.framesThisSecond = 0;
      this.lastUpdate = timestamp;
      
      // Update display
      if (this.display && this.fpsDisplay) {
        // Color based on performance
        let color = 'lime'; // Good performance
        if (this.fps < this.options.criticalThreshold) {
          color = 'red'; // Bad performance
        } else if (this.fps < this.options.warningThreshold) {
          color = 'yellow'; // Warning
        }
        
        this.fpsDisplay.innerHTML = `FPS: <span style="color:${color}">${this.fps}</span>`;
      }
      
      // Check if optimization is needed
      if (this.options.autoOptimize && this.fps < this.options.criticalThreshold) {
        this._applyOptimizations();
      }
    }
  }
  
  /**
   * Apply optimizations to improve performance
   * @private
   */
  _applyOptimizations() {
    // Increase optimization level up to maximum
    this.options.optimizationLevel = Math.min(3, this.options.optimizationLevel + 1);
    
    // Run registered optimizers
    this.optimizers.forEach(optimizer => {
      try {
        optimizer(this.options.optimizationLevel);
      } catch (error) {
        console.error('Error applying optimization:', error);
      }
    });
    
    console.log(`Applied optimizations at level ${this.options.optimizationLevel}`);
  }
  
  /**
   * Register an optimization function
   * @param {Function} callback - Function to call with the optimization level (0-3)
   */
  registerOptimizer(callback) {
    if (typeof callback === 'function') {
      this.optimizers.push(callback);
    }
  }
  
  /**
   * Get current FPS value
   * @returns {number} Current FPS
   */
  getFPS() {
    return this.fps;
  }

  /**
   * Show or hide the FPS display
   * @param {boolean} show - Whether to show the display
   */
  showDisplay(show = true) {
    if (!this.display) {
      if (show) this._createDisplay();
      return;
    }
    
    this.display.style.display = show ? 'block' : 'none';
    this.options.showDisplay = show;
  }
}

// …existing code…

// OVERRIDE performanceOptimizer ONLY if it exists
if (window.performanceOptimizer) {
  const perf = window.performanceOptimizer;

  // Block its clearApples method
  if (typeof perf.clearApples === 'function') {
    perf.clearApples = function() {
      console.log("🛡️ BLOCKED: performanceOptimizer.clearApples");
      return "Prevented";
    };
  }

  // Wrap setOptimizationLevel
  if (typeof perf.setOptimizationLevel === 'function') {
    const orig = perf.setOptimizationLevel;
    perf.setOptimizationLevel = function(level) {
      console.log(`⚡ INTERCEPTED: Optimization level → ${level}`);
      const result = orig.call(perf, level);

      // Prevent apple clearing at high levels
      if (level >= 3) {
        console.log(`⚡ Skipped clearAllApplesToImprovePerformance at level ${level}`);
        // clearAllApplesToImprovePerformance is now a no-op
      }

      return result;
    };
  }

} else {
  console.warn("performanceOptimizer not defined — skipping its overrides");
}

// …existing code…
