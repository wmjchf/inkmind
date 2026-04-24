import Taro from "@tarojs/taro";
import { API_BASE } from "../config";

export type RecognizeImageResult = {
  text: string;
  provider?: string;
  action?: string;
};

/**
 * 上传本地图片到后端 `POST /ocr/recognize`（multipart 字段名 `image`），返回印刷体识别文本。
 */
export async function recognizeImage(filePath: string): Promise<RecognizeImageResult> {
  const token: string | undefined = Taro.getStorageSync("accessToken");
  if (!token) {
    throw new Error("未登录，请先使用需要登录的功能");
  }

  const res = await Taro.uploadFile({
    url: `${API_BASE}/ocr/recognize`,
    filePath,
    name: "image",
    header: { Authorization: `Bearer ${token}` },
  });

  let body: Record<string, unknown>;
  try {
    const raw = res.data;
    body = typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
  } catch {
    throw new Error("识别服务返回格式异常");
  }

  if (res.statusCode === 401) {
    Taro.removeStorageSync("accessToken");
  }

  if (res.statusCode >= 400) {
    const msg = typeof body.message === "string" ? body.message : `识别失败（${res.statusCode}）`;
    throw new Error(msg);
  }

  const text = body.text;
  if (typeof text !== "string") {
    const msg = typeof body.message === "string" ? body.message : "识别结果无效";
    throw new Error(msg);
  }

  return {
    text,
    ...(typeof body.provider === "string" ? { provider: body.provider } : {}),
    ...(typeof body.action === "string" ? { action: body.action } : {}),
  };
}
