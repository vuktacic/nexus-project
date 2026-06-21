"use client";

import { useState, useEffect, useRef } from "react";
import { useDeviceMotion } from "../hooks/useDeviceMotion";

function clampJoystick(dx: number, dy: number, max: number) {
    const dist = Math.hypot(dx, dy);
    if (dist <= max) return { dx, dy };
    const scale = max / dist;
    return { dx: dx * scale, dy: dy * scale };
}

// phone control defaults
const DEFAULT_SHIELD_BETA_THRESHOLD = 60;
export const SHIELD_DURATION = 500;
const SHIELD_COOLDOWN = 800;

const DEFAULT_ATTACK_THRESHOLD = 7;
const ATTACK_COOLDOWN_TIME = 1000;
const GYRO_POLL_MS = 50;

const MOTION_DETECTION_TIMEOUT_MS = 1500;

interface MotionButtonsProps {
    channelRef: React.MutableRefObject<any>;
    shieldActive: boolean;
    onShield: () => void;
}

function InteractiveInstructionButtons({
    channelRef,
    shieldActive,
    onShield,
}: MotionButtonsProps) {
    const [attackCooldown, setAttackCooldown] = useState(false);
    
    const handleAttack = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (attackCooldown || shieldActive || !channelRef.current) return;
        
        channelRef.current.emit("attack");
        setAttackCooldown(true);
        setTimeout(() => setAttackCooldown(false), ATTACK_COOLDOWN_TIME);
    };
    
    const [shieldCooldown, setShieldCooldown] = useState(false);
    const handleShieldClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (shieldActive || shieldCooldown) return;
        setShieldCooldown(true);
        setTimeout(() => setShieldCooldown(false), SHIELD_COOLDOWN);

        onShield();
    };

    return (
        <div
            style={{
                position: "absolute",
                bottom: 40, 
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                gap: "32px",
                zIndex: 10,
            }}
        >
            <button
                onClick={handleAttack}
                disabled={attackCooldown || shieldActive}
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: attackCooldown || shieldActive ? "not-allowed" : "pointer",
                    outline: "none",
                }}
            >
                <img
                    src="/assets/ui/stab_ins.png"
                    alt="push phone toward right direction to attack"
                    style={{
                        width: 90,
                        height: 90,
                        borderRadius: "14px",
                        objectFit: "contain",
                        background: attackCooldown || shieldActive ? "rgba(255,0,0,0.05)" : "rgba(255,255,255,0.05)",
                        border: attackCooldown || shieldActive ? "2px solid rgba(244, 67, 54, 0.4)" : "2px solid rgba(255,255,255,0.15)",
                        opacity: attackCooldown || shieldActive ? 0.4 : 1,
                        transition: "all 0.15s ease",
                    }}
                />
            </button>

            <button
                onClick={handleShieldClick}
                disabled={shieldActive}
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: shieldActive ? "not-allowed" : "pointer",
                    outline: "none",
                }}
            >
                <img
                    src="/assets/ui/shield_ins.png"
                    alt="turn to shield"
                    style={{
                        width: 90,
                        height: 90,
                        borderRadius: "14px",
                        objectFit: "contain",
                        background: shieldActive ? "rgba(0,188,212,0.15)" : "rgba(255,255,255,0.05)",
                        border: shieldActive ? "2px solid #00bcd4" : "2px solid rgba(255,255,255,0.15)",
                        opacity: shieldActive ? 0.6 : 1,
                        boxShadow: shieldActive ? "0 0 15px rgba(0, 188, 212, 0.4)" : "none",
                        transition: "all 0.15s ease",
                    }}
                />
            </button>
        </div>
    );
}

