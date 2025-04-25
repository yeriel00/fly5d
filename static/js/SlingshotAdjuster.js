import * as THREE from 'three';

/**
 * Utility for fine-tuning the slingshot position and rotation in real-time
 */
export default class SlingshotAdjuster {
  /**
   * Create a new slingshot adjuster
   * @param {WeaponSystem} weaponSystem - The weapon system that holds the slingshot
   */
  constructor(weaponSystem) {
    this.weaponSystem = weaponSystem;
    this.slingshotModel = weaponSystem.weaponModel;
    
    // Initialize with current values
    this.position = {
      x: 0.25,   // Default horizontal position (right side)
      y: -0.3,   // Default vertical position (bottom)
      z: -0.7    // Default depth position (in front)
    };
    
    this.rotation = {
      x: 0,                  // Default pitch rotation (0 degrees)
      y: Math.PI * 0.35,     // Default yaw rotation (9 degrees)
      z: -Math.PI * 0.08     // Default roll rotation (-14.4 degrees)
    };
    
    // Apply initial values
    this.applyValues();
    
    // Create UI if in browser environment
    if (typeof document !== 'undefined') {
      this.createUI();
    }
  }
  
  /**
   * Apply current position and rotation values to the slingshot model
   * @private
   */
  applyValues() {
    if (!this.slingshotModel) return;
    
    // Set position
    this.slingshotModel.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );
    
    // Set rotation
    this.slingshotModel.rotation.set(
      this.rotation.x,
      this.rotation.y,
      this.rotation.z
    );
    
