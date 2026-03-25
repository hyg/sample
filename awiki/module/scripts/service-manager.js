/**
 * service_manager.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/service_manager.py
 * 分析报告：doc/scripts/service_manager.py/py.md
 * 蒸馏数据：doc/scripts/service_manager.py/py.json
 *
 * 跨平台服务管理器：为 ws_listener 后台进程安装/卸载/启动/停止/状态
 * 在 ws_listener.py CLI 和 OS 特定服务管理（launchd / systemd / Task Scheduler）之间提供抽象层
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const { SDKConfig } = require('./utils/config.js');
const { getLogDir: getLogDirFromLogging, findLatestLogFile, getLogFilePath } = require('./utils/logging.js');

// 项目根目录
const _PROJECT_ROOT = path.resolve(__dirname, '..');

// 服务标签
const _SERVICE_LABEL = 'com.awiki.ws-listener';

/**
 * 获取应用日志文件路径
 *
 * @param {SDKConfig} config - SDK 配置实例
 * @returns {string} 日志文件路径
 */
function _applicationLogPath(config = null) {
  const resolvedConfig = config || SDKConfig.load();
  const logDir = getLogDirFromLogging(resolvedConfig);
  const latestLog = findLatestLogFile(logDir);
  if (latestLog) {
    return latestLog;
  }
  return getLogFilePath(logDir);
}

/**
 * ServiceManager 抽象基类
 * 平台特定服务管理器的基类
 */
class ServiceManager {
  constructor() {
    if (new.target === ServiceManager) {
      throw new Error('ServiceManager 是抽象基类，不能直接实例化');
    }
  }

  /**
   * 安装并启动后台服务
   * @param {string} credential - 凭证名称
   * @param {string|null} config_path - 配置文件路径
   * @param {string|null} mode - 模式
   */
  install(credential, config_path, mode) {
    throw new Error('Method "install" must be implemented');
  }

  /**
   * 停止并移除后台服务
   */
  uninstall() {
    throw new Error('Method "uninstall" must be implemented');
  }

  /**
   * 启动已安装的服务
   */
  start() {
    throw new Error('Method "start" must be implemented');
  }

  /**
   * 停止运行中的服务
   */
  stop() {
    throw new Error('Method "stop" must be implemented');
  }

  /**
   * 返回服务状态
   * @returns {Object} 服务状态
   */
  status() {
    throw new Error('Method "status" must be implemented');
  }

  /**
   * 返回平台特定日志目录
   * @returns {string} 日志目录路径
   */
  logDir() {
    throw new Error('Method "logDir" must be implemented');
  }

  /**
   * 检查服务是否已安装
   * @returns {boolean} 是否已安装
   */
  isInstalled() {
    throw new Error('Method "isInstalled" must be implemented');
  }

  /**
   * 返回当前用户的 PATH 用于服务环境
   * @returns {string} PATH 环境变量
   */
  _userPath() {
    return process.env.PATH || '';
  }

  /**
   * 查找最佳 Python 解释器路径
   * @returns {string} Python 解释器路径
   */
  findPython() {
    let venvPython;
    if (process.platform === 'win32') {
      venvPython = path.join(_PROJECT_ROOT, '.venv', 'Scripts', 'python.exe');
    } else {
      venvPython = path.join(_PROJECT_ROOT, '.venv', 'bin', 'python');
    }

    if (fs.existsSync(venvPython)) {
      return venvPython;
    }
    return process.execPath;
  }

  /**
   * 构建 ws_listener.py run 的命令行参数
   *
   * @param {string} credential - 凭证名称
   * @param {string|null} config_path - 配置文件路径
   * @param {string|null} mode - 模式
   * @returns {string[]} 命令行参数数组
   */
  _buildRunArgs(credential, config_path, mode) {
    const pythonPath = this.findPython();
    const scriptPath = path.resolve(_PROJECT_ROOT, 'scripts', 'ws_listener.py');
    const args = [pythonPath, scriptPath, 'run', '--credential', credential];

    if (config_path) {
      args.push('--config', path.resolve(config_path));
    }
    if (mode) {
      args.push('--mode', mode);
    }

    return args;
  }

