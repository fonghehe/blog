---
title: "攝影機預覽的資源租約：權限彈窗晚返回時，頁面已經關閉了"
date: 2026-11-05 14:40:22
tags:
  - JavaScript
  - 工程化
description: "用請求世代和軌道清理管理攝影機生命週期，區分停止預覽與真正釋放設備。"
readingTime: 4
wordCount: 1142
---

使用者點開掃碼彈窗，瀏覽器開始請求攝影機權限。使用者隨即關閉彈窗，幾秒後又允許了權限，攝影機指示燈卻亮了起來。組件已經卸載，不代表尚未完成的設備請求被撤銷；晚返回的 MediaStream 仍需要有人接住並釋放。

掃碼、證件拍照和影片預覽都需要明確的資源所有者。本文把一次預覽看成一份有開始和結束的租約，只討論本地採集，不包含上傳、錄制和遠端通話。

## 權限、設備、軌道和畫面不是一回事

權限允許不保證設備可用：設備可能不存在、正在被佔用，或不符合分辨率條件。影片元素能否播放又受到另一組條件影響。把所有失敗都顯示為“請開啓權限”，會讓使用者在硬體錯誤里反復修改設置。

根據實際異常分類提供重試或選擇設備，但不要靠輪詢權限不斷彈窗。[Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)定義設備請求和軌道行為。HTTPS、安全上下文、嵌入頁面策略及目標瀏覽器差異都需要在部署環境驗證。

## 用請求世代接住晚返回結果

`getUserMedia` 沒有一個可照搬 Fetch 的通用 AbortSignal 取消參數。關閉彈窗時遞增世代號；舊請求即使成功，也立即停止它返回的全部軌道。切換前後攝影機時沿用同樣辦法，避免較慢的舊請求覆蓋新預覽。

```javascript
export function cameraSession(mediaDevices, video) {
  let generation = 0;
  let current = null;
  function stop() {
    generation++;
    if (current) {
      if (video.srcObject === current) video.srcObject = null;
      current.getTracks().forEach(track => track.stop());
      current = null;
    }
  }
  async function start(constraints = { video: true, audio: false }) {
    stop();
    const own = generation;
    let candidate;
    try {
      candidate = await mediaDevices.getUserMedia(constraints);
      if (own !== generation) {
        candidate.getTracks().forEach(track => track.stop());
        return false;
      }
      current = candidate;
      video.srcObject = candidate;
      await video.play();
      return own === generation;
    } catch (error) {
      if (own === generation) {
        stop();
        throw error;
      }
      candidate?.getTracks().forEach(track => track.stop());
      return false;
    }
  }
  return { start, stop };
}
```

這個幫助函數擁有自己取得的流，外部不應把軌道再共享出去後還期望獨立控制壽命。`video.play()` 失敗也需要清理；第二次開始與第一次等待播放交錯時，第一份流已由 stop 釋放。示例用世代判斷返回是否仍然有效，調用方不能把每次 Promise 完成都當成預覽開啓成功。

## 清空 srcObject 只是解除顯示關聯

隱藏影片元素或把 `srcObject` 設為 null 不等於停止採集。真正釋放本例擁有的資源需要調用所有軌道的 `stop()`。只停影片軌道而忘記音訊軌，會留下不必要的麥克風使用，所以不需要音頻時一開始就不要請求。

`enabled = false` 更像暫停輸出，不應被當成釋放設備的替代品。若業務允許臨時靜音或暫停，可以單獨建狀態；結束掃描、路由離開和組件銷毀都應進入明確的釋放路徑。對外部結束的軌道還要監聽狀態，通知畫面預覽已經失效。

## 生命週期規則要符合產品承諾

掃碼頁進入後台時是否停止，取決於任務需求與平台限制。若決定停止，恢復時由使用者明確重新開始，或在已經授權且環境允許的條件下重新請求，並處理失敗。不要每次 visibilitychange 都無條件申請，造成權限打擾與設備爭搶。

多個預覽組件需要共享設備時，應由統一管理器持有流，按消費者引用計數或租約決定何時釋放。組件各自隨手 stop 同一條軌道，會互相中斷。反過來，管理器不應因為某個忘記退出的消費者永久佔用設備，必須有可觀測的所有者和清理路徑。

## 約束失敗要允許降級，但不能偽報能力

先區分必需條件和理想條件。強制指定不支持的尺寸會失敗，適度使用 ideal 可以讓瀏覽器協商；業務若必須滿足清晰度，協商後還要讀取實際軌道設置並驗證。前後置選擇也不能在缺少設備時裝作成功。

測試延遲授權後關閉、連續切換、拒絕權限、設備不可用、播放失敗、銷毀時清理，以及舊請求晚於新請求完成。自動測試可用可控 Promise 驗證清理次數，但攝影機指示燈、系統權限與真實設備只能通過瀏覽器設備走查確認。

交付時讓每份流都有明確主人、每條退出路徑都有釋放動作。這樣頁面消失後，設備才不會繼續替一個已經不存在的界面工作。
