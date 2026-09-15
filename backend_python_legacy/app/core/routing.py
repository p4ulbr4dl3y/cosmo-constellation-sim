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
    """Построение ненаправленного графа смежности по списку ребер [u, v, dist]."""
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
    Поиск кратчайшего маршрута от клиента до ближайшего доступного шлюза по алгоритму Дейкстры.

    Правила маршрутизации:
    - клиентские пункты не являются ретрансляторами трафика;
    - наземные шлюзы являются терминальными узлами;
    - маршрут обязательно содержит минимум один спутник (длина пути >= 3 узлов: клиент, спутник, ..., шлюз);
    - при метрике 'hops' минимизируется число переходов, при равенстве - суммарное расстояние;
    - при метрике 'distance' минимизируется расстояние, при равенстве - число переходов.

    Возвращает кортеж: список узлов маршрута и суммарную протяженность в километрах.
    Если путь не найден, возвращается ([], 0.0).
    """
    if not online_gateways or client_id not in adj:
        return [], 0.0

    # Минимальные достигнутые веса: узел -> (число переходов, расстояние) или наоборот
    best_cost: dict[str, tuple[float, float]] = {}

    # Элементы очереди с приоритетом: (первичный вес, вторичный вес, текущий узел, путь, дистанция)
    pq: list[tuple[float, float, str, list[str], float]] = []

    if metric == "hops":
        heapq.heappush(pq, (0.0, 0.0, client_id, [client_id], 0.0))
        best_cost[client_id] = (0.0, 0.0)
    else:
        heapq.heappush(pq, (0.0, 0.0, client_id, [client_id], 0.0))
        best_cost[client_id] = (0.0, 0.0)

    while pq:
        pri, sec, curr, path, total_dist = heapq.heappop(pq)

        # Проверка достижения доступного наземного шлюза
        if curr in online_gateways and curr != client_id:
            if len(path) >= 3:
                return path, total_dist

        current_cost = (pri, sec)
        if current_cost > best_cost.get(curr, (float("inf"), float("inf"))):
            continue

        for nxt, d in adj.get(curr, []):
            # Клиентские пункты не ретранслируют чужой трафик
            if nxt in all_clients and nxt != client_id:
                continue

            # Прямая связь клиент-шлюз без участия спутника запрещена
            if nxt in online_gateways and len(path) < 2:
                continue

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
                heapq.heappush(pq, (new_cost[0], new_cost[1], nxt, path + [nxt], new_dist))

    return [], 0.0


def classify_failure(
    has_client_satellite: bool,
    online_gateways_count: int,
    has_gateway_satellite: bool,
) -> tuple[str, str]:
    """
    Классификация первопричины отсутствия маршрута для клиентского пункта:
    - no_client_satellite: над клиентом нет видимого активного спутника;
    - gateway_offline: все наземные шлюзы отключены или на обслуживании;
    - no_gateway_satellite: шлюзы активны, но над ними нет видимых спутников;
    - isl_disconnected: есть видимость у клиента и шлюза, но разорвана межспутниковая сеть.
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
