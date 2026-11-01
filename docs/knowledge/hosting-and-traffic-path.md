# Where Atlas runs and how traffic reaches it

Atlas runs in two places. The website that students open is a set of built files on Firebase Hosting at https://atlas-f2757.web.app. The Atlas API, its PostgreSQL database and the uploaded study reviewer files live on one rented virtual server (a VPS) and are reached at https://api.140-245-60-8.sslip.io. This page explains both halves, the path a request takes to the Atlas API, and how HTTPS certificates, visitor addresses, timeouts and size limits work on the way. Facts are as of 2026-11-01.

## Where do the Atlas website and the Atlas API run?

The Atlas website is the React app in `frontend/`. `npm run build` turns it into plain files in `frontend/dist`, and Firebase Hosting serves those files from Google's servers. No Atlas code runs at Firebase. The Firebase project (id `learnhub-ea4291`) provides only Hosting and Firebase Authentication, which owns accounts, passwords and password-reset emails. Firestore, Cloud Storage and Cloud Functions are not used, so the free Spark plan is enough.

The Atlas API is the Express app in `backend/`. It runs on one Oracle Cloud free-tier ARM server (Ubuntu LTS, 2 CPU cores, 12 GB RAM) that the author shares with other projects. The same server holds PostgreSQL 14 and the uploads folder on its disk. See [what runs on the server](vps-and-shared-infrastructure.md#what-runs-on-the-server-for-atlas).

The browser talks to both halves: to Firebase for the website files and for signing in, and to the Atlas API for everything else (the feed, uploads, upvotes, saved items, notes, flashcards and reports). Firebase never calls the Atlas API. The API checks each sign-in token by itself, with Google's public keys.

## How is the Atlas website set up on Firebase Hosting?

`firebase.json` defines two Hosting targets, and `.firebaserc` connects each target to a site in the Firebase project `learnhub-ea4291`:

- Target `app` is the site `atlas-f2757` (https://atlas-f2757.web.app). It serves `frontend/dist`.
- Target `old` is the site `learnhub-ea4291`, the project's default site from before the rename. It only redirects visitors (see [the old LearnHub address](#what-happens-at-the-old-learnhub-address)).

The `app` target has one rewrite: any address that is not a real file gets `/index.html`. That is how a single-page app (SPA) works on static hosting. The browser always receives the same page, and React Router reads the address (`/browse`, `/terms`, `/saved` and so on) and shows the right screen. Without the rewrite, opening a link such as https://atlas-f2757.web.app/browse directly would give a 404 error.

Firebase Hosting also handles HTTPS for the `web.app` addresses by itself, with certificates that Firebase issues and renews. The Atlas author manages nothing about the website's certificate.

## How does browser caching work for the Atlas website?

`firebase.json` sets two caching rules for the Atlas website:

- Files under `/assets/` get `Cache-Control: public, max-age=31536000, immutable`, so a browser keeps them for one year without asking again. That is safe because Vite puts a content hash in every asset file name: a new build produces new names, and the old cached files are no longer requested.
- `/index.html` gets `Cache-Control: no-cache`, so a browser must check for a newer version before reusing it.

A check of the live site on 2026-11-01 found a gap. The no-cache rule matches only the address `/index.html` itself. Page addresses such as `/` and `/browse`, which serve the same `index.html` without naming it, came back with Firebase's default `Cache-Control: max-age=3600`, because Firebase matches header rules against the address the browser asked for, not against the file that was served. So after a deploy, a browser that opened Atlas within the last hour can show the previous version for up to one hour when Atlas is opened again. Pressing reload fetches the page again and gets the new version. A header rule that also covers page addresses such as `/` and `/browse` would close the gap. It has not been added.

## What happens at the old LearnHub address?

Atlas was called LearnHub until 2026-10-23. The old website, https://learnhub-ea4291.web.app, is the default Hosting site of the Firebase project, and Firebase does not allow deleting a project's default site. It stays as the `old` target in `firebase.json`, with one redirect rule: every address answers with a permanent redirect (HTTP 301) to the same path on https://atlas-f2757.web.app. A check on 2026-11-01 confirmed that the path and the query string survive (for example `/browse?strand=STEM`), and that the default site's second name, learnhub-ea4291.firebaseapp.com, redirects the same way.

Firebase applies redirects before it looks for files, so visitors never see the page in `hosting-redirect/index.html`. The folder exists because every Hosting site needs a folder of files to deploy. Its page says "LearnHub is now Atlas" and links to the new site, as a fallback if the redirect rule is ever removed. Firebase's reserved pages under `/__/` come before redirects, which keeps Google sign-in working on the old domain.

On 2026-11-01 the `hosting-redirect` folder was deleted in the maintainer's local working copy, although it is still in the repository. Restore it, or remove the `old` target, before a plain `firebase deploy` or `firebase deploy --only hosting:old`. The usual website deploy, `firebase deploy --only hosting:app`, does not need it.

## Why does Google sign-in still use the old LearnHub Firebase domain?

`frontend/.env.production` sets `VITE_FIREBASE_AUTH_DOMAIN=learnhub-ea4291.firebaseapp.com`. The auth domain is where Firebase runs its sign-in helper page. "Continue with Google" opens that page in a popup (or, when the browser blocks popups, as a full-page redirect), Google checks the account, and the helper hands the result back to Atlas.

Google only sends a sign-in back to addresses listed on the Firebase project's OAuth client, and the helper page on learnhub-ea4291.firebaseapp.com is on that list. When the auth domain was switched to atlas-f2757.web.app during the rename, Google sign-in failed with `redirect_uri_mismatch`, so the old domain was kept on purpose. Visitors see it only in the address bar of the Google popup.

Two settings must stay in place for Google sign-in on Atlas: atlas-f2757.web.app must stay on the Authorized domains list in the Firebase console (Authentication, Settings), and the auth domain must stay one that Google accepts. Email-and-password sign-in does not use the helper page.

## Why does the Atlas API use an sslip.io address?

The Atlas API needs a hostname that browsers can look up and that a normal HTTPS certificate can be issued for, and no domain was bought for Atlas. sslip.io is a free public DNS (name lookup) service: any name that contains an IP address written with dashes resolves to that address. The name api.140-245-60-8.sslip.io therefore leads straight to the Atlas server, and Let's Encrypt can issue a normal certificate for it.

What this means for Atlas:

- No domain purchase and no DNS settings were needed.
- Atlas depends on sslip.io answering name lookups. If sslip.io stopped working, browsers could not find the Atlas API, while the website on Firebase would still load.
- The name changes if the server's address ever changes.
- Atlas API traffic passes through no CDN and no tunnel: browsers connect straight to the server.

Moving the Atlas API to a real domain later means: pointing the domain at the server, adding the name to the front door in the Fleet repo (listener, certificate and route), changing `VITE_API_URL` in `frontend/.env.production`, and rebuilding and redeploying the website. `FRONTEND_ORIGIN` on the server changes only if the website's own address changes.

## How does a request reach the Atlas API?

In plain words, a request from the Atlas website, for example "load the feed", travels like this:

1. The browser looks up api.140-245-60-8.sslip.io, gets the server's address from sslip.io, and opens an HTTPS connection on port 443. Plain HTTP on port 80 is answered with a redirect to HTTPS.
2. k3s, the small Kubernetes system on the server, receives the connection and hands it to the front door.
3. The front door is Envoy, a proxy program run by Envoy Gateway inside k3s. It decrypts the HTTPS connection with the certificate for the API name, adds the visitor's address to the `X-Forwarded-For` header, and picks the route for that name.
4. The route points back out of the cluster to the Atlas API process, which runs directly on the server under pm2.
5. The Atlas API checks the sign-in token, applies its rate limits, and reads or writes PostgreSQL 14 on the same server. File requests read the uploads folder on disk.
6. The answer goes back the same way, and the front door encrypts it for the browser.

The front door is shared with the author's other projects, but each name has its own route. The Atlas API itself is not inside k3s. The [technical version](#which-kubernetes-objects-carry-a-request-to-the-atlas-api) names each object.

## Which Kubernetes objects carry a request to the Atlas API?

The front-door objects for the Atlas API are files in the author's private Fleet repo, under `infrastructure/configs/`, applied by Flux (see [Flux and Fleet](vps-and-shared-infrastructure.md#what-are-flux-and-the-fleet-repo)):

1. ServiceLB, the load balancer built into k3s, puts the Envoy service on the server's own ports 80 and 443. That service uses `externalTrafficPolicy: Local`, which keeps each visitor's real source address.
2. The Gateway in `gateway.yaml` has a listener on port 443 for the name api.140-245-60-8.sslip.io, with the certificate from cert-manager. Only routes in the front door's own namespace may attach to it, so no other project can claim the name. The port 80 listener answers every name with a 301 to HTTPS (`redirect-to-https.yaml`).
3. An HTTPRoute in `learnhub-route.yaml` matches the API name and sends every path to a Service named after LearnHub, with a 60-second request timeout.
4. That Service has no selector, so Kubernetes does not look for pods. A hand-written EndpointSlice next to it points at the server itself, where the API process listens. This is the standard way to give a program outside the cluster a name inside it.
5. Envoy connects straight to that address, and the Node process run by pm2 answers.

`certificate-sslip.yaml` holds the cert-manager objects for the name, and `client-traffic.yaml` sets how Envoy decides who the visitor is. No rate limit, size limit or header policy is attached to the Atlas route.

## What does the Atlas API contact on the internet?

The Atlas API makes only two kinds of outgoing calls, both over HTTPS:

- Google's public keys. `firebase-admin` (set up in `backend/src/config/firebaseAdmin.js`) downloads Google's public signing keys and checks every Firebase ID token against them. Only the project id is configured, and no service-account key file is stored on the server. The keys are cached, so this is not one download per request.
- Google Gemini. Making flashcards sends the study material from the server to the Gemini API (`backend/src/utils/gemini.js`): PDFs and images as the file itself, text files as text, and Word or PowerPoint files as their extracted text. `GEMINI_API_KEY` exists only in the server's `backend/.env`, never in the website. Without a key, only flashcards stop working.

Firebase Authentication works between the browser and Firebase: sign-up, login, Google sign-in and password-reset emails never pass through the Atlas API, and the API never sees a password. The API receives only the signed ID token that the browser sends with each request.

## How do HTTPS certificates work for the Atlas API?

The certificate for api.140-245-60-8.sslip.io comes from Let's Encrypt, a free certificate authority, and is managed by cert-manager, a program in the k3s cluster that requests certificates and renews them before they run out.

Let's Encrypt needs proof that the requester controls the name. The usual proof for an owned domain, a DNS record, is impossible here, because the author does not control the sslip.io domain. cert-manager therefore uses the HTTP-01 check: Let's Encrypt asks for a special file over plain HTTP on port 80, and cert-manager answers it through a short-lived route on the front door's port 80 listener. That route has an exact path, so it wins over the redirect to HTTPS.

The certificate in use on 2026-11-01 was issued on 2026-10-16, the day the front door moved to Envoy Gateway, and is valid for about 90 days. cert-manager renews it by itself well before it expires (about 30 days ahead), and nothing is copied by hand. The certificate is kept as a Kubernetes Secret that the Gateway's listener for the API name reads. The Atlas API also sends a `Strict-Transport-Security` header (set by helmet), which tells browsers to use only HTTPS for the API.

The website's certificates are separate: Firebase Hosting issues and renews them for the `web.app` addresses.

## How does the Atlas API know each visitor's address?

The Atlas API counts its rate limits per visitor address, so it must see the visitor's real address, not the front door's. Three pieces make that work:

1. ServiceLB with `externalTrafficPolicy: Local` passes each connection to Envoy with the visitor's own source address.
2. Envoy adds that address to the end of the `X-Forwarded-For` header when it forwards the request to the API. Atlas traffic passes through no other proxy, CDN or tunnel.
3. The server's `backend/.env` must have `TRUST_PROXY=true`. Then `backend/src/app.js` runs `app.set('trust proxy', 1)`: Express trusts exactly one proxy and takes the last address in `X-Forwarded-For` as `req.ip`. An address that a visitor writes into their own `X-Forwarded-For` header sits further left and is ignored.

`req.ip` is the key for the general limit (600 requests per 15 minutes) and the write limit (120 changes per 15 minutes). Without `TRUST_PROXY=true`, every visitor would seem to come from the front door, and all of them would share one allowance. If a second proxy, such as a CDN, were ever put in front, the code would have to trust two hops instead of one.

The comment in `backend/src/app.js` and the `TRUST_PROXY` descriptions in the README and in `backend/.env.example` still say "nginx". The mechanism is the same with Envoy.

## What timeouts and size limits apply on the way to the Atlas API?

These limits apply to requests on their way to the Atlas API:

- Front door timeout: the Atlas route gives the API 60 seconds to answer. Envoy's own default is 15 seconds; 60 matches what nginx allowed before 2026-10-16. A slower answer becomes a 504 error from Envoy. That error carries no CORS header, so the browser cannot read it, and the website shows "Could not reach Atlas. Check your internet connection and try again."
- Front door size limit: none. Envoy has no request-body limit for Atlas, so the API's own limits decide.
- Upload size: one file per request, at most `MAX_FILE_SIZE_MB` (10 MB by default). multer, the upload library used in `backend/src/middleware/upload.js`, stops reading at the limit, and the API answers 413 "That file is too large."
- JSON bodies (display names, notes, flashcard requests): at most 512 KB (`express.json` in `backend/src/app.js`).
- Feed pages: at most 50 study reviewers per request (12 by default).
- Virus scan: the API waits up to 30 seconds for the ClamAV service in `daemon` mode, which the live server is set to, or up to 120 seconds for the `clamscan` command.
- Gemini: the API waits up to 120 seconds for flashcards, longer than the front door's 60. A flashcard set that took more than 60 seconds would show an error even if Gemini finished. Whether real requests come close has not been measured.

Rate limits are applied only by the Atlas API itself, never by the front door.

## Why is the Atlas database not reachable from the internet?

PostgreSQL 14 runs directly on the server, outside the k3s cluster, and the author's other projects use the same database server. It accepts connections from only three places: the server itself, the cluster's internal pod network (for other projects' backends), and the author's private WireGuard VPN. It never accepts connections from the internet.

The Atlas API runs on the same machine, so it connects locally, and no database port has to be open to the world. The maintainer reaches the database through the VPN, for example to run `npm run db:migrate` or to make an admin. A VPN (virtual private network) is an encrypted private link between the maintainer's computer and the server.

Keeping the database private removes the most direct attack: nobody on the internet can even try a database password. Two more layers protect Atlas data:

- The Atlas API process is not reachable directly either. Visitors reach it only through the front door; a direct connection attempt from outside timed out on 2026-11-01.
- The limited `learnhub_api` role is meant for the API: it can only read and change rows, so a break-in through an API connected as that role could not drop tables. The role exists on the live server (checked 2026-10-31).

## What changed when Envoy Gateway replaced nginx on 2026-10-16?

Until 2026-10-16, nginx on the server was the front door for the Atlas API, with a certificate from certbot. On that day the author moved the front door of every site into the k3s cluster, built on the Kubernetes Gateway API and run by Envoy Gateway. For Atlas this changed:

1. The front door's settings are files in the Fleet repo, applied by Flux, instead of nginx files edited on the server.
2. The certificate is made and renewed by cert-manager in the cluster instead of certbot on the server.
3. Envoy's default timeout is 15 seconds, so the Atlas route sets 60 seconds to match nginx.
4. nginx's 12 MB body limit for the API was not carried over. Envoy has no body limit for Atlas; the API's own 10 MB file limit and 512 KB JSON limit apply.
5. Envoy adds the visitor's address to `X-Forwarded-For`, as nginx did, so `TRUST_PROXY=true` with one trusted proxy still fits.
6. The Atlas API stayed on pm2. Envoy sends Atlas traffic back out of the cluster to it.
7. The Atlas API now depends on k3s: if the cluster is down, nobody can reach the API, even while pm2 keeps it running.

nginx still runs on the server, but only for an unrelated project. The README's "Current live deployment" section still says the API is "behind nginx"; that wording is outdated. The README's "Deploying to a VPS" guide also uses nginx. That guide remains a valid way to host Atlas on a new server, but it is not how the live API is served.
