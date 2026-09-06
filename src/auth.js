// 认证服务 - 处理用户认证和会话管理
import { timingSafeEqual, generateSessionId, generateRandomString } from './utils.js';
import { SESSION_TIMEOUT_MS, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_SECONDS } from './config.js';

// 会话ID格式校验：必须是 generateSessionId() 产出的 64 位字母数字字符串
const SESSION_ID_PATTERN = /^[A-Za-z0-9]{64}$/;

export class AuthService {
  constructor(env) {
    this.env = env;
  }

  /**
   * 生成新的会话ID
   * @returns {string}
   */
  generateSessionId() {
    return generateSessionId();
  }

  /**
   * 验证管理员密码（恒定时间比较，不再使用固定盐值做无意义哈希）
   * @param {string} password - 输入的密码
   * @returns {Promise<boolean>}
   */
  async validateAdminPassword(password) {
    if (!this.env.ADMIN_PASSWORD) {
      throw new Error('管理员密码未配置');
    }
    if (typeof password !== 'string' || password.length === 0) {
      return false;
    }
    return timingSafeEqual(password, this.env.ADMIN_PASSWORD);
  }

  /**
   * 基于 IP 的登录/验证失败限流，防止暴力破解
   * @param {Request} request
   * @param {string} scope - 限流场景标识，如 'admin-login' / 'validate'
   * @returns {Promise<boolean>} true 表示允许继续尝试
   */
  async checkRateLimit(request, scope) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `ratelimit:${scope}:${ip}`;
    const raw = await this.env.SESSION_STORE.get(key);
    const record = raw ? JSON.parse(raw) : { count: 0 };
    return record.count < RATE_LIMIT_MAX_ATTEMPTS;
  }

  /**
   * 记录一次失败尝试
   */
  async recordFailure(request, scope) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `ratelimit:${scope}:${ip}`;
    const raw = await this.env.SESSION_STORE.get(key);
    const record = raw ? JSON.parse(raw) : { count: 0 };
    record.count += 1;
    await this.env.SESSION_STORE.put(key, JSON.stringify(record), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS
    });
  }

  /**
   * 成功后清除失败计数
   */
  async clearFailures(request, scope) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `ratelimit:${scope}:${ip}`;
    await this.env.SESSION_STORE.delete(key);
  }

  /**
   * 创建会话（自动附带 CSRF token）
   * @param {string} sessionId - 会话ID
   * @param {Object} sessionData - 会话数据
   * @returns {Promise<Object>} 创建的会话对象（含 csrfToken）
   */
  async createSession(sessionId, sessionData) {
    try {
      const session = {
        ...sessionData,
        csrfToken: generateRandomString(32),
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TIMEOUT_MS
      };
      await this.env.SESSION_STORE.put(sessionId, JSON.stringify(session));
      return session;
    } catch (error) {
      console.error('创建会话失败:', error);
      throw new Error('会话创建失败');
    }
  }

  /**
   * 局部更新一个已存在的会话（例如推进答题进度），不改变 csrfToken/createdAt，
   * 且不允许通过 patch 覆盖这两个字段，防止业务代码不小心把 CSRF token 换掉导致表单校验失败。
   * @param {string} sessionId
   * @param {Object} patch - 要合并进去的字段
   * @returns {Promise<Object|null>} 更新后的会话，会话不存在则返回 null
   */
  async updateSession(sessionId, patch) {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const { csrfToken, createdAt, ...safePatch } = patch || {};
    const updated = { ...session, ...safePatch };

    try {
      await this.env.SESSION_STORE.put(sessionId, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('更新会话失败:', error);
      throw new Error('会话更新失败');
    }
  }

  /**
   * 获取会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Object|null>}
   */
  async getSession(sessionId) {
    if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
      return null;
    }
    try {
      const sessionData = await this.env.SESSION_STORE.get(sessionId);
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      if (Date.now() > session.expiresAt) {
        await this.deleteSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      console.error('获取会话失败:', error);
      return null;
    }
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    if (!sessionId) return;
    try {
      await this.env.SESSION_STORE.delete(sessionId);
    } catch (error) {
      console.error('删除会话失败:', error);
      throw new Error('会话删除失败');
    }
  }

  /**
   * 检查管理员权限
   * @param {Request} request - 请求对象
   * @returns {Promise<boolean>}
   */
  async isAdmin(request) {
    try {
      const sessionId = this.getSessionIdFromRequest(request);
      if (!sessionId) {
        return false;
      }

      const session = await this.getSession(sessionId);
      return !!(session && session.isAdmin);
    } catch (error) {
      console.error('检查管理员权限失败:', error);
      return false;
    }
  }

  /**
   * 校验 CSRF token（用于所有会改变状态的已登录 POST 请求）
   * @param {Object} session
   * @param {string} token
   * @returns {boolean}
   */
  verifyCsrfToken(session, token) {
    if (!session || !session.csrfToken || !token) return false;
    return timingSafeEqual(session.csrfToken, token);
  }

  /**
   * 从请求中获取会话ID
   * @param {Request} request - 请求对象
   * @returns {string|null}
   */
  getSessionIdFromRequest(request) {
    const cookie = request.headers.get('cookie');
    if (!cookie) {
      return null;
    }

    const sessionIdMatch = cookie.match(/(?:^|;\s*)sessionId=([^;]+)/);
    return sessionIdMatch ? sessionIdMatch[1] : null;
  }

  /**
   * 设置会话Cookie
   * @param {Response} response - 响应对象
   * @param {string} sessionId - 会话ID
   * @returns {Response}
   */
  setSessionCookie(response, sessionId) {
    // 生产环境始终通过 HTTPS 提供服务，Secure 恒为 true；
    // 本地用 `wrangler dev` 调试时如走 http，可临时改为 false。
    const cookie = `sessionId=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/`;
    response.headers.append('Set-Cookie', cookie);
    return response;
  }

  /**
   * 清除会话Cookie
   * @param {Response} response - 响应对象
   * @returns {Response}
   */
  clearSessionCookie(response) {
    response.headers.append(
      'Set-Cookie',
      'sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax'
    );
    return response;
  }
}
