"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { DishCard } from "@/components/DishCard";
import { DetailImage } from "@/components/DetailImage";
import { CookingSteps } from "@/components/CookingSteps";

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

// 模拟袁枚的回答
function generateYuanmeiResponse(query: string): string {
  const responses = [
    `「${query}」……此乃寻味之道也。袁子我走遍大江南北，略知一二，且听我细细道来。`,
    `唔，「${query}」……好一个刁钻的问题！你算是问对人了。`,
    `哈哈，问得好！「${query}」——此乃随园之学问，听我道来……`,
    `「${query}」……吾儿莫急，袁子这就为你翻阅《食单》，寻得此味。`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

type Message = {
  id: number;
  role: "user" | "yuanmei";
  content: string;
  displayedContent: string;
  isTyping?: boolean;
  dishes?: Dish[];
  dishDetail?: {
    name: string;
    desc: string;
    image: string;
    origin?: string;
    ingredients: string[];
    originalText?: string;
    modernMethod?: string;
    history?: string;
    tags: string[];
  };
};

const STORAGE_KEY = "suiyuan_chat_messages";

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

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<number | null>(null);
  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);

  // 加载保存的对话
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.map((m: Message) => ({ ...m, isTyping: false })));
          if (parsed.length > 0) {
            lastMessageIdRef.current = parsed[parsed.length - 1].id;
          }
        }
      } catch (e) {
        console.error("Failed to load saved messages:", e);
      }
    }
  }, []);

  // 保存对话到 sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    const query = searchParams.get("query");
    if (query) {
      setMessages([]);
      sessionStorage.removeItem(STORAGE_KEY);
      lastMessageIdRef.current = null;
      setTimeout(() => handleSend(query), 100);
    }
  }, [searchParams]);

  // 滚动到容器顶部（让用户消息可见）
  const scrollContainerToTop = () => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      // 滚动到让新消息出现在可视区域上方（大约输入框的位置）
      // 这样用户消息就会显示在屏幕上方的位置
      container.scrollTop = container.scrollHeight;
    }
  };

  // 平滑滚动到容器底部
  const smoothScrollDown = () => {
    if (!chatContainerRef.current) return;
    
    const container = chatContainerRef.current;
    const startScroll = container.scrollTop;
    const endScroll = container.scrollHeight - container.clientHeight;
    const distance = endScroll - startScroll;
    
    if (distance <= 0) return;
    
    const duration = 300;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      
      container.scrollTop = startScroll + distance * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };

  const handleSend = async (sendText?: string) => {
    const text = sendText || input.trim();
    if (!text) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: text,
      displayedContent: text,
      isTyping: false,
    };

    setMessages(prev => [...prev, userMessage]);
    lastMessageIdRef.current = userMessage.id;
    
    if (!sendText) {
      setInput("");
    }
    
    setIsSearching(true);

    // 滚动到用户消息位置，让它显示在屏幕上方
    setTimeout(() => {
      const userMessageEl = document.getElementById(`message-${userMessage.id}`);
      if (userMessageEl) {
        userMessageEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }, 0);

    await new Promise(resolve => setTimeout(resolve, 800));

    const yuanmeiText = generateYuanmeiResponse(text);
    const yuanmeiMessageId = Date.now();
    
    const yuanmeiMessage: Message = {
      id: yuanmeiMessageId,
      role: "yuanmei",
      content: yuanmeiText,
      displayedContent: "",
      isTyping: true,
    };

    setMessages(prev => [...prev, yuanmeiMessage]);
    lastMessageIdRef.current = yuanmeiMessageId;

    // 打字机效果
    for (let i = 0; i <= yuanmeiText.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 40));
      setMessages(prev => prev.map(msg => 
        msg.id === yuanmeiMessageId 
          ? { ...msg, displayedContent: yuanmeiText.slice(0, i) }
          : msg
      ));
      smoothScrollDown(); // 平滑跟随袁枚回复
    }

    setMessages(prev => prev.map(msg => 
      msg.id === yuanmeiMessageId 
        ? { ...msg, isTyping: false }
        : msg
    ));

    try {
      const dishes = await fetchDishesFromAPI(text);
      setMessages(prev => prev.map(msg => 
        msg.id === yuanmeiMessageId 
          ? { ...msg, dishes }
          : msg
      ));
      setTimeout(smoothScrollDown, 100);
    } catch (error) {
      console.error('Search error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === yuanmeiMessageId 
          ? { ...msg, dishes: [] }
          : msg
      ));
    }
    
    setIsSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCardClick = (dish: Dish) => {
    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: `我想了解「${dish.name}」的详细信息`,
      displayedContent: `我想了解「${dish.name}」的详细信息`,
      isTyping: false,
    };

    setMessages(prev => [...prev, userMessage]);
    lastMessageIdRef.current = userMessage.id;

    setTimeout(() => {
      const userMessageEl = document.getElementById(`message-${userMessage.id}`);
      if (userMessageEl) {
        userMessageEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }, 0);

    // 生成精美的菜品详情
    const ingredientsList = Array.isArray(dish.ingredients) ? dish.ingredients : [];
    const tagsList = Array.isArray(dish.tags) ? dish.tags : [];

    const yuanmeiMessageId = Date.now();

    const yuanmeiMessage: Message = {
      id: yuanmeiMessageId,
      role: "yuanmei",
      content: `「${dish.name}」……好！这道菜袁子我甚是喜爱，且听我细细道来。`,
      displayedContent: `「${dish.name}」……好！这道菜袁子我甚是喜爱，且听我细细道来。`,
      isTyping: false,
      dishDetail: {
        name: dish.name,
        desc: dish.desc,
        image: dish.image,
        origin: dish.origin,
        ingredients: ingredientsList,
        history: dish.history,
        tags: tagsList,
        originalText: dish.originalText || '',
        modernMethod: dish.modernMethod || ''
      }
    };

    // 添加消息
    setMessages(prev => [...prev, yuanmeiMessage]);
    lastMessageIdRef.current = yuanmeiMessageId;
    smoothScrollDown();
    
    // 动画过程中多次滚动，确保内容始终可见
    const scrollInterval = setInterval(smoothScrollDown, 100);
    setTimeout(() => clearInterval(scrollInterval), 600);
  };

  return (
    <div className="garden-container">
      <nav className="top-nav">
        <button onClick={() => {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
          router.push("/");
        }} className="back-link">「 归去 」</button>
        <div className="dynasty-tag">清 · 随园食单</div>
        {messages.length > 0 && (
          <button 
            onClick={() => {
              setMessages([]);
              sessionStorage.removeItem(STORAGE_KEY);
              lastMessageIdRef.current = null;
            }} 
            className="clear-btn"
          >
            清空对话
          </button>
        )}
      </nav>

      <main className="main-content">
        {/* 对话区域 */}
        <div className="chat-section" ref={chatContainerRef}>
          {messages.length === 0 && (
            <div className="welcome-hint">
              <div className="yuanmei-avatar-large">枚</div>
              <p>袁子在此，且问随园菜肴，必有回应。</p>
            </div>
          )}

          {messages.map((msg) => (
            <div 
              key={msg.id} 
              id={`message-${msg.id}`}
              className={`message ${msg.role}`}
            >
              {msg.role === "yuanmei" ? (
                <div className="yuanmei-avatar">枚</div>
              ) : (
                <div className="user-avatar">客</div>
              )}
              <div className="message-content">
                <div className="message-bubble">
                  {msg.displayedContent}
                  {msg.isTyping && (
                    <span className="cursor">|</span>
                  )}
                </div>
                {msg.dishDetail && (
                  <div className="dish-detail-card">
                    <div className="detail-header">
                      <DetailImage
                        dishName={msg.dishDetail.name}
                        dishDesc={msg.dishDetail.desc}
                        originalText={msg.dishDetail.originalText}
                        modernMethod={msg.dishDetail.modernMethod}
                        className="detail-image"
                      />
                      <div className="detail-header-info">
                        <h3 className="detail-title">{msg.dishDetail.name}</h3>
                        <p className="detail-desc">{msg.dishDetail.desc}</p>
                      </div>
                    </div>

                    <div className="detail-info-stack">
                      <div className="detail-info-item">
                        <span className="detail-info-icon">📍</span>
                        <div className="detail-info-content">
                          <span className="detail-info-label">产地</span>
                          <span className="detail-info-value">{msg.dishDetail.origin || "江南"}</span>
                        </div>
                      </div>
                      <div className="detail-info-item">
                        <span className="detail-info-icon">🥢</span>
                        <div className="detail-info-content">
                          <span className="detail-info-label">主料</span>
                          <span className="detail-info-value">
                            {msg.dishDetail.ingredients.length > 0
                              ? msg.dishDetail.ingredients.join("、")
                              : "暂无信息"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="detail-section yuanmei-quote-section">
                      <div className="yuanmei-header">
                        <div className="yuanmei-avatar-small">枚</div>
                        <span className="yuanmei-label">袁枚 · 随园主人</span>
                      </div>
                      <div className="yuanmei-quote">
                        <span className="quote-mark">❝</span>
                        <p className="yuanmei-text">
                          {msg.dishDetail.history || `此乃${msg.dishDetail.name}，乃随园食单中之上品。`}
                        </p>
                        <span className="quote-mark">❞</span>
                      </div>
                    </div>

                    <CookingSteps
                      dishName={msg.dishDetail.name}
                      dishDesc={msg.dishDetail.desc}
                      ingredients={msg.dishDetail.ingredients}
                    />

                    {msg.dishDetail.tags.length > 0 && (
                      <div className="detail-section">
                        <h4 className="detail-section-title">相关标签</h4>
                        <div className="detail-tags">
                          {msg.dishDetail.tags.map((tag, i) => (
                            <span key={i} className="detail-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="detail-footer">
                      此乃随园珍藏，若有不解之处，尽管问来。
                    </div>
                  </div>
                )}
                {msg.dishes && msg.dishes.length > 0 && (
                  <div className="dish-results">
                    <div className="results-header">
                      <div className="results-count">共寻得 {msg.dishes.length} 道佳肴</div>
                    </div>
                    <div className="dish-grid">
                      {msg.dishes.map((dish, i) => (
                        <DishCard
                          key={dish.id}
                          dish={dish}
                          index={i}
                          onClick={() => handleCardClick(dish)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {msg.dishes && msg.dishes.length === 0 && (
                  <div className="dish-results">
                    <div className="empty-state">
                      <div className="empty-icon">无</div>
                      <p className="empty-text">随园中暂无此味，不如问问别的？</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 输入区域 */}
        <div className="input-section">
          <div className="input-box">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例：我想吃点酸甜开胃的，最好是鱼..."
              className="chat-input"
              rows={2}
            />
            <button 
              onClick={() => handleSend()} 
              className="send-btn"
              disabled={isSearching}
            >
              <span className="seal-text">{isSearching ? "寻觅中" : "询问"}</span>
            </button>
          </div>
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
        .clear-btn {
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
        .clear-btn:hover { 
          border-color: #a00; 
          color: #a00;
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          max-width: 900px;
          width: 100%;
          margin: 0 auto;
          padding: 0 20px;
        }

        .chat-section {
          flex: 1;
          padding: 30px 0;
          overflow-y: auto;
          scroll-behavior: smooth;
        }

        .welcome-hint {
          text-align: center;
          padding: 60px 20px;
          animation: fadeIn 0.6s ease;
        }

        .welcome-hint .yuanmei-avatar-large {
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
          margin: 0 auto 16px;
        }

        .welcome-hint p {
          color: #8b5a2b;
          letter-spacing: 3px;
          font-size: 15px;
          opacity: 0.8;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          animation: fadeInUp 0.4s ease;
        }

        .message.user {
          flex-direction: row-reverse;
        }

        .yuanmei-avatar, .user-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          flex-shrink: 0;
        }

        .yuanmei-avatar {
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff;
        }

        .user-avatar {
          background: linear-gradient(135deg, #4a7c59, #6b9b7a);
          color: #fff;
        }

        .message-content {
          max-width: 90%;
        }

        .message.user .message-content {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .message-bubble {
          padding: 14px 20px;
          border-radius: 16px;
          line-height: 1.8;
          letter-spacing: 0.05em;
          min-height: 1.8em;
        }

        .message.yuanmei .message-bubble {
          background: #fffcf5;
          border: 1px solid rgba(139,90,43,0.15);
          border-top-left-radius: 4px;
          color: #332c28;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }

        .message.user .message-bubble {
          background: #4a7c59;
          color: #fff;
          border-top-right-radius: 4px;
          box-shadow: 0 4px 16px rgba(74,124,89,0.25);
        }

        .cursor {
          animation: blink 0.8s infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .dish-results {
          margin-top: 20px;
          width: 100%;
        }

        .results-header {
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(139,90,43,0.15);
        }

        .results-count {
          font-size: 13px;
          color: #8b5a2b;
          letter-spacing: 2px;
        }

        .dish-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
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
          height: 180px;
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
          top: 10px;
          left: 10px;
          border: 1px solid #a00;
          color: #a00;
          font-size: 10px;
          padding: 2px 6px;
          background: rgba(255,255,255,0.9);
          letter-spacing: 1px;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dish-info {
          padding: 14px 16px;
        }

        .dish-name {
          font-size: 16px;
          margin: 0 0 6px;
          color: #1e1a17;
          letter-spacing: 2px;
          border-left: 3px solid #a00;
          padding-left: 10px;
        }

        .dish-desc {
          font-size: 12px;
          color: #666;
          line-height: 1.6;
          margin: 0 0 10px;
        }

        .dish-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tag {
          background: rgba(139,90,43,0.08);
          color: #8b5a2b;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          border: 1px solid rgba(139,90,43,0.12);
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          background: #fffcf5;
          border-radius: 12px;
          border: 1px dashed rgba(139,90,43,0.2);
        }
        .empty-icon {
          font-size: 36px;
          color: rgba(139,90,43,0.2);
          margin-bottom: 12px;
        }
        .empty-text {
          font-size: 14px;
          color: #8b5a2b;
          letter-spacing: 2px;
          opacity: 0.7;
        }

        /* 菜品详情卡片 */
        .dish-detail-card {
          margin-top: 20px;
          background: linear-gradient(135deg, #fffcf5, #fff8ee);
          border: 1px solid rgba(139,90,43,0.2);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(139,90,43,0.1);
          opacity: 0;
          animation: slideIn 0.5s ease forwards;
        }

        .detail-header {
          display: flex;
          gap: 20px;
          padding: 20px;
          background: linear-gradient(135deg, rgba(139,90,43,0.05), rgba(139,90,43,0.02));
          border-bottom: 1px solid rgba(139,90,43,0.1);
          opacity: 0;
          animation: slideIn 0.5s ease 0.1s forwards;
        }

        .detail-image {
          width: 160px;
          height: 160px;
          object-fit: cover;
          border-radius: 8px;
          border: 2px solid rgba(139,90,43,0.15);
          filter: sepia(5%);
        }

        .detail-header-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .detail-title {
          font-size: 22px;
          color: #1e1a17;
          margin: 0 0 12px;
          letter-spacing: 4px;
          border-left: 4px solid #a00;
          padding-left: 14px;
          line-height: 1.4;
        }

        .detail-desc {
          font-size: 14px;
          color: #5a4a3a;
          line-height: 1.8;
          margin: 0;
          letter-spacing: 0.5px;
        }

        .detail-info-stack {
          display: flex;
          flex-direction: column;
          opacity: 0;
          animation: slideIn 0.5s ease 0.2s forwards;
        }

        .detail-info-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          background: #fffcf5;
          border-bottom: 1px solid rgba(139,90,43,0.06);
        }

        .detail-info-item:last-child {
          border-bottom: none;
        }

        .detail-info-icon {
          font-size: 20px;
        }

        .detail-info-content {
          display: flex;
          flex-direction: column;
        }

        .detail-info-label {
          font-size: 11px;
          color: #8b5a2b;
          letter-spacing: 2px;
          opacity: 0.7;
          margin-bottom: 4px;
        }

        .detail-info-value {
          font-size: 14px;
          color: #332c28;
          letter-spacing: 1px;
        }

        .yuanmei-quote-section {
          padding: 20px;
          background: rgba(139,90,43,0.02);
          border-top: 1px solid rgba(139,90,43,0.08);
          border-bottom: 1px solid rgba(139,90,43,0.08);
          opacity: 0;
          animation: slideIn 0.5s ease 0.3s forwards;
        }

        .yuanmei-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .yuanmei-avatar-small {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #8b5a2b, #c4853f);
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }

        .yuanmei-label {
          font-size: 12px;
          color: #8b5a2b;
          letter-spacing: 2px;
        }

        .yuanmei-quote {
          padding: 0 10px;
        }

        .quote-mark {
          color: rgba(139,90,43,0.3);
          font-size: 24px;
          line-height: 1;
        }

        .yuanmei-text {
          font-size: 14px;
          color: #5a4a3a;
          line-height: 1.9;
          margin: 8px 0;
          letter-spacing: 0.5px;
        }

        .detail-section {
          padding: 16px 20px;
          opacity: 0;
          animation: slideIn 0.5s ease 0.4s forwards;
        }

        .detail-section-title {
          font-size: 11px;
          color: #8b5a2b;
          margin: 0 0 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          opacity: 0.8;
        }

        .detail-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .detail-tag {
          background: rgba(139,90,43,0.1);
          color: #8b5a2b;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          border: 1px solid rgba(139,90,43,0.15);
          letter-spacing: 1px;
        }

        .detail-footer {
          padding: 16px 20px;
          background: rgba(139,90,43,0.03);
          font-size: 13px;
          color: #8b5a2b;
          letter-spacing: 2px;
          text-align: center;
          font-style: italic;
          opacity: 0;
          animation: slideIn 0.5s ease 0.5s forwards;
        }
          opacity: 0.8;
        }

        .input-section {
          padding: 20px 0 30px;
          border-top: 1px solid rgba(139,90,43,0.1);
          background: rgba(242,237,225,0.8);
          position: sticky;
          bottom: 0;
        }

        .input-box {
          display: flex;
          gap: 12px;
          max-width: 900px;
          margin: 0 auto;
        }

        .chat-input {
          flex: 1;
          background: #fffcf5;
          border: 1px solid rgba(139,90,43,0.2);
          border-radius: 24px;
          padding: 12px 20px;
          font-family: inherit;
          font-size: 15px;
          color: #332c28;
          resize: none;
          outline: none;
          transition: border-color 0.3s, box-shadow 0.3s;
        }

        .chat-input:focus {
          border-color: #8b5a2b;
          box-shadow: 0 0 0 3px rgba(139,90,43,0.1);
        }

        .chat-input::placeholder { color: #bbb; font-size: 14px; }

        .send-btn {
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
          box-shadow: 0 4px 12px rgba(139,90,43,0.3);
        }

        .send-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .send-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(139,90,43,0.4);
        }

        .send-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          .top-nav { padding: 16px 24px; }
          .main-content { padding: 0 16px; }
          .message-content { max-width: 85%; }
          .dish-grid { grid-template-columns: 1fr; }
          .input-box { flex-direction: column; }
          .send-btn { width: 100%; }
        }
      `}</style>
    </div>
  );
}

// 使用 Suspense 包装以支持 useSearchParams
export default function ChatPage() {
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
      <ChatPageContent />
    </Suspense>
  );
}
