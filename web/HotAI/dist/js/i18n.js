// 增强版轻量级 i18n 翻译引擎 - 支持自动文本扫描
const I18n = {
    // 当前语言
    currentLang: 'zh',
    
    // 反向映射表（文本 → key）
    zhMap: {},
    enMap: {},
    
    // 翻译字典（扩展版，涵盖所有页面）
    translations: {
        zh: {
            // === 导航栏 (所有页面共享) ===
            'nav.home': '首页',
            'nav.console': '控制台',
            'nav.models': '模型广场',
            'nav.docs': '文档',
            'nav.about': '关于',
            'nav.login': '登录',
            'nav.signup': '注册',
            'nav.profile': '个人设置',
            'nav.logout': '退出登录',
            'nav.notice': '公告',
            'nav.language': '语言',
            
            // === 侧边栏 (首页) ===
            'sidebar.extensions': '功能拓展',
            'sidebar.model_management': '模型管理',
            'sidebar.history': '历史记录',
            'sidebar.no_history': '暂无对话记录',
            
            // === 主体区域 (首页) ===
            'main.input_placeholder': '输入您的问题...',
            'main.subtitle': '国内外 AI api 智能聚合平台，众多合作模型供您选择',
            'main.more_platforms': '更多',
            'main.loading': '加载中...',
            'main.load_failed': '加载失败',
            'main.no_models': '无可用模型',
            'main.search_model': '搜索模型...',
            'main.select_model': '请先选择模型',
            'main.enter_message': '请输入消息内容',
            'main.login_required': '您需要登录才能使用聊天功能，是否跳转到登录页面？',
            'main.send_failed': '发送失败',
            'main.network_error': '网络错误',
            'main.retry': '请刷新重试',
            
            // === 公告弹窗 (所有页面共享) ===
            'notice.title': '公告',
            'notice.no_notice': '暂无公告',
            'notice.loading': '加载中...',
            'notice.load_failed': '加载公告失败',
            'notice.close': '关闭',
            
            // === 余额 ===
            'balance.label': '余额',
            'balance.loading': '加载中...',
            'balance.failed': '余额加载失败',
            
            // === 语言选择 ===
            'lang.zh': '中文',
            'lang.en': 'English',
            
            // === 登录页面 ===
            'login.title': '登录',
            'login.welcome': '欢迎回来，请登录您的账户',
            'login.username': '用户名或邮箱',
            'login.password': '密码',
            'login.username_placeholder': '请输入您的用户名或邮箱地址',
            'login.password_placeholder': '请输入您的密码',
            'login.continue': '继续',
            'login.forgot_password': '忘记密码？',
            'login.no_account': '没有账户？',
            'login.signup_link': '注册',
            'login.carousel1_title': 'AI 算力聚合',
            'login.carousel1_desc': '汇聚全球顶尖模型 API',
            'login.carousel2_title': '极速稳定',
            'login.carousel2_desc': '企业级高可用 API 服务',
            'login.carousel3_title': '开发者友好',
            'login.carousel3_desc': '智能运维与弹性计费',
            
            // === 注册页面 ===
            'register.title': '注册',
            'register.desc': '加入图灵智算，开启 AI 开发之旅',
            'register.username': '用户名',
            'register.username_placeholder': '请输入用户名',
            'register.password': '密码',
            'register.password_placeholder': '输入密码，最短 8 位，最长 20 位',
            'register.confirm_password': '确认密码',
            'register.confirm_password_placeholder': '确认密码',
            'register.submit': '注册',
            'register.has_account': '已有账户？',
            'register.login_link': '登录',
            'register.carousel1_title': '多模型支持',
            'register.carousel1_desc': '一键接入 ChatGPT、Claude、Gemini',
            'register.carousel2_title': 'API 智能路由',
            'register.carousel2_desc': '自动选择最优模型与通道',
            'register.carousel3_title': '数据安全保障',
            'register.carousel3_desc': '企业级加密与本地化部署',
            
            // === 密码重置页面 ===
            'reset.title': '密码重置',
            'reset.desc': '输入您的邮箱以重置密码',
            'reset.email': '邮箱',
            'reset.email_placeholder': '请输入您的邮箱地址',
            'reset.submit': '提交',
            'reset.back_to_login': '想起来了？',
            'reset.login_link': '登录',
            'reset.carousel1_title': '安全可靠',
            'reset.carousel1_desc': '企业级数据保护与加密',
            'reset.carousel2_title': '快速响应',
            'reset.carousel2_desc': '密码重置邮件秒级送达',
            'reset.carousel3_title': '体验优化',
            'reset.carousel3_desc': '极简流程，快速恢复访问',
            
            // === 文档页面 ===
            'docs.search_placeholder': '搜索文档',
            'docs.search_shortcut': 'Ctrl K',
            'docs.section_intro': '介绍',
            'docs.section_guides': '功能指南',
            'docs.menu_quickstart': '快速开始',
            'docs.menu_intro': '项目介绍',
            'docs.menu_features': '特性说明',
            'docs.menu_architecture': '技术架构',
            'docs.menu_analytics': '分析工具设置指南',
            'docs.menu_performance': '性能分析设置指南',
            'docs.menu_changelog': '更新日志',
            'docs.menu_guide_overview': '功能指南概述',
            'docs.menu_user_guide': '用户指南',
            'docs.menu_admin_guide': '管理员指南',
            'docs.toc_title': '目录',
            'docs.loading': '正在加载文档...',
            'docs.btn_help': '帮助',
            'docs.btn_theme': '主题切换',
            'docs.btn_github': 'GitHub',
            
            // === 用户中心/个人设置页面 ===
            'profile.sidebar_title': '个人中心',
            'profile.menu_profile': '个人资料',
            'profile.menu_security': '账号安全',
            'profile.menu_bindings': '登录方式',
            'profile.menu_preferences': '偏好设置',
            'profile.menu_password': '修改密码',
            'profile.menu_twofa': '双重验证',
            'profile.panel_profile_title': '个人资料',
            'profile.panel_profile_desc': '维护公开展示信息，并保持头像与昵称风格一致。',
            'profile.panel_security_title': '账号安全',
            'profile.panel_security_desc': '管理您的账号安全设置，保护账户安全。',
            'profile.panel_bindings_title': '登录方式绑定',
            'profile.panel_bindings_desc': '查看当前绑定状态，并将更多第三方登录方式关联到这个账号。',
            'profile.panel_preferences_title': '偏好设置',
            'profile.panel_preferences_desc': '自定义您的使用体验。',
            'profile.panel_password_title': '修改密码',
            'profile.panel_password_desc': '定期更新密码以保护账户安全。',
            'profile.panel_twofa_title': '双重验证',
            'profile.panel_twofa_desc': '启用双重验证以增强账户安全性。',
            'profile.status_enabled': '启用',
            'profile.balance_label': '账户余额',
            'profile.request_count': '请求次数',
            'profile.register_date': '注册时间',
            'profile.card_avatar_title': '资料与头像',
            'profile.avatar_tip': '上传图片时会自动压缩静态图片到 20KB 以内，GIF 需自行控制在 20KB 以内',
            'profile.btn_upload': '上传图片',
            'profile.btn_save': '保存',
            'profile.btn_delete': '删除',
            'profile.btn_update_profile': '更新资料',
            'profile.label_username': '用户名',
            'profile.current_password': '当前密码',
            'profile.current_password_placeholder': '请输入当前密码',
            'profile.new_password': '新密码',
            'profile.new_password_placeholder': '请输入新密码',
            'profile.password_hint': '密码至少需要 8 个字符',
            'profile.confirm_password': '确认新密码',
            'profile.confirm_password_placeholder': '请再次输入新密码',
            'profile.btn_change_password': '修改密码',
            'profile.email_bound': '已绑定',
            'profile.email_bind_info': '主邮箱在资料表单中管理',
            'profile.btn_manage_email': '管理邮箱',
            'profile.developing': '该功能正在开发中...',
            
            // === 模型广场页面 ===
            'model.filter_title': '筛选',
            'model.filter_reset': '重置',
            'model.filter_provider': '供应商',
            'model.filter_all_providers': '全部供应商',
            'model.filter_group': '可用令牌分组',
            'model.filter_all_groups': '全部分组',
            'model.filter_billing': '计费类型',
            'model.filter_all_billing': '全部类型',
            'model.filter_billing_quantity': '按量计费',
            'model.filter_billing_per_call': '按次计费',
            'model.filter_tags': '标签',
            'model.filter_all_tags': '全部标签',
            'model.filter_endpoint': '端点类型',
            'model.filter_all_endpoints': '全部端点',
            'model.search_placeholder': '模糊搜索模型名称',
            'model.btn_copy': '复制',
            'model.switch_price': '充值价格显示',
            'model.switch_rate': '倍率',
            'model.btn_table_view': '表格视图',
            'model.btn_card_view': '卡片视图',
            'model.btn_unit_k': 'K',
            'model.banner_title': '全部供应商',
            'model.banner_count': '共 2 个模型',
            'model.banner_desc': '查看所有可用的AI模型供应商，包括众多知名供应商的模型。',
            'model.table_name': '模型名称',
            'model.table_provider': '供应商',
            'model.table_desc': '描述',
            'model.table_tags': '标签',
            'model.table_billing': '计费类型',
            'model.table_endpoint': '可用端点类型',
            'model.table_rate': '倍率',
            'model.table_price': '模型价格',
            
            // === 控制台页面 ===
            'console.sidebar_chat': '聊天',
            'console.sidebar_playground': '操练场',
            'console.sidebar_chat_page': '聊天',
            'console.sidebar_console': '控制台',
            'console.sidebar_dashboard': '数据看板',
            'console.sidebar_tokens': '令牌管理',
            'console.sidebar_logs': '使用日志',
            'console.sidebar_draw_logs': '绘图日志',
            'console.sidebar_task_logs': '任务日志',
            'console.sidebar_admin': '管理员',
            'console.sidebar_channels': '渠道管理',
            'console.sidebar_redemption': '兑换码管理',
            'console.sidebar_users': '用户管理',
            'console.sidebar_settings': '系统设置',
            'console.sidebar_profile': '个人中心',
            'console.sidebar_wallet': '钱包',
            'console.sidebar_profile_settings': '个人设置',
            'console.stat_account': '账户数据',
            'console.stat_balance': '当前余额',
            'console.stat_history': '历史消耗',
            'console.stat_usage': '使用统计',
            'console.stat_requests': '请求次数',
            'console.stat_stats': '统计次数',
            'console.stat_resources': '资源消耗',
            'console.stat_quota': '统计额度',
            'console.stat_tokens': '统计Tokens',
            'console.stat_performance': '性能指标',
            'console.stat_avg_rpm': '平均RPM',
            'console.stat_avg_tpm': '平均TPM',
            'console.chart_title': '模型数据分析',
            'console.chart_consumption_dist': '消耗分布',
            'console.chart_consumption_trend': '消耗趋势',
            'console.chart_call_dist': '调用次数分布',
            'console.chart_call_ranking': '调用次数排行',
            'console.chart_placeholder': '模型消耗分布',
            'console.chart_total': '总计',
            'console.api_no_info': '暂无API信息',
            'console.api_desc': '请联系管理员在系统设置中配置API信息',
            'console.welcome_prefix': '👋 下午好',
            
            // === 其他通用文本 ===
            'common.confirm': '确认',
            'common.cancel': '取消',
            'common.save': '保存',
            'common.delete': '删除',
            'common.edit': '编辑',
            'common.submit': '提交',
            'common.back': '返回',
            'common.next': '下一步',
            'common.previous': '上一步',
            'common.search': '搜索',
            'common.filter': '筛选',
            'common.sort': '排序',
            'common.refresh': '刷新',
            'common.close': '关闭'
        },
        en: {
            // === Navigation (shared across all pages) ===
            'nav.home': 'Home',
            'nav.console': 'Console',
            'nav.models': 'Models',
            'nav.docs': 'Docs',
            'nav.about': 'About',
            'nav.login': 'Login',
            'nav.signup': 'Sign Up',
            'nav.profile': 'Profile',
            'nav.logout': 'Logout',
            'nav.notice': 'Notice',
            'nav.language': 'Language',
            
            // === Sidebar (home page) ===
            'sidebar.extensions': 'Extensions',
            'sidebar.model_management': 'Models',
            'sidebar.history': 'History',
            'sidebar.no_history': 'No conversation history',
            
            // === Main content (home page) ===
            'main.input_placeholder': 'Type your question...',
            'main.subtitle': 'AI API aggregation platform with numerous models to choose from',
            'main.more_platforms': 'More',
            'main.loading': 'Loading...',
            'main.load_failed': 'Load failed',
            'main.no_models': 'No models available',
            'main.search_model': 'Search models...',
            'main.select_model': 'Please select a model first',
            'main.enter_message': 'Please enter a message',
            'main.login_required': 'You need to login to use chat feature. Redirect to login page?',
            'main.send_failed': 'Send failed',
            'main.network_error': 'Network error',
            'main.retry': 'Please refresh and retry',
            
            // === Notice modal (shared) ===
            'notice.title': 'Notice',
            'notice.no_notice': 'No notices',
            'notice.loading': 'Loading...',
            'notice.load_failed': 'Failed to load notice',
            'notice.close': 'Close',
            
            // === Balance ===
            'balance.label': 'Balance',
            'balance.loading': 'Loading...',
            'balance.failed': 'Failed to load balance',
            
            // === Language selection ===
            'lang.zh': '中文',
            'lang.en': 'English',
            
            // === Login page ===
            'login.title': 'Login',
            'login.welcome': 'Welcome back, please login to your account',
            'login.username': 'Username or Email',
            'login.password': 'Password',
            'login.username_placeholder': 'Enter your username or email',
            'login.password_placeholder': 'Enter your password',
            'login.continue': 'Continue',
            'login.forgot_password': 'Forgot password?',
            'login.no_account': 'Don\'t have an account?',
            'login.signup_link': 'Sign Up',
            'login.carousel1_title': 'AI Computing Aggregation',
            'login.carousel1_desc': 'Gather world-class model APIs',
            'login.carousel2_title': 'Fast & Stable',
            'login.carousel2_desc': 'Enterprise-grade HA API service',
            'login.carousel3_title': 'Developer Friendly',
            'login.carousel3_desc': 'Smart ops & flexible billing',
            
            // === Register page ===
            'register.title': 'Register',
            'register.desc': 'Join HotAI, start your AI development journey',
            'register.username': 'Username',
            'register.username_placeholder': 'Enter your username',
            'register.password': 'Password',
            'register.password_placeholder': 'Enter password, 8-20 characters',
            'register.confirm_password': 'Confirm Password',
            'register.confirm_password_placeholder': 'Confirm password',
            'register.submit': 'Register',
            'register.has_account': 'Already have an account?',
            'register.login_link': 'Login',
            'register.carousel1_title': 'Multi-model Support',
            'register.carousel1_desc': 'One-click access to ChatGPT, Claude, Gemini',
            'register.carousel2_title': 'Smart API Routing',
            'register.carousel2_desc': 'Auto-select optimal model and channel',
            'register.carousel3_title': 'Data Security',
            'register.carousel3_desc': 'Enterprise-grade encryption & local deployment',
            
            // === Reset password page ===
            'reset.title': 'Reset Password',
            'reset.desc': 'Enter your email to reset your password',
            'reset.email': 'Email',
            'reset.email_placeholder': 'Enter your email address',
            'reset.submit': 'Submit',
            'reset.back_to_login': 'Remember now?',
            'reset.login_link': 'Login',
            'reset.carousel1_title': 'Safe & Reliable',
            'reset.carousel1_desc': 'Enterprise-grade data protection & encryption',
            'reset.carousel2_title': 'Fast Response',
            'reset.carousel2_desc': 'Password reset email delivered in seconds',
            'reset.carousel3_title': 'Optimized Experience',
            'reset.carousel3_desc': 'Simple flow, quick access recovery',
            
            // === Docs page ===
            'docs.search_placeholder': 'Search docs',
            'docs.search_shortcut': 'Ctrl K',
            'docs.section_intro': 'Introduction',
            'docs.section_guides': 'Guides',
            'docs.menu_quickstart': 'Quick Start',
            'docs.menu_intro': 'Introduction',
            'docs.menu_features': 'Features',
            'docs.menu_architecture': 'Architecture',
            'docs.menu_analytics': 'Analytics Setup',
            'docs.menu_performance': 'Performance Setup',
            'docs.menu_changelog': 'Changelog',
            'docs.menu_guide_overview': 'Guide Overview',
            'docs.menu_user_guide': 'User Guide',
            'docs.menu_admin_guide': 'Admin Guide',
            'docs.toc_title': 'Contents',
            'docs.loading': 'Loading docs...',
            'docs.btn_help': 'Help',
            'docs.btn_theme': 'Theme',
            'docs.btn_github': 'GitHub',
            
            // === Profile page ===
            'profile.sidebar_title': 'Profile Center',
            'profile.menu_profile': 'Profile',
            'profile.menu_security': 'Account Security',
            'profile.menu_bindings': 'Login Methods',
            'profile.menu_preferences': 'Preferences',
            'profile.menu_password': 'Change Password',
            'profile.menu_twofa': 'Two-Factor Auth',
            'profile.panel_profile_title': 'Profile',
            'profile.panel_profile_desc': 'Manage your public display information, keep your avatar and nickname consistent.',
            'profile.panel_security_title': 'Account Security',
            'profile.panel_security_desc': 'Manage your account security settings to protect your account.',
            'profile.panel_bindings_title': 'Login Method Bindings',
            'profile.panel_bindings_desc': 'View current binding status and link more third-party login methods.',
            'profile.panel_preferences_title': 'Preferences',
            'profile.panel_preferences_desc': 'Customize your experience.',
            'profile.panel_password_title': 'Change Password',
            'profile.panel_password_desc': 'Regularly update your password to protect your account.',
            'profile.panel_twofa_title': 'Two-Factor Authentication',
            'profile.panel_twofa_desc': 'Enable two-factor authentication to enhance account security.',
            'profile.status_enabled': 'Enabled',
            'profile.balance_label': 'Balance',
            'profile.request_count': 'Requests',
            'profile.register_date': 'Registered',
            'profile.card_avatar_title': 'Profile & Avatar',
            'profile.avatar_tip': 'Images will be auto-compressed to under 20KB, GIFs must be manually kept under 20KB.',
            'profile.btn_upload': 'Upload',
            'profile.btn_save': 'Save',
            'profile.btn_delete': 'Delete',
            'profile.btn_update_profile': 'Update Profile',
            'profile.label_username': 'Username',
            'profile.current_password': 'Current Password',
            'profile.current_password_placeholder': 'Enter current password',
            'profile.new_password': 'New Password',
            'profile.new_password_placeholder': 'Enter new password',
            'profile.password_hint': 'Password must be at least 8 characters',
            'profile.confirm_password': 'Confirm New Password',
            'profile.confirm_password_placeholder': 'Re-enter new password',
            'profile.btn_change_password': 'Change Password',
            'profile.email_bound': 'Bound',
            'profile.email_bind_info': 'Main email is managed in the profile form',
            'profile.btn_manage_email': 'Manage Email',
            'profile.developing': 'This feature is under development...',
            
            // === Model page ===
            'model.filter_title': 'Filters',
            'model.filter_reset': 'Reset',
            'model.filter_provider': 'Provider',
            'model.filter_all_providers': 'All Providers',
            'model.filter_group': 'Token Group',
            'model.filter_all_groups': 'All Groups',
            'model.filter_billing': 'Billing Type',
            'model.filter_all_billing': 'All Types',
            'model.filter_billing_quantity': 'Per-usage',
            'model.filter_billing_per_call': 'Per-call',
            'model.filter_tags': 'Tags',
            'model.filter_all_tags': 'All Tags',
            'model.filter_endpoint': 'Endpoint Type',
            'model.filter_all_endpoints': 'All Endpoints',
            'model.search_placeholder': 'Search model name',
            'model.btn_copy': 'Copy',
            'model.switch_price': 'Show Price',
            'model.switch_rate': 'Rate',
            'model.btn_table_view': 'Table View',
            'model.btn_card_view': 'Card View',
            'model.btn_unit_k': 'K',
            'model.banner_title': 'All Providers',
            'model.banner_count': '2 models total',
            'model.banner_desc': 'View all available AI model providers, including many well-known providers.',
            'model.table_name': 'Model Name',
            'model.table_provider': 'Provider',
            'model.table_desc': 'Description',
            'model.table_tags': 'Tags',
            'model.table_billing': 'Billing Type',
            'model.table_endpoint': 'Endpoint Type',
            'model.table_rate': 'Rate',
            'model.table_price': 'Price',
            
            // === Console page ===
            'console.sidebar_chat': 'Chat',
            'console.sidebar_playground': 'Playground',
            'console.sidebar_chat_page': 'Chat',
            'console.sidebar_console': 'Console',
            'console.sidebar_dashboard': 'Dashboard',
            'console.sidebar_tokens': 'Token Management',
            'console.sidebar_logs': 'Usage Logs',
            'console.sidebar_draw_logs': 'Draw Logs',
            'console.sidebar_task_logs': 'Task Logs',
            'console.sidebar_admin': 'Admin',
            'console.sidebar_channels': 'Channel Management',
            'console.sidebar_redemption': 'Redemption Codes',
            'console.sidebar_users': 'User Management',
            'console.sidebar_settings': 'System Settings',
            'console.sidebar_profile': 'Profile',
            'console.sidebar_wallet': 'Wallet',
            'console.sidebar_profile_settings': 'Profile Settings',
            'console.stat_account': 'Account',
            'console.stat_balance': 'Balance',
            'console.stat_history': 'History Spent',
            'console.stat_usage': 'Usage Stats',
            'console.stat_requests': 'Requests',
            'console.stat_stats': 'Stats',
            'console.stat_resources': 'Resources',
            'console.stat_quota': 'Stat Quota',
            'console.stat_tokens': 'Stat Tokens',
            'console.stat_performance': 'Performance',
            'console.stat_avg_rpm': 'Avg RPM',
            'console.stat_avg_tpm': 'Avg TPM',
            'console.chart_title': 'Model Analytics',
            'console.chart_consumption_dist': 'Consumption Distribution',
            'console.chart_consumption_trend': 'Consumption Trend',
            'console.chart_call_dist': 'Call Distribution',
            'console.chart_call_ranking': 'Call Ranking',
            'console.chart_placeholder': 'Model Consumption Distribution',
            'console.chart_total': 'Total',
            'console.api_no_info': 'No API Info',
            'console.api_desc': 'Contact admin to configure API info in system settings',
            'console.welcome_prefix': '👋 Good afternoon',
            
            // === Common ===
            'common.confirm': 'Confirm',
            'common.cancel': 'Cancel',
            'common.save': 'Save',
            'common.delete': 'Delete',
            'common.edit': 'Edit',
            'common.submit': 'Submit',
            'common.back': 'Back',
            'common.next': 'Next',
            'common.previous': 'Previous',
            'common.search': 'Search',
            'common.filter': 'Filter',
            'common.sort': 'Sort',
            'common.refresh': 'Refresh',
            'common.close': 'Close'
        }
    },
    
    // 构建反向映射表
    buildReverseMaps() {
        this.zhMap = {};
        this.enMap = {};
        
        for (const key in this.translations.zh) {
            const zhText = this.translations.zh[key];
            const enText = this.translations.en[key];
            this.zhMap[zhText] = key;
            this.enMap[enText] = key;
        }
    },
    
    // 初始化语言
    init() {
        // 构建反向映射
        this.buildReverseMaps();
        
        // 从 localStorage 读取保存的语言，或使用浏览器语言
        const savedLang = localStorage.getItem('lang');
        if (savedLang && this.translations[savedLang]) {
            this.currentLang = savedLang;
        } else {
            // 根据浏览器语言自动选择
            const browserLang = navigator.language || navigator.userLanguage;
            if (browserLang.startsWith('zh')) {
                this.currentLang = 'zh';
            } else {
                this.currentLang = 'en';
            }
            localStorage.setItem('lang', this.currentLang);
        }
        
        // 应用翻译
        this.applyTranslations();
    },
    
    // 获取翻译文本
    t(key) {
        const translation = this.translations[this.currentLang][key];
        return translation || key;
    },
    
    // 切换语言
    switchLanguage(lang) {
        if (!this.translations[lang]) {
            console.error('Language not supported:', lang);
            return;
        }
        
        this.currentLang = lang;
        localStorage.setItem('lang', lang);
        this.applyTranslations();
        
        // 触发自定义事件，通知其他组件语言已改变
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    },
    
    // 判断节点是否应该跳过
    isSkippableNode(node) {
        if (!node || !node.parentElement) return true;
        
        // 跳过 script、style、noscript 标签
        const tagName = node.parentElement.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tagName)) return true;
        
        // 跳过带 data-no-i18n 属性的元素
        if (node.parentElement.hasAttribute('data-no-i18n')) return true;
        
        // 跳过 brand-logo 类（Turing Intelligent Computing 不翻译）
        if (node.parentElement.classList.contains('brand-logo')) return true;
        
        // 跳过 pure digit or whitespace
        const text = node.textContent.trim();
        if (!text || /^\d+$/.test(text)) return true;
        
        // 跳过纯符号/图标文本
        if (/^[+\-•·\s]+$/.test(text)) return true;
        
        return false;
    },
    
    // 应用翻译到页面
    applyTranslations() {
        // 1. 优先处理带 data-i18n 属性的元素（显式绑定）
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            
            // 根据元素类型应用翻译
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder !== undefined) {
                    el.placeholder = translation;
                }
            } else {
                el.textContent = translation;
            }
        });
        
        // 2. 处理 data-i18n-placeholder 属性
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });
        
        // 3. 处理 data-i18n-title 属性
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });
        
        // 4. 自动扫描所有文本节点（智能翻译）
        this.autoTranslateTextNodes(document.body);
    },
    
    // 自动翻译文本节点
    autoTranslateTextNodes(rootElement) {
        if (!rootElement) return;
        
        const walker = document.createTreeWalker(
            rootElement,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const nodesToTranslate = [];
        let node;
        
        // 收集所有需要翻译的文本节点
        while (node = walker.nextNode()) {
            if (this.isSkippableNode(node)) continue;
            
            const text = node.textContent.trim();
            if (!text) continue;
            
            // 已经有 data-i18n 的元素跳过（已在 data-i18n 中处理过）
            if (node.parentElement && node.parentElement.hasAttribute('data-i18n')) continue;
            
            nodesToTranslate.push(node);
        }
        
        // 翻译收集到的节点
        const sourceMap = this.currentLang === 'zh' ? this.enMap : this.zhMap;
        
        nodesToTranslate.forEach(node => {
            const originalText = node.textContent.trim();
            
            // 查找反向映射
            const key = sourceMap[originalText];
            if (key) {
                const translatedText = this.t(key);
                // 保留原始的前后空白
                const leadingSpace = node.textContent.match(/^\s*/)[0];
                const trailingSpace = node.textContent.match(/\s*$/)[0];
                node.textContent = leadingSpace + translatedText + trailingSpace;
            }
        });
    },
    
    // 获取当前语言
    getCurrentLang() {
        return this.currentLang;
    }
};

// 页面加载时自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18n.init());
} else {
    I18n.init();
}