"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../backend/supabase";

interface JoystickProps {
  uuid: string;
}

export const Joystick = ({ uuid }: JoystickProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const maxDistance = 75; // pixels
  const throttleRef = useRef<number>(0);

  const broadcastMove = useCallback((dx: number, dy: number) => {
    // Throttle to 20 fps (50ms)
    const now = Date.now();
    if (now - throttleRef.current < 50) return;
    throttleRef.current = now;

    // Normalize dx and dy to [-1, 1] range based on maxDistance
    const normalizedDx = dx / maxDistance;
    const normalizedDy = dy / maxDistance;

    supabase.channel('game_room').send({
      type: 'broadcast',
      event: 'joystick',
      payload: { uuid, dx: normalizedDx, dy: normalizedDy }
    });
  }, [uuid]);

  useEffect(() => {
    if (!active) {
      // Send a final stop event
      broadcastMove(0, 0);
    }
  }, [active, broadcastMove]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setActive(true);
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!active) return;
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
  };

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate center of the joystick container
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const distance = Math.hypot(dx, dy);
    
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }

    setPosition({ x: dx, y: dy });
    broadcastMove(dx, dy);
  };

  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <h2 className="absolute top-10 text-white text-2xl font-bold">Use Joystick to Move</h2>
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="relative w-48 h-48 rounded-full bg-gray-800 border-4 border-gray-700 shadow-xl flex items-center justify-center cursor-pointer"
      >
        <div 
          ref={stickRef}
          className="absolute w-20 h-20 rounded-full bg-blue-500 shadow-lg pointer-events-none transition-colors"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            backgroundColor: active ? '#2563eb' : '#3b82f6'
          }}
        />
      </div>
    </div>
  );
};
