import type { ChatMessage, OpenClawConfig } from "../shared/types";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function createOpenClawProvider(config: OpenClawConfig) {
  return createOpenAICompatible({
    name: "openclaw",
    apiKey: config.token,
    baseURL: config.baseUrl,
    headers: {
      "x-openclaw-agent-id": config.agentId,
      "x-openclaw-session-key": config.sessionKey
    },
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set("x-openclaw-agent-id", config.agentId);
      headers.set("x-openclaw-session-key", config.sessionKey);
      return fetch(input, { ...init, headers });
    }
  });
}

export async function requestOpenClaw(
  config: OpenClawConfig,
  messages: ChatMessage[]
): Promise<string> {
  const openai = createOpenClawProvider(config);

  try {
    const { text } = await generateText({
      model: openai(config.model),
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content
      }))
    });

    if (text.trim()) {
      return text;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenClaw Gateway 请求失败: ${message}`);
  }

  throw new Error("OpenClaw Gateway 返回了空响应。");
}
