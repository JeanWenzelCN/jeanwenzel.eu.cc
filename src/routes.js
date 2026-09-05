// 路由处理函数 - 处理各种路由请求

import { PATH_ROOT, PATH_ADMIN, PATH_LOGOUT, PATH_VALIDATE, HTTP_STATUS } from './config.js';
import { AuthService } from './auth.js';
import { KVStore } from './kv.js';
import { createHtmlResponse, createJsonResponse } from './utils.js';
import { getQuestionsTemplate, getWelcomeTemplate, getAdminLoginTemplate, getAdminTemplate } from './templates.js';

/**
 * 路由处理器类
 */
export class RouteHandler {
  /**
   * 构造函数
   * @param {Object} env 环境变量
   */
  constructor(env) {
    this.authService = new AuthService(env);
    this.kvStore = new KVStore(env);
  }

  /**
   * 处理根路径请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleRoot(request, env) {
    // 检查是否有有效的会话
    const sessionId = this.authService.getSessionId(request);
    const isAuthenticated = await this.authService.validateSession(sessionId);

    if (isAuthenticated) {
      // 已通过验证，显示欢迎页面
      const userInfo = await this.authService.getCurrentUser(request);
      const welcomeHtml = getWelcomeTemplate(userInfo);
      return createHtmlResponse(HTTP_STATUS.OK, welcomeHtml);
    } else {
      // 未通过验证，显示问题页面
      const questions = await this.kvStore.getQuestions();
      const questionsHtml = getQuestionsTemplate(questions.questions);
      return createHtmlResponse(HTTP_STATUS.OK, questionsHtml);
    }
  }

  /**
   * 处理验证请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleValidate(request, env) {
    try {
      const formData = await request.formData();
      const answers = {};

      // 收集所有答案
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('answer_')) {
          const questionId = key.replace('answer_', '');
          answers[questionId] = value.toString();
        }
      }

      // 验证答案
      const questions = await this.kvStore.getQuestions();
      let allCorrect = true;
      const results = [];

      for (const question of questions.questions) {
        const userAnswer = answers[question.id] || '';
        const isCorrect = userAnswer === question.answer;
        
        results.push({
          id: question.id,
          question: question.question,
          userAnswer: userAnswer,
          correctAnswer: question.answer,
          isCorrect: isCorrect
        });

        if (!isCorrect) {
          allCorrect = false;
        }
      }

      // 如果全部正确，创建会话
      if (allCorrect) {
        const sessionId = await this.authService.createSession({
          verifiedAt: new Date().toISOString(),
          totalQuestions: questions.questions.length
        });
        
        const response = new Response(JSON.stringify({
          success: true,
          message: '验证成功！',
          sessionId: sessionId
        }), {
          status: HTTP_STATUS.OK,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': this.authService.setSessionCookie(sessionId),
            'Access-Control-Allow-Origin': '*'
          }
        });
        
        return response;
      } else {
        // 验证失败
        return createJsonResponse(HTTP_STATUS.BAD_REQUEST, {
          success: false,
          message: '验证失败，请检查答案',
          results: results
        });
      }
    } catch (error) {
      console.error('验证请求处理失败:', error);
      return createJsonResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  /**
   * 处理登出请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleLogout(request, env) {
    try {
      const sessionId = this.authService.getSessionId(request);
      if (sessionId) {
        await this.authService.destroySession(sessionId);
      }

      const response = new Response(JSON.stringify({
        success: true,
        message: '已成功退出登录'
      }), {
        status: HTTP_STATUS.OK,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': this.authService.clearSessionCookie(),
          'Access-Control-Allow-Origin': '*'
        }
      });

      return response;
    } catch (error) {
      console.error('登出请求处理失败:', error);
      return createJsonResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  /**
   * 处理管理员后台请求（支持分页）
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAdmin(request, env) {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page')) || 1;
      const pageSize = 10; // 每页显示10个问题

      // 检查管理员密码
      if (request.method === 'POST') {
        const formData = await request.formData();
        const password = formData.get('password');

        if (!this.authService.validateAdminPassword(password)) {
          return createHtmlResponse(HTTP_STATUS.UNAUTHORIZED, getAdminLoginTemplate());
        }
      }

      // 获取分页问题列表
      const paginationData = await this.kvStore.getQuestions(page, pageSize);
      const adminHtml = getAdminTemplate(paginationData);
      return createHtmlResponse(HTTP_STATUS.OK, adminHtml);
    } catch (error) {
      console.error('管理员请求处理失败:', error);
      return createHtmlResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, getAdminLoginTemplate());
    }
  }

  /**
   * 处理添加问题请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAddQuestion(request, env) {
    try {
      // 检查管理员权限
      const sessionId = this.authService.getSessionId(request);
      const isAdmin = await this.authService.isAdmin(sessionId);
      
      if (!isAdmin) {
        return createJsonResponse(HTTP_STATUS.UNAUTHORIZED, {
          success: false,
          message: '需要管理员权限'
        });
      }

      const formData = await request.formData();
      const question = formData.get('question');
      const answer = formData.get('answer');

      if (!question || !answer) {
        return createJsonResponse(HTTP_STATUS.BAD_REQUEST, {
          success: false,
          message: '问题内容和答案不能为空'
        });
      }

      // 生成随机ID
      const questionId = 'q' + Date.now();
      
      // 创建问题对象
      const questionData = {
        id: questionId,
        question: question.toString(),
        answer: answer.toString(),
        salt: this.kvStore.generateSalt()
      };

      // 保存问题
      const success = await this.kvStore.saveQuestion(questionId, questionData);
      
      if (success) {
        return createJsonResponse(HTTP_STATUS.OK, {
          success: true,
          message: '问题添加成功',
          questionId: questionId
        });
      } else {
        return createJsonResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
          success: false,
          message: '保存问题失败'
        });
      }
    } catch (error) {
      console.error('添加问题请求处理失败:', error);
      return createJsonResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  /**
   * 处理删除问题请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleDeleteQuestion(request, env) {
    try {
      // 检查管理员权限
      const sessionId = this.authService.getSessionId(request);
      const isAdmin = await this.authService.isAdmin(sessionId);
      
      if (!isAdmin) {
        return createJsonResponse(HTTP_STATUS.UNAUTHORIZED, {
          success: false,
          message: '需要管理员权限'
        });
      }

      const formData = await request.formData();
      const questionId = formData.get('id');

      if (!questionId) {
        return createJsonResponse(HTTP_STATUS.BAD_REQUEST, {
          success: false,
          message: '问题ID不能为空'
        });
      }

      // 删除问题
      const success = await this.kvStore.deleteQuestion(questionId);
      
      if (success) {
        return createJsonResponse(HTTP_STATUS.OK, {
          success: true,
          message: '问题删除成功'
        });
      } else {
        return createJsonResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
          success: false,
          message: '删除问题失败'
        });
      }
    } catch (error) {
      console.error('删除问题请求处理失败:', error);
      return createJsonResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  /**
   * 处理管理员登录页面（GET请求）
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAdminLogin(request, env) {
    return createHtmlResponse(HTTP_STATUS.OK, getAdminLoginTemplate());
  }
}
