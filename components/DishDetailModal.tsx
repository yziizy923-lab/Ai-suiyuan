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
  dish_location?: {
    name: string;
    origin: string;
    longitude: number;
    latitude: number;
    note: string;
  };
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
  /** 地理成因类型消息：显示食材产地信息 */
  geoCauseInfo?: {
    ingredient: string;
    placeName: string;
    color: string;
    content: string;
  };
};
type ViewMode = "ingredients" | "flavor" | "culture" | "geo-cause" | null;

interface DishDetailModalProps {
  dish: Dish;
  onClose: () => void;
}

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

const FLAVOR_COLORS: Record<string, string> = {
  "酸": "#F39C12",
  "甜": "#E74C3C",
  "苦": "#8E44AD",
  "辣": "#C0392B",
  "咸": "#2980B9",
  "鲜": "#fbd01e",
};

const FLAVOR_ICONS: Record<string, string> = {
  "酸": "⭐",
  "甜": "💫",
  "苦": "🌙",
  "辣": "🔥",
  "咸": "💧",
  "鲜": "✨",
};

const FLAVOR_DESC: Record<string, string> = {
  "酸": "开胃解腻，刺激味蕾",
  "甜": "愉悦心情，温和甘美",
  "苦": "清热降火，回味悠长",
  "辣": "驱寒暖身，刺激食欲",
  "咸": "提鲜入味，基础底味",
  "鲜": "自然鲜美，回味无穷",
};

const FLAVOR_SHAPES: Record<string, string> = {
  "酸": "星形",
  "甜": "圆形",
  "苦": "波浪形",
  "辣": "火焰形",
  "咸": "方形",
  "鲜": "水滴形",
};

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

