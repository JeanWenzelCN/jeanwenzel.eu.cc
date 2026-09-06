// HTML模板文件 - 提供可复用的HTML模板
import { escapeHtml } from './utils.js';

/**
 * 获取基础HTML模板（统一配色：低饱和的蓝灰色系）
 * @param {string} title 页面标题
 * @param {string} content 页面内容
 * @returns {string} 完整的HTML
 */
export function getBaseHtml(title, content) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        :root {
            --color-ink: #2C3E56;       /* 标题、深色文字 */
            --color-primary: #225577;   /* 主色：按钮、链接、强调 */
            --color-slate: #525367;     /* 次要文字、边框强调 */
            --color-bg: #F3F4F6;        /* 页面背景 */
            --color-surface: #FFFFFF;   /* 卡片背景 */
            --color-border: #DCE0E6;
            --color-muted: #7B7F8C;
            --color-danger: #A3454C;
            --color-danger-bg: #F6E9EA;
            --color-success: #3D7259;
            --color-success-bg: #E9F1EC;
            --color-progress-bg: #E3E6EB;
            --radius: 10px;
        }
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
            max-width: 640px;
            margin: 0 auto;
            padding: 32px 20px 60px;
            line-height: 1.65;
            background: var(--color-bg);
            color: var(--color-ink);
        }
        .header {
            text-align: center;
            margin-bottom: 28px;
        }
        .header h1 {
            font-size: 1.4rem;
            font-weight: 600;
            color: var(--color-ink);
            margin: 0;
        }
        .panel {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius);
            padding: 20px;
            margin-bottom: 16px;
        }
        .panel--accent {
            border-top: 3px solid var(--color-primary);
        }
        .muted { color: var(--color-muted); font-size: 0.9rem; }
        code {
            background: var(--color-bg);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.85em;
        }
        .btn {
            padding: 10px 18px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.95rem;
            margin-right: 8px;
            margin-top: 6px;
            text-decoration: none;
            display: inline-block;
            transition: opacity 0.15s ease;
        }
        .btn:hover { opacity: 0.88; }
        .btn-primary { background-color: var(--color-primary); color: #fff; }
        .btn-danger { background-color: var(--color-danger); color: #fff; }
        .btn-success { background-color: var(--color-success); color: #fff; }
        .btn-outline {
            background: transparent;
            color: var(--color-slate);
            border: 1px solid var(--color-border);
        }
        .error {
            color: var(--color-danger);
            background-color: var(--color-danger-bg);
            border: 1px solid var(--color-danger);
            padding: 10px 14px;
            border-radius: 8px;
            margin-bottom: 18px;
            font-size: 0.92rem;
        }
        .success {
            color: var(--color-success);
            background-color: var(--color-success-bg);
            border: 1px solid var(--color-success);
            padding: 10px 14px;
            border-radius: 8px;
            margin-bottom: 18px;
        }
        .form-group { margin-bottom: 16px; }
        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-weight: 600;
            color: var(--color-slate);
            font-size: 0.92rem;
        }
        .form-group input[type="text"],
        .form-group input[type="password"],
        .form-group textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--color-border);
            border-radius: 8px;
            font-size: 1rem;
            background: var(--color-bg);
            color: var(--color-ink);
        }
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--color-primary);
        }
        .option-list { display: flex; flex-direction: column; gap: 10px; margin: 4px 0 6px; }
        .option-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border: 1px solid var(--color-border);
            border-radius: 8px;
            background: var(--color-bg);
            cursor: pointer;
        }
        .option-item input { accent-color: var(--color-primary); }
        .progress {
            height: 8px;
            background: var(--color-progress-bg);
            border-radius: 999px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        .progress__bar {
            height: 100%;
            background: var(--color-primary);
            border-radius: 999px;
            transition: width 0.2s ease;
        }
        .progress__label {
            font-size: 0.85rem;
            color: var(--color-muted);
            margin-bottom: 18px;
            text-align: right;
        }
        .question-item {
            padding: 14px 16px;
            border: 1px solid var(--color-border);
            border-radius: var(--radius);
            margin-bottom: 10px;
            background: var(--color-surface);
        }
        .question-item h3 { margin: 0 0 6px; font-size: 1rem; color: var(--color-ink); }
        .badge {
            display: inline-block;
            font-size: 0.72rem;
            padding: 2px 8px;
            border-radius: 999px;
            background: var(--color-bg);
            color: var(--color-slate);
            border: 1px solid var(--color-border);
            margin-left: 6px;
            vertical-align: middle;
        }
        .pagination {
            display: flex; justify-content: center; align-items: center;
            margin-top: 16px; gap: 6px; flex-wrap: wrap;
        }
        .pagination button {
            padding: 6px 12px; border: 1px solid var(--color-border);
            background-color: var(--color-surface); cursor: pointer; border-radius: 6px;
            color: var(--color-slate);
        }
        .pagination button.active { background-color: var(--color-primary); color: #fff; border-color: var(--color-primary); }
        .pagination button:disabled { opacity: 0.45; cursor: not-allowed; }
        .pagination-info { margin: 0 8px; font-size: 0.85rem; color: var(--color-muted); }
        .message-item {
            padding: 12px 14px;
            border: 1px solid var(--color-border);
            border-radius: 8px;
            margin-bottom: 8px;
            background: var(--color-bg);
        }
        .message-item .meta { font-size: 0.78rem; color: var(--color-muted); margin-top: 6px; }
        h2 { font-size: 1.1rem; color: var(--color-ink); margin-top: 0; }
        hr { border: none; border-top: 1px solid var(--color-border); margin: 24px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${escapeHtml(title)}</h1>
    </div>
    ${content}
</body>
</html>
  `;
}

/**
 * 单题页面（一页一题模式）
 * @param {Object} params
 * @param {Object} params.question 当前题目（公开字段：id/question/type/options）
 * @param {number} params.index 当前是第几题（1-based）
 * @param {number} params.total 总题数
 * @param {string} params.csrfToken
 * @param {string} [params.errorMessage] 上一次作答错误时的提示
 * @param {boolean} [params.showMessage] 是否在本题展示留言框（最后一题时为 true）
 * @param {string} [params.messagePrompt] 留言框提示语
 * @returns {string}
 */
export function getQuestionStepTemplate({
  question,
  index,
  total,
  csrfToken,
  errorMessage = '',
  showMessage = false,
  messagePrompt = ''
}) {
  const progressPercent = total > 0 ? Math.round(((index - 1) / total) * 100) : 0;

  let inputBlock;
  if (question.type === 'choice') {
    const options = Array.isArray(question.options) ? question.options : [];
    inputBlock = `
      <div class="option-list">
        ${options.map((opt, i) => `
          <label class="option-item">
            <input type="radio" name="answer" value="${escapeHtml(opt)}" required>
            <span>${escapeHtml(opt)}</span>
          </label>
        `).join('')}
      </div>
    `;
  } else {
    inputBlock = `
      <div class="form-group">
        <input type="text" name="answer" maxlength="100" required autofocus>
      </div>
    `;
  }

  const messageBlock = showMessage ? `
    <div class="form-group">
      <label for="message">${escapeHtml(messagePrompt)}</label>
      <textarea id="message" name="message" rows="3" maxlength="500"></textarea>
    </div>
  ` : '';

  const content = `
    <div class="panel">
      <div class="progress"><div class="progress__bar" style="width:${progressPercent}%"></div></div>
      <div class="progress__label">第 ${index} / ${total} 题</div>

      ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}

      <form method="POST" action="/question/answer">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <h3>${escapeHtml(question.question)}</h3>
        ${inputBlock}
        ${messageBlock}
        <button type="submit" class="btn btn-primary">${index >= total ? '提交并完成' : '下一题'}</button>
      </form>
    </div>
  `;

  return getBaseHtml('问答验证', content);
}

/**
 * 暂无题目 / 起始占位页
 */
export function getEmptyQuestionsTemplate() {
  const content = `
    <div class="panel">
      <p>暂无验证问题，请联系管理员配置题目。</p>
    </div>
  `;
  return getBaseHtml('问答验证', content);
}

/**
 * 管理员登录模板
 */
export function getAdminLoginTemplate(errorMessage = '') {
  const content = `
    <div class="panel">
      ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}
      <form method="POST" action="/admin/login">
          <div class="form-group">
              <label for="password">管理员密码</label>
              <input type="password" id="password" name="password" required>
          </div>
          <button type="submit" class="btn btn-primary">登录</button>
      </form>
    </div>
  `;
  return getBaseHtml('管理员登录', content);
}

/**
 * 管理员后台模板
 * @param {Object} paginationData 题目分页数据
 * @param {string} csrfToken
 * @param {Object} messageSettings { enabled, prompt }
 * @param {Object} messagesData 留言分页数据
 */
export function getAdminTemplate(paginationData, csrfToken, messageSettings, messagesData) {
  const { questions, total, totalPages, currentPage } = paginationData;
  const token = escapeHtml(csrfToken);

  // ---- 题目列表 ----
  let content = '<div class="panel"><h2>题目列表</h2>';

  if (questions.length === 0) {
    content += '<p class="muted">暂无题目数据</p>';
  } else {
    for (const question of questions) {
      const typeLabel = question.type === 'choice' ? '选择题' : '文本题';
      let optionsPreview = '';
      if (question.type === 'choice' && Array.isArray(question.options)) {
        optionsPreview = `<p class="muted">选项：${question.options.map(escapeHtml).join(' / ')}</p>`;
      }
      content += `
        <div class="question-item">
          <h3>${escapeHtml(question.question)} <span class="badge">${typeLabel}</span></h3>
          ${optionsPreview}
          <p class="muted"><em>答案以哈希形式安全存储，后台不回显明文</em></p>
          <form method="POST" action="/admin/delete" style="display: inline;">
              <input type="hidden" name="csrf_token" value="${token}">
              <input type="hidden" name="id" value="${escapeHtml(question.id)}">
              <button type="submit" class="btn btn-danger">删除</button>
          </form>
        </div>
      `;
    }
  }

  if (totalPages > 1) {
    content += '<div class="pagination">';
    content += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="window.location.href='/admin?page=${currentPage - 1}'">上一页</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        content += `<button class="${i === currentPage ? 'active' : ''}" onclick="window.location.href='/admin?page=${i}'">${i}</button>`;
      } else if (i === currentPage - 3 || i === currentPage + 3) {
        content += '<span>...</span>';
      }
    }
    content += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="window.location.href='/admin?page=${currentPage + 1}'">下一页</button>`;
    content += `<span class="pagination-info">第 ${currentPage} 页，共 ${totalPages} 页，总计 ${total} 个问题</span>`;
    content += '</div>';
  }

  content += '</div>';

  // ---- 添加题目 ----
  content += `
    <div class="panel">
      <h2>添加新题目</h2>
      <form method="POST" action="/admin/add" id="addQuestionForm">
        <input type="hidden" name="csrf_token" value="${token}">

        <div class="form-group">
          <label>题目类型</label>
          <label style="font-weight:400;"><input type="radio" name="type" value="text" checked onchange="qaToggleType()"> 文本题</label>
          &nbsp;&nbsp;
          <label style="font-weight:400;"><input type="radio" name="type" value="choice" onchange="qaToggleType()"> 选择题</label>
        </div>

        <div class="form-group">
          <label for="question">题目内容</label>
          <input type="text" id="question" name="question" maxlength="200" required>
        </div>

        <div id="optionsBlock" style="display:none;">
          <div class="form-group">
            <label>选项（至少填 2 个，最多 6 个）</label>
            <input type="text" name="option_1" maxlength="100" placeholder="选项 1" style="margin-bottom:8px;">
            <input type="text" name="option_2" maxlength="100" placeholder="选项 2" style="margin-bottom:8px;">
            <input type="text" name="option_3" maxlength="100" placeholder="选项 3（选填）" style="margin-bottom:8px;">
            <input type="text" name="option_4" maxlength="100" placeholder="选项 4（选填）" style="margin-bottom:8px;">
            <input type="text" name="option_5" maxlength="100" placeholder="选项 5（选填）" style="margin-bottom:8px;">
            <input type="text" name="option_6" maxlength="100" placeholder="选项 6（选填）">
          </div>
        </div>

        <div class="form-group">
          <label for="answer">正确答案（选择题需与某个选项完全一致）</label>
          <input type="text" id="answer" name="answer" maxlength="100" required>
        </div>

        <button type="submit" class="btn btn-success">添加题目</button>
      </form>
    </div>

    <script>
      function qaToggleType() {
        var isChoice = document.querySelector('input[name="type"]:checked').value === 'choice';
        document.getElementById('optionsBlock').style.display = isChoice ? 'block' : 'none';
      }
    </script>
  `;

  // ---- 留言设置 ----
  content += `
    <div class="panel">
      <h2>留言功能设置</h2>
      <form method="POST" action="/admin/settings">
        <input type="hidden" name="csrf_token" value="${token}">
        <div class="form-group">
          <label style="font-weight:400;">
            <input type="checkbox" name="enabled" ${messageSettings.enabled ? 'checked' : ''}>
            在最后一题展示留言框（访客选填，不做校验）
          </label>
        </div>
        <div class="form-group">
          <label for="prompt">留言提示语</label>
          <input type="text" id="prompt" name="prompt" maxlength="100" value="${escapeHtml(messageSettings.prompt)}">
        </div>
        <button type="submit" class="btn btn-primary">保存设置</button>
      </form>
    </div>
  `;

  // ---- 留言列表 ----
  content += '<div class="panel"><h2>访客留言</h2>';
  if (!messagesData || messagesData.messages.length === 0) {
    content += '<p class="muted">暂无留言</p>';
  } else {
    for (const msg of messagesData.messages) {
      const time = msg.submittedAt ? new Date(msg.submittedAt).toLocaleString('zh-CN') : '';
      content += `
        <div class="message-item">
          <div>${escapeHtml(msg.content)}</div>
          <div class="meta">${escapeHtml(time)}</div>
          <form method="POST" action="/admin/message/delete" style="display:inline;">
            <input type="hidden" name="csrf_token" value="${token}">
            <input type="hidden" name="id" value="${escapeHtml(msg.id)}">
            <button type="submit" class="btn btn-outline">删除</button>
          </form>
        </div>
      `;
    }
  }
  content += '</div>';

  content += `
    <form method="POST" action="/admin/logout">
      <input type="hidden" name="csrf_token" value="${token}">
      <button type="submit" class="btn btn-outline">退出管理员登录</button>
    </form>
  `;

  return getBaseHtml('管理员后台', content);
}
