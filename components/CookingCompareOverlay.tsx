"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { Soup, Cookie, Sprout, TreePine, Cherry, Drumstick, Ham } from "lucide-react";

export type CookingIngredient = {
  id: string;
  label: string;
  /** Lucide 图标名称 */
  iconName?: string;
};

export type CookingStep = {
  text: string;
  image?: string;
};

const DEFAULT_STEPS: CookingStep[] = [
  { text: "准备食材：鸡胸肉剁成细碎小粒，香菇和口蘑切成细末，火腿切成小丁，所有食材均匀剁碎。",        image: "/images/wts_step/wts_step1.jpg" },
  { text: "准备高汤：浓郁的金黄色鸡汤在炒锅中煨煮，蒸汽袅袅升起，汤汁浓稠香醇。",        image: "/images/wts_step/wts_step2.jpg" },
  { text: "食材入汤：将剁碎的鸡肉、蘑菇、松子、瓜子和火腿加入煨煮的鸡汤中，食材漂浮在金黄色的汤汁里。",        image: "/images/wts_step/wts_step3.jpg" },
  { text: "翻炒至沸腾：所有食材在炒锅中用大火一起煨煮，汤汁剧烈沸腾，蒸汽升腾，食材充分融合。",    image: "/images/wts_step/wts_step4.jpg" },
  { text: "出锅装盘：用勺子将成品舀入碗中，呈现出豆腐脑般嫩滑的质地，表面撒上松子和火腿丁作为点缀。",    image: "/images/wts_step/wts_step5.jpg" },
];

/** 食材 ID → Lucide 图标组件映射 */
const INGREDIENT_ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  soup:     Soup,
  tofu:     Cookie,
  shiitake: TreePine,
  mushroom: Sprout,
  pine:     TreePine,
  melon:    Cherry,
  chicken:  Drumstick,
  ham:      Ham,
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
  steps?: CookingStep[];
  /**
   * inline 模式：直接渲染在父容器内，不使用 createPortal 全屏覆盖。
   * 适合嵌入弹窗右侧面板等场景。
   */
  inline?: boolean;
};

