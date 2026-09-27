"""资源监视测试：纯函数 + 端点鉴权。

纯函数部分只依赖 metrics.py（刻意不 import psutil），因此压力计算、
cgroup 解析、降采样等核心规则可以在不装采集依赖的环境下完整验证。
"""

from types import SimpleNamespace

import pytest

from app.api.monitor import api_system_monitor
from app.services.monitor import metrics

# ── 压力等级 ────────────────────────────────────────────────


def test_clamp_bounds_values():
    assert metrics.clamp(50) == 50
    assert metrics.clamp(-10) == 0
    assert metrics.clamp(150) == 100
    assert metrics.clamp(5, 0, 1) == 1


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, metrics.LEVEL_NORMAL),
        (59.9, metrics.LEVEL_NORMAL),
        (60.0, metrics.LEVEL_ELEVATED),
        (79.9, metrics.LEVEL_ELEVATED),
        (80.0, metrics.LEVEL_HIGH),
        (94.9, metrics.LEVEL_HIGH),
        (95.0, metrics.LEVEL_CRITICAL),
        (100, metrics.LEVEL_CRITICAL),
    ],
)
def test_classify_level_boundaries(value, expected):
    """等级区间取左闭右开：阈值值归入更严重的一档。"""
    assert metrics.classify_level(value) == expected


def test_classify_level_out_of_range_clamps_first():
    assert metrics.classify_level(-5) == metrics.LEVEL_NORMAL
    assert metrics.classify_level(999) == metrics.LEVEL_CRITICAL


# ── 压力计算 ────────────────────────────────────────────────


def _pressure(**overrides):
    """构造默认的 compute_pressure 调用参数。"""
    base = dict(
        cpu_total=10.0,
        cpu_iowait=2.0,
        memory_total=8_000_000_000,
        memory_available=4_000_000_000,
        load1=2.0,
        cores=8,
    )
    base.update(overrides)
    return metrics.compute_pressure(**base)


def _dim(p, key):
    return next(d for d in p.dimensions if d.key == key)


def test_pressure_uses_worst_dimension_as_index():
    p = _pressure(cpu_total=92.0)
    assert p.level == "high"
    assert p.index == 92.0
    assert _dim(p, "cpu").value == 92.0


def test_pressure_cpu_considers_iowait_as_pressure():
    """iowait 是 CPU 忙于等 IO，与总占用取较大值作为 CPU 维度。"""
    p = _pressure(cpu_total=20.0, cpu_iowait=71.0)
    assert _dim(p, "cpu").value == 71.0


def test_pressure_memory_uses_available_not_free():
    p = _pressure(memory_total=10_000, memory_available=3_000)
    assert _dim(p, "memory").value == 70.0


def test_pressure_memory_zero_total_is_zero_not_crash():
    p = _pressure(memory_total=0, memory_available=0)
    assert _dim(p, "memory").value == 0.0


def test_pressure_load_is_per_core_ratio_and_clamped():
    """load1 / 核心数：4 核 load1=2.0 即每核 0.5 → 50%。"""
    assert _dim(_pressure(load1=2.0, cores=4), "load").value == 50.0
    # 超过 100% 时截断，不产出越界百分比
    assert _dim(_pressure(load1=8.0, cores=4), "load").value == 100.0


def test_pressure_zero_cores_does_not_divide_by_zero():
    p = _pressure(load1=5.0, cores=0)
    assert 0.0 <= _dim(p, "load").value <= 100.0


def test_pressure_swap_dimension_absent_without_swap():
    p = _pressure(swap_total=0, swap_percent=99.0)
    assert "swap" not in [d.key for d in p.dimensions]
    assert len(p.dimensions) == 3


def test_pressure_swap_dimension_present_with_swap():
    p = _pressure(swap_total=4_000_000_000, swap_percent=68.0)
    assert _dim(p, "swap").value == 68.0
    assert p.index == 68.0


def test_pressure_causes_only_dimensions_at_threshold():
    """只有达到阈值（>=60）的维度进入成因列表。"""
    p = _pressure(cpu_total=20.0, memory_available=1_000_000_000, load1=1.0)
    assert p.causes == ("内存",)
    assert p.level == "high"


def test_pressure_no_causes_when_all_low():
    p = _pressure(cpu_total=5.0, memory_available=7_999_000_000, load1=0.1)
    assert p.causes == ()
    assert p.level == "normal"
    assert p.level_label == "正常"


def test_pressure_to_dict_is_plain():
    d = metrics.pressure_to_dict(_pressure())
    assert set(d) == {"index", "level", "level_label", "dimensions", "causes"}
    assert all(isinstance(dim, dict) for dim in d["dimensions"])
    assert all(isinstance(c, str) for c in d["causes"])


# ── cgroup 解析 ────────────────────────────────────────────


