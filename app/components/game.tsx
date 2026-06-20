"use client";

import { useEffect, useRef } from "react";
import { supabase } from "../backend/supabase";

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;

const PLAYER_SIZE = 100;
const PLAYER_SPEED = 350; // pixels/sec

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let width = window.innerWidth;
    let height = window.innerHeight;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width;
      canvas.height = height;
    }

    resize();
    window.addEventListener("resize", resize);

    const keys: Record<string, boolean> = {};

    const localPlayer = {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
    };

    const players: Record<string, { x: number, y: number, dx: number, dy: number, lastUpdate: number }> = {};

    const channel = supabase.channel('game_room')
      .on(
        'broadcast',
        { event: 'joystick' },
        (payload) => {
          const { uuid, dx, dy } = payload.payload;
          if (!players[uuid]) {
            players[uuid] = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, dx: 0, dy: 0, lastUpdate: performance.now() };
          }
          players[uuid].dx = dx;
          players[uuid].dy = dy;
          players[uuid].lastUpdate = performance.now();
        }
      )
      .subscribe();

    function keyDown(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = true;
    }

    function keyUp(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = false;
    }

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    const playerImage = new Image();
    playerImage.src = "/assets/sprites/cat-removebg-preview.png";

    let last = performance.now();

    function loop(now: number) {
      const dt = (now - last) / 1000;
      last = now;

      let dx = 0;
      let dy = 0;

      if (keys["w"] || keys["arrowup"]) dy--;
      if (keys["s"] || keys["arrowdown"]) dy++;
      if (keys["a"] || keys["arrowleft"]) dx--;
      if (keys["d"] || keys["arrowright"]) dx++;

      // Normalize diagonal movement
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
      }

      localPlayer.x += dx * PLAYER_SPEED * dt;
      localPlayer.y += dy * PLAYER_SPEED * dt;

      // Keep local player inside world
      localPlayer.x = Math.max(
        PLAYER_SIZE / 2,
        Math.min(WORLD_WIDTH - PLAYER_SIZE / 2, localPlayer.x)
      );
      localPlayer.y = Math.max(
        PLAYER_SIZE / 2,
        Math.min(WORLD_HEIGHT - PLAYER_SIZE / 2, localPlayer.y)
      );

      // Update remote players
      for (const uuid in players) {
        const p = players[uuid];
        p.x += p.dx * PLAYER_SPEED * dt;
        p.y += p.dy * PLAYER_SPEED * dt;

        p.x = Math.max(PLAYER_SIZE / 2, Math.min(WORLD_WIDTH - PLAYER_SIZE / 2, p.x));
        p.y = Math.max(PLAYER_SIZE / 2, Math.min(WORLD_HEIGHT - PLAYER_SIZE / 2, p.y));

        if (now - p.lastUpdate > 2000) {
          p.dx = 0;
          p.dy = 0;
        }
      }

      // Camera follows local player
      const cameraX = Math.max(
        0,
        Math.min(WORLD_WIDTH - width, localPlayer.x - width / 2)
      );

      const cameraY = Math.max(
        0,
        Math.min(WORLD_HEIGHT - height, localPlayer.y - height / 2)
      );

      // Background
      ctx.fillStyle = "#181818";
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = "#2f2f2f";
      ctx.lineWidth = 1;

      const grid = 100;

      const startX = Math.floor(cameraX / grid) * grid;
      const startY = Math.floor(cameraY / grid) * grid;

      for (let x = startX; x <= cameraX + width; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x - cameraX, 0);
        ctx.lineTo(x - cameraX, height);
        ctx.stroke();
      }

      for (let y = startY; y <= cameraY + height; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y - cameraY);
        ctx.lineTo(width, y - cameraY);
        ctx.stroke();
      }

      // World border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.strokeRect(
        -cameraX,
        -cameraY,
        WORLD_WIDTH,
        WORLD_HEIGHT
      );

      // Draw local player
      if (playerImage.complete) {
        ctx.drawImage(
          playerImage,
          localPlayer.x - PLAYER_SIZE / 2 - cameraX,
          localPlayer.y - PLAYER_SIZE / 2 - cameraY,
          PLAYER_SIZE,
          PLAYER_SIZE
        );

        // Draw remote players
        for (const uuid in players) {
          const p = players[uuid];
          ctx.drawImage(
            playerImage,
            p.x - PLAYER_SIZE / 2 - cameraX,
            p.y - PLAYER_SIZE / 2 - cameraY,
            PLAYER_SIZE,
            PLAYER_SIZE
          );
        }
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      channel.unsubscribe();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}