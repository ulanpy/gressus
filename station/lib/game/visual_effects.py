"""Visual effects and animations for the tile game.

Provides tile state management, particle systems, and magical effects.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
import pygame


class TileState(Enum):
    """Tile visual states."""
    BASE = "base"        # Calm glowing tile
    READY = "ready"      # Active, waiting to be pressed
    PRESSED = "pressed"  # Hit animation


@dataclass
class Particle:
    """A single particle for effects."""
    x: float
    y: float
    vx: float
    vy: float
    life: float       # Current life (0-1, starts at 1)
    max_life: float   # Total life in seconds
    color: tuple[int, int, int]
    size: float       # Radius
    kind: str = "star"  # "star", "spark", "dot"


@dataclass
class TileVisuals:
    """Visual state for a single tile."""
    state: TileState = TileState.BASE
    pulse_time: float = 0.0      # For pulsing animation
    hit_time: float = 0.0        # Time since hit
    particles: list[Particle] = field(default_factory=list)
    glow_intensity: float = 1.0  # 0-1, based on state
    scale: float = 1.0           # For compress/decompress


class ParticleSystem:
    """Manages visual particles."""

    def __init__(self):
        self.particles: list[Particle] = []

    def add_particle(
        self,
        x: float,
        y: float,
        vx: float,
        vy: float,
        life_s: float,
        color: tuple[int, int, int],
        size: float,
        kind: str = "star",
    ) -> None:
        """Add a new particle."""
        p = Particle(x, y, vx, vy, 1.0, life_s, color, size, kind)
        self.particles.append(p)

    def burst_stars(
        self,
        cx: float,
        cy: float,
        count: int = 12,
        speed: float = 300.0,
        life_s: float = 0.8,
        color: Optional[tuple[int, int, int]] = None,
    ) -> None:
        """Create a burst of stars from a center point."""
        if color is None:
            color = (255, 215, 100)  # Golden
        for _ in range(count):
            angle = random.uniform(0, 2 * math.pi)
            v = random.uniform(0.7, 1.0) * speed
            vx = math.cos(angle) * v
            vy = math.sin(angle) * v
            size = random.uniform(2.0, 5.0)
            self.add_particle(cx, cy, vx, vy, life_s, color, size, "star")

    def sparkle_ring(
        self,
        cx: float,
        cy: float,
        radius: float = 50.0,
        count: int = 8,
        life_s: float = 0.6,
    ) -> None:
        """Create sparkles around a circle."""
        for i in range(count):
            angle = (i / count) * 2 * math.pi
            x = cx + radius * math.cos(angle)
            y = cy + radius * math.sin(angle)
            color = (200 + random.randint(-50, 50), 200 + random.randint(-50, 50), 255)
            self.add_particle(x, y, 0, 0, life_s, color, 2.0, "spark")

    def update(self, dt: float) -> None:
        """Update all particles."""
        dead = []
        for i, p in enumerate(self.particles):
            p.life -= dt / p.max_life
            if p.life <= 0:
                dead.append(i)
            else:
                p.x += p.vx * dt
                p.y += p.vy * dt
                # Gravity for star particles
                if p.kind == "star":
                    p.vy += 150.0 * dt  # Downward acceleration

        for i in reversed(dead):
            self.particles.pop(i)

    def draw(self, surface: pygame.Surface) -> None:
        """Draw all particles."""
        for p in self.particles:
            if p.life <= 0:
                continue
            # Fade out as life decreases
            alpha = int(255 * p.life)
            if p.kind == "star":
                # Draw rotating star
                angle = (1.0 - p.life) * 360
                size = int(p.size)
                self._draw_star(surface, int(p.x), int(p.y), size, p.color, alpha, angle)
            elif p.kind == "spark":
                pygame.draw.circle(surface, p.color, (int(p.x), int(p.y)), int(p.size))
            else:  # dot
                pygame.draw.circle(surface, p.color, (int(p.x), int(p.y)), max(1, int(p.size * p.life)))

    @staticmethod
    def _draw_star(
        surface: pygame.Surface,
        cx: int,
        cy: int,
        size: int,
        color: tuple[int, int, int],
        alpha: int,
        angle: float,
    ) -> None:
        """Draw a rotating star."""
        points = []
        for i in range(10):
            a = angle + (i / 10) * 360
            rad = math.radians(a)
            r = size if i % 2 == 0 else size / 2
            x = cx + r * math.cos(rad)
            y = cy + r * math.sin(rad)
            points.append((x, y))
        
        # Create temporary surface with alpha
        star_surf = pygame.Surface((size * 3, size * 3), pygame.SRCALPHA)
        offset = size * 1.5
        points_offset = [(x - cx + offset, y - cy + offset) for x, y in points]
        pygame.draw.polygon(star_surf, (*color, alpha), points_offset)
        surface.blit(star_surf, (cx - int(offset), cy - int(offset)))


class TileEffectRenderer:
    """Renders tile visual effects."""

    # Color palettes
    COLOR_BASE_GLOW = (100, 180, 255)      # Cyan/blue
    COLOR_READY_GLOW = (150, 220, 255)     # Brighter cyan
    COLOR_READY_NEON = (0, 255, 255)       # Neon cyan
    COLOR_PRESSED_STAR = (255, 215, 100)   # Golden
    COLOR_PRESSED_SPARK = (255, 255, 255)  # White

    @staticmethod
    def draw_base_tile(
        surface: pygame.Surface,
        rect: pygame.Rect,
        glow_intensity: float = 1.0,
    ) -> None:
        """Draw a calm base tile with soft glow."""
        # Main tile with rounded corners
        color = TileEffectRenderer.COLOR_BASE_GLOW
        # Soften color slightly
        color_soft = tuple(int(c * (0.7 + 0.3 * glow_intensity)) for c in color)
        pygame.draw.rect(surface, color_soft, rect, border_radius=12)
        
        # Glow outline
        glow_color = tuple(int(c * 0.6 * glow_intensity) for c in color)
        pygame.draw.rect(surface, glow_color, rect, width=3, border_radius=12)
        
        # Inner soft edge
        inner_rect = rect.inflate(-6, -6)
        pygame.draw.rect(surface, (200, 230, 255), inner_rect, width=1, border_radius=10)

    @staticmethod
    def draw_ready_tile(
        surface: pygame.Surface,
        rect: pygame.Rect,
        pulse_phase: float = 0.0,
        glow_intensity: float = 1.0,
    ) -> None:
        """Draw an active ready tile with neon glow."""
        # Pulsing effect (0-1)
        pulse = 0.5 + 0.5 * math.sin(pulse_phase * 2 * math.pi)
        intensity = 0.7 + 0.3 * pulse
        
        # Main tile - brighter
        color = TileEffectRenderer.COLOR_READY_GLOW
        color_bright = tuple(int(c * intensity * glow_intensity) for c in color)
        pygame.draw.rect(surface, color_bright, rect, border_radius=12)
        
        # Neon outline that pulses
        neon_color = TileEffectRenderer.COLOR_READY_NEON
        neon_intensity = int(200 * intensity * glow_intensity)
        neon_rgba = (*neon_color, neon_intensity)
        
        # Draw neon-style outline with slight glow
        outline_width = 4
        pygame.draw.rect(surface, neon_color, rect, width=outline_width, border_radius=12)
        
        # Outer glow (larger outline)
        outer_rect = rect.inflate(6, 6)
        outer_glow = tuple(int(c * 0.4 * intensity) for c in neon_color)
        pygame.draw.rect(surface, outer_glow, outer_rect, width=2, border_radius=14)
        
        # Inner bright edge
        inner_rect = rect.inflate(-8, -8)
        pygame.draw.rect(surface, (255, 255, 255), inner_rect, width=2, border_radius=8)

    @staticmethod
    def draw_pressed_tile(
        surface: pygame.Surface,
        rect: pygame.Rect,
        compress_factor: float = 0.1,
    ) -> None:
        """Draw a compressed tile being pressed."""
        # Slightly compressed
        compressed_rect = rect.copy()
        compressed_rect.height = int(rect.height * (1.0 - compress_factor))
        compressed_rect.centery = rect.centery
        
        # Bright white/golden
        pygame.draw.rect(surface, (255, 255, 255), compressed_rect, border_radius=10)
        pygame.draw.rect(surface, (255, 200, 100), compressed_rect, width=3, border_radius=10)


class ComboBar:
    """Visual progress bar for combo system."""

    def __init__(self, x: int, y: int, width: int, height: int = 40):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.progress = 0.0  # 0-1
        self.combo_count = 0  # 0-10
        self.last_combo_time = 0.0
        self.burst_particles: list[Particle] = []

    def update(self, dt: float, combo_count: int) -> None:
        """Update combo bar state."""
        self.combo_count = combo_count
        self.progress = (combo_count % 10) / 10.0
        
        # Update burst particles
        dead = []
        for i, p in enumerate(self.burst_particles):
            p.life -= dt / p.max_life
            if p.life <= 0:
                dead.append(i)
            else:
                p.x += p.vx * dt
                p.y += p.vy * dt
                p.vy += 200.0 * dt  # Gravity
        
        for i in reversed(dead):
            self.burst_particles.pop(i)

    def combo_complete(self) -> None:
        """Called when combo is complete."""
        # Create burst effect
        cx = self.x + self.width // 2
        cy = self.y + self.height // 2
        for _ in range(20):
            angle = random.uniform(0, 2 * math.pi)
            speed = random.uniform(150, 400)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            color = (random.choice([255, 200]), random.randint(100, 255), random.randint(50, 150))
            p = Particle(cx, cy, vx, vy, 1.0, 0.8, color, random.uniform(2, 6), "star")
            self.burst_particles.append(p)

    def draw(self, surface: pygame.Surface) -> None:
        """Draw the combo bar."""
        # Background bar
        pygame.draw.rect(surface, (30, 30, 40), (self.x, self.y, self.width, self.height), border_radius=8)
        
        # Progress fill
        fill_width = int(self.width * self.progress)
        fill_color = (100 + int(100 * self.progress), 200, 100 + int(100 * self.progress))
        pygame.draw.rect(surface, fill_color, (self.x, self.y, fill_width, self.height), border_radius=8)
        
        # Animated sparkles inside bar
        sparkle_count = max(1, int(5 * self.progress))
        for i in range(sparkle_count):
            sx = self.x + random.randint(10, self.width - 10)
            sy = self.y + random.randint(5, self.height - 5)
            pygame.draw.circle(surface, (255, 255, 255), (sx, sy), 2)
        
        # Border
        pygame.draw.rect(surface, (150, 200, 150), (self.x, self.y, self.width, self.height), width=2, border_radius=8)
        
        # Combo count text
        if self.combo_count > 0:
            font = pygame.font.Font(None, 28)
            text = font.render(f"{self.combo_count}/10", True, (255, 255, 255))
            text_rect = text.get_rect(center=(self.x + self.width // 2, self.y + self.height // 2))
            surface.blit(text, text_rect)
        
        # Draw burst particles
        for p in self.burst_particles:
            if p.life > 0:
                alpha = int(255 * p.life)
                angle = (1.0 - p.life) * 360
                size = int(p.size)
                # Simple star draw
                pygame.draw.circle(surface, p.color, (int(p.x), int(p.y)), size)


class BackgroundEffects:
    """Animated background effects."""

    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.time = 0.0
        # Background stars
        self.bg_stars = []
        for _ in range(20):
            x = random.uniform(0, width)
            y = random.uniform(0, height)
            brightness = random.uniform(0.1, 0.4)
            self.bg_stars.append({"x": x, "y": y, "brightness": brightness})

    def update(self, dt: float) -> None:
        """Update background effects."""
        self.time += dt
        # Subtle floating animation
        for star in self.bg_stars:
            star["y"] = star["y"] + math.sin(self.time + star["x"]) * 0.5

    def draw(self, surface: pygame.Surface) -> None:
        """Draw background effects."""
        # Subtle floating stars
        for star in self.bg_stars:
            brightness = int(255 * star["brightness"] * (0.5 + 0.5 * math.sin(self.time * 2)))
            pygame.draw.circle(surface, (brightness, brightness, brightness + 50), (int(star["x"]), int(star["y"])), 1)
