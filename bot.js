/**
 * bot.js - Helper utilities for the bot
 * Contains common permission checks, embed builders, and small utilities used by commands.
 */

const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  hasPerms: (member, perm) => {
    if (!member) return false;
    return member.permissions.has(PermissionsBitField.Flags[perm]) || member.permissions.has(PermissionsBitField.Flags.Administrator);
  },

  requirePerm: (member, perm) => {
    if (!member) return false;
    if (member.permissions.has(PermissionsBitField.Flags[perm])) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return false;
  },

  makeEmbed: (title, description, footer) => {
    const e = new EmbedBuilder().setTitle(title || '').setDescription(description || '').setTimestamp();
    if (footer) e.setFooter({ text: footer });
    return e;
  },

  // safe mention helper
  safeMention: member => {
    if (!member) return '';
    if (member.nickname) return \`\${member.nickname} (\${member.user.tag})\`;
    return member.user.tag;
  }
};
