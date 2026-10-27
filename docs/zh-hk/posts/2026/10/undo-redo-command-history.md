---
title: "撤銷與重做的命令歷史：一次操作到底應該恢復什麼"
date: 2026-10-27 15:18:29
tags:
  - JavaScript
  - 工程化
description: "用字幕編輯示例解釋事務分組、反向命令、保存基線和外部副作用的邊界。"
readingTime: 4
wordCount: 1127
---

拖動一個對象產生 80 次狀態更新，按一次撤銷卻只退回一像素；另一種實現保存整棵組件狀態，連展開面板和加載標記也一起恢復了。撤銷的困難不在維護兩個數組，而在定義用戶認知中的“一次操作”。

這裡用字幕文本編輯建立最小模型：每條字幕有穩定 ID，命令記錄修改前後文本。示例只處理本地已有字幕的文本替換，不包含插入刪除、多人協同或網絡回滾。

## 歷史應記錄領域變化

領域狀態包括字幕內容、順序和時間範圍；選中項、播放位置、懸浮提示是交互狀態。一次文本撤銷是否恢復選區可以單獨約定，但不應把整個 UI 狀態作為業務快照。否則異步請求標記和已經失效的資源引用也會被帶回過去。

穩定 ID 比數組位置更適合命令。若命令寫著“修改第三行”，排序之後就可能修改另一條字幕。命令應定位 ID，附帶必要的版本或前置條件。不存在的目標不能靜默跳過，否則界面會誤報撤銷成功。

## 反向命令需要前置條件

以下歷史存儲 `before` 與 `after`，撤銷前檢查當前值仍然等於預期。檢查失敗時先拋錯，保持歷史棧不變，交給調用層選擇重新加載或衝突處理。直接覆蓋會把外部變更吃掉。類是教學模型，生產代碼應隱藏內部數組並限制外部直接修改狀態。

```javascript
export class CaptionHistory {
  constructor(initial, limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit');
    this.state = { ...initial };
    this.past = [];
    this.future = [];
    this.limit = limit;
  }
  apply(command, reverse = false) {
    const expected = reverse ? command.after : command.before;
    const next = reverse ? command.before : command.after;
    if (this.state[command.id] !== expected) throw new Error('revision conflict');
    this.state = { ...this.state, [command.id]: next };
  }
  execute(id, after) {
    if (!Object.hasOwn(this.state, id) || typeof after !== 'string') {
      throw new Error('unknown caption or invalid text');
    }
    const command = { id, before: this.state[id], after };
    if (command.before === after) return;
    this.apply(command);
    this.past.push(command);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo() {
    const command = this.past.at(-1);
    if (!command) return false;
    this.apply(command, true);
    this.past.pop();
    this.future.push(command);
    return true;
  }
  redo() {
    const command = this.future.at(-1);
    if (!command) return false;
    this.apply(command);
    this.future.pop();
    this.past.push(command);
    return true;
  }
}
```

執行新命令後清空 redo 分支，因為未來歷史屬於已經放棄的另一條時間線。無實際變化不入棧。容量上限只控制命令數量；若文本很大，還需按實際內容大小預算內存。對含圖片或二進制內容的編輯器，歷史最好引用受管理資源，不複製完整數據。

## 輸入和拖動必須按意圖分組

一段連續輸入可合併為一條命令，但不能只按固定毫秒窗口決定。光標移動、切換字幕、粘貼和輸入法確認通常應結束一個分組。拖動則在開始時記錄原值，移動期間展示預覽，結束時只提交一次命令；取消拖動應回到原值且不新增歷史。

事務組中若有多個領域修改，應全部成功後才入棧，失敗則恢復已完成的部分。反向順序通常與正向順序相反，但對於依賴外部系統的操作，未必存在真正可逆的命令。不要把本地文本歷史推廣成“任何功能都能一鍵回滾”。

## 已保存狀態不是歷史棧長度

保存後繼續修改再撤銷，內容可能重新等於已保存版本。用 `past.length > 0` 判斷未保存會一直亮紅點。相反，歷史達到上限後長度不變，內容卻仍在變化。應保留保存基線的內容指紋或文檔修訂標識，比較當前領域狀態，而不是歷史長度。

異步保存還要綁定發起保存時的快照。若保存 A 時用戶已改成 B，A 成功後只能把 A 標為服務端基線，不能宣佈 B 已保存。保存失敗也不應該刪除本地歷史，用戶仍需要撤銷與繼續編輯。

## 網絡和多人編輯需要另一層協議

撤銷“已發送郵件”不能簡單恢復本地按鈕狀態。對外部副作用應使用取消、補償或新的業務命令，並明確是否真的可恢復。多人編輯時，舊的 before 值可能已失效，需要操作轉換、協同模型或衝突策略；本例的前置條件檢查只能發現衝突，不能自動合併。

驗收應覆蓋連續兩次撤銷與重做、撤銷後新建分支、空操作、目標失效、容量裁剪、保存中繼續輸入，以及輸入法和拖動的事務邊界。瀏覽器輸入事件與原生歷史的關係可以參考 [Input Events](https://www.w3.org/TR/input-events-2/)，不要讓原生撤銷和自建歷史同時消費同一次按鍵。
