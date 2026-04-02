"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import ParticleCanvas, { type IngredientPoint } from "@/components/ParticleCanvas";
import FlavorDiffusionCanvas, { type FlavorType, type ImportanceLevel } from "@/components/FlavorDiffusionCanvas";
import FloatingDialog from "@/components/FloatingDialog";
import dishData from "@/data/wang_sitai_babao_doufu.json";

const INGREDIENT_COLORS: Record<string, string> = {
  "鸡肉": "#FF6B6B",
  "香菇": "#D4A574",
  "蘑菇": "#C8A882",
  "松子仁": "#8B7355",
  "瓜子仁": "#C9B037",
  "火腿": "#E84545",
  "鸡汤": "#FFB347",
};

const FLAVOR_COLORS: Record<FlavorType, string> = {
  "酸": "#FF6B6B",
  "甜": "#FFB5E8",
  "苦": "#5C7A5C",
  "辣": "#FF4500",
  "咸": "#87CEEB",
  "鲜": "#FFD700",
};

const DISH_CENTER_LNG = 120.15;
const DISH_CENTER_LAT = 30.28;

type ActiveTab = "geo" | "culture" | "ingredients" | "flavor";

type GeoCauseTarget = {
  ingredient: string;
  placeName: string;
  lng: number;
  lat: number;
};

type GeoPreset = {
  id: "gaoyou" | "jinhua" | "qingyuan" | "yichun" | "nanjing";
  flyTo: { center: [number, number]; zoom: number };
  rivers: string[];
  terrain: string[];
  climate: string[];
  notes?: string[];
};

function getGeoPreset(placeName: string): GeoPreset | null {
  if (placeName.includes("高邮")) {
    return {
      id: "gaoyou",
      flyTo: { center: [119.45, 32.78], zoom: 7.2 },
      rivers: ["京杭大运河", "长江下游水系"],
      terrain: ["里下河平原", "湖荡与圩田"],
      climate: ["江淮湿润季风"],
      notes: ["水网密、湿度高，利于家禽养殖与鲜味积累"],
    };
  }
  if (placeName.includes("金华")) {
    return {
      id: "jinhua",
      flyTo: { center: [119.65, 29.09], zoom: 7.6 },
      rivers: ["钱塘江水系（婺江）"],
      terrain: ["金衢盆地（示意）"],
      climate: ["亚热带湿润季风", "冬季相对干冷时段（利于腌制风干）"],
      notes: ["盆地通风与冬季干燥期，常被用于腌腊风干工艺的形成"],
    };
  }
  if (placeName.includes("庆元")) {
    return {
      id: "qingyuan",
      flyTo: { center: [119.07, 27.63], zoom: 7.6 },
      rivers: ["瓯江上游支流（示意）"],
      terrain: ["浙南山地", "林地覆盖"],
      climate: ["湿润多雨", "昼夜温差（山地）"],
      notes: ["林下湿润与温差更利于食用菌栽培环境稳定"],
    };
  }
  if (placeName.includes("伊春")) {
    return {
      id: "yichun",
      flyTo: { center: [128.9, 47.73], zoom: 6.9 },
      rivers: ["松花江水系（示意）"],
      terrain: ["小兴安岭山地林海"],
      climate: ["寒温带季风", "夏季昼长、光照足"],
      notes: ["森林生态与冷凉气候，常与坚果类成熟和风味形成相关"],
    };
  }
  if (placeName.includes("南京")) {
    return {
      id: "nanjing",
      flyTo: { center: [118.78, 32.06], zoom: 7.2 },
      rivers: ["长江", "秦淮河（示意）"],
      terrain: ["宁镇丘陵与滨江平原"],
      climate: ["江淮湿润季风"],
      notes: ["大江水系与城市饮食吊汤传统相互促成"],
    };
  }
  return null;
}

