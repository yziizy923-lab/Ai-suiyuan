"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// 辅助函数
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// 1. 食材配置：在这里修改你的图片路径
const INGREDIENTS = [
  {
    id: "tofu",
    name: "豆腐",
    ancientIcon: "/images/ancient/tofu_icon.png",
    modernIcon: "/images/modern/tofu_icon.png",
    ancientInPot: "/images/ancient/tofu_sliced.png", // 锅内状态（切开/平面）
    modernInPot: "/images/modern/tofu_sliced.png",
  },
  {
    id: "ham",
    name: "火腿",
    ancientIcon: "/images/ancient/ham_icon.png",
    modernIcon: "/images/modern/ham_icon.png",
    ancientInPot: "/images/ancient/ham_sliced.png",
    modernInPot: "/images/modern/ham_sliced.png",
  },
  // ... 你可以继续添加其他 6 宝
];

const FINAL_RESULTS = {
  ancient: "/images/ancient/final_dish.png",
  modern: "/images/modern/final_dish.png",
};

export default function SuiyuanCookingPage() {
  const [inPotIds, setInPotIds] = useState<string[]>([]); // 已经在锅里的食材 ID
  const [isFinished, setIsFinished] = useState(false);

  // 检查是否完成（八宝齐聚）
  useEffect(() => {
    if (inPotIds.length === INGREDIENTS.length && INGREDIENTS.length > 0) {
      setTimeout(() => setIsFinished(true), 800);
    }
  }, [inPotIds]);

  // 处理拖拽松手逻辑
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, ingredientId: string) => {
    // 简单的碰撞检测：如果松手位置在屏幕中心区域（锅的位置）
    // 你可以根据实际布局微调这个阈值
    const isOverPot = info.point.x > window.innerWidth / 2 - 100 && 
                     info.point.x < window.innerWidth / 2 + 100;

    if (isOverPot && !inPotIds.includes(ingredientId)) {
      setInPotIds((prev) => [...prev, ingredientId]);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 flex">
      
      {/* 1. 左半部分：古代 */}
      <div className="relative flex-1 h-full border-r border-white/10 bg-[url('/images/ancient_bg.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-blue-900/20 backdrop-blur-sm" /> {/* 遮罩层 */}
        
        <h2 className="absolute top-10 left-10 text-amber-200 text-2xl font-serif">随园古境</h2>
        
        {/* 古代桌子与锅 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-96 h-96">
            <img src="/images/ancient/table.png" alt="古桌" className="absolute inset-0 object-contain" />
            <img src="/images/ancient/pot.png" alt="古锅" className="absolute inset-0 object-contain z-10" />
            
            {/* 古代锅内食材分布 */}
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              {inPotIds.map((id, index) => {
                const item = INGREDIENTS.find(i => i.id === id);
                if (!item) return null;
                return (
                  <motion.img
                    key={`ancient-${id}`}
                    initial={{ opacity: 0, scale: 0.5, y: -50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    src={item.ancientInPot}
                    className="absolute w-24 h-24 object-contain"
                    style={{ rotate: index * 45 }} // 让食材错开排布
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* 古代食材陈列 (镜像感应，不可直接拖拽) */}
        <div className="absolute left-6 top-1/4 flex flex-col gap-4">
          {INGREDIENTS.map((item) => (
            <div key={`side-ancient-${item.id}`} className="relative w-16 h-16 grayscale opacity-50">
              <img src={item.ancientIcon} className="w-full h-full object-contain" />
              {inPotIds.includes(item.id) && (
                <motion.div layoutId={`fly-ancient-${item.id}`} className="absolute inset-0 bg-amber-500/20 rounded-full" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. 右半部分：现代 */}
      <div className="relative flex-1 h-full bg-[url('/images/modern_bg.jpg')] bg-cover bg-center">
        <h2 className="absolute top-10 right-10 text-white text-2xl font-sans">现代实验室</h2>
        
        {/* 现代桌子与锅 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-96 h-96">
            <img src="/images/modern/table.png" alt="现代桌" className="absolute inset-0 object-contain" />
            <img src="/images/modern/pot.png" alt="现代锅" className="absolute inset-0 object-contain z-10" />
            
            {/* 现代锅内食材分布 */}
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              {inPotIds.map((id, index) => {
                const item = INGREDIENTS.find(i => i.id === id);
                if (!item) return null;
                return (
                  <motion.img
                    key={`modern-${id}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={item.modernInPot}
                    className="absolute w-24 h-24 object-contain"
                    style={{ x: (index % 3 - 1) * 30, y: (Math.floor(index / 3) - 1) * 30 }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* 现代食材陈列 (可拖拽源) */}
        <div className="absolute right-6 top-1/4 flex flex-col gap-4 z-50">
          {INGREDIENTS.map((item) => (
            <motion.div
              key={`side-modern-${item.id}`}
              drag
              dragSnapToOrigin
              onDragEnd={(e, info) => handleDragEnd(e, info, item.id)}
              whileHover={{ scale: 1.1 }}
              whileDrag={{ scale: 1.2, zIndex: 100 }}
              className={cn(
                "w-16 h-16 cursor-grab active:cursor-grabbing bg-white/10 rounded-xl p-2 backdrop-blur-md border border-white/20",
                inPotIds.includes(item.id) && "opacity-20 pointer-events-none"
              )}
            >
              <img src={item.modernIcon} className="w-full h-full object-contain" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* 3. 成品大图覆盖层 */}
      <AnimatePresence>
        {isFinished && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[100] flex"
          >
            <div className="flex-1 h-full bg-black/80 flex flex-col items-center justify-center p-10">
              <motion.img 
                initial={{ y: 50 }} animate={{ y: 0 }}
                src={FINAL_RESULTS.ancient} 
                className="max-w-full max-h-[70%] object-contain shadow-2xl shadow-amber-900/50" 
              />
              <h3 className="mt-8 text-amber-200 text-3xl font-serif">王太守八宝豆腐 · 古法还原</h3>
            </div>
            <div className="flex-1 h-full bg-black/80 flex flex-col items-center justify-center p-10 border-l border-white/20">
              <motion.img 
                initial={{ y: 50 }} animate={{ y: 0 }}
                src={FINAL_RESULTS.modern} 
                className="max-w-full max-h-[70%] object-contain shadow-2xl shadow-blue-900/50" 
              />
              <h3 className="mt-8 text-white text-3xl font-sans">王太守八宝豆腐 · 现代转化</h3>
              <button 
                onClick={() => {setInPotIds([]); setIsFinished(false);}}
                className="mt-10 px-6 py-2 bg-white text-black rounded-full hover:bg-amber-200 transition-colors"
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