import * as THREE from 'three';

export default class AudioManager {
  constructor(camera) {
    // Create an audio listener and attach it to the camera
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    
    // Create empty objects to track our sounds
    this.ambientSounds = {};
    this.pointSounds = {};
    this.eventSounds = {};
    
    // Audio loader for loading sound files
    this.audioLoader = new THREE.AudioLoader();
    
    // Master volume controls
    this.masterVolume = 0.5;
    this.masterMuted = false;
    
    // Day/night transition
    this.dayIntensity = 1.0;
    this.nightIntensity = 0.0;
    
    // Create loaders for ambient sounds
    this.loadAmbientSounds();
  }
  
  loadAmbientSounds() {
    // Create ambient sound objects
    this.ambientSounds.daytime = new THREE.Audio(this.listener);
    this.ambientSounds.nighttime = new THREE.Audio(this.listener);
    this.ambientSounds.wind = new THREE.Audio(this.listener);
    
    // Load ambient daytime sound (birds, etc)
    this.audioLoader.load('/static/sounds/ambient_day.mp3', (buffer) => {
      this.ambientSounds.daytime.setBuffer(buffer);
      this.ambientSounds.daytime.setLoop(true);
      this.ambientSounds.daytime.setVolume(0.2 * this.masterVolume);
      this.ambientSounds.daytime.play();
    });
    
    // Load ambient nighttime sound (crickets, etc)
    this.audioLoader.load('/static/sounds/ambient_night.mp3', (buffer) => {
      this.ambientSounds.nighttime.setBuffer(buffer);
      this.ambientSounds.nighttime.setLoop(true);
      this.ambientSounds.nighttime.setVolume(0.0 * this.masterVolume); // start at 0
      this.ambientSounds.nighttime.play();
    });
    
    // Load wind sound
    this.audioLoader.load('/static/sounds/wind.mp3', (buffer) => {
      this.ambientSounds.wind.setBuffer(buffer);
      this.ambientSounds.wind.setLoop(true);
      this.ambientSounds.wind.setVolume(0.1 * this.masterVolume);
      this.ambientSounds.wind.play();
    });
  }
  
  createWaterfallSound(position) {
    // Create positional sound
    const sound = new THREE.PositionalAudio(this.listener);
    
    // Set properties for distance model
    sound.setRefDistance(5);
    sound.setMaxDistance(100);
    sound.setRolloffFactor(1);
    
    // Load waterfall sound
    this.audioLoader.load('/static/sounds/waterfall.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.3 * this.masterVolume);
      sound.play();
    });
    
    // Create a mesh to attach the sound to
    const audioSource = new THREE.Object3D();
    audioSource.position.copy(position);
    audioSource.add(sound);
    
    // Store in our collection
    const id = `waterfall_${Date.now()}`;
    this.pointSounds[id] = {
      object: audioSource,
      sound: sound
    };
    
    return audioSource;
  }
  
  createFireSound(position, intensity = 0.5) {
    // Create positional fire sound
    const sound = new THREE.PositionalAudio(this.listener);
    
    // Set properties for distance model
    sound.setRefDistance(3);
    sound.setMaxDistance(20);
    sound.setRolloffFactor(1);
    
    // Load fire sound
    this.audioLoader.load('/static/sounds/fire.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.2 * intensity * this.masterVolume);
      sound.play();
    });
    
    // Create a mesh to attach the sound to
    const audioSource = new THREE.Object3D();
    audioSource.position.copy(position);
    audioSource.add(sound);
    
    // Store in our collection
    const id = `fire_${Date.now()}`;
    this.pointSounds[id] = {
      object: audioSource,
      sound: sound
    };
    
    return audioSource;
  }
  
  updateDayNightCycle(timeOfDay) {
    // Calculate day/night transition based on time of day
    // Assume 0 = noon, 0.5 = midnight
    
    // Day intensity increases from 0 at midnight to 1 at noon
    this.dayIntensity = Math.sin(Math.PI * (1 - timeOfDay * 2)) * 0.9 + 0.1;
    this.dayIntensity = Math.max(0, this.dayIntensity);
    
    // Night intensity is the opposite
    this.nightIntensity = 1 - this.dayIntensity;
    
    // Update ambient sound volumes
    if (this.ambientSounds.daytime && this.ambientSounds.daytime.buffer) {
      this.ambientSounds.daytime.setVolume(0.2 * this.dayIntensity * this.masterVolume);
    }
    
    if (this.ambientSounds.nighttime && this.ambientSounds.nighttime.buffer) {
      this.ambientSounds.nighttime.setVolume(0.3 * this.nightIntensity * this.masterVolume);
    }
  }
  
  playFootstep() {
    // Create a single-use sound for footsteps
    const sound = new THREE.Audio(this.listener);
    
    // Randomly select one of 4 footstep sounds
    const stepNum = Math.floor(Math.random() * 4) + 1;
    
    this.audioLoader.load(`/static/sounds/footstep${stepNum}.mp3`, (buffer) => {
      sound.setBuffer(buffer);
      sound.setVolume(0.1 * this.masterVolume);
      sound.play();
    });
  }
  
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    
    // Update all sound volumes
    Object.values(this.ambientSounds).forEach(sound => {
      if (sound.buffer) {
        // Preserve the relative volume ratio
        const relativeVolume = sound.getVolume() / (this.masterMuted ? 0.0001 : this.masterVolume);
        sound.setVolume(relativeVolume * this.masterVolume);
      }
    });
    
    Object.values(this.pointSounds).forEach(pointSound => {
      if (pointSound.sound && pointSound.sound.buffer) {
        const relativeVolume = pointSound.sound.getVolume() / (this.masterMuted ? 0.0001 : this.masterVolume);
        pointSound.sound.setVolume(relativeVolume * this.masterVolume);
      }
    });
  }
  
  toggleMute() {
    this.masterMuted = !this.masterMuted;
    
    if (this.masterMuted) {
      // Store current volume and mute all sounds
      Object.values(this.ambientSounds).forEach(sound => {
        if (sound.buffer) sound.setVolume(0);
      });
      
      Object.values(this.pointSounds).forEach(pointSound => {
        if (pointSound.sound && pointSound.sound.buffer) pointSound.sound.setVolume(0);
      });
    } else {
      // Restore volumes
      this.setMasterVolume(this.masterVolume);
    }
    
    return this.masterMuted;
  }
  
  update(delta, playerVelocity) {
    // Optionally modulate wind sound based on player height or velocity
    if (this.ambientSounds.wind && this.ambientSounds.wind.buffer) {
      // Wind gets stronger with player speed
      const speedFactor = Math.min(1, playerVelocity.length() / 2);
      const windBase = 0.1;
      const windDynamic = 0.2 * speedFactor;
      
      this.ambientSounds.wind.setVolume((windBase + windDynamic) * this.masterVolume);
    }
  }
}
