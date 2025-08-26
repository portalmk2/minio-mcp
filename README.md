# 🗄️ MinIO MCP Server

[![npm version](https://badge.fury.io/js/@pickstar-2002/minio-mcp.svg)](https://badge.fury.io/js/@pickstar-2002/minio-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> 🚀 一个功能强大的 MinIO 对象存储 MCP (Model Context Protocol) 服务器，为 AI 助手提供完整的对象存储操作能力。

## ✨ 特性

- 🔗 **完整的 MinIO 集成** - 支持所有主要的对象存储操作
- 📁 **存储桶管理** - 创建、删除、列出存储桶
- 📄 **对象操作** - 上传、下载、删除、复制文件
- 🔍 **高级功能** - 预签名 URL、批量操作、存储统计
- 🛡️ **安全策略** - 存储桶策略管理
- 🎯 **类型安全** - 完整的 TypeScript 支持
- ⚡ **高性能** - 异步操作，支持大文件处理

## 📦 安装

### 作为 MCP 服务器使用（推荐）

在您的 AI 助手配置中添加以下配置：

```json
{
  "mcpServers": {
    "minio-mcp": {
      "command": "npx",
      "args": [
        "@pickstar-2002/minio-mcp@latest",
        "--endpoint=your-minio-endpoint",
        "--access-key=your-access-key", 
        "--secret-key=your-secret-key",
        "--use-ssl=true"
      ]
    }
  }
}
```

### 本地开发安装

```bash
# 克隆仓库
git clone https://github.com/pickstar-2002/minio-mcp.git
cd minio-mcp

# 安装依赖
npm install

# 构建项目
npm run build

# 启动服务
npm start
```

## 🚀 快速开始

### 1. 基本配置

```bash
npx @pickstar-2002/minio-mcp@latest \
  --endpoint=api.minio.pickstar.site \
  --access-key=your-access-key \
  --secret-key=your-secret-key \
  --use-ssl=true
```

### 2. 在 Cursor 中使用

在 `.cursorrules` 或 `cursor-settings.json` 中添加：

```json
{
  "mcp": {
    "servers": {
      "minio-mcp": {
        "command": "npx",
        "args": ["@pickstar-2002/minio-mcp@latest", "--endpoint=your-endpoint", "--access-key=key", "--secret-key=secret"]
      }
    }
  }
}
```

### 3. 在 Claude Desktop 中使用

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "minio-mcp": {
      "command": "npx",
      "args": ["@pickstar-2002/minio-mcp@latest", "--endpoint=your-endpoint", "--access-key=key", "--secret-key=secret", "--use-ssl=true"]
    }
  }
}
```

## 🛠️ API 功能

### 连接管理
- `connect_minio` - 连接到 MinIO 服务器

### 存储桶操作
- `list_buckets` - 列出所有存储桶
- `create_bucket` - 创建存储桶
- `delete_bucket` - 删除存储桶
- `bucket_exists` - 检查存储桶是否存在

### 对象操作
- `list_objects` - 列出存储桶中的对象
- `upload_file` - 上传文件到存储桶
- `download_file` - 从存储桶下载文件
- `delete_object` - 删除存储桶中的对象
- `delete_objects` - 批量删除对象
- `copy_object` - 复制对象
- `get_object_info` - 获取对象信息

### 高级功能
- `generate_presigned_url` - 生成预签名 URL
- `get_storage_stats` - 获取存储统计信息
- `upload_files` - 批量上传文件
- `download_files` - 批量下载文件

### 策略管理
- `set_bucket_policy` - 设置存储桶策略
- `get_bucket_policy` - 获取存储桶策略
- `delete_bucket_policy` - 删除存储桶策略

## 📝 使用示例

### 基本文件操作

```typescript
// 上传文件
await uploadFile({
  bucketName: "my-bucket",
  objectName: "documents/file.pdf",
  filePath: "/local/path/to/file.pdf"
});

// 下载文件
await downloadFile({
  bucketName: "my-bucket", 
  objectName: "documents/file.pdf",
  filePath: "/local/download/path/file.pdf"
});

// 生成预签名 URL
const url = await generatePresignedUrl({
  bucketName: "my-bucket",
  objectName: "documents/file.pdf",
  method: "GET",
  expires: 3600 // 1小时
});
```

### 批量操作

```typescript
// 批量上传
await uploadFiles({
  bucketName: "my-bucket",
  files: [
    { localPath: "/path/file1.jpg", objectName: "images/file1.jpg" },
    { localPath: "/path/file2.jpg", objectName: "images/file2.jpg" }
  ]
});

// 批量删除
await deleteObjects({
  bucketName: "my-bucket",
  objectNames: ["images/file1.jpg", "images/file2.jpg"]
});
```

## ⚙️ 配置选项

| 参数 | 描述 | 必需 | 默认值 |
|------|------|------|--------|
| `--endpoint` | MinIO 服务器地址 | ✅ | - |
| `--access-key` | 访问密钥 | ✅ | - |
| `--secret-key` | 秘密密钥 | ✅ | - |
| `--use-ssl` | 是否使用 SSL | ❌ | `false` |
| `--port` | 服务器端口 | ❌ | `9000` |
| `--region` | 区域设置 | ❌ | `us-east-1` |

## 🔧 开发

### 项目结构

```
minio-mcp/
├── src/
│   ├── index.ts          # 主入口文件
│   ├── tools/            # MCP 工具定义
│   └── types/            # TypeScript 类型定义
├── build/                # 构建输出
├── package.json
└── README.md
```

### 构建命令

```bash
# 开发模式
npm run dev

# 构建项目
npm run build

# 运行测试
npm test

# 代码检查
npm run lint

# 格式化代码
npm run format
```

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持

如果您遇到问题或有任何疑问，请：

- 📝 [提交 Issue](https://github.com/pickstar-2002/minio-mcp/issues)
- 💬 参与 [Discussions](https://github.com/pickstar-2002/minio-mcp/discussions)
- 📧 发送邮件至开发者

## 🙏 致谢

- [MinIO](https://min.io/) - 高性能对象存储
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI 助手协议标准
- 所有贡献者和用户的支持

---

**微信: pickstar_loveXX**

⭐ 如果这个项目对您有帮助，请给我们一个 Star！