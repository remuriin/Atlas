// Inside the Oracle Cloud server: the k3s cluster that holds the front door, the
// programs that run straight on the server, and what Atlas keeps on its disk.
// Public-safe: no addresses, ports other than 80 and 443, paths or accounts.
AX.addView({
  id: 'vps',
  parent: 'deploy',
  group: 'Where it runs',
  related: ['deploy', 'path', 'backend', 'data'],
  type: 'nested',
  title: 'Inside the VPS',
  eyebrow: 'NESTED',
  purpose: 'What runs on the one server behind the Atlas API. The front door lives in a small k3s cluster; the API, the database and the virus scanner run straight on the server. Zoom in to open both.',
  desc: 'Nested view of the Atlas server: browsers reach ServiceLB and Envoy Gateway in the k3s cluster, where cert-manager and Flux also run; Envoy forwards to the Atlas API, which pm2 runs outside the cluster next to PostgreSQL 14, the ClamAV virus scanner and a planned backup job. The API reads and writes the uploads folder, and the maintainer reaches PostgreSQL over a WireGuard VPN.',
  grid: { x: 40, y: 72, col: 168, row: 96, gapX: 64, gapY: 48 },
  zones: [
    { id: 'z-vps', label: 'ORACLE CLOUD VPS', around: ['k3s', 'host', 'others', 'uploads', 'vpn'], pad: 20, term: 'vps' },
  ],
  nodes: [
    {
      id: 'visitors', at: [0, 0], nudge: [-8, 0], size: [152, 84], tag: 'USERS', treat: 'input',
      name: 'Browsers', sub: 'HTTPS on port 443', piece: 'concept:browser', opens: 'path', term: 'web-browser',
      lines: ['Plain HTTP on port 80 gets a', '301 to HTTPS'],
    },
    {
      id: 'k3s', at: [1, 0], span: [4, 1], size: [888, 100], max: 1, tag: 'K3S', treat: 'security',
      name: 'k3s cluster', sub: 'small Kubernetes; the front door lives here', piece: 'infra:envoy', opens: 'path', term: 'k3s',
      kids: {
        cols: 4, h: 56,
        items: [
          {
            id: 'slb', box: [272, 102, 168, 56], name: 'ServiceLB', sub: 'ports 80 + 443 of the server', subLod: 2, term: 'k3s', opens: 'path',
            lines: ['Built into k3s', 'Keeps each visitor’s address'],
          },
          {
            id: 'envoy', box: [504, 102, 168, 56], name: 'Envoy Gateway', sub: 'the front door', subLod: 2, treat: 'security',
            piece: 'infra:envoy', opens: 'path', term: 'envoy-gateway',
            lines: ['Ends HTTPS for the API name', '60 s timeout, X-Forwarded-For'],
          },
          {
            id: 'certs', box: [736, 102, 168, 56], name: 'cert-manager', sub: 'Let’s Encrypt certificate', subLod: 2, term: 'cert-manager', opens: 'deploy',
            lines: ['HTTP-01 check on port 80', 'Renews about 30 days early'],
          },
          {
            id: 'flux', box: [968, 102, 168, 56], name: 'Flux', sub: 'applies the Fleet repo', subLod: 2, term: 'flux', opens: 'p-deploy',
            lines: ['Checks Fleet every minute', 'A merge there is live at once'],
          },
        ],
      },
    },
    {
      id: 'host', at: [1, 1], span: [4, 1], size: [888, 100], max: 1, tag: 'HOST', treat: 'backend',
      name: 'Host processes', sub: 'run straight on the server, outside k3s', piece: 'app:backend', opens: 'backend', term: 'vps',
      kids: {
        cols: 4, h: 56,
        items: [
          {
            id: 'clam', box: [272, 246, 168, 56], name: 'ClamAV daemon', sub: 'virus scan for uploads', subLod: 2,
            piece: 'ext:clamav', opens: 'l-upload-checks', term: 'clamav',
            lines: ['Threat: 422. Scanner down: 503', 'Keeps about 1-1.5 GB RAM busy'],
          },
          {
            id: 'api', box: [504, 246, 168, 56], name: 'pm2 + Atlas API', sub: 'process learnhub-api', subLod: 2, treat: 'focal',
            piece: 'app:backend', opens: 'backend', term: 'pm2',
            lines: ['Restarts on crash and reboot', 'Runs with NODE_ENV=production'],
          },
          {
            id: 'pg', box: [736, 246, 168, 56], name: 'PostgreSQL 14', sub: 'shared, own Atlas database', subLod: 2, treat: 'store',
            piece: 'store:postgres', opens: 'data', term: 'postgresql',
            lines: ['Only server, pods and VPN', 'API role learnhub_api: rows only'],
          },
          {
            id: 'backup', box: [968, 246, 168, 56], name: 'Backup cron (planned)', sub: 'nightly backup.sh', subLod: 2, treat: 'optional',
            piece: 'script:backup.sh', opens: 'db-ops', term: 'postgresql',
            lines: ['Database dump + uploads archive', 'Keeps 14 nights'],
          },
        ],
      },
    },
    {
      id: 'uploads', at: [2, 2], size: [168, 84], tag: 'FILES', treat: 'store',
      name: 'Uploads folder', sub: 'UPLOAD_DIR on the disk', piece: 'store:uploads', opens: 'f-file', term: 'uploads-folder',
      lines: ['Random hex file names', 'Row + file = one reviewer'],
    },
    {
      id: 'vpn', at: [3, 2], size: [168, 84], tag: 'VPN', treat: 'security',
      name: 'Maintainer VPN', sub: 'WireGuard', opens: 'db-ops', term: 'wireguard',
      lines: ['The only way into PostgreSQL', 'from outside the server'],
    },
    {
      id: 'others', at: [1, 2], size: [168, 112], tag: 'NOT ATLAS', treat: 'external',
      name: 'Other services', sub: 'Rem RaaS, RemOps, a portal, a game-server panel, uptime and monitoring tools', term: 'vps',
      lines: ['Not Atlas. They share the front', 'door and the PostgreSQL server'],
    },
  ],
  edges: [
    { from: 'visitors', to: 'k3s', style: 'link', max: 1 },
    { from: 'k3s', to: 'host', label: 'FORWARDS', style: 'accent', max: 1 },
    { from: 'host', to: 'uploads', label: 'READ/WRITE', style: 'muted', max: 1 },
    { from: 'vpn', to: 'host', label: 'MAINTENANCE', dash: true, max: 1 },
    { from: 'visitors', to: 'slb', style: 'link', lod: 2 },
    { from: 'slb', to: 'envoy', style: 'link', lod: 2 },
    { from: 'certs', to: 'envoy', label: 'CERT', style: 'muted', lod: 2 },
    { from: 'envoy', to: 'api', label: 'FORWARDS', style: 'accent', lod: 2 },
    { from: 'api', to: 'pg', label: 'SQL', style: 'muted', lod: 2 },
    { from: 'api', to: 'clam', label: 'SCAN', style: 'muted', lod: 2 },
    { from: 'backup', to: 'pg', label: 'DUMP', dash: true, lod: 2 },
    { from: 'api', to: 'uploads', label: 'READ/WRITE', style: 'muted', lod: 2 },
    { from: 'vpn', to: 'pg', label: 'MAINTENANCE', dash: true, lod: 2 },
  ],
  notes: [
    { at: [4, 2], w: 168, lod: 3, text: 'Still to do on the server: the nightly backup job with a copy on another machine, and the 16 sample PDFs in the uploads folder (their files answer 404 until then).' },
  ],
});
