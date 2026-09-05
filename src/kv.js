// KV 操作类 - 处理存储操作

import { hashWithSalt, generateRandomString, timingSafeEqual } from './utils.js';
import { MAX_QUESTIONS, MAX_QUESTION_LENGTH, MAX_ANSWER_LENGTH } from './config.js';

/**
 * KV存储操作类
 * 注意：题目答案不会以明文保存，只保存"盐值 + 哈希"，
 * 这样即使问题数据被意外泄露（如未授权的接口访问），也拿不到正确答案。
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
   * 规范化答案（去首尾空格、忽略大小写），提升用户体验且不影响安全性
   * @param {string} answer
   * @returns {string}
   */
  _normalizeAnswer(answer) {
    return String(answer ?? '').trim().toLowerCase();
  }

  /**
   * 保存问题到KV（内部使用，question 需已包含 answerHash / salt）
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
   * 新增一道验证问题（对外暴露的写入入口，负责校验长度限制、数量上限，并对答案做哈希）
   * @param {string} question 问题内容
   * @param {string} answer 正确答案（明文，仅用于计算哈希，不落库）
   * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
   */
  async addQuestion(question, answer) {
    const q = String(question ?? '').trim();
    const a = String(answer ?? '').trim();

    if (!q || !a) {
      return { ok: false, error: '问题和答案不能为空' };
    }
    if (q.length > MAX_QUESTION_LENGTH) {
      return { ok: false, error: `问题长度不能超过 ${MAX_QUESTION_LENGTH} 个字符` };
    }
    if (a.length > MAX_ANSWER_LENGTH) {
      return { ok: false, error: `答案长度不能超过 ${MAX_ANSWER_LENGTH} 个字符` };
    }

    const { total } = await this.getQuestions(1, MAX_QUESTIONS);
    if (total >= MAX_QUESTIONS) {
      return { ok: false, error: `最多只能添加 ${MAX_QUESTIONS} 道题目` };
    }

    const id = generateRandomString(12);
    const salt = generateRandomString(16);
    const answerHash = await hashWithSalt(this._normalizeAnswer(a), salt);

    const success = await this.saveQuestion(id, { question: q, answerHash, salt });
    return success ? { ok: true, id } : { ok: false, error: '写入存储失败' };
  }

  /**
   * 校验用户提交的答案是否正确
   * @param {Object} question 从 KV 读出的问题对象（含 answerHash、salt）
   * @param {string} submittedAnswer 用户提交的答案
   * @returns {Promise<boolean>}
   */
  async verifyAnswer(question, submittedAnswer) {
    if (!question || !question.answerHash || !question.salt) return false;
    const submittedHash = await hashWithSalt(this._normalizeAnswer(submittedAnswer), question.salt);
    return timingSafeEqual(submittedHash, question.answerHash);
  }

  /**
   * 从KV获取单个问题（内部使用，含 answerHash）
   * @param {string} id 问题ID
   * @returns {Promise<Object|null>}
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
   * 获取所有问题列表（支持分页）—— 内部使用，包含 answerHash/salt，绝不能直接返回给未鉴权的客户端
   * @param {number} page 页码，从1开始
   * @param {number} pageSize 每页数量
   * @returns {Promise<{questions: Array, total: number, totalPages: number}>} 分页结果
   */
  async getQuestions(page = 1, pageSize = 10) {
    try {
      const result = await this.kv.list({ prefix: 'question:' });
      const questionKeys = result.keys.filter(key => key.name.startsWith('question:'));

      const total = questionKeys.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);

      const questions = [];
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

      return { questions, total, totalPages, currentPage: page, pageSize };
    } catch (error) {
      console.error('获取问题列表失败:', error);
      return { questions: [], total: 0, totalPages: 0, currentPage: page, pageSize };
    }
  }

  /**
   * 获取用于"公开展示"的题目列表：只含 id 和题干，绝不包含 answerHash/salt
   * @returns {Promise<Array<{id: string, question: string}>>}
   */
  async getPublicQuestions() {
    const { questions } = await this.getQuestions(1, MAX_QUESTIONS);
    return questions.map(q => ({ id: q.id, question: q.question }));
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
}
