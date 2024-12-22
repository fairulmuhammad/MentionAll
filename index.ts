import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";

import qrcode from "qrcode-terminal"; // Import the qrcode-terminal library

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const sock: WASocket = makeWASocket({
    auth: state,
    printQRInTerminal: false,  // Disable default QR code printing
  });

  sock.ev.on("creds.update", saveCreds);

  // Listen for connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    // If QR code is part of the connection update, print it
    if (qr) {
      console.log("QR Code received, scan the QR code to login.");
      qrcode.generate(qr, { small: true }); // Generate and print the QR code to the terminal
    }

    // Handle connection close and reconnect if necessary
    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect!.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("Connection closed due to: ", lastDisconnect!.error);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("Opened connection");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];
    console.log(message);

    const remoteJid = message.key.remoteJid;
    if (remoteJid && typeof remoteJid === "string") {
      const messageText =
        message.message?.extendedTextMessage?.text ||
        message.message?.conversation ||
        "";

      if (messageText === ".tagall") {
        const groupData = await sock.groupMetadata(remoteJid);
        const participants = groupData.participants;

        // Construct message text by collecting participant names (pushName) or fallback to ID
        const mentions = participants.map((participant) => participant.id);
        const participantNames = participants.map((participant) => {
          // Check if pushName exists, otherwise fallback to participant's ID
          return participant.notify || participant.id.split("@")[0];
        });

        // Construct the message text to mention all participants
        const messageTextWithMentions = `@${participantNames.join(", @")}: hi`;

        // Send the message with mentions
        await sock.sendMessage(remoteJid, {
          text: messageTextWithMentions,
          mentions,
        });
      }
    } else {
      console.error("remoteJid is invalid or not a string");
    }
  });
}

connectToWhatsApp();
