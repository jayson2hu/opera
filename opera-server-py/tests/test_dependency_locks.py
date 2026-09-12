"""Keep reproducible dependency installation guarded against manifest drift."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest


spec = importlib.util.spec_from_file_location(
    "check_dependency_locks",
    Path(__file__).resolve().parents[1] / "scripts" / "check_dependency_locks.py",
)
assert spec and spec.loader
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


@pytest.mark.parametrize("entry", ["demo>=1.0 --hash=sha256:" + "a" * 64, "demo==1.0", "demo==1.0 --hash=sha256:bad"])
def test_lock_rejects_unpinned_or_unhashed_requirements(tmp_path, entry):
    lock = tmp_path / "requirements.lock"
    lock.write_text(entry)
    with pytest.raises(ValueError):
        checker.read_lock(lock)


def test_lock_check_rejects_manifest_version_drift():
    with pytest.raises(ValueError, match="does not satisfy"):
        checker.check_closure(["demo>=2"], {"demo": "1.0"})


def test_lock_check_traverses_extras_and_rejects_unneeded_dependencies(monkeypatch):
    packages = {
        "demo": SimpleNamespace(version="1.0", requires=['extra-dependency>=2; extra == "feature"']),
        "extra-dependency": SimpleNamespace(version="2.0", requires=[]),
    }
    monkeypatch.setattr(checker, "distribution", packages.__getitem__)
    lock = {"demo": "1.0", "extra-dependency": "2.0"}
    checker.check_closure(["demo[feature]>=1"], lock)
    with pytest.raises(ValueError, match="not required by the manifest"):
        checker.check_closure(["demo>=1"], lock)
