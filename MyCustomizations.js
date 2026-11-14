// 本地自定义逻辑，在远程脚本的 main() 之后执行
// 注意：不要定义 main 函数，否则会与远程脚本冲突（build.js 会报错）

function applyCustomizations(config) {
  // ===== DNS: nameserver 置顶 + 去重 =====
  config.dns = config.dns || {};
  const customDns = ['119.29.29.29', '2402:4e00::', '2402:4e00:1::'];
  const originalNameserver = Array.isArray(config.dns.nameserver)
    ? config.dns.nameserver
    : [];
  config.dns.nameserver = Array.from(
    new Set([...customDns, ...originalNameserver])
  );

  // ===== fake-ip-range6: 为空则设为 2001:2::/64 =====
  const v6 = config.dns['fake-ip-range6'];
  if (v6 === undefined || v6 === null || String(v6).trim() === '') {
    config.dns['fake-ip-range6'] = '2001:2::/64';
  }

  // ===== rules: 前置迅雷直连规则 =====
  config.rules = config.rules || [];
  const customRules = [
    'PROCESS-NAME,DownloadSDKServer.exe,DIRECT',
    'PROCESS-NAME,thunder.exe,DIRECT',
    'PROCESS-NAME,Thunder.exe,DIRECT',
  ];
  config.rules = [...customRules, ...config.rules];

  return config;
}