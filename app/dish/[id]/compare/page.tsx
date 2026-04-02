"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";

type Dish = {
  id: number;
  name: string;
  desc: string;
  image: string;
  tags: string[];
  ingredients: string[];
  origin?: string;
  history?: string;
  originalText?: string;
  modernMethod?: string;
};

async function fetchDishFromAPI(id: number): Promise<Dish | null> {
  try {
    const response = await fetch(`/api/dishes/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error("Failed to fetch dish");
    }
    const dish = await response.json();
    return {
      ...dish,
      tags: Array.isArray(dish.tags)
        ? dish.tags
        : parseArrayField(dish.tags),
      ingredients: Array.isArray(dish.ingredients)
        ? dish.ingredients
        : parseArrayField(dish.ingredients),
      image: dish.image || `https://picsum.photos/seed/${dish.id}/800/500`,
    };
  } catch (error) {
    console.error("Failed to fetch dish:", error);
    return null;
  }
}

function parseArrayField(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export default function ComparePage() {
  const router = useRouter();
  const params = useParams();
  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  const dishId = Number(params.id);

  useEffect(() => {
    async function loadDish() {
      setLoading(true);
      const data = await fetchDishFromAPI(dishId);
      setDish(data);
      setLoading(false);
    }
    loadDish();
  }, [dishId]);

  // 全局监听鼠标移动，确保拖动流畅
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // 优先使用滑动条轨道的 ref
      if (sliderTrackRef.current) {
        updateSliderPositionFromTrack(e.clientX);
      } else if (containerRef.current) {
        updateSliderPosition(e.clientX);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging]);

  // 处理滑块拖动 - 使用滑动条轨道
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleSliderTrackMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    if (sliderTrackRef.current) {
      updateSliderPositionFromTrack(e.clientX);
    }
  };

  const updateSliderPosition = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const updateSliderPositionFromTrack = (clientX: number) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>正在加载对比...</p>
      </div>
    );
  }

  if (!dish) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>未找到菜品信息</p>
        <button onClick={() => router.back()} style={styles.backButton}>
          返回
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => router.back()} style={styles.backLink}>
          「 返回详情 」
        </button>
        <h1 style={styles.title}>{dish.name}</h1>
        <div style={styles.headerRight} />
      </div>

      {/* 图片对比容器 */}
      <div style={styles.compareWrapper}>
        <div ref={containerRef} style={styles.compareContainer}>
          {/* 现代层（底层，完整显示） */}
          <div style={styles.imageLayer}>
            <img src="/test2.png" alt="现代" style={styles.image} />
            <div style={styles.labelModern}>
              <span style={styles.labelText}>今</span>
            </div>
          </div>

          {/* 古代层（上层，裁剪显示） */}
          <div
            style={{
              ...styles.imageLayer,
              clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
              zIndex: 2,
            }}
          >
            <img src="/test1.jpg" alt="古代" style={styles.image} />
            <div style={styles.labelAncients}>
              <span style={styles.labelText}>古</span>
            </div>
          </div>
        </div>

        {/* 滑动轴 - 放在图片下方 */}
        <div style={styles.sliderBarContainer}>
          <span style={styles.sliderLabel}>古</span>
          <div
            ref={sliderTrackRef}
            style={styles.sliderTrack}
            onMouseDown={handleSliderTrackMouseDown}
          >
            <div
              style={{
                ...styles.sliderFill,
                width: `${sliderPosition}%`,
              }}
            />
            <div
              style={{
                ...styles.sliderThumb,
                left: `${sliderPosition}%`,
              }}
              onMouseDown={handleMouseDown}
            >
              <span style={styles.thumbArrows}>◀▶</span>
            </div>
          </div>
          <span style={styles.sliderLabel}>今</span>
        </div>
      </div>

      <div style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerItem}>
            <span style={styles.footerLabel}>古代</span>
            <span style={styles.footerValue}>
              {dish.originalText || "袁枚《随园食单》记载"}
            </span>
          </div>
          <div style={styles.footerItem}>
            <span style={styles.footerLabel}>现代</span>
            <span style={styles.footerValue}>
              {dish.modernMethod || "现代烹饪方式"}
            </span>
          </div>
        </div>
        <p style={styles.hint}>← 拖动滑轴查看古今对比 →</p>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    color: "#fff",
    fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 30px",
    background: "rgba(0, 0, 0, 0.3)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  },
  backLink: {
    background: "none",
    border: "none",
    color: "#e8d5b7",
    fontSize: "14px",
    cursor: "pointer",
    padding: "8px 16px",
    borderRadius: "20px",
    transition: "all 0.3s ease",
    fontFamily: "inherit",
  },
  title: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#e8d5b7",
    margin: 0,
    textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
  },
  headerRight: {
    width: "100px",
  },
  compareWrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "40px",
    gap: "30px",
  },
  compareContainer: {
    position: "relative",
    width: "100%",
    maxWidth: "800px",
    aspectRatio: "16 / 10",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
    border: "3px solid rgba(232, 213, 183, 0.3)",
    cursor: "ew-resize",
    userSelect: "none",
  },
  imageLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  labelAncients: {
    position: "absolute",
    top: "15px",
    left: "15px",
    background: "linear-gradient(135deg, #8b4513 0%, #a0522d 100%)",
    padding: "6px 16px",
    borderRadius: "20px",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.3)",
  },
  labelModern: {
    position: "absolute",
    top: "15px",
    right: "15px",
    background: "linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)",
    padding: "6px 16px",
    borderRadius: "20px",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.3)",
  },
  labelText: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    letterSpacing: "2px",
  },
  sliderBarContainer: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    width: "100%",
    maxWidth: "600px",
    padding: "10px 20px",
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: "30px",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(232, 213, 183, 0.2)",
  },
  sliderLabel: {
    color: "#e8d5b7",
    fontSize: "16px",
    fontWeight: "600",
    letterSpacing: "2px",
    minWidth: "30px",
    textAlign: "center",
  },
  sliderTrack: {
    flex: 1,
    height: "12px",
    background: "rgba(255, 255, 255, 0.15)",
    borderRadius: "6px",
    position: "relative",
    cursor: "ew-resize",
    overflow: "visible",
  },
  sliderFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    background: "linear-gradient(90deg, #8b4513 0%, #d4a574 50%, #2e7d32 100%)",
    borderRadius: "6px",
    transition: "width 0s",
  },
  sliderThumb: {
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #e8d5b7 0%, #d4a574 100%)",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3), 0 0 15px rgba(232, 213, 183, 0.3)",
    cursor: "ew-resize",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  thumbArrows: {
    color: "#5d4037",
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "-2px",
  },
  footer: {
    padding: "20px 30px",
    background: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "blur(10px)",
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
  },
  footerContent: {
    display: "flex",
    justifyContent: "space-around",
    gap: "30px",
    marginBottom: "15px",
  },
  footerItem: {
    flex: 1,
    textAlign: "center",
  },
  footerLabel: {
    display: "block",
    fontSize: "14px",
    color: "#e8d5b7",
    marginBottom: "8px",
    fontWeight: "600",
    letterSpacing: "2px",
  },
  footerValue: {
    display: "block",
    fontSize: "13px",
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 1.6,
  },
  hint: {
    textAlign: "center",
    fontSize: "13px",
    color: "rgba(255, 255, 255, 0.5)",
    margin: 0,
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    color: "#fff",
  },
  loadingSpinner: {
    width: "50px",
    height: "50px",
    border: "3px solid rgba(232, 213, 183, 0.2)",
    borderTopColor: "#e8d5b7",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: "20px",
    fontSize: "16px",
    color: "#e8d5b7",
  },
  errorContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    color: "#fff",
  },
  errorText: {
    fontSize: "18px",
    marginBottom: "20px",
  },
  backButton: {
    background: "linear-gradient(135deg, #e8d5b7 0%, #d4a574 100%)",
    color: "#5d4037",
    border: "none",
    padding: "12px 30px",
    borderRadius: "25px",
    fontSize: "14px",
    cursor: "pointer",
    fontWeight: 600,
  },
};