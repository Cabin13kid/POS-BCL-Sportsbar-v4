"""Iteration 3 tests: multi-promotions, item_percent, stats/today, shift-notes, set_order_promotions."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://drink-stock-hub-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@bar.nl"
ADMIN_PASSWORD = "admin123"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_auth():
    return _h(_login(ADMIN_EMAIL, ADMIN_PASSWORD))


@pytest.fixture(scope="module")
def werknemer(admin_auth):
    suffix = uuid.uuid4().hex[:6]
    email = f"TEST_werk_{suffix}@bar.nl"
    pw = "test1234"
    r = requests.post(f"{BASE_URL}/api/users", headers=admin_auth, json={
        "email": email, "password": pw, "name": "TEST_werk", "role": "werknemer",
    })
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    token = _login(email, pw)
    yield {"id": uid, "email": email, "token": token, "auth": _h(token)}
    requests.delete(f"{BASE_URL}/api/users/{uid}", headers=admin_auth)


@pytest.fixture(scope="module")
def menu_items(admin_auth):
    return requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()


def _mk_promo(admin_auth, **kwargs):
    payload = {"name": f"TEST_{uuid.uuid4().hex[:6]}", "active": True, **kwargs}
    r = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def _del_promo(admin_auth, pid):
    requests.delete(f"{BASE_URL}/api/promotions/{pid}", headers=admin_auth)


def _del_order(admin_auth, oid):
    requests.delete(f"{BASE_URL}/api/orders/{oid}", headers=admin_auth)


# ---------------- Stats today ----------------
class TestStatsToday:
    def test_stats_today_shape(self, admin_auth):
        r = requests.get(f"{BASE_URL}/api/stats/today", headers=admin_auth)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("revenue", "open_count", "paid_count", "low_stock"):
            assert key in d, f"missing key {key}: {d}"
        assert isinstance(d["revenue"], (int, float))
        assert isinstance(d["open_count"], int)
        assert isinstance(d["paid_count"], int)
        assert isinstance(d["low_stock"], list)

    def test_stats_today_low_stock_fields_and_threshold(self, admin_auth):
        r = requests.get(f"{BASE_URL}/api/stats/today", headers=admin_auth)
        d = r.json()
        for inv in d["low_stock"]:
            for f in ("id", "name", "category", "total_available", "loose_units", "trays_in_storage", "units_per_tray"):
                assert f in inv, f"low_stock item missing {f}: {inv}"
            assert inv["total_available"] < 6
            # consistency
            expected = inv["loose_units"] + inv["trays_in_storage"] * inv["units_per_tray"]
            assert inv["total_available"] == expected

    def test_stats_today_revenue_and_counts_after_paid_order(self, admin_auth, menu_items):
        m = menu_items[0]
        # baseline
        before = requests.get(f"{BASE_URL}/api/stats/today", headers=admin_auth).json()
        # create + pay an order
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 3.0, "qty": 2}]
        }).json()
        requests.post(f"{BASE_URL}/api/orders/{o['id']}/pay", headers=admin_auth)
        after = requests.get(f"{BASE_URL}/api/stats/today", headers=admin_auth).json()
        assert round(after["revenue"] - before["revenue"], 2) == 6.0
        assert after["paid_count"] == before["paid_count"] + 1
        _del_order(admin_auth, o["id"])


# ---------------- Shift Notes ----------------
class TestShiftNotes:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/shift-notes", json={"text": "x"})
        assert r.status_code in (401, 403)

    def test_create_get_delete_sorted_desc(self, admin_auth):
        # create two
        r1 = requests.post(f"{BASE_URL}/api/shift-notes", headers=admin_auth, json={"text": "TEST first"})
        assert r1.status_code == 200, r1.text
        n1 = r1.json()
        assert n1["author_email"] == ADMIN_EMAIL
        assert n1["text"] == "TEST first"
        assert "created_at" in n1 and "id" in n1
        r2 = requests.post(f"{BASE_URL}/api/shift-notes", headers=admin_auth, json={"text": "TEST second"})
        n2 = r2.json()
        # list
        lst = requests.get(f"{BASE_URL}/api/shift-notes", headers=admin_auth).json()
        ids = [n["id"] for n in lst]
        assert n1["id"] in ids and n2["id"] in ids
        # sorted desc by created_at - find positions
        idx1 = ids.index(n1["id"])
        idx2 = ids.index(n2["id"])
        assert idx2 < idx1, "newer note should come first"
        # delete
        d = requests.delete(f"{BASE_URL}/api/shift-notes/{n1['id']}", headers=admin_auth)
        assert d.status_code == 200
        d = requests.delete(f"{BASE_URL}/api/shift-notes/{n2['id']}", headers=admin_auth)
        assert d.status_code == 200
        # confirm gone
        lst2 = requests.get(f"{BASE_URL}/api/shift-notes", headers=admin_auth).json()
        ids2 = [n["id"] for n in lst2]
        assert n1["id"] not in ids2 and n2["id"] not in ids2

    def test_empty_text_returns_400(self, admin_auth):
        r = requests.post(f"{BASE_URL}/api/shift-notes", headers=admin_auth, json={"text": ""})
        assert r.status_code == 400
        assert "leeg" in r.json().get("detail", "").lower()

    def test_whitespace_text_returns_400(self, admin_auth):
        r = requests.post(f"{BASE_URL}/api/shift-notes", headers=admin_auth, json={"text": "   \n\t"})
        assert r.status_code == 400
        assert "leeg" in r.json().get("detail", "").lower()

    def test_author_email_is_caller(self, werknemer):
        r = requests.post(f"{BASE_URL}/api/shift-notes", headers=werknemer["auth"], json={"text": "TEST werk note"})
        assert r.status_code == 200
        assert r.json()["author_email"].lower() == werknemer["email"].lower()
        requests.delete(f"{BASE_URL}/api/shift-notes/{r.json()['id']}", headers=werknemer["auth"])


# ---------------- Promotions item_percent ----------------
class TestItemPercentPromo:
    def test_create_item_percent_admin(self, admin_auth, menu_items):
        ids = [m["id"] for m in menu_items[:2]]
        p = _mk_promo(admin_auth, type="item_percent", value=10, menu_item_ids=ids)
        assert p["type"] == "item_percent"
        assert p["value"] == 10
        assert p["menu_item_ids"] == ids
        _del_promo(admin_auth, p["id"])

    def test_create_item_percent_werknemer_forbidden(self, werknemer):
        r = requests.post(f"{BASE_URL}/api/promotions", headers=werknemer["auth"], json={
            "name": "TEST_403", "type": "item_percent", "value": 10, "menu_item_ids": [],
        })
        assert r.status_code == 403

    def test_item_percent_math(self, admin_auth, menu_items):
        m = menu_items[0]
        # 10% on item price €2 qty 3 => 0.60
        p = _mk_promo(admin_auth, type="item_percent", value=10, menu_item_ids=[m["id"]])
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.0, "qty": 3}],
            "promotion_ids": [p["id"]],
        }).json()
        assert o["subtotal"] == 6.0
        assert o["discount"] == 0.60, o
        assert o["total"] == 5.40, o
        assert o["promotion_ids"] == [p["id"]]
        _del_order(admin_auth, o["id"])
        _del_promo(admin_auth, p["id"])


# ---------------- Multi-promotions ----------------
class TestMultiPromotions:
    def test_create_order_with_two_promos_additive(self, admin_auth, menu_items):
        m = menu_items[0]
        # subtotal €6 (price 2 x qty 3)
        # order_percent 20% => 1.20
        # item_fixed €0.50 qty 3 => 1.50
        # total discount 2.70, total = 3.30
        p1 = _mk_promo(admin_auth, type="order_percent", value=20)
        p2 = _mk_promo(admin_auth, type="item_fixed", value=0.5, menu_item_ids=[m["id"]])
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.0, "qty": 3}],
            "promotion_ids": [p1["id"], p2["id"]],
        }).json()
        assert o["subtotal"] == 6.0
        assert o["discount"] == 2.70, o
        assert o["total"] == 3.30, o
        assert set(o["promotion_ids"]) == {p1["id"], p2["id"]}
        _del_order(admin_auth, o["id"])
        _del_promo(admin_auth, p1["id"])
        _del_promo(admin_auth, p2["id"])

    def test_multi_promo_discount_capped_at_subtotal(self, admin_auth, menu_items):
        m = menu_items[0]
        # subtotal €4; two 60% promos => raw 4.80 => capped to 4.0, total 0
        p1 = _mk_promo(admin_auth, type="order_percent", value=60)
        p2 = _mk_promo(admin_auth, type="order_percent", value=60)
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.0, "qty": 2}],
            "promotion_ids": [p1["id"], p2["id"]],
        }).json()
        assert o["subtotal"] == 4.0
        assert o["discount"] == 4.0, o
        assert o["total"] == 0.0, o
        _del_order(admin_auth, o["id"])
        _del_promo(admin_auth, p1["id"])
        _del_promo(admin_auth, p2["id"])


# ---------------- Set order promotions endpoint ----------------
class TestSetOrderPromotions:
    def test_put_replaces_list_and_recalcs(self, admin_auth, menu_items):
        m = menu_items[0]
        p1 = _mk_promo(admin_auth, type="order_percent", value=10)  # initial
        p2 = _mk_promo(admin_auth, type="order_percent", value=25)  # replacement
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.0, "qty": 5}],  # subtotal 10
            "promotion_ids": [p1["id"]],
        }).json()
        assert o["discount"] == 1.0
        r = requests.put(f"{BASE_URL}/api/orders/{o['id']}/promotions", headers=admin_auth, json={
            "promotion_ids": [p2["id"]],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["promotion_ids"] == [p2["id"]]
        assert d["discount"] == 2.5, d
        assert d["total"] == 7.5, d
        assert d["subtotal"] == 10.0
        _del_order(admin_auth, o["id"])
        _del_promo(admin_auth, p1["id"])
        _del_promo(admin_auth, p2["id"])

    def test_put_filters_invalid_ids(self, admin_auth, menu_items):
        m = menu_items[0]
        p = _mk_promo(admin_auth, type="order_percent", value=10)
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.0, "qty": 1}],
        }).json()
        r = requests.put(f"{BASE_URL}/api/orders/{o['id']}/promotions", headers=admin_auth, json={
            "promotion_ids": [p["id"], "nonexistent-id-xyz"],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["promotion_ids"] == [p["id"]], d
        _del_order(admin_auth, o["id"])
        _del_promo(admin_auth, p["id"])

    def test_put_on_paid_order_returns_400(self, admin_auth, menu_items):
        m = menu_items[0]
        p = _mk_promo(admin_auth, type="order_percent", value=10)
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 1.0, "qty": 1}],
        }).json()
        requests.post(f"{BASE_URL}/api/orders/{o['id']}/pay", headers=admin_auth)
        r = requests.put(f"{BASE_URL}/api/orders/{o['id']}/promotions", headers=admin_auth, json={
            "promotion_ids": [p["id"]],
        })
        assert r.status_code == 400
        assert "open" in r.json().get("detail", "").lower()
        _del_order(admin_auth, o["id"])
        _del_promo(admin_auth, p["id"])

    def test_put_werknemer_allowed(self, admin_auth, werknemer, menu_items):
        m = menu_items[0]
        p = _mk_promo(admin_auth, type="order_percent", value=15)
        o = requests.post(f"{BASE_URL}/api/orders", headers=werknemer["auth"], json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.0, "qty": 2}],
        }).json()
        r = requests.put(f"{BASE_URL}/api/orders/{o['id']}/promotions", headers=werknemer["auth"], json={
            "promotion_ids": [p["id"]],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["discount"] == 0.60
        assert d["total"] == 3.40
        _del_order(admin_auth, o["id"])
        _del_promo(admin_auth, p["id"])


# ---------------- Order response shape ----------------
class TestOrderShape:
    def test_order_has_subtotal_and_promotion_ids_list(self, admin_auth, menu_items):
        m = menu_items[0]
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.5, "qty": 2}],
        }).json()
        assert "subtotal" in o
        assert o["subtotal"] == 5.0
        assert "promotion_ids" in o
        assert isinstance(o["promotion_ids"], list)
        assert o["promotion_ids"] == []
        _del_order(admin_auth, o["id"])

    def test_add_items_recalc_uses_all_promotion_ids(self, admin_auth, menu_items):
        m = menu_items[0]
        p1 = _mk_promo(admin_auth, type="order_percent", value=10)
        p2 = _mk_promo(admin_auth, type="item_fixed", value=0.25, menu_item_ids=[m["id"]])
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.0, "qty": 2}],  # sub 4
            "promotion_ids": [p1["id"], p2["id"]],
        }).json()
        # initial: 10% of 4 = 0.40 + 0.25*2 = 0.50 -> 0.90, total 3.10
        assert o["discount"] == 0.90, o
        # add same item qty 1 -> qty 3, sub 6
        upd = requests.post(f"{BASE_URL}/api/orders/{o['id']}/items", headers=admin_auth, json={
            "items": [{"menu_item_id": m["id"], "name": m["name"], "price": 2.0, "qty": 1}],
        }).json()
        # 10% of 6 = 0.60 + 0.25*3 = 0.75 -> 1.35, total 4.65
        assert upd["subtotal"] == 6.0
        assert upd["discount"] == 1.35, upd
        assert upd["total"] == 4.65, upd
        assert set(upd["promotion_ids"]) == {p1["id"], p2["id"]}
        _del_order(admin_auth, o["id"])
        _del_promo(admin_auth, p1["id"])
        _del_promo(admin_auth, p2["id"])
