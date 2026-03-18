/**
 * did:wba 部署管理器
 * 
 * 提供多种部署方式：
 * 1. 手动部署（生成文件和说明）
 * 2. 本地文件部署（直接写入文件系统）
 * 3. RESTful API 部署（可插拔接口）
 * 4. SSH/SFTP 部署（可插拔接口）
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { didWbaHandler } from './did-wba.js';

/**
 * 部署结果
 */
export class DeploymentResult {
  constructor(success, did, didJsonUrl, message, details = {}) {
    this.success = success;
    this.did = did;
    this.didJsonUrl = didJsonUrl;
    this.message = message;
    this.details = details;
  }

  toString() {
    return `
========================================
DID 部署${this.success ? '成功' : '失败'}
========================================
DID: ${this.did}
部署 URL: ${this.didJsonUrl}
说明：${this.message}

${this.details.instructions || ''}
========================================
    `.trim();
  }
}

/**
 * 部署配置
 */
export class DeploymentConfig {
  constructor(options = {}) {
    this.method = options.method || 'manual'; // manual, local, api, ssh
    this.outputDir = options.outputDir || './did-output';
    this.apiEndpoint = options.apiEndpoint || null;
    this.apiToken = options.apiToken || null;
    this.sshHost = options.sshHost || null;
    this.sshUser = options.sshUser || null;
    this.sshPort = options.sshPort || 22;
    this.sshKey = options.sshKey || null;
    this.webRoot = options.webRoot || '/var/www/html';
  }
}

/**
 * 部署器接口（抽象类）
 */
export class Deployer {
  constructor(config) {
    if (this.constructor === Deployer) {
      throw new Error('Deployer is an abstract class');
    }
    this.config = config;
  }

  /**
   * 部署 DID 文档
   * @param {string} did - DID 字符串
   * @param {Object} didDocument - DID 文档对象
   * @returns {Promise<DeploymentResult>}
   */
  async deploy(did, didDocument) {
    throw new Error('Method "deploy" must be implemented');
  }

  /**
   * 验证部署
   * @param {string} did - DID 字符串
   * @returns {Promise<boolean>}
   */
  async verify(did) {
    throw new Error('Method "verify" must be implemented');
  }
}

/**
 * 手动部署器 - 生成文件和说明
 */
export class ManualDeployer extends Deployer {
  async deploy(did, didDocument) {
    const { outputDir } = this.config;
    
    // 确保输出目录存在
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // 生成 did.json
    const didJsonPath = join(outputDir, 'did.json');
    writeFileSync(didJsonPath, JSON.stringify(didDocument, null, 2));

    // 生成私钥文件（警告：需要妥善保管）
    const privateKeyPath = join(outputDir, 'private-key.txt');
    // 私钥从外部传入，这里只生成说明

    // 生成部署说明
    const instructionsPath = join(outputDir, 'deployment-instructions.txt');
    const instructions = this.generateInstructions(did, didDocument);
    writeFileSync(instructionsPath, instructions);

    // 生成部署信息 JSON
    const infoPath = join(outputDir, 'deployment-info.json');
    const info = didWbaHandler.getDeploymentInstructions(did);
    writeFileSync(infoPath, JSON.stringify(info, null, 2));

    return new DeploymentResult(
      true,
      did,
      didWbaHandler.getDidJsonUrl(did),
      '已生成部署文件，请按照说明手动部署',
      {
        outputDir,
        files: ['did.json', 'private-key.txt', 'deployment-instructions.txt', 'deployment-info.json'],
        instructions: this.generateInstructions(did, didDocument)
      }
    );
  }

  async verify(did) {
    // 手动部署无法自动验证，返回说明
    return {
      verified: false,
      message: '手动部署需要手动验证，请使用 curl 访问 did.json URL',
      instructions: `curl -I ${didWbaHandler.getDidJsonUrl(did)}`
    };
  }

  generateInstructions(did, didDocument) {
    const info = didWbaHandler.getDeploymentInstructions(did);
    
    return `
========================================
DID 部署说明
========================================

DID: ${did}
部署 URL: ${info.didJsonUrl}

----------------------------------------
部署步骤:
----------------------------------------

1. 将生成的 did.json 文件上传到服务器
   目标位置：${info.deploymentPath}
   
   完整 URL: ${info.didJsonUrl}

2. 部署方式（选择一种）:

   A) 使用 SCP:
      scp did.json user@${info.domain}:${info.deploymentPath}
   
   B) 使用 FTP/SFTP:
      使用 FileZilla 等工具上传到对应路径
   
   C) 直接服务器操作:
      ssh user@${info.domain}
      sudo cp did.json ${info.deploymentPath}

3. 设置正确的文件权限:
   chmod 644 ${info.deploymentPath}

4. 确保 Web 服务器配置正确:
   
   Nginx 示例:
   location /.well-known/did.json {
       alias /path/to/did.json;
       add_header Content-Type application/json;
   }

5. 验证部署:
   curl -I ${info.didJsonUrl}
   curl ${info.didJsonUrl} | jq

----------------------------------------
安全警告:
----------------------------------------
- 私钥文件 (private-key.txt) 必须妥善保管
- 不要将私钥上传到服务器
- 建议使用加密存储（如 VeraCrypt）
- 定期轮换密钥

========================================
`.trim();
  }

  async verify(did) {
    return {
      verified: false,
      message: '手动部署需要手动验证',
      instructions: `
请使用以下命令验证部署:

1. 检查 HTTPS 访问:
   curl -I ${didWbaHandler.getDidJsonUrl(did)}

2. 检查内容:
   curl ${didWbaHandler.getDidJsonUrl(did)} | jq

3. 验证 DID 文档:
   - 确保 id 字段与 DID 匹配
   - 确保 @context 包含必要的上下文
   - 确保 verificationMethod 存在
`.trim()
    };
  }
}