    // Store values as initial position/rotation for idle animation
    this.weaponSystem.initialWeaponPosition = this.slingshotModel.position.clone();
    this.weaponSystem.initialWeaponRotation = this.slingshotModel.rotation.clone();
  }
  
  /**
   * Create UI controls for adjusting the slingshot
   * @private 
   */
  createUI() {
    // Create container
    const container = document.createElement('div');
    container.id = 'slingshot-adjuster';
    container.style.position = 'fixed';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.padding = '10px';
    container.style.borderRadius = '5px';
    container.style.color = 'white';
    container.style.fontFamily = 'monospace';
    container.style.fontSize = '12px';
    container.style.zIndex = '10000';
    container.style.width = '250px';
    container.style.display = 'none'; // Hidden by default
    
    // Create title
    const title = document.createElement('div');
    title.textContent = 'Slingshot Adjustment';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.style.textAlign = 'center';
    container.appendChild(title);
    
    // Create position controls
    const posControls = this.createControlGroup('Position', this.position, [-2, 2], 0.01);
    container.appendChild(posControls);
    
    // Create rotation controls (convert to degrees for UI)
    const rotationDegrees = {
      x: this.toDegrees(this.rotation.x),
      y: this.toDegrees(this.rotation.y),
      z: this.toDegrees(this.rotation.z)
    };
    const rotControls = this.createControlGroup('Rotation (degrees)', rotationDegrees, [-180, 180], 1);
    container.appendChild(rotControls);
    
    // Add apply button
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply';
    applyButton.style.marginTop = '10px';
    applyButton.style.width = '100%';
    applyButton.style.padding = '5px';
    applyButton.style.backgroundColor = '#4CAF50';
    applyButton.style.color = 'white';
    applyButton.style.border = 'none';
    applyButton.style.borderRadius = '3px';
    applyButton.style.cursor = 'pointer';
    applyButton.onclick = () => {
      // Convert degrees back to radians for rotation
      this.rotation.x = this.toRadians(rotationDegrees.x);
      this.rotation.y = this.toRadians(rotationDegrees.y);
      this.rotation.z = this.toRadians(rotationDegrees.z);
      
      // Apply values
      this.applyValues();
      
      // Output values to console for copying
      console.log(`Position: x: ${this.position.x}, y: ${this.position.y}, z: ${this.position.z}`);
      console.log(`Rotation: x: ${this.rotation.x}, y: ${this.rotation.y}, z: ${this.rotation.z}`);
      console.log(`Rotation (degrees): x: ${rotationDegrees.x}, y: ${rotationDegrees.y}, z: ${rotationDegrees.z}`);
    };
    container.appendChild(applyButton);
    
    // Add code output button
    const codeButton = document.createElement('button');
    codeButton.textContent = 'Copy Code';
    codeButton.style.marginTop = '5px';
    codeButton.style.width = '100%';
    codeButton.style.padding = '5px';
    codeButton.style.backgroundColor = '#2196F3';
    codeButton.style.color = 'white';
    codeButton.style.border = 'none';
    codeButton.style.borderRadius = '3px';
    codeButton.style.cursor = 'pointer';
    codeButton.onclick = () => {
      const code = this.generateCode();
      navigator.clipboard.writeText(code).then(() => {
        alert('Code copied to clipboard!');
      });
      console.log(code);
    };
    container.appendChild(codeButton);
    
    // Add toggle button (always visible)
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Show Slingshot Adjuster';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '10px';
    toggleButton.style.right = '10px';
    toggleButton.style.padding = '5px';
    toggleButton.style.backgroundColor = '#FFC107';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '3px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.zIndex = '10001';
    
    toggleButton.onclick = () => {
      if (container.style.display === 'none') {
        container.style.display = 'block';
        toggleButton.textContent = 'Hide Slingshot Adjuster';
      } else {
        container.style.display = 'none';
        toggleButton.textContent = 'Show Slingshot Adjuster';
      }
    };
    
    // Add to body
    document.body.appendChild(container);
    document.body.appendChild(toggleButton);
  }
  
  /**
   * Create a control group for position or rotation
   * @private
   */
  createControlGroup(title, values, range, step) {
    const group = document.createElement('div');
    group.style.marginBottom = '10px';
    
    // Add title
    const groupTitle = document.createElement('div');
    groupTitle.textContent = title;
    groupTitle.style.fontWeight = 'bold';
    groupTitle.style.marginBottom = '5px';
    group.appendChild(groupTitle);
    
    // Add controls for x, y, z
    ['x', 'y', 'z'].forEach(axis => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.marginBottom = '3px';
      
      // Label
      const label = document.createElement('div');
      label.textContent = axis + ':';
      label.style.width = '15px';
      label.style.marginRight = '5px';
      row.appendChild(label);
      
      // Slider
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = range[0];
      slider.max = range[1];
      slider.step = step;
      slider.value = values[axis];
      slider.style.flex = '1';
      slider.style.marginRight = '5px';
      slider.oninput = () => {
        values[axis] = parseFloat(slider.value);
        valueInput.value = slider.value;
      };
      row.appendChild(slider);
      
      // Value input
      const valueInput = document.createElement('input');
      valueInput.type = 'number';
      valueInput.value = values[axis];
      valueInput.step = step;
      valueInput.style.width = '60px';
      valueInput.oninput = () => {
        const val = parseFloat(valueInput.value);
        if (!isNaN(val)) {
          values[axis] = val;
          slider.value = val;
        }
      };
      row.appendChild(valueInput);
      
      group.appendChild(row);
    });
    
    return group;
  }
  
  /**
   * Convert radians to degrees
   * @private
   */
  toDegrees(radians) {
    return radians * (180 / Math.PI);
  }
  
  /**
   * Convert degrees to radians
   * @private
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Generate code for current position and rotation
   * @private
   */
  generateCode() {
    return `
// Position slingshot in camera view
this.weaponModel.position.set(${this.position.x}, ${this.position.y}, ${this.position.z});
    
// Set rotation for proper orientation
this.weaponModel.rotation.set(${this.rotation.x}, ${this.rotation.y}, ${this.rotation.z});
// In degrees: x: ${this.toDegrees(this.rotation.x).toFixed(1)}, y: ${this.toDegrees(this.rotation.y).toFixed(1)}, z: ${this.toDegrees(this.rotation.z).toFixed(1)}
    
// Store for animations
this.initialWeaponPosition = this.weaponModel.position.clone();
this.initialWeaponRotation = this.weaponModel.rotation.clone();`;
  }
  
  /**
   * Set position directly
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   */
  setPosition(x, y, z) {
    this.position = { x, y, z };
    this.applyValues();
  }
  
  /**
   * Set rotation directly (in radians)
   * @param {number} x - X rotation (pitch)
   * @param {number} y - Y rotation (yaw)
   * @param {number} z - Z rotation (roll)
   */
  setRotation(x, y, z) {
    this.rotation = { x, y, z };
    this.applyValues();
  }
  
  /**
   * Set rotation using degrees
   * @param {number} x - X rotation in degrees (pitch)
   * @param {number} y - Y rotation in degrees (yaw)
   * @param {number} z - Z rotation in degrees (roll)
   */
  setRotationDegrees(x, y, z) {
    this.rotation = {
      x: this.toRadians(x),
      y: this.toRadians(y),
      z: this.toRadians(z)
    };
    this.applyValues();
  }
  
  /**
   * Apply a preset configuration
   * @param {string} preset - The preset name ('default', 'rightHanded', 'centered', etc)
   */
  applyPreset(preset) {
    switch (preset.toLowerCase()) {
      case 'default':
        this.setPosition(0.25, -0.3, -0.7);
        this.setRotation(0, Math.PI * 0.05, -Math.PI * 0.08);
        break;
      case 'righthanded':
        this.setPosition(0.3, -0.35, -0.75);
        this.setRotation(0.1, Math.PI * 0.1, -Math.PI * 0.1);
        break;
      case 'lefthanded':
        this.setPosition(-0.3, -0.35, -0.75);
        this.setRotation(0.1, Math.PI * 0.1, Math.PI * 0.1);
        break;
      case 'centered':
        this.setPosition(0, -0.4, -0.8);
        this.setRotation(0, 0, 0);
        break;
      case 'lowered':
        this.setPosition(0.25, -0.5, -0.7);
        this.setRotation(0, Math.PI * 0.05, -Math.PI * 0.08);
        break;
      case 'raised':
        this.setPosition(0.25, -0.2, -0.7);
        this.setRotation(0, Math.PI * 0.05, -Math.PI * 0.08);
        break;
      default:
        console.warn(`Unknown preset: ${preset}`);
    }
  }
}
