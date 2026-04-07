"use client";

import { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import ParticleCanvas, { type IngredientPoint } from "./ParticleCanvas";
import FlavorDiffusionCanvas, { type FlavorIngredientData } from "./FlavorDiffusionCanvas";
import CookingCompareOverlay from "./CookingCompareOverlay";

type Dish = {
  id: number;
  name: string;
  desc: string;
  image: string;
  tags: string[];
  ingredients: string[];
  origin?: string;
  originCoords?: [number, number];
  history?: string;
  originalText?: string;
  modernMethod?: string;
  // 菜品位置数据
  dish_location?: {
    name: string;
    origin: string;
    longitude: number;
    latitude: number;
    note: string;
  };
  // 食材分布数据（可选，来自 wang_sitai_babao_doufu.json 格式）
  ingredients_distribution?: Array<{
    ingredient: string;
    category: string;
    distribution_locations: Array<{
      name: string;
      longitude: number;
      latitude: number;
      note: string;
    }>;
  }>;
};

type CookingStep = {
  step: number;
  title: string;
  desc: string;
  imageBase64?: string;
};

type Message = {
  role: "user" | "ai" | "legend" | "flavor-legend";
  content: string;
  legendItems?: { ingredient: string; color: string; icon: string; desc: string }[];
  flavorLegendItems?: { flavor: string; color: string; icon: string; desc: string; shape: string }[];
};
type ViewMode = "ingredients" | "flavor" | "compare" | "culture" | "geo-cause" | null;

interface DishDetailModalProps {
  dish: Dish;
  onClose: () => void;
}

// 食材颜色映射 - 基于食材类别
const INGREDIENT_COLORS: Record<string, string> = {
  "鸡肉": "#FF6B6B",
  "鸡汤": "#FFB347",
  "香菇": "#D4A574",
  "蘑菇": "#C8A882",
  "松子仁": "#8B7355",
  "瓜子仁": "#C9B037",
  "火腿": "#E84545",
  "豆腐脑": "#FFFACD",
  "default": "#8b5a2b",
};

// 食材图标映射
const INGREDIENT_ICONS: Record<string, string> = {
  "鸡肉": "🐔",
  "鸡汤": "🍲",
  "香菇": "🍄",
  "蘑菇": "🍄",
  "松子仁": "🌲",
  "瓜子仁": "🌻",
  "火腿": "🥓",
  "豆腐脑": "🧈",
  "default": "🥬",
};

// 获取食材对应的描述
const INGREDIENT_DESC: Record<string, string> = {
  "鸡肉": "肉质鲜嫩，富含蛋白质",
  "鸡汤": "滋补养身，味道鲜美",
  "香菇": "香气浓郁，提升鲜味",
  "蘑菇": "口感细腻，菌香四溢",
  "松子仁": "香脆可口，富含油脂",
  "瓜子仁": "清香开胃，营养丰富",
  "火腿": "咸香醇厚，增添风味",
  "豆腐脑": "细腻柔滑，入口即化",
  "default": "重要食材",
};

// 风味颜色映射
const FLAVOR_COLORS: Record<string, string> = {
  "酸": "#E74C3C",
  "甜": "#F39C12",
  "苦": "#8E44AD",
  "辣": "#C0392B",
  "咸": "#2980B9",
  "鲜": "#27AE60",
};

// 风味图标映射
const FLAVOR_ICONS: Record<string, string> = {
  "酸": "⭐",
  "甜": "💫",
  "苦": "🌙",
  "辣": "🔥",
  "咸": "💧",
  "鲜": "✨",
};

// 风味描述映射
const FLAVOR_DESC: Record<string, string> = {
  "酸": "开胃解腻，刺激味蕾",
  "甜": "愉悦心情，温和甘美",
  "苦": "清热降火，回味悠长",
  "辣": "驱寒暖身，刺激食欲",
  "咸": "提鲜入味，基础底味",
  "鲜": "自然鲜美，回味无穷",
};

// 风味形状映射 - 对应 FlavorDiffusionCanvas 中的形状
const FLAVOR_SHAPES: Record<string, string> = {
  "酸": "星形",
  "甜": "圆形",
  "苦": "波浪形",
  "辣": "火焰形",
  "咸": "方形",
  "鲜": "水滴形",
};

// 从坐标点提取唯一的食材颜色信息
function extractIngredientLegend(points: IngredientPoint[]): { ingredient: string; color: string; icon: string; desc: string }[] {
  const seen = new Set<string>();
  const legend: { ingredient: string; color: string; icon: string; desc: string }[] = [];

  for (const pt of points) {
    if (!seen.has(pt.ingredient)) {
      seen.add(pt.ingredient);
      legend.push({
        ingredient: pt.ingredient,
        color: pt.color,
        icon: INGREDIENT_ICONS[pt.ingredient] || INGREDIENT_ICONS.default,
        desc: INGREDIENT_DESC[pt.ingredient] || INGREDIENT_DESC.default,
      });
    }
  }

  return legend;
}

// 从风味数据提取唯一的风味信息
function extractFlavorLegend(flavorData: FlavorIngredientData[]): { flavor: string; color: string; icon: string; desc: string; shape: string }[] {
  const seen = new Set<string>();
  const legend: { flavor: string; color: string; icon: string; desc: string; shape: string }[] = [];

  for (const item of flavorData) {
    if (!seen.has(item.flavor)) {
      seen.add(item.flavor);
      legend.push({
        flavor: item.flavor,
        color: FLAVOR_COLORS[item.flavor] || "#8b5a2b",
        icon: FLAVOR_ICONS[item.flavor] || "🍽️",
        desc: FLAVOR_DESC[item.flavor] || "独特风味",
        shape: FLAVOR_SHAPES[item.flavor] || "圆形",
      });
    }
  }

  return legend;
}

// 根据菜品数据生成食材坐标点
function generateIngredientPoints(dish: Dish): IngredientPoint[] {
  const points: IngredientPoint[] = [];

  console.log('[generateIngredientPoints] dish.name:', dish.name);
  console.log('[generateIngredientPoints] dish.ingredients_distribution:', !!dish.ingredients_distribution);
  if (dish.ingredients_distribution) {
    console.log('[generateIngredientPoints] ingredients count:', dish.ingredients_distribution.length);
  }

  // 如果有精确的食材分布数据
  if (dish.ingredients_distribution) {
    for (const ing of dish.ingredients_distribution) {
      const color = INGREDIENT_COLORS[ing.ingredient] || INGREDIENT_COLORS.default;
      console.log('[generateIngredientPoints] Processing ingredient:', ing.ingredient, 'locations:', ing.distribution_locations.length);
      for (const loc of ing.distribution_locations) {
        points.push({
          lng: loc.longitude,
          lat: loc.latitude,
          name: loc.name,
          ingredient: ing.ingredient,
          color,
        });
      }
    }
  }

  console.log('[generateIngredientPoints] Total points generated:', points.length);
  return points;
}

// 获取菜品中心坐标
function getDishCenterCoords(dish: Dish): { lng: number; lat: number } {
  if (dish.dish_location) {
    return { lng: dish.dish_location.longitude, lat: dish.dish_location.latitude };
  }
  if (dish.originCoords) {
    return { lng: dish.originCoords[0], lat: dish.originCoords[1] };
  }
  return { lng: 108, lat: 34 };
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

async function callAI(question: string, dishName: string, originalText: string, modernMethod: string): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, dishName, originalText, modernMethod }),
    });
    const data = await res.json();
    return data.content || "抱歉，暂无相关内容。";
  } catch {
    return "网络异常，请稍后重试。";
  }
}