@pytest.mark.parametrize(
    ("raw", "expected_quota", "expected_period"),
    [
        ("50000 100000", 0.5, 100000.0),
        ("100000 100000", 1.0, 100000.0),
        ("250000 100000", 2.5, 100000.0),
        ("100000 10000", 10.0, 10000.0),
        ("max 100000", None, 100000.0),
        ("max", None, 100000.0),
        (None, None, 100000.0),
        ("", None, 100000.0),
        ("garbage", None, 100000.0),
        ("50000 notanumber", 0.5, 100000.0),
        ("50000 0", 0.5, 100000.0),
    ],
)
def test_parse_cpu_quota_variants(raw, expected_quota, expected_period):
    """v2 cpu.max：'<配额us> <周期us>'，配额为 max 表示未设限制。

    配额与周期同为微秒，故 配额/周期 直接等于核心数；
    周期非法或为 0 时回退默认 100ms，避免除零。
    """
    assert metrics.parse_cpu_quota(raw) == (expected_quota, expected_period)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("max", True),
        ("9223372036854771712", True),
        ("MAX", True),
        ("9223372036854771712  ", True),
        (None, True),
        ("", True),
        ("2147483648", False),
        ("0", False),
    ],
)
def test_is_unlimited_memory(raw, expected):
    assert metrics.is_unlimited_memory(raw) is expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("123", 123), ("-5", -5), (None, None), ("", None), ("12.5", None), ("abc", None)],
)
def test_parse_int(raw, expected):
    assert metrics.parse_int(raw) == expected


def test_parse_keyed_stat_filters_and_skips_garbage():
    raw = "usage_usec 123456\nnr_throttled 3\nbogus 9\nthrottled_usec notanint\n"
    out = metrics.parse_keyed_stat(
        raw, ("usage_usec", "nr_throttled", "throttled_usec")
    )
    assert out == {"usage_usec": 123456, "nr_throttled": 3}


def test_parse_keyed_stat_empty_inputs():
    assert metrics.parse_keyed_stat(None, ("a",)) == {}
    assert metrics.parse_keyed_stat("", ("a",)) == {}


# ── 历史降采样 ────────────────────────────────────────────


def test_downsample_within_limit_returns_copy():
    src = [1.0, 2.0, 3.0]
    assert metrics.downsample_series(src, 10) == src
    assert metrics.downsample_series(src, 3) == src
    src.append(4.0)  # 原序列不被就地修改
    assert len(metrics.downsample_series(src, 10)) == 4


def test_downsample_to_max_points_keeps_first_and_last():
    out = metrics.downsample_series(list(range(301)), 3)
    assert len(out) == 3
    assert out[0] == 0
    assert out[-1] == 300


def test_downsample_extreme_limits():
    assert metrics.downsample_series([], 10) == []
    assert metrics.downsample_series([7.0], 10) == [7.0]
    assert metrics.downsample_series([1.0, 2.0], 0) == [1.0, 2.0]


# ── 累计计数器速率 ────────────────────────────────────────


def test_rate_zero_when_no_previous_baseline():
    """首个样本没有基准：累计值是开机以来的总量，不能直接与 0 相除。"""
    assert metrics.rate_per_second(1_000_000_000, None, 1.0) == 0


def test_rate_zero_on_counter_regression():
    """容器重启导致计数器归零时返回 0，不产出负速率。"""
    assert metrics.rate_per_second(100, 1000, 1.0) == 0


def test_rate_zero_on_nonpositive_dt():
    assert metrics.rate_per_second(1000, 0, 0) == 0
    assert metrics.rate_per_second(1000, 0, -1) == 0


def test_rate_computes_per_second_average():
    assert metrics.rate_per_second(1000, 0, 1.0) == 1000
    assert metrics.rate_per_second(1000, 0, 0.5) == 2000


def test_prev_counter_missing_baseline():
    assert metrics.prev_counter(None, "bytes_sent") is None
    assert metrics.prev_counter({"bytes_sent": 42}, "bytes_sent") == 42
    assert metrics.prev_counter({}, "bytes_sent") is None


# ── 端点 ───────────────────────────────────────────────────


