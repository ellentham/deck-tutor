# Security

## API Keys

Deck Tutor uses optional API keys for AI-powered features:

- **GEMINI_API_KEY** — Google Gemini (recommended)
- **OPENAI_API_KEY** — OpenAI GPT-4o-mini (alternative)

**Never commit API keys to the repository.** Keys are loaded from environment variables via a `.env` file, which is gitignored.

### Setup

1. Copy `.env.example` to `.env`
2. Add your keys to `.env` (see [Get a Gemini API key](https://ai.google.dev/) or [OpenAI API keys](https://platform.openai.com/api-keys))
3. The app runs without keys but AI features will be disabled

### If You Accidentally Commit a Key

1. **Rotate the key immediately** — revoke it in the provider dashboard and create a new one
2. Remove it from git history (e.g. `git filter-branch` or BFG Repo-Cleaner)
3. Force-push only if the key was pushed to a remote
