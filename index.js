// استيراد المكتبات
const { Client, IntentsBitField, Partials, EmbedBuilder, PermissionsBitField } = require('discord.js');
require('dotenv').config();

// إعداد عميل Discord
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.GuildMessageReactions, 
    IntentsBitField.Flags.DirectMessageReactions,
  ],
  partials: [
    Partials.Channel,
    Partials.Message, 
    Partials.Reaction, 
    Partials.User
  ]
});

// متغيرات البيئة
const prefix = process.env.prefix || '+'; // افتراضياً '+' إذا لم يتم تحديده
const ALLOWED_USER = process.env.AllowedUser; 

// حالة البوت عند الجاهزية
client.once("ready", () => {
  console.log("Bot is Ready!");
  console.log("Code by Studio MILLION");
  console.log("discord.gg/1million");
  client.user.setActivity(`Studio MILLION`);
  client.user.setStatus("online");
});

// التعامل مع الرسائل والأوامر
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  
  // أمر ping
  if (message.content === prefix + 'ping') {
    const msg = await message.channel.send("Ping..");
    const timeTaken = msg.createdTimestamp - message.createdTimestamp;
    await msg.delete();
    message.channel.send(`\`\`\`javascript\nDiscord API: ${Math.round(client.ws.ping)} ms\nTime taken: ${timeTaken} ms\n\`\`\``);
  }

  // أمر help
  if (message.content.startsWith(prefix + "help")) {
    const help = new EmbedBuilder()
      .setTitle(`Help Menu`)
      .setColor("#a4c8fd")
      .setFooter({ text: `${message.author.tag}`, iconURL: `${message.author.displayAvatarURL({ dynamic: true })}` })
      .setTimestamp()
      .setDescription(`**__Commands__**  
          ـــــــــــــــــــــــــ
          **Main Cmds**
          ${prefix}ping 
          ${prefix}support
          ـــــــــــــــــــــــــ
          **BroadCast Cmds**
          ${prefix}bc  <- ALL
          ${prefix}obc <- Online only
          ${prefix}fbc <- Offline only
          ـــــــــــــــــــــــــ
          By : NL_j
          Studio 1MILLION **|** [**Support Server**](https://discord.gg/1million)`);
    message.channel.send({ embeds: [help] });
  }

  // أوامر البث
  handleBroadcastCommands(message);
});

