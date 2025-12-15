const http = require('http');

console.log('🔍 サーバー接続テスト開始...\n');

const options = {
    hostname: '127.0.0.1',
    port: 3306,
    path: '/health',
    method: 'GET',
    timeout: 5000
};

const req = http.request(options, (res) => {
    console.log('✅ サーバーに接続成功!');
    console.log(`ステータスコード: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('レスポンス:', data);
        console.log('\n✅ サーバーは正常に動作しています！');
        console.log('次のコマンドでテストを実行してください: npm test');
    });
});

req.on('error', (error) => {
    console.error('❌ サーバーに接続できません\n');

    if (error.code === 'ECONNREFUSED') {
        console.error('原因: サーバーが起動していません');
        console.error('\n対処法:');
        console.error('1. 別のターミナルを開く');
        console.error('2. 以下のコマンドを実行: npm run dev');
        console.error('3. "Server running on port 3000" と表示されるまで待つ');
        console.error('4. このテストを再実行');
    } else if (error.code === 'ETIMEDOUT') {
        console.error('原因: 接続がタイムアウトしました');
        console.error('\n対処法:');
        console.error('1. ファイアウォールの設定を確認');
        console.error('2. ポート3000が使用可能か確認');
    } else {
        console.error('エラー詳細:', error);
    }
});

req.on('timeout', () => {
    console.error('❌ タイムアウト: サーバーからの応答がありません');
    req.destroy();
});

req.end();