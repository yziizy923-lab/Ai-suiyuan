"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { DishCard } from "@/components/DishCard";
import DishDetailModal from "@/components/DishDetailModal";

type Dish = {
  id: number;
  name: string;
  desc: string;
  image: string;
  tags: string[];
  ingredients: string[];
  origin?: string;
  originCoords?: [number, number];
  history?: string;
  originalText?: string;
  modernMethod?: string;
  longitude?: number;
  latitude?: number;
};

async function fetchDishesFromAPI(search?: string): Promise<Dish[]> {
  try {
    const url = search
      ? `/api/dishes?search=${encodeURIComponent(search)}`
      : "/api/dishes";
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch dishes");
    const data = await response.json();
    return data.dishes.map((dish: Record<string, unknown>) => ({
      id: dish.id as number,
      name: dish.name as string,
      desc: (dish.desc as string) || "",
      image: (dish.image as string) || `https://picsum.photos/seed/${dish.id}/400/400`,
      tags: Array.isArray(dish.tags) ? (dish.tags as string[]) : [],
      ingredients: Array.isArray(dish.ingredients)
        ? (dish.ingredients as string[])
        : typeof dish.ingredients === "string"
          ? (dish.ingredients as string).split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
          : [],
      origin: dish.origin as string | undefined,
      history: dish.history as string | undefined,
      originalText: (dish.originalText as string) || (dish.original_text as string) || "",
      modernMethod: (dish.modernMethod as string) || (dish.modern_method as string) || "",
      // 转换 longitude/latitude 到 originCoords
      originCoords: (dish.longitude && dish.latitude)
        ? [dish.longitude as number, dish.latitude as number]
        : (dish.originCoords as [number, number] | undefined),
    }));
  } catch (error) {
    console.error("API fetch error:", error);
    return [];
  }
}

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const query = searchParams.get("query") || "";

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    if (query) {
      setLoading(true);
      fetchDishesFromAPI(query).then((results) => {
        setDishes(results);
        setLoading(false);
      });
    } else {
      setDishes([]);
      setLoading(false);
    }
  }, [query]);

  const handleBack = () => {
    router.push("/");
  };

  /** 输入：用户输入；输出：跳转带 query 的列表页并重新拉取菜品 */
  const handleAskSubmit = () => {
    const q = searchInput.trim();
    if (!q) return;
    router.push(`/chat?query=${encodeURIComponent(q)}`);
  };

  return (
    <div className="garden-container">
      {/* Top bar: back link only */}
      <header className="results-top">
        <button type="button" onClick={handleBack} className="back-link">
          「 返回随园 」
        </button>
      </header>

      <div className="results-divider" />

      {/* Ask section — right aligned, full row padding */}
      <div className={`ask-area${selectedDish ? " ask-area--compact" : ""}`}>
        <div className="ask-panel">
          <div className="ask-head">
            <div className="yuanmei-avatar" aria-hidden>枚</div>
            <p className="ask-greeting">袁子在此，有何疑问尽管道来。</p>
          </div>
          <div className="ask-bar">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAskSubmit();
              }}
              placeholder="例：想吃清淡一点的，或者有没有素菜推荐..."
              className="ask-input"
              aria-label="向袁子提问"
            />
            <button type="button" className="ask-btn" onClick={handleAskSubmit}>
              询问
            </button>
          </div>
        </div>
      </div>

      {/* Result count + cards — below ask, same side padding */}
      <div className="results-meta">
        {!loading && query && (
          <p className="results-count">
            共寻得 <span className="results-count-num">{dishes.length}</span> 道佳肴
          </p>
        )}
      </div>

      <main className="main-content">
        {loading ? (
          <LoadingView />
        ) : !query ? (
          <EmptyView message="请输入关键词，向袁子询问想寻的佳肴。" />
        ) : dishes.length === 0 ? (
          <EmptyView message="随园中暂无此味，不如换个说法问问袁子？" />
        ) : (
          <div className="dish-grid">
            {dishes.map((dish, i) => (
              <DishCard
                key={dish.id}
                dish={dish}
                index={i}
                variant="medium"
                onClick={() => setSelectedDish(dish)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedDish && (
        <DishDetailModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}

      <style jsx>{`
        .garden-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
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
          overflow-x: hidden;
        }

        .results-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 80px 20px;
          flex-shrink: 0;
        }

        .back-link {
          flex-shrink: 0;
          background: none;
          border: 1px solid #8b5a2b;
          color: #8b5a2b;
          padding: 10px 24px;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.3s;
          font-family: inherit;
          font-size: 15px;
          letter-spacing: 2px;
        }
        .back-link:hover {
          background: #8b5a2b;
          color: #fff;
        }

        .results-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(
            to right,
            transparent,
            rgba(139, 90, 43, 0.12) 10%,
            rgba(139, 90, 43, 0.12) 90%,
            transparent
          );
          flex-shrink: 0;
        }

        /* Ask area — right aligned, with side padding */
        .ask-area {
          display: flex;
          justify-content: flex-end;
          padding: 24px 15vw 0;
          flex-shrink: 0;
        }

        /* Compact mode when dish modal is open */
        .ask-area--compact {
          width: 100%;
          padding-right: 0;
        }

        .ask-panel {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          flex-shrink: 0;
        }

        .ask-area--compact .ask-panel {
          width: 30%;
          align-items: flex-start;
        }

        .ask-area--compact .ask-bar {
          min-width: 0;
          width: 100%;
        }

        .ask-area--compact .ask-input {
          font-size: 13px;
        }

        .ask-area--compact .ask-btn {
          padding: 7px 16px;
          font-size: 13px;
        }

        .ask-area--compact .ask-greeting {
          font-size: 13px;
        }

        .ask-area--compact .yuanmei-avatar {
          width: 30px;
          height: 30px;
          font-size: 13px;
        }

        .ask-head {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .yuanmei-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(139, 90, 43, 0.25);
        }

        .ask-greeting {
          margin: 0;
          font-size: 14px;
          color: #a0774f;
          letter-spacing: 2px;
        }

        .ask-bar {
          display: flex;
          align-items: center;
          background: #fffcf4;
          border-radius: 15px;
          border: 1px solid rgba(139, 90, 43, 0.15);
          padding: 6px 6px 6px 20px;
          box-shadow: 0 4px 16px rgba(45, 41, 38, 0.06);
          gap: 0;
          min-width: 500px;
        }

        .ask-input {
          flex: 1;
          border: none;
          background: transparent;
          font-family: inherit;
          font-size: 14px;
          color: #332c28;
          outline: none;
          min-width: 0;
          padding: 6px 8px;
        }
        .ask-input::placeholder {
          color: #b0a098;
          letter-spacing: 0.5px;
        }

        .ask-btn {
          flex-shrink: 0;
          border: none;
          background: linear-gradient(135deg, #8b5a2b, #a06830);
          color: #fff;
          padding: 9px 24px;
          border-radius: 999px;
          font-family: inherit;
          font-size: 14px;
          letter-spacing: 3px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 8px rgba(139, 90, 43, 0.28);
        }
        .ask-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(139, 90, 43, 0.35);
        }

        /* Result count — below ask, left aligned, with side padding */
        .results-meta {
          padding: 32px 15vw 24px;
          flex-shrink: 0;
        }

        .results-count {
          margin: 0;
          font-size: 14px;
          color: #8b5a2b;
          letter-spacing: 2px;
        }

        .results-count-num {
          font-size: 26px;
          font-weight: 700;
          color: #b82f2d;
          margin: 0 4px;
          vertical-align: -2px;
        }

        .main-content {
          flex: 1;
          overflow-y: auto;
          padding: 0 15vw 48px;
        }

        .dish-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        @media (max-width: 1300px) {
          .dish-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 960px) {
          .dish-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 680px) {
          .results-top {
            padding: 16px 5vw 12px;
          }
          .ask-area {
            padding: 16px 5vw 0;
          }
          .ask-panel {
            align-items: stretch;
            width: 100%;
          }
          .ask-bar {
            min-width: 0;
            width: 100%;
          }
          .results-meta {
            padding: 24px 5vw 18px;
          }
          .main-content {
            padding: 0 5vw 32px;
          }
          .dish-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        .loading-view,
        .empty-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 240px;
          gap: 16px;
        }
        .loading-view .yuanmei-avatar-large {
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
        }
        .loading-view p,
        .empty-view p {
          color: #8b5a2b;
          letter-spacing: 2px;
          font-size: 14px;
          opacity: 0.85;
          margin: 0;
          text-align: center;
          max-width: 360px;
          line-height: 1.8;
        }
        .empty-view .empty-icon {
          font-size: 48px;
          color: rgba(139, 90, 43, 0.2);
        }
      `}</style>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="loading-view">
      <div className="yuanmei-avatar-large">枚</div>
      <p>袁子正在为你翻阅《食单》...</p>
    </div>
  );
}

function EmptyView({ message }: { message: string }) {
  return (
    <div className="empty-view">
      <div className="empty-icon">无</div>
      <p>{message}</p>
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
            <p style={{ color: "#8b5a2b", letterSpacing: 3, fontSize: 15 }}>袁子正在为你翻阅《食单》...</p>
          </div>
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}
