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
    [ingredientPoints]
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

      buildMarkers(map);
    });

    mapRef.current = map;
    setTimeout(() => setShowContent(true), 300);

    return () => {
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
    }
  }, [activeTab]);

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

      {/* Ensure map canvas fills correctly */}
      <style>{`
        .mapboxgl-canvas { outline: none !important; }
        .wst-marker-wrap:hover { z-index: 999 !important; }
      `}</style>
    </div>
  );
}
