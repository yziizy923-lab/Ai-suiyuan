"use client";

import { useState } from "react";

type Tab = "geo" | "culture" | "ingredients" | "flavor";

interface FloatingDialogProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  ingredientColors: Record<string, string>;
}

export default function FloatingDialog({
  activeTab,
  onTabChange,
  ingredientColors,
}: FloatingDialogProps) {
  const [collapsed, setCollapsed] = useState(false);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "geo", label: "地理分布", icon: "🗺️" },
    { id: "flavor", label: "味觉地图", icon: "✨" },
    { id: "culture", label: "文化故事", icon: "📜" },
    { id: "ingredients", label: "食材图鉴", icon: "🥢" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 500,
        fontFamily: '"Noto Serif SC", "SimSun", serif',
      }}
    >
      {/* Tab bar */}
      {!collapsed && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 8,
            justifyContent: "flex-end",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "1px solid",
                borderColor:
                  activeTab === tab.id
                    ? "rgba(139,90,43,0.8)"
                    : "rgba(139,90,43,0.25)",
                background:
                  activeTab === tab.id
                    ? "linear-gradient(135deg, #8b5a2b, #a06830)"
                    : "rgba(255,252,245,0.88)",
                color:
                  activeTab === tab.id ? "#fff" : "rgba(139,90,43,0.8)",
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

      {/* Main panel */}
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
        {/* Header */}
        <div
          style={{
            padding: collapsed ? "12px 0" : "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom:
              !collapsed && activeTab !== "geo" && activeTab !== "flavor"
                ? "1px solid rgba(139,90,43,0.2)"
                : "none",
            minHeight: 48,
            justifyContent: collapsed ? "center" : "space-between",
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
              <span
                style={{
                  color: "rgba(244,197,66,0.9)",
                  fontSize: 13,
                  letterSpacing: "3px",
                  fontWeight: 600,
                }}
              >
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
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.color =
                    "rgba(255,255,255,0.8)")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.color =
                    "rgba(255,255,255,0.4)")
                }
              >
                −
              </button>
            </>
          )}
        </div>

        {/* Content */}
        {!collapsed && (
          <div style={{ padding: "14px 18px", flex: 1 }}>
            {activeTab === "geo" && (
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
                  各色粒子自食材产地飘向菜品中心，<br />
                  汇聚成这一味随园珍馐。
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(ingredientColors).map(([name, color]) => (
                    <div
                      key={name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
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
                      <span
                        style={{
                          color: "rgba(255,255,255,0.7)",
                          fontSize: 12,
                          letterSpacing: "1px",
                        }}
                      >
                        {name}
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
                  <span
                    style={{
                      color: "rgba(244,197,66,0.8)",
                      fontSize: 11,
                      letterSpacing: "1px",
                    }}
                  >
                    💡 提示：切换地图缩放级别可欣赏粒子流动效果
                  </span>
                </div>
              </div>
            )}

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
                    <div
                      key={item.flavor}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
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
                      <span
                        style={{
                          color: "rgba(255,255,255,0.7)",
                          fontSize: 12,
                          letterSpacing: "1px",
                        }}
                      >
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
                  <span
                    style={{
                      color: "rgba(244,197,66,0.8)",
                      fontSize: 11,
                      letterSpacing: "1px",
                    }}
                  >
                    💡 提示：主料扩散范围大、脉冲强；辅料范围小、呼吸弱
                  </span>
                </div>
              </div>
            )}

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
                    "此圣祖师赐徐健庵尚书方也。尚书取方时，御膳房费一千两。"
                    <br />
                    <span
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        fontSize: 11,
                        marginTop: 4,
                        display: "block",
                      }}
                    >
                      —— 孟亭太守
                    </span>
                  </p>
                </div>
                <p
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 12,
                    lineHeight: 1.8,
                    margin: 0,
                    letterSpacing: "0.5px",
                  }}
                >
                  此菜为康熙皇帝赐予徐健庵尚书之御膳方。太守祖父楼村先生为尚书门生，故得此方流传。王太守依此方烹饪，以嫩鸡肉与香菇、蘑菇、松子等八宝共入浓鸡汤，尽显清代江南饮食之精致。
                </p>
              </div>
            )}

            {activeTab === "ingredients" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(ingredientColors).map(([name, color]) => (
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
                    <span
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontSize: 12,
                        letterSpacing: "1px",
                        flex: 1,
                      }}
                    >
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
