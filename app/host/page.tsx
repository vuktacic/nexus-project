"use client";

import { useEffect, useRef } from "react";

const WORLD_SCALE = 0.1;
const ATTACK_RANGE_WORLD = 4000;
const ATTACK_RANGE_SCREEN = ATTACK_RANGE_WORLD * WORLD_SCALE;
const ATTACK_ANGLE = Math.PI / 6;
const FX_MAX_TIME = 0.25;

export default function Host() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playersRef = useRef<any[]>([]);
    const fxRef = useRef<any[]>([]);
    const teamRef = useRef({ shark: 0, cat: 0 });

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

                    // Full world state (players)
                    channel.on("state", (state: any) => {
                        playersRef.current = (state.players || []).map((p: any) => ({
                            ...p,
                            gold: p.gold ?? 0,
                        }));

                        // Update team gold counts
                        teamRef.current.shark = state.teams?.shark?.gold || 0;
                        teamRef.current.cat = state.teams?.cat?.gold || 0;
                    });

                    // Attack visual effects
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

        const bgImg = new Image();
        bgImg.src = "/assets/map/combined_sides.png";

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resize();
        window.addEventListener("resize", resize);

        let last = performance.now();

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

        function drawPlayers() {
            const SPRITE_SIZE = 90;

            const { catLeader, sharkLeader } = getTeamGoldLeaders();

            for (const p of playersRef.current) {
                let img = p.shark ? sharkImg : catImg;
                const px = p.x * WORLD_SCALE;
                const py = p.y * WORLD_SCALE;
                
                if (!p.alive) {
                    img = fireIMG;
                    ctx.drawImage(img, px - SPRITE_SIZE / 2, py - SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
                } else {
                    console.log(`[HOST LOG] Drawing player ${p.name} at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) with gold: ${p.gold}`);

                    const isGoldLeader = p.gold > 0 && (p.shark ? p === sharkLeader : p === catLeader);
                    if (isGoldLeader) {
                        img = p.shark ? mvpSharkImg : mvpCatImg;
                    }

                    if (p.shield) {
                        img = shieldImg;
                    }

                    ctx.drawImage(img, px - SPRITE_SIZE / 2, py - SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);

                    const dx = p.dx ?? 0;
                    const dy = p.dy ?? 0;

                    if (dx !== 0 || dy !== 0) {
                        const angle = Math.atan2(dy, dx); // arctan of dy and dx

                        ctx.save();
                        ctx.translate(px, py); 
                        ctx.rotate(angle);     

                        ctx.fillStyle = "#ff3333";
                        ctx.beginPath();
                        ctx.moveTo(SPRITE_SIZE / 2 + 10, 0);
                        ctx.lineTo(SPRITE_SIZE / 2 - 2, -7);
                        ctx.lineTo(SPRITE_SIZE / 2 - 2, 7);
                        ctx.closePath();
                        ctx.fill();

                        ctx.restore();
                    }

                    ctx.fillStyle = "#ffffff";
                    ctx.font = "bold 14px system-ui, sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(p.name || "Anonymous", px, py - SPRITE_SIZE / 2 - 6);

                    if (p.gold > 0) {
                        ctx.fillStyle = "#ffd700";
                        ctx.font = "bold 26px system-ui, sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillText(`Gold: ${p.gold}`, px, py + SPRITE_SIZE / 2 + 16);
                    }
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

        function loop(now: number) {
            const dt = (now - last) / 1000;
            last = now;

            updateFX(dt);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (bgImg.complete) {
                ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
            }

            drawAttackFX();
            drawPlayers();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 18px system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(`Shark Team Gold: ${teamRef.current.shark}`, 20, 30);
            ctx.textAlign = "right";
            ctx.fillText(`Cat Team Gold: ${teamRef.current.cat}`, canvas.width - 20, 30);

            requestAnimationFrame(loop);
        }

        requestAnimationFrame(loop);

        return () => window.removeEventListener("resize", resize);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: "100vw", height: "100vh", display: "block" }}
        />
    );
}