import React, { useEffect, useRef } from 'react';

export default function NetworkBackground() {
  const canvasRef  = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const ctx = canvas.getContext('2d');
    const ox  = overlay.getContext('2d');
    if (!ctx || !ox) return;

    let frame = 0;
    let animId = 0;
    const pointer = { x: -1000, y: -1000 };

    // 1. Rain drops
    const rain = Array.from({ length: 220 }, () => ({
      x: Math.random(), y: Math.random(),
      len: 8 + Math.random() * 16,
      speed: 0.002 + Math.random() * 0.004,
      drift: -0.0003 - Math.random() * 0.0005,
      alpha: 0.08 + Math.random() * 0.22,
      width: 0.5 + Math.random() * 0.8,
    }));

    // 2. GNN sensor nodes (Blue and Yellow)
    const nodes = Array.from({ length: 45 }, (_, i) => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00028,
      vy: (Math.random() - 0.5) * 0.00028,
      phase: i * 0.68,
      type: Math.random() < 0.35 ? 'yellow' : 'blue', // 35% yellow, 65% blue
    }));

    // 3. Ripples
    const ripples = [];
    const spawnRipple = (px, py) => ripples.push({
      px: px != null ? px : Math.random(),
      py: py != null ? py : 0.58 + Math.random() * 0.42,
      r: 0, maxR: 18 + Math.random() * 32,
      alpha: 0.28, speed: 0.28 + Math.random() * 0.32,
    });
    for (let i = 0; i < 8; i++) spawnRipple(null, null);

    // 4. Matrix glyphs
    const GLYPHS = '0123456789ABCDEF.,:msMPa%Hz><!';
    const COL_W = 18;
    let matrixCols = [];
    const initMatrix = () => {
      const W = window.innerWidth;
      matrixCols = Array.from({ length: Math.ceil(W / COL_W) }, () => ({
        y: Math.random() * -200,
        speed: 0.4 + Math.random() * 0.7,
        len: 6 + Math.floor(Math.random() * 10),
        chars: Array.from({ length: 16 }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]),
        refresh: 0,
      }));
    };

    // 5. Lightning state
    let lightning   = null;
    let lightningTimer = 300 + Math.floor(Math.random() * 420);
    let flashAlpha  = 0;

    const buildArc = (x1, y1, x2, y2, depth) => {
      if (depth === 0) return [{ x: x2, y: y2 }];
      const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 80;
      const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 40;
      return [
        ...buildArc(x1, y1, mx, my, depth - 1),
        { x: mx, y: my },
        ...buildArc(mx, my, x2, y2, depth - 1),
        { x: x2, y: y2 },
      ];
    };

    const triggerLightning = (W, H) => {
      const x = W * (0.1 + Math.random() * 0.8);
      const pts = buildArc(x, 0, x + (Math.random() - 0.5) * 140, H * (0.50 + Math.random() * 0.40), 4);
      const branchFrom = pts[Math.floor(pts.length * 0.4)];
      const branch = branchFrom
        ? buildArc(branchFrom.x, branchFrom.y, branchFrom.x + (Math.random() - 0.5) * 100, branchFrom.y + 80 + Math.random() * 100, 3)
        : [];
      lightning = { pts, branch, alpha: 1.0, duration: 10 };
      flashAlpha = 0.35;
      lightningTimer = 300 + Math.floor(Math.random() * 420);
    };

    const resizeCanvas = (c, context) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width  = window.innerWidth  * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width  = window.innerWidth  + 'px';
      c.style.height = window.innerHeight + 'px';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      resizeCanvas(canvas, ctx);
      resizeCanvas(overlay, ox);
    };

    const onMove = (e) => { pointer.x = e.clientX; pointer.y = e.clientY; };

    const draw = () => {
      const W = window.innerWidth, H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);
      ox.clearRect(0, 0, W, H);

      // Matrix data stream (background canvas)
      ctx.font = '11px "JetBrains Mono", monospace';
      matrixCols.forEach((col, colIdx) => {
        col.y += col.speed;
        col.refresh++;
        if (col.refresh > 8) {
          col.chars[Math.floor(Math.random() * col.chars.length)] =
            GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          col.refresh = 0;
        }
        if (col.y > H + col.len * 14) col.y = -col.len * 14;
        col.chars.slice(0, col.len).forEach((ch, ci) => {
          const cy = col.y + ci * 14;
          if (cy < 0 || cy > H) return;
          const isHead = ci === col.len - 1;
          const fade = ci / col.len;
          const g = Math.floor(120 + 80 * fade);
          const b = Math.floor(100 + 60 * fade);
          const a = isHead ? 0.55 : (0.06 + fade * 0.09);
          ctx.fillStyle = isHead
            ? 'rgba(180,255,255,' + a + ')'
            : 'rgba(0,' + g + ',' + b + ',' + a + ')';
          ctx.fillText(ch, colIdx * COL_W + 2, cy);
        });
      });

      // Diagonal grid
      ctx.strokeStyle = 'rgba(20,60,90,0.10)';
      ctx.lineWidth = 1;
      const drift = (frame * 0.05) % 48;
      for (let x = -48 + drift; x < W + 48; x += 48) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - H * 0.16, H); ctx.stroke();
      }

      // 3-layer flood wave
      for (let layer = 2; layer >= 0; layer--) {
        const amp   = 18 + layer * 10;
        const freq  = 0.009 - layer * 0.002;
        const spd   = frame * (0.010 + layer * 0.004) + layer * 1.3;
        const baseY = H * (0.76 - layer * 0.05);

        const grad = ctx.createLinearGradient(0, baseY - amp * 2, 0, H);
        const gc   = 80 + layer * 20;
        const bc   = 160 + layer * 20;
        const a1   = 0.55 - layer * 0.08;
        grad.addColorStop(0, 'rgba(0,' + gc + ',' + bc + ',' + a1 + ')');
        grad.addColorStop(1, 'rgba(0,15,55,0.70)');

        ctx.beginPath(); ctx.moveTo(0, H);
        for (let px = 0; px <= W; px += 3) {
          const wy = baseY + amp * Math.sin(px * freq + spd)
                           + amp * 0.45 * Math.sin(px * freq * 1.9 - spd * 0.7);
          px === 0 ? ctx.moveTo(px, wy) : ctx.lineTo(px, wy);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();

        // Glowing crest on top layer
        if (layer === 0) {
          ctx.beginPath();
          for (let px = 0; px <= W; px += 3) {
            const wy = baseY + amp * Math.sin(px * freq + spd)
                             + amp * 0.45 * Math.sin(px * freq * 1.9 - spd * 0.7);
            px === 0 ? ctx.moveTo(px, wy) : ctx.lineTo(px, wy);
          }
          ctx.strokeStyle = 'rgba(0,240,255,0.90)';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 20;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Rain
      rain.forEach((r) => {
        r.y += r.speed; r.x += r.drift;
        if (r.y > 1) { r.y = -0.02; r.x = Math.random(); }
        if (r.x < 0) r.x = 1.0;
        const rx = r.x * W, ry = r.y * H;
        if (r.y > 0.72 && Math.random() < 0.015) spawnRipple(r.x, r.y);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + r.drift * W * 8, ry + r.len);
        ctx.strokeStyle = 'rgba(150,225,255,' + r.alpha + ')';
        ctx.lineWidth = r.width; ctx.stroke();
      });

      // Ripples
      if (frame % 18 === 0 && ripples.length < 25) spawnRipple(null, null);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += rp.speed; rp.alpha -= 0.005;
        if (rp.alpha <= 0 || rp.r > rp.maxR) { ripples.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.ellipse(rp.px * W, rp.py * H, rp.r, rp.r * 0.30, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,220,255,' + rp.alpha + ')';
        ctx.lineWidth = 0.8; ctx.stroke();
      }

      // GNN sensor mesh (Blue and Yellow)
      nodes.forEach((node, idx) => {
        node.x += node.vx; node.y += node.vy;
        if (node.x < 0 || node.x > 1) node.vx *= -1;
        if (node.y < 0 || node.y > 1) node.vy *= -1;
        const px = node.x * W, py = node.y * H;
        const cd = Math.hypot(pointer.x - px, pointer.y - py);
        if (cd < 160) {
          node.x += (pointer.x - px) / W * 0.001;
          node.y += (pointer.y - py) / H * 0.001;
        }
        nodes.slice(idx + 1).forEach((other) => {
          const d = Math.hypot(px - other.x * W, py - other.y * H);
          if (d < 150) {
            const prox = cd < 160 ? 1.8 : 1.0;
            // Edges are a glowing blueish cyan
            ctx.strokeStyle = 'rgba(60,180,255,' + (0.15 * (1 - d / 150) * prox) + ')';
            ctx.lineWidth = cd < 160 ? 1.5 : 0.8;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(other.x * W, other.y * H); ctx.stroke();
          }
        });
        const pulse = 1.3 + Math.sin(frame * 0.025 + node.phase) * 0.7;
        const enlarged = cd < 120 ? 1.8 : 1.2; // slightly larger base nodes
        const baseAlpha = cd < 120 ? 0.95 : 0.75;
        
        const isYellow = node.type === 'yellow';
        const color = isYellow
          ? 'rgba(255,215,0,' + baseAlpha + ')'
          : 'rgba(0,170,255,' + baseAlpha + ')';
          
        ctx.shadowColor = isYellow ? '#ffd700' : '#00aaff';
        ctx.shadowBlur = cd < 120 ? 16 : 6; // Always have some glow, more when cursor near
        
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px, py, pulse * enlarged, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Lightning — drawn on OVERLAY canvas (z-50, above all panels)
      lightningTimer--;
      if (lightningTimer <= 0) triggerLightning(W, H);

      if (flashAlpha > 0) {
        ox.fillStyle = 'rgba(210,235,255,' + flashAlpha + ')';
        ox.fillRect(0, 0, W, H);
        flashAlpha = Math.max(0, flashAlpha - 0.012);
      }

      if (lightning) {
        const drawBolt = (pts, alpha, lw) => {
          if (!pts || !pts.length) return;
          // outer glow pass
          ox.beginPath(); ox.moveTo(pts[0].x, pts[0].y);
          pts.forEach(p => ox.lineTo(p.x, p.y));
          ox.strokeStyle = 'rgba(150,220,255,' + (alpha * 0.4) + ')';
          ox.lineWidth = lw * 5;
          ox.shadowColor = '#00cfff';
          ox.shadowBlur = 30;
          ox.stroke();
          // core bright line
          ox.beginPath(); ox.moveTo(pts[0].x, pts[0].y);
          pts.forEach(p => ox.lineTo(p.x, p.y));
          ox.strokeStyle = 'rgba(230,248,255,' + alpha + ')';
          ox.lineWidth = lw;
          ox.shadowColor = '#ffffff';
          ox.shadowBlur = 14;
          ox.stroke();
          ox.shadowBlur = 0;
        };
        drawBolt(lightning.pts,   lightning.alpha,       3.0);
        drawBolt(lightning.branch, lightning.alpha * 0.7, 1.6);
        lightning.alpha -= 0.09;
        lightning.duration--;
        if (lightning.duration <= 0 || lightning.alpha <= 0) lightning = null;
      }

      frame++;
      animId = requestAnimationFrame(draw);
    };

    resize(); initMatrix(); draw();

    const onResize = () => { resize(); initMatrix(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMove);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <>
      {/* Background layer: grid, waves, rain, nodes */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 w-full h-full"
        style={{ zIndex: 0, opacity: 0.85 }}
      />
      {/* Lightning layer: sits behind UI panels (z-10) but above base background */}
      <canvas
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 w-full h-full"
        style={{ zIndex: 1, opacity: 1 }}
      />
    </>
  );
}
