import { APIApplication } from 'discord-api-types/v10';
import { solveCaptcha } from './captcha';
import { ClientQuest } from './client';
import type {
	AllQuestsResponse,
	CaptchaDataFromRequest,
	QuestTaskConfigType,
} from './interface';
import { Quest } from './quest';
import { Utils } from './utils';
import { buildConnector, Client } from 'undici';

export class QuestManager implements Iterable<Quest> {
	private readonly quests = new Map<string, Quest>();
	public readonly client: ClientQuest;
	constructor(client: ClientQuest, quests: Quest[] = []) {
		this.client = client;
		quests.forEach((quest) => this.quests.set(quest.id, quest));
	}

	static async fromResponse(
		client: ClientQuest,
		response: AllQuestsResponse,
		fetchExcludedQuests = false,
	): Promise<QuestManager> {
		if (response.quest_enrollment_blocked_until !== null) {
			throw new Error(
				`Quest enrollment is blocked until ${response.quest_enrollment_blocked_until}.`,
			);
		}
		const questManager = new QuestManager(
			client,
			response.quests.map((quest) => Quest.create(quest)),
		);
		if (fetchExcludedQuests) {
			for (const quest of response.excluded_quests) {
				if (quest.id) {
					await questManager.addExcludedQuest(quest.id);
				}
			}
		}
		return Promise.resolve(questManager);
	}

	protected addExcludedQuest(questId: string) {
		// fetch quest details and add to quests
		return this.client.rest
			.get(`/quests/${questId}`)
			.then((response) => {
				const quest = Quest.create({
					id: questId,
					config: response as any,
					user_status: null,
					targeted_content: 0,
					preview: false,
				});
				console.log(
					`Added excluded quest "${quest.config.messages.quest_name}" to the quest manager.`,
				);
				this.quests.set(quest.id, quest);
			})
			.catch((err) => {
				console.error(
					`Failed to fetch excluded quest "${questId}".`,
					err.message,
				);
			});
	}

	[Symbol.iterator](): IterableIterator<Quest> {
		return this.quests.values();
	}

	get size(): number {
		return this.quests.size;
	}

	list(): Quest[] {
		return Array.from(this.quests.values());
	}

	get(id: string): Quest | undefined {
		return this.quests.get(id);
	}

	upsert(quest: Quest): void {
		this.quests.set(quest.id, quest);
	}

	remove(id: string): boolean {
		return this.quests.delete(id);
	}

	clear(): void {
		this.quests.clear();
	}

	getExpired(date: Date = new Date()): Quest[] {
		return this.list().filter((quest) => quest.isExpired(date));
	}

	getCompleted(): Quest[] {
		return this.list().filter((quest) => quest.isCompleted());
	}

	getClaimable(): Quest[] {
		return this.list().filter(
			(quest) => quest.isCompleted() && !quest.hasClaimedRewards(),
		);
	}

	hasQuest(id: string): boolean {
		return this.quests.has(id);
	}

	filterQuestsValidToDo() {
		return this.list().filter(
			(quest) => !quest.isCompleted() && !quest.isExpired(),
		);
	}

	filterQuestsValidToRedeem() {
		return this.list().filter(
			(quest) => quest.isCompleted() && !quest.hasClaimedRewards(),
		);
	}

	getApplicationData(ids: string[]) {
		const query = new URLSearchParams();
		ids.forEach((id) => query.append('application_ids', id));
		return this.client.rest.get(`/applications/public`, {
			query,
		}) as Promise<
			{
				// Partial<ApplicationData>
				id: string;
				name: string;
				icon: string;
				description: string;
				executables: {
					os: string;
					name: string;
					is_launcher: boolean;
				}[];
			}[]
		>;
	}

	/**
	 * Enroll in a quest.
	 * @param questId string
	 * @param isAndroid boolean
	 * @warning This API is heavily rate-limited (1 hour). Use with caution.
	 */
	acceptQuest(
		questId: string,
		isAndroid = false,
	): Promise<Quest | undefined> {
		// console.log(`Accepting quest "${questId}"...`);
		return this.client.rest
			.post(`/quests/${questId}/enroll`, {
				body: {
					location: isAndroid ? 12 : 11, // QUEST_HOME_MOBILE : QUEST_HOME_DESKTOP | https://docs.discord.food/resources/quests#quest-content-type
					// location: 19, // QUEST_SHARE_LINK
					is_targeted: false,
					metadata_raw: null,
					metadata_sealed: null,
				},
				headers: {
					AndroidRequest: isAndroid ? 'true' : 'false',
				},
			})
			.then((r) => {
				const quest = this.get(questId);
				quest?.updateUserStatus(r as any);
				return quest;
			});
	}

