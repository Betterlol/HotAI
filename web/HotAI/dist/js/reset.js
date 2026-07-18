// 密码重置页面逻辑
document.addEventListener('DOMContentLoaded', () => {
    // 步骤状态
    let currentStep = 1;
    let resetEmail = '';

    // 获取步骤容器
    const step1 = document.getElementById('resetStep1');
    const step2 = document.getElementById('resetStep2');
    const successPanel = document.getElementById('resetSuccess');

    // Step 1 元素
    const emailInput = document.getElementById('resetEmail');
    const sendCodeBtn = document.getElementById('resetSendCode');
    const step1Message = document.getElementById('resetMessage1');

    // Step 2 元素
    const tokenInput = document.getElementById('resetToken');
    const submitBtn = document.getElementById('resetSubmit');
    const step2Message = document.getElementById('resetMessage2');
    const step2EmailDisplay = document.getElementById('resetEmailDisplay');

    // 成功面板元素
    const newPasswordDisplay = document.getElementById('resetNewPassword');
    const copyPasswordBtn = document.getElementById('resetCopyPassword');
    const goLoginBtn = document.getElementById('resetGoLogin');

    let codeCooldown = 0;
    let cooldownTimer = null;

    // 显示消息
    function showMessage(el, text, type = 'info') {
        if (!el) return;
        el.textContent = text;
        el.className = `reset-message reset-message-${type}`;
        el.style.display = 'block';
    }

    function hideMessage(el) {
        if (!el) return;
        el.style.display = 'none';
    }

    // 邮箱格式验证
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // 切换到步骤 2
    function goToStep2(email) {
        resetEmail = email;
        currentStep = 2;

        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'block';
        if (successPanel) successPanel.style.display = 'none';

        // 显示邮箱
        if (step2EmailDisplay) step2EmailDisplay.textContent = email;

        // 聚焦到 token 输入框
        if (tokenInput) tokenInput.focus();
    }

    // 切换到成功面板
    function goToSuccess(newPassword) {
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'none';
        if (successPanel) successPanel.style.display = 'block';

        if (newPasswordDisplay) newPasswordDisplay.textContent = newPassword;
    }

    // 更新发送按钮倒计时
    function updateCooldownButton() {
        if (sendCodeBtn) {
            sendCodeBtn.textContent = `${codeCooldown}s`;
            sendCodeBtn.disabled = true;
        }
    }

    // Step 1: 发送重置邮件
    async function handleSendCode(e) {
        e.preventDefault();
        if (!emailInput) return;

        const email = emailInput.value.trim();
        hideMessage(step1Message);

        if (!email) {
            showMessage(step1Message, I18n.t('reset.email_required'), 'error');
            return;
        }

        if (!validateEmail(email)) {
            showMessage(step1Message, I18n.t('reset.email_invalid'), 'error');
            return;
        }

        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = I18n.t('reset.sending_code');

        try {
            const result = await API.sendPasswordResetEmail(email);

            if (result.success) {
                showMessage(step1Message, I18n.t('reset.code_sent'), 'success');

                // 开始倒计时（60秒），然后切到 Step 2
                codeCooldown = 60;
                updateCooldownButton();

                cooldownTimer = setInterval(() => {
                    codeCooldown--;
                    if (codeCooldown <= 0) {
                        clearInterval(cooldownTimer);
                        sendCodeBtn.disabled = false;
                        sendCodeBtn.textContent = I18n.t('reset.resend_code');
                    } else {
                        updateCooldownButton();
                    }
                }, 1000);

                // 切换到步骤 2
                setTimeout(() => {
                    goToStep2(email);
                }, 1000);
            } else {
                showMessage(step1Message, result.message || I18n.t('reset.send_code_failed'), 'error');
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = I18n.t('reset.send_code');
            }
        } catch (error) {
            showMessage(step1Message, error.message || I18n.t('reset.send_code_failed'), 'error');
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = I18n.t('reset.send_code');
        }
    }

    // Step 2: 提交重置
    async function handleReset(e) {
        e.preventDefault();
        hideMessage(step2Message);

        if (!tokenInput) return;

        const token = tokenInput.value.trim();

        if (!token) {
            showMessage(step2Message, I18n.t('reset.token_required'), 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = I18n.t('reset.submitting');

        try {
            // POST /api/user/reset — 后端验证 token 并自动生成新密码返回
            const result = await API.resetPassword(resetEmail, token);

            if (result.success) {
                const generatedPassword = result.data || '';
                goToSuccess(generatedPassword);
            } else {
                showMessage(step2Message, result.message || I18n.t('reset.failed') || '重置失败', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = I18n.t('reset.submit');
            }
        } catch (error) {
            showMessage(step2Message, error.message || '重置失败', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = I18n.t('reset.submit');
        }
    }

    // 复制密码到剪贴板
    async function copyPassword() {
        const pwd = newPasswordDisplay ? newPasswordDisplay.textContent : '';
        if (!pwd) return;

        try {
            await navigator.clipboard.writeText(pwd);
            if (copyPasswordBtn) {
                const original = copyPasswordBtn.textContent;
                copyPasswordBtn.textContent = I18n.t('reset.copied');
                setTimeout(() => {
                    copyPasswordBtn.textContent = original;
                }, 2000);
            }
        } catch (error) {
            // 降级：选中文本
            if (newPasswordDisplay) {
                const range = document.createRange();
                range.selectNode(newPasswordDisplay);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
            }
        }
    }

    // 绑定事件
    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', handleSendCode);
    }

    if (emailInput) {
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendCodeBtn && sendCodeBtn.click();
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', handleReset);
    }

    if (tokenInput) {
        tokenInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitBtn && submitBtn.click();
        });
    }

    if (copyPasswordBtn) {
        copyPasswordBtn.addEventListener('click', copyPassword);
    }

    if (goLoginBtn) {
        goLoginBtn.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }

    // 初始化：Step 1 显示，Step 2 和成功面板隐藏
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (successPanel) successPanel.style.display = 'none';
});
