"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import ParticleCanvas, { type IngredientPoint } from "@/components/ParticleCanvas";
import FlavorDiffusionCanvas, { type FlavorType, type ImportanceLevel } from "@/components/FlavorDiffusionCanvas";
import FloatingDialog, { type IngredientGeoInfo, type GraphIngredientData, type GraphIngredientPoint } from "@/components/FloatingDialog";
import CookingCompareOverlay from "@/components/CookingCompareOverlay";

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
  stepNumber?: number;
  title: string;
  desc: string;
  imageBase64?: string;
  success?: boolean;
};

type ActiveTab = "geo" | "culture" | "ingredients" | "flavor";

type GeoCauseTarget = {
  ingredient: string;
  placeName: string;
  lng: number;
  lat: number;
};

// 食材颜色映射
const INGREDIENT_COLORS: Record<string, string> = {
  "鸡肉": "#FF6B6B",
  "鸡汤": "#FFB347",
  "香菇": "#D4A574",
  "蘑菇": "#C8A882",
  "松子仁": "#8B7355",
  "瓜子仁": "#C9B037",
  "火腿": "#E84545",
  "豆腐脑": "#FFFACD",
  "猪肉": "#FF8C8C",
  "牛肉": "#CD853F",
  "羊肉": "#D2691E",
  "鱼肉": "#87CEEB",
  "虾": "#FFB6C1",
  "蟹": "#FFA500",
  "青菜": "#90EE90",
  "白菜": "#98FB98",
  "default": "#8b5a2b",
};

const FLAVOR_COLORS: Record<FlavorType, string> = {
  "酸": "#FF6B6B",
  "甜": "#FFB5E8",
  "苦": "#5C7A5C",
  "辣": "#FF4500",
  "咸": "#87CEEB",
  "鲜": "#FFD700",
};

// 地理预设数据
type GeoPreset = {
  id: string;
  flyTo: { center: [number, number]; zoom: number };
  rivers: string[];
  terrain: string[];
  climate: string[];
  notes?: string[];
};

function getGeoPreset(placeName: string): GeoPreset | null {
  const lower = placeName.toLowerCase();
  
  if (lower.includes("高邮") || lower.includes("扬州") || lower.includes("江苏")) {
    return { id: "gaoyou", flyTo: { center: [119.45, 32.78], zoom: 7.2 }, rivers: ["京杭大运河", "长江下游水系"], terrain: ["里下河平原"], climate: ["江淮湿润季风"] };
  }
  if (lower.includes("金华") || lower.includes("浙江")) {
    return { id: "jinhua", flyTo: { center: [119.65, 29.09], zoom: 7.6 }, rivers: ["钱塘江水系（婺江）"], terrain: ["金衢盆地"], climate: ["亚热带湿润季风"] };
  }
  if (lower.includes("庆元") || lower.includes("丽水") || lower.includes("浙江")) {
    return { id: "qingyuan", flyTo: { center: [119.07, 27.63], zoom: 7.6 }, rivers: ["瓯江上游支流"], terrain: ["浙南山地", "林地覆盖"], climate: ["湿润多雨"] };
  }
  if (lower.includes("伊春") || lower.includes("黑龙江") || lower.includes("东北")) {
    return { id: "yichun", flyTo: { center: [128.9, 47.73], zoom: 6.9 }, rivers: ["松花江水系"], terrain: ["小兴安岭山地林海"], climate: ["寒温带季风"] };
  }
  if (lower.includes("南京") || lower.includes("江苏")) {
    return { id: "nanjing", flyTo: { center: [118.78, 32.06], zoom: 7.2 }, rivers: ["长江", "秦淮河"], terrain: ["宁镇丘陵与滨江平原"], climate: ["江淮湿润季风"] };
  }
  if (lower.includes("宣威") || lower.includes("云南")) {
    return { id: "xuanwei", flyTo: { center: [104.10, 26.22], zoom: 7.2 }, rivers: ["牛栏江流域"], terrain: ["云贵高原"], climate: ["高原季风气候"] };
  }
  if (lower.includes("延边") || lower.includes("长白山") || lower.includes("吉林")) {
    return { id: "yanbian", flyTo: { center: [128.04, 41.93], zoom: 7.2 }, rivers: ["图们江水系"], terrain: ["长白山脉"], climate: ["温带季风"] };
  }
  if (lower.includes("清远") || lower.includes("广东")) {
    return { id: "qingyuan", flyTo: { center: [113.05, 23.68], zoom: 7.2 }, rivers: ["北江水系"], terrain: ["珠三角平原"], climate: ["亚热带季风"] };
  }
  if (lower.includes("苏州") || lower.includes("杭州")) {
    return { id: "suzhou", flyTo: { center: [120.62, 31.30], zoom: 7.5 }, rivers: ["京杭大运河", "太湖"], terrain: ["江南水乡"], climate: ["亚热带湿润季风"] };
  }
  return null;
}

