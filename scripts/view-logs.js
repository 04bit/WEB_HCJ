#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logsDir = path.join(__dirname, '../logs');

// ログファイル一覧を取得
function getLogFiles() {
    try {
        const files = fs.readdirSync(logsDir)
            .filter(file => file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: path.join(logsDir, file),
                stats: fs.statSync(path.join(logsDir, file))
            }))
            .sort((a, b) => b.stats.mtime - a.stats.mtime);

        return files;
    } catch (error) {
        console.error('ログディレクトリが見つかりません:', logsDir);
        return [];
    }
}

// ログファイルを表示
function displayLogs(filePath, lines = 50) {
    console.log(`\n📄 ログファイル: ${path.basename(filePath)}\n`);
    console.log('='.repeat(80));

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const logLines = fileContent.split('\n').filter(line => line.trim());

    // 最新N行を表示
    const recentLines = logLines.slice(-lines);

    recentLines.forEach(line => {
        try {
            const log = JSON.parse(line);
            const timestamp = log.timestamp || '';
            const level = (log.level || '').toUpperCase();
            const message = log.message || '';

            // レベルに応じて色付け
            let color = '\x1b[0m'; // デフォルト
            if (level === 'ERROR') color = '\x1b[31m'; // 赤
            else if (level === 'WARN') color = '\x1b[33m'; // 黄
            else if (level === 'INFO') color = '\x1b[32m'; // 緑
            else if (level === 'HTTP') color = '\x1b[36m'; // シアン

            console.log(`${color}[${timestamp}] [${level}] ${message}\x1b[0m`);

            // 追加情報があれば表示
            const meta = { ...log };
            delete meta.timestamp;
            delete meta.level;
            delete meta.message;

            if (Object.keys(meta).length > 0) {
                console.log('  ', JSON.stringify(meta, null, 2).replace(/\n/g, '\n   '));
            }
        } catch (e) {
            // JSONパースエラーの場合はそのまま表示
            console.log(line);
        }
    });

    console.log('='.repeat(80));
    console.log(`\n表示: ${recentLines.length} / ${logLines.length} 行\n`);
}

// エラーログのみを抽出
function displayErrors(filePath) {
    console.log(`\n🚨 エラーログ: ${path.basename(filePath)}\n`);
    console.log('='.repeat(80));

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const logLines = fileContent.split('\n').filter(line => line.trim());

    const errorLines = logLines.filter(line => {
        try {
            const log = JSON.parse(line);
            return log.level === 'error' || log.level === 'warn';
        } catch {
            return false;
        }
    });

    if (errorLines.length === 0) {
        console.log('✅ エラーはありません');
    } else {
        errorLines.forEach(line => {
            const log = JSON.parse(line);
            console.log(`\x1b[31m[${log.timestamp}] ${log.message}\x1b[0m`);
            if (log.stack) {
                console.log(`  Stack: ${log.stack.split('\n')[0]}`);
            }
        });
    }

    console.log('='.repeat(80));
    console.log(`\nエラー/警告: ${errorLines.length} 件\n`);
}

// 統計情報を表示
function displayStats(files) {
    console.log('\n📊 ログファイル統計\n');
    console.log('='.repeat(80));

    files.forEach(file => {
        const sizeKB = (file.stats.size / 1024).toFixed(2);
        const modified = file.stats.mtime.toLocaleString('ja-JP');
        console.log(`📁 ${file.name}`);
        console.log(`   サイズ: ${sizeKB} KB`);
        console.log(`   更新日時: ${modified}`);
        console.log();
    });

    const totalSize = files.reduce((sum, f) => sum + f.stats.size, 0);
    console.log(`合計サイズ: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('='.repeat(80));
}

// メイン処理
const args = process.argv.slice(2);
const command = args[0];

const files = getLogFiles();

if (files.length === 0) {
    console.log('ログファイルが見つかりません');
    process.exit(1);
}

switch (command) {
    case 'list':
        displayStats(files);
        break;

    case 'errors':
        const latestLog = files[0];
        displayErrors(latestLog.path);
        break;

    case 'tail':
        const lines = parseInt(args[1]) || 50;
        const logFile = files[0];
        displayLogs(logFile.path, lines);
        break;

    default:
        console.log(`
📝 ログ閲覧ツール

使い方:
  node scripts/view-logs.js [コマンド] [オプション]

コマンド:
  list              ログファイル一覧と統計を表示
  errors            エラーログのみを表示
  tail [行数]       最新のログを表示（デフォルト: 50行）

例:
  node scripts/view-logs.js list
  node scripts/view-logs.js errors
  node scripts/view-logs.js tail 100
    `);
}