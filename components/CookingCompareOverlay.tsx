"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";

export type CookingIngredient = {
  id: string;
  label: string;
};

const ANCIENT_IMG_DIR = "/images/ancient/pot";
const MODERN_IMG_DIR = "/images/modern/pot";

/** 每种食材对应古/今两张锅图，顺序按 DEFAULT_INGREDIENTS 排列 */
const POT_IMAGES: [string, string][] = [
  [`${ANCIENT_IMG_DIR}/古代-鸡汤.png`,  `${MODERN_IMG_DIR}/现代-鸡汤.png` ],
  [`${ANCIENT_IMG_DIR}/古代-豆腐.png`,  `${MODERN_IMG_DIR}/现代-豆腐.png` ],
  [`${ANCIENT_IMG_DIR}/古代-香菇.png`,  `${MODERN_IMG_DIR}/现代-香菇.png` ],
  [`${ANCIENT_IMG_DIR}/古代-蘑菇.png`,  `${MODERN_IMG_DIR}/现代-蘑菇.png` ],
  [`${ANCIENT_IMG_DIR}/古代-松子.png`,  `${MODERN_IMG_DIR}/现代-松子.png` ],
  [`${ANCIENT_IMG_DIR}/古代-瓜子.png`,  `${MODERN_IMG_DIR}/现代-瓜子.png` ],
  [`${ANCIENT_IMG_DIR}/古代-鸡肉.png`,  `${MODERN_IMG_DIR}/现代-鸡肉.png` ],
  [`${ANCIENT_IMG_DIR}/古代-火腿.png`,  `${MODERN_IMG_DIR}/现代-火腿.png` ],
];

const DEFAULT_INGREDIENTS: CookingIngredient[] = [
  { id: "soup",    label: "鸡汤"  },
  { id: "tofu",    label: "豆腐"  },
  { id: "shiitake",label: "香菇"  },
  { id: "mushroom",label: "鲜菇"  },
  { id: "pine",    label: "松子"  },
  { id: "melon",   label: "瓜子"  },
  { id: "chicken", label: "鸡肉"  },
  { id: "ham",     label: "火腿"  },
];

type Props = {
  open: boolean;
  onClose: () => void;
  dishTitle?: string;
  ingredients?: CookingIngredient[];
};

function isOverEitherPot(clientX: number, clientY: number): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const lx = w * 0.25;
  const rx = w * 0.75;
  const cy = h * 0.52;
  const r = Math.min(w, h) * 0.18;
  const dL = Math.hypot(clientX - lx, clientY - cy);
  const dR = Math.hypot(clientX - rx, clientY - cy);
  return dL < r || dR < r;
}

