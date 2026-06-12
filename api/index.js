const serverless = require('serverless-http');
const app = require('../lifelink-backend/server');

module.exports = serverless(app);