/**
 * Simple FPS monitor with performance recommendations
 */
export default class FPSMonitor {
  constructor(options = {}) {
    this.options = {
      updateInterval: 1000, // Update stats every second
      historyLength: 60,    // Keep 60 seconds of history
      showDisplay: true,    // Whether to show display
      ...options
    };
    
    // Stats tracking
    this.fpsHistory = [];
    this.lastUpdate = 0;
    this.frameCount = 0;
    this.currentFps = 0;
    this.averageFps = 0;
    this.minFps = Infinity;
    this.maxFps = 0;
    
    // Create display if needed
    if (this.options.showDisplay) {
      this._createDisplay();
    }
    
    // Start monitoring
    this._initMonitoring();
  }
  
  /**
   * Create FPS display element
   * @private
   */
  _createDisplay() {
    const display = document.createElement('div');
    display.id = 'fps-monitor';
    display.style.position = 'fixed';
    display.style.top = '10px';
    display.style.right = '10px';
    display.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    display.style.color = '#fff';
    display.style.padding = '8px 12px';
    display.style.borderRadius = '4px';
    display.style.fontFamily = 'monospace';
    display.style.fontSize = '12px';
    display.style.zIndex = '9999';
    display.style.userSelect = 'none';
    
    // Create FPS display
    const fpsDisplay = document.createElement('div');
    fpsDisplay.id = 'fps-value';
    fpsDisplay.style.fontSize = '16px';
    fpsDisplay.style.fontWeight = 'bold';
    display.appendChild(fpsDisplay);
    
    // Create min/max/avg display
    const statsDisplay = document.createElement('div');
    statsDisplay.id = 'fps-stats';
    display.appendChild(statsDisplay);
    
    // Create recommendations display
    const recommendationsDisplay = document.createElement('div');
    recommendationsDisplay.id = 'fps-recommendations';
    recommendationsDisplay.style.marginTop = '8px';
    recommendationsDisplay.style.color = '#aaffaa';
    recommendationsDisplay.style.fontSize = '10px';
    display.appendChild(recommendationsDisplay);
    
    // Add toggle button
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Optimize';
    toggleButton.style.marginTop = '8px';
    toggleButton.style.padding = '4px 8px';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '3px';
    toggleButton.style.backgroundColor = '#2a62e8';
    toggleButton.style.color = 'white';
    toggleButton.style.cursor = 'pointer';
    toggleButton.onclick = () => this.applyOptimizations();
    display.appendChild(toggleButton);
    
    document.body.appendChild(display);
    this.display = display;
    this.fpsDisplay = fpsDisplay;
    this.statsDisplay = statsDisplay;
    this.recommendationsDisplay = recommendationsDisplay;
  }
  
  /**
   * Initialize performance monitoring
   * @private
   */
  _initMonitoring() {
    // Function to update FPS counter
    const updateStats = (timestamp) => {
      // Count this frame
      this.frameCount++;
      
      // Check if we should update stats
      if (timestamp - this.lastUpdate >= this.options.updateInterval) {
        // Calculate FPS
        const elapsed = timestamp - this.lastUpdate;
        this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
        
        // Update history
        this.fpsHistory.push(this.currentFps);
        if (this.fpsHistory.length > this.options.historyLength) {
          this.fpsHistory.shift();
        }
        
        // Calculate statistics
        if (this.fpsHistory.length > 0) {
          this.minFps = Math.min(...this.fpsHistory);
          this.maxFps = Math.max(...this.fpsHistory);
          
          const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
          this.averageFps = Math.round(sum / this.fpsHistory.length);
        }
        
        // Update display
        if (this.options.showDisplay) {
          this._updateDisplay();
        }
        
        // Generate recommendations if needed
        if (this.averageFps < 40) {
          this._generateRecommendations();
        }
        
        // Reset frame counter
        this.lastUpdate = timestamp;
        this.frameCount = 0;
      }
      
      // Continue monitoring
      requestAnimationFrame(updateStats);
    };
    
    // Start monitoring
    this.lastUpdate = performance.now();
    requestAnimationFrame(updateStats);
  }
  
