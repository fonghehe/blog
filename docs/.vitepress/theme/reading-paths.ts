export const readingPaths = [
  {
    id: "state",
    titles: { zh: "页面状态与数据一致性", en: "Screen state & data consistency", ja: "画面状態とデータの整合性", tw: "頁面狀態與資料一致性", hk: "頁面狀態與資料一致性" },
    descriptions: {
      zh: "从加载、空态和刷新失败开始，再处理账户隔离与前后台切换。",
      en: "Start with loading, empty and refresh states, then cover account isolation and app lifecycle.",
      ja: "読み込み・空状態・更新失敗から、アカウント分離とライフサイクルへ進みます。",
      tw: "從載入、空狀態和重新整理失敗開始，再處理帳號隔離與前背景切換。",
      hk: "從載入、空狀態和重新整理失敗開始，再處理帳戶隔離與前後台切換。",
    },
    slugs: ["mobile-screen-state-contract", "mobile-session-storage", "react-native-appstate-refresh"],
  },
  {
    id: "performance",
    titles: { zh: "移动端性能诊断", en: "Mobile performance diagnosis", ja: "モバイルの性能分析", tw: "行動端效能診斷", hk: "流動應用效能診斷" },
    descriptions: {
      zh: "先建立可复现的采样路径，再区分帧耗时与列表渲染问题。",
      en: "Build a repeatable measurement path before diagnosing frame time and list rendering.",
      ja: "再現可能な計測手順を作り、フレーム時間とリスト描画の問題を切り分けます。",
      tw: "先建立可重現的取樣路徑，再區分影格耗時與列表繪製問題。",
      hk: "先建立可重現的取樣路徑，再區分畫格耗時與清單渲染問題。",
    },
    slugs: ["flutter-frame-jank-investigation", "react-native-list-performance-diagnosis"],
  },
  {
    id: "delivery",
    titles: { zh: "测试、无障碍与发布", en: "Testing, accessibility & delivery", ja: "テスト・アクセシビリティ・リリース", tw: "測試、無障礙與發布", hk: "測試、無障礙與發佈" },
    descriptions: {
      zh: "把功能测试、读屏验收与版本兼容检查串成一条交付路径。",
      en: "Connect feature tests, screen-reader checks and version compatibility into a delivery workflow.",
      ja: "機能テスト、スクリーンリーダー検証、バージョン互換性を一つの流れにします。",
      tw: "把功能測試、讀屏驗收與版本相容檢查串成一條交付路徑。",
      hk: "將功能測試、讀屏驗收與版本相容檢查連成一條交付流程。",
    },
    slugs: ["flutter-feature-testing-pyramid", "mobile-accessibility-rn-flutter", "mobile-release-rollout-gates"],
  },
];

export const selectedSlugs = ["mobile-screen-state-contract", "flutter-frame-jank-investigation", "mobile-accessibility-rn-flutter"];
