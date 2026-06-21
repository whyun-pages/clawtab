# 流式聊天输出时序

本文档总结 `popup` 通过 `chat/stream` Port 与 `background service worker` 交互时的流式输出流程。

## 正常流程

```mermaid
sequenceDiagram
    autonumber
    participant User as 用户
    participant Popup as Popup UI
    participant BG as Background Service Worker
    participant Connector as runConnectorStream
    participant LLM as streamLlm / AI SDK
    participant API as OpenAI-Compatible API
    participant Store as chrome.storage

    User->>Popup: 输入消息并点击发送
    Popup->>Popup: 清空输入框
    Popup->>Popup: 插入 user 消息
    Popup->>Popup: 插入空 assistant 占位消息
    Popup->>Popup: 禁用发送按钮

    Popup->>BG: chrome.runtime.connect({ name: "chat/stream" })
    Popup->>BG: postMessage(chat/stream:start, requestId, message)

    BG->>Store: getConfig() + getHistory()
    Store-->>BG: config + history

    BG-->>Popup: chat/stream:started(requestId, assistantMessageId)
    Popup->>Popup: 将 assistant 占位消息 ID 对齐

    BG->>Connector: runConnectorStream(message, tabs, config, history, onDelta, abortSignal)

    alt 未配置 API Key / Base URL
        Connector-->>BG: onDelta(配置提示文本)
        BG-->>Popup: chat/stream:delta(requestId, delta)
        Popup->>Popup: 追加 delta 到 assistant 消息
        Connector-->>BG: ConnectorResult(mode: config-required)
    else 配置完整
        Connector->>LLM: streamLlm(config, messages, onDelta, abortSignal)
        LLM->>API: 发起流式 chat/completions 请求

        loop 模型持续输出
            API-->>LLM: SSE chunk / token delta
            LLM-->>Connector: onDelta(delta)
            Connector-->>BG: onDelta(delta)
            BG-->>Popup: chat/stream:delta(requestId, delta)
            Popup->>Popup: 追加 delta 到 assistant 消息并重新渲染
        end

        API-->>LLM: [DONE]
        LLM-->>Connector: 返回完整 reply
        Connector-->>BG: ConnectorResult(mode: gateway, reply)
    end

    BG->>Store: saveHistory(user + assistant 完整回复)
    Store-->>BG: latest history

    BG-->>Popup: chat/stream:done(requestId, result, history)
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
    participant LLM as LLM Request

    alt 用户清空对话 / popup 关闭 / 新请求开始
        Popup->>BG: port.disconnect()
        BG->>LLM: AbortController.abort()
        BG->>BG: 停止继续推送 delta
    else 请求失败
        BG-->>Popup: chat/stream:error(requestId, message)
        Popup->>Popup: assistant 占位消息显示错误
        Popup->>Popup: 恢复发送按钮
        Popup->>BG: port.disconnect()
    end
```

## 关键约定

- `requestId` 用于过滤过期事件，避免旧请求污染当前 UI。
- `assistantMessageId` 用于把后台最终保存的 assistant 消息与 popup 中的占位消息对齐。
- `chat/stream:delta` 携带文本增量和 `deltaType`；普通回答使用 `answer`，思考内容使用 `reasoning`。
- `reasoning` 可来自标准 reasoning 流，也可由 `<think>...</think>` 文本段解析得到。
- 最终完整回复以 `chat/stream:done.result.reply` 和 `history` 为准。
- assistant 历史消息可保存 `reasoning` 字段，popup 重开后仍能显示思考过程。
- Port 断开会触发后台 `AbortController.abort()`，用于取消仍在进行中的大模型请求。
