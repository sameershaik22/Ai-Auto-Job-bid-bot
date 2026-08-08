import express from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { startImapListener } from '../services/emailService.js';

const router = express.Router();

const ENCRYPTION_KEY = (process.env.CREDENTIAL_KEY || process.env.JWT_SECRET || 'autobid-default-key-32-chars!!').padEnd(32, '!').substring(0, 32);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT id, platform, email, created_at, updated_at FROM platform_credentials WHERE user_id = $1 ORDER BY platform', [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { platform, email, password } = req.body;
    if (!platform || !email) {
      return res.status(400).json({ error: 'platform and email are required' });
    }

    const encryptedPassword = encrypt(password);
    const existing = await queryOne('SELECT id FROM platform_credentials WHERE platform = $1 AND user_id = $2', [platform, req.user.id]);

    if (existing) {
      await query(
        'UPDATE platform_credentials SET email=$1, password_enc=$2, updated_at=CURRENT_TIMESTAMP WHERE platform=$3 AND user_id=$4',
        [email, encryptedPassword, platform, req.user.id]
      );
    } else {
      const id = `cred_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
      await query(
        'INSERT INTO platform_credentials (id, user_id, platform, email, password_enc) VALUES ($1,$2,$3,$4,$5)',
        [id, req.user.id, platform, email, encryptedPassword]
      );
    }

    if (platform === 'gmail') {
      startImapListener(req.user.id, { email, password });
    }

    res.json({ success: true, platform });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:platform/decrypt', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM platform_credentials WHERE platform = $1 AND user_id = $2', [req.params.platform, req.user.id]);
    if (!row) return res.status(404).json({ error: 'Credentials not found' });
    res.json({ platform: row.platform, email: row.email, password: decrypt(row.password_enc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:platform', async (req, res) => {
  try {
    await query('DELETE FROM platform_credentials WHERE platform = $1 AND user_id = $2', [req.params.platform, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { decrypt };
export default router;
