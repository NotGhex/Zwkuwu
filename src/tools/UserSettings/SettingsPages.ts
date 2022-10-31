import { ButtonPaginationBuilder, PageResolvable, PaginationControllerType } from '@falloutstudios/djs-pagination';
import { ActionRowBuilder, APIButtonComponentWithCustomId, ButtonBuilder, ButtonStyle, inlineCode, MessageActionRowComponentBuilder, SelectMenuBuilder, SelectMenuComponentOptionData } from 'discord.js';
import util from '../util';
import { UserSettings } from './UserSettings';

export class SettingsPages {
    readonly userSettings: UserSettings;

    constructor(userSettings: UserSettings) {
        this.userSettings = userSettings;
    }

    public allowSnipesSettings(): PageResolvable {
        const snipeCommand = this.userSettings.client.applicationCommands.get('snipe');

        return {
            embeds: [
                util.smallEmbed('Allow Snipes')
                    .setDescription(`Allows you to use ${snipeCommand?.id ? '</snipe:' + snipeCommand.id + '>' : inlineCode('/snipe')} and allows the bot to snipe your deleted messages.`)
            ],
            components: [
                this.toggleComponentBuilder({
                    customId: 'usersettings-allowsniping',
                    placeholder: `Enable/Disable message sniping`,
                    enabled: this.userSettings.allowSniping,
                    enableOption: `Enable message sniping & snipe command`,
                    disableOption: `Disable message sniping & snipe command`
                })
            ]
        };
    }

    public cleanDataOnLeave(): PageResolvable {
        return {
            embeds: [
                util.smallEmbed('Clean Data on Leave')
                    .setDescription(`Clears your snipes and will not save your user data when you leave the server. **Confessions and already sniped messages will not be remove**`)
            ],
            components: [
                this.toggleComponentBuilder({
                    customId: 'usersettings-cleandataonleave',
                    placeholder: `Enable/Disable saving member data on leave`,
                    enabled: this.userSettings.cleanDataOnLeave,
                    enableOption: `Don't save data on leave`,
                    disableOption: `Keep data in server on leave`
                })
            ]
        };
    }

    public toggleComponentBuilder(options: {
        customId: string;
        placeholder?: string;
        enabled?: boolean;
        enableOption: Omit<SelectMenuComponentOptionData, 'value' | 'default'>|string;
        disableOption: Omit<SelectMenuComponentOptionData, 'value' | 'default'>|string;
    }): ActionRowBuilder<MessageActionRowComponentBuilder> {
        return new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .setComponents(
                new SelectMenuBuilder({ placeholder: options.placeholder })
                    .setCustomId(options.customId)
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setOptions(
                        {
                            ...(typeof options.enableOption === 'string' ? { label: options.enableOption } : options.enableOption),
                            value: 'enable',
                            default: options.enabled === true
                        },
                        {
                            ...(typeof options.disableOption === 'string' ? { label: options.disableOption } : options.disableOption),
                            value: 'disable',
                            default: options.enabled === false
                        }
                    )
            );
    }

    public createPagination(): ButtonPaginationBuilder {
        const pagination = new ButtonPaginationBuilder({
            authorId: this.userSettings.id,
            onDisableAction: 'DeleteComponents',
            pages: [
                () => this.allowSnipesSettings(),
                () => this.cleanDataOnLeave()
            ],
            buttons: {
                buttons: [
                    {
                        button: new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Secondary),
                        customId: 'prev',
                        type: PaginationControllerType.PreviousPage
                    },
                    {
                        button: new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Secondary),
                        customId: 'next',
                        type: PaginationControllerType.NextPage
                    }
                ],
            }
        });

        pagination.setCollectorOptions({
            filter: component => component.customId.startsWith('usersettings-') || pagination.buttons.some(b => (b.builder.data as APIButtonComponentWithCustomId).custom_id === component.customId)
        });

        pagination.on('collectorCollect', async component => {
            if (!component.isSelectMenu() || component.user.id !== this.userSettings.id || !component.customId.startsWith('usersettings-')) return;

            const type = component.customId.split('-')[1];
            const enabled = component.values.shift() === 'enabled';

            await component.deferReply({ ephemeral: true });

            switch (type) {
                case 'allowsniping':
                    await this.userSettings.update({
                        allowSniping: enabled
                    });

                    await component.editReply({ embeds: [util.smallEmbed(`${enabled ? 'Enabled' : 'Disabled'} message sniping & snipe command`)] });
                    break;
                case 'cleandataonleave':
                    await this.userSettings.update({
                        cleanDataOnLeave: enabled
                    });

                    await component.editReply({ embeds: [util.smallEmbed(`${enabled ? 'Clearing' : 'Saving'} member data on server leave`)] });
                    break;
            }

            pagination.collector?.resetTimer();
        });

        return pagination;
    }
}