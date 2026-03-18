import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';
import { Utils } from './src/utils';

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

client.connect();
