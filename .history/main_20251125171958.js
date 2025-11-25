
document.addEventListener('DOMContentLoaded', () => {
    const selectors = ['loginScreen', 'registerScreen', 'appScreen'];

    function showScreen(screen) {
        selectors.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(screen);
        if (target) target.classList.remove('hidden');
    }

    function showTempMessage(elementId, message, isError = false) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = message;
        el.style.display = 'block';
        el.classList.toggle('error-message', isError);
        setTimeout(() => {
            el.style.display = 'none';
            el.textContent = '';
        }, 3000);
    }

    // Attach simple navigation handlers (protect against missing elements)
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    if (showRegister) showRegister.addEventListener('click', (e) => { e.preventDefault(); showScreen('registerScreen'); });
    if (showLogin) showLogin.addEventListener('click', (e) => { e.preventDefault(); showScreen('loginScreen'); });

    // Form handling
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = (document.getElementById('registerName') || {}).value || '';
            const email = (document.getElementById('registerEmail') || {}).value || '';
            const password = (document.getElementById('registerPassword') || {}).value || '';
            const passwordConfirm = (document.getElementById('registerPasswordConfirm') || {}).value || '';

            const registerErrorEl = document.getElementById('registerError');
            const registerSuccessEl = document.getElementById('registerSuccess');
            if (registerErrorEl) { registerErrorEl.textContent = ''; registerErrorEl.style.display = 'none'; }
            if (registerSuccessEl) { registerSuccessEl.textContent = ''; registerSuccessEl.style.display = 'none'; }

            if (!name || !email || !password) {
                if (registerErrorEl) { registerErrorEl.textContent = '必須項目を入力してください。'; registerErrorEl.style.display = 'block'; }
                return;
            }
            if (password !== passwordConfirm) {
                if (registerErrorEl) { registerErrorEl.textContent = 'パスワードが一致しません。'; registerErrorEl.style.display = 'block'; }
                return;
            }

            // TODO: 実際のサーバー呼び出しやユーザー保存処理をここに追加
            if (registerSuccessEl) {
                registerSuccessEl.textContent = '登録が完了しました。ログイン画面に戻ります。';
                registerSuccessEl.style.display = 'block';
            }

            // 2秒後にログイン画面へ戻す（ユーザーにメッセージを表示するため）
            setTimeout(() => {
                if (registerForm) registerForm.reset();
                showScreen('loginScreen');
            }, 2000);
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = (document.getElementById('loginEmail') || {}).value || '';
            const password = (document.getElementById('loginPassword') || {}).value || '';
            const loginErrorEl = document.getElementById('loginError');
            if (loginErrorEl) { loginErrorEl.textContent = ''; loginErrorEl.style.display = 'none'; }

            if (!email || !password) {
                if (loginErrorEl) { loginErrorEl.textContent = 'メールアドレスとパスワードを入力してください。'; loginErrorEl.style.display = 'block'; }
                return;
            }

            // TODO: サーバー認証を追加。ここでは成功したものとして振る舞う。
            if (loginErrorEl) { loginErrorEl.textContent = 'ログイン成功（デモ）。'; loginErrorEl.style.display = 'block'; }

            // 実際のアプリ画面があればここで切り替える（`appScreen` が存在する場合のみ）
            const appEl = document.getElementById('appScreen');
            if (appEl) {
                showScreen('appScreen');
            }
        });
    }
});