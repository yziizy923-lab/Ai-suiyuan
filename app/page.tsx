"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const dishes = [
  { id: 1, name: "蟹粉豆腐", desc: "嫩豆腐佐蟹粉，鲜美无比", emoji: "🦀", angle: 0 },
  { id: 2, name: "白切鸡",   desc: "皮脆肉滑，原汁原味",     emoji: "🍗", angle: 60 },
  { id: 3, name: "松鼠桂鱼", desc: "酥脆金黄，酸甜适中",     emoji: "🐟", angle: 120 },
  { id: 4, name: "东坡肉",   desc: "肥而不腻，入口即化",     emoji: "🥩", angle: 180 },
  { id: 5, name: "芙蓉蛋",   desc: "柔嫩如云，清淡雅致",     emoji: "🥚", angle: 240 },
  { id: 6, name: "鸭羹汤",   desc: "鲜汤慢炖，醇香扑鼻",     emoji: "🍲", angle: 300 },
];

// 椭圆轨道参数
const CX = 260;   // 轨道中心 x（scene 宽 520 的一半）
const CY = 250;   // 轨道中心 y
const RX = 300;   // 水平半径
const RY = 100;    // 垂直半径（透视压缩）

// 菜碟基础尺寸（最大，前景时）
const BASE_SIZE = 76;

function getDishTransform(angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const x = CX + RX * Math.cos(a);
  const y = CY + RY * Math.sin(a);
  // sinA ∈ [-1, 1]，映射到 scale ∈ [0.62, 1.0]
  const sinA = Math.sin(a);
  const scale = 0.62 + 0.38 * ((sinA + 1) / 2);
  // 后方透明度略降
  const opacity = 0.55 + 0.45 * ((sinA + 1) / 2);
  return { x, y, scale, sinA, opacity };
}

export default function Home() {
  const router = useRouter();
  const [activeDish, setActiveDish] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [speechText, setSpeechText] = useState("");
  const [mounted, setMounted] = useState(false);
  const [dialogInput, setDialogInput] = useState("");
  const rafRef = useRef<number | null>(null);
  const rotRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => {
      setSpeaking(true);
      setSpeechText("欢迎来到随园，且听我道来今日佳肴……");
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // rAF 驱动旋转，避免 setInterval 掉帧
  useEffect(() => {
    let last = performance.now();
    function frame(now: number) {
      const dt = now - last;
      last = now;
      rotRef.current = (rotRef.current + dt * 0.018) % 360;
      setRotation(rotRef.current);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const handleDishClick = (dish: (typeof dishes)[0]) => {
    const isDeselecting = dish.id === activeDish;
    setActiveDish(isDeselecting ? null : dish.id);
    setSpeaking(true);
    setSpeechText(
      isDeselecting
        ? "欢迎来到随园，且听我道来今日佳肴……"
        : `此乃${dish.name}，${dish.desc}。`
    );
  };

  const handleDialogSubmit = () => {
    if (!dialogInput.trim()) return;
    router.push(`/chat?query=${encodeURIComponent(dialogInput)}`);
  };

  // 计算每个菜的当前位置，按 sinA 排序实现正确遮挡
  const dishesWithPos = dishes.map((d) => {
    const { x, y, scale, sinA, opacity } = getDishTransform(d.angle + rotation);
    return { ...d, x, y, scale, sinA, opacity };
  });
  // sinA 小（靠后）的先渲染，sinA 大（靠前）的后渲染 → 前景在上
  const sorted = [...dishesWithPos].sort((a, b) => a.sinA - b.sinA);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fdf6e3",
        backgroundImage: `
          radial-gradient(circle at 20% 20%, rgba(139,90,43,0.05) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(139,90,43,0.05) 0%, transparent 50%),
          repeating-linear-gradient(
            45deg, transparent, transparent 40px,
            rgba(139,90,43,0.015) 40px, rgba(139,90,43,0.015) 41px
          )
        `,
        fontFamily: '"Noto Serif SC", "Source Han Serif CN", serif',
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        padding: "40px 0",
      }}
    >
      {/* 四角装饰 */}
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((pos) => (
        <div
          key={pos}
          style={{
            position: "fixed",
            top:    pos.includes("top")    ? 20 : "auto",
            bottom: pos.includes("bottom") ? 20 : "auto",
            left:   pos.includes("left")   ? 20 : "auto",
            right:  pos.includes("right")  ? 20 : "auto",
            width: 60, height: 60,
            borderTop:    pos.includes("top")    ? "2px solid rgba(139,90,43,0.35)" : "none",
            borderBottom: pos.includes("bottom") ? "2px solid rgba(139,90,43,0.35)" : "none",
            borderLeft:   pos.includes("left")   ? "2px solid rgba(139,90,43,0.35)" : "none",
            borderRight:  pos.includes("right")  ? "2px solid rgba(139,90,43,0.35)" : "none",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* 标题 */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 32,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(-20px)",
          transition: "all 0.8s ease",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, 3.2rem)",
            fontWeight: 700,
            color: "#5c2d0a",
            letterSpacing: "0.35em",
            margin: 0,
            textShadow: "0 2px 6px rgba(92,45,10,0.12)",
          }}
        >
          隨園食單
        </h1>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 }}>
          <div style={{ width: 50, height: 1, background: "linear-gradient(to right, transparent, rgba(139,90,43,0.45))" }} />
          <span style={{ fontSize: 12, color: "#8b5a2b", letterSpacing: "0.25em" }}>袁枚　著</span>
          <div style={{ width: 50, height: 1, background: "linear-gradient(to left, transparent, rgba(139,90,43,0.45))" }} />
        </div>
      </div>

      {/* 主舞台 */}
      <div
        style={{
          position: "relative",
          width: 520,
          height: 560,
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease 0.3s",
        }}
      >
        {/* 椭圆轨道线（纯装饰） */}
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
        >
          <ellipse
            cx={CX} cy={CY} rx={RX} ry={RY}
            fill="none"
            stroke="rgba(139,90,43,0.13)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        </svg>

        {/* ---- 后半段菜碟（被袁枚遮挡，sinA < 0） ---- */}
        {sorted
          .filter((d) => d.sinA < 0)
          .map((dish) => (
            <DishNode
              key={dish.id}
              dish={dish}
              isActive={activeDish === dish.id}
              onClick={() => handleDishClick(dish)}
              zIndex={4}
            />
          ))}

        {/* ---- 袁枚本人（中间层） ---- */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 15,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* 气泡 */}
          {speaking && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 14px)",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#fffbf0",
                border: "1px solid rgba(139,90,43,0.28)",
                borderRadius: 14,
                padding: "9px 16px",
                fontSize: 12,
                color: "#5c2d0a",
                maxWidth: 210,
                textAlign: "center",
                lineHeight: 1.7,
                letterSpacing: "0.06em",
                whiteSpace: "normal",
                zIndex: 20,
                animation: "speechIn 0.4s ease",
              }}
            >
              {speechText}
              <div
                style={{
                  position: "absolute",
                  bottom: -7,
                  left: "50%",
                  width: 13, height: 13,
                  background: "#fffbf0",
                  border: "1px solid rgba(139,90,43,0.28)",
                  borderTop: "none",
                  borderLeft: "none",
                  transform: "translateX(-50%) rotate(45deg)",
                }}
              />
            </div>
          )}

          {/* 袁枚图片 */}
          <img
            src="/yuanmei.png"
            alt="袁枚"
            style={{ width: 200, height: 500, objectFit: "contain" }}
          />

          {/* 输入框 */}
          <input
            type="text"
            value={dialogInput}
            onChange={(e) => setDialogInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleDialogSubmit();
              }
            }}
            placeholder="与袁枚聊天..."
            style={{
              background: "rgba(92,45,10,0.85)",
              color: "#fdf6e3",
              fontSize: 11,
              padding: "4px 16px",
              borderRadius: 20,
              letterSpacing: "0.18em",
              marginTop: -6,
              boxShadow: "0 2px 10px rgba(92,45,10,0.25)",
              border: "none",
              outline: "none",
              width: 140,
              textAlign: "center",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* ---- 前半段菜碟（遮挡袁枚，sinA >= 0） ---- */}
        {sorted
          .filter((d) => d.sinA >= 0)
          .map((dish) => (
            <DishNode
              key={dish.id}
              dish={dish}
              isActive={activeDish === dish.id}
              onClick={() => handleDishClick(dish)}
              zIndex={20}
            />
          ))}
      </div>

      {/* 底部提示 */}
      <p
        style={{
          marginTop: 28,
          fontSize: 12,
          color: "rgba(92,45,10,0.42)",
          letterSpacing: "0.22em",
          textAlign: "center",
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease 1s",
        }}
      >
        点击周围菜肴　探寻食谱之道
      </p>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap');
        @keyframes speechIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </main>
  );
}

