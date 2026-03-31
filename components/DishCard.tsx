'use client';

import { useState, useEffect } from 'react';

type Dish = {
  id: number;
  name: string;
  desc: string;
  image: string;
  tags: string[];
  originalText?: string;
  modernMethod?: string;
};

interface DishCardProps {
  dish: Dish;
  index: number;
  onClick: () => void;
}

export function DishCard({ dish, index, onClick }: DishCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 组件挂载时自动生成图片
  useEffect(() => {
    const generateImage = async () => {
      if (isGenerating || imageUrl) return;

      setIsGenerating(true);
      try {
        // 用 POST + JSON，避免袁枚原文/现代做法过长导致 GET URL 被截断
        const response = await fetch('/api/generate-dish-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dish: dish.name,
            desc: dish.desc || '',
            ancient: dish.originalText || '',
            method: dish.modernMethod || '',
          }),
        });
        const data = await response.json();

        if (data.success && data.imageUrl) {
          setImageUrl(data.imageUrl);
        } else {
          setError(data.error || '生成失败');
        }
      } catch (err) {
        setError('网络错误');
      } finally {
        setIsGenerating(false);
      }
    };

    generateImage();
  }, [dish.id, dish.name, dish.desc, dish.originalText, dish.modernMethod]);

  return (
    <>
      <div 
        className="dish-card" 
        style={{ animationDelay: `${index * 0.1}s` }} 
        onClick={onClick}
      >
        <div className="dish-media">
          {isGenerating ? (
            <div className="image-loading">
              <div className="loading-spinner" />
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt={dish.name} />
          ) : error ? (
            <div className="image-error">{error}</div>
          ) : (
            <div className="image-loading">
              <div className="loading-spinner" />
            </div>
          )}
          <div className="corner-tag">随园秘藏</div>
        </div>
        <div className="dish-info">
          <h3 className="dish-name">{dish.name}</h3>
          <p className="dish-desc">{dish.desc}</p>
          <div className="dish-tags">
            {dish.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .dish-card {
          background: #fff;
          border: 1px solid #eee;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
          opacity: 0;
          animation: fadeInUp 0.6s ease forwards;
        }

        .dish-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }

        .dish-media {
          position: relative;
          width: 100%;
          padding-top: 75%;
          overflow: hidden;
          background: #f0f0f0;
        }

        .dish-media img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s;
        }

        .dish-card:hover .dish-media img {
          transform: scale(1.05);
        }

        .corner-tag {
          position: absolute;
          top: 10px;
          left: 10px;
          border: 1px solid #a00;
          color: #a00;
          font-size: 10px;
          padding: 2px 6px;
          background: rgba(255,255,255,0.9);
          letter-spacing: 1px;
          font-family: "Noto Serif SC", serif;
        }

        .image-loading {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #e0e0e0;
          border-top-color: #a00;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .image-error {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          color: #999;
          font-size: 14px;
        }

        .dish-info {
          padding: 14px 16px;
        }

        .dish-name {
          margin: 0 0 6px;
          font-size: 16px;
          font-weight: 600;
          color: #333;
          font-family: "Noto Serif SC", serif;
        }

        .dish-desc {
          margin: 0 0 10px;
          font-size: 13px;
          color: #666;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .dish-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag {
          display: inline-block;
          padding: 2px 8px;
          background: #fef2f2;
          color: #a00;
          font-size: 11px;
          border-radius: 4px;
          border: 1px solid #fecaca;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
