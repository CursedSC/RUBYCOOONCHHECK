const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const fetch = require('node-fetch');

const DANBOORU_API = 'https://danbooru.donmai.us/posts.json';
const MAX_TAGS = 25;
const INTERACTION_TIMEOUT = 2500; // 2.5 секунды для безопасности

module.exports = {
  data: new SlashCommandBuilder()
    .setName('арт')
    .setDescription('Ищет арты на Danbooru по тегам')
    .addStringOption(option =>
      option.setName('теги')
        .setDescription('Теги для поиска (через пробел)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('nsfw')
        .setDescription('Искать NSFW арты')
        .setRequired(false)),

  async execute(interaction) {
    // Немедленно отложить ответ для предотвращения таймаута
    await interaction.deferReply();

    try {
      // Проверка NSFW
      const isDM = interaction.channel?.type === 'DM';
      const isNSFW = interaction.channel?.nsfw || isDM;
      const wantNSFW = interaction.options.getBoolean('nsfw') || false;
      
      if (wantNSFW && !isNSFW) {
        return await interaction.editReply({ 
          content: 'NSFW арты доступны только в 18+ каналах или в ЛС!',
          flags: MessageFlags.Ephemeral 
        });
      }

      // Получение тегов
      let tags = interaction.options.getString('теги') || '';
      if (wantNSFW) tags += ' rating:e';
      else tags += ' rating:safe';
      tags = `order:random ${tags}`.trim();

      // Функция безопасного запроса к API
      const fetchArt = async (pageNum = 1) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), INTERACTION_TIMEOUT);
        
        try {
          const params = new URLSearchParams({
            tags,
            limit: 1,
            page: pageNum
          });
          
          const res = await fetch(`${DANBOORU_API}?${params}`, {
            signal: controller.signal,
            timeout: INTERACTION_TIMEOUT
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          return data[0];
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      // Генерация embed
      const makeEmbed = (post) => {
        const tagsArr = post.tag_string.split(' ').slice(0, MAX_TAGS);
        const tagsStr = tagsArr.join(', ');
        const imageUrl = post.large_file_url || post.file_url;
        
        const embed = new EmbedBuilder()
          .setTitle(`Арт #${post.id}`)
          .setURL(`https://danbooru.donmai.us/posts/${post.id}`)
          .setDescription(`**Теги:** ${tagsStr}${post.tag_string.split(' ').length > MAX_TAGS ? ' ...' : ''}`)
          .setImage(imageUrl)
          .setFooter({ 
            text: `Рейтинг: ${post.rating.toUpperCase()} | Автор: ${post.uploader_name || 'неизвестен'}` 
          });
          
        return embed;
      };

      // Кнопки перелистывания
      const getRow = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev_art')
          .setLabel('← Назад')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('next_art')
          .setLabel('Вперед →')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('random_art')
          .setLabel('🎲 Случайный')
          .setStyle(ButtonStyle.Success)
      );

      // Получение первого поста
      const post = await fetchArt(1);
      if (!post) {
        return await interaction.editReply({ 
          content: 'Арт не найден по этим тегам.' 
        });
      }

      // NSFW спойлер для изображения
      let content = '';
      if (wantNSFW && post.rating === 'e') {
        content = '||Изображение содержит NSFW контент||';
      }

      // Отправка сообщения
      await interaction.editReply({
        content: content || undefined,
        embeds: [makeEmbed(post)],
        components: [getRow()]
      });

      // Обработка кнопок
      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ 
        filter, 
        time: 120000 
      });

      let currentPage = 1;

      collector.on('collect', async i => {
        await i.deferUpdate();
        
        try {
          if (i.customId === 'prev_art') currentPage = Math.max(1, currentPage - 1);
          if (i.customId === 'next_art') currentPage += 1;
          if (i.customId === 'random_art') currentPage = Math.floor(Math.random() * 100) + 1;

          const newPost = await fetchArt(currentPage);
          if (!newPost) {
            return await i.followUp({ 
              content: 'Больше артов не найдено.',
              flags: MessageFlags.Ephemeral 
            });
          }

          let newContent = '';
          if (wantNSFW && newPost.rating === 'e') {
            newContent = '||Изображение содержит NSFW контент||';
          }

          await i.editReply({
            content: newContent || undefined,
            embeds: [makeEmbed(newPost)],
            components: [getRow()]
          });
        } catch (error) {
          console.error('Ошибка при обновлении:', error);
          await i.followUp({ 
            content: 'Ошибка при загрузке нового арта.',
            flags: MessageFlags.Ephemeral 
          });
        }
      });

      collector.on('end', async () => {
        try {
          await interaction.editReply({ components: [] });
        } catch (error) {
          // Игнорируем ошибки при удалении кнопок
          console.log('Не удалось удалить кнопки (сообщение могло быть удалено)');
        }
      });

    } catch (error) {
      console.error('Ошибка выполнения команды /арт:', error);
      
      try {
        await interaction.editReply({ 
          content: 'Произошла ошибка при поиске арта. Попробуйте позже.' 
        });
      } catch (replyError) {
        console.error('Не удалось отправить сообщение об ошибке:', replyError);
      }
    }
  }
};
