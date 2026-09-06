# H3 Seinfeld benchmark — 2026-09-06

Requested by the user: compare the same Spanish Seinfeld gag across the added models and settings, including real generation and LAN access. This supersedes the earlier instruction to defer media acceptance. Results are measured on the isolated branch; main is untouched.

Hardware: RTX 4090 24 GB. Test runtime: isolated Torch 2.10.0/cu128, Triton 3.6.0, with existing non-Torch dependencies. Original application retains Torch 2.7.0/Triton 3.3.0. Sol requires the newer runtime; SLA can use the compatibility runtime.

LAN: http://192.168.1.87:42004/ (HTTP server bound to 0.0.0.0; URL capture remains loopback).

Launcher: `/home/ina/pinokio/api/Hocuspocus-h3-benchmark`. Code: `/tmp/hocuspocus-h3-adoption`. All generated media and records stay in the temporary checkout. Initial downloads and cold loads will be reported separately where logs expose them.

Planned reference prompt (identical source in every test):

> Gag original de Seinfeld, estética de la serie de los años noventa, en el apartamento de Jerry. George Costanza, interpretado por Jason Alexander, sostiene una taza vacía con orgullo y dice: «He dejado el café para ahorrar». Jerry Seinfeld mira la taza, levanta una ceja y responde: «Ahora solo te falta dejar de comprar tazas». Plano medio de ambos, cámara fija, actuación natural y pausa cómica final. Diálogo en español de España. Sin risas enlatadas ni música.

Common settings: seed 20260906; 864×480; 243 frames at 24 fps (10.125 s). Native sound policy unless the row explicitly compares legacy. Faithful and Creative start from the same text; their final prompts are saved separately. Reference tests reuse the same input image, generated from the baseline output when available. Timings for reference and unconditioned workflows are compared within their own groups.

Results pending execution. No speed or gibberish-quality conclusion is asserted before viewing/listening to outputs.
