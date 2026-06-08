from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ---- Setup ----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ---- Models ----
class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str = "Gebruiker"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MenuItemIn(BaseModel):
    name: str
    category: str
    price: float
    inventory_id: Optional[str] = None


class MenuItemOut(MenuItemIn):
    id: str


class InventoryItemIn(BaseModel):
    name: str
    category: str
    loose_units: int = 0
    trays_in_storage: int = 0
    units_per_tray: int = 0


class InventoryItemOut(InventoryItemIn):
    id: str


class TableIn(BaseModel):
    name: str
    x: float = 100
    y: float = 100
    seats: int = 4


class TableOut(TableIn):
    id: str


class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    qty: int


class OrderIn(BaseModel):
    table_id: Optional[str] = None
    table_name: Optional[str] = None
    items: List[OrderItem]
    note: Optional[str] = None
    promotion_id: Optional[str] = None


class OrderOut(BaseModel):
    id: str
    table_id: Optional[str] = None
    table_name: Optional[str] = None
    items: List[OrderItem]
    total: float
    discount: float = 0.0
    promotion_id: Optional[str] = None
    status: str
    note: Optional[str] = None
    created_at: str


class OrderItemsAdd(BaseModel):
    items: List[OrderItem]


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "werknemer"  # admin | manager | werknemer


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class PromotionIn(BaseModel):
    name: str
    type: str  # "order_percent" | "item_fixed"
    value: float
    menu_item_ids: List[str] = []
    active: bool = True
    starts_at: Optional[str] = None  # ISO8601
    ends_at: Optional[str] = None


class PromotionOut(PromotionIn):
    id: str


# ---- Auth helpers ----
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now_utc() + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Niet geauthenticeerd")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Gebruiker niet gevonden")
        return {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "user"),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token verlopen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ongeldig token")


# Role-based access. Roles: admin > manager > werknemer
ROLE_LEVEL = {"admin": 3, "manager": 2, "werknemer": 1}


def require_roles(*allowed):
    async def _check(user: dict = Depends(get_current_user)):
        if user.get("role") not in allowed:
            raise HTTPException(status_code=403, detail="Geen rechten voor deze actie")
        return user
    return _check


require_admin = require_roles("admin")
require_manager = require_roles("admin", "manager")


# ---- Seed ----
SEED_CATEGORIES = ["Frisdrank", "Non alcoholisch Bier", "Alcohol", "Snacks", "Eten"]

SEED_MENU = [
    # Frisdrank
    ("Coca Cola", "Frisdrank", 2.00),
    ("Coca Cola Zero", "Frisdrank", 2.00),
    ("Fanta", "Frisdrank", 2.00),
    ("Sprite", "Frisdrank", 2.00),
    ("Ice Tea Sparkling", "Frisdrank", 2.00),
    ("Ice Tea Green", "Frisdrank", 2.00),
    ("Chocomelk", "Frisdrank", 2.00),
    ("Spa Rood", "Frisdrank", 2.00),
    ("Spa Blauw", "Frisdrank", 2.00),
    ("AA Sportdrank", "Frisdrank", 2.00),
    # Non alcoholisch Bier
    ("Affligem Blond 0.0", "Non alcoholisch Bier", 2.50),
    ("Desperados 0.0", "Non alcoholisch Bier", 2.50),
    ("Texels 0.0", "Non alcoholisch Bier", 2.50),
    ("Grolsch Radler 0.0", "Non alcoholisch Bier", 2.50),
    # Snacks
    ("Naturel Chips", "Snacks", 1.50),
    # Eten (no prices given - default 0)
    ("Spareribs", "Eten", 0.00),
    ("Pasta met balletjes", "Eten", 0.00),
    ("Pasta Vega", "Eten", 0.00),
]


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"]
    pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "email": email,
            "password_hash": hash_password(pw),
            "name": "Admin",
            "role": "admin",
            "created_at": iso(now_utc()),
        })
    else:
        if not verify_password(pw, existing["password_hash"]):
            await db.users.update_one(
                {"email": email},
                {"$set": {"password_hash": hash_password(pw)}},
            )


