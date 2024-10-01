// controllers/AuthController.js

const sha1 = require('sha1');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization || '';
    const [authType, authValue] = authHeader.split(' ');

    if (authType !== 'Basic' || !authValue) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const [email, password] = Buffer.from(authValue, 'base64').toString().split(':');
      if (!email || !password) {
        throw new Error('Invalid credentials');
      }

      const hashedPassword = sha1(password);

      const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

      if (!user) {
        throw new Error('Unauthorized');
      }

      const token = uuidv4();
      const tokenKey = `auth_${token}`;

      await redisClient.set(tokenKey, user._id.toString(), 'EX', 86400); // 24 hours

      return res.status(200).json({ token });
    } catch (error) {
      console.error('Error authenticating user:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokenKey = `auth_${token}`;

    try {
      const userId = await redisClient.get(tokenKey);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await redisClient.del(tokenKey);

      return res.status(204).send();
    } catch (error) {
      console.error('Error disconnecting user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = AuthController;
