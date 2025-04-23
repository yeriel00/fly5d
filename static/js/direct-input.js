/**
 * Direct input handler that bypasses all the normal event systems
 * for maximum reliability with mouse events
 */
class DirectInputHandler {
  constructor() {
    console.log("🔌 DirectInputHandler initialized");
    this.mouseState = {
      isLeftDown: false,
      isRightDown: false,
      downTime: 0
    };
    
    this.callbacks = {
      leftDown: [],
      leftUp: [],
      rightDown: [],
      rightUp: []
    };
    
    // Set up event handlers
    this._setupEventHandlers();
  }
  
  /**
   * Set up mouse event handlers directly on document
   */
  _setupEventHandlers() {
    console.log("🔄 Setting up DirectInputHandler events");
    
    // Direct assignment instead of addEventListener to avoid conflicts
    document.onmousedown = (e) => {
      if (e.button === 0) { // Left click
        console.log("⬇️ DirectInputHandler: LEFT MOUSE DOWN");
        this.mouseState.isLeftDown = true;
        this.mouseState.downTime = Date.now();
        this._executeCallbacks('leftDown');
      } else if (e.button === 2) { // Right click
        console.log("⬇️ DirectInputHandler: RIGHT MOUSE DOWN");
        this.mouseState.isRightDown = true;
        this._executeCallbacks('rightDown');
      }
    };
    
    document.onmouseup = (e) => {
      if (e.button === 0 && this.mouseState.isLeftDown) { // Left click released
        const holdTime = Date.now() - this.mouseState.downTime;
        console.log(`⬆️ DirectInputHandler: LEFT MOUSE UP after ${holdTime}ms`);
        this.mouseState.isLeftDown = false;
        this._executeCallbacks('leftUp', holdTime);
      } else if (e.button === 2) { // Right click released
        console.log("⬆️ DirectInputHandler: RIGHT MOUSE UP");
        this.mouseState.isRightDown = false;
        this._executeCallbacks('rightUp');
      }
    };
    
    // Handle mouse leaving window as a mouse-up event
    document.onmouseleave = () => {
      if (this.mouseState.isLeftDown) {
        const holdTime = Date.now() - this.mouseState.downTime;
        console.log(`🚫 DirectInputHandler: MOUSE LEFT WINDOW while button was down (${holdTime}ms)`);
        this.mouseState.isLeftDown = false;
        this._executeCallbacks('leftUp', holdTime, true);
      }
    };
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mouseState.isLeftDown) {
        const holdTime = Date.now() - this.mouseState.downTime;
        console.log(`🔴 DirectInputHandler: PAGE HIDDEN while button was down (${holdTime}ms)`);
        this.mouseState.isLeftDown = false;
        this._executeCallbacks('leftUp', holdTime, true);
      }
    });
  }
  
  /**
   * Execute all registered callbacks
   * @param {string} type - Callback type
   * @param {number} holdTime - For up events, how long button was held
   * @param {boolean} forced - If this was forced (mouse left window)
   */
  _executeCallbacks(type, holdTime = 0, forced = false) {
    if (!this.callbacks[type]) return;
    
    for (const callback of this.callbacks[type]) {
      try {
        callback({holdTime, forced});
      } catch (err) {
        console.error(`Error in ${type} callback:`, err);
      }
    }
  }
  
  /**
   * Add a left mouse down callback
   * @param {Function} callback - Function to call
   */
  onLeftDown(callback) {
    if (typeof callback === 'function') {
      this.callbacks.leftDown.push(callback);
    }
  }
  
  /**
   * Add a left mouse up callback
   * @param {Function} callback - Function to call
   */
  onLeftUp(callback) {
    if (typeof callback === 'function') {
      this.callbacks.leftUp.push(callback);
    }
  }
  
  /**
   * Add a right mouse down callback
   * @param {Function} callback - Function to call
   */
  onRightDown(callback) {
    if (typeof callback === 'function') {
      this.callbacks.rightDown.push(callback);
    }
  }
  
  /**
   * Add a right mouse up callback
   * @param {Function} callback - Function to call
   */
  onRightUp(callback) {
    if (typeof callback === 'function') {
      this.callbacks.rightUp.push(callback);
    }
  }
  
  /**
   * Check if left mouse button is currently down
   * @returns {boolean} True if down
   */
  isLeftMouseDown() {
    return this.mouseState.isLeftDown;
  }
  
  /**
   * Check if right mouse button is currently down
   * @returns {boolean} True if down
   */
  isRightMouseDown() {
    return this.mouseState.isRightDown;
  }
}

// Create singleton instance
const directInput = new DirectInputHandler();
export default directInput;
