import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';

let currentUserId: string | null = null;

const client = new ClientQuest(process.env.TOKEN!);

/*
client.on(
	GatewayDispatchEvents.MessageCreate,
	async ({ data: message, api }) => {
		console.log('Message received:', message.content);
		if (message.content === 'ping' && message.author.id === currentUserId) {
			await api.channels.createMessage(message.channel_id, {
				content: 'pong',
			});
		}
	},
);
*/

client.once(GatewayDispatchEvents.Ready, async ({ data, api }) => {
	currentUserId = data.user.id;
	console.log(`Logged in as @${data.user.username}`);
	await client.fetchQuests(true);
	const questsValid = client.questManager!.filterQuestsValid();
	console.log(`Found ${questsValid.length} valid quests to do.`);
	await Promise.allSettled(
		questsValid.map((quest) => client.questManager!.doingQuest(quest)),
	);
	// Disconnect
	await client.destroy();
});

client.rest.on('rateLimited', (info: any) => {
	console.warn(
		`\n[RateLimit]\n` +
			`  -> Route: ${info.method} ${info.route}\n` +
			`  -> Scope: ${info.scope}${info.global ? ' (Global)' : ''}\n` +
			`  -> Limit: ${info.limit} requests\n` +
			`  -> Retry after: ${info.retryAfter}ms (${(info.retryAfter / 1000).toFixed(2)}s)\n`
	);
});

client.connect();
