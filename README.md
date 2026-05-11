# AI Tagger for Zotero / Zotero AI Tagger 插件

![AI Tagger logo](addon/content/icons/logo.svg)

## 中文说明

### 项目简介

这是一个 Zotero 7 原生插件：基于文献元信息调用 LLM 自动建议并应用标签，支持批量处理、并发控制与多 Provider 配置。

### 当前功能（MVP）

- 右键菜单批量触发：`AI 智能标签建议（批量）`
- 支持 `OpenAI / Azure OpenAI / OpenAI-compatible`
- 设置页可直接测试 Provider 连接，避免批量运行后才发现配置错误
- 标签策略：
  - 仅已有标签
  - 允许新标签（新标签默认需人工确认）
  - 自定义标签列表（用户输入，逗号分隔，AI 仅从列表中选择）
- 应用策略：
  - 直接写入
  - 先预览后写入
- 队列处理：可配置并发、请求间隔、失败重试
- 文献上下文：默认使用元数据；可选择附加 Zotero 已索引的 PDF / 网页快照正文片段
- 提示词设置：全局 `System Prompt` / `User Prompt`（基础版，不支持模板变量）
- 复古未来主义 SVG logo 已作为插件图标与设置页图标使用
- 中英文界面（zh-CN / en-US）

### 如何快速拿到可测试 XPI

1. 安装依赖：

```bash
npm install
```

2. 生成构建产物并复制 xpi 到可见目录：

```bash
npm run build:xpi
```

3. 测试安装包位置：

- 推荐直接用：`build/*.xpi`
- 原始构建目录：`.scaffold/build/*.xpi`

当前默认文件名示例：`build/ai-tagger.xpi`

### Zotero 安装方式

1. 打开 Zotero
2. `Tools -> Plugins`
3. 右上角齿轮 -> `Install Plugin From File...`
4. 选择上一步生成的 `.xpi`

### 使用说明

1. 在 `Edit -> Preferences -> AI Tagger` 配置 API 参数
2. 点击 `测试连接`，确认 Provider、模型和 API Key 可用
3. 如需更高质量的主题识别，可开启“包含已索引附件正文”并设置最大字符数
4. 在文献列表选中一篇或多篇条目
5. 右键 -> `AI 智能标签建议（批量）`
6. 查看进度窗口，按策略自动写入或确认后写入

### 关键配置项

- Provider：`openai | azure | compatible`
- API：
  - OpenAI/compatible 使用 `Base URL + API Key + Model`
  - Azure 使用 `Endpoint + Deployment + API Version + API Key`
- 标签策略可选 `custom_list`，并在设置页用英文逗号填写标签列表
- 自定义标签列表同时支持英文逗号、中文逗号、分号和换行
- 附件正文开关默认关闭；开启后会把 Zotero 已索引文本片段发送给所选 Provider
- 队列默认：并发 `3`，间隔 `800ms`，重试 `3`

### 开发命令

```bash
npm start        # 开发模式（热重载）
npm run build    # 生产构建
npm run build:xpi
npm test         # 本地纯逻辑单元测试
npm run test:zotero # Zotero 集成测试（需要本机 Zotero 测试环境）
npm run lint:check
```

### 已知限制

- Zotero 集成测试依赖本地 Zotero 可执行路径（需在 `.env` 配置）
- 当前仅实现 Chat API 路线；Responses API 预留后续版本

---

## English

### Overview

This is a native Zotero 7 plugin that suggests and applies tags with LLMs from item metadata, with batch processing, queue controls, and multi-provider support.

### MVP Features

- Batch trigger from item right-click menu
- Supports `OpenAI / Azure OpenAI / OpenAI-compatible`
- Provider connection test from the settings pane
- Tag policy:
  - existing tags only
  - allow new tags (new tags require confirmation by default)
  - custom tag list only (comma-separated user input)
- Apply mode:
  - auto apply
  - preview then apply
- Queue controls: concurrency, request interval, retries
- Document context: metadata by default, with optional Zotero-indexed PDF/snapshot text excerpts
- Prompt settings: global `System Prompt` and `User Prompt` (basic mode, no template variables)
- Retro-futurist SVG logo used for the plugin and preferences pane
- Bilingual UI: zh-CN / en-US

### Build a testable XPI quickly

1. Install dependencies:

```bash
npm install
```

2. Build and copy XPI to a visible directory:

```bash
npm run build:xpi
```

3. XPI locations:

- Preferred: `build/*.xpi`
- Original scaffold output: `.scaffold/build/*.xpi`

Current default output example: `build/ai-tagger.xpi`

### Install in Zotero

1. Open Zotero
2. `Tools -> Plugins`
3. Gear icon -> `Install Plugin From File...`
4. Select the generated `.xpi`

### Usage

1. Configure API settings in `Edit -> Preferences -> AI Tagger`
2. Use `Test Connection` to verify provider, model, and API key settings
3. Optionally enable indexed attachment text for richer topic detection
4. Select one or more items in Zotero library
5. Right click -> run batch tag suggestion
6. Monitor progress and apply results according to your mode

### Core settings

- Provider: `openai | azure | compatible`
- API options:
  - OpenAI/compatible: `Base URL + API Key + Model`
  - Azure: `Endpoint + Deployment + API Version + API Key`
- Tag policy `custom_list` uses a comma-separated tag list from preferences
- Custom tag lists accept English commas, Chinese commas, semicolons, and line breaks
- Attachment text is disabled by default; enabling it sends Zotero-indexed text excerpts to the selected provider
- Queue defaults: concurrency `3`, interval `800ms`, retries `3`

### Dev commands

```bash
npm start
npm run build
npm run build:xpi
npm test
npm run test:zotero
npm run lint:check
```

### Known limitations

- Zotero integration tests require a local Zotero binary path in `.env`
- Chat API flow is implemented in MVP; Responses API is planned for later
