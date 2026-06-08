"""Tests for new iteration: role-based auth, user CRUD, promotions, add items to order."""
import os
import uuid
from datetime import datetime, timedelta, timezone

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
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def admin_auth(admin_token):
    return _h(admin_token)


@pytest.fixture(scope="module")
def admin_id(admin_auth):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_auth)
    return r.json()["id"]


@pytest.fixture(scope="module")
def users(admin_auth):
    """Create manager + werknemer test users; yield ids and tokens; cleanup at end."""
    created = {}
    suffix = uuid.uuid4().hex[:6]
    for role in ("manager", "werknemer"):
        email = f"TEST_{role}_{suffix}@bar.nl"
        pw = "test1234"
        r = requests.post(f"{BASE_URL}/api/users", headers=admin_auth, json={
            "email": email, "password": pw, "name": f"TEST_{role}", "role": role,
        })
        assert r.status_code == 200, f"create {role} failed: {r.status_code} {r.text}"
        d = r.json()
        token = _login(email, pw)
        created[role] = {"id": d["id"], "email": email, "password": pw, "token": token}
    yield created
    for v in created.values():
        requests.delete(f"{BASE_URL}/api/users/{v['id']}", headers=admin_auth)


# ---- User CRUD (admin only) ----
class TestUserCRUD:
    def test_create_user_roles_and_get(self, admin_auth, users):
        # verify by listing
        r = requests.get(f"{BASE_URL}/api/users", headers=admin_auth)
        assert r.status_code == 200
        emails = {u["email"]: u for u in r.json()}
        for role, v in users.items():
            assert v["email"] in emails
            assert emails[v["email"]]["role"] == role

    def test_create_user_non_admin_forbidden(self, users):
        r = requests.post(f"{BASE_URL}/api/users", headers=_h(users["manager"]["token"]), json={
            "email": f"TEST_nope_{uuid.uuid4().hex[:6]}@bar.nl", "password": "x", "name": "x", "role": "werknemer",
        })
        assert r.status_code == 403

    def test_update_user_name_role_password(self, admin_auth, users):
        uid = users["werknemer"]["id"]
        r = requests.put(f"{BASE_URL}/api/users/{uid}", headers=admin_auth, json={
            "name": "TEST_renamed", "role": "manager", "password": "newpass123",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_renamed"
        assert d["role"] == "manager"
        # new password works
        new_token = _login(users["werknemer"]["email"], "newpass123")
        assert new_token
        # revert role to werknemer for downstream tests
        requests.put(f"{BASE_URL}/api/users/{uid}", headers=admin_auth, json={"role": "werknemer", "password": users["werknemer"]["password"]})
        users["werknemer"]["token"] = _login(users["werknemer"]["email"], users["werknemer"]["password"])

    def test_delete_self_blocked(self, admin_auth, admin_id):
        r = requests.delete(f"{BASE_URL}/api/users/{admin_id}", headers=admin_auth)
        assert r.status_code == 400

    def test_manager_list_users_forbidden(self, users):
        r = requests.get(f"{BASE_URL}/api/users", headers=_h(users["manager"]["token"]))
        assert r.status_code == 403
        assert "Geen rechten" in r.json().get("detail", "")


# ---- Role-based access on existing endpoints ----
class TestRoleAccess:
    def test_werknemer_cannot_post_menu(self, users):
        r = requests.post(f"{BASE_URL}/api/menu", headers=_h(users["werknemer"]["token"]), json={
            "name": "TEST_NoAccess", "category": "Frisdrank", "price": 1.0,
        })
        assert r.status_code == 403

    def test_manager_can_post_menu(self, users, admin_auth):
        r = requests.post(f"{BASE_URL}/api/menu", headers=_h(users["manager"]["token"]), json={
            "name": "TEST_MgrMenu", "category": "Frisdrank", "price": 1.0,
        })
        assert r.status_code == 200
        mid = r.json()["id"]
        requests.delete(f"{BASE_URL}/api/menu/{mid}", headers=admin_auth)

    def test_werknemer_can_create_order_and_pay(self, users, admin_auth):
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()[0]
        r = requests.post(f"{BASE_URL}/api/orders", headers=_h(users["werknemer"]["token"]), json={
            "table_name": "Bar", "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": menu["price"], "qty": 1}]
        })
        assert r.status_code == 200
        oid = r.json()["id"]
        # add items
        a = requests.post(f"{BASE_URL}/api/orders/{oid}/items", headers=_h(users["werknemer"]["token"]), json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": menu["price"], "qty": 1}]
        })
        assert a.status_code == 200
        # pay
        p = requests.post(f"{BASE_URL}/api/orders/{oid}/pay", headers=_h(users["werknemer"]["token"]))
        assert p.status_code == 200
        # cleanup
        requests.delete(f"{BASE_URL}/api/orders/{oid}", headers=admin_auth)

    def test_werknemer_delete_order_forbidden_manager_ok(self, users, admin_auth):
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()[0]
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": menu["price"], "qty": 1}]
        }).json()
        r = requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=_h(users["werknemer"]["token"]))
        assert r.status_code == 403
        r2 = requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=_h(users["manager"]["token"]))
        assert r2.status_code == 200

    def test_manager_cannot_update_promotion(self, users, admin_auth):
        p = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json={
            "name": "TEST_mgrcheck", "type": "order_percent", "value": 5,
        }).json()
        r = requests.put(f"{BASE_URL}/api/promotions/{p['id']}", headers=_h(users["manager"]["token"]), json={
            "name": "TEST_mgrcheck", "type": "order_percent", "value": 10,
        })
        assert r.status_code == 403
        requests.delete(f"{BASE_URL}/api/promotions/{p['id']}", headers=admin_auth)


