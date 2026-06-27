# 流式聊天输出时序

本文档总结 `popup` 通过 `chat/stream` Port 与 `background service worker` 交互时的流式输出流程，包含工具调用与会话相关细节。

## 正常流程

```mermaid
sequenceDiagram
    autonumber
    participant User as 用户
    participant Popup as Popup UI
    participant BG as Background Service Worker
    participant Connector as runConnectorStream
    participant LLM as streamLlm / AI SDK
    participant Tools as gatewayTools<br/>(tabSnapshotListBasic / tabSnapshotGet)
    participant API as OpenAI-Compatible API
    participant IDB as IndexedDB (sessions / messages)

    User->>Popup: 输入消息并点击发送
    Popup->>Popup: 清空输入框
    Popup->>Popup: 插入 user 消息
    Popup->>Popup: 插入空 assistant 占位消息
    Popup->>Popup: 禁用发送按钮

    Popup->>BG: chrome.runtime.connect({ name: "chat/stream" })
    Popup->>BG: postMessage(chat/stream:start, requestId, message)

    BG->>BG: getConfig()
    BG->>IDB: getCurrentSid() + getMessages(sid)
    IDB-->>BG: config + history

    BG-->>Popup: chat/stream:started(requestId, assistantMessageId)
    Popup->>Popup: 将 assistant 占位消息 ID 对齐

    BG->>Connector: runConnectorStream(message, tabs, config, history, onDelta, abortSignal)

    alt 未配置 API Key / Base URL
        Connector-->>BG: onDelta(配置提示文本)
        BG-->>Popup: chat/stream:delta(requestId, deltaType=answer)
        Popup->>Popup: 追加 delta 到 assistant 消息
        Connector-->>BG: ConnectorResult(mode: config-required)
    else 配置完整
        Connector->>LLM: streamLlm(config, messages, onDelta, abortSignal)
        LLM->>API: 发起流式 chat/completions 请求<br/>(prepareStep 在 step 0/1 强制选择工具)

        loop step 0..N (stopWhen: stepCountIs(5))
            alt 工具调用
                API-->>LLM: tool-input-start / tool-input-delta / tool-input-end / tool-call
                LLM-->>BG: onDelta({ type: "tool", delta: { event: ... } })
                BG-->>Popup: chat/stream:delta(deltaType=tool)
                LLM->>Tools: execute(input)
                Tools-->>LLM: { data: ... }
                LLM-->>BG: onDelta({ type: "tool", delta: { event: "result", ... } })
                BG-->>Popup: chat/stream:delta(deltaType=tool)
                Popup->>Popup: 在 assistant 消息上插入 / 更新工具调用块
            else 文本 / 思考
                API-->>LLM: text-delta / reasoning-delta
                LLM-->>BG: onDelta({ type: "answer" | "reasoning", delta })
                BG-->>Popup: chat/stream:delta(deltaType=answer | reasoning)
                Popup->>Popup: 追加 delta 到 assistant 消息并 patch 渲染
            end
        end

        API-->>LLM: finishReason / [DONE]
        LLM-->>Connector: { text, reasoning?, toolCalls? }
        Connector-->>BG: ConnectorResult(mode: gateway, reply, reasoning, toolCalls)
    end

    BG->>IDB: appendMessages(sid, [user, assistant])
    IDB-->>BG: latest history

    BG-->>Popup: chat/stream:done(requestId, sid, result, history)
    Popup->>Popup: 用最终 history 对齐本地状态
    Popup->>BG: port.disconnect()
    Popup->>Popup: 清理 activePort / requestId
    Popup->>Popup: 恢复发送按钮
```

## 异常与取消流程

```mermaid
sequenceDiagram
    participant Popup as Popup UI
    participant BG as Background
    participant LLM as AI SDK Stream

    alt 用户切换会话 / popup 关闭 / 新请求开始
        Popup->>BG: port.disconnect()
        BG->>LLM: AbortController.abort()
        BG->>BG: 停止继续 postMessage
    else 请求失败
        BG-->>Popup: chat/stream:error(requestId, message)
        Popup->>Popup: assistant 占位消息显示错误
        Popup->>Popup: 恢复发送按钮
        Popup->>BG: port.disconnect()
    end
```

## 关键约定

- `requestId` 用于过滤过期事件，避免旧请求污染当前 UI。popup 在 `chat-stream-controller.ts` 中只处理 `message.requestId === activeRequestId` 的事件。
- `assistantMessageId` 用于把 background 最终保存的 assistant 消息与 popup 中的占位消息对齐；popup 当前直接用本地生成的占位 ID，等 `chat/stream:done` 后再用 history 对齐。
- `chat/stream:delta` 携带文本增量与 `deltaType`：
  - `answer`：普通回答文本
  - `reasoning`：思考过程文本（可来自标准 reasoning 流或 `<think>...</think>` 解析）
  - `tool`：工具调用过程事件，`delta` 是结构化对象（`call` / `input-start` / `input-delta` / `input-end` / `result` / `error`）
- popup 只在收到 `result` / `error` 时把工具调用追加进 assistant 消息的 `toolCalls`（与 background 持久化策略一致）。
- 最终完整回复以 `chat/stream:done.result.reply` 与 `history` 为准；popup 应当用 `history` 重新渲染整列消息，避免增量与最终结果不一致。
- `chat/stream:done` 同时返回 `sid`，方便前端确认对应的是哪条会话。
- AI SDK 在 `prepareStep` 中强制：step 0 必须调用 `tabSnapshotListBasicTool`，step 1 必须调用 `tabSnapshotGet`，从 step 2 起允许自由选择；整轮步数受 `stopWhen: stepCountIs(5)` 约束。
- assistant 历史消息会保存 `reasoning` 和 `toolCalls`（仅 `result` / `error` 事件），popup 重开后仍能显示思考过程与工具调用结果。
- Port 断开会触发 background 的 `AbortController.abort()`，用于取消仍在进行中的 AI SDK 请求；正在执行的工具不会被 abort（由 AI SDK 内部决定）。
- 用户在流式输出过程中切换会话时，popup 会先调用 `stopChatStream()` 主动断开 Port，再用新的 `chat/state:get` 对齐 UI。
