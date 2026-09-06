// 路由处理 - 处理所有HTTP请求
import { AuthService } from './auth.js';
import { KVStore } from './kv.js';
import {
  getQuestionStepTemplate,
  getEmptyQuestionsTemplate,
  getAdminLoginTemplate,
  getAdminTemplate
} from './templates.js';
import { getSuccessPageTemplate } from './pages/success.js';
import { createHtmlResponse, createRedirectResponse, createErrorResponse } from './utils.js';

/**
 * 路由处理器类
 */
export class RouteHandler {
  constructor(env) {
    this.env = env;
    this.authService = new AuthService(env);
    this.kvStore = new KVStore(env);
  }

  // -----------------------------------------------------------------------
  // 公开：入口 / 一页一题问答流程
  // -----------------------------------------------------------------------

  /**
   * 根路径：已验证 -> 独立成功页；进行中 -> 跳到当前题目；否则开启一次新的问答流程
   */
  async handleRoot(request) {
    try {
      const sessionId = this.authService.getSessionIdFromRequest(request);
      const session = sessionId ? await this.authService.getSession(sessionId) : null;

      if (session && session.verified) {
        return createHtmlResponse(getSuccessPageTemplate(session));
      }

      if (session && Array.isArray(session.questionOrder)) {
        return createRedirectResponse('/question');
      }

      const publicQuestions = await this.kvStore.getPublicQuestions();
      if (publicQuestions.length === 0) {
        return createHtmlResponse(getEmptyQuestionsTemplate());
      }

      const newSessionId = this.authService.generateSessionId();
      await this.authService.createSession(newSessionId, {
        isAdmin: false,
        verified: false,
        username: '访客',
        questionOrder: publicQuestions.map(q => q.id),
        currentIndex: 0
      });

      const response = createRedirectResponse('/question');
      return this.authService.setSessionCookie(response, newSessionId);
    } catch (error) {
      console.error('处理根路径请求失败:', error);
      return createErrorResponse('页面加载失败', 500);
    }
  }

  /**
   * 展示当前进度对应的那一题。进度完全来自服务端 session，客户端无法跳题。
   */
  async handleQuestionPage(request) {
    try {
      const sessionId = this.authService.getSessionIdFromRequest(request);
      const session = sessionId ? await this.authService.getSession(sessionId) : null;

      if (!session || session.isAdmin || !Array.isArray(session.questionOrder)) {
        return createRedirectResponse('/');
      }
      if (session.verified) {
        return createRedirectResponse('/');
      }

      const total = session.questionOrder.length;
      const idx = session.currentIndex || 0;

      if (idx >= total) {
        // 理论上不会出现（提交答案时已经会转成 verified），兜底处理
        await this.authService.updateSession(sessionId, { verified: true });
        return createRedirectResponse('/');
      }

      const questionId = session.questionOrder[idx];
      const question = await this.kvStore.getQuestion(questionId);
      if (!question) {
        // 题目在答题过程中被后台删除了，跳过它
        await this.authService.updateSession(sessionId, { currentIndex: idx + 1 });
        return createRedirectResponse('/question');
      }

      const isLast = idx === total - 1;
      const messageSettings = isLast ? await this.kvStore.getMessageSettings() : null;

      const publicQuestion = {
        id: question.id,
        question: question.question,
        type: question.type,
        options: question.options
      };

      return createHtmlResponse(getQuestionStepTemplate({
        question: publicQuestion,
        index: idx + 1,
        total,
        csrfToken: session.csrfToken,
        showMessage: !!(isLast && messageSettings && messageSettings.enabled),
        messagePrompt: messageSettings ? messageSettings.prompt : ''
      }));
    } catch (error) {
      console.error('展示题目失败:', error);
      return createErrorResponse('页面加载失败', 500);
    }
  }

