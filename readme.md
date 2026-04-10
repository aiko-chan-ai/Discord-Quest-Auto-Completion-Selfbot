# Discord Quest Auto-Completion Selfbot

A selfbot that automatically completes **Discord Quests**.

Based on the original work by [amia](https://gist.github.com/aamiaa/204cd9d42013ded9faf646fae7f89fbb).

This project provides a minimal selfbot framework built on top of discord.js core libraries, demonstrating how selfbot patches can be implemented without modifying the library’s source code directly.

> [!CAUTION]
> As of April 7th 2026, Discord has expressed their intent to crack down on automating quest completion.
> 
> Some users have received the following system message:
> 
> <img width="836" height="272" alt="image" src="https://github.com/user-attachments/assets/3f19670e-e6f4-4425-99d7-7f04d1398787" />
> 
> Use the script at your own risk.

> [!WARNING]
> **I take no responsibility for accounts that get blocked for using this repo.**

> [!CAUTION]
> **Using this on a user account is prohibited by the [Discord TOS](https://discord.com/terms) and can lead to account suspension.**

## ✨ Features

* Automatically **enrolls** and **completes** currently active quests. Supported task types:

  * `WATCH_VIDEO`
  * `PLAY_ON_DESKTOP`
  * `PLAY_ON_XBOX` (untested)
  * `PLAY_ON_PLAYSTATION` (untested)
  * `PLAY_ACTIVITY` (untested)
  * `WATCH_VIDEO_ON_MOBILE`
  * `ACHIEVEMENT_IN_ACTIVITY`

* ~~Automatically **redeems rewards** for completed quests.~~ nope 😭
* Unsupported for now (due to no valid samples at time of development):

  * `STREAM_ON_DESKTOP`

## 📦 Installation & Setup (Local)

> [!NOTE]
> **Node.js 24.0.0 or newer is required**

### 1. Install dependencies

```sh
npm install
```

### 2. Insert your token

Replace the token inside `.env`.

### 3. Start the bot

```sh
npm run start
```

## 📦 Installation & Setup (Github)

> [!NOTE]
> **This is how you use GitHub Actions to automatically complete quests for you and send notifications via webhook (optional).**

> [!CAUTION]
> **Running this on GitHub Actions is prohibited by the [GitHub Actions Acceptable Use Policy](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies#4-spam-and-inauthentic-activity-on-github) and can lead to immediate account suspension.**

### Fork This Repository
<img width="446" height="132" alt="1" src="https://github.com/user-attachments/assets/a47e639c-6cef-474e-aa1e-01c5cdfb00ab" />
<img width="771" height="608" alt="2" src="https://github.com/user-attachments/assets/1599f2be-d556-4d83-a5b5-afe299eeee4f" />

### Configure your settings (Open your forked repository)

- 1. Go to the **Settings** tab

<img width="613" height="99" alt="3" src="https://github.com/user-attachments/assets/0856ea9f-0097-41db-a21f-0690b1ef0e35" />

- 2. On the left sidebar, navigate to **Secrets and variables** → **Actions**. Click on **New repository secret**.

<img width="1920" height="905" alt="4" src="https://github.com/user-attachments/assets/85795de7-133e-4d91-8bc5-4dc050004f14" />

- 3. Add the following secrets: `TOKEN` (Required) and `WEBHOOK_URL` (Optional)

<img width="1299" height="553" alt="5" src="https://github.com/user-attachments/assets/7e4e3635-9a1b-4d30-b79c-28a34bbe2c69" />
<img width="1279" height="798" alt="6" src="https://github.com/user-attachments/assets/f481a38f-6fc9-4c0c-a60c-cf4c64fd83a0" />
<img width="1212" height="552" alt="7" src="https://github.com/user-attachments/assets/8305457b-c311-4d79-b08a-6fe0c48a3e4e" />

- 4. Go to the **Actions** tab and enable GitHub Actions.

<img width="1920" height="908" alt="8" src="https://github.com/user-attachments/assets/1b113327-0d9a-4234-9500-58ad4a03c04a" />
<img width="1709" height="619" alt="9" src="https://github.com/user-attachments/assets/b6c07038-d87c-4dc4-ab12-e4167c55d7e1" />

### You're all set! After completing these steps, the bot will automatically run every day at **00:15 UTC**. If you want to run it manually, you can still trigger the workflow yourself from the Actions tab.

> [!IMPORTANT]
> On forked repositories, scheduled workflows can be automatically disabled after a long period of inactivity (especially on public repositories).
>
> If the schedule does not run, re-enable the workflow in the **Actions** tab and push a tiny commit to your default branch (for example, a small README typo fix) to wake the scheduler.

<img width="1920" height="592" alt="10" src="https://github.com/user-attachments/assets/76ba5c5f-f534-48aa-87ad-f7df2b710e88" />
<img width="1920" height="912" alt="11" src="https://github.com/user-attachments/assets/e500b38e-1b84-4a16-8035-cd6653da0758" />

## 📤 Example Output

After completion, your output may look like this:

```sh
Logged in!
Found 9 valid quests to do.
Spoofing video for Opera GX.
Spoofed your game to the Comet AI browser. Wait for 15 more minutes.
Spoofed your game to Delta Force. Wait for 15 more minutes.
Spoofed your game to Where Winds Meet. Wait for 15 more minutes.
Spoofing video for Mobile Orbs Intro.
Spoofing video for Amazon.
Spoofing video for Microsoft Edge - Your AI Browser.
Spoofed your game to Risk of Rain 2. Wait for 15 more minutes.
Spoofing video for EVE Online Video.
Quest "Opera GX" completed!
Quest "Mobile Orbs Intro" completed!
Quest "Amazon" completed!
Quest "Microsoft Edge - Your AI Browser" completed!
Spoofed your game to the Comet AI browser. Wait for 15 more minutes.
Spoofed your game to Delta Force. Wait for 15 more minutes.
Spoofed your game to Where Winds Meet. Wait for 15 more minutes.
Spoofed your game to Risk of Rain 2. Wait for 15 more minutes.
Quest "EVE Online Video" completed!
...
Spoofed your game to the Comet AI browser. Wait for 1 more minute.
Spoofed your game to Delta Force. Wait for 1 more minute.
Spoofed your game to Where Winds Meet. Wait for 1 more minute.
Spoofed your game to Risk of Rain 2. Wait for 1 more minute.
Quest "Download Comet Browser" completed!
Quest "New Season Ahsarah" completed!
Quest "Where Winds Meet Launch" completed!
Quest "Alloyed Collective Gupdoption" completed!
```

## 🙏 Credits

* [Complete Recent Discord Quest](https://gist.github.com/aamiaa/204cd9d42013ded9faf646fae7f89fbb/4912415839790240d49c1d2553e940f0c65f95d5)
* [Equicord's Questify plugin](https://equicord.org/plugins/Questify)
* [discord.js](https://github.com/discordjs/discord.js)
* [The idea of using GitHub Actions as a server to run the selfbot is from manishbhaiii](https://github.com/manishbhaiii/Discord-Quest-Auto-Completion-Selfbot)

*README compiled with assistance from AI.*
