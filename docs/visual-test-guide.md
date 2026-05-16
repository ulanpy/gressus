# Quick Start - Visual Effects & Testing

## Running the Visual Test Mode

### Minimal Command (with defaults)
```bash
cd /home/alya/treadmillgame
python scripts/tile_game.py --test
```

### With Custom Command Server
```bash
python scripts/tile_game.py --test \
    --command-host 192.168.1.100 \
    --command-port 9000
```

### Display Selection
```bash
python scripts/tile_game.py --test --display 0
```

## Test Mode Walkthrough

Once the test window opens:

1. **BASE TILE** (First Screen)
   - Shows calm, glowing blue tile
   - Soft pulsing animation
   - Represents neutral/waiting state
   - **Action**: Press any key to proceed

2. **READY TILE** (Second Screen)
   - Shows brighter, active tile
   - Neon cyan outline
   - Fast pulsing effect
   - **Action**: Press any key to proceed

3. **PRESSED TILE** (Third Screen)
   - Shows tile being stepped on
   - Golden star burst explodes outward
   - Sparkle ring around tile
   - Sends "STEP_LEFT" command
   - **Action**: Press any key to proceed

4. **COMBO COMPLETE** (Fourth Screen)
   - Shows rainbow celebration
   - Multiple tiles with combined bursts
   - Heavy particle effects
   - Sends "COMBO_COMPLETE" command
   - **Action**: Press any key to cycle back to BASE TILE

## Command Integration

### Setting Up a Command Receiver

Example Python server to receive commands:

```python
import socket

def start_command_server(host='127.0.0.1', port=5000):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((host, port))
    server.listen(1)
    print(f"Listening for commands on {host}:{port}")
    
    while True:
        conn, addr = server.accept()
        data = conn.recv(1024).decode().strip()
        print(f"Received from {addr}: {data}")
        
        if data == "STEP_LEFT":
            print("  → Left foot step detected")
        elif data == "STEP_RIGHT":
            print("  → Right foot step detected")
        elif data == "COMBO_COMPLETE":
            print("  → 🎉 Combo complete! 10 steps achieved!")
        
        conn.close()

if __name__ == '__main__':
    start_command_server()
```

Save as `receive_commands.py`, then run:
```bash
python receive_commands.py
```

In another terminal, run the test:
```bash
python scripts/tile_game.py --test --command-host 127.0.0.1 --command-port 5000
```

### Normal Game Mode with Commands

```bash
python scripts/tile_game.py \
    --command-host 127.0.0.1 \
    --command-port 5000 \
    --speed 0.22 \
    --step-time-s 1.45
```

## Visual Features Demonstrated

### Tile States
| State | Visual | Meaning |
|-------|--------|---------|
| **BASE** | Soft glowing blue | Neutral, waiting |
| **READY** | Bright cyan + pulse | Ready to be stepped on |
| **PRESSED** | Golden burst + sparkles | Successfully stepped on |

### Effects
- **Star Burst**: 12+ golden stars exploding outward
- **Sparkle Ring**: 8 cyan sparkles circling the tile
- **Combo Bar**: Glowing progress indicator (0-10)
- **Background**: Subtle floating stars

### Performance
- **FPS**: 60 FPS target
- **Particles**: ~50-100 during normal play
- **Particles (Burst)**: 20+ during combo effects

## Troubleshooting

### Test Mode Won't Start
```bash
# Check Python version (3.10+)
python3 --version

# Check pygame installation
python3 -c "import pygame; print(pygame.__version__)"

# Check display configuration
python3 scripts/tile_game.py --test --display 0  # Try different display numbers
```

### Commands Not Sending
```bash
# Check if server is listening
netstat -tlnp | grep 5000

# Look for errors in stderr
python scripts/tile_game.py --test 2>&1 | grep command
```

### Graphics Issues
```bash
# Verify WAYLAND settings
echo $WAYLAND_DISPLAY
echo $QT_QPA_PLATFORM

# Force XCB
export QT_QPA_PLATFORM=xcb
python scripts/tile_game.py --test
```

## Next Steps

### Normal Game Play
Once visual effects are tested:

```bash
# Capture floor baseline
python scripts/tile_game.py

# Press SPACE to capture floor and start game
# Press ESC to quit
```

### Integration with Challenge System
Connect the command receiver to your challenge/therapy system:

```
Game → TCP Commands → Challenge Manager
        (STEP_LEFT)
        (STEP_RIGHT)
        (COMBO_COMPLETE)
```

### Customization
Modify visual properties in `src/game/visual_effects.py`:
- `COLOR_BASE_GLOW` - Base tile color
- `COLOR_READY_GLOW` - Ready tile color  
- `COLOR_READY_NEON` - Ready tile neon outline
- `COLOR_PRESSED_STAR` - Star burst color
- Particle counts and speeds

## Performance Optimization

If experiencing low FPS:

1. Reduce background stars:
   ```python
   # In BackgroundEffects.__init__, change:
   for _ in range(20):  # Reduce to 10 or less
   ```

2. Limit particle count:
   ```python
   # In ParticleSystem, add max limit check
   ```

3. Profile with:
   ```bash
   python -m cProfile -s cumtime scripts/tile_game.py --test
   ```

## File Locations

```
/home/alya/treadmillgame/
├── scripts/
│   └── tile_game.py           # Main game script
├── src/game/
│   ├── visual_effects.py      # Visual system (NEW)
│   ├── models.py              # Data models (UPDATED)
│   ├── render.py              # Rendering (UPDATED)
│   └── ...
├── docs/
│   ├── visual-effects.md      # Full documentation (NEW)
│   └── visual-test-guide.md   # This file
└── config/
    └── calibration.json       # Camera calibration
```

## Key Commands Reference

```bash
# Test mode (visual demo)
python scripts/tile_game.py --test

# Test with custom server
python scripts/tile_game.py --test --command-host 192.168.1.100 --command-port 9000

# Normal game
python scripts/tile_game.py

# With camera display
python scripts/tile_game.py --display 0

# Slow speed (easy)
python scripts/tile_game.py --speed 0.15 --step-time-s 1.8

# Fast speed (hard)
python scripts/tile_game.py --speed 0.35 --step-time-s 1.2
```

## Questions & Support

See the full documentation in [docs/visual-effects.md](visual-effects.md) for:
- Detailed visual design philosophy
- Particle system internals
- Accessibility features
- Future enhancement ideas
