import { AttachmentBuilder, Collection, GuildTextBasedChannel } from 'discord.js';
import { Logger } from 'fallout-utility';
import { cwd, RecipleClient, SlashCommandBuilder } from 'reciple';
import BaseModule from '../BaseModule';
import { RawSkinData, SkinData } from './PlayerSkin/SkinData';
import express, { Express, Response } from 'express';
import util from './util';
import yml from 'yaml';
import createConfig from '../_createConfig';
import path from 'path';
import axios from 'axios';
import { mkdirSync } from 'fs';
import crypto from 'crypto';

export interface PlayerSkinModuleConfig {
    port: string;
    fallbackSkin: string;
    gameChatsChannel: string;
    messageApplicationId: string;
    routes: {
        head: string;
        skin: string;
    }
}

export class PlayerSkinModule extends BaseModule {
    public config: PlayerSkinModuleConfig = PlayerSkinModule.getConfig();
    public cache: Collection<string, SkinData> = new Collection();
    public gameChatsChannel!: GuildTextBasedChannel;
    public fallbackSkin?: Buffer;
    public logger!: Logger;
    public server: Express = express();

    public async onStart(client: RecipleClient<boolean>): Promise<boolean> {
        this.logger = client.logger.cloneLogger({ loggerName: 'PlayerSkinModule' });

        await this.readFallbackSkin();

        this.server.listen(this.config.port || process.env.PORT, () => this.logger.warn('Server is listening on port ' + (this.config.port || process.env.PORT)));
        this.server.get(path.join('/', this.config.routes.head, ':player/:scale?') as `${string}:player/:scale?`, async (req, res) => {
            const player: SkinData|undefined = await this.resolveSkinData(req.params.player);
            const scale = !isNaN(Number(req.params.scale)) ? Number(req.params.scale) : 1;
            if (scale > 300) return res.status(403).send({ error: 'Maximum scale exceeded' });
            if (!player) return this.sendSkin(res, { scale });

            return player.hasSkin() ? this.sendSkin(res, undefined, { buffer: await player.getHead(scale), file: player.file }) : this.sendSkin(res, { scale });
        });

        this.server.get(path.join('/', this.config.routes.skin, ':player') as `${string}:player`, async (req, res) => {
            const player: SkinData|undefined = await this.resolveSkinData(req.params.player);

            if (!player) return this.sendSkin(res);

            return this.sendSkin(res, undefined, player.hasSkin() ? { buffer: await player.getSkinBuffer(), file: player.file } : undefined);
        });

        return true;
    }

    public async onLoad(client: RecipleClient<boolean>): Promise<void> {
        const gameChatsChannel = client.channels.cache.get(this.config.gameChatsChannel) ?? await client.channels.fetch(this.config.gameChatsChannel).catch(() => null);
        if (!gameChatsChannel || gameChatsChannel.isDMBased() || !gameChatsChannel.isTextBased()) throw new Error('Invalid game chats channel');

        this.gameChatsChannel = gameChatsChannel;

        this.commands = [
            new SlashCommandBuilder()
                .setName('skin')
                .setDescription('Modify minecraft player skin settings')
                .addSubcommand(remove => remove
                    .setName('remove')
                    .setDescription('Remove player skkin')
                    .addStringOption(player => player
                        .setName('player')
                        .setDescription('Player name')
                        .setRequired(true)
                    )
                )
                .addSubcommand(set => set
                    .setName('set')
                    .setDescription('Set player skin')
                    .addStringOption(player => player
                        .setName('player')
                        .setDescription('Player name')
                        .setRequired(true)
                    )
                    .addAttachmentOption(skin => skin
                        .setName('skin')
                        .setDescription('Skin file')
                        .setRequired(true)    
                    )
                )
                .addSubcommandGroup(view => view
                    .setName('view')
                    .setDescription('View skin')
                    .addSubcommand(avatar => avatar
                        .setName('avatar')
                        .setDescription('View skin avatar')
                        .addStringOption(player => player
                            .setName('player')
                            .setDescription('Player name')
                            .setRequired(true)
                        )
                    )
                    .addSubcommand(skin => skin
                        .setName('skin')
                        .setDescription('View skin image')
                        .addStringOption(player => player
                            .setName('player')
                            .setDescription('Player name')
                            .setRequired(true)
                        )
                    )
                )
                .setExecute(async data => {
                    const interaction = data.interaction;
                    const command = interaction.options.getSubcommand(true);
                    const playerName = interaction.options.getString('player', true);
                    
                    await interaction.deferReply();
                    let player = await this.resolveSkinData(playerName);

                    if (command !== 'set' && !player) {
                        await interaction.editReply({ embeds: [util.errorEmbed('No player data found')] });
                        return;
                    }

                    switch (command) {
                        case 'avatar':
                            const avatar = new AttachmentBuilder(await player!.getHead(5), { name: player?.filePath || undefined });

                            await interaction.editReply({
                                embeds: [
                                    util.smallEmbed(`${player?.player} ┃ Avatar`)
                                    .setImage('attachment://'+ player!.file)
                                ],
                                files: [avatar]
                            });

                            return;
                        case 'skin':
                            const skin = new AttachmentBuilder(await player!.getSkinBuffer(), { name: player?.filePath || undefined });

                            await interaction.editReply({
                                embeds: [
                                    util.smallEmbed(`${player?.player} ┃ Skin`)
                                    .setImage('attachment://'+ player!.file)
                                ],
                                files: [skin]
                            });

                            return;
                    }

                    const key = crypto.randomUUID().split('-').shift();
                    await interaction.editReply({
                        embeds: [
                            util.smallEmbed(`Send \`${key}\` in minecraft to continue`, true)
                        ]
                    });

                    const confirmed = await this.gameChatsChannel.awaitMessages({
                        max: 1,
                        filter: message => (message.applicationId === this.config.messageApplicationId && message.author.username.toLowerCase() === playerName.toLowerCase() || message.author.id === this.config.messageApplicationId) && message.content === key,
                        time: 20000
                    });

                    if (!confirmed.size) {
                        await interaction.editReply({ embeds: [util.errorEmbed('Cannot verify your request')] });
                        return;
                    }

                    await interaction.editReply({ embeds: [util.smallEmbed('Loading...')] });
                    const keyMessage = confirmed.first()!;

                    await keyMessage.reply('Key Verified');

                    switch (command) {
                        case 'remove':
                            await player?.delete();
                            await interaction.editReply({ embeds: [util.errorEmbed('Deleted player data')] });
                            break;
                        case 'set':
                            const attachment = interaction.options.getAttachment('skin', true);

                            if (!player) {
                                player = await this.createSkinData({
                                    player: playerName,
                                    file: null,
                                    createdAt: new Date(),
                                    lastUpdatedAt: new Date()
                                });
                            }

                            if (!player) {
                                await interaction.editReply({ embeds: [util.errorEmbed('No player data found')] });
                                break;
                            }

                            if ((attachment.height !== 64 && attachment.height !== 32) || attachment.width !== 64) {
                                await interaction.editReply({ embeds: [util.errorEmbed('Invalid Minecraft skin size')] });
                                break;
                            }

                            const err = await player.setSkin(attachment).catch(() => true);
                            await interaction.editReply({ embeds: [err ? util.errorEmbed('An error occured') : util.smallEmbed('Skin uploaded')] });
                            break;
                    }
                })
        ];
    }

