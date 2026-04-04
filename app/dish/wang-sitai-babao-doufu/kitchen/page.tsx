"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// 食材配置：图层顺序从下到上是 鸡汤、豆腐、香菇、蘑菇、松子、瓜子、鸡肉、火腿
const INGREDIENTS = [
  { id: "chicken-soup", name: "鸡汤", zIndex: 1 },
  { id: "tofu", name: "豆腐", zIndex: 2 },
  { id: "shiitake", name: "香菇", zIndex: 3 },
  { id: "mushroom", name: "蘑菇", zIndex: 4 },
  { id: "pine-nut", name: "松子", zIndex: 5 },
  { id: "watermelon-seed", name: "瓜子", zIndex: 6 },
  { id: "chicken", name: "鸡肉", zIndex: 7 },
  { id: "ham", name: "火腿", zIndex: 8 },
];

// 根据食材ID获取对应的图片路径
const getIngredientImage = (id: string, isAncient: boolean) => {
  const imageMap: Record<string, { ancient: string; modern: string }> = {
    "chicken-soup": {
      ancient: "/images/ancient/pot/古代-鸡汤.png",
      modern: "/images/modern/pot/现代-鸡汤.png",
    },
    "tofu": {
      ancient: "/images/ancient/pot/古代-豆腐.png",
      modern: "/images/modern/pot/现代-豆腐.png",
    },
    "shiitake": {
      ancient: "/images/ancient/pot/古代-香菇.png",
      modern: "/images/modern/pot/现代-香菇.png",
    },
    "mushroom": {
      ancient: "/images/ancient/pot/古代-蘑菇.png",
      modern: "/images/modern/pot/现代-蘑菇.png",
    },
    "pine-nut": {
      ancient: "/images/ancient/pot/古代-松子.png",
      modern: "/images/modern/pot/现代-松子.png",
    },
    "watermelon-seed": {
      ancient: "/images/ancient/pot/古代-瓜子.png",
      modern: "/images/modern/pot/现代-瓜子.png",
    },
    "chicken": {
      ancient: "/images/ancient/pot/古代-鸡肉.png",
      modern: "/images/modern/pot/现代-鸡肉.png",
    },
    "ham": {
      ancient: "/images/ancient/pot/古代-火腿.png",
      modern: "/images/modern/pot/现代-火腿.png",
    },
  };
  const images = imageMap[id] || { ancient: "", modern: "" };
  return isAncient ? images.ancient : images.modern;
};

// 根据ID获取zIndex
const getZIndex = (id: string) => {
  const ingredient = INGREDIENTS.find((i) => i.id === id);
  return ingredient?.zIndex || 1;
};

// 按zIndex排序的食材列表
const sortedIngredients = [...INGREDIENTS].sort((a, b) => a.zIndex - b.zIndex);

const FINAL_ANCIENT = "/images/ancient/pot/古代.png";
const FINAL_MODERN = "/images/modern/pot/现代.png";

/** 与 3306×3306 素材一致的正方形视口；内层圆形 overflow-hidden 防止图层溢出到锅外 */
const POT_VIEWPORT_CLASS =
  "relative w-[min(92vmin,min(46vw,520px))] aspect-square max-w-full shrink-0";

