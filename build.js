const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ===== 配置 =====
const UPSTREAM_CANDIDATES = [
  'Upstream.js',
  'Upstream.txt',
  'Upstream.url',
  'Upstream',
  'upstream.js',
  'upstream.txt',
  'upstream.url',
  'upstream',
];
const CUSTOM_FILE = 'MyCustomizations.js';
const OUT_FILE = path.join(__dirname, 'dist', 'merged-script.js');
const FETCH_TIMEOUT_MS = 30000;

// ===== 工具函数 =====
function findUpstreamFile() {
  for (const name of UPSTREAM_CANDIDATES) {
    const p = path.join(__dirname, name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  throw new Error(
    `未找到上游配置文件名。请创建以下任意一个文件并写入远程 URL：\n  ${UPSTREAM_CANDIDATES.join('\n  ')}`
  );
}

function parseUpstreamUrl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (lines.length === 0) {
    throw new Error(`${path.basename(filePath)} 中没有有效的 URL（所有行都是注释或空行）`);
  }

  const urlStr = lines[0];
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`上游 URL 格式不合法: ${urlStr}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`上游 URL 必须是 http/https 协议: ${urlStr}`);
  }
  return urlStr;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'clash-verge-merge-builder/1.0' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function validateRemoteHasMain(remoteCode, url) {
  const sandbox = { console };
  vm.createContext(sandbox);
  try {
    vm.runInContext(remoteCode, sandbox, { timeout: 5000 });
  } catch (e) {
    throw new Error(`远程脚本执行失败（${url}）: ${e.message}`);
  }
  if (typeof sandbox.main !== 'function') {
    throw new Error(`远程脚本中未找到 main 函数（${url}）`);
  }
}

function loadCustomCode() {
  const p = path.join(__dirname, CUSTOM_FILE);
  if (!fs.existsSync(p)) {
    throw new Error(`未找到自定义脚本: ${CUSTOM_FILE}`);
  }
  const code = fs.readFileSync(p, 'utf-8');
  if (!/function\s+applyCustomizations\s*\(/.test(code)) {
    throw new Error(`${CUSTOM_FILE} 中未找到 applyCustomizations 函数`);
  }
  if (/function\s+main\s*\(/.test(code)) {
    throw new Error(`${CUSTOM_FILE} 中不允许定义 main 函数（会与远程脚本冲突）`);
  }
  return code;
}

function assemble(remoteCode, remoteUrl, customCode) {
  return [
    '// ============================================================',
    '// 自动生成文件，请勿手动修改',
    `// 生成时间: ${new Date().toISOString()}`,
    `// 上游脚本: ${remoteUrl}`,
    `// 自定义脚本: ${CUSTOM_FILE}`,
    '// ============================================================',
    '',
    '// ===== 远程脚本开始 =====',
    remoteCode,
    '// ===== 远程脚本结束 =====',
    '',
    '// ===== 本地自定义开始 =====',
    customCode,
    '// ===== 本地自定义结束 =====',
    '',
    '// ===== 包装 main（自动生成） =====',
    'const __remoteMain = main;',
    'function main(config) {',
    '  let result = __remoteMain(config);',
    '  if (typeof applyCustomizations === "function") {',
    '    result = applyCustomizations(result);',
    '  }',
    '  return result;',
    '}',
    '',
  ].join('\n');
}

// ===== 主流程 =====
async function build() {
  const upstreamFile = findUpstreamFile();
  console.log(`📄 上游配置文件: ${path.basename(upstreamFile)}`);

  const remoteUrl = parseUpstreamUrl(upstreamFile);
  console.log(`🔗 上游 URL: ${remoteUrl}`);

  console.log('⬇️  下载远程脚本…');
  const remoteCode = await fetchWithTimeout(remoteUrl, FETCH_TIMEOUT_MS);
  if (!remoteCode.trim()) {
    throw new Error('远程脚本内容为空');
  }
  console.log(`   已下载 ${remoteCode.length} 字节`);

  console.log('🔍 校验远程脚本包含 main 函数…');
  validateRemoteHasMain(remoteCode, remoteUrl);

  console.log(`📄 读取本地自定义: ${CUSTOM_FILE}`);
  const customCode = loadCustomCode();

  console.log('🧩 拼装最终脚本…');
  const finalCode = assemble(remoteCode, remoteUrl, customCode);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, finalCode, 'utf-8');
  console.log(`✅ 已生成: ${OUT_FILE}（${finalCode.length} 字节）`);
}

build().catch((err) => {
  console.error(`❌ 构建失败: ${err.message}`);
  process.exit(1);
});