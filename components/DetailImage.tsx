'use client';

import { useState, useEffect } from 'react';

interface DetailImageProps {
  dishName: string;
  dishDesc: string;
  originalText?: string;
  modernMethod?: string;
  fallbackSrc?: string;
  className?: string;
}

export function DetailImage({ dishName, dishDesc, originalText, modernMethod, fallbackSrc, className }: DetailImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateImage = async () => {
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
  }, [dishName, dishDesc, originalText, modernMethod]);

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
