# GitHub OAuth Setup Guide

## 1. Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Claude Web (or your preferred name)
   - **Homepage URL**: http://localhost:12020 (or your production URL)
   - **Authorization callback URL**: http://localhost:12020/auth/github/callback
4. Click "Register application"
5. Copy the **Client ID** and generate a new **Client Secret**

## 2. Configure Environment Variables

Update your `backend/.env` file with the GitHub OAuth credentials:

```env
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:12020/github/callback
```

## 3. Run Database Migration

Execute the GitHub OAuth database migration:

```bash
cd backend
psql $DATABASE_URL -f migrations/003_github_oauth.sql
```

## 4. Using GitHub Integration

### Connect GitHub Account
1. Click the GitHub icon in the top toolbar
2. Click "Connect GitHub Account"
3. Authorize the application in GitHub
4. Your repositories will be automatically synced

### Clone Private Repositories
1. Open the GitHub manager (GitHub icon in toolbar)
2. Click on any repository from your list
3. Copy the provided clone URL (includes temporary OAuth token)
4. Use the URL in your terminal:
   ```bash
   git clone https://oauth2:TOKEN@github.com/username/repo.git
   ```

### Manage Repositories
- **Sync**: Click "Sync Repos" to refresh your repository list
- **Remove**: Click the delete icon to remove a repo from local list (doesn't affect GitHub)
- **Disconnect**: Click "Disconnect" to revoke access and remove all data

## Security Notes

- OAuth tokens are encrypted and stored securely in the database
- Tokens are automatically refreshed when needed
- Clone URLs contain temporary tokens - use immediately and don't share
- All GitHub data is removed when you disconnect your account

## Troubleshooting

### "Failed to connect to GitHub"
- Check your Client ID and Client Secret are correct
- Ensure the callback URL matches exactly
- Check browser console for any errors

### "Failed to sync repositories"
- Your token might have expired - try disconnecting and reconnecting
- Check if you have the correct OAuth scopes (repo, user:email)

### Database errors
- Ensure you've run the migration script
- Check that PostgreSQL is running and accessible