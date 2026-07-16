# VPS Capacity Baseline

This document records the production server's resource envelope and a point-in-time utilization baseline. It is intended to prevent new collectors, bots, or operational services from being added without accounting for host capacity.

## Provisioned server

| Item | Value |
|---|---:|
| Provider / plan | Hetzner Cloud CPX22 |
| Host | `ubuntu-4gb-nbg1-1` |
| vCPU | 2 |
| RAM | 4 GB |
| Local disk | 80 GB |
| Included outbound traffic | 20 TB |
| Baseline captured | 2026-07-13 |

The Hetzner dashboard showed zero material consumption of the 20 TB outbound allowance. The displayed `3.70` usage figure is billing usage, not CPU, RAM, or disk utilization.

## Observed utilization

### CPU

The one-week graph was generally around 5-25% of one vCPU, with short spikes around 40-70%. Hetzner labels one vCPU as 100%, so the observed graph stayed below one fully occupied core on a two-vCPU server.

Interpretation: there is visible CPU headroom for the current process set. Short spikes are not a capacity incident. Sustained utilization and bot-loop latency matter more than an isolated peak.

### Process memory

The matching PM2 inventory reported approximately 685 MB of RSS across the ten online managed processes. The main HYPE bot was the largest at approximately 383 MB, and the health watchdog used approximately 53 MB.

This is not total host memory usage. It excludes the operating system, filesystem cache, PM2 daemon, and any process outside PM2. The screenshots show the 4 GB provisioned capacity but do not show actual available RAM or swap use.

### Disk I/O

The root filesystem measurement on 2026-07-13 was:

| Filesystem | Size | Used | Available | Use |
|---|---:|---:|---:|---:|
| `/dev/sda1` mounted at `/` | 75 GB | 14 GB | 59 GB | 19% |

The provider's 80 GB figure is decimal provisioned capacity; Linux reports approximately 75 GiB. `/opt/bybit-rev` resides on this root filesystem.

The short dashboard sample showed:

- writes generally around 10-50 KB/s, with peaks around 70-75 KB/s;
- reads near zero;
- roughly 0-10 write IOPS.

Interpretation: the current append-oriented collectors are not visibly stressing disk throughput or IOPS, and the filesystem has substantial free-space headroom. File-growth rate should still be monitored because collectors append continuously.

### Network

The short sample showed approximately:

- inbound traffic mostly around 80-220 KB/s, with peaks around 400-450 KB/s;
- outbound traffic generally below 50 KB/s;
- packet rate mostly around 200-500 packets/s, with brief peaks near 1,000 packets/s.

Interpretation: network bandwidth and packet rate have substantial headroom under the current workload.

## Current verdict

**No server upgrade is indicated by this baseline.** CPU, disk capacity/I/O, and network utilization look light relative to the provisioned server. RAM and swap headroom still need command-line measurements before adding a materially heavier workload.

Do not use spare live-server capacity for backtests, bulk replays, or research jobs. Those can compete with price handling, reconciliation, state writes, collectors, and health monitoring even if average dashboard usage looks low.

## Required checks before adding a persistent service

Capture these before and after the new service is introduced:

```bash
date -u
uptime
free -h
swapon --show
df -h / /opt/bybit-rev
df -i / /opt/bybit-rev
pm2 ls --no-color
ps -eo pid,comm,%cpu,%mem,rss --sort=-rss | head -20
```

For a short pressure sample:

```bash
vmstat 5 12
```

Record:

- available RAM and swap use;
- root/data disk occupancy and inode use;
- one-, five-, and fifteen-minute load averages;
- PM2 RSS and restart-count changes;
- whether the runtime-health heartbeat, main loop, WebSocket, reconciliation, or collector streams become stale.

Add one persistent service at a time, then observe it for at least 24 hours before attributing the remaining headroom to another service.

## Upgrade triggers

Consider upgrading only when one or more of these conditions is sustained or repeatedly affects production behavior:

- available RAM remains below 1 GB, swap begins growing, or the kernel/PM2 logs show memory pressure or OOM termination;
- aggregate CPU/load approaches the two-vCPU envelope for extended periods, rather than brief collection spikes;
- host contention causes bot-loop, runtime-heartbeat, WebSocket, reconciliation, or collector-staleness incidents;
- disk occupancy exceeds 75%, inode consumption becomes material, or collector growth leaves insufficient retention headroom;
- disk I/O wait becomes sustained and coincides with delayed state or stream writes;
- a proposed persistent workload cannot fit with at least 25% measured headroom after a realistic soak.

An upgrade should be driven by sustained measurements or degraded production timing, not process count alone.

## Likely capacity consumers

The changes most likely to justify a future upgrade are:

- additional high-frequency WebSocket/order-book collectors;
- more live symbols with independent technical-context windows;
- multiple additional Node/`ts-node` bots;
- local databases, metrics stacks, or long-retention indexing;
- any accidental production-host backtest or replay workload.

Small read-only watchdog checks and lightweight log publishing are unlikely to be decisive by themselves, but their cumulative cost should still be measured.

The optional `hype-hl-short-shadow` tails existing files and retains a bounded 48-hour window; it creates no new market-data stream. It should still be treated as one new persistent Node process: capture the before/after checks above, watch its RSS after bootstrap and again after 24 hours, and confirm that collector and main-bot heartbeat timing remain unchanged.