function PotStack({
  isAncient,
  inPotIds,
}: {
  isAncient: boolean;
  inPotIds: string[];
}) {
  const sortedIds = [...inPotIds].sort((a, b) => getZIndex(a) - getZIndex(b));

  return (
    <div className={POT_VIEWPORT_CLASS}>
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-full",
          isAncient
            ? "bg-stone-100/90 ring-[3px] ring-amber-600/40 shadow-xl shadow-amber-900/30"
            : "bg-stone-100/90 ring-[3px] ring-stone-400/40 shadow-xl shadow-black/20"
        )}
      >
        {sortedIds.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
            <p
              className={cn(
                "text-sm font-medium",
                isAncient ? "text-amber-900/80" : "text-stone-700/80"
              )}
            >
              空锅待烹
            </p>
          </div>
        ) : (
          <div className="relative h-full w-full p-[2.5%]">
            {sortedIds.map((id) => (
              <motion.img
                key={`${isAncient ? "a" : "m"}-${id}`}
                src={getIngredientImage(id, isAncient)}
                alt={INGREDIENTS.find((i) => i.id === id)?.name ?? ""}
                className="pointer-events-none absolute inset-0 h-full w-full max-h-full max-w-full select-none object-contain object-center"
                style={{ zIndex: getZIndex(id) }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                draggable={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuiyuanCookingPage() {
  const [inPotIds, setInPotIds] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const leftRailRef = useRef<HTMLDivElement>(null);
  const rightRailRef = useRef<HTMLDivElement>(null);
  const syncScrollLock = useRef(false);

  const handleRailScroll = (source: "left" | "right") => {
    if (syncScrollLock.current) return;
    const left = leftRailRef.current;
    const right = rightRailRef.current;
    if (!left || !right) return;
    const top = source === "left" ? left.scrollTop : right.scrollTop;
    syncScrollLock.current = true;
    if (source === "left") {
      right.scrollTop = top;
    } else {
      left.scrollTop = top;
    }
    requestAnimationFrame(() => {
      syncScrollLock.current = false;
    });
  };

  // 检查是否完成（八宝齐聚）
  useEffect(() => {
    if (inPotIds.length === INGREDIENTS.length && INGREDIENTS.length > 0) {
      setTimeout(() => setIsFinished(true), 1000);
    }
  }, [inPotIds]);

  // 处理拖拽松手 - 添加食材到两个锅
  const handleDragEnd = (ingredientId: string) => {
    if (!inPotIds.includes(ingredientId)) {
      setInPotIds((prev) => [...prev, ingredientId]);
    }
  };

  // 重置
  const handleReset = () => {
    setInPotIds([]);
    setIsFinished(false);
  };

  return (
    <div
      className="relative flex w-full h-screen overflow-hidden"
      style={{
        background: "#fdf6e3",
        backgroundImage: `
          radial-gradient(circle at 20% 20%, rgba(139,90,43,0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(139,90,43,0.06) 0%, transparent 50%),
          repeating-linear-gradient(
            45deg, transparent, transparent 40px,
            rgba(139,90,43,0.018) 40px, rgba(139,90,43,0.018) 41px
          )
        `,
        fontFamily: '"Noto Serif SC", "Source Han Serif CN", serif',
      }}
    >
      {/* 左半部分：古代 */}
      <div className="relative flex-1 h-full border-r border-r-amber-700/20 flex items-center justify-center">
        <h2 className="absolute top-10 left-10 text-amber-900 text-2xl font-serif">古</h2>

        <PotStack isAncient inPotIds={inPotIds} />

        {/* 古代食材陈列 - 与右侧同步滚动 */}
        <div
          ref={leftRailRef}
          onScroll={() => handleRailScroll("left")}
          className="absolute left-4 top-24 bottom-6 flex max-w-[4.5rem] flex-col gap-2 overflow-y-auto z-50
            overscroll-y-contain
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-amber-400/40
            [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          {sortedIngredients.map((item) => {
            const isInPot = inPotIds.includes(item.id);
            return (
              <motion.div
                key={`side-ancient-${item.id}`}
                drag={!isInPot}
                dragSnapToOrigin
                dragElastic={0.5}
                onDragEnd={() => handleDragEnd(item.id)}
                whileHover={!isInPot ? { scale: 1.08 } : {}}
                whileDrag={!isInPot ? { scale: 1.18, zIndex: 100 } : {}}
                className={cn(
                  "h-14 w-14 shrink-0 cursor-grab active:cursor-grabbing rounded-lg border flex items-center justify-center text-center text-[11px] leading-tight font-serif font-medium shadow-md",
                  isInPot
                    ? "opacity-40 border-amber-700/30 bg-amber-100/50 text-amber-800/50"
                    : "border-amber-600/50 bg-amber-50/90 text-amber-900 hover:bg-amber-100/95"
                )}
              >
                {item.name}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 右半部分：现代 */}
      <div className="relative flex-1 h-full flex items-center justify-center">
        <h2 className="absolute top-10 right-10 text-stone-800 text-2xl font-sans">今</h2>

        <PotStack isAncient={false} inPotIds={inPotIds} />

        {/* 现代食材陈列 - 与左侧同步滚动 */}
        <div
          ref={rightRailRef}
          onScroll={() => handleRailScroll("right")}
          className="absolute right-4 top-24 bottom-6 flex max-w-[4.5rem] flex-col gap-2 overflow-y-auto z-50
            overscroll-y-contain
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-stone-400/40
            [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          {sortedIngredients.map((item) => {
            const isInPot = inPotIds.includes(item.id);
            return (
              <motion.div
                key={`side-modern-${item.id}`}
                drag={!isInPot}
                dragSnapToOrigin
                dragElastic={0.5}
                onDragEnd={() => handleDragEnd(item.id)}
                whileHover={!isInPot ? { scale: 1.08 } : {}}
                whileDrag={!isInPot ? { scale: 1.18, zIndex: 100 } : {}}
                className={cn(
                  "h-14 w-14 shrink-0 cursor-grab active:cursor-grabbing rounded-lg border flex items-center justify-center text-center text-[11px] leading-tight font-medium shadow-md",
                  isInPot
                    ? "opacity-40 border-stone-500/30 bg-stone-100/50 text-stone-600/70"
                    : "border-stone-500/45 bg-stone-50/90 text-stone-800 hover:bg-stone-100/95"
                )}
              >
                {item.name}
              </motion.div>
            );
          })}
        </div>

      </div>

      {/* 成品大图覆盖层 */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-amber-950/60 backdrop-blur-sm"
          >
            <div className="text-center">
              <h2 className="text-4xl font-serif text-amber-100 mb-8">王太守八宝豆腐 · 烹饪完成</h2>
              <div className="flex gap-16 justify-center">
                <div className="flex flex-col items-center">
                  <img
                    src={FINAL_ANCIENT}
                    alt="古法成品"
                    className="max-h-[min(55vh,420px)] w-auto max-w-[min(42vw,380px)] object-contain"
                  />
                  <p className="mt-4 text-amber-200 text-xl font-serif">古法还原</p>
                </div>
                <div className="flex flex-col items-center">
                  <img
                    src={FINAL_MODERN}
                    alt="现代成品"
                    className="max-h-[min(55vh,420px)] w-auto max-w-[min(42vw,380px)] object-contain"
                  />
                  <p className="mt-4 text-stone-200 text-xl font-sans">现代转化</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="mt-10 px-8 py-3 bg-amber-700 text-amber-50 rounded-full hover:bg-amber-600 transition-colors text-lg shadow-lg shadow-amber-900/30"
              >
                再次烹饪
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}