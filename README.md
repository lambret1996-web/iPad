# Ping测试 - 网页封装 IPA（免费方案）

把网页封装成 iOS 安装包（IPA），**无需 Mac、免费**，用 GitHub Actions 云端编译。

> ✅ 已确认：后端接口已部署在 `https://testping.pages.dev`，`/visit` 可正常返回 JSON。
> 网页内 API 已配置为绝对域名 `https://testping.pages.dev/visit` 和 `/save`。

## 工程结构
```
web2ipa/
├── www/                     # 网页源码（封装的页面）
│   └── index.html           # ⚠️ 需要你补全完整源码
├── .github/workflows/
│   └── build-ipa.yml        # GitHub Actions 自动编译脚本
├── capacitor.config.json    # Capacitor 配置（App名称、ID等）
├── package.json             # 依赖
└── README.md
```

## 使用步骤

### 1. 补全网页源码
把完整的 `index.html`（包含全部 HTML + `<script>` JS 测速逻辑）放到 `www/` 目录。
> 当前是占位文件，后半段被截断，需要你补全。

### 2. 创建 GitHub 仓库并推送
1. 在 github.com 新建一个仓库（公开/私有均可）
2. 本地把整个 `web2ipa` 文件夹推上去：
```bash
cd web2ipa
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

### 3. 触发编译
推送后 GitHub Actions 会自动开始编译（约5~10分钟）。
也可以手动触发：仓库 → **Actions** → **构建未签名IPA** → **Run workflow**

### 4. 下载 IPA
编译完成后，在 Actions 运行页面底部 **Artifacts** 处下载 `ping-test-ipa`，解压得到：
```
Ping测试-未签名.ipa
```

### 5. 自签安装到 iPhone
用你的自签工具（AltStore / Sideloadly / ESign / Feather 等）对 IPA 签名后安装到 iPhone。

## 常见问题

### Q: 为什么是"未签名"IPA？
本方案用 GitHub 免费的 macOS 云编译机，不做 Apple 签名（签名需要开发者账号/证书）。
拿到未签名 IPA 后，用你的自签工具签名即可安装，7天有效（免费Apple ID）。

### Q: 网页里测速会访问 http:// 站点，iOS 会拦截吗？
已解决。编译脚本里已自动开启 ATS（`NSAllowsArbitraryLoads`），允许 HTTP 明文请求。
如果你不想放开全部HTTP，可自行收紧（见 build-ipa.yml 注释）。

### Q: 可以改 App 名称/图标吗？
- 名称：改 `capacitor.config.json` 里的 `appName`
- 图标/启动屏：iOS 工程在 CI 里生成，默认用 Capacitor 默认图标；如需自定义，需要在仓库加 `resources/` 并在 workflow 里加 `npx capacitor-assets generate` 步骤（需要 Node 18+ 和 @capacitor/assets）。

## 注意事项
- GitHub 免费账号每月有 macOS 编译额度（约2000分钟），个人打包绰绰有余
- 首次推送若 Actions 未自动跑，检查仓库 Settings → Actions → 是否被禁用
- 自签仅限个人设备使用，不要分发
