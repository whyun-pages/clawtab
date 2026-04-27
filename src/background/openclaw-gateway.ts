import type { ChatMessage, OpenClawConfig } from "../shared/types";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function requestOpenClaw(
  config: OpenClawConfig,
  messages: ChatMessage[]
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      "x-openclaw-agent-id": config.agentId,
      "x-openclaw-session-key": config.sessionKey
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      messages: messages.map<OpenAIMessage>((message) => ({
        role: message.role,
        content: message.content
      }))
    })
  });

  const payload = (await response.json().catch(() => null)) as OpenAIChatResponse | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenClaw Gateway 请求失败: HTTP ${response.status}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }

  throw new Error("OpenClaw Gateway 返回了空响应。");
}
