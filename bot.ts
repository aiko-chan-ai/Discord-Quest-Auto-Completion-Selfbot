import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';
import { Utils } from './src/utils';
import { loadEnvFile } from 'node:process';

try {
	loadEnvFile();
} catch {}

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

// Main entry point logic fetches quests, filters them, and starts execution
client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	currentUserId = data.user.id;
	// console.log(`Logged in as @${data.user.username}`);
	console.log('Logged in!');

	await client.fetchQuests(false);
	const questsValid = client.questManager!.filterQuestsValidToDo();
	console.log(`Found ${questsValid.length} valid quests to do.`);
	await Promise.allSettled(
		questsValid.map((quest) => client.questManager!.doingQuest(quest)),
	);

	// ! Redeem rewards for completed quests
	// Todo: Cache quests
	/*
	await client.fetchQuests(false);
	const questsToRedeem = client.questManager!.filterQuestsValidToRedeem();
	console.log(`Found ${questsToRedeem.length} quests to redeem rewards for.`);
	for (const quest of questsToRedeem) {
		await client.questManager!.redeemQuest(quest);
	}
	*/
	// Disconnect
	console.log('All quests processed. Disconnecting...');
	await client.destroy();
});

process.on('unhandledRejection', (reason: unknown) => {
	console.error('[Error:] Unhandled Rejection', reason);
});

process.on('uncaughtException', (error: Error) => {
	console.error('Uncaught Exception:', error.message);
});

client.connect();
