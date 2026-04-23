import { Component, ReactNode } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

type State = {
  selected: number;
};

/** 供 Tab 页通过 Taro.getTabBar(page)?.setSelected(n) 同步高亮 */
export default class CustomTabBar extends Component<unknown, State> {
  constructor(props: unknown) {
    super(props);
    this.state = { selected: 0 };
  }

  setSelected = (selected: number) => {
    this.setState({ selected });
  };

  switchLeft = () => {
    this.setState({ selected: 0 });
    void Taro.switchTab({ url: "/pages/index/index" });
  };

  switchRight = () => {
    this.setState({ selected: 2 });
    void Taro.switchTab({ url: "/pages/profile/index" });
  };

  /** 主入口：仅调起相机，不切换 Tab；识别 API 后续再接 */
  openCamera = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["camera"],
      });
      const path = res.tempFiles[0]?.tempFilePath;
      if (!path) return;
      const q = `localPath=${encodeURIComponent(path)}&source=ocr`;
      void Taro.navigateTo({ url: `/pages/add/index?${q}` });
    } catch {
      /* 用户取消 */
    }
  };

  render(): ReactNode {
    const { selected } = this.state;
    return (
      <View className="tabbar">
        <View className="tab" onClick={this.switchLeft}>
          <Text className={`tab-text ${selected === 0 ? "on" : ""}`}>收藏</Text>
        </View>

        <View className="tab-center-wrap">
          <View className="fab" onClick={() => void this.openCamera()}>
            <Text>＋</Text>
          </View>
          <Text className="fab-label">拍照</Text>
        </View>

        <View className="tab" onClick={this.switchRight}>
          <Text className={`tab-text ${selected === 2 ? "on" : ""}`}>我的</Text>
        </View>
      </View>
    );
  }
}