// ---- 单个菜碟组件 ----
type DishData = {
  id: number;
  name: string;
  desc: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

function DishNode({
  dish,
  isActive,
  onClick,
  zIndex,
}: {
  dish: DishData;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
}) {
  const size = BASE_SIZE * dish.scale;

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: dish.x,
        top: dish.y,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${isActive ? 1.15 : 1})`,
        transition: "transform 0.3s ease",
        cursor: "pointer",
        zIndex,
        opacity: dish.opacity,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: isActive
            ? "radial-gradient(circle at 35% 35%, #fff8e7, #f0d890)"
            : "radial-gradient(circle at 35% 35%, #fffef8, #faecd4)",
          border: `${isActive ? "2.5px" : "1.5px"} solid ${isActive ? "rgba(139,90,43,0.55)" : "rgba(139,90,43,0.22)"}`,
          boxShadow: isActive
            ? "0 6px 22px rgba(92,45,10,0.22), inset 0 2px 4px rgba(255,255,240,0.9)"
            : "0 3px 10px rgba(92,45,10,0.1), inset 0 1px 2px rgba(255,255,240,0.7)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          transition: "all 0.3s ease",
        }}
      >
        <span style={{ fontSize: size * 0.36, lineHeight: 1 }}>{dish.emoji}</span>
        <span
          style={{
            fontSize: Math.max(9, size * 0.14),
            color: "#5c2d0a",
            fontWeight: 600,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          {dish.name}
        </span>
      </div>

      {/* 悬浮说明 */}
      {isActive && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "calc(100% + 10px)",
            transform: "translateX(-50%)",
            background: "rgba(92,45,10,0.88)",
            color: "#fdf6e3",
            fontSize: 11,
            padding: "5px 12px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            letterSpacing: "0.06em",
            boxShadow: "0 3px 10px rgba(0,0,0,0.2)",
            lineHeight: 1.5,
          }}
        >
          {dish.desc}
        </div>
      )}
    </div>
  );
}