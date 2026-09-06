"""Shared H3 writing and audio policy; no runtime or provider imports."""
from __future__ import annotations

import re

STYLES = {"faithful", "creative"}
AUDIO_POLICIES = {"native", "legacy"}


def planning_style(value: str | None) -> str:
    style = str(value or "faithful").strip().lower()
    if style not in STYLES:
        raise ValueError("H3 planning_style must be faithful or creative")
    return style


def audio_policy(value: str | None) -> str:
    policy = str(value or "native").strip().lower()
    if policy not in AUDIO_POLICIES:
        raise ValueError("H3 audio policy must be native or legacy")
    return policy


def writing_contract(style: str = "faithful") -> str:
    creative = planning_style(style) == "creative"
    return (
        "WRITING MODE (takes precedence over generic expansion advice): "
        + ("CREATIVE. Develop causal action and natural supporting dialogue for interacting characters. "
           if creative else "FAITHFUL. Preserve the requested events and exact dialogue; do not add extra spoken lines when literal lines were supplied. ")
        + "Preserve exact actor/character portrayal, franchise, era, wardrobe and outcome. "
        "Never blend adaptations or invent powers. Every literal line is immutable, in its original language, "
        "and spoken once by its assigned person. If the user asks for speech without words, write actual "
        "short meaningful lines, not 'they discuss' or background chatter. Explicit silence and 'only these lines' "
        "override creative freedom. Visible signs/titles are not spoken dialogue. Budget the total speech "
        "across all speakers for the real duration (about two words/second). Do not fill unused time with speech. "
        "Use stable speaker IDs in first-vocal-event order; never transfer a line to another person's mouth. "
        "Only literal words and [Language] go inside <d> tags. Camera, delivery and acting stay outside. "
        "After the last word, use concrete nonverbal action with mouths closed. Voiceover does not move on-screen lips."
    )


def sound_contract(policy: str = "native") -> str:
    if audio_policy(policy) == "legacy":
        return ("LEGACY AUDIO POLICY: Keep only exact tagged speech. All other descriptions are visual; "
                "overall_soundscape and non_diegetic_music must be N/A. Do not describe sound or silence.")
    return (
        "NATIVE AUDIO POLICY: Describe location ambience and synchronized physical effects in overall_soundscape, "
        "without dialogue, indistinct chatter or invented background voices. Use non_diegetic_music only for "
        "explicitly requested audience-only music, otherwise N/A. Preserve explicit silence. "
        "Schedule each tagged line once in a concrete interval. Before and after dialogue, people remain silent "
        "with mouths closed while the visible action and requested effects continue. Keep voice-reference timbre "
        "and delivery but not its source noise, room echo or microphone coloration."
    )


def apply_h3_audio_policy(prompt: str, policy: str = "native", duration_seconds: float = 0) -> str:
    """Preserve authored sound fields; the legacy sanitizer remains an explicit choice."""
    if audio_policy(policy) == "legacy":
        from .director.h3_dialogue import apply_h3_no_sound_description
        return apply_h3_no_sound_description(prompt)
    text = str(prompt or "").strip()
    if not text:
        return text
    if duration_seconds:
        from .minimax_h3_duration import inject_h3_vocal_timeline
        text, _ = inject_h3_vocal_timeline(text, duration_seconds, audio_policy="native")
    return text
