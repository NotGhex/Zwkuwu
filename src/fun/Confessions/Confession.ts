import { Confessions, PrismaClient } from '@prisma/client';
import { GuildTextBasedChannel, If, Message, TextBasedChannel, User } from 'discord.js';
import { RecipleClient } from 'reciple';
import util from '../../tools/util';
import { ConfessionsModule } from '../confessions';

export interface RawConfession extends Confessions {}

export class Confession<Fetched extends boolean = boolean> implements RawConfession {
    private _author: User|null = null;
    private _channel: GuildTextBasedChannel|null = null;
    private _message: Message|null = null;
    private _deleted: boolean = false;
    private _authorId: string;
    private _channelId: string;
    private _messageId: string;
    private _title: string|null;
    private _content: string;
    private _createdAt: Date;
    private _id: string;

    public confessionManager: ConfessionsModule;
    public client: RecipleClient<true>;
    public prisma: PrismaClient;

    get author(): If<Fetched, User> { return this._author as If<Fetched, User>; }
    get channel(): If<Fetched, GuildTextBasedChannel> { return this._channel as If<Fetched, GuildTextBasedChannel>; }
    get message(): If<Fetched, Message> { return this._message as If<Fetched, Message>; }
    get deleted() { return this._deleted; }
    get authorId() { return this._authorId; }
    get channelId() { return this._channelId; }
    get messageId() { return this._messageId; }
    get title() { return this._title; }
    get content() { return this._content; }
    get createdAt() { return this._createdAt; }
    get id() { return this._id; }

    constructor(confessionManager: ConfessionsModule, rawConfession: RawConfession) {
        this.confessionManager = confessionManager;
        this.client = util.client;
        this.prisma = util.prisma;

        this._authorId = rawConfession.authorId;
        this._channelId = rawConfession.channelId;
        this._messageId = rawConfession.messageId;
        this._title = rawConfession.title;
        this._content = rawConfession.content;
        this._createdAt = rawConfession.createdAt;
        this._id = rawConfession.id;
    }

    public async fetch(): Promise<Confession<true>> {
        const data = await this.prisma.confessions.findFirst({
            where: {
                id: this.id
            }
        });

        if (!data) {
            await this.delete()
            throw new Error(`No confession data from database`);
        }

        this._authorId = data.authorId;
        this._channelId = data.channelId;
        this._messageId = data.messageId;
        this._title = data.title;
        this._content = data.content;
        this._createdAt = data.createdAt;

        const author = await this.client.users.fetch(this.authorId).catch(() => undefined);
        const channel = await this.client.channels.fetch(this.channelId).then(channel => channel && !channel.isDMBased() && channel.isTextBased() ? channel : null).catch(() => undefined);

        if (author === undefined) throw new Error(`Cannot fetch confession message author`);
        if (channel === undefined) throw new Error(`Cannot fetch confession message channel`);

        this._author = author;
        this._channel = channel;

        const message = await this.channel?.messages.fetch(this.messageId).catch(() => undefined);

        if (message === undefined) throw new Error(`Cannot fetch confession message`);

        this._message = message; 

        if (!this.isFetched()) throw new Error('Cannot fetch confession');
        return this;
    }

    public isFetched(): this is Confession<true> {
        return this._author !== null && this._channel !== null && this._message !== null;
    }

    public async delete(): Promise<void> {
        await this.prisma.confessions.delete({
            where: {
                id: this.id
            }
        });

        this._deleted = true;
        this.confessionManager.cache.sweep(c => c.deleted);
    }
}