async def seed_data():
    # If seeded marker exists, skip
    marker = await db.app_meta.find_one({"key": "seeded_v1"})
    if marker:
        return

    # Clean any old menu/inventory presets
    await db.menu_items.delete_many({})
    await db.inventory_items.delete_many({})

    # Seed inventory + menu items (linked)
    for name, category, price in SEED_MENU:
        inv_id = str(uuid.uuid4())
        await db.inventory_items.insert_one({
            "_id": inv_id,
            "name": name,
            "category": category,
            "loose_units": 0,
            "trays_in_storage": 0,
            "units_per_tray": 0,
            "created_at": iso(now_utc()),
        })
        item_id = str(uuid.uuid4())
        await db.menu_items.insert_one({
            "_id": item_id,
            "name": name,
            "category": category,
            "price": price,
            "inventory_id": inv_id,
            "created_at": iso(now_utc()),
        })

    await db.app_meta.insert_one({"key": "seeded_v1", "at": iso(now_utc())})


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await seed_admin()
    await seed_data()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---- Auth Endpoints ----
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-mail al in gebruik")
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": "werknemer",
        "created_at": iso(now_utc()),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    token = create_access_token(uid, email)
    response.set_cookie(
        "access_token", token, httponly=True, samesite="lax", max_age=43200, path="/"
    )
    return {
        "token": token,
        "user": {"id": uid, "email": email, "name": payload.name, "role": "werknemer"},
    }


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Ongeldige inloggegevens")
    uid = str(user["_id"])
    token = create_access_token(uid, email)
    response.set_cookie(
        "access_token", token, httponly=True, samesite="lax", max_age=43200, path="/"
    )
    return {
        "token": token,
        "user": {
            "id": uid,
            "email": email,
            "name": user.get("name", ""),
            "role": user.get("role", "user"),
        },
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---- Categories ----
@api.get("/categories")
async def categories(_=Depends(get_current_user)):
    return SEED_CATEGORIES


# ---- Menu Items ----
def menu_doc_to_out(d: dict) -> dict:
    return {
        "id": d["_id"],
        "name": d["name"],
        "category": d["category"],
        "price": d["price"],
        "inventory_id": d.get("inventory_id"),
    }


@api.get("/menu", response_model=List[MenuItemOut])
async def list_menu(_=Depends(get_current_user)):
    items = await db.menu_items.find().to_list(1000)
    return [menu_doc_to_out(d) for d in items]


@api.post("/menu", response_model=MenuItemOut)
async def create_menu(payload: MenuItemIn, _=Depends(require_manager)):
    item_id = str(uuid.uuid4())
    doc = {
        "_id": item_id,
        "name": payload.name,
        "category": payload.category,
        "price": payload.price,
        "inventory_id": payload.inventory_id,
        "created_at": iso(now_utc()),
    }
    await db.menu_items.insert_one(doc)
    return menu_doc_to_out(doc)


@api.put("/menu/{item_id}", response_model=MenuItemOut)
async def update_menu(item_id: str, payload: MenuItemIn, _=Depends(require_manager)):
    res = await db.menu_items.find_one_and_update(
        {"_id": item_id},
        {"$set": payload.model_dump()},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Menu item niet gevonden")
    return menu_doc_to_out(res)


@api.delete("/menu/{item_id}")
async def delete_menu(item_id: str, _=Depends(require_manager)):
    await db.menu_items.delete_one({"_id": item_id})
    return {"ok": True}


# ---- Inventory ----
def inv_doc_to_out(d: dict) -> dict:
    return {
        "id": d["_id"],
        "name": d["name"],
        "category": d["category"],
        "loose_units": d.get("loose_units", 0),
        "trays_in_storage": d.get("trays_in_storage", 0),
        "units_per_tray": d.get("units_per_tray", 0),
    }


@api.get("/inventory", response_model=List[InventoryItemOut])
async def list_inventory(_=Depends(get_current_user)):
    items = await db.inventory_items.find().to_list(1000)
    return [inv_doc_to_out(d) for d in items]


@api.post("/inventory", response_model=InventoryItemOut)
async def create_inventory(payload: InventoryItemIn, _=Depends(require_manager)):
    item_id = str(uuid.uuid4())
    doc = {"_id": item_id, **payload.model_dump(), "created_at": iso(now_utc())}
    await db.inventory_items.insert_one(doc)
    return inv_doc_to_out(doc)


@api.put("/inventory/{item_id}", response_model=InventoryItemOut)
async def update_inventory(item_id: str, payload: InventoryItemIn, _=Depends(require_manager)):
    res = await db.inventory_items.find_one_and_update(
        {"_id": item_id},
        {"$set": payload.model_dump()},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Voorraad item niet gevonden")
    return inv_doc_to_out(res)


@api.delete("/inventory/{item_id}")
async def delete_inventory(item_id: str, _=Depends(require_manager)):
    await db.inventory_items.delete_one({"_id": item_id})
    return {"ok": True}


# ---- Tables / Floorplan ----
def table_doc_to_out(d: dict) -> dict:
    return {
        "id": d["_id"],
        "name": d["name"],
        "x": d.get("x", 100),
        "y": d.get("y", 100),
        "seats": d.get("seats", 4),
    }


@api.get("/tables", response_model=List[TableOut])
async def list_tables(_=Depends(get_current_user)):
    items = await db.tables.find().to_list(1000)
    return [table_doc_to_out(d) for d in items]


@api.post("/tables", response_model=TableOut)
async def create_table(payload: TableIn, _=Depends(require_manager)):
    item_id = str(uuid.uuid4())
    doc = {"_id": item_id, **payload.model_dump(), "created_at": iso(now_utc())}
    await db.tables.insert_one(doc)
    return table_doc_to_out(doc)


@api.put("/tables/{item_id}", response_model=TableOut)
async def update_table(item_id: str, payload: TableIn, _=Depends(require_manager)):
    res = await db.tables.find_one_and_update(
        {"_id": item_id},
        {"$set": payload.model_dump()},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Tafel niet gevonden")
    return table_doc_to_out(res)


@api.delete("/tables/{item_id}")
async def delete_table(item_id: str, _=Depends(require_manager)):
    await db.tables.delete_one({"_id": item_id})
    return {"ok": True}


# ---- Orders ----
def order_doc_to_out(d: dict) -> dict:
    return {
        "id": d["_id"],
        "table_id": d.get("table_id"),
        "table_name": d.get("table_name"),
        "items": d.get("items", []),
        "total": d.get("total", 0),
        "discount": d.get("discount", 0.0),
        "promotion_id": d.get("promotion_id"),
        "status": d.get("status", "open"),
        "note": d.get("note"),
        "created_at": d.get("created_at"),
    }


def promo_is_active(p: dict) -> bool:
    if not p.get("active", True):
        return False
    now = now_utc()
    s, e = p.get("starts_at"), p.get("ends_at")
    if s:
        try:
            if datetime.fromisoformat(s) > now:
                return False
        except Exception:
            pass
    if e:
        try:
            if datetime.fromisoformat(e) < now:
                return False
        except Exception:
            pass
    return True


def calc_totals(items: list, promo: Optional[dict]):
    subtotal = round(sum(i["price"] * i["qty"] for i in items), 2)
    discount = 0.0
    if promo and promo_is_active(promo):
        if promo["type"] == "order_percent":
            discount = round(subtotal * (promo["value"] / 100.0), 2)
        elif promo["type"] == "item_fixed":
            ids = set(promo.get("menu_item_ids") or [])
            for it in items:
                if it["menu_item_id"] in ids:
                    discount += round(promo["value"] * it["qty"], 2)
    discount = min(discount, subtotal)
    return round(subtotal - discount, 2), round(discount, 2)


async def decrement_inventory(items: List[OrderItem]):
    for it in items:
        menu = await db.menu_items.find_one({"_id": it.menu_item_id})
        if not menu or not menu.get("inventory_id"):
            continue
        inv = await db.inventory_items.find_one({"_id": menu["inventory_id"]})
        if not inv:
            continue
        loose = inv.get("loose_units", 0)
        trays = inv.get("trays_in_storage", 0)
        per_tray = inv.get("units_per_tray", 0)
        remaining = it.qty
        take_loose = min(loose, remaining)
        loose -= take_loose
        remaining -= take_loose
        while remaining > 0 and trays > 0 and per_tray > 0:
            trays -= 1
            loose += per_tray
            take = min(loose, remaining)
            loose -= take
            remaining -= take
        if remaining > 0:
            loose -= remaining
        await db.inventory_items.update_one(
            {"_id": inv["_id"]},
            {"$set": {"loose_units": loose, "trays_in_storage": trays}},
        )


@api.get("/orders", response_model=List[OrderOut])
async def list_orders(status: Optional[str] = None, _=Depends(get_current_user)):
    q = {}
    if status:
        q["status"] = status
    items = await db.orders.find(q).sort("created_at", -1).to_list(1000)
    return [order_doc_to_out(d) for d in items]


@api.post("/orders", response_model=OrderOut)
async def create_order(payload: OrderIn, _=Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Bestelling is leeg")
    promo = None
    if payload.promotion_id:
        promo = await db.promotions.find_one({"_id": payload.promotion_id})
    items_dump = [i.model_dump() for i in payload.items]
    total, discount = calc_totals(items_dump, promo)
    item_id = str(uuid.uuid4())
    doc = {
        "_id": item_id,
        "table_id": payload.table_id,
        "table_name": payload.table_name,
        "items": items_dump,
        "total": total,
        "discount": discount,
        "promotion_id": payload.promotion_id if promo else None,
        "status": "open",
        "note": payload.note,
        "created_at": iso(now_utc()),
    }
    await db.orders.insert_one(doc)
    await decrement_inventory(payload.items)
    return order_doc_to_out(doc)


@api.post("/orders/{order_id}/items", response_model=OrderOut)
async def add_items_to_order(order_id: str, payload: OrderItemsAdd, _=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestelling niet gevonden")
    if order.get("status") != "open":
        raise HTTPException(status_code=400, detail="Alleen open bestellingen kunnen worden uitgebreid")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Geen items meegegeven")

    existing = list(order.get("items", []))
    for new_it in payload.items:
        nd = new_it.model_dump()
        merged = False
        for ex in existing:
            if ex["menu_item_id"] == nd["menu_item_id"] and ex["price"] == nd["price"]:
                ex["qty"] = ex.get("qty", 0) + nd["qty"]
                merged = True
                break
        if not merged:
            existing.append(nd)

    promo = None
    if order.get("promotion_id"):
        promo = await db.promotions.find_one({"_id": order["promotion_id"]})
    total, discount = calc_totals(existing, promo)

    res = await db.orders.find_one_and_update(
        {"_id": order_id},
        {"$set": {"items": existing, "total": total, "discount": discount}},
        return_document=True,
    )
    await decrement_inventory(payload.items)
    return order_doc_to_out(res)


@api.post("/orders/{order_id}/pay", response_model=OrderOut)
async def pay_order(order_id: str, _=Depends(get_current_user)):
    res = await db.orders.find_one_and_update(
        {"_id": order_id},
        {"$set": {"status": "paid", "paid_at": iso(now_utc())}},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Bestelling niet gevonden")
    return order_doc_to_out(res)


@api.delete("/orders/{order_id}")
async def delete_order(order_id: str, _=Depends(require_manager)):
    await db.orders.delete_one({"_id": order_id})
    return {"ok": True}


# ---- Users (admin only) ----
def user_doc_to_out(d: dict) -> dict:
    return {
        "id": str(d["_id"]),
        "email": d["email"],
        "name": d.get("name", ""),
        "role": d.get("role", "werknemer"),
    }


@api.get("/users")
async def list_users(_=Depends(require_admin)):
    users = await db.users.find().to_list(1000)
    return [user_doc_to_out(u) for u in users]


@api.post("/users")
async def create_user(payload: UserCreateIn, _=Depends(require_admin)):
    if payload.role not in ROLE_LEVEL:
        raise HTTPException(status_code=400, detail="Ongeldige rol")
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-mail al in gebruik")
    res = await db.users.insert_one({
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "created_at": iso(now_utc()),
    })
    u = await db.users.find_one({"_id": res.inserted_id})
    return user_doc_to_out(u)


@api.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdateIn, _=Depends(require_admin)):
    upd = {}
    if payload.name is not None:
        upd["name"] = payload.name
    if payload.role is not None:
        if payload.role not in ROLE_LEVEL:
            raise HTTPException(status_code=400, detail="Ongeldige rol")
        upd["role"] = payload.role
    if payload.password:
        upd["password_hash"] = hash_password(payload.password)
    if not upd:
        raise HTTPException(status_code=400, detail="Niets om bij te werken")
    res = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": upd},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")
    return user_doc_to_out(res)


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, current=Depends(require_admin)):
    if str(current["id"]) == user_id:
        raise HTTPException(status_code=400, detail="Je kan jezelf niet verwijderen")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"ok": True}


# ---- Promotions (admin only for mutations, any user for read) ----
def promo_doc_to_out(d: dict) -> dict:
    return {
        "id": d["_id"],
        "name": d["name"],
        "type": d["type"],
        "value": d["value"],
        "menu_item_ids": d.get("menu_item_ids", []),
        "active": d.get("active", True),
        "starts_at": d.get("starts_at"),
        "ends_at": d.get("ends_at"),
    }


@api.get("/promotions", response_model=List[PromotionOut])
async def list_promotions(_=Depends(get_current_user)):
    items = await db.promotions.find().sort("name", 1).to_list(1000)
    return [promo_doc_to_out(d) for d in items]


@api.post("/promotions", response_model=PromotionOut)
async def create_promotion(payload: PromotionIn, _=Depends(require_admin)):
    if payload.type not in ("order_percent", "item_fixed"):
        raise HTTPException(status_code=400, detail="Ongeldig type")
    item_id = str(uuid.uuid4())
    doc = {"_id": item_id, **payload.model_dump(), "created_at": iso(now_utc())}
    await db.promotions.insert_one(doc)
    return promo_doc_to_out(doc)


@api.put("/promotions/{promo_id}", response_model=PromotionOut)
async def update_promotion(promo_id: str, payload: PromotionIn, _=Depends(require_admin)):
    if payload.type not in ("order_percent", "item_fixed"):
        raise HTTPException(status_code=400, detail="Ongeldig type")
    res = await db.promotions.find_one_and_update(
        {"_id": promo_id},
        {"$set": payload.model_dump()},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Promotie niet gevonden")
    return promo_doc_to_out(res)


@api.delete("/promotions/{promo_id}")
async def delete_promotion(promo_id: str, _=Depends(require_admin)):
    await db.promotions.delete_one({"_id": promo_id})
    return {"ok": True}


# ---- Reset (admin only) ----
@api.post("/dev/reset-menu-inventory")
async def reset_menu_inventory(_=Depends(require_admin)):
    """Clear menu + inventory + seed marker so seed_data re-runs."""
    await db.menu_items.delete_many({})
    await db.inventory_items.delete_many({})
    await db.app_meta.delete_one({"key": "seeded_v1"})
    await seed_data()
    return {"ok": True}


# ---- Register router & CORS ----
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
