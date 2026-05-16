# Visual Effects & Magic Rehabilitation System

This document describes the complete visual overhaul of the Treadmill Tile Game designed for pediatric rehabilitation therapy.

## Overview

The tile game now features a **magical, rewarding visual system** with:
- Clean, soft cartoon aesthetic optimized for projector visibility
- Smooth animations and particle effects
- Meaningful visual feedback through tile states
- Combo system with celebration effects
- Accessibility for children during physical rehabilitation

## Visual Design Philosophy

### Core Principles
- **Safe**: Soft, rounded, non-aggressive visuals
- **Motivating**: Clear feedback for successful steps
- **Magical**: Rewarding star bursts and sparkle effects
- **Accessible**: High contrast for projection, no overwhelming stimuli
- **Therapeutic**: Smooth pacing suitable for rehabilitation therapy

### Color Palette
- **Base Tiles**: Soft cyan/blue (100, 180, 255) for calm, neutral state
- **Ready Tiles**: Brighter cyan (150, 220, 255) with neon outline for active state
- **Pressed Tiles**: White/golden transition for compression effect
- **Particles**: Golden stars (255, 215, 100) and white sparkles
- **Background**: Dark (0, 0, 0) for projector contrast with subtle floating stars

## Tile System - Three States

### 1. Base Tile (Inactive)
```
Visual: Calm glowing rectangular tile with rounded corners
Properties:
  - Soft blue/cyan color palette (100, 180, 255)
  - Subtle idle pulsing animation (0.5-1.0x intensity)
  - Rounded corners (radius: 12px)
  - Inner and outer glow outline
  - Futuristic cartoon look

Purpose: Neutral visual state, no action required
```

### 2. Ready Tile (Active - Awaiting Step)
```
Visual: Active tile that child should step on
Properties:
  - Brighter glow (150, 220, 255)
  - Neon cyan outline (0, 255, 255)
  - Pulsing effect that increases intensity (0.7-1.0x, 3 cycles/sec)
  - Outer luminous halo
  - Floating sparkles on edges

Animation: Smooth pulse cycle
  - Phase: sin(time * 2π * 3.0) cycles 3 times per second
  - Intensity modulation makes tile "breathe"

Purpose: Clear visual signal for child to step on this tile
```

### 3. Pressed Tile (Hit!)
```
Visual: Magical reward when child correctly steps on tile
Properties:
  - Tile compresses slightly (compress_factor: 0% → 20% over 0.1s)
  - Bright white/golden color during transition
  - Remains visible for 0.18 seconds after hit

Particle Effects:
  - Star Burst (12 stars minimum)
    - Speed: 300 px/s outward
    - Golden color (255, 215, 100)
    - Rotating and fading effect
    - Lifetime: 0.8 seconds
  
  - Sparkle Ring (8 sparkles)
    - Appear around tile edge
    - Radius: 30px
    - Cyan-blue color with variation
    - Lifetime: 0.6 seconds

Purpose: Strong positive reinforcement for successful step
```

## Combo System

### Progress Bar
```
Location: Top of screen, centered
Size: 50% of screen width, 40px height
Position: (scr_w * 0.25, 20)

Display:
  - Background: Dark rounded rectangle
  - Progress fill: Green to cyan gradient
  - Progress text: "X/10" (current/max)
  - Animated sparkles inside bar
  - Glowing border

Update Rate: 10% per successful step
```

### Combo Complete (10 Steps)
```
Trigger: Every 10 consecutive successful steps without a miss

Visual Effect:
  - Giant star burst (20 stars minimum)
  - Rainbow colors: Mix of golds, purples, pinks
  - Doubled speed: 400-500 px/s
  - Multiple sparkle rings (5 rings × 8 sparkles)
  - Larger radius: 60px
  - Brief intense glow across treadmill

Audio: Success chime (existing system)
Command: "COMBO_COMPLETE" sent to challenge system

Behavior After:
  - Combo counter resets to 0
  - Bar resets with burst animation
  - Ready for next combo sequence
```

### Combo Reset
```
Trigger: When tile passes bottom of screen without being pressed (miss)

Effect: Combo_count immediately resets to 0
Warning: Visual feedback shows progress loss
```

## Particle System

### Particle Types

#### Star Particles
```
Shape: Rotating 10-pointed star
Rotation: (1 - life) * 360 degrees per particle
Physics:
  - Initial velocity: outward from center
  - Gravity: 150 px/s² downward
  - Fade: Linear based on remaining life (alpha = 255 * life)
Lifetime: 0.6 - 0.8 seconds
```

#### Sparkle Particles
```
Shape: Small bright circle (radius: 2px)
Physics:
  - Static position (no velocity)
  - Optional gravity
  - Fade: Linear
Lifetime: 0.4 - 0.6 seconds
```

#### Dot Particles
```
Shape: Small circle with decreasing radius
Physics:
  - May have initial velocity
  - Gravity optional
  - Radius decays with life
Lifetime: 0.3 - 0.5 seconds
```

### Burst Effects

#### Star Burst
```python
particle_sys.burst_stars(
    cx, cy,              # Center position
    count=12,            # Number of stars
    speed=300,           # Initial speed (px/s)
    life_s=0.8,          # Total lifetime
    color=(255, 215, 100) # Golden
)
```

#### Sparkle Ring
```python
particle_sys.sparkle_ring(
    cx, cy,              # Center position
    radius=30,           # Ring radius
    count=8,             # Number of sparkles
    life_s=0.6           # Lifetime
)
```

## Background Effects

