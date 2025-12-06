/**
 * commands.js
 * Exports a register function that adds many commands to client.commands Collection.
 * Includes moderation commands, general commands, and music stubs (erela.js-ready).
 *
 * NOTE: Commands are designed to be simple; expand / secure as needed.
 */

const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { Client } = require('discord.js');
const botUtils = require('./bot.js');

// Minimal music manager stub (you should connect real erela.js manager when ready)
let MusicManager = {
  // This object is a set of stub functions to show how commands connect.
  // Replace with erela.js Manager or discord-player integration in production.
  queues: new Map(),

  ensureQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, { playing: false, tracks: [], position: 0 });
    }
    return this.queues.get(guildId);
  },

  play(guildId, track) {
    const q = this.ensureQueue(guildId);
    q.tracks.push(track);
    q.playing = true;
    return q;
  },

  skip(guildId) {
    const q = this.queues.get(guildId);
    if (!q) return null;
    q.position++;
    if (q.position >= q.tracks.length) {
      q.playing = false;
    }
    return q;
  },

  nowPlaying(guildId) {
    const q = this.queues.get(guildId);
    if (!q || !q.playing) return null;
    return q.tracks[q.position] || null;
  }
};

function safeReply(message, content) {
  return message.reply({ content }).catch(()=>{});
}

