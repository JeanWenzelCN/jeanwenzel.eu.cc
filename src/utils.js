// 工具函数 - 提供通用功能支持

import { randomUUID } from 'crypto';

/**
 * 生成随机会话ID
 * @returns {string} 会话ID
 */
export function generateSessionId() {
  return randomUUID();
}

/**
 * 生成随机盐值
 * @param {number} length 盐值长度
 * @returns {string} 盐值
 */
export function generateSalt(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let salt = '';
  for (let i = 0; i < length; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * 使用SHA-256加盐哈希文本
 * @param {string} text 要哈希的文本
 * @param {string} salt 盐值
 * @returns {Promise<string>} 哈希值
 */
export async function hashWithSalt(text, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 从Cookie中提取指定值
 * @param {string} cookie Cookie字符串
 * @param {string} name 要提取的Cookie名称
 * @returns {string|null} Cookie值，如果不存在则返回null
 */
export function getCookieValue(cookie, name) {
  const cookies = cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return cookieValue;
    }
  }
  return null;
}

/**
 * 设置Cookie
 * @param {string} name Cookie名称
 * @param {string} value Cookie值
 * @param {number} maxAge 最大存活时间（秒）
 * @param {string} path Cookie路径
 * @param {boolean} secure 是否仅HTTPS传输
 * @param {boolean} httpOnly 是否禁止JavaScript访问
 * @returns {string} Cookie字符串
 */
export function setCookie(name, value, maxAge, path = '/', secure = true, httpOnly = true) {
  let cookie = `${name}=${value}`;
  if (maxAge) {
    cookie += `; Max-Age=${maxAge}`;
  }
  cookie += `; Path=${path}`;
  if (secure) {
    cookie += '; Secure';
  }
  if (httpOnly) {
    cookie += '; HttpOnly';
  }
  return cookie;
}

/**
 * 清除Cookie
 * @param {string} name Cookie名称
 * @param {string} path Cookie路径
 * @returns {string} Cookie字符串
 */
export function clearCookie(name, path = '/') {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure`;
}

/**
 * 验证答案长度
 * @param {string} answer 答案
 * @returns {boolean} 是否有效
 */
export function validateAnswerLength(answer) {
  return answer && answer.length <= 500;
}

/**
 * 验证答案是否为空
 * @param {string} answer 答案
 * @returns {boolean} 是否有效
 */
export function validateAnswerNotEmpty(answer) {
  return answer && answer.trim().length > 0;
}

/**
 * 创建JSON响应
 * @param {number} statusCode HTTP状态码
 * @param {Object} data 响应数据
 * @returns {Response} Response对象
 */
export function createJsonResponse(statusCode, data) {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * 创建HTML响应
 * @param {number} statusCode HTTP状态码
 * @param {string} html HTML内容
 * @returns {Response} Response对象
 */
export function createHtmlResponse(statusCode, html) {
  return new Response(html, {
    status: statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