const RECOMMENDED_QUESTIONS: { id: ViewMode; label: string; icon: string; defaultQuestion: string; hasParticle?: boolean; hasFlavor?: boolean }[] = [
  { id: "ingredients", label: "食材产地", icon: "🗺️", defaultQuestion: "请介绍这道菜的食材产地分布", hasParticle: true },
  { id: "flavor",      label: "风味分析", icon: "✨", defaultQuestion: "请分析这道菜的风味特征", hasFlavor: true },
  { id: "compare",     label: "古今对比", icon: "🍳", defaultQuestion: "请对比古代做法与现代做法的异同" },
  { id: "culture",     label: "文化故事", icon: "📜", defaultQuestion: "请讲述这道菜的文化故事与传承" },
  { id: "geo-cause",   label: "地理成因", icon: "🌍", defaultQuestion: "请分析食材与地理成因的关系" },
];

export default function DishDetailModal({ dish, onClose }: DishDetailModalProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showCookingSteps, setShowCookingSteps] = useState(false);
  const [cookingSteps, setCookingSteps] = useState<CookingStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Chat state - 初始不选中任何按钮
  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** 古今对比：全屏拖拽烹饪演示（覆盖地图与弹窗） */
  const [cookingCompareOpen, setCookingCompareOpen] = useState(false);

  // 粒子动画状态 - 根据 viewMode 控制显示
  const [particleVisible, setParticleVisible] = useState(false);
  const [ingredientPoints, setIngredientPoints] = useState<IngredientPoint[]>([]);
  // 风味扩散动画状态
  const [flavorVisible, setFlavorVisible] = useState(false);
  const [flavorData, setFlavorData] = useState<FlavorIngredientData[]>([]);
  // 存储从 API 获取的菜品详细数据（包含 dish_location 和 ingredients_distribution）
  const [dishExtraData, setDishExtraData] = useState<{
    dish_location?: Dish['dish_location'];
    ingredients_distribution?: Dish['ingredients_distribution'];
  } | null>(null);

  // 合并菜品数据：优先使用 API 返回的数据，其次使用传入的 dish 数据
  const dishCenter = dishExtraData?.dish_location
    ? { lng: dishExtraData.dish_location.longitude, lat: dishExtraData.dish_location.latitude }
    : getDishCenterCoords(dish);

  // 加载食材分布数据并生成坐标点
  useEffect(() => {
    async function loadIngredientData() {
      if (!dish?.name) return;

      try {
        // 从 API 获取食材分布数据
        const res = await fetch(`/api/dish-detail?name=${encodeURIComponent(dish.name)}`);
        const result = await res.json();

        if (result.success && result.data) {
          // 存储 API 返回的数据
          setDishExtraData({
            dish_location: result.data.dish_location,
            ingredients_distribution: result.data.ingredients_distribution,
          });
          // 使用 API 返回的数据生成坐标点
          const points = generateIngredientPoints({
            ...dish,
            ingredients_distribution: result.data.ingredients_distribution,
            dish_location: result.data.dish_location,
          });
          setIngredientPoints(points);
        } else {
          // 如果没有精确数据，使用菜品自身的食材数据
          const points = generateIngredientPoints(dish);
          setIngredientPoints(points);
        }
      } catch (error) {
        console.error('Failed to load ingredient distribution:', error);
        const points = generateIngredientPoints(dish);
        setIngredientPoints(points);
      }
    }

    loadIngredientData();
  }, [dish]);

  // 加载风味数据
  useEffect(() => {
    async function loadFlavorData() {
      if (!dish?.name) return;

      try {
        const res = await fetch(`/api/dish-flavor?name=${encodeURIComponent(dish.name)}`);
        const result = await res.json();

        if (result.success && result.data) {
          setFlavorData(result.data);
        }
      } catch (error) {
        console.error('Failed to load flavor data:', error);
      }
    }

    loadFlavorData();
  }, [dish]);

  // 当 viewMode 变化时控制动画显示
  useEffect(() => {
    console.log('[DishDetail] viewMode changed to:', viewMode);
    console.log('[DishDetail] ingredientPoints count:', ingredientPoints.length);
    console.log('[DishDetail] dishCenter:', dishCenter);

    if (viewMode === "ingredients" && ingredientPoints.length > 0) {
      setParticleVisible(true);
      setFlavorVisible(false);
    } else if (viewMode === "flavor" && flavorData.length > 0) {
      setFlavorVisible(true);
      setParticleVisible(false);
    } else {
      setParticleVisible(false);
      setFlavorVisible(false);
    }
  }, [viewMode, ingredientPoints.length, flavorData.length]);

  // 当 ingredientPoints 更新且 viewMode 是 "ingredients" 时，确保粒子显示
  useEffect(() => {
    if (viewMode === "ingredients" && ingredientPoints.length > 0) {
      console.log('[DishDetail] ingredientPoints loaded, showing particles');
      setParticleVisible(true);
    }
  }, [ingredientPoints, viewMode]);

  // 当 flavorData 更新且 viewMode 是 "flavor" 时，确保风味动画显示
  useEffect(() => {
    if (viewMode === "flavor" && flavorData.length > 0) {
      console.log('[DishDetail] flavorData loaded, showing flavor diffusion');
      setFlavorVisible(true);
    }
  }, [flavorData, viewMode]);

  // 粒子动画触发（保留备用，现在由 viewMode 控制）
  const triggerParticleAnimation = () => {
    setParticleVisible(true);
  };

  // 风味动画触发
  const triggerFlavorAnimation = () => {
    setFlavorVisible(true);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Init Mapbox - 改为可交互
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!accessToken) return;

    console.log('[DishDetail] Initializing map...');

    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/light-v11",
      center: [dishCenter.lng, dishCenter.lat],
      zoom: 5,
      interactive: true,  // 允许拖动和缩放
      attributionControl: false,
      projection: "mercator",
    });

    map.on("load", () => {
      console.log('[DishDetail] Map loaded');
      map.getStyle()?.layers?.forEach((layer) => {
        if (layer.layout && ("text-field" in layer.layout)) {
          map.setLayoutProperty(layer.id, "text-field", ["get", "name_zh-Hans"]);
        }
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", "#e8dcc8");
        }
      });

      // 添加菜品位置标记
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="width:20px;height:20px;background:linear-gradient(135deg,#d44444,#a83232);
          border:3px solid rgba(255,255,255,0.9);border-radius:50%;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`;
      new mapboxgl.Marker({ element: el })
        .setLngLat([dishCenter.lng, dishCenter.lat])
        .addTo(map);
      map.flyTo({ center: [dishCenter.lng, dishCenter.lat], zoom: 5, duration: 2000 });
    });

    mapRef.current = map;
    console.log('[DishDetail] mapRef.current set:', !!mapRef.current);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);  // 只初始化一次

  // 当 API 数据加载完成后，平滑飞到正确的菜品位置
  useEffect(() => {
    if (!dishExtraData?.dish_location || !mapRef.current) return;

    const map = mapRef.current;
    const { longitude, latitude } = dishExtraData.dish_location;

    console.log('[DishDetail] Flying to dish location:', longitude, latitude);

    // 地图加载完成后飞到正确位置
    if (map.isStyleLoaded()) {
      map.flyTo({ center: [longitude, latitude], zoom: 5, duration: 1500 });
    } else {
      map.once("load", () => {
        map.flyTo({ center: [longitude, latitude], zoom: 5, duration: 1500 });
      });
    }
  }, [dishExtraData?.dish_location]);

  // Generate image
  useEffect(() => {
    if (!dish) return;
    const generateImage = async () => {
      setIsGeneratingImage(true);
      setImageError(null);
      try {
        const response = await fetch("/api/generate-dish-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dish: dish.name, desc: dish.desc || "", ancient: dish.history || "" }),
        });
        const data = await response.json();
        if (data.success && data.imageUrl) {
          setImageUrl(data.imageUrl);
        } else {
          setImageError(data.error || "生成失败");
        }
      } catch {
        setImageError("网络错误");
      } finally {
        setIsGeneratingImage(false);
      }
    };
    generateImage();
  }, [dish]);

  // Load cooking steps
  const loadCookingSteps = async () => {
    setLoadingSteps(true);
    try {
      const stepsRes = await fetch(
        `/api/cooking-steps?dish=${encodeURIComponent(dish.name)}&desc=${encodeURIComponent(dish.desc)}&ingredients=${encodeURIComponent(dish.ingredients.join(","))}`
      );
      const stepsData = await stepsRes.json();
      if (stepsData.success && stepsData.steps) {
        setCookingSteps(stepsData.steps);
        setCurrentStep(0);
        setShowCookingSteps(true);
      }
    } catch {
      alert("生成制作过程失败，请重试");
    } finally {
      setLoadingSteps(false);
    }
  };

  // Send message
  const handleSend = async (question: string, forceView?: ViewMode) => {
    if (!question.trim()) return;
    const targetView = forceView || viewMode;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setAiLoading(true);

    // Switch view based on keywords (only if not null)
    const viewMap: Record<string, Exclude<ViewMode, null>> = {
      "食材": "ingredients", "产地": "ingredients",
      "风味": "flavor", "分析": "flavor",
      "古今": "compare", "对比": "compare",
      "文化": "culture", "故事": "culture",
      "地理": "geo-cause", "成因": "geo-cause",
    };

    let inferredView: Exclude<ViewMode, null> | null = null;
    for (const [kw, v] of Object.entries(viewMap)) {
      if (question.includes(kw)) { inferredView = v; break; }
    }

    const finalView = inferredView || targetView;
    setViewMode(finalView);

    try {
      const originalText = dish?.originalText || dish?.history || "";
      const modernMethod = dish?.modernMethod || "";
      const aiContent = await callAI(question, dish?.name || "", originalText, modernMethod);
      const aiMsg: Message = { role: "ai", content: aiContent };
      setMessages((prev) => [...prev, aiMsg]);

      // 如果是食材产地问题，回答完成后自动添加图例说明
      if (finalView === "ingredients" && ingredientPoints.length > 0) {
        const legendItems = extractIngredientLegend(ingredientPoints);
        const legendContent = `图例说明：图中各色光点代表不同食材所在产地——`;
        const legendMsg: Message = {
          role: "legend",
          content: legendContent,
          legendItems,
        };
        // 延迟添加，让 AI 回复先显示
        setTimeout(() => {
          setMessages((prev) => [...prev, legendMsg]);
        }, 300);
      }

      // 如果是风味分析问题，回答完成后自动添加图例说明
      if (finalView === "flavor" && flavorData.length > 0) {
        const legendItems = extractFlavorLegend(flavorData);
        const legendContent = `风味图例：`;
        const legendMsg: Message = {
          role: "flavor-legend",
          content: legendContent,
          flavorLegendItems: legendItems,
        };
        // 延迟添加，让 AI 回复先显示
        setTimeout(() => {
          setMessages((prev) => [...prev, legendMsg]);
        }, 300);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "抱歉，服务暂时不可用。" }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Click recommended button
  const handleRecommendedClick = (preset: typeof RECOMMENDED_QUESTIONS[0]) => {
    if (preset.id === "compare") {
      setViewMode("compare");
      setCookingCompareOpen(true);
      return;
    }
    // 如果是"食材产地"按钮，先触发粒子动画
    if (preset.hasParticle) {
      triggerParticleAnimation();
    }
    // 如果是"风味分析"按钮，先触发动画
    if (preset.hasFlavor) {
      triggerFlavorAnimation();
    }
    handleSend(preset.defaultQuestion, preset.id);
  };

  // Handle free input submit
  const handleInputSubmit = () => {
    if (inputValue.trim()) {
      handleSend(inputValue.trim(), "culture");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Left: map background */}
        <div className="modal-map" ref={mapContainerRef} />

        {/* 粒子动画层 - 食材产地 */}
        {ingredientPoints.length > 0 && (
          <ParticleCanvas
            ingredientPoints={ingredientPoints}
            dishCenterLng={dishCenter.lng}
            dishCenterLat={dishCenter.lat}
            mapRef={mapRef}
            visible={particleVisible}
            containerRef={mapContainerRef}
          />
        )}

        {/* 风味扩散动画层 - 风味分析 */}
        {flavorData.length > 0 && (
          <FlavorDiffusionCanvas
            ingredientData={flavorData}
            dishCenterLng={dishCenter.lng}
            dishCenterLat={dishCenter.lat}
            mapRef={mapRef}
            visible={flavorVisible}
            containerRef={mapContainerRef}
          />
        )}

        {/* Centered content layer */}
        <div className="modal-content-layer">
          {/* Left silk scroll with image */}
          <div className="modal-scroll">
            {/* Dish name above image */}
            <h2 className="modal-scroll-title">{dish.name}</h2>

            <div className="modal-image-area">
              {isGeneratingImage ? (
                <div className="modal-img-loading">
                  <div className="modal-spinner" />
                  <span>画中寻味...</span>
                </div>
              ) : imageUrl ? (
                <img src={imageUrl} alt={dish.name} className="modal-dish-img" />
              ) : imageError ? (
                <div className="modal-img-error">
                  <span>🌿</span><span>{imageError}</span>
                </div>
              ) : (
                <div className="modal-img-loading"><div className="modal-spinner" /></div>
              )}
              <div className="modal-img-vignette" />
              <div className="modal-img-frame" />
            </div>

            {/* Divider line */}
            <div className="modal-scroll-divider" />

            {/* Text info below image: original text */}
            <div className="modal-scroll-info">
              {dish.originalText && (
                <div className="modal-info-row modal-info-original">
                  <span className="modal-info-tag">原文</span>
                  <p className="modal-info-text">{dish.originalText}</p>
                </div>
              )}
              {dish.tags?.length > 0 && (
                <div className="modal-info-row">
                  <span className="modal-info-tag">口味</span>
                  <div className="modal-tags">
                    {dish.tags.map((tag) => (
                      <span key={tag} className="modal-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {dish.ingredients?.length > 0 && (
                <div className="modal-info-row">
                  <span className="modal-info-tag">食材</span>
                  <p className="modal-info-text">{dish.ingredients.join("、")}</p>
                </div>
              )}
            </div>
          </div>


            {/* Right: Q&A chat panel */}
          <div className="modal-chat-panel">
            {/* Recommended buttons */}
            <div className="modal-rec-bar">
              {RECOMMENDED_QUESTIONS.map((q) => (
                <button
                  key={q.id}
                  className={`modal-rec-btn ${viewMode === q.id ? "modal-rec-btn-active" : ""}`}
                  onClick={() => handleRecommendedClick(q)}
                >
                  <span className="modal-rec-icon">{q.icon}</span>
                  <span className="modal-rec-label">{q.label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="modal-chat-divider" />

            {/* Message stream */}
            <div className="modal-msg-stream">
              {messages.length === 0 && (
                <div className="modal-msg-empty">
                  <div className="modal-yuanmei-small">枚</div>
                  <p className="modal-msg-empty-text">袁子在此，有何疑问尽管道来。</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`modal-msg modal-msg-${msg.role}`}>
                  {msg.role === "ai" && <span className="modal-msg-avatar">枚</span>}
                  <div className="modal-msg-bubble">
                    <p className="modal-msg-text">{msg.content}</p>
                    {msg.role === "legend" && msg.legendItems && (
                      <div className="modal-legend">
                        <div className="modal-legend-grid">
                          {msg.legendItems.map((item) => (
                            <div key={item.ingredient} className="modal-legend-item">
                              <span className="modal-legend-dot" style={{ background: item.color }} />
                              <span className="modal-legend-icon">{item.icon}</span>
                              <span className="modal-legend-name">{item.ingredient}</span>
                              <span className="modal-legend-desc">{item.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.role === "flavor-legend" && msg.flavorLegendItems && (
                      <div className="modal-legend">
                        <div className="modal-legend-grid">
                          {msg.flavorLegendItems.map((item) => (
                            <div key={item.flavor} className="modal-legend-item">
                              <span className="modal-legend-dot" style={{ background: item.color }} />
                              <span className="modal-legend-name">{item.flavor}</span>
                              <span className="modal-legend-shape">{item.shape}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="modal-msg modal-msg-ai">
                  <span className="modal-msg-avatar">枚</span>
                  <div className="modal-msg-bubble modal-msg-bubble-loading">
                    <span className="modal-loading-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="modal-chat-input-area">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleInputSubmit(); }}
                placeholder="自由提问，或描述你想了解的内容..."
                className="modal-chat-input-field"
              />
              <button className="modal-chat-send-btn" onClick={handleInputSubmit} disabled={aiLoading}>
                询问
              </button>
            </div>
          </div>
        </div>

        {/* Cooking steps modal */}
        {showCookingSteps && (
          <div className="modal-cooking-overlay">
            <div className="modal-cooking-box">
              <button className="modal-cooking-close" onClick={() => setShowCookingSteps(false)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <div className="modal-cooking-header">
                <span className="modal-cooking-icon">🍳</span>
                <h2 className="modal-cooking-title">制作过程</h2>
                <span className="modal-cooking-subtitle">{dish.name}</span>
              </div>
              <div className="modal-cooking-timeline">
                {cookingSteps.map((s, i) => (
                  <button
                    key={s.step}
                    className={`modal-cooking-frame ${i === currentStep ? "active" : ""} ${i < currentStep ? "past" : ""}`}
                    onClick={() => setCurrentStep(i)}
                  >
                    {s.imageBase64 ? (
                      <img src={`data:image/png;base64,${s.imageBase64}`} alt={s.title} />
                    ) : (
                      <div className="modal-cooking-placeholder">🍽️</div>
                    )}
                    <span className={`modal-cooking-badge ${i === currentStep ? "badge-active" : ""}`}>{s.step}</span>
                  </button>
                ))}
              </div>
              <div className="modal-cooking-text" key={currentStep}>
                <h3 className="modal-cooking-step-title">{cookingSteps[currentStep]?.title}</h3>
                <p className="modal-cooking-step-desc">{cookingSteps[currentStep]?.desc}</p>
              </div>
              <div className="modal-cooking-dots">
                {cookingSteps.map((_, i) => (
                  <div key={i} className={`modal-cooking-dot ${i === currentStep ? "dot-active" : ""} ${i < currentStep ? "dot-past" : ""}`} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: rgba(30, 20, 10, 0.65);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        .modal-box {
          position: relative;
          width: 90vw;
          height: 90vh;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.4);
          animation: slideUp 0.35s cubic-bezier(0.23, 1, 0.32, 1);
        }

        /* Close button — top right corner */
        .modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 20;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 252, 245, 0.92);
          border: 1px solid rgba(139, 90, 43, 0.3);
          color: #8b5a2b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 2px 12px rgba(0,0,0,0.12);
        }
        .modal-close:hover {
          background: #8b5a2b;
          color: #fff;
          transform: scale(1.08);
        }

        /* Map background */
        .modal-map {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: #e8dcc8;
          z-index: 0;
        }

        /* Content layer on top of map, but below particles */
        .modal-content-layer {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 40px 48px;
          gap: 24px;
          pointer-events: none; /* 让鼠标事件穿透到地图 */
        }

        .modal-content-layer > * {
          pointer-events: auto; /* 子元素可以捕获鼠标事件 */
        }

        .modal-scroll-title {
          font-size: 18px;
          letter-spacing: 4px;
          color: #1e1a17;
          text-align: center;
          margin: 0;
          padding-bottom: 4px;
          /* 与下方图片之间保持紧凑 */
        }

        /* Left silk scroll：略窄于原先；内边距只留卷轴木边，内容区尽量铺满 */
        .modal-scroll {
          width: min(30vw, 320px);
          max-width: 100%;
          height: 88%;
          flex-shrink: 0;
          box-sizing: border-box;
          background-image: url('/juanzhou.PNG');
          background-size: 100% 100%;
          background-repeat: no-repeat;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          /* 上/下略留，左右仅避开绢轴两侧木纹，约 6%～8% */
          padding: 4% 4%;
          gap: 14px;
        }

        .modal-image-area {
          position: relative;
          flex: 1;
          min-height: 0;
          width: 100%;
          border-radius: 10px;
          overflow: hidden;
        }

        .modal-img-loading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: linear-gradient(135deg, #f5f0e6, #e8dcc8);
          font-size: 13px;
          color: #8b5a2b;
          letter-spacing: 3px;
        }

        .modal-img-error {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: rgba(139,90,43,0.06);
          font-size: 12px;
          color: #8b5a2b;
        }

        .modal-dish-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          filter: sepia(5%) contrast(1.05);
          transition: transform 0.6s;
          /* 不用径向遮罩，避免画面缩成中间一条；边缘由 vignette 轻扫 */
        }

        .modal-img-vignette {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent 50%, rgba(45,41,38,0.12));
          pointer-events: none;
        }

        .modal-img-frame {
          position: absolute;
          inset: 0;
          border: 3px solid rgba(139,90,43,0.25);
          border-radius: 12px;
          pointer-events: none;
        }

        .modal-scroll-divider {
          width: 80%;
          height: 2px;
          background: linear-gradient(to right, transparent, #8b5a2b, transparent);
          margin: 10px auto 8px;
        }

        /* Info below image in scroll */
        .modal-scroll-info {
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          max-height: 40%;
          width: 100%;
          box-sizing: border-box;
          padding: 0 2px;
        }

        .modal-info-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          width: 100%;
        }

        .modal-info-tag {
          font-size: 13px;
          color: #8b5a2b;
          letter-spacing: 1px;
          font-weight: 600;
          white-space: nowrap;
        }

        .modal-info-text {
          font-size: 12px;
          color: #4a3a2a;
          line-height: 1.6;
          margin: 0;
          flex: 1;
        }

        .modal-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          flex: 1;
        }

        .modal-tag {
          background: rgba(139,90,43,0.12);
          color: #6b4423;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          border: 1px solid rgba(139,90,43,0.2);
        }

        /* Right Q&A：只占约四成宽，中间留白露地图 */
        .modal-chat-panel {
          flex: 0 0 min(26%, 380px);
          width: min(26%, 380px);
          min-width: 260px;
          max-width: 380px;
          display: flex;
          flex-direction: column;
          height: 88%;
          background: rgba(255,252,245,0.7);
          border-radius: 12px;
          border: 1px solid rgba(139,90,43,0.15);
          overflow: hidden;
          box-shadow: inset 0 2px 8px rgba(139,90,43,0.06);
        }

        /* Recommended bar */
        .modal-rec-bar {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px 16px;
          flex-shrink: 0;
          border-bottom: 1px solid rgba(139,90,43,0.1);
        }

        .modal-rec-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          border-radius: 8px;
          border: 1px solid rgba(139,90,43,0.2);
          background: rgba(255,252,245,0.8);
          color: #5c2d0a;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          letter-spacing: 1px;
          text-align: left;
        }
        .modal-rec-btn:hover {
          background: rgba(139,90,43,0.1);
          border-color: rgba(139,90,43,0.5);
          transform: translateX(2px);
        }
        .modal-rec-btn-active {
          background: linear-gradient(135deg, #8b5a2b, #a06830) !important;
          color: #fff !important;
          border-color: #8b5a2b !important;
        }
        .modal-rec-icon { font-size: 15px; }
        .modal-rec-label { font-weight: 600; letter-spacing: 2px; }

        .modal-chat-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(139,90,43,0.2), transparent);
          margin: 0 16px;
          flex-shrink: 0;
        }

        /* Message stream */
        .modal-msg-stream {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 0;
        }

        .modal-msg-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 20px 0;
        }

        .modal-yuanmei-small {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff;
          font-size: 14px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-msg-empty-text {
          color: #8b5a2b;
          font-size: 13px;
          letter-spacing: 2px;
          opacity: 0.7;
          margin: 0;
          text-align: center;
        }

        .modal-msg {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          animation: modalFadeInUp 0.3s ease;
        }
        .modal-msg-user { flex-direction: row-reverse; }
        .modal-msg-ai { flex-direction: row; }

        .modal-msg-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff;
          font-size: 12px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .modal-msg-bubble {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.8;
          letter-spacing: 0.5px;
        }
        .modal-msg-user .modal-msg-bubble {
          background: linear-gradient(135deg, #8b5a2b, #a06830);
          color: #fff;
          border-bottom-right-radius: 3px;
        }
        .modal-msg-ai .modal-msg-bubble {
          background: rgba(255,252,245,0.95);
          color: #3a2a1a;
          border: 1px solid rgba(139,90,43,0.2);
          border-bottom-left-radius: 3px;
        }
        .modal-msg-legend .modal-msg-bubble {
          background: rgba(255,252,245,0.95);
          color: #3a2a1a;
          border: 1px solid rgba(139,90,43,0.2);
          border-bottom-left-radius: 3px;
        }
        .modal-msg-bubble-loading {
          padding: 12px 18px;
        }

        .modal-msg-text {
          margin: 0;
          white-space: pre-wrap;
        }

        .modal-loading-dots span {
          animation: modalDotBlink 1.4s infinite;
          color: #8b5a2b;
          font-size: 18px;
          line-height: 1;
        }
        .modal-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .modal-loading-dots span:nth-child(3) { animation-delay: 0.4s; }

        /* Legend section in chat */
        .modal-legend {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed rgba(139,90,43,0.2);
        }

        .modal-legend-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .modal-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: rgba(255,252,245,0.6);
          border-radius: 8px;
          border: 1px solid rgba(139,90,43,0.1);
        }

        .modal-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 6px currentColor;
        }

        .modal-legend-icon {
          font-size: 14px;
          flex-shrink: 0;
        }

        .modal-legend-name {
          font-weight: 600;
          color: #5c2d0a;
          font-size: 12px;
          min-width: 60px;
        }

        .modal-legend-desc {
          color: #7a6a5a;
          font-size: 11px;
          flex: 1;
        }

        .modal-legend-shape {
          color: #9a8a7a;
          font-size: 11px;
          font-weight: 600;
          min-width: 50px;
          text-align: center;
        }

        /* Flavor legend section in chat */
        .modal-flavor-legend {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed rgba(139,90,43,0.2);
        }

        .modal-flavor-legend-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .modal-flavor-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: rgba(255,252,245,0.6);
          border-radius: 8px;
          border: 1px solid rgba(139,90,43,0.1);
        }

        .modal-flavor-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 6px currentColor;
        }

        .modal-flavor-legend-icon {
          font-size: 14px;
          flex-shrink: 0;
        }

        .modal-flavor-legend-name {
          font-weight: 600;
          color: #5c2d0a;
          font-size: 12px;
          min-width: 40px;
        }

        .modal-flavor-legend-desc {
          color: #7a6a5a;
          font-size: 11px;
          flex: 1;
        }

        /* Input area */
        .modal-chat-input-area {
          padding: 12px 16px;
          border-top: 1px solid rgba(139,90,43,0.1);
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          background: rgba(255,252,245,0.8);
        }

        .modal-chat-input-field {
          flex: 1;
          background: rgba(255,252,245,0.9);
          border: 1px solid rgba(139,90,43,0.2);
          border-radius: 20px;
          padding: 9px 16px;
          font-family: inherit;
          font-size: 13px;
          color: #332c28;
          outline: none;
          transition: border-color 0.2s;
        }
        .modal-chat-input-field:focus { border-color: rgba(139,90,43,0.5); }
        .modal-chat-input-field::placeholder { color: #bbb; letter-spacing: 1px; }

        .modal-chat-send-btn {
          background: linear-gradient(135deg, #8b5a2b, #a06830);
          color: #fff;
          border: none;
          padding: 9px 18px;
          border-radius: 20px;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          letter-spacing: 2px;
          transition: all 0.3s;
          box-shadow: 0 3px 10px rgba(139,90,43,0.25);
        }
        .modal-chat-send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 5px 14px rgba(139,90,43,0.35);
        }
        .modal-chat-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Old detail styles - kept for reference, will remove unused */
        .modal-detail {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 90%;
          overflow-y: auto;
        }

        /* Old action buttons */
        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: auto;
          padding-top: 8px;
          flex-wrap: wrap;
        }

        .modal-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.3s;
          border: 2px solid transparent;
          letter-spacing: 1px;
        }

        .modal-btn-cooking {
          background: linear-gradient(135deg, #8b5a2b, #a06830);
          color: #fff;
          border-color: #8b5a2b;
        }
        .modal-btn-cooking:hover {
          background: linear-gradient(135deg, #a06830, #b07838);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(139,90,43,0.3);
        }
        .modal-btn-cooking:disabled { opacity: 0.7; cursor: wait; }

        .modal-btn-explore {
          background: rgba(255,252,245,0.92);
          color: #8b5a2b;
          border-color: rgba(139,90,43,0.3);
        }
        .modal-btn-explore:hover {
          background: rgba(139,90,43,0.1);
          border-color: #8b5a2b;
          transform: translateY(-2px);
        }

        .modal-btn-compare {
          background: rgba(255,252,245,0.92);
          color: #8b5a2b;
          border-color: rgba(139,90,43,0.3);
        }
        .modal-btn-compare:hover {
          background: rgba(139,90,43,0.1);
          border-color: #8b5a2b;
          transform: translateY(-2px);
        }

        .modal-btn-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Spinner */
        .modal-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(139,90,43,0.15);
          border-top-color: #8b5a2b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Cooking overlay */
        .modal-cooking-overlay {
          position: absolute;
          inset: 0;
          z-index: 10;
          background: rgba(0,0,0,0.72);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          animation: fadeIn 0.25s ease;
        }

        .modal-cooking-box {
          position: relative;
          width: 88%;
          max-height: 88%;
          overflow-y: auto;
          background: linear-gradient(135deg, #1a1612, #2d2620 40%, #1a1612);
          border-radius: 14px;
          padding: 36px;
        }

        .modal-cooking-close {
          position: absolute;
          top: -44px;
          right: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .modal-cooking-close:hover { background: rgba(255,255,255,0.35); }

        .modal-cooking-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }
        .modal-cooking-icon { font-size: 22px; }
        .modal-cooking-title {
          font-size: 18px;
          color: #fff;
          margin: 0;
          letter-spacing: 3px;
          font-weight: 600;
        }
        .modal-cooking-subtitle {
          margin-left: auto;
          font-size: 12px;
          color: #f4c542;
          letter-spacing: 1px;
        }

        .modal-cooking-timeline {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          scrollbar-width: none;
          margin-bottom: 16px;
        }
        .modal-cooking-timeline::-webkit-scrollbar { display: none; }

        .modal-cooking-frame {
          flex-shrink: 0;
          width: 110px;
          aspect-ratio: 4/3;
          border-radius: 8px;
          overflow: hidden;
          background: #2d2620;
          border: 2px solid rgba(255,255,255,0.06);
          position: relative;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-cooking-frame:hover { transform: scale(1.04); }
        .modal-cooking-frame.active { border-color: rgba(244,197,66,0.7); z-index: 2; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
        .modal-cooking-frame.past { opacity: 0.5; }
        .modal-cooking-frame:not(.active):not(.past) { opacity: 0.28; }
        .modal-cooking-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .modal-cooking-placeholder { font-size: 20px; opacity: 0.4; }
        .modal-cooking-badge {
          position: absolute;
          bottom: 5px;
          right: 6px;
          background: rgba(0,0,0,0.5);
          color: rgba(255,255,255,0.7);
          font-size: 9px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 3px;
        }
        .modal-cooking-badge.badge-active {
          background: linear-gradient(135deg, #f4c542, #e6a91a);
          color: #2d2926;
        }

        .modal-cooking-text {
          animation: fadeSlide 0.35s ease-out;
          padding: 0 4px;
        }
        .modal-cooking-step-title {
          font-size: 20px;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: 3px;
        }
        .modal-cooking-step-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.72);
          line-height: 1.85;
          margin: 0;
        }

        .modal-cooking-dots {
          display: flex;
          justify-content: center;
          gap: 7px;
          margin-top: 14px;
        }
        .modal-cooking-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          transition: all 0.35s;
        }
        .modal-cooking-dot.dot-active { width: 20px; border-radius: 3px; background: linear-gradient(90deg,#f4c542,#e6a91a); }
        .modal-cooking-dot.dot-past { background: rgba(255,255,255,0.38); }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes modalFadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalDotBlink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }

        @media (max-width: 900px) {
          .modal-box { width: 94vw; height: 90vh; }
          .modal-content-layer {
            flex-direction: column;
            justify-content: flex-start;
            padding: 24px 20px;
            gap: 20px;
          }
          .modal-scroll { width: 100%; height: 45%; }
          .modal-detail { height: auto; }
          .modal-chat-panel {
            flex: 1 1 auto;
            width: 100%;
            max-width: none;
            min-width: 0;
            height: 45%;
          }
        }
      `}</style>

      {/* 古今对比全屏烹饪演示 — 覆盖整个页面包括地图 */}
      <CookingCompareOverlay
        open={cookingCompareOpen}
        onClose={() => setCookingCompareOpen(false)}
        dishTitle={dish.name}
      />
    </div>
  );
}
