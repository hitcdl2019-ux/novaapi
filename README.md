# NovaAPI

下一代 LLM 网关与 AI 资产管理系统，基于 [New API](https://github.com/Calcium-Ion/new-api) 二次开发。

## 简介

NovaAPI 是一个统一的 AI API 代理网关，将 40+ 上游 AI 服务提供商聚合在 OpenAI 兼容接口之后，提供用户管理、计费结算、限流控制和管理后台等完整功能。

**核心能力：**

- 统一接口：所有上游模型通过 OpenAI 兼容格式访问
- 格式转换：OpenAI / Claude Messages / Google Gemini 互转
- 智能路由：渠道加权随机、失败自动重试、用户级限流
- 计费结算：预扣额度 → 实际结算 → 日志记录，支持订阅与钱包
- 多语言 UI：简体中文、繁体中文、英语、法语、日语

## 支持的上游提供商

OpenAI / Claude / Gemini / Azure / AWS Bedrock / DeepSeek / Qwen / 阿里 / 百度 / Moonshot / Mistral / Cohere / Jina / Ollama / SiliconFlow / xAI / Dify / Codex / 360AI / 百川 / 讯飞 / 智谱 / 腾讯 / 火山引擎 / MiniMax / StepFun / Cloudflare / Perplexity / Replicate / Vertex / OpenRouter / Coze / 以及更多...

## 快速开始

### Docker Compose（推荐）

```bash
git clone https://github.com/hitcdl2019-ux/novaapi.git
cd novaapi
# 编辑 docker-compose.yml 配置
docker-compose up -d
```

### Docker 命令

```bash
# SQLite（默认）
docker run --name novaapi -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest

# MySQL
docker run --name novaapi -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/novaapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

部署完成后访问 `http://localhost:3000` 即可使用。

## 技术栈

| 层 | 技术 |
|------|------|
| 后端 | Go 1.25 + Gin + GORM |
| 前端 | React 19 + TypeScript + Rsbuild + Tailwind CSS v4 |
| 数据库 | SQLite / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6 |
| 缓存 | Redis + 内存缓存 |
| 认证 | JWT + WebAuthn/Passkeys + OAuth |

## 项目结构

```
router/          — HTTP 路由分发
controller/      — 请求处理器
service/         — 业务逻辑层
model/           — 数据模型与数据库访问（GORM）
relay/           — AI API 代理转发引擎（核心）
  relay/channel/ — 40+ 上游提供商适配器
middleware/       — 认证 / 限流 / CORS / 日志
setting/          — 配置管理
common/           — 共享工具（JSON、加密、Redis、限流）
dto/              — 数据传输对象
constant/         — 常量定义
i18n/             — 国际化（en / zh）
web/default/      — 默认前端主题（React 19 + Rsbuild）
web/classic/      — 经典前端主题（React 18 + Vite）
```

## 请求处理流程

```
用户请求（OpenAI 格式）
  → Middleware 认证（Token / Auth）
  → Distributor 选渠道（负载均衡 / 亲和性）
  → Adaptor 格式转换（OpenAI → 上游格式）
  → HTTP 转发上游 API
  → DoResponse 解析返回 + 计费结算
  → 返回用户（OpenAI 兼容格式）
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SESSION_SECRET` | 会话密钥（多机部署必须设置） | - |
| `CRYPTO_SECRET` | 加密密钥（共享 Redis 必须设置） | - |
| `SQL_DSN` | 数据库连接字符串 | SQLite |
| `REDIS_CONN_STRING` | Redis 连接字符串 | - |
| `STREAMING_TIMEOUT` | 流式超时（秒） | 300 |
| `GIN_MODE` | 运行模式（debug/release） | release |

完整配置见 [环境变量文档](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables)。

## 开发

### 后端

```bash
go run main.go
```

### 前端

```bash
cd web/default
bun install
bun run dev    # 开发服务器 :5173，proxy /api → 后端 :3000
bun run build  # 生产构建，go:embed 打包为单二进制
```

## 许可证

本项目基于 [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE) 开源。

上游项目：[New API](https://github.com/Calcium-Ion/new-api)（基于 [One API](https://github.com/songquanpeng/one-api)，MIT License）。