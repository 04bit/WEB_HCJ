
function showScreen(screen) {
    ['loginScreen', 'registerScreen'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(screen).classList.remove('hidden');
}

function showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

document.getElementById('showRegister').onclick = () => showScreen('registerScreen');
document.getElementById('showLogin').onclick = () => showScreen('loginScreen');