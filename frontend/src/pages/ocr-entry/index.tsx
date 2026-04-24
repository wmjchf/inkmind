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
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["camera"],
      });
      const path = res.tempFiles[0]?.tempFilePath;
      if (!path) return;
      void Taro.navigateTo({
        url: `/pages/add/index?localPath=${encodeURIComponent(path)}&source=ocr`,
      });
    } catch {
      void Taro.switchTab({ url: "/pages/index/index" });
    }
  };

  return (
    <View className="ocr-placeholder">
      <Text className="title">用底部中间的「识别」</Text>
      <Text className="sub">主入口在底部 Tab 中间「识别」：拍书页后录入内容。想纯手输请到「我的」→ 手动添加金句。</Text>
      <View className="btn" onClick={() => void open()}>
        拍书页识别
      </View>
      <View className="link" onClick={() => Taro.switchTab({ url: "/pages/index/index" })}>
        回收藏
      </View>
    </View>
  );
}
