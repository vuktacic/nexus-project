"use client";

import { useEffect, useRef } from "react";
import { SHIELD_DURATION } from "../controller/page";

const WORLD_SCALE = 0.1;
const ATTACK_RANGE_WORLD = 4000;
const FX_MAX_TIME = 0.25;

// Rounder, friendlier display font for all HUD + canvas text
const FONT_DISPLAY = "'Baloo 2', 'Comic Sans MS', 'Arial Rounded MT Bold', system-ui, sans-serif";

const TEAM_THEME = {
    shark: { primary: "#1fb6ff", dark: "#0a5c8a", glow: "#bdf3ff", label: "SHARKS", emoji: "🦈" },
    cat: { primary: "#ff7a59", dark: "#9c3b1f", glow: "#ffe1cf", label: "CATS", emoji: "🐱" },
};

const GOLD = { fill: "#ffd54a", stroke: "#9a6b00" };

export default function Host() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playersRef = useRef<any[]>([]);
    const fxRef = useRef<any[]>([]);
    const teamRef = useRef({ shark: 0, cat: 0 });
    const winnerRef = useRef<string | null>(null);
    const winnerStartRef = useRef<number | null>(null);
    const confettiRef = useRef<any[]>([]);

    useEffect(() => {
        let channel: any = null;

        let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://165.22.144.193";
        if (backendUrl && !backendUrl.startsWith("http://") && !backendUrl.startsWith("https://")) {
            backendUrl = `http://${backendUrl}`;
        }
        const isHttps = backendUrl.startsWith("https://");
        console.log(`[HOST LOG] Connecting to ${backendUrl}`);

        import("@geckos.io/client")
            .then((module) => {
                const geckos = module.default;
                channel = geckos({ url: backendUrl, port: (isHttps ? null : 3001) as number });

                channel.onConnect((error: any) => {
                    if (error) {
                        console.error("[HOST LOG] Connection error:", error);
                        return;
                    }
                    console.log(`[HOST LOG] Connected! ID: ${channel.id}`);

                    channel.on("state", (state: any) => {
                        playersRef.current = (state.players || []).map((p: any) => ({
                            ...p,
                            gold: p.gold ?? 0,
                        }));

                        teamRef.current.shark = state.teams?.shark?.gold || 0;
                        teamRef.current.cat = state.teams?.cat?.gold || 0;
                        winnerRef.current = state.winner || null;
                    });

                    channel.on("attack_fx", (fx: any) => {
                        fxRef.current.push({ ...fx, t: 0 });
                    });
                });
            })
            .catch((err) => {
                console.error("[HOST LOG] Failed to load geckos client:", err);
            });

        return () => {
            if (channel) channel.close();
        };
    }, []);

    // Pull in a rounder, cartoony display font for the HUD + canvas text
    useEffect(() => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&display=swap";
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;

        const catImg = new Image();
        catImg.src = "/assets/sprites/cat-removebg-preview.png";
        const sharkImg = new Image();
        sharkImg.src = "/assets/sprites/shark-removebg-preview.png";
        const mvpCatImg = new Image();
        mvpCatImg.src = "/assets/sprites/mvp_cat.png";
        const mvpSharkImg = new Image();
        mvpSharkImg.src = "/assets/sprites/mvp_shark.png";
        const shieldImg = new Image();
        shieldImg.src = "/assets/objects/box-removebg-preview.png";
        const fireIMG = new Image();
        fireIMG.src = "/assets/objects/fire-removebg-preview.png";

        const fireballImg = new Image();
        fireballImg.src = "/assets/objects/fireball-removebg-preview.png";

        const coinImg = new Image();
        coinImg.src = "/assets/ui/coin-removebg-preview.png";

        const bgImg = new Image();
        bgImg.src = "/assets/map/combined_sides.png";

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resize();
        window.addEventListener("resize", resize);

        let last = performance.now();

        // ---------- small drawing helpers ----------

        function hashString(s: string) {
            let h = 0;
            for (let i = 0; i < s.length; i++) {
                h = (h << 5) - h + s.charCodeAt(i);
                h |= 0;
            }
            return h;
        }

        function easeOutBack(t: number) {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            const x = Math.min(Math.max(t, 0), 1);
            return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
        }

        function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
            const rad = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + rad, y);
            ctx.arcTo(x + w, y, x + w, y + h, rad);
            ctx.arcTo(x + w, y + h, x, y + h, rad);
            ctx.arcTo(x, y + h, x, y, rad);
            ctx.arcTo(x, y, x + w, y, rad);
            ctx.closePath();
        }

        function drawComicText(
            text: string,
            x: number,
            y: number,
            size: number,
            fill: string,
            stroke: string,
            align: CanvasTextAlign = "center",
            strokeWidth = Math.max(3, size * 0.16)
        ) {
            ctx.save();
            ctx.font = `800 ${size}px ${FONT_DISPLAY}`;
            ctx.textAlign = align;
            ctx.textBaseline = "alphabetic";
            ctx.lineJoin = "round";
            ctx.miterLimit = 2;
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = stroke;
            ctx.strokeText(text, x, y);
            ctx.fillStyle = fill;
            ctx.fillText(text, x, y);
            ctx.restore();
        }

        function drawStar(
            cx: number,
            cy: number,
            outerR: number,
            innerR: number,
            points: number,
            rotation: number,
            color: string,
            alpha: number
        ) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < points * 2; i++) {
                const r = i % 2 === 0 ? outerR : innerR;
                const a = rotation + (Math.PI / points) * i;
                const px = cx + Math.cos(a) * r;
                const py = cy + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        function drawGoldAmount(x: number, y: number, amount: number, size: number, align: "left" | "right" | "center") {
            const text = `${amount}`;
            ctx.font = `800 ${size}px ${FONT_DISPLAY}`;
            const textW = ctx.measureText(text).width;
            const iconSize = size * 1.2;
            const gap = size * 0.22;
            const blockW = iconSize + gap + textW;

            let blockLeft: number;
            if (align === "left") blockLeft = x;
            else if (align === "right") blockLeft = x - blockW;
            else blockLeft = x - blockW / 2;

            ctx.drawImage(coinImg, blockLeft, y - iconSize * 0.82, iconSize, iconSize);
            drawComicText(text, blockLeft + iconSize + gap, y, size, GOLD.fill, "#3a2a00", "left", Math.max(2.5, size * 0.16));
        }

        // ---------- gameplay fx ----------

        function updateFX(dt: number) {
            for (const fx of fxRef.current) {
                fx.t += dt;
            }
            fxRef.current = fxRef.current.filter((fx) => fx.t < FX_MAX_TIME);
        }

        function getTeamGoldLeaders() {
            let catLeader: any = null;
            let sharkLeader: any = null;

            for (const p of playersRef.current) {
                if (!p.alive) continue;
                if (p.shark) {
                    if (!sharkLeader || p.gold > sharkLeader.gold) sharkLeader = p;
                } else {
                    if (!catLeader || p.gold > catLeader.gold) catLeader = p;
                }
            }

            return { catLeader, sharkLeader };
        }

        function drawVignette() {
            const grd = ctx.createRadialGradient(
                canvas.width / 2,
                canvas.height / 2,
                Math.min(canvas.width, canvas.height) * 0.35,
                canvas.width / 2,
                canvas.height / 2,
                Math.max(canvas.width, canvas.height) * 0.75
            );
            grd.addColorStop(0, "rgba(0,0,0,0)");
            grd.addColorStop(1, "rgba(0,0,0,0.35)");
            ctx.save();
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        function drawHUD() {
            const padding = 18;
            const badgeH = 56;
            const badgeW = 230;

            function badge(theme: typeof TEAM_THEME.shark, mascotImg: HTMLImageElement, gold: number, align: "left" | "right") {
                const x = align === "left" ? padding : canvas.width - padding - badgeW;
                const y = padding;

                ctx.save();
                ctx.shadowColor = "rgba(0,0,0,0.35)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetY = 4;
                roundedRectPath(x, y, badgeW, badgeH, badgeH / 2);
                ctx.fillStyle = theme.dark;
                ctx.fill();
                ctx.restore();

                roundedRectPath(x + 3, y + 3, badgeW - 6, badgeH - 6, (badgeH - 6) / 2);
                const grd = ctx.createLinearGradient(x, y, x, y + badgeH);
                grd.addColorStop(0, theme.primary);
                grd.addColorStop(1, theme.dark);
                ctx.fillStyle = grd;
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(255,255,255,0.6)";
                ctx.stroke();

                const iconCX = align === "left" ? x + badgeH / 2 : x + badgeW - badgeH / 2;
                const iconCY = y + badgeH / 2;
                const iconR = badgeH / 2 - 4;

                ctx.save();
                ctx.beginPath();
                ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.fill();
                ctx.restore();

                const spriteSize = iconR * 1.8;
                ctx.drawImage(mascotImg, iconCX - spriteSize / 2, iconCY - spriteSize / 2, spriteSize, spriteSize);

                const textX = align === "left" ? x + badgeH : x + badgeW - badgeH;
                ctx.save();
                ctx.textAlign = align === "left" ? "left" : "right";
                ctx.textBaseline = "middle";
                ctx.font = `700 12px ${FONT_DISPLAY}`;
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.fillText(theme.label, textX, y + badgeH * 0.32);
                ctx.restore();

                drawGoldAmount(textX, y + badgeH * 0.78, gold, 20, align === "left" ? "left" : "right");
            }

            badge(TEAM_THEME.shark, sharkImg, teamRef.current.shark, "left");
            badge(TEAM_THEME.cat, catImg, teamRef.current.cat, "right");
        }

        function drawPlayers() {
            const SPRITE_SIZE = 90;
            const now = Date.now();

            const { catLeader, sharkLeader } = getTeamGoldLeaders();

            for (const p of playersRef.current) {
                let img = p.shark ? sharkImg : catImg;
                const px = p.x * WORLD_SCALE;
                const baseY = p.y * WORLD_SCALE;

                if (!p.alive) {
                    img = fireIMG;
                    ctx.drawImage(img, px - SPRITE_SIZE / 2, baseY - SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
                    drawComicText("KO'd", px, baseY + SPRITE_SIZE / 2 + 18, 14, "#ffd9d9", "#6b0000");
                    continue;
                }

                const phase = hashString(p.id || p.name || "p") % 1000;
                const bob = Math.sin(now / 260 + phase) * 4;
                const py = baseY + bob;

                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = "#000";
                ctx.beginPath();
                ctx.ellipse(px, baseY + SPRITE_SIZE / 2 + 6, SPRITE_SIZE * 0.32, SPRITE_SIZE * 0.12, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                const isGoldLeader = p.gold > 0 && (p.shark ? p === sharkLeader : p === catLeader);
                if (isGoldLeader) {
                    img = p.shark ? mvpSharkImg : mvpCatImg;
                }

                ctx.drawImage(img, px - SPRITE_SIZE / 2, py - SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);

                if (isGoldLeader) {
                    drawStar(px, py - SPRITE_SIZE / 2 - 14, 10, 4, 5, now / 500, GOLD.fill, 0.95);
                }

                if (p.shield) {
                    ctx.save();
                    ctx.drawImage(shieldImg, px - SPRITE_SIZE / 2, py - SPRITE_SIZE / 2, SPRITE_SIZE * 1.2, SPRITE_SIZE * 1.2);

                    ctx.restore();
                }

                const dx = p.dx ?? 0;
                const dy = p.dy ?? 0;

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
                    ctx.moveTo(SPRITE_SIZE / 2 + 12, 0);
                    ctx.lineTo(SPRITE_SIZE / 2 - 3, -8);
                    ctx.lineTo(SPRITE_SIZE / 2 - 3, 8);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.restore();
                }

                // name tag pill
                ctx.save();
                ctx.font = `700 14px ${FONT_DISPLAY}`;
                const label = p.name || "Anonymous";
                const tw = ctx.measureText(label).width;
                const tagW = tw + 20;
                const tagH = 22;
                const tagX = px - tagW / 2;
                const tagY = py - SPRITE_SIZE / 2 - tagH - 10;
                roundedRectPath(tagX, tagY, tagW, tagH, tagH / 2);
                ctx.fillStyle = "rgba(20,20,30,0.55)";
                ctx.fill();
                ctx.restore();

                drawComicText(label, px, tagY + tagH * 0.72, 14, "#ffffff", "#000000", "center", 2.5);

                if (p.gold > 0) {
                    drawGoldAmount(px, py + SPRITE_SIZE / 2 + 24, p.gold, 20, "center");
                }
            }
        }

        function drawAttackFX() {
            const FIREBALL_LENGTH = 4000 * WORLD_SCALE;
            const FIREBALL_WIDTH = 1200 * WORLD_SCALE;

            for (const fx of fxRef.current) {
                const progress = fx.t / FX_MAX_TIME;
                const alpha = 1 - progress;

                const x = fx.x * WORLD_SCALE;
                const y = fx.y * WORLD_SCALE;

                ctx.save();

                ctx.globalAlpha = alpha;
                ctx.shadowColor = "#ff8a00";
                ctx.shadowBlur = 18;
                ctx.translate(x, y);
                ctx.rotate(fx.angle);
                ctx.scale(-1, 1);

                ctx.drawImage(
                    fireballImg,
                    -45 - FIREBALL_LENGTH,
                    -FIREBALL_WIDTH / 2,
                    FIREBALL_LENGTH,
                    FIREBALL_WIDTH
                );

                ctx.restore();
            }
        }

        // ---------- victory confetti ----------

        function seedConfetti() {
            const colors = ["#ffd54a", "#ff7a59", "#1fb6ff", "#ffffff", "#7CFC95"];
            const particles = [];
            for (let i = 0; i < 140; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: -Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 60,
                    vy: 80 + Math.random() * 120,
                    size: 6 + Math.random() * 6,
                    rot: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 6,
                    color: colors[Math.floor(Math.random() * colors.length)],
                });
            }
            confettiRef.current = particles;
        }

        function updateConfetti(dt: number) {
            for (const c of confettiRef.current) {
                c.x += c.vx * dt;
                c.y += c.vy * dt;
                c.vy += 40 * dt;
                c.rot += c.rotSpeed * dt;
                if (c.y > canvas.height + 20) {
                    c.y = -20;
                    c.x = Math.random() * canvas.width;
                    c.vy = 80 + Math.random() * 120;
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

        function drawWinnerScreen(now: number) {
            if (!winnerRef.current) return;

            if (winnerStartRef.current === null) {
                winnerStartRef.current = now;
                seedConfetti();
            }

            const elapsed = (now - winnerStartRef.current) / 1000;
            const popT = easeOutBack(Math.min(elapsed / 0.6, 1));
            const bob = Math.sin(now / 260) * 6;

            const theme = winnerRef.current === "shark" ? TEAM_THEME.shark : TEAM_THEME.cat;
            const mvpImg = winnerRef.current === "shark" ? mvpSharkImg : mvpCatImg;

            ctx.save();
            ctx.fillStyle = "rgba(10, 8, 20, 0.6)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            updateConfetti(1 / 60);
            drawConfetti();

            const cx = canvas.width / 2;
            const cy = canvas.height / 2 + 10;
            const glowR = Math.min(canvas.width, canvas.height) * 0.32;
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
            glow.addColorStop(0, theme.glow);
            glow.addColorStop(1, "rgba(255,255,255,0)");
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            for (let i = 0; i < 6; i++) {
                const a = now / 1200 + (i * Math.PI) / 3;
                const r = glowR * 0.78;
                drawStar(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 12, 5, 5, a, "#ffffff", 0.85);
            }

            const spriteSize = Math.min(canvas.width, canvas.height) * 0.34 * popT;
            ctx.save();
            ctx.translate(cx, cy + bob);
            ctx.drawImage(mvpImg, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
            ctx.restore();

            const bannerY = cy - glowR - 30;
            drawComicText(`${theme.emoji} ${theme.label} WIN! ${theme.emoji}`, cx, bannerY, 52, "#ffffff", theme.dark, "center", 9);

            drawComicText("YAYYY VICTORY gg!", cx, cy + glowR + 70, 26, GOLD.fill, "#5a3d00", "center", 5);
        }

        function loop(now: number) {
            const dt = (now - last) / 1000;
            last = now;

            if (!winnerRef.current && winnerStartRef.current !== null) {
                winnerStartRef.current = null;
                confettiRef.current = [];
            }

            updateFX(dt);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (bgImg.complete) {
                ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
            }

            drawVignette();
            drawAttackFX();
            drawPlayers();
            drawHUD();

            if (winnerRef.current) {
                drawWinnerScreen(now);
            }

            requestAnimationFrame(loop);
        }

        requestAnimationFrame(loop);

        return () => window.removeEventListener("resize", resize);
    }, []);

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                background: "linear-gradient(180deg, #bdeaff 0%, #eaf9ff 100%)",
            }}
        >
            <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
        </div>
    );
}   