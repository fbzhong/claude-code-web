# Building and Using Custom Container Image

## Current Default Image
By default, Claude Web uses the base `ubuntu:22.04` image and installs development tools on first container creation.

## Using the Custom Development Image

We provide a pre-configured development image with all necessary tools pre-installed for better performance.

### 1. Build the Custom Image

```bash
# Build the development container image
docker build -t claude-web-dev:latest docker/dev-container/
```

This image includes:
- Ubuntu 22.04 base
- Development tools: git, vim, nano, build-essential
- Programming languages: Python 3, Node.js, npm
- Additional tools: yarn, pnpm, TypeScript, Jupyter
- Pre-configured developer user with sudo access

### 2. Configure Backend to Use Custom Image

Option A: Update your `.env` file:
```bash
CONTAINER_IMAGE=claude-web-dev:latest
```

Option B: Set environment variable:
```bash
export CONTAINER_IMAGE=claude-web-dev:latest
```

### 3. Restart Backend

After changing the image configuration, restart the backend:
```bash
cd backend && pnpm run dev
```

## Advantages of Custom Image

1. **Faster container creation** - No need to install tools on first run
2. **Consistent environment** - All users get the same pre-configured setup
3. **Better resource usage** - Shared base layers between containers
4. **Version control** - Image definition is tracked in git

## Customizing the Image

To add more tools or change the configuration:

1. Edit `docker/dev-container/Dockerfile`
2. Rebuild the image: `docker build -t claude-web-dev:latest docker/dev-container/`
3. Restart the backend to use the new image

## Verifying Image Usage

Check backend logs when creating a new session:
```
[ContainerManager] Using container image: claude-web-dev:latest
```

Or check running containers:
```bash
docker ps --format "table {{.Names}}\t{{.Image}}"
```