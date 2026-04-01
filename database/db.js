const path = require("path");
const Database = require("better-sqlite3");
const { schemaSql, seedSql } = require("./migrations");

let db;

function initializeDatabase() {
  if (db) {
    return db;
  }
  const dbPath = path.join(process.cwd(), "database", "velance.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(schemaSql);
  const tx = db.transaction(() => {
    seedSql.forEach(([sql, key, value]) => {
      db.prepare(sql).run(key, value);
    });
  });
  tx();
  return db;
}

function getDb() {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

module.exports = {
  initializeDatabase,
  getDb
};