def _stub_payload():
    """构造一份结构完整的采样 payload，避免测试依赖真实系统指标。"""
    return {
        "host": {
            "ts": 1_700_000_000.0,
            "cores": 4,
            "cpu": {
                "total": 12.5,
                "per_core": [10.0, 12.0, 14.0, 15.0],
                "breakdown": {
                    "user": 6.0,
                    "system": 3.0,
                    "iowait": 1.0,
                    "steal": 0.0,
                    "idle": 90.0,
                },
            },
            "memory": {
                "total": 16_000_000_000,
                "used": 8_000_000_000,
                "cached": 2_000_000_000,
                "buffers": 500_000_000,
                "free": 1_500_000_000,
                "available": 5_000_000_000,
                "used_percent": 50.0,
            },
            "swap": {"total": 0, "used": 0, "free": 0, "percent": 0.0},
            "load": {"load1": 1.2, "load5": 1.0, "load15": 0.8},
            "disk": {
                "read_bytes_per_sec": 0,
                "write_bytes_per_sec": 0,
                "read_count_per_sec": 0,
                "write_count_per_sec": 0,
            },
            "net": {
                "bytes_sent_per_sec": 0,
                "bytes_recv_per_sec": 0,
                "packets_sent_per_sec": 0,
                "packets_recv_per_sec": 0,
            },
        },
        "container": {
            "cpu": {
                "has_limit": False,
                "quota_cores": None,
                "used_cores": None,
                "used_percent": None,
                "throttled_count": 0,
                "throttled_seconds": 0.0,
            },
            "memory": {
                "has_limit": False,
                "limit": None,
                "current": 0,
                "used_percent": None,
                "oom_kill_count": 0,
                "max_events": 0,
            },
        },
        "pressure": {
            "index": 50.0,
            "level": "normal",
            "level_label": "正常",
            "dimensions": [{"key": "memory", "label": "内存", "value": 50.0}],
            "causes": [],
        },
        "processes": [],
        "history": {
            "ts": [1.0, 2.0, 3.0],
            "cpu_total": [10.0, 11.0, 12.0],
            "cpu_user": [6.0, 6.5, 7.0],
            "cpu_system": [3.0, 3.0, 3.0],
            "cpu_iowait": [1.0, 1.0, 1.0],
            "memory_used_percent": [50.0, 50.0, 50.0],
            "memory_cached_percent": [12.5, 12.5, 12.5],
            "memory_buffers_percent": [3.1, 3.1, 3.1],
            "memory_free_percent": [9.4, 9.4, 9.4],
            "load1": [1.2, 1.2, 1.2],
            "load5": [1.0, 1.0, 1.0],
            "load15": [0.8, 0.8, 0.8],
            "disk_read_bps": [0.0, 0.0, 0.0],
            "disk_write_bps": [0.0, 0.0, 0.0],
            "net_sent_bps": [0.0, 0.0, 0.0],
            "net_recv_bps": [0.0, 0.0, 0.0],
        },
        "meta": {
            "in_container": True,
            "platform": "Linux",
            "machine": "x86_64",
            "sample_interval_seconds": 1.0,
            "history_seconds": 600,
        },
    }


class _StubSampler:
    """采样器替身：固定返回 payload，不触碰真实系统指标。"""

    def payload(self, minutes=5, top=20):
        return _stub_payload()


@pytest.mark.asyncio
async def test_api_monitor_passes_payload_through_schema(monkeypatch):
    """端点函数把采样器输出经 MonitorData 校验后原样返回。"""
    import app.api.monitor as monitor_mod

    monkeypatch.setattr(monitor_mod, "get_sampler", lambda: _StubSampler())
    resp = await api_system_monitor(
        credentials=SimpleNamespace(credentials="tok"),
        admin=object(),
        minutes=2,
        processes=3,
    )
    assert resp.code == 0
    body = resp.data.model_dump()
    assert set(body) == {"host", "container", "pressure", "processes", "history", "meta"}
    assert body["host"]["cores"] == 4
    assert len(body["host"]["cpu"]["per_core"]) == 4
    assert body["pressure"]["level"] == "normal"
    assert len(body["history"]["cpu_total"]) == 3
    assert body["meta"]["in_container"] is True


def test_api_monitor_requires_admin(client, member_token):
    """普通成员访问返回 403：资源明细属管理员视角。"""
    resp = client.get(
        "/api/v1/system/monitor",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 403


def test_api_monitor_requires_auth(client):
    """未携带令牌被拒绝，不泄露任何指标。"""
    assert client.get("/api/v1/system/monitor").status_code in (401, 403)


def test_api_monitor_admin_not_blocked_by_role_gate(client, admin_token):
    """管理员通过角色门禁（此处验证鉴权，不依赖真实采样数据）。"""
    resp = client.get(
        "/api/v1/system/monitor",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code != 403


def test_api_monitor_rejects_out_of_range_window(client, admin_token):
    """历史窗口超过环形缓冲上限被 Query(le=10) 拒绝为 422。"""
    resp = client.get(
        "/api/v1/system/monitor?minutes=99",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 422


def test_api_monitor_accepts_trailing_slash_via_redirect(client, admin_token):
    """尾部斜杠兼容：与 /system/status 同一套路由风格。"""
    resp = client.get(
        "/api/v1/system/monitor/",
        headers={"Authorization": f"Bearer {admin_token}"},
        follow_redirects=False,
    )
    assert resp.status_code in (200, 307)
