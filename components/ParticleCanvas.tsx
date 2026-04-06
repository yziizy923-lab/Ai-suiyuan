"use client";

import { useEffect, useRef, useCallback } from "react";

export interface IngredientPoint {
  lng: number;
  lat: number;
  name: string;
  ingredient: string;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  /** jittered spawn screen x */
  spawnX: number;
  /** jittered spawn screen y */
  spawnY: number;
  /** fixed non-jittered screen x at time of spawn (home for flow phase) */
  initX: number;
  /** fixed non-jittered screen y at time of spawn */
  initY: number;
  /** fixed non-jittered target screen x at time of spawn */
  initTargetX: number;
  /** fixed non-jittered target screen y at time of spawn */
  initTargetY: number;
  color: string;
  alpha: number;
  size: number;
  baseSize: number;
  life: number;
  maxLife: number;
  ingredient: string;
  lng: number;
  lat: number;
  moveDelay: number;
  spawnEnd: number;
}

interface ParticleCanvasProps {
  ingredientPoints: IngredientPoint[];
  dishCenterLng: number;
  dishCenterLat: number;
  mapRef: React.RefObject<mapboxgl.Map | null>;
  visible: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const PARTICLE_LIFE = 220;
const PARTICLE_SPAWN_INTERVAL = 100;
const SPAWN_END_RATIO = 0.25;

export default function ParticleCanvas({
  ingredientPoints,
  dishCenterLng,
  dishCenterLat,
  mapRef,
  visible,
  containerRef,
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);

  const spawnParticle = useCallback(
    (source: IngredientPoint) => {
      const canvas = canvasRef.current;
      const map = mapRef.current;
      if (!canvas || !map) return;

      const baseSize = 2.5 + Math.random() * 3.5;
      const maxLife = PARTICLE_LIFE + Math.floor(Math.random() * 80);
      const spawnEnd = Math.floor(maxLife * SPAWN_END_RATIO);
      const moveDelay = Math.floor(Math.random() * spawnEnd * 0.8);

      // Initial screen position (first draw frame will fix from lng/lat)
      const origin = map.project([source.lng, source.lat]);
      const jitterX = (Math.random() - 0.5) * 14;
      const jitterY = (Math.random() - 0.5) * 14;

      particlesRef.current.push({
        x: origin.x + jitterX,
        y: origin.y + jitterY,
        spawnX: 0,
        spawnY: 0,
        initX: 0,
        initY: 0,
        initTargetX: 0,
        initTargetY: 0,
        color: source.color,
        alpha: 0,
        size: 0,
        baseSize,
        life: 0,
        maxLife,
        ingredient: source.ingredient,
        lng: source.lng,
        lat: source.lat,
        moveDelay,
        spawnEnd,
      });
    },
    [mapRef, canvasRef]
  );

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Ensure canvas size matches container before any projection
      const container = containerRef.current;
      if (container && (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight)) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // When not visible, just clear canvas and skip all particle logic
      if (!visible) return;

      const map = mapRef.current;

      if (timestamp - lastSpawnTimeRef.current > PARTICLE_SPAWN_INTERVAL) {
        lastSpawnTimeRef.current = timestamp;
        ingredientPoints.forEach((pt) => {
          for (let i = 0; i < 2; i++) {
            spawnParticle(pt);
          }
        });
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;

        const progress = Math.min(p.life / p.maxLife, 1);

        // ── Sync to current map viewport every frame ─────────────────────────
        if (map) {
          // Recalculate screen positions from live geo coords
          const curOrigin = map.project([p.lng, p.lat]);
          const curTarget = map.project([dishCenterLng, dishCenterLat]);

          if (p.life === 1) {
            // First frame: initialise spawn offset (jitter) once
            p.spawnX = p.x;
            p.spawnY = p.y;
            p.initX = curOrigin.x;
            p.initY = curOrigin.y;
            p.initTargetX = curTarget.x;
            p.initTargetY = curTarget.y;
          } else {
            // Keep jittered spawn position moving with the map
            const spawnOffX = p.spawnX - p.initX;
            const spawnOffY = p.spawnY - p.initY;
            p.initX = curOrigin.x;
            p.initY = curOrigin.y;
            p.spawnX = p.initX + spawnOffX;
            p.spawnY = p.initY + spawnOffY;
            p.initTargetX = curTarget.x;
            p.initTargetY = curTarget.y;
          }
        }

        // ── PHASE 1: SPAWN (原地浮现，脉冲呼吸) ─────────────────────────────
        if (p.life <= p.spawnEnd) {
          const spawnProgress = p.life / p.spawnEnd;
          // ease-in-out for smooth ramp
          const ease = spawnProgress < 0.5
            ? 2 * spawnProgress * spawnProgress
            : -1 + (4 - 2 * spawnProgress) * spawnProgress;
          p.alpha = ease * 0.95;

          const sizeEase = spawnProgress < 0.7 ? ease : 1 - (spawnProgress - 0.7) / 0.3;
          p.size = p.baseSize * sizeEase;

          // 原地呼吸漂移（基于当前同步后的 spawn 坐标）
          const drift = Math.sin(p.life * 0.18) * 2;
          const driftY = Math.cos(p.life * 0.13 + 1) * 2;
          p.x = p.spawnX + drift;
          p.y = p.spawnY + driftY;
        }

        // ── PHASE 2: FLOW (从产地飞向菜品中心) ───────────────────────────────
        else {
          if (p.life < p.spawnEnd + p.moveDelay) {
            // 等待启动：原地维持
            p.alpha = Math.min(p.alpha + 0.05, 1);
            p.size = p.baseSize;
            p.x = p.spawnX;
            p.y = p.spawnY;
          } else {
            // 从 initX/Y (非抖动坐标) 出发，向 initTargetX/Y 移动
            const moveTotal = p.maxLife - p.spawnEnd - p.moveDelay;
            const moveElapsed = p.life - p.spawnEnd - p.moveDelay;
            const moveProgress = Math.min(moveElapsed / moveTotal, 1);

            // ease-in-out cubic
            const eased = moveProgress < 0.5
              ? 4 * moveProgress * moveProgress * moveProgress
              : 1 - Math.pow(-2 * moveProgress + 2, 3) / 2;

            p.x = p.initX + (p.initTargetX - p.initX) * eased;
            p.y = p.initY + (p.initTargetY - p.initY) * eased;

            p.alpha = moveProgress < 0.65
              ? 0.75 + 0.25 * (moveProgress / 0.65)
              : 1 - (moveProgress - 0.65) / 0.35;
            p.alpha = Math.max(0, Math.min(1, p.alpha));
          }
        }

        // ── 绘制 ────────────────────────────────────────────────────────────
        const glowIntensity = Math.max(0.01,
          p.life <= p.spawnEnd
            ? 0.55 + 0.45 * Math.sin(p.life * 0.28)
            : 0.4 + 0.35 * Math.max(0, 1 - progress)
        );

        // 确保尺寸有效
        const safeSize = Math.max(0.1, p.size);
        const glowRadius = Math.max(0.1, safeSize * 4 * glowIntensity);

        // 光晕层
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.45;
        const glowGrad = ctx.createRadialGradient(
          p.x, p.y, 0, p.x, p.y, glowRadius
        );
        glowGrad.addColorStop(0, p.color + "ee");
        glowGrad.addColorStop(0.3, p.color + "66");
        glowGrad.addColorStop(1, "transparent");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 粒子核心
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12 * glowIntensity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, safeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 高光点
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.85;
        const hlGrad = ctx.createRadialGradient(
          p.x - safeSize * 0.3, p.y - safeSize * 0.3, 0,
          p.x, p.y, safeSize
        );
        hlGrad.addColorStop(0, "#ffffffcc");
        hlGrad.addColorStop(1, "transparent");
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, safeSize * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        return p.life < p.maxLife;
      });

      animFrameRef.current = requestAnimationFrame(draw);
    },
    // eslint-disable-next-line react-hooks/immutability
    [visible, ingredientPoints, dishCenterLng, dishCenterLat, mapRef, spawnParticle]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef]);

  useEffect(() => {
    if (visible) {
      lastSpawnTimeRef.current = 0; // reset so first batch spawns immediately
      particlesRef.current = [];
    }
  }, [visible]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

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
        zIndex: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.8s ease",
      }}
    />
  );
}
