const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('MySQL 接続成功');

    const [rows] = await conn.query('SELECT 1 AS result');
    console.log(rows);

    await conn.end();
  } catch (err) {
    console.error('MySQL 接続失敗');
    console.error(err.message);
  }
})();