	private async timeout(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async redeemQuest(
		quest: Quest,
		retry = 0,
		captchaHeaders?: Record<string, string>,
	): Promise<void> {
		if (retry === 3) {
			console.error(
				`Failed to redeem quest "${quest.config.messages.quest_name}" after ${retry} attempts.`,
			);
			return;
		}
		if (!quest.isCompleted()) {
			console.error(`Cannot redeem rewards for an incomplete quest.`);
			return;
		}
		if (quest.hasClaimedRewards()) {
			console.error(`Rewards for this quest have already been claimed.`);
			return;
		}
		try {
			const agent = new Client('https://discord.com', {
				connect: buildConnector({
					ciphers: [
						'TLS_AES_128_GCM_SHA256',
						'TLS_AES_256_GCM_SHA384',
						'TLS_CHACHA20_POLY1305_SHA256',
						'ECDHE-ECDSA-AES128-GCM-SHA256',
						'ECDHE-RSA-AES128-GCM-SHA256',
						'ECDHE-ECDSA-AES256-GCM-SHA384',
						'ECDHE-RSA-AES256-GCM-SHA384',
						'ECDHE-ECDSA-CHACHA20-POLY1305',
						'ECDHE-RSA-CHACHA20-POLY1305',
						'ECDHE-RSA-AES128-SHA',
						'ECDHE-RSA-AES256-SHA',
						'AES128-GCM-SHA256',
						'AES256-GCM-SHA384',
						'AES128-SHA',
						'AES256-SHA',
					].join(':'),
				}),
			});
			const res = (await this.client.rest.post(
				`/quests/${quest.id}/claim-reward`,
				{
					body: {
						platform: quest.raw.config.rewards_config.platforms[0],
						location: 11, // QUEST_HOME_DESKTOP | https://docs.discord.food/resources/quests#quest-content-type
						is_targeted: false,
						metadata_raw: null,
						metadata_sealed: null,
						traffic_metadata_raw: quest.raw.traffic_metadata_raw,
						traffic_metadata_sealed:
							quest.raw.traffic_metadata_sealed,
					},
					headers: captchaHeaders,
					dispatcher: agent,
				},
			)) as any;
			console.log(
				`Claimed rewards for quest "${quest.config.messages.quest_name}"!`,
			);
			quest.updateUserStatus(res);
		} catch (err: any) {
			const rawError = err.rawError as CaptchaDataFromRequest;
			if (rawError['captcha_key'] && rawError['captcha_sitekey']) {
				console.warn(
					`Captcha required to redeem rewards for quest "${quest.config.messages.quest_name}".`,
					rawError,
				);
				const solvedCaptchaKey = await solveCaptcha(rawError);
				console.log(
					`Captcha Key solved: ${solvedCaptchaKey.slice(0, 30)}<0,30>. Retrying reward redemption...`,
				);
				// Todo: Fix "Unknown Message" error when solving captcha for quest rewards claiming.
				return this.redeemQuest(quest, retry + 1, {
					'x-captcha-key': solvedCaptchaKey,
					'x-captcha-rqtoken': rawError['captcha_rqtoken'],
					'x-captcha-session-id': rawError['captcha_session_id'],
				});
			} else {
				console.error(
					`Failed to redeem rewards for quest "${quest.config.messages.quest_name}".`,
					err.message,
				);
			}
		}
	}

	async doingQuest(quest: Quest) {
		const questName = quest.config.messages.quest_name;
		const isAndroid =
			Boolean(quest.config.task_config_v2.tasks.WATCH_VIDEO_ON_MOBILE) &&
			!Boolean(quest.config.task_config_v2.tasks.WATCH_VIDEO);
		if (!quest.isEnrolledQuest()) {
			console.log(
				`Enrolling in quest "${questName}" (${isAndroid ? 'Android' : 'Desktop'} version)...`,
			);
			try {
				await this.acceptQuest(quest.id, isAndroid);
			} catch (err: any) {
				console.error(
					`Failed to enroll in quest "${questName}".`,
					err?.message,
				);
				return;
			}
		} else {
			console.log(`Already enrolled in quest "${questName}".`);
		}
		const applicationName = quest.config.application.name;
		const taskConfig = quest.config.task_config_v2;
		const taskName = [
			'WATCH_VIDEO',
			'PLAY_ON_DESKTOP',
			'PLAY_ON_XBOX',
			'PLAY_ON_PLAYSTATION',
			'STREAM_ON_DESKTOP',
			'PLAY_ACTIVITY',
			'WATCH_VIDEO_ON_MOBILE',
			'ACHIEVEMENT_IN_ACTIVITY',
		].find(
			(x) => taskConfig.tasks[x as QuestTaskConfigType] != null,
		) as QuestTaskConfigType;
		const secondsNeeded = taskConfig.tasks[taskName].target;
		let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;
		switch (taskName) {
			case 'WATCH_VIDEO':
			case 'WATCH_VIDEO_ON_MOBILE': {
				await this.doingWatchVideoQuest(
					quest,
					questName,
					secondsNeeded,
					secondsDone,
				);
				break;
			}
			case 'PLAY_ON_XBOX':
			case 'PLAY_ON_PLAYSTATION':
			case 'PLAY_ON_DESKTOP': {
				await this.doingPlayOnPlatformQuest(
					quest,
					questName,
					secondsNeeded,
					taskName,
					applicationName,
				);
				break;
			}
			case 'PLAY_ACTIVITY': {
				await this.doingPlayActivityQuest(
					quest,
					questName,
					secondsNeeded,
					taskName,
					applicationName,
				);
				break;
			}
			case 'STREAM_ON_DESKTOP': {
				console.log(
					'This no longer works in node for non-video quests. Use the discord desktop app to complete the',
					questName,
					'quest!',
				);
				break;
			}
			case 'ACHIEVEMENT_IN_ACTIVITY': {
				await this.doingAchievementInActivityQuest(quest, questName);
				break;
			}
			default: {
				console.log(
					'Unknown quest type. Use the discord desktop app to complete the',
					questName,
					'quest!',
				);
			}
		}
	}
	async doingWatchVideoQuest(
		quest: Quest,
		questName: string,
		secondsNeeded: number,
		secondsDone: number,
	) {
		const maxFuture = 10,
			speed = 7,
			interval = 1;
		const enrolledAt = new Date(
			quest.userStatus?.enrolled_at as any,
		).getTime();
		let completed = false;
		let fn = async () => {
			while (true) {
				const maxAllowed =
					Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
				const diff = maxAllowed - secondsDone;
				const timestamp = secondsDone + speed;
				if (diff >= speed) {
					const res = (await this.client.rest.post(
						`/quests/${quest.id}/video-progress`,
						{
							body: {
								timestamp: Math.min(
									secondsNeeded,
									timestamp + Math.random(),
								),
							},
						},
					)) as any;
					completed = res.completed_at != null;
					secondsDone = Math.min(secondsNeeded, timestamp);
				}

				if (timestamp >= secondsNeeded) {
					break;
				}
				await this.timeout(interval * 1000);
			}
			if (!completed) {
				await this.client.rest.post(
					`/quests/${quest.id}/video-progress`,
					{
						body: { timestamp: secondsNeeded },
					},
				);
			}
			console.log(`Quest "${questName}" completed!`);
			this.client.emitQuestCompleted(quest.id);
		};
		console.log(`Spoofing video for ${questName}.`);
		await fn();
	}
	async doingPlayOnPlatformQuest(
		quest: Quest,
		questName: string,
		secondsNeeded: number,
		taskName: string,
		applicationName: string,
	) {
		const interval = 20;
		while (!quest.isCompleted()) {
			const secondsDone =
				(quest.userStatus?.progress?.[taskName]?.value as number) || 0;
			const res = await this.client.rest.post(
				`/quests/${quest.id}/heartbeat`,
				{
					body: {
						application_id: quest.config.application.id,
						terminal: false,
					},
				},
			);
			quest.updateUserStatus(res as any);
			console.log(
				`Spoofed your game to ${applicationName}. Wait for ${Math.ceil(
					(secondsNeeded - secondsDone) / 60,
				)} more minute(s).`,
			);
			await new Promise((resolve) =>
				setTimeout(resolve, interval * 1000),
			);
		}
		const res = await this.client.rest.post(
			`/quests/${quest.id}/heartbeat`,
			{
				body: {
					application_id: quest.config.application.id,
					terminal: true,
				},
			},
		);
		quest.updateUserStatus(res as any);
		console.log(`Quest "${questName}" completed!`);
		this.client.emitQuestCompleted(quest.id);
	}
	async doingPlayActivityQuest(
		quest: Quest,
		questName: string,
		secondsNeeded: number,
		taskName: string,
		applicationName: string,
	) {
		const interval = 20;
		const streamKey = 'call:1:1'; // Todo: call:channel_id:user_id | guild:guild_id:channel_id:user_id
		while (!quest.isCompleted()) {
			const secondsDone =
				(quest.userStatus?.progress?.[taskName]?.value as number) || 0;
			const res = await this.client.rest.post(
				`/quests/${quest.id}/heartbeat`,
				{
					body: { stream_key: streamKey, terminal: false },
				},
			);
			quest.updateUserStatus(res as any);
			console.log(
				`Spoofed your activity to ${applicationName}. Wait for ${Math.ceil(
					(secondsNeeded - secondsDone) / 60,
				)} more minute(s).`,
			);
			await new Promise((resolve) =>
				setTimeout(resolve, interval * 1000),
			);
		}
		const res = await this.client.rest.post(
			`/quests/${quest.id}/heartbeat`,
			{
				body: { stream_key: streamKey, terminal: true },
			},
		);
		quest.updateUserStatus(res as any);
		console.log(`Quest "${questName}" completed!`);
		this.client.emitQuestCompleted(quest.id);
	}
	async doingAchievementInActivityQuest(quest: Quest, questName: string) {
		// 1. Get application ID
		const applicationId = quest.config.application.id;
		const applicationName = quest.config.application.name;
		const questTarget =
			quest.config.task_config_v2.tasks.ACHIEVEMENT_IN_ACTIVITY.target;
		// 2. Authorize
		const query = new URLSearchParams({
			response_type: 'code',
			client_id: applicationId,
			scope: 'identify applications.commands applications.entitlements',
			state: '',
		});
		const res2 = (await this.client.rest.post(`/oauth2/authorize`, {
			query,
			body: {
				permissions: '0',
				authorize: true,
				integration_type: 1,
				location_context: {
					guild_id: '10000',
					channel_id: '10000',
					channel_type: 10000,
				},
			},
		})) as Record<string, any>;
		console.log(`Authorized application ${applicationName}`);
		const location = res2?.location;
		let authCode: string | null = null;
		if (location) {
			authCode = new URL(location).searchParams.get('code');
		}
		if (!authCode) {
			console.error(
				`No auth code received for application ${applicationName}. Cannot complete the quest.`,
			);
			return;
		}
		// 3. Complete achievement in activity
		const { token, error: authError } = await Utils.authorizeDiscordSays(
			applicationId,
			authCode,
		);
		if (authError || !token) {
			console.error(
				`Failed to authorize with Discord Says for application ${applicationName}. Cannot complete the quest.`,
				authError,
			);
			return;
		}
		const { success, error: progressError } =
			await Utils.progressDiscordSays(applicationId, token, questTarget);
		if (progressError || !success) {
			console.error(
				`Failed to progress quest with Discord Says for application ${applicationName}. Cannot complete the quest.`,
				progressError,
			);
			return;
		}
		// 4. Deauthorize
		const res3 = (await this.client.rest.get(`/oauth2/tokens`)) as {
			id: string;
			scopes: string[];
			application: APIApplication;
			disclosures: number[];
		}[];
		const tokenInfo = res3.find((t) => t.application.id === applicationId);
		if (tokenInfo) {
			try {
				await this.client.rest.delete(`/oauth2/tokens/${tokenInfo.id}`);
				console.log(`Deauthorized application ${applicationName}`);
			} catch (err) {
				console.error(
					`Failed to deauthorize token for application ${applicationName}.`,
					(err as Error).message,
				);
			}
		}
		console.log(`Quest "${questName}" completed!`);
		this.client.emitQuestCompleted(quest.id);
	}
}
