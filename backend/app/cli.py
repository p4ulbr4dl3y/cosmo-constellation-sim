from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

from app.core.export import export_result
from app.core.routing import RoutingMetric
from app.core.simulator import run_simulation
from app.core.validator import validate_scenario


def print_table(scenario_name: str, result: dict[str, Any], target_sla: float) -> None:
    """Выводит форматированную таблицу доступности связи по клиентам и статистику сбоев."""
    metrics = result.get("client_metrics", {})
    summary = result.get("summary", {})
    total_steps = result.get("total_steps", 0)
    step_s = result.get("step_s", 120)
    overall_sla = summary.get("average_availability_pct", 0.0)

    print("\n" + "=" * 82)
    print(f"  СЦЕНАРИЙ: {scenario_name}")
    print("=" * 82)
    print(
        f"{'Клиент':<8} | {'Всего':<6} | {'Связь':<6} | {'Отказ':<6} | {'SLA (%)':<9} | {'Цель':<6} | {'Статус':<8} | {'Макс.обрыв':<12}"
    )
    print("-" * 82)

    total_failures: dict[str, int] = {}
    for cid, m in metrics.items():
        avail = m.get("availability_pct", 0.0)
        avail_ratio = m.get("availability_ratio", 0.0)
        up = int(round(avail_ratio * total_steps))
        down = total_steps - up
        max_d = m.get("max_outage_s", 0)
        status_str = "OK" if m.get("meets_target", False) else "FAIL"

        print(
            f"{cid:<8} | {total_steps:<6} | {up:<6} | {down:<6} | {avail:>8.2f}% | {target_sla * 100:>5.1f}% | {status_str:<8} | {max_d:>8} с"
        )

        for rk, rv in m.get("failure_breakdown", {}).items():
            total_failures[rk] = total_failures.get(rk, 0) + rv

    print("-" * 82)
    avg_str = "ДОСТИГНУТА" if summary.get("all_meet_target", False) else "НЕ ДОСТИГНУТА"
    print(
        f"Средняя доступность: {overall_sla:.2f}% | Цель: {target_sla * 100:.1f}% | Итог: {avg_str}"
    )

    if any(total_failures.values()):
        print("\nРаспределение причин отказов (шагов по клиентам):")
        labels = {
            "no_client_satellite": "Клиент вне зоны видимости КА",
            "gateway_offline": "Шлюз выключен (плановый отказ)",
            "no_gateway_satellite": "Шлюз вне зоны видимости КА",
            "isl_disconnected": "Разрыв цепочки межспутниковых линков",
        }
        for k, label in labels.items():
            cnt = total_failures.get(k, 0)
            if cnt > 0:
                print(f"  - {label:<42}: {cnt} шагов ({cnt * step_s} с)")
    print("=" * 82 + "\n")


def process_scenario(
    path: Path,
    metric: RoutingMetric = "hops",
    export_path: Path | None = None,
) -> bool:
    """Выполняет загрузку, валидацию и моделирование переданного сценария."""
    if not path.exists():
        print(f"Ошибка: файл '{path}' не найден.", file=sys.stderr)
        return False

    try:
        scenario = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Ошибка чтения JSON '{path}': {e}", file=sys.stderr)
        return False

    errors = validate_scenario(scenario)
    if errors:
        print(f"Ошибки валидации в '{path.name}':", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return False

    target_sla = float(scenario.get("environment", {}).get("target_availability", 0.90))

    t0 = time.perf_counter()
    res = run_simulation(scenario, metric=metric, include_timeline=False)
    calc_time = (time.perf_counter() - t0) * 1000

    print_table(path.name, res, target_sla)
    print(f"Время расчета: {calc_time:.1f} мс")

    if export_path:
        exported = export_result(
            scenario,
            metric=metric,
            routes=res["routes"],
            client_metrics=res["client_metrics"],
            summary=res["summary"],
        )
        export_path.write_text(json.dumps(exported, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Результат экспортирован в: {export_path}")

    return res.get("summary", {}).get("all_meet_target", False)


def main() -> None:
    """Консольный интерфейс для запуска моделирования и анализа доступности созвездия."""
    parser = argparse.ArgumentParser(
        description="Cosmo Constellation Simulator CLI - расчет орбитальной доступности (КосмоХакатон 2026)"
    )
    parser.add_argument(
        "--scenario",
        "-s",
        type=Path,
        help="Путь к файлу сценария cosmo-A-1.0",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Запустить расчет по всем эталонным сценариям из директории 'data/'",
    )
    parser.add_argument(
        "--metric",
        "-m",
        choices=["hops", "distance", "delay"],
        default="hops",
        help="Критерий маршрутизации: hops - минимальное число хопов; distance/delay - минимальное расстояние.",
    )
    parser.add_argument(
        "--export",
        "-e",
        type=Path,
        help="Сохранить результат в файл формата cosmo-A-result-1.0",
    )

    args = parser.parse_args()
    metric: RoutingMetric = "distance" if args.metric in ("distance", "delay") else "hops"

    if args.all:
        candidates = [
            Path("data"),
            Path("../data"),
            Path("Данные"),
            Path("../Данные"),
        ]
        data_dir = next((c for c in candidates if c.exists() and c.is_dir()), None)
        if not data_dir:
            print("Ошибка: папка 'data/' не найдена.", file=sys.stderr)
            sys.exit(1)

        scenarios = sorted(data_dir.glob("*.json"))
        if not scenarios:
            print(f"Нет JSON файлов в '{data_dir}/'.", file=sys.stderr)
            sys.exit(1)

        for sc in scenarios:
            process_scenario(sc, metric=metric)
        sys.exit(0)

    if not args.scenario:
        parser.print_help()
        sys.exit(1)

    ok = process_scenario(args.scenario, metric=metric, export_path=args.export)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