// دالة لمعالجة أوامر البث
async function handleBroadcastCommands(message) {
  if (!message.channel.guild || message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (["bc", "obc", "fbc"].includes(command) && message.author.id !== ALLOWED_USER) {
    return message.reply("You are not allowed to use this command.");
  }

  if (command === "bc") {
    await handleBcCommand(message, args);
  } else if (command === "obc") {
    await handleObcCommand(message, args);
  } else if (command === "fbc") {
    await handleFbcCommand(message, args);
  }
}

// معالجة أمر البث لجميع الأعضاء
async function handleBcCommand(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.channel.send("**You don't have the required permissions to use this command.**");
  }
  if (!args.length) {
    return message.reply("**Please provide a message to send.**");
  }

  const confirmMessage = await message.channel.send(`**Are you sure you want to send this message?**\n\`\`\`${args.join(' ')}\`\`\``);
  await confirmMessage.react("✅");
  await confirmMessage.react("❌");

  const filter = (reaction, user) => {
    return ["✅", "❌"].includes(reaction.emoji.name) && user.id === message.author.id;
  };

  const collector = confirmMessage.createReactionCollector({ filter, max: 1, time: 60000 });

  collector.on('collect', async (reaction, user) => {
    if (reaction.emoji.name === "✅") {
      confirmMessage.delete();

      // إنشاء رسالة الإحصائيات الأولية
      const statsMessage = await message.channel.send("**Broadcast Started...**");

      let sentCount = 0;
      let failedCount = 0;
      const members = await message.guild.members.fetch();
      const broadcastMembers = members.filter(member => !member.user.bot);
      const totalMembers = broadcastMembers.size;
      const botCount = members.size - totalMembers;

      // دالة لتحديث الإحصائيات
      const updateStats = async (sent, failed) => {
        sentCount = sent;
        failedCount = failed;
        const remaining = totalMembers - sentCount - failedCount;

        const statsEmbed = await createStatsEmbed(totalMembers, sentCount, failedCount, remaining, botCount);

        try {
          await statsMessage.edit({ embeds: [statsEmbed], content: "**Broadcast In Progress...**" });
        } catch (error) {
          if (error.code === 10008) { // Unknown Message
            console.warn("Stats message was deleted. Sending a new message with final stats.");
            await message.channel.send({ embeds: [statsEmbed], content: "**Broadcast In Progress...**" });
          } else {
            console.error("Error updating stats message:", error);
          }
        }
      };

      // بدء مؤقت لتحديث الإحصائيات كل 5 ثوانٍ
      const statsInterval = setInterval(() => {
        updateStats(sentCount, failedCount);
      }, 5000); // 5000 ميلي ثانية = 5 ثوانٍ

      // إرسال الرسائل
      const { sentCount: totalSent, failedCount: totalFailed } = await sendMessagesToMembers(
        broadcastMembers,
        args.join(' '),
        500, // تأخير 0.5 ثانية بين كل رسالة
        updateStats
      );

      clearInterval(statsInterval); // إيقاف تحديث الإحصائيات

      // إرسال الإحصائيات النهائية
      await sendFinalStats(statsMessage, totalMembers, totalSent, totalFailed, botCount);

      // إضافة رسالة الانتهاء
      await message.channel.send("**تم الانتهاء من Broadcast**");

    } else if (reaction.emoji.name === "❌") {
      confirmMessage.delete();
      const sentMessage = await message.channel.send("**Broadcast has been canceled.**");
      setTimeout(() => sentMessage.delete(), 3000);
    }
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      confirmMessage.delete();
      message.channel.send("**No reaction after 60 seconds, operation canceled.**").then(msg => setTimeout(() => msg.delete(), 3000));
    }
  });
}

// معالجة أمر البث للأعضاء المتصلين فقط
async function handleObcCommand(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.channel.send("**You don't have the required permissions to use this command.**");
  }
  if (!args.length) {
    return message.reply("**Please provide a message to send.**");
  }

  const confirmMessage = await message.channel.send(`**Are you sure you want to send this message?**\n\`\`\`${args.join(' ')}\`\`\``);
  await confirmMessage.react("✅");
  await confirmMessage.react("❌");

  const filter = (reaction, user) => {
    return ["✅", "❌"].includes(reaction.emoji.name) && user.id === message.author.id;
  };

  const collector = confirmMessage.createReactionCollector({ filter, max: 1, time: 60000 });

  collector.on('collect', async (reaction, user) => {
    if (reaction.emoji.name === "✅") {
      confirmMessage.delete();

      // إنشاء رسالة الإحصائيات الأولية
      const statsMessage = await message.channel.send("**Broadcast Started...**");

      let sentCount = 0;
      let failedCount = 0;
      const members = await message.guild.members.fetch();
      const onlineMembers = members.filter(member => member.presence && member.presence.status !== "offline" && !member.user.bot);
      const totalMembers = onlineMembers.size;
      const botCount = members.size - totalMembers;

      // دالة لتحديث الإحصائيات
      const updateStats = async (sent, failed) => {
        sentCount = sent;
        failedCount = failed;
        const remaining = totalMembers - sentCount - failedCount;

        const statsEmbed = await createStatsEmbed(totalMembers, sentCount, failedCount, remaining, botCount);

        try {
          await statsMessage.edit({ embeds: [statsEmbed], content: "**Broadcast In Progress...**" });
        } catch (error) {
          if (error.code === 10008) { // Unknown Message
            console.warn("Stats message was deleted. Sending a new message with final stats.");
            await message.channel.send({ embeds: [statsEmbed], content: "**Broadcast In Progress...**" });
          } else {
            console.error("Error updating stats message:", error);
          }
        }
      };

      // بدء مؤقت لتحديث الإحصائيات كل 5 ثوانٍ
      const statsInterval = setInterval(() => {
        updateStats(sentCount, failedCount);
      }, 5000); // 5000 ميلي ثانية = 5 ثوانٍ

      // إرسال الرسائل
      const { sentCount: totalSent, failedCount: totalFailed } = await sendMessagesToMembers(
        onlineMembers,
        args.join(' '),
        500, // تأخير 0.5 ثانية بين كل رسالة
        updateStats
      );

      clearInterval(statsInterval); // إيقاف تحديث الإحصائيات

      // إرسال الإحصائيات النهائية
      await sendFinalStats(statsMessage, totalMembers, totalSent, totalFailed, botCount);

      // إضافة رسالة الانتهاء
      await message.channel.send("**تم الانتهاء من Broadcast**");

    } else if (reaction.emoji.name === "❌") {
      confirmMessage.delete();
      const sentMessage = await message.channel.send("**Broadcast has been canceled.**");
      setTimeout(() => sentMessage.delete(), 3000);
    }
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      confirmMessage.delete();
      message.channel.send("**No reaction after 60 seconds, operation canceled.**").then(msg => setTimeout(() => msg.delete(), 3000));
    }
  });
}

