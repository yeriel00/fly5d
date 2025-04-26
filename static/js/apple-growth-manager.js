import AppleSystem from './AppleSystem.js';

/**
 * AppleGrowthManager
 * - Initializes AppleSystem
 * - Forces initial growth
 * - Periodically checks & grows missing appleswe
 * - Logs each grow/ripen event for debugging
 */
export default class AppleGrowthManager {
  constructor(scene, getTerrainHeight, onCollect, config = {}) {
    // *** INCREASE DEFAULT SPEED MULTIPLIER ***
    const defaults = { speedMultiplier: 5 }; // Start 5x faster (was 1)
    // *** END INCREASE ***
    this.cfg = { ...defaults, ...config };
    this.appleSystem = new AppleSystem(scene, {
      sphereRadius: 400,
      getTerrainHeight,
      onAppleCollected: (type, value, multiplier, position) => {
        console.log(`[AppleGrowthManager] Apple collected! Adding ${value} ${type} apples to player.`);
        if (onCollect) {
          onCollect(type, value, multiplier, position);
        } else {
          console.warn('[AppleGrowthManager] No onCollect callback provided!');
        }
      },
      maxApplesPerTree: 6,
      // Apply speed multiplier directly here as well for clarity
      growthTime: 10 / this.cfg.speedMultiplier, // Use base time from AppleSystem
      growthProbability: 0.25 * this.cfg.speedMultiplier, // Use base prob from AppleSystem
      fallProbability: 0.15, // Fall probability is high enough, maybe don't multiply
      appleRadius: 3.0,
      groundLifetime: 60, // Use shorter lifetime from AppleSystem
      performanceMode: false
    });
  }

  init() {
    // console.log('🍎 [GrowthMgr] initializing apples...');

    // *** NEW: Find trees FIRST ***
    if (typeof this.appleSystem.findAppleTrees === 'function') {
        this.appleSystem.findAppleTrees(); // Call findAppleTrees here
    } else {
        // console.error("[GrowthMgr] CRITICAL: findAppleTrees method not found on AppleSystem!");
        return; // Stop initialization if method is missing
    }

    // Check if trees were found
    if (this.appleSystem.appleTrees.length === 0) {
        // console.warn("[GrowthMgr] No apple trees found by AppleSystem. Apples will not grow.");
        // Optionally, set up a retry mechanism or log more details
    } else {
        // Initial population: Try to grow some apples immediately
        if (typeof this.appleSystem.forceGrowNewApples === 'function') {
            // *** AIM FOR MORE APPLES INITIALLY ***
            const initialGrowth = this.appleSystem.forceGrowNewApples(this.appleSystem.appleTrees.length * 4); // Try 4 per tree initially (was 2)
            // *** END AIM FOR MORE ***
            // console.log(`🍏 [GrowthMgr] Forced initial growth of ${initialGrowth.grown} apples.`);
        } else {
            //  console.warn("[GrowthMgr] forceGrowNewApples not found on AppleSystem.");
        }
    }

    // log ripen events
    const origRipen = this.appleSystem._ripenApple.bind(this.appleSystem);
    this.appleSystem._ripenApple = (apple) => {
    //   console.log(`🍏 [GrowthMgr] ripened at ${apple.position.toArray()}`);
      origRipen(apple);
    };
    // Periodic check and replenish
    this.checkIntervalId = setInterval(() => {
      if (!this.appleSystem) {
          clearInterval(this.checkIntervalId);
          return;
      }
      const counts = this.appleSystem.getAppleCount();
      const stats = this.appleSystem.getStats(); // Keep stats for collection info if needed
      const totalTrees = this.appleSystem.appleTrees.length;
      // *** AIM FOR MORE APPLES PER TREE ***
      const desiredAppleCount = totalTrees * (this.appleSystem.options.maxApplesPerTree * 0.75); // Aim for 75% full (was 50%)
      // *** END AIM FOR MORE ***

      console.log(`🌱 [GrowthMgr] Counts: Tree=${counts.treeApples}, Ground=${counts.groundApples}. Stats:`, stats);

      // If tree apples are below desired threshold, force grow NEW apples
      if (counts.treeApples < desiredAppleCount && totalTrees > 0) {
        const needed = Math.ceil(desiredAppleCount - counts.treeApples);
        // console.log(`🔄 [GrowthMgr] Low on tree apples (${counts.treeApples}/${Math.round(desiredAppleCount)}). Trying to grow ${needed} new ones.`);
        this.appleSystem.forceGrowNewApples(needed);
      }
      // *** CHECK MORE FREQUENTLY ***
    }, 4000); // Check every 4 seconds (was 8)
    // *** END CHECK MORE FREQUENTLY ***
  }

  // NEW: adjust grow speed at runtime
  setSpeedMultiplier(mult) {
    this.cfg.speedMultiplier = mult;
    this.appleSystem.options.growthTime = 30 / mult;
    this.appleSystem.options.growthProbability = 0.05 * mult;
    // console.log(`🍎 [GrowthMgr] speedMultiplier set to ${mult}`);
  }

  // Add cleanup
  cleanup() {
      if (this.checkIntervalId) {
          clearInterval(this.checkIntervalId);
          this.checkIntervalId = null;
      }
      if (this.appleSystem) {
          this.appleSystem.cleanup();
          this.appleSystem = null;
      }
    //   console.log("🍎 [GrowthMgr] Cleaned up.");
  }
}