export default function WangSitaiPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("geo");
  const [particleVisible, setParticleVisible] = useState(false);
  const [flavorParticleVisible, setFlavorParticleVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const dishMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [geoTarget, setGeoTarget] = useState<GeoCauseTarget | null>(null);
  const [geoCauseOpen, setGeoCauseOpen] = useState(false);
  const [geoCauseLoading, setGeoCauseLoading] = useState(false);
  const [geoCauseText, setGeoCauseText] = useState<string>("");
  const [geoCauseError, setGeoCauseError] = useState<string>("");
  const geoCauseCacheRef = useRef<Map<string, string>>(new Map());
  const flowAnimRef = useRef<number | null>(null);

  const ingredientPoints: IngredientPoint[] = (
    dishData.ingredients_distribution as Array<{
      ingredient: string;
      distribution_locations: Array<{
        name: string;
        longitude: number;
        latitude: number;
        note: string;
      }>;
    }>
  ).flatMap((ing) =>
    ing.distribution_locations.map((loc) => ({
      lng: loc.longitude,
      lat: loc.latitude,
      name: loc.name,
      ingredient: ing.ingredient,
      color: INGREDIENT_COLORS[ing.ingredient] || "#ffffff",
    }))
  );

  const flavorData = (
    dishData.ingredients_distribution as Array<{
      ingredient: string;
      distribution_locations: Array<{
        name: string;
        longitude: number;
        latitude: number;
        note: string;
      }>;
    }>
  ).flatMap((ing) => {
    const flavorMap: Record<string, FlavorType> = {
      "鸡肉": "鲜",
      "香菇": "鲜",
      "蘑菇": "鲜",
      "松子仁": "鲜",
      "瓜子仁": "咸",
      "火腿": "咸",
      "鸡汤": "鲜",
    };
    const importanceMap: Record<string, ImportanceLevel> = {
      "鸡肉": "main",
      "香菇": "main",
      "蘑菇": "important",
      "松子仁": "important",
      "火腿": "important",
      "瓜子仁": "normal",
      "鸡汤": "normal",
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

  const runFlowAnimation = useCallback((map: mapboxgl.Map, layerId: string) => {
    if (flowAnimRef.current) cancelAnimationFrame(flowAnimRef.current);
    let t = 0;
    const tick = () => {
      t = (t + 1) % 200;
      // 让 dash 位移产生“流动”错觉
      const a = 1 + (t % 20) * 0.1;
      const b = 2 + ((t + 7) % 20) * 0.1;
      try {
        map.setPaintProperty(layerId, "line-dasharray", [a, b]);
      } catch {
        // ignore (map may be gone)
      }
      flowAnimRef.current = requestAnimationFrame(tick);
    };
    flowAnimRef.current = requestAnimationFrame(tick);
  }, []);

  const stopFlowAnimation = useCallback(() => {
    if (flowAnimRef.current) cancelAnimationFrame(flowAnimRef.current);
    flowAnimRef.current = null;
  }, []);

  const applyGeoHighlight = useCallback(
    (preset: GeoPreset | null) => {
      const map = mapRef.current;
      if (!map) return;
      const id = preset?.id;

      // fly to region
      if (preset) {
        map.flyTo({ center: preset.flyTo.center, zoom: preset.flyTo.zoom, duration: 1200, essential: true });
      }

      // filters
      const riverHL = "wst-rivers-highlight";
      const basinHL = "wst-basins-outline";
      const climateHL = "wst-climate-highlight";
      const terrainBase = "wst-terrain";

      try {
        map.setFilter(riverHL, id ? ["==", ["get", "place"], id] : ["==", ["get", "place"], "__none__"]);
        map.setFilter(basinHL, id ? ["==", ["get", "place"], id] : ["==", ["get", "place"], "__none__"]);
        map.setFilter(climateHL, id ? ["==", ["get", "place"], id] : ["==", ["get", "place"], "__none__"]);
        map.setPaintProperty(terrainBase, "fill-opacity", 0);
      } catch {
        // layers may not exist yet
      }

      // flow animation on highlighted river
      if (preset) runFlowAnimation(map, riverHL);
      else stopFlowAnimation();

      // climate flash
      if (preset) {
        try {
          map.setPaintProperty(climateHL, "fill-opacity", 0.22);
          window.setTimeout(() => {
            try {
              map.setPaintProperty(climateHL, "fill-opacity", 0.12);
            } catch {
              // ignore
            }
          }, 520);
        } catch {
          // ignore
        }
      }
    },
    [runFlowAnimation, stopFlowAnimation]
  );

  const openGeoCause = useCallback(
    async (target: GeoCauseTarget) => {
      setGeoTarget(target);
      setGeoCauseOpen(true);
      setGeoCauseError("");

      const preset = getGeoPreset(target.placeName);
      applyGeoHighlight(preset);

      const cacheKey = `${dishData.dish_name}::${target.ingredient}::${target.placeName}`;
      const cached = geoCauseCacheRef.current.get(cacheKey);
      if (cached) {
        setGeoCauseText(cached);
        return;
      }

      setGeoCauseLoading(true);
      setGeoCauseText("");
      try {
        const res = await fetch("/api/geo-cause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dish: dishData.dish_name,
            ingredient: target.ingredient,
            placeName: target.placeName,
            lng: target.lng,
            lat: target.lat,
            context: {
              rivers: preset?.rivers ?? [],
              terrain: preset?.terrain ?? [],
              climate: preset?.climate ?? [],
              notes: preset?.notes ?? [],
            },
          }),
        });
        const data = await res.json();
        if (!data?.success || !data?.content) {
          throw new Error(data?.error || "生成失败");
        }
        geoCauseCacheRef.current.set(cacheKey, data.content);
        setGeoCauseText(data.content);
      } catch (e: any) {
        setGeoCauseError(e?.message || "生成失败");
      } finally {
        setGeoCauseLoading(false);
      }
    },
    [applyGeoHighlight]
  );

  const buildMarkers = useCallback(
    (map: mapboxgl.Map) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      dishMarkerRef.current?.remove();

      if (!document.getElementById("wst-marker-styles")) {
        const style = document.createElement("style");
        style.id = "wst-marker-styles";
        style.textContent = `
          .wst-marker-wrap { position: relative; width: 24px; height: 24px; cursor: pointer; }
          .wst-marker-wrap.hidden { display: none !important; }
          .wst-glow-dot {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 10px; height: 10px; border-radius: 50%;
            box-shadow: 0 0 6px 2px currentColor;
            animation: wst-pulse 2s ease-out infinite;
          }
          .wst-outer-ring {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 20px; height: 20px; border-radius: 50%;
            border: 1.5px solid currentColor;
            opacity: 0.45;
            animation: wst-ring 2s ease-out infinite;
          }
          .wst-marker-label {
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
          @keyframes wst-pulse {
            0% { transform: translate(-50%,-50%) scale(1); opacity: 0.9; }
            100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
          }
          @keyframes wst-ring {
            0% { transform: translate(-50%,-50%) scale(0.8); opacity: 0.45; }
            100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
          }
          .wst-dish-marker-wrap { position: relative; width: 40px; height: 40px; cursor: default; }
          .wst-dish-dot {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            width: 22px; height: 22px; border-radius: 50%;
            background: radial-gradient(circle, #f4c542, #d4a017);
            border: 3px solid rgba(255,255,255,0.9);
            box-shadow: 0 0 12px 4px rgba(244,197,66,0.5), 0 2px 8px rgba(0,0,0,0.4);
            animation: wst-dish-pulse 2.5s ease-out infinite;
          }
          .wst-dish-ring {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            width: 36px; height: 36px; border-radius: 50%;
            border: 2px solid rgba(244,197,66,0.5);
            animation: wst-ring 2.5s ease-out infinite;
          }
          @keyframes wst-dish-pulse {
            0%,100% { box-shadow: 0 0 12px 4px rgba(244,197,66,0.5), 0 2px 8px rgba(0,0,0,0.4); }
            50% { box-shadow: 0 0 20px 8px rgba(244,197,66,0.7), 0 2px 8px rgba(0,0,0,0.4); }
          }
          .wst-popup .mapboxgl-popup-content {
            background: rgba(45,38,32,0.95) !important;
            border-radius: 8px !important;
            padding: 10px 14px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
            border: 1px solid rgba(139,90,43,0.3) !important;
          }
          .wst-popup .mapboxgl-popup-tip { border-top-color: rgba(45,38,32,0.95) !important; }
        `;
        document.head.appendChild(style);
      }

      // Ingredient markers
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

        const popup = new mapboxgl.Popup({
          offset: 18,
          closeButton: false,
          closeOnClick: false,
          className: "wst-popup",
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
          openGeoCause({
            ingredient: pt.ingredient,
            placeName: pt.name,
            lng: pt.lng,
            lat: pt.lat,
          });
        });

        markersRef.current.push(marker);
      });

      // Dish center marker
      const dishEl = document.createElement("div");
      dishEl.className = "wst-dish-marker-wrap";
      const dishDot = document.createElement("div");
      dishDot.className = "wst-dish-dot";
      dishEl.appendChild(dishDot);
      const dishRing = document.createElement("div");
      dishRing.className = "wst-dish-ring";
      dishEl.appendChild(dishRing);

      const dishPopup = new mapboxgl.Popup({
        offset: 22,
        closeButton: false,
        closeOnClick: false,
        className: "wst-popup",
      }).setHTML(`
        <div style="font-family:'Noto Serif SC',serif;">
          <div style="color:#f4c542;font-size:13px;font-weight:600;margin-bottom:4px;letter-spacing:1px;">
            ${dishData.dish_name}
          </div>
          <div style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:0.5px;">
            江南 · 随园
          </div>
        </div>
      `);

      dishMarkerRef.current = new mapboxgl.Marker({ element: dishEl })
        .setLngLat([DISH_CENTER_LNG, DISH_CENTER_LAT])
        .setPopup(dishPopup)
        .addTo(map);
      dishMarkerRef.current.togglePopup();

      // Fit bounds to show all markers — no right padding (full-screen map)
      const bounds = new mapboxgl.LngLatBounds();
      ingredientPoints.forEach((pt) => bounds.extend([pt.lng, pt.lat]));
      bounds.extend([DISH_CENTER_LNG, DISH_CENTER_LAT]);
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 100, left: 60, right: 60 },
        duration: 2000,
      });
    },
    [ingredientPoints, openGeoCause]
  );

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [DISH_CENTER_LNG, DISH_CENTER_LAT],
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

      const navEl = document.querySelector<HTMLElement>(
        ".wang-sitai-map .mapboxgl-ctrl-top-right"
      );
      if (navEl) {
        navEl.style.zIndex = "600";
        navEl.style.top = "14px";
        navEl.style.right = "14px";
      }

      map.getStyle().layers?.forEach((layer: any) => {
        if (layer.layout?.["text-field"]) {
          map.setLayoutProperty(layer.id, "text-field", ["get", "name_zh-Hans"]);
        }
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", "#e8dcc8");
        }
      });

      // --- 地理成因：面状/线状标注图层（示意） ---
      // 水系（示意）
      if (!map.getSource("wst-rivers")) {
        map.addSource("wst-rivers", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              // 南京：长江（示意线）
              {
                type: "Feature",
                properties: { place: "nanjing", kind: "river", name: "长江" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [116.8, 31.6],
                    [118.2, 31.9],
                    [118.78, 32.06],
                    [119.6, 32.2],
                    [121.2, 31.4],
                  ],
                },
              },
              // 高邮：大运河（示意线）
              {
                type: "Feature",
                properties: { place: "gaoyou", kind: "canal", name: "京杭大运河" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [118.9, 33.2],
                    [119.1, 32.95],
                    [119.45, 32.78],
                    [119.6, 32.5],
                    [119.9, 32.2],
                  ],
                },
              },
              // 金华：婺江（示意线）
              {
                type: "Feature",
                properties: { place: "jinhua", kind: "river", name: "婺江" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [118.7, 29.0],
                    [119.2, 29.08],
                    [119.65, 29.09],
                    [120.0, 29.25],
                    [120.5, 29.3],
                  ],
                },
              },
              // 庆元：浙南山溪（示意线）
              {
                type: "Feature",
                properties: { place: "qingyuan", kind: "river", name: "瓯江上游支流" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [118.6, 27.4],
                    [118.85, 27.55],
                    [119.07, 27.63],
                    [119.35, 27.8],
                    [119.6, 27.95],
                  ],
                },
              },
              // 伊春：松花江水系（示意线）
              {
                type: "Feature",
                properties: { place: "yichun", kind: "river", name: "松花江水系" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [126.2, 47.2],
                    [127.3, 47.45],
                    [128.9, 47.73],
                    [130.2, 47.85],
                    [131.0, 47.7],
                  ],
                },
              },
            ],
          },
        });
      }

      if (!map.getLayer("wst-rivers-base")) {
        map.addLayer({
          id: "wst-rivers-base",
          type: "line",
          source: "wst-rivers",
          paint: {
            "line-color": "rgba(60,140,220,0.45)",
            "line-width": 2,
            "line-opacity": 0.22,
          },
        });
      }
      if (!map.getLayer("wst-rivers-highlight")) {
        map.addLayer({
          id: "wst-rivers-highlight",
          type: "line",
          source: "wst-rivers",
          filter: ["==", ["get", "place"], "__none__"],
          paint: {
            "line-color": "rgba(214,170,72,0.98)",
            "line-width": 3.5,
            "line-opacity": 0.92,
            "line-dasharray": [1, 2],
          },
        });
      }

      // 地形（示意：低海拔浅色、高海拔深色）
      if (!map.getSource("wst-terrain")) {
        map.addSource("wst-terrain", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              // 东部低海拔（示意）
              {
                type: "Feature",
                properties: { elev: 120 },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [108.0, 20.0],
                      [123.0, 20.0],
                      [123.0, 35.5],
                      [108.0, 35.5],
                      [108.0, 20.0],
                    ],
                  ],
                },
              },
              // 东北山地/林海（示意）
              {
                type: "Feature",
                properties: { elev: 620 },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [122.0, 41.0],
                      [135.0, 41.0],
                      [135.0, 53.0],
                      [122.0, 53.0],
                      [122.0, 41.0],
                    ],
                  ],
                },
              },
              // 西部高海拔（示意）
              {
                type: "Feature",
                properties: { elev: 2400 },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [73.5, 18.0],
                      [108.0, 18.0],
                      [108.0, 54.0],
                      [73.5, 54.0],
                      [73.5, 18.0],
                    ],
                  ],
                },
              },
            ],
          },
        });
      }
      if (!map.getLayer("wst-terrain")) {
        map.addLayer({
          id: "wst-terrain",
          type: "fill",
          source: "wst-terrain",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "elev"],
              0,
              "rgba(210,230,210,0.75)",
              800,
              "rgba(200,210,230,0.75)",
              3000,
              "rgba(210,200,230,0.75)",
            ],
            "fill-opacity": 0,
          },
        });
      }

      // 盆地范围（示意：金衢盆地）
      if (!map.getSource("wst-basins")) {
        map.addSource("wst-basins", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { place: "jinhua", name: "金衢盆地（示意）" },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [118.9, 28.7],
                      [120.3, 28.7],
                      [120.3, 29.6],
                      [118.9, 29.6],
                      [118.9, 28.7],
                    ],
                  ],
                },
              },
            ],
          },
        });
      }
      if (!map.getLayer("wst-basins-fill")) {
        map.addLayer({
          id: "wst-basins-fill",
          type: "fill",
          source: "wst-basins",
          paint: {
            "fill-color": "rgba(140,200,140,0.7)",
            "fill-opacity": 0,
          },
        });
      }
      if (!map.getLayer("wst-basins-outline")) {
        map.addLayer({
          id: "wst-basins-outline",
          type: "line",
          source: "wst-basins",
          filter: ["==", ["get", "place"], "__none__"],
          paint: {
            "line-color": "rgba(214,170,72,0.9)",
            "line-width": 2,
            "line-opacity": 0.8,
          },
        });
      }

      // 气候示意（湿润 vs 干燥，粗略分区）
      if (!map.getSource("wst-climate")) {
        map.addSource("wst-climate", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { zone: "humid", place: "jinhua" },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [105.0, 22.0],
                      [123.5, 22.0],
                      [123.5, 32.5],
                      [105.0, 32.5],
                      [105.0, 22.0],
                    ],
                  ],
                },
              },
              {
                type: "Feature",
                properties: { zone: "humid", place: "qingyuan" },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [105.0, 22.0],
                      [123.5, 22.0],
                      [123.5, 32.5],
                      [105.0, 32.5],
                      [105.0, 22.0],
                    ],
                  ],
                },
              },
              {
                type: "Feature",
                properties: { zone: "humid", place: "gaoyou" },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [105.0, 22.0],
                      [123.5, 22.0],
                      [123.5, 32.5],
                      [105.0, 32.5],
                      [105.0, 22.0],
                    ],
                  ],
                },
              },
              {
                type: "Feature",
                properties: { zone: "humid", place: "nanjing" },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [105.0, 22.0],
                      [123.5, 22.0],
                      [123.5, 32.5],
                      [105.0, 32.5],
                      [105.0, 22.0],
                    ],
                  ],
                },
              },
              {
                type: "Feature",
                properties: { zone: "dry", place: "yichun" },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [100.0, 33.0],
                      [135.0, 33.0],
                      [135.0, 54.0],
                      [100.0, 54.0],
                      [100.0, 33.0],
                    ],
                  ],
                },
              },
            ],
          },
        });
      }

      if (!map.getLayer("wst-climate-base")) {
        map.addLayer({
          id: "wst-climate-base",
          type: "fill",
          source: "wst-climate",
          paint: {
            "fill-color": [
              "match",
              ["get", "zone"],
              "humid",
              "rgba(100,200,120,0.75)",
              "dry",
              "rgba(230,210,90,0.75)",
              "rgba(200,200,200,0.5)",
            ],
            "fill-opacity": 0,
          },
        });
      }
      if (!map.getLayer("wst-climate-highlight")) {
        map.addLayer({
          id: "wst-climate-highlight",
          type: "fill",
          source: "wst-climate",
          filter: ["==", ["get", "place"], "__none__"],
          paint: {
            "fill-color": [
              "match",
              ["get", "zone"],
              "humid",
              "rgba(100,200,120,0.9)",
              "dry",
              "rgba(230,210,90,0.9)",
              "rgba(200,200,200,0.6)",
            ],
            "fill-opacity": 0.12,
          },
        });
      }

      buildMarkers(map);
    });

    mapRef.current = map;
    setTimeout(() => setShowContent(true), 300);

    return () => {
      stopFlowAnimation();
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "geo") {
      setParticleVisible(true);
      setFlavorParticleVisible(false);
      markersRef.current.forEach((m) => {
        const el = m.getElement();
        if (el) el.classList.add("hidden");
      });
      dishMarkerRef.current?.getElement().classList.add("hidden");
      setGeoCauseOpen(false);
      applyGeoHighlight(null);
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
    } else {
      setParticleVisible(false);
      setFlavorParticleVisible(false);
      markersRef.current.forEach((m) => {
        const el = m.getElement();
        if (el) el.classList.add("hidden");
      });
      dishMarkerRef.current?.getElement().classList.add("hidden");
      setGeoCauseOpen(false);
      applyGeoHighlight(null);
    }
  }, [activeTab, applyGeoHighlight]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#e8dcc8",
        overflow: "hidden",
        fontFamily: '"Noto Serif SC", "SimSun", serif',
      }}
    >
      {/* Map background */}
      <div ref={mapContainerRef} className="wang-sitai-map" style={{ position: "absolute", inset: 0 }} />

      {/* Particle canvas overlay */}
      <ParticleCanvas
        ingredientPoints={ingredientPoints}
        dishCenterLng={DISH_CENTER_LNG}
        dishCenterLat={DISH_CENTER_LAT}
        mapRef={mapRef}
        visible={particleVisible}
        containerRef={mapContainerRef}
      />

      {/* Flavor diffusion canvas overlay */}
      <FlavorDiffusionCanvas
        ingredientData={flavorData}
        dishCenterLng={DISH_CENTER_LNG}
        dishCenterLat={DISH_CENTER_LAT}
        mapRef={mapRef}
        visible={flavorParticleVisible}
        containerRef={mapContainerRef}
      />

      {/* Top nav */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          padding: "22px 48px",
          display: "flex",
          alignItems: "center",
          zIndex: 300,
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(-12px)",
          transition: "all 0.7s ease",
        }}
      >
        <a
          href="/chat"
          style={{
            background: "rgba(255,252,245,0.88)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(139,90,43,0.3)",
            color: "#8b5a2b",
            padding: "7px 20px",
            borderRadius: 3,
            textDecoration: "none",
            fontSize: 14,
            letterSpacing: "2px",
            transition: "all 0.25s",
          }}
        >
          「 返回随园 」
        </a>
        <div
          style={{
            marginLeft: "auto",
            background: "rgba(255,252,245,0.75)",
            backdropFilter: "blur(8px)",
            padding: "7px 20px",
            letterSpacing: "6px",
            fontSize: 13,
            color: "rgba(139,90,43,0.7)",
            fontWeight: 600,
          }}
        >
          清 · 袁枚
        </div>
      </nav>

      {/* Title card (top-left) */}
      <div
        style={{
          position: "fixed",
          top: 90,
          left: 48,
          zIndex: 200,
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(-16px)",
          transition: "all 0.8s cubic-bezier(0.23,1,0.32,1)",
          transitionDelay: "0.2s",
        }}
      >
        <div
          style={{
            background: "rgba(45,38,32,0.88)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(139,90,43,0.35)",
            borderRadius: 12,
            padding: "24px 32px",
            maxWidth: 340,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              color: "rgba(244,197,66,0.7)",
              fontSize: 11,
              letterSpacing: "4px",
              marginBottom: 10,
            }}
          >
            随园食单 · 珍馐
          </div>
          <h1
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: 700,
              margin: "0 0 12px",
              letterSpacing: "4px",
              borderBottom: "1px solid rgba(139,90,43,0.3)",
              paddingBottom: 12,
            }}
          >
            {dishData.dish_name}
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              lineHeight: 1.9,
              margin: 0,
              letterSpacing: "0.5px",
            }}
          >
            {dishData.modern_translation.slice(0, 60)}
            {dishData.modern_translation.length > 60 ? "…" : ""}
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 14,
            }}
          >
            {dishData.taste_tags.map((tag) => (
              <span
                key={tag}
                style={{
                  background: "rgba(139,90,43,0.25)",
                  border: "1px solid rgba(139,90,43,0.3)",
                  color: "rgba(244,197,66,0.85)",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontSize: 12,
                  letterSpacing: "1px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Yuanmei quote card (bottom-left) */}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: 48,
          zIndex: 200,
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.8s cubic-bezier(0.23,1,0.32,1)",
          transitionDelay: "0.4s",
          maxWidth: 360,
        }}
      >
        <div
          style={{
            background: "rgba(255,252,245,0.88)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(139,90,43,0.25)",
            borderRadius: 10,
            padding: "18px 22px",
            borderLeft: "4px solid #8b5a2b",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              color: "#8b5a2b",
              fontSize: 11,
              letterSpacing: "3px",
              marginBottom: 10,
            }}
          >
            袁枚原文
          </div>
          <p
            style={{
              color: "#3a3430",
              fontSize: 13,
              lineHeight: 2,
              margin: 0,
              fontStyle: "italic",
            }}
          >
            {dishData.original_text.slice(0, 80)}
            {dishData.original_text.length > 80 ? "…" : ""}
          </p>
        </div>
      </div>

      {/* Stats ribbon */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 48px",
          background: "rgba(45,38,32,0.8)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(139,90,43,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 32,
          zIndex: 200,
          opacity: showContent ? 1 : 0,
          transition: "all 0.8s ease",
          transitionDelay: "0.5s",
        }}
      >
        {[
          { label: "食材种类", value: `${dishData.ingredients_summary.total_ingredient_types} 种` },
          { label: "产地坐标", value: `${dishData.ingredients_summary.total_distribution_points} 处` },
          { label: "风味标签", value: dishData.taste_tags.join(" · ") },
          { label: "所属菜系", value: dishData.category },
        ].map((stat) => (
          <div key={stat.label} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 11,
                letterSpacing: "2px",
              }}
            >
              {stat.label}
            </span>
            <span
              style={{
                color: "rgba(244,197,66,0.85)",
                fontSize: 13,
                letterSpacing: "1px",
              }}
            >
              {stat.value}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {Object.entries(INGREDIENT_COLORS).map(([name, color]) => (
            <div
              key={name}
              title={name}
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: color,
                boxShadow: `0 0 6px ${color}`,
                cursor: "default",
              }}
            />
          ))}
        </div>
      </div>

      {/* Floating dialog (bottom-right) */}
      <FloatingDialog
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        ingredientColors={INGREDIENT_COLORS}
      />

      {/* 地理成因浮动卡片（点击产地出现） */}
      {activeTab === "ingredients" && geoCauseOpen && geoTarget && (
        <div
          style={{
            position: "fixed",
            top: 96,
            right: 22,
            zIndex: 520,
            width: 360,
            maxWidth: "calc(100vw - 44px)",
            background: "rgba(255,252,245,0.72)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(139,90,43,0.28)",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderBottom: "1px solid rgba(139,90,43,0.18)",
              background: "linear-gradient(180deg, rgba(45,38,32,0.10), rgba(45,38,32,0))",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "#5a3b1f",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${geoTarget.ingredient} · ${geoTarget.placeName}`}
              >
                {geoTarget.ingredient} · {geoTarget.placeName}
              </div>
              <div style={{ fontSize: 11, color: "rgba(90,59,31,0.7)", letterSpacing: "2px", marginTop: 2 }}>
                地理成因 · 为什么是这里
              </div>
            </div>
            <button
              onClick={() => {
                setGeoCauseOpen(false);
                stopFlowAnimation();
                applyGeoHighlight(null);
              }}
              style={{
                marginLeft: "auto",
                background: "rgba(45,38,32,0.06)",
                border: "1px solid rgba(139,90,43,0.25)",
                color: "rgba(90,59,31,0.9)",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                letterSpacing: "2px",
                fontSize: 12,
              }}
            >
              关闭
            </button>
          </div>

          <div style={{ padding: "12px 14px 14px" }}>
            {geoCauseLoading ? (
              <div style={{ color: "rgba(58,52,48,0.75)", fontSize: 13, lineHeight: 1.9, letterSpacing: "0.5px" }}>
                正在推演此地山川水脉与风土……
              </div>
            ) : geoCauseError ? (
              <div style={{ color: "#8b2b2b", fontSize: 13, lineHeight: 1.9 }}>
                {geoCauseError}
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => openGeoCause(geoTarget)}
                    style={{
                      background: "rgba(139,90,43,0.12)",
                      border: "1px solid rgba(139,90,43,0.25)",
                      color: "#8b5a2b",
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                      letterSpacing: "2px",
                      fontSize: 12,
                    }}
                  >
                    重试
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  color: "rgba(58,52,48,0.92)",
                  fontSize: 13,
                  lineHeight: 2,
                  letterSpacing: "0.6px",
                  fontFamily: '"Noto Serif SC", "SimSun", serif',
                }}
              >
                {geoCauseText || "点击任一产地光点，即可生成地理成因解释。"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ensure map canvas fills correctly */}
      <style>{`
        .mapboxgl-canvas { outline: none !important; }
        .wst-marker-wrap:hover { z-index: 999 !important; }
      `}</style>
    </div>
  );
}
