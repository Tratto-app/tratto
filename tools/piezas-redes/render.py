import os, asyncio
from playwright.async_api import async_playwright
D=os.path.dirname(os.path.abspath(__file__))
os.makedirs(D+"/salida",exist_ok=True)
PIEZAS={'perfil':('01-foto-de-perfil.png',2**0),'portada':('02-portada-facebook.png',1),'post1':('03-post-presentacion.png',1),
        'post2':('04-post-como-funciona.png',1),'post3':('05-post-proveedores.png',1),
        'cartel-prov':('06-cartel-proveedores-A4.png',2),'cartel-cli':('07-cartel-vecinos-A4.png',2)}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
            proxy={"server":os.environ["HTTPS_PROXY"]},args=["--disable-background-networking"])
        for escala in (1,2):
            pg=await (await b.new_context(viewport={"width":1800,"height":1200},device_scale_factor=escala,ignore_https_errors=True)).new_page()
            await pg.goto(f"file://{D}/piezas.html",wait_until="networkidle"); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(500)
            if escala==1: print('fuentes:',await pg.evaluate("[...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family))]"))
            for id_,(nombre,esc) in PIEZAS.items():
                if esc==escala:
                    await pg.locator('#'+id_).screenshot(path=f"{D}/salida/{nombre}")
        # PDF A4 de los carteles
        for id_,nombre in (('cartel-prov','06-cartel-proveedores-A4.pdf'),('cartel-cli','07-cartel-vecinos-A4.pdf')):
            pg=await (await b.new_context(ignore_https_errors=True)).new_page()
            await pg.goto(f"file://{D}/piezas.html",wait_until="networkidle"); await pg.evaluate("document.fonts.ready")
            await pg.evaluate("""id=>{const el=document.getElementById(id);document.body.innerHTML='';document.body.appendChild(el);
              document.body.style.cssText='margin:0;padding:0;background:#FCFBF8;display:block';
              const s=document.createElement('style');s.textContent='@page{size:1240px 1754px;margin:0}';document.head.appendChild(s)}""",id_)
            await pg.pdf(path=f"{D}/salida/{nombre}",width="1240px",height="1754px",print_background=True,page_ranges="1")
        await b.close()
asyncio.run(main())
