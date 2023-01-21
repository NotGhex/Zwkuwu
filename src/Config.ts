import { ColorResolvable } from 'discord.js';
import { SnipeConfig } from './fun/snipe.js';
import { ConfessionsConfig } from './fun/confessions.js';
import { TiktokConfig } from './fun/tiktok.js';
import { AntiProxyConfig } from './moderation/antiProxy.js';
import { SrvStatusConfig } from './dev/srvStatus.js';
import { WelcomerConfig } from './utils/welcomer.js';
import { RoleMenuConfig } from './utils/roleMenu.js';
import { MinecraftSkinsConfig } from './utils/minecraftSkins.js';
import { AnticrashConfig } from './anticrash.js';

export interface BaseConfig {
    embedColor: ColorResolvable;
    errorEmbedColor: ColorResolvable;
    expressPort: number|null;
    snipes: SnipeConfig;
    confessions: ConfessionsConfig;
    tiktok: TiktokConfig;
    antiProxy: AntiProxyConfig;
    srvStatus: SrvStatusConfig;
    welcomer: WelcomerConfig;
    roleMenu: RoleMenuConfig;
    minecraftSkins: MinecraftSkinsConfig;
    anticrash: AnticrashConfig;
};

export const snowflake = '0000000000000000000';

export const defaultconfig: BaseConfig = {
    embedColor: 'Blue',
    errorEmbedColor: 'DarkButNotBlack',
    expressPort: null,
    snipes: {
        ignoredUsers: [],
        ignoredWords: []
    },
    confessions: {
        confessionsChannelId: snowflake,
        titleAccessRequiredPermissions: 'Administrator',
        modalPlaceholders: [
            'I am so pretty',
            'I farted',
            'I hate you',
            'WTF'
        ]
    },
    tiktok: {
        cookies: ''
    },
    antiProxy: {
        token: null,
        consoleBotIds: [snowflake],
        consoleChannelIds: [snowflake],
        punishmentCommands: ['ban-ip {player_name} VPN/Proxy is detected in your connection.'],
    },
    srvStatus: {
        pingTimeout: 10000,
        updateIntervalMs: 10000,
        embedColor: {
            online: 'Green',
            offline: 'Red',
            pending: 'DarkButNotBlack'
        },
        servers: [
            {
                host: 'ourworld6.aternos.me',
                port: 40655,
            }
        ]
    },
    welcomer: {
        guilds: [
            {
                guildId: snowflake,
                welcomeChannelIds: [snowflake],
                leaveChannelIds: [snowflake],
            }
        ],
        ignoreBots: true
    },
    roleMenu: {
        roleMenus: [
            {
                label: 'Untitled role menu',
                messageId: snowflake,
                channelId: snowflake,
                messageData: 'Select roles',
                menu: {
                    placeholder: 'Select roles',
                    multiple: true
                },
                roles: [
                    {
                        roleId: snowflake,
                        label: 'Untitled role'
                    }
                ]
            }
        ]
    },
    minecraftSkins: {
        fallbackSkins: 'https://crafthead.net/skin/{playername}',
        gameChatsChannelIds: [snowflake],
        gameConsoleChannelIds: [snowflake],
        messageUserApplicationIds: [snowflake],
        routes: {
            cloudHost: '127.0.0.1',
            head: '/skins/head',
            skin: '/skins/skin'
        }
    },
    anticrash: {
        errorReportsChannelIds: [snowflake],
        reportToUsers: [snowflake]
    }
};

export type Config = typeof defaultconfig & BaseConfig;