// 内联版本：用于嵌入右侧聊天面板
function CookingCompareInline({
  dishTitle = "王太守八宝豆腐",
  ingredients = DEFAULT_INGREDIENTS,
  steps = DEFAULT_STEPS,
  onClose,
}: Omit<Props, "open" | "inline">) {
  const [inPotIds, setInPotIds] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (inPotIds.length === ingredients.length && ingredients.length > 0) {
      const t = window.setTimeout(() => setFinished(true), 600);
      return () => clearTimeout(t);
    }
  }, [inPotIds, ingredients.length]);

  // 内联模式下用容器 ref 判断是否拖到锅上
  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, id: string) => {
      // 内联模式：检测鼠标是否在古锅或今锅区域
      // 通过 document.elementsFromPoint 判断
      const els = document.elementsFromPoint(info.point.x, info.point.y);
      const overPot = els.some(
        (el) => el.getAttribute("data-pot") === "ancient" || el.getAttribute("data-pot") === "modern"
      );
      if (overPot && !inPotIds.includes(id)) {
        setInPotIds((prev) => [...prev, id]);
      }
    },
    [inPotIds]
  );

  const reset = () => {
    setInPotIds([]);
    setFinished(false);
  };

  const cream = "#f4efe6";
  const bronze = "#c4a574";
  const silver = "#9ca3af";
  const potSize = 200;

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      fontFamily: '"Noto Serif SC", "SimSun", serif',
      background: cream,
      borderRadius: 10,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* 标题栏 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 50px",
        borderBottom: "1px solid rgba(139,90,43,0.12)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: "#5a3b1f", letterSpacing: 3, fontWeight: 600 }}>古今对比</span>
        <span style={{ fontSize: 11, color: "rgba(90,59,31,0.5)", letterSpacing: 1 }}>将食材拖入锅中</span>
      </div>

      {/* 双锅区域 */}
      <div style={{ display: "flex", flex: "0 0 auto", padding: "12px 8px 4px", gap: 8 }}>
        {/* 古 锅 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18, color: "rgba(90,59,31,0.85)", fontWeight: 600, letterSpacing: 4 }}>古</span>
          <div
            data-pot="ancient"
            style={{
              width: potSize,
              height: potSize,
              position: "relative",
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(139,90,43,0.15)",
              border: "3px dashed rgba(139,90,43,0.3)",
              background: "radial-gradient(circle, rgba(139,90,43,0.05) 0%, rgba(244,239,230,0.8) 100%)",
            }}
          >
            {/* 空白圆形 - 不显示锅图，等待食材放入 */}
            {inPotIds.length === 0 && (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(139,90,43,0.25)",
                fontSize: 11,
                letterSpacing: 2,
              }}>
                空盘
              </div>
            )}
            {inPotIds.map((id) => {
              const idx = ingredients.findIndex((i) => i.id === id);
              if (idx < 0) return null;
              return (
                <motion.div
                  key={`ancient-layer-${id}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: `url(${POT_IMAGES[idx][0]}) center/contain no-repeat`,
                    mixBlendMode: "multiply",
                  }}
                />
              );
            })}
            {/* 放入计数 */}
            {inPotIds.length > 0 && (
              <div style={{
                position: "absolute", bottom: 6, right: 6,
                background: "rgba(139,90,43,0.85)",
                color: "#fff", fontSize: 10, borderRadius: 10,
                padding: "1px 6px", letterSpacing: 1,
              }}>
                {inPotIds.length}/{ingredients.length}
              </div>
            )}
          </div>
        </div>

        {/* 今 锅 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18, color: "rgba(55,65,81,0.9)", fontWeight: 600, letterSpacing: 4 }}>今</span>
          <div
            data-pot="modern"
            style={{
              width: potSize,
              height: potSize,
              position: "relative",
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              border: "3px dashed rgba(156,163,175,0.4)",
              background: "radial-gradient(circle, rgba(156,163,175,0.08) 0%, rgba(244,239,230,0.9) 100%)",
            }}
          >
            {/* 空白圆形 - 不显示锅图，等待食材放入 */}
            {inPotIds.length === 0 && (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(156,163,175,0.35)",
                fontSize: 11,
                letterSpacing: 2,
              }}>
                空盘
              </div>
            )}
            {[...inPotIds].sort((a, b) => a === "soup" ? -1 : b === "soup" ? 1 : 0).map((id) => {
              const idx = ingredients.findIndex((i) => i.id === id);
              if (idx < 0) return null;
              return (
                <motion.div
                  key={`modern-layer-${id}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: `url(${POT_IMAGES[idx][1]}) center/contain no-repeat`,
                    mixBlendMode: "normal",
                  }}
                />
              );
            })}
            {inPotIds.length > 0 && (
              <div style={{
                position: "absolute", bottom: 6, right: 6,
                background: "rgba(55,65,81,0.85)",
                color: "#fff", fontSize: 10, borderRadius: 10,
                padding: "1px 6px", letterSpacing: 1,
              }}>
                {inPotIds.length}/{ingredients.length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 食材拖拽区 */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 12px 12px",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignContent: "flex-start",
      }}>
        {ingredients.map((item) => {
          const done = inPotIds.includes(item.id);
          return (
            <motion.div
              key={`inline-${item.id}`}
              drag={!done}
              dragSnapToOrigin
              onDragEnd={(e, info) => handleDragEnd(e, info, item.id)}
              whileHover={!done ? { scale: 1.05 } : {}}
              whileDrag={{ scale: 1.1, zIndex: 999, cursor: "grabbing" }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: done ? "rgba(196,165,116,0.25)" : "rgba(255,255,255,0.85)",
                border: `1px solid ${done ? bronze : "rgba(139,90,43,0.2)"}`,
                fontSize: 12,
                color: done ? "rgba(90,59,31,0.4)" : "#5a3b1f",
                cursor: done ? "default" : "grab",
                opacity: done ? 0.5 : 1,
                pointerEvents: done ? "none" : "auto",
                userSelect: "none",
                boxShadow: done ? "none" : "0 2px 6px rgba(0,0,0,0.05)",
                textDecorationLine: done ? "line-through" : "none",
                textDecorationStyle: "solid",
                textDecorationColor: bronze,
                letterSpacing: 1,
                transition: "opacity 0.2s, background 0.2s",
              }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {(() => {
                    const Icon = INGREDIENT_ICON_MAP[item.id];
                    return Icon ? <Icon size={13} strokeWidth={2} /> : null;
                  })()}
                  <span>{item.label}</span>
                </span>
              </motion.div>
          );
        })}
      </div>

{/* 步骤列表 */}
<div style={{
  flexShrink: 0,
  height: 180,           // ← 固定高度，不再撑大布局
  overflowY: "auto",     // ← 纵向可滚动
  padding: "8px 16px 12px",
  borderTop: "1px solid rgba(139,90,43,0.1)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
}}>
  <div style={{ fontSize: 11, color: "rgba(90,59,31,0.45)", letterSpacing: 2, marginBottom: 2 }}>烹饪步骤</div>
  {/* 图片横排 + 箭头：横向滚动 */}
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 0,
    overflowX: "auto",
    flexShrink: 0,
    paddingBottom: 4,
  }}>
    {steps.map((step, idx) => (
      <div key={idx} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {step.image ? (
            <img
              src={step.image}
              alt={`步骤${idx + 1}`}
              style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1.5px solid rgba(139,90,43,0.15)" }}
            />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 8, background: "rgba(139,90,43,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍽️</div>
          )}
          <span style={{ fontSize: 10, color: "rgba(90,59,31,0.45)", letterSpacing: 1 }}>{idx + 1}</span>
        </div>
        {idx < steps.length - 1 && (
          <span style={{ fontSize: 12, color: "rgba(139,90,43,0.4)", margin: "0 4px", paddingBottom: 14 }}>→</span>
        )}
      </div>
    ))}
  </div>
  {/* 步骤文字：纵向滚动读取 */}
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {steps.map((step, idx) => (
      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ fontSize: 10, color: "rgba(139,90,43,0.6)", fontWeight: 600, minWidth: 16, paddingTop: 1 }}>{idx + 1}.</span>
        <span style={{ fontSize: 11, color: "#5a3b1f", letterSpacing: 0.5, lineHeight: 1.6 }}>{step.text}</span>
      </div>
    ))}
  </div>
