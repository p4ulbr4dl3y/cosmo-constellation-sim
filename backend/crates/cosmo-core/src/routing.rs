use std::collections::{BinaryHeap, HashMap, HashSet};

use crate::constants::{
    get_failure_description_ru, FAILURE_REASON_GATEWAY_OFFLINE, FAILURE_REASON_ISL_DISCONNECTED,
    FAILURE_REASON_NO_CLIENT_SAT, FAILURE_REASON_NO_GW_SAT,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoutingMetric {
    Hops,
    Distance,
}

impl RoutingMetric {
    pub fn from_str(s: &str) -> Self {
        if s.eq_ignore_ascii_case("hops") {
            RoutingMetric::Hops
        } else {
            RoutingMetric::Distance
        }
    }
}

pub fn build_adjacency(
    edges: &[(String, String, f64)],
) -> HashMap<String, Vec<(String, f64)>> {
    let mut adj: HashMap<String, Vec<(String, f64)>> = HashMap::new();
    for (u, v, dist) in edges {
        adj.entry(u.clone()).or_default().push((v.clone(), *dist));
        adj.entry(v.clone()).or_default().push((u.clone(), *dist));
    }
    adj
}

#[derive(Debug, Clone, PartialEq)]
struct PQItem {
    pri: f64,
    sec: f64,
    curr: String,
    path: Vec<String>,
    total_dist: f64,
}

impl Eq for PQItem {}

impl PartialOrd for PQItem {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PQItem {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        other
            .pri
            .partial_cmp(&self.pri)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                other
                    .sec
                    .partial_cmp(&self.sec)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| other.curr.cmp(&self.curr))
    }
}

/// Поиск кратчайшего маршрута от клиента до ближайшего доступного шлюза по алгоритму Дейкстры.
pub fn find_route(
    adj: &HashMap<String, Vec<(String, f64)>>,
    client_id: &str,
    online_gateways: &HashSet<String>,
    all_clients: &HashSet<String>,
    metric: RoutingMetric,
) -> (Vec<String>, f64) {
    if online_gateways.is_empty() || !adj.contains_key(client_id) {
        return (vec![], 0.0);
    }

    let mut best_cost: HashMap<String, (f64, f64)> = HashMap::new();
    let mut pq = BinaryHeap::new();

    let init_cost = (0.0, 0.0);
    best_cost.insert(client_id.to_string(), init_cost);
    pq.push(PQItem {
        pri: 0.0,
        sec: 0.0,
        curr: client_id.to_string(),
        path: vec![client_id.to_string()],
        total_dist: 0.0,
    });

    while let Some(item) = pq.pop() {
        let PQItem {
            pri,
            sec,
            curr,
            path,
            total_dist,
        } = item;

        if online_gateways.contains(&curr) && curr != client_id {
            if path.len() >= 3 {
                return (path, total_dist);
            }
        }

        let current_cost = (pri, sec);
        if let Some(&best) = best_cost.get(&curr) {
            if current_cost > best {
                continue;
            }
        }

        if let Some(neighbors) = adj.get(&curr) {
            for (nxt, d) in neighbors {
                if all_clients.contains(nxt) && nxt != client_id {
                    continue;
                }

                if online_gateways.contains(nxt) && path.len() < 2 {
                    continue;
                }

                if path.contains(nxt) {
                    continue;
                }

                let new_hops = path.len() as f64;
                let new_dist = total_dist + d;

                let new_cost = if metric == RoutingMetric::Hops {
                    (new_hops, new_dist)
                } else {
                    (new_dist, new_hops)
                };

                let is_better = match best_cost.get(nxt) {
                    Some(&best) => new_cost < best,
                    None => true,
                };

                if is_better {
                    best_cost.insert(nxt.clone(), new_cost);
                    let mut new_path = path.clone();
                    new_path.push(nxt.clone());
                    pq.push(PQItem {
                        pri: new_cost.0,
                        sec: new_cost.1,
                        curr: nxt.clone(),
                        path: new_path,
                        total_dist: new_dist,
                    });
                }
            }
        }
    }

    (vec![], 0.0)
}

/// Классификация первопричины отсутствия маршрута для клиентского пункта.
pub fn classify_failure(
    has_client_satellite: bool,
    online_gateways_count: usize,
    has_gateway_satellite: bool,
) -> (&'static str, &'static str) {
    let code = if !has_client_satellite {
        FAILURE_REASON_NO_CLIENT_SAT
    } else if online_gateways_count == 0 {
        FAILURE_REASON_GATEWAY_OFFLINE
    } else if !has_gateway_satellite {
        FAILURE_REASON_NO_GW_SAT
    } else {
        FAILURE_REASON_ISL_DISCONNECTED
    };

    (code, get_failure_description_ru(code))
}
