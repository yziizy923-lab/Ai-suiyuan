'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './CookingSteps.module.css';

interface CookingStep {
  step: number;
  title: string;
  desc: string;
}

interface CookingStepsProps {
  dishName: string;
  dishDesc: string;
  ingredients?: string[];
}

const AUTO_MS = 3000;

export function CookingSteps({ dishName, dishDesc, ingredients }: CookingStepsProps) {
  const [steps, setSteps] = useState<CookingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepImages, setStepImages] = useState<Record<number, string>>({});
  const [generatingStep, setGeneratingStep] = useState<number | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepImagesRef = useRef<Record<number, string>>({});
  stepImagesRef.current = stepImages;

  useEffect(() => {
    const fetchSteps = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          dish: dishName,
          desc: dishDesc,
          ingredients: ingredients?.join('、') || '',
        });
        const response = await fetch(`/api/cooking-steps?${params}`);
        const data = await response.json();

        if (data.success && data.steps) {
          setSteps(data.steps);
        } else {
          setError('暂无烹饪步骤');
        }
      } catch {
        setError('获取步骤失败');
      } finally {
        setLoading(false);
      }
    };

    fetchSteps();
  }, [dishName, dishDesc, ingredients]);

  useEffect(() => {
    if (steps.length === 0) return;

    const generateImages = async () => {
      for (const step of steps) {
        if (stepImagesRef.current[step.step]) continue;

        setGeneratingStep(step.step);
        try {
          const response = await fetch(
            `/api/generate-dish-image?dish=${encodeURIComponent(`${dishName} ${step.title}`)}&desc=${encodeURIComponent(step.desc)}`
          );
          const data = await response.json();

          if (data.success && data.imageUrl) {
            setStepImages((prev) => ({ ...prev, [step.step]: data.imageUrl }));
          }
        } catch {
          console.error(`生成步骤${step.step}图片失败`);
        }
        setGeneratingStep(null);
      }
    };

    generateImages();
  }, [steps, dishName]);

  // 自动推进
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (steps.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrentStep((i) => (i + 1) % steps.length);
    }, AUTO_MS);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [steps.length]);

  useEffect(() => {
    setCurrentStep(0);
  }, [steps]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>正在获取烹饪秘方...</p>
      </div>
    );
  }

  if (error || steps.length === 0) {
    return null;
  }

  const step = steps[currentStep];
  const gen = step && generatingStep === step.step;
  const imgUrl = step ? stepImages[step.step] : undefined;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.icon}>🍳</span>
        <h3 className={styles.title}>随园烹制法</h3>
      </div>

      {/* 横向时间轴：点击图片切换当前步骤 */}
      <div className={styles.timeline} role="region" aria-label="制作步骤时间轴">
        <div className={styles.track}>
          {steps.map((s, i) => {
            const isActive = i === currentStep;
            const isPast = i < currentStep;
            const isGen = s && generatingStep === s.step;
            const img = stepImages[s.step];
            return (
              <button
                type="button"
                key={s.step}
                className={`${styles.frame} ${isActive ? styles.frameActive : ''} ${isPast ? styles.framePast : ''}`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`步骤 ${s.step}：${s.title}`}
                onClick={() => setCurrentStep(i)}
              >
                {img ? (
                  <img src={img} alt="" className={styles.frameImg} />
                ) : isGen ? (
                  <div className={styles.frameLoading}>
                    <div className={styles.spinner} />
                  </div>
                ) : (
                  <div className={styles.framePlaceholder}>
                    <span className={styles.framePlaceholderIcon}>🍽️</span>
                  </div>
                )}
                <span className={styles.frameBadge}>{s.step}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 当前步骤文字 */}
      <div className={styles.textBox} key={currentStep}>
        <h4 className={styles.stepTitle}>{step.title}</h4>
        <p className={styles.stepDesc}>{step.desc}</p>
      </div>

      {/* 底部进度指示 */}
      <div className={styles.progressRow} aria-hidden>
        {steps.map((_, i) => (
          <div
            key={i}
            className={`${styles.dot} ${i === currentStep ? styles.dotActive : ''} ${i < currentStep ? styles.dotPast : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
