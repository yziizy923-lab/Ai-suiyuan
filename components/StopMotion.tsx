"use client";

import { useState, useEffect, useRef } from "react";

interface Step {
  step: number;
  title: string;
  desc: string;
  imageBase64?: string;
}

interface StopMotionProps {
  steps: Step[];
  dishName: string;
}

export default function StopMotion({ steps, dishName }: StopMotionProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalSteps = steps.length;
  const currentData = steps[currentStep];

  // 自动播放逻辑
  useEffect(() => {
    if (!isPlaying || transitioning) return;

    timerRef.current = setTimeout(() => {
      // 开始过渡
      setTransitioning(true);

      // 400ms 后切换到下一张
      setTimeout(() => {
        setCurrentStep((prev) => (prev + 1) % totalSteps);
        setTransitioning(false);
      }, 400);
    }, 2500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStep, isPlaying, transitioning, totalSteps]);

  const goToStep = (index: number) => {
    setIsPlaying(false);
    setTransitioning(true);
    setTimeout(() => {
      setCurrentStep(index);
      setTransitioning(false);
    }, 400);
  };

  return (
    <div style={{ width: '100%', minHeight: '600px' }}>
      {/* 标题 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'
      }}>
        <span style={{ fontSize: '24px' }}>🍳</span>
        <h2 style={{
          fontSize: '20px', fontWeight: 600, color: '#fff', margin: 0, letterSpacing: '3px'
        }}>制作过程</h2>
        <span style={{
          fontSize: '13px', color: '#f4c542', marginLeft: 'auto', letterSpacing: '1px'
        }}>{dishName}</span>
      </div>

      {/* 动画舞台 */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a1612 0%, #2d2620 40%, #3d352d 100%)',
        boxShadow: '0 25px 80px rgba(0,0,0,0.35), 0 10px 30px rgba(0,0,0,0.2)',
        marginBottom: '20px'
      }}>
        {/* 图片 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'scale(1.05)' : 'scale(1)',
          transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out'
        }}>
          {currentData?.imageBase64 ? (
            <img
              src={`data:image/png;base64,${currentData.imageBase64}`}
              alt={currentData.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #2d2620 0%, #1a1612 100%)',
              gap: '16px'
            }}>
              <span style={{ fontSize: '80px', opacity: 0.3 }}>🍽️</span>
              <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px' }}>
                第 {currentData?.step} 步
              </span>
            </div>
          )}
        </div>

        {/* 步骤指示器 */}
        <div style={{
          position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '12px'
        }}>
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => goToStep(index)}
              style={{
                width: index === currentStep ? '24px' : '12px',
                height: '12px',
                borderRadius: '6px',
                background: index === currentStep ? '#f4c542' : 'rgba(255,255,255,0.3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0
              }}
            />
          ))}
        </div>

        {/* 文字层 */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          padding: '80px 40px 50px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, transparent 100%)',
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'translateY(20px)' : 'translateY(0)',
          transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '56px', fontWeight: 700, color: '#f4c542', lineHeight: 1 }}>
              {currentData?.step}
            </span>
            <span style={{ fontSize: '28px', color: 'rgba(255,255,255,0.3)' }}>/</span>
            <span style={{ fontSize: '22px', color: 'rgba(255,255,255,0.4)' }}>{totalSteps}</span>
          </div>
          <h3 style={{
            fontSize: '30px', fontWeight: 600, color: '#fff', margin: '0 0 12px', letterSpacing: '4px'
          }}>{currentData?.title}</h3>
          <p style={{
            fontSize: '15px', lineHeight: 1.9, color: 'rgba(255,255,255,0.8)',
            margin: 0, maxWidth: '480px'
          }}>{currentData?.desc}</p>
        </div>

        {/* 进度条 */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '3px', background: 'rgba(255,255,255,0.15)'
        }}>
          <div style={{
            height: '100%',
            width: `${((currentStep + 1) / totalSteps) * 100}%`,
            background: 'linear-gradient(90deg, #f4c542, #e6a91a)',
            transition: 'width 0.5s ease-in-out',
            boxShadow: '0 0 10px rgba(244,197,66,0.5)'
          }} />
        </div>
      </div>

      {/* 控制栏 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
        <button
          onClick={() => goToStep((currentStep - 1 + totalSteps) % totalSteps)}
          style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(139,90,43,0.1)', border: '2px solid rgba(139,90,43,0.2)',
            color: '#8b5a2b', fontSize: '18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s ease'
          }}
        >◀</button>

        <button
          onClick={() => {
            setIsPlaying(!isPlaying);
            if (!isPlaying) {
              setTransitioning(true);
              setTimeout(() => {
                setCurrentStep((prev) => (prev + 1) % totalSteps);
                setTransitioning(false);
              }, 400);
            }
          }}
          style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: isPlaying ? 'linear-gradient(135deg, #c4853f, #d49550)' : 'linear-gradient(135deg, #8b5a2b, #a06830)',
            border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(139,90,43,0.3)',
            transition: 'all 0.25s ease'
          }}
        >{isPlaying ? '⏸' : '▶'}</button>

        <button
          onClick={() => goToStep((currentStep + 1) % totalSteps)}
          style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(139,90,43,0.1)', border: '2px solid rgba(139,90,43,0.2)',
            color: '#8b5a2b', fontSize: '18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s ease'
          }}
        >▶</button>

        <button
          onClick={() => goToStep(0)}
          style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(139,90,43,0.1)', border: '2px solid rgba(139,90,43,0.2)',
            color: '#8b5a2b', fontSize: '18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s ease'
          }}
        >↻</button>
      </div>

      {/* 步骤预览 */}
      <div style={{
        display: 'flex', gap: '10px', overflowX: 'auto', padding: '8px 4px'
      }}>
        {steps.map((step, index) => (
          <button
            key={step.step}
            onClick={() => goToStep(index)}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px',
              background: index === currentStep ? 'rgba(139,90,43,0.15)' : 'rgba(139,90,43,0.05)',
              border: index === currentStep ? '2px solid #8b5a2b' : '1px solid rgba(139,90,43,0.12)',
              borderRadius: '10px', cursor: 'pointer', transition: 'all 0.25s ease',
              minWidth: '130px'
            }}
          >
            <span style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: index === currentStep ? 'linear-gradient(135deg, #f4c542, #e6a91a)' : 'rgba(139,90,43,0.15)',
              color: index === currentStep ? '#2d2926' : '#8b5a2b',
              fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>{step.step}</span>
            <span style={{
              fontSize: '13px', color: '#5a4a3a', whiteSpace: 'nowrap'
            }}>{step.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
