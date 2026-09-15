use std::collections::HashSet;

use crate::constants::SCHEMA_VERSION_INPUT;
use crate::models::Scenario;

fn is_finite_number(val: &serde_json::Value) -> bool {
    if let Some(f) = val.as_f64() {
        f.is_finite()
    } else {
        false
    }
}

pub fn validate_scenario_value(s: &serde_json::Value) -> Vec<String> {
    let mut errors = Vec::new();

    let obj = match s.as_object() {
        Some(o) => o,
        None => {
            return vec!["Сценарий должен быть объектом JSON (словарём).".to_string()];
        }
    };

    // 1. Проверка версии схемы
    let version = obj.get("schema_version").and_then(|v| v.as_str());
    if version != Some(SCHEMA_VERSION_INPUT) {
        let v_str = version.unwrap_or("");
        errors.push(format!(
            "Неподдерживаемая версия схемы: '{v_str}'. Ожидается '{SCHEMA_VERSION_INPUT}'."
        ));
    }

    // 2. Параметры среды
    let mut max_h: i64 = 172800;

    if let Some(env_val) = obj.get("environment") {
        if let Some(env) = env_val.as_object() {
            let env_keys = [
                "altitude_km",
                "inclination_deg",
                "earth_angle0_deg",
                "horizon_s",
                "step_s",
                "min_elevation_deg",
                "isl_range_km",
                "target_availability",
            ];
            for key in &env_keys {
                if !env.contains_key(*key) {
                    errors.push(format!(
                        "В разделе 'environment' отсутствует обязательное поле '{key}'."
                    ));
                } else if !is_finite_number(&env[*key]) {
                    errors.push(format!(
                        "Поле '{key}' в 'environment' должно быть конечным числом."
                    ));
                }
            }

            if let Some(alt) = env.get("altitude_km").and_then(|v| v.as_f64()) {
                if alt.is_finite() && !(200.0..=1200.0).contains(&alt) {
                    errors.push(format!(
                        "Недопустимая высота орбиты altitude_km={alt} км. Допустимый диапазон: [200, 1200]."
                    ));
                }
            }

            if let Some(inc) = env.get("inclination_deg").and_then(|v| v.as_f64()) {
                if inc.is_finite() && !(inc > 0.0 && inc <= 180.0) {
                    errors.push(format!(
                        "Недопустимое наклонение орбиты inclination_deg={inc}°. Допустимый диапазон: (0, 180]."
                    ));
                }
            }

            let step_s_opt = env.get("step_s");
            let horizon_s_opt = env.get("horizon_s");
            let mut valid_time_types = true;

            let step_s = match step_s_opt {
                Some(v) if v.is_i64() => v.as_i64(),
                Some(_) => {
                    errors.push("Шаг расчета step_s должен быть целым положительным числом секунд.".to_string());
                    valid_time_types = false;
                    None
                }
                None => None,
            };

            let horizon_s = match horizon_s_opt {
                Some(v) if v.is_i64() => {
                    let h = v.as_i64().unwrap();
                    max_h = h;
                    Some(h)
                }
                Some(_) => {
                    errors.push("Горизонт расчета horizon_s должен быть целым положительным числом секунд.".to_string());
                    valid_time_types = false;
                    None
                }
                None => None,
            };

            if valid_time_types {
                if let (Some(step), Some(horizon)) = (step_s, horizon_s) {
                    if !(step > 0 && step <= horizon && horizon <= 172800) {
                        errors.push(format!(
                            "Недопустимая временная сетка: step_s={step}, horizon_s={horizon}. Должно выполняться 0 < step_s <= horizon_s <= 172800 (до 48 часов)."
                        ));
                    } else if horizon % step != 0 {
                        errors.push(format!(
                            "Горизонт расчета horizon_s ({horizon} с) должен быть нацело кратен шагу step_s ({step} с)."
                        ));
                    }
                }
            }

            if let Some(el) = env.get("min_elevation_deg").and_then(|v| v.as_f64()) {
                if el.is_finite() && !(0.0..90.0).contains(&el) {
                    errors.push(format!(
                        "Недопустимый минимальный угол возвышения min_elevation_deg={el}°. Допустимо: [0, 90)."
                    ));
                }
            }

            if let Some(isl) = env.get("isl_range_km").and_then(|v| v.as_f64()) {
                if isl.is_finite() && !(isl > 0.0 && isl <= 10000.0) {
                    errors.push(format!(
                        "Недопустимая дальность ISL isl_range_km={isl} км. Допустимо: (0, 10000]."
                    ));
                }
            }

            if let Some(ta) = env.get("target_availability").and_then(|v| v.as_f64()) {
                if ta.is_finite() && !(0.0..=1.0).contains(&ta) {
                    errors.push(format!(
                        "Целевая доступность target_availability={ta} должна быть в диапазоне [0.0, 1.0]."
                    ));
                }
            }
        } else {
            errors.push("Отсутствует обязательный раздел 'environment' (параметры среды и расчета).".to_string());
        }
    } else {
        errors.push("Отсутствует обязательный раздел 'environment' (параметры среды и расчета).".to_string());
    }

    // 3. Конфигурация орбитальной группировки
    let mut plane_ids = HashSet::new();
    let mut sat_ids = HashSet::new();

    if let Some(des_val) = obj.get("design") {
        if let Some(des) = des_val.as_object() {
            let stage = des.get("launch_stage");
            let stage_valid = stage.and_then(|v| v.as_i64()).map_or(false, |s| s >= 1 && s <= 3);
            if !stage_valid {
                let st_repr = stage.map_or("None".to_string(), |v| v.to_string());
                errors.push(format!(
                    "Параметр launch_stage должен быть целым числом 1, 2 или 3. Получено: {st_repr}"
                ));
            }

            match des.get("planes") {
                Some(serde_json::Value::Array(planes)) if !planes.is_empty() => {
                    for (idx, p_val) in planes.iter().enumerate() {
                        if let Some(p) = p_val.as_object() {
                            let pid = p.get("id").and_then(|v| v.as_str());
                            if pid.is_none() || pid.unwrap().is_empty() {
                                let repr = p.get("id").map_or("None".to_string(), |v| v.to_string());
                                errors.push(format!("Плоскость #{idx} имеет некорректный id: {repr}"));
                            } else {
                                let pid_str = pid.unwrap();
                                if plane_ids.contains(pid_str) {
                                    errors.push(format!("Дублирующийся идентификатор плоскости: '{pid_str}'."));
                                } else {
                                    plane_ids.insert(pid_str.to_string());
                                }
                            }

                            for angle_key in &["raan_deg", "phase_deg"] {
                                let val = p.get(*angle_key).and_then(|v| v.as_f64());
                                if val.map_or(true, |v| !v.is_finite() || !(0.0..360.0).contains(&v)) {
                                    let pid_disp = pid.unwrap_or("unknown");
                                    let v_repr = p.get(*angle_key).map_or("None".to_string(), |v| v.to_string());
                                    errors.push(format!(
                                        "Недопустимый угол {angle_key}={v_repr} для плоскости '{pid_disp}'. Допустимо: [0, 360)."
                                    ));
                                }
                            }
                        } else {
                            errors.push(format!("Элемент #{idx} в 'planes' должен быть объектом (dict)."));
                        }
                    }
                }
                _ => {
                    errors.push("Список орбитальных плоскостей 'planes' пуст или отсутствует.".to_string());
                }
            }

            match des.get("satellites") {
                Some(serde_json::Value::Array(sats)) if !sats.is_empty() => {
                    for (idx, sat_val) in sats.iter().enumerate() {
                        if let Some(sat) = sat_val.as_object() {
                            let sid = sat.get("id").and_then(|v| v.as_str());
                            if sid.is_none() || sid.unwrap().is_empty() {
                                let repr = sat.get("id").map_or("None".to_string(), |v| v.to_string());
                                errors.push(format!("Спутник #{idx} имеет некорректный id: {repr}"));
                            } else {
                                let sid_str = sid.unwrap();
                                if sat_ids.contains(sid_str) {
                                    errors.push(format!("Дублирующийся идентификатор спутника: '{sid_str}'."));
                                } else {
                                    sat_ids.insert(sid_str.to_string());
                                }
                            }

                            let pid = sat.get("plane_id").and_then(|v| v.as_str()).unwrap_or("");
                            if !plane_ids.contains(pid) {
                                let sid_disp = sid.unwrap_or("unknown");
                                errors.push(format!(
                                    "Спутник '{sid_disp}' ссылается на несуществующую плоскость plane_id='{pid}'."
                                ));
                            }

                            let batch = sat.get("launch_batch").and_then(|v| v.as_i64());
                            if batch.map_or(true, |b| b < 1 || b > 3) {
                                let sid_disp = sid.unwrap_or("unknown");
                                let b_repr = sat.get("launch_batch").map_or("None".to_string(), |v| v.to_string());
                                errors.push(format!(
                                    "Спутник '{sid_disp}' имеет недопустимый launch_batch={b_repr}. Допустимо: 1, 2 или 3."
                                ));
                            }

                            let slot = sat.get("slot_deg").and_then(|v| v.as_f64());
                            if slot.map_or(true, |s| !s.is_finite()) {
                                let sid_disp = sid.unwrap_or("unknown");
                                let s_repr = sat.get("slot_deg").map_or("None".to_string(), |v| v.to_string());
                                errors.push(format!(
                                    "Спутник '{sid_disp}' имеет некорректный slot_deg={s_repr}. Ожидается число."
                                ));
                            }
                        } else {
                            errors.push(format!("Элемент #{idx} в 'satellites' должен быть объектом (dict)."));
                        }
                    }
                }
                _ => {
                    errors.push("Список спутников 'satellites' пуст или отсутствует.".to_string());
                }
            }
        } else {
            errors.push("Отсутствует обязательный раздел 'design' (конфигурация группировки).".to_string());
        }
    } else {
        errors.push("Отсутствует обязательный раздел 'design' (конфигурация группировки).".to_string());
    }

    // 4. Наземные пункты
    let mut ground_ids = HashSet::new();
    let mut has_client = false;
    let mut has_gateway = false;
    let mut gateway_ids = HashSet::new();

    match obj.get("ground_sites") {
        Some(serde_json::Value::Array(ground)) if !ground.is_empty() => {
            for (idx, g_val) in ground.iter().enumerate() {
                if let Some(g) = g_val.as_object() {
                    let gid = g.get("id").and_then(|v| v.as_str());
                    if gid.is_none() || gid.unwrap().is_empty() {
                        let repr = g.get("id").map_or("None".to_string(), |v| v.to_string());
                        errors.push(format!("Наземный пункт #{idx} имеет некорректный id: {repr}"));
                    } else {
                        let gid_str = gid.unwrap();
                        if ground_ids.contains(gid_str) {
                            errors.push(format!("Дублирующийся идентификатор наземного пункта: '{gid_str}'."));
                        } else if sat_ids.contains(gid_str) {
                            errors.push(format!(
                                "Идентификатор наземного пункта '{gid_str}' совпадает с идентификатором спутника!"
                            ));
                        } else {
                            ground_ids.insert(gid_str.to_string());
                        }
                    }

                    let role = g.get("role").and_then(|v| v.as_str()).unwrap_or("");
                    if role == "client" {
                        has_client = true;
                    } else if role == "gateway" {
                        has_gateway = true;
                        if let Some(gid_str) = gid {
                            gateway_ids.insert(gid_str.to_string());
                        }
                    } else {
                        let gid_disp = gid.unwrap_or("unknown");
                        errors.push(format!(
                            "Пункт '{gid_disp}' имеет недопустимую роль role='{role}'. Допустимо: 'client' или 'gateway'."
                        ));
                    }

                    let lat = g.get("lat_deg").and_then(|v| v.as_f64());
                    let lon = g.get("lon_deg").and_then(|v| v.as_f64());
                    let gid_disp = gid.unwrap_or("unknown");

                    if lat.map_or(true, |v| !v.is_finite() || !(-90.0..=90.0).contains(&v)) {
                        let l_repr = g.get("lat_deg").map_or("None".to_string(), |v| v.to_string());
                        errors.push(format!(
                            "Пункт '{gid_disp}' имеет недопустимую широту lat_deg={l_repr}. Допустимо: [-90, 90]."
                        ));
                    }
                    if lon.map_or(true, |v| !v.is_finite() || !(-180.0..=180.0).contains(&v)) {
                        let l_repr = g.get("lon_deg").map_or("None".to_string(), |v| v.to_string());
                        errors.push(format!(
                            "Пункт '{gid_disp}' имеет недопустимую долготу lon_deg={l_repr}. Допустимо: [-180, 180]."
                        ));
                    }
                } else {
                    errors.push(format!("Элемент #{idx} в 'ground_sites' должен быть объектом (dict)."));
                }
            }

            if !has_client {
                errors.push("В сценарии должен присутствовать хотя бы один клиентский пункт (role='client').".to_string());
            }
            if !has_gateway {
                errors.push("В сценарии должен присутствовать хотя бы один шлюз (role='gateway').".to_string());
            }
        }
        _ => {
            errors.push("Список наземных пунктов 'ground_sites' пуст или отсутствует.".to_string());
        }
    }

    // 5. Отказы спутников и периоды недоступности шлюзов
    if let Some(failures_val) = obj.get("failures") {
        if let Some(failures) = failures_val.as_array() {
            for (idx, f_val) in failures.iter().enumerate() {
                if let Some(f) = f_val.as_object() {
                    let sid = f.get("satellite_id").and_then(|v| v.as_str()).unwrap_or("");
                    if !sat_ids.contains(sid) {
                        errors.push(format!("Отказ #{idx} ссылается на неизвестный satellite_id='{sid}'."));
                    }
                    let start_s = f.get("start_s").and_then(|v| v.as_f64());
                    let end_s = f.get("end_s").and_then(|v| v.as_f64());

                    if start_s.is_none() || end_s.is_none() || !start_s.unwrap().is_finite() || !end_s.unwrap().is_finite() {
                        errors.push(format!("Интервал отказа #{idx} должен содержать числовые start_s и end_s."));
                    } else {
                        let st = start_s.unwrap();
                        let en = end_s.unwrap();
                        if !(0.0 <= st && st < en && en <= max_h as f64) {
                            errors.push(format!(
                                "Отказ #{idx} для спутника '{sid}' имеет некорректный интервал [{st}, {en}). Должно выполняться: 0 <= start_s < end_s <= horizon_s ({max_h})."
                            ));
                        }
                    }
                } else {
                    errors.push(format!("Элемент #{idx} в 'failures' должен быть объектом (dict)."));
                }
            }
        } else {
            errors.push("Поле 'failures' должно быть списком.".to_string());
        }
    }

    if let Some(gw_outages_val) = obj.get("gateway_outages") {
        if let Some(gw_outages) = gw_outages_val.as_array() {
            for (idx, f_val) in gw_outages.iter().enumerate() {
                if let Some(f) = f_val.as_object() {
                    let gid = f.get("gateway_id").and_then(|v| v.as_str()).unwrap_or("");
                    if !gateway_ids.contains(gid) {
                        errors.push(format!(
                            "Период недоступности шлюза #{idx} ссылается на неизвестный gateway_id='{gid}'."
                        ));
                    }
                    let start_s = f.get("start_s").and_then(|v| v.as_f64());
                    let end_s = f.get("end_s").and_then(|v| v.as_f64());

                    if start_s.is_none() || end_s.is_none() || !start_s.unwrap().is_finite() || !end_s.unwrap().is_finite() {
                        errors.push(format!(
                            "Интервал недоступности шлюза #{idx} должен содержать числовые start_s и end_s."
                        ));
                    } else {
                        let st = start_s.unwrap();
                        let en = end_s.unwrap();
                        if !(0.0 <= st && st < en && en <= max_h as f64) {
                            errors.push(format!(
                                "Период недоступности #{idx} для шлюза '{gid}' имеет некорректный интервал [{st}, {en}). Должно выполняться: 0 <= start_s < end_s <= horizon_s ({max_h})."
                            ));
                        }
                    }
                } else {
                    errors.push(format!("Элемент #{idx} в 'gateway_outages' должен быть объектом (dict)."));
                }
            }
        } else {
            errors.push("Поле 'gateway_outages' должно быть списком.".to_string());
        }
    }

    errors
}

pub fn validate_scenario(s: &Scenario) -> Vec<String> {
    let value = serde_json::to_value(s).unwrap_or(serde_json::Value::Null);
    validate_scenario_value(&value)
}
