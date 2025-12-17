#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
const daysToKeep = 30; // 保持する日数

console.log('🧹 ログファイルのクリーンアップを開始します...\n');

try {
    if (!fs.existsSync(logsDir)) {
        console.log('ログディレクトリが存在しません:', logsDir);
        process.exit(0);
    }

    const files = fs.readdirSync(logsDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    let deletedSize = 0;

    files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
            const sizeKB = (stats.size / 1024).toFixed(2);
            console.log(`🗑️  削除: ${file} (${sizeKB} KB, ${Math.floor(age / (24 * 60 * 60 * 1000))} 日前)`);
            fs.unlinkSync(filePath);
            deletedCount++;
            deletedSize += stats.size;
        }
    });

    if (deletedCount === 0) {
        console.log('✅ 削除するログファイルはありません');
    } else {
        const savedMB = (deletedSize / 1024 / 1024).toFixed(2);
        console.log(`\n✅ ${deletedCount} 個のファイルを削除しました（${savedMB} MB解放）`);
    }

    // 残りのファイル情報
    const remainingFiles = fs.readdirSync(logsDir);
    if (remainingFiles.length > 0) {
        const totalSize = remainingFiles.reduce((sum, file) => {
            const stats = fs.statSync(path.join(logsDir, file));
            return sum + stats.size;
        }, 0);
        const totalMB = (totalSize / 1024 / 1024).toFixed(2);
        console.log(`\n📁 残りのログファイル: ${remainingFiles.length} 個 (${totalMB} MB)`);
    }

} catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
}