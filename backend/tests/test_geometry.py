import json
from pathlib import Path
import numpy as np
import pytest

from app.core.geometry import compute_positions, snapshot as app_snapshot


def get_ref_geometry():
    import sys

    candidates = [
        Path.cwd() / "reference",
        Path.cwd().parent / "reference",
        Path(__file__).resolve().parents[2] / "reference",
        Path(__file__).resolve().parents[1] / "reference",
        Path.cwd() / "Расчетный модуль",
        Path.cwd().parent / "Расчетный модуль",
        Path(__file__).resolve().parents[2] / "Расчетный модуль",
        Path(__file__).resolve().parents[1] / "Расчетный модуль",
    ]
    for c in candidates:
        if c.exists():
            if str(c) not in sys.path:
                sys.path.insert(0, str(c))
            import geometry as ref

            return ref
    raise FileNotFoundError("Reference geometry module not found")


def get_preset_path(name: str) -> Path:
    candidates = [
        Path.cwd() / "data" / name,
        Path.cwd().parent / "data" / name,
        Path(__file__).resolve().parents[2] / "data" / name,
        Path(__file__).resolve().parents[1] / "data" / name,
        Path.cwd() / "Данные" / name,
        Path.cwd().parent / "Данные" / name,
        Path(__file__).resolve().parents[2] / "Данные" / name,
        Path(__file__).resolve().parents[1] / "Данные" / name,
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError(f"Preset {name} not found")


def test_positions_exact_match():
    ref = get_ref_geometry()
    path = get_preset_path("01_full_constellation.json")
    scenario = json.loads(path.read_text(encoding="utf-8"))

    for t_s in [0.0, 120.0, 3600.0, 43200.0, 86280.0]:
        ref_ids, ref_xyz, ref_fixed = ref.positions(scenario, t_s)
        app_ids, app_xyz, app_fixed = compute_positions(scenario, t_s)

        assert ref_ids == app_ids
        np.testing.assert_allclose(ref_xyz, app_xyz, rtol=1e-12, atol=1e-10)
        np.testing.assert_allclose(ref_fixed, app_fixed, rtol=1e-12, atol=1e-10)


def test_snapshot_exact_match():
    ref = get_ref_geometry()
    path = get_preset_path("01_full_constellation.json")
    scenario = json.loads(path.read_text(encoding="utf-8"))

    for t_s in [0.0, 1200.0, 86280.0]:
        ref_snap = ref.snapshot(scenario, t_s)
        app_snap = app_snapshot(scenario, t_s)

        # Edges count and content
        ref_edges_set = {(e[0], e[1]) for e in ref_snap["edges"]}
        app_edges_set = {(e[0], e[1]) for e in app_snap["edges"]}
        assert ref_edges_set == app_edges_set

        # Elevation angles
        for gid in ref_snap["elevation_deg"]:
            assert gid in app_snap["elevation_deg"]
            for sid, el in ref_snap["elevation_deg"][gid].items():
                app_el = app_snap["elevation_deg"][gid][sid]
                assert pytest.approx(el, rel=1e-7, abs=1e-7) == app_el