// معالجة أمر البث للأعضاء غير المتصلين فقط
async function handleFbcCommand(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.channel.send("**You don't have the required permissions to use this command.**");
  }
  if (!args.length) {
    return message.reply("**Please provide a message to send.**");
  }

  const confirmMessage = await message.channel.send(`**Are you sure you want to send this message?**\n\`\`\`${args.join(' ')}\`\`\``);
  await confirmMessage.react("✅");
  await confirmMessage.react("❌");

  const filter = (reaction, user) => {
    return ["✅", "❌"].includes(reaction.emoji.name) && user.id === message.author.id;
  };

  const collector = confirmMessage.createReactionCollector({ filter, max: 1, time: 60000 });

  collector.on('collect', async (reaction, user) => {
    if (reaction.emoji.name === "✅") {
      confirmMessage.delete();

      // إنشاء رسالة الإحصائيات الأولية
      const statsMessage = await message.channel.send("**Broadcast Started...**");

      let sentCount = 0;
      let failedCount = 0;
      const members = await message.guild.members.fetch();
      const offlineMembers = members.filter(member => (!member.presence || member.presence.status === "offline") && !member.user.bot);
      const totalMembers = offlineMembers.size;
      const botCount = members.size - totalMembers;

      // دالة لتحديث الإحصائيات
      const updateStats = async (sent, failed) => {
        sentCount = sent;
        failedCount = failed;
        const remaining = totalMembers - sentCount - failedCount;

        const statsEmbed = await createStatsEmbed(totalMembers, sentCount, failedCount, remaining, botCount);

        try {
          await statsMessage.edit({ embeds: [statsEmbed], content: "**Broadcast In Progress...**" });
        } catch (error) {
          if (error.code === 10008) { // Unknown Message
            console.warn("Stats message was deleted. Sending a new message with final stats.");
            await message.channel.send({ embeds: [statsEmbed], content: "**Broadcast In Progress...**" });
          } else {
            console.error("Error updating stats message:", error);
          }
        }
      };

      // بدء مؤقت لتحديث الإحصائيات كل 5 ثوانٍ
      const statsInterval = setInterval(() => {
        updateStats(sentCount, failedCount);
      }, 5000); // 5000 ميلي ثانية = 5 ثوانٍ

      // إرسال الرسائل
      const { sentCount: totalSent, failedCount: totalFailed } = await sendMessagesToMembers(
        offlineMembers,
        args.join(' '),
        500, // تأخير 0.5 ثانية بين كل رسالة
        updateStats
      );

      clearInterval(statsInterval); // إيقاف تحديث الإحصائيات

      // إرسال الإحصائيات النهائية
      await sendFinalStats(statsMessage, totalMembers, totalSent, totalFailed, botCount);

      // إضافة رسالة الانتهاء
      await message.channel.send("**تم الانتهاء من Broadcast**");

    } else if (reaction.emoji.name === "❌") {
      confirmMessage.delete();
      const sentMessage = await message.channel.send("**Broadcast has been canceled.**");
      setTimeout(() => sentMessage.delete(), 3000);
    }
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      confirmMessage.delete();
      message.channel.send("**No reaction after 60 seconds, operation canceled.**").then(msg => setTimeout(() => msg.delete(), 3000));
    }
  });
}

