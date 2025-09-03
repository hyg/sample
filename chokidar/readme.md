# Nextcloud 同步工具架构设计说明

## 架构设计理念

根据职责分离、信息隐藏和接口统一原则，我们采用了清晰的架构设计：

1. **状态封装**：`filemap` 状态由 `main.js` 统一维护，不暴露给其他模块
2. **模块职责分离**：
   - `nextcloud-webdav.js`：专门处理 WebDAV 相关的文件操作
   - `nextcloud-http.js`：专门处理 HTTP API 相关的共享操作
   - `main.js`：负责业务逻辑协调、状态管理和文件映射创建
3. **接口统一**：通过统一的对象调用模块功能，便于切换和维护
4. **返回值分离**：不同模块返回不同的信息，满足不同需求
5. **路径配置化**：使用 `.env` 中的 `TAB_DRAFT_FOLDER` 配置服务器文件路径

## 架构升级内容

1. **语法升级**：将所有的 `import` 语法改为 `require` 语法，以支持 CommonJS 模块系统。
2. **模块拆分**：将原有功能拆分为三个独立的职责区域：
   - 协议模块（`nextcloud-webdav.js`、`nextcloud-http.js`）：处理具体协议操作
   - 业务逻辑模块（`main.js`）：处理文件映射、状态管理和业务流程
3. **状态封装**：`filemap` 状态完全由 `main.js` 维护，其他模块只需接收必要的参数。
4. **接口统一**：通过统一的 `nextcloud` 对象调用模块功能：
   - `nextcloud.initialize(localPath)`
   - `nextcloud.upload(localPath)`
   - `nextcloud.remove(localPath)`
5. **职责分离**：将 `makefilemap` 等业务逻辑函数移到 `main.js` 中。
6. **返回值分离**：
   - `webdav.initialize(localPath)`：返回远程文件路径
   - `http.initialize(localPath, remotePath)`：返回共享信息 `{url, shareId}`
7. **路径配置化**：所有服务器文件路径都使用 `.env` 中的 `TAB_DRAFT_FOLDER` 配置
8. **依赖更新**：更新 `package.json` 文件，将模块类型从 `module` 改为 `commonjs`。

## 文件说明

- `nextcloud-webdav.js`：WebDAV 相关功能模块（文件操作）
- `nextcloud-http.js`：HTTP API 相关功能模块（共享操作）
- `main.js`：主程序文件，负责业务逻辑协调、状态管理和文件映射创建

## 接口函数说明

### 统一接口调用
在 `main.js` 中，通过统一的 `nextcloud` 对象调用模块功能：

```javascript
// 根据需要选择使用 webdav 或 http 模块
const nextcloud = require('./nextcloud-webdav.js');
// const nextcloud = require('./nextcloud-http.js');

// 统一的调用语法
nextcloud.initialize(localPath);
nextcloud.upload(localPath);
nextcloud.remove(localPath);
```

### WebDAV 模块接口函数（纯文件操作）
1. **initialize(localPath)**：在服务器的 draft 文件夹创建同名文件，上传本地文件内容
   - **返回值**：远程文件路径 (例如: `/draft/filename.md`)
   - **说明**：只负责文件操作，不涉及共享

2. **upload(localPath)**：上传本地文件内容到服务器同名文件
   - **返回值**：操作成功与否 (true/false)

3. **remove(localPath)**：删除服务器同名文件
   - **返回值**：操作成功与否 (true/false)

### HTTP 模块接口函数（纯共享操作）
1. **initialize(localPath, remotePath)**：设置文件的只读共享
   - **参数**：本地文件路径, 远程文件路径
   - **返回值**：共享信息 `{ url: "共享链接", shareId: "共享ID" }`
   - **说明**：返回共享URL供合作伙伴使用

2. **upload(localPath)**：上传本地文件内容到服务器同名文件
   - **返回值**：操作成功与否 (true/false)

3. **remove(localPath)**：删除服务器同名文件
   - **返回值**：操作成功与否 (true/false)

4. **unshare(shareId)**：取消文件的共享链接（通过 shareId 操作）
   - **返回值**：操作成功与否 (true/false)

## 状态管理策略

### 最佳实践：状态封装
- **filemap 封装**：`filemap` 状态完全由 `main.js` 维护，不暴露给其他模块
- **参数传递**：模块间通过简单的参数传递进行通信
- **优势**：
  1. **信息隐藏**：模块不需要知道 `filemap` 的内部结构
  2. **降低耦合**：模块间依赖关系简单清晰
  3. **易于维护**：状态管理集中在一个地方
  4. **提高安全性**：避免模块意外修改状态
  5. **接口统一**：通过统一的对象调用，便于模块切换
  6. **职责清晰**：每个模块只关注自己的核心职责
  7. **返回值分离**：不同模块返回不同信息，满足不同需求
  8. **路径配置化**：服务器文件路径可配置，便于部署

## 工作流程

1. **文件初始化**：
   - `main.js` 调用 `webdav.initialize(localPath)` 创建并上传文件
   - `main.js` 获取返回的远程文件路径
   - `main.js` 调用 `http.initialize(localPath, remotePath)` 创建共享
   - `main.js` 获取返回的共享信息 `{url, shareId}` 并维护到 `filemap` 中

2. **文件操作**：
   - 使用 `webdav.upload(localPath)` 上传文件内容
   - 使用 `webdav.remove(localPath)` 删除文件

3. **共享操作**：
   - 使用 `http.initialize(localPath, remotePath)` 创建共享
   - 使用 `http.unshare(shareId)` 取消共享

## 配置说明

在 `.env` 文件中配置以下参数：

```env
TAB_URL="https://your-nextcloud-server.com/remote.php/dav/files/username"
TAB_USER="your-username"
TAB_PASS="your-password"
TAB_DRAFT_FOLDER="draft"  # 服务器文件夹名称
LOCAL_DIR="d:\\src"
```

所有服务器文件操作都会在文件名前加上 `TAB_DRAFT_FOLDER` 配置的路径。

## 使用方式

```bash
# 运行主程序
node main.js
```

## 功能特性

1. 创建文件映射
2. 上传文件到 Nextcloud
3. 创建只读共享链接
4. 监控本地文件变化并同步
5. 优雅退出处理（删除共享和文件，生成日小结）