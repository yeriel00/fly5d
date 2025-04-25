/**
 * System to manage a crosshair in the center of the screen
 */
export default class CrosshairSystem {
  /**
   * Create a new crosshair system
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      color: 'rgba(255, 255, 255, 0.7)',
      size: 16,
      thickness: 2,
      dotSize: 2,
      gap: 4,
      chargeIndicator: true,
      showDot: true
    }, options);
    
    // Create the crosshair element
    this.element = document.createElement('div');
    this.element.id = 'crosshair';
    
    // Apply initial styles
    this._applyStyles();
    
    // Add to document
    document.body.appendChild(this.element);
    
    // Create charge indicator elements
    if (this.options.chargeIndicator) {
      this.chargeIndicator = document.createElement('div');
      this.chargeIndicator.id = 'charge-indicator';
      this.chargeIndicator.style.display = 'none';
      document.body.appendChild(this.chargeIndicator);
    }
  }
  
  /**
   * Apply styles to the crosshair element
   * @private
   */
  _applyStyles() {
    const { size, thickness, gap, color, dotSize, showDot } = this.options;
    
    // Style for the main crosshair container
    Object.assign(this.element.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      width: `${size * 2}px`,
      height: `${size * 2}px`,
      marginLeft: `-${size}px`,
      marginTop: `-${size}px`,
      pointerEvents: 'none'
    });
    
    // Create crosshair parts
    const parts = ['top', 'right', 'bottom', 'left'];
    if (showDot) parts.push('center');
    
    // Remove any existing parts (in case of update)
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    // Create new parts
    parts.forEach(part => {
      const el = document.createElement('div');
      el.className = `crosshair-${part}`;
      
      if (part === 'center' && showDot) {
        // Center dot
        Object.assign(el.style, {
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          marginLeft: `-${dotSize / 2}px`,
          marginTop: `-${dotSize / 2}px`,
          background: color,
          borderRadius: '50%'
        });
      } else {
        // Lines
        Object.assign(el.style, {
          position: 'absolute',
          background: color
        });
        
        switch (part) {
          case 'top':
            Object.assign(el.style, {
              top: '0',
              left: '50%',
              width: `${thickness}px`,
              height: `${size - gap}px`,
              marginLeft: `-${thickness / 2}px`
            });
            break;
          case 'right':
            Object.assign(el.style, {
              top: '50%',
              right: '0',
              width: `${size - gap}px`,
              height: `${thickness}px`,
              marginTop: `-${thickness / 2}px`
            });
            break;
          case 'bottom':
            Object.assign(el.style, {
              bottom: '0',
              left: '50%',
              width: `${thickness}px`,
              height: `${size - gap}px`,
              marginLeft: `-${thickness / 2}px`
            });
            break;
          case 'left':
            Object.assign(el.style, {
              top: '50%',
              left: '0',
              width: `${size - gap}px`,
              height: `${thickness}px`,
              marginTop: `-${thickness / 2}px`
            });
            break;
        }
      }
      
      this.element.appendChild(el);
    });
    
    // Style charge indicator if it exists
    if (this.chargeIndicator) {
      const chargeSize = size * 2 + 10;
      Object.assign(this.chargeIndicator.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: `${chargeSize}px`,
        height: `${chargeSize}px`,
        marginLeft: `-${chargeSize / 2}px`,
        marginTop: `-${chargeSize / 2}px`,
        border: `2px solid ${color}`,
        borderRadius: '50%',
        opacity: '0.5',
        transition: 'transform 0.1s ease',
        transform: 'scale(0)',
        pointerEvents: 'none'
      });
    }
  }
  
  /**
   * Show the crosshair
   */
  show() {
    this.element.style.display = 'block';
  }
  
  /**
   * Hide the crosshair
   */
  hide() {
    this.element.style.display = 'none';
    if (this.chargeIndicator) {
      this.chargeIndicator.style.display = 'none';
    }
  }
  
  /**
   * Update the charge indicator ring
   * @param {number} charge - Charge value between 0 and 1
   */
  updateCharge(charge) {
    if (!this.chargeIndicator) return;
    
    if (charge > 0) {
      this.chargeIndicator.style.display = 'block';
      this.chargeIndicator.style.transform = `scale(${0.5 + charge * 0.5})`;
      this.chargeIndicator.style.opacity = `${0.3 + charge * 0.2}`;
    } else {
      this.chargeIndicator.style.display = 'none';
    }
  }
  
  /**
   * Update the crosshair style
   * @param {Object} options - Style options to update
   */
  updateStyle(options) {
    this.options = { ...this.options, ...options };
    this._applyStyles();
  }
  
  /**
   * Clean up crosshair resources
   */
  cleanup() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    if (this.chargeIndicator && this.chargeIndicator.parentNode) {
      this.chargeIndicator.parentNode.removeChild(this.chargeIndicator);
    }
  }
}
