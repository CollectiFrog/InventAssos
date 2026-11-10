# Development image for the `app` service of compose.yaml and for the Dev Container.
# The source is mounted at run time: nothing is copied here. Production uses ../Dockerfile.
# Debian rather than Alpine: it ships git, make and a shell for the Dev Container.
FROM node:24-bookworm

# Named volumes take the owner of the directory they are mounted on: create them for `node`, so
# npm ci in the container never writes Linux binaries into the host's node_modules.
RUN mkdir -p /workspace/node_modules /workspace/docs/site/node_modules \
  && chown -R node:node /workspace

USER node
WORKDIR /workspace
ENV IN_APP_CONTAINER=1
