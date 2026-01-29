# 打包 Windows EXE（Electron + Vite）

下面是将该项目打包成 Windows 可执行程序 (.exe) 的说明和推荐做法（包括演示场景）。

## 前提
- 在 Windows 环境（推荐），已安装 Node.js（LTS）、npm 或 pnpm。
- 推荐在本机（PowerShell / CMD）中运行构建命令（WSL 也可以，但若要生成 Windows 安装器/portable，需安装 wine/mono）。
- 确保你已安装依赖：`npm ci`。

## 常用脚本
- `npm run build`：编译 TypeScript 并使用 Vite 生成 `dist`。
- `npm run electron:build`：完整构建并使用 electron-builder 生成安装器（默认 NSIS）
- `npm run build:win`：快速脚本，生成 NSIS 安装器（64-bit）
- `npm run build:portable`：生成 portable 单文件 EXE（方便分发，但首次运行需解压，启动较慢）
- `npm run build:dir`：生成解包目录（`win-unpacked`），适合现场演示，启动最快。

## 快速打包命令（示例）
在项目根目录（含 `package.json`）下运行：
```bash
npm ci
npm run build:win  # 生成 NSIS 安装器
npm run build:portable  # 生成 portable 单文件（便于拷贝）
npm run build:dir  # 生成 win-unpacked 解包目录，运行更快（推荐演示）
```

构建完成后，产物将放在 `release/` 目录下（`package.json` 中 `directories.output` 指定）。

## 演示场景建议
- 如果只是演示：**不要**使用 `portable`（单文件 exe），因为它在首次运行时会自解压到临时目录，导致启动变慢并增大延迟。推荐使用 `win-unpacked`（`npm run build:dir`）或先通过 `NSIS` 安装后运行（`build:win`）。
- 运行 `win-unpacked` 下的 exe 更快，且无需安装。复制目录后直接运行 exe 以确保演示体验流畅。

## 常见问题与提示
- 如果需要 32-bit：`electron-builder --win --ia32` 或修改脚本。
- 如果出现 `nsis` / `makensis` missing 错误：在 Windows 下 electron-builder 通常会自动下载安装，但在一些 Linux/WSL 环境需要安装 `wine` / `makensis` 等依赖。
- 推荐在 Windows 上构建，避免 cross-platform 构建问题，或使用 CI（Windows runner）构建并发布二进制文件。

## 可选增强（如果你愿意我来实现）
- 添加自定义图标：`build/icons/win/icon.ico`，并在 `package.json` `build` 中添加 `icon` 字段。
- 在 `package.json` 中添加 `nsis` 配置（是否创建桌面快捷方式、one-click 等）。
- 添加一个 `build:demo` 脚本，用于快速打包解包目录并打包成一个 zip，方便拷贝演示目录。
- 在 CI（GitHub Actions）配置自动构建并 attach artifacts（releases）。

如果你想要我现在立刻添加 `icon` 或 `nsis` 的配置或设置 CI，请告诉我你的偏好（例如：是否需要 desktop shortcut，是否需要管理员安装，是否要 32-bit 支持），我可以继续实现并提交改动。