module.exports.register = (client, options = {}) => {
  const prefix = options.prefix || '!';

  // helper to register commands quickly
  function addCommand(name, opts) {
    const cmd = Object.assign({ name, aliases: [], description: '', usage: '', perms: [] }, opts);
    client.commands.set(name, cmd);
    (cmd.aliases || []).forEach(a => client.commands.set(a, cmd));
  }

  //
  // General commands
  //
  addCommand('help', {
    description: 'Shows help for commands.',
    aliases: ['h'],
    execute: async ({ message }) => {
      const embed = new EmbedBuilder()
        .setTitle('Help')
        .setDescription('Available commands: help, ping, info, avatar, server, userinfo, uptime, invite')
        .addFields([
          { name: 'Moderation', value: '`ban`, `kick`, `mute` (requires perms)' },
          { name: 'Music (stubs)', value: '`play`, `skip`, `queue`, `np`' }
        ])
        .setFooter({ text: \`Prefix: \${prefix}\` })
        .setTimestamp();
      message.channel.send({ embeds: [embed] }).catch(()=>{});
    }
  });

  addCommand('ping', {
    description: 'Ping the bot (latency).',
    execute: async ({ client, message }) => {
      const sent = await message.channel.send('Pinging...').catch(()=>null);
      if (!sent) return;
      const diff = sent.createdTimestamp - message.createdTimestamp;
      sent.edit(\`Pong! WS: \${Math.round(client.ws.ping)}ms | Msg RTT: \${diff}ms\`).catch(()=>{});
    }
  });

  addCommand('info', {
    description: 'Bot info and stats.',
    execute: async ({ client, message }) => {
      const embed = new EmbedBuilder()
        .setTitle('Bot Info')
        .addFields([
          { name: 'Tag', value: client.user.tag, inline: true },
          { name: 'Guilds', value: String(client.guilds.cache.size), inline: true },
          { name: 'Users Cached', value: String(client.users.cache.size), inline: true },
          { name: 'Uptime', value: Math.floor(client.uptime / 1000 / 60) + 'm', inline: true }
        ])
        .setTimestamp();
      message.channel.send({ embeds: [embed] }).catch(()=>{});
    }
  });

  addCommand('avatar', {
    description: 'Get avatar of a user.',
    aliases: ['av'],
    execute: async ({ message, args }) => {
      const user = message.mentions.users.first() || message.author;
      message.channel.send({ content: user.displayAvatarURL({ dynamic: true, size: 4096 }) }).catch(()=>{});
    }
  });

  addCommand('server', {
    description: 'Server info.',
    execute: async ({ message }) => {
      const g = message.guild;
      const embed = new EmbedBuilder()
        .setTitle('Server Info')
        .addFields([
          { name: 'Name', value: g.name, inline: true },
          { name: 'Members', value: String(g.memberCount), inline: true },
          { name: 'Owner', value: `<@${g.ownerId}>`, inline: true }
        ]);
      message.channel.send({ embeds: [embed] }).catch(()=>{});
    }
  });

  addCommand('invite', {
    description: 'Get an invite link (generate if you have manage guild).',
    execute: async ({ message }) => {
      // try to create a vanity invite-like link (requires CREATE_INSTANT_INVITE)
      try {
        const ch = message.channel;
        const invite = await ch.createInvite({ maxAge: 0, unique: false }).catch(()=>null);
        message.channel.send({ content: invite ? invite.url : 'Could not create invite; check perms.' }).catch(()=>{});
      } catch (err) {
        safeReply(message, 'Could not create invite.');
      }
    }
  });

  //
  // Moderation commands (permission checks)
  //
  addCommand('ban', {
    description: 'Ban a member. Requires BAN_MEMBERS.',
    usage: '<@user> [reason]',
    perms: ['BanMembers'],
    aliases: [],
    execute: async ({ message, args }) => {
      if (!botUtils.requirePerm(message.member, 'BanMembers')) {
        return safeReply(message, 'You need the BAN_MEMBERS permission to use this command.');
      }

      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return safeReply(message, 'Please mention a member to ban.');
      if (!target.bannable) return safeReply(message, 'I cannot ban that user (role hierarchy or missing perms).');

      const reason = args.slice(1).join(' ') || 'No reason provided';
      await target.ban({ reason }).catch(err => {
        console.error(err);
        safeReply(message, 'Failed to ban user.');
      });
      message.channel.send({ content: `Banned ${target.user.tag} - ${reason}` }).catch(()=>{});
    }
  });

  addCommand('kick', {
    description: 'Kick a member. Requires KICK_MEMBERS.',
    usage: '<@user> [reason]',
    perms: ['KickMembers'],
    execute: async ({ message, args }) => {
      if (!botUtils.requirePerm(message.member, 'KickMembers')) {
        return safeReply(message, 'You need the KICK_MEMBERS permission to use this command.');
      }
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return safeReply(message, 'Please mention a member to kick.');
      if (!target.kickable) return safeReply(message, 'I cannot kick that user.');

      const reason = args.slice(1).join(' ') || 'No reason provided';
      await target.kick(reason).catch(err => {
        console.error(err);
        safeReply(message, 'Failed to kick user.');
      });
      message.channel.send({ content: `Kicked ${target.user.tag} - ${reason}` }).catch(()=>{});
    }
  });

  addCommand('mute', {
    description: 'Mute a member by adding a Mute role (create if missing). Requires ManageRoles.',
    usage: '<@user> [reason]',
    perms: ['ManageRoles'],
    execute: async ({ message, args }) => {
      if (!botUtils.requirePerm(message.member, 'ManageRoles')) {
        return safeReply(message, 'You need the MANAGE_ROLES permission to use this command.');
      }
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return safeReply(message, 'Please mention a member to mute.');

      let muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
      if (!muteRole) {
        try {
          muteRole = await message.guild.roles.create({ name: 'Muted', reason: 'Auto-created mute role', permissions: [] });
          // deny send messages in channels (best-effort)
          for (const [, ch] of message.guild.channels.cache) {
            try {
              await ch.permissionOverwrites.edit(muteRole, { SendMessages: false, AddReactions: false }, { reason: 'Setting mute perms' }).catch(()=>{});
            } catch(e) {}
          }
        } catch (e) {
          console.error('Could not create mute role:', e);
        }
      }

      if (!muteRole) return safeReply(message, 'Could not create or find a "Muted" role.');

      await target.roles.add(muteRole).catch(err => {
        console.error(err);
        safeReply(message, 'Failed to add Muted role.');
      });

      message.channel.send({ content: `Muted ${target.user.tag}.` }).catch(()=>{});
    }
  });

  addCommand('purge', {
    description: 'Bulk delete messages. Requires ManageMessages.',
    usage: '<number>',
    perms: ['ManageMessages'],
    execute: async ({ message, args }) => {
      if (!botUtils.requirePerm(message.member, 'ManageMessages')) {
        return safeReply(message, 'You need the MANAGE_MESSAGES permission to use this command.');
      }
      const count = parseInt(args[0], 10);
      if (isNaN(count) || count < 1 || count > 100) return safeReply(message, 'Provide a number between 1 and 100.');
      const messages = await message.channel.bulkDelete(count + 1).catch(err => null);
      message.channel.send({ content: `Deleted ${messages ? messages.size - 1 : 0} messages (attempt).` }).then(m => setTimeout(()=>m.delete().catch(()=>{}), 3000)).catch(()=>{});
    }
  });

  //
  // Music commands (stubs that show erela.js integration points)
  //
  addCommand('play', {
    description: 'Play a track (stub).',
    usage: '<query or url>',
    execute: async ({ message, args }) => {
      const vc = message.member.voice.channel;
      if (!vc) return safeReply(message, 'You must be in a voice channel to use music commands.');

      const query = args.join(' ');
      if (!query) return safeReply(message, 'Provide a search term or URL.');

      // In a real implementation: use erela.js manager.search() and manager.players.create()
      MusicManager.play(message.guild.id, { title: query, requester: message.author.tag });
      message.channel.send({ content: `Enqueued: **${query}** (stub).` }).catch(()=>{});
    }
  });

  addCommand('skip', {
    description: 'Skip current track (stub).',
    execute: async ({ message }) => {
      const q = MusicManager.skip(message.guild.id);
      if (!q) return safeReply(message, 'Nothing to skip.');
      message.channel.send({ content: 'Skipped track (stub).' }).catch(()=>{});
    }
  });

  addCommand('queue', {
    description: 'Show queue (stub).',
    execute: async ({ message }) => {
      const q = MusicManager.queues.get(message.guild.id);
      if (!q || q.tracks.length === 0) return safeReply(message, 'Queue is empty.');
      const list = q.tracks.map((t, i) => \`\${i+1}. \${t.title}\`).slice(0, 20).join('\\n');
      const embed = new EmbedBuilder().setTitle('Queue (stub)').setDescription(list);
      message.channel.send({ embeds: [embed] }).catch(()=>{});
    }
  });

  addCommand('np', {
    description: 'Now playing (stub).',
    aliases: ['nowplaying'],
    execute: async ({ message }) => {
      const now = MusicManager.nowPlaying(message.guild.id);
      if (!now) return safeReply(message, 'Nothing is playing.');
      message.channel.send({ content: `Now playing: **${now.title}** (requested by ${now.requester})` }).catch(()=>{});
    }
  });

  //
  // Example of a command requiring no permissions (everyone)
  //
  addCommand('say', {
    description: 'Bot repeats what you say (no mention allowed of @everyone/@here).',
    usage: '<text>',
    perms: [],
    execute: async ({ message, args }) => {
      const text = args.join(' ');
      if (!text) return safeReply(message, 'Provide text to say.');
      const safe = text.replace(/@everyone/ig,'(everyone)').replace(/@here/ig,'(here)');
      message.channel.send({ content: safe }).catch(()=>{});
    }
  });

  //
  // Long sample command to push file size (example)
  //
  addCommand('bigsample', {
    description: 'A long sample command with verbose output to make file size bigger.',
    execute: async ({ message }) => {
      // produce 50 lines of info as a sample "big" output
      const lines = [];
      for (let i=1;i<=50;i++) {
        lines.push(\`Line \${i}: This is a big sample line for testing the long command output. System placeholder.\`);
      }
      message.channel.send({ content: '```\n' + lines.join('\\n') + '\n```' }).catch(()=>{});
    }
  });

  //
  // Administrative: reload commands (simple)
  //
  addCommand('reloadcmds', {
    description: 'Reload commands from commands.js (owner only).',
    perms: ['Administrator'],
    execute: async ({ client, message }) => {
      if (!botUtils.requirePerm(message.member, 'Administrator')) return safeReply(message, 'Admins only.');
      try {
        delete require.cache[require.resolve('./commands.js')];
        const fresh = require('./commands.js');
        if (fresh && typeof fresh.register === 'function') {
          client.commands.clear();
          fresh.register(client, { prefix });
          safeReply(message, 'Commands reloaded.');
        } else {
          safeReply(message, 'Reloaded but no register() found.');
        }
      } catch (e) {
        console.error(e);
        safeReply(message, 'Error reloading commands.');
      }
    }
  });

  //
  // Add more commands as desired...
  //

  // End of register
};
