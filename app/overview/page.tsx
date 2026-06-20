"use client";

import { useState, useEffect, useRef } from "react";
import { PLAYER_SIZE } from "./components/game";

export default function Overview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resize();
        window.addEventListener("resize", resize);

        // Example: Draw a simple grid
        const gridSize = 50;
        ctx.strokeStyle = "#ccc";
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // grab all players (placeholder) and draw them. sprite shark/cat based on shark boolean. also draw health bar and name above them
        const players: any[] = []

        players.forEach(player => {
            const screenX = player.x;
            const screenY = player.y;

            // draw player sprite image

            const playerImage = new Image();
            // playerImage.src = "/assets/sprites/cat-removebg-preview.png";
            // depends based on shark boolean
            playerImage.src = player.shark ? "/assets/sprites/cat-removebg-preview.png"
                : "/assets/sprites/shark-removebg-preview.png";
            playerImage.width = PLAYER_SIZE;
            playerImage.height = PLAYER_SIZE;

            // draw health bar
            ctx.fillStyle = "red";
            ctx.fillRect(screenX - 25, screenY - 40, 50 * (player.health / 100), 5);
        });

        return () => {
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <div>
            <canvas
                ref={canvasRef}
                style={{
                    display: "block",
                    width: "100vw",
                    height: "100vh",
                    touchAction: "none",
                }}
            />
        </div>
    );
}