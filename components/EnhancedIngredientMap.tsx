"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import ParticleCanvas, { type IngredientPoint } from "./ParticleCanvas";
import FlavorDiffusionCanvas, { type FlavorType, type ImportanceLevel } from "./FlavorDiffusionCanvas";

export interface IngredientGeoInfo {
  name: string;
  ingredient: string;
  color: string;
  geoCondition: string;
}

export interface GraphIngredientData {
  ingredient: string;
  factors: string[];
  points: Array<{
    region: string;
    lat: number;
    lng: number;
    desc: string;
    factor: string;
  }>;
}

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
    return {
      id: "gaoyou",
      flyTo: { center: [119.45, 32.78], zoom: 7.2 },
      rivers: ["京杭大运河", "长江下游水系"],
      terrain: ["里下河平原", "湖荡与圩田"],
      climate: ["江淮湿润季风"],
      notes: ["水网密、湿度高，利于家禽养殖与鲜味积累"],
    };
  }
  if (lower.includes("金华") || lower.includes("浙江")) {
    return {
      id: "jinhua",
      flyTo: { center: [119.65, 29.09], zoom: 7.6 },
      rivers: ["钱塘江水系（婺江）"],
      terrain: ["金衢盆地"],
      climate: ["亚热带湿润季风", "冬季相对干冷时段"],
      notes: ["盆地通风与冬季干燥期，常用于腌腊风干工艺"],
    };
  }
  if (lower.includes("庆元") || lower.includes("丽水") || lower.includes("浙江")) {
    return {
      id: "qingyuan",
      flyTo: { center: [119.07, 27.63], zoom: 7.6 },
      rivers: ["瓯江上游支流"],
      terrain: ["浙南山地", "林地覆盖"],
      climate: ["湿润多雨", "昼夜温差（山地）"],
      notes: ["林下湿润与温差更利于食用菌栽培环境稳定"],
    };
  }
  if (lower.includes("伊春") || lower.includes("黑龙江") || lower.includes("东北")) {
    return {
      id: "yichun",
      flyTo: { center: [128.9, 47.73], zoom: 6.9 },
      rivers: ["松花江水系"],
      terrain: ["小兴安岭山地林海"],
      climate: ["寒温带季风", "夏季昼长、光照足"],
      notes: ["森林生态与冷凉气候，常与坚果类成熟和风味形成相关"],
    };
  }
  if (lower.includes("南京") || lower.includes("江苏")) {
    return {
      id: "nanjing",
      flyTo: { center: [118.78, 32.06], zoom: 7.2 },
      rivers: ["长江", "秦淮河"],
      terrain: ["宁镇丘陵与滨江平原"],
      climate: ["江淮湿润季风"],
      notes: ["大江水系与城市饮食吊汤传统相互促成"],
    };
  }
  if (lower.includes("宣威") || lower.includes("云南")) {
    return {
      id: "xuanwei",
      flyTo: { center: [104.10, 26.22], zoom: 7.2 },
      rivers: ["牛栏江流域"],
      terrain: ["云贵高原", "乌蒙山区"],
      climate: ["高原季风气候", "昼夜温差大"],
      notes: ["高海拔与独特气候，利于火腿腌制风干"],
    };
  }
  if (lower.includes("延边") || lower.includes("长白山") || lower.includes("吉林")) {
    return {
      id: "yanbian",
      flyTo: { center: [128.04, 41.93], zoom: 7.2 },
      rivers: ["图们江水系"],
      terrain: ["长白山脉", "原始森林"],
      climate: ["温带季风", "冬季严寒漫长"],
      notes: ["原始森林生态环境，红松籽品质优良"],
    };
  }
  return null;
}

interface EnhancedIngredientMapProps {
  dishName: string;
  dishCenterLng?: number;
  dishCenterLat?: number;
  ingredientsDistribution: Array<{
    ingredient: string;
    category: string;
    distribution_locations: Array<{
      name: string;
      longitude: number;
      latitude: number;
      note: string;
    }>;
  }>;
  dishLocation?: {
    name: string;
    origin: string;
    longitude: number;
    latitude: number;
    note: string;
  };
  onIngredientClick?: (ingredient: string, placeName: string, lng: number, lat: number) => void;
  activeTab?: "geo" | "ingredients" | "flavor";
}

