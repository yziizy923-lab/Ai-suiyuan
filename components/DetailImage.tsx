'use client';

import { useState, useEffect } from 'react';

interface DetailImageProps {
  dishName: string;
  dishDesc: string;
  originalText?: string;
  modernMethod?: string;
  /** 优先使用此图片 URL（如从数据库获取的） */
  imageUrl?: string;
  fallbackSrc?: string;
  className?: string;
}

export function DetailImage({ dishName, dishDesc, originalText, modernMethod, imageUrl: dbImageUrl, fallbackSrc, className }: DetailImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 检查图片是否有效（非空且不是占位符）
  const hasValidImage = (url: string | undefined | null): boolean => {
    if (!url) return false;
    if (url.includes('picsum.photos')) return false;
    return url.startsWith('data:') || url.startsWith('/') || url.startsWith('http');
  };

  useEffect(() => {
    const initImage = async () => {
      const validDbUrl = dbImageUrl;
      // 1. 优先使用传入的图片 URL（来自数据库）
      if (hasValidImage(validDbUrl)) {
        setImageUrl(validDbUrl);
        setIsGenerating(false);
        return;
      }

      // 2. 数据库无图片，调用 API 生成并保存到数据库
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch('/api/generate-dish-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dish: dishName,
            desc: dishDesc || '',
            ancient: originalText || '',
            method: modernMethod || '',
            saveToDb: true,
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

    initImage();
  }, [dishName, dishDesc, originalText, modernMethod, dbImageUrl]);

  if (isGenerating) {
    return (
      <div className={`${className || ''}`} style={{ 
        width: 160, 
        height: 160, 
        background: 'linear-gradient(135deg, #f5f5f5, #e8e8e8)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: 24,
          height: 24,
          border: '3px solid #e0e0e0',
          borderTopColor: '#a00',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <img
        src={fallbackSrc || `https://picsum.photos/seed/${dishName}/400/400`}
        alt={dishName}
        className={className}
      />
    );
  }

  return (
    <img
      src={imageUrl || fallbackSrc}
      alt={dishName}
      className={className}
    />
  );
}
