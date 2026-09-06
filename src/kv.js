// KV 操作类 - 处理存储操作

import { hashWithSalt, generateRandomString, timingSafeEqual } from './utils.js';
import {
  MAX_QUESTIONS,
  MAX_QUESTION_LENGTH,
  MAX_ANSWER_LENGTH,
  MIN_OPTIONS,
  MAX_OPTIONS,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGE_PROMPT_LENGTH,
  DEFAULT_MESSAGE_PROMPT,
  MESSAGE_SETTINGS_KEY
} from './config.js';

/**
 * KV存储操作类
 * 注意：题目答案不会以明文保存，只保存"盐值 + 哈希"，
 * 这样即使问题数据被意外泄露（如未授权的接口访问），也拿不到正确答案。
 */
export class KVStore {
  constructor(env) {
    this.kv = env.KV;
  }

  /**
   * 规范化答案（去首尾空格、忽略大小写），提升用户体验且不影响安全性
   */
  _normalizeAnswer(answer) {
    return String(answer ?? '').trim().toLowerCase();
  }

  // ---------------------------------------------------------------------
  // 题目
  // ---------------------------------------------------------------------

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
   * 新增一道验证问题。
   * @param {Object} input
   * @param {string} input.question 题干
   * @param {'text'|'choice'} input.type 题目类型
   * @param {string} input.answer 正确答案（明文，仅用于计算哈希，不落库）
   * @param {string[]} [input.options] 选择题的选项列表（type === 'choice' 时必填）
   * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
   */
  async addQuestion({ question, type, answer, options }) {
    const q = String(question ?? '').trim();
    const a = String(answer ?? '').trim();
    const questionType = type === 'choice' ? 'choice' : 'text';

    if (!q || !a) {
      return { ok: false, error: '问题和答案不能为空' };
    }
    if (q.length > MAX_QUESTION_LENGTH) {
      return { ok: false, error: `问题长度不能超过 ${MAX_QUESTION_LENGTH} 个字符` };
    }
    if (a.length > MAX_ANSWER_LENGTH) {
      return { ok: false, error: `答案长度不能超过 ${MAX_ANSWER_LENGTH} 个字符` };
    }

    let cleanOptions = [];
    if (questionType === 'choice') {
      cleanOptions = (Array.isArray(options) ? options : [])
        .map(opt => String(opt ?? '').trim())
        .filter(opt => opt.length > 0);

      if (cleanOptions.length > MAX_OPTIONS) {
        return { ok: false, error: `选项最多 ${MAX_OPTIONS} 个` };
      }
      if (cleanOptions.length < MIN_OPTIONS) {
        return { ok: false, error: `选择题至少需要 ${MIN_OPTIONS} 个选项` };
      }
      if (cleanOptions.some(opt => opt.length > MAX_ANSWER_LENGTH)) {
        return { ok: false, error: `每个选项长度不能超过 ${MAX_ANSWER_LENGTH} 个字符` };
      }
      const matches = cleanOptions.some(opt => opt.toLowerCase() === a.toLowerCase());
      if (!matches) {
        return { ok: false, error: '正确答案必须和某一个选项完全一致' };
      }
    }

    const { total } = await this.getQuestions(1, MAX_QUESTIONS);
    if (total >= MAX_QUESTIONS) {
      return { ok: false, error: `最多只能添加 ${MAX_QUESTIONS} 道题目` };
    }

    const id = generateRandomString(12);
    const salt = generateRandomString(16);
    const answerHash = await hashWithSalt(this._normalizeAnswer(a), salt);

    const record = { question: q, type: questionType, answerHash, salt };
    if (questionType === 'choice') {
      record.options = cleanOptions;
    }

    const success = await this.saveQuestion(id, record);
    return success ? { ok: true, id } : { ok: false, error: '写入存储失败' };
  }

  /**
   * 校验用户提交的答案是否正确（文本题、选择题通用：都是比较规范化后的文本哈希）
   */
  async verifyAnswer(question, submittedAnswer) {
    if (!question || !question.answerHash || !question.salt) return false;
    const submittedHash = await hashWithSalt(this._normalizeAnswer(submittedAnswer), question.salt);
    return timingSafeEqual(submittedHash, question.answerHash);
  }

