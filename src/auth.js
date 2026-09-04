// 认证服务 - 处理用户认证和会话管理

import { KV_SESSION_STORE, COOKIE_NAME, COOKIE_MAX_AGE } from './config.js';
import { generateSessionId, getCookieValue, setCookie, clearCookie } from './utils.js';
import { KVStore } from './kv.js';

/**
 * 认证服务类
 */
export class AuthService {
  /**
   * 构造函数
   * @param {Object} env 环境变量
   */
  constructor(env) {
    this.kvStore = new KVStore(env);
  }

  /**
   * 从请求中获取会话ID
   * @param {Request} request 请求对象
   * @returns {string|null} 会话ID，如果不存在则返回null
   */
  getSessionId(request) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return null;
    }
    return getCookieValue(cookieHeader, COOKIE_NAME);
  }

  /**
   * 创建新的会话
   * @param {Object} userInfo 用户信息
   * @returns {Promise<string>} 会话ID
   */
  async createSession(userInfo) {
    const sessionId = generateSessionId();
    const sessionData = {
      userInfo: userInfo,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    };

    await this.kvStore.saveSession(sessionId, sessionData, COOKIE_MAX_AGE);
    return sessionId;
  }

  /**
   * 验证会话是否存在且有效
   * @param {string} sessionId 会话ID
   * @returns {Promise<boolean>} 是否有效
   */
  async validateSession(sessionId) {
    if (!sessionId) {
      return false;
    }

    const sessionData = await this.kvStore.getSession(sessionId);
    if (!sessionData) {
      return false;
    }

    // 检查会话是否过期（24小时）
    const sessionTime = new Date(sessionData.lastAccessed);
    const currentTime = new Date();
    const timeDiff = currentTime - sessionTime;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      await this.kvStore.deleteSession(sessionId);
      return false;
    }

    // 更新最后访问时间
    sessionData.lastAccessed = new Date().toISOString();
    await this.kvStore.saveSession(sessionId, sessionData, COOKIE_MAX_AGE);
    return true;
  }

  /**
   * 销毁会话
   * @param {string} sessionId 会话ID
   * @returns {Promise<boolean>} 是否成功
   */
  async destroySession(sessionId) {
    if (!sessionId) {
      return false;
    }
    return await this.kvStore.deleteSession(sessionId);
  }

  /**
   * 验证管理员密码
   * @param {string} password 密码
   * @returns {boolean} 是否正确
   */
  validateAdminPassword(password) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return false;
    }
    return password === adminPassword;
  }

  /**
   * 设置会话Cookie
   * @param {string} sessionId 会话ID
   * @returns {string} Cookie字符串
   */
  setSessionCookie(sessionId) {
    return setCookie(COOKIE_NAME, sessionId, COOKIE_MAX_AGE, '/', true, true);
  }

  /**
   * 清除会话Cookie
   * @returns {string} Cookie字符串
   */
  clearSessionCookie() {
    return clearCookie(COOKIE_NAME, '/');
  }

  /**
   * 检查用户是否已通过验证
   * @param {Request} request 请求对象
   * @returns {Promise<boolean>} 是否已通过验证
   */
  async isAuthenticated(request) {
    const sessionId = this.getSessionId(request);
    return await this.validateSession(sessionId);
  }

  /**
   * 获取当前用户信息
   * @param {Request} request 请求对象
   * @returns {Promise<Object|null>} 用户信息，如果不存在则返回null
   */
  async getCurrentUser(request) {
    const sessionId = this.getSessionId(request);
    if (!sessionId) {
      return null;
    }

    const sessionData = await this.kvStore.getSession(sessionId);
    return sessionData ? sessionData.userInfo : null;
  }
}
