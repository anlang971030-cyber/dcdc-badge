# Legacy v1

`app-v1.js` 是第一版完整前端源码的只读归档，其中保留了：

- `organicPreset`
- `geometricPreset`
- `dataPreset`
- 旧版 A / B / C 三方案生成逻辑
- 旧版 SVG 抽象图案与 Canvas 合成流程

正式版入口 `../app.js` 不导入此文件。第一版项目中没有独立的 `facet.js`、`ascii.js` 或 `contour.js` 文件，因此没有伪造空白模块；相关旧文案和视觉逻辑仅存在于归档源码中。
