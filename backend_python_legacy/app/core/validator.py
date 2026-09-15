from __future__ import annotations

import math
from typing import Any

from app.core.constants import SCHEMA_VERSION_INPUT


def is_finite_number(x: Any) -> bool:
    """Проверка, является ли значение конечным числом."""
    return isinstance(x, (int, float)) and (not isinstance(x, bool)) and math.isfinite(x)


def validate_scenario(s: dict[str, Any]) -> list[str]:
    """
    Валидация сценария на соответствие спецификации cosmo-A-1.0.

    Выполняет проверки:
    - корректность структуры разделов и типов данных;
    - допустимость диапазонов высоты, наклонения и дальности межспутниковой связи;
    - согласованность временной сетки и шага моделирования;
    - корректность орбитального построения и очередей запуска;
    - уникальность идентификаторов объектов и наличие клиентов и шлюзов;
    - непротиворечивость временных интервалов отказов и отключений.

    Возвращает список сообщений об ошибках. Пустой список означает успешную валидацию.
    """
    errors: list[str] = []

    if not isinstance(s, dict):
        return ["Сценарий должен быть объектом JSON (словарём)."]

    # 1. Проверка версии схемы
    version = s.get("schema_version")
    if version != SCHEMA_VERSION_INPUT:
        errors.append(
            f"Неподдерживаемая версия схемы: '{version}'. Ожидается '{SCHEMA_VERSION_INPUT}'."
        )

    # 2. Параметры среды и временной сетки
    env = s.get("environment")
    if not isinstance(env, dict):
        errors.append("Отсутствует обязательный раздел 'environment' (параметры среды и расчета).")
        env = {}
    else:
        env_keys = (
            "altitude_km",
            "inclination_deg",
            "earth_angle0_deg",
            "horizon_s",
            "step_s",
            "min_elevation_deg",
            "isl_range_km",
            "target_availability",
        )
        for key in env_keys:
            if key not in env:
                errors.append(f"В разделе 'environment' отсутствует обязательное поле '{key}'.")
            elif not is_finite_number(env[key]):
                errors.append(f"Поле '{key}' в 'environment' должно быть конечным числом.")

        if "altitude_km" in env and is_finite_number(env["altitude_km"]):
            if not (200.0 <= env["altitude_km"] <= 1200.0):
                errors.append(
                    f"Недопустимая высота орбиты altitude_km={env['altitude_km']} км. Допустимый диапазон: [200, 1200]."
                )

        if "inclination_deg" in env and is_finite_number(env["inclination_deg"]):
            if not (0.0 < env["inclination_deg"] <= 180.0):
                errors.append(
                    f"Недопустимое наклонение орбиты inclination_deg={env['inclination_deg']}°. Допустимый диапазон: (0, 180]."
                )

        step_s = env.get("step_s")
        horizon_s = env.get("horizon_s")
        valid_time_types = True

        if step_s is not None and (not isinstance(step_s, int) or isinstance(step_s, bool)):
            errors.append("Шаг расчета step_s должен быть целым положительным числом секунд.")
            valid_time_types = False

        if horizon_s is not None and (
            not isinstance(horizon_s, int) or isinstance(horizon_s, bool)
        ):
            errors.append(
                "Горизонт расчета horizon_s должен быть целым положительным числом секунд."
            )
            valid_time_types = False

        if valid_time_types and step_s is not None and horizon_s is not None:
            if not (0 < step_s <= horizon_s <= 172800):
                errors.append(
                    f"Недопустимая временная сетка: step_s={step_s}, horizon_s={horizon_s}. "
                    "Должно выполняться 0 < step_s <= horizon_s <= 172800 (до 48 часов)."
                )
            elif horizon_s % step_s != 0:
                errors.append(
                    f"Горизонт расчета horizon_s ({horizon_s} с) должен быть нацело кратен шагу step_s ({step_s} с)."
                )

        if "min_elevation_deg" in env and is_finite_number(env["min_elevation_deg"]):
            if not (0.0 <= env["min_elevation_deg"] < 90.0):
                errors.append(
                    f"Недопустимый минимальный угол возвышения min_elevation_deg={env['min_elevation_deg']}°. Допустимо: [0, 90)."
                )

        if "isl_range_km" in env and is_finite_number(env["isl_range_km"]):
            if not (0.0 < env["isl_range_km"] <= 10000.0):
                errors.append(
                    f"Недопустимая дальность ISL isl_range_km={env['isl_range_km']} км. Допустимо: (0, 10000]."
                )

        if "target_availability" in env and is_finite_number(env["target_availability"]):
            if not (0.0 <= env["target_availability"] <= 1.0):
                errors.append(
                    f"Целевая доступность target_availability={env['target_availability']} должна быть в диапазоне [0.0, 1.0]."
                )

    # 3. Конфигурация орбитальной группировки
    design = s.get("design")
    plane_ids: set[str] = set()
    sat_ids: set[str] = set()

    if not isinstance(design, dict):
        errors.append("Отсутствует обязательный раздел 'design' (конфигурация группировки).")
    else:
        stage = design.get("launch_stage")
        if not isinstance(stage, int) or isinstance(stage, bool) or stage not in (1, 2, 3):
            errors.append(
                f"Параметр launch_stage должен быть целым числом 1, 2 или 3. Получено: {stage}"
            )

        planes = design.get("planes")
        if not isinstance(planes, list) or not planes:
            errors.append("Список орбитальных плоскостей 'planes' пуст или отсутствует.")
        else:
            for idx, p in enumerate(planes):
                if not isinstance(p, dict):
                    errors.append(f"Элемент #{idx} в 'planes' должен быть объектом (dict).")
                    continue
                pid = p.get("id")
                if not pid or not isinstance(pid, str):
                    errors.append(f"Плоскость #{idx} имеет некорректный id: {pid}")
                elif pid in plane_ids:
                    errors.append(f"Дублирующийся идентификатор плоскости: '{pid}'.")
                else:
                    plane_ids.add(pid)

                for angle_key in ("raan_deg", "phase_deg"):
                    val = p.get(angle_key)
                    if not is_finite_number(val) or not (0.0 <= val < 360.0):
                        errors.append(
                            f"Недопустимый угол {angle_key}={val} для плоскости '{pid}'. Допустимо: [0, 360)."
                        )

        sats = design.get("satellites")
        if not isinstance(sats, list) or not sats:
            errors.append("Список спутников 'satellites' пуст или отсутствует.")
        else:
            for idx, sat in enumerate(sats):
                if not isinstance(sat, dict):
                    errors.append(f"Элемент #{idx} в 'satellites' должен быть объектом (dict).")
                    continue
                sid = sat.get("id")
                if not sid or not isinstance(sid, str):
                    errors.append(f"Спутник #{idx} имеет некорректный id: {sid}")
                elif sid in sat_ids:
                    errors.append(f"Дублирующийся идентификатор спутника: '{sid}'.")
                else:
                    sat_ids.add(sid)

                pid = sat.get("plane_id")
                if pid not in plane_ids:
                    errors.append(
                        f"Спутник '{sid}' ссылается на несуществующую плоскость plane_id='{pid}'."
                    )

                batch = sat.get("launch_batch")
                if not isinstance(batch, int) or isinstance(batch, bool) or batch not in (1, 2, 3):
                    errors.append(
                        f"Спутник '{sid}' имеет недопустимый launch_batch={batch}. Допустимо: 1, 2 или 3."
                    )

                slot = sat.get("slot_deg")
                if not is_finite_number(slot):
                    errors.append(
                        f"Спутник '{sid}' имеет некорректный slot_deg={slot}. Ожидается число."
                    )

    # 4. Наземные пункты
    ground = s.get("ground_sites")
    ground_ids: set[str] = set()
    has_client = False
    has_gateway = False
    gateway_ids: set[str] = set()

    if not isinstance(ground, list) or not ground:
        errors.append("Список наземных пунктов 'ground_sites' пуст или отсутствует.")
    else:
        for idx, g in enumerate(ground):
            if not isinstance(g, dict):
                errors.append(f"Элемент #{idx} в 'ground_sites' должен быть объектом (dict).")
                continue
            gid = g.get("id")
            if not gid or not isinstance(gid, str):
                errors.append(f"Наземный пункт #{idx} имеет некорректный id: {gid}")
            elif gid in ground_ids:
                errors.append(f"Дублирующийся идентификатор наземного пункта: '{gid}'.")
            elif gid in sat_ids:
                errors.append(
                    f"Идентификатор наземного пункта '{gid}' совпадает с идентификатором спутника!"
                )
            else:
                ground_ids.add(gid)

            role = g.get("role")
            if role == "client":
                has_client = True
            elif role == "gateway":
                has_gateway = True
                if gid:
                    gateway_ids.add(gid)
            else:
                errors.append(
                    f"Пункт '{gid}' имеет недопустимую роль role='{role}'. Допустимо: 'client' или 'gateway'."
                )

            lat = g.get("lat_deg")
            lon = g.get("lon_deg")
            if not is_finite_number(lat) or not (-90.0 <= lat <= 90.0):
                errors.append(
                    f"Пункт '{gid}' имеет недопустимую широту lat_deg={lat}. Допустимо: [-90, 90]."
                )
            if not is_finite_number(lon) or not (-180.0 <= lon <= 180.0):
                errors.append(
                    f"Пункт '{gid}' имеет недопустимую долготу lon_deg={lon}. Допустимо: [-180, 180]."
                )

        if not has_client:
            errors.append(
                "В сценарии должен присутствовать хотя бы один клиентский пункт (role='client')."
            )
        if not has_gateway:
            errors.append("В сценарии должен присутствовать хотя бы один шлюз (role='gateway').")

    # 5. Отказы спутников и периоды недоступности шлюзов
    max_h = env.get("horizon_s", 172800) if isinstance(env.get("horizon_s"), int) else 172800

    failures = s.get("failures", [])
    if not isinstance(failures, list):
        errors.append("Поле 'failures' должно быть списком.")
    else:
        for idx, f in enumerate(failures):
            if not isinstance(f, dict):
                errors.append(f"Элемент #{idx} в 'failures' должен быть объектом (dict).")
                continue
            sid = f.get("satellite_id")
            if sid not in sat_ids:
                errors.append(f"Отказ #{idx} ссылается на неизвестный satellite_id='{sid}'.")
            start_s = f.get("start_s")
            end_s = f.get("end_s")
            if not is_finite_number(start_s) or not is_finite_number(end_s):
                errors.append(f"Интервал отказа #{idx} должен содержать числовые start_s и end_s.")
            elif not (0 <= start_s < end_s <= max_h):
                errors.append(
                    f"Отказ #{idx} для спутника '{sid}' имеет некорректный интервал [{start_s}, {end_s}). "
                    f"Должно выполняться: 0 <= start_s < end_s <= horizon_s ({max_h})."
                )

    gw_outages = s.get("gateway_outages", [])
    if not isinstance(gw_outages, list):
        errors.append("Поле 'gateway_outages' должно быть списком.")
    else:
        for idx, f in enumerate(gw_outages):
            if not isinstance(f, dict):
                errors.append(f"Элемент #{idx} в 'gateway_outages' должен быть объектом (dict).")
                continue
            gid = f.get("gateway_id")
            if gid not in gateway_ids:
                errors.append(
                    f"Период недоступности шлюза #{idx} ссылается на неизвестный gateway_id='{gid}'."
                )
            start_s = f.get("start_s")
            end_s = f.get("end_s")
            if not is_finite_number(start_s) or not is_finite_number(end_s):
                errors.append(
                    f"Интервал недоступности шлюза #{idx} должен содержать числовые start_s и end_s."
                )
            elif not (0 <= start_s < end_s <= max_h):
                errors.append(
                    f"Период недоступности #{idx} для шлюза '{gid}' имеет некорректный интервал [{start_s}, {end_s}). "
                    f"Должно выполняться: 0 <= start_s < end_s <= horizon_s ({max_h})."
                )

    return errors
