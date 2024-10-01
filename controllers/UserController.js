// controllers/UsersController.js

const sha1 = require('sha1');
const { ObjectID } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class UsersController {
  static async postNew(req, res) {
    try {
      const { email, password } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }

      if (!password) {
        return res.status(400).json({ error: 'Missing password' });
      }

      const existingUser = await dbClient.db.collection('users').findOne({ email });

      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      const hashedPassword = sha1(password);

      const newUser = {
        email,
        password: hashedPassword
      };

      const result = await dbClient.db.collection('users').insertOne(newUser);

      const insertedId = result.insertedId;
      if (!insertedId) {
        return res.status(500).json({ error: 'Failed to insert user' });
      }

      return res.status(201).json({ id: insertedId, email });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  static async getMe(req, res) {
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

      const user = await dbClient.db.collection('users').findOne({ _id: new dbClient.ObjectID(userId) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { _id, email } = user;
      if (!_id || !email) {
        return res.status(500).json({ error: 'Failed to retrieve user' });
      }

      return res.status(200).json({ id: _id, email });
    } catch (error) {
      console.error('Error retrieving user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UsersController;