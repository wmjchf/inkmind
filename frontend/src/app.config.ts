export default {
  pages: [
    "pages/index/index",
    "pages/ocr-entry/index",
    "pages/profile/index",
    "pages/feedback/index",
    "pages/add/index",
    "pages/entry-detail/index",
  ],
  permission: {
    "scope.camera": {
      desc: "用于拍书页并识别书中内容（OCR）",
    },
  },
  window: {
    backgroundTextStyle: "dark",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTitleText: "InkMind",
    navigationBarTextStyle: "black",
    backgroundColor: "#f5f7fa",
  },
  tabBar: {
    custom: true,
    color: "#999999",
    selectedColor: "#38a8ff",
    backgroundColor: "#ffffff",
    borderStyle: "white",
    list: [
      { pagePath: "pages/index/index", text: "收藏" },
      { pagePath: "pages/ocr-entry/index", text: "识别" },
      { pagePath: "pages/profile/index", text: "我的" },
    ],
  },
};
