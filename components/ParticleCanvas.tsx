"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface IngredientPoint {
  lng: number;
  lat: number;
  name: string;
  ingredient: string;
  color: string;
}

interface IngredientOrigin {
  x: number;
  y: number;
  name: string;
  ingredient: string;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  initX: number;
  initY: number;
  initTargetX: number;
  initTargetY: number;
  color: string;
  alpha: number;
  size: number;
  baseSize: number;
  life: number;
  maxLife: number;
  ingredient: string;
  /** ingredient index, for OD line lookup */
  ingredientIdx: number;
  lng: number;
  lat: number;
  moveDelay: number;
  spawnEnd: number;
}

interface ODLine {
  originLng: number;
  originLat: number;
  color: string;
  ingredient: string;
  /** 0-1: how far the line has been drawn toward the target */
  progress: number;
  /** alpha 0-1 */
  alpha: number;
  /** frame number when this line is allowed to start appearing */
  startFrame: number;
  /** true once fully drawn and all particles for this ingredient are gone */
  done: boolean;
}

interface ParticleCanvasProps {
  ingredientPoints: IngredientPoint[];
  dishCenterLng: number;
  dishCenterLat: number;
  mapRef: React.RefObject<mapboxgl.Map | null>;
  visible: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onIngredientClick?: (name: string, ingredient: string, color: string) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  ingredient: string;
  color: string;
}

const PARTICLE_LIFE = 220;
const INITIAL_BURST = 14;
/** Each ingredient's line starts this many frames after the previous one */
const LINE_STAGGER_FRAMES = 22;
/**
 * How many frames before the first particle enters flight phase that the
 * line is allowed to start drawing.  Creates the "line grows with particles"
 * feel without the line ever outrunning the particles.
 */
const LINE_LEAD_FRAMES = 10;

