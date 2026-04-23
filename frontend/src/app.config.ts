export default {
  pages: [
    "pages/index/index",
    "pages/ocr-entry/index",
    "pages/profile/index",
    "pages/add/index",
    "pages/entry-detail/index",
  ],
  permission: {
    "scope.camera": {
      desc: "用于拍摄书页，便于后续 OCR 识别句子",
    },
  },
  window: {
    backgroundTextStyle: "dark",
    navigationBarBackgroundColor: "#f7f5f2",
    navigationBarTitleText: "InkMind",
    navigationBarTextStyle: "black",
    backgroundColor: "#f7f5f2",
  },
  tabBar: {
    custom: true,
    color: "#666666",
    selectedColor: "#1a1a1a",
    backgroundColor: "#ffffff",
    borderStyle: "black",
    list: [
      { pagePath: "pages/index/index", text: "收藏" },
      { pagePath: "pages/ocr-entry/index", text: "拍照" },
      { pagePath: "pages/profile/index", text: "我的" },
    ],
  },
};
