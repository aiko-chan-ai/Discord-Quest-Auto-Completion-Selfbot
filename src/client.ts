import { Client, APIGatewayBotInfo } from '@discordjs/core';
import { RequestInit } from 'undici';
import { REST, DefaultRestOptions, ResponseLike } from '@discordjs/rest';
import { WebSocketManager, WebSocketShard } from '@discordjs/ws';
import { GatewaySendPayload, GatewayOpcodes } from 'discord-api-types/v10';
import { QuestManager } from './questManager';
import { AllQuestsResponse } from './interface';
import { Constants } from './constants';

async function makeRequest(
	url: string,
	init: RequestInit,
): Promise<ResponseLike> {
	// console.log(`Making request to ${url} with method ${init.method}...`);
	if (init.headers) {
		const myHeaders = new Headers(init.headers as any);
		const isAndroidRequest = myHeaders.get('AndroidRequest') === 'true';
		myHeaders.delete('AndroidRequest');
		myHeaders.set(
			'Authorization',
			myHeaders.get('Authorization')!.replace('Bot ', ''),
		);
		myHeaders.append('accept-language', 'vi');
		myHeaders.append('x-debug-options', 'bugReporterEnabled');
		myHeaders.append('x-discord-locale', 'en-US');
		myHeaders.append('x-discord-timezone', 'Asia/Saigon');
		if (isAndroidRequest) {
			myHeaders.set('User-Agent', Constants.ANDROID_USER_AGENT);
		} else {
			myHeaders.set('User-Agent', Constants.USER_AGENT);
			myHeaders.append('origin', 'https://discord.com');
			myHeaders.append('referer', 'https://discord.com/channels/@me');
			myHeaders.append('pragma', 'no-cache');
			myHeaders.append('priority', 'u=1, i');
			myHeaders.append(
				'sec-ch-ua',
				'"Not)A;Brand";v="8", "Chromium";v="138"',
			);
			myHeaders.append('sec-ch-ua-mobile', '?0');
			myHeaders.append('sec-ch-ua-platform', '"Windows"');
			myHeaders.append('sec-fetch-dest', 'empty');
			myHeaders.append('sec-fetch-mode', 'cors');
			myHeaders.append('sec-fetch-site', 'same-origin');
		}
		myHeaders.append(
			'x-super-properties',
			Buffer.from(
				JSON.stringify(
					isAndroidRequest
						? Constants.ANDROID_Properties
						: Constants.Properties,
				),
			).toString('base64'),
		);
		init.headers = myHeaders;
	}
	return DefaultRestOptions.makeRequest(url, init);
}

const originalSend = WebSocketShard.prototype.send;
WebSocketShard.prototype.send = async function (payload: GatewaySendPayload) {
	if (payload.op === GatewayOpcodes.Identify) {
		payload.d = {
			token: payload.d.token,
			properties: {
				...Constants.Properties,
				is_fast_connect: false,
				gateway_connect_reasons: 'AppSkeleton',
			},
			capabilities: 0,
			presence: payload.d.presence,
			compress: payload.d.compress,
			client_state: {
				guild_versions: {},
			},
		} as any;
	}
	return originalSend.call(this, payload);
};

export class ClientQuest extends Client {
	public questManager: QuestManager | null = null;
	public websocketManager: WebSocketManager;
	constructor(token: string) {
		const rest = new REST({ version: '10', makeRequest }).setToken(token);
		const gateway = new WebSocketManager({
			token: token,
			intents: 0,
			rest,
		});
		gateway.fetchGatewayInformation = (
			force?: boolean,
		): Promise<APIGatewayBotInfo> => {
			return Promise.resolve({
				url: 'wss://gateway.discord.gg',
				shards: 1,
				session_start_limit: {
					total: 1000,
					remaining: 1000,
					reset_after: 14400000,
					max_concurrency: 1,
				},
			});
		};
		super({ rest, gateway });
		this.websocketManager = gateway;
	}
	connect() {
		return this.websocketManager.connect();
	}
	destroy() {
		return this.websocketManager.destroy();
	}
	fetchQuests(fetchExcludedQuests = false) {
		return this.rest
			.get('/quests/@me')
			.then((response) =>
				QuestManager.fromResponse(
					this,
					response as AllQuestsResponse,
					fetchExcludedQuests,
				),
			)
			.then((manager) => {
				this.questManager = manager;
				return manager;
			});
	}
}