  /**
   * 提交当前题目的答案：答错则停在原地重新作答，答对才推进进度；
   * 最后一题正确后，顺带保存可选留言，并把 session 标记为已验证。
   */
  async handleQuestionAnswer(request) {
    try {
      const sessionId = this.authService.getSessionIdFromRequest(request);
      const session = sessionId ? await this.authService.getSession(sessionId) : null;

      if (!session || session.isAdmin || !Array.isArray(session.questionOrder) || session.verified) {
        return createRedirectResponse('/');
      }

      const formData = await request.formData();

      if (!this.authService.verifyCsrfToken(session, formData.get('csrf_token'))) {
        return createErrorResponse('CSRF 校验失败', 403);
      }

      const total = session.questionOrder.length;
      const idx = session.currentIndex || 0;
      if (idx >= total) {
        return createRedirectResponse('/');
      }

      const questionId = session.questionOrder[idx];
      const question = await this.kvStore.getQuestion(questionId);
      const isLast = idx === total - 1;

      if (!question) {
        await this.authService.updateSession(sessionId, { currentIndex: idx + 1 });
        return createRedirectResponse('/question');
      }

      const allowed = await this.authService.checkRateLimit(request, 'validate');
      const publicQuestion = {
        id: question.id,
        question: question.question,
        type: question.type,
        options: question.options
      };
      const messageSettings = isLast ? await this.kvStore.getMessageSettings() : null;
      const showMessage = !!(isLast && messageSettings && messageSettings.enabled);

      if (!allowed) {
        return createHtmlResponse(getQuestionStepTemplate({
          question: publicQuestion,
          index: idx + 1,
          total,
          csrfToken: session.csrfToken,
          errorMessage: '尝试次数过多，请 15 分钟后再试。',
          showMessage,
          messagePrompt: messageSettings ? messageSettings.prompt : ''
        }));
      }

      const submitted = formData.get('answer');
      const correct = await this.kvStore.verifyAnswer(question, submitted);

      if (!correct) {
        await this.authService.recordFailure(request, 'validate');
        return createHtmlResponse(getQuestionStepTemplate({
          question: publicQuestion,
          index: idx + 1,
          total,
          csrfToken: session.csrfToken,
          errorMessage: '答案不正确，请重新作答。',
          showMessage,
          messagePrompt: messageSettings ? messageSettings.prompt : ''
        }));
      }

      await this.authService.clearFailures(request, 'validate');

      if (isLast) {
        if (showMessage) {
          // 留言不做必填、不做格式校验，为空会被静默跳过
          await this.kvStore.saveMessage(formData.get('message'));
        }
        await this.authService.updateSession(sessionId, { verified: true, currentIndex: total });
      } else {
        await this.authService.updateSession(sessionId, { currentIndex: idx + 1 });
      }

      return createRedirectResponse('/');
    } catch (error) {
      console.error('处理答题请求失败:', error);
      return createErrorResponse('提交失败', 500);
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

  // -----------------------------------------------------------------------
  // 管理员
  // -----------------------------------------------------------------------

  async handleAdmin(request) {
    try {
      const sessionId = this.authService.getSessionIdFromRequest(request);
      const session = sessionId ? await this.authService.getSession(sessionId) : null;

      if (!session || !session.isAdmin) {
        return createHtmlResponse(getAdminLoginTemplate());
      }

      const url = new URL(request.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);

      const paginationData = await this.kvStore.getQuestions(page, 10);
      const messageSettings = await this.kvStore.getMessageSettings();
      const messagesData = await this.kvStore.getMessages(1, 10);

      return createHtmlResponse(
        getAdminTemplate(paginationData, session.csrfToken, messageSettings, messagesData)
      );
    } catch (error) {
      console.error('处理管理员后台请求失败:', error);
      return createErrorResponse('处理管理员后台请求失败', 500);
    }
  }

  async handleAdminLoginPage() {
    return createHtmlResponse(getAdminLoginTemplate());
  }

  async handleAdminLogin(request) {
    try {
      const allowed = await this.authService.checkRateLimit(request, 'admin-login');
      if (!allowed) {
        return createHtmlResponse(getAdminLoginTemplate('尝试次数过多，请 15 分钟后再试。'));
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
   * 校验请求是否来自已登录管理员，并且 CSRF token 有效
   */
  async _requireAdminWithCsrf(request, formData) {
    const sessionId = this.authService.getSessionIdFromRequest(request);
    const session = sessionId ? await this.authService.getSession(sessionId) : null;

    if (!session || !session.isAdmin) {
      return { ok: false, response: createErrorResponse('未授权', 401) };
    }

    if (!this.authService.verifyCsrfToken(session, formData.get('csrf_token'))) {
      return { ok: false, response: createErrorResponse('CSRF 校验失败', 403) };
    }

    return { ok: true, session };
  }

  async handleAddQuestion(request) {
    try {
      const formData = await request.formData();
      const check = await this._requireAdminWithCsrf(request, formData);
      if (!check.ok) return check.response;

      const type = formData.get('type') === 'choice' ? 'choice' : 'text';
      const question = formData.get('question');
      const answer = formData.get('answer');
      const options = type === 'choice'
        ? [1, 2, 3, 4, 5, 6].map(i => formData.get(`option_${i}`))
        : undefined;

      const result = await this.kvStore.addQuestion({ question, type, answer, options });
      if (!result.ok) {
        return createErrorResponse(result.error, 400);
      }

      return createRedirectResponse('/admin');
    } catch (error) {
      console.error('处理添加问题请求失败:', error);
      return createErrorResponse('添加问题失败', 500);
    }
  }

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

  async handleAdminSettings(request) {
    try {
      const formData = await request.formData();
      const check = await this._requireAdminWithCsrf(request, formData);
      if (!check.ok) return check.response;

      const enabled = formData.get('enabled') === 'on';
      const prompt = formData.get('prompt');

      await this.kvStore.updateMessageSettings({ enabled, prompt });
      return createRedirectResponse('/admin');
    } catch (error) {
      console.error('保存留言设置失败:', error);
      return createErrorResponse('保存设置失败', 500);
    }
  }

  async handleDeleteMessage(request) {
    try {
      const formData = await request.formData();
      const check = await this._requireAdminWithCsrf(request, formData);
      if (!check.ok) return check.response;

      const id = formData.get('id');
      if (!id) {
        return createErrorResponse('留言ID不能为空', 400);
      }

      await this.kvStore.deleteMessage(id);
      return createRedirectResponse('/admin');
    } catch (error) {
      console.error('删除留言失败:', error);
      return createErrorResponse('删除留言失败', 500);
    }
  }
}
