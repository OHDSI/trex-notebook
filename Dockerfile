# Bakes the pre-built sibyl plugin into the trex image so the running container
# is self-contained (no bind-mounts). The strategus + network sub-plugins are
# SystemJS modules built into sibyl/public/plugins/ and ship inside sibyl's dist.
# Build everything on the host FIRST (sub-plugins, then sibyl):
#
#   cd plugins/strategus && npm run build && cd ../..   # -> sibyl/public/plugins/
#   cd plugins/network   && npm run build && cd ../..   # -> sibyl/public/plugins/
#   cd plugins/sibyl     && npm run build:trex          # copies public/ into dist/
#   docker compose up -d --build
#
# Base tag: sha-c5df9612 = OHDSI/trex's "cleanup (#35)". This is the newest
# trexsql build that actually SERVES HTTP under our setup — the later hades
# build (sha-8eaa659) boots and logs "started on 0.0.0.0:8001" but the worker
# never binds the port (broken). So we pin c5df9612 for a working stack.
# NOTE: this build does NOT include the hades extension (added in sha-8eaa659).
FROM ghcr.io/ohdsi/trexsql:sha-c5df9612216612296bbbdcd449543331ab41c761

# package.json carries the trex.ui.routes entry (path /sibyl, dir dist);
# trex serves the dist under /plugins/sibyl. The dist also contains
# plugins/<strategus|network>-plugin/ + config/plugins.json (the sibyl host
# loads those sub-plugins at runtime via SystemJS).
COPY plugins/sibyl/package.json /usr/src/plugins/sibyl/package.json
COPY plugins/sibyl/dist         /usr/src/plugins/sibyl/dist
