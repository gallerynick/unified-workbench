"""通知渠道注册表 - 发送推送渠道的唯一权威常量源。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ChannelDef:
    id: str
    label: str
    config_keys: list[str]


ALL_CHANNELS: list[ChannelDef] = [
    ChannelDef("websocket", "站内通知", ["enabled_channels"]),
    ChannelDef("feishu",   "飞书",    ["feishu_webhook_url"]),
    ChannelDef(
        "email", "邮件",
        ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_use_tls"],
    ),
    ChannelDef("wecom",    "企业微信", ["wecom_webhook_url"]),
]

DEFAULT_CHANNELS = ["websocket"]

CHANNEL_MAP: dict[str, ChannelDef] = {c.id: c for c in ALL_CHANNELS}
VALID_CHANNEL_IDS = frozenset(CHANNEL_MAP.keys())


def get_channel(channel_id: str) -> ChannelDef | None:
    return CHANNEL_MAP.get(channel_id)


def get_all_channel_ids() -> list[str]:
    return [c.id for c in ALL_CHANNELS]
