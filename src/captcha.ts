import { Constants } from './constants';
import { CaptchaDataFromRequest } from './interface';
import { YesCaptchaSolver } from './providers/yescaptcha';
import { Utils } from './utils';

let yesCaptchaClient: YesCaptchaSolver | null = null;

if (process.env.YES_CAPTCHA_API_KEY) {
	console.log('YesCaptcha API key found. Captcha solving is enabled.');
	yesCaptchaClient = new YesCaptchaSolver(process.env.YES_CAPTCHA_API_KEY);
}

// Handles captcha solving uses YesCaptcha if available else falls back to manual input.
export function solveCaptcha(data: CaptchaDataFromRequest): Promise<string> {
	if (yesCaptchaClient) {
		return yesCaptchaClient
			.hcaptcha(data.captcha_sitekey, 'https://discord.com', {
				rqdata: data.captcha_rqdata,
				isInvisible: false,
				userAgent: Constants.USER_AGENT,
			})
			.then((result) => result.gRecaptchaResponse)
			.catch(() =>
				Utils.askQuestion(
					'YesCaptcha failed. Enter the Captcha Key manually (or press Enter to skip): ',
				).then((answer) => {
					if (!answer.trim()) throw new Error('CAPTCHA_SKIPPED');
					return answer;
				}),
			);
	}
	return Utils.askQuestion(
		'Enter the Captcha Key manually (or press Enter to skip this quest): ',
	).then((answer) => {
		if (!answer.trim()) {
			throw new Error('CAPTCHA_SKIPPED');
		}
		return answer;
	});
}
