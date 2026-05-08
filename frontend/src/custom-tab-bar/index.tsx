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
    void Taro.switchTab({ url: "/pages/plaza/index" });
  };

  switchRight = () => {
    this.setState({ selected: 2 });
    void Taro.switchTab({ url: "/pages/profile/index" });
  };

  /** 中间「识别」：拍照 / 相册 OCR / 手动添加 */
  openAddCenter = async () => {
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
      const q = `localPath=${encodeURIComponent(path)}&source=ocr`;
      void Taro.navigateTo({ url: `/pages/add/index?${q}` });
    } catch {
      /* 取消操作菜单或选图 */
    }
  };

  render(): ReactNode {
    const { selected } = this.state;
    return (
      <View className="tabbar">
        <View className="tab" onClick={this.switchLeft}>
          <Image
            className="tab-icon"
            src={selected === 0 ? tabIcons.plazaOn : tabIcons.plazaOff}
            mode="aspectFit"
          />
          <Text className={`tab-text ${selected === 0 ? "on" : ""}`}>广场</Text>
        </View>

        <View className="tab-center-wrap">
          <View className="fab" onClick={() => void this.openAddCenter()}>
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
