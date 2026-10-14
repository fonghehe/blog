// Deliberately narrow: do not infer whether arbitrary personal experience is true.
export const repeatedClaims = new Set([
  '这套方案已经在线上稳定运行了半年以上，经过了实际验证。',
  '這套方案已經在線上穩定運行了半年以上，經過了實際驗證。',
  'This approach has been running stably in production for over six months and has been practically validated.',
  'This approach has been running stably in production for over six months and has proven itself in real use.',
  'このアプローチは6ヶ月以上本番環境で安定稼働しており、実際に検証済みです。',
  "This approach has been running stably in production for over half a year and has been proven in practice.",
  "This approach has been running stably in production for over half a year and has been proven in real use.",
  "This approach has been running stably in production for over half a year and has been validated in practice.",
  "This approach has been running stably in production for over half a year and has proven itself in practice.",
  "This approach has been running stably in production for over half a year and has stood up to real-world use.",
  "This approach has been running stably in production for over half a year and is proven in practice.",
  "This approach has been running stably in production for over half a year, so it is battle-tested.",
  "This approach has been running stably in production for over half a year, so it's battle-tested.",
  "This approach has been running stably in production for over half a year, so it's proven in practice.",
  "This approach has been running stably in production for over six months and has been battle-tested.",
  "This approach has been running stably in production for over six months and has been validated in real-world use.",
  "このアプローチは6ヶ月以上本番環境で安定して動作し、実際に検証されています。",
  "このアプローチは半年以上にわたって本番環境で安定稼働しており、実際に検証済みだ。",
  "このアプローチは半年以上にわたって本番環境で安定稼働しており、実際に検証済みです。",
  "このアプローチは半年以上本番環境で安定して稼働しており、実際に検証されています。",
  "このアプローチは半年以上本番環境で安定稼働しており、実際に検証済みです。",
  "这套方案已经在线上稳定运行了半年多，是经过实战检验的。",
  "这套方案已经在线上稳定运行半年多，是经过实战验证的。",
  "这套方案已经在线上稳定运行半年多，经受过实际验证。",
  "这套方案已经在线上稳定运行半年多，经受过真实流量验证。",
]);

export function cleanKnownContent(source) {
  const parts = source.split(/(```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~)/g);
  return parts.map((part, index) => {
    if (index % 2 === 0) return part.split('\n').filter(line => !repeatedClaims.has(line.trim())).join('\n');
    const match = part.match(/^```(?:javascript|js|typescript|ts)\s*\n([\s\S]*?)```$/);
    if (match && /^(?:\.[\w-]+|#[\w-]+|:root|@(?:media|container)|html\b|body\b)/.test(match[1].trim())
      && /[\w-]+\s*:\s*[^;{}]+;/.test(match[1])) return part.replace(/^```[^\n]+/, '```css');
    return part;
  }).join('');
}
