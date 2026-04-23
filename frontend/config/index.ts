import path from "path";
import { defineConfig, type UserConfigExport } from "@tarojs/cli";

export default defineConfig({
  projectName: "inkmind-mini",
  date: "2026-4-23",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: "src",
  outputRoot: "dist",
  plugins: ["@tarojs/plugin-framework-react"],
  defineConstants: {},
  copy: { patterns: [], options: {} },
  framework: "react",
  compiler: {
    type: "webpack5",
    prebundle: { enable: false },
  },
  cache: { enable: false },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
    },
  },
  alias: {
    "@": path.resolve(__dirname, "..", "src"),
  },
} satisfies UserConfigExport);
