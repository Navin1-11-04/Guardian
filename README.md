# Guardian: AI Agent Firewall

> **A delegated consent firewall for AI agents.** Keep sovereign AI models secure while letting them interact with your digital life through Auth0's Token Vault.

## 🎯 The Problem

Open AI models like Llama are bringing sovereign AI to everyone—running locally on machines, browsers, even phones. But here's the catch: **powerful AI agents need access to your APIs, but you can't just give them raw credentials.**

Guardian solves this by acting as a **trusted intermediary**. Your AI agent talks to Guardian, Guardian evaluates policies, and only approved actions reach your APIs—keeping your secrets safe.

## ✨ Key Features

### 🔐 **Policy-Driven Authorization**
- Define rules: `allow`, `block`, or `step-up` auth for each action
- Fine-grained control: per-provider, per-action, per-resource
- Real-time audit trail: see exactly what the agent tried to do

### 🔑 **Auth0 Token Vault Integration**
- Secure OAuth token management—no credentials in code
- Multi-provider support: GitHub, Google Drive, Slack, more
- Token refresh & consent delegation built-in

### 🛡️ **Multi-Step Authentication**
- Sensitive operations trigger `step-up` authentication
- Agent waits for user approval before proceeding
- Keeps humans in control

### 📊 **Audit & Compliance**
- Live audit log of all agent actions
- Decision tracking: which policies applied, results
- Export-ready for security reviews

## 🏗️ Architecture

```
┌─────────────────┐
│   AI Agent      │  (LLM + Tools)
│  (LangChain)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Guardian     │  (This app)
│   ┌──────┐      │
│   │Policy│      │  Evaluate:
│   │Engine│      │  - Is action allowed?
│   └──────┘      │  - Needs auth?
│   ┌──────┐      │
│   │Audit │      │
│   │Trail │      │
│   └──────┘      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Auth0 Token   │
│     Vault       │  Secure OAuth tokens
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  External APIs  │
│ • GitHub        │
│ • Google Drive  │
│ • Slack         │
│ • More...       │
└─────────────────┘
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Auth0 account (free tier works)
- GitHub PAT (Personal Access Token)
- OpenRouter or compatible LLM API key

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/guardian.git
cd guardian

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local

# Fill in your credentials
# - AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
# - GITHUB_PAT
# - OPENROUTER_API_KEY (or your LLM provider)
```

### Configure .env.local

```env
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_SECRET=generate-with-openssl-rand-hex-32

GITHUB_PAT=ghp_your_token
OPENROUTER_API_KEY=sk_your_key
```

### Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### 1. **Set Up Policies**
Click **"Policies & Audit"** to configure what your agent can do:
- Read GitHub repos → `allow`
- Create issues → `step-up` (requires confirmation)
- Delete repos → `block` (never allowed)

### 2. **Ask Your Agent**
Natural language queries:
- "List my GitHub repositories"
- "Create an issue on my Guardian repo titled..."
- "Get details on my repos"

### 3. **Monitor Audit Log**
See real-time activity:
- Which actions ran
- Which were blocked
- Which required step-up auth

## 🎨 Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Auth0, LangChain
- **LLM**: OpenRouter (Llama 3.8B) — swap for any OpenAI-compatible API
- **Integrations**: 
  - GitHub (Octokit)
  - Google Drive (googleapis)
  - Auth0 Token Vault

## 🔧 API Routes

### `POST /api/agent`
Send a message to the AI agent.

**Request:**
```json
{ "message": "List my repos" }
```

**Response:**
```json
{
  "reply": "{\"ok\": true, \"data\": [{...repos...}]}"
}
```

### `GET /api/policies`
Fetch current security policies.

### `POST /api/policies`
Update security policies.

### `GET /api/audit`
Fetch audit log.

## 🛠️ Customization

### Add a New Tool
1. Create the tool function in `lib/guardian/`
2. Wrap with `guardedTool()` in `lib/agents.ts`
3. Define the policy rule in `lib/guardian/policy.ts`

Example:
```typescript
const sendSlackMessageTool = new DynamicStructuredTool({
  name: "send_slack_message",
  description: "Send a message to Slack",
  schema: z.object({ channel: z.string(), text: z.string() }),
  func: async ({ channel, text }) => {
    // Your implementation
  }
});

// Wrap it
guardedTool(sendSlackMessageTool, {
  provider: "slack",
  action: "send",
  resource: "messages"
})
```

### Switch LLM Provider

Change in `lib/agents.ts`:
```typescript
// From OpenRouter
const model = new ChatOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  model: "meta-llama/llama-3-8b-instruct",
});

// To OpenAI
const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4-turbo",
});
```

## 🎬 Demo Workflow

1. **User logs in** via Auth0
2. **User asks**: "Create an issue on Guardian repo"
3. **Agent parses** the request and resolves `Guardian` → repo path
4. **Guardian evaluates** policy: `github.write.issues` → `step-up`
5. **User sees** step-up auth modal, approves
6. **Agent creates** issue using GitHub API
7. **Audit log** records the action with full details
8. **User sees** success card with issue link

## 🏆 Built For

**Auth0 Authorized to Act Hackathon**

Guardian showcases how **Auth0's Token Vault** enables secure AI agent orchestration:
- ✅ Uses Token Vault for OAuth management
- ✅ Multi-provider agent coordination
- ✅ Step-up authentication on sensitive operations
- ✅ Keeps users in control while letting agents act
- ✅ Secure policy-driven access control

## 📂 Project Structure

```
guardian/
├── app/
│   ├── api/
│   │   ├── agent/          # Agent message handler
│   │   ├── audit/          # Audit log API
│   │   └── policies/       # Policy CRUD
│   ├── components/
│   │   └── ChatUI.tsx      # Main chat interface
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── agents.ts           # LangChain agent setup
│   ├── auth0.ts            # Auth0 config
│   ├── guardian/
│   │   ├── policy.ts       # Policy evaluation
│   │   ├── firewall.ts     # Tool wrapper
│   │   ├── audit.ts        # Audit logging
│   │   ├── github.ts       # GitHub tools
│   │   ├── google-drive.ts # Google Drive tools
│   │   └── ...
│   └── ...
├── public/
└── README.md
```

## 🔐 Security Notes

- Never commit `.env.local` — use `.env.example` template
- Auth0 secrets are never exposed to the client
- GitHub PAT should have minimum necessary scopes
- Audit logs are in-memory (use database for production)
- Step-up auth requires Auth0 redirect for production deployment

## 🚀 Deployment

### Deploy to Vercel

```bash
npm run build
vercel deploy
```

Set environment variables in Vercel dashboard.

### Deploy to Your Server

```bash
npm run build
npm start
```

## 📝 License

MIT

## 🤝 Contributing

Pull requests welcome! For major changes, please open an issue first.

## 💬 Questions?

- Check the [Auth0 AI Agents Docs](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow)
- Review [LangChain Documentation](https://js.langchain.com/)
- Open an issue on GitHub

---

**Built with ❤️ for the Auth0 Authorized to Act Hackathon**
