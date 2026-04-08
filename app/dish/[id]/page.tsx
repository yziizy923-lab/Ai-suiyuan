"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import CookingCompareOverlay from "@/components/CookingCompareOverlay";

type Dish = {
  id: number;
  name: string;
  desc: string;
  image: string;
  tags: string[];
  ingredients: string[];
  origin?: string;
  originCoords?: [number, number]; // [经度偏移%, 纬度偏移%] 用于地图标记
  history?: string;
};

type CookingStep = {
  step: number;
  stepNumber?: number;
  title: string;
  desc: string;
  imageBase64?: string;
  success?: boolean;
};

async function fetchDishFromAPI(id: number): Promise<Dish | null> {
  try {
    const response = await fetch(`/api/dishes/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch dish');
    }
    const dish = await response.json();
    // 处理数据库返回的数据格式
    return {
      ...dish,
      // 数据库中 tags 和 ingredients 可能是数组、JSON字符串或逗号分隔的字符串，需要处理
      tags: Array.isArray(dish.tags) ? dish.tags : parseArrayField(dish.tags),
      ingredients: Array.isArray(dish.ingredients) ? dish.ingredients : parseArrayField(dish.ingredients),
      image: dish.image || `https://picsum.photos/seed/${dish.id}/800/500`
    };
  } catch (error) {
    console.error('Failed to fetch dish:', error);
    return null;
  }
}

