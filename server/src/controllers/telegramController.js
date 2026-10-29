import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { ENV } from '../config/env.js';
import { encrypt } from '../utils/crypto.js';
import { runChannelImport } from '../services/telegram/historyImporter.js';
import { ImportJob } from '../models/ImportJob.js';
import { disconnectActiveClient, getTelegramClient, saveSessionString } from '../services/telegram/telegramClient.js';

let pendingClient = null;
let phoneCodeHash = null;
let loginPhoneNumber = null;

export async function getStatus(req, res) {
  res.json({
    connected: !!req.user.encryptedTelegramSession,
    phone: req.user.telegramPhoneNumber || null
  });
}

export async function startAuth(req, res, next) {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'Phone number required' });

    loginPhoneNumber = phoneNumber;
    const session = new StringSession('');
    pendingClient = new TelegramClient(session, ENV.TELEGRAM_API_ID, ENV.TELEGRAM_API_HASH, {
      connectionRetries: 3
    });

    await pendingClient.connect();
    const result = await pendingClient.sendCode(
      { apiId: ENV.TELEGRAM_API_ID, apiHash: ENV.TELEGRAM_API_HASH },
      phoneNumber
    );

    phoneCodeHash = result.phoneCodeHash;
    res.json({ message: 'Login code dispatched', phoneCodeHash });
  } catch (err) {
    next(err);
  }
}

export async function verifyCode(req, res, next) {
  try {
    const { code } = req.body;
    if (!pendingClient || !phoneCodeHash) {
      return res.status(400).json({ error: 'Authentication sequence not initialized' });
    }

    try {
      await pendingClient.invoke(
        new (await import('telegram')).Api.auth.SignIn({
          phoneNumber: loginPhoneNumber,
          phoneCodeHash: phoneCodeHash,
          phoneCode: code
        })
      );
    } catch (error) {
      if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
        return res.status(200).json({ requires2FA: true });
      }
      throw error;
    }

    const sessionString = pendingClient.session.save();
    saveSessionString(sessionString);
    req.user.encryptedTelegramSession = encrypt(sessionString);
    req.user.telegramPhoneNumber = loginPhoneNumber;
    await req.user.save();

    res.json({ message: 'Telegram authentication complete' });
  } catch (err) {
    next(err);
  }
}

export async function verify2FA(req, res, next) {
  try {
    const { password } = req.body;
    if (!pendingClient) return res.status(400).json({ error: 'Authentication sequence not found' });

    await pendingClient.signInWithPassword({
      apiId: ENV.TELEGRAM_API_ID,
      apiHash: ENV.TELEGRAM_API_HASH,
      password: password
    });

    const sessionString = pendingClient.session.save();
    saveSessionString(sessionString);
    req.user.encryptedTelegramSession = encrypt(sessionString);
    req.user.telegramPhoneNumber = loginPhoneNumber;
    await req.user.save();

    res.json({ message: '2FA authentication complete' });
  } catch (err) {
    next(err);
  }
}

export async function getChannels(req, res, next) {
  try {
    const client = await getTelegramClient(req.user);
    const dialogs = await client.getDialogs();
    const channels = dialogs
      .filter(d => d.isChannel || d.isGroup)
      .map(d => ({
        id: String(d.id),
        title: d.title || 'Untitled Dialog',
        unreadCount: d.unreadCount,
        isChannel: d.isChannel,
        isGroup: d.isGroup
      }));

    res.json(channels);
  } catch (err) {
    next(err);
  }
}

export async function triggerImport(req, res, next) {
  try {
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId required' });

    const client = await getTelegramClient(req.user);
    const job = await ImportJob.create({ sourceChannelId: channelId, status: 'running' });
    runChannelImport(client, channelId, job._id);

    res.json({ message: 'Import background task triggered', jobId: job._id });
  } catch (err) {
    next(err);
  }
}

export async function getImportStatus(req, res, next) {
  try {
    const job = await ImportJob.findById(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Import job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function cancelImport(req, res, next) {
  try {
    const job = await ImportJob.findById(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    job.status = 'cancelled';
    await job.save();
    res.json({ message: 'Import cancellation requested' });
  } catch (err) {
    next(err);
  }
}

export async function disconnect(req, res, next) {
  try {
    req.user.encryptedTelegramSession = null;
    req.user.telegramPhoneNumber = null;
    await req.user.save();
    disconnectActiveClient();
    res.json({ message: 'Telegram account disconnected' });
  } catch (err) {
    next(err);
  }
}
