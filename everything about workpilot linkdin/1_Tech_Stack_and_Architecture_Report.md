# WorkPilot - Tech Stack and Architecture Report

## 🏗️ Overall Architecture
WorkPilot follows a decoupled Client-Server architecture designed to run on containerized environments such as AWS ECS (Fargate) or EC2 instances with Docker-Compose.

### 1. Frontend Client
- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion (Motion), Lenis (Smooth Scrolling)
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Deployment Build**: Optimized static route pages via Turbopack, bundled into a lightweight Alpine Node image.

### 2. Backend Server
- **Runtime**: Node.js (v20+ target)
- **Framework**: Express.js 5.0
- **Language**: TypeScript
- **Database ORM**: Drizzle ORM
- **Database Engine**: PostgreSQL (Neon Serverless Postgres via `postgres` driver)
- **AI Engine**: Google Gemini API via `@langchain/google-genai` and `@langchain/langgraph`
- **Security & Auth**: JWT (JSON Web Tokens), `bcrypt` for password hashing, `express-rate-limit` for DDoS protection, `cors`, `cookie-parser`.
- **Validation**: `zod`, `express-validator`
- **Time/Date Management**: Luxon

### 3. External Integrations
- **LinkedIn Automation**: Unipile API (for messaging, scraping, connecting)
- **LLM/AI Reasoning**: Google Gemini 2.5 Flash
- **Email Delivery**: Resend API
- **Payments & Subscriptions**: Razorpay
- **Data Encryption**: Custom data encryption key for protecting sensitive user credentials.

### 4. Containerization & DevOps
- **Container Engine**: Docker & Docker Compose
- **Build Multi-stage**: Optimizing size via `node:alpine` for both client and server containers.
- **Proxy**: Nginx (Reverse proxy with TLS 1.3, gzip, WebSockets routing)

---
### Architecture Flow
1. **User Request**: User interacts with the Next.js frontend (`linkdin.workpilot.co.in`).
2. **Reverse Proxy**: Nginx routes frontend traffic to the Next.js container (Port 3000) and API traffic to the Express container (Port 4000).
3. **API Layer**: Express validates requests, checks JWT authentication, and executes business logic.
4. **Data Access**: Drizzle ORM queries the external Neon Serverless PostgreSQL database securely over SSL.
5. **AI/Automation Execution**: For specific tasks, the backend invokes Gemini for decision making, and Unipile for automating LinkedIn actions (messaging/connections) on behalf of the user.
