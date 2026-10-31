# Budget Tracker

![CI](https://github.com/Paarth11/budget-tracker/actions/workflows/ci.yml/badge.svg)

A zero-based monthly budgeting app with user accounts. Plan every unit of income before the month starts, then log expenses against each budget line and watch what is left. Built with React, Node.js and PostgreSQL, and deployed to AWS ECS Fargate through a GitHub Actions CI/CD pipeline.

![Budget Screen](docs/Budget-ss.png)

## Features

- **Zero-based budgeting:** the header shows how much income is still unassigned. It turns green at zero and red when over-budgeted.
- **Monthly budgets:** income and expense groups with planned amounts. Start a new month by copying the previous one, or from a basic template.
- **Transactions:** log income and expenses and assign each to a budget line. Spent and remaining amounts update per line.
- **User accounts:** sign up and log in. Every user sees only their own data.
- **CSV export:** download all transactions as a spreadsheet-safe CSV.
- **Responsive UI:** works on phones, with Budget and Transactions as separate tabs on small screens.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript, Zod (validation) |
| Database | PostgreSQL |
| Auth | bcrypt password hashing, signed JWT in an httpOnly cookie |
| Testing | Vitest, supertest |
| Container | Docker (multi-stage build) |
| CI/CD | GitHub Actions |
| Cloud | AWS ECS Fargate, ECR, RDS, ALB, Secrets Manager, CloudWatch, IAM |

## Architecture

```mermaid
flowchart LR
    U["Browser<br/>React app"] -->|HTTP| ALB["Application Load Balancer"]
    ALB -->|port 4000| ECS["ECS Fargate task<br/>Node.js + Express"]
    ECS -->|SQL over SSL, port 5432| RDS[("RDS PostgreSQL")]
    SM["Secrets Manager"] -.->|injected at start-up| ECS
    ECS -.->|logs| CW["CloudWatch Logs"]
```

The container serves both the built React app and the JSON API from one origin, so login cookies need no cross-site setup.

- The load balancer is the only public entry point. The app accepts traffic only from the load balancer, and the database accepts traffic only from the app (security groups).
- `DATABASE_URL` and `JWT_SECRET` live in AWS Secrets Manager. ECS injects them as environment variables when a task starts, so they are never in the image or the repository.
- The ECS task execution role pulls the image, reads the secrets and writes logs. The task role is empty because the app makes no direct AWS calls.

## CI/CD pipeline

```mermaid
flowchart LR
    Dev["git push to main"] --> GH["GitHub Actions<br/>install, test, build"]
    GH --> OIDC["Assume AWS role<br/>OIDC, no stored keys"]
    OIDC --> Build["Build Docker image"]
    Build --> ECR["Push to ECR<br/>tag = commit SHA"]
    ECR --> TD["Register new<br/>task definition revision"]
    TD --> Deploy["Rolling deploy to ECS Fargate<br/>health checks and auto rollback"]
```

1. **Test and build:** every push and pull request installs dependencies, runs the server tests, and builds the server and client.
2. **Deploy:** pushes to `main` that pass the checks log in to AWS using OIDC (short-lived credentials, no access keys stored in GitHub).
3. The image is built from the `Dockerfile` and pushed to ECR, tagged with the commit SHA so every running version traces back to its code.
4. The pipeline copies the current ECS task definition, swaps in the new image, registers a new revision and updates the service.
5. ECS starts a new task, waits for it to pass health checks (`/healthz`), then stops the old one. If the new task keeps failing, the deployment circuit breaker rolls back.

## Getting started

### Prerequisites

- Node.js 22 or newer
- Docker (for a local PostgreSQL), or any PostgreSQL 16 instance

### Run locally

```bash
# 1. Start PostgreSQL (skip if you already have one)
docker compose up -d

# 2. API (tables are created automatically on start)
cd server
cp .env.example .env
npm install
npm run dev            # http://localhost:4000

# 3. Frontend, in a second terminal
cd client
npm install
npm run dev            # http://localhost:5173
```

Open http://localhost:5173, create an account, and click **Start budget**.

### Run the production image locally

```bash
docker build -t budget-tracker .
docker run --rm -p 4000:4000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  budget-tracker
```

Then open http://localhost:4000. Set `COOKIE_SECURE=false` when testing over plain HTTP.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `JWT_SECRET` | yes in production | Signs login cookies. Use a long random value. |
| `PORT` | no | Port to listen on. Default `4000`. |
| `NODE_ENV` | no | `production` makes the server also serve the built React app. |
| `DB_SSL` | no | `true` for AWS RDS, which requires encrypted connections. |
| `COOKIE_SECURE` | no | `true` once the site is served over HTTPS. Defaults to `true` in production. |
| `CLIENT_ORIGIN` | no | Allowed origin for local development. Default `http://localhost:5173`. |

## Testing

```bash
cd server
npm test
```

The tests use Vitest and supertest to call the Express app directly. The database layer is mocked, so no PostgreSQL is needed to run them. They cover authentication on protected routes, input validation (for example malformed months and non-positive amounts), and that queries are scoped to the logged-in user.

## API reference

All `/api` routes except `/api/auth/*` require a login cookie and return `401` without one.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/healthz` | Health check for the load balancer. Public, does not use the database. |
| `POST` | `/api/auth/register` | Create an account and start a session. |
| `POST` | `/api/auth/login` | Log in. |
| `POST` | `/api/auth/logout` | End the session. |
| `GET` | `/api/auth/me` | The current user. |
| `GET` | `/api/budget/:month` | Budget lines (with spent totals) and transactions for `YYYY-MM`. |
| `POST` | `/api/budget/:month/start` | Start a month from the previous one or a template. |
| `POST` | `/api/items` | Add a budget line. |
| `PATCH` | `/api/items/:id` | Update a line's name or planned amount. |
| `DELETE` | `/api/items/:id` | Delete a line. Its transactions become unassigned. |
| `POST` | `/api/transactions` | Add a transaction. |
| `PATCH` | `/api/transactions/:id` | Assign or unassign a transaction to a budget line. |
| `DELETE` | `/api/transactions/:id` | Delete a transaction. |
| `GET` | `/api/export/transactions.csv` | Download all transactions as CSV. |

## Security

- Passwords are hashed with bcrypt and never stored or returned in plain text.
- Sessions use a signed JWT in an `httpOnly`, `SameSite=Lax` cookie, which is also `Secure` over HTTPS.
- Login and signup are rate limited, and login gives the same response for unknown emails and wrong passwords.
- Every database query is parameterized and filtered by the logged-in user's id, so users cannot read or change each other's data.
- Request bodies are validated with Zod before any database call.
- The CSV export neutralizes spreadsheet formula injection.
- In AWS: the database is private, secrets are in Secrets Manager, IAM roles are least-privilege, and GitHub gets temporary credentials through OIDC.

## Deploying to AWS

The app runs on ECS Fargate behind an Application Load Balancer, with RDS PostgreSQL as the database. The one-time AWS setup is:

1. ECR repository `expense-tracker`.
2. Three security groups: load balancer (80 and 443 from anywhere), app (4000 from the load balancer), database (5432 from the app).
3. RDS PostgreSQL in the default VPC, not publicly accessible, with an initial database named `tracker`.
4. Two Secrets Manager secrets: `expense-tracker/database-url` and `expense-tracker/jwt-secret`, each stored as plaintext.
5. IAM roles: a task execution role (`AmazonECSTaskExecutionRolePolicy` plus read access to the two secrets) and an empty task role.
6. CloudWatch log group `/ecs/expense-tracker`.
7. Target group (type IP, port 4000, health check `/healthz`), Application Load Balancer, ECS cluster, task definition and service with the deployment circuit breaker enabled.
8. An IAM role for GitHub Actions with an OIDC trust policy limited to this repository's `production` environment, and permissions to push to ECR and update the service.

Then add these as GitHub repository variables:

| Variable | Example |
| --- | --- |
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/GithubBudgetTrackingRole` |
| `AWS_REGION` | `ap-south-1` |
| `ECR_REPOSITORY` | `expense-tracker` |
| `ECS_CLUSTER` | `expense-tracker` |
| `ECS_SERVICE` | `expense-tracker` |

From then on, every push to `main` that passes the checks deploys automatically.

### Before real users

- Add an ACM certificate and an HTTPS listener, redirect port 80 to it, and set `COOKIE_SECURE=true` in the task definition.
- Turn on deletion protection and a final snapshot for the database.

### Controlling cost

The load balancer, RDS and Fargate bill while they exist. To pause: set the ECS service to 0 tasks and stop the RDS instance (AWS restarts a stopped instance after 7 days). The load balancer keeps billing until it is deleted.

## Project structure

```
.
├── client/              React + Vite + Tailwind frontend
├── server/              Express API
│   ├── src/             routes, auth, database
│   └── tests/           Vitest + supertest tests
├── Dockerfile           multi-stage build: client, server, then a small runtime image
├── docker-compose.yml   local PostgreSQL
└── .github/workflows/   CI/CD pipeline
```

## Roadmap

- Infrastructure as code with Terraform (the AWS setup is currently created by hand in the console).
- HTTPS with a custom domain.
- CloudWatch alarms for errors and CPU.
- Password reset by email.