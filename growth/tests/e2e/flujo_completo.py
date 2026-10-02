#!/usr/bin/env python3
"""Prueba de punta a punta del Growth OS contra un proyecto Supabase (staging).

Recorre el camino completo con las Edge Functions y la base reales:
  prospecto nuevo -> automatización de bienvenida -> respuesta "me interesa"
  -> automatización de interesados (link personal) -> click en el link
  -> install / register / first_action desde la "app" (growth-event)
  -> prospecto activado y métricas actualizadas.

Solo usa la librería estándar. Necesita estas variables de entorno (nunca
se guardan en el repo):
  GROWTH_SUPABASE_URL      https://<proyecto>.supabase.co
  GROWTH_ANON_KEY          clave pública (anon o sb_publishable_...)
  GROWTH_DEMO_EMAIL        usuario miembro del workspace demo
  GROWTH_DEMO_PASSWORD
  GROWTH_WORKSPACE_SLUG    (opcional, por defecto "demo")

Crea un prospecto de prueba con email e2e-<hora>@example.com dentro del
workspace demo. No borra nada (queda como un prospecto más de la demo).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

URL = os.environ["GROWTH_SUPABASE_URL"].rstrip("/")
ANON = os.environ["GROWTH_ANON_KEY"]
SLUG = os.environ.get("GROWTH_WORKSPACE_SLUG", "demo")
FN = f"{URL}/functions/v1"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):  # devolvemos el 302 tal cual
        return None


def call(method, url, body=None, token=None, headers=None, follow=True):
    h = {"apikey": ANON, "content-type": "application/json"}
    if token:
        h["authorization"] = f"Bearer {token}"
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw and r.headers.get("content-type", "").startswith("application/json") else raw), r.headers
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw), e.headers
        except Exception:
            return e.code, raw, e.headers


fallos = 0


def check(nombre, cond, detalle=""):
    global fallos
    print(("OK   " if cond else "FALLA") + f"  {nombre}" + (f"  ({detalle})" if detalle and not cond else ""))
    if not cond:
        fallos += 1


def rest(method, path, token, body=None, prefer=None):
    return call(method, f"{URL}/rest/v1/{path}", body, token, {"Prefer": prefer} if prefer else None)


def rpc(name, args, token):
    return call("POST", f"{URL}/rest/v1/rpc/{name}", args, token)


def main():
    # 1. Sesión del usuario demo
    s, auth, _ = call("POST", f"{URL}/auth/v1/token?grant_type=password",
                      {"email": os.environ["GROWTH_DEMO_EMAIL"], "password": os.environ["GROWTH_DEMO_PASSWORD"]})
    check("login del usuario demo", s == 200, s)
    if s != 200:
        sys.exit(1)
    tok = auth["access_token"]

    s, ws, _ = rest("GET", f"growth_workspaces?slug=eq.{SLUG}&select=id,is_demo", tok)
    check("ve su workspace (RLS)", s == 200 and len(ws) == 1, ws)
    ws_id = ws[0]["id"]

    # 2. Prospecto nuevo (dispara la automatización "Bienvenida")
    email = f"e2e-{int(time.time())}@example.com"
    s, src, _ = rest("GET", f"growth_sources?workspace_id=eq.{ws_id}&key=eq.instagram&select=id", tok)
    s, p, _ = rest("POST", "growth_prospects", tok, {
        "workspace_id": ws_id, "first_name": "Prueba", "last_name": "E2E", "email": email,
        "instagram": "@demo_e2e", "city": "CABA", "source_id": src[0]["id"],
    }, prefer="return=representation")
    check("crea el prospecto", s == 201, p)
    p = p[0]
    pid, ref = p["id"], p["ref"]
    check("el score se calcula solo", p["score"] > 0, p["score"])

    # 3. IA: análisis aplicado al prospecto
    s, ai, _ = call("POST", f"{FN}/growth-ai", {"workspace_id": ws_id, "action": "analyze", "prospect_id": pid, "apply": True}, tok)
    check("growth-ai analyze", s == 200 and ai.get("ok") and "score" in ai["output"], ai)

    # 4. Automatizaciones: corre la bienvenida (análisis + primer mensaje + espera respuesta)
    s, au, _ = call("POST", f"{FN}/growth-automations", {"workspace_id": ws_id}, tok)
    check("growth-automations procesa", s == 200 and au.get("ok"), au)
    s, msgs, _ = rest("GET", f"growth_messages?prospect_id=eq.{pid}&select=direction,status,ai_generated", tok)
    check("se mandó el primer mensaje (simulado)", any(m["direction"] == "out" and m["status"] == "mock_sent" for m in msgs), msgs)
    s, runs, _ = rest("GET", f"growth_workflow_runs?prospect_id=eq.{pid}&select=status,waiting_reply", tok)
    check("la bienvenida queda esperando respuesta", any(r["status"] == "waiting" and r["waiting_reply"] for r in runs), runs)

    # 5. Llega una respuesta: la IA la lee y lo marca interesado
    s, inb, _ = call("POST", f"{FN}/growth-send", {"workspace_id": ws_id, "action": "inbound", "prospect_id": pid,
                                                    "channel": "instagram", "body": "Me interesa, pasame el link para descargarla"}, tok)
    check("growth-send inbound + análisis", s == 200 and inb.get("analysis", {}).get("intent") == "high", inb)
    s, pp, _ = rest("GET", f"growth_prospects?id=eq.{pid}&select=status,interest,replied_at", tok)
    check("queda interesado", pp[0]["status"] == "interested" and pp[0]["interest"] == "high", pp)

    # 6. Automatizaciones: retoma la bienvenida y arranca "Interesados -> link"
    s, au, _ = call("POST", f"{FN}/growth-automations", {"workspace_id": ws_id}, tok)
    check("growth-automations retoma", s == 200, au)
    s, pp, _ = rest("GET", f"growth_prospects?id=eq.{pid}&select=status,link_sent_at", tok)
    check("se le mandó su link personal", pp[0]["status"] == "link_sent" and pp[0]["link_sent_at"], pp)

    # 7. Click en el link desde un Android
    s, links, _ = rest("GET", f"growth_tracking_links?workspace_id=eq.{ws_id}&slug=like.demo-lanzamiento*&select=slug", tok)
    slug = links[0]["slug"]
    s, _, h = call("GET", f"{FN}/growth-go/{slug}?r={ref}", None, None,
                   {"user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36"}, follow=False)
    loc = h.get("location", "") if h else ""
    check("growth-go redirige a Google Play", s == 302 and "play.google.com" in loc and "referrer=" in loc, f"{s} {loc}")
    referrer = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query).get("referrer", [""])[0]
    click_token = urllib.parse.parse_qs(referrer).get("gid", [""])[0]
    check("el referrer de Play trae el id del click", len(click_token) == 24, referrer)
    s, _, _ = call("GET", f"{FN}/growth-go/{slug}?r={ref}", None, None, {"user-agent": "WhatsApp/2.23"}, follow=False)
    check("la vista previa de WhatsApp no cuenta como click", s == 200, s)

    # 8. La "app" informa install, register y first_action con la clave de ingesta
    s, key, _ = rpc("growth_rotate_ingest_key", {"ws": ws_id}, tok)
    check("genera la clave de ingesta", s == 200 and str(key).startswith("gk_"), key)
    ext = f"e2e-user-{int(time.time())}"
    evs = [
        {"event": "install", "external_user_id": ext, "click_token": click_token, "platform": "android"},
        {"event": "first_open", "external_user_id": ext},
        {"event": "sign_up", "external_user_id": ext, "email": email, "properties": {"method": "email"}},
        {"event": "first_action", "external_user_id": ext, "idempotency_key": f"{ext}-fa"},
        {"event": "first_action", "external_user_id": ext, "idempotency_key": f"{ext}-fa"},
    ]
    s, r, _ = call("POST", f"{FN}/growth-event", {"events": evs}, None, {"x-growth-key": key})
    check("growth-event acepta el lote", s == 200 and r.get("ok"), r)
    check("el evento repetido se ignora (idempotencia)", r["results"][-1].get("duplicate") is True, r)
    s, bad, _ = call("POST", f"{FN}/growth-event", {"event": "install"}, None, {"x-growth-key": "gk_" + "0" * 48})
    check("una clave inválida se rechaza", s == 401, s)

    s, pp, _ = rest("GET", f"growth_prospects?id=eq.{pid}&select=status,clicked_at,installed_at,registered_at,activated_at,app_user_id,score", tok)
    p = pp[0]
    check("prospecto ACTIVADO y vinculado al usuario de la app",
          p["status"] == "activated" and p["app_user_id"] and p["installed_at"] and p["registered_at"] and p["activated_at"], p)
    s, tl, _ = rest("GET", f"growth_timeline?prospect_id=eq.{pid}&select=type&order=created_at", tok)
    tipos = [t["type"] for t in tl]
    check("la línea de tiempo tiene todo el recorrido",
          all(x in tipos for x in ["created", "message_out", "message_in", "click", "install", "register", "activation"]), tipos)

    # 9. Las métricas lo reflejan
    s, k, _ = rpc("growth_kpis", {"ws": ws_id, "p_from": "2000-01-01T00:00:00Z", "p_to": "2100-01-01T00:00:00Z"}, tok)
    check("growth_kpis responde", s == 200 and k["cur"]["activations"] >= 1, k)

    # 10. Aislamiento: el mismo token no puede ver otro workspace inexistente/ajeno
    s, otro, _ = call("POST", f"{FN}/growth-ai", {"workspace_id": "00000000-0000-0000-0000-000000000000", "action": "explain"}, tok)
    check("growth-ai rechaza un workspace ajeno", s == 403, s)

    print(f"\n{'TODO OK' if not fallos else f'{fallos} FALLAS'}  · prospecto de prueba: {email}")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
