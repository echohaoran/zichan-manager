"""预聚合分析：把拉取的原始数据计算成结构化报告，供 agent 直接推理。"""
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _dedup_anomalies(items: List[Dict], key: str, label: str) -> List[Dict]:
    seen: Dict[str, int] = {}
    result = []
    for it in items:
        v = (it.get(key) or "").strip()
        if not v or v == "空":
            continue
        if v in seen:
            result.append({label: v, "id": it["id"], "first_id": seen[v]})
        else:
            seen[v] = it["id"]
    return result


def analyze_assets(
    assets: List[Dict],
    persons: List[Dict],
    categories: List[Dict],
    departments: List[Dict],
    stats: Dict,
) -> Dict[str, Any]:
    """聚合分析入口：返回结构化报告（分布/价值/时间/异常/最近变更）。"""
    total = len(assets)
    person_dept = {p.get("name"): (p.get("department_name") or "未分配") for p in persons}

    # 状态 / 分类 / 部门 / 领用人分布
    by_status = dict(Counter(a.get("status") or "未知" for a in assets))
    by_category = dict(Counter((a.get("category_name") or "未知") for a in assets))
    by_department = dict(
        Counter((person_dept.get(a.get("person_name")) if a.get("person_name") else "未分配") for a in assets)
    )
    by_person = dict(
        Counter(a.get("person_name") for a in assets if a.get("person_name"))
    )

    # 价值统计（与 dashboard 一致：排除已报废）
    active = [a for a in assets if a.get("status") != "已报废"]
    total_value = round(sum(a.get("price") or 0 for a in active), 2)
    value_by_category: Dict[str, float] = {}
    for a in active:
        cat = a.get("category_name") or "未知"
        value_by_category[cat] = round(value_by_category.get(cat, 0) + (a.get("price") or 0), 2)

    # 购买时间跨度 / 平均价格
    dates = [d for d in (_parse_dt(a.get("purchase_date")) for a in assets) if d]
    purchase_span = {}
    if dates:
        purchase_span = {
            "earliest": min(dates).date().isoformat(),
            "latest": max(dates).date().isoformat(),
        }
    prices = [a.get("price") or 0 for a in assets]
    avg_price = round(sum(prices) / len(prices), 2) if prices else 0

    # 异常提示
    anomalies = {
        "重复资产编码": _dedup_anomalies(assets, "asset_code", "asset_code"),
        "重复序列号": _dedup_anomalies(assets, "sn", "sn"),
        "在库却绑定领用人": [
            {"id": a["id"], "name": a.get("name"), "person": a.get("person_name")}
            for a in assets
            if a.get("status") == "在库" and a.get("person_id")
        ],
        "序列号为空": sum(1 for a in assets if not (a.get("sn") or "").strip() or a.get("sn") == "空"),
        "价格为0或负数": sum(1 for a in assets if (a.get("price") or 0) <= 0),
    }

    return {
        "总览": {
            "资产总数": total,
            "在库": by_status.get("在库", 0),
            "领用中": by_status.get("领用中", 0),
            "已报废": by_status.get("已报废", 0),
            "总价值(不含报废)": total_value,
            "平均价格": avg_price,
            "领用人数量": len(by_person),
            "部门数量": len(departments),
            "分类数量": len(categories),
            "购买时间跨度": purchase_span,
        },
        "按状态分布": by_status,
        "按分类分布": by_category,
        "按分类价值": value_by_category,
        "按部门分布": by_department,
        "按领用人分布(前20)": dict(Counter(by_person).most_common(20)),
        "最近更新(前10)": [
            {"id": a["id"], "name": a.get("name"), "updated_at": a.get("updated_at")}
            for a in sorted(assets, key=lambda x: x.get("updated_at") or "", reverse=True)[:10]
        ],
        "异常提示": anomalies,
    }