export default function CookingCompareOverlay({
  open,
  onClose,
  dishTitle = "王太守八宝豆腐",
  ingredients = DEFAULT_INGREDIENTS,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [inPotIds, setInPotIds] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setInPotIds([]);
      setFinished(false);
    }
  }, [open]);

  useEffect(() => {
    if (inPotIds.length === ingredients.length && ingredients.length > 0) {
      const t = window.setTimeout(() => setFinished(true), 600);
      return () => clearTimeout(t);
    }
  }, [inPotIds, ingredients.length]);

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, id: string) => {
      const { x, y } = info.point;
      if (isOverEitherPot(x, y) && !inPotIds.includes(id)) {
        setInPotIds((prev) => [...prev, id]);
      }
    },
    [inPotIds]
  );

  const reset = () => {
    setInPotIds([]);
    setFinished(false);
  };

  if (!mounted || !open) return null;

  const cream = "#f4efe6";
  const bronze = "#c4a574";
  const silver = "#9ca3af";

  const potSize = Math.min(window.innerWidth * 0.22, 280);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="cooking-compare-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483646,
            display: "flex",
            background: cream,
            fontFamily: '"Noto Serif SC", "SimSun", serif',
            boxShadow: "inset 0 0 120px rgba(139,90,43,0.06)",
          }}
        >
          {/* 左：古 */}
          <div
            style={{
              flex: 1,
              position: "relative",
              borderRight: "1px solid rgba(139,90,43,0.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 28,
                left: 32,
                fontSize: 42,
                color: "rgba(90,59,31,0.85)",
                fontWeight: 600,
                letterSpacing: 8,
              }}
            >
              古
            </span>

            {/* 锅：叠图 — 每放入一个食材就盖上一层对应图片 */}
            <div
              style={{
                width: potSize,
                height: potSize,
                position: "relative",
                marginBottom: 24,
              }}
            >
              {/* 底锅 */}
              <img
                src={`${ANCIENT_IMG_DIR}/古代.png`}
                alt="古代锅"
                style={{ width: "100%", height: "100%", position: "absolute", inset: 0, borderRadius: "50%" }}
              />
              {/* 叠图 */}
              {inPotIds.map((id) => {
                const idx = ingredients.findIndex((i) => i.id === id);
                if (idx < 0) return null;
                const [src] = POT_IMAGES[idx];
                return (
                  <img
                    key={`ancient-layer-${id}`}
                    src={src}
                    alt={ingredients[idx].label}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      mixBlendMode: "multiply",
                    }}
                  />
                );
              })}
            </div>

            {/* 左侧可拖拽食材 */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                maxWidth: potSize + 40,
                justifyContent: "center",
              }}
            >
              {ingredients.map((item) => {
                const done = inPotIds.includes(item.id);
                return (
                  <motion.div
                    key={`g-${item.id}`}
                    drag={!done}
                    dragSnapToOrigin
                    onDragEnd={(e, info) => handleDragEnd(e, info, item.id)}
                    whileHover={!done ? { scale: 1.03 } : {}}
                    whileDrag={{ scale: 1.08, zIndex: 100, cursor: "grabbing" }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: done ? "rgba(196,165,116,0.35)" : "rgba(255,255,255,0.65)",
                      border: `1px solid ${done ? bronze : "rgba(139,90,43,0.2)"}`,
                      fontSize: 13,
                      color: done ? "#5a3b1f" : "rgba(90,59,31,0.45)",
                      boxShadow: done ? "none" : "0 2px 8px rgba(0,0,0,0.04)",
                      minWidth: 72,
                      textAlign: "center",
                      cursor: done ? "default" : "grab",
                      opacity: done ? 0.45 : 1,
                      pointerEvents: done ? "none" : "auto",
                    }}
                  >
                    {item.label}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* 右：今 */}
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 28,
                right: 32,
                fontSize: 42,
                color: "rgba(55,65,81,0.9)",
                fontWeight: 600,
                letterSpacing: 8,
              }}
            >
              今
            </span>

            {/* 锅：叠图 */}
            <div
              style={{
                width: potSize,
                height: potSize,
                position: "relative",
                marginBottom: 24,
              }}
            >
              <img
                src={`${MODERN_IMG_DIR}/现代.png`}
                alt="现代锅"
                style={{ width: "100%", height: "100%", position: "absolute", inset: 0, borderRadius: "50%" }}
              />
              {inPotIds.map((id) => {
                const idx = ingredients.findIndex((i) => i.id === id);
                if (idx < 0) return null;
                const [, src] = POT_IMAGES[idx];
                return (
                  <img
                    key={`modern-layer-${id}`}
                    src={src}
                    alt={ingredients[idx].label}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      mixBlendMode: "multiply",
                    }}
                  />
                );
              })}
            </div>

            {/* 右侧可拖拽食材 */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                maxWidth: potSize + 40,
                justifyContent: "center",
              }}
            >
              {ingredients.map((item) => {
                const done = inPotIds.includes(item.id);
                return (
                  <motion.div
                    key={`j-${item.id}`}
                    drag={!done}
                    dragSnapToOrigin
                    onDragEnd={(e, info) => handleDragEnd(e, info, item.id)}
                    whileHover={!done ? { scale: 1.03 } : {}}
                    whileDrag={{ scale: 1.08, zIndex: 100, cursor: "grabbing" }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: done ? "rgba(243,244,246,0.8)" : "rgba(255,255,255,0.92)",
                      border: `1px solid ${done ? silver : "rgba(156,163,175,0.45)"}`,
                      fontSize: 13,
                      color: done ? "rgba(107,114,128,0.6)" : "#374151",
                      boxShadow: done ? "none" : "0 4px 14px rgba(0,0,0,0.08)",
                      minWidth: 72,
                      textAlign: "center",
                      cursor: done ? "default" : "grab",
                      opacity: done ? 0.45 : 1,
                      pointerEvents: done ? "none" : "auto",
                    }}
                  >
                    {item.label}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* 顶栏 */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "fixed",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2147483647,
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid rgba(139,90,43,0.25)",
              background: "rgba(255,252,245,0.95)",
              color: "#5a3b1f",
              fontSize: 13,
              letterSpacing: 3,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            关闭古今烹饪
          </button>

          <AnimatePresence>
            {finished && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 2147483647,
                  display: "flex",
                  background: "rgba(45,38,32,0.88)",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <motion.div
                  initial={{ scale: 0.92, y: 24 }}
                  animate={{ scale: 1, y: 0 }}
                  style={{
                    maxWidth: 520,
                    width: "100%",
                    background: cream,
                    borderRadius: 16,
                    padding: "36px 28px",
                    textAlign: "center",
                    border: "1px solid rgba(139,90,43,0.2)",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🍲</div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 22, color: "#5a3b1f", letterSpacing: 4 }}>
                    {dishTitle}
                  </h3>
                  <p style={{ margin: "0 0 24px", fontSize: 14, color: "rgba(90,59,31,0.65)", letterSpacing: 2 }}>
                    八宝入釜 · 古今一味
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    style={{
                      padding: "10px 28px",
                      borderRadius: 999,
                      border: "none",
                      background: "#8b5a2b",
                      color: "#fff",
                      fontSize: 14,
                      letterSpacing: 2,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      marginRight: 12,
                    }}
                  >
                    再次烹饪
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: "10px 28px",
                      borderRadius: 999,
                      border: "1px solid rgba(139,90,43,0.35)",
                      background: "transparent",
                      color: "#5a3b1f",
                      fontSize: 14,
                      letterSpacing: 2,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    返回
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
