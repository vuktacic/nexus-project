"use client";

import { useEffect, useRef } from "react";

const WORLD_SCALE = 0.1;
const FX_MAX_TIME = 0.25;
const FONT_DISPLAY = "'Baloo 2', 'Arial Rounded MT Bold', system-ui, sans-serif";

const TEAM_THEME = {
  shark: { primary: "#1fb6ff", dark: "#0a5c8a", glow: "#bdf3ff", label: "SHARKS", emoji: "🦈" },
  cat:   { primary: "#ff7a59", dark: "#9c3b1f", glow: "#ffe1cf", label: "CATS",   emoji: "🐱" },
};
const GOLD = { fill: "#ffd54a", stroke: "#3a2a00" };

export default function Host() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const playersRef   = useRef<any[]>([]);
  const fxRef        = useRef<any[]>([]);
  const teamRef      = useRef({ shark: 0, cat: 0 });
  const timeLeftRef  = useRef<number>(180);
  const gameOverRef  = useRef<{ winner: string; sharkGold: number; catGold: number } | null>(null);

  // ── Network ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let channel: any = null;
    let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://165.22.144.193";
    if (!backendUrl.startsWith("http://") && !backendUrl.startsWith("https://"))
      backendUrl = `http://${backendUrl}`;
    const isHttps = backendUrl.startsWith("https://");

    import("@geckos.io/client").then((module) => {
      const geckos = module.default;
      channel = geckos({ url: backendUrl, port: (isHttps ? null : 3001) as number });

      channel.onConnect((error: any) => {
        if (error) { console.error("[HOST] connect error:", error); return; }

        channel.on("state", (state: any) => {
          playersRef.current = (state.players || []).map((p: any) => ({ ...p, gold: p.gold ?? 0 }));
          teamRef.current.shark = state.teams?.shark?.gold ?? 0;
          teamRef.current.cat   = state.teams?.cat?.gold   ?? 0;
          if (state.timeLeft !== undefined) timeLeftRef.current = state.timeLeft;
        });

        channel.on("attack_fx", (fx: any) => fxRef.current.push({ ...fx, t: 0 }));

        channel.on("timer", (data: any) => {
          timeLeftRef.current = data.timeLeft ?? timeLeftRef.current;
        });

        channel.on("game_over", (data: any) => {
          gameOverRef.current = {
            winner:    data.winner,
            sharkGold: data.sharkGold ?? 0,
            catGold:   data.catGold   ?? 0,
          };
        });
      });
    }).catch(console.error);

    return () => { if (channel) channel.close(); };
  }, []);

  // ── Google font ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // ── Render loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;

    // assets
    const load = (src: string) => { const i = new Image(); i.src = src; return i; };
    const catImg      = load("/assets/sprites/cat-removebg-preview.png");
    const sharkImg    = load("/assets/sprites/shark-removebg-preview.png");
    const mvpCatImg   = load("/assets/sprites/mvp_cat.png");
    const mvpSharkImg = load("/assets/sprites/mvp_shark.png");
    const shieldImg   = load("/assets/objects/box-removebg-preview.png");
    const fireIMG     = load("/assets/objects/fire-removebg-preview.png");
    const fireballImg = load("/assets/objects/fireball-removebg-preview.png");
    const coinImg     = load("/assets/ui/coin-removebg-preview.png");
    const bgImg       = load("/assets/map/combined_sides.png");

    // confetti
    const confettiRef = { current: [] as any[] };
    const winAnimRef  = { current: null as number | null };

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // ── Helpers ────────────────────────────────────────────────────────────────

    function hashStr(s: string) {
      let h = 0;
      for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
      return h;
    }

    function easeOutBack(t: number) {
      const c1 = 1.70158, c3 = c1 + 1, x = Math.min(Math.max(t, 0), 1);
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      const rad = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    }

    function comicText(
      text: string, x: number, y: number, size: number,
      fill: string, stroke: string,
      align: CanvasTextAlign = "center",
      sw = Math.max(3, size * 0.16)
    ) {
      ctx.save();
      ctx.font = `800 ${size}px ${FONT_DISPLAY}`;
      ctx.textAlign = align;
      ctx.textBaseline = "alphabetic";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = sw;
      ctx.strokeStyle = stroke;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    function drawStar(cx: number, cy: number, outerR: number, innerR: number,
      pts: number, rot: number, color: string, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = rot + (Math.PI / pts) * i;
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function goldLabel(x: number, y: number, amount: number, size: number, align: "left" | "right" | "center") {
      const text = `${amount}`;
      ctx.font = `800 ${size}px ${FONT_DISPLAY}`;
      const tw = ctx.measureText(text).width;
      const iconSize = size * 1.2, gap = size * 0.22;
      const blockW = iconSize + gap + tw;
      const bx = align === "left" ? x : align === "right" ? x - blockW : x - blockW / 2;
      ctx.drawImage(coinImg, bx, y - iconSize * 0.82, iconSize, iconSize);
      comicText(text, bx + iconSize + gap, y, size, GOLD.fill, "#3a2a00", "left", Math.max(2.5, size * 0.16));
    }

    // ── FX ────────────────────────────────────────────────────────────────────

    function updateFX(dt: number) {
      for (const fx of fxRef.current) fx.t += dt;
      fxRef.current = fxRef.current.filter((fx) => fx.t < FX_MAX_TIME);
    }

    function drawAttackFX() {
      const FL = 4000 * WORLD_SCALE, FW = 1200 * WORLD_SCALE;
      for (const fx of fxRef.current) {
        const alpha = 1 - fx.t / FX_MAX_TIME;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = "#ff8a00";
        ctx.shadowBlur  = 18;
        ctx.translate(fx.x * WORLD_SCALE, fx.y * WORLD_SCALE);
        ctx.rotate(fx.angle);
        ctx.scale(-1, 1);
        ctx.drawImage(fireballImg, -45 - FL, -FW / 2, FL, FW);
        ctx.restore();
      }
    }

    // ── Players ───────────────────────────────────────────────────────────────

    function getLeaders() {
      let catLeader: any = null, sharkLeader: any = null;
      for (const p of playersRef.current) {
        if (!p.alive) continue;
        if (p.shark) { if (!sharkLeader || p.gold > sharkLeader.gold) sharkLeader = p; }
        else          { if (!catLeader   || p.gold > catLeader.gold)   catLeader   = p; }
      }
      return { catLeader, sharkLeader };
    }

    function drawPlayers(now: number) {
      const SS = 90;
      const { catLeader, sharkLeader } = getLeaders();

      for (const p of playersRef.current) {
        let img = p.shark ? sharkImg : catImg;
        const px = p.x * WORLD_SCALE;
        const baseY = p.y * WORLD_SCALE;

        if (!p.alive) {
          ctx.drawImage(fireIMG, px - SS / 2, baseY - SS / 2, SS, SS);
          comicText("KO'd", px, baseY + SS / 2 + 18, 14, "#ffd9d9", "#6b0000");
          continue;
        }

        const phase = hashStr(p.id || p.name || "p") % 1000;
        const bob = Math.sin(now / 260 + phase) * 4;
        const py = baseY + bob;

        // shadow
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(px, baseY + SS / 2 + 6, SS * 0.32, SS * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const isLeader = p.gold > 0 && (p.shark ? p === sharkLeader : p === catLeader);
        if (isLeader) img = p.shark ? mvpSharkImg : mvpCatImg;

        ctx.drawImage(img, px - SS / 2, py - SS / 2, SS, SS);
        if (isLeader) drawStar(px, py - SS / 2 - 14, 10, 4, 5, now / 500, GOLD.fill, 0.95);

        if (p.shield) ctx.drawImage(shieldImg, px - SS * 0.75, py - SS * 0.75, SS * 1.5, SS * 1.5);

        const dx = p.dx ?? 0, dy = p.dy ?? 0;
        if (dx !== 0 || dy !== 0) {
          const angle = Math.atan2(dy, dx);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle);
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#7a0000";
          ctx.fillStyle = "#ff5252";
          ctx.beginPath();
          ctx.moveTo(SS / 2 + 12, 0);
          ctx.lineTo(SS / 2 - 3, -8);
          ctx.lineTo(SS / 2 - 3, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // name pill
        ctx.save();
        ctx.font = `700 14px ${FONT_DISPLAY}`;
        const label = p.name || "Anonymous";
        const tw = ctx.measureText(label).width;
        const tagW = tw + 20, tagH = 22;
        const tagX = px - tagW / 2, tagY = py - SS / 2 - tagH - 10;
        roundRect(tagX, tagY, tagW, tagH, tagH / 2);
        ctx.fillStyle = "rgba(20,20,30,0.55)";
        ctx.fill();
        ctx.restore();
        comicText(label, px, tagY + tagH * 0.72, 14, "#ffffff", "#000000", "center", 2.5);

        if (p.gold > 0) goldLabel(px, py + SS / 2 + 24, p.gold, 20, "center");
      }
    }

    // ── HUD ───────────────────────────────────────────────────────────────────

    function drawHUD() {
      const pad = 18, bH = 56, bW = 230;

      function badge(theme: typeof TEAM_THEME.shark, mascot: HTMLImageElement, gold: number, align: "left"|"right") {
        const x = align === "left" ? pad : canvas.width - pad - bW, y = pad;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        roundRect(x, y, bW, bH, bH / 2);
        ctx.fillStyle = theme.dark;
        ctx.fill();
        ctx.restore();

        roundRect(x + 3, y + 3, bW - 6, bH - 6, (bH - 6) / 2);
        const grd = ctx.createLinearGradient(x, y, x, y + bH);
        grd.addColorStop(0, theme.primary);
        grd.addColorStop(1, theme.dark);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.stroke();

        const icx = align === "left" ? x + bH / 2 : x + bW - bH / 2;
        const icy = y + bH / 2, icR = bH / 2 - 4;
        ctx.save();
        ctx.beginPath();
        ctx.arc(icx, icy, icR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
        ctx.restore();
        ctx.drawImage(mascot, icx - icR * 0.9, icy - icR * 0.9, icR * 1.8, icR * 1.8);

        const tx = align === "left" ? x + bH : x + bW - bH;
        ctx.save();
        ctx.textAlign = align;
        ctx.textBaseline = "middle";
        ctx.font = `700 12px ${FONT_DISPLAY}`;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText(theme.label, tx, y + bH * 0.32);
        ctx.restore();
        goldLabel(tx, y + bH * 0.78, gold, 20, align);
      }

      badge(TEAM_THEME.shark, sharkImg, teamRef.current.shark, "left");
      badge(TEAM_THEME.cat,   catImg,   teamRef.current.cat,   "right");
    }

    // ── Timer ─────────────────────────────────────────────────────────────────

    function drawTimer(now: number) {
      const t = Math.max(0, Math.ceil(timeLeftRef.current));
      const mins = Math.floor(t / 60);
      const secs = t % 60;
      const label = `${mins}:${secs.toString().padStart(2, "0")}`;
      const isUrgent = t <= 30;

      const cx = canvas.width / 2;
      const cy = 50;
      const w  = 140, h = 48, r = 24;

      // pill bg
      ctx.save();
      ctx.shadowColor = isUrgent ? "#ff2222" : "rgba(0,0,0,0.4)";
      ctx.shadowBlur = isUrgent ? 18 : 10;
      roundRect(cx - w / 2, cy - h / 2, w, h, r);
      ctx.fillStyle = isUrgent ? "#3a0000" : "rgba(15,15,30,0.72)";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = isUrgent
        ? `rgba(255,60,60,${0.6 + 0.4 * Math.sin(now / 200)})`
        : "rgba(255,255,255,0.25)";
      ctx.stroke();
      ctx.restore();

      // clock icon
      ctx.save();
      ctx.strokeStyle = isUrgent ? "#ff6060" : "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 44, cy, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 44, cy - 6);
      ctx.lineTo(cx - 44, cy);
      ctx.lineTo(cx - 40, cy);
      ctx.stroke();
      ctx.restore();

      comicText(
        label, cx + 8, cy + 8, 26,
        isUrgent ? "#ff6060" : "#ffffff",
        isUrgent ? "#5a0000" : "#000000",
        "center", 4
      );
    }

    // ── Vignette ─────────────────────────────────────────────────────────────

    function drawVignette() {
      const grd = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75
      );
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.save();
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // ── Confetti ─────────────────────────────────────────────────────────────

    function seedConfetti() {
      const colors = ["#ffd54a", "#ff7a59", "#1fb6ff", "#ffffff", "#7CFC95", "#ff69b4"];
      confettiRef.current = Array.from({ length: 160 }, () => ({
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 60,
        vy: 80 + Math.random() * 120,
        size: 6 + Math.random() * 7,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
    }

    function updateConfetti(dt: number) {
      for (const c of confettiRef.current) {
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.vy += 40 * dt;  c.rot += c.rotSpeed * dt;
        if (c.y > canvas.height + 20) {
          c.y = -20; c.x = Math.random() * canvas.width; c.vy = 80 + Math.random() * 120;
        }
      }
    }

    function drawConfetti() {
      for (const c of confettiRef.current) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
        ctx.restore();
      }
    }

    // ── Win screen ────────────────────────────────────────────────────────────

    function drawWinScreen(now: number) {
      const go = gameOverRef.current!;
      const isTie = go.winner === "tie";
      const theme = isTie ? null : TEAM_THEME[go.winner as "shark" | "cat"];
      const mvpImg = go.winner === "shark" ? mvpSharkImg : go.winner === "cat" ? mvpCatImg : null;

      if (winAnimRef.current === null) {
        winAnimRef.current = now;
        seedConfetti();
      }

      const elapsed = (now - winAnimRef.current) / 1000;
      const popT = easeOutBack(Math.min(elapsed / 0.7, 1));
      const bob = Math.sin(now / 280) * 7;

      // dark overlay
      ctx.save();
      ctx.fillStyle = "rgba(8, 6, 18, 0.68)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      updateConfetti(1 / 60);
      drawConfetti();

      const cx = canvas.width / 2, cy = canvas.height / 2;

      // glow circle
      if (theme) {
        const glowR = Math.min(canvas.width, canvas.height) * 0.3;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        glow.addColorStop(0, theme.glow + "cc");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // orbiting stars
        for (let i = 0; i < 6; i++) {
          const a = now / 1200 + (i * Math.PI) / 3;
          const r = glowR * 0.78;
          drawStar(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 12, 5, 5, a, "#ffffff", 0.85);
        }
      }

      // mascot
      if (mvpImg) {
        const ss = Math.min(canvas.width, canvas.height) * 0.3 * popT;
        ctx.save();
        ctx.translate(cx, cy - 30 + bob);
        ctx.drawImage(mvpImg, -ss / 2, -ss / 2, ss, ss);
        ctx.restore();
      } else {
        // tie — draw both
        const ss = Math.min(canvas.width, canvas.height) * 0.22 * popT;
        ctx.save();
        ctx.translate(cx - ss * 0.6, cy - 30 + bob);
        ctx.drawImage(sharkImg, -ss / 2, -ss / 2, ss, ss);
        ctx.restore();
        ctx.save();
        ctx.translate(cx + ss * 0.6, cy - 30 - bob);
        ctx.drawImage(catImg, -ss / 2, -ss / 2, ss, ss);
        ctx.restore();
      }

      // Title
      const glowR2 = Math.min(canvas.width, canvas.height) * 0.3;
      const titleY = cy - glowR2 - 20;
      const title = isTie
        ? "🤝 IT'S A TIE! 🤝"
        : `${theme!.emoji} ${theme!.label} WIN! ${theme!.emoji}`;
      const titleColor = isTie ? "#ffd54a" : "#ffffff";
      const titleStroke = isTie ? "#5a3d00" : (theme?.dark ?? "#000");
      comicText(title, cx, titleY, 54, titleColor, titleStroke, "center", 10);

      // Score card
      const cardW = 320, cardH = 120, cardX = cx - cardW / 2, cardY = cy + glowR2 - 10;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 20;
      roundRect(cardX, cardY, cardW, cardH, 18);
      ctx.fillStyle = "rgba(15,12,30,0.88)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.stroke();
      ctx.restore();

      // shark score
      comicText("🦈", cardX + 40,        cardY + 44, 22, "#fff", "transparent", "center", 0);
      comicText(`${go.sharkGold}`,         cardX + 40,        cardY + 76, 28,
        go.winner === "shark" ? GOLD.fill : "#aaa", go.winner === "shark" ? "#3a2a00" : "#333", "center", 4);
      comicText("SHARKS",                  cardX + 40,        cardY + 102, 13, "#aaa", "#000", "center", 2);

      // divider
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cardY + 16);
      ctx.lineTo(cx, cardY + cardH - 16);
      ctx.stroke();
      ctx.restore();
      comicText("VS", cx, cardY + 68, 18, "rgba(255,255,255,0.35)", "transparent", "center", 0);

      // cat score
      comicText("🐱", cardX + cardW - 40, cardY + 44, 22, "#fff", "transparent", "center", 0);
      comicText(`${go.catGold}`,           cardX + cardW - 40, cardY + 76, 28,
        go.winner === "cat" ? GOLD.fill : "#aaa", go.winner === "cat" ? "#3a2a00" : "#333", "center", 4);
      comicText("CATS",                    cardX + cardW - 40, cardY + 102, 13, "#aaa", "#000", "center", 2);

      // sub-message
      comicText(
        isTie ? "dead even — gg both squads!" : "the other team got cleaned out 💀",
        cx, cardY + cardH + 46, 22, GOLD.fill, "#3a2a00", "center", 4
      );
    }

    // ── Main loop ─────────────────────────────────────────────────────────────

    let last = performance.now();

    function loop(now: number) {
      const dt = (now - last) / 1000;
      last = now;

      updateFX(dt);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bgImg.complete) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      drawVignette();
      drawAttackFX();
      drawPlayers(now);
      drawHUD();
      drawTimer(now);

      if (gameOverRef.current) drawWinScreen(now);

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0818" }}>
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
    </div>
  );
}
