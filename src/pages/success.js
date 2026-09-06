// 验证通过后的独立页面模块。
//
// 这个文件故意和问答校验逻辑完全解耦：routes.js 只在"用户已通过全部校验"时
// 调用 getSuccessPageTemplate()，往后如果要把这个页面换成真正的内容（博客、
// 落地页等），只需要改这一个文件，不会牵扯到 auth/kv/校验流程的任何代码。

import { getBaseHtml } from '../templates.js';
import { escapeHtml } from '../utils.js';

/**
 * @param {Object} session 当前已验证通过的会话
 * @returns {string} 完整 HTML
 */
export function getSuccessPageTemplate(session = {}) {
  const name = escapeHtml(session.username || '访客');

  const content = `
    <div class="panel panel--accent">
      <h2>Hello, World 👋</h2>
      <p>你好，${name}。这里是验证通过后的独立页面模块。</p>
      <p class="muted">这只是一个占位内容，后续可以直接编辑
        <code>src/pages/success.js</code> 替换成正式页面，不会影响问答校验逻辑。</p>
    </div>
    <a href="/logout" class="btn btn-outline">退出登录</a>
  `;

  return getBaseHtml('验证成功', content);
}