export default function ParticleCanvas({
  ingredientPoints,
  dishCenterLng,
  dishCenterLat,
  mapRef,
  visible,
  containerRef,
  onIngredientClick,
}: ParticleCanvasProps) {
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const odLinesRef = useRef<ODLine[]>([]);
  const spawnedRef = useRef<Set<number>>(new Set());
  const frameRef = useRef<number>(0);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    name: "",
    ingredient: "",
    color: "",
  });

  const ingredientOriginsRef = useRef<IngredientOrigin[]>([]);

  const spawnParticle = useCallback(
    (source: IngredientPoint, ingredientIdx: number, moveDelayExtra = 0) => {
      const map = mapRef.current;
      if (!map) return;

      const baseSize = 2.5 + Math.random() * 3.5;
      const maxLife = PARTICLE_LIFE + Math.floor(Math.random() * 80);
      const spawnEnd = Math.floor(maxLife * 0.22);
      const moveDelay =
        moveDelayExtra + Math.floor(Math.random() * spawnEnd * 0.5);

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
        ingredientIdx,
        lng: source.lng,
        lat: source.lat,
        moveDelay,
        spawnEnd,
      });
    },
    [mapRef]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (
      container &&
      (canvas.width !== container.clientWidth ||
        canvas.height !== container.clientHeight)
    ) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!visible) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const map = mapRef.current;
    frameRef.current++;
    const frame = frameRef.current;

    // ── One-shot burst per ingredient ──────────────────────────────────────
    ingredientPoints.forEach((pt, idx) => {
      if (spawnedRef.current.has(idx)) return;
      spawnedRef.current.add(idx);

      for (let i = 0; i < INITIAL_BURST; i++) {
        spawnParticle(pt, idx, i * 4);
      }

      // 保存食材原点位置，用于悬浮检测
      if (map) {
        const origin = map.project([pt.lng, pt.lat]);
        ingredientOriginsRef.current[idx] = {
          x: origin.x,
          y: origin.y,
          name: pt.name,
          ingredient: pt.ingredient,
          color: pt.color,
        };
      }

      // Line may start just before the first particle enters flight phase
      const firstFlowFrame = Math.floor(PARTICLE_LIFE * 0.22) - LINE_LEAD_FRAMES;
      const staggerOffset = idx * LINE_STAGGER_FRAMES;

      odLinesRef.current.push({
        originLng: pt.lng,
        originLat: pt.lat,
        color: pt.color,
        ingredient: pt.ingredient,
        progress: 0,
        alpha: 0,
        startFrame: frame + staggerOffset + Math.max(0, firstFlowFrame),
        done: false,
      });
    });

    // ── Per-ingredient: max flight progress among live particles ───────────
    // This is the "wavefront" the line tracks.
    const ingredientLeadProgress = new Map<number, number>();
    particlesRef.current.forEach((p) => {
      if (p.life <= p.spawnEnd + p.moveDelay) return;
      const moveTotal = p.maxLife - p.spawnEnd - p.moveDelay;
      const moveElapsed = p.life - p.spawnEnd - p.moveDelay;
      const mp = Math.min(moveElapsed / moveTotal, 1);
      const prev = ingredientLeadProgress.get(p.ingredientIdx) ?? 0;
      if (mp > prev) ingredientLeadProgress.set(p.ingredientIdx, mp);
    });

    // ── Advance OD lines ───────────────────────────────────────────────────
    odLinesRef.current.forEach((line) => {
      if (line.done) return;
      if (frame < line.startFrame) return;

      const ingredientIdx = ingredientPoints.findIndex(
        (p) => p.ingredient === line.ingredient
      );
      const leadMp = ingredientLeadProgress.get(ingredientIdx) ?? 0;
      const particlesAlive = particlesRef.current.some(
        (p) => p.ingredientIdx === ingredientIdx
      );

      if (particlesAlive) {
        // Smoothly chase the leading particle; cap at 1 so it never overshoots
        const target = Math.min(leadMp * 1.04, 1);
        line.progress += (target - line.progress) * 0.14;
      } else {
        // All particles dead — glide to completion
        line.progress += (1 - line.progress) * 0.16;
        if (line.progress > 0.995) {
          line.progress = 1;
          line.done = true;
        }
      }

      // Alpha fades in over the first 20 % of progress
      line.alpha = Math.min(line.progress * 5, 1);
    });

    // ── Draw OD lines (drawn before particles so particles sit on top) ─────
    if (map) {
      odLinesRef.current.forEach((line) => {
        if (line.alpha <= 0.01) return;

        const origin = map.project([line.originLng, line.originLat]);
        const target = map.project([dishCenterLng, dishCenterLat]);

        const endX = origin.x + (target.x - origin.x) * line.progress;
        const endY = origin.y + (target.y - origin.y) * line.progress;

        // Dashed line body
        ctx.save();
        ctx.globalAlpha = line.alpha * 0.65;
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]);
        ctx.shadowColor = line.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();

        // Origin dot
        ctx.save();
        ctx.globalAlpha = line.alpha * 0.85;
        ctx.fillStyle = line.color;
        ctx.shadowColor = line.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Leading tip dot (disappears once line is complete)
        if (line.progress < 0.97) {
          ctx.save();
          ctx.globalAlpha = line.alpha * 0.9;
          ctx.fillStyle = line.color;
          ctx.shadowColor = line.color;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(endX, endY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Arrowhead fades in as the line nears completion
        if (line.progress > 0.88) {
          const headAlpha = (line.progress - 0.88) / 0.12;
          const dx = target.x - origin.x;
          const dy = target.y - origin.y;
          const angle = Math.atan2(dy, dx);
          const headLen = 9;
          ctx.save();
          ctx.globalAlpha = line.alpha * headAlpha * 0.9;
          ctx.strokeStyle = line.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
          ctx.shadowColor = line.color;
          ctx.shadowBlur = 6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(
            endX - headLen * Math.cos(angle - Math.PI / 6),
            endY - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(endX, endY);
          ctx.lineTo(
            endX - headLen * Math.cos(angle + Math.PI / 6),
            endY - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // ── Draw & advance particles ───────────────────────────────────────────
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life++;
      const progress = Math.min(p.life / p.maxLife, 1);

      if (map) {
        const curOrigin = map.project([p.lng, p.lat]);
        const curTarget = map.project([dishCenterLng, dishCenterLat]);

        if (p.life === 1) {
          p.spawnX = p.x;
          p.spawnY = p.y;
          p.initX = curOrigin.x;
          p.initY = curOrigin.y;
          p.initTargetX = curTarget.x;
          p.initTargetY = curTarget.y;
        } else {
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

      // Phase 1: Spawn — pulse at origin
      if (p.life <= p.spawnEnd) {
        const sp = p.life / p.spawnEnd;
        const ease = sp < 0.5 ? 2 * sp * sp : -1 + (4 - 2 * sp) * sp;
        p.alpha = ease * 0.95;
        const sizeEase = sp < 0.7 ? ease : 1 - (sp - 0.7) / 0.3;
        p.size = p.baseSize * sizeEase;
        p.x = p.spawnX + Math.sin(p.life * 0.18) * 2;
        p.y = p.spawnY + Math.cos(p.life * 0.13 + 1) * 2;
      }
      // Phase 2a: Waiting (moveDelay)
      else if (p.life < p.spawnEnd + p.moveDelay) {
        p.alpha = Math.min(p.alpha + 0.05, 1);
        p.size = p.baseSize;
        p.x = p.spawnX;
        p.y = p.spawnY;
      }
      // Phase 2b: Flight
      else {
        const moveTotal = p.maxLife - p.spawnEnd - p.moveDelay;
        const moveElapsed = p.life - p.spawnEnd - p.moveDelay;
        const mp = Math.min(moveElapsed / moveTotal, 1);
        const eased =
          mp < 0.5
            ? 4 * mp * mp * mp
            : 1 - Math.pow(-2 * mp + 2, 3) / 2;
        p.x = p.initX + (p.initTargetX - p.initX) * eased;
        p.y = p.initY + (p.initTargetY - p.initY) * eased;
        p.alpha =
          mp < 0.6
            ? 0.75 + 0.25 * (mp / 0.6)
            : 1 - (mp - 0.6) / 0.4;
        p.alpha = Math.max(0, Math.min(1, p.alpha));
      }

      const glowIntensity = Math.max(
        0.01,
        p.life <= p.spawnEnd
          ? 0.55 + 0.45 * Math.sin(p.life * 0.28)
          : 0.4 + 0.35 * Math.max(0, 1 - progress)
      );
      const safeSize = Math.max(0.1, p.size);
      const glowRadius = Math.max(0.1, safeSize * 4 * glowIntensity);

      if (
        !isFinite(p.x) || !isFinite(p.y) ||
        !isFinite(safeSize) || !isFinite(glowRadius)
      ) return true;

      // Glow halo
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.4;
      const glowGrad = ctx.createRadialGradient(
        p.x, p.y, 0, p.x, p.y, glowRadius
      );
      glowGrad.addColorStop(0, p.color + "ee");
      glowGrad.addColorStop(0.3, p.color + "55");
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Core
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10 * glowIntensity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, safeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Highlight
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.8;
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

    // ── 食材原点悬浮检测 ─────────────────────────────────────────────────
    const mousePos = mouseRef.current;
    if (mousePos && map) {
      let found = false;
      for (const origin of ingredientOriginsRef.current) {
        if (!origin) continue;
        const dx = mousePos.x - origin.x;
        const dy = mousePos.y - origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20) {
          setTooltip({
            visible: true,
            x: origin.x,
            y: origin.y,
            name: origin.name,
            ingredient: origin.ingredient,
            color: origin.color,
          });
          found = true;
          break;
        }
      }
      if (!found && tooltip.visible) {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
    } else if (tooltip.visible) {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [
    visible,
    ingredientPoints,
    dishCenterLng,
    dishCenterLat,
    mapRef,
    spawnParticle,
    containerRef,
  ]);

  // Resize observer
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

  // Reset on re-trigger
  useEffect(() => {
    if (visible) {
      particlesRef.current = [];
      odLinesRef.current = [];
      spawnedRef.current = new Set();
      frameRef.current = 0;
      ingredientOriginsRef.current = [];
    }
  }, [visible, ingredientPoints, dishCenterLng, dishCenterLat]);

  // Animation loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // 鼠标事件监听
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = null;
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    const handleClick = (e: MouseEvent) => {
      if (!onIngredientClick) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // 查找点击位置附近的食材原点
      for (const origin of ingredientOriginsRef.current) {
        if (!origin) continue;
        const dx = clickX - origin.x;
        const dy = clickY - origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 25) {
          onIngredientClick(origin.name, origin.ingredient, origin.color);
          break;
        }
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
    };
  }, [onIngredientClick]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "auto",
          cursor: "pointer",
          zIndex: 2,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      />
      {/* 悬浮提示 */}
      {tooltip.visible && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y - 45,
            transform: "translateX(-50%)",
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            backdropFilter: "blur(8px)",
            border: `1.5px solid ${tooltip.color}`,
            borderRadius: 8,
            padding: "8px 14px",
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: `0 4px 20px ${tooltip.color}40, 0 2px 8px rgba(0,0,0,0.4)`,
            minWidth: 120,
          }}
        >
          <div
            style={{
              color: tooltip.color,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            {tooltip.name}
          </div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: 11,
            }}
          >
            {tooltip.ingredient}
          </div>
        </div>
      )}
    </>
  );
}