function parseArrayField(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); }
    catch { return value.split(',').map(s => s.trim()).filter(Boolean); }
  }
  return [];
}

async function fetchDishFullDetail(id: number) {
  try {
    const res = await fetch(`/api/dish-full-detail?id=${id}`);
    const result = await res.json();
    if (result.success && result.data) {
      return result.data;
    }
  } catch (e) {
    console.error('[DishDetail] Failed to fetch full detail:', e);
  }
  return null;
}

async function fetchDishBasic(id: number): Promise<Dish | null> {
  try {
    const response = await fetch(`/api/dishes/${id}`);
    if (!response.ok) return null;
    const dish = await response.json();
    return {
      ...dish,
      tags: Array.isArray(dish.tags) ? dish.tags : parseArrayField(dish.tags),
      ingredients: Array.isArray(dish.ingredients) ? dish.ingredients : parseArrayField(dish.ingredients),
      image: dish.image || `https://picsum.photos/seed/${dish.id}/800/500`
    };
  } catch { return null; }
}

export default function DishDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [dish, setDish] = useState<Dish | null>(null);
  const [ingredientsDistribution, setIngredientsDistribution] = useState<Dish['ingredients_distribution']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("geo");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(true);

  // 地图相关
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const dishMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const flowAnimRef = useRef<number | null>(null);

  // 地理成因相关
  const [geoTarget, setGeoTarget] = useState<GeoCauseTarget | null>(null);
  const [geoCauseOpen, setGeoCauseOpen] = useState(false);
  const [geoCauseLoading, setGeoCauseLoading] = useState(false);
  const [geoCauseText, setGeoCauseText] = useState<string>("");
  const geoCauseCacheRef = useRef<Map<string, string>>(new Map());

  // 粒子点击 → 对话面板地理条件
  const [geoIngredientDetail, setGeoIngredientDetail] = useState<string>("");
  const [geoIngredientLoading, setGeoIngredientLoading] = useState(false);
  const geoIngredientCacheRef = useRef<Map<string, string>>(new Map());

  // 选中的食材
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientGeoInfo | null>(null);

  // 知识图谱数据
  const [graphIngredientsData, setGraphIngredientsData] = useState<GraphIngredientData[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const graphCacheRef = useRef<Map<string, GraphIngredientData>>(new Map());
  const graphMarkersRef = useRef<mapboxgl.Marker[]>([]);

  const dishId = Number(params.id);

  // 计算地图中心
  const effectiveDishCenter = dish?.dish_location
    ? { lng: dish.dish_location.longitude, lat: dish.dish_location.latitude }
    : dish?.originCoords
      ? { lng: dish.originCoords[0], lat: dish.originCoords[1] }
      : { lng: 108, lat: 34 };

  // 生成食材点数据
  const ingredientPoints: IngredientPoint[] = ingredientsDistribution.flatMap((ing) => {
    const color = INGREDIENT_COLORS[ing.ingredient] || INGREDIENT_COLORS.default;
    return ing.distribution_locations.map((loc) => ({
      lng: loc.longitude,
      lat: loc.latitude,
      name: loc.name,
      ingredient: ing.ingredient,
      color,
    }));
  });

  // 生成风味数据
  const flavorData = ingredientsDistribution.flatMap((ing) => {
    const flavorMap: Record<string, FlavorType> = {
      "鸡肉": "鲜", "香菇": "鲜", "蘑菇": "鲜", "松子仁": "鲜",
      "鸡汤": "鲜", "猪肉": "咸", "牛肉": "咸", "羊肉": "咸",
      "鱼肉": "鲜", "虾": "鲜", "蟹": "鲜", "火腿": "咸",
      "豆腐": "淡", "豆腐脑": "淡", "青菜": "淡", "白菜": "淡",
    };
    const importanceMap: Record<string, ImportanceLevel> = {
      "鸡肉": "main", "香菇": "main", "蘑菇": "important",
      "火腿": "important", "松子仁": "important",
      "鸡汤": "normal", "猪肉": "normal",
    };
    return ing.distribution_locations.map((loc) => ({
      lng: loc.longitude,
      lat: loc.latitude,
      name: loc.name,
      ingredient: ing.ingredient,
      flavor: flavorMap[ing.ingredient] || "鲜",
      importance: importanceMap[ing.ingredient] || "normal",
      color: FLAVOR_COLORS[flavorMap[ing.ingredient] || "鲜"],
    }));
  });

  // 构建食材地理信息
  const ingredientGeoInfo: Record<string, IngredientGeoInfo> = (() => {
    const info: Record<string, IngredientGeoInfo> = {};
    ingredientsDistribution.forEach((ing) => {
      const locations = ing.distribution_locations;
      if (locations.length > 0) {
        const geoCondition = locations.map((loc) => `${loc.name}：${loc.note}`).join("；");
        info[locations[0].name] = {
          name: locations[0].name,
          ingredient: ing.ingredient,
          color: INGREDIENT_COLORS[ing.ingredient] || INGREDIENT_COLORS.default,
          geoCondition,
        };
      }
    });
    return info;
  })();

  const findIngredientGeoInfo = (name: string): IngredientGeoInfo | null => {
    for (const locName in ingredientGeoInfo) {
      if (locName === name) return ingredientGeoInfo[locName];
    }
    return null;
  };

  // 从知识图谱获取食材地理信息
  const fetchIngredientFromGraph = useCallback(async (ingredientName: string): Promise<GraphIngredientData | null> => {
    const cached = graphCacheRef.current.get(ingredientName);
    if (cached) return cached;

    setGraphLoading(true);
    try {
      const res = await fetch(`/api/dish-ingredients-graph?ingredient=${encodeURIComponent(ingredientName)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.success && data.points && data.points.length > 0) {
        const graphData: GraphIngredientData = {
          ingredient: data.ingredient,
          factors: data.factors,
          points: data.points,
        };
        graphCacheRef.current.set(ingredientName, graphData);
        return graphData;
      }
    } catch { /* ignore */ } finally { setGraphLoading(false); }
    return null;
  }, []);

  // 地理高亮效果
  const applyGeoHighlight = useCallback((preset: GeoPreset | null) => {
    const map = mapRef.current;
    if (!map) return;
    const id = preset?.id;

    if (preset) {
      map.flyTo({ center: preset.flyTo.center, zoom: preset.flyTo.zoom, duration: 1200, essential: true });
    }

    const riverHL = "wst-rivers-highlight";
    const climateHL = "wst-climate-highlight";

    try {
      map.setFilter(riverHL, id ? ["==", ["get", "place"], id] : ["==", ["get", "place"], "__none__"]);
      map.setFilter(climateHL, id ? ["==", ["get", "place"], id] : ["==", ["get", "place"], "__none__"]);
    } catch { /* layers may not exist yet */ }

    if (preset) {
      try {
        map.setPaintProperty(climateHL, "fill-opacity", 0.22);
        window.setTimeout(() => { try { map.setPaintProperty(climateHL, "fill-opacity", 0.12); } catch { /* ignore */ } }, 520);
      } catch { /* ignore */ }
    }
  }, []);

  // 打开地理成因面板
  const openGeoCause = useCallback(async (target: GeoCauseTarget) => {
    setGeoTarget(target);
    setGeoCauseOpen(true);
    setGeoCauseText("");

    const preset = getGeoPreset(target.placeName);
    applyGeoHighlight(preset);

    const cacheKey = `${dish?.name}::${target.ingredient}::${target.placeName}`;
    const cached = geoCauseCacheRef.current.get(cacheKey);
    if (cached) { setGeoCauseText(cached); return; }

    setGeoCauseLoading(true);
    try {
      const res = await fetch("/api/geo-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish: dish?.name, ingredient: target.ingredient, placeName: target.placeName, lng: target.lng, lat: target.lat }),
      });
      const data = await res.json();
      if (data.success && data.content) {
        geoCauseCacheRef.current.set(cacheKey, data.content);
        setGeoCauseText(data.content);
      }
    } catch { /* ignore */ } finally { setGeoCauseLoading(false); }
  }, [dish?.name, applyGeoHighlight]);

  // 处理食材点击（带知识图谱查询）
  const handleIngredientClickWithGraph = useCallback(async (placeName: string, ingredient: string, lng: number, lat: number) => {
    const map = mapRef.current;

    // 1. 从本地数据找地理条件
    const geoInfo = findIngredientGeoInfo(placeName);
    if (geoInfo) {
      setSelectedIngredient(geoInfo);
    }

    // 2. 查询知识图谱
    const graphData = await fetchIngredientFromGraph(ingredient);
    if (graphData && graphData.points.length > 0) {
      setGraphIngredientsData((prev) => {
        const filtered = prev.filter((d) => d.ingredient !== ingredient);
        return [...filtered, graphData!];
      });

      // 添加知识图谱标记
      if (map) {
        graphMarkersRef.current.forEach((m) => m.remove());
        graphMarkersRef.current = [];
        const marker = addGraphGeoMarkers(map, ingredient, graphData.points);
        if (marker) graphMarkersRef.current.push(marker);
      }
    }

    // 3. 触发产地高亮
    const preset = getGeoPreset(placeName);
    applyGeoHighlight(preset);

    // 4. 弹出地理成因面板
    openGeoCause({ ingredient, placeName, lng, lat });
  }, [findIngredientGeoInfo, fetchIngredientFromGraph, applyGeoHighlight, openGeoCause]);

  // 添加知识图谱地理坐标点
  const addGraphGeoMarkers = useCallback((map: mapboxgl.Map, ingredientName: string, points: GraphIngredientPoint[]) => {
    const color = INGREDIENT_COLORS[ingredientName] || "#f4c542";
    const el = document.createElement("div");
    el.style.position = "relative";
    el.style.width = "20px";
    el.style.height = "20px";

    const inner = document.createElement("div");
    inner.style.cssText = `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; border-radius: 50%; background: ${color}; border: 2px solid #f4c542; box-shadow: 0 0 8px 2px ${color}80; animation: graph-pulse 1.8s ease-out infinite;`;

    if (points.length > 0) {
      const pt = points[0];
      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(`<div style="font-family:'Noto Serif SC',serif; font-size:12px;"><div style="color:#f4c542;font-weight:600;margin-bottom:4px;">📍 ${ingredientName} · 图谱坐标</div><div style="color:rgba(255,255,255,0.6);">地区：${pt.region}</div></div>`);

      const marker = new mapboxgl.Marker({ element: el }).setLngLat([pt.lng, pt.lat]).setPopup(popup).addTo(map);
      el.addEventListener("mouseenter", () => marker.getPopup()?.addTo(map));
      el.addEventListener("mouseleave", () => marker.getPopup()?.remove());

      map.flyTo({ center: [pt.lng, pt.lat], zoom: 6, duration: 1400, essential: true });
      return marker;
    }
    return null;
  }, []);

  // 加载菜品数据
  useEffect(() => {
    async function loadDish() {
      setLoading(true);
      try {
        const [fullDetail, basicDish] = await Promise.all([fetchDishFullDetail(dishId), fetchDishBasic(dishId)]);
        if (basicDish) {
          setDish(basicDish);
          if (fullDetail?.ingredients_distribution?.length > 0) {
            setIngredientsDistribution(fullDetail.ingredients_distribution);
          }
          setTimeout(() => setShowContent(true), 300);
        } else {
          setError('菜品未找到');
        }
      } catch (err) { setError('加载失败'); } finally { setLoading(false); }
    }
    if (dishId) loadDish();
  }, [dishId]);

  // 生成图片
  useEffect(() => {
    if (!dish) return;
    const generateImage = async () => {
      setIsGeneratingImage(true);
      try {
        const response = await fetch('/api/generate-dish-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish: dish.name, desc: dish.desc || '', ancient: dish.history || '', method: '' }),
        });
        const data = await response.json();
        if (data.success && data.imageUrl) setImageUrl(data.imageUrl);
      } catch { /* ignore */ } finally { setIsGeneratingImage(false); }
    };
    generateImage();
  }, [dish?.name, dish?.desc, dish?.history]);

  // 构建地图标记
  const buildMarkers = useCallback((map: mapboxgl.Map) => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    dishMarkerRef.current?.remove();

    if (!document.getElementById("wst-marker-styles")) {
      const style = document.createElement("style");
      style.id = "wst-marker-styles";
      style.textContent = `
        .wst-marker-wrap { position: relative; width: 24px; height: 24px; cursor: pointer; }
        .wst-marker-wrap.hidden { display: none !important; }
        .wst-glow-dot { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; border-radius: 50%; animation: wst-pulse 2s ease-out infinite; }
        .wst-outer-ring { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid currentColor; opacity: 0.45; animation: wst-ring 2s ease-out infinite; }
        .wst-marker-label { position: absolute; top: -22px; left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 11px; font-family: "Noto Serif SC", serif; color: rgba(255,255,255,0.85); text-shadow: 0 1px 4px rgba(0,0,0,0.7); pointer-events: none; letter-spacing: 1px; }
        @keyframes wst-pulse { 0% { transform: translate(-50%,-50%) scale(1); opacity: 0.9; } 100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; } }
        @keyframes wst-ring { 0% { transform: translate(-50%,-50%) scale(0.8); opacity: 0.45; } 100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; } }
        .wst-dish-marker-wrap { position: relative; width: 40px; height: 40px; }
        .wst-dish-dot { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle, #f4c542, #d4a017); border: 3px solid rgba(255,255,255,0.9); animation: wst-dish-pulse 2.5s ease-out infinite; }
        .wst-dish-ring { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 36px; height: 36px; border-radius: 50%; border: 2px solid rgba(244,197,66,0.5); animation: wst-ring 2.5s ease-out infinite; }
        @keyframes wst-dish-pulse { 0%,100% { box-shadow: 0 0 12px 4px rgba(244,197,66,0.5); } 50% { box-shadow: 0 0 20px 8px rgba(244,197,66,0.7); } }
        .wst-popup .mapboxgl-popup-content { background: rgba(45,38,32,0.95) !important; border-radius: 8px !important; padding: 10px 14px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important; border: 1px solid rgba(139,90,43,0.3) !important; }
        .wst-popup .mapboxgl-popup-tip { border-top-color: rgba(45,38,32,0.95) !important; }
      `;
      document.head.appendChild(style);
    }

    ingredientPoints.forEach((pt) => {
      const el = document.createElement("div");
      el.className = "wst-marker-wrap";
      el.style.color = pt.color;

      const label = document.createElement("div");
      label.className = "wst-marker-label";
      label.textContent = pt.name;
      el.appendChild(label);

      const dot = document.createElement("div");
      dot.className = "wst-glow-dot";
      dot.style.background = pt.color;
      dot.style.boxShadow = `0 0 6px 2px ${pt.color}`;
      el.appendChild(dot);

      const ring = document.createElement("div");
      ring.className = "wst-outer-ring";
      ring.style.borderColor = pt.color;
      el.appendChild(ring);

      const popup = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: false, className: "wst-popup" }).setHTML(`<div style="font-family:'Noto Serif SC',serif;"><div style="color:#f4c542;font-size:13px;font-weight:600;margin-bottom:4px;letter-spacing:1px;">${pt.name}</div><div style="color:rgba(255,255,255,0.6);font-size:11px;">${pt.ingredient}</div></div>`);

      const marker = new mapboxgl.Marker({ element: el }).setLngLat([pt.lng, pt.lat]).setPopup(popup).addTo(map);
      el.addEventListener("mouseenter", () => marker.getPopup()?.addTo(map));
      el.addEventListener("mouseleave", () => marker.getPopup()?.remove());
      el.addEventListener("click", (ev) => { ev.stopPropagation(); handleIngredientClickWithGraph(pt.name, pt.ingredient, pt.lng, pt.lat); });

      markersRef.current.push(marker);
    });

    const dishEl = document.createElement("div");
    dishEl.className = "wst-dish-marker-wrap";
    const dishDot = document.createElement("div");
    dishDot.className = "wst-dish-dot";
    dishEl.appendChild(dishDot);
    const dishRing = document.createElement("div");
    dishRing.className = "wst-dish-ring";
    dishEl.appendChild(dishRing);

    const dishPopup = new mapboxgl.Popup({ offset: 22, closeButton: false, closeOnClick: false, className: "wst-popup" }).setHTML(`<div style="font-family:'Noto Serif SC',serif;"><div style="color:#f4c542;font-size:13px;font-weight:600;margin-bottom:4px;">${dish?.name || ''}</div><div style="color:rgba(255,255,255,0.6);font-size:11px;">${dish?.dish_location?.origin || '江南·随园'}</div></div>`);

    dishMarkerRef.current = new mapboxgl.Marker({ element: dishEl }).setLngLat([effectiveDishCenter.lng, effectiveDishCenter.lat]).setPopup(dishPopup).addTo(map);
    dishMarkerRef.current.togglePopup();

    if (ingredientPoints.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      ingredientPoints.forEach((pt) => bounds.extend([pt.lng, pt.lat]));
      bounds.extend([effectiveDishCenter.lng, effectiveDishCenter.lat]);
      map.fitBounds(bounds, { padding: { top: 80, bottom: 100, left: 60, right: 60 }, duration: 2000 });
    }
  }, [ingredientPoints, dish?.name, dish?.dish_location, effectiveDishCenter, handleIngredientClickWithGraph]);

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !dish) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [effectiveDishCenter.lng, effectiveDishCenter.lat],
      zoom: 4,
      attributionControl: false,
      logoPosition: "bottom-right",
      projection: "mercator",
      minZoom: 2,
      maxZoom: 10,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      setMapLoaded(true);

      map.getStyle().layers?.forEach((layer: any) => {
        if (layer.layout?.["text-field"]) map.setLayoutProperty(layer.id, "text-field", ["get", "name_zh-Hans"]);
        if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", "#e8dcc8");
      });

      // 河流数据
      if (!map.getSource("wst-rivers")) {
        map.addSource("wst-rivers", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [
            { type: "Feature", properties: { place: "nanjing", name: "长江" }, geometry: { type: "LineString", coordinates: [[116.8, 31.6], [118.2, 31.9], [118.78, 32.06], [119.6, 32.2]] } },
            { type: "Feature", properties: { place: "gaoyou", name: "京杭大运河" }, geometry: { type: "LineString", coordinates: [[118.9, 33.2], [119.1, 32.95], [119.45, 32.78]] } },
            { type: "Feature", properties: { place: "jinhua", name: "婺江" }, geometry: { type: "LineString", coordinates: [[118.7, 29.0], [119.65, 29.09], [120.0, 29.25]] } },
            { type: "Feature", properties: { place: "qingyuan", name: "瓯江" }, geometry: { type: "LineString", coordinates: [[118.6, 27.4], [119.07, 27.63]] } },
            { type: "Feature", properties: { place: "yichun", name: "松花江" }, geometry: { type: "LineString", coordinates: [[126.2, 47.2], [128.9, 47.73]] } },
          ] },
        });
      }
      if (!map.getLayer("wst-rivers-base")) map.addLayer({ id: "wst-rivers-base", type: "line", source: "wst-rivers", paint: { "line-color": "rgba(60,140,220,0.45)", "line-width": 2, "line-opacity": 0.22 } });
      if (!map.getLayer("wst-rivers-highlight")) map.addLayer({ id: "wst-rivers-highlight", type: "line", source: "wst-rivers", filter: ["==", ["get", "place"], "__none__"], paint: { "line-color": "rgba(214,170,72,0.98)", "line-width": 3.5, "line-opacity": 0.92, "line-dasharray": [1, 2] } });

      // 气候数据
      if (!map.getSource("wst-climate")) {
        map.addSource("wst-climate", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [
            { type: "Feature", properties: { zone: "humid", place: "jinhua" }, geometry: { type: "Polygon", coordinates: [[[105.0, 22.0], [123.5, 22.0], [123.5, 32.5], [105.0, 32.5], [105.0, 22.0]]] } },
            { type: "Feature", properties: { zone: "humid", place: "qingyuan" }, geometry: { type: "Polygon", coordinates: [[[105.0, 22.0], [123.5, 22.0], [123.5, 32.5], [105.0, 32.5], [105.0, 22.0]]] } },
            { type: "Feature", properties: { zone: "humid", place: "gaoyou" }, geometry: { type: "Polygon", coordinates: [[[105.0, 22.0], [123.5, 22.0], [123.5, 32.5], [105.0, 32.5], [105.0, 22.0]]] } },
            { type: "Feature", properties: { zone: "dry", place: "yichun" }, geometry: { type: "Polygon", coordinates: [[[100.0, 33.0], [135.0, 33.0], [135.0, 54.0], [100.0, 54.0], [100.0, 33.0]]] } },
          ] },
        });
      }
      if (!map.getLayer("wst-climate-highlight")) map.addLayer({ id: "wst-climate-highlight", type: "fill", source: "wst-climate", filter: ["==", ["get", "place"], "__none__"], paint: { "fill-color": ["match", ["get", "zone"], "humid", "rgba(100,200,120,0.9)", "dry", "rgba(230,210,90,0.9)", "rgba(200,200,200,0.6)"], "fill-opacity": 0.12 } });

      buildMarkers(map);
    });

    mapRef.current = map;
    return () => { if (flowAnimRef.current) cancelAnimationFrame(flowAnimRef.current); markersRef.current.forEach((m) => m.remove()); dishMarkerRef.current?.remove(); graphMarkersRef.current.forEach((m) => m.remove()); map.remove(); mapRef.current = null; };
  }, [dish, effectiveDishCenter, buildMarkers]);

  // 处理 tab 切换
  useEffect(() => {
    if (activeTab === "geo") {
      markersRef.current.forEach((m) => { const el = m.getElement(); if (el) el.classList.add("hidden"); });
      dishMarkerRef.current?.getElement().classList.add("hidden");
      setGeoCauseOpen(false);
      applyGeoHighlight(null);
    } else if (activeTab === "ingredients") {
      markersRef.current.forEach((m) => { const el = m.getElement(); if (el) el.classList.remove("hidden"); });
      dishMarkerRef.current?.getElement().classList.remove("hidden");
    }
  }, [activeTab, applyGeoHighlight]);

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, fontFamily: '"Noto Serif SC", "SimSun", serif' }}>
        <div style={{ width: 40, height: 40, background: "#332c28", borderRadius: "50%", filter: "blur(8px)", animation: "pulse 1.5s infinite" }} />
        <div style={{ fontSize: 18, color: "#8b5a2b", letterSpacing: 4 }}>正在翻阅食单...</div>
        <style>{`@keyframes pulse { 0%,100% { transform: scale(0.8); opacity: 0.3; } 50% { transform: scale(1.3); opacity: 0.6; } }`}</style>
      </div>
    );
  }

  if (error || !dish) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: '"Noto Serif SC", "SimSun", serif' }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 60, height: 60, background: "rgba(139,90,43,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#8b5a2b", margin: "0 auto 20px" }}>!</div>
          <h2 style={{ fontSize: 20, color: "#8b5a2b", letterSpacing: 4, margin: "0 0 30px" }}>{error || '菜品未找到'}</h2>
          <button onClick={() => router.push("/chat")} style={{ background: "rgba(255,252,245,0.88)", border: "1px solid #8b5a2b", color: "#8b5a2b", padding: "10px 24px", borderRadius: 3, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>「 返回随园 」</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#e8dcc8", overflow: "hidden", fontFamily: '"Noto Serif SC", "SimSun", serif' }}>
      {/* 地图 */}
      <div ref={mapContainerRef} className="dish-detail-map" style={{ position: "absolute", inset: 0 }} />

      {/* 粒子动画 */}
      <ParticleCanvas ingredientPoints={ingredientPoints} dishCenterLng={effectiveDishCenter.lng} dishCenterLat={effectiveDishCenter.lat} mapRef={mapRef} visible={activeTab === "geo"} containerRef={mapContainerRef} onIngredientClick={(name, ingredient, color) => { const pt = ingredientPoints.find(p => p.name === name); if (pt) handleIngredientClickWithGraph(name, ingredient, pt.lng, pt.lat); }} />

      {/* 风味扩散 */}
      <FlavorDiffusionCanvas ingredientData={flavorData} dishCenterLng={effectiveDishCenter.lng} dishCenterLat={effectiveDishCenter.lat} mapRef={mapRef} visible={activeTab === "flavor"} containerRef={mapContainerRef} />

      {/* 顶部导航 */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 300, opacity: showContent ? 1 : 0, transition: "all 0.7s ease" }}>
        <button onClick={() => router.push("/chat")} style={{ background: "rgba(255,252,245,0.88)", backdropFilter: "blur(8px)", border: "1px solid rgba(139,90,43,0.3)", color: "#8b5a2b", padding: "7px 20px", borderRadius: 3, cursor: "pointer", fontSize: 14, fontFamily: "inherit", letterSpacing: "2px", transition: "all 0.25s" }}>「 返回随园 」</button>
        <div style={{ background: "rgba(255,252,245,0.75)", backdropFilter: "blur(8px)", padding: "7px 20px", letterSpacing: "6px", fontSize: 13, color: "rgba(139,90,43,0.7)", fontWeight: 600 }}>清 · 袁枚</div>
      </nav>

      {/* 标题卡片 */}
      <div style={{ position: "fixed", top: 90, left: 48, zIndex: 200, background: "rgba(45,38,32,0.88)", backdropFilter: "blur(20px)", border: "1px solid rgba(139,90,43,0.35)", borderRadius: 12, padding: "24px 32px", maxWidth: 340, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", opacity: showContent ? 1 : 0, transform: showContent ? "translateY(0)" : "translateY(-16px)", transition: "all 0.8s cubic-bezier(0.23,1,0.32,1)", transitionDelay: "0.2s" }}>
        <div style={{ color: "rgba(244,197,66,0.7)", fontSize: 11, letterSpacing: "4px", marginBottom: 10 }}>随园食单 · 珍馐</div>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, margin: "0 0 12px", letterSpacing: "4px", borderBottom: "1px solid rgba(139,90,43,0.3)", paddingBottom: 12 }}>{dish.name}</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.9, margin: 0, letterSpacing: "0.5px" }}>{dish.desc}</p>
        {dish.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {dish.tags.map((tag) => (
              <span key={tag} style={{ background: "rgba(139,90,43,0.25)", border: "1px solid rgba(139,90,43,0.3)", color: "rgba(244,197,66,0.85)", padding: "3px 10px", borderRadius: 12, fontSize: 12, letterSpacing: "1px" }}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* 袁枚原文 */}
      {dish.history && (
        <div style={{ position: "fixed", bottom: 80, left: 48, zIndex: 200, maxWidth: 360, background: "rgba(255,252,245,0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(139,90,43,0.25)", borderRadius: 10, padding: "18px 22px", borderLeft: "4px solid #8b5a2b", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", opacity: showContent ? 1 : 0, transform: showContent ? "translateY(0)" : "translateY(16px)", transition: "all 0.8s cubic-bezier(0.23,1,0.32,1)", transitionDelay: "0.4s" }}>
          <div style={{ color: "#8b5a2b", fontSize: 11, letterSpacing: "3px", marginBottom: 10 }}>袁枚原文</div>
          <p style={{ color: "#3a3430", fontSize: 13, lineHeight: 2, margin: 0, fontStyle: "italic" }}>{dish.history}</p>
        </div>
      )}

      {/* 底部统计栏 */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 48px", background: "rgba(45,38,32,0.8)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(139,90,43,0.2)", display: "flex", alignItems: "center", gap: 32, zIndex: 200, opacity: showContent ? 1 : 0, transition: "all 0.8s ease", transitionDelay: "0.5s" }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: "2px" }}>食材 {ingredientsDistribution.length || dish.ingredients?.length || 0} 种</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: "2px" }}>产地 {ingredientsDistribution.reduce((sum, d) => sum + d.distribution_locations.length, 0)} 处</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {Object.entries(INGREDIENT_COLORS).slice(0, 8).map(([name, color]) => (
            <div key={name} title={name} style={{ width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, cursor: "default" }} />
          ))}
        </div>
      </div>

      {/* 浮动对话框 - 完整集成王太守八宝豆腐的功能 */}
      <FloatingDialog
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as ActiveTab)}
        ingredientColors={INGREDIENT_COLORS}
        ingredientGeoInfo={ingredientGeoInfo}
        selectedIngredient={selectedIngredient}
        onIngredientSelect={(name) => {
          if (!name) { setSelectedIngredient(null); setGeoCauseOpen(false); setGeoTarget(null); }
          else { const info = findIngredientGeoInfo(name); if (info) setSelectedIngredient(info); }
        }}
        geoIngredientDetail={geoIngredientDetail}
        geoIngredientLoading={geoIngredientLoading}
        geoCauseTarget={geoTarget}
        geoCauseText={geoCauseText}
        geoCauseLoading={geoCauseLoading}
        onGeoCauseClear={() => { setGeoTarget(null); setGeoCauseText(""); setSelectedIngredient(null); }}
        graphIngredientsData={graphIngredientsData}
        graphLoading={graphLoading}
        onGraphIngredientClick={(ingredient, points) => {
          if (points.length > 0 && mapRef.current) {
            const pt = points[0];
            mapRef.current.flyTo({ center: [pt.lng, pt.lat], zoom: 6, duration: 1400, essential: true });
          }
        }}
      />

      {/* 古今对比 */}
      <CookingCompareOverlay open={cookingMode} onClose={() => setCookingMode(false)} dishTitle={dish.name} />

      <style>{`
        .dish-detail-map .mapboxgl-canvas { outline: none !important; }
        .wst-marker-wrap:hover { z-index: 999 !important; }
      `}</style>
    </div>
  );
}
