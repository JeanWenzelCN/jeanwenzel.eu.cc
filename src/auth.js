// 认证服务 - 处理用户认证和会话管理
import { crypto } from 'crypto';
import { hashWithSalt, generateSessionId } from './utils.js';

export class AuthService {
  constructor(env) {
    this.env = env;
  }

  /**
   * 验证管理员密码
   * @param {string} password - 输入的密码
   * @returns {Promise<boolean>}
   */
  async validateAdminPassword(password) {
    if (!this.env.ADMIN_PASSWORD) {
      throw new Error('管理员密码未配置');
    }
    
    const salt = 'admin_salt';
    const inputHash = await hashWithSalt(password, salt);
    const correctHash = await hashWithSalt(this.env.ADMIN_PASSWORD, salt);
    
    return inputHash === correctHash;
  }

  /**
   * 创建会话
   * @param {string} sessionId - 会话ID
   * @param {Object} sessionData - 会话数据
   * @returns {Promise<void>}
   */
  async createSession(sessionId, sessionData) {
    try {
      await this.env.SESSION_STORE.put(sessionId, JSON.stringify({
        ...sessionData,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TIMEOUT
      }));
    } catch (error) {
      console.error('创建会话失败:', error);
      throw new Error('会话创建失败');
    }
  }

  /**
   * 获取会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Object|null>}
   */
  async getSession(sessionId) {
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
      return session && session.isAdmin;
    } catch (error) {
      console.error('检查管理员权限失败:', error);
      return false;
    }
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
    
    const sessionIdMatch = cookie.match(/sessionId=([^;]+)/);
    return sessionIdMatch ? sessionIdMatch[1] : null;
  }

  /**
   * 设置会话Cookie
   * @param {Response} response - 响应对象
   * @param {string} sessionId - 会话ID
   * @returns {Response}
   */
  setSessionCookie(response, sessionId) {
    const isSecure = this.env.ADMIN_PASSWORD ? true : false;
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      path: '/'
    };
    
    if (isSecure) {
      cookieOptions.secure = true;
    }
    
    response.headers.append('Set-Cookie', `sessionId=${sessionId}; ${Object.entries(cookieOptions).map(([key, value]) => `${key}=${value}`).join('; ')}`);
    return response;
  }

  /**
   * 清除会话Cookie
   * @param {Response} response - 响应对象
   * @returns {Response}
   */
  clearSessionCookie(response) {
    response.headers.append('Set-Cookie', 'sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly');
    return response;
  }
}

// 会话超时时间（30分钟）
const SESSION_TIMEOUT = 30 * 60 * 1000;
