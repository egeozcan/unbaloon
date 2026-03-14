import {
  BALLOON_HIGHLIGHTS,
  BG_COLOR_TOP,
  BG_COLOR_BOTTOM,
  STRING_LENGTH_RATIO,
  POP_EXPAND_SCALE,
  PARTICLE_LIFETIME,
} from './constants';
import type { Balloon, Particle } from './balloon';

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  drawBackground(width: number, height: number): void {
    const grad = this.ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, BG_COLOR_TOP);
    grad.addColorStop(1, BG_COLOR_BOTTOM);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawBalloon(b: Balloon): void {
    if (b.state === 'popping') {
      this.drawPoppingBalloon(b);
      return;
    }

    const ctx = this.ctx;
    const rx = b.radiusX * b.scaleX;
    const ry = b.radiusY * b.scaleY;

    ctx.save();
    ctx.translate(b.x, b.y);

    // Balloon body
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();

    // 3D highlight shine
    const highlightColor = BALLOON_HIGHLIGHTS[b.number] || '#FFFFFF';
    const shine = ctx.createRadialGradient(
      -rx * 0.3, -ry * 0.3, rx * 0.05,
      -rx * 0.1, -ry * 0.1, rx * 0.6
    );
    shine.addColorStop(0, highlightColor);
    shine.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();

    // Number text
    const fontSize = Math.round(ry * 0.7);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(String(b.number), 0, 0);

    // Tie knot (small triangle at bottom)
    const knotY = ry;
    const knotSize = rx * 0.15;
    ctx.beginPath();
    ctx.moveTo(-knotSize, knotY);
    ctx.lineTo(knotSize, knotY);
    ctx.lineTo(0, knotY + knotSize * 2);
    ctx.closePath();
    ctx.fillStyle = b.color;
    ctx.fill();

    // String (quadratic curve hanging down)
    const stringLen = ry * STRING_LENGTH_RATIO;
    ctx.beginPath();
    ctx.moveTo(0, knotY + knotSize * 2);
    ctx.quadraticCurveTo(rx * 0.3, knotY + knotSize * 2 + stringLen * 0.5, 0, knotY + knotSize * 2 + stringLen);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  private drawPoppingBalloon(b: Balloon): void {
    const ctx = this.ctx;
    const t = b.popProgress;

    // Expanding and fading balloon body
    if (t < 0.5) {
      const expandT = t / 0.5; // 0→1
      const scale = 1 + (POP_EXPAND_SCALE - 1) * expandT;
      const alpha = 1 - expandT;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(b.x, b.y);
      ctx.beginPath();
      ctx.ellipse(0, 0, b.radiusX * scale, b.radiusY * scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.restore();
    }

    // Particles
    this.drawParticles(b.particles);
  }

  private drawParticles(particles: Particle[]): void {
    const ctx = this.ctx;
    for (const p of particles) {
      if (p.age >= PARTICLE_LIFETIME) continue;
      const alpha = 1 - p.age / PARTICLE_LIFETIME;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }
  }

}
