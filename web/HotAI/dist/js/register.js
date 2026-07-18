// 注册页面逻辑
document.addEventListener('DOMContentLoaded', async () => {
    // 获取系统状态
    let systemStatus = null;
    try {
        const statusRes = await API.getStatus();
        if (statusRes.success && statusRes.data) {
            systemStatus = statusRes.data;
        }
    } catch (error) {
        console.error('Failed to load system status:', error);
    }

    const emailVerificationEnabled = systemStatus?.email_verification || false;
    const passwordRegisterEnabled = systemStatus?.password_register_enabled !== false;

    // 若系统禁用密码注册，跳转登录页
    if (!passwordRegisterEnabled) {
        alert(I18n.t('register.failed') + ': ' + '密码注册已禁用');
        window.location.href = 'login.html';
        return;
    }

    // 获取表单元素
    const usernameInput = document.getElementById('regUsername');
    const emailInput = document.getElementById('regEmail');
    const pwd1Input = document.getElementById('regPwd1');
    const pwd2Input = document.getElementById('regPwd2');
    const submitBtn = document.querySelector('.btn-submit');
    const messageDiv = document.getElementById('regMessage');

    // 验证码相关元素（若需要）
    let codeInput, sendCodeBtn, codeGroup;
    if (emailVerificationEnabled) {
        codeGroup = document.getElementById('regCodeGroup');
        codeInput = document.getElementById('regCode');
        sendCodeBtn = document.getElementById('regSendCode');
        
        if (codeGroup) codeGroup.style.display = 'block';
    }

    let codeCooldown = 0;
    let cooldownTimer = null;

    // 显示消息
    function showMessage(text, type = 'info') {
        if (!messageDiv) return;
        messageDiv.textContent = text;
        messageDiv.className = `reg-message reg-message-${type}`;
        messageDiv.style.display = 'block';
    }

    function hideMessage() {
        if (!messageDiv) return;
        messageDiv.style.display = 'none';
    }

    // 邮箱格式验证
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // 发送验证码
    async function sendVerificationCode() {
        const email = emailInput.value.trim();
        
        if (!email) {
            showMessage(I18n.t('register.email_required'), 'error');
            return;
        }
        
        if (!validateEmail(email)) {
            showMessage(I18n.t('register.email_invalid'), 'error');
            return;
        }

        // 禁用按钮
        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = I18n.t('register.sending_code');

        try {
            const result = await API.sendEmailCode(email);
            
            if (result.success) {
                showMessage(I18n.t('register.code_sent'), 'success');
                
                // 开始倒计时（60秒）
                codeCooldown = 60;
                updateCooldownButton();
                
                cooldownTimer = setInterval(() => {
                    codeCooldown--;
                    if (codeCooldown <= 0) {
                        clearInterval(cooldownTimer);
                        sendCodeBtn.disabled = false;
                        sendCodeBtn.textContent = I18n.t('register.resend_code');
                    } else {
                        updateCooldownButton();
                    }
                }, 1000);
            } else {
                showMessage(result.message || I18n.t('register.send_code_failed'), 'error');
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = I18n.t('register.send_code');
            }
        } catch (error) {
            showMessage(error.message || I18n.t('register.send_code_failed'), 'error');
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = I18n.t('register.send_code');
        }
    }

    function updateCooldownButton() {
        sendCodeBtn.textContent = `${codeCooldown}s`;
        sendCodeBtn.disabled = true;
    }

    // 绑定发送验证码按钮
    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', sendVerificationCode);
    }

    // 注册处理
    async function handleRegister(e) {
        e.preventDefault();
        hideMessage();

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = pwd1Input.value;
        const confirmPassword = pwd2Input.value;

        // 前端验证
        if (!username) {
            showMessage(I18n.t('register.username_required'), 'error');
            return;
        }

        if (!email) {
            showMessage(I18n.t('register.email_required'), 'error');
            return;
        }

        if (!validateEmail(email)) {
            showMessage(I18n.t('register.email_invalid'), 'error');
            return;
        }

        if (!password) {
            showMessage(I18n.t('register.password_required'), 'error');
            return;
        }

        if (password.length < 8 || password.length > 20) {
            showMessage(I18n.t('register.password_length'), 'error');
            return;
        }

        if (password !== confirmPassword) {
            showMessage(I18n.t('register.password_mismatch'), 'error');
            return;
        }

        let verificationCode = null;
        if (emailVerificationEnabled) {
            verificationCode = codeInput ? codeInput.value.trim() : null;
            if (!verificationCode) {
                showMessage(I18n.t('register.verification_code_required'), 'error');
                return;
            }
        }

        // 禁用按钮
        submitBtn.disabled = true;
        submitBtn.textContent = I18n.t('register.registering');

        try {
            // 调用注册 API
            const registerResult = await API.register(username, password, email, verificationCode);
            
            if (registerResult.success) {
                showMessage(I18n.t('register.success'), 'success');
                
                // 注册成功后自动登录
                try {
                    const loginResult = await Auth.login(username, password);
                    
                    if (loginResult.success) {
                        // 登录成功，跳转
                        const urlParams = new URLSearchParams(window.location.search);
                        const redirect = urlParams.get('redirect') || 'index.html';
                        setTimeout(() => {
                            window.location.href = redirect;
                        }, 500);
                    } else {
                        // 登录失败，跳转到登录页
                        showMessage('注册成功，请登录', 'success');
                        setTimeout(() => {
                            window.location.href = 'login.html';
                        }, 1500);
                    }
                } catch (loginError) {
                    // 登录出错，跳转到登录页
                    showMessage('注册成功，请登录', 'success');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                }
            } else {
                showMessage(registerResult.message || I18n.t('register.failed'), 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = I18n.t('register.submit');
            }
        } catch (error) {
            showMessage(error.message || I18n.t('register.failed'), 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = I18n.t('register.submit');
        }
    }

    // 绑定提交按钮
    if (submitBtn) {
        submitBtn.addEventListener('click', handleRegister);
    }

    // 回车键提交
    if (pwd2Input) {
        pwd2Input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });
    }
});