/**
 * 本地文件部署器 - 直接写入本地文件系统
 */
export class LocalFileDeployer extends Deployer {
  async deploy(did, didDocument) {
    const { outputDir, webRoot } = this.config;
    const { domain, path } = didWbaHandler.parseDID(did);
    
    // 计算部署路径
    let deployPath;
    if (path) {
      // did:wba:example.com:user:alice → /user/alice/did.json
      deployPath = join(webRoot, path.replace(/:/g, '/'), 'did.json');
    } else {
      // did:wba:example.com → /.well-known/did.json
      deployPath = join(webRoot, '.well-known', 'did.json');
    }

    // 确保目录存在
    const deployDir = dirname(deployPath);
    if (!existsSync(deployDir)) {
      mkdirSync(deployDir, { recursive: true });
    }

    // 写入 did.json
    writeFileSync(deployPath, JSON.stringify(didDocument, null, 2));

    return new DeploymentResult(
      true,
      did,
      didWbaHandler.getDidJsonUrl(did),
      `已部署到本地文件系统：${deployPath}`,
      {
        deployPath,
        url: didWbaHandler.getDidJsonUrl(did)
      }
    );
  }

  async verify(did) {
    // 本地部署可以直接读取验证
    return {
      verified: true,
      message: '本地部署已验证',
      details: {
        method: 'local-file'
      }
    };
  }
}

/**
 * RESTful API 部署器接口（抽象类）
 * 
 * 用于与身份服务器集成
 */
export class ApiDeployer extends Deployer {
  /**
   * 部署 DID 文档
   * @param {string} did - DID 字符串
   * @param {Object} didDocument - DID 文档对象
   * @param {string} privateKey - 私钥（用于签名）
   * @returns {Promise<DeploymentResult>}
   */
  async deploy(did, didDocument, privateKey) {
    throw new Error('ApiDeployer must be extended to implement deploy()');
  }

  /**
   * 验证部署
   * @param {string} did - DID 字符串
   * @returns {Promise<Object>} 验证结果
   */
  async verify(did) {
    throw new Error('ApiDeployer must be extended to implement verify()');
  }

  /**
   * 更新 DID 文档
   * @param {string} did - DID 字符串
   * @param {Object} didDocument - 新的 DID 文档
   * @param {string} privateKey - 私钥（用于签名）
   * @returns {Promise<DeploymentResult>}
   */
  async update(did, didDocument, privateKey) {
    throw new Error('ApiDeployer must be extended to implement update()');
  }

  /**
   * 撤销 DID
   * @param {string} did - DID 字符串
   * @param {string} privateKey - 私钥（用于签名）
   * @returns {Promise<DeploymentResult>}
   */
  async revoke(did, privateKey) {
    throw new Error('ApiDeployer must be extended to implement revoke()');
  }
}

/**
 * SSH/SFTP 部署器接口（抽象类）
 * 
 * 用于通过 SSH/SFTP 部署到远程服务器
 */
export class SshDeployer extends Deployer {
  /**
   * 部署 DID 文档
   * @param {string} did - DID 字符串
   * @param {Object} didDocument - DID 文档对象
   * @returns {Promise<DeploymentResult>}
   */
  async deploy(did, didDocument) {
    throw new Error('SshDeployer must be extended to implement deploy()');
  }

  /**
   * 验证部署
   * @param {string} did - DID 字符串
   * @returns {Promise<Object>} 验证结果
   */
  async verify(did) {
    throw new Error('SshDeployer must be extended to implement verify()');
  }
}

/**
 * 部署管理器
 */
export class DeploymentManager {
  constructor(config = {}) {
    this.config = new DeploymentConfig(config);
    this.deployers = {
      manual: new ManualDeployer(this.config),
      local: new LocalFileDeployer(this.config),
      api: null, // 需要外部注册
      ssh: null  // 需要外部注册
    };
  }

  /**
   * 注册自定义部署器
   * @param {string} type - 部署器类型
   * @param {Deployer} deployer - 部署器实例
   */
  registerDeployer(type, deployer) {
    if (!(deployer instanceof Deployer)) {
      throw new Error('Deployer must extend Deployer class');
    }
    this.deployers[type] = deployer;
  }

  /**
   * 获取部署器
   * @param {string} type - 部署器类型
   * @returns {Deployer}
   */
  getDeployer(type) {
    const deployer = this.deployers[type];
    if (!deployer) {
      throw new Error(`Deployer type "${type}" not found. Available: ${Object.keys(this.deployers).join(', ')}`);
    }
    return deployer;
  }

  /**
   * 部署 DID 文档
   * @param {string} did - DID 字符串
   * @param {Object} didDocument - DID 文档对象
   * @param {string} method - 部署方法（manual, local, api, ssh）
   * @returns {Promise<DeploymentResult>}
   */
  async deploy(did, didDocument, method = 'manual') {
    const deployer = this.getDeployer(method);
    return await deployer.deploy(did, didDocument);
  }

  /**
   * 验证部署
   * @param {string} did - DID 字符串
   * @param {string} method - 部署方法
   * @returns {Promise<Object>}
   */
  async verify(did, method = 'manual') {
    const deployer = this.getDeployer(method);
    return await deployer.verify(did);
  }
}

// 创建全局部署管理器实例
export const deploymentManager = new DeploymentManager();
