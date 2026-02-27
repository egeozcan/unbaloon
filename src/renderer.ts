import {
  BALLOON_HIGHLIGHTS,
  BG_COLOR_TOP,
  BG_COLOR_BOTTOM,
  STRING_LENGTH_RATIO,
  POP_EXPAND_SCALE,
  PARTICLE_LIFETIME,
  GAUGE_MAX,
  GAUGE_RADIUS_RATIO,
  GAUGE_MARGIN,
  GAUGE_LINE_WIDTH_RATIO,
  GAUGE_COLORS,
  GAUGE_FLASH_DURATION,
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

  drawGauge(screenWidth: number, count: number, level: number, flashTimer: number): void {
    const ctx = this.ctx;
    const radius = screenWidth * GAUGE_RADIUS_RATIO;
    const lineWidth = radius * GAUGE_LINE_WIDTH_RATIO;
    const cx = screenWidth - GAUGE_MARGIN - radius;
    const cy = GAUGE_MARGIN + radius;

    ctx.save();

    // Flash effect on level-up
    if (flashTimer > 0) {
      const flashAlpha = 0.4 * (flashTimer / GAUGE_FLASH_DURATION);
      ctx.beginPath();
      ctx.arc(cx, cy, radius + lineWidth, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fill();
    }

    // Background track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Colored arc — sweeps from top (−π/2) clockwise
    if (count > 0) {
      const fraction = count / GAUGE_MAX;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + fraction * Math.PI * 2;

      // Create a gradient along the arc using segmented colors
      const segments = Math.max(1, Math.ceil(fraction * GAUGE_COLORS.length));
      for (let i = 0; i < segments; i++) {
        const segStart = startAngle + (i / GAUGE_COLORS.length) * Math.PI * 2;
        const segEnd = Math.min(
          startAngle + ((i + 1) / GAUGE_COLORS.length) * Math.PI * 2,
          endAngle
        );
        if (segStart >= endAngle) break;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, segStart, segEnd);
        ctx.strokeStyle = GAUGE_COLORS[i % GAUGE_COLORS.length];
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'butt';
        ctx.stroke();
      }

      // Round cap at the start
      const capX = cx + Math.cos(startAngle) * radius;
      const capY = cy + Math.sin(startAngle) * radius;
      ctx.beginPath();
      ctx.arc(capX, capY, lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = GAUGE_COLORS[0];
      ctx.fill();

      // Round cap at the end
      const endX = cx + Math.cos(endAngle) * radius;
      const endY = cy + Math.sin(endAngle) * radius;
      const endColorIdx = Math.min(
        Math.floor(fraction * GAUGE_COLORS.length),
        GAUGE_COLORS.length - 1
      );
      ctx.beginPath();
      ctx.arc(endX, endY, lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = GAUGE_COLORS[endColorIdx];
      ctx.fill();
    }

    // Inner circle background (semi-transparent)
    ctx.beginPath();
    ctx.arc(cx, cy, radius - lineWidth * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    // Count number
    const countSize = Math.round(radius * 0.75);
    ctx.font = `bold ${countSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.fillText(String(count), cx, cy);

    // Level indicator below gauge
    if (level > 0) {
      const starSize = Math.round(radius * 0.32);
      ctx.font = `bold ${starSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      // Show colored stars for each level (up to 5, then number)
      const stars = level <= 5 ? '\u2B50'.repeat(level) : `\u2B50\u00D7${level}`;
      ctx.fillStyle = '#FF8800';
      ctx.fillText(stars, cx, cy + radius + lineWidth / 2 + 4);
    }

    ctx.restore();
  }
}
