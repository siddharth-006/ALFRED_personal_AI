"use client";

let audioContext: AudioContext | null = null;
let soundEnabled = true;
let userInteracted = false;

if (typeof window !== 'undefined') {
  const markInteracted = () => {
    userInteracted = true;
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    window.removeEventListener('click', markInteracted, true);
    window.removeEventListener('keydown', markInteracted, true);
  };
  window.addEventListener('click', markInteracted, true);
  window.addEventListener('keydown', markInteracted, true);
}

export const initAudio = () => {
  if (typeof window === 'undefined') return;
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (userInteracted && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
};

export const setSoundEnabled = (enabled: boolean) => {
  soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('alfred_sound_enabled', enabled ? 'true' : 'false');
  }
};

export const isSoundEnabled = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('alfred_sound_enabled') !== 'false';
  }
  return true;
};

// Advanced synthetic sounds using AudioContext layering
const playCinematicSound = (
  type: 'hover' | 'click' | 'success' | 'startup' | 'scan',
  volumeOffset: number = 1
) => {
  if (!soundEnabled) return;
  
  // Ensure AudioContext is initialized and active
  initAudio();
  const ctx = audioContext;
  if (!ctx) return;
  if (!userInteracted && ctx.state === 'suspended') return; // Cannot play if blocked by browser policy

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.value = volumeOffset;

  switch (type) {
    case 'hover': {
      // Crisp, extremely short glass-like tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3000, now);
      osc.frequency.exponentialRampToValueAtTime(8000, now + 0.02);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
      break;
    }
    
    case 'click': {
      // Deeper, punchy UI confirmation click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05); // sharp drop creates "thump"
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }

    case 'success': {
      // Cinematic futuristic chime (multiple layered sines forming a chord)
      const frequencies = [523.25, 659.25, 1046.50]; // C5, E5, C6
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        
        osc.frequency.setValueAtTime(freq, now + i * 0.05); // slight arpeggiation
        
        gain.gain.setValueAtTime(0, now + i * 0.05);
        gain.gain.linearRampToValueAtTime(0.05, now + i * 0.05 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.8);
        
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 1);
      });
      break;
    }

    case 'startup': {
      // Mechanical boot sequence: "arranging all the metal items"
      // We'll use multiple metallic clicks, clanks, and servo whirs overlapping.
      
      // 1. Servo Whirs (Motor powering up and moving)
      const servoOsc = ctx.createOscillator();
      const servoGain = ctx.createGain();
      servoOsc.type = 'sawtooth';
      
      // Pitch goes up and down like a robot arm moving
      servoOsc.frequency.setValueAtTime(100, now);
      servoOsc.frequency.linearRampToValueAtTime(300, now + 0.2);
      servoOsc.frequency.linearRampToValueAtTime(150, now + 0.4);
      servoOsc.frequency.linearRampToValueAtTime(400, now + 0.7);
      servoOsc.frequency.linearRampToValueAtTime(50, now + 1.2);
      
      servoGain.gain.setValueAtTime(0, now);
      servoGain.gain.linearRampToValueAtTime(0.1, now + 0.1);
      servoGain.gain.setValueAtTime(0.1, now + 0.6);
      servoGain.gain.linearRampToValueAtTime(0.001, now + 1.2);
      
      servoOsc.connect(servoGain);
      servoGain.connect(masterGain);
      servoOsc.start(now);
      servoOsc.stop(now + 1.3);

      // 2. Metallic Clanks and Clicks (Suit assembling)
      const clankTimes = [0.1, 0.3, 0.45, 0.7, 0.85, 1.0, 1.2, 1.5];
      
      clankTimes.forEach((timeOffset, index) => {
        // Metallic burst using multiple inharmonic oscillators
        const clankGain = ctx.createGain();
        clankGain.connect(masterGain);
        
        // Envelope for sharp impact
        clankGain.gain.setValueAtTime(0, now + timeOffset);
        clankGain.gain.linearRampToValueAtTime(index === clankTimes.length - 1 ? 0.5 : 0.2, now + timeOffset + 0.01);
        clankGain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.15);

        // Frequencies for a metallic "thwack"
        const freqs = index === clankTimes.length - 1 
          ? [200, 450, 700, 1100, 1800] // Heavy final clank
          : [800, 1200, 1700, 2500, 3500]; // Lighter assembly clicks

        freqs.forEach(freq => {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          // Pitch drops slightly for impact feel
          osc.frequency.setValueAtTime(freq, now + timeOffset);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + timeOffset + 0.1);
          
          osc.connect(clankGain);
          osc.start(now + timeOffset);
          osc.stop(now + timeOffset + 0.2);
        });
      });

      // 3. Final Power Up Bass Drop
      const powerOsc = ctx.createOscillator();
      const powerGain = ctx.createGain();
      powerOsc.type = 'sine';
      
      // Drops in right as the final clank hits (1.5s)
      powerOsc.frequency.setValueAtTime(250, now + 1.5);
      powerOsc.frequency.exponentialRampToValueAtTime(30, now + 3.0);
      
      powerGain.gain.setValueAtTime(0, now + 1.5);
      powerGain.gain.linearRampToValueAtTime(0.4, now + 1.6);
      powerGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
      
      powerOsc.connect(powerGain);
      powerGain.connect(masterGain);
      powerOsc.start(now + 1.5);
      powerOsc.stop(now + 4);

      break;
    }

    case 'scan': {
      // Soft sonar ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.6);
      break;
    }
  }
};

export const playHoverSound = () => playCinematicSound('hover', 0.4);
export const playClickSound = () => playCinematicSound('click', 0.8);
export const playSuccessSound = () => playCinematicSound('success', 1.0);
export const playStartupSound = () => playCinematicSound('startup', 1.5);
export const playScanSound = () => playCinematicSound('scan', 0.5);

if (typeof window !== 'undefined') {
  soundEnabled = isSoundEnabled();
}
