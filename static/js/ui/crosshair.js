/**
 * Creates and manages the crosshair UI for aiming weapons
 */
export default class Crosshair {
  /**
   * Create a new crosshair
   */
  constructor() {
    this._createCrosshairElement();
  }

  /**
   * Create the crosshair DOM element
   * @private
   */
  _createCrosshairElement() {
    // Create the crosshair element
    this.element = document.createElement('div');
    this.element.className = 'crosshair';
    document.body.appendChild(this.element);
  }

  /**
   * Update the crosshair state
   * @param {Object} weaponState - The current weapon state
   */
  update(weaponState) {
    if (weaponState.isCharging) {
      this.element.classList.add('charging');
      
      // Scale based on charge power if available
      if (weaponState.chargeState && weaponState.chargeState.power) {
        const scale = 1 + weaponState.chargeState.power * 0.5; // Scale between 1-1.5x
        this.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    } else {
      this.element.classList.remove('charging');
      this.element.style.transform = 'translate(-50%, -50%)';
    }
  }

  /**
   * Show or hide the crosshair
   * @param {boolean} visible - Whether the crosshair should be visible
   */
  setVisible(visible) {
    this.element.style.display = visible ? 'block' : 'none';
  }
}
