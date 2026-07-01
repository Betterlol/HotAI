// 登录页面逻辑
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.querySelector('.btn-submit');
    const usernameInput = document.querySelector('input[type="text"]');
    const passwordInput = document.getElementById('loginPassword');
    
    // 登录按钮点击事件
    if (submitBtn) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            
            // 验证输入
            if (!username) {
                alert('请输入用户名或邮箱');
                return;
            }
            
            if (!password) {
                alert('请输入密码');
                return;
            }
            
            // 禁用按钮，显示加载状态
            submitBtn.disabled = true;
            submitBtn.textContent = '登录中...';
            
            try {
                const result = await Auth.login(username, password);
                
                if (result.success) {
                    // 检查是否有重定向地址
                    const urlParams = new URLSearchParams(window.location.search);
                    const redirect = urlParams.get('redirect') || '/index.html';
                    
                    // 登录成功，跳转
                    window.location.href = redirect;
                } else {
                    alert(result.message || '登录失败，请检查用户名和密码');
                    submitBtn.disabled = false;
                    submitBtn.textContent = '继续';
                }
            } catch (error) {
                alert('登录失败: ' + error.message);
                submitBtn.disabled = false;
                submitBtn.textContent = '继续';
            }
        });
    }
    
    // 回车键登录
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });
    }
});
