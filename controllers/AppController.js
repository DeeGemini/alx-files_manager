// controllers/AppController.js

const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  static async getStatus(req, res) {
    let redisStatus = false;
    let dbStatus = false;

    try {
      await redisClient.ping();
      redisStatus = true;
    } catch (error) {
      console.error('Redis connection error:', error);
    }

    try {
      await dbClient.isAlive();
      dbStatus = true;
    } catch (error) {
      console.error('Database connection error:', error);
    }

    res.status(200).json({ redis: redisStatus, db: dbStatus });
  }

  static async getStats(req, res) {
    try {
      const usersCount = await dbClient.nbUsers();
      const filesCount = await dbClient.nbFiles();

      res.status(200).json({ users: usersCount, files: filesCount });
    } catch (error) {
      console.error('Error retrieving stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = AppController;
