// This file is the entire "switch" between MySQL, PostgreSQL, and MongoDB.
// Whichever one DB_TYPE names is the one server.js ends up using — nothing
// else in the app needs to change.
const DB_TYPE = process.env.DB_TYPE || "mysql";

const adapters = {
  mysql: require("./mysql"),
  postgres: require("./postgres"),
  mongodb: require("./mongodb"),
};

if (!adapters[DB_TYPE]) {
  throw new Error(`Unknown DB_TYPE "${DB_TYPE}". Use mysql, postgres, or mongodb.`);
}

module.exports = adapters[DB_TYPE];
