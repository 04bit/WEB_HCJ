
function showScreen(screen) {
    ['loginScreen', 'registerScreen'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(screen).classList.remove('hidden');
}

document.getElementById('showRegister').onclick = () => showScreen('registerScreen');
document.getElementById('showLogin').onclick = () => showScreen('loginScreen');