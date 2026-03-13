import { ClientQuest } from './client';
import type { AllQuestsResponse, QuestTaskConfigType } from './interface';
import { Quest } from './quest';

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
		return this.client.rest.get(`/quests/${questId}`).then((response) => {
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
		}).catch((err) => {
			console.error(`Failed to fetch excluded quest "${questId}".`, err);
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

	filterQuestsValid() {
		return this.list().filter(
			(quest) =>
				quest.id !== '1412491570820812933' &&
				!quest.isCompleted() &&
				!quest.isExpired(),
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

	acceptQuest(questId: string, isAndroid = false): Promise<Quest | undefined> {
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
					AndroidRequest: isAndroid ? "true" : "false",
				}
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

	async doingQuest(quest: Quest) {
		const questName = quest.config.messages.quest_name;
		const isAndroid = Boolean(
			quest.config.task_config.tasks.WATCH_VIDEO_ON_MOBILE,
		);
		if (!quest.isEnrolledQuest()) {
			console.log(`Enrolling in quest "${questName}" (${isAndroid ? 'Android' : 'Desktop'} version)...`);
			try {
				await this.acceptQuest(quest.id, isAndroid);
			} catch (err: any) {
				console.error(`Failed to enroll in quest "${questName}".`, err?.message);
				throw err;
			}
		}
		const applicationName = quest.config.application.name;
		const taskConfig = quest.config.task_config;
		const taskName = [
			'WATCH_VIDEO',
			'PLAY_ON_DESKTOP',
			'STREAM_ON_DESKTOP',
			'PLAY_ACTIVITY',
			'WATCH_VIDEO_ON_MOBILE',
		].find(
			(x) => taskConfig.tasks[x as QuestTaskConfigType] != null,
		) as QuestTaskConfigType;
		const secondsNeeded = taskConfig.tasks[taskName].target;
		let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;
		if (
			taskName === 'WATCH_VIDEO' ||
			taskName === 'WATCH_VIDEO_ON_MOBILE'
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
						Math.floor((Date.now() - enrolledAt) / 1000) +
						maxFuture;
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
			};
			console.log(`Spoofing video for ${questName}.`);
			await fn();
		} else if (taskName === 'PLAY_ON_DESKTOP') {
			const interval = 60;
			while (!quest.isCompleted()) {
				const secondsDone = quest.userStatus?.progress?.[taskName]?.value as number || 0;
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
					)} more minutes.`,
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
		} else if (taskName === 'STREAM_ON_DESKTOP') {
			console.log(
				'This no longer works in node for non-video quests. Use the discord desktop app to complete the',
				questName,
				'quest!',
			);
		} else if (taskName === 'PLAY_ACTIVITY') {
			console.log(
				'This quest not supported. Use the discord desktop app to complete the',
				questName,
				'quest!',
			);
		} else {
			console.log(
				'Unknown quest type. Use the discord desktop app to complete the',
				questName,
				'quest!',
			);
		}
	}


}
