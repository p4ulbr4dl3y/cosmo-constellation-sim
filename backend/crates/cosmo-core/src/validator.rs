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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn valid_scenario_json() -> serde_json::Value {
        json!({
            "schema_version": "cosmo-A-1.0",
            "environment": {
                "altitude_km": 600.0,
                "inclination_deg": 80.0,
                "earth_angle0_deg": 0.0,
                "horizon_s": 3600,
                "step_s": 60,
                "min_elevation_deg": 10.0,
                "isl_range_km": 3000.0,
                "target_availability": 0.9
            },
            "design": {
                "launch_stage": 1,
                "planes": [
                    { "id": "P1", "raan_deg": 0.0, "phase_deg": 0.0 }
                ],
                "satellites": [
                    { "id": "SAT1", "plane_id": "P1", "launch_batch": 1, "slot_deg": 0.0 }
                ]
            },
            "ground_sites": [
                { "id": "C1", "name": "Client 1", "role": "client", "lat_deg": 65.0, "lon_deg": 40.0 },
                { "id": "G1", "name": "Gateway 1", "role": "gateway", "lat_deg": 68.0, "lon_deg": 33.0 }
            ],
            "failures": [],
            "gateway_outages": []
        })
    }

    #[test]
    fn test_valid_scenario_passes() {
        let scenario_val = valid_scenario_json();
        let errs = validate_scenario_value(&scenario_val);
        assert!(errs.is_empty(), "Expected clean validation, got: {:?}", errs);
    }

    #[test]
    fn test_non_object_scenario() {
        assert!(!validate_scenario_value(&json!(42)).is_empty());
        assert!(!validate_scenario_value(&json!("string")).is_empty());
        assert!(!validate_scenario_value(&json!(null)).is_empty());
        assert!(!validate_scenario_value(&json!([1, 2, 3])).is_empty());
    }

    #[test]
    fn test_invalid_schema_version() {
        let mut s = valid_scenario_json();
        s["schema_version"] = json!("invalid-schema-2.0");
        let errs = validate_scenario_value(&s);
        assert!(errs.iter().any(|e| e.contains("Неподдерживаемая версия схемы")));

        let mut s_missing = valid_scenario_json();
        s_missing.as_object_mut().unwrap().remove("schema_version");
        let errs_m = validate_scenario_value(&s_missing);
        assert!(errs_m.iter().any(|e| e.contains("Неподдерживаемая версия схемы")));
    }

    #[test]
    fn test_environment_missing_or_invalid() {
        let mut s = valid_scenario_json();
        s.as_object_mut().unwrap().remove("environment");
        let errs = validate_scenario_value(&s);
        assert!(errs.iter().any(|e| e.contains("Отсутствует обязательный раздел 'environment'")));

        let mut s_not_obj = valid_scenario_json();
        s_not_obj["environment"] = json!(123);
        let errs_obj = validate_scenario_value(&s_not_obj);
        assert!(errs_obj.iter().any(|e| e.contains("Отсутствует обязательный раздел 'environment'")));
    }

    #[test]
    fn test_environment_missing_keys_and_non_finite() {
        let mut s = valid_scenario_json();
        s["environment"].as_object_mut().unwrap().remove("altitude_km");
        let errs = validate_scenario_value(&s);
        assert!(errs.iter().any(|e| e.contains("отсутствует обязательное поле 'altitude_km'")));

        let mut s_non_num = valid_scenario_json();
        s_non_num["environment"]["altitude_km"] = json!("six_hundred");
        let errs_nn = validate_scenario_value(&s_non_num);
        assert!(errs_nn.iter().any(|e| e.contains("должно быть конечным числом")));
    }

    #[test]
    fn test_altitude_km_boundaries() {
        let mut s_low = valid_scenario_json();
        s_low["environment"]["altitude_km"] = json!(199.9);
        assert!(!validate_scenario_value(&s_low).is_empty());

        let mut s_high = valid_scenario_json();
        s_high["environment"]["altitude_km"] = json!(1200.1);
        assert!(!validate_scenario_value(&s_high).is_empty());

        let mut s_min = valid_scenario_json();
        s_min["environment"]["altitude_km"] = json!(200.0);
        assert!(validate_scenario_value(&s_min).is_empty());

        let mut s_max = valid_scenario_json();
        s_max["environment"]["altitude_km"] = json!(1200.0);
        assert!(validate_scenario_value(&s_max).is_empty());
    }

    #[test]
    fn test_inclination_deg_boundaries() {
        let mut s_zero = valid_scenario_json();
        s_zero["environment"]["inclination_deg"] = json!(0.0);
        assert!(!validate_scenario_value(&s_zero).is_empty());

        let mut s_neg = valid_scenario_json();
        s_neg["environment"]["inclination_deg"] = json!(-5.0);
        assert!(!validate_scenario_value(&s_neg).is_empty());

        let mut s_high = valid_scenario_json();
        s_high["environment"]["inclination_deg"] = json!(180.1);
        assert!(!validate_scenario_value(&s_high).is_empty());

        let mut s_max = valid_scenario_json();
        s_max["environment"]["inclination_deg"] = json!(180.0);
        assert!(validate_scenario_value(&s_max).is_empty());
    }

    #[test]
    fn test_step_s_and_horizon_s_boundaries() {
        let mut s_step_float = valid_scenario_json();
        s_step_float["environment"]["step_s"] = json!(60.5);
        let errs1 = validate_scenario_value(&s_step_float);
        assert!(errs1.iter().any(|e| e.contains("step_s должен быть целым")));

        let mut s_horiz_float = valid_scenario_json();
        s_horiz_float["environment"]["horizon_s"] = json!(3600.5);
        let errs2 = validate_scenario_value(&s_horiz_float);
        assert!(errs2.iter().any(|e| e.contains("horizon_s должен быть целым")));

        let mut s_step_zero = valid_scenario_json();
        s_step_zero["environment"]["step_s"] = json!(0);
        assert!(!validate_scenario_value(&s_step_zero).is_empty());

        let mut s_step_gt_horiz = valid_scenario_json();
        s_step_gt_horiz["environment"]["step_s"] = json!(7200);
        s_step_gt_horiz["environment"]["horizon_s"] = json!(3600);
        assert!(!validate_scenario_value(&s_step_gt_horiz).is_empty());

        let mut s_horiz_too_large = valid_scenario_json();
        s_horiz_too_large["environment"]["horizon_s"] = json!(200000);
        assert!(!validate_scenario_value(&s_horiz_too_large).is_empty());

        let mut s_not_multiple = valid_scenario_json();
        s_not_multiple["environment"]["step_s"] = json!(7);
        s_not_multiple["environment"]["horizon_s"] = json!(100);
        let errs3 = validate_scenario_value(&s_not_multiple);
        assert!(errs3.iter().any(|e| e.contains("должен быть нацело кратен")));
    }

    #[test]
    fn test_min_elevation_deg_boundaries() {
        let mut s_neg = valid_scenario_json();
        s_neg["environment"]["min_elevation_deg"] = json!(-0.1);
        assert!(!validate_scenario_value(&s_neg).is_empty());

        let mut s_90 = valid_scenario_json();
        s_90["environment"]["min_elevation_deg"] = json!(90.0);
        assert!(!validate_scenario_value(&s_90).is_empty());

        let mut s_valid = valid_scenario_json();
        s_valid["environment"]["min_elevation_deg"] = json!(0.0);
        assert!(validate_scenario_value(&s_valid).is_empty());
    }

    #[test]
    fn test_isl_range_km_boundaries() {
        let mut s_zero = valid_scenario_json();
        s_zero["environment"]["isl_range_km"] = json!(0.0);
        assert!(!validate_scenario_value(&s_zero).is_empty());

        let mut s_high = valid_scenario_json();
        s_high["environment"]["isl_range_km"] = json!(10000.1);
        assert!(!validate_scenario_value(&s_high).is_empty());

        let mut s_max = valid_scenario_json();
        s_max["environment"]["isl_range_km"] = json!(10000.0);
        assert!(validate_scenario_value(&s_max).is_empty());
    }

    #[test]
    fn test_target_availability_boundaries() {
        let mut s_neg = valid_scenario_json();
        s_neg["environment"]["target_availability"] = json!(-0.1);
        assert!(!validate_scenario_value(&s_neg).is_empty());

        let mut s_high = valid_scenario_json();
        s_high["environment"]["target_availability"] = json!(1.1);
        assert!(!validate_scenario_value(&s_high).is_empty());

        let mut s_valid = valid_scenario_json();
        s_valid["environment"]["target_availability"] = json!(1.0);
        assert!(validate_scenario_value(&s_valid).is_empty());
    }

    #[test]
    fn test_design_boundaries() {
        let mut s_no_des = valid_scenario_json();
        s_no_des.as_object_mut().unwrap().remove("design");
        assert!(!validate_scenario_value(&s_no_des).is_empty());

        let mut s_des_not_obj = valid_scenario_json();
        s_des_not_obj["design"] = json!("not_obj");
        assert!(!validate_scenario_value(&s_des_not_obj).is_empty());

        let mut s_stage = valid_scenario_json();
        s_stage["design"]["launch_stage"] = json!(4);
        assert!(!validate_scenario_value(&s_stage).is_empty());

        let mut s_no_planes = valid_scenario_json();
        s_no_planes["design"]["planes"] = json!([]);
        assert!(!validate_scenario_value(&s_no_planes).is_empty());

        let mut s_plane_not_obj = valid_scenario_json();
        s_plane_not_obj["design"]["planes"] = json!([123]);
        assert!(!validate_scenario_value(&s_plane_not_obj).is_empty());

        let mut s_plane_bad_id = valid_scenario_json();
        s_plane_bad_id["design"]["planes"] = json!([{ "id": "", "raan_deg": 0.0, "phase_deg": 0.0 }]);
        assert!(!validate_scenario_value(&s_plane_bad_id).is_empty());

        let mut s_plane_dup_id = valid_scenario_json();
        s_plane_dup_id["design"]["planes"] = json!([
            { "id": "P1", "raan_deg": 0.0, "phase_deg": 0.0 },
            { "id": "P1", "raan_deg": 10.0, "phase_deg": 0.0 }
        ]);
        assert!(!validate_scenario_value(&s_plane_dup_id).is_empty());

        let mut s_plane_bad_raan = valid_scenario_json();
        s_plane_bad_raan["design"]["planes"] = json!([{ "id": "P1", "raan_deg": 360.0, "phase_deg": 0.0 }]);
        assert!(!validate_scenario_value(&s_plane_bad_raan).is_empty());

        let mut s_no_sats = valid_scenario_json();
        s_no_sats["design"]["satellites"] = json!([]);
        assert!(!validate_scenario_value(&s_no_sats).is_empty());

        let mut s_sat_not_obj = valid_scenario_json();
        s_sat_not_obj["design"]["satellites"] = json!([123]);
        assert!(!validate_scenario_value(&s_sat_not_obj).is_empty());

        let mut s_sat_bad_id = valid_scenario_json();
        s_sat_bad_id["design"]["satellites"] = json!([{ "id": "", "plane_id": "P1", "launch_batch": 1, "slot_deg": 0.0 }]);
        assert!(!validate_scenario_value(&s_sat_bad_id).is_empty());

        let mut s_sat_dup_id = valid_scenario_json();
        s_sat_dup_id["design"]["satellites"] = json!([
            { "id": "SAT1", "plane_id": "P1", "launch_batch": 1, "slot_deg": 0.0 },
            { "id": "SAT1", "plane_id": "P1", "launch_batch": 1, "slot_deg": 10.0 }
        ]);
        assert!(!validate_scenario_value(&s_sat_dup_id).is_empty());

        let mut s_sat_unknown_plane = valid_scenario_json();
        s_sat_unknown_plane["design"]["satellites"] = json!([
            { "id": "SAT1", "plane_id": "P99", "launch_batch": 1, "slot_deg": 0.0 }
        ]);
        assert!(!validate_scenario_value(&s_sat_unknown_plane).is_empty());

        let mut s_sat_bad_batch = valid_scenario_json();
        s_sat_bad_batch["design"]["satellites"] = json!([
            { "id": "SAT1", "plane_id": "P1", "launch_batch": 5, "slot_deg": 0.0 }
        ]);
        assert!(!validate_scenario_value(&s_sat_bad_batch).is_empty());

        let mut s_sat_bad_slot = valid_scenario_json();
        s_sat_bad_slot["design"]["satellites"] = json!([
            { "id": "SAT1", "plane_id": "P1", "launch_batch": 1, "slot_deg": "invalid" }
        ]);
        assert!(!validate_scenario_value(&s_sat_bad_slot).is_empty());
    }

    #[test]
    fn test_ground_sites_boundaries() {
        let mut s_no_gs = valid_scenario_json();
        s_no_gs.as_object_mut().unwrap().remove("ground_sites");
        assert!(!validate_scenario_value(&s_no_gs).is_empty());

        let mut s_gs_not_obj = valid_scenario_json();
        s_gs_not_obj["ground_sites"] = json!([123]);
        assert!(!validate_scenario_value(&s_gs_not_obj).is_empty());

        let mut s_gs_bad_id = valid_scenario_json();
        s_gs_bad_id["ground_sites"] = json!([
            { "id": "", "role": "client", "lat_deg": 0.0, "lon_deg": 0.0 }
        ]);
        assert!(!validate_scenario_value(&s_gs_bad_id).is_empty());

        let mut s_gs_dup_id = valid_scenario_json();
        s_gs_dup_id["ground_sites"] = json!([
            { "id": "C1", "role": "client", "lat_deg": 0.0, "lon_deg": 0.0 },
            { "id": "C1", "role": "gateway", "lat_deg": 1.0, "lon_deg": 1.0 }
        ]);
        assert!(!validate_scenario_value(&s_gs_dup_id).is_empty());

        let mut s_gs_same_sat_id = valid_scenario_json();
        s_gs_same_sat_id["ground_sites"] = json!([
            { "id": "SAT1", "role": "client", "lat_deg": 0.0, "lon_deg": 0.0 },
            { "id": "G1", "role": "gateway", "lat_deg": 1.0, "lon_deg": 1.0 }
        ]);
        assert!(!validate_scenario_value(&s_gs_same_sat_id).is_empty());

        let mut s_gs_bad_role = valid_scenario_json();
        s_gs_bad_role["ground_sites"] = json!([
            { "id": "C1", "role": "unknown_role", "lat_deg": 0.0, "lon_deg": 0.0 },
            { "id": "G1", "role": "gateway", "lat_deg": 1.0, "lon_deg": 1.0 }
        ]);
        assert!(!validate_scenario_value(&s_gs_bad_role).is_empty());

        let mut s_gs_bad_lat = valid_scenario_json();
        s_gs_bad_lat["ground_sites"] = json!([
            { "id": "C1", "role": "client", "lat_deg": 95.0, "lon_deg": 0.0 },
            { "id": "G1", "role": "gateway", "lat_deg": 1.0, "lon_deg": 1.0 }
        ]);
        assert!(!validate_scenario_value(&s_gs_bad_lat).is_empty());

        let mut s_gs_bad_lon = valid_scenario_json();
        s_gs_bad_lon["ground_sites"] = json!([
            { "id": "C1", "role": "client", "lat_deg": 0.0, "lon_deg": 185.0 },
            { "id": "G1", "role": "gateway", "lat_deg": 1.0, "lon_deg": 1.0 }
        ]);
        assert!(!validate_scenario_value(&s_gs_bad_lon).is_empty());

        let mut s_no_client = valid_scenario_json();
        s_no_client["ground_sites"] = json!([
            { "id": "G1", "role": "gateway", "lat_deg": 0.0, "lon_deg": 0.0 }
        ]);
        let errs_no_c = validate_scenario_value(&s_no_client);
        assert!(errs_no_c.iter().any(|e| e.contains("role='client'")));

        let mut s_no_gw = valid_scenario_json();
        s_no_gw["ground_sites"] = json!([
            { "id": "C1", "role": "client", "lat_deg": 0.0, "lon_deg": 0.0 }
        ]);
        let errs_no_g = validate_scenario_value(&s_no_gw);
        assert!(errs_no_g.iter().any(|e| e.contains("role='gateway'")));
    }

    #[test]
    fn test_failures_and_gateway_outages_boundaries() {
        let mut s_fail_not_arr = valid_scenario_json();
        s_fail_not_arr["failures"] = json!("not_an_array");
        assert!(!validate_scenario_value(&s_fail_not_arr).is_empty());

        let mut s_fail_item_not_obj = valid_scenario_json();
        s_fail_item_not_obj["failures"] = json!([123]);
        assert!(!validate_scenario_value(&s_fail_item_not_obj).is_empty());

        let mut s_fail_bad_sat = valid_scenario_json();
        s_fail_bad_sat["failures"] = json!([
            { "satellite_id": "SAT999", "start_s": 0.0, "end_s": 100.0 }
        ]);
        assert!(!validate_scenario_value(&s_fail_bad_sat).is_empty());

        let mut s_fail_bad_times = valid_scenario_json();
        s_fail_bad_times["failures"] = json!([
            { "satellite_id": "SAT1", "start_s": "abc", "end_s": 100.0 }
        ]);
        assert!(!validate_scenario_value(&s_fail_bad_times).is_empty());

        let mut s_fail_invalid_interval = valid_scenario_json();
        s_fail_invalid_interval["failures"] = json!([
            { "satellite_id": "SAT1", "start_s": 100.0, "end_s": 50.0 }
        ]);
        assert!(!validate_scenario_value(&s_fail_invalid_interval).is_empty());

        let mut s_gw_not_arr = valid_scenario_json();
        s_gw_not_arr["gateway_outages"] = json!("not_an_array");
        assert!(!validate_scenario_value(&s_gw_not_arr).is_empty());

        let mut s_gw_item_not_obj = valid_scenario_json();
        s_gw_item_not_obj["gateway_outages"] = json!([123]);
        assert!(!validate_scenario_value(&s_gw_item_not_obj).is_empty());

        let mut s_gw_bad_gw = valid_scenario_json();
        s_gw_bad_gw["gateway_outages"] = json!([
            { "gateway_id": "G999", "start_s": 0.0, "end_s": 100.0 }
        ]);
        assert!(!validate_scenario_value(&s_gw_bad_gw).is_empty());

        let mut s_gw_bad_times = valid_scenario_json();
        s_gw_bad_times["gateway_outages"] = json!([
            { "gateway_id": "G1", "start_s": 0.0, "end_s": "xyz" }
        ]);
        assert!(!validate_scenario_value(&s_gw_bad_times).is_empty());

        let mut s_gw_invalid_interval = valid_scenario_json();
        s_gw_invalid_interval["gateway_outages"] = json!([
            { "gateway_id": "G1", "start_s": 0.0, "end_s": 4000.0 } // horizon is 3600
        ]);
        assert!(!validate_scenario_value(&s_gw_invalid_interval).is_empty());
    }

    #[test]
    fn test_validate_scenario_struct_helper() {
        let s_val = valid_scenario_json();
        let scenario: Scenario = serde_json::from_value(s_val).unwrap();
        assert!(validate_scenario(&scenario).is_empty());
    }
}