# ---- Promotions ----
class TestPromotions:
    def test_create_order_percent(self, admin_auth):
        r = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json={
            "name": "TEST_20off", "type": "order_percent", "value": 20, "active": True,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["type"] == "order_percent" and d["value"] == 20 and d["active"] is True
        requests.delete(f"{BASE_URL}/api/promotions/{d['id']}", headers=admin_auth)

    def test_create_item_fixed(self, admin_auth):
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()
        ids = [m["id"] for m in menu[:2]]
        r = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json={
            "name": "TEST_fixed", "type": "item_fixed", "value": 0.5, "menu_item_ids": ids,
        })
        assert r.status_code == 200
        assert r.json()["menu_item_ids"] == ids
        requests.delete(f"{BASE_URL}/api/promotions/{r.json()['id']}", headers=admin_auth)

    def test_order_percent_discount_applied(self, admin_auth):
        # Build subtotal 10€: price 5.0 qty 2
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()[0]
        p = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json={
            "name": "TEST_20pct", "type": "order_percent", "value": 20,
        }).json()
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": 5.0, "qty": 2}],
            "promotion_id": p["id"],
        })
        assert o.status_code == 200
        d = o.json()
        assert d["discount"] == 2.0, d
        assert d["total"] == 8.0, d
        assert d["promotion_id"] == p["id"]
        requests.delete(f"{BASE_URL}/api/orders/{d['id']}", headers=admin_auth)
        requests.delete(f"{BASE_URL}/api/promotions/{p['id']}", headers=admin_auth)

    def test_item_fixed_discount_applied(self, admin_auth):
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()[0]
        p = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json={
            "name": "TEST_fix50", "type": "item_fixed", "value": 0.5, "menu_item_ids": [menu["id"]],
        }).json()
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": 2.0, "qty": 3}],
            "promotion_id": p["id"],
        })
        d = o.json()
        assert d["discount"] == 1.5, d
        assert d["total"] == 4.5, d
        requests.delete(f"{BASE_URL}/api/orders/{d['id']}", headers=admin_auth)
        requests.delete(f"{BASE_URL}/api/promotions/{p['id']}", headers=admin_auth)

    def test_promotion_future_start_no_discount(self, admin_auth):
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()[0]
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        p = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json={
            "name": "TEST_future", "type": "order_percent", "value": 50, "starts_at": future,
        }).json()
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": 5.0, "qty": 2}],
            "promotion_id": p["id"],
        }).json()
        assert o["discount"] == 0, o
        assert o["total"] == 10.0, o
        requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=admin_auth)
        requests.delete(f"{BASE_URL}/api/promotions/{p['id']}", headers=admin_auth)

    def test_promotion_inactive_no_discount(self, admin_auth):
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()[0]
        p = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json={
            "name": "TEST_inactive", "type": "order_percent", "value": 50, "active": False,
        }).json()
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": 5.0, "qty": 2}],
            "promotion_id": p["id"],
        }).json()
        assert o["discount"] == 0, o
        assert o["total"] == 10.0, o
        requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=admin_auth)
        requests.delete(f"{BASE_URL}/api/promotions/{p['id']}", headers=admin_auth)


# ---- Add items to order ----
class TestAddItemsToOrder:
    def test_merge_same_item_recalc_total_with_promo(self, admin_auth):
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()[0]
        p = requests.post(f"{BASE_URL}/api/promotions", headers=admin_auth, json={
            "name": "TEST_addpct", "type": "order_percent", "value": 10,
        }).json()
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": 2.0, "qty": 2}],
            "promotion_id": p["id"],
        }).json()
        assert len(o["items"]) == 1
        # add same item qty 1 -> merge to qty 3
        upd = requests.post(f"{BASE_URL}/api/orders/{o['id']}/items", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": 2.0, "qty": 1}]
        })
        assert upd.status_code == 200
        d = upd.json()
        assert len(d["items"]) == 1
        assert d["items"][0]["qty"] == 3
        # subtotal 6.0, 10% off = 0.6, total 5.4
        assert d["discount"] == 0.6, d
        assert d["total"] == 5.4, d
        requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=admin_auth)
        requests.delete(f"{BASE_URL}/api/promotions/{p['id']}", headers=admin_auth)

    def test_add_items_to_paid_order_400(self, admin_auth):
        menu = requests.get(f"{BASE_URL}/api/menu", headers=admin_auth).json()[0]
        o = requests.post(f"{BASE_URL}/api/orders", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": 1.0, "qty": 1}]
        }).json()
        requests.post(f"{BASE_URL}/api/orders/{o['id']}/pay", headers=admin_auth)
        r = requests.post(f"{BASE_URL}/api/orders/{o['id']}/items", headers=admin_auth, json={
            "items": [{"menu_item_id": menu["id"], "name": menu["name"], "price": 1.0, "qty": 1}]
        })
        assert r.status_code == 400
        assert "open" in r.json().get("detail", "").lower()
        requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=admin_auth)
