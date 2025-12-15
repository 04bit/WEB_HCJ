// test-api.js - APIの動作確認用スクリプト
const API_URL = 'http://127.0.0.1:3306/api';

async function testAPI() {
  console.log('🧪 API動作テスト開始\n');

  try {
    // 1. ヘルスチェック
    console.log('ヘルスチェック...');
    const health = await fetch('http://127.0.0.1:3306/health', {
      signal: AbortSignal.timeout(5000)
    });
    const healthData = await health.json();
    console.log('✅ サーバー稼働中:', healthData);
    console.log('');

    // 2. 新規登録
    console.log('新規ユーザー登録...');
    const testEmail = `test${Date.now()}@example.com`;
    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: testEmail,
        password: 'password123'
      }),
      signal: AbortSignal.timeout(5000)
    });
    const registerData = await registerRes.json();
    console.log('✅ 登録成功:', registerData);
    console.log('');

    // 3. ログイン
    console.log('ログイン...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123'
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!loginRes.ok) {
      const errorData = await loginRes.json();
      console.log('❌ ログイン失敗:', errorData);
      return;
    }

    const loginData = await loginRes.json();
    console.log('✅ ログイン成功');
    console.log('トークン:', loginData.token.substring(0, 20) + '...');
    console.log('ユーザー:', loginData.user);
    console.log('');

    const token = loginData.token;

    // 4. 出勤打刻
    console.log('出勤打刻...');
    const clockInRes = await fetch(`${API_URL}/attendance/clock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: '出勤',
        time: '09:00:00'
      }),
      signal: AbortSignal.timeout(5000)
    });
    const clockInData = await clockInRes.json();
    console.log('✅ 出勤打刻成功:', clockInData);
    console.log('');

    // 5. 本日の勤怠取得
    console.log('本日の勤怠取得...');
    const todayRes = await fetch(`${API_URL}/attendance/today`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: AbortSignal.timeout(5000)
    });
    const todayData = await todayRes.json();
    console.log('✅ 本日の勤怠:', todayData);
    console.log('');

    // 6. 勤怠履歴取得
    console.log('勤怠履歴取得...');
    const historyRes = await fetch(`${API_URL}/attendance/history`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: AbortSignal.timeout(5000)
    });
    const historyData = await historyRes.json();
    console.log('✅ 勤怠履歴:', historyData);
    console.log('');

    console.log('🎉 全てのテストが成功しました！');

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ タイムアウトエラー: サーバーが起動していない可能性があります');
      console.error('   → 別のターミナルで `npm run dev` を実行してください');
    } else if (error.cause && error.cause.code === 'ECONNREFUSED') {
      console.error('❌ 接続エラー: サーバーが起動していません');
      console.error('   → 別のターミナルで `npm run dev` を実行してください');
    } else {
      console.error('❌ エラー:', error.message);
      console.error('   詳細:', error);
    }
  }
}

// Node.js環境で実行
if (typeof window === 'undefined') {
  testAPI();
}

module.exports = testAPI;