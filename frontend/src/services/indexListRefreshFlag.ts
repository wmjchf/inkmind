import Taro from "@tarojs/taro";

const KEY = "inkmind_pending_index_refresh";

/** 列表数据已变化，下次进入收藏 Tab 时应刷新（添加/删除成功后调用） */
export function requestIndexListRefresh(): void {
  try {
    Taro.setStorageSync(KEY, "1");
  } catch {
    /* ignore */
  }
}

/** 若存在标记则清除并返回 true；用于收藏首页仅在「需要时」请求 */
export function consumeIndexListRefreshRequest(): boolean {
  try {
    const v = Taro.getStorageSync(KEY);
    if (v === "1") {
      Taro.removeStorageSync(KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
