// 路由处理 - 处理所有HTTP请求
import { AuthService } from './auth.js';
import { KVStore } from './kv.js';
import {
  getQuestionsTemplate,
  getWelcomeTemplate,
  getAdminLoginTemplate,
  getAdminTemplate
} from './templates.js';
import { createHtmlResponse, createRedirectResponse, createErrorResponse } from './utils.js';
import { MAX_QUESTIONS } from './config.js';

/**
 * 路由处理器类
 */
export class RouteHandler {
  constructor(env) {
    this.env = env;
    this.authService = new AuthService(env);
    this.kvStore = new KVStore(env);
  }

  /**
   * 处理根路径请求：已通过验证 -> 欢迎页；未验证 -> 问答验证表单
   */
  async handleRoot(request) {
    try {
      const sessionId = this.authService.getSessionIdFromRequest(request);
      const session = sessionId ? await this.authService.getSession(sessionId) : null;

      if (session) {
        return createHtmlResponse(getWelcomeTemplate({
          name: session.username || '访客',
          isAdmin: !!session.isAdmin
        }));
      }

      const questions = await this.kvStore.getPublicQuestions();
      return createHtmlResponse(getQuestionsTemplate(questions));
    } catch (error) {
      console.error('处理根路径请求失败:', error);
      return createErrorResponse('页面加载失败', 500);
    }
  }

  /**
   * 处理问答验证提交
   */
  async handleValidate(request) {
    try {
      const allowed = await this.authService.checkRateLimit(request, 'validate');
      if (!allowed) {
        const questions = await this.kvStore.getPublicQuestions();
        return createHtmlResponse(
          getQuestionsTemplate(questions, '尝试次数过多，请 15 分钟后再试。')
        );
      }

      const formData = await request.formData();
      const { questions } = await this.kvStore.getQuestions(1, MAX_QUESTIONS);

      if (questions.length === 0) {
        return createHtmlResponse(getQuestionsTemplate([], '暂无验证问题，请联系管理员。'));
      }

      let allCorrect = true;
      for (const question of questions) {
        const submitted = formData.get(`answer_${question.id}`);
        const correct = await this.kvStore.verifyAnswer(question, submitted);
        if (!correct) {
          allCorrect = false;
          break;
        }
      }

      if (!allCorrect) {
        await this.authService.recordFailure(request, 'validate');
        const publicQuestions = await this.kvStore.getPublicQuestions();
        return createHtmlResponse(
          getQuestionsTemplate(publicQuestions, '有答案不正确，请重新作答。')
        );
      }

      await this.authService.clearFailures(request, 'validate');

      const sessionId = this.authService.generateSessionId();
      await this.authService.createSession(sessionId, {
        isAdmin: false,
        username: '访客'
      });

      const response = createRedirectResponse('/');
      return this.authService.setSessionCookie(response, sessionId);
    } catch (error) {
      console.error('处理验证请求失败:', error);
      return createErrorResponse('验证失败', 500);
    }
  }

  /**
   * 处理登出请求（普通用户 / 管理员通用）
   */
  async handleLogout(request) {
    try {
      const sessionId = this.authService.getSessionIdFromRequest(request);
      if (sessionId) {
        await this.authService.deleteSession(sessionId);
      }
      const response = createRedirectResponse('/');
      return this.authService.clearSessionCookie(response);
    } catch (error) {
      console.error('处理登出请求失败:', error);
      return createErrorResponse('登出失败', 500);
    }
  }

  /**
   * 处理管理员后台请求（支持分页）——必须持有有效的管理员会话
   */
  async handleAdmin(request) {
    try {
      const sessionId = this.authService.getSessionIdFromRequest(request);
      const session = sessionId ? await this.authService.getSession(sessionId) : null;

      if (!session || !session.isAdmin) {
        return createHtmlResponse(getAdminLoginTemplate());
      }

      const url = new URL(request.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
      const pageSize = 10;

      const paginationData = await this.kvStore.getQuestions(page, pageSize);
      return createHtmlResponse(getAdminTemplate(paginationData, session.csrfToken));
    } catch (error) {
      console.error('处理管理员后台请求失败:', error);
      return createErrorResponse('处理管理员后台请求失败', 500);
    }
  }

  /**
   * 处理管理员登录页面（GET）
   */
  async handleAdminLoginPage() {
    return createHtmlResponse(getAdminLoginTemplate());
  }

  /**
   * 处理管理员登录请求（POST），带暴力破解限流
   */
  async handleAdminLogin(request) {
    try {
      const allowed = await this.authService.checkRateLimit(request, 'admin-login');
      if (!allowed) {
        return createHtmlResponse(
          getAdminLoginTemplate('尝试次数过多，请 15 分钟后再试。')
        );
      }

      const formData = await request.formData();
      const password = formData.get('password');

      const isValidPassword = await this.authService.validateAdminPassword(password);
      if (!isValidPassword) {
        await this.authService.recordFailure(request, 'admin-login');
        return createHtmlResponse(getAdminLoginTemplate('密码错误。'));
      }

      await this.authService.clearFailures(request, 'admin-login');

      const sessionId = this.authService.generateSessionId();
      await this.authService.createSession(sessionId, {
        isAdmin: true,
        username: '管理员'
      });

      const response = createRedirectResponse('/admin');
      return this.authService.setSessionCookie(response, sessionId);
    } catch (error) {
      console.error('处理管理员登录请求失败:', error);
      return createErrorResponse('管理员登录失败', 500);
    }
  }

  /**
   * 校验请求是否来自已登录管理员，并且 CSRF token 有效。
   * 返回 { ok, session } —— ok 为 false 时调用方应直接返回错误响应。
   */
  async _requireAdminWithCsrf(request, formData) {
    const sessionId = this.authService.getSessionIdFromRequest(request);
    const session = sessionId ? await this.authService.getSession(sessionId) : null;

    if (!session || !session.isAdmin) {
      return { ok: false, response: createErrorResponse('未授权', 401) };
    }

    const csrfToken = formData.get('csrf_token');
    if (!this.authService.verifyCsrfToken(session, csrfToken)) {
      return { ok: false, response: createErrorResponse('CSRF 校验失败', 403) };
    }

    return { ok: true, session };
  }

  /**
   * 处理添加问题请求（仅管理员）
   */
  async handleAddQuestion(request) {
    try {
      const formData = await request.formData();
      const check = await this._requireAdminWithCsrf(request, formData);
      if (!check.ok) return check.response;

      const question = formData.get('question');
      const answer = formData.get('answer');

      const result = await this.kvStore.addQuestion(question, answer);
      if (!result.ok) {
        return createErrorResponse(result.error, 400);
      }

      return createRedirectResponse('/admin');
    } catch (error) {
      console.error('处理添加问题请求失败:', error);
      return createErrorResponse('添加问题失败', 500);
    }
  }

  /**
   * 处理删除问题请求（仅管理员）
   */
  async handleDeleteQuestion(request) {
    try {
      const formData = await request.formData();
      const check = await this._requireAdminWithCsrf(request, formData);
      if (!check.ok) return check.response;

      const questionId = formData.get('id');
      if (!questionId) {
        return createErrorResponse('问题ID不能为空', 400);
      }

      await this.kvStore.deleteQuestion(questionId);
      return createRedirectResponse('/admin');
    } catch (error) {
      console.error('处理删除问题请求失败:', error);
      return createErrorResponse('删除问题失败', 500);
    }
  }
}