    public async sendSkin(res: Response, head?: { scale: number; }, skin?: { buffer: Buffer; file: string; }): Promise<void> {
        if (!skin) {
            if (this.fallbackSkin) {
                res.contentType('image/png');
                res.set('Content-Disposition', `inline; filename="steve.png"`);
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.send(head ? await SkinData.getHead(this.fallbackSkin, head.scale) : this.fallbackSkin);
                return;
            }

            res.status(404).send({ error: 'No skin data found' });
            return;
        }

        res.contentType('image/png');
        res.set('Content-Disposition', `inline; filename="${skin.file}.png"`);
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(head ? await SkinData.getHead(skin.buffer, head.scale) : skin.buffer);
    }

    public async resolveSkinData(player: string): Promise<SkinData|undefined> {
        return this.cache.get(player) ?? this.fetchSkinData(player);
    }

    public async fetchSkinData(filter: string|Partial<RawSkinData>, cache: boolean = true): Promise<SkinData|undefined> {
        const data = await util.prisma.playerSkinData.findFirst({
            where: typeof filter === 'string'
                ? { player: filter }
                : filter
        });

        if (!data) return undefined;

        const skinData = new SkinData(this, data);
        if (cache) this.cache.set(skinData.player, skinData);

        return skinData;
    }

    public async createSkinData(data: RawSkinData): Promise<SkinData> {
        return new SkinData(this, await util.prisma.playerSkinData.create({ data }));
    }

    public async readFallbackSkin(useCache: boolean = true): Promise<Buffer|null> {
        if (this.fallbackSkin && useCache) return this.fallbackSkin;

        const fileHttp = await axios({ url: this.config.fallbackSkin, method: 'GET', responseType: 'arraybuffer' }).catch(() => null);
        if (!fileHttp) return null;

        const buffer = Buffer.from(fileHttp.data);
        this.fallbackSkin = buffer;

        return this.fallbackSkin;
    }

    public static getConfig(): PlayerSkinModuleConfig {
        mkdirSync(path.join(cwd, 'config/playerSkinData/skins'), { recursive: true });

        return yml.parse(createConfig(path.join(cwd, 'config/playerSkinData/config.yml'), <PlayerSkinModuleConfig>({
            port: '',
            fallbackSkin: 'https://s.namemc.com/i/59e3a240bd150317.png',
            gameChatsChannel: '000000000000000000',
            messageApplicationId: '000000000000000000',
            routes: {
                head: '/head',
                skin: '/skin'
            }
        })));
    }
}

export default new PlayerSkinModule();