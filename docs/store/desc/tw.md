ClawTab 是一個執行在 Chrome 擴充功能環境中的瀏覽器自動化助手。它會從目前開啟的網頁中擷取標題、URL 和內文內容（基於 Mozilla Readability + NodeHtmlMarkdown 轉為 markdown），並在側邊欄中提供對話式問答體驗。

你可以用它快速理解網頁內容、詢問頁面細節、總結文章重點，或結合目前分頁內容向你設定的大型語言模型介面發問。多工作階段能力讓你可以並行維護多個獨立的對話脈絡。

主要功能：

- 在 Chrome 側邊欄中進行網頁內容問答
- 擷取目前分頁的標題、URL 和內文文字（基於 Mozilla Readability + NodeHtmlMarkdown 轉為 markdown），依 URL 索引快取快照
- 支援 OpenAI-compatible Chat Completions 介面
- 串流輸出，支援顯示模型的思考過程（reasoning）
- 內建工具呼叫：列出開啟的分頁、擷取網頁內文快照，工具呼叫結果以 markdown 呈現
- 背景開啟網頁並自動擷取內容：模型可在不切換焦點的情況下開啟 URL 並讀取內文，已開啟的頁面會重複使用分頁
- 多站點搜尋：綜合搜尋（Google / Bing / 百度）與商品搜尋（淘寶 / 京東 / 閒魚 / 亞馬遜 / eBay / Best Buy）
- 對話內引用跳轉：回答中引用的分頁可點擊，直接開啟或聚焦對應網頁
- 多工作階段管理，可建立、切換、刪除獨立的對話
- 支援 Markdown 回答呈現、程式碼高亮
- 支援複製問題和答案
- 多語言介面：簡體中文、English、日本語、繁體中文，可在設定中切換介面語言
- 聊天工作階段和訊息持久化到 IndexedDB，模型設定儲存在 `chrome.storage.local`
- Enter / Shift+Enter 快捷鍵傳送和換行

使用方式：

1. 安裝擴充功能後開啟 ClawTab 側邊欄。
2. 在「大型語言模型設定」中填寫 Base URL、API Key 和 Model。
3. 開啟任意網頁。
4. 在輸入框中詢問目前網頁內容，或新建工作階段開始獨立對話。

資料說明：

ClawTab 不提供自有雲端模型服務。使用者輸入、網頁文字和聊天脈絡會傳送到使用者自行設定的大型語言模型介面。API Key、模型設定、工作階段與聊天歷史以及網頁快照預設儲存在本機瀏覽器儲存空間中（`chrome.storage.local` + IndexedDB），不會上傳到第三方服務。
