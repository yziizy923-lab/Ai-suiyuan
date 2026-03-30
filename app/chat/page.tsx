"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

type Dish = {
  id: number;
  name: string;
  desc: string;
  image: string;
  tags: string[];
  ingredients: string[];
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
      ...dish,
      image: dish.image || `https://picsum.photos/seed/${dish.id}/400/400`
    }));
  } catch (error) {
    console.error('API fetch error:', error);
    return [];
  }
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [results, setResults] = useState<Dish[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const query = searchParams.get("query");
    if (query) {
      setInput(query);
      handleSearch(query);
    }
  }, [searchParams]);

  const handleSearch = async (searchQuery?: string) => {
    const query = searchQuery || input;
    if (!query.trim()) return;
    setIsSearching(true);
    setResults(null);
    
    try {
      const dishes = await fetchDishesFromAPI(query);
      setResults(dishes);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    }
    
    setIsSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="garden-container">
      <nav className="top-nav">
        <button onClick={() => router.push("/")} className="back-link">「 归去 」</button>
        <div className="dynasty-tag">清 · 随园食单</div>
      </nav>

      <main className="main-content">
        {/* 搜索区域 */}
        <div className="search-section">
          <div className="search-box">
            <div className="search-header">
              <div className="yuanmei-avatar">枚</div>
              <div className="search-title">随园问膳</div>
            </div>
            <div className="paper-line"></div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例：我想吃点酸甜开胃的，最好是鱼..."
              className="search-input"
              rows={3}
            />
            <div className="search-footer">
              <button onClick={() => handleSearch()} disabled={isSearching} className="search-btn">
                <span className="seal-text">寻味</span>
              </button>
            </div>
          </div>
        </div>

        {/* 结果展示区域 */}
        <div className="results-section">
          {isSearching && (
            <div className="ink-loading">
              <div className="ink-stain"></div>
              <p>袁子正在为你翻阅《食单》...</p>
            </div>
          )}

          {!isSearching && results !== null && (
            <>
              {results.length > 0 ? (
                <>
                  <div className="results-header">
                    <div className="results-count">共寻得 {results.length} 道佳肴</div>
                  </div>
                  <div className="dish-grid">
                    {results.map((dish, i) => (
                      <div key={dish.id} className="dish-card" style={{ animationDelay: `${i * 0.1}s` }} onClick={() => router.push(`/dish/${dish.id}`)}>
                        <div className="dish-media">
                          <img
                            src={dish.image}
                            alt={dish.name}
                            onError={(e) => {
                              const t = e.target as HTMLImageElement;
                              t.src = `https://picsum.photos/seed/${dish.id}x/400/400`;
                            }}
                          />
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
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">无</div>
                  <p className="empty-text">随园中暂无此味，不如问问别的？</p>
                </div>
              )}
            </>
          )}
        </div>
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
          padding: 30px 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
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

        .main-content {
          flex: 1;
          padding: 0 60px 60px;
          display: flex;
          flex-direction: column;
        }

        .search-section {
          display: flex;
          justify-content: center;
          margin-bottom: 40px;
        }

        .search-box {
          width: 100%;
          max-width: 600px;
          background: #fffcf5;
          padding: 24px 28px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
          border: 1px solid rgba(139,90,43,0.15);
          border-radius: 8px;
        }

        .search-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .yuanmei-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff;
          font-size: 18px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .search-title {
          font-size: 15px;
          color: #8b5a2b;
          letter-spacing: 3px;
        }

        .paper-line {
          height: 1px;
          background: linear-gradient(to right, #dcd0b8, transparent);
          margin-bottom: 16px;
        }

        .search-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: 16px;
          color: #332c28;
          resize: none;
          line-height: 1.8;
          box-sizing: border-box;
        }
        .search-input::placeholder { color: #ccc; font-size: 14px; }

        .search-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 16px;
        }

        .search-btn {
          background: #a00;
          color: #fff;
          border: none;
          padding: 10px 28px;
          cursor: pointer;
          box-shadow: 3px 3px 0px #600;
          transition: all 0.2s;
          font-family: inherit;
          border-radius: 4px;
        }
        .search-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .search-btn:not(:disabled):active {
          transform: translate(2px, 2px);
          box-shadow: none;
        }
        .seal-text {
          letter-spacing: 2px;
          font-weight: bold;
        }

        .results-section {
          flex: 1;
        }

        .results-header {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(139,90,43,0.15);
        }

        .results-count {
          font-size: 13px;
          color: #8b5a2b;
          letter-spacing: 2px;
        }

        .dish-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 28px;
        }

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
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
          transform: translateY(-4px);
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

        .dish-media {
          position: relative;
          height: 200px;
          overflow: hidden;
          background: #f5f0e8;
        }
        .dish-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: sepia(10%);
          transition: transform 0.6s;
        }
        .dish-card:hover .dish-media img { transform: scale(1.05); }

        .corner-tag {
          position: absolute;
          top: 12px;
          left: 12px;
          border: 1px solid #a00;
          color: #a00;
          font-size: 10px;
          padding: 2px 6px;
          background: rgba(255,255,255,0.9);
          letter-spacing: 1px;
        }

        .dish-info {
          padding: 18px 20px;
        }

        .dish-name {
          font-size: 18px;
          margin: 0 0 8px;
          color: #1e1a17;
          letter-spacing: 2px;
          border-left: 3px solid #a00;
          padding-left: 10px;
        }

        .dish-desc {
          font-size: 13px;
          color: #666;
          line-height: 1.7;
          margin: 0 0 12px;
        }

        .dish-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tag {
          background: rgba(139,90,43,0.08);
          color: #8b5a2b;
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 11px;
          border: 1px solid rgba(139,90,43,0.12);
        }

        .ink-loading { 
          text-align: center;
          padding: 80px 0;
        }
        .ink-stain {
          width: 40px;
          height: 40px;
          background: #332c28;
          border-radius: 50%;
          margin: 0 auto 20px;
          filter: blur(8px);
          animation: inkPulse 1.5s infinite;
        }
        @keyframes inkPulse {
          0%, 100% { transform: scale(0.8); opacity: 0.3; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
        .ink-loading p {
          color: #8b5a2b;
          letter-spacing: 2px;
          font-size: 14px;
        }

        .empty-state {
          text-align: center;
          padding: 100px 0;
        }
        .empty-icon {
          font-size: 48px;
          color: rgba(139,90,43,0.2);
          margin-bottom: 20px;
        }
        .empty-text {
          font-size: 16px;
          color: #8b5a2b;
          letter-spacing: 3px;
          opacity: 0.6;
        }

        @media (max-width: 768px) {
          .top-nav { padding: 20px 24px; }
          .main-content { padding: 0 24px 40px; }
          .dish-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

// 使用 Suspense 包装以支持 useSearchParams
export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="garden-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="ink-loading">
          <div className="ink-stain"></div>
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
            color: #2d2926;
          }
          .ink-loading { width: 100%; text-align: center; }
          .ink-stain {
            width: 40px; height: 40px; background: #332c28; border-radius: 50%;
            margin: 0 auto 20px; filter: blur(8px);
            animation: inkPulse 1.5s infinite;
          }
          @keyframes inkPulse {
            0%, 100% { transform: scale(0.8); opacity: 0.3; }
            50% { transform: scale(1.3); opacity: 0.6; }
          }
        `}</style>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}