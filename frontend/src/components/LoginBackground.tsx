import React, { useEffect, useRef } from 'react';

export default function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const RAIN_COUNT = 150;
    const RIPPLE_COUNT = 30;
    const WIND_ANGLE = 15; // degrees

    // --- 5. Distant City Silhouette ---
    const buildings: { x: number; width: number; height: number; windows: any[] }[] = [];
    let bX = 0;
    while (bX < 3000) { // Enough to cover wide screens
      const bWidth = Math.random() * 40 + 20;
      const bHeight = Math.random() * 150 + 40;
      const windows = [];
      for(let w = 0; w < 6; w++) {
         if (Math.random() > 0.5) {
            windows.push({
               x: Math.random() * (bWidth - 8) + 4,
               y: Math.random() * (bHeight - 15) + 5,
               state: Math.random() > 0.8,
               timer: Math.random() * 100
            });
         }
      }
      buildings.push({ x: bX, width: bWidth, height: bHeight, windows });
      bX += bWidth + Math.random() * 15;
    }

    // --- 2. Volumetric Fog Layer ---
    const fogs = Array.from({ length: 6 }, () => ({
      x: Math.random() * width,
      y: height - 250 - Math.random() * 100,
      radius: Math.random() * 250 + 200,
      vx: (Math.random() - 0.5) * 0.4,
    }));

    // --- 1. Lightning Bolts ---
    let lightningFlash = 0;
    let lightningPaths: {x: number, y: number}[][] = [];
    const triggerLightning = () => {
      lightningFlash = 0.85; // Bright flash
      lightningPaths = [];
      const startX = Math.random() * width;
      let currX = startX;
      let currY = 0;
      const path = [{x: currX, y: currY}];
      while(currY < height - 100) {
         currX += (Math.random() - 0.5) * 120;
         currY += Math.random() * 60 + 20;
         path.push({x: currX, y: currY});
      }
      lightningPaths.push(path);
      
      // Add a branch
      if (Math.random() > 0.4) {
         const branch = [];
         const splitIndex = Math.floor(path.length / 3) + Math.floor(Math.random() * (path.length / 3));
         let bX = path[splitIndex].x;
         let bY = path[splitIndex].y;
         branch.push({x: bX, y: bY});
         while(bY < height - 150) {
            bX += (Math.random() - 0.5) * 90;
            bY += Math.random() * 50 + 20;
            branch.push({x: bX, y: bY});
         }
         lightningPaths.push(branch);
      }
    };

    // --- 3. Rain Splash Particles ---
    const splashes: {x: number; y: number; vx: number; vy: number; life: number}[] = [];
    const createSplash = (x: number, y: number) => {
      const count = Math.floor(Math.random() * 3) + 2;
      for(let i = 0; i < count; i++) {
        splashes.push({
          x, y,
          vx: (Math.random() - 0.5) * 3 + Math.sin(WIND_ANGLE * Math.PI / 180) * 1.5,
          vy: -Math.random() * 2.5 - 1.5,
          life: 1
        });
      }
    };

    class Raindrop {
      x: number;
      y: number;
      length: number;
      speed: number;
      constructor() {
        this.x = Math.random() * width * 1.5 - width * 0.25;
        this.y = Math.random() * height * 1.5 - height * 0.5;
        this.length = Math.random() * 20 + 10;
        this.speed = Math.random() * 15 + 15;
      }
      update() {
        this.x += Math.sin((WIND_ANGLE * Math.PI) / 180) * this.speed;
        this.y += Math.cos((WIND_ANGLE * Math.PI) / 180) * this.speed;
        
        // Reset when it hits the water line (baseHeight)
        if (this.y > height - 80 + Math.random() * 40) {
          createRipple(this.x, this.y);
          createSplash(this.x, this.y); // Spawn splash droplets
          this.y = -50;
          this.x = Math.random() * width * 1.5 - width * 0.25;
          this.speed = Math.random() * 15 + 15;
        }
      }
      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(
          this.x - Math.sin((WIND_ANGLE * Math.PI) / 180) * this.length,
          this.y - Math.cos((WIND_ANGLE * Math.PI) / 180) * this.length
        );
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    class Ripple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      life: number;
      maxLife: number;
      active: boolean;
      constructor() {
        this.x = 0; this.y = 0; this.radius = 0; this.maxRadius = 0;
        this.life = 0; this.maxLife = 0; this.active = false;
      }
      spawn(x: number, y: number) {
        this.x = x; this.y = y;
        this.radius = 2; this.maxRadius = Math.random() * 25 + 15;
        this.life = 1; this.maxLife = Math.random() * 30 + 30;
        this.active = true;
      }
      update() {
        if (!this.active) return;
        this.radius += 0.5; this.life -= 1;
        if (this.life <= 0) this.active = false;
      }
      draw(ctx: CanvasRenderingContext2D) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.radius * 2, this.radius * 0.5, 0, 0, Math.PI * 2);
        const opacity = (this.life / this.maxLife) * 0.4;
        ctx.strokeStyle = `rgba(34, 211, 238, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    const drops = Array.from({ length: RAIN_COUNT }, () => new Raindrop());
    const ripples = Array.from({ length: RIPPLE_COUNT }, () => new Ripple());

    function createRipple(x: number, y: number) {
      const inactiveRipple = ripples.find(r => !r.active);
      if (inactiveRipple) inactiveRipple.spawn(x, y);
    }

    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      const baseHeight = height - 80;

      // 1. Lightning Bolt Flashes (Background layer)
      if (lightningFlash > 0) {
         ctx.fillStyle = `rgba(224, 242, 254, ${lightningFlash * 0.4})`; // Screen flash
         ctx.fillRect(0, 0, width, height);
         lightningFlash -= 0.025;
      }
      // Random trigger
      if (Math.random() < 0.0015) triggerLightning();

      // 5. Distant City Silhouette
      ctx.fillStyle = '#020617';
      buildings.forEach(b => {
         if (b.x > width) return;
         ctx.fillRect(b.x, baseHeight - b.height + 20, b.width, b.height);
         // Flicker windows
         b.windows.forEach(w => {
            w.timer -= 1;
            if (w.timer <= 0) {
               w.state = Math.random() > 0.4;
               w.timer = Math.random() * 100 + 50;
            }
            if (w.state) {
               ctx.fillStyle = `rgba(253, 230, 138, ${Math.random() * 0.4 + 0.2})`;
               ctx.fillRect(b.x + w.x, baseHeight - b.height + 20 + w.y, 2, 3);
            }
         });
         ctx.fillStyle = '#020617'; // Reset for next building
      });

      // 1. Lightning Bolts (Drawn behind fog and rain)
      if (lightningFlash > 0 && lightningPaths.length > 0) {
         ctx.strokeStyle = `rgba(255, 255, 255, ${lightningFlash * 1.5})`;
         ctx.lineWidth = 2;
         ctx.shadowColor = '#fff';
         ctx.shadowBlur = 15;
         lightningPaths.forEach(path => {
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for(let i=1; i<path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();
         });
         ctx.shadowBlur = 0;
      }

      // 2. Volumetric Fog / Mist Layer
      fogs.forEach(fog => {
         fog.x += fog.vx;
         if (fog.x > width + fog.radius) fog.x = -fog.radius;
         if (fog.x < -fog.radius) fog.x = width + fog.radius;
         const grad = ctx.createRadialGradient(fog.x, fog.y, 0, fog.x, fog.y, fog.radius);
         grad.addColorStop(0, 'rgba(34, 211, 238, 0.04)');
         grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
         ctx.fillStyle = grad;
         ctx.fillRect(fog.x - fog.radius, fog.y - fog.radius, fog.radius * 2, fog.radius * 2);
      });

      // 6. Water Reflection (Mirror the city silhouette faintly below baseHeight)
      ctx.save();
      ctx.globalAlpha = 0.15;
      // We flip the canvas vertically around the baseHeight
      ctx.translate(0, baseHeight + 20);
      ctx.scale(1, -1);
      ctx.fillStyle = '#020617';
      buildings.forEach(b => {
         if (b.x > width) return;
         ctx.fillRect(b.x, 0, b.width, b.height);
      });
      ctx.restore();

      // Original Rain & Ripples
      drops.forEach(drop => { drop.update(); drop.draw(ctx); });
      ripples.forEach(ripple => { ripple.update(); ripple.draw(ctx); });

      // 3. Rain Splash Particles
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.25; // gravity pulling it back down
        s.life -= 0.035; // fade out
        if (s.life <= 0) {
          splashes.splice(i, 1);
        } else {
          ctx.fillStyle = `rgba(165, 243, 252, ${s.life})`;
          ctx.fillRect(s.x, s.y, 1.5, 1.5);
        }
      }

      // Sine Wave Flood Water (3 Layers)
      time += 0.02;
      const waveHeight = 25;

      // Layer 1 (Back)
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 10) {
        ctx.lineTo(x, baseHeight + Math.sin(x * 0.003 + time * 1.5) * waveHeight);
      }
      ctx.lineTo(width, height);
      ctx.fillStyle = 'rgba(8, 145, 178, 0.2)';
      ctx.fill();

      // Layer 2 (Middle)
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 10) {
        ctx.lineTo(x, baseHeight + 20 + Math.sin(x * 0.005 + time * 2) * (waveHeight * 0.8));
      }
      ctx.lineTo(width, height);
      ctx.fillStyle = 'rgba(2, 132, 199, 0.3)';
      ctx.fill();

      // Layer 3 (Front with glowing crest)
      ctx.beginPath();
      ctx.moveTo(0, height);
      const frontWavePts = [];
      for (let x = 0; x <= width; x += 10) {
        const y = baseHeight + 40 + Math.sin(x * 0.004 + time * 2.5) * (waveHeight * 0.6);
        ctx.lineTo(x, y);
        frontWavePts.push({x, y}); // Save points for foam
      }
      ctx.lineTo(width, height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Dark water hiding below
      ctx.fill();

      // Glowing Crest Line
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // 4. Dynamic Wave Foam
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      frontWavePts.forEach((pt, i) => {
         // Identify crests (where y is visually highest -> numerically lowest)
         if (i > 0 && i < frontWavePts.length - 1) {
            const prev = frontWavePts[i-1].y;
            const next = frontWavePts[i+1].y;
            if (pt.y < prev && pt.y < next) {
               // Render dense foam clustered near the crest
               for(let f = 0; f < 3; f++) {
                  if(Math.random() > 0.4) {
                     ctx.globalAlpha = Math.random() * 0.5 + 0.1;
                     ctx.fillRect(pt.x + (Math.random()-0.5)*18, pt.y + Math.random()*8, 1.5, 1.5);
                  }
               }
            }
         }
         // Random sparse foam along the entire wave body
         if (Math.random() > 0.85) {
            ctx.globalAlpha = Math.random() * 0.3;
            ctx.fillRect(pt.x + (Math.random()-0.5)*10, pt.y + Math.random()*6, 1, 1);
         }
      });
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="pointer-events-none"
      style={{ opacity: 0.8, position: 'absolute', top: 0, left: 0, zIndex: 0 }}
    />
  );
}
