from __future__ import annotations

import collections
import heapq
from typing import Literal

from app.core.constants import (
    FAILURE_DESCRIPTIONS_RU,
    FAILURE_REASON_GATEWAY_OFFLINE,
    FAILURE_REASON_ISL_DISCONNECTED,
    FAILURE_REASON_NO_CLIENT_SAT,
    FAILURE_REASON_NO_GW_SAT,
)

RoutingMetric = Literal["hops", "distance"]


def build_adjacency(
    edges: list[list[str | float]],
) -> dict[str, list[tuple[str, float]]]:
    """Build undirected adjacency graph from edges [u, v, dist]."""
    adj: dict[str, list[tuple[str, float]]] = collections.defaultdict(list)
    for u, v, dist in edges:
        u_str, v_str, d_val = str(u), str(v), float(dist)
        adj[u_str].append((v_str, d_val))
        adj[v_str].append((u_str, d_val))
    return adj


def find_route(
    adj: dict[str, list[tuple[str, float]]],
    client_id: str,
    online_gateways: set[str],
    all_clients: set[str],
    metric: RoutingMetric = "hops",
) -> tuple[list[str], float]:
    """
    Find shortest route from client_id to any available gateway.
    Rules:
    - Client nodes CANNOT relay traffic.
    - Gateways are terminal nodes.
    - Must traverse at least one satellite (len(path) >= 3: [Client, Sat, ..., Gateway]).
    - If metric == 'hops': minimize hops first, tie-break by total distance.
    - If metric == 'distance': minimize distance first, tie-break by hops.
    Returns: (path, total_distance_km). If no route found, returns ([], 0.0).
    """
    if not online_gateways or client_id not in adj:
        return [], 0.0

    # Best costs seen: key=node -> (hops, distance) or (distance, hops)
    best_cost: dict[str, tuple[float, float]] = {}

    # Priority queue items: (primary_key, secondary_key, current_node, path, total_dist)
    pq: list[tuple[float, float, str, list[str], float]] = []

    if metric == "hops":
        # (hops, dist, node, path, total_dist)
        heapq.heappush(pq, (0.0, 0.0, client_id, [client_id], 0.0))
        best_cost[client_id] = (0.0, 0.0)
    else:
        # (dist, hops, node, path, total_dist)
        heapq.heappush(pq, (0.0, 0.0, client_id, [client_id], 0.0))
        best_cost[client_id] = (0.0, 0.0)

    while pq:
        pri, sec, curr, path, total_dist = heapq.heappop(pq)

        # Reached an online gateway?
        if curr in online_gateways and curr != client_id:
            if len(path) >= 3:  # At least client -> sat -> gateway
                return path, total_dist

        # If current cost exceeds best recorded, skip
        current_cost = (pri, sec)
        if current_cost > best_cost.get(curr, (float("inf"), float("inf"))):
            continue

        for nxt, d in adj.get(curr, []):
            # Other client points cannot relay traffic
            if nxt in all_clients and nxt != client_id:
                continue

            # Cannot jump straight from client to gateway without satellite
            if nxt in online_gateways and len(path) < 2:
                continue

            # No loop in current path
            if nxt in path:
                continue

            new_hops = float(len(path))
            new_dist = total_dist + d

            if metric == "hops":
                new_cost = (new_hops, new_dist)
            else:
                new_cost = (new_dist, new_hops)

            if new_cost < best_cost.get(nxt, (float("inf"), float("inf"))):
                best_cost[nxt] = new_cost
                heapq.heappush(
                    pq, (new_cost[0], new_cost[1], nxt, path + [nxt], new_dist)
                )

    return [], 0.0


def classify_failure(
    has_client_satellite: bool,
    online_gateways_count: int,
    has_gateway_satellite: bool,
) -> tuple[str, str]:
    """
    Classify the root-cause failure when no route exists for a client:
    1. no_client_satellite: client has no visible active satellite
    2. gateway_offline: all gateways are down/in maintenance
    3. no_gateway_satellite: gateways are online, but no active satellite is visible over them
    4. isl_disconnected: client and gateways have visible satellites, but ISL network is disconnected
    """
    if not has_client_satellite:
        code = FAILURE_REASON_NO_CLIENT_SAT
    elif online_gateways_count == 0:
        code = FAILURE_REASON_GATEWAY_OFFLINE
    elif not has_gateway_satellite:
        code = FAILURE_REASON_NO_GW_SAT
    else:
        code = FAILURE_REASON_ISL_DISCONNECTED

    description = FAILURE_DESCRIPTIONS_RU[code]
    return code, description
