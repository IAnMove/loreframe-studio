"""Sample local benchmark memory without allocating CUDA tensors in the client.

RSS includes shared pages, PSS apportions them. GPU process usage includes
allocator reservations. Sampled peaks are lower bounds, not minimum requirements.
"""
from __future__ import annotations
import json
import threading
import time
from pathlib import Path


class MemorySampler:
    def __init__(self, pid: int, folder: Path):
        import psutil
        import pynvml
        self.psutil, self.nvml = psutil, pynvml
        self.process = psutil.Process(pid)
        self.folder = folder
        self.stop_event = threading.Event()
        self.peaks = {}
        self.errors = []
        self.samples = 0
        self.gpus = []
        try:
            pynvml.nvmlInit()
            self.gpus = [pynvml.nvmlDeviceGetHandleByIndex(i)
                         for i in range(pynvml.nvmlDeviceGetCount())]
        except Exception as error:
            self.errors.append(str(error))
        self.thread = threading.Thread(target=self._run, daemon=True)

    def sample(self):
        processes = [self.process] + self.process.children(recursive=True)
        pids = {p.pid for p in processes}
        data = {'time': time.time(), 'process_rss_bytes': 0,
                'process_pss_bytes': 0, 'process_swap_bytes': 0}
        for process in processes:
            try:
                memory = process.memory_full_info()
                data['process_rss_bytes'] += memory.rss
                data['process_pss_bytes'] += getattr(memory, 'pss', 0)
                data['process_swap_bytes'] += getattr(memory, 'swap', 0)
            except self.psutil.NoSuchProcess:
                continue
        ram = self.psutil.virtual_memory()
        data['system_ram_unavailable_bytes'] = ram.total - ram.available
        data['system_swap_used_bytes'] = self.psutil.swap_memory().used
        for index, gpu in enumerate(self.gpus):
            memory = self.nvml.nvmlDeviceGetMemoryInfo(gpu)
            data[f'gpu{index}_total_used_bytes'] = memory.used
            processes = self.nvml.nvmlDeviceGetComputeRunningProcesses(gpu)
            amounts = [p.usedGpuMemory for p in processes if p.pid in pids
                       and isinstance(p.usedGpuMemory, int) and p.usedGpuMemory <= memory.total]
            data[f'gpu{index}_process_used_bytes'] = sum(amounts)
        return data

    def _run(self):
        self.folder.mkdir(parents=True, exist_ok=True)
        with (self.folder / 'memory-samples.jsonl').open('a') as stream:
            while not self.stop_event.is_set():
                try:
                    data = self.sample()
                    for name, value in data.items():
                        if name != 'time':
                            self.peaks[name] = max(self.peaks.get(name, 0), value)
                    if self.samples == 0:
                        (self.folder / 'memory-baseline.json').write_text(json.dumps(data, indent=2))
                    stream.write(json.dumps(data) + '\n')
                    stream.flush()
                    self.samples += 1
                except Exception as error:
                    if str(error) not in self.errors:
                        self.errors.append(str(error))
                self.stop_event.wait(1)

    def start(self):
        self.thread.start()

    def finish(self):
        self.stop_event.set()
        self.thread.join(timeout=10)
        result = {'pid': self.process.pid, 'interval_seconds': 1,
                  'samples': self.samples, 'peak_bytes': self.peaks, 'errors': self.errors,
                  'note': 'Sampled observed usage, not a guaranteed hardware minimum. System totals include other apps; process totals include children. RSS can double count shared pages.'}
        (self.folder / 'memory.json').write_text(json.dumps(result, indent=2))
        return result