export default function Controller() {
    const [name, setName] = useState("");
    const [joined, setJoined] = useState(false);
    const [statusMsg, setStatusMsg] = useState("");
    const [shieldActive, setShieldActive] = useState(false);
    const channelRef = useRef<any>(null);

    const [motionAvailable, setMotionAvailable] = useState<boolean | null>(null);

    const [showSettings, setShowSettings] = useState(false);
    const [attackThres, setAttackThres] = useState(DEFAULT_ATTACK_THRESHOLD);
    const [betaThres, setBetaThres] = useState(DEFAULT_SHIELD_BETA_THRESHOLD);

    const [knob, setKnob] = useState({ x: 0, y: 0 });
    const joystickRef = useRef({
        active: false,
        pointerId: -1,
        originX: 0,
        originY: 0,
        angleRef: 0,
    });

    const { orientation, motion, permissionNeeded, requestPermission } = useDeviceMotion();

    useEffect(() => {
        if (permissionNeeded) {
            requestPermission()
                .then((result: any) => {
                    if (result === "denied" || result === false) {
                        setMotionAvailable(false);
                    }
                })
                .catch(() => setMotionAvailable(false));
        }
    }, [permissionNeeded, requestPermission]);

    useEffect(() => {
        if (motionAvailable !== null) return;

        if (orientation && motion) {
            setMotionAvailable(true);
            return;
        }

        const timeout = setTimeout(() => {
            setMotionAvailable((prev) => (prev === null ? false : prev));
        }, MOTION_DETECTION_TIMEOUT_MS);

        return () => clearTimeout(timeout);
    }, [orientation, motion, motionAvailable]);

    const debugRef = useRef<{ orientation: any; motion: any }>({ orientation: null, motion: null });
    useEffect(() => {
        debugRef.current = { orientation, motion };
    }, [orientation, motion]);

    const thresholdsRef = useRef({ attackThres, betaThres });
    useEffect(() => {
        thresholdsRef.current = { attackThres, betaThres };
    }, [attackThres, betaThres]);

    const prevRef = useRef({
        alpha: null as number | null,
        beta: null as number | null,
        gamma: null as number | null,
        motionX: null as number | null,
        motionY: null as number | null,
        motionZ: null as number | null,
    });

    const shieldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const attackCooldownRef = useRef(false);
    const shieldCooldownRef = useRef(false);

    function triggerShield() {
        if (!channelRef.current) return;
        if (shieldTimeoutRef.current) return;
        if (shieldCooldownRef.current) return;

        shieldCooldownRef.current = true; 

        channelRef.current.emit("shield", { shield: true });
        setShieldActive(true);

        shieldTimeoutRef.current = setTimeout(() => {
            channelRef.current?.emit("shield", { shield: false });
            setShieldActive(false);
            shieldTimeoutRef.current = null;
        }, SHIELD_DURATION);

        setTimeout(
            () => {
                shieldCooldownRef.current = false;
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate([50]);
                }
            },
            SHIELD_DURATION + SHIELD_COOLDOWN,
        );
    }

    function handleManualShieldToggle() {
        if (shieldActive) {
            if (shieldTimeoutRef.current) {
                clearTimeout(shieldTimeoutRef.current);
                shieldTimeoutRef.current = null;
            }
            channelRef.current?.emit("shield", { shield: false });
            setShieldActive(false);
        } else {
            triggerShield();
        }
    }

    function triggerAttack() {
        if (!channelRef.current) return;
        if (shieldTimeoutRef.current) return;
        if (attackCooldownRef.current) return;

        channelRef.current.emit("attack");
        attackCooldownRef.current = true;

        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([10, 20, 30, 40, 50]); //attack
        }

        setTimeout(() => {
            attackCooldownRef.current = false;
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate([80]);
            }
        }, ATTACK_COOLDOWN_TIME);
    }

    function gyroAndAccelHandler() {
        const currentOrientation = debugRef.current.orientation;
        const currentMotion = debugRef.current.motion;

        if (!currentOrientation || !currentMotion) return;

        const prev = prevRef.current;
        const currentThresholds = thresholdsRef.current;

        if (
            prev.alpha !== null &&
            prev.beta !== null &&
            prev.gamma !== null &&
            prev.motionX !== null &&
            prev.motionY !== null &&
            prev.motionZ !== null
        ) {
            const betaDelta = Math.abs(currentOrientation.beta - prev.beta);
            const gammaDelta = Math.abs(currentOrientation.gamma - prev.gamma);
            const motionDeltaZ = currentMotion.z - prev.motionZ;
            const accelZDelta = Math.abs(motionDeltaZ);

            if (betaDelta <= 8 && accelZDelta > currentThresholds.attackThres) {
                triggerAttack();
            } else if (gammaDelta >= currentThresholds.betaThres) {
                triggerShield();
            }
        }

        prev.alpha = currentOrientation.alpha;
        prev.beta = currentOrientation.beta;
        prev.gamma = currentOrientation.gamma;
        prev.motionX = currentMotion.x;
        prev.motionY = currentMotion.y;
        prev.motionZ = currentMotion.z;
    }

    useEffect(() => {
        if (!joined || !motionAvailable) return;

        const gyroInterval = setInterval(gyroAndAccelHandler, GYRO_POLL_MS);
        return () => clearInterval(gyroInterval);
    }, [joined, motionAvailable]);

    useEffect(() => {
        return () => {
            if (shieldTimeoutRef.current) clearTimeout(shieldTimeoutRef.current);
        };
    }, []);

    const sendRef = useRef({ dx: 0, dy: 0 });
    const angleRef = useRef(0);

    useEffect(() => {
        if (!joined) return;
        const interval = setInterval(() => {
            channelRef.current?.emit("input", sendRef.current);
        }, 50);

        return () => clearInterval(interval);
    }, [joined]);

    function connectAndJoin(playerName: string) {
        let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://165.22.144.193";
        if (backendUrl && !backendUrl.startsWith("http://") && !backendUrl.startsWith("https://")) {
            backendUrl = `http://${backendUrl}`;
        }
        const isHttps = backendUrl.startsWith("https://");
        console.log(`[CLIENT LOG] Connecting to ${backendUrl}`);
        setStatusMsg(`Connecting to game server...`);

        import("@geckos.io/client")
            .then((module) => {
                const geckos = module.default;
                const channel = geckos({ url: backendUrl, port: (isHttps ? null : 3001) as number });

                channel.onConnect((error) => {
                    if (error) {
                        console.error("[CLIENT LOG] Connection error:", error);
                        setStatusMsg(`Connection error: ${error.message}`);
                        return;
                    }
                    console.log(`[CLIENT LOG] Connected! ID: ${channel.id}`);
                    channel.emit("join", { name: playerName });
                    channelRef.current = channel;
                    setJoined(true);
                });

                channel.onDisconnect(() => {
                    console.warn("[CLIENT LOG] Disconnected.");
                    setJoined(false);
                    setStatusMsg("Disconnected from server");
                });
            })
            .catch((err) => {
                console.error("[CLIENT LOG] Failed to load geckos client:", err);
                setStatusMsg("Failed to initialize game client package");
            });
    }

    function handleJoin(e: React.FormEvent) {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) return;
        connectAndJoin(trimmedName);
    }

    function onPointerDown(e: React.PointerEvent) {
        if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".settings-panel")) return;
        joystickRef.current.active = true;
        joystickRef.current.pointerId = e.pointerId;
        joystickRef.current.originX = e.clientX;
        joystickRef.current.originY = e.clientY;
    }

    function onPointerMove(e: React.PointerEvent) {
        if (!joystickRef.current.active || e.pointerId !== joystickRef.current.pointerId) return;

        const rawDx = e.clientX - joystickRef.current.originX;
        const rawDy = e.clientY - joystickRef.current.originY;
        const MAX = 80;
        const clamped = clampJoystick(rawDx, rawDy, MAX);

        setKnob({ x: clamped.dx, y: clamped.dy });

        sendRef.current.dx = clamped.dx / MAX;
        sendRef.current.dy = clamped.dy / MAX;

        const len = Math.hypot(clamped.dx, clamped.dy);
        if (len > 0.01) {
            angleRef.current = Math.atan2(clamped.dy, clamped.dx);
        }
    }

    function onPointerUp(e: React.PointerEvent) {
        if (e.pointerId !== joystickRef.current.pointerId) return;
        joystickRef.current.active = false;
        setKnob({ x: 0, y: 0 });
        sendRef.current.dx = 0;
        sendRef.current.dy = 0;
    }

    if (!joined) {
        return (
            <div
                style={{
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    color: "#fff",
                }}
            >
                <form
                    onSubmit={handleJoin}
                    style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "16px",
                        padding: "32px",
                        width: "90%",
                        maxWidth: "400px",
                        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
                        textAlign: "center",
                    }}
                >
                    <h2 style={{ marginBottom: "8px", fontSize: "24px", fontWeight: 700, letterSpacing: "-0.5px" }}>
                        join the fun
                    </h2>
                    <p style={{ color: "#8a8a9e", fontSize: "14px", marginBottom: "24px" }}>
                        pick your name!!
                    </p>

                    <input
                        type="text"
                        placeholder="name of kitty or sharky"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={15}
                        required
                        style={{
                            width: "100%",
                            padding: "12px 16px",
                            borderRadius: "8px",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            background: "rgba(0, 0, 0, 0.3)",
                            color: "#fff",
                            fontSize: "16px",
                            marginBottom: "16px",
                            outline: "none",
                            boxSizing: "border-box",
                        }}
                    />

                    <button
                        type="submit"
                        style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                            color: "#fff",
                            fontSize: "16px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Join Game
                    </button>

                    {statusMsg && (
                        <p style={{ marginTop: "16px", color: "#f87171", fontSize: "14px" }}>
                            {statusMsg}
                        </p>
                    )}
                </form>
            </div>
        );
    }

    return (
        <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
                height: "100vh",
                background: "radial-gradient(circle at center, #111 0%, #000 100%)",
                touchAction: "none",
                position: "relative",
                overflow: "hidden",
                userSelect: "none",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            {/* Settings Toggle Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(!showSettings);
                }}
                style={{
                    position: "absolute",
                    top: "50px",
                    right: "20px",
                    zIndex: 30,
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "50%",
                    width: "44px",
                    height: "44px",
                    cursor: "pointer",
                    color: "white",
                    fontSize: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    outline: "none",
                }}
            >
            </button>

            {/* Slider Settings Overlay Panel */}
            {showSettings && (
                <div
                    className="settings-panel"
                    style={{
                        position: "absolute",
                        top: "76px",
                        right: "20px",
                        zIndex: 25,
                        width: "260px",
                        background: "rgba(0, 0, 0, 0.85)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "12px",
                        padding: "16px",
                        color: "white",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    }}
                >
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600 }}>Sensors Adjustment</h3>
                    
                    {/* Attack Slider */}
                    <div style={{ marginBottom: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px", color: "#ccc" }}>
                            <span>Attack Threshold</span>
                            <span style={{ color: "#6366f1", fontWeight: "bold" }}>{attackThres}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.5"
                            value={attackThres}
                            onChange={(e) => setAttackThres(parseFloat(e.target.value))}
                            style={{ width: "100%", accentColor: "#6366f1", cursor: "pointer" }}
                        />
                    </div>

                    {/* Beta/Shield Slider */}
                    <div style={{ marginBottom: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px", color: "#ccc" }}>
                            <span>Beta Threshold</span>
                            <span style={{ color: "#00bcd4", fontWeight: "bold" }}>{betaThres}°</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={betaThres}
                            onChange={(e) => setBetaThres(parseInt(e.target.value))}
                            style={{ width: "100%", accentColor: "#00bcd4", cursor: "pointer" }}
                        />
                    </div>
                </div>
            )}

            <InteractiveInstructionButtons
                channelRef={channelRef}
                shieldActive={shieldActive}
                onShield={handleManualShieldToggle}
            />

            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 140,
                    height: 140,
                    transform: "translate(-50%, -50%)",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.08)",
                        border: "2px solid rgba(255,255,255,0.2)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        left: 70 + knob.x,
                        top: 70 + knob.y,
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "white",
                        transform: "translate(-50%, -50%)",
                        transition: joystickRef.current.active ? "none" : "left 0.15s, top 0.15s",
                    }}
                />
            </div>
        </div>
    );
}