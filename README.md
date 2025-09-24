
# 📞 Twilio Dialer – Frontend (Vite + React)

A lightweight web app for agents to place and monitor customer calls using a serverless backend (**FastAPI on AWS Lambda + API Gateway**) and **Twilio Voice**.

Supports two modes:

- **Server-placed calls** (backend dials the customer with a text-to-speech message)
- **Browser calling (WebRTC → PSTN)** via Twilio Voice SDK (agent talks directly from the browser)

---

## Demo / Links

- **Live site**: [https://www.talentpulltech.cloud/login](Dailer) (CloudFront / Route53)  
- **Backend API sample- **: `https://<api-id>.execute-api.<region>.amazonaws.com` (hiddeen)
- **GitHub repo**: `https://github.com/alamuk/twilio_app`

 Tip: For best results with browser calling, use **HTTPS** (CloudFront/Route53 domain).

---

## 🧩 Architecture

- **Frontend**: Vite + React (this repo)  
- **Backend**: FastAPI, deployed to AWS Lambda behind API Gateway (HTTP API)  
- **Telephony**: Twilio Voice (REST API + Browser SDK)  
- **Hosting**: S3 (static site) + CloudFront (CDN), optional custom domain via Route53  
- **CI/CD**: GitHub Actions → OIDC → IAM role → S3/CloudFront  

---

## 🔧 Prerequisites

- A running backend with endpoints:
  - `POST /api/call` – create a call (TTS message, backend places the call)
  - `POST /api/hangup` – end a call by SID
  - `GET /api/status?sid=CA...` – poll call state
  - `POST /api/token` – returns a Twilio AccessToken for browser calling
  - `GET /client/voice` – TwiML handler for the Voice SDK (Twilio “TwiML App” points here)

- Twilio account + verified numbers  
- AWS account with S3 + CloudFront set up (OAC recommended)  

---

## Environment Variables (Frontend)

You can provide these via **Vite envs** or type them in the **UI Settings panel** (persisted in `localStorage`).

```ini
VITE_API_BASE=https://<api-id>.execute-api.<region>.amazonaws.com
VITE_FROM_POOL=+numbers 
```

```ini
##### install dependencies
npm ci
##### start dev server
npm run dev
##### open the URL printed by Vite (e.g. http://localhost:5173)

```

### Custom Domain (Route53)

Register or transfer your domain to Route53

In CloudFront → add Alternate domain name (CNAME), e.g. www.ms-alam.co.uk

Request/attach an ACM certificate (in us-east-1)

In Route53 → Hosted Zone → create an A (Alias) record pointing domain → CloudFront


### CORS with Backend
In your backend deployment, set AllowedOrigins to include frontend origins:
http://localhost:5173
https://<example>.cloudfront.net
https://demosite.com

Redeploy backend so FastAPI’s CORS middleware accepts them.


Troubleshooting
❌ AccessDenied XML on CloudFront

Ensure S3 bucket is private

CloudFront uses OAC

Bucket policy allows that OAC

index.html exists at bucket root

❌ CORS errors calling API

Add frontend origins to backend AllowedOrigins

Redeploy backend

❌ GitHub Actions “Could not load credentials”

AWS_ROLE_ARN secret set correctly

IAM Role trust policy matches repo/branch via OIDC

Regions match

❌ Browser calling doesn’t start

Use HTTPS + allow Microphone

Twilio TwiML App → Voice URL points to /client/voice

Backend /api/token returns valid Twilio token