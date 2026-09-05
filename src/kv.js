// KV 操作类 - 处理存储操作

import { KV_USER_STORE, KV_SESSION_STORE } from './config.js';

/**
 * KV存储操作类
 */
export class KVStore {
  /**
   * 构造函数
   * @param {Object} env 环境变量
   */
  constructor(env) {
    this.kv = env.KV;
  }

  /**
   * 保存问题到KV
   * @param {string} id 问题ID
   * @param {Object} question 问题对象
   * @returns {Promise<boolean>} 是否成功
   */
  async saveQuestion(id, question) {
    try {
      await this.kv.put(`question:${id}`, JSON.stringify(question));
      return true;
    } catch (error) {
      console.error('保存问题失败:', error);
      return false;
    }
  }

  /**
   * 从KV获取问题
   * @param {string} id 问题ID
   * @returns {Promise<Object|null>} 问题对象，如果不存在则返回null
   */
  async getQuestion(id) {
    try {
      const result = await this.kv.get(`question:${id}`);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('获取问题失败:', error);
      return null;
    }
  }

  /**
   * 获取所有问题列表（支持分页）
   * @param {number} page 页码，从1开始
   * @param {number} pageSize 每页数量
   * @returns {Promise<{questions: Array, total: number, totalPages: number}>} 分页结果
   */
  async getQuestions(page = 1, pageSize = 10) {
    try {
      const result = await this.kv.list({ prefix: 'question:' });
      const questions = [];
      
      // 过滤出问题键
      const questionKeys = result.keys.filter(key => key.name.startsWith('question:'));
      
      // 计算分页
      const total = questionKeys.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);
      
      // 获取当前页的问题
      for (let i = startIndex; i < endIndex; i++) {
        const key = questionKeys[i];
        const questionData = await this.kv.get(key.name);
        if (questionData) {
          try {
            const question = JSON.parse(questionData);
            questions.push({
              id: key.name.replace('question:', ''),
              ...question
            });
          } catch (parseError) {
            console.error('解析问题数据失败:', parseError);
          }
        }
      }
      
      return {
        questions,
        total,
        totalPages,
        currentPage: page,
        pageSize
      };
    } catch (error) {
      console.error('获取问题列表失败:', error);
      return {
        questions: [],
        total: 0,
        totalPages: 0,
        currentPage: page,
        pageSize
      };
    }
  }

  /**
   * 删除问题
   * @param {string} id 问题ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteQuestion(id) {
    try {
      await this.kv.delete(`question:${id}`);
      return true;
    } catch (error) {
      console.error('删除问题失败:', error);
      return false;
    }
  }

  /**
   * 保存会话到KV
   * @param {string} sessionId 会话ID
   * @param {Object} sessionData 会话数据
   * @param {number} ttl 过期时间（秒）
   * @returns {Promise<boolean>} 是否成功
   */
  async saveSession(sessionId, sessionData, ttl = 86400) {
    try {
      await this.kv.put(sessionId, JSON.stringify(sessionData), {
        expirationTtl: ttl
      });
      return true;
    } catch (error) {
      console.error('保存会话失败:', error);
      return false;
    }
  }

  /**
   * 从KV获取会话
   * @param {string} sessionId 会话ID
   * @returns {Promise<Object|null>} 会话对象，如果不存在则返回null
   */
  async getSession(sessionId) {
    try {
      const result = await this.kv.get(sessionId);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('获取会话失败:', error);
      return null;
    }
  }

  /**
   * 删除会话
   * @param {string} sessionId 会话ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteSession(sessionId) {
    try {
      await this.kv.delete(sessionId);
      return true;
    } catch (error) {
      console.error('删除会话失败:', error);
      return false;
    }
  }

  /**
   * 初始化示例问题数据
   * @returns {Promise<boolean>} 是否成功
   */
  async initializeQuestions() {
    try {
      const questions = [
        {
          id: 'q1',
          question: '中国的首都是哪里？',
          answer: '北京',
          salt: this.generateSalt()
        },
        {
          id: 'q2',
          question: '1 + 1 等于多少？',
          answer: '2',
          salt: this.generateSalt()
        },
        {
          id: 'q3',
          question: '地球有几个大洲？',
          answer: '7',
          salt: this.generateSalt()
        },
        {
          id: 'q4',
          question: '世界上最高的山峰是？',
          answer: '珠穆朗玛峰',
          salt: this.generateSalt()
        },
        {
          id: 'q5',
          question: '中国的国花是？',
          answer: '牡丹',
          salt: this.generateSalt()
        }
      ];

      for (const question of questions) {
        await this.saveQuestion(question.id, question);
      }

      return true;
    } catch (error) {
      console.error('初始化问题数据失败:', error);
      return false;
    }
  }

  /**
   * 生成随机盐值
   * @param {number} length 盐值长度
   * @returns {string} 盐值
   */
  generateSalt(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let salt = '';
    for (let i = 0; i < length; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  }
}

