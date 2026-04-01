"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";

export type FlavorType = "酸" | "甜" | "苦" | "辣" | "咸" | "鲜";
export type ImportanceLevel = "main" | "important" | "normal";

export interface FlavorIngredientData {
  lng: number;
  lat: number;
  name: string;
  ingredient: string;
  flavor: FlavorType;
  importance: ImportanceLevel;
  color: string;
}

interface Props {
  ingredientData: FlavorIngredientData[];
  dishCenterLng: number;
  dishCenterLat: number;
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  visible: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface DiffusionParticle {
  x: number;
  y: number;
  lng: number;
  lat: number;
  flavor: FlavorType;
  importance: ImportanceLevel;
  color: string;
  radius: number;
  maxRadius: number;
  alpha: number;
  maxAlpha: number;
  phase: "expanding" | "stable" | "fading";
  rotation: number;
  rotationSpeed: number;
  pulsePhase: number;
}

const IMPORTANCE_PARAMS: Record<ImportanceLevel, { maxRadius: number; speed: number; pulseIntensity: number; maxAlpha: number }> = {
  "main": { maxRadius: 100, speed: 2000, pulseIntensity: 1, maxAlpha: 0.75 },
  "important": { maxRadius: 65, speed: 3000, pulseIntensity: 0.6, maxAlpha: 0.55 },
  "normal": { maxRadius: 40, speed: 4000, pulseIntensity: 0.3, maxAlpha: 0.35 },
};

function drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number, rotation: number) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI / spikes) + rotation;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawWaveShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, waves: number, rotation: number) {
  ctx.beginPath();
  const points = 64;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2 + rotation;
    const waveOffset = Math.sin(angle * waves) * radius * 0.15;
    const r = radius + waveOffset;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawFlameShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, rotation: number) {
  ctx.beginPath();
  const flames = 6;
  for (let i = 0; i < flames; i++) {
    const baseAngle = (i / flames) * Math.PI * 2 + rotation;
    const flameRadius = radius * (0.6 + Math.random() * 0.4);
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + Math.cos(baseAngle - 0.3) * flameRadius * 0.5,
      cy + Math.sin(baseAngle - 0.3) * flameRadius * 0.5,
      cx + Math.cos(baseAngle) * flameRadius,
      cy + Math.sin(baseAngle) * flameRadius
    );
    ctx.quadraticCurveTo(
      cx + Math.cos(baseAngle + 0.3) * flameRadius * 0.5,
      cy + Math.sin(baseAngle + 0.3) * flameRadius * 0.5,
      cx, cy
    );
  }
}

function drawSquareShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, rotation: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.rect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawDropletShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, rotation: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.bezierCurveTo(radius * 0.8, -radius * 0.3, radius, radius * 0.5, 0, radius);
  ctx.bezierCurveTo(-radius, radius * 0.5, -radius * 0.8, -radius * 0.3, 0, -radius);
  ctx.restore();
}

export default function FlavorDiffusionCanvas({
  ingredientData,
  mapRef,
  visible,
  containerRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<DiffusionParticle[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  const spawnedRef = useRef<boolean>(false);

  const spawnDiffusion = useCallback((data: FlavorIngredientData) => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const params = IMPORTANCE_PARAMS[data.importance];
    const projected = map.project([data.lng, data.lat]);

    const particle: DiffusionParticle = {
      x: projected.x,
      y: projected.y,
      lng: data.lng,
      lat: data.lat,
      flavor: data.flavor,
      importance: data.importance,
      color: data.color,
      radius: 0,
      maxRadius: params.maxRadius + (Math.random() - 0.5) * 20,
      alpha: 0,
      maxAlpha: params.maxAlpha,
      phase: "expanding",
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      pulsePhase: Math.random() * Math.PI * 2,
    };
    particlesRef.current.push(particle);
  }, [mapRef]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (container && (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight)) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!visible) return;

    const timestamp = Date.now();

    if (!spawnedRef.current && timestamp > 2000) {
      spawnedRef.current = true;
      ingredientData.forEach((data) => {
        for (let i = 0; i < 3; i++) {
          setTimeout(() => spawnDiffusion(data), i * 300);
        }
      });
    }

    particlesRef.current = particlesRef.current.filter((p) => {
      const projected = map.project([p.lng, p.lat]);
      p.x = projected.x;
      p.y = projected.y;

      const params = IMPORTANCE_PARAMS[p.importance];

      if (p.phase === "expanding") {
        p.radius += (p.maxRadius / params.speed) * 16;
        p.alpha = Math.min(p.alpha + 0.03, p.maxAlpha);
        p.pulsePhase += 0.08;
        p.rotation += p.rotationSpeed;

        if (p.radius >= p.maxRadius) {
          p.phase = "stable";
          p.radius = p.maxRadius;
        }
      } else if (p.phase === "stable") {
        p.pulsePhase += 0.05 * params.pulseIntensity;
        p.rotation += p.rotationSpeed * 0.5;
        const pulse = Math.sin(p.pulsePhase);
        p.alpha = p.maxAlpha * (0.7 + 0.3 * pulse);
      }

      const currentRadius = p.radius * (1 + Math.sin(p.pulsePhase) * 0.1 * params.pulseIntensity);
      const color = p.color || "#FFD700";
      const alphaHex = Math.round(p.alpha * 255).toString(16).padStart(2, "0");

      ctx.save();

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentRadius);
      gradient.addColorStop(0, color + alphaHex);
      gradient.addColorStop(0.5, color + Math.round(p.alpha * 0.5 * 255).toString(16).padStart(2, "0"));
      gradient.addColorStop(1, color + "00");

      ctx.fillStyle = gradient;

      switch (p.flavor) {
        case "酸":
          drawStarShape(ctx, p.x, p.y, 8, currentRadius, currentRadius * 0.5, p.rotation);
          break;
        case "甜":
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
          break;
        case "苦":
          drawWaveShape(ctx, p.x, p.y, currentRadius, 5, p.rotation);
          break;
        case "辣":
          drawFlameShape(ctx, p.x, p.y, currentRadius, p.rotation);
          break;
        case "咸":
          drawSquareShape(ctx, p.x, p.y, currentRadius, p.rotation);
          break;
        case "鲜":
          drawDropletShape(ctx, p.x, p.y, currentRadius, p.rotation);
          break;
        default:
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      }

      ctx.fill();
      ctx.restore();

      return true;
    });

    animFrameRef.current = requestAnimationFrame(draw);
  }, [mapRef, visible, ingredientData, spawnDiffusion, containerRef]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  useEffect(() => {
    if (!visible) {
      particlesRef.current = [];
      spawnedRef.current = false;
    }
  }, [visible]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}
