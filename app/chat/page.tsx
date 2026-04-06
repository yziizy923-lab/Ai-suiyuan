"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useRef } from "react";
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
      : "/api/dishes";
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch dishes");
    const data = await response.json();
    return data.dishes.map((dish: { id: number; name: string; desc?: string; image?: string; tags?: string[]; ingredients?: string[] | string; origin?: string; history?: string; originalText?: string; original_text?: string; modernMethod?: string; modern_method?: string }) => ({
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
    console.error("API fetch error:", error);
    return [];
  }
}

// 便签的几种背景色，循环使用
const NOTE_COLORS = ["#fff9e6", "#f0f8e8", "#fff0f0", "#eef4ff", "#f8f0ff"];
const NOTE_ROTATIONS = [-1.5, 1.2, -0.8, 1.8, -1.2, 0.5];

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // 历史提问便签
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = searchParams.get("query");
    if (query) {
      const timer1 = setTimeout(() => setSearchQuery(query), 0);
      const timer2 = setTimeout(() => setLoading(true), 0);
      fetchDishesFromAPI(query).then((results) => {
        setDishes(results);
        setLoading(false);
      });
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const handleSendChat = () => {
    const val = chatInputRef.current?.value.trim();
    if (!val) return;
    // 加入便签历史
    setChatHistory((prev) => [...prev, val]);
    // 清空输入框
    if (chatInputRef.current) chatInputRef.current.value = "";
    // 跳转
    router.push(`/chat?query=${encodeURIComponent(val)}`);
  };

  const handleCardClick = (dish: Dish) => {
    router.push(`/dish/${dish.id}`);
  };

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div className="garden-container">
      <nav className="top-nav">
        <button onClick={handleBack} className="back-link">
          「 返回随园 」
        </button>
      </nav>

      <main className="main-content">
        {loading ? (
          <div className="loading-section">
            <div className="yuanmei-avatar-large">枚</div>
            <p className="loading-text">袁子正在为你翻阅《食单》...</p>
          </div>
        ) : (
          <>
            {/* 问答区：便签列 + 输入框 */}
            <div className="chat-area">
              {/* 左侧便签列，只在有历史时显示 */}
              {chatHistory.length > 0 && (
                <div className="notes-col">
                  <p className="notes-label">问过的问题</p>
                  {chatHistory.map((q, i) => (
                    <div
                      key={i}
                      className="sticky-note"
                      style={{
                        background: NOTE_COLORS[i % NOTE_COLORS.length],
                        transform: `rotate(${NOTE_ROTATIONS[i % NOTE_ROTATIONS.length]}deg)`,
                        zIndex: chatHistory.length - i,
                        marginBottom: i < chatHistory.length - 1 ? "-10px" : "0",
                      }}
                    >
                      <span className="note-index">问 {`${"①②③④⑤⑥⑦⑧⑨⑩"[i] ?? i + 1}`}</span>
                      <span className="note-text">{q}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 右侧：袁子头像 + 输入框 */}
              <div className="chat-box-wrapper">
                <div className="yuanmei-intro">
                  <div className="yuanmei-avatar-small">枚</div>
                  <span className="yuanmei-intro-text">袁子在此，有何疑问尽管道来。</span>
                </div>
                <div className="chat-input-box">
                  <input
                    ref={chatInputRef}
                    type="text"
                    placeholder="例：想吃清淡一点的，或者有没有素菜推荐..."
                    className="chat-input-field"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendChat();
                    }}
                  />
                  <button className="chat-send-btn" onClick={handleSendChat}>
                    询问
                  </button>
                </div>
              </div>
            </div>

            <p className="results-count">
              共寻得 <span className="count-number">{dishes.length}</span> 道佳肴
            </p>

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
                {/* 已删除返回按钮 */}
              </div>
            )}
          </>
        )}
      </main>

      <style jsx>{`
        .garden-container {
          min-height: 100vh;
          background-color: #f2ede1;
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 27px,
            rgba(180, 160, 120, 0.08) 27px,
            rgba(180, 160, 120, 0.08) 28px
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
          background: rgba(242, 237, 225, 0.95);
          backdrop-filter: blur(8px);
          z-index: 100;
          border-bottom: 1px solid rgba(139, 90, 43, 0.1);
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
        .back-link:hover {
          background: #8b5a2b;
          color: #fff;
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

        /* ====== 核心新增：横向布局容器 ====== */
        .chat-area {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 40px;
          animation: fadeInUp 0.4s ease;
        }

        /* 便签列 */
        .notes-col {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex-shrink: 0;
          min-width: 140px;
          max-width: 180px;
        }

        .notes-label {
          font-size: 11px;
          color: #8b5a2b;
          letter-spacing: 2px;
          opacity: 0.55;
          margin-bottom: 12px;
        }

        .sticky-note {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid rgba(180, 140, 60, 0.22);
          border-radius: 2px;
          box-shadow: 2px 3px 0 rgba(180, 140, 60, 0.1);
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: transform 0.25s, box-shadow 0.25s;
          cursor: default;
          position: relative;
        }

        .sticky-note:hover {
          transform: rotate(0deg) translateY(-5px) !important;
          box-shadow: 3px 6px 12px rgba(139, 90, 43, 0.18);
          z-index: 20 !important;
        }

        .note-index {
          font-size: 10px;
          color: #b89060;
          letter-spacing: 1px;
        }

        .note-text {
          font-size: 12px;
          color: #4a3318;
          letter-spacing: 0.5px;
          line-height: 1.6;
          word-break: break-all;
        }

        /* 输入区靠右 */
        .chat-box-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .yuanmei-intro {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
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
          max-width: 520px;
          width: 100%;
          padding: 12px 20px;
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
          font-size: 14px;
          color: #332c28;
          outline: none;
          padding: 6px 0;
          letter-spacing: 0.5px;
        }

        .chat-input-field::placeholder {
          color: #bbb;
          font-size: 13px;
          letter-spacing: 1px;
        }

        .chat-send-btn {
          background: linear-gradient(135deg, #8b5a2b, #a0692e);
          color: #fff;
          border: none;
          padding: 8px 20px;
          border-radius: 20px;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          letter-spacing: 2px;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(139, 90, 43, 0.25);
          white-space: nowrap;
        }

        .chat-send-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(139, 90, 43, 0.35);
        }

        /* ====== 其余原有样式 ====== */
        .results-count {
          font-size: 14px;
          color: #8b5a2b;
          letter-spacing: 2px;
          opacity: 0.8;
          margin-bottom: 28px;
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

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: #fffcf5;
          border-radius: 12px;
          border: 1px dashed rgba(139, 90, 43, 0.2);
          animation: fadeIn 0.6s ease;
        }

        .empty-icon {
          font-size: 48px;
          color: rgba(139, 90, 43, 0.2);
          margin-bottom: 16px;
        }

        .empty-text {
          font-size: 16px;
          color: #8b5a2b;
          letter-spacing: 2px;
          opacity: 0.7;
          margin: 0;
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
          box-shadow: 0 6px 16px rgba(139, 90, 43, 0.4);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .top-nav { padding: 16px 24px; }
          .main-content { padding: 24px 16px 40px; }
          .chat-area { flex-direction: column; align-items: stretch; }
          .notes-col { flex-direction: row; flex-wrap: wrap; max-width: 100%; }
          .sticky-note { width: auto; min-width: 100px; margin-bottom: 0 !important; }
          .chat-box-wrapper { align-items: stretch; }
          .dish-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
        }
      `}</style>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "#f2ede1",
            fontFamily: '"Noto Serif SC", serif',
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#8b5a2b,#c4853f)",
                color: "#fff",
                fontSize: 24,
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              枚
            </div>
            <p style={{ color: "#8b5a2b", letterSpacing: 3, fontSize: 15 }}>
              袁子正在为你翻阅《食单》...
            </p>
          </div>
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}