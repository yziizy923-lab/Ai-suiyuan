"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { DishCard } from "@/components/DishCard";

type Dish = {
  id: number;
  name: string;
  desc: string;
  image: string;
  tags: string[];
  ingredients: string[];
  origin?: string;
  history?: string;
  originalText?: string;
  modernMethod?: string;
};

async function fetchDishesFromAPI(search?: string): Promise<Dish[]> {
  try {
    const url = search 
      ? `/api/dishes?search=${encodeURIComponent(search)}`
      : '/api/dishes';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch dishes');
    }
    const data = await response.json();
    return data.dishes.map((dish: any) => ({
      id: dish.id,
      name: dish.name,
      desc: dish.desc || "",
      image: dish.image || `https://picsum.photos/seed/${dish.id}/400/400`,
      tags: Array.isArray(dish.tags) ? dish.tags : [],
      ingredients: Array.isArray(dish.ingredients)
        ? dish.ingredients
        : typeof dish.ingredients === "string"
          ? dish.ingredients.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
          : [],
      origin: dish.origin,
      history: dish.history,
      originalText: dish.originalText || dish.original_text || "",
      modernMethod: dish.modernMethod || dish.modern_method || "",
    }));
  } catch (error) {
    console.error('API fetch error:', error);
    return [];
  }
}

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const query = searchParams.get("query");
    if (query) {
      setSearchQuery(query);
      setLoading(true);
      fetchDishesFromAPI(query).then((results) => {
        setDishes(results);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const handleCardClick = (dish: Dish) => {
    router.push(`/dish/${dish.id}`);
  };

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div className="garden-container">
      <nav className="top-nav">
        <button onClick={handleBack} className="back-link">「 返回随园 」</button>
        <div className="dynasty-tag">清 · 随园食单</div>
      </nav>

      <main className="main-content">
        {loading ? (
          <div className="loading-section">
            <div className="yuanmei-avatar-large">枚</div>
            <p className="loading-text">袁子正在为你翻阅《食单》...</p>
          </div>
        ) : (
          <>
            {/* 智能对话框 */}
            <div className="chat-box-wrapper">
              <div className="yuanmei-intro">
                <div className="yuanmei-avatar-small">枚</div>
                <span className="yuanmei-intro-text">袁子在此，有何疑问尽管道来。</span>
              </div>
              <div className="chat-input-box">
                <input
                  type="text"
                  placeholder="例：想吃清淡一点的，或者有没有素菜推荐..."
                  className="chat-input-field"
                  id="ai-chat-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = document.getElementById('ai-chat-input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        router.push(`/chat?query=${encodeURIComponent(input.value.trim())}`);
                      }
                    }
                  }}
                />
                <button
                  className="chat-send-btn"
                  onClick={() => {
                    const input = document.getElementById('ai-chat-input') as HTMLInputElement;
                    if (input?.value.trim()) {
                      router.push(`/chat?query=${encodeURIComponent(input.value.trim())}`);
                    }
                  }}
                >
                  询问
                </button>
              </div>
            </div>

            <div className="results-header">
              <h2 className="results-title">
                {searchQuery ? `「${searchQuery}」的搜索结果` : '随园菜谱'}
              </h2>
              <p className="results-count">
                共寻得 <span className="count-number">{dishes.length}</span> 道佳肴
              </p>
            </div>

            {dishes.length > 0 ? (
              <div className="dish-grid">
                {dishes.map((dish, i) => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    index={i}
                    onClick={() => handleCardClick(dish)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">无</div>
                <p className="empty-text">随园中暂无此味，不如问问别的？</p>
                <button onClick={handleBack} className="retry-btn">
                  返回首页重新搜索
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <style jsx>{`
        .garden-container {
          min-height: 100vh;
          background-color: #f2ede1;
          background-image:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 27px,
              rgba(180,160,120,0.08) 27px,
              rgba(180,160,120,0.08) 28px
            );
          font-family: "Noto Serif SC", "Source Han Serif CN", "SimSun", "STSong", serif;
          color: #2d2926;
          display: flex;
          flex-direction: column;
        }

        .top-nav {
          padding: 20px 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          background: rgba(242,237,225,0.95);
          backdrop-filter: blur(8px);
          z-index: 100;
          border-bottom: 1px solid rgba(139,90,43,0.1);
        }

        .back-link {
          background: none;
          border: 1px solid #8b5a2b;
          color: #8b5a2b;
          padding: 6px 18px;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.3s;
          font-family: inherit;
        }

        .back-link:hover { background: #8b5a2b; color: #fff; }

        .dynasty-tag { letter-spacing: 6px; font-weight: bold; opacity: 0.4; }

        .new-search-btn {
          background: none;
          border: 1px solid rgba(139,90,43,0.3);
          color: rgba(139,90,43,0.6);
          padding: 4px 12px;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.3s;
          font-family: inherit;
          font-size: 12px;
        }

        .new-search-btn:hover {
          border-color: #8b5a2b;
          color: #8b5a2b;
        }

        .main-content {
          flex: 1;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          padding: 40px 60px 60px;
        }

        .loading-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 100px 20px;
          animation: fadeIn 0.6s ease;
        }

        .yuanmei-avatar-large {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff;
          font-size: 24px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .loading-text {
          color: #8b5a2b;
          letter-spacing: 3px;
          font-size: 15px;
          opacity: 0.8;
        }

        .results-header {
          margin-bottom: 40px;
          text-align: center;
          animation: fadeInUp 0.6s ease;
        }

        .chat-box-wrapper {
          margin-bottom: 40px;
          animation: fadeInUp 0.4s ease;
        }

        .yuanmei-intro {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: center;
          margin-bottom: 16px;
        }

        .yuanmei-avatar-small {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff;
          font-size: 14px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .yuanmei-intro-text {
          color: #8b5a2b;
          font-size: 14px;
          letter-spacing: 2px;
          opacity: 0.8;
        }

        .chat-input-box {
          display: flex;
          gap: 12px;
          max-width: 700px;
          margin: 0 auto;
          padding: 20px 24px;
          background: rgba(255, 252, 245, 0.98);
          border-radius: 16px;
          border: 1px solid rgba(139, 90, 43, 0.2);
          box-shadow: 0 8px 32px rgba(139, 90, 43, 0.1);
        }

        .chat-input-field {
          flex: 1;
          background: transparent;
          border: none;
          font-family: inherit;
          font-size: 15px;
          color: #332c28;
          outline: none;
          padding: 10px 0;
          letter-spacing: 0.5px;
        }

        .chat-input-field::placeholder {
          color: #bbb;
          font-size: 14px;
          letter-spacing: 1px;
        }

        .chat-send-btn {
          background: linear-gradient(135deg, #8b5a2b, #a0692e);
          color: #fff;
          border: none;
          padding: 10px 28px;
          border-radius: 22px;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          letter-spacing: 3px;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(139, 90, 43, 0.25);
        }

        .chat-send-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(139, 90, 43, 0.35);
        }

        .results-title {
          font-size: 28px;
          color: #1e1a17;
          margin: 0 0 16px;
          letter-spacing: 4px;
        }

        .results-count {
          font-size: 14px;
          color: #8b5a2b;
          letter-spacing: 2px;
          opacity: 0.8;
        }

        .count-number {
          font-size: 20px;
          font-weight: bold;
          color: #a00;
        }

        .dish-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: #fffcf5;
          border-radius: 12px;
          border: 1px dashed rgba(139,90,43,0.2);
          animation: fadeIn 0.6s ease;
        }

        .empty-icon {
          font-size: 48px;
          color: rgba(139,90,43,0.2);
          margin-bottom: 16px;
        }

        .empty-text {
          font-size: 16px;
          color: #8b5a2b;
          letter-spacing: 2px;
          opacity: 0.7;
          margin: 0 0 24px;
        }

        .retry-btn {
          background: linear-gradient(135deg, #8b5a2b, #a0692e);
          color: #fff;
          border: none;
          padding: 12px 28px;
          border-radius: 24px;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          letter-spacing: 2px;
          transition: all 0.3s;
        }

        .retry-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(139,90,43,0.4);
        }

        @media (max-width: 768px) {
          .top-nav { padding: 16px 24px; }
          .main-content { padding: 24px 16px 40px; }
          .results-title { font-size: 22px; }
          .dish-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
          .chat-input-box { padding: 14px 18px; }
          .chat-send-btn { padding: 10px 20px; font-size: 13px; }
        }
      `}</style>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      <div className="garden-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loading-content">
          <div className="yuanmei-avatar">枚</div>
          <p>袁子正在为你翻阅《食单》...</p>
        </div>
        <style jsx>{`
          .garden-container {
            min-height: 100vh;
            background-color: #f2ede1;
            background-image:
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 27px,
                rgba(180,160,120,0.08) 27px,
                rgba(180,160,120,0.08) 28px
              );
            font-family: "Noto Serif SC", "Source Han Serif CN", "SimSun", "STSong", serif;
          }
          .loading-content {
            text-align: center;
            animation: fadeIn 0.6s ease;
          }
          .yuanmei-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #8b5a2b, #c4853f);
            color: #fff;
            font-size: 24px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          }
          .loading-content p {
            color: #8b5a2b;
            letter-spacing: 3px;
            font-size: 15px;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
}
