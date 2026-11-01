# The VPS and shared infrastructure

The Atlas API, its database and its uploaded files live on one VPS (virtual private server), a rented virtual machine in a cloud data center. The author uses the same server for several other projects, and Atlas shares the front door and the database server with them. This page explains the machine, what runs on it for Atlas, the shared tools (k3s, Envoy Gateway, cert-manager, Flux and pm2) in plain words, how the maintainer reaches the server, how the Atlas API is watched, and the server work still pending on 2026-11-01.

## What kind of server runs the Atlas API?

The Atlas API runs on one Oracle Cloud free-tier virtual server:

- Processor: ARM (the same family of chips as most phones), 2 CPU cores
- Memory: 12 GB of RAM
- Operating system: Ubuntu LTS, a long-term-support Linux release
- Address: one public address, which Atlas reaches through the name api.140-245-60-8.sslip.io

Free tier means there is no monthly bill, but there is also no paid support and no uptime promise. ARM means every program on the server needs an ARM build; Node, PostgreSQL and ClamAV all have one. The Atlas API is plain JavaScript run by Node 20+, so nothing has to be compiled for ARM, and Atlas uses no container images for its own code.

The Atlas website is not on this server. It is on Firebase Hosting (see [where Atlas runs](hosting-and-traffic-path.md#where-do-the-atlas-website-and-the-atlas-api-run)).

## What runs on the server for Atlas?

Five things on the server belong to Atlas or serve it directly:

1. The Atlas API: the Node app from `backend/`, run directly on the server (not in a container) by pm2 under the process name `learnhub-api`. Its production settings are in the server's own `backend/.env`, which is never committed.
2. PostgreSQL 14: the database server, outside the k3s cluster. Atlas has its own database in it, still named `learnhub`. The API connects to it on the same machine.
3. The uploads folder (`UPLOAD_DIR`): every uploaded study reviewer file, stored on the server's disk under a random name. A study reviewer is a database row plus a file, so both must be backed up together.
4. The front door for the API name: a route, a certificate and a Service in the k3s cluster, run by Envoy Gateway and cert-manager.
5. ClamAV: the virus scanner for uploads, installed as a service, with the API's `CLAMAV_MODE` set to `daemon` (checked 2026-10-31). The EICAR test upload that confirms it end to end is still to do.

The API folder on the server still carries the LearnHub name, like the pm2 process and the database. Not running on 2026-11-01: the nightly backup job (see [pending work](#what-server-work-is-still-pending-for-atlas)).

## What else shares the server with Atlas?

The same server runs the author's other projects and the tools that serve all of them:

- Rem RaaS, a RAG-as-a-service platform
- RemOps
- A portal
- A game-server panel
- Uptime and monitoring tools
- The shared machinery: k3s, Envoy Gateway, cert-manager and Flux

Atlas does not depend on any of these projects. It shares only two things with them: the front door (Envoy Gateway in k3s, which serves every project's names) and the PostgreSQL server (each project has its own database in it). Most of the other projects run as containers inside k3s; the Atlas API runs directly on the server under pm2.

## Why does sharing one server matter for Atlas?

Sharing one machine keeps Atlas free to run, but it has costs:

- Shared resources. The 2 CPU cores, the 12 GB of RAM and the disk serve every project. A busy neighbor can slow the Atlas API, and a full disk would break uploads and the database for everyone. The ClamAV service alone keeps about 1 to 1.5 GB of RAM in use.
- Shared database server. A restart, upgrade or overload of PostgreSQL affects Atlas and the other projects at the same time.
- Shared front door. A broken change to the Envoy Gateway setup, or k3s itself being down, makes the Atlas API unreachable even when the API process is fine.
- A single point of failure. There is no second server, no standby database and no automatic failover. If the server, its disk or the cloud region fails, the Atlas API is down until the machine is back, and data is only as safe as the last backup that was copied off the machine. On 2026-11-01 no backup job runs yet.

Not affected: the website files and sign-in live on Firebase, so they stay up when the server is down.

## What happens to Atlas when the server or the cluster is down?

The Atlas website still loads from Firebase Hosting, and Firebase sign-in still works, because neither runs on the server. Everything that needs the Atlas API stops:

- Whole server down, or the sslip.io name not resolving: the browser cannot connect, and the website shows "Could not reach Atlas. Check your internet connection and try again."
- k3s down: the front door is gone, so the API cannot be reached even though pm2 keeps it running.
- Only the API process down (crashed or restarting): the front door answers with its own HTTP 503 error. That error carries no CORS header, so the browser treats it like a failed connection, and the website shows the same "Could not reach Atlas" message.
- PostgreSQL down: the API still answers, but requests that need data fail with "Something went wrong on our side. Please try again." `GET /api/health` still says ok, because it does not check the database.

Planned restarts of the whole server on 2026-10-13 and 2026-10-16 showed that every service comes back by itself, and pm2 started the Atlas API again without help. In the 2026-10-13 test the sites were down for about two and a half minutes.

## What is k3s and how does Atlas use it?

Kubernetes is a system that keeps programs running in containers: you describe what should exist, and it starts, restarts and replaces those programs to match. k3s is a small, single-program version of Kubernetes that suits a single machine and ARM processors. On this server, k3s runs one cluster with one node, the server itself.

Most of the author's other projects run inside k3s. The Atlas API does not; it runs directly on the server under pm2. Atlas uses k3s only for its front door:

- Envoy Gateway and its Envoy proxy, which receive all HTTPS traffic for the API name
- cert-manager, which keeps the API's certificate valid
- ServiceLB, the load balancer built into k3s, which gives the front door the server's ports 80 and 443
- A Service with an EndpointSlice, which points the front door at the API process outside the cluster

Moving the Atlas API into k3s is listed as a possible later step and has not been done. Because the front door is in k3s, a k3s failure takes the Atlas API offline too.

## What are Envoy Gateway and cert-manager?

Envoy is a proxy: a program that accepts visitors' connections and forwards each request to the right program behind it, much like nginx. Envoy Gateway is the program that runs Envoy inside Kubernetes and configures it from standard Gateway API objects: a Gateway (which names and ports to accept, and which certificate each name uses) and HTTPRoutes (which name and path go where). Together they are the front door of the server. For the Atlas API, the front door ends HTTPS, redirects plain HTTP to HTTPS, sets a 60-second timeout and passes the visitor's address in `X-Forwarded-For`. It adds no rate limit and no size limit for Atlas.

cert-manager is a Kubernetes program that gets HTTPS certificates from a certificate authority and renews them automatically. For the Atlas API name it asks Let's Encrypt, proves control of the name over plain HTTP (the HTTP-01 check), stores the certificate where Envoy reads it, and renews it about 30 days before it expires. Before 2026-10-16 the certificate came from certbot on the server (see [the switch from nginx](hosting-and-traffic-path.md#what-changed-when-envoy-gateway-replaced-nginx-on-2026-10-16)).

## What are Flux and the Fleet repo?

Fleet is the author's private Git repository that describes everything the k3s cluster should run, including the front door. Flux is a program inside the cluster that reads Fleet's `main` branch and changes the cluster to match it. This way of working is called GitOps: a change to the cluster is a commit, and Fleet's history shows every change. Flux checks Fleet every minute, and a webhook from GitHub tells it about each push, so a merged change usually goes live within seconds.

The Atlas files in Fleet are in `infrastructure/configs/`:

- `learnhub-route.yaml`: the Service, EndpointSlice and HTTPRoute that send the API name to the API process
- `gateway.yaml`: the shared Gateway, with the listener for the API name
- `certificate-sslip.yaml`: the Let's Encrypt issuer and the certificate for the API name
- `client-traffic.yaml`: how Envoy decides who the visitor is

Flux does not deploy the Atlas API or the Atlas website. The API is copied to the server and restarted by hand, and the website is deployed with the Firebase CLI. Merging a pull request in the Atlas repository deploys nothing, but merging in Fleet changes the live front door at once (see [front-door changes](deployment.md#how-are-changes-to-the-atlas-front-door-deployed)).

## What does pm2 do for the Atlas API?

pm2 is a process manager for Node apps. On the Atlas server it:

- Runs the Atlas API as the process `learnhub-api`, from the backend folder.
- Restarts the API automatically if it crashes.
- Starts the API again after the server reboots (set up once with `pm2 save` and `pm2 startup`). This worked in the server restart tests of 2026-10-13 and 2026-10-16.
- Keeps the API's console output in log files.

Commands the maintainer uses on the server:

```
pm2 status
pm2 logs learnhub-api
pm2 restart learnhub-api
```

The API must run with `NODE_ENV=production`, which hides internal error details from API answers and stops the API from starting while the Auth emulator setting is still present. `pm2 restart` keeps the environment the process was started with. A restart takes a moment, during which the front door answers 503, and it resets the in-memory rate limits. The README's generic setup guide names the process `atlas-api`; the live server keeps `learnhub-api`.

## How does the maintainer reach the server and the database?

Only the maintainer (the author) has access to the Atlas server, and there are two ways in:

- SSH, an encrypted remote login, for work on the server: copying new backend code, running `npm` and `pm2` commands, and reading logs.
- A WireGuard VPN, an encrypted private network between the maintainer's computer and the server. From outside the server, the PostgreSQL database can be reached only through this VPN, for example to run migrations or admin queries.

Connection details, accounts and keys are deliberately not published. Students and other contributors never need server access: the website, the API and the README's local setup cover development. The Atlas Reports page (`/admin`) is part of the website and only manages reported study reviewers. Making someone an admin is a database update run by the maintainer, on the server or over the VPN (the README shows the `UPDATE users SET role = 'admin'` statement).

## How is the Atlas API monitored?

Monitoring for the Atlas API is basic:

- `GET /api/health` answers `{"status":"ok"}` without a login. It proves that the API process is running and that the front door, the certificate and the sslip.io name all work. It does not check the database, so it can say ok while PostgreSQL is down.
- pm2 shows whether `learnhub-api` is online and how often it restarted, and keeps its logs. The API logs its start lines, every 500 error with details, every upload blocked by the virus scan, and a warning when ClamAV is off in production.
- The server runs uptime and monitoring tools for all the author's projects. They run outside k3s on purpose, so they keep working when the cluster is broken. Which addresses they watch is not recorded in the Atlas repository; https://api.140-245-60-8.sslip.io/api/health is the address to watch for Atlas.

Not in the Atlas code: an error-tracking service, and a health check that includes the database.

## What server work is still pending for Atlas?

As of 2026-11-01 this server work is still to do:

1. Copy the 16 sample PDFs from `backend/db/seed-files/` into the server's uploads folder, and delete the files of the old study reviewers that the 2026-10-31 reset removed. Until then, opening or downloading a sample study reviewer's file on the live site answers 404 "The file for this study reviewer is missing."
2. Test the virus scan end to end: upload the harmless EICAR test file, which must be refused with 422. ClamAV is installed and `CLAMAV_MODE` is `daemon` (checked 2026-10-31), but this test has not been done.
3. Start backups: add the nightly cron line for `backend/scripts/backup.sh`, and copy the backups to another machine. No backup job and no off-machine copy exist yet.
4. Deploy the new search ranking once it is merged. The live API runs the code deployed on 2026-10-29, which does not have it.
5. Set `VITE_TAKEDOWN_EMAIL` before the next website build, so the Terms page shows a takedown inbox.
6. Restore the `hosting-redirect` folder in the maintainer's working copy, or drop the `old` target, before a full Firebase deploy.

Already done (checked 2026-10-31): ClamAV in daemon mode, and the limited database role `learnhub_api` with `MIGRATION_DATABASE_URL` set for the owner `learnhub_app`. The order and the commands are in [the remaining server steps](deployment.md#what-are-the-remaining-steps-for-the-live-atlas-server).
