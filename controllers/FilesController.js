// controllers/FilesController.js

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class FilesController {
  static async postUpload(req, res) {
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

      const { name, type, parentId = 0, isPublic = false, data } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }

      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }

      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      if (parentId) {
        const parentFile = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectID(parentId) });
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }

        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      const newFile = {
        userId: new dbClient.ObjectID(userId),
        name,
        type,
        isPublic,
        parentId: parentId === 0 ? 0 : new dbClient.ObjectID(parentId)
      };

      if (type === 'folder') {
        const result = await dbClient.db.collection('files').insertOne(newFile);
        return res.status(201).json({ id: result.insertedId, ...newFile });
      } else {
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }

        const localPath = path.join(folderPath, uuidv4());
        fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

        newFile.localPath = localPath;
        const result = await dbClient.db.collection('files').insertOne(newFile);
        return res.status(201).json({ id: result.insertedId, ...newFile });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async getShow(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const tokenKey = `auth_${token}`;
      const userId = await redisClient.get(tokenKey);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileId = req.params.id;
      const file = await dbClient.db.collection('files')
        .findOne({ _id: new dbClient.ObjectID(fileId), userId: new dbClient.ObjectID(userId) });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json(file);
    } catch (error) {
      console.error('Error retrieving file:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getIndex(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const tokenKey = `auth_${token}`;
      const userId = await redisClient.get(tokenKey);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const parentId = req.query.parentId ? new dbClient.ObjectID(req.query.parentId) : 0;
      const page = parseInt(req.query.page, 10) || 0;
      const pageSize = 20;

      const files = await dbClient.db.collection('files')
        .find({ userId: new dbClient.ObjectID(userId), parentId })
        .skip(page * pageSize)
        .limit(pageSize)
        .toArray();

      return res.status(200).json(files);
    } catch (error) {
      console.error('Error retrieving files:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FilesController;