function generateIngredientPoints(dish: Dish): IngredientPoint[] {
  const points: IngredientPoint[] = [];
  if (dish.ingredients_distribution) {
    for (const ing of dish.ingredients_distribution) {
      const color = INGREDIENT_COLORS[ing.ingredient] || INGREDIENT_COLORS.default;
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
  return points;
}

function getDishCenterCoords(dish: Dish): { lng: number; lat: number } {
  if (dish.dish_location) {
    return { lng: dish.dish_location.longitude, lat: dish.dish_location.latitude };
  }
  if (dish.originCoords) {
    return { lng: dish.originCoords[0], lat: dish.originCoords[1] };
  }
  return { lng: 108, lat: 34 };
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

// "compare" 已从 ViewMode 中移除，改为独立的 cookingCompareOpen 状态控制
const RECOMMENDED_QUESTIONS: { id: ViewMode | "compare"; label: string; icon: string; defaultQuestion: string; hasParticle?: boolean; hasFlavor?: boolean }[] = [
  { id: "ingredients", label: "食材产地", icon: "🗺️", defaultQuestion: "请介绍这道菜的食材产地分布", hasParticle: true },
  { id: "flavor",      label: "风味分析", icon: "✨", defaultQuestion: "请分析这道菜的风味特征", hasFlavor: true },
  { id: "compare",     label: "古今对比", icon: "🍳", defaultQuestion: "" },
  { id: "culture",     label: "文化故事", icon: "📜", defaultQuestion: "请讲述这道菜的文化故事与传承" },
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

  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ 独立控制古今对比悬浮小弹窗
  const [cookingCompareOpen, setCookingCompareOpen] = useState(false);

  const [particleVisible, setParticleVisible] = useState(false);
  const [ingredientPoints, setIngredientPoints] = useState<IngredientPoint[]>([]);
  const [flavorVisible, setFlavorVisible] = useState(false);
  const [flavorData, setFlavorData] = useState<FlavorIngredientData[]>([]);

  // 视频路径常量
  const VIDEO1_PATH = "/videos/video1.mp4";
  const VIDEO2_PATH = "/videos/video2.mp4";

  // 文化故事视频显示状态
  const [cultureVideosVisible, setCultureVideosVisible] = useState(false);
  const [dishExtraData, setDishExtraData] = useState<{
    dish_location?: Dish['dish_location'];
    ingredients_distribution?: Dish['ingredients_distribution'];
  } | null>(null);
  const [geoCauseLoading, setGeoCauseLoading] = useState(false);

  const dishCenter = dishExtraData?.dish_location
    ? { lng: dishExtraData.dish_location.longitude, lat: dishExtraData.dish_location.latitude }
    : getDishCenterCoords(dish);

  useEffect(() => {
    async function loadIngredientData() {
      if (!dish?.name) return;
      try {
        // 首先尝试从 Neo4j 知识图谱获取食材分布数据
        const graphRes = await fetch(`/api/dish-ingredients-graph?name=${encodeURIComponent(dish.name)}`);
        const graphResult = await graphRes.json();
        
        if (graphResult.success && graphResult.ingredients && graphResult.ingredients.length > 0) {
          // 将图谱数据转换为 ingredients_distribution 格式
          const ingredients_distribution = graphResult.ingredients.map((ing: any) => ({
            ingredient: ing.ingredient,
            category: '食材',
            distribution_locations: ing.points.map((pt: any) => ({
              name: pt.region,
              longitude: pt.lng,
              latitude: pt.lat,
              note: pt.desc || pt.factor || '',
            })),
          }));
          
          // 默认菜品产地（江南地区）
          const dish_location = {
            name: dish.name,
            origin: '江南地区（今江苏、浙江一带）',
            longitude: 120.15,
            latitude: 30.28,
            note: '源于江南地区，体现江南饮食文化特色',
          };
          
          setDishExtraData({ dish_location, ingredients_distribution });
          const points = generateIngredientPoints({
            ...dish,
            ingredients_distribution,
            dish_location,
          });
          setIngredientPoints(points);
          console.log(`[DishDetailModal] Loaded ${ingredients_distribution.length} ingredients from Neo4j`);
        } else {
          // 如果图谱没有数据，尝试使用 dish-detail API（特菜品）
          const res = await fetch(`/api/dish-detail?name=${encodeURIComponent(dish.name)}`);
          const result = await res.json();
          if (result.success && result.data) {
            setDishExtraData({
              dish_location: result.data.dish_location,
              ingredients_distribution: result.data.ingredients_distribution,
            });
            const points = generateIngredientPoints({
              ...dish,
              ingredients_distribution: result.data.ingredients_distribution,
              dish_location: result.data.dish_location,
            });
            setIngredientPoints(points);
          } else {
            setIngredientPoints(generateIngredientPoints(dish));
          }
        }
      } catch (err) {
        console.error('[DishDetailModal] Failed to load ingredient data:', err);
        setIngredientPoints(generateIngredientPoints(dish));
      }
    }
    loadIngredientData();
  }, [dish]);

  useEffect(() => {
    async function loadFlavorData() {
      if (!dish?.name) return;
      try {
        const res = await fetch(`/api/dish-flavor?name=${encodeURIComponent(dish.name)}`);
        const result = await res.json();
        if (result.success && result.data) setFlavorData(result.data);
      } catch {
        console.error('Failed to load flavor data');
      }
    }
    loadFlavorData();
  }, [dish]);

  useEffect(() => {
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

  useEffect(() => {
    if (viewMode === "ingredients" && ingredientPoints.length > 0) setParticleVisible(true);
  }, [ingredientPoints, viewMode]);

  useEffect(() => {
    if (viewMode === "flavor" && flavorData.length > 0) setFlavorVisible(true);
  }, [flavorData, viewMode]);

  // 文化故事模式显示视频
  useEffect(() => {
    if (viewMode === "culture") {
      setCultureVideosVisible(true);
    } else {
      setCultureVideosVisible(false);
    }
  }, [viewMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!accessToken) return;

    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/light-v11",
      center: [dishCenter.lng, dishCenter.lat],
      zoom: 5,
      interactive: true,
      attributionControl: false,
      projection: "mercator",
    });

    map.on("load", () => {
      map.getStyle()?.layers?.forEach((layer) => {
        if (layer.layout && ("text-field" in layer.layout)) {
          map.setLayoutProperty(layer.id, "text-field", ["get", "name_zh-Hans"]);
        }
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", "#e8dcc8");
        }
      });
      const el = document.createElement("div");
      el.innerHTML = `<div style="width:20px;height:20px;background:linear-gradient(135deg,#d44444,#a83232);
        border:3px solid rgba(255,255,255,0.9);border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`;
      new mapboxgl.Marker({ element: el })
        .setLngLat([dishCenter.lng, dishCenter.lat])
        .addTo(map);
      map.flyTo({ center: [dishCenter.lng, dishCenter.lat], zoom: 5, duration: 2000 });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!dishExtraData?.dish_location || !mapRef.current) return;
    const map = mapRef.current;
    const { longitude, latitude } = dishExtraData.dish_location;
    if (map.isStyleLoaded()) {
      map.flyTo({ center: [longitude, latitude], zoom: 5, duration: 1500 });
    } else {
      map.once("load", () => map.flyTo({ center: [longitude, latitude], zoom: 5, duration: 1500 }));
    }
  }, [dishExtraData?.dish_location]);

  const hasValidImage = (url: string | undefined): boolean => {
    if (!url) return false;
    if (url.includes('picsum.photos')) return false;
    return url.startsWith('data:') || url.startsWith('/') || url.startsWith('http');
  };

  useEffect(() => {
    if (!dish) return;
    if (hasValidImage(dish.image)) {
      setImageUrl(dish.image);
      setIsGeneratingImage(false);
      return;
    }
    const generateImage = async () => {
      setIsGeneratingImage(true);
      setImageError(null);
      try {
        const response = await fetch("/api/generate-dish-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dish: dish.name, desc: dish.desc || "", ancient: dish.history || "", saveToDb: true }),
        });
        const data = await response.json();
        if (data.success && data.imageUrl) setImageUrl(data.imageUrl);
        else setImageError(data.error || "生成失败");
      } catch {
        setImageError("网络错误");
      } finally {
        setIsGeneratingImage(false);
      }
    };
    generateImage();
  }, [dish]);

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

  const handleSend = async (question: string, forceView?: ViewMode) => {
    if (!question.trim()) return;
    const targetView = forceView || viewMode;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setAiLoading(true);

    const viewMap: Record<string, Exclude<ViewMode, null>> = {
      "食材": "ingredients", "产地": "ingredients",
      "风味": "flavor", "分析": "flavor",
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

      if (finalView === "ingredients" && ingredientPoints.length > 0) {
        const legendItems = extractIngredientLegend(ingredientPoints);
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            role: "legend",
            content: "图例说明：图中各色光点代表不同食材所在产地——",
            legendItems,
          }]);
        }, 300);
      }

      if (finalView === "flavor" && flavorData.length > 0) {
        const legendItems = extractFlavorLegend(flavorData);
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            role: "flavor-legend",
            content: "风味图例：",
            flavorLegendItems: legendItems,
          }]);
        }, 300);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "抱歉，服务暂时不可用。" }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRecommendedClick = (preset: typeof RECOMMENDED_QUESTIONS[0]) => {
    // ✅ 切换模式时关闭味觉地图
    setFlavorVisible(false);
    // ✅ 古今对比：打开居中悬浮小弹窗，不占用聊天面板
    if (preset.id === "compare") {
      setCookingCompareOpen(true);
      return;
    }
    // ✅ 文化故事：直接显示视频
    if (preset.id === "culture") {
      setCultureVideosVisible(true);
      handleSend(preset.defaultQuestion, preset.id as ViewMode);
      return;
    }
    if (preset.hasParticle) setParticleVisible(true);
    if (preset.hasFlavor) setFlavorVisible(true);
    handleSend(preset.defaultQuestion, preset.id as ViewMode);
  };

  const handleInputSubmit = () => {
    if (inputValue.trim()) handleSend(inputValue.trim(), "culture");
  };

  // 处理点击食材产地粒子
  const handleIngredientClick = async (name: string, ingredient: string, color: string) => {
    if (!name || !ingredient) return;

    setGeoCauseLoading(true);

    try {
      const res = await fetch("/api/geo-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish: dish.name,
          ingredient,
          placeName: name,
        }),
      });
      const data = await res.json();

      // 添加地理成因消息到聊天面板
      setMessages((prev) => [
        ...prev,
        {
          role: "ai" as const,
          content: data.success
            ? data.content
            : `「${ingredient}」产自「${name}」，此地气候温润、地势平坦、水系发达，自古便是此食材的重要产区。`,
          geoCauseInfo: {
            ingredient,
            placeName: name,
            color,
            content: data.success ? data.content : "",
          },
        },
      ]);
    } catch {
      // 网络错误时使用默认文案
      setMessages((prev) => [
        ...prev,
        {
          role: "ai" as const,
          content: `「${ingredient}」产自「${name}」，此地气候温润、地势平坦、水系发达，自古便是此食材的重要产区。`,
          geoCauseInfo: {
            ingredient,
            placeName: name,
            color,
            content: "",
          },
        },
      ]);
    } finally {
      setGeoCauseLoading(false);
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

        {/* Map background */}
        <div className="modal-map" ref={mapContainerRef} />

        {/* 粒子动画层 */}
        {ingredientPoints.length > 0 && (
          <ParticleCanvas
            ingredientPoints={ingredientPoints}
            dishCenterLng={dishCenter.lng}
            dishCenterLat={dishCenter.lat}
            mapRef={mapRef}
            visible={particleVisible}
            containerRef={mapContainerRef}
            onIngredientClick={handleIngredientClick}
          />
        )}

        {/* 风味扩散动画层 */}
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

        {/* 文化故事视频层 - 直接在地图上显示两个视频 */}
        {cultureVideosVisible && (
          <div className="culture-videos-container">
            <div className="culture-video-item">
              <span className="culture-video-label">古籍记载</span>
              <video
                src={VIDEO1_PATH}
                controls
                autoPlay
                loop
                muted
                className="culture-video"
              />
            </div>
            <div className="culture-video-item">
              <span className="culture-video-label">现代演绎</span>
              <video
                src={VIDEO2_PATH}
                controls
                autoPlay
                loop
                muted
                className="culture-video"
              />
            </div>
          </div>
        )}

        {/* Content layer */}
        <div className="modal-content-layer">
          {/* Left silk scroll */}
          <div className="modal-scroll">
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
            <div className="modal-scroll-divider" />
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

          {/* ✅ 古今对比悬浮小弹窗 — 居中浮于地图上，左右面板之间 */}
          {cookingCompareOpen && (
            <div className="cooking-float-backdrop" onClick={() => setCookingCompareOpen(false)}>
              <div
                className="cooking-float-panel"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 小弹窗关闭按钮 */}
                <button
                  className="cooking-float-close"
                  onClick={() => setCookingCompareOpen(false)}
                  aria-label="关闭古今对比"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                <CookingCompareOverlay
                  open={true}
                  onClose={() => setCookingCompareOpen(false)}
                  dishTitle={dish.name}
                  inline={true}
                />
              </div>
            </div>
          )}

          {/* Right Q&A chat panel */}
          <div className="modal-chat-panel">
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

            <div className="modal-chat-divider" />

            {/* ✅ 聊天面板只渲染正常消息流，不再嵌入 CookingCompareOverlay */}
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
                  <div className={`modal-msg-bubble ${msg.geoCauseInfo ? "modal-msg-geo-cause" : ""}`}>
                    {/* 地理成因消息头部 */}
                    {msg.geoCauseInfo && (
                      <div className="geo-cause-header">
                        <div
                          className="geo-cause-dot"
                          style={{ background: msg.geoCauseInfo.color, boxShadow: `0 0 8px ${msg.geoCauseInfo.color}` }}
                        />
                        <span className="geo-cause-ingredient" style={{ color: msg.geoCauseInfo.color }}>
                          {msg.geoCauseInfo.ingredient}
                        </span>
                        <span className="geo-cause-arrow">→</span>
                        <span className="geo-cause-place">{msg.geoCauseInfo.placeName}</span>
                      </div>
                    )}
                    {/* 消息内容 */}
                    <p className="modal-msg-text">{msg.content}</p>
                    {/* 地理成因详情（如果有） */}
                    {msg.geoCauseInfo?.content && (
                      <div className="geo-cause-detail">
                        <div className="geo-cause-detail-divider" />
                        <div className="geo-cause-dimensions">
                          <span className="geo-cause-dim" title="气候">🌦 气候</span>
                          <span className="geo-cause-dim" title="地形">⛰ 地形</span>
                          <span className="geo-cause-dim" title="水文">💧 水文</span>
                        </div>
                      </div>
                    )}
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
              {(aiLoading || geoCauseLoading) && (
                <div className="modal-msg modal-msg-ai">
                  <span className="modal-msg-avatar">枚</span>
                  <div className="modal-msg-bubble modal-msg-bubble-loading">
                    {geoCauseLoading ? (
                      <div className="geo-cause-loading">
                        <span className="geo-cause-loading-text">正在推演此地山川水脉……</span>
                      </div>
                    ) : (
                      <span className="modal-loading-dots">
                        <span>.</span><span>.</span><span>.</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

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

        .modal-map {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: #e8dcc8;
          z-index: 0;
        }

        .modal-content-layer {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 40px 48px;
          gap: 24px;
          pointer-events: none;
        }

        .modal-content-layer > * {
          pointer-events: auto;
        }

        /* ✅ 古今对比悬浮弹窗 — 透明遮罩撑满中间区域，弹窗居中 */
        .cooking-float-backdrop {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          /* 不加 background，保持地图可见；点击空白处关闭 */
        }

        .cooking-float-panel {
          position: relative;
          width: min(600px, 60vw);
          height: min(580px, 82vh);
          border-radius: 14px;
          overflow: hidden;
          box-shadow:
            0 8px 40px rgba(0, 0, 0, 0.28),
            0 2px 12px rgba(139, 90, 43, 0.15);
          border: 1px solid rgba(139, 90, 43, 0.2);
          animation: floatPanelIn 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }

        /* 小弹窗的关闭按钮 — 右上角 */
        .cooking-float-close {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 20;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 252, 245, 0.92);
          border: 1px solid rgba(139, 90, 43, 0.3);
          color: #8b5a2b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .cooking-float-close:hover {
          background: #8b5a2b;
          color: #fff;
          transform: scale(1.08);
        }

        /* 文化故事视频弹窗 */
        .culture-videos-container {
          position: absolute;
          inset: 0;
          z-index: 12;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 60px 80px;
          box-sizing: border-box;
          pointer-events: none;
        }

        .culture-video-item {
          width: 100%;
          max-width: 700px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: auto;
        }

        .culture-video-label {
          font-size: 14px;
          color: #fff;
          letter-spacing: 3px;
          font-weight: 600;
          text-align: center;
          text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }

        .culture-video {
          width: 100%;
          max-height: 220px;
          border-radius: 10px;
          border: 2px solid rgba(139, 90, 43, 0.3);
          background: #1a1a1a;
          object-fit: contain;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        @keyframes floatPanelIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .modal-scroll-title {
          font-size: 18px;
          letter-spacing: 4px;
          color: #1e1a17;
          text-align: center;
          margin: 0;
          padding-bottom: 4px;
        }

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
        .modal-msg-bubble-loading { padding: 12px 18px; }

        /* 地理成因消息样式 */
        .modal-msg-geo-cause {
          background: linear-gradient(135deg, rgba(139,90,43,0.08), rgba(244,239,230,0.95)) !important;
          border: 1px solid rgba(139,90,43,0.3) !important;
          padding: 12px 14px;
        }

        .geo-cause-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px dashed rgba(139,90,43,0.2);
        }

        .geo-cause-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .geo-cause-ingredient {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1px;
        }

        .geo-cause-arrow {
          color: rgba(139,90,43,0.5);
          font-size: 12px;
        }

        .geo-cause-place {
          color: #5a3b1f;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 1px;
        }

        .geo-cause-detail {
          margin-top: 10px;
        }

        .geo-cause-detail-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(139,90,43,0.25), transparent);
          margin: 10px 0;
        }

        .geo-cause-dimensions {
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .geo-cause-dim {
          font-size: 11px;
          color: rgba(139,90,43,0.6);
          letter-spacing: 1px;
          padding: 3px 8px;
          background: rgba(139,90,43,0.06);
          border-radius: 4px;
        }

        /* 地理成因加载状态 */
        .geo-cause-loading {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 0;
        }

        .geo-cause-loading-text {
          color: rgba(139,90,43,0.7);
          font-size: 12px;
          letter-spacing: 1px;
          animation: geoCausePulse 1.5s ease-in-out infinite;
        }

        @keyframes geoCausePulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
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

        .modal-legend-icon { font-size: 14px; flex-shrink: 0; }

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

        .modal-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(139,90,43,0.15);
          border-top-color: #8b5a2b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

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
          .modal-chat-panel {
            flex: 1 1 auto;
            width: 100%;
            max-width: none;
            min-width: 0;
            height: 45%;
          }
          .cooking-float-panel {
            width: min(360px, 88vw);
            height: min(480px, 65vh);
          }
        }
      `}</style>
    </div>
  );
}