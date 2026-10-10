This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3010](http://localhost:3010) with your browser to see the result.

## Telegram demo sign-in notifications

The app requires users to register an email and password before signing in, and protected workspace pages redirect visitors without a registered browser account and active demo session. Demo accounts are stored only in the current browser; passwords are stored as salted PBKDF2 hashes, not plaintext. This is a local demo gate, not server-side authentication: it does not verify that an email belongs to the user or that it is a Gmail account, and it must not be used to protect sensitive or production data. Each successful sign-in automatically sends the registered name, email, and server-generated access time to the configured Telegram bot. The timestamp includes a readable India Standard Time (Asia/Kolkata) value and an ISO 8601 value with the exact `+05:30` offset. The login page discloses this before sign-in. Passwords are never sent to Telegram.

To configure notifications:

1. Create a Telegram bot with Telegram's official BotFather and keep its bot token private.
2. Start a conversation with the bot and obtain the destination chat ID for the account that should receive notices.
3. Add these server-only values to `frontend/.env.local` and restart the frontend:

   ```dotenv
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

Do not prefix these variables with `NEXT_PUBLIC_` or commit the token. Notifications are disabled until both values are configured. The prediction form discloses that every successful prediction automatically sends a minimal report to Telegram: a single prediction includes its predicted label and a server-generated UTC timestamp, while a CSV batch includes aggregate counts by predicted label. The report excludes identities, credentials, confidence values, and patient inputs, and is labeled as an AI research prediction, not a diagnosis. The same-origin notification endpoints rate-limit requests.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
