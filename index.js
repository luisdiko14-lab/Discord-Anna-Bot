/**
 * index.js - Entry point
 * Loads environment, creates Client, registers commands from commands.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');

const PREFIX = process.env.PREFIX || '!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

const commandsModule = require('./commands.js');
if (commandsModule && typeof commandsModule.register === 'function') {
  commandsModule.register(client, { prefix: PREFIX });
} else {
  console.warn('commands.js did not export a register function');
}

client.once('ready', () => {
  console.log(\`\${client.user.tag} is online. Prefix: "\${PREFIX}"\`);
  // set activity
  client.user.setActivity('Type !help | Music & Moderation', { type: 'Listening' });
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = PREFIX;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\\s+/);
  const cmdName = args.shift().toLowerCase();

  const cmd = client.commands.get(cmdName) || client.commands.find(c => c.aliases && c.aliases.includes(cmdName));
  if (!cmd) return;

  try {
    await cmd.execute({ client, message, args, prefix });
  } catch (err) {
    console.error('Command error:', err);
    message.reply({ content: 'There was an error while executing that command.' }).catch(()=>{});
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('No DISCORD_TOKEN in .env - copy .env.example to .env and add your token.');
  process.exit(1);
}

client.login(token);
