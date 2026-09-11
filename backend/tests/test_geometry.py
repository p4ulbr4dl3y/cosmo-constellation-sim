import json
from pathlib import Path
import numpy as np
import pytest

from app.core.geometry import compute_positions, snapshot as app_snapshot


def get_ref_geometry():
    import sys
    ref_dir = Path(__file__).resolve().parents[3] / "Расчетный модуль"
    if not ref_dir.exists():
        ref_dir = Path.cwd().parent / "Расчетный модуль"
    if str(ref_dir) not in sys.path:
        sys.path.insert(0, str(ref_dir))
    import geometry as ref
    return ref


def get_preset_path(name: str) -> Path:
    candidates = [
        Path.cwd() / "Данные" / name,
        Path.cwd().parent / "Данные" / name,
        Path(__file__).resolve().parents[3] / "Данные" / name,
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
