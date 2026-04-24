import { Component, ReactNode } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { iconCameraFab, tabIcons } from "../assets/tab-icons";
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

  /** 主入口「识别」：调起相机拍书页 → 添加页自动请求后端 OCR 填入内容 */
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
          <Image
            className="tab-icon"
            src={selected === 0 ? tabIcons.bookOn : tabIcons.bookOff}
            mode="aspectFit"
          />
          <Text className={`tab-text ${selected === 0 ? "on" : ""}`}>收藏</Text>
        </View>

        <View className="tab-center-wrap">
          <View className="fab" onClick={() => void this.openCamera()}>
            <Image className="fab-icon" src={iconCameraFab} mode="aspectFit" />
          </View>
        </View>

        <View className="tab" onClick={this.switchRight}>
          <Image
            className="tab-icon"
            src={selected === 2 ? tabIcons.userOn : tabIcons.userOff}
            mode="aspectFit"
          />
          <Text className={`tab-text ${selected === 2 ? "on" : ""}`}>我的</Text>
        </View>
      </View>
    );
  }
}
