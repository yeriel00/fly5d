/**
 * Web browser input handling utility - helps with mouse and keyboard input
 */
export default class WebBrowserInput {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = Object.assign({
      preventContextMenu: true,
      lockPointer: false,
    }, options);
    
    // Mouse state
    this.mouse = {
      leftDown: false,
      rightDown: false,
      middleDown: false,
      position: { x: 0, y: 0 },
      movement: { x: 0, y: 0 },
      lastDownTime: 0
    };
    
    // Callbacks
    this.callbacks = {
      mouseDown: [],
      mouseUp: [],
      mouseMove: [],
      keyDown: [],
      keyUp: []
    };
    
    // Keys currently pressed
    this.keys = {};
    
    // Set up event listeners
    this._setupListeners();
  }
  
  /**
   * Set up DOM event listeners
   * @private
   */
  _setupListeners() {
    // Mouse events
    document.addEventListener('mousedown', this._handleMouseDown.bind(this));
    document.addEventListener('mouseup', this._handleMouseUp.bind(this));
    document.addEventListener('mousemove', this._handleMouseMove.bind(this));
    
    // Prevent context menu if specified
    if (this.options.preventContextMenu) {
      document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
      });
    }
    
    // Handle pointer lock events
    if (this.options.lockPointer) {
      this.canvas.addEventListener('click', () => {
        this.canvas.requestPointerLock();
      });
    }
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._resetState();
      }
    });
    
    // Mouse leaves window - treat as all buttons released
    document.addEventListener('mouseleave', this._resetMouseState.bind(this));
    
    // Key events
    document.addEventListener('keydown', this._handleKeyDown.bind(this));
    document.addEventListener('keyup', this._handleKeyUp.bind(this));
    
    // Window blur - reset all input states
    window.addEventListener('blur', this._resetState.bind(this));
  }
  
  /**
   * Handle mouse down events
   * @private
   */
  _handleMouseDown(e) {
    // Update button state
    if (e.button === 0) {
      this.mouse.leftDown = true;
      this.mouse.lastDownTime = Date.now();
      console.log("LEFT MOUSE DOWN detected by InputHandler");
    } else if (e.button === 2) {
      this.mouse.rightDown = true;
    } else if (e.button === 1) {
      this.mouse.middleDown = true;
    }
    
    // Dispatch to callbacks
    for (const callback of this.callbacks.mouseDown) {
      callback({
        button: e.button,
        position: { x: e.clientX, y: e.clientY },
        originalEvent: e
      });
    }
  }
  
  /**
   * Handle mouse up events
   * @private
   */
  _handleMouseUp(e) {
    const heldDuration = this.mouse.leftDown ? Date.now() - this.mouse.lastDownTime : 0;
    
    // Update button state
    if (e.button === 0) {
      this.mouse.leftDown = false;
      console.log(`LEFT MOUSE UP detected by InputHandler (held for ${heldDuration}ms)`);
    } else if (e.button === 2) {
      this.mouse.rightDown = false;
    } else if (e.button === 1) {
      this.mouse.middleDown = false;
    }
    
    // Dispatch to callbacks
    for (const callback of this.callbacks.mouseUp) {
      callback({
        button: e.button,
        position: { x: e.clientX, y: e.clientY },
        duration: heldDuration,
        originalEvent: e
      });
    }
  }
  
  /**
   * Handle mouse move events
   * @private
   */
  _handleMouseMove(e) {
    // Update position
    this.mouse.position.x = e.clientX;
    this.mouse.position.y = e.clientY;
    
    // Handle pointer lock
    if (document.pointerLockElement === this.canvas) {
      this.mouse.movement.x = e.movementX;
      this.mouse.movement.y = e.movementY;
    } else {
      this.mouse.movement.x = 0;
      this.mouse.movement.y = 0;
    }
    
    // Dispatch to callbacks
    for (const callback of this.callbacks.mouseMove) {
      callback({
        position: { x: e.clientX, y: e.clientY },
        movement: { x: e.movementX, y: e.movementY },
        originalEvent: e
      });
    }
  }
  
  /**
   * Handle key down events
   * @private
   */
  _handleKeyDown(e) {
    // Skip repeated key presses 
    if (e.repeat) return;
    
    // Update key state
    this.keys[e.code] = true;
    
    // Dispatch to callbacks
    for (const callback of this.callbacks.keyDown) {
      callback({
        code: e.code,
        key: e.key,
        originalEvent: e
      });
    }
  }
  
  /**
   * Handle key up events
   * @private
   */
  _handleKeyUp(e) {
    // Update key state
    delete this.keys[e.code];
    
    // Dispatch to callbacks
    for (const callback of this.callbacks.keyUp) {
      callback({
        code: e.code,
        key: e.key,
        originalEvent: e
      });
    }
  }
  
  /**
   * Reset all input states
   * @private
   */
  _resetState() {
    this._resetMouseState();
    this.keys = {};
  }
  
  /**
   * Reset mouse state
   * @private
   */
  _resetMouseState() {
    // If left mouse was down, trigger callbacks for release
    if (this.mouse.leftDown) {
      for (const callback of this.callbacks.mouseUp) {
        callback({
          button: 0,
          position: { ...this.mouse.position },
          duration: Date.now() - this.mouse.lastDownTime,
          forced: true
        });
      }
    }
    
    this.mouse.leftDown = false;
    this.mouse.rightDown = false;
    this.mouse.middleDown = false;
  }
  
  /**
   * Add a mouse down event listener
   * @param {Function} callback - Called when mouse button is pressed
   */
  onMouseDown(callback) {
    if (typeof callback === 'function') {
      this.callbacks.mouseDown.push(callback);
    }
  }
  
  /**
   * Add a mouse up event listener
   * @param {Function} callback - Called when mouse button is released
   */
  onMouseUp(callback) {
    if (typeof callback === 'function') {
      this.callbacks.mouseUp.push(callback);
    }
  }
  
  /**
   * Add a mouse move event listener
   * @param {Function} callback - Called when mouse moves
   */
  onMouseMove(callback) {
    if (typeof callback === 'function') {
      this.callbacks.mouseMove.push(callback);
    }
  }
  
  /**
   * Add a key down event listener
   * @param {Function} callback - Called when key is pressed
   */
  onKeyDown(callback) {
    if (typeof callback === 'function') {
      this.callbacks.keyDown.push(callback);
    }
  }
  
  /**
   * Add a key up event listener
   * @param {Function} callback - Called when key is released
   */
  onKeyUp(callback) {
    if (typeof callback === 'function') {
      this.callbacks.keyUp.push(callback);
    }
  }
  
  /**
   * Check if a specific key is currently pressed
   * @param {string} code - Key code to check
   * @returns {boolean} True if key is down
   */
  isKeyDown(code) {
    return this.keys[code] === true;
  }
  
  /**
   * Check if left mouse button is down
   * @returns {boolean} True if down
   */
  isLeftMouseDown() {
    return this.mouse.leftDown;
  }
  
  /**
   * Check if right mouse button is down
   * @returns {boolean} True if down
   */
  isRightMouseDown() {
    return this.mouse.rightDown;
  }
  
  /**
   * Get the current mouse position
   * @returns {Object} x, y coordinates 
   */
  getMousePosition() {
    return { ...this.mouse.position };
  }
  
  /**
   * Get the current mouse movement (in pointer lock)
   * @returns {Object} x, y movement deltas
   */
  getMouseMovement() {
    return { ...this.mouse.movement };
  }
}
