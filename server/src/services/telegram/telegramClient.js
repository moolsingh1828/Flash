import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { ENV } from '../../config/env.js';
import { decrypt, encrypt } from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';

let activeClientInstance = null;
let currentSessionString = '';

export async function getTelegramClient(user = null) {
  if (activeClientInstance && activeClientInstance.connected) {
    return activeClientInstance;
  }

  let sessionString = '';
  if (user && user.encryptedTelegramSession) {
    try {
      sessionString = decrypt(user.encryptedTelegramSession);
    } catch (e) {
      logger.error('Failed to decrypt telegram session.');
    }
  }

  const session = new StringSession(sessionString || currentSessionString);
  const client = new TelegramClient(session, ENV.TELEGRAM_API_ID, ENV.TELEGRAM_API_HASH, {
    connectionRetries: 5
  });

  await client.connect();
  activeClientInstance = client;
  return client;
}

export function saveSessionString(sessionStr) {
  currentSessionString = sessionStr;
}

export function disconnectActiveClient() {
  if (activeClientInstance) {
    try { activeClientInstance.disconnect(); } catch (e) {}
    activeClientInstance = null;
  }
}