  /**
   * 创建并返回日志目录
   * @returns {string} 日志目录路径
   */
  _ensureLogDir() {
    const dir = this.logDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
}

// ---------------------------------------------------------------------------
// macOS — launchd
// ---------------------------------------------------------------------------

/**
 * macOS 服务管理器，使用 launchd (LaunchAgent)
 */
class MacOSServiceManager extends ServiceManager {
  constructor() {
    super();
    this.platform = 'macOS';
    this._agentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    this._plistPath = path.join(this._agentsDir, `${_SERVICE_LABEL}.plist`);
  }

  logDir() {
    return path.join(os.homedir(), 'Library', 'Logs', 'awiki-ws-listener');
  }

  isInstalled() {
    return fs.existsSync(this._plistPath);
  }

  /**
   * 安装并启动后台服务
   */
  install(credential, config_path, mode) {
    if (this.isInstalled()) {
      console.log(`Service already installed: ${this._plistPath}`);
      console.log('To reinstall, run first: python scripts/ws_listener.py uninstall');
      return;
    }

    if (!fs.existsSync(this._agentsDir)) {
      fs.mkdirSync(this._agentsDir, { recursive: true });
    }

    const logs = this._ensureLogDir();
    const plistContent = this._generatePlist(credential, config_path, mode, logs);
    fs.writeFileSync(this._plistPath, plistContent, 'utf8');
    console.log(`plist written to: ${this._plistPath}`);

    const result = this._launchctl('load', this._plistPath);
    if (result.status === 0) {
      console.log('Service installed and started');
      console.log(`  Logs: tail -f ${path.join(logs, 'stderr.log')}`);
      console.log(`  App logs: tail -f ${_applicationLogPath()}`);
    } else {
      console.log(`launchctl load failed: ${result.stderr?.trim() || result.error?.message}`);
    }
  }

  /**
   * 停止并移除后台服务
   */
  uninstall() {
    if (!this.isInstalled()) {
      console.log('Service not installed');
      return;
    }

    const result = this._launchctl('unload', this._plistPath);
    if (result.status !== 0) {
      console.log(`launchctl unload warning: ${result.stderr?.trim() || result.error?.message}`);
    }

    fs.unlinkSync(this._plistPath);
    console.log('Service uninstalled');
  }

  /**
   * 启动已安装的服务
   */
  start() {
    if (!this.isInstalled()) {
      console.log('Service not installed, run first: python scripts/ws_listener.py install');
      return;
    }

    const result = this._launchctl('load', this._plistPath);
    if (result.status === 0) {
      console.log('Service started');
    } else {
      console.log(`Start failed: ${result.stderr?.trim() || result.error?.message}`);
    }
  }

  /**
   * 停止运行中的服务
   */
  stop() {
    if (!this.isInstalled()) {
      console.log('Service not installed');
      return;
    }

    const result = this._launchctl('unload', this._plistPath);
    if (result.status === 0) {
      console.log('Service stopped');
    } else {
      console.log(`Stop failed: ${result.stderr?.trim() || result.error?.message}`);
    }
  }

  /**
   * 返回服务状态
   * @returns {Object} 服务状态
   */
  status() {
    const output = {
      platform: 'macOS (launchd)',
      installed: this.isInstalled(),
      service_file: this._plistPath,
      application_log_dir: getLogDirFromLogging(SDKConfig.load()),
      application_log_path: _applicationLogPath()
    };

    if (this.isInstalled()) {
      const result = this._launchctl('list');
      output.running = result.stdout?.includes(_SERVICE_LABEL) || false;

      try {
        const plistText = fs.readFileSync(this._plistPath, 'utf8');
        if (plistText.includes('--mode')) {
          const parts = plistText.split('--mode');
          if (parts.length > 1) {
            const match = parts[1].match(/<string>(\w[\w-]*)<\/string>/);
            if (match) {
              output.mode = match[1];
            }
          }
        }
      } catch (e) {
        // 忽略读取错误
      }

      const stderrLog = path.join(this.logDir(), 'stderr.log');
      if (fs.existsSync(stderrLog)) {
        output.log_size_bytes = fs.statSync(stderrLog).size;
        output.log_path = stderrLog;
      }

      const appLog = _applicationLogPath();
      if (fs.existsSync(appLog)) {
        output.application_log_size_bytes = fs.statSync(appLog).size;
      }
    } else {
      output.running = false;
    }

    return output;
  }

