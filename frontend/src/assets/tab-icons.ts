/** 自定义 TabBar 用内联 SVG（小程序 Image 支持 data URL） */

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const strokeMuted = "#999999";
const strokeActive = "#38a8ff";

/** 收藏：书 */
const iconBook = (stroke: string) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
  );

/** 我的：用户 */
const iconUser = (stroke: string) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
  );

/** 中间「识别」入口：相机（白描，放在蓝底 FAB 上） */
export const iconCameraFab = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`
);

export const tabIcons = {
  bookOff: iconBook(strokeMuted),
  bookOn: iconBook(strokeActive),
  userOff: iconUser(strokeMuted),
  userOn: iconUser(strokeActive),
} as const;
