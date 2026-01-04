# Deploy to Railway

## Quick Setup (5 minutes)

### 1. Install Railway CLI
```bash
npm i -g @railway/cli
```

### 2. Login to Railway
```bash
railway login
```
This opens your browser - sign up/login with GitHub (easiest) and add your credit card.

### 3. Initialize Project
```bash
# From this directory
railway init
```
- Choose "Create new project"
- Give it a name like "gmail-mcp-server"

### 4. Deploy
```bash
railway up
```

This will:
- Upload your code
- Install dependencies (`npm install`)
- Build TypeScript (`npm run build`)
- Start the server (`npm start`)

### 5. Get Your URL
```bash
railway domain
```

This generates a public URL like: `https://gmail-mcp-server-production.up.railway.app`

---

## Environment Variables (Optional)

Set CORS origins for your frontend:

```bash
railway variables set ALLOWED_ORIGINS=https://your-frontend.com
```

Or use Railway dashboard:
1. Go to [railway.app](https://railway.app)
2. Select your project
3. Go to Variables tab
4. Add `ALLOWED_ORIGINS`

---

## Using Your Deployed Server

### Test Health Endpoint
```bash
curl https://your-railway-url.up.railway.app/health
```

### From Your Frontend
```javascript
const response = await fetch('https://your-railway-url.up.railway.app/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Google-Access-Token': userGoogleAccessToken,
    'X-Google-Refresh-Token': userGoogleRefreshToken
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'send_email',
      arguments: {
        to: ['test@example.com'],
        subject: 'Hello from Railway!',
        body: 'This email was sent via my deployed MCP server'
      }
    }
  })
});

const data = await response.json();
console.log(data);
```

---

## Useful Commands

```bash
railway status          # Check deployment status
railway logs            # View server logs (live)
railway domain          # Show your public URL
railway open            # Open Railway dashboard
railway variables       # List environment variables
railway down            # Delete deployment
```

---

## Auto-Deploy from GitHub (Recommended)

Instead of `railway up` every time:

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) dashboard
3. Click your project → Settings → Connect to GitHub
4. Select your repo

Now every `git push` auto-deploys! 🚀

---

## Monitoring Costs

Check usage:
```bash
railway status
```

Or go to: https://railway.app/account/usage

Your server uses ~$0.20-0.50/month for a small project, well under the $5 credit.

---

## Troubleshooting

**Port issues?**
Railway auto-detects port 3001 from your code, but you can force it:
```bash
railway variables set PORT=3001
```

**Build failing?**
Check logs:
```bash
railway logs
```

**Need to restart?**
```bash
railway restart
```
