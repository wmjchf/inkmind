/** 首页收藏列表用内联 SVG（小程序 Image 支持 data URL） */

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const stroke = "#999999";

export const indexIcons = {
  /** 搜索入口放大镜 */
  search: svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`
  ),
} as const;
