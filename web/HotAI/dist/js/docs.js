// 文档页面逻辑 - Markdown 渲染版本
document.addEventListener('DOMContentLoaded', () => {
    // ========== 检查依赖库是否加载 ==========
    if (typeof markdownit === 'undefined') {
        console.error('markdown-it 未加载');
        document.getElementById('md-content').innerHTML = '<div style="text-align: center; padding: 60px 20px;"><h2 style="color: #ef4444;">错误：markdown-it 库未加载</h2></div>';
        return;
    }
    
    if (typeof hljs === 'undefined') {
        console.error('highlight.js 未加载');
        document.getElementById('md-content').innerHTML = '<div style="text-align: center; padding: 60px 20px;"><h2 style="color: #ef4444;">错误：highlight.js 库未加载</h2></div>';
        return;
    }

    // ========== 状态管理 ==========
    let sidebarCollapsed = false;
    let currentDocPath = '';

    // ========== DOM 元素引用 ==========
    const searchInput = document.querySelector('.sidebar-search input');
    const searchShortcut = document.querySelector('.sidebar-search span');
    const menuItems = document.querySelectorAll('.menu-item');
    const mdContent = document.getElementById('md-content');
    const tocList = document.getElementById('toc-list');
    const sidebar = document.querySelector('.docs-sidebar-left');
    const bottomBtns = document.querySelectorAll('.bottom-icon-btn');
    const docsContent = document.querySelector('.docs-content');

    // ========== 初始化 markdown-it ==========
    const md = markdownit({
        html: true,
        linkify: true,
        typographer: true,
        highlight: function (str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return '<pre class="hljs"><code>' +
                           hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                           '</code></pre>';
                } catch (__) {}
            }
            return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
        }
    });

    // ========== 加载 Markdown 文档 ==========
    async function loadDoc(path) {
        if (!path || currentDocPath === path) return;
        
        currentDocPath = path;
        
        // 更新 URL hash
        window.location.hash = '#' + path;
        
        // 显示加载状态
        mdContent.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: var(--c-text-secondary);"><p>正在加载文档...</p></div>';
        tocList.innerHTML = '';
        
        try {
            const response = await fetch(path, { cache: 'no-store' });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const markdownText = await response.text();
            
            // 渲染 Markdown 为 HTML
            const htmlContent = md.render(markdownText);
            mdContent.innerHTML = htmlContent;
            
            // 重新应用翻译到动态加载的文档内容
            if (typeof I18n !== 'undefined') {
                I18n.applyTranslations();
            }
            
            // 滚动到顶部
            docsContent.scrollTop = 0;
            
            // 生成目录
            generateTOC();
            
            // 初始化滚动监听
            initTOCScrollSpy();
            
            // 为代码块添加复制按钮
            addCopyButtons();
            
            showToast('文档加载成功', 'success');
            
        } catch (error) {
            console.error('加载文档失败:', error);
            mdContent.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <h2 style="color: #ef4444; margin-bottom: 16px;">⚠️ 文档加载失败</h2>
                    <p style="color: var(--c-text-secondary); margin-bottom: 8px;">无法加载文档：<code>${path}</code></p>
                    <p style="color: var(--c-text-secondary); font-size: 14px;">错误信息：${error.message}</p>
                    <p style="color: var(--c-text-secondary); font-size: 14px; margin-top: 16px;">
                        请确保对应的 <code>.md</code> 文件已创建。
                    </p>
                </div>
            `;
            tocList.innerHTML = '';
            showToast('文档加载失败', 'error');
        }
    }

    // ========== 生成目录 (TOC) ==========
    function generateTOC() {
        const headings = mdContent.querySelectorAll('h1, h2, h3');
        
        if (headings.length === 0) {
            tocList.innerHTML = '<li style="color: var(--c-text-secondary); font-size: 12px;">暂无目录</li>';
            return;
        }
        
        tocList.innerHTML = '';
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1));
            const text = heading.textContent.trim();
            const id = 'heading-' + index;
            
            // 为标题添加 ID，便于锚点跳转
            heading.id = id;
            
            // 创建目录项
            const li = document.createElement('li');
            li.textContent = text;
            li.setAttribute('data-target', id);
            
            // 根据层级添加样式
            if (level === 1) {
                li.style.fontWeight = '600';
            } else if (level === 2) {
                // h2 正常样式
            } else if (level === 3) {
                li.classList.add('sub');
            }
            
            // 点击目录项滚动到对应标题
            li.addEventListener('click', () => {
                const target = document.getElementById(id);
                if (target) {
                    const offset = target.offsetTop - 80;
                    docsContent.scrollTo({
                        top: offset,
                        behavior: 'smooth'
                    });
                }
            });
            
            tocList.appendChild(li);
        });
    }

    // ========== 滚动监听 - 高亮当前目录项 ==========
    function initTOCScrollSpy() {
        const tocItems = tocList.querySelectorAll('li[data-target]');
        
        if (tocItems.length === 0) return;
        
        const observerOptions = {
            root: docsContent,
            rootMargin: '-80px 0px -80% 0px',
            threshold: 0
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    
                    // 移除所有 active 状态
                    tocItems.forEach(item => item.classList.remove('active'));
                    
                    // 添加当前 active 状态
                    const activeTocItem = tocList.querySelector(`li[data-target="${id}"]`);
                    if (activeTocItem) {
                        activeTocItem.classList.add('active');
                    }
                }
            });
        }, observerOptions);
        
        // 观察所有标题
        const headings = mdContent.querySelectorAll('h1, h2, h3');
        headings.forEach(heading => observer.observe(heading));
    }

    // ========== 为代码块添加复制按钮 ==========
    function addCopyButtons() {
        const codeBlocks = mdContent.querySelectorAll('pre.hljs');
        
        codeBlocks.forEach(block => {
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            
            const header = document.createElement('div');
            header.className = 'code-header';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn';
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            `;
            
            copyBtn.addEventListener('click', async () => {
                const code = block.textContent;
                
                try {
                    await navigator.clipboard.writeText(code);
                    
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
                    copyBtn.style.color = '#10b981';
                    
                    showToast('代码已复制', 'success');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.style.color = '';
                    }, 1500);
                } catch (error) {
                    showToast('复制失败', 'error');
                }
            });
            
            header.appendChild(copyBtn);
            
            // 包装代码块
            block.parentNode.insertBefore(wrapper, block);
            wrapper.appendChild(header);
            wrapper.appendChild(block);
        });
    }

    // ========== 搜索功能 ==========
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase().trim();
            
            menuItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (keyword === '' || text.includes(keyword)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        });
    }

    // ========== Ctrl+K 快捷键聚焦搜索框 ==========
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
            }
        }
    });

    // 点击 Ctrl K 标签也聚焦搜索框
    if (searchShortcut) {
        searchShortcut.addEventListener('click', () => {
            if (searchInput) {
                searchInput.focus();
            }
        });
    }

    // ========== 侧边栏导航切换 ==========
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 移除所有 active 状态
            menuItems.forEach(i => i.classList.remove('active'));
            
            // 添加当前 active 状态
            item.classList.add('active');
            
            // 加载对应的 Markdown 文档
            const docPath = item.getAttribute('href');
            loadDoc(docPath);
        });
    });

    // ========== 底部按钮功能 ==========
    if (bottomBtns.length >= 3) {
        // 第一个按钮：帮助信息
        bottomBtns[0].addEventListener('click', () => {
            showToast('文档中心 - 帮助与指南');
        });
        
        // 第二个按钮：主题切换（占位功能）
        bottomBtns[1].addEventListener('click', () => {
            showToast('主题切换功能开发中');
        });
        
        // 第三个按钮：GitHub 链接
        bottomBtns[2].addEventListener('click', () => {
            window.open('https://github.com/Betterlol/HotAI', '_blank');
        });
    }

    // ========== Toast 提示函数 ==========
    function showToast(message, type = 'info') {
        // 移除已存在的 toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // 创建新 toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' 
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
            : type === 'error'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        
        toast.innerHTML = `${icon}<span>${message}</span>`;
        document.body.appendChild(toast);
        
        // 1.5 秒后自动移除
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }

    // 添加 slideOut 动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideOut {
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // ========== 初始化加载 ==========
    function init() {
        // 检查 URL hash
        const hash = window.location.hash.substring(1);
        
        let initialDoc = 'docs/user/101-user-guide.md';
        
        if (hash && hash.startsWith('docs/')) {
            initialDoc = hash;
        }
        
        // 高亮对应菜单项
        menuItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === initialDoc) {
                item.classList.add('active');
            }
        });
        
        // 如果没有任何选中项，默认选中第一个
        const hasActive = Array.from(menuItems).some(item => item.classList.contains('active'));
        if (!hasActive && menuItems.length > 0) {
            menuItems[0].classList.add('active');
        }
        
        // 加载文档
        loadDoc(initialDoc);
    }

    // 监听浏览器前进/后退
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash && hash.startsWith('docs/')) {
            loadDoc(hash);
            
            // 更新菜单高亮
            menuItems.forEach(item => {
                if (item.getAttribute('href') === hash) {
                    menuItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                }
            });
        }
    });

    // ========== 启动 ==========
    init();
    console.log('文档页面已加载 (Markdown 渲染模式)');
});
