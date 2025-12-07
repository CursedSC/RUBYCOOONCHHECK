const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Database = require('../database');
const { generateKindnessCard } = require('../utils/kindnessCardGenerator');
const db = new Database();

const KINDNESS_CHANNEL_ID = '1438269919857872896';
const ALLOWED_ROLE_ID = '1382000040977109003';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('доброта')
        .setDescription('Отправить добрителку (открытку) пользователю в честь дня доброты')
        .setDMPermission(false)
        .addUserOption(option =>
            option
                .setName('кому')
                .setDescription('Пользователь, которому отправить добрителку')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('поздравление')
                .setDescription('Текст поздравления')
                .setRequired(true)
                .setMaxLength(300)
        )
        .addStringOption(option =>
            option
                .setName('от-кого')
                .setDescription('Ваше имя/прозвище (оставьте пустым для анонимной отправки)')
                .setRequired(false)
                .setMaxLength(50)
        ),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return await interaction.reply({
                content: '❌ У вас нет прав для использования этой команды.',
                ephemeral: true
            });
        }
        
        try {
            await interaction.deferReply({ ephemeral: true });

            const recipient = interaction.options.getUser('кому');
            const message = interaction.options.getString('поздравление');
            const senderNickname = interaction.options.getString('от-кого');
            const sender = interaction.user;

            if (recipient.id === sender.id) {
                return await interaction.editReply({
                    content: '❌ Вы не можете отправить добрителку самому себе!'
                });
            }

            if (recipient.bot) {
                return await interaction.editReply({
                    content: '❌ Нельзя отправить добрителку боту!'
                });
            }

            const canSend = await db.canSendKindnessCard(sender.id);
            if (!canSend) {
                const sentCount = await db.getUserKindnessCardsSent(sender.id);
                return await interaction.editReply({
                    content: `❌ Вы уже использовали все свои добрителки! (Отправлено: ${sentCount}/3)`
                });
            }

            try {
                await db.sendKindnessCard(sender.id, recipient.id, message, senderNickname);
            } catch (error) {
                if (error.message === 'DUPLICATE') {
                    return await interaction.editReply({
                        content: `❌ Вы уже отправили добрителку пользователю <@${recipient.id}>!`
                    });
                }
                throw error;
            }

            const sentCount = await db.getUserKindnessCardsSent(sender.id);
            const remainingCards = 3 - sentCount;

            // Генерируем визуальную карточку
            const senderDisplayName = senderNickname || 'Аноним';
            const recipientDisplayName = recipient.username;
            
            const cardBuffer = await generateKindnessCard(
                senderDisplayName,
                recipientDisplayName,
                message
            );

            const attachment = new AttachmentBuilder(cardBuffer, { 
                name: 'kindness-card.png' 
            });

            // Отправляем в канал
            const kindnessChannel = interaction.guild.channels.cache.get(KINDNESS_CHANNEL_ID);
            if (kindnessChannel) {
                await kindnessChannel.send({
                    content: `💌 **Новая открытка для** <@${recipient.id}>!`,
                    files: [attachment]
                });
            }

            // Отправляем в ЛС получателю
            try {
                const dmAttachment = new AttachmentBuilder(cardBuffer, { 
                    name: 'kindness-card.png' 
                });
                await recipient.send({
                    content: '💌 **Вам пришла открытка!**',
                    files: [dmAttachment]
                });
            } catch (error) {
                console.log(`Не удалось отправить ЛС пользователю ${recipient.tag}`);
            }

            // Ответ отправителю
            await interaction.editReply({
                content: `✅ Открытка успешно отправлена пользователю <@${recipient.id}>!\n📊 Использовано: ${sentCount}/3 | Осталось: ${remainingCards}`
            });

        } catch (error) {
            console.error('Ошибка в команде доброта:', error);
            await interaction.editReply({
                content: '❌ Произошла ошибка при отправке добрителки.'
            });
        }
    }
};
