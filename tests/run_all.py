"""
Jalankan semua pengujian: python tests/run_all.py

  test_unit.py         42 pengecekan: wallet & seed, mining, PoW, deteksi manipulasi, aturan fork, perbaikan chain
  test_concurrency.py   1 pengecekan: 3 proses menulis blok bersamaan, tidak ada yang hilang
  test_cli_extra.py    14 pengecekan: menu wallet lain dan launcher
  test_network.py      24 pengecekan: 3 node sungguhan (port 8341-8343) membentuk complete graph, fork, sinkronisasi

Data uji dibuat di folder sementara, jadi wallet asli di Database/ tidak tersentuh.
Matikan node lain yang memakai port 8341-8343 sebelum menjalankan test_network.py.
"""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = ["test_unit", "test_concurrency", "test_cli_extra", "test_network"]


def main():
    passed = failed = 0
    with tempfile.TemporaryDirectory(prefix="k-chain-tests-") as scratch:
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
        for name in TESTS:
            print(f"=== {name}", flush=True)
            run = subprocess.run([sys.executable, os.path.join(ROOT, "tests", f"{name}.py"), ROOT,
                                  os.path.join(scratch, name)], env=env, capture_output=True, text=True,
                                 encoding="utf-8", errors="replace")
            lines = run.stdout.splitlines()
            ok = sum(line.startswith("PASS") for line in lines)
            bad = [line for line in lines if line.startswith("FAIL")]
            passed, failed = passed + ok, failed + len(bad)
            print(f"    {ok} passed, {len(bad)} failed (exit {run.returncode})")
            for line in bad:
                print("    " + line)
            if run.returncode and not bad:
                print(run.stdout[-2000:], run.stderr[-2000:])
                failed += 1
    print(f"\nTotal: {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
