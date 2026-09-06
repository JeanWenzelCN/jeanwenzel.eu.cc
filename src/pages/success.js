// "验证通过后做什么" 的独立模块。
//
// 这个文件和问答校验逻辑完全解耦：routes.js 只在"用户已通过全部题目校验"时
// 调用 grantAccessAndRedirect()。以后如果想改成别的行为（比如先展示一个
// 提示页面再跳转），只需要改这一个文件。
//
// 当前行为：
//   1. 生成一个新的、和问答 session 无关的随机访问令牌，写入共享 KV（带过期时间）
//   2. 把令牌种成 Cookie 下发，Domain 设成父域名，跨子域名可读
//   3. 清理掉已经用完的问答 session
//   4. 302 跳转到目标子域名（从环境变量 TARGET_ORIGIN 读取）
//
// 目标子域名那边由另一个独立的 Worker 负责：检查这个 Cookie 对应的令牌
// 在共享 KV 里是否存在，不存在就拒绝访问。

import { generateRandomString, setCookie, clearCookie } from '../utils.js';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_KV_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS
} from '../config.js';

/**
 * @param {Object} env Worker 环境变量/绑定（需要 env.SESSION_STORE、env.TARGET_ORIGIN，
 *                      可选 env.COOKIE_DOMAIN）
 * @param {AuthService} authService 用于清理已完成使命的问答 session
 * @param {string} sessionId 当前问答 session 的 ID
 * @returns {Promise<Response>}
 */
export async function grantAccessAndRedirect(env, authService, sessionId) {
  const targetOrigin = env.TARGET_ORIGIN;
  if (!targetOrigin) {
    console.error('缺少 TARGET_ORIGIN 环境变量，无法完成跳转');
    return new Response('系统配置错误，请联系管理员。', { status: 500 });
  }

  // 生成访问令牌并写入共享 KV，交给 KV 的 expirationTtl 自动过期，不需要手动清理
  const token = generateRandomString(48);
  await env.SESSION_STORE.put(
    `${ACCESS_TOKEN_KV_PREFIX}${token}`,
    JSON.stringify({ issuedAt: Date.now() }),
    { expirationTtl: ACCESS_TOKEN_TTL_SECONDS }
  );

  // 问答 session 已经用完，删掉防止被重复利用
  if (sessionId) {
    await authService.deleteSession(sessionId);
  }

  const response = new Response(null, {
    status: 302,
    headers: { Location: targetOrigin }
  });

  // 清掉本站用的问答 sessionId cookie
  response.headers.append('Set-Cookie', clearCookie('sessionId'));

  // 下发跨子域可读的访问令牌 cookie
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    expires: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000)
  };
  if (env.COOKIE_DOMAIN) {
    cookieOptions.domain = env.COOKIE_DOMAIN;
  } else {
    console.error('未配置 COOKIE_DOMAIN，令牌 Cookie 将只对当前子域名生效，目标子域名可能读不到');
  }

  response.headers.append('Set-Cookie', setCookie(ACCESS_TOKEN_COOKIE_NAME, token, cookieOptions));

  return response;
}