// دالة لإرسال الرسائل إلى الأعضاء مع تأخير ومعالجة الأخطاء
async function sendMessagesToMembers(members, messageContent, delay, updateStats) {
  let sentCount = 0;
  let failedCount = 0;

  for (const member of members.values()) {
    if (!member.user.bot) {
      try {
        // بناء الرسالة مع المنشن
        const dmMessage = `${messageContent}\n<@${member.id}>`;
        await member.send(dmMessage);
        sentCount++;
      } catch (err) {
        if (err.code === 50007) { // Cannot send messages to this user
          console.log(`Cannot send message to ${member.user.tag} (User has DMs disabled or bot is blocked).`);
        } else if (err.code === 10008) { // Unknown Message
          console.log(`Cannot send message to ${member.user.tag}: Unknown Message.`);
        } else if (err.code === 20026) { // Bot flagged by anti-spam
          console.error(`Bot has been flagged by Discord's anti-spam system. Please follow the instructions to appeal: https://dis.gd/app-quarantine`);
          process.exit(); // إيقاف البوت لأنه في الحجر الصحي
        } else {
          console.error(`Could not send message to ${member.user.tag}:`, err);
        }
        failedCount++;
      }
      // تحديث الإحصائيات
      updateStats(sentCount, failedCount);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return { sentCount, failedCount };
}

// دالة لإنشاء Embed بالإحصائيات
async function createStatsEmbed(totalMembers, sentCount, failedCount, remaining, botCount) {
  const embed = new EmbedBuilder()
    .setTitle(`📊 إحصائيات البث`)
    .setColor("#a4c8fd")
    .setDescription(
      `👥 إجمالي الأعضاء: ${totalMembers}\n\n` +
      `📨 الرسائل المرسلة: ${sentCount}\n\n` +
      `❌ الرسائل الفاشلة: ${failedCount}\n\n` +
      `⏳ المتبقي: ${remaining}\n\n` +
      `🤖 البوتات: ${botCount}`
    )
    .setTimestamp();

  return embed;
}

// دالة لإرسال الإحصائيات النهائية
async function sendFinalStats(statsMessage, totalMembers, sentCount, failedCount, botCount) {
  const remaining = totalMembers - sentCount - failedCount;
  const finalEmbed = await createStatsEmbed(totalMembers, sentCount, failedCount, remaining, botCount);
  
  try {
    await statsMessage.edit({ embeds: [finalEmbed], content: "**Broadcast Finished**" });
  } catch (error) {
    if (error.code === 10008) { // Unknown Message
      console.warn("Stats message was deleted. Sending a new message with final stats.");
      await statsMessage.channel.send({ embeds: [finalEmbed], content: "**Broadcast Finished**" });
    } else {
      console.error("Error editing final stats message:", error);
    }
  }
}

// دعم البوت
client.on("messageCreate", msg => {
  if (msg.content === `${prefix}support`) {
    msg.reply("https://discord.gg/1million");
  }
});

// تسجيل الدخول
client.login(process.env.token);