"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import CookingCompareOverlay from "./CookingCompareOverlay";

type Tab = "geo" | "culture" | "ingredients" | "flavor";

export interface IngredientGeoInfo {
  name: string;
  ingredient: string;
  color: string;
  geoCondition: string;
}

interface FloatingDialogProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  ingredientColors: Record<string, string>;
  ingredientGeoInfo?: Record<string, IngredientGeoInfo>;
  selectedIngredient?: IngredientGeoInfo | null;
  onIngredientSelect?: (ingredientName: string) => void;
  // 粒子点击后 AI 生成的地理条件
  geoIngredientDetail?: string;
  geoIngredientLoading?: boolean;
  // 食材产地 Tab 选中的产地信息
  geoCauseTarget?: { ingredient: string; placeName: string } | null;
  geoCauseText?: string;
  geoCauseLoading?: boolean;
  onGeoCauseClear?: () => void;
}

export default function FloatingDialog({
  activeTab,
  onTabChange,
  ingredientColors,
  ingredientGeoInfo = {},
  selectedIngredient,
  onIngredientSelect,
  geoIngredientDetail = "",
  geoIngredientLoading = false,
  geoCauseTarget = null,
  geoCauseText = "",
  geoCauseLoading = false,
  onGeoCauseClear,
}: FloatingDialogProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [cookingOpen, setCookingOpen] = useState(false);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "geo", label: "地理分布", icon: "🗺️" },
    { id: "flavor", label: "味觉地图", icon: "✨" },
    { id: "culture", label: "文化故事", icon: "📜" },
    { id: "ingredients", label: "食材图鉴", icon: "🥢" },
  ];

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 500,
          fontFamily: '"Noto Serif SC", "SimSun", serif',
        }}
      >
        {/* Tab 栏 */}
        {!collapsed && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, justifyContent: "flex-end" }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid",
                  borderColor: activeTab === tab.id ? "rgba(139,90,43,0.8)" : "rgba(139,90,43,0.25)",
                  background:
                    activeTab === tab.id
                      ? "linear-gradient(135deg, #8b5a2b, #a06830)"
                      : "rgba(255,252,245,0.88)",
                  color: activeTab === tab.id ? "#fff" : "rgba(139,90,43,0.8)",
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  backdropFilter: "blur(12px)",
                  boxShadow:
                    activeTab === tab.id
                      ? "0 4px 16px rgba(139,90,43,0.35)"
                      : "0 2px 8px rgba(0,0,0,0.08)",
                  letterSpacing: "1px",
                  fontFamily: '"Noto Serif SC", "SimSun", serif',
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ marginRight: 5, fontSize: 12 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* 主面板 */}
        <div
          style={{
            width: collapsed ? 48 : 320,
            minHeight: collapsed ? 48 : 280,
            background: "rgba(45,38,32,0.92)",
            backdropFilter: "blur(20px)",
            borderRadius: collapsed ? 14 : "14px 4px 14px 14px",
            border: "1px solid rgba(139,90,43,0.35)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
            overflow: "hidden",
            transition: "all 0.35s cubic-bezier(0.23,1,0.32,1)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* 头部 */}
          <div
            style={{
              padding: collapsed ? "12px 0" : "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              borderBottom:
                !collapsed && activeTab !== "geo" && activeTab !== "flavor"
                  ? "1px solid rgba(139,90,43,0.2)"
                  : "none",
              minHeight: 48,
            }}
          >
            {collapsed ? (
              <div
                onClick={() => setCollapsed(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(139,90,43,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                🗺️
              </div>
            ) : (
              <>
                <span style={{ color: "rgba(244,197,66,0.9)", fontSize: 13, letterSpacing: "3px", fontWeight: 600 }}>
                  随园探索
                </span>
                <button
                  onClick={() => setCollapsed(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    padding: "0 4px",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "rgba(255,255,255,0.8)")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "rgba(255,255,255,0.4)")}
                >
                  −
                </button>
              </>
            )}
          </div>

          {/* 内容区 */}
          {!collapsed && (
            <div style={{ padding: "14px 18px", flex: 1 }}>
              {/* 古今对比入口按钮 */}
              <motion.button
                onClick={() => setCookingOpen(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  marginBottom: 14,
                  borderRadius: 10,
                  border: "1px solid rgba(244,197,66,0.5)",
                  background: "linear-gradient(135deg, rgba(139,90,43,0.35), rgba(92,45,10,0.45))",
                  color: "rgba(244,197,66,0.95)",
                  fontSize: 13,
                  cursor: "pointer",
                  letterSpacing: "2px",
                  fontFamily: '"Noto Serif SC", "SimSun", serif',
                  fontWeight: 600,
                  transition: "all 0.25s ease",
                  boxShadow: "0 4px 14px rgba(139,90,43,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 14 }}>🍳</span>
                <span>古今对比 · 随园烹饪</span>
              </motion.button>

              {/* ── 地理分布 Tab ── */}
              {activeTab === "geo" && (
                <div>
                  {selectedIngredient ? (
                    <>
                      {/* 已选食材：展示 AI 生成的地理条件 */}
                      <div
                        style={{
                          marginBottom: 12,
                          padding: "14px",
                          background: `${selectedIngredient.color}12`,
                          borderRadius: 10,
                          border: `1px solid ${selectedIngredient.color}35`,
                        }}
                      >
                        {/* 食材名称 + 产地行 */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: selectedIngredient.color,
                              boxShadow: `0 0 8px ${selectedIngredient.color}`,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: selectedIngredient.color,
                              fontSize: 14,
                              fontWeight: 600,
                              letterSpacing: "1px",
                            }}
                          >
                            {selectedIngredient.ingredient}
                          </span>
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginLeft: 2 }}>
                            · {selectedIngredient.name}
                          </span>
                        </div>

                        {/* 地理条件区块标题 */}
                        <div
                          style={{
                            fontSize: 10,
                            letterSpacing: "3px",
                            color: "rgba(244,197,66,0.6)",
                            marginBottom: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 20,
                              height: 1,
                              background: "rgba(244,197,66,0.3)",
                            }}
                          />
                          地理成因 · 气候 / 地形 / 水文
                          <span
                            style={{
                              display: "inline-block",
                              width: 20,
                              height: 1,
                              background: "rgba(244,197,66,0.3)",
                            }}
                          />
                        </div>

                        {/* 加载态 */}
                        {geoIngredientLoading && (
                          <>
                            <style>{`
                              @keyframes wst-shimmer {
                                0%,100% { opacity: 0.3; }
                                50% { opacity: 0.7; }
                              }
                            `}</style>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 8 }}>
                              {[100, 82, 94, 70].map((w, i) => (
                                <div
                                  key={i}
                                  style={{
                                    height: 9,
                                    borderRadius: 4,
                                    background: "rgba(255,255,255,0.1)",
                                    width: `${w}%`,
                                    animation: "wst-shimmer 1.5s ease-in-out infinite",
                                    animationDelay: `${i * 0.15}s`,
                                  }}
                                />
                              ))}
                            </div>
                            <div
                              style={{
                                color: "rgba(255,255,255,0.28)",
                                fontSize: 11,
                                letterSpacing: "1.5px",
                                marginTop: 4,
                              }}
                            >
                              正在推演此地山川水脉……
                            </div>
                          </>
                        )}

                        {/* AI 生成内容 */}
                        {!geoIngredientLoading && geoIngredientDetail && (
                          <p
                            style={{
                              color: "rgba(255,255,255,0.78)",
                              fontSize: 12,
                              lineHeight: 2,
                              margin: 0,
                              letterSpacing: "0.6px",
                            }}
                          >
                            {geoIngredientDetail}
                          </p>
                        )}

                        {/* 兜底：原始 note（无 AI 内容且未加载时） */}
                        {!geoIngredientLoading && !geoIngredientDetail && (
                          <p
                            style={{
                              color: "rgba(255,255,255,0.45)",
                              fontSize: 12,
                              lineHeight: 1.85,
                              margin: 0,
                              letterSpacing: "0.5px",
                            }}
                          >
                            {selectedIngredient.geoCondition}
                          </p>
                        )}
                      </div>

                      {/* 三个维度图标提示 */}
                      {!geoIngredientLoading && geoIngredientDetail && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            { icon: "🌦", label: "气候" },
                            { icon: "⛰", label: "地形" },
                            { icon: "💧", label: "水文" },
                          ].map((dim) => (
                            <div
                              key={dim.label}
                              style={{
                                flex: 1,
                                padding: "5px 0",
                                background: "rgba(255,255,255,0.04)",
                                borderRadius: 6,
                                border: "1px solid rgba(139,90,43,0.18)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <span style={{ fontSize: 14 }}>{dim.icon}</span>
                              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: "1px" }}>
                                {dim.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 返回总览按钮 */}
                      <button
                        onClick={() => onIngredientSelect?.("")}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid rgba(139,90,43,0.25)",
                          background: "rgba(139,90,43,0.1)",
                          color: "rgba(244,197,66,0.7)",
                          fontSize: 11,
                          cursor: "pointer",
                          letterSpacing: "1px",
                          fontFamily: '"Noto Serif SC", "SimSun", serif',
                          marginBottom: 12,
                        }}
                      >
                        ← 返回总览
                      </button>
                    </>
                  ) : (
                    /* 未选中：总览说明 + 图例 */
                    <>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.55)",
                          fontSize: 12,
                          lineHeight: 1.8,
                          margin: "0 0 12px",
                          letterSpacing: "1px",
                        }}
                      >
                        各色粒子自食材产地飘向菜品中心，<br />
                        汇聚成这一味随园珍馐。
                      </p>
                      <p
                        style={{
                          color: "rgba(244,197,66,0.7)",
                          fontSize: 11,
                          lineHeight: 1.7,
                          margin: "0 0 12px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        点击地图上的食材粒子<br />
                        查看气候 · 地形 · 水文地理条件
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(Object.entries(ingredientColors) as [string, string][]).map((entry) => {
                          const name: string = entry[0];
                          const color: string = entry[1];
                          const isSelected = Boolean(selectedIngredient) && selectedIngredient!.name === name;
                          return (
                            <div
                              key={name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "6px 8px",
                                background: isSelected
                                  ? `${color}20`
                                  : "rgba(255,255,255,0.03)",
                                borderRadius: 8,
                                border: isSelected
                                  ? `1px solid ${color}50`
                                  : "1px solid transparent",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                              }}
                              onClick={() => {
                                const geoInfo = ingredientGeoInfo[name];
                                if (geoInfo) onIngredientSelect?.(name);
                              }}
                            >
                              <div
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  background: color,
                                  boxShadow: `0 0 8px ${color}`,
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, letterSpacing: "1px" }}>
                                {name}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          padding: "8px 12px",
                          background: "rgba(139,90,43,0.15)",
                          borderRadius: 8,
                          borderLeft: "3px solid rgba(244,197,66,0.5)",
                        }}
                      >
                        <span style={{ color: "rgba(244,197,66,0.8)", fontSize: 11, letterSpacing: "1px" }}>
                          💡 点击粒子查看产地地理成因
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── 味觉地图 Tab ── */}
              {activeTab === "flavor" && (
                <div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.55)",
                      fontSize: 12,
                      lineHeight: 1.8,
                      margin: "0 0 12px",
                      letterSpacing: "1px",
                    }}
                  >
                    食材依其风味呈现独特形态，<br />
                    扩散汇聚成这一味随园珍馐。
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { flavor: "酸", color: "#FF6B6B", shape: "锯齿星形", desc: "尖锐三角形，边缘尖刺" },
                      { flavor: "甜", color: "#FFB5E8", shape: "圆形", desc: "平滑柔和，糖霜融化" },
                      { flavor: "苦", color: "#5C7A5C", shape: "波浪形", desc: "涟漪起伏，苦瓜纹理" },
                      { flavor: "辣", color: "#FF4500", shape: "火焰形", desc: "放射状，爆炸碎片" },
                      { flavor: "咸", color: "#87CEEB", shape: "方形", desc: "晶体结构，网格纹理" },
                      { flavor: "鲜", color: "#FFD700", shape: "水滴形", desc: "垂落汤汁，清润流动" },
                    ].map((item) => (
                      <div key={item.flavor} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: item.flavor === "甜" ? "50%" : "2px",
                            background: item.color,
                            boxShadow: `0 0 8px ${item.color}`,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, letterSpacing: "1px" }}>
                          {item.flavor} · {item.shape}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      padding: "8px 12px",
                      background: "rgba(139,90,43,0.15)",
                      borderRadius: 8,
                      borderLeft: "3px solid rgba(244,197,66,0.5)",
                    }}
                  >
                    <span style={{ color: "rgba(244,197,66,0.8)", fontSize: 11, letterSpacing: "1px" }}>
                      💡 主料扩散范围大、脉冲强；辅料范围小、呼吸弱
                    </span>
                  </div>
                </div>
              )}

              {/* ── 文化故事 Tab ── */}
              {activeTab === "culture" && (
                <div>
                  <div
                    style={{
                      marginBottom: 14,
                      padding: "10px 12px",
                      background: "rgba(139,90,43,0.1)",
                      borderRadius: 8,
                      borderLeft: "3px solid rgba(244,197,66,0.4)",
                    }}
                  >
                    <p
                      style={{
                        color: "rgba(255,255,255,0.65)",
                        fontSize: 12,
                        lineHeight: 1.9,
                        margin: 0,
                        fontStyle: "italic",
                        letterSpacing: "0.5px",
                      }}
                    >
                      &quot;此圣祖师赐徐健庵尚书方也。尚书取方时，御膳房费一千两。&quot;
                      <br />
                      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 4, display: "block" }}>
                        —— 孟亭太守
                      </span>
                    </p>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.8, margin: 0, letterSpacing: "0.5px" }}>
                    此菜为康熙皇帝赐予徐健庵尚书之御膳方。太守祖父楼村先生为尚书门生，故得此方流传。王太守依此方烹饪，以嫩鸡肉与香菇、蘑菇、松子等八宝共入浓鸡汤，尽显清代江南饮食之精致。
                  </p>
                </div>
              )}

              {/* ── 食材图鉴 Tab ── */}
              {activeTab === "ingredients" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* 选中产地时显示详情 */}
                  {geoCauseTarget ? (
                    <>
                      {/* 产地信息头部 */}
                      <div
                        style={{
                          padding: "12px",
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: 10,
                          border: "1px solid rgba(139,90,43,0.2)",
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: "#f4c542",
                              boxShadow: "0 0 8px rgba(244,197,66,0.6)",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "#f4c542", fontSize: 14, fontWeight: 600, letterSpacing: "1px" }}>
                            {geoCauseTarget.placeName}
                          </span>
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "2px", marginBottom: 10 }}>
                          产出 · {geoCauseTarget.ingredient}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            letterSpacing: "2px",
                            color: "rgba(244,197,66,0.5)",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ display: "inline-block", width: 16, height: 1, background: "rgba(244,197,66,0.3)" }} />
                          地理成因 · 为什么是这里
                          <span style={{ display: "inline-block", width: 16, height: 1, background: "rgba(244,197,66,0.3)" }} />
                        </div>
                      </div>

                      {/* 地理成因内容 */}
                      {geoCauseLoading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          {[100, 75, 88, 60].map((w, i) => (
                            <div
                              key={i}
                              style={{
                                height: 9,
                                borderRadius: 4,
                                background: "rgba(255,255,255,0.08)",
                                width: `${w}%`,
                              }}
                            />
                          ))}
                          <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, letterSpacing: "1px", marginTop: 4 }}>
                            正在推演此地山川水脉……
                          </div>
                        </div>
                      ) : geoCauseText ? (
                        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 2, margin: 0, letterSpacing: "0.5px" }}>
                          {geoCauseText}
                        </p>
                      ) : (
                        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 1.8, margin: 0 }}>
                          点击地图上的产地光点获取地理成因解释
                        </p>
                      )}

                      {/* 清除选中按钮 */}
                      <button
                        onClick={() => {
                          if (onGeoCauseClear) {
                            onGeoCauseClear();
                          } else if (typeof onIngredientSelect === "function") {
                            onIngredientSelect("");
                          }
                        }}
                        style={{
                          marginTop: 4,
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid rgba(139,90,43,0.25)",
                          background: "rgba(139,90,43,0.1)",
                          color: "rgba(244,197,66,0.7)",
                          fontSize: 11,
                          cursor: "pointer",
                          letterSpacing: "1px",
                          fontFamily: '"Noto Serif SC", "SimSun", serif',
                        }}
                      >
                        ← 返回列表
                      </button>
                    </>
                  ) : (
                    /* 未选中：显示食材列表 */
                    <>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: "1px", margin: "0 0 4px" }}>
                        点击地图光点查看产地信息
                      </p>
                      {(Object.entries(ingredientColors) as [string, string][]).map(([name, color]) => (
                        <div
                          key={name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 10px",
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 8,
                            border: `1px solid ${color}22`,
                          }}
                        >
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: color,
                              boxShadow: `0 0 6px ${color}`,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, letterSpacing: "1px", flex: 1 }}>
                            {name}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 古今对比全屏烹饪弹窗 */}
      <CookingCompareOverlay
        open={cookingOpen}
        onClose={() => setCookingOpen(false)}
        dishTitle="王太守八宝豆腐"
      />
    </>
  );
}