</div>
      {/* 完成提示 */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(244,239,230,0.97)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              borderRadius: 10,
              zIndex: 10,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 36 }}>🍲</div>
            <div style={{ fontSize: 15, color: "#5a3b1f", letterSpacing: 4, fontWeight: 600 }}>{dishTitle}</div>
            <div style={{ fontSize: 12, color: "rgba(90,59,31,0.6)", letterSpacing: 2 }}>八宝入釜 · 古今一味</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={reset}
                style={{
                  padding: "7px 18px", borderRadius: 999,
                  border: "none", background: "#8b5a2b",
                  color: "#fff", fontSize: 12, letterSpacing: 2,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                再次烹饪
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "7px 18px", borderRadius: 999,
                  border: "1px solid rgba(139,90,43,0.35)",
                  background: "transparent", color: "#5a3b1f",
                  fontSize: 12, letterSpacing: 2,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                关闭
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 全屏 Portal 版（原有逻辑，保持不变）──────────────────────────────

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
  steps = DEFAULT_STEPS,
  inline = false,
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

  // ── inline 模式：直接渲染，不走 portal ──
  if (inline) {
    if (!open) return null;
    return (
      <CookingCompareInline
        dishTitle={dishTitle}
        ingredients={ingredients}
        steps={steps}
        onClose={onClose}
      />
    );
  }

  // ── portal 全屏模式（原有逻辑）──
  if (!mounted || !open) return null;

  const cream = "#f4efe6";
  const bronze = "#c4a574";
  const silver = "#9ca3af";
  const potSize = Math.min(window.innerWidth * 0.28, 320);

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

            <div
              style={{
                width: potSize,
                height: potSize,
                position: "relative",
                marginBottom: 24,
                borderRadius: "50%",
                overflow: "hidden",
                border: "3px dashed rgba(139,90,43,0.3)",
                background: "radial-gradient(circle, rgba(139,90,43,0.05) 0%, rgba(244,239,230,0.8) 100%)",
              }}
            >
              {/* 空白圆形 - 不显示锅图，等待食材放入 */}
              {inPotIds.length === 0 && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(139,90,43,0.25)",
                  fontSize: 13,
                  letterSpacing: 3,
                  zIndex: 1,
                }}>
                  空盘
                </div>
              )}
              {inPotIds.map((id) => {
                const idx = ingredients.findIndex((i) => i.id === id);
                if (idx < 0) return null;
                return (
                  <motion.div
                    key={`ancient-layer-${id}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background: `url(${POT_IMAGES[idx][0]}) center/contain no-repeat`,
                      mixBlendMode: "multiply",
                    }}
                  />
                );
              })}
            </div>

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
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {(() => {
                    const Icon = INGREDIENT_ICON_MAP[item.id];
                    return Icon ? <Icon size={13} strokeWidth={2} /> : null;
                  })()}
                  <span>{item.label}</span>
                </span>
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

            <div
              style={{
                width: potSize,
                height: potSize,
                position: "relative",
                marginBottom: 24,
                borderRadius: "50%",
                overflow: "hidden",
                border: "3px dashed rgba(156,163,175,0.4)",
                background: "radial-gradient(circle, rgba(156,163,175,0.08) 0%, rgba(244,239,230,0.9) 100%)",
              }}
            >
              {/* 空白圆形 - 不显示锅图，等待食材放入 */}
              {inPotIds.length === 0 && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(156,163,175,0.35)",
                  fontSize: 13,
                  letterSpacing: 3,
                  zIndex: 1,
                }}>
                  空盘
                </div>
              )}
              {[...inPotIds].sort((a, b) => a === "soup" ? -1 : b === "soup" ? 1 : 0).map((id) => {
              const idx = ingredients.findIndex((i) => i.id === id);
              if (idx < 0) return null;
              return (
                <motion.div
                  key={`modern-layer-${id}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background: `url(${POT_IMAGES[idx][1]}) center/contain no-repeat`,
                      mixBlendMode: "normal",
                    }}
                  />
                );
              })}
            </div>

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
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {(() => {
                    const Icon = INGREDIENT_ICON_MAP[item.id];
                    return Icon ? <Icon size={13} strokeWidth={2} /> : null;
                  })()}
                  <span>{item.label}</span>
                </span>
              </motion.div>
                );
              })}
            </div>

