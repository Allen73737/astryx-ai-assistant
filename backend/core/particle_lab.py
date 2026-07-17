"""Particle Lab Engine — Simple physics simulation with gravity and collisions."""

from __future__ import annotations

import json
import math
import structlog

logger = structlog.get_logger(__name__)


class PhysicsEngine:
    """Simple 2D physics engine for particle simulation."""

    def __init__(self):
        self.particles: list[dict] = []
        self.gravity = 0.5
        self.bounds = {"width": 100, "height": 80}
        self.tick = 0

    def initialize(self, count: int = 30) -> list[dict]:
        """Initialize particles with random positions and velocities."""
        import random
        self.particles = []
        for i in range(count):
            self.particles.append({
                "id": i,
                "x": random.uniform(5, 90),
                "y": random.uniform(5, 70),
                "vx": random.uniform(-1.5, 1.5),
                "vy": random.uniform(-1.5, 1.5),
                "size": random.uniform(2, 6),
                "color": random.choice(["#f472b6", "#c084fc", "#fbbf24", "#38bdf8", "#34d399"]),
                "mass": 1.0,
            })
        self.tick = 0
        return self.particles

    def step(self, gravity: float | None = None) -> list[dict]:
        """Advance the simulation by one tick. Returns updated particle states."""
        if not self.particles:
            return self.initialize(30)

        self.tick += 1
        if gravity is not None:
            self.gravity = max(0, min(5, gravity))

        w, h = self.bounds["width"], self.bounds["height"]

        for p in self.particles:
            # Apply gravity
            p["vy"] += self.gravity * 0.15

            # Apply velocity
            p["x"] += p["vx"] * 0.4
            p["y"] += p["vy"] * 0.4

            # Boundary collision (bounce off walls)
            if p["x"] - p["size"] < 0:
                p["x"] = p["size"]
                p["vx"] *= -0.85
            elif p["x"] + p["size"] > w:
                p["x"] = w - p["size"]
                p["vx"] *= -0.85

            # Floor collision with energy loss
            if p["y"] + p["size"] > h:
                p["y"] = h - p["size"]
                p["vy"] *= -0.7
                # Friction
                p["vx"] *= 0.98
            elif p["y"] - p["size"] < 0:
                p["y"] = p["size"]
                p["vy"] *= -0.85

            # Drag (air resistance)
            p["vx"] *= 0.995
            p["vy"] *= 0.995

            # Clamp velocity
            max_v = 8
            v_mag = math.sqrt(p["vx"] ** 2 + p["vy"] ** 2)
            if v_mag > max_v:
                scale = max_v / v_mag
                p["vx"] *= scale
                p["vy"] *= scale

        # Simple particle-particle collisions (O(n²) but fine for 30 particles)
        for i in range(len(self.particles)):
            for j in range(i + 1, len(self.particles)):
                a = self.particles[i]
                b = self.particles[j]
                dx = b["x"] - a["x"]
                dy = b["y"] - a["y"]
                dist = math.sqrt(dx * dx + dy * dy)
                min_dist = (a["size"] + b["size"]) * 0.8

                if dist < min_dist and dist > 0.01:
                    # Elastic collision
                    nx = dx / dist
                    ny = dy / dist
                    overlap = (min_dist - dist) * 0.5

                    a["x"] -= nx * overlap
                    a["y"] -= ny * overlap
                    b["x"] += nx * overlap
                    b["y"] += ny * overlap

                    # Exchange velocity along collision normal
                    rel_vx = a["vx"] - b["vx"]
                    rel_vy = a["vy"] - b["vy"]
                    rel_vn = rel_vx * nx + rel_vy * ny

                    if rel_vn > 0:
                        impulse = rel_vn * 0.8
                        a["vx"] -= impulse * nx
                        a["vy"] -= impulse * ny
                        b["vx"] += impulse * nx
                        b["vy"] += impulse * ny

        return self.particles

    def set_gravity(self, g: float) -> None:
        """Set gravity value (0-5)."""
        self.gravity = max(0, min(5, g))

    def get_state(self) -> dict:
        """Get full simulation state."""
        return {
            "tick": self.tick,
            "gravity": self.gravity,
            "particle_count": len(self.particles),
            "particles": self.particles,
        }


# Singleton
physics_engine = PhysicsEngine()


async def handle_particles(data: str) -> str:
    """Handle the PARTICLES tool command.

    Format:
        init|count  — Initialize N particles
        step|gravity  — Advance simulation (optional gravity override)
        state  — Get current simulation state
        gravity|0.5  — Set gravity value
        reset  — Reset to defaults
    """
    parts = data.split("|")
    action = parts[0].strip().lower() if parts else "step"
    logger.info("particles_command", action=action)

    if action == "init":
        count = int(parts[1]) if len(parts) > 1 and parts[1].strip().isdigit() else 30
        # Clamp to prevent overload
        count = max(5, min(100, count))
        particles = physics_engine.initialize(count)
        return json.dumps({"type": "init", "count": count, "particles": particles})

    elif action == "step":
        gravity = float(parts[1]) if len(parts) > 1 else physics_engine.gravity
        particles = physics_engine.step(gravity)
        return json.dumps({
            "type": "step",
            "tick": physics_engine.tick,
            "gravity": physics_engine.gravity,
            "particles": particles,
        })

    elif action in ["state", "status"]:
        state = physics_engine.get_state()
        return json.dumps({"type": "state", **state})

    elif action == "gravity":
        if len(parts) > 1 and parts[1].strip():
            g = float(parts[1])
            physics_engine.set_gravity(g)
            return json.dumps({"type": "gravity", "gravity": physics_engine.gravity})
        return json.dumps({"type": "gravity", "gravity": physics_engine.gravity})

    elif action == "reset":
        physics_engine.__init__()
        return json.dumps({"type": "reset", "message": "Physics engine reset."})

    return json.dumps({"error": f"Unknown action: {action}"})
