# Apple Containers: Guest OS & Architecture Support

## Summary

Apple containers support **Linux guests only**. There is no support for running macOS, Windows, or any other operating system as a container guest. This is a fundamental architectural constraint, not a temporary limitation.

---

## Supported Guest Configurations

| Guest OS | Status | Notes |
|----------|--------|-------|
| Linux (arm64) | Supported | Native performance on Apple Silicon |
| Linux (amd64) | Supported | Via Rosetta translation; must opt in |
| macOS | Not supported | No plans announced |
| Windows | Not supported | No plans announced |

### Linux arm64 (Native)

The default and primary target. Any OCI-compatible Linux image built for `arm64`/`aarch64` runs natively on Apple Silicon with near-bare-metal performance. This includes all major distros (Ubuntu, Debian, Alpine, Fedora, etc.) and any custom images.

### Linux amd64 (Via Rosetta)

Apple containers can run x86_64/amd64 Linux images using Rosetta translation. This is useful for images that are only published for amd64 or for testing x86-specific behavior.

To run an amd64 image:

```bash
container run --arch amd64 docker.io/library/ubuntu:24.04
```

Rosetta translation adds some overhead but is generally functional for most workloads.

---

## Why No macOS Guests?

### Technical Reasons

1. **macOS lacks container primitives.** Linux containers rely on kernel-level features (cgroups, namespaces, overlayfs) that macOS does not have. Apple's container tool works by running a lightweight Linux kernel in each VM — there's no equivalent lightweight macOS kernel to boot.

2. **macOS is not lightweight.** Apple containers achieve sub-second startup because the Linux VMs are minimal. macOS requires a full OS boot (30+ seconds), disk images (15+ GB), and significantly more memory. This defeats the purpose of containers.

3. **Licensing restrictions.** Apple's macOS EULA only permits virtualization on Apple hardware, and the Virtualization framework's macOS VM support has a different (heavier) API surface than the lightweight Linux VM path that containers use.

4. **Different Virtualization framework APIs.** The macOS Virtualization framework has separate code paths for Linux VMs (`VZLinuxBootLoader`) and macOS VMs (`VZMacOSBootLoader`). The container tool uses the Linux path exclusively. macOS VMs require IPSW restore images, a virtual Mac hardware model, and don't support the same fast-boot optimizations.

### Architectural Comparison

| Aspect | Linux Guest (Container) | macOS Guest (VM) |
|--------|------------------------|-------------------|
| Boot time | Sub-second | 30-60 seconds |
| Disk footprint | Megabytes (layered OCI image) | 15+ GB (IPSW restore) |
| Memory | Configurable, minimal | 4+ GB recommended |
| Kernel | Lightweight Linux kernel per VM | Full macOS kernel |
| Image format | OCI/Docker images | IPSW + disk image |
| Framework API | `VZLinuxBootLoader` | `VZMacOSBootLoader` |

### Community Interest

There is an [open discussion (apple/container#611)](https://github.com/apple/container/discussions/611) requesting macOS guest support with 33+ upvotes. An Apple maintainer responded:

> "Today github.com/apple/containerization and this project focus just on Linux based container workloads."

No timeline or commitment to macOS guest support has been given.

### Alternatives for macOS VMs

If you need reproducible macOS environments, the options are:

- **Virtualization framework directly** — Apple's `VZVirtualMachine` API supports macOS guests, but without the container UX (no OCI images, no layered filesystems, no fast startup)
- **[Tart](https://github.com/cirruslabs/tart)** — Open-source tool for macOS and Linux VMs on Apple Silicon, with OCI-based image distribution. Closer to the container UX but still full VM boot times
- **GitHub Actions macOS runners** — For CI/CD specifically

---

## Host Requirements (For Reference)

The host side is equally constrained:

| Requirement | Detail |
|-------------|--------|
| Hardware | Apple Silicon (M1+) only. No Intel. |
| OS | macOS 26 (Tahoe) recommended. macOS 15 has limited support. |
| Platform | macOS only. No Linux or Windows host support. |

---

## Implications for This Project

Since Apple containers only run Linux guests:

- Our `Dockerfile` correctly uses `ubuntu:24.04` as the base image
- Claude Code runs inside a Linux environment regardless of the macOS host
- Any tools or dependencies must be Linux-compatible (arm64 preferred)
- If we ever need macOS-specific tooling inside the container, it won't be possible — we'd need a separate approach

---

## Sources

- [apple/container GitHub](https://github.com/apple/container) — "A tool for creating and running **Linux** containers using lightweight virtual machines on a Mac"
- [apple/container#611 — macOS inside containers discussion](https://github.com/apple/container/discussions/611)
- [Apple Containerization framework docs](https://github.com/apple/containerization)
- [The New Stack: Apple Containers Technical Comparison](https://thenewstack.io/apple-containers-on-macos-a-technical-comparison-with-docker/)
- [Apple Developer: Virtualization framework](https://developer.apple.com/documentation/virtualization)
