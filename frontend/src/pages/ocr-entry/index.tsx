import { View, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import "./index.scss";

/**
 * TabBar 配置要求的中间页占位（主流程走自定义 Tab 中间按钮调相机）。
 * 若用户误点系统层中间 Tab 进入此页，可在此引导。
 */
export default function OcrEntryPage() {
  useDidShow(() => {
    const page = Taro.getCurrentInstance().page;
    if (page) {
      const tabBar = Taro.getTabBar<{ setSelected: (n: number) => void }>(page);
      tabBar?.setSelected?.(1);
    }
  });

  const open = async () => {
    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: ["拍照", "从相册选择", "手动添加"],
      });
      if (tapIndex === 2) {
        void Taro.navigateTo({ url: "/pages/add/index?source=manual" });
        return;
      }
      const sourceType = tapIndex === 0 ? (["camera"] as const) : (["album"] as const);
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: [...sourceType],
      });
      const path = res.tempFiles[0]?.tempFilePath;
      if (!path) return;
      void Taro.navigateTo({
        url: `/pages/add/index?localPath=${encodeURIComponent(path)}&source=ocr`,
      });
    } catch {
      /* 取消菜单或选图 */
    }
  };

  return (
    <View className="ocr-placeholder">
      <Text className="title">用底部中间的「识别」</Text>
      <Text className="sub">
        主入口在底部 Tab 中间「识别」：可选拍照、从图库选图（OCR 填入正文），或「手动添加」直接输入。也可在此使用下方按钮。
      </Text>
      <View className="btn" onClick={() => void open()}>
        拍照 / 图库 / 手动添加
      </View>
      <View className="link" onClick={() => Taro.switchTab({ url: "/pages/plaza/index" })}>
        回广场
      </View>
    </View>
  );
}
