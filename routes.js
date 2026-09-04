// 路由处理函数 - 处理各种路由请求

import { PATH_ROOT, PATH_ADMIN, PATH_LOGOUT, PATH_VALIDATE, HTTP_STATUS } from './config.js';
import { AuthService } from './auth.js';
import { KVStore } from './kv.js';
import { createHtmlResponse, createJsonResponse } from './utils.js';

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
      const welcomeHtml = this.getWelcomeHtml(userInfo);
      return createHtmlResponse(HTTP_STATUS.OK, welcomeHtml);
    } else {
      // 未通过验证，显示问题页面
      const questions = await this.kvStore.getQuestions();
      const questionsHtml = this.getQuestionsHtml(questions);
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

      for (const question of questions) {
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
          totalQuestions: questions.length
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
   * 处理管理员后台请求
   * @param {Request} request 请求对象
   * @param {Object} env 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async handleAdmin(request, env) {
    try {
      // 检查管理员密码
      const formData = await request.formData();
      const password = formData.get('password');

      if (!this.authService.validateAdminPassword(password)) {
        return createHtmlResponse(HTTP_STATUS.UNAUTHORIZED, this.getAdminLoginHtml());
      }

      // 获取问题列表
      const questions = await this.kvStore.getQuestions();
      const adminHtml = this.getAdminHtml(questions);
      return createHtmlResponse(HTTP_STATUS.OK, adminHtml);
    } catch (error) {
      console.error('管理员请求处理失败:', error);
      return createHtmlResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, this.getAdminErrorHtml());
    }
  }

  /**
   * 获取问题页面HTML
   * @param {Array} questions 问题列表
   * @returns {string} HTML内容
   */
  getQuestionsHtml(questions) {
    let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>问答验证系统</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        .question {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .question h3 {
            margin-top: 0;
            color: #333;
        }
        .answer-input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 3px;
            font-size: 16px;
        }
        .submit-btn {
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        .submit-btn:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <h1>问答验证系统</h1>
    <p>请回答以下所有问题，全部正确后方可访问内容。</p>
    <form id="qaForm" method="POST" action="/validate">
    `;

    for (const question of questions) {
      html += `
        <div class="question">
            <h3>问题 ${question.id}: ${question.question}</h3>
            <input type="text" 
                   name="answer_${question.id}" 
                   class="answer-input" 
                   placeholder="请输入答案" 
                   required>
        </div>
      `;
    }

    html += `
        <button type="submit" class="submit-btn">提交验证</button>
    </form>
</body>
</html>
    `;

    return html;
  }

  /**
   * 获取欢迎页面HTML
   * @param {Object} userInfo 用户信息
   * @returns {string} HTML内容
   */
  getWelcomeHtml(userInfo) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>欢迎</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        .welcome {
            text-align: center;
            padding: 40px;
            background-color: #f8f9fa;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .logout-btn {
            background-color: #dc3545;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        .logout-btn:hover {
            background-color: #c82333;
        }
    </style>
</head>
<body>
    <div class="welcome">
        <h1>欢迎！</h1>
        <p>您已成功通过验证，可以访问本网站内容。</p>
        <p>验证时间: ${new Date().toLocaleString()}</p>
    </div>
    <button class="logout-btn" onclick="window.location.href='/logout'">退出登录</button>
</body>
</html>
    `;
  }

  /**
   * 获取管理员登录页面HTML
   * @returns {string} HTML内容
   */
  getAdminLoginHtml() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理员登录</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
        }
        .login-form {
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .password-input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 3px;
            margin-bottom: 10px;
        }
        .login-btn {
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            width: 100%;
        }
        .login-btn:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <h1>管理员登录</h1>
    <form class="login-form" method="POST" action="/admin">
        <input type="password" 
               name="password" 
               class="password-input" 
               placeholder="请输入管理员密码" 
               required>
        <button type="submit" class="login-btn">登录</button>
    </form>
</body>
</html>
    `;
  }

  /**
   * 获取管理员页面HTML
   * @param {Array} questions 问题列表
   * @returns {string} HTML内容
   */
  getAdminHtml(questions) {
    let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理员后台</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }
        .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }
        .question-list {
            margin-bottom: 20px;
        }
        .question-item {
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            margin-bottom: 10px;
        }
        .add-form {
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .form-group input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 3px;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-right: 10px;
        }
        .btn-primary {
            background-color: #007bff;
            color: white;
        }
        .btn-primary:hover {
            background-color: #0056b3;
        }
        .btn-danger {
            background-color: #dc3545;
            color: white;
        }
        .btn-danger:hover {
            background-color: #c82333;
        }
        .btn-success {
            background-color: #28a745;
            color: white;
        }
        .btn-success:hover {
            background-color: #218838;
        }
    </style>
</head>
<body>
    <div class="admin-header">
        <h1>管理员后台</h1>
        <a href="/" class="btn btn-primary">返回首页</a>
    </div>

    <div class="question-list">
        <h2>问题列表</h2>
    `;

    for (const question of questions) {
      html += `
        <div class="question-item">
            <h3>问题 ${question.id}: ${question.question}</h3>
            <p><strong>正确答案:</strong> ${question.answer}</p>
            <form method="POST" action="/admin/delete" style="display: inline;">
                <input type="hidden" name="id" value="${question.id}">
                <button type="submit" class="btn btn-danger">删除</button>
            </form>
        </div>
      `;
    }

    html += `
    </div>

    <div class="add-form">
        <h2>添加新问题</h2>
        <form method="POST" action="/admin/add">
            <div class="form-group">
                <label for="question">问题内容:</label>
                <input type="text" id="question" name="question" required>
            </div>
            <div class="form-group">
                <label for="answer">正确答案:</label>
                <input type="text" id="answer" name="answer" required>
            </div>
            <button type="submit" class="btn btn-success">添加问题</button>
        </form>
    </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * 获取管理员错误页面HTML
   * @returns {string} HTML内容
   */
  getAdminErrorHtml() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>错误</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
        }
        .error-message {
            color: #dc3545;
            padding: 20px;
            border: 1px solid #dc3545;
            border-radius: 5px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="error-message">
        <h1>服务器错误</h1>
        <p>请稍后重试。</p>
    </div>
</body>
</html>
    `;
  }
}
