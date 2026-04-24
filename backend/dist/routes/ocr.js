"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const config_1 = require("../config");
const requireAuth_1 = require("../middleware/requireAuth");
const aliyunOcr_1 = require("../services/aliyunOcr");
const httpError_1 = require("../lib/httpError");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});
exports.ocrRouter = (0, express_1.Router)();
exports.ocrRouter.use(requireAuth_1.requireAuth);
/**
 * 上传图片 → 阿里云 RecognizeAdvanced（全文识别高精版）→ 返回纯文本（供小程序填表）。
 * 表单字段名：`image`（与 Taro.uploadFile name 一致）
 */
exports.ocrRouter.post("/recognize", upload.single("image"), (0, requireAuth_1.asyncHandler)(async (req, res) => {
    const { accessKeyId, accessKeySecret, endpoint } = config_1.config.aliyunOcr;
    if (!accessKeyId || !accessKeySecret) {
        throw new httpError_1.HttpError(503, "OCR_NOT_CONFIGURED", "未配置 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET");
    }
    const buf = req.file?.buffer;
    if (!buf?.length) {
        throw new httpError_1.HttpError(400, "VALIDATION", "请使用 multipart 上传字段 image（图片二进制）");
    }
    const { text } = await (0, aliyunOcr_1.recognizeAdvancedFromImageBuffer)(buf, {
        accessKeyId,
        accessKeySecret,
        endpoint,
    });
    res.json({
        text,
        provider: "aliyun-ocr-advanced",
        action: "RecognizeAdvanced",
    });
}));
