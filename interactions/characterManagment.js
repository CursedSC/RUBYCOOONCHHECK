// interactions/characterManagementHandler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('../database');

const db = new Database();

const LOG_CHANNEL_ID = '1381454654440865934';

async function sendLogToChannel(client, logData) {
    try {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) {
            console.error('❌ Канал логирования не найден!');
            return;
        }

        const logEmbed = new EmbedBuilder()
            .setTitle(logData.title)
            .setDescription(logData.description)
            .setColor(logData.color)
            .addFields(logData.fields)
            .setFooter({ text: `Модератор: ${logData.moderatorId}` })
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
        console.log('✅ Лог отправлен в канал');
    } catch (error) {
        console.error('❌ Ошибка отправки лога:', error);
    }
}

module.exports = {
    name: 'interactionCreate',
    
    canHandle(interaction) {
        return interaction.isStringSelectMenu() && 
               (interaction.customId.startsWith('delete_character_select_') ||
                interaction.customId.startsWith('transfer_character_select_')) ||
               interaction.isButton() && 
               (interaction.customId.startsWith('confirm_delete_') ||
                interaction.customId.startsWith('cancel_delete_') ||
                interaction.customId.startsWith('confirm_transfer_') ||
                interaction.customId.startsWith('cancel_transfer_'));
    },

    async execute(interaction) {
        if (!this.canHandle(interaction)) {
            return;
        }

        try {
            if (interaction.customId.startsWith('delete_character_select_')) {
                await this.handleDeleteCharacterSelect(interaction);
            }
            else if (interaction.customId.startsWith('transfer_character_select_')) {
                await this.handleTransferCharacterSelect(interaction);
            }
            else if (interaction.customId.startsWith('confirm_delete_')) {
                await this.handleConfirmDelete(interaction);
            }
            else if (interaction.customId.startsWith('cancel_delete_')) {
                await this.handleCancelDelete(interaction);
            }
            else if (interaction.customId.startsWith('confirm_transfer_')) {
                await this.handleConfirmTransfer(interaction);
            }
            else if (interaction.customId.startsWith('cancel_transfer_')) {
                await this.handleCancelTransfer(interaction);
            }

        } catch (error) {
            console.error('❌ Ошибка в characterManagementHandler:', error);
            await this.handleError(interaction, error);
        }
    },

    async handleDeleteCharacterSelect(interaction) {
        const parts = interaction.customId.split('_');
        const targetUserId = parts[3];
        const characterId = interaction.values[0];

        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const confirmButton = new ButtonBuilder()
                .setCustomId(`confirm_delete_${characterId}`)
                .setLabel('✅ Да, удалить')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId(`cancel_delete_${characterId}`)
                .setLabel('❌ Отмена')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            const totalStats = (character.strength || 0) + (character.agility || 0) + (character.reaction || 0) + 
                             (character.accuracy || 0) + (character.endurance || 0) + (character.durability || 0) + (character.magic || 0);

            const confirmEmbed = new EmbedBuilder()
                .setTitle('⚠️ Подтверждение удаления')
                .setDescription(`Вы действительно хотите удалить персонажа **${character.name}**?`)
                .setColor(0xff0000)
                .setThumbnail(character.avatar_url)
                .addFields(
                    { name: '👤 Имя', value: character.name, inline: true },
                    { name: '🦁 Раса', value: character.race || 'Не указано', inline: true },
                    { name: '🎂 Возраст', value: character.age?.toString() || 'Не указано', inline: true },
                    { name: '💪 Общая сила', value: totalStats.toLocaleString(), inline: true },
                    { name: '👤 Владелец', value: `<@${character.user_id}>`, inline: true },
                    { name: '📍 Слот', value: character.slot?.toString() || '1', inline: true }
                )
                .addFields({
                    name: '⚠️ ВНИМАНИЕ',
                    value: 'Это действие необратимо! Все данные персонажа будут потеряны навсегда.',
                    inline: false
                })
                .setTimestamp();

            await interaction.update({
                embeds: [confirmEmbed],
                components: [row]
            });

        } catch (error) {
            console.error('❌ Ошибка в handleDeleteCharacterSelect:', error);
            throw error;
        }
    },

    async handleTransferCharacterSelect(interaction) {
        const parts = interaction.customId.split('_');
        const fromUserId = parts[3];
        const toUserId = parts[4];
        const characterId = interaction.values[0];

        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const confirmButton = new ButtonBuilder()
                .setCustomId(`confirm_transfer_${characterId}_${fromUserId}_${toUserId}`)
                .setLabel('✅ Да, передать')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId(`cancel_transfer_${characterId}`)
                .setLabel('❌ Отмена')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            const totalStats = (character.strength || 0) + (character.agility || 0) + (character.reaction || 0) + 
                             (character.accuracy || 0) + (character.endurance || 0) + (character.durability || 0) + (character.magic || 0);

            const confirmEmbed = new EmbedBuilder()
                .setTitle('🔄 Подтверждение передачи')
                .setDescription(`Передать персонажа **${character.name}**?`)
                .setColor(0x3498db)
                .setThumbnail(character.avatar_url)
                .addFields(
                    { name: '👤 Имя персонажа', value: character.name, inline: true },
                    { name: '🦁 Раса', value: character.race || 'Не указано', inline: true },
                    { name: '💪 Общая сила', value: totalStats.toLocaleString(), inline: true },
                    { name: '📤 От кого', value: `<@${fromUserId}>`, inline: true },
                    { name: '📥 Кому', value: `<@${toUserId}>`, inline: true },
                    { name: '📍 Текущий слот', value: character.slot?.toString() || '1', inline: true }
                )
                .setTimestamp();

            await interaction.update({
                embeds: [confirmEmbed],
                components: [row]
            });

        } catch (error) {
            console.error('❌ Ошибка в handleTransferCharacterSelect:', error);
            throw error;
        }
    },

    async handleConfirmDelete(interaction) {
        const characterId = interaction.customId.split('_')[2];

        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.update({
                    content: '❌ Персонаж не найден!',
                    embeds: [],
                    components: []
                });
            }

            const result = await db.deleteCharacter(characterId);
            
            if (result === 0) {
                throw new Error('Не удалось удалить персонажа из базы данных');
            }

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Персонаж удален')
                .setDescription(`Персонаж **${character.name}** был успешно удален`)
                .setColor(0x00ff00)
                .addFields(
                    { name: '👤 Удаленный персонаж', value: character.name, inline: true },
                    { name: '👤 Владелец', value: `<@${character.user_id}>`, inline: true },
                    { name: '🗑️ Удалил', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();

            await interaction.update({
                embeds: [successEmbed],
                components: []
            });

            await sendLogToChannel(interaction.client, {
                title: '🗑️ Лог удаления персонажа',
                description: `Персонаж **${character.name}** был удален`,
                color: 0xff0000,
                fields: [
                    { name: '👤 Персонаж', value: character.name, inline: true },
                    { name: '👤 Владелец', value: `<@${character.user_id}>`, inline: true },
                    { name: '🗑️ Удалил', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📍 Канал', value: `<#${interaction.channelId}>`, inline: false }
                ],
                moderatorId: interaction.user.id
            });

        } catch (error) {
            console.error('❌ Ошибка удаления персонажа:', error);
            await interaction.update({
                content: 'Произошла ошибка при удалении персонажа!',
                embeds: [],
                components: []
            });
        }
    },

    async handleConfirmTransfer(interaction) {
        const parts = interaction.customId.split('_');
        const characterId = parts[2];
        const fromUserId = parts[3];
        const toUserId = parts[4];

        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.update({
                    content: '❌ Персонаж не найден!',
                    embeds: [],
                    components: []
                });
            }

            const nextSlot = await db.getNextAvailableSlot(toUserId);
            const maxSlots = await db.getUserSlots(toUserId);

            if (nextSlot > maxSlots) {
                return await interaction.update({
                    content: `❌ У получателя заняты все слоты! (${maxSlots}/${maxSlots})`,
                    embeds: [],
                    components: []
                });
            }

            await db.db.run(
                'UPDATE characters SET user_id = ?, slot = ? WHERE id = ?',
                [toUserId, nextSlot, characterId]
            );

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Персонаж передан')
                .setDescription(`Персонаж **${character.name}** успешно передан`)
                .setColor(0x00ff00)
                .setThumbnail(character.avatar_url)
                .addFields(
                    { name: '👤 Персонаж', value: character.name, inline: true },
                    { name: '📤 От кого', value: `<@${fromUserId}>`, inline: true },
                    { name: '📥 Кому', value: `<@${toUserId}>`, inline: true },
                    { name: '📍 Новый слот', value: nextSlot.toString(), inline: true },
                    { name: '🔄 Передал', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();

            await interaction.update({
                embeds: [successEmbed],
                components: []
            });

            await sendLogToChannel(interaction.client, {
                title: '🔄 Лог передачи персонажа',
                description: `Персонаж **${character.name}** был передан`,
                color: 0x3498db,
                fields: [
                    { name: '👤 Персонаж', value: character.name, inline: true },
                    { name: '📤 От кого', value: `<@${fromUserId}>`, inline: true },
                    { name: '📥 Кому', value: `<@${toUserId}>`, inline: true },
                    { name: '📍 Новый слот', value: nextSlot.toString(), inline: true },
                    { name: '🔄 Передал', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📍 Канал', value: `<#${interaction.channelId}>`, inline: false }
                ],
                moderatorId: interaction.user.id
            });

        } catch (error) {
            console.error('❌ Ошибка передачи персонажа:', error);
            await interaction.update({
                content: 'Произошла ошибка при передаче персонажа!',
                embeds: [],
                components: []
            });
        }
    },

    async handleCancelDelete(interaction) {
        const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Удаление отменено')
            .setDescription('Операция удаления персонажа была отменена')
            .setColor(0x95a5a6)
            .setTimestamp();

        await interaction.update({
            embeds: [cancelEmbed],
            components: []
        });
    },

    async handleCancelTransfer(interaction) {
        const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Передача отменена')
            .setDescription('Операция передачи персонажа была отменена')
            .setColor(0x95a5a6)
            .setTimestamp();

        await interaction.update({
            embeds: [cancelEmbed],
            components: []
        });
    },

    async handleError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Ошибка')
            .setDescription(`Произошла ошибка: ${error.message}`)
            .setColor(0xff0000)
            .setTimestamp();

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [errorEmbed],
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.followUp({
                    embeds: [errorEmbed],
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (replyError) {
            console.error('❌ Не удалось отправить сообщение об ошибке:', replyError);
        }
    }
};
