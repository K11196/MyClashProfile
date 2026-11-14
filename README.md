# MyClashProfile

自动合并远程 Clash 扩展脚本 + 本地自定义逻辑，生成一个可直接被 Clash Verge 引用的脚本。

## 工作原理

- `Upstream.js`：填写远程脚本 URL（纯文本，`#` 开头为注释）
- `MyCustomizations.js`：你的本地自定义逻辑，导出 `applyCustomizations(config)`
- `build.js`：读取 URL → 下载远程脚本 → 校验有 `main` → 拼装本地逻辑 → 输出 `dist/merged-script.js`
- GitHub Actions：每天自动构建，或当你 push 上述文件时立即构建

## 首次部署

1. 创建仓库 `MyClashProfile`，把本仓库文件全部上传（`dist/` 可先不创建）。
2. 进入仓库 **Settings → Actions → General → Workflow permissions**，选择 **Read and write permissions**，保存。
3. 进入 **Actions → Build Merged Script → Run workflow** 手动触发一次。
4. 构建成功后，仓库会出现 `dist/merged-script.js`。

## 在 Clash Verge 中引用

把下面的链接填入 Clash Verge 的「全局扩展脚本」：