// 解析数组字段，支持数组、JSON字符串或逗号分隔的字符串
function parseArrayField(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

// 袁枚原文数据

export default function DishDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [imgError, setImgError] = useState(false); // 用于 fallback
  const [showCookingSteps, setShowCookingSteps] = useState(false);
  const [cookingSteps, setCookingSteps] = useState<CookingStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  // AI 图片生成状态
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  // 动画状态
  const [currentStep, setCurrentStep] = useState(0);
  const animationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 古今对比弹窗状态
  const [cookingMode, setCookingMode] = useState(false);

  // 地图背景引用 - 必须在所有 useEffect 之前声明，避免早期返回导致 Hooks 顺序变化
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapBgRef = useRef<mapboxgl.Map | null>(null);

  const dishId = Number(params.id);

  // 加载制作步骤
  const loadCookingSteps = async () => {
    if (!dish) return;

    setLoadingSteps(true);
    try {
      // 1. 获取 AI 生成的步骤
      const stepsRes = await fetch(
        `/api/cooking-steps?dish=${encodeURIComponent(dish.name)}&desc=${encodeURIComponent(dish.desc)}&ingredients=${encodeURIComponent(dish.ingredients.join(','))}`
      );
      const stepsData = await stepsRes.json();

      if (stepsData.success && stepsData.steps) {
        setCookingSteps(stepsData.steps);
        setShowCookingSteps(true);

        // 2. 批量生成步骤图片
        const batchRes = await fetch('/api/step-image', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            steps: stepsData.steps,
            dishName: dish.name,
          }),
        });
        const batchData = await batchRes.json();

        if (batchData.success && batchData.steps) {
          // 合并图片到步骤
          setCookingSteps((prev) =>
            prev.map((step) => {
              const generated = batchData.steps.find(
                (s: { stepNumber: number }) => s.stepNumber === step.step
              );
              return generated?.success
                ? { ...step, imageBase64: generated.imageBase64 }
                : step;
            })
          );
        }
      }
    } catch (error) {
      console.error('加载制作步骤失败:', error);
      alert('生成制作过程失败，请重试');
    } finally {
      setLoadingSteps(false);
    }
  };

  useEffect(() => {
    async function loadDish() {
      setLoading(true);
      setError(null);
      try {
        const dishData = await fetchDishFromAPI(dishId);
        if (dishData) {
          setDish(dishData);
          setTimeout(() => setShowContent(true), 300);
        } else {
          setError('菜品未找到');
        }
      } catch (err) {
        console.error('Error loading dish:', err);
        setError('加载失败');
      } finally {
        setLoading(false);
      }
    }

    if (dishId) {
      loadDish();
    }
  }, [dishId]);

  useEffect(() => {
    if (showCookingSteps && cookingSteps.length > 0) {
      setCurrentStep(0);
    }
  }, [showCookingSteps]);

  useEffect(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    if (!showCookingSteps || cookingSteps.length <= 1) return;
    animationIntervalRef.current = setInterval(() => {
      setCurrentStep((i) => (i + 1) % cookingSteps.length);
    }, 3000);
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [showCookingSteps, cookingSteps.length]);

  // 初始化地图背景 - 依赖 dish 确保在数据加载完成后执行
  useEffect(() => {
    if (!dish || !mapContainerRef.current || mapBgRef.current) return;

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    console.log('[Mapbox] Token exists:', !!accessToken);
    console.log('[Mapbox] Token prefix:', accessToken?.substring(0, 10) || 'none');
    if (!accessToken) {
      console.error('[Mapbox] NEXT_PUBLIC_MAPBOX_TOKEN is not set');
      // 设置备用背景
      if (mapContainerRef.current) {
        mapContainerRef.current.style.backgroundImage = 
          'radial-gradient(circle at 50% 50%, rgba(139, 90, 43, 0.1) 0%, transparent 60%)';
      }
      return;
    }

    try {
      mapboxgl.accessToken = accessToken;

      // 创建复古风格的地图背景
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [108, 34],
        zoom: 5.5,
        interactive: false,
        attributionControl: false,
        logoPosition: 'bottom-right',
        projection: "mercator",
        // 限制地图范围在中国境内
        maxBounds: [
          [73.5, 18.0],
          [135.0, 54.0],
        ],
        minZoom: 3,
        maxZoom: 10,
      });

      map.on('load', () => {
        console.log('[Mapbox] Map loaded successfully');

        // 设置地图语言为中文
        map.getStyle().layers?.forEach((layer: mapboxgl.Layer) => {
          if (layer.layout && 'text-field' in layer.layout) {
            map.setLayoutProperty(layer.id, 'text-field', ['get', 'name_zh-Hans']);
          }
        });

        // 复古背景色逻辑
        map.getStyle().layers?.forEach((layer: mapboxgl.Layer) => {
          if (layer.type === 'background') {
            map.setPaintProperty(layer.id, 'background-color', '#e8dcc8');
          }
        });

        // 如果有产地坐标，添加定位标记
        if (dish?.originCoords) {
          console.log('[Mapbox] Adding marker at:', dish.originCoords);

          // 注入全局样式用于动态创建的标记元素
          if (!document.getElementById('dish-marker-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'dish-marker-styles';
            styleEl.textContent = `
              .dish-location-marker {
                cursor: pointer;
                z-index: 10;
              }
              .marker-pin {
                position: relative;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .marker-dot {
                width: 16px;
                height: 16px;
                background: linear-gradient(135deg, #d44444, #a83232);
                border: 3px solid rgba(255,255,255,0.9);
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                position: relative;
                z-index: 2;
              }
              .marker-pulse {
                position: absolute;
                width: 32px;
                height: 32px;
                background: rgba(212, 68, 68, 0.4);
                border-radius: 50%;
                animation: pulse-ring 2s ease-out infinite;
              }
              @keyframes pulse-ring {
                0% {
                  transform: scale(0.8);
                  opacity: 0.8;
                }
                100% {
                  transform: scale(2.5);
                  opacity: 0;
                }
              }
              .dish-popup .mapboxgl-popup-content {
                background: linear-gradient(135deg, #2d2926, #3d3530) !important;
                border-radius: 8px !important;
                padding: 12px 16px !important;
                box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
                min-width: 120px;
              }
              .dish-popup .mapboxgl-popup-tip {
                border-top-color: #2d2926 !important;
              }
              .dish-popup .popup-content {
                font-family: "Noto Serif SC", "SimSun", serif;
              }
              .dish-popup .popup-title {
                color: #fff;
                font-size: 14px;
                font-weight: 600;
                letter-spacing: 1px;
                margin-bottom: 4px;
              }
              .dish-popup .popup-origin {
                color: rgba(255,255,255,0.7);
                font-size: 12px;
              }
            `;
            document.head.appendChild(styleEl);
          }

          // 创建自定义定位标记元素
          const markerElement = document.createElement('div');
          markerElement.className = 'dish-location-marker';
          markerElement.innerHTML = `
            <div class="marker-pin">
              <div class="marker-dot"></div>
              <div class="marker-pulse"></div>
            </div>
          `;

          // 创建弹出框
          const popup = new mapboxgl.Popup({
            offset: [0, -30],
            closeButton: false,
            closeOnClick: false,
            className: 'dish-popup'
          }).setHTML(`
            <div class="popup-content">
              <div class="popup-title">${dish.name}</div>
              ${dish.origin ? `<div class="popup-origin">📍 ${dish.origin}</div>` : ''}
            </div>
          `);

          // 创建标记
          const marker = new mapboxgl.Marker({ element: markerElement })
            .setLngLat([dish.originCoords[0], dish.originCoords[1]])
            .setPopup(popup)
            .addTo(map);

          console.log('[Mapbox] Marker added successfully');

          // 点击标记时聚焦到该位置
          markerElement.addEventListener('click', () => {
            map.flyTo({
              center: [dish.originCoords![0], dish.originCoords![1]],
              zoom: 7,
              duration: 1500,
              essential: true,
            });
            marker.togglePopup();
          });

          // 页面加载后默认飞向标记位置
          setTimeout(() => {
            map.flyTo({
              center: [dish.originCoords![0], dish.originCoords![1]],
              zoom: 6,
              duration: 3000,
              essential: true,
            });
          }, 500);
        } else {
          console.log('[Mapbox] No originCoords found for dish:', dish?.name);
        }
      });

      map.on('error', (e) => {
        console.error('[Mapbox] Map error:', e);
      });

      mapBgRef.current = map;

      return () => {
        map.remove();
        mapBgRef.current = null;
      };
    } catch (err) {
      console.error('[Mapbox] Failed to initialize map:', err);
    }
  }, [dish]);

  // AI 生成菜品图片
  useEffect(() => {
    if (!dish) return;

    const generateImage = async () => {
      setIsGeneratingImage(true);
      setImageError(null);
      try {
        const response = await fetch('/api/generate-dish-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dish: dish.name,
            desc: dish.desc || '',
            ancient: dish.history || '',
            method: '',
          }),
        });
        const data = await response.json();
        if (data.success && data.imageUrl) {
          setImageUrl(data.imageUrl);
        } else {
          setImageError(data.error || '生成失败');
        }
      } catch {
        setImageError('网络错误');
      } finally {
        setIsGeneratingImage(false);
      }
    };

    generateImage();
  }, [dish?.id, dish?.name, dish?.desc, dish?.history]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: dish?.name,
        text: dish?.desc,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("链接已复制到剪贴板");
    }
  };

  const handleSave = () => {
    const saved = JSON.parse(localStorage.getItem("savedDishes") || "[]");
    if (!saved.includes(dishId)) {
      saved.push(dishId);
      localStorage.setItem("savedDishes", JSON.stringify(saved));
      alert(`「${dish?.name}」已收藏至随园`);
    } else {
      alert("此菜已在随园收藏中");
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="ink-stain" />
        <div className="loading-text">正在翻阅食单...</div>
        <style jsx>{`
          .loading-screen {
            position: fixed; inset: 0;
            background: linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 100%);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 20px;
            font-family: "Noto Serif SC", "SimSun", serif;
          }
          .ink-stain {
            width: 40px; height: 40px; background: #332c28; border-radius: 50%;
            filter: blur(8px);
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0%,100% { transform: scale(0.8); opacity: 0.3; }
            50% { transform: scale(1.3); opacity: 0.6; }
          }
          .loading-text { font-size: 18px; color: #8b5a2b; letter-spacing: 4px; }
        `}</style>
      </div>
    );
  }

  if (error || !dish) {
    return (
      <div className="error-screen">
        <div className="error-content">
          <div className="error-icon">!</div>
          <h2 className="error-title">{error || '菜品未找到'}</h2>
          <button onClick={() => router.push("/chat")} className="back-btn">「 返回随园 」</button>
        </div>
        <style jsx>{`
          .error-screen {
            position: fixed; inset: 0;
            background: linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 100%);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            font-family: "Noto Serif SC", "SimSun", serif;
          }
          .error-content {
            text-align: center;
          }
          .error-icon {
            width: 60px; height: 60px; 
            background: rgba(139,90,43,0.15);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 32px; color: #8b5a2b;
            margin: 0 auto 20px;
          }
          .error-title {
            font-size: 20px; color: #8b5a2b;
            letter-spacing: 4px; margin: 0 0 30px;
          }
          .back-btn {
            background: rgba(255,252,245,0.88); backdrop-filter: blur(8px);
            border: 1px solid #8b5a2b; color: #8b5a2b;
            padding: 10px 24px; border-radius: 3px; cursor: pointer;
            font-size: 14px; transition: all 0.3s; font-family: inherit;
          }
          .back-btn:hover { background: #8b5a2b; color: #fff; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dish-detail-container">

      {/* 背景：地理地图 */}
      <div ref={mapContainerRef} className="map-bg" />

      {/* 左侧绢轴背景 + 菜品图片叠加 */}
      <div className="left-bg-image">
        {/* 图片容器 */}
        <div className="dish-image-overlay">
          {isGeneratingImage ? (
            <div className="overlay-generating">
              <div className="overlay-spinner" />
              <span className="overlay-text">画中寻味...</span>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={dish?.name}
              className="overlay-dish-img"
              onError={() => setImgError(true)}
            />
          ) : imageError ? (
            <div className="overlay-error">
              <span className="overlay-error-icon">🌿</span>
              <span className="overlay-error-text">{imageError}</span>
            </div>
          ) : dish?.image ? (
            <img
              src={imgError ? `https://picsum.photos/seed/${dish.id}/400/500` : dish.image}
              alt={dish?.name}
              className="overlay-dish-img"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="overlay-placeholder">
              <span className="overlay-placeholder-icon">🥢</span>
            </div>
          )}
          <div className="overlay-vignette" />
          <div className="overlay-frame" />
        </div>
        {/* 图片下方的文字信息 */}
        <div className="dish-image-info">
          {dish?.history && (
            <div className="info-section origin-text">
              <span className="info-label-tag">袁枚曰</span>
              <p className="info-text">{dish.history}</p>
            </div>
          )}
          {dish?.tags && dish.tags.length > 0 && (
            <div className="info-section flavor-tags">
              <span className="info-label-tag">口味</span>
              <div className="tags-row">
                {dish.tags.map((tag, idx) => (
                  <span key={idx} className="flavor-tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {dish?.ingredients && dish.ingredients.length > 0 && (
            <div className="info-section main-ingredients">
              <span className="info-label-tag">主要食材</span>
              <p className="info-text">{dish.ingredients.join('、')}</p>
            </div>
          )}
        </div>
      </div>

      {/* 顶部导航 */}
      <nav className={`top-nav ${showContent ? 'visible' : ''}`}>
        <button onClick={() => router.push("/chat")} className="back-link">「 返回随园 」</button>
      </nav>

      {/* 右侧三个按键 */}
      <div className={`right-actions ${showContent ? 'visible' : ''}`}>
        <button className="right-action-btn" title="古今对比" onClick={() => setCookingMode(true)}>
          <span className="right-action-icon">🔄</span>
          <span className="right-action-text">古今对比</span>
        </button>
        <button className="right-action-btn" title="分享">
          <span className="right-action-icon">📤</span>
          <span className="right-action-text">分享</span>
        </button>
        <button
          className="right-action-btn"
          title="地图探索"
          onClick={() => router.push("/dish/wang-sitai-babao-doufu")}
        >
          <span className="right-action-icon">🗺️</span>
          <span className="right-action-text">探索</span>
        </button>
        <button
          className="right-action-btn right-action-primary"
          title="制作"
          onClick={loadCookingSteps}
          disabled={loadingSteps}
        >
          {loadingSteps ? (
            <span className="right-action-icon right-action-spinner" />
          ) : (
            <span className="right-action-icon">🍳</span>
          )}
          <span className="right-action-text">制作</span>
        </button>
      </div>

      {/* 主内容 */}
      <div className={`content-overlay ${showContent ? 'visible' : ''}`}>
        
      </div>

      {/* 底部按键 */}
      <div className={`bottom-actions ${showContent ? 'visible' : ''}`}>
      </div>

      {/* 制作过程动画 */}
      {showCookingSteps && dish && cookingSteps.length > 0 && (
        <div className="cooking-steps-modal">
          <div className="modal-backdrop" onClick={() => setShowCookingSteps(false)} />
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowCookingSteps(false)}>
              ✕
            </button>

            {/* 标题 */}
            <div className="anim-header">
              <span className="anim-icon">🍳</span>
              <h2 className="anim-title">制作过程</h2>
              <span className="anim-subtitle">{dish.name}</span>
            </div>

            {/* 横向时间轴 - 直接点击图片切换 */}
            <div className="anim-timeline" role="region" aria-label="制作步骤时间轴">
              <div className="anim-track">
                {cookingSteps.map((s: CookingStep, i: number) => {
                  const isActive = i === currentStep;
                  const isPast = i < currentStep;
                  return (
                    <button
                      type="button"
                      key={s.step}
                      className={`anim-frame ${isActive ? 'anim-frame-active' : ''} ${isPast ? 'anim-frame-past' : ''}`}
                      aria-current={isActive ? 'step' : undefined}
                      aria-label={`步骤 ${s.step}: ${s.title}`}
                      onClick={() => setCurrentStep(i)}
                    >
                      {s.imageBase64 ? (
                        <img
                          src={`data:image/png;base64,${s.imageBase64}`}
                          alt={s.title}
                          className="anim-frame-img"
                        />
                      ) : (
                        <div className="anim-frame-placeholder">
                          <span className="anim-frame-placeholder-icon">🍽️</span>
                        </div>
                      )}
                      <span className={`anim-frame-badge ${isActive ? 'anim-frame-badge-active' : ''}`}>
                        {s.step}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 当前步骤文字 */}
            <div className="anim-textbox" key={currentStep}>
              <h3 className="anim-step-title">{cookingSteps[currentStep]?.title}</h3>
              <p className="anim-step-desc">{cookingSteps[currentStep]?.desc}</p>
            </div>

            {/* 底部进度点 */}
            <div className="anim-progress-row" aria-hidden>
              {cookingSteps.map((_: CookingStep, i: number) => (
                <div
                  key={i}
                  className={`anim-dot ${i === currentStep ? 'anim-dot-active' : ''} ${i < currentStep ? 'anim-dot-past' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dish-detail-container {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          font-family: "Noto Serif SC", "Source Han Serif CN", "SimSun", "STSong", serif;
          color: #2d2926;
          display: flex;
          flex-direction: column;
        }

        /* 地理地图背景 */
        .map-bg {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          /* 备用背景色 - 复古宣纸色调 */
          background-color: #e8dcc8;
          background-image: 
            radial-gradient(circle at 20% 30%, rgba(139, 90, 43, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(139, 90, 43, 0.06) 0%, transparent 40%);
        }

        /* 确保 Mapbox canvas 正确显示 */
        :global(.map-bg .mapboxgl-canvas) {
          outline: none;
        }

        :global(.map-bg .mapboxgl-map) {
          width: 100% !important;
          height: 100% !important;
        }

        /* 确保地图标记在内容上方可见 */
        :global(.map-bg .mapboxgl-marker) {
          z-index: 100 !important;
        }

        /* 左侧绢轴背景 */
        .left-bg-image {
          position: absolute;
          top: 10%;
          left: 0;
          width: 40%;
          height: 85%;
          background-image: url('/juanzhou.PNG');
          background-size: 100% 100%;
          background-repeat: no-repeat;
          z-index: 2;
        }

        /* 图片容器 - 独立定位 */
        .dish-image-overlay {
          position: absolute;
          top: 8%;
          left: 18%;
          right: 18%;
          height: 48%;
          border-radius: 12px;
          overflow: hidden;
        }

        /* 图片下方的文字信息容器 - 独立定位 */
        .dish-image-info {
          position: absolute;
          top: 58%;
          left:10%;
          right: 12%;
          bottom: 10%;
          padding: 30px 20px;
          border-radius: 12px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .info-section {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .info-section .info-icon {
          font-size: 16px;
          flex-shrink: 0;
          margin-top: 20px;
        }

        .info-label-tag {
          font-size: 16px;
          color: #8b5a2b;
          letter-spacing: 2px;
          font-weight: 600;
          white-space: nowrap;
          margin-right: 6px;
        }

        .info-text {
          color: #3a3430;
          line-height: 1.6;
          margin: 0;
          flex: 1;
        }

        .origin-text .info-text {
          font-size: 14px;
          color: #5a4a3a;
        }

        .tags-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          flex: 1;
        }

        .flavor-tag {
          background: linear-gradient(135deg, rgba(139,90,43,0.15), rgba(196,133,63,0.1));
          color: #6b4423;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 14px;
          border: 1px solid rgba(139,90,43,0.2);
        }

        .main-ingredients .info-text {
          font-size: 14px;
        }
        
        .overlay-dish-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          filter: sepia(5%) contrast(1.05);
          transition: transform 0.6s ease, filter 0.4s ease;
          mask-image: radial-gradient(circle at center, black 70%, transparent 100%);
          -webkit-mask-image: radial-gradient(circle at center, black 70%, transparent 100%);
        }
        
        .dish-image-overlay:hover .overlay-dish-img {
          transform: scale(1.03);
          filter: sepia(3%) contrast(1.08);
        }

        /* 加载中状态 */
        .overlay-generating {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 50%, #f5f0e6 100%);
        }
        
        .overlay-spinner {
          width: 40px;
          height: 40px;
          border: 2px solid rgba(139, 90, 43, 0.15);
          border-top-color: #8b5a2b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .overlay-text {
          font-size: 13px;
          color: #8b5a2b;
          letter-spacing: 4px;
          animation: pulse 2s ease-in-out infinite;
        }

        /* 错误状态 */
        .overlay-error {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: linear-gradient(135deg, rgba(139, 90, 43, 0.08) 0%, rgba(196, 133, 63, 0.05) 100%);
        }
        
        .overlay-error-icon {
          font-size: 36px;
          opacity: 0.6;
        }
        
        .overlay-error-text {
          font-size: 12px;
          color: #8b5a2b;
          letter-spacing: 2px;
        }

        /* 占位符 */
        .overlay-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 100%);
        }
        
        .overlay-placeholder-icon {
          font-size: 48px;
          opacity: 0.3;
        }

        /* 右侧三个按键 */
        .right-actions {
          position: fixed;
          right: 40px;
          top: 50%;
          transform: translateY(-50%) translateX(20px);
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 100;
          opacity: 0;
          transition: all 0.7s ease;
        }
        .right-actions.visible {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
          transition-delay: 0.3s;
        }
        .right-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px 18px;
          background: rgba(255, 252, 245, 0.92);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(139, 90, 43, 0.25);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }
        .right-action-btn:hover {
          background: rgba(139, 90, 43, 0.12);
          border-color: #8b5a2b;
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
        }
        .right-action-icon {
          font-size: 22px;
        }
        .right-action-text {
          font-size: 12px;
          color: #8b5a2b;
          letter-spacing: 2px;
          font-family: inherit;
        }
        .right-action-primary {
          background: linear-gradient(135deg, #8b5a2b, #a06830);
          border-color: #8b5a2b;
        }
        .right-action-primary:hover {
          background: linear-gradient(135deg, #a06830, #b07838);
          border-color: #a06830;
        }
        .right-action-primary .right-action-text {
          color: #fff;
        }
        .right-action-spinner {
          width: 22px;
          height: 22px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* 导航 */
        .top-nav {
          position: fixed; top: 0; left: 0; right: 0;
          padding: 28px 60px;
          display: flex; justify-content: space-between; align-items: center;
          z-index: 100;
          opacity: 0; transform: translateY(-16px);
          transition: all 0.7s ease;
        }
        .top-nav.visible { opacity: 1; transform: translateY(0); }
        .back-link {
          background: rgba(255,252,245,0.88); backdrop-filter: blur(8px);
          border: 1px solid #8b5a2b; color: #8b5a2b;
          padding: 7px 20px; border-radius: 3px; cursor: pointer;
          font-size: 14px; transition: all 0.3s; font-family: inherit;
        }
        .back-link:hover { background: #8b5a2b; color: #fff; }
        .dynasty-tag {
          background: rgba(255,252,245,0.75); backdrop-filter: blur(8px);
          padding: 7px 20px; letter-spacing: 6px; font-weight: bold;
          opacity: 0.55; font-size: 14px;
        }

        /* 主内容区域 */
        .content-overlay {
          position: relative; z-index: 10;
          flex: 1;
          display: flex;
          padding: 100px 60px 140px;
          gap: 40px;
          overflow-y: auto;
        }

        /* 左上角：菜品图片区域 */
        .dish-image-section {
          flex-shrink: 0;
          width: 420px;
          opacity: 0; transform: translateX(-30px);
          transition: all 0.8s cubic-bezier(0.23,1,0.32,1);
        }
        .content-overlay.visible .dish-image-section {
          opacity: 1; transform: translateX(0);
          transition-delay: 0.15s;
        }
        .dish-image-wrap {
          position: relative; 
          height: 560px; 
          overflow: hidden;
          background: #e8e0d0;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .dish-img {
          width: 100%; height: 100%; object-fit: cover;
          filter: sepia(8%); display: block;
          transition: transform 0.6s ease;
        }
        .dish-image-wrap:hover .dish-img { transform: scale(1.03); }
        .img-vignette {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, transparent 50%, rgba(45,41,38,0.18));
          pointer-events: none;
        }
        .corner-seal {
          position: absolute; top: 16px; right: 16px;
          background: rgba(160,0,0,0.88); color: #fff;
          padding: 5px 12px; font-size: 11px; letter-spacing: 2px;
          border-radius: 3px;
        }

        /* AI 生成图片样式 */
        .ai-generating {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 16px;
          background: linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 100%);
          z-index: 2;
        }
        .generating-spinner {
          width: 48px; height: 48px;
          border: 3px solid rgba(139,90,43,0.15);
          border-top-color: #8b5a2b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .generating-text {
          font-size: 14px; color: #8b5a2b;
          letter-spacing: 3px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* 右侧：菜品信息区域 */
        .dish-info-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          opacity: 0; transform: translateX(30px);
          transition: all 0.8s cubic-bezier(0.23,1,0.32,1);
        }
        .content-overlay.visible .dish-info-section {
          opacity: 1; transform: translateX(0);
          transition-delay: 0.3s;
        }
        .dish-info-card {
          background: rgba(255,252,245,0.95); 
          backdrop-filter: blur(16px);
          border: 1px solid rgba(139,90,43,0.18);
          border-radius: 12px; 
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        }
        
        /* 菜品标题 */
        .dish-header { margin-bottom: 32px; }
        .dish-title {
          font-size: 36px; margin: 0 0 16px;
          letter-spacing: 6px; color: #1e1a17;
          border-bottom: 2px solid #a00; 
          padding-bottom: 16px;
          display: inline-block;
        }
        .dish-desc {
          font-size: 16px; color: #555; line-height: 2;
          margin: 0; font-style: italic;
        }

        /* 信息块 */
        .info-block {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px 0;
          border-bottom: 1px dashed rgba(139,90,43,0.15);
        }
        .info-icon { font-size: 20px; }
        .info-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .info-label {
          font-size: 12px; color: #999; letter-spacing: 3px;
          text-transform: uppercase;
        }
        .info-value {
          font-size: 18px; color: #8b5a2b; font-weight: 500;
        }

        /* 袁枚原文 */
        .yuanmei-block {
          margin-top: 28px;
          padding: 24px;
          background: linear-gradient(135deg, rgba(139,90,43,0.06) 0%, rgba(196,133,63,0.04) 100%);
          border-radius: 10px;
          border-left: 4px solid #8b5a2b;
        }
        .yuanmei-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .yuanmei-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff; font-size: 16px; font-weight: bold;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid rgba(139,90,43,0.3);
        }
        .yuanmei-label { font-size: 14px; color: #666; letter-spacing: 2px; }
        .yuanmei-quote-wrap {
          position: relative;
          padding: 0 20px;
        }
        .quote-mark {
          font-size: 32px; color: rgba(139,90,43,0.3);
          position: absolute;
        }
        .quote-mark:first-of-type { top: -10px; left: 0; }
        .quote-mark-end { 
          bottom: -20px; 
          right: 20px; 
          transform: rotate(180deg);
        }
        .yuanmei-quote {
          font-size: 15px; color: #3a3430; line-height: 2.2;
          margin: 0; padding: 0;
          font-style: italic;
        }

        /* 标签 */
        .tags-row { 
          display: flex; gap: 10px; flex-wrap: wrap; 
          margin-top: 24px;
        }
        .tag {
          background: rgba(139,90,43,0.09); color: #8b5a2b;
          padding: 6px 16px; border-radius: 20px; font-size: 13px;
          border: 1px solid rgba(139,90,43,0.15);
        }

        /* 底部三个按键 */
        .bottom-actions {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          padding: 20px 60px;
          background: transparent;
          display: flex;
          justify-content: center;
          gap: 20px;
          z-index: 100;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.8s ease;
        }
        .bottom-actions.visible {
          opacity: 1;
          transform: translateY(0);
          transition-delay: 0.5s;
        }
        .action-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 32px;
          border-radius: 8px;
          font-size: 15px;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }
        .action-btn .btn-icon { font-size: 18px; }
        .action-btn .btn-text { letter-spacing: 2px; }
        
        .action-primary {
          background: linear-gradient(135deg, #8b5a2b, #a06830);
          color: #fff;
          border-color: #8b5a2b;
        }
        .action-primary:hover {
          background: linear-gradient(135deg, #a06830, #b07838);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(139,90,43,0.3);
        }
        
        .action-secondary {
          background: rgba(255,252,245,0.9);
          color: #8b5a2b;
          border-color: rgba(139,90,43,0.3);
        }
        .action-secondary:hover {
          background: rgba(139,90,43,0.1);
          border-color: #8b5a2b;
          transform: translateY(-2px);
        }

        .action-cooking {
          background: linear-gradient(135deg, #c9302c, #d44444);
          color: #fff;
          border-color: #c9302c;
        }
        .action-cooking:hover {
          background: linear-gradient(135deg, #d44444, #e05555);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(201,48,44,0.3);
        }
        .action-cooking:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        /* 制作过程模态框 */
        .cooking-steps-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
        }
        .modal-content {
          position: relative;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          overflow-y: auto;
          z-index: 1;
          border-radius: 16px;
          background: linear-gradient(135deg, #1a1612 0%, #2d2620 40%, #1a1612 100%);
          padding: 40px;
        }
        .modal-close {
          position: absolute;
          top: -50px;
          right: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: #fff;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .modal-close:hover {
          background: rgba(255,255,255,0.3);
        }

        /* 动画样式 */
        .anim-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .anim-icon { font-size: 24px; }
        .anim-title {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
          margin: 0;
          letter-spacing: 3px;
        }
        .anim-subtitle {
          font-size: 13px;
          color: #f4c542;
          margin-left: auto;
          letter-spacing: 1px;
        }

        /* ── 横向时间轴 ── */
        .anim-timeline {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .anim-track {
          display: flex;
          gap: 10px;
          flex: 1;
          min-width: 0;
          overflow-x: auto;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .anim-track::-webkit-scrollbar { display: none; }

        .anim-frame {
          flex-shrink: 0;
          width: 120px;
          aspect-ratio: 4 / 3;
          border-radius: 10px;
          overflow: hidden;
          position: relative;
          background: #2d2620;
          border: 2px solid rgba(255,255,255,0.06);
          transition: border-color 0.4s ease, box-shadow 0.4s ease, opacity 0.4s ease, transform 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .anim-frame:hover {
          transform: scale(1.05);
          border-color: rgba(255,255,255,0.25);
        }

        .anim-frame-active {
          border-color: rgba(244, 197, 66, 0.7);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
          z-index: 2;
        }

        .anim-frame-past {
          opacity: 0.5;
        }

        .anim-frame:not(.anim-frame-active):not(.anim-frame-past) {
          opacity: 0.28;
        }

        .anim-frame-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .anim-frame-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #2d2620 0%, #1a1612 100%);
        }

        .anim-frame-placeholder-icon {
          font-size: 24px;
          opacity: 0.4;
        }

        .anim-frame-badge {
          position: absolute;
          bottom: 6px;
          right: 8px;
          background: rgba(0, 0, 0, 0.55);
          color: rgba(255, 255, 255, 0.75);
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          pointer-events: none;
        }

        .anim-frame-badge-active {
          background: linear-gradient(135deg, #f4c542, #e6a91a);
          color: #2d2926;
        }

        .anim-textbox {
          margin-top: 16px;
          padding: 0 4px;
          animation: fadeSlide 0.4s ease-out;
        }

        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .anim-step-title {
          font-size: 22px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 10px;
          letter-spacing: 3px;
        }

        .anim-step-desc {
          font-size: 14px;
          line-height: 1.85;
          color: rgba(255,255,255,0.75);
          margin: 0;
        }

        .anim-progress-row {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
        }

        .anim-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          transition: all 0.35s ease;
        }

        .anim-dot-past {
          background: rgba(255,255,255,0.35);
        }

        .anim-dot-active {
          width: 20px;
          border-radius: 3px;
          background: linear-gradient(90deg, #f4c542, #e6a91a);
        }

        /* 地图定位标记样式 */
        .dish-location-marker {
          cursor: pointer;
          z-index: 10;
        }

        .marker-pin {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .marker-dot {
          width: 16px;
          height: 16px;
          background: linear-gradient(135deg, #d44444, #a83232);
          border: 3px solid rgba(255,255,255,0.9);
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
          z-index: 2;
        }

        .marker-pulse {
          position: absolute;
          width: 32px;
          height: 32px;
          background: rgba(212, 68, 68, 0.4);
          border-radius: 50%;
          animation: pulse-ring 2s ease-out infinite;
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }

        /* 弹出框样式 - 使用 :global() 使 Mapbox 内置类样式生效 */
        :global(.dish-popup .mapboxgl-popup-content) {
          background: linear-gradient(135deg, #2d2926, #3d3530) !important;
          border-radius: 8px !important;
          padding: 12px 16px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
          min-width: 120px;
        }

        :global(.dish-popup .mapboxgl-popup-tip) {
          border-top-color: #2d2926 !important;
        }

        :global(.dish-popup .popup-content) {
          font-family: "Noto Serif SC", "SimSun", serif;
        }

        :global(.dish-popup .popup-title) {
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }

        :global(.dish-popup .popup-origin) {
          color: rgba(255,255,255,0.7);
          font-size: 12px;
        }

        /* 响应式 */
        @media (max-width: 900px) {
          .content-overlay {
            flex-direction: column;
            padding: 80px 24px 120px;
          }
          .dish-image-section { width: 100%; }
          .dish-image-wrap { height: 300px; }
          .top-nav { padding: 18px 24px; }
          .dish-title { font-size: 26px; }
          .bottom-actions { 
            padding: 16px 24px;
            gap: 12px;
          }
          .action-btn { 
            padding: 12px 20px;
            font-size: 14px;
          }
          .action-btn .btn-text { display: none; }
        }
      `}</style>

      {/* 古今对比弹窗 - 使用统一的 CookingCompareOverlay 组件 */}
      <CookingCompareOverlay
        open={cookingMode}
        onClose={() => setCookingMode(false)}
        dishTitle={dish?.name || "菜品"}
      />
    </div>
  );
}