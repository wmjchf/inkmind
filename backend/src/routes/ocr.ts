import { Router } from "express";
import multer from "multer";
import { config } from "../config";
import { asyncHandler, requireAuth } from "../middleware/requireAuth";
import { recognizeGeneralFromImageBuffer } from "../services/aliyunOcr";
import { HttpError } from "../lib/httpError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const ocrRouter = Router();
ocrRouter.use(requireAuth);

/**
 * 上传图片 → 阿里云 RecognizeGeneral → 返回纯文本（供小程序填表）。
 * 表单字段名：`image`（与 Taro.uploadFile name 一致）
 */
ocrRouter.post(
  "/recognize",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const { accessKeyId, accessKeySecret, endpoint } = config.aliyunOcr;
    if (!accessKeyId || !accessKeySecret) {
      throw new HttpError(
        503,
        "OCR_NOT_CONFIGURED",
        "未配置 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET"
      );
    }
    const buf = req.file?.buffer;
    if (!buf?.length) {
      throw new HttpError(400, "VALIDATION", "请使用 multipart 上传字段 image（图片二进制）");
    }

    const { text } = await recognizeGeneralFromImageBuffer(buf, {
      accessKeyId,
      accessKeySecret,
      endpoint,
    });

    res.json({
      text,
      provider: "aliyun-ocr",
      action: "RecognizeGeneral",
    });
  })
);
