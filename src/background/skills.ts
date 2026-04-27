import type { PageSnapshot, SkillDecision, SkillName } from "../shared/types";

const skillRules: Array<{ skill: SkillName; keywords: string[]; reason: string }> = [
  {
    skill: "shopping",
    keywords: ["价格", "多少钱", "优惠", "对比", "商品", "购买"],
    reason: "用户在询问商品价格或对比信息，优先走 shopping skill。"
  },
  {
    skill: "social",
    keywords: ["热点", "热搜", "新闻", "趋势", "时事"],
    reason: "用户需要实时热点或新闻信息，优先走 social skill。"
  },
  {
    skill: "video",
    keywords: ["视频", "字幕", "总结", "讲了什么", "片段"],
    reason: "用户需要视频内容总结或字幕提取，优先走 video skill。"
  }
];

export function decideSkill(userMessage: string): SkillDecision {
  const normalized = userMessage.toLowerCase();
  const matched = skillRules.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );

  if (!matched) {
    return {
      skill: null,
      reason: "当前请求更适合直接结合已抓取标签页内容回答。"
    };
  }

  return {
    skill: matched.skill,
    reason: matched.reason
  };
}

export async function runSkill(skill: SkillName, tabs: PageSnapshot[]): Promise<string> {
  const primaryTab = tabs[0];

  if (!primaryTab) {
    return `已命中 ${skill} skill，但当前还没有可用的页面数据。请先打开相关网页再提问。`;
  }

  switch (skill) {
    case "shopping":
      return [
        "shopping skill 已触发。",
        `当前优先分析页面：${primaryTab.title}`,
        "后续可在这里接入真实商品信息抓取与价格对比逻辑。"
      ].join("\n");
    case "social":
      return [
        "social skill 已触发。",
        `当前优先分析页面：${primaryTab.title}`,
        "后续可在这里接入站点热点抓取与多来源聚合。"
      ].join("\n");
    case "video":
      return [
        "video skill 已触发。",
        `当前优先分析页面：${primaryTab.title}`,
        "后续可在这里接入字幕提取、时间轴切片与总结能力。"
      ].join("\n");
  }
}