### Animated Background
```
Feature: Subtle floating stars in background
Purpose: Relaxing, magical atmosphere
Animation:
  - 20 stars at random positions
  - Brightness: 0.1 - 0.4 of maximum
  - Subtle up-down floating motion
  - Sine wave animation: sin(time + x_position)
  - Cycle: ~1 star per pixel column for smooth variation

Visual Purpose: Fills empty space, adds depth
```

## Command System

The game sends challenge commands to a TCP server for integration with other systems.

### Commands Sent

#### Step Detection
```
Format: "STEP_LEFT" or "STEP_RIGHT"
Trigger: Immediate upon tile press
Purpose: Notify system of foot press location
Host: 127.0.0.1 (configurable)
Port: 5000 (configurable)
```

#### Combo Complete
```
Format: "COMBO_COMPLETE"
Trigger: Every 10 successful steps
Purpose: Trigger special reward sequence
Host: 127.0.0.1 (configurable)
Port: 5000 (configurable)
```

### Command Configuration
```bash
--command-host 127.0.0.1  # Server hostname
--command-port 5000       # Server port
```

## Visual Test Mode

### Purpose
Demonstrate all visual states and effects without camera hardware.

### Usage
```bash
python scripts/tile_game.py --test
```

### Demo Sequence
Press any key to cycle through:

1. **BASE TILE** - Calm glowing tile (neutral state)
2. **READY TILE** - Active pulsing tile (child should step)
3. **PRESSED TILE** - Magical star burst effect (success!)
4. **COMBO COMPLETE** - Rainbow celebration (10 steps done!)

### Controls
- **Any Key**: Advance to next state
- **ESC/Q**: Quit test mode

### Test Mode Output
- Displays current state name
- Shows state description
- Sends test commands to localhost:5000
- Demonstrates all particle effects

## Technical Implementation

### File Structure
```
src/game/
  ├── visual_effects.py    # Core effects system
  ├── models.py             # Updated with TileVisuals
  ├── render.py             # Enhanced rendering
  └── [other files]

scripts/
  └── tile_game.py          # Main game with visual integration
```

### Key Classes

#### TileState (Enum)
```python
class TileState(Enum):
    BASE = "base"           # Calm, neutral
    READY = "ready"         # Active, awaiting press
    PRESSED = "pressed"     # Being stepped on
```

#### TileVisuals (Dataclass)
```python
@dataclass
class TileVisuals:
    state: TileState
    pulse_time: float        # For animation phase
    hit_time: float          # Time since hit
    particles: list[Particle]
    glow_intensity: float    # 0-1
    scale: float             # For compression
```

#### ParticleSystem
Manages burst effects, star explosions, and sparkle trails.

#### ComboBar
Renders progress bar with visual feedback.

#### BackgroundEffects
Manages ambient background animations.

#### TileEffectRenderer
Renders individual tile states and visual effects.

## Configuration

### Game Launch (Normal Mode)
```bash
python scripts/tile_game.py \
    --test false \
    --command-host 127.0.0.1 \
    --command-port 5000 \
    --speed 0.22 \
    --step-time-s 1.45
```

### Visual Test Mode
```bash
python scripts/tile_game.py \
    --test \
    --command-host 127.0.0.1 \
    --command-port 5000
```

## Performance Considerations

### Particle Limits
- Maximum active particles: ~200 recommended
- Burst limit: 20 stars + 8 sparkles per event
- Update rate: 60 FPS

### Optimization
- Alpha blending for particle fading
- Efficient particle culling on lifecycle
- Background star positions pre-calculated
- Particle physics simplified (gravity only)

## Accessibility Features

### For Children with Mobility Challenges
- Soft, non-aggressive visual design
- Clear, simple feedback
- Rewarding effects motivate continued engagement
- No flashing or overwhelming stimuli
- Smooth animations reduce visual fatigue

### For Rehabilitation Therapists
- Clear visual indication of successful step
- Combo tracking shows progress
- Test mode for demonstration
- Adjustable parameters (speed, step timing)

## Future Enhancements

### Potential Additions
- Difficulty progression (tile size/speed)
- Sound effect integration with particles
- Theme variations (space, underwater, etc.)
- Accessibility mode (high contrast, simplified)
- Performance metrics visualization
- Adjustment calibration UI

### Research Integration Points
- Step detection accuracy logging
- Engagement metrics tracking
- Therapy effectiveness monitoring
- Motion analysis feedback

## Troubleshooting

### Visual Issues

**Problem**: Particles not appearing
- Check particle_system is initialized
- Verify draw_scene is called with particle_system parameter

**Problem**: Tiles not pulsing
- Verify TileState.READY is set
- Check pulse_time is being updated in draw_scene

**Problem**: Low frame rate
- Reduce particle count limits
- Check background star count
- Profile with Python cProfile

### Command Issues

**Problem**: Commands not sending
- Verify command-host and command-port are correct
- Check network connectivity to target server
- Look for socket timeout errors in stderr

**Problem**: Commands arrive but aren't processed
- Verify command format: "STEP_LEFT", "STEP_RIGHT", "COMBO_COMPLETE"
- Check server is listening on correct port
- Verify TCP connection is established

## References

### Related Files
- [src/game/hit_logic.py](src/game/hit_logic.py) - Step detection
- [src/game/audio.py](src/game/audio.py) - Sound integration
- [config/calibration.json](config/calibration.json) - Camera calibration

### Standards Compliance
- Python 3.10+
- Pygame 2.1+
- Type hints for type safety
