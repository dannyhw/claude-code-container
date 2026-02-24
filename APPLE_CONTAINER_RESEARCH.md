# Apple Container Tool: Comprehensive Research Document

## Table of Contents

1. [Overview](#overview)
2. [Requirements and Installation](#requirements-and-installation)
3. [Architecture and Technical Design](#architecture-and-technical-design)
4. [Building Images (Dockerfile/Containerfile)](#building-images)
5. [Running Containers](#running-containers)
6. [Networking and Port Forwarding](#networking-and-port-forwarding)
7. [Volume Mounts and Persistent Storage](#volume-mounts-and-persistent-storage)
8. [Pushing and Pulling Images](#pushing-and-pulling-images)
9. [Complete CLI Command Reference](#complete-cli-command-reference)
10. [Limitations vs Docker](#limitations-vs-docker)
11. [Gotchas and Known Issues](#gotchas-and-known-issues)

---

## Overview

Apple's `container` is an open-source tool written in Swift for creating and running Linux containers as **lightweight virtual machines** on macOS. It was announced at WWDC 2025 and is optimized for Apple Silicon.

Unlike Docker (which runs all containers inside a single shared Linux VM), Apple's `container` creates a **separate lightweight VM for each container**. This provides VM-level isolation for every container while still achieving sub-second startup times.

The tool produces and consumes **standard OCI-compatible container images**, meaning images built with it can run anywhere, and images from Docker Hub or any OCI registry can be pulled and run.

**Two components exist:**
- **`container`** -- The CLI tool (this document's focus)
- **`containerization`** -- The underlying Swift package/framework at [github.com/apple/containerization](https://github.com/apple/containerization)

**Project status:** Pre-1.0, under active development. Stability guaranteed only within patch versions (e.g., 0.1.1 to 0.1.2). Minor releases may include breaking changes.

---

## Requirements and Installation

### System Requirements

- **Hardware:** Mac with Apple Silicon (M1 or later)
- **OS:** macOS 26 ("Tahoe") or later
  - macOS 15 (Sequoia) has partial support but with significant networking limitations (no container-to-container communication)
  - The maintainers will not address issues that cannot be reproduced on macOS 26

### Installation

1. Download the signed `.pkg` installer from the [GitHub releases page](https://github.com/apple/container/releases)
2. Double-click the package and follow the prompts
3. Enter your administrator password when requested
4. Start the service:

```bash
container system start
```

The first start will prompt you to install a Linux kernel.

### Uninstallation

```bash
# Remove everything including user data
/usr/local/bin/uninstall-container.sh -d

# Remove tool but keep user data (images, volumes, etc.)
/usr/local/bin/uninstall-container.sh -k
```

### Upgrading

```bash
container system stop
/usr/local/bin/uninstall-container.sh -k
# Then install the new version
```

---

## Architecture and Technical Design

### How It Works Under the Hood

```
CLI (container) --> API Server (container-apiserver, launchd agent)
                        |
                        +--> container-core-images (XPC: image management, local storage)
                        +--> container-network-vmnet (XPC: virtual networking via vmnet)
                        +--> container-runtime-linux (per-container VM management)
```

- **Virtualization Framework:** Uses Apple's macOS Virtualization.framework to manage VMs
- **Networking:** Uses the vmnet framework for virtual networking
- **One VM per container:** Each container runs in its own lightweight VM with a minimal Linux kernel, minimal root filesystem, and lightweight init system
- **Security model:** Each container gets full VM-level isolation (not just namespace/cgroup isolation like Docker)
- **Credential storage:** Uses macOS Keychain for registry credentials
- **Service management:** Uses launchd for service lifecycle
- **Logging:** Uses macOS unified logging system

### OCI Compatibility

The tool **consumes and produces standard OCI images**. Images built locally are guaranteed to run on any OCI-compatible platform. You can:
- Pull images from Docker Hub, GHCR, or any OCI registry
- Push images you build to those registries
- Use standard Dockerfile/Containerfile syntax

---

## Building Images

### Containerfile/Dockerfile Support

Apple's `container` uses **BuildKit** under the hood for image building. It supports standard **Dockerfile** and **Containerfile** syntax. If no `-f/--file` flag is specified, it looks for `Dockerfile` first, then falls back to `Containerfile`.

Standard OCI/Docker instructions are supported: `FROM`, `RUN`, `COPY`, `ADD`, `WORKDIR`, `CMD`, `ENTRYPOINT`, `ENV`, `EXPOSE`, `ARG`, `LABEL`, multi-stage builds, etc.

### Example Dockerfile

```dockerfile
FROM docker.io/python:alpine
WORKDIR /content
RUN apk add curl
RUN echo '<!DOCTYPE html><html><body><h1>Hello</h1></body></html>' > index.html
CMD ["python3", "-m", "http.server", "80", "--bind", "0.0.0.0"]
```

### Build Commands

**Basic build:**
```bash
container build --tag my-image --file Dockerfile .
```

**Multi-architecture build:**
```bash
container build --arch arm64 --arch amd64 --tag registry.example.com/user/web-test:latest --file Dockerfile .
```

**Build with build arguments:**
```bash
container build --build-arg MY_VAR=value --tag my-image .
```

**Build a specific target in a multi-stage Dockerfile:**
```bash
container build --target builder --tag my-image .
```

**Build without cache:**
```bash
container build --no-cache --tag my-image .
```

### Build Command -- Full Syntax

```
container build [options] [context-dir]
```

| Flag | Description |
|------|-------------|
| `-a/--arch` | Target architecture(s) (e.g., arm64, amd64) |
| `--build-arg` | Build-time variables |
| `-c/--cpus` | CPUs for the build VM |
| `-f/--file` | Path to Dockerfile/Containerfile |
| `-l/--label` | Image labels |
| `-m/--memory` | Memory for the build VM |
| `--no-cache` | Disable build cache |
| `-o/--output` | Output destination |
| `--os` | Target OS |
| `--platform` | Target platform (e.g., linux/arm64) |
| `--progress` | Progress output type |
| `--pull` | Always pull base images |
| `-q/--quiet` | Suppress build output |
| `-t/--tag` | Image name and tag |
| `--target` | Multi-stage build target |

### Builder Management

The builder is a separate BuildKit VM. Default resources: 2 GiB RAM, 2 CPUs.

```bash
# Start with custom resources
container builder start --cpus 8 --memory 32g

# Check status
container builder status

# Restart with different resources
container builder stop
container builder delete
container builder start --cpus 8 --memory 32g
```

### Disable Rosetta for Builds

By default, Rosetta may be used for cross-architecture builds. To disable:

```bash
container system property set build.rosetta false
```

---

## Running Containers

### Basic Run

```bash
# Run interactively
container run -it ubuntu:latest /bin/bash

# Run detached (background)
container run -d --name my-server --rm nginx:latest

# Run with auto-cleanup
container run --rm ubuntu:latest echo "hello world"
```

### Run Command -- Full Syntax

```
container run [options] <image> [arguments ...]
```

| Flag | Description |
|------|-------------|
| `-i/--interactive` | Keep STDIN open |
| `-t/--tty` | Allocate a pseudo-TTY |
| `-d/--detach` | Run in background |
| `--name` | Assign a name |
| `--rm` | Auto-remove when stopped |
| `-e/--env` | Set environment variables |
| `--env-file` | Read env vars from file |
| `-u/--user` | Username or UID |
| `--uid` | User ID |
| `--gid` | Group ID |
| `-w/--workdir` | Working directory |
| `-c/--cpus` | Number of CPUs (default: 4) |
| `-m/--memory` | Memory limit (default: 1 GiB) |
| `-p/--publish` | Port mapping (host:container) |
| `-v/--volume` | Bind mount a volume |
| `--mount` | Mount with key=value syntax |
| `--network` | Network to connect to |
| `--dns` | Custom DNS server |
| `--entrypoint` | Override entrypoint |
| `--init` | Run an init process |
| `--init-image` | Custom init image |
| `-k/--kernel` | Custom Linux kernel |
| `-l/--label` | Container labels |
| `--read-only` | Read-only root filesystem |
| `--rosetta` | Enable Rosetta translation |
| `--ssh` | Forward SSH agent socket |
| `-a/--arch` | Target architecture |
| `--os` | Target OS |
| `--platform` | Target platform |
| `--cidfile` | Write container ID to file |
| `--scheme` | Registry scheme |
| `--virtualization` | Enable nested virtualization (M3+) |

### Resource Limits

```bash
# Custom CPU and memory
container run --rm --cpus 8 --memory 32g ubuntu:latest

# Defaults: 4 CPUs, 1 GiB RAM
```

### Container Lifecycle Management

```bash
# Create without starting
container create --name my-app ubuntu:latest /bin/bash

# Start a created/stopped container
container start --attach --interactive my-app

# Stop gracefully (with timeout)
container stop --time 30 my-app

# Kill immediately
container kill my-app

# Remove
container delete my-app
# Or force-remove
container delete --force my-app

# List containers
container list --all
container ls -a

# Inspect
container inspect my-app

# Execute command in running container
container exec my-app ls /content
container exec -it my-app sh

# View logs
container logs my-app
container logs --follow my-app
container logs --boot my-app    # VM boot logs

# Resource stats (live streaming)
container stats
container stats my-app

# Resource stats (snapshot)
container stats --no-stream my-app
container stats --format json --no-stream my-app | jq

# Prune stopped containers
container prune
```

### Nested Virtualization (M3+ only)

```bash
container run --name nested --virtualization \
  --kernel /path/to/kernel --rm ubuntu:latest sh -c "dmesg | grep kvm"
```

---

## Networking and Port Forwarding

### Architecture

Containers attach to vmnet-managed virtual networks. On macOS 26, each container gets its own IP address on a virtual network managed by the `container-network-vmnet` XPC helper. Default subnet is typically `192.168.64.1/24`.

### Port Forwarding

Format: `[host-ip:]host-port:container-port[/protocol]`

```bash
# Map host port 8080 to container port 8000 on localhost (IPv4)
container run -d --rm -p 127.0.0.1:8080:8000 node:latest npx http-server -a :: -p 8000

# IPv6 port forwarding
container run -d --rm -p '[::1]:8080:8000' node:latest npx http-server -a :: -p 8000

# Simple port mapping (binds to localhost by default)
container run -d --rm -p 8080:80 nginx:latest
```

**Important:** Unlike Docker, you do NOT always have to do explicit port mapping. On macOS 26 with user-defined networks, containers get their own IPs and can be accessed directly.

### User-Defined Networks

```bash
# Create a network
container network create my-network

# Create with custom subnets
container network create my-network --subnet 192.168.100.0/24 --subnet-v6 fd00:1234::/64

# Run container on a specific network
container run -d --name web --network my-network --rm my-image

# Custom MAC address
container run --network default,mac=02:42:ac:11:00:02 ubuntu:latest

# List networks
container network ls

# Inspect
container network inspect my-network

# Delete
container network delete my-network

# Prune unused networks
container network prune
```

### Container-to-Container Communication

On macOS 26, containers on the same user-defined network can communicate with each other. **This does NOT work on macOS 15.**

### Accessing Host Services from a Container (host.container.internal)

To access services running on the host from within a container:

```bash
# Create DNS entry (requires sudo)
sudo container system dns create host.container.internal

# Then from within the container:
curl http://host.container.internal:8000
```

You can also create custom local DNS domains:

```bash
sudo container system dns create test
container system property set dns.domain test
# Containers can now resolve *.test domains
```

### Configuring Default Subnets

```bash
container system property set network.subnet 192.168.100.1/24
container system property set network.subnetv6 fd00:abcd::/64
```

### SSH Agent Forwarding

```bash
container run -it --rm --ssh alpine:latest sh
```

This automatically mounts and configures `SSH_AUTH_SOCK` inside the container. The socket path updates automatically if you log out and back in.

### macOS 15 Networking Limitations

- No container-to-container communication
- Single network only (`container network` commands are unavailable)
- Potential subnet mismatches between vmnet and network helper requiring manual configuration

---

## Volume Mounts and Persistent Storage

### Bind Mounts (Host Directory to Container)

**Using `--volume` flag:**

```bash
container run --volume ${HOME}/Desktop/assets:/content/assets \
  docker.io/python:alpine ls -l /content/assets
```

**Using `--mount` flag (key=value syntax):**

```bash
container run --mount source=${HOME}/Desktop/assets,target=/content/assets \
  docker.io/python:alpine ls -l /content/assets
```

Relative paths are supported for `--volume`.

### Named Volumes

```bash
# Create a named volume
container volume create my-data

# Create with size limit
container volume create --opt size=10g my-data

# Use in a container
container run -v my-data:/data ubuntu:latest

# List volumes
container volume ls

# Inspect
container volume inspect my-data

# Delete
container volume delete my-data

# Delete all volumes
container volume delete --all

# Prune unused volumes
container volume prune
```

### Important Gotcha: Anonymous Volumes and --rm

Unlike Docker, **anonymous volumes do NOT auto-cleanup** when using `--rm`. You must manually delete them with `container volume prune` or `container volume delete`.

---

## Pushing and Pulling Images

### Pulling Images

```bash
# Pull from Docker Hub (default registry)
container image pull ubuntu:latest

# Pull specific architecture
container image pull --arch arm64 ubuntu:latest

# Pull with platform
container image pull --platform linux/amd64 ubuntu:latest
```

### Pushing Images

```bash
# Login to registry
container registry login registry.example.com

# Login with password from stdin
echo $TOKEN | container registry login --username user --password-stdin registry.example.com

# Tag an image
container image tag my-local-image registry.example.com/user/my-image:latest

# Push
container image push registry.example.com/user/my-image:latest

# List authenticated registries
container registry list

# Logout
container registry logout registry.example.com
```

### Image Management

```bash
# List local images
container image list
container image ls --verbose

# Inspect image details
container image inspect my-image | jq

# Save image to tar archive
container image save --output my-image.tar my-image:latest

# Load image from tar archive
container image load --input my-image.tar

# Delete image
container image delete my-image:latest

# Delete all images
container image delete --all

# Prune dangling images
container image prune

# Prune all unused images
container image prune --all
```

### Change Default Registry

```bash
container system property set registry.domain my-registry.example.com
```

---

## Complete CLI Command Reference

### Container Lifecycle

| Command | Aliases | Description |
|---------|---------|-------------|
| `container run` | | Create and run a container |
| `container create` | | Create a container without starting |
| `container start` | | Start a stopped container |
| `container stop` | | Stop a running container |
| `container kill` | | Send a signal to a running container |
| `container delete` | `rm` | Remove a container |
| `container list` | `ls` | List containers |
| `container exec` | | Run command in a running container |
| `container logs` | | View container logs |
| `container inspect` | | Show detailed container info (JSON) |
| `container stats` | | Show live resource usage |
| `container prune` | | Remove stopped containers |

### Image Management

| Command | Aliases | Description |
|---------|---------|-------------|
| `container image pull` | | Pull an image from a registry |
| `container image push` | | Push an image to a registry |
| `container image list` | `ls` | List local images |
| `container image delete` | `rm` | Remove an image |
| `container image tag` | | Tag an image |
| `container image save` | | Export image to tar |
| `container image load` | | Import image from tar |
| `container image inspect` | | Show detailed image info |
| `container image prune` | | Remove unused images |

### Build

| Command | Description |
|---------|-------------|
| `container build` | Build an image from Dockerfile/Containerfile |
| `container builder start` | Start the BuildKit builder |
| `container builder stop` | Stop the builder |
| `container builder delete` | Remove the builder |
| `container builder status` | Show builder status |

### Networking (macOS 26+)

| Command | Aliases | Description |
|---------|---------|-------------|
| `container network create` | | Create a network |
| `container network delete` | `rm` | Remove a network |
| `container network list` | `ls` | List networks |
| `container network inspect` | | Show network details |
| `container network prune` | | Remove unused networks |

### Volumes

| Command | Aliases | Description |
|---------|---------|-------------|
| `container volume create` | | Create a named volume |
| `container volume delete` | `rm` | Remove a volume |
| `container volume list` | `ls` | List volumes |
| `container volume inspect` | | Show volume details |
| `container volume prune` | | Remove unused volumes |

### Registry

| Command | Description |
|---------|-------------|
| `container registry login` | Authenticate with a registry |
| `container registry logout` | Remove stored credentials |
| `container registry list` | List authenticated registries |

### System

| Command | Description |
|---------|-------------|
| `container system start` | Start container services |
| `container system stop` | Stop container services |
| `container system status` | Health check |
| `container system version` | Show version info |
| `container system logs` | View service logs |
| `container system df` | Show disk usage |
| `container system dns create` | Create local DNS domain (sudo) |
| `container system dns delete` | Remove local DNS domain (sudo) |
| `container system dns list` | List DNS domains |
| `container system kernel set` | Install/update Linux kernel |
| `container system property list` | List system properties |
| `container system property get` | Get a property value |
| `container system property set` | Set a property value |
| `container system property clear` | Reset property to default |

### Shell Completion

```bash
container --generate-completion-script zsh
container --generate-completion-script bash
container --generate-completion-script fish
```

---

## Limitations vs Docker

### Fundamental Architecture Differences

| Aspect | Docker Desktop (macOS) | Apple Container |
|--------|----------------------|-----------------|
| VM model | Single shared Linux VM | One lightweight VM per container |
| Isolation | Namespace/cgroup (shared kernel) | Full VM isolation per container |
| Platform | Cross-platform | Apple Silicon macOS only |
| macOS version | Any supported macOS | macOS 26+ (limited on macOS 15) |
| Intel Mac support | Yes | No |
| Written in | Go | Swift |
| Init system | containerd/runc | Custom minimal init (vminitd) |

### Missing Features (vs Docker)

1. **No `docker compose` equivalent** -- There is no built-in compose file support. A community project [container-compose](https://github.com/noghartt/container-compose) exists as a workaround.
2. **No `container ps` command** -- Use `container list` / `container ls` instead.
3. **No Docker Swarm or orchestration** -- Single-host tool only.
4. **No Linux host support** -- macOS only.
5. **No Windows container support** -- Linux containers only.
6. **No Intel Mac support** -- Apple Silicon only.
7. **Anonymous volumes do not auto-cleanup with `--rm`** -- Must manually prune.
8. **Memory ballooning is partial** -- Freed memory inside a container is not always returned to the host. Containers may need to be restarted under heavy memory load.

### Networking Differences

- On macOS 26 with user-defined networks, containers get their own IPs and you do not always need explicit port mapping (unlike Docker where `-p` is always required for host access).
- Port forwarding stability is still maturing -- some users have reported inconsistencies.
- Socket publishing (Unix Domain Socket) is available as an alternative to port forwarding, bypassing the network stack entirely.
- `host.container.internal` DNS requires explicit setup via `sudo container system dns create`.

### Performance Characteristics

- **Startup:** Sub-second container start times (faster than Docker Desktop which boots a full VM).
- **Memory:** Each container VM has overhead, but the VMs are very lightweight.
- **CPU:** Near-native performance on Apple Silicon.

---

## Gotchas and Known Issues

1. **macOS 26 is strongly recommended.** macOS 15 support exists but with crippled networking (no container-to-container communication, no `container network` commands).

2. **Pre-1.0 software.** Breaking changes may occur between minor releases (e.g., 0.1.x to 0.2.x).

3. **Anonymous volumes are not cleaned up with `--rm`.** You must manually run `container volume prune`.

4. **Memory is not always returned to the host.** Due to partial memory ballooning support, containers that allocate and then free large amounts of memory may not release it back. Restart the container to reclaim.

5. **Port forwarding can be inconsistent.** Some users have reported issues with port forwarding on macOS 26 betas. Unix Domain Socket publishing is a workaround.

6. **Permission issues with socket publishing.** Publishing sockets to system directories like `/var/run/` fails due to macOS permissions. Use `/tmp` or another user-writable directory instead.

7. **Default resource limits are modest.** Defaults are 4 CPUs and 1 GiB RAM per container. For build-heavy workloads, explicitly set higher limits.

8. **Builder resources are even more modest.** BuildKit defaults to 2 CPUs and 2 GiB RAM. For large builds, start the builder with more resources.

9. **Containers must listen on 0.0.0.0 inside the VM.** Binding to `localhost` inside the container will not be reachable from the host.

10. **No `docker-compose.yml` support.** Multi-container setups require scripting or the third-party `container-compose` tool.

11. **Subnet mismatches on macOS 15.** The vmnet and network helper may assign different subnets, requiring manual configuration via `container system property set`.

12. **Nested virtualization requires M3 or later.** The `--virtualization` flag only works on M3+ chips.

---

## Sources

- [GitHub: apple/container](https://github.com/apple/container)
- [GitHub: apple/containerization](https://github.com/apple/containerization)
- [Command Reference](https://github.com/apple/container/blob/main/docs/command-reference.md)
- [How-To Guide](https://github.com/apple/container/blob/main/docs/how-to.md)
- [Tutorial](https://github.com/apple/container/blob/main/docs/tutorial.md)
- [Technical Overview](https://github.com/apple/container/blob/main/docs/technical-overview.md)
- [InfoQ: Apple Containerization](https://www.infoq.com/news/2025/06/apple-container-linux/)
- [The Register: Apple Containerization](https://www.theregister.com/2025/06/10/apple_tries_to_contain_itself/)
- [The New Stack: Technical Comparison with Docker](https://thenewstack.io/apple-containers-on-macos-a-technical-comparison-with-docker/)
- [The New Stack: Tutorial](https://thenewstack.io/tutorial-setting-up-and-exploring-apple-containerization-on-macos/)
- [Medium: Port Forwarding Issues](https://medium.com/@aeke/bridging-the-gap-solving-port-forwarding-issues-in-apples-new-container-infrastructure-2cbdb3e7799d)
- [DZone: What Apple's Native Containers Mean for Docker Users](https://dzone.com/articles/what-apples-native-containers-mean-for-docker-user)
- [container-compose (community)](https://github.com/noghartt/container-compose)