  /**
   * 从KV获取单个问题（内部使用，含 answerHash）
   */
  async getQuestion(id) {
    if (!id) return null;
    try {
      const result = await this.kv.get(`question:${id}`);
      if (!result) return null;
      return { id, ...JSON.parse(result) };
    } catch (error) {
      console.error('获取问题失败:', error);
      return null;
    }
  }

  /**
   * 获取所有问题列表（支持分页）—— 内部使用，包含 answerHash/salt，绝不能直接返回给未鉴权的客户端
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
   * 获取用于"公开展示"的题目列表：只含 id/题干/类型/选项，绝不包含 answerHash/salt
   * @returns {Promise<Array<{id: string, question: string, type: string, options?: string[]}>>}
   */
  async getPublicQuestions() {
    const { questions } = await this.getQuestions(1, MAX_QUESTIONS);
    return questions.map(q => {
      const pub = { id: q.id, question: q.question, type: q.type === 'choice' ? 'choice' : 'text' };
      if (pub.type === 'choice') {
        pub.options = Array.isArray(q.options) ? q.options : [];
      }
      return pub;
    });
  }

  async deleteQuestion(id) {
    try {
      await this.kv.delete(`question:${id}`);
      return true;
    } catch (error) {
      console.error('删除问题失败:', error);
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // 留言功能设置（后台可开关 + 自定义提示语）
  // ---------------------------------------------------------------------

  async getMessageSettings() {
    try {
      const raw = await this.kv.get(MESSAGE_SETTINGS_KEY);
      if (!raw) {
        return { enabled: true, prompt: DEFAULT_MESSAGE_PROMPT };
      }
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled !== false,
        prompt: typeof parsed.prompt === 'string' && parsed.prompt.trim()
          ? parsed.prompt.trim().slice(0, MAX_MESSAGE_PROMPT_LENGTH)
          : DEFAULT_MESSAGE_PROMPT
      };
    } catch (error) {
      console.error('获取留言设置失败:', error);
      return { enabled: true, prompt: DEFAULT_MESSAGE_PROMPT };
    }
  }

  async updateMessageSettings({ enabled, prompt }) {
    const cleanPrompt = String(prompt ?? '').trim().slice(0, MAX_MESSAGE_PROMPT_LENGTH) || DEFAULT_MESSAGE_PROMPT;
    const settings = { enabled: !!enabled, prompt: cleanPrompt };
    try {
      await this.kv.put(MESSAGE_SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('更新留言设置失败:', error);
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // 留言内容（不做必填/格式校验，仅做长度限制；展示时必须由调用方转义）
  // ---------------------------------------------------------------------

  async saveMessage(content) {
    const clean = String(content ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!clean) return { ok: true, skipped: true }; // 留言为空，静默跳过，不算错误

    const id = generateRandomString(12);
    const record = { content: clean, submittedAt: Date.now() };
    try {
      await this.kv.put(`message:${id}`, JSON.stringify(record));
      return { ok: true, id };
    } catch (error) {
      console.error('保存留言失败:', error);
      return { ok: false, error: '留言保存失败' };
    }
  }

  async getMessages(page = 1, pageSize = 10) {
    try {
      const result = await this.kv.list({ prefix: 'message:' });

      const records = [];
      for (const key of result.keys) {
        const raw = await this.kv.get(key.name);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            records.push({ id: key.name.replace('message:', ''), ...parsed });
          } catch (parseError) {
            console.error('解析留言数据失败:', parseError);
          }
        }
      }

      records.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

      const total = records.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const startIndex = (page - 1) * pageSize;
      const pageRecords = records.slice(startIndex, startIndex + pageSize);

      return { messages: pageRecords, total, totalPages, currentPage: page, pageSize };
    } catch (error) {
      console.error('获取留言列表失败:', error);
      return { messages: [], total: 0, totalPages: 0, currentPage: page, pageSize };
    }
  }

  async deleteMessage(id) {
    try {
      await this.kv.delete(`message:${id}`);
      return true;
    } catch (error) {
      console.error('删除留言失败:', error);
      return false;
    }
  }
}
