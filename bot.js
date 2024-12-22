const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, WAMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode !==
        DisconnectReason.loggedOut);
      console.log('Connection closed due to: ', lastDisconnect.error);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Opened connection');
    }
  });

  sock.ev.on('messages.upsert', async (upsert) => {
    const message = upsert.messages[0];
    const remoteJid = message.key.remoteJid;
    const fromMe = message.key.fromMe || false; // Default to false if undefined
    const text = message.message?.extendedTextMessage?.text || message.message?.conversation || undefined;

    if (remoteJid && remoteJid.endsWith('@g.us') && !fromMe) {
      if (text === '@tagall') {
        await tagAllParticipants(sock, remoteJid);
      } else if (text === 'Comment') {
        await commentOnParticipants(sock, remoteJid);
      }
    } else {
      console.error('remoteJid tidak valid atau pesan bukan dari grup.');
    }
  });
}

async function tagAllParticipants(sock, remoteJid) {
  try {
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const participants = groupMetadata.participants;
    const mentionedJidList = participants.map((participant) => participant.id);

    await sock.sendMessage(remoteJid, {
      text: '@everyone',
      mentions: mentionedJidList,
    });

    console.log('Tag all berhasil dijalankan.');
  } catch (error) {
    console.error('Error saat mencoba tag all:', error);
  }
}

async function commentOnParticipants(sock, remoteJid) {
  try {
    const groupData = await sock.groupMetadata(remoteJid);
    const mentionedJidList = groupData.participants.map(
      (participant) => participant.id
    );

    await sock.sendMessage(remoteJid, {
      text: '@test', // Replace with your desired message
      mentions: mentionedJidList,
    });

    console.log('Comment berhasil dijalankan.');
  } catch (error) {
    console.error('Error saat mencoba comment:', error);
  }
}

connectToWhatsApp();