  /**
   * Update FPS display
   * @private
   */
  _updateDisplay() {
    // Set color based on performance
    let color;
    if (this.currentFps >= 55) color = '#4caf50'; // Green for good performance
    else if (this.currentFps >= 30) color = '#ff9800'; // Orange for okay performance
    else color = '#f44336'; // Red for poor performance
    
    // Update FPS display
    this.fpsDisplay.textContent = `${this.currentFps} FPS`;
    this.fpsDisplay.style.color = color;
    
    // Update stats display
    this.statsDisplay.textContent = `Avg: ${this.averageFps} | Min: ${this.minFps} | Max: ${this.maxFps}`;
  }
  
  /**
   * Generate performance recommendations
   * @private
   */
  _generateRecommendations() {
    let recommendations = [];
    
    // Check for apple system
    if (window.game?.appleSystem) {
      if (this.averageFps < 20) {
        recommendations.push("• Disable apple growth system");
        recommendations.push("• Reduce tree draw distance");
      } else if (this.averageFps < 30) {
        recommendations.push("• Reduce apple growth probability");
        recommendations.push("• Skip visual effects for apples");
      }
    }
    
    // Check for too many objects in scene
    if (this.averageFps < 25) {
      recommendations.push("• Scene may have too many objects");
      recommendations.push("• Try reducing environment detail");
    }
    
    // Update recommendations display
    if (this.recommendationsDisplay && recommendations.length > 0) {
      this.recommendationsDisplay.innerHTML = recommendations.join('<br>');
      this.recommendationsDisplay.style.display = 'block';
    } else if (this.recommendationsDisplay) {
      this.recommendationsDisplay.style.display = 'none';
    }
  }
  
  /**
   * Apply optimization presets
   */
  applyOptimizations() {
    if (!window.game) return;
    
    if (window.game.appleSystem) {
      // Apply emergency optimizations
      if (this.averageFps < 20) {
        // Ultra-low settings
        window.game.appleSystem.options.growthProbability = 0.001;
        window.game.appleSystem.options.fallProbability = 0.0005;
        window.game.appleSystem.options.maxApplesPerTree = 2;
        window._skipAppleFrame = true; // Force perma-skip for lowest performance devices
        
        // Remove all existing apples that aren't golden
        if (window.game.appleSystem.groundApples) {
          // Keep only golden apples on ground
          for (let i = window.game.appleSystem.groundApples.length - 1; i >= 0; i--) {
            const apple = window.game.appleSystem.groundApples[i];
            if (!apple.isGolden) {
              window.game.appleSystem._removeGroundApple(i);
            }
          }
        }
        
        // Remove all growing apples that aren't golden
        if (window.game.appleSystem.growthPoints) {
          Object.values(window.game.appleSystem.growthPoints).forEach(points => {
            points.forEach(point => {
              if (point.hasApple && !point.isGolden && point.apple) {
                window.game.appleSystem.scene.remove(point.apple);
                point.hasApple = false;
                point.apple = null;
                point.growthProgress = 0;
              }
            });
          });
        }
        
        alert("Applied emergency optimizations. Low FPS mode enabled.");
      } 
      // Medium optimizations
      else if (this.averageFps < 40) {
        window.game.appleSystem.options.growthProbability = 0.005;
        window.game.appleSystem.options.fallProbability = 0.002;
        window.game.appleSystem.options.maxApplesPerTree = 3;
        
        alert("Applied medium optimizations for improved performance.");
      } 
      else {
        alert("Performance is already good. No optimizations needed.");
      }
    }
  }
  
  /**
   * Get current FPS value
   * @returns {number} Current FPS
   */
  getFPS() {
    return this.currentFps;
  }
}