export default function EnhancedIngredientMap({
  dishName,
  dishCenterLng = 120.15,
  dishCenterLat = 30.28,
  ingredientsDistribution,
  dishLocation,
  onIngredientClick,
  activeTab = "geo",
}: EnhancedIngredientMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const dishMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const flowAnimRef = useRef<number | null>(null);
  const [particleVisible, setParticleVisible] = useState(true);
  const [flavorParticleVisible, setFlavorParticleVisible] = useState(false);
  const graphMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // 计算地图中心
  const effectiveDishCenter = dishLocation
    ? { lng: dishLocation.longitude, lat: dishLocation.latitude }
    : { lng: dishCenterLng, lat: dishCenterLat };

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

  // 处理食材点击
  const handleIngredientClick = useCallback(
    (placeName: string, ingredient: string, lng: number, lat: number) => {
      if (onIngredientClick) {
        onIngredientClick(ingredient, placeName, lng, lat);
      }
    },
    [onIngredientClick]
  );

  // 地理高亮效果
  const applyGeoHighlight = useCallback((preset: GeoPreset | null) => {
    const map = mapRef.current;
    if (!map) return;
    const id = preset?.id;

    if (preset) {
      map.flyTo({ center: preset.flyTo.center, zoom: preset.flyTo.zoom, duration: 1200, essential: true });
    }

    const riverHL = "wst-rivers-highlight";
    const basinHL = "wst-basins-outline";
    const climateHL = "wst-climate-highlight";

    try {
      map.setFilter(riverHL, id ? ["==", ["get", "place"], id] : ["==", ["get", "place"], "__none__"]);
      map.setFilter(basinHL, id ? ["==", ["get", "place"], id] : ["==", ["get", "place"], "__none__"]);
      map.setFilter(climateHL, id ? ["==", ["get", "place"], id] : ["==", ["get", "place"], "__none__"]);
    } catch { /* layers may not exist yet */ }

    if (preset) {
      try {
        map.setPaintProperty(climateHL, "fill-opacity", 0.22);
        window.setTimeout(() => {
          try { map.setPaintProperty(climateHL, "fill-opacity", 0.12); } catch { /* ignore */ }
        }, 520);
      } catch { /* ignore */ }
    }
  }, []);

  // 构建地图标记
  const buildMarkers = useCallback(
    (map: mapboxgl.Map) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      dishMarkerRef.current?.remove();

      // 注入样式
      if (!document.getElementById("eim-marker-styles")) {
        const style = document.createElement("style");
        style.id = "eim-marker-styles";
        style.textContent = `
          .eim-marker-wrap { position: relative; width: 24px; height: 24px; cursor: pointer; }
          .eim-marker-wrap.hidden { display: none !important; }
          .eim-glow-dot {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 10px; height: 10px; border-radius: 50%;
            box-shadow: 0 0 6px 2px currentColor;
            animation: eim-pulse 2s ease-out infinite;
          }
          .eim-outer-ring {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 20px; height: 20px; border-radius: 50%;
            border: 1.5px solid currentColor;
            opacity: 0.45;
            animation: eim-ring 2s ease-out infinite;
          }
          .eim-marker-label {
            position: absolute; top: -22px; left: 50%;
            transform: translateX(-50%);
            white-space: nowrap;
            font-size: 11px;
            font-family: "Noto Serif SC", serif;
            color: rgba(255,255,255,0.85);
            text-shadow: 0 1px 4px rgba(0,0,0,0.7);
            pointer-events: none;
            letter-spacing: 1px;
          }
          @keyframes eim-pulse {
            0% { transform: translate(-50%,-50%) scale(1); opacity: 0.9; }
            100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
          }
          @keyframes eim-ring {
            0% { transform: translate(-50%,-50%) scale(0.8); opacity: 0.45; }
            100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
          }
          .eim-dish-marker-wrap { position: relative; width: 40px; height: 40px; cursor: default; }
          .eim-dish-dot {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            width: 22px; height: 22px; border-radius: 50%;
            background: radial-gradient(circle, #f4c542, #d4a017);
            border: 3px solid rgba(255,255,255,0.9);
            box-shadow: 0 0 12px 4px rgba(244,197,66,0.5), 0 2px 8px rgba(0,0,0,0.4);
            animation: eim-dish-pulse 2.5s ease-out infinite;
          }
          .eim-dish-ring {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            width: 36px; height: 36px; border-radius: 50%;
            border: 2px solid rgba(244,197,66,0.5);
            animation: eim-ring 2.5s ease-out infinite;
          }
          @keyframes eim-dish-pulse {
            0%,100% { box-shadow: 0 0 12px 4px rgba(244,197,66,0.5), 0 2px 8px rgba(0,0,0,0.4); }
            50% { box-shadow: 0 0 20px 8px rgba(244,197,66,0.7), 0 2px 8px rgba(0,0,0,0.4); }
          }
          .eim-popup .mapboxgl-popup-content {
            background: rgba(45,38,32,0.95) !important;
            border-radius: 8px !important;
            padding: 10px 14px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
            border: 1px solid rgba(139,90,43,0.3) !important;
          }
          .eim-popup .mapboxgl-popup-tip { border-top-color: rgba(45,38,32,0.95) !important; }
        `;
        document.head.appendChild(style);
      }

      // 创建食材标记
      ingredientPoints.forEach((pt) => {
        const el = document.createElement("div");
        el.className = "eim-marker-wrap";
        el.style.color = pt.color;

        const label = document.createElement("div");
        label.className = "eim-marker-label";
        label.textContent = pt.name;
        el.appendChild(label);

        const dot = document.createElement("div");
        dot.className = "eim-glow-dot";
        dot.style.background = pt.color;
        dot.style.boxShadow = `0 0 6px 2px ${pt.color}`;
        el.appendChild(dot);

        const ring = document.createElement("div");
        ring.className = "eim-outer-ring";
        ring.style.borderColor = pt.color;
        el.appendChild(ring);

        const popup = new mapboxgl.Popup({
          offset: 18,
          closeButton: false,
          closeOnClick: false,
          className: "eim-popup",
        }).setHTML(`
          <div style="font-family:'Noto Serif SC',serif;">
            <div style="color:#f4c542;font-size:13px;font-weight:600;margin-bottom:4px;letter-spacing:1px;">
              ${pt.name}
            </div>
            <div style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:0.5px;">
              ${pt.ingredient}
            </div>
          </div>
        `);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([pt.lng, pt.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("mouseenter", () => marker.getPopup()?.addTo(map));
        el.addEventListener("mouseleave", () => marker.getPopup()?.remove());
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          handleIngredientClick(pt.name, pt.ingredient, pt.lng, pt.lat);
          
          // 触发地理高亮
          const preset = getGeoPreset(pt.name);
          applyGeoHighlight(preset);
        });

        // 默认隐藏，在 ingredients tab 显示
        el.classList.add("hidden");
        markersRef.current.push(marker);
      });

      // 创建菜品标记
      const dishEl = document.createElement("div");
      dishEl.className = "eim-dish-marker-wrap";
      const dishDot = document.createElement("div");
      dishDot.className = "eim-dish-dot";
      dishEl.appendChild(dishDot);
      const dishRing = document.createElement("div");
      dishRing.className = "eim-dish-ring";
      dishEl.appendChild(dishRing);

      const dishPopup = new mapboxgl.Popup({
        offset: 22,
        closeButton: false,
        closeOnClick: false,
        className: "eim-popup",
      }).setHTML(`
        <div style="font-family:'Noto Serif SC',serif;">
          <div style="color:#f4c542;font-size:13px;font-weight:600;margin-bottom:4px;letter-spacing:1px;">
            ${dishName}
          </div>
          <div style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:0.5px;">
            ${dishLocation?.origin || "江南·随园"}
          </div>
        </div>
      `);

      dishMarkerRef.current = new mapboxgl.Marker({ element: dishEl })
        .setLngLat([effectiveDishCenter.lng, effectiveDishCenter.lat])
        .setPopup(dishPopup)
        .addTo(map);
      dishMarkerRef.current.togglePopup();

      // 调整视野
      if (ingredientPoints.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        ingredientPoints.forEach((pt) => bounds.extend([pt.lng, pt.lat]));
        bounds.extend([effectiveDishCenter.lng, effectiveDishCenter.lat]);
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 100, left: 60, right: 60 },
          duration: 2000,
        });
      }
    },
    [ingredientPoints, dishName, dishLocation, effectiveDishCenter, handleIngredientClick, applyGeoHighlight]
  );

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      return;
    }

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

      // 设置中文标签
      map.getStyle().layers?.forEach((layer: any) => {
        if (layer.layout?.["text-field"]) {
          map.setLayoutProperty(layer.id, "text-field", ["get", "name_zh-Hans"]);
        }
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", "#e8dcc8");
        }
      });

      // 添加河流数据源
      if (!map.getSource("eim-rivers")) {
        map.addSource("eim-rivers", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: { place: "nanjing", kind: "river", name: "长江" },
                geometry: { type: "LineString", coordinates: [[116.8, 31.6], [118.2, 31.9], [118.78, 32.06], [119.6, 32.2], [121.2, 31.4]] } },
              { type: "Feature", properties: { place: "gaoyou", kind: "canal", name: "京杭大运河" },
                geometry: { type: "LineString", coordinates: [[118.9, 33.2], [119.1, 32.95], [119.45, 32.78], [119.6, 32.5], [119.9, 32.2]] } },
              { type: "Feature", properties: { place: "jinhua", kind: "river", name: "婺江" },
                geometry: { type: "LineString", coordinates: [[118.7, 29.0], [119.2, 29.08], [119.65, 29.09], [120.0, 29.25], [120.5, 29.3]] } },
              { type: "Feature", properties: { place: "qingyuan", kind: "river", name: "瓯江上游支流" },
                geometry: { type: "LineString", coordinates: [[118.6, 27.4], [118.85, 27.55], [119.07, 27.63], [119.35, 27.8], [119.6, 27.95]] } },
              { type: "Feature", properties: { place: "yichun", kind: "river", name: "松花江水系" },
                geometry: { type: "LineString", coordinates: [[126.2, 47.2], [127.3, 47.45], [128.9, 47.73], [130.2, 47.85], [131.0, 47.7]] } },
            ],
          },
        });
      }

      // 河流基础层
      if (!map.getLayer("eim-rivers-base")) {
        map.addLayer({
          id: "eim-rivers-base",
          type: "line",
          source: "eim-rivers",
          paint: { "line-color": "rgba(60,140,220,0.45)", "line-width": 2, "line-opacity": 0.22 },
        });
      }
      // 河流高亮层
      if (!map.getLayer("eim-rivers-highlight")) {
        map.addLayer({
          id: "eim-rivers-highlight",
          type: "line",
          source: "eim-rivers",
          filter: ["==", ["get", "place"], "__none__"],
          paint: { "line-color": "rgba(214,170,72,0.98)", "line-width": 3.5, "line-opacity": 0.92, "line-dasharray": [1, 2] },
        });
      }

      // 添加盆地数据
      if (!map.getSource("eim-basins")) {
        map.addSource("eim-basins", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: { place: "jinhua", name: "金衢盆地" },
                geometry: { type: "Polygon", coordinates: [[[118.9, 28.7], [120.3, 28.7], [120.3, 29.6], [118.9, 29.6], [118.9, 28.7]]] } },
            ],
          },
        });
      }
      if (!map.getLayer("eim-basins-outline")) {
        map.addLayer({
          id: "eim-basins-outline",
          type: "line",
          source: "eim-basins",
          filter: ["==", ["get", "place"], "__none__"],
          paint: { "line-color": "rgba(214,170,72,0.9)", "line-width": 2, "line-opacity": 0.8 },
        });
      }

      // 添加气候数据
      if (!map.getSource("eim-climate")) {
        map.addSource("eim-climate", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: { zone: "humid", place: "jinhua" },
                geometry: { type: "Polygon", coordinates: [[[105.0, 22.0], [123.5, 22.0], [123.5, 32.5], [105.0, 32.5], [105.0, 22.0]]] } },
              { type: "Feature", properties: { zone: "humid", place: "qingyuan" },
                geometry: { type: "Polygon", coordinates: [[[105.0, 22.0], [123.5, 22.0], [123.5, 32.5], [105.0, 32.5], [105.0, 22.0]]] } },
              { type: "Feature", properties: { zone: "humid", place: "gaoyou" },
                geometry: { type: "Polygon", coordinates: [[[105.0, 22.0], [123.5, 22.0], [123.5, 32.5], [105.0, 32.5], [105.0, 22.0]]] } },
              { type: "Feature", properties: { zone: "humid", place: "nanjing" },
                geometry: { type: "Polygon", coordinates: [[[105.0, 22.0], [123.5, 22.0], [123.5, 32.5], [105.0, 32.5], [105.0, 22.0]]] } },
              { type: "Feature", properties: { zone: "dry", place: "yichun" },
                geometry: { type: "Polygon", coordinates: [[[100.0, 33.0], [135.0, 33.0], [135.0, 54.0], [100.0, 54.0], [100.0, 33.0]]] } },
            ],
          },
        });
      }
      if (!map.getLayer("eim-climate-highlight")) {
        map.addLayer({
          id: "eim-climate-highlight",
          type: "fill",
          source: "eim-climate",
          filter: ["==", ["get", "place"], "__none__"],
          paint: {
            "fill-color": ["match", ["get", "zone"], "humid", "rgba(100,200,120,0.9)", "dry", "rgba(230,210,90,0.9)", "rgba(200,200,200,0.6)"],
            "fill-opacity": 0.12,
          },
        });
      }

      buildMarkers(map);
    });

    mapRef.current = map;

    return () => {
      if (flowAnimRef.current) cancelAnimationFrame(flowAnimRef.current);
      markersRef.current.forEach((m) => m.remove());
      dishMarkerRef.current?.remove();
      graphMarkersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [effectiveDishCenter, buildMarkers]);

  // 当食材分布数据更新时，重新构建标记
  useEffect(() => {
    if (mapRef.current && mapLoaded && ingredientPoints.length > 0) {
      // 延迟一点确保地图完全准备好
      const timer = setTimeout(() => {
        buildMarkers(mapRef.current!);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [ingredientsDistribution, mapLoaded, buildMarkers]);

  // 处理 tab 切换
  useEffect(() => {
    if (activeTab === "geo") {
      setParticleVisible(true);
      setFlavorParticleVisible(false);
      markersRef.current.forEach((m) => {
        const el = m.getElement();
        if (el) el.classList.add("hidden");
      });
      dishMarkerRef.current?.getElement().classList.add("hidden");
    } else if (activeTab === "ingredients") {
      setParticleVisible(false);
      setFlavorParticleVisible(false);
      markersRef.current.forEach((m) => {
        const el = m.getElement();
        if (el) el.classList.remove("hidden");
      });
      dishMarkerRef.current?.getElement().classList.remove("hidden");
    } else if (activeTab === "flavor") {
      setParticleVisible(false);
      setFlavorParticleVisible(true);
      markersRef.current.forEach((m) => {
        const el = m.getElement();
        if (el) el.classList.add("hidden");
      });
      dishMarkerRef.current?.getElement().classList.add("hidden");
    }
  }, [activeTab]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={mapContainerRef} className="enhanced-ingredient-map" style={{ position: "absolute", inset: 0 }} />

      <ParticleCanvas
        ingredientPoints={ingredientPoints}
        dishCenterLng={effectiveDishCenter.lng}
        dishCenterLat={effectiveDishCenter.lat}
        mapRef={mapRef}
        visible={particleVisible}
        containerRef={mapContainerRef}
        onIngredientClick={handleIngredientClick}
      />

      <FlavorDiffusionCanvas
        ingredientData={flavorData}
        dishCenterLng={effectiveDishCenter.lng}
        dishCenterLat={effectiveDishCenter.lat}
        mapRef={mapRef}
        visible={flavorParticleVisible}
        containerRef={mapContainerRef}
      />

      <style>{`
        .enhanced-ingredient-map .mapboxgl-canvas { outline: none !important; }
        .eim-marker-wrap:hover { z-index: 999 !important; }
      `}</style>
    </div>
  );
}

// 导出颜色映射供外部使用
export { INGREDIENT_COLORS, FLAVOR_COLORS };