  /**
   * 执行 launchctl 命令
   * @param {...string} args - 命令参数
   * @returns {Object} 执行结果
   */
  _launchctl(...args) {
    try {
      const result = spawnSync('launchctl', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return {
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || ''
      };
    } catch (e) {
      return {
        status: -1,
        stdout: '',
        stderr: e.message,
        error: e
      };
    }
  }

  /**
   * 生成 launchd plist 配置
   */
  _generatePlist(credential, config_path, mode, logs) {
    const runArgs = this._buildRunArgs(credential, config_path, mode);
    const argsXml = runArgs.map(a => `        <string>${a}</string>`).join('\n');
    const userPath = this._userPath();

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${_SERVICE_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        ${argsXml}
    </array>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${userPath}</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>WorkingDirectory</key>
    <string>${_PROJECT_ROOT}</string>

    <key>StandardOutPath</key>
    <string>${path.join(logs, 'stdout.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(logs, 'stderr.log')}</string>
</dict>
</plist>
`;
  }
}

// ---------------------------------------------------------------------------
// Linux — systemd user service
// ---------------------------------------------------------------------------

/**
 * Linux 服务管理器，使用 systemd 用户单元
 */
class LinuxServiceManager extends ServiceManager {
  constructor() {
    super();
    this.platform = 'Linux';
    this._UNIT_NAME = 'awiki-ws-listener.service';

    const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    this._unitDir = path.join(configHome, 'systemd', 'user');
    this._unitPath = path.join(this._unitDir, this._UNIT_NAME);
  }

  logDir() {
    const stateHome = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    return path.join(stateHome, 'awiki-ws-listener', 'logs');
  }

  isInstalled() {
    return fs.existsSync(this._unitPath);
  }

  /**
   * 安装并启动后台服务
   */
  install(credential, config_path, mode) {
    if (this.isInstalled()) {
      console.log(`Service already installed: ${this._unitPath}`);
      console.log('To reinstall, run first: python scripts/ws_listener.py uninstall');
      return;
    }

    if (!fs.existsSync(this._unitDir)) {
      fs.mkdirSync(this._unitDir, { recursive: true });
    }

    const logs = this._ensureLogDir();
    const unitContent = this._generateUnit(credential, config_path, mode, logs);
    fs.writeFileSync(this._unitPath, unitContent, 'utf8');
    console.log(`Unit file written to: ${this._unitPath}`);

    this._systemctl('daemon-reload');
    const result = this._systemctl('enable', '--now', this._UNIT_NAME);
    if (result.status === 0) {
      console.log('Service installed and started');
      console.log(`  Logs: journalctl --user -u ${this._UNIT_NAME} -f`);
      console.log(`  File logs: tail -f ${path.join(logs, 'stderr.log')}`);
      console.log(`  App logs: tail -f ${_applicationLogPath()}`);
      console.log();
      console.log('Hint: For headless servers (SSH-only, no GUI session), run:');
      console.log('  sudo loginctl enable-linger $USER');
      console.log('This allows the user service to start at boot without a login session.');
    } else {
      console.log(`systemctl enable --now failed: ${result.stderr?.trim() || result.error?.message}`);
    }
  }

  /**
   * 停止并移除后台服务
   */
  uninstall() {
    if (!this.isInstalled()) {
      console.log('Service not installed');
      return;
    }

    this._systemctl('disable', '--now', this._UNIT_NAME);
    fs.unlinkSync(this._unitPath);
    this._systemctl('daemon-reload');
    console.log('Service uninstalled');
  }

  /**
   * 启动已安装的服务
   */
  start() {
    if (!this.isInstalled()) {
      console.log('Service not installed, run first: python scripts/ws_listener.py install');
      return;
    }

    const result = this._systemctl('start', this._UNIT_NAME);
    if (result.status === 0) {
      console.log('Service started');
    } else {
      console.log(`Start failed: ${result.stderr?.trim() || result.error?.message}`);
    }
  }

  /**
   * 停止运行中的服务
   */
  stop() {
    if (!this.isInstalled()) {
      console.log('Service not installed');
      return;
    }

    const result = this._systemctl('stop', this._UNIT_NAME);
    if (result.status === 0) {
      console.log('Service stopped');
    } else {
      console.log(`Stop failed: ${result.stderr?.trim() || result.error?.message}`);
    }
  }

  /**
   * 返回服务状态
   * @returns {Object} 服务状态
   */
  status() {
    const output = {
      platform: 'Linux (systemd)',
      installed: this.isInstalled(),
      service_file: this._unitPath,
      application_log_dir: getLogDirFromLogging(SDKConfig.load()),
      application_log_path: _applicationLogPath()
    };

    if (this.isInstalled()) {
      const result = this._systemctl('is-active', this._UNIT_NAME);
      const state = (result.stdout || '').trim();
      output.running = state === 'active';
      output.state = state;

      try {
        const unitText = fs.readFileSync(this._unitPath, 'utf8');
        for (const line of unitText.split('\n')) {
          if (line.includes('--mode')) {
            const match = line.match(/--mode\s+(\S+)/);
            if (match) {
              output.mode = match[1];
              break;
            }
          }
        }
      } catch (e) {
        // 忽略读取错误
      }

      const stderrLog = path.join(this.logDir(), 'stderr.log');
      if (fs.existsSync(stderrLog)) {
        output.log_size_bytes = fs.statSync(stderrLog).size;
        output.log_path = stderrLog;
      }

      const appLog = _applicationLogPath();
      if (fs.existsSync(appLog)) {
        output.application_log_size_bytes = fs.statSync(appLog).size;
      }
    } else {
      output.running = false;
    }

    return output;
  }

  /**
   * 执行 systemctl 命令
   * @param {...string} args - 命令参数
   * @returns {Object} 执行结果
   */
  _systemctl(...args) {
    try {
      const result = spawnSync('systemctl', ['--user', ...args], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return {
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || ''
      };
    } catch (e) {
      return {
        status: -1,
        stdout: '',
        stderr: e.message,
        error: e
      };
    }
  }

  /**
   * 生成 systemd 单元配置
   */
  _generateUnit(credential, config_path, mode, logs) {
    const runArgs = this._buildRunArgs(credential, config_path, mode);
    const execStart = runArgs.map(a => `"${a}"`).join(' ');
    const userPath = this._userPath();

    return `[Unit]
Description=awiki WebSocket Listener
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${execStart}
WorkingDirectory=${_PROJECT_ROOT}
Environment=PATH=${userPath}
Restart=on-failure
RestartSec=10
StandardOutput=append:${path.join(logs, 'stdout.log')}
StandardError=append:${path.join(logs, 'stderr.log')}

[Install]
WantedBy=default.target
`;
  }
}

// ---------------------------------------------------------------------------
// Windows — Task Scheduler
// ---------------------------------------------------------------------------

/**
 * Windows 服务管理器，使用任务计划程序 (schtasks)
 */
class WindowsServiceManager extends ServiceManager {
  constructor() {
    super();
    this.platform = 'Windows';
    this._TASK_NAME = 'awiki-ws-listener';

    const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    this._appDir = path.join(localApp, 'awiki-ws-listener');
    this._batPath = path.join(this._appDir, 'run-listener.bat');
  }

  logDir() {
    return path.join(this._appDir, 'logs');
  }

  isInstalled() {
    try {
      const result = spawnSync('schtasks', ['/Query', '/TN', this._TASK_NAME], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return result.status === 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * 安装并启动后台服务
   */
  install(credential, config_path, mode) {
    if (this.isInstalled()) {
      console.log(`Task '${this._TASK_NAME}' already exists in Task Scheduler`);
      console.log('To reinstall, run first: python scripts/ws_listener.py uninstall');
      return;
    }

    if (!fs.existsSync(this._appDir)) {
      fs.mkdirSync(this._appDir, { recursive: true });
    }

    const logs = this._ensureLogDir();
    const batContent = this._generateBat(credential, config_path, mode, logs);
    fs.writeFileSync(this._batPath, batContent, 'utf8');
    console.log(`Batch file written to: ${this._batPath}`);

    const createResult = spawnSync(
      'schtasks',
      ['/Create', '/TN', this._TASK_NAME, '/TR', this._batPath, '/SC', 'ONLOGON', '/RL', 'LIMITED', '/F'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    if (createResult.status !== 0) {
      console.log(`schtasks /Create failed: ${createResult.stderr?.trim() || createResult.error?.message}`);
      return;
    }

    console.log('Scheduled task created');

    const runResult = spawnSync('schtasks', ['/Run', '/TN', this._TASK_NAME], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (runResult.status === 0) {
      console.log('Service installed and started');
    } else {
      console.log(`Task created but start failed: ${runResult.stderr?.trim() || runResult.error?.message}`);
    }

    console.log(`  Logs: ${logs}`);
    console.log(`  App logs: ${_applicationLogPath()}`);
  }

  /**
   * 停止并移除后台服务
   */
  uninstall() {
    if (!this.isInstalled()) {
      console.log('Service not installed');
      return;
    }

    spawnSync('schtasks', ['/End', '/TN', this._TASK_NAME], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const result = spawnSync('schtasks', ['/Delete', '/TN', this._TASK_NAME, '/F'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (result.status === 0) {
      console.log('Scheduled task removed');
    } else {
      console.log(`schtasks /Delete warning: ${result.stderr?.trim() || result.error?.message}`);
    }

    if (fs.existsSync(this._batPath)) {
      fs.unlinkSync(this._batPath);
    }
    console.log('Service uninstalled');
  }

  /**
   * 启动已安装的服务
   */
  start() {
    if (!this.isInstalled()) {
      console.log('Service not installed, run first: python scripts/ws_listener.py install');
      return;
    }

    const result = spawnSync('schtasks', ['/Run', '/TN', this._TASK_NAME], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (result.status === 0) {
      console.log('Service started');
    } else {
      console.log(`Start failed: ${result.stderr?.trim() || result.error?.message}`);
    }
  }

  /**
   * 停止运行中的服务
   */
  stop() {
    if (!this.isInstalled()) {
      console.log('Service not installed');
      return;
    }

    const result = spawnSync('schtasks', ['/End', '/TN', this._TASK_NAME], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (result.status === 0) {
      console.log('Service stopped');
    } else {
      console.log(`Stop failed: ${result.stderr?.trim() || result.error?.message}`);
    }
  }

  /**
   * 返回服务状态
   * @returns {Object} 服务状态
   */
  status() {
    const installed = this.isInstalled();
    const output = {
      platform: 'Windows (Task Scheduler)',
      installed: installed,
      task_name: this._TASK_NAME,
      application_log_dir: getLogDirFromLogging(SDKConfig.load()),
      application_log_path: _applicationLogPath()
    };

    if (installed) {
      const result = spawnSync(
        'schtasks',
        ['/Query', '/TN', this._TASK_NAME, '/FO', 'LIST', '/V'],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      output.running = result.stdout?.includes('Running') || false;
      output.details = (result.stdout || '').trim();

      const stderrLog = path.join(this.logDir(), 'stderr.log');
      if (fs.existsSync(stderrLog)) {
        output.log_size_bytes = fs.statSync(stderrLog).size;
        output.log_path = stderrLog;
      }

      const appLog = _applicationLogPath();
      if (fs.existsSync(appLog)) {
        output.application_log_size_bytes = fs.statSync(appLog).size;
      }
    } else {
      output.running = false;
    }

    return output;
  }

  /**
   * 生成批处理文件
   */
  _generateBat(credential, config_path, mode, logs) {
    const runArgs = this._buildRunArgs(credential, config_path, mode);
    const cmdLine = runArgs.map(a => `"${a}"`).join(' ');

    return `@echo off
REM awiki WebSocket Listener — auto-generated, do not edit manually
cd /d "${_PROJECT_ROOT}"
${cmdLine} >> "${path.join(logs, 'stdout.log')}" 2>> "${path.join(logs, 'stderr.log')}"
`;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * 返回当前平台的适当 ServiceManager
 * @returns {ServiceManager} 服务管理器实例
 */
function get_service_manager() {
  switch (process.platform) {
    case 'darwin':
      return new MacOSServiceManager();
    case 'linux':
      return new LinuxServiceManager();
    case 'win32':
      return new WindowsServiceManager();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

module.exports = {
  ServiceManager,
  MacOSServiceManager,
  LinuxServiceManager,
  WindowsServiceManager,
  get_service_manager
};
