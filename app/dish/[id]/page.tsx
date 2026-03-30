"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [imgError, setImgError] = useState(false);

  const dishId = Number(params.id);

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

      {/* 背景：水墨纸张 */}
      <div className="paper-bg" />

      {/* 顶部导航 */}
      <nav className={`top-nav ${showContent ? 'visible' : ''}`}>
        <button onClick={() => router.push("/chat")} className="back-link">「 返回随园 」</button>
        <div className="dynasty-tag">清 · 随园食单</div>
      </nav>

      {/* 主内容 */}
      <div className={`content-overlay ${showContent ? 'visible' : ''}`}>
        
        {/* 左上角：菜品大图 */}
        <div className="dish-image-section">
          <div className="dish-image-wrap">
            <img
              src={imgError ? `https://picsum.photos/seed/fallback${dish.id}/800/500` : dish.image}
              alt={dish.name}
              className="dish-img"
              onError={() => setImgError(true)}
            />
            <div className="corner-seal">随园秘藏</div>
            <div className="img-vignette" />
          </div>
        </div>

        {/* 右侧：菜品介绍信息 */}
        <div className="dish-info-section">
          <div className="dish-info-card">
            
            {/* 菜品标题 */}
            <div className="dish-header">
              <h1 className="dish-title">{dish.name}</h1>
              <p className="dish-desc">{dish.desc}</p>
            </div>

            {/* 产地 */}
            <div className="info-block">
              <div className="info-icon">📍</div>
              <div className="info-content">
                <span className="info-label">产地</span>
                <span className="info-value">{dish.origin ?? "江南"}</span>
              </div>
            </div>

            {/* 食材 */}
            <div className="info-block">
              <div className="info-icon">🥢</div>
              <div className="info-content">
                <span className="info-label">主料</span>
                <span className="info-value">{dish.ingredients.join("、")}</span>
              </div>
            </div>

            {/* 袁枚原文 */}
            <div className="yuanmei-block">
              <div className="yuanmei-header">
                <div className="yuanmei-avatar">枚</div>
                <span className="yuanmei-label">袁枚 · 随园主人</span>
              </div>
              <div className="yuanmei-quote-wrap">
                <div className="quote-mark">❝</div>
                <p className="yuanmei-quote">
                  {dish.history ?? `此乃${dish.name}，乃随园食单中之上品。`}
                </p>
                <div className="quote-mark quote-mark-end">❞</div>
              </div>
            </div>

            {/* 标签 */}
            <div className="tags-row">
              {dish.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* 底部三个按键 */}
      <div className={`bottom-actions ${showContent ? 'visible' : ''}`}>
        <button className="action-btn action-secondary" onClick={() => router.push("/chat")}>
          <span className="btn-icon">🏠</span>
          <span className="btn-text">返回首页</span>
        </button>
        <button className="action-btn action-secondary" onClick={handleSave}>
          <span className="btn-icon">⭐</span>
          <span className="btn-text">收藏此菜</span>
        </button>
        <button className="action-btn action-primary" onClick={handleShare}>
          <span className="btn-icon">📤</span>
          <span className="btn-text">分享食单</span>
        </button>
      </div>

      <style jsx>{`
        .dish-detail-container {
          position: fixed; inset: 0;
          overflow: hidden;
          font-family: "Noto Serif SC", "Source Han Serif CN", "SimSun", "STSong", serif;
          color: #2d2926;
          display: flex;
          flex-direction: column;
        }

        /* 水墨纸张背景 */
        .paper-bg {
          position: absolute; inset: 0; z-index: 0;
          background-color: #ede8db;
          background-image:
            radial-gradient(ellipse at 20% 50%, rgba(180,150,100,0.12) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(160,130,90,0.10) 0%, transparent 50%),
            repeating-linear-gradient(
              0deg, transparent, transparent 31px,
              rgba(180,160,120,0.06) 31px, rgba(180,160,120,0.06) 32px
            );
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
          background: rgba(255,252,245,0.95);
          backdrop-filter: blur(16px);
          border-top: 1px solid rgba(139,90,43,0.15);
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
    </div>
  );
}