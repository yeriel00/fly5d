/**
 * Simplified TWEEN implementation just to get the basic functionality working
 */

class Tween {
  constructor(object) {
    this.object = object;
    this.valuesStart = {};
    this.valuesEnd = {};
    this.duration = 1000;
    this.easingFunction = Tween.Easing.Linear;
    this.startTime = null;
    this._isPlaying = false;
    this._onUpdateCallback = null;
    this._onCompleteCallback = null;
    this._id = Tween.nextId();
  }

  static nextId() {
    return Tween._nextId++;
  }

  to(properties, duration) {
    this.valuesEnd = properties;
    if (duration !== undefined) {
      this.duration = duration;
    }
    return this;
  }

  start() {
    Tween._add(this);
    this.startTime = Date.now();
    this._isPlaying = true;
    
    // Save start values
    for (const property in this.valuesEnd) {
      this.valuesStart[property] = this.object[property];
    }
    
    return this;
  }
  
  stop() {
    Tween._remove(this);
    this._isPlaying = false;
    return this;
  }
  
  onUpdate(callback) {
    this._onUpdateCallback = callback;
    return this;
  }
  
  onComplete(callback) {
    this._onCompleteCallback = callback;
    return this;
  }
  
  easing(easingFunction) {
    this.easingFunction = easingFunction;
    return this;
  }
  
  update(time = Date.now()) {
    if (!this._isPlaying) return false;
    
    const elapsed = (time - this.startTime) / this.duration;
    
    if (elapsed > 1) {
      // Animation complete
      for (const property in this.valuesEnd) {
        this.object[property] = this.valuesEnd[property];
      }
      
      if (this._onUpdateCallback) {
        this._onUpdateCallback(this.object, 1);
      }
      
      if (this._onCompleteCallback) {
        this._onCompleteCallback(this.object);
      }
      
      this.stop();
      return false;
    }
    
    // Animation in progress
    const value = this.easingFunction(elapsed);
    
    for (const property in this.valuesEnd) {
      const start = this.valuesStart[property];
      const end = this.valuesEnd[property];
      this.object[property] = start + (end - start) * value;
    }
    
    if (this._onUpdateCallback) {
      this._onUpdateCallback(this.object, elapsed);
    }
    
    return true;
  }
}

// Static properties
Tween._nextId = 0;
Tween._tweens = {};

// Static methods
Tween._add = function(tween) {
  Tween._tweens[tween._id] = tween;
};

Tween._remove = function(tween) {
  delete Tween._tweens[tween._id];
};

Tween.update = function(time) {
  let tweenIds = Object.keys(Tween._tweens);
  if (tweenIds.length === 0) return false;
  
  time = time !== undefined ? time : Date.now();
  
  for (let i = 0; i < tweenIds.length; i++) {
    const id = tweenIds[i];
    const tween = Tween._tweens[id];
    if (tween && tween.update(time) === false) {
      delete Tween._tweens[id];
    }
  }
  
  return true;
};

// Add some easing functions
Tween.Easing = {
  Linear: function(k) {
    return k;
  },
  
  Quadratic: {
    In: function(k) {
      return k * k;
    },
    Out: function(k) {
      return k * (2 - k);
    },
    InOut: function(k) {
      if ((k *= 2) < 1) return 0.5 * k * k;
      return -0.5 * (--k * (k - 2) - 1);
    }
  },
  
  Cubic: {
    In: function(k) {
      return k * k * k;
    },
    Out: function(k) {
      return --k * k * k + 1;
    },
    InOut: function(k) {
      if ((k *= 2) < 1) return 0.5 * k * k * k;
      return 0.5 * ((k -= 2) * k * k + 2);
    }
  },
  
  Elastic: {
    Out: function(k) {
      if (k === 0) return 0;
      if (k === 1) return 1;
      return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1;
    }
  }
};

export default {
  Tween: Tween,
  update: Tween.update,
  Easing: Tween.Easing
};
