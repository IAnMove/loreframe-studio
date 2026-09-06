"""Ensure repeated benchmark monitoring never submits duplicate GPU jobs."""
import importlib.util
import json
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('h3_benchmark_client', Path(__file__).resolve().parents[1] / 'app/scripts/benchmark_h3.py')
client = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(client)


def test_existing_result_keeps_original_measurement(tmp_path):
    row = client.matrix()[0]
    folder = tmp_path / row['id']
    folder.mkdir()
    expected = {'result': {'status': 'completed'}, 'memory': {'samples': 43}}
    (folder / 'result.json').write_text(json.dumps(expected))
    with patch.object(client, 'request', side_effect=AssertionError('must not submit')):
        assert client.run_row('unused', tmp_path, row, server_pid=99999999) == expected


def test_reattach_uses_recorded_job(tmp_path):
    row = client.matrix()[0]
    folder = tmp_path / row['id']
    folder.mkdir()
    active = {'job_id': 'still-running', 'started_at': 10}
    (folder / 'active.json').write_text(json.dumps(active))
    with patch.object(client, 'request', side_effect=AssertionError('must not submit')), patch.object(client, 'monitor_job', return_value={'reattached': True}) as monitor:
        assert client.run_row('unused', tmp_path, row) == {'reattached': True}
    monitor.assert_called_once_with('unused', folder, row, active)
