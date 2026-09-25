import os, asyncio, base64
from playwright.async_api import async_playwright
D=os.path.dirname(os.path.abspath(__file__))
PANTALLAS=[('c-02-pedido.png','Proveedores de tu zona','Te conectamos con <em>quien sabe</em>'),
           ('c-04-chat.png','Chat y presupuesto','Presupuestos <em>claros</em>, en el chat'),
           ('c-03-comparacion.png','Comparador con IA','Compará y <em>elegí vos</em>'),
           ('c-01-inicio.png','Tus pedidos','Todo en <em>un solo lugar</em>'),
           ('c-00-entrada.png','Tratto','Del pedido al presupuesto, <em>sin vueltas</em>')]
TAM={'ios':(1290,2796,dict(pad=150,eti=34,h1=112,gap=40,telw=1010,rad=64)),
     'play':(1080,1920,dict(pad=90,eti=26,h1=84,gap=26,telw=640,rad=40))}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",proxy={"server":os.environ["HTTPS_PROXY"]},args=["--disable-background-networking"])
        pg=await b.new_page(viewport={'width':1400,'height':3000})
        await pg.goto(f'file://{D}/marco.html',wait_until='networkidle'); await pg.evaluate('document.fonts.ready')
        os.makedirs(D+'/salida',exist_ok=True)
        for tienda,(W,Hh,c) in TAM.items():
            for i,(img,eti,tit) in enumerate(PANTALLAS,1):
                datos=base64.b64encode(open(D+'/'+img,'rb').read()).decode()
                html=(f"<div class='m' id='x' style='width:{W}px;height:{Hh}px;padding-top:{c['pad']}px'>"
                      f"<div class='eti' style='font-size:{c['eti']}px'>{eti}</div>"
                      f"<h1 style='font-size:{c['h1']}px;margin:{c['gap']}px {c['pad']*0.6}px {c['gap']*2.2}px'>{tit}</h1>"
                      f"<div class='tel' style='width:{c['telw']}px;border-radius:{c['rad']}px'><img src='data:image/png;base64,{datos}'></div></div>")
                await pg.evaluate("h=>document.body.innerHTML=h",html); await pg.wait_for_timeout(300)
                await pg.locator('#x').screenshot(path=f"{D}/salida/{tienda}-{i}.png")
        await b.close()
asyncio.run(main())