{/* 步骤列表 */}
<div style={{
  width: "100%",
  height: 200,           // ← 固定高度
  overflowY: "auto",     // ← 纵向滚动
  padding: "10px 20px 14px",
  borderTop: "1px solid rgba(139,90,43,0.12)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  flexShrink: 0,
}}>
  <div style={{ fontSize: 11, color: "rgba(90,59,31,0.45)", letterSpacing: 2 }}>烹饪步骤</div>
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 0,
    overflowX: "auto",
    flexShrink: 0,
  }}>
    {steps.map((step, idx) => (
      <div key={idx} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {step.image ? (
            <img
              src={step.image}
              alt={`步骤${idx + 1}`}
              style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", border: "1.5px solid rgba(139,90,43,0.15)" }}
            />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 8, background: "rgba(139,90,43,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🍽️</div>
          )}
          <span style={{ fontSize: 11, color: "rgba(90,59,31,0.45)", letterSpacing: 1 }}>{idx + 1}</span>
        </div>
        {idx < steps.length - 1 && (
          <span style={{ fontSize: 14, color: "rgba(139,90,43,0.4)", margin: "0 6px", paddingBottom: 16 }}>→</span>
        )}
      </div>
    ))}
  </div>
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {steps.map((step, idx) => (
      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 11, color: "rgba(139,90,43,0.6)", fontWeight: 600, minWidth: 18, paddingTop: 1 }}>{idx + 1}.</span>
        <span style={{ fontSize: 12, color: "#5a3b1f", letterSpacing: 0.5, lineHeight: 1.7 }}>{step.text}</span>
      </div>
    ))}
    </div>
  </div>
</div>

          {/* 顶栏关闭按钮 */}
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
                    maxWidth